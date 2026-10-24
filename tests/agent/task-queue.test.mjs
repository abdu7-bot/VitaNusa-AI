import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import the task queue module
import { createTaskQueue } from '../../scripts/agent/task-queue.mjs';

test('task queue can be created', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  assert.ok(queue);
  assert.ok(existsSync(dir));
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can enqueue tasks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  const task = queue.enqueue({
    id: 'T001',
    title: 'Test Task',
    priority: 'P1',
  });
  
  assert.equal(task.id, 'T001');
  assert.equal(task.status, 'READY');
  assert.ok(task.enqueuedAt);
  
  const savedQueue = queue.loadQueue();
  assert.equal(savedQueue.length, 1);
  assert.equal(savedQueue[0].id, 'T001');
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can claim tasks atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  
  const claimed = queue.claim('T001', 'worker-1');
  assert.equal(claimed.status, 'RUNNING');
  assert.equal(claimed.claimedBy, 'worker-1');
  assert.ok(claimed.claimedAt);
  
  const state = queue.loadState();
  assert.equal(state.activeTasks.length, 1);
  assert.equal(state.activeTasks[0].taskId, 'T001');
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue prevents claiming non-READY tasks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.claim('T001', 'worker-1');
  queue.release('T001', 'COMPLETED', {});
  
  // Now try to claim T001 again (should fail because not READY)
  assert.throws(() => {
    queue.claim('T001', 'worker-2');
  }, /not READY/);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue enforces concurrency limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Task 1', priority: 'P1' });
  queue.enqueue({ id: 'T002', title: 'Task 2', priority: 'P2' });
  
  queue.claim('T001', 'worker-1');
  
  assert.throws(() => {
    queue.claim('T002', 'worker-2');
  }, /Maximum concurrent workers/);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can release tasks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.claim('T001', 'worker-1');
  queue.release('T001', 'COMPLETED', { testsPassed: true });
  
  const savedQueue = queue.loadQueue();
  assert.equal(savedQueue[0].status, 'COMPLETED');
  
  const state = queue.loadState();
  assert.equal(state.activeTasks.length, 0);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can cancel tasks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.cancel('T001');
  
  const savedQueue = queue.loadQueue();
  assert.equal(savedQueue[0].status, 'CANCELLED');
  assert.ok(savedQueue[0].cancelledAt);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can pause and resume', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.pause();
  const state1 = queue.loadState();
  assert.equal(state1.paused, true);
  
  queue.resume();
  const state2 = queue.loadState();
  assert.equal(state2.paused, false);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue blocks claim when paused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.pause();
  
  assert.throws(() => {
    queue.claim('T001', 'worker-1');
  }, /Queue is paused/);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue can recover from failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.claim('T001', 'worker-1');
  
  // Simulate recovery
  const recovered = queue.recover();
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].id, 'T001');
  
  const savedQueue = queue.loadQueue();
  assert.equal(savedQueue[0].status, 'READY');
  
  const state = queue.loadState();
  assert.equal(state.activeTasks.length, 0);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue provides status', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Task 1', priority: 'P1' });
  queue.enqueue({ id: 'T002', title: 'Task 2', priority: 'P2' });
  queue.claim('T001', 'worker-1');
  
  const status = queue.getStatus();
  assert.equal(status.queueLength, 2);
  assert.equal(status.readyCount, 1);
  assert.equal(status.runningCount, 1);
  assert.equal(status.activeCount, 1);
  assert.equal(status.maxConcurrent, 1);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue sorts by priority', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T002', title: 'Task 2', priority: 'P2' });
  queue.enqueue({ id: 'T001', title: 'Task 1', priority: 'P1' });
  queue.enqueue({ id: 'T003', title: 'Task 3', priority: 'P3' });
  
  const savedQueue = queue.loadQueue();
  assert.equal(savedQueue[0].id, 'T001');
  assert.equal(savedQueue[1].id, 'T002');
  assert.equal(savedQueue[2].id, 'T003');
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue prevents duplicate enqueue', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  
  assert.throws(() => {
    queue.enqueue({ id: 'T001', title: 'Duplicate', priority: 'P1' });
  }, /already in queue/);
  
  rmSync(dir, { recursive: true, force: true });
});

test('task queue writes audit log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitanusa-queue-'));
  const queue = createTaskQueue(dir);
  
  queue.enqueue({ id: 'T001', title: 'Test Task', priority: 'P1' });
  queue.claim('T001', 'worker-1');
  queue.release('T001', 'COMPLETED', { testsPassed: true });
  
  const auditLog = readFileSync(join(dir, 'audit.log'), 'utf8');
  assert.ok(auditLog.includes('ENQUEUE'));
  assert.ok(auditLog.includes('CLAIM'));
  assert.ok(auditLog.includes('RELEASE'));
  
  rmSync(dir, { recursive: true, force: true });
});
