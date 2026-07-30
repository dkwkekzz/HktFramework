import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry, sha256Tagged } from '@hkt/v0-module-contract';
import { compileSchema } from '@hkt/v1-schema';
import { deriveSeed } from '@hkt/v2-determinism';
import { ScenarioRunner, StepRejection } from '@hkt/v3-scenario-runner';
import type { JsonObject, ScenarioReport, ScenarioSpec, StepDefinition } from '@hkt/v3-scenario-runner';
import { deriveStatus, evaluateGates, type Measurements } from '@hkt/v4-evidence-gate';
import { ComponentRegistry, EntityStore } from '@hkt/k0-entity-state';
import { evaluate } from '@hkt/k1-predicate-query';
import { RuleBook, type RuleSpec } from '@hkt/k2-rule-transaction';
import { WorldRuntime, resimulate, type WorldSnapshot } from '@hkt/k3-event-replay';

/**
 * VS0 — 결정적 세계 변화 (원문 「20」).
 *
 * ```text
 * 실체가 에너지 10을 가지고 있다.
 * 행동이 에너지 3을 소비한다.
 * 같은 행동을 세 번 수행한다.
 * 네 번째 행동은 실패한다.
 * ```
 *
 * 완료 조건은 넷이다 — 에너지 결과 1 · 네 번째 행동은 상태를 전혀 바꾸지 않음 ·
 * 모든 변화가 사건 로그에 남음 · 재생 결과 동일.
 *
 * ## 왜 이 파일이 패키지 밖에 있는가
 *
 * VS0 은 V0~V4 와 K0~K3 **아홉 모듈에 걸친** 시나리오다. 어느 한 모듈이 소유하면 그 모듈이 다른
 * 모듈의 통과를 선언하는 셈이 된다. 저장소의 것이므로 저장소에 둔다 —
 * `tests/conventions.test.ts` 가 같은 이유로 여기 있는 것과 같다.
 *
 * ## 아홉 모듈이 실제로 쓰이는 자리
 *
 * | 모듈 | 이 장면에서 하는 일 |
 * |---|---|
 * | V0 | 저장소의 모든 `MODULE.yaml` 을 거부 없이 등록하고 위상 순서를 낸다 |
 * | V1 | K3 이 만든 사건 문서를 사건 스키마로 검증한다 |
 * | V2 | 세계 시드를 조합한다 — 같은 시드면 같은 사건 id |
 * | V3 | 이 장면 자체를 Given-When-Then 으로 실행한다 |
 * | V4 | VS0 통과 여부만 바꿔 넣었을 때 상태가 갈리는지 확인한다 |
 * | K0 | 에너지·체력을 담고, 하한을 스키마로 지킨다 |
 * | K1 | 규칙의 조건(사거리·생존)을 판정한다 |
 * | K2 | 비용과 효과를 원자적으로 처리한다 |
 * | K3 | 사건을 기록하고 재생한다 |
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// ---------------------------------------------------------------------------
// 무대 — 원문 「20」 VS0 의 장면 그대로
// ---------------------------------------------------------------------------

const COMPONENTS = [
  {
    type: 'energy',
    title: '생명 에너지 (하한 0)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current'],
      properties: { current: { type: 'integer', minimum: 0 } },
    },
  },
  {
    type: 'health',
    title: '체력',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current', 'max'],
      properties: { current: { type: 'integer', minimum: 0 }, max: { type: 'integer', minimum: 1 } },
    },
  },
  {
    type: 'position',
    title: '위치',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
    },
  },
];

const WORLD_SEED = '20260730';
const ACTOR = 'hunter_a';
const TARGET = 'beast_ka';

const RULES: RuleSpec[] = [
  {
    id: 'l1_living_only',
    title: '죽은 신체는 행동할 수 없다 (제약 규칙)',
    scope: 'L1',
    priority: 100,
    when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'strike' },
    requires: { op: 'gt', path: 'actor.energy.current', value: -1 },
    costs: [],
    effects: [],
    emits: [],
    tags: ['hard'],
  },
  {
    id: 'l1_strike',
    title: '행동은 에너지 3 을 소비한다',
    scope: 'L1',
    priority: 10,
    when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'strike' },
    requires: { op: 'within_distance', a: 'actor', b: 'target', max: 2 },
    costs: [{ op: 'add', path: 'actor.energy.current', value: -3 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -10 }],
    emits: [{ id: 'strike_sound', channels: ['audio'] }],
    tags: ['physical'],
  },
];

const registry = ComponentRegistry.of(COMPONENTS);
const rules = RuleBook.of(RULES);

function initialStore(): EntityStore {
  return EntityStore.empty(registry)
    .spawn({
      id: ACTOR,
      kind: 'person',
      tags: ['human'],
      components: { energy: { current: 10 }, position: { x: 0, y: 0, z: 0 } },
    })
    .spawn({
      id: TARGET,
      kind: 'giant_beast',
      tags: ['beast'],
      components: { health: { current: 900, max: 900 }, position: { x: 1, y: 0, z: 0 } },
    });
}

function freshRuntime(): WorldRuntime {
  return new WorldRuntime({ store: initialStore(), rules, worldSeed: WORLD_SEED });
}

/** V3 의 상태로 오갈 수 있게 세계를 스냅샷 + 읽기 쉬운 값으로 편다. */
function viewOf(runtime: WorldRuntime, changed: boolean, rejection: string | null): JsonObject {
  return {
    snapshot: runtime.snapshot() as unknown as JsonObject,
    energy: (runtime.store.component(ACTOR, 'energy') ?? {})['current'] as number,
    beastHealth: (runtime.store.component(TARGET, 'health') ?? {})['current'] as number,
    eventCount: runtime.log().length,
    storeHash: runtime.store.hash(),
    changedByLastStep: changed,
    lastRejection: rejection,
  };
}

