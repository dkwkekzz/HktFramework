import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseScene, buildSituationScene } from '../../dependencies/src/c01Scenes.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../../dependencies/src/c01Dependencies.js';
import { evaluateDependencies } from '../../dependencies/src/dependencyGraph.js';
import { planAll } from '../../possibilities/src/possibilityGraph.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { PERCEPTION_CHANNELS, perceive, perceiveAll, validatePerception, neighborsOf } from '../src/perception.js';
import { PHENOMENON_SENSES } from '../src/phenomena.js';
import { BeliefLedger, updateBeliefs } from '../src/beliefs.js';
import { formIntents, CAUTION_THRESHOLD } from '../src/intents.js';
import { createC01Runtime, senseAndIntend, c01PlaceOf } from '../src/c01Runtime.js';

const setup = (situation = null) => {
  const scene = situation ? buildSituationScene(situation) : buildBaseScene();
  return { scene, runtime: createC01Runtime({ state: scene.state, ontology: scene.ontology }) };
};
const byArchetype = (state, a) => Object.values(state.subjects).find((s) => s.archetype === a);
const plansOf = (scene) => planAll({
  catalog: C01_STRATEGIES, ctx: scene,
  evaluation: evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene),
}).plans;

const raid = (runtime, scene, tick, at = 'village-pasture') => {
  const apex = byArchetype(scene.state, 'apex-monster').id;
  const r = runtime.commit({
    type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick,
    payload: { subjectId: apex, from: 'apex-lair', to: at }, at, actor: apex, traceId: `tr-${tick}`,
  });
  if (!r.ok) throw new Error(`습격 사건 거부: ${r.violations[0].violationCode}`);
  return r;
};

// ── R3 지각 ─────────────────────────────────────────────────────────────────

test('R3: 주체의 지각 어휘가 전부 채널 표에 있다 (Handoff: S-S01 프로필 소비)', () => {
  const { scene } = setup();
  assert.deepEqual(validatePerception(scene.state.subjects, PHENOMENON_SENSES), [],
    '주체가 가진 채널이 표에 없거나, 아무도 읽지 못하는 감각이 있다');
  for (const spec of Object.values(PERCEPTION_CHANNELS)) {
    assert.ok(['here', 'route', 'region'].includes(spec.reach));
    assert.ok(spec.fidelity > 0 && spec.fidelity <= 1);
  }
});

test('R3: 자국은 감각·거리·예민함이 맞아야 닿는다 — 세계를 통째로 보는 주체는 없다', () => {
  const { scene, runtime } = setup();
  raid(runtime, scene, 1);
  const state = runtime.state();
  const seen = perceiveAll({ subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes });

  // 목장에 있는 주민은 가축이 사라진 것을 직접 본다
  const villager = byArchetype(state, 'villager');
  assert.equal(villager.at, 'village-pasture');
  assert.ok(seen[villager.id].some((p) => p.direct && p.at === 'village-pasture'),
    '목장에 선 주민이 습격 자국을 못 봤다');

  // 습지의 군락은 감각이 없다 — 아무것도 알지 못한다
  const colony = byArchetype(state, 'resource-colony');
  assert.deepEqual(colony.perception, []);
  assert.deepEqual(seen[colony.id], [], '감각 없는 주체가 무언가를 지각했다');

  // 자기가 남긴 자국은 지각이 아니다
  const apex = byArchetype(state, 'apex-monster');
  assert.ok(!seen[apex.id].some((p) => p.sourceEventId === runtime.log.list()[0].id),
    '자기가 남긴 자국을 스스로 지각했다');
});

