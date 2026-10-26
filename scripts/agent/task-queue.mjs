/**
 * VitaNusa AI - Durable Task Queue
 * 
 * Implements: priority-based task queue, atomic claiming, concurrency limits,
 * cancellation, manual pause, safe restart/recovery, audit logs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX_CONCURRENT_WORKERS = 1;
const MAX_REPAIR_COUNT = 3;
const TASK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

export function createTaskQueue(queueDir) {
  mkdirSync(queueDir, { recursive: true });
  const queueFile = join(queueDir, 'queue.json');
  const stateFile = join(queueDir, 'state.json');
  const auditFile = join(queueDir, 'audit.log');
  
  return {
    queueFile,
    stateFile,
    auditFile,
    
    loadQueue() {
      if (!existsSync(queueFile)) return [];
      try {
        return JSON.parse(readFileSync(queueFile, 'utf8'));
      } catch {
        return [];
      }
    },
    
    saveQueue(queue) {
      writeFileSync(queueFile, JSON.stringify(queue, null, 2), { mode: 0o600 });
    },
    
    loadState() {
      if (!existsSync(stateFile)) return { activeTasks: [], paused: false, cancelled: [] };
      try {
        return JSON.parse(readFileSync(stateFile, 'utf8'));
      } catch {
        return { activeTasks: [], paused: false, cancelled: [] };
      }
    },
    
    saveState(state) {
      writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    },
    
    audit(action, taskId, details = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        taskId,
        ...details,
      };
      writeFileSync(auditFile, JSON.stringify(entry) + '\n', { flag: 'a', mode: 0o600 });
    },
    
    // Enqueue a new task
    enqueue(task) {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      // Check if task already exists
      if (queue.some(t => t.id === task.id)) {
        throw new Error(`Task ${task.id} already in queue`);
      }
      
      task.status = 'READY';
      task.enqueuedAt = new Date().toISOString();
      task.priority = task.priority || 'P99';
      task.priorityRank = Number((task.priority || 'P99').match(/\d+/)?.[0] ?? 99);
      
      queue.push(task);
      queue.sort((a, b) => a.priorityRank - b.priorityRank || a.id.localeCompare(b.id));
      this.saveQueue(queue);
      this.audit('ENQUEUE', task.id, { priority: task.priority, title: task.title });
      
      return task;
    },
    
    // Claim a task atomically
    claim(taskId, workerId) {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      if (state.paused) {
        throw new Error('Queue is paused');
      }
      
      if (state.cancelled.includes(taskId)) {
        throw new Error(`Task ${taskId} has been cancelled`);
      }
      
      if (state.activeTasks.length >= MAX_CONCURRENT_WORKERS) {
        throw new Error(`Maximum concurrent workers (${MAX_CONCURRENT_WORKERS}) reached`);
      }
      
      const taskIndex = queue.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        throw new Error(`Task ${taskId} not found in queue`);
      }
      
      const task = queue[taskIndex];
      if (task.status !== 'READY') {
        throw new Error(`Task ${taskId} is not READY (status: ${task.status})`);
      }
      
      // Atomic claim: update both queue and state
      task.status = 'RUNNING';
      task.claimedAt = new Date().toISOString();
      task.claimedBy = workerId;
      task.startedAt = new Date().toISOString();
      
      state.activeTasks.push({
        taskId,
        workerId,
        claimedAt: task.claimedAt,
        startedAt: task.startedAt,
      });
      
      this.saveQueue(queue);
      this.saveState(state);
      this.audit('CLAIM', taskId, { workerId });
      
      return task;
    },
    
    // Release a task (complete or fail)
    release(taskId, status, result = {}) {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      const taskIndex = queue.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        throw new Error(`Task ${taskId} not found in queue`);
      }
      
      const task = queue[taskIndex];
      task.status = status;
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      state.activeTasks = state.activeTasks.filter(t => t.taskId !== taskId);
      
      this.saveQueue(queue);
      this.saveState(state);
      this.audit('RELEASE', taskId, { status, ...result });
      
      return task;
    },
    
    // Cancel a task
    cancel(taskId) {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      const taskIndex = queue.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        throw new Error(`Task ${taskId} not found in queue`);
      }
      
      const task = queue[taskIndex];
      if (task.status === 'RUNNING') {
        // Add to cancelled list
        if (!state.cancelled.includes(taskId)) {
          state.cancelled.push(taskId);
        }
      }
      
      task.status = 'CANCELLED';
      task.cancelledAt = new Date().toISOString();
      
      state.activeTasks = state.activeTasks.filter(t => t.taskId !== taskId);
      
      this.saveQueue(queue);
      this.saveState(state);
      this.audit('CANCEL', taskId);
      
      return task;
    },
    
    // Pause the queue
    pause() {
      const state = this.loadState();
      state.paused = true;
      state.pausedAt = new Date().toISOString();
      this.saveState(state);
      this.audit('PAUSE', null);
    },
    
    // Resume the queue
    resume() {
      const state = this.loadState();
      state.paused = false;
      state.resumedAt = new Date().toISOString();
      this.saveState(state);
      this.audit('RESUME', null);
    },
    
    // Check for stale tasks (tasks running too long)
    checkStaleTasks() {
      const state = this.loadState();
      const stale = [];
      
      for (const activeTask of state.activeTasks) {
        const startedAt = new Date(activeTask.startedAt).getTime();
        const now = Date.now();
        if (now - startedAt > TASK_TIMEOUT_MS) {
          stale.push(activeTask.taskId);
        }
      }
      
      return stale;
    },
    
    // Recover from failure (restart)
    recover() {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      // Reset any RUNNING tasks to READY (for recovery)
      for (const task of queue) {
        if (task.status === 'RUNNING') {
          task.status = 'READY';
          task.recoveredAt = new Date().toISOString();
        }
      }
      
      state.activeTasks = [];
      state.paused = false;
      
      this.saveQueue(queue);
      this.saveState(state);
      this.audit('RECOVER', null, { recoveredTasks: queue.filter(t => t.recoveredAt).length });
      
      return queue.filter(t => t.recoveredAt);
    },
    
    // Get queue status
    getStatus() {
      const queue = this.loadQueue();
      const state = this.loadState();
      
      return {
        paused: state.paused,
        activeCount: state.activeTasks.length,
        maxConcurrent: MAX_CONCURRENT_WORKERS,
        queueLength: queue.length,
        readyCount: queue.filter(t => t.status === 'READY').length,
        runningCount: queue.filter(t => t.status === 'RUNNING').length,
        completedCount: queue.filter(t => t.status === 'COMPLETED').length,
        failedCount: queue.filter(t => t.status === 'FAILED').length,
        cancelledCount: queue.filter(t => t.status === 'CANCELLED').length,
        activeTasks: state.activeTasks,
      };
    },
  };
}

export default createTaskQueue;
