import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseScene } from '../../dependencies/src/c01Scenes.js';
import { buildC01RequirementGraph } from '../../world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { buildPhenomenonCatalog, BEHAVIOR_SENSES, PHENOMENON_SENSES, PhenomenonStream } from '../src/phenomena.js';
import { createC01Runtime, C01_REDUCERS } from '../src/c01Runtime.js';

const sceneOf = () => buildBaseScene();
const runtimeOf = () => {
  const scene = sceneOf();
  return { scene, runtime: createC01Runtime({ state: scene.state, ontology: scene.ontology }) };
};
const apexId = (scene) => Object.values(scene.state.subjects).find((s) => s.archetype === 'apex-monster').id;

// ── R2 / I-3: 현상 카탈로그가 Q 의 성공 결과에서 나온다 ──────────────────────

test('I-3: 현상 카탈로그는 Q 의 성공 결과에서 만들어진다 (Handoff: Q-S01 출력 소비)', () => {
  const graph = buildC01RequirementGraph(C01_STRATEGIES);
  const catalog = buildPhenomenonCatalog(graph);

  // Q 가 선언한 행동과 카탈로그의 행동이 정확히 같다 — 어느 쪽도 남거나 모자라지 않는다
  const fromQ = new Set(graph.outcomes.map((o) => o.behavior));
  const inCatalog = new Set(catalog.entries.map((e) => e.behavior));
  assert.deepEqual([...inCatalog].sort(), [...fromQ].sort());
  assert.ok(catalog.entries.length > 0);

  // 각 자국의 서술과 장소는 Q 의 outcome 에서 온 것이다 (손으로 적은 것이 아님)
  for (const e of catalog.entries) {
    assert.ok(e.effects.length > 0, `${e.behavior} 에 남는 자국의 서술 없음`);
    assert.ok(PHENOMENON_SENSES.includes(e.sense), `${e.behavior} 감각 불량: ${e.sense}`);
    for (const effect of e.effects)
      assert.ok(graph.outcomes.some((o) => o.behavior === e.behavior && o.effect === effect),
        `${e.behavior} 의 서술 "${effect}" 가 Q 에 없다`);
    for (const place of e.places)
      assert.ok(graph.outcomes.some((o) => o.behavior === e.behavior && o.at === place),
        `${e.behavior} 의 장소 "${place}" 가 Q 에 없다`);
  }
});

test('I-3: Q 가 부르지 않는 감각 매핑과 매핑 없는 행동은 둘 다 거부된다 (양방향 lint)', () => {
  const graph = buildC01RequirementGraph(C01_STRATEGIES);
  // ① 매핑 없는 행동 — 자국을 정하지 않은 행동은 세계에 남을 수 없다
  const missing = { ...BEHAVIOR_SENSES };
  delete missing.hunt;
  assert.throws(() => buildPhenomenonCatalog(graph, missing), /감각 매핑 없는 행동 원자: hunt/);
  // ② 죽은 매핑 — Q 가 부르지 않는 행동의 감각은 미소비 출력이다
  const extra = { ...BEHAVIOR_SENSES, 'sing-a-song': { sense: 'sound', legibility: 1 } };
  assert.throws(() => buildPhenomenonCatalog(graph, extra), /Q 가 부르지 않는 행동의 감각 매핑: sing-a-song/);
  // ③ 성공 결과가 없으면 현상도 없다
  assert.throws(() => buildPhenomenonCatalog({ outcomes: [] }), /성공 결과가 없는 요구 그래프/);
});

// ── R0: 상태 저장소 ──────────────────────────────────────────────────────────

test('Handoff: 런타임 상태는 W 가 실체화한 정식 세계다 (C01-W-S01 실제 출력 소비)', () => {
  const { scene, runtime } = runtimeOf();
  const state = runtime.state();
  assert.deepEqual(Object.keys(state.region.places).sort(), Object.keys(scene.world.places).sort());
  assert.deepEqual(Object.keys(state.region.rules).sort(), Object.keys(scene.world.rules).sort());
  for (const [res, qty] of Object.entries(scene.world.resources))
    assert.equal(state.resources[res], qty, `${res} 재고가 W 산출과 다르다`);
});

test('읽기 스냅샷은 얼어 있다 — 사건 없이 상태를 고칠 수 없다 (AX-EVENT-SOURCED 첫 방벽)', () => {
  const { runtime } = runtimeOf();
  const before = runtime.hash();
  const snapshot = runtime.state();
  assert.throws(() => { snapshot.resources.meat = 999; }, TypeError);
  assert.throws(() => { snapshot.region.places['apex-lair'].integrity = 0; }, TypeError);
  assert.throws(() => { delete snapshot.contracts['ct-1']; }, TypeError);
  assert.equal(runtime.hash(), before, '스냅샷을 건드렸는데 세계가 바뀌었다');
});

// ── R1: 사건 경유 전이 ───────────────────────────────────────────────────────