test('R3: 거리 규칙 — here 는 같은 장소, route 는 길로 이어진 곳까지', () => {
  const { scene, runtime } = setup();
  const apex = byArchetype(scene.state, 'apex-monster').id;
  // 골짜기에 추적 흔적(trace)을 남긴다 — 냄새로 좇을 수 있는 자국
  runtime.commit({ type: 'MonsterMoved', behavior: 'stalk-prey', strategy: 'P-HUNT-HERD', tick: 1,
    payload: { subjectId: apex, from: 'apex-lair', to: 'herd-valley' }, at: 'herd-valley', actor: apex });
  const state = runtime.state();
  const phenomena = runtime.phenomena.list();
  const routes = state.region.routes;

  // 골짜기는 monster-route 로 습지·둥지와 이어져 있다
  assert.ok(neighborsOf('herd-valley', routes).has('marsh-colony'));

  // sight-near(here) 만 가진 주체는 다른 장소의 일을 모른다
  const nearOnly = { id: 'x-near', at: 'marsh-colony', perception: ['sight-near'] };
  assert.deepEqual(perceive({ subject: nearOnly, phenomena, routes }), []);

  // route 채널은 이웃 장소까지 닿는다 (다만 충실도가 떨어진다)
  const scented = { id: 'x-scent', at: 'marsh-colony', perception: ['scent-prey-tracking'] };
  const got = perceive({ subject: scented, phenomena, routes });
  assert.equal(got.length, 1, '길로 이어진 곳의 자국을 못 맡았다');
  assert.ok(got[0].fidelity < 1, '멀리서 맡은 것이 직접 본 것과 같은 충실도다');
  assert.equal(got[0].direct, false);
});

// ── R4 믿음 ─────────────────────────────────────────────────────────────────

test('SC-C01-R4-01: 과장된 목격 소문 대 실제 흔적 → 상이한 믿음', () => {
  const { scene, runtime } = setup();
  const villager = byArchetype(scene.state, 'villager');
  raid(runtime, scene, 1);                       // 목장에 실제 습격 자국이 남는다
  runtime.commit({                               // 그 소식이 소문으로 퍼진다
    type: 'TrackProgress', behavior: 'spread-rumor', strategy: 'P-REPORT-SIGHTING', tick: 2,
    payload: { by: villager.id, roll: 1 }, at: 'village-pasture', actor: villager.id,
  });

  const state = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 3 });

  // 목장에서 직접 본 주민 — 크기 그대로, 확신 높음
  const seenIt = ledger.believes(villager.id, 'village-pasture', 'threat');
  assert.ok(seenIt, '직접 본 주민에게 위협 믿음이 없다');
  assert.equal(seenIt.direct, true);
  assert.equal(seenIt.via, 'sight-near');

  // 전초에서 소문만 들은 상인 — 크기가 부풀고 확신이 낮다
  const merchant = byArchetype(state, 'merchant');
  assert.equal(merchant.at, 'hunter-outpost');
  const heardIt = ledger.believes(merchant.id, 'village-pasture', 'threat');
  assert.ok(heardIt, '소문을 들은 상인에게 위협 믿음이 없다');
  assert.equal(heardIt.via, 'rumor');
  assert.equal(heardIt.direct, false);

  // 같은 사건인데 믿음이 다르다 — 소문 쪽이 더 크고 덜 확실하다
  assert.ok(heardIt.magnitude > seenIt.magnitude,
    `소문이 부풀지 않았다: 소문 ${heardIt.magnitude} vs 목격 ${seenIt.magnitude}`);
  assert.ok(heardIt.confidence < seenIt.confidence,
    `소문의 확신이 목격보다 낮지 않다: ${heardIt.confidence} vs ${seenIt.confidence}`);
});

test('R4: 직접 본 것이 소문을 덮어쓴다 — 같은 사실에 두 경로가 닿으면', () => {
  const { scene, runtime } = setup();
  const villager = byArchetype(scene.state, 'villager');
  raid(runtime, scene, 1);
  runtime.commit({ type: 'TrackProgress', behavior: 'spread-rumor', strategy: 'P-REPORT-SIGHTING', tick: 2,
    payload: { by: villager.id, roll: 1 }, at: 'village-pasture', actor: 'someone-else' });

  const state = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 3 });

  // 주민은 sight-near 와 rumor 를 둘 다 가졌다 — 그래도 남는 믿음은 직접 본 쪽이다
  assert.ok(villager.perception.includes('rumor') && villager.perception.includes('sight-near'));
  const belief = ledger.believes(villager.id, 'village-pasture', 'threat');
  assert.equal(belief.direct, true, '소문이 목격을 덮어썼다');
});

