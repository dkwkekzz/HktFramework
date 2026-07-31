export { DeltaError, affectedEntities, applyStateDelta, applyStateDeltas } from './delta.js';
export { WorldRuntime, resimulate, type RuntimeOptions } from './runtime.js';
export {
  buildWorld,
  createK3Module,
  driveTicks,
  driveWorld,
  executeK3,
  validateInput,
  validateOutput,
  K3_PURPOSE,
  K3_VERSION,
  type IntentDriver,
  type K3Input,
  type K3Output,
  type K3World,
} from './module.js';
export {
  REPLAY_ISSUE,
  type InvariantReport,
  type JournalEntry,
  type ReplayIssueCode,
  type ScheduledEntry,
  type ScheduledEventTemplate,
  type SubmitResult,
  type WorldEvent,
  type WorldSnapshot,
} from './types.js';