test('상태 변경은 사건을 통해서만 일어나고, 확정된 사건은 자국을 남긴다', () => {
  const { scene, runtime } = runtimeOf();
  const before = runtime.hash();
  const result = runtime.commit({
    type: 'ResourceGathered', behavior: 'gather-herbs',
    payload: { resource: 'healing-herb', qty: 2, at: 'marsh-colony' },
    tick: 1, traceId: 'tr-gather', at: 'marsh-colony', actor: 'pl-crafter',
  });
  assert.equal(result.ok, true, JSON.stringify(result.violations));
  assert.notEqual(runtime.hash(), before, '사건이 확정됐는데 상태가 그대로다');
  assert.equal(runtime.log.length, 1);
  assert.equal(result.phenomena.length, 1);
  assert.equal(result.phenomena[0].sourceEventId, result.event.id, '자국이 사건과 이어지지 않는다');
  assert.equal(result.phenomena[0].traceId, 'tr-gather', '인과 추적 ID 유실');
  assert.equal(result.phenomena[0].at, 'marsh-colony');
  assert.equal(runtime.state().resources['healing-herb'], scene.world.resources['healing-herb'] + 2);
});

test('공리를 어기는 사건은 거부되고, 상태도 로그도 자국도 남지 않는다 (오류 은폐 금지)', () => {
  const { runtime } = runtimeOf();
  const before = runtime.hash();
  const result = runtime.commit({
    type: 'ItemCrafted', behavior: 'craft-item',
    payload: { produces: [{ resource: 'healing-potion', qty: 5 }], consumes: [] },
    tick: 1,
  });
  assert.equal(result.ok, false, '비용 없는 생산이 통과했다');
  assert.equal(result.violations[0].violationCode, 'CONSERVATION_NO_COST');
  assert.equal(runtime.hash(), before, '거부됐는데 상태가 바뀌었다');
  assert.equal(runtime.log.length, 0, '거부된 사건이 로그에 남았다');
  assert.equal(runtime.phenomena.length, 0, '거부된 사건이 자국을 남겼다');
});

test('재고를 넘는 소비도 거부된다 (보존 공리 경계)', () => {
  const { runtime } = runtimeOf();
  const stock = runtime.state().resources['healing-herb'];
  const ok = runtime.commit({
    type: 'ItemCrafted', behavior: 'craft-item', tick: 1,
    payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: [{ resource: 'healing-herb', qty: stock }] },
  });
  assert.equal(ok.ok, true, '재고 전량 소비는 통과해야 한다');

  const over = runtime.commit({
    type: 'ItemCrafted', behavior: 'craft-item', tick: 2,
    payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: [{ resource: 'healing-herb', qty: 1 }] },
  });
  assert.equal(over.ok, false, '재고가 빈 뒤에도 소비가 통과했다');
  assert.equal(over.violations[0].violationCode, 'CONSERVATION_INSUFFICIENT_SOURCE');
});

test('사냥이 비용 없이 재료를 내면 거부된다 — 사체는 해체를 거쳐야 재료가 된다 (I-5 경계)', () => {
  const { scene, runtime } = runtimeOf();
  const apex = apexId(scene);
  // 개체군을 줄이는 것만으로는 통과한다 (비용 = 개체 하나, 재료 생산 없음)
  const kill = runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', tick: 1,
    payload: { subjectId: apex, by: 'pl-hunter' } });
  assert.equal(kill.ok, true, JSON.stringify(kill.violations));

  // 같은 사건이 재료까지 즉시 내려 하면 보존 공리가 막는다.
  // 개체군 감소는 아직 "추적 가능한 비용"으로 세어지지 않는다 — 열린 이슈 I-5
  const withLoot = runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', tick: 2,
    payload: { subjectId: apex, by: 'pl-hunter', produces: [{ resource: 'hide', qty: 2 }] } });
  assert.equal(withLoot.ok, false);
  assert.equal(withLoot.violations[0].violationCode, 'CONSERVATION_NO_COST');
});

test('존재론 밖의 사건과 Q 가 모르는 행동은 세계에 닿지 못한다 (실패 경로)', () => {
  const { runtime } = runtimeOf();
  assert.throws(() => runtime.commit({ type: 'DragonAwakened', behavior: 'hunt', payload: {}, tick: 1 }),
    /미등록 사건 타입: DragonAwakened/);
  assert.throws(() => runtime.commit({ type: 'ResourceGathered', behavior: 'gather-herbs', payload: { resource: 'meat' }, tick: 1 }),
    /사건 payload 누락: ResourceGathered — qty,at/);
  assert.throws(() => runtime.commit({
    type: 'ResourceGathered', behavior: 'summon-from-nothing',
    payload: { resource: 'meat', qty: 1, at: 'herd-valley' }, tick: 1,
  }), /현상 카탈로그에 없는 행동: summon-from-nothing/);
  assert.equal(runtime.log.length, 0);
});

// ── 완료 조건 ────────────────────────────────────────────────────────────────

