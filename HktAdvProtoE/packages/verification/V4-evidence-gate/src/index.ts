export {
  FAILED,
  STATUS_LADDER,
  isAtLeast,
  isLadderStatus,
  lowerOf,
  statusRank,
  type EvidenceStatus,
  type VerificationStatus,
} from './status.js';

export {
  GATE_IDS,
  GATE_NAMES,
  LADDER_EXPLANATION,
  blockingGates,
  deriveStatus,
  evaluateGates,
  type GateId,
  type GateResult,
  type Measurements,
} from './gates.js';

export {
  EVIDENCE_SCHEMA,
  EvidenceStore,
  evidenceHash,
  issueEvidence,
  validateEvidenceDocument,
  type EvidenceDocument,
  type IssueRequest,
} from './evidence.js';

export { IssueError, issueForModule, type IssueForModuleInput } from './issue.js';

export {
  auditRepository,
  contractHashOf,
  impactOf,
  measurementsFrom,
  type AuditInput,
  type AuditReport,
  type ModuleAudit,
} from './audit.js';

export {
  buildBoard,
  type Board,
  type BoardInput,
  type CompletionReport,
  type FailedCheck,
  type HashRow,
  type ReplayRow,
  type StatusRow,
} from './board.js';

export {
  V4_STEPS,
  editContractStep,
  forgeStatusStep,
  issueEvidenceStep,
  runAuditStep,
  setMeasurementStep,
  type EvidenceMeasurementRecord,
} from './steps.js';

export {
  checkOutputConsistency,
  createV4Module,
  executeV4,
  V4_INPUT_SCHEMA,
  V4_OUTPUT_SCHEMA,
  V4_PURPOSE,
  V4_VERSION,
  type V4Input,
  type V4Output,
} from './module.js';
