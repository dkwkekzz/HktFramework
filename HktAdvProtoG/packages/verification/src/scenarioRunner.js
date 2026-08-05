// V2 — Scenario Runner: 고정 초기 상태·입력을 재현 실행하고 해시 궤적·검증 결과를 낸다.
import { SeededRandom, stateHash, firstDivergence } from './deterministic.js';

export class ScenarioRunner {
  #scenarios = new Map();

  /**
   * scenario:
   *  id, cycleId,
   *  setup(rng) → 초기 세계 (상태를 소유한 객체여도 됨),
   *  inputs: 입력 배열,
   *  apply(world, input, rng) → {events} — 상태 변경은 world 내부에서 사건 경유로만,
   *  snapshot(world) → 해시 대상 상태,
   *  expect({world, events, trail}) → [{name, passed, detail}]
   */
  register(scenario) {
    for (const k of ['id', 'setup', 'inputs', 'apply', 'snapshot', 'expect'])
      if (scenario[k] == null) throw new Error(`Scenario ${scenario.id ?? '?'} 필드 누락: ${k}`);
    if (this.#scenarios.has(scenario.id)) throw new Error(`중복 Scenario 등록: ${scenario.id}`);
    this.#scenarios.set(scenario.id, scenario);
  }

  run(id, { seed = 1 } = {}) {
    const sc = this.#scenarios.get(id);
    if (!sc) throw new Error(`미등록 Scenario: ${id}`);
    const rng = new SeededRandom(seed);
    const world = sc.setup(rng);
    const trail = [stateHash(sc.snapshot(world))];
    const events = [];
    for (const input of sc.inputs) {
      const r = sc.apply(world, input, rng) ?? {};
      if (r.events) events.push(...r.events);
      trail.push(stateHash(sc.snapshot(world)));
    }
    const checks = sc.expect({ world, events, trail });
    return {
      scenario: id,
      cycleId: sc.cycleId ?? null,
      seed,
      passed: checks.every((c) => c.passed),
      checks,
      stateHashBefore: trail[0],
      stateHashAfter: trail[trail.length - 1],
      trail,
      events,
    };
  }

  /** 같은 Scenario 두 실행의 결정성 비교 — 최초 차이 입력 인덱스 보고 */
  static compare(runA, runB) {
    const idx = firstDivergence(runA.trail, runB.trail);
    return {
      identical: idx === -1,
      firstDivergenceIndex: idx,
      hashA: idx === -1 ? null : runA.trail[idx],
      hashB: idx === -1 ? null : runB.trail[idx],
    };
  }
}