test('R4: 믿음은 지각에서만 자란다 — 아무 자국도 없으면 아무도 아무것도 모른다', () => {
  const { scene, runtime } = setup();
  const state = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 1 });
  for (const id of Object.keys(state.subjects))
    assert.deepEqual(ledger.of(id).beliefs, [], `${id} 가 자국 없이 무언가를 믿는다`);
  // 세계에는 포식자가 실재하지만 아무도 그것을 모른다
  assert.ok(byArchetype(state, 'apex-monster'));
});

test('R4: 믿음 대 실제 diff 가 나온다 (완료 조건 — Lab 확인용)', () => {
  const { scene, runtime } = setup();
  raid(runtime, scene, 1);
  const state = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 2 });

  const villager = byArchetype(state, 'villager');
  const rows = ledger.diff(villager.id, state);
  assert.ok(rows.length > 0, 'diff 가 비었다');
  for (const r of rows) {
    assert.ok(r.at && r.topic, 'diff 행에 장소·주제가 없다');
    assert.ok(r.because, 'diff 행에 그렇게 믿는 이유가 없다');
  }
  assert.equal(ledger.hash(), ledger.hash());
});

// ── R5 기억 ─────────────────────────────────────────────────────────────────

test('R5: 기억은 시간과 함께 흐려진다 — 위협은 더 오래 남는다', () => {
  const { scene, runtime } = setup();
  raid(runtime, scene, 1);
  const state = runtime.state();
  const villager = byArchetype(state, 'villager');
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 1 });

  const fresh = ledger.weight(villager.id, 'village-pasture', 'threat', 1);
  const later = ledger.weight(villager.id, 'village-pasture', 'threat', 20);
  const muchLater = ledger.weight(villager.id, 'village-pasture', 'threat', 60);
  assert.ok(fresh > 0, '방금 본 위협의 무게가 0');
  assert.ok(later < fresh, '기억이 흐려지지 않는다');
  assert.ok(muchLater < later);
  // 겪지 않은 곳에는 기억이 없다
  assert.equal(ledger.weight(villager.id, 'apex-lair', 'threat', 1), 0);
});

test('SC-C01-R5-BASE-01: 위협 기억 → 다음 행동(경계·회피) 반영', () => {
  // 굶주린 포식 마물이 목장을 노린다. 그러나 거기서 거듭 사냥당한 기억이 쌓이면 내려오지 않는다.
  const { scene, runtime } = setup('ST-C01-01');
  const plans = plansOf(scene);
  const apexId = byArchetype(scene.state, 'apex-monster').id;
  const plan = plans.find((p) => p.subject === apexId);
  assert.equal(plan.chosen.id, 'P-RAID-PASTURE');
  assert.equal(c01PlaceOf(plan.chosen), 'village-pasture');

  // 한 번 내려와 목장을 알게 된다 (앎 관문 통과)
  raid(runtime, scene, 1);
  const known = runtime.state();
  assert.equal(known.subjects[apexId].at, 'village-pasture');
  const calm = formIntents({ plans, subjects: known.subjects, beliefs: new BeliefLedger(), tick: 2, placeOf: c01PlaceOf });
  const calmIntent = calm.intents.find((i) => i.subject === apexId);
  assert.equal(calmIntent.submitted, true, JSON.stringify(calmIntent));
  assert.equal(calmIntent.caution, 0);

  // 사냥꾼들이 목장에서 그를 거듭 몰아붙인다 — 포식자는 그 싸움 소리를 듣는다
  for (const tick of [2, 3]) {
    const r = runtime.commit({
      type: 'MonsterHunted', behavior: 'fight', strategy: 'P-HUNT-APEX', tick,
      payload: { subjectId: apexId, by: 'pl-hunter' },
      at: 'village-pasture', actor: 'pl-hunter', traceId: `tr-hunt-${tick}`,
    });
    assert.equal(r.ok, true, JSON.stringify(r.violations));
  }

  const state = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick: 4 });
  const fear = ledger.weight(apexId, 'village-pasture', 'threat', 4);
  assert.ok(fear >= plan.chosen.gain + CAUTION_THRESHOLD,
    `위협 기억 ${fear} 이(가) 물러설 만큼 쌓이지 않았다 (이득 ${plan.chosen.gain})`);

  const scared = formIntents({ plans, subjects: state.subjects, beliefs: ledger, tick: 4, placeOf: c01PlaceOf });
  const scaredIntent = scared.intents.find((i) => i.subject === apexId);
  assert.equal(scaredIntent.submitted, false, '거듭 당하고도 그대로 내려온다');
  assert.match(scaredIntent.reason, /물러선다/);

  // 시간이 지나 기억이 흐려지면 다시 내려온다 — 겁은 영구하지 않다
  const healed = formIntents({ plans, subjects: state.subjects, beliefs: ledger, tick: 400, placeOf: c01PlaceOf });
  const healedIntent = healed.intents.find((i) => i.subject === apexId);
  assert.equal(healedIntent.submitted, true, '기억이 흐려졌는데도 영영 물러서 있다');
});

