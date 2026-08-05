// O0 — 세계관 공리: AxiomSpec 스키마, 레지스트리, phase 별 검증 함수 (헌법 §16 구조).
// 공리는 전면 콘텐츠가 아니라 능력·소유권·세계 변화를 일관되게 작동시키는 기반이다.
//
// AxiomContext 관례:
//   { phase, before?, after?, input, eventId?, traceId }
//   - runtime_transition   : input = { events: [{type, payload, actor?, statePaths?}], observedPaths?: [] }
//   - world_compile        : input = { proposal: {creates?: [], modifies?: []}, observedPaths?: [] }
//   - authority_resolution : input = { resource, claims: [{by}], accepted: [{by}], resolvedBy }
import { stateHash } from '../../verification/src/deterministic.js';

export const AXIOM_PHASES = ['definition', 'world_compile', 'runtime_transition', 'authority_resolution'];
export const AXIOM_SEVERITIES = ['error', 'warning'];

export class AxiomRegistry {
  #axioms = new Map(); // id → {spec, evaluator}

  register(spec, evaluator) {
    for (const k of ['id', 'description', 'phases', 'severity', 'evaluatorId'])
      if (spec[k] == null) throw new Error(`AxiomSpec 필드 누락: ${k} (${spec.id ?? '?'})`);
    for (const p of spec.phases)
      if (!AXIOM_PHASES.includes(p)) throw new Error(`미지 phase ${p} (${spec.id})`);
    if (!AXIOM_SEVERITIES.includes(spec.severity)) throw new Error(`미지 severity ${spec.severity} (${spec.id})`);
    if (typeof evaluator !== 'function') throw new Error(`평가기 없음 (${spec.id})`);
    if (this.#axioms.has(spec.id)) throw new Error(`중복 공리: ${spec.id}`);
    this.#axioms.set(spec.id, { spec: structuredClone(spec), evaluator });
  }

  get(id) {
    const a = this.#axioms.get(id);
    if (!a) throw new Error(`미등록 공리: ${id}`);
    return a;
  }

  listByPhase(phase) {
    return [...this.#axioms.values()].filter((a) => a.spec.phases.includes(phase));
  }

  /** 등록 순서와 무관한 결정적 스냅샷 — registryHash 의 근거 */
  snapshot() {
    const axioms = [...this.#axioms.values()].map((a) => a.spec).sort((x, y) => x.id.localeCompare(y.id));
    return { axioms, hash: stateHash({ axioms }) };
  }

  /** phase 에 등록된 공리 전부를 실행 — 평가기 예외는 은폐하지 않고 실패 결과로 노출 */
  evaluate(ctx) {
    const results = [];
    for (const { spec, evaluator } of this.listByPhase(ctx.phase)) {
      try {
        results.push({ severity: spec.severity, ...evaluator(ctx) });
      } catch (e) {
        results.push({
          axiomId: spec.id, severity: spec.severity, passed: false,
          violationCode: 'EVALUATOR_ERROR', message: e.message, statePaths: [],
        });
      }
    }
    const violations = results.filter((r) => !r.passed);
    return {
      phase: ctx.phase,
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      results,
      violations,
    };
  }
}

export function validateDefinition(candidate, registry, extra = {}) {
  return registry.evaluate({ phase: 'definition', input: candidate, ...extra });
}
export function validateWorldProposal(proposal, registry, extra = {}) {
  return registry.evaluate({ phase: 'world_compile', input: proposal, ...extra });
}
export function validateTransition(transition, registry) {
  return registry.evaluate({ phase: 'runtime_transition', ...transition });
}
export function validateAuthorityResolution(resolution, registry, extra = {}) {
  return registry.evaluate({ phase: 'authority_resolution', input: resolution, ...extra });
}

/** before/after 의 변경된 상태 경로 목록 (점 표기, 결정적 순서) */
export function changedPaths(before, after, prefix = '') {
  if (Object.is(before, after)) return [];
  const isObj = (v) => v && typeof v === 'object';
  if (!isObj(before) || !isObj(after)) return [prefix || '(root)'];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const out = [];
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in before) || !(k in after)) { out.push(path); continue; }
    out.push(...changedPaths(before[k], after[k], path));
  }
  return out;
}
