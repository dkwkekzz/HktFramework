export type {
  AssertionResult,
  LabCheck,
  LabRow,
  LabViewModel,
  ModuleContext,
  ModuleDefinition,
  ScenarioRun,
  VerificationIssue,
  VerificationScenario,
} from './contract.js';
export { runScenario } from './contract.js';

export { parseModuleContract, type ParseResult } from './parse.js';
export {
  buildRegistry,
  canonicalize,
  dependencyClosure,
  dependentClosure,
  topologicalOrder,
} from './registry.js';
export { sha256Hex, sha256Tagged } from './sha256.js';
export {
  createV0Module,
  validateInput,
  validateOutput,
  V0_PURPOSE,
  V0_VERSION,
  type V0Input,
  type V0Output,
} from './module.js';
export {
  ISSUE,
  type IssueCode,
  type ModuleCommands,
  type ModuleContract,
  type ModuleContractDocument,
  type ModuleRegistry,
  type RegistrationReport,
  type RejectedDocument,
} from './types.js';
