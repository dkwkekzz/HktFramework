// V0 확장 — Cycle/Situation/Scenario/Step 스키마 검증과 등록, cycle:lint 골격.
import { ModuleContractRegistry, MODULE_ORDER } from './contracts.js';

const CYCLE_REQUIRED = ['id', 'title', 'status', 'playerFantasy', 'coreGameplayLoops', 'situations'];
const SITUATION_REQUIRED = [
  'id', 'title', 'regionStatePredicates', 'involvedSubjects', 'dependencyPressures',
  'observableSignals', 'autonomousEscalation', 'playerInterventionFamilies', 'persistentOutcomes',
];
const LOOP_REQUIRED = ['id', 'playerIntent', 'entrySignals', 'actions', 'worldOutputs', 'repeatVariationSources'];

export function validateCycleSpec(spec) {
  const errors = [];
  for (const k of CYCLE_REQUIRED) if (spec[k] == null) errors.push(`Cycle 필수 필드 누락: ${k}`);
  if (Array.isArray(spec.coreGameplayLoops)) {
    if (spec.coreGameplayLoops.length < 3) errors.push('Gameplay Loop 는 최소 3개');
    for (const loop of spec.coreGameplayLoops)
      for (const k of LOOP_REQUIRED) if (loop[k] == null) errors.push(`Loop ${loop.id ?? '?'} 필드 누락: ${k}`);
  }
  if (Array.isArray(spec.situations)) {
    if (spec.situations.length < 5) errors.push('Situation 은 최소 5개');
    for (const st of spec.situations)
      for (const k of SITUATION_REQUIRED) if (st[k] == null) errors.push(`Situation ${st.id ?? '?'} 필드 누락: ${k}`);
  }
  return errors;
}

export class CycleRegistry {
  #cycles = new Map(); // id → {spec, scenarios: Map, contracts: ModuleContractRegistry}

  registerCycle(spec) {
    const errors = validateCycleSpec(spec);
    if (errors.length) throw new Error(`Cycle ${spec?.id ?? '?'} 등록 실패:\n${errors.join('\n')}`);
    if (this.#cycles.has(spec.id)) throw new Error(`중복 Cycle: ${spec.id}`);
    this.#cycles.set(spec.id, { spec, scenarios: new Map(), contracts: new ModuleContractRegistry() });
    return spec.id;
  }

  getCycle(id) {
    const c = this.#cycles.get(id);
    if (!c) throw new Error(`미등록 Cycle: ${id}`);
    return c;
  }

  /** Scenario 를 Cycle(과 선택적 Situation)에 연결한다 */
  attachScenario(cycleId, { id, situationId = null, kind = 'base' }) {
    const c = this.getCycle(cycleId);
    if (c.scenarios.has(id)) throw new Error(`중복 Scenario: ${id}`);
    if (situationId && !c.spec.situations.some((s) => s.id === situationId))
      throw new Error(`Scenario ${id} 가 미지 Situation ${situationId} 를 참조`);
    c.scenarios.set(id, { id, situationId, kind });
  }

  attachSteps(cycleId, steps, { externalArtifacts = [], terminalArtifacts = [] } = {}) {
    const c = this.getCycle(cycleId);
    c.contracts.registerExternalArtifacts(externalArtifacts);
    c.contracts.registerTerminalArtifacts(terminalArtifacts);
    for (const s of steps) c.contracts.registerStep(s);
  }

  /** cycle:lint 골격 — 필수 요소·모듈 커버리지·의존성 검사 */
  lint(cycleId) {
    const c = this.getCycle(cycleId);
    const errors = [];
    const warnings = [];
    const covered = c.contracts.modulesCovered();
    for (const m of MODULE_ORDER) if (!covered.includes(m)) errors.push(`모듈 Step 누락 (SKIP 금지): ${m}`);
    for (const st of c.spec.situations) {
      const linked = [...c.scenarios.values()].some((sc) => sc.situationId === st.id);
      if (!linked) errors.push(`Scenario 없는 Situation: ${st.id}`);
    }
    if (c.scenarios.size === 0) errors.push('Cycle 에 Scenario 가 없음');
    const dep = c.contracts.checkDependencies();
    errors.push(...dep.errors);
    warnings.push(...dep.warnings);
    return { errors, warnings, scenarioCount: c.scenarios.size, stepCount: c.contracts.stepCount, modulesCovered: covered };
  }
}
