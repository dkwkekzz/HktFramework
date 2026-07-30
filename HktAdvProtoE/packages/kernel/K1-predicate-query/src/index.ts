export { QueryRejection } from './errors.js';
export { causesOf, deepEqual, evaluate } from './evaluate.js';
export { resolveBinding, resolvePath, type Resolution } from './path.js';
export { planQuery, runQuery, runQueryByFullScan } from './plan.js';
export {
  buildWorld,
  createK1Module,
  executeK1,
  validateInput,
  validateOutput,
  K1_PURPOSE,
  K1_VERSION,
  type K1CheckResult,
  type K1Input,
  type K1Output,
  type K1QueryResult,
  type K1World,
} from './module.js';
export {
  PATH_PATTERN,
  POSITION_COMPONENT,
  QUERY_ISSUE,
  type BindingTable,
  type PlanSource,
  type PredicateCause,
  type PredicateOp,
  type PredicateResult,
  type PredicateSpec,
  type PredicateTrace,
  type QueryCandidate,
  type QueryIssueCode,
  type QueryPlan,
  type QueryReport,
  type QuerySource,
  type QuerySpec,
} from './types.js';
