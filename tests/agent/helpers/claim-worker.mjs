import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const runtimeDir = process.argv[2];
const taskId = process.argv[3];
const workerId = process.argv[4];

const lockFile = join(runtimeDir, `claim-${taskId}.lock`);
mkdirSync(runtimeDir, { recursive: true });

try {
  writeFileSync(lockFile, JSON.stringify({ taskId, workerId, claimedAt: new Date().toISOString(), fencingToken: Date.now() }), { flag: 'wx', mode: 0o600 });
  process.send({ workerId, claimed: { success: true, lockFile } });
} catch (e) {
  if (e.code === 'EEXIST') {
    try {
      const existing = JSON.parse(readFileSync(lockFile, 'utf8'));
      const claimedAt = new Date(existing.claimedAt).getTime();
      if (Date.now() - claimedAt > 31 * 60 * 1000) {
        rmSync(lockFile, { force: true });
        try {
          writeFileSync(lockFile, JSON.stringify({ taskId, workerId, claimedAt: new Date().toISOString(), fencingToken: Date.now() }), { flag: 'wx', mode: 0o600 });
          process.send({ workerId, claimed: { success: true, lockFile, stale: true } });
        } catch (retryErr) {
          if (retryErr.code === 'EEXIST') {
            process.send({ workerId, claimed: { success: false, reason: 'Task already claimed by another worker' } });
          } else {
            process.send({ workerId, claimed: { success: false, reason: retryErr.message } });
          }
        }
      }
    } catch {}
    process.send({ workerId, claimed: { success: false, reason: 'Task already claimed by another worker' } });
  } else {
    process.send({ workerId, claimed: { success: false, reason: `Unexpected error: ${e.message}` } });
  }
}
