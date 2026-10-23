#!/usr/bin/env node
/**
 * VitaNusa AI - Operation Journal
 * Durable tracking of external side effects for crash recovery.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const OPERATION_STATES = {
  PLANNED: 'PLANNED',
  STARTED: 'STARTED',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
};

export function createJournal(journalDir) {
  mkdirSync(journalDir, { recursive: true });
  return {
    dir: journalDir,
    record(op) {
      const entry = {
        id: op.id || randomUUID(),
        taskId: op.taskId,
        attempt: op.attempt || 1,
        type: op.type,
        target: op.target,
        status: op.status || OPERATION_STATES.PLANNED,
        startedAt: op.startedAt || new Date().toISOString(),
        confirmedAt: op.confirmedAt || null,
        failedAt: op.failedAt || null,
        error: op.error || null,
        evidenceRef: op.evidenceRef || null,
      };
      const file = join(journalDir, `${entry.id}.json`);
      writeFileSync(file, JSON.stringify(entry, null, 2), { mode: 0o600 });
      return entry;
    },
    get(id) {
      const file = join(journalDir, `${id}.json`);
      if (!existsSync(file)) return null;
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    },
    update(id, updates) {
      const existing = this.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates };
      const file = join(journalDir, `${id}.json`);
      writeFileSync(file, JSON.stringify(updated, null, 2), { mode: 0o600 });
      return updated;
    },
    async listByTask(taskId) {
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(journalDir).filter(f => f.endsWith('.json'));
      const results = [];
      for (const f of files) {
        try {
          const entry = JSON.parse(readFileSync(join(journalDir, f), 'utf8'));
          if (entry.taskId === taskId) results.push(entry);
        } catch {}
      }
      return results;
    },
    isConfirmed(id) {
      const entry = this.get(id);
      return entry?.status === OPERATION_STATES.CONFIRMED;
    },
  };
}
