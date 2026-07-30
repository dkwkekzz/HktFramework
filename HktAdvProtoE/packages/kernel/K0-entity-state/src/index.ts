export { ComponentRegistry } from './components.js';
export { StoreRejection } from './errors.js';
export { applyOperation, applyOperations, type AppliedOperation } from './operations.js';
export { deepFreeze, EntityStore, OWNERSHIP_COMPONENT } from './store.js';
export {
  createK0Module,
  executeK0,
  validateInput,
  validateOutput,
  K0_PURPOSE,
  K0_VERSION,
  type K0Input,
  type K0Output,
} from './module.js';
export {
  NAME_PATTERN,
  STORE_ISSUE,
  type ComponentDefinition,
  type ComponentSnapshot,
  type ComponentType,
  type EntityId,
  type EntitySpec,
  type EntityState,
  type JsonObject,
  type JsonValue,
  type StoreIssueCode,
  type StoreOperation,
} from './types.js';