// ── R6 의도 ─────────────────────────────────────────────────────────────────

test('R6: 모르는 곳으로는 가지 않는다 — 전지적 주체 금지', () => {
  const { scene, runtime } = setup('ST-C01-01');
  const state = runtime.state();
  const apex = byArchetype(state, 'apex-monster');
  const plans = plansOf(scene);
  const apexPlan = plans.find((p) => p.subject === apex.id);
  assert.equal(apexPlan.chosen.id, 'P-RAID-PASTURE');
  assert.equal(c01PlaceOf(apexPlan.chosen), 'village-pasture');
  assert.notEqual(apex.at, 'village-pasture', '포식자가 이미 목장에 있다 — 전제가 깨졌다');

  // 목장에 대해 아무것도 모르는 상태 → 의도가 서지 않는다
  const blind = formIntents({ plans, subjects: state.subjects, beliefs: new BeliefLedger(), tick: 1, placeOf: c01PlaceOf });
  const blindIntent = blind.intents.find((i) => i.subject === apex.id);
  assert.equal(blindIntent.submitted, false);
  assert.match(blindIntent.reason, /모른다/);

  // 목장의 자국을 맡고 나면 — 간다
  runtime.commit({ type: 'MonsterMoved', behavior: 'herd-livestock', strategy: 'P-TEND-LIVESTOCK', tick: 1,
    payload: { subjectId: byArchetype(state, 'villager').id, from: 'hunter-outpost', to: 'village-pasture' },
    at: 'village-pasture', actor: byArchetype(state, 'villager').id });
  const after = runtime.state();
  const ledger = new BeliefLedger();
  updateBeliefs(ledger, perceiveAll({
    subjects: after.subjects, phenomena: runtime.phenomena.list(), routes: after.region.routes,
  }), { tick: 2 });
  const known = ledger.of(apex.id).beliefs.some((b) => b.at === 'village-pasture');
  const informed = formIntents({ plans, subjects: after.subjects, beliefs: ledger, tick: 2, placeOf: c01PlaceOf });
  const informedIntent = informed.intents.find((i) => i.subject === apex.id);
  assert.equal(informedIntent.submitted, known,
    `앎과 의도가 어긋난다 (앎 ${known} / 제출 ${informedIntent.submitted}): ${informedIntent.reason}`);
});

test('R6: 의도는 사건이 아니다 — 세계를 바꾸지 않는다', () => {
  const { scene, runtime } = setup('ST-C01-01');
  raid(runtime, scene, 1);
  const before = { hash: runtime.hash(), events: runtime.log.length, phenomena: runtime.phenomena.length };
  const result = senseAndIntend({ runtime, subjects: runtime.state().subjects, plans: plansOf(scene), tick: 2 });
  assert.ok(result.intents.length > 0);
  assert.equal(runtime.hash(), before.hash, '의도가 세계를 바꿨다');
  assert.equal(runtime.log.length, before.events, '의도가 사건을 만들었다');
  assert.equal(runtime.phenomena.length, before.phenomena, '의도가 자국을 남겼다');
});

test('R6: 결정성 — 같은 자국·같은 계획 → 같은 의도 해시', () => {
  const run = () => {
    const { scene, runtime } = setup('ST-C01-01');
    raid(runtime, scene, 1);
    return senseAndIntend({ runtime, subjects: runtime.state().subjects, plans: plansOf(scene), tick: 2 });
  };
  const a = run();
  const b = run();
  assert.equal(a.hash, b.hash);
  assert.equal(a.ledger.hash(), b.ledger.hash());
});
