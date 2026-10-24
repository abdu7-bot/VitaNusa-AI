import { atomicClaim, releaseClaim } from '../../../scripts/agent/task-orchestrator.mjs';

const runtimeDir = process.argv[2];
const taskId = process.argv[3];
const workerId = process.argv[4];

const paths = {
  RUNTIME_DIR: runtimeDir,
  STATE_FILE: runtimeDir + '/state.json',
  EVIDENCE_DIR: runtimeDir + '/evidence',
  CHECKPOINT_DIR: runtimeDir + '/checkpoints',
  JOURNAL_DIR: runtimeDir + '/journal',
  LOCK_DIR: runtimeDir + '/locks',
};

const result = atomicClaim(paths, taskId, workerId);
process.send({ workerId, claimed: result });

if (result && result.success) {
  setTimeout(() => {
    releaseClaim(paths, taskId, workerId);
    process.exit(0);
  }, 500);
} else {
  process.exit(0);
}