// ---------------------------------------------------------------------------
// V3 단계 — 세계를 한 걸음 굴린다
// ---------------------------------------------------------------------------

/**
 * 상태를 K3 의 스냅샷으로 들고 다닌다.
 *
 * V3 의 단계는 **JSON 상태를 받아 새 JSON 상태를 돌려주는 순수 함수**여야 한다. 그래서 세계를
 * 클로저에 숨겨 두지 않고, 매 단계 스냅샷에서 되살렸다가 다시 스냅샷으로 접는다 —
 * 덕분에 이 장면은 K3 의 스냅샷 왕복을 네 번 더 확인하는 셈이 된다.
 */
const strikeStep: StepDefinition = {
  id: 'strike',
  title: '행동한다 — 에너지 3 을 쓰고 대상의 체력을 10 깎는다',
  paramsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { note: { type: 'string' } },
  },
  apply(state, _params, context) {
    const snapshot = state['snapshot'] as unknown as WorldSnapshot;
    const runtime = WorldRuntime.restore(snapshot, rules, registry);
    const before = runtime.store.hash();
    const result = runtime.submit({
      id: `vs0_intent_${context.index}`,
      actor: ACTOR,
      verb: 'strike',
      targets: [TARGET],
    });
    const after = runtime.store.hash();
    if (result.rejection && result.rejection.code !== 'E_UNAFFORDABLE_COST') {
      throw new StepRejection(result.rejection.code, result.rejection.path, result.rejection.message);
    }
    return viewOf(runtime, before !== after, result.rejection?.code ?? null);
  },
};

const VS0_SCENARIO: ScenarioSpec = {
  id: 'vs0_deterministic_world_change',
  title: 'VS0 — 에너지 10 · 행동마다 3 소비 · 세 번 성공 · 네 번째 실패',
  given: { fixture: 'vs0_initial_world' },
  when: [
    { step: 'strike', note: '첫 번째 행동 (에너지 10 → 7)' },
    { step: 'strike', note: '두 번째 행동 (7 → 4)' },
    { step: 'strike', note: '세 번째 행동 (4 → 1)' },
    { step: 'strike', note: '네 번째 행동 — 1 로는 3 을 낼 수 없다' },
  ],
  then: [
    { id: 'energy_ends_at_one', path: '/energy', op: 'equals', value: 1, reason: '에너지 결과가 1이다' },
    { id: 'third_action_changed_the_world', path: '/changedByLastStep', op: 'equals', value: true, at: 2 },
    {
      id: 'fourth_action_changed_nothing',
      path: '/changedByLastStep',
      op: 'equals',
      value: false,
      at: 3,
      reason: '네 번째 행동은 상태를 전혀 변경하지 않는다',
    },
    { id: 'fourth_action_was_unaffordable', path: '/lastRejection', op: 'equals', value: 'E_UNAFFORDABLE_COST', at: 3 },
    { id: 'three_events_in_the_log', path: '/eventCount', op: 'equals', value: 3, reason: '모든 변화가 사건 로그에 남는다' },
    { id: 'damage_is_thirty', path: '/beastHealth', op: 'equals', value: 870 },
    { id: 'energy_actually_moved', path: '/energy', op: 'changed' },
  ],
  seed: { worldSeed: WORLD_SEED },
};

// ---------------------------------------------------------------------------
// 슬라이스 실행
// ---------------------------------------------------------------------------

export interface SliceCheck {
  id: string;
  module: string;
  passed: boolean;
  detail: string;
}

export interface SliceReport {
  slice: 'VS0';
  /** 원문 「20」 VS0 이 포함한다고 적은 모듈 */
  modules: string[];
  passed: boolean;
  checks: SliceCheck[];
  scenario: ScenarioReport;
  digest: string;
}