test('완료 조건: 임의 상태 조회가 사건 이력으로 완전히 설명된다', () => {
  const { scene, runtime } = runtimeOf();
  const apex = apexId(scene);
  runtime.commit({
    type: 'MonsterMoved', behavior: 'raid-pasture', tick: 1, traceId: 'tr-raid',
    payload: { subjectId: apex, from: 'apex-lair', to: 'village-pasture' },
    at: 'village-pasture', actor: apex,
  });
  runtime.commit({
    type: 'ContractIssued', behavior: 'issue-subjugation-contract', tick: 2, traceId: 'tr-raid',
    payload: { contractId: 'ct-sub-1', kind: 'subjugation' }, at: 'hunter-outpost',
  });

  // 바뀐 경로는 하나도 빠짐없이 사건으로 설명된다
  for (const path of runtime.explainedPaths()) {
    const events = runtime.explain(path);
    assert.ok(events.length > 0, `${path} 를 설명하는 사건이 없다`);
    for (const e of events) assert.ok(e.type && e.behavior, `${path} 의 사건에 타입·행동이 없다`);
  }
  // 상위 경로로 물어도 하위 변경이 함께 설명된다
  const subjectEvents = runtime.explain('subjects');
  assert.ok(subjectEvents.some((e) => e.type === 'MonsterMoved'));
  assert.deepEqual(runtime.explain('contracts').map((e) => e.type), ['ContractIssued']);
  // 인과 추적 ID 로 한 흐름을 묶을 수 있다
  assert.equal(runtime.log.list().filter((e) => e.traceId === 'tr-raid').length, 2);
  // 사건이 건드리지 않은 경로는 설명 목록에 없다 (거짓 설명 금지)
  assert.deepEqual(runtime.explain('schemaVersion'), []);
});

test('결정성: 로그 재생 = 상태 재현 (같은 사건 → 같은 상태 해시)', () => {
  const { scene, runtime } = runtimeOf();
  const initial = structuredClone(scene.state);
  const apex = apexId(scene);
  runtime.commit({ type: 'MonsterMoved', behavior: 'migrate', tick: 1,
    payload: { subjectId: apex, from: 'apex-lair', to: 'herd-valley' }, at: 'herd-valley' });
  runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', tick: 2,
    payload: { subjectId: apex, by: 'pl-hunter' }, at: 'herd-valley' });
  runtime.commit({ type: 'TradeExecuted', behavior: 'buy-byproducts', tick: 3,
    payload: { resource: 'hide', qty: 1, from: 'pl-hunter', to: 'sub-000007' }, at: 'hunter-outpost' });

  const replayed = runtime.replay(initial);
  assert.equal(replayed.hash, runtime.hash(), '재생 상태가 현재 상태와 다르다');

  // 같은 사건 열을 새 런타임에 다시 넣어도 같은 해시가 나온다
  const fresh = createC01Runtime({ state: structuredClone(initial), ontology: scene.ontology });
  for (const ev of runtime.log.list())
    fresh.commit({ type: ev.type, behavior: ev.behavior, payload: ev.payload, tick: ev.tick, traceId: ev.traceId });
  assert.equal(fresh.hash(), runtime.hash());
});

test('현상 흐름은 장소·시각으로 물을 수 있다 (R3 지각의 입력)', () => {
  const { scene, runtime } = runtimeOf();
  const apex = apexId(scene);
  runtime.commit({ type: 'MonsterMoved', behavior: 'raid-pasture', tick: 1,
    payload: { subjectId: apex, from: 'apex-lair', to: 'village-pasture' }, at: 'village-pasture' });
  runtime.commit({ type: 'ResourceGathered', behavior: 'gather-herbs', tick: 5,
    payload: { resource: 'healing-herb', qty: 1, at: 'marsh-colony' }, at: 'marsh-colony' });

  assert.equal(runtime.phenomena.at('village-pasture').length, 1);
  assert.equal(runtime.phenomena.at('village-pasture')[0].sense, 'absence');
  assert.equal(runtime.phenomena.since(5).length, 1);
  assert.equal(runtime.phenomena.since(0).length, 2);
  // 읽기 난이도가 실려 있다 — 누가 읽을 수 있는지는 R3 이 정한다
  for (const p of runtime.phenomena.list())
    assert.ok(p.legibility > 0 && p.legibility <= 1, `읽기 난이도 불량: ${p.legibility}`);
});

test('현상 흐름은 사건 없이 스스로 자국을 만들지 않는다', () => {
  const stream = new PhenomenonStream();
  assert.equal(stream.length, 0);
  assert.deepEqual(stream.list(), []);
  assert.deepEqual(stream.fromEvent('ev-000001'), []);
});

test('리듀서는 순수하다 — 같은 사건에 같은 다음 상태 (결정성 기반)', () => {
  const { scene } = runtimeOf();
  const ev = { type: 'ResourceGathered', tick: 1, payload: { resource: 'meat', qty: 3, at: 'village-pasture' } };
  const a = C01_REDUCERS.ResourceGathered(structuredClone(scene.state), ev);
  const b = C01_REDUCERS.ResourceGathered(structuredClone(scene.state), ev);
  assert.deepEqual(a, b);
});