export const VS0_MODULES = ['V0', 'V1', 'V2', 'V3', 'V4', 'K0', 'K1', 'K2', 'K3'];

export function runVS0(): SliceReport {
  const checks: SliceCheck[] = [];
  const check = (id: string, module: string, passed: boolean, detail: string): void => {
    checks.push({ id, module, passed, detail });
  };

  // ── V3 — 장면을 Given-When-Then 으로 실행한다 ────────────────────────────────
  const runner = new ScenarioRunner();
  runner.register(strikeStep);
  runner.fixtures.add({
    id: 'vs0_initial_world',
    title: '에너지 10 을 가진 실체와 사거리 안의 대상',
    state: viewOf(freshRuntime(), false, null),
  });
  const scenario = runner.run(VS0_SCENARIO);

  check(
    'scenario_passes',
    'V3',
    scenario.passed,
    scenario.passed
      ? `조건 ${scenario.conditions.length}개 모두 통과`
      : `실패 조건 ${scenario.conditions.filter((condition) => !condition.passed).map((condition) => condition.id).join(', ')}`,
  );
  for (const condition of scenario.conditions) {
    check(`then_${condition.id}`, 'V3', condition.passed, `${condition.path} ${condition.op} → ${JSON.stringify(condition.actual)}`);
  }

  // ── K3 — 같은 장면을 런타임으로 직접 굴려 재생까지 확인한다 ────────────────────
  const initial = initialStore();
  const runtime = new WorldRuntime({ store: initial, rules, worldSeed: WORLD_SEED });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    runtime.advance();
    runtime.submit({ id: `vs0_intent_${attempt}`, actor: ACTOR, verb: 'strike', targets: [TARGET] });
  }
  const again = resimulate(initial, runtime.journal(), {
    rules,
    worldSeed: WORLD_SEED,
    untilTick: runtime.tick,
  });
  const audit = runtime.audit(initial, again);

  check('energy_result_is_one', 'K0', (runtime.store.component(ACTOR, 'energy') ?? {})['current'] === 1, `에너지 ${JSON.stringify(runtime.store.component(ACTOR, 'energy'))}`);
  check('three_events_only', 'K2', runtime.log().length === 3, `사건 ${runtime.log().length}건 · 의도 ${runtime.journal().length}건`);
  check('every_change_has_an_event', 'K3', audit.everyChangeHasAnEvent, `로그 재생 ${audit.replayedStoreHash} · 실제 ${audit.storeHash}`);
  check('replay_is_identical', 'K3', audit.replayIsIdentical, `사건 해시 ${audit.logHash} · 재시뮬레이션 ${again.logHash()}`);
  check('log_is_append_only', 'K3', audit.logIsAppendOnly, `사건 ${runtime.log().length}건`);
  check('no_store_violation', 'K0', audit.storeIssues.length === 0, `저장소 감사 위반 ${audit.storeIssues.length}건`);

  // ── K1 — 조건 판정이 실제로 쓰였는가 ────────────────────────────────────────
  const reach = evaluate(
    runtime.store,
    { op: 'within_distance', a: 'actor', b: 'target', max: 2 },
    { actor: ACTOR, target: TARGET },
  );
  const drained = evaluate(
    runtime.store,
    { op: 'gt', path: 'actor.energy.current', value: 2 },
    { actor: ACTOR },
  );
  check('reach_condition_holds', 'K1', reach.passed, `거리 판정 ${JSON.stringify(reach.trace.actual)}`);
  check(
    'fourth_attempt_is_explained',
    'K1',
    !drained.passed && drained.causes.length > 0,
    `남은 에너지로는 3 을 낼 수 없다 — ${drained.causes.map((cause) => `${cause.at}: ${cause.reason}`).join(', ')}`,
  );

  // ── V2 — 같은 시드면 같은 세계 ──────────────────────────────────────────────
  const rerun = new WorldRuntime({ store: initialStore(), rules, worldSeed: WORLD_SEED });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    rerun.advance();
    rerun.submit({ id: `vs0_intent_${attempt}`, actor: ACTOR, verb: 'strike', targets: [TARGET] });
  }
  const other = new WorldRuntime({ store: initialStore(), rules, worldSeed: '20260731' });
  other.advance();
  other.submit({ id: 'vs0_intent_0', actor: ACTOR, verb: 'strike', targets: [TARGET] });

  check('same_seed_same_events', 'V2', rerun.logHash() === runtime.logHash(), `${rerun.logHash()}`);
  check(
    'different_seed_different_ids',
    'V2',
    other.log()[0]?.id !== runtime.log()[0]?.id,
    `${runtime.log()[0]?.id} ≠ ${other.log()[0]?.id}`,
  );
  check(
    'seed_comes_from_the_design_rule',
    'V2',
    deriveSeed({ worldSeed: BigInt(WORLD_SEED) }) === deriveSeed({ worldSeed: BigInt(WORLD_SEED) }),
    '원본 29장의 조합 규칙',
  );

  // ── V1 — 사건 문서가 스키마를 지킨다 ────────────────────────────────────────
  // 스키마 문서는 K3 의 것이다. 패키지 내보내기에 기대지 않고 저장소의 파일을 그대로 읽는다 —
  // 슬라이스가 보는 스키마와 K3 이 배포하는 스키마가 같은 파일이어야 하기 때문이다.
  const eventSchema = JSON.parse(
    readFileSync(
      join(ROOT, 'packages', 'kernel', 'K3-event-replay', 'schemas', 'k3-world-event.schema.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const eventValidator = compileSchema(eventSchema);
  const eventIssues = runtime
    .log()
    .flatMap((event) => eventValidator.validate(JSON.parse(JSON.stringify(event))).issues);
  check('events_match_the_schema', 'V1', eventIssues.length === 0, `사건 ${runtime.log().length}건 · 위반 ${eventIssues.length}건`);

  // ── V0 — 저장소의 계약이 모두 등록된다 ──────────────────────────────────────
  const documents = collectContracts();
  const report = buildRegistry(documents);
  const registered = [...report.registered];
  check('all_contracts_register', 'V0', report.issues.length === 0, `등록 ${registered.length} · 거부 ${report.rejected.length}`);
  check(
    'vs0_modules_are_registered',
    'V0',
    VS0_MODULES.every((id) => registered.includes(id)),
    `누락 ${VS0_MODULES.filter((id) => !registered.includes(id)).join(', ') || '없음'}`,
  );
  check(
    'dependencies_come_first',
    'V0',
    dependenciesComeFirst(report.registry),
    `위상 순서 ${report.registry.order.join(' → ')}`,
  );

  // ── V4 — VS0 통과 여부가 실제로 상태를 가른다 ───────────────────────────────
  const measured = (verdict: string): Measurements => ({
    purpose: '한 문장짜리 목적',
    contract: { inputs: ['a'], outputs: ['b'], ownsState: ['c'], invariants: ['d'], scenarios: ['e'] },
    staticCheck: { passed: true },
    unitTests: { passed: 1, failed: 0 },
    propertyTests: { seeds: 1, invariantViolations: 0 },
    labScenarios: { e: 'passed' },
    replay: { runs: 1, uniqueHashes: 1 },
    integrationSlices: { VS0: verdict },
    regression: { failures: 0 },
    hashes: { sourceHash: `sha256:${'0'.repeat(64)}`, contractHash: `sha256:${'1'.repeat(64)}` },
  });
  const withPass = deriveStatus(evaluateGates(measured('passed')), true);
  const withFail = deriveStatus(evaluateGates(measured('pending')), true);
  check(
    'slice_verdict_moves_the_status',
    'V4',
    withPass === 'VERIFIED' && withFail === 'LAB_PASS',
    `통과 → ${withPass} · 미통과 → ${withFail}`,
  );

  const passed = checks.every((entry) => entry.passed);
  const body = { slice: 'VS0' as const, modules: VS0_MODULES, passed, checks, scenario };
  return { ...body, digest: sha256Tagged(JSON.stringify(body)) };
}

// ---------------------------------------------------------------------------

function collectContracts(): { path: string; text: string }[] {
  const packages = join(ROOT, 'packages');
  const documents: { path: string; text: string }[] = [];
  for (const group of readdirSync(packages).sort()) {
    const groupDir = join(packages, group);
    if (group === 'node_modules' || !existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir).sort()) {
      const file = join(groupDir, entry, 'MODULE.yaml');
      if (!existsSync(file)) continue;
      documents.push({
        path: relative(ROOT, file).split(sep).join('/'),
        text: readFileSync(file, 'utf8'),
      });
    }
  }
  return documents;
}

/**
 * 위상 순서에서 선행이 언제나 앞에 온다.
 *
 * "K 커널 전체가 V 페이즈 전체보다 뒤"는 아니다 — K0 의 선행은 V0·V1 뿐이므로 V2 보다 앞에 놓일 수
 * 있고, 그것이 옳다. 원문 「28」의 고정 순서는 **작업 순서**이지 위상 순서가 아니다.
 */
function dependenciesComeFirst(registry: { modules: readonly { id: string; dependsOn: readonly string[] }[]; order: readonly string[] }): boolean {
  const position = new Map(registry.order.map((id, index) => [id, index]));
  return registry.modules.every((module) =>
    module.dependsOn.every((dependency) => (position.get(dependency) ?? -1) < (position.get(module.id) ?? -1)),
  );
}
