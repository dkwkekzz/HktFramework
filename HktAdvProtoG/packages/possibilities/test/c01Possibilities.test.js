import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAtom, makeStrategy, canPerform, expandCandidates, selectGoal, planFor, planAll, validateCatalog,
} from '../src/possibilityGraph.js';
import { C01_STRATEGIES } from '../src/c01Strategies.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../../dependencies/src/c01Dependencies.js';
import { evaluateDependencies } from '../../dependencies/src/dependencyGraph.js';
import { buildBaseScene, buildSituationScene } from '../../dependencies/src/c01Scenes.js';

const evalOf = (scene) => evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene);
const planScene = (scene) => planAll({ catalog: C01_STRATEGIES, ctx: scene, evaluation: evalOf(scene) });
const findByArchetype = (scene, a) => Object.values(scene.state.subjects).find((s) => s.archetype === a);
const planOf = (scene, archetype) => planScene(scene).plans.find((p) => p.subject === findByArchetype(scene, archetype).id);

/** 무리 개체수와 부상만 바꾼 장면 — 다른 조건은 기준 장면과 같다 */
function apexScene({ herd, injury }) {
  const scene = buildBaseScene();
  findByArchetype(scene, 'herd-beast').population.count = herd;
  findByArchetype(scene, 'apex-monster').attrs.injury = injury;
  return scene;
}

test('카탈로그 정합: 모든 전략에 원자를 실제로 가진 수행 주체가 있다 (Handoff: S-S01 행동 후보 소비)', () => {
  const subjects = Object.values(buildBaseScene().state.subjects);
  assert.deepEqual(validateCatalog(C01_STRATEGIES, subjects), []);
});

test('가능성 문법: 주체는 자기 행동 후보로 만들 수 있는 전략만 쓸 수 있다 (P2)', () => {
  const scene = buildBaseScene();
  const apex = findByArchetype(scene, 'apex-monster');
  const herd = findByArchetype(scene, 'herd-beast');
  const raid = C01_STRATEGIES.find((s) => s.id === 'P-RAID-PASTURE');
  assert.equal(canPerform(apex, raid), true);
  assert.equal(canPerform(herd, raid), false, '무리는 raid-pasture 행동이 없다');

  // 행동 후보를 빼앗으면 전략도 불가능해진다
  const crippled = { ...apex, behaviors: apex.behaviors.filter((b) => b !== 'raid-pasture') };
  assert.equal(canPerform(crippled, raid), false);
});

test('SC-C01-P4-01: 포식 마물의 조달 경로가 먹이량과 위험 비용에서 계산된다', () => {
  // 같은 굶주림(부상 5)에서 무리가 두터우면 사냥, 얇으면 목장 습격으로 뒤집힌다
  const thick = planOf(apexScene({ herd: 6, injury: 5 }), 'apex-monster');
  const thin = planOf(apexScene({ herd: 1, injury: 5 }), 'apex-monster');
  assert.equal(thick.goal.kind, 'prey');
  assert.equal(thin.goal.kind, 'prey');
  assert.equal(thick.chosen.id, 'P-HUNT-HERD', `무리가 두터운데 ${thick.chosen.id} 선택`);
  assert.equal(thin.chosen.id, 'P-RAID-PASTURE', `무리가 얇은데 ${thin.chosen.id} 선택`);

  // 선택은 이득·비용·위험이 모두 적힌 후보 비교에서 나온다 (설명 가능성)
  for (const plan of [thick, thin]) {
    assert.ok(plan.candidates.length >= 3, '후보가 3개 미만');
    for (const c of plan.candidates)
      for (const k of ['gain', 'cost', 'risk', 'score'])
        assert.ok(Number.isFinite(c[k]), `${c.id} 의 ${k} 가 수치가 아님`);
    assert.equal(plan.candidates[0].id, plan.chosen.id);
  }
  // 목장 습격의 위험은 마을 방위 전력에서 온다
  const raid = thin.candidates.find((c) => c.id === 'P-RAID-PASTURE');
  const guild = findByArchetype(apexScene({ herd: 1, injury: 5 }), 'hunters-guild');
  assert.equal(raid.risk, 2 + guild.members.length);
});

test('SC-C01-P-02: 같은 의존 계열이라도 원형마다 다른 전략을 펼친다', () => {
  const scene = buildBaseScene();
  const sets = {};
  for (const a of ['apex-monster', 'herd-beast', 'villager'])
    sets[a] = expandCandidates(C01_STRATEGIES, findByArchetype(scene, a), 'prey').map((s) => s.id);

  for (const [a, ids] of Object.entries(sets)) assert.ok(ids.length > 0, `${a} 의 prey 전략 없음`);
  // 세 원형의 전략 집합은 서로 겹치지 않는다
  const all = Object.values(sets).flat();
  assert.equal(new Set(all).size, all.length, `전략 중복: ${all.join(',')}`);
  assert.ok(sets['apex-monster'].includes('P-RAID-PASTURE'));
  assert.ok(sets['herd-beast'].includes('P-MIGRATE-MARSH'));
  assert.ok(sets['villager'].includes('P-TEND-LIVESTOCK'));
});

test('ST-C01-01 에서 포식 마물은 목장을 노리고, 조합은 다른 방식으로 대응한다 (복수 해결 경로)', () => {
  const scene = buildSituationScene('ST-C01-01');
  assert.equal(planOf(scene, 'apex-monster').chosen.id, 'P-RAID-PASTURE');

  // 조합의 safety 후보에는 토벌·먹이 회복·조절이 함께 놓인다 — 하나의 위협에 여러 해법
  const guild = planOf(scene, 'hunters-guild');
  assert.equal(guild.goal.kind, 'safety');
  const families = guild.candidates.map((c) => c.interventionFamily);
  for (const f of ['subjugate', 'restore-prey-base', 'cull-contract'])
    assert.ok(families.includes(f), `개입군 누락: ${f} (있는 것: ${families.join(',')})`);
});

test('플레이어 역할은 Situation 의 개입군을 전략으로 갖는다 — 유인·토벌·정보', () => {
  const scene = buildSituationScene('ST-C01-01');
  const hunter = Object.values(scene.state.subjects).find((s) => s.role === 'hunter');
  const tracker = Object.values(scene.state.subjects).find((s) => s.role === 'tracker');
  const families = (subject, kind) => expandCandidates(C01_STRATEGIES, subject, kind).map((s) => s.interventionFamily);
  assert.ok(families(hunter, 'reputation').includes('lure-away-with-bait'), '유인 전략 없음');
  assert.ok(families(hunter, 'reputation').includes('subjugate'), '토벌 전략 없음');
  assert.ok(families(tracker, 'reputation').includes('sell-tracking-intel'), '정보 전략 없음');
});

test('P4 목적 유지: 근소한 차이로는 목적을 갈아타지 않는다', () => {
  const kinds = { prey: 0.50, safety: 0.60 };
  const fresh = selectGoal({ kinds });
  assert.equal(fresh.kind, 'safety');

  const kept = selectGoal({ kinds }, 'prey');           // 격차 0.10 < 기본 hysteresis 0.15
  assert.equal(kept.kind, 'prey');
  assert.equal(kept.kept, true);

  const switched = selectGoal({ kinds: { prey: 0.30, safety: 0.60 } }, 'prey'); // 격차 0.30
  assert.equal(switched.kind, 'safety');

  assert.equal(selectGoal({ kinds: { prey: 0 } }).kind, null, '결핍 0 인데 목적이 생김');
});

test('결핍이 없으면 목적도 계획도 없다 — 균형 장면', () => {
  const { plans } = planScene(buildBaseScene());
  assert.ok(plans.every((p) => p.goal.kind === null), '균형 장면에서 목적 발생');
  assert.ok(plans.every((p) => p.chosen === null));
});

test('이득 0 인 수단만 남으면 계획을 세우지 않고 이유를 남긴다', () => {
  // ST-C01-01 은 시장 재고가 0 이라 제작자가 살 수 있는 것이 없다
  const scene = buildSituationScene('ST-C01-01');
  const crafter = planScene(scene).plans.find((p) => p.archetype === 'player:dresser-crafter');
  assert.equal(crafter.goal.kind, 'byproduct');
  assert.equal(crafter.chosen, null);
  assert.match(crafter.reason, /실효 있는 수단 없음/);
  assert.ok(crafter.candidates.length > 0, '후보 자체는 펼쳐져 있어야 한다');
});

test('같은 상태 → 같은 계획 해시 (결정성)', () => {
  assert.equal(planScene(buildBaseScene()).hash, planScene(buildBaseScene()).hash);
  assert.notEqual(planScene(buildBaseScene()).hash, planScene(buildSituationScene('ST-C01-01')).hash);
  const a = planScene(buildSituationScene('ST-C01-01'));
  const b = planScene(buildSituationScene('ST-C01-01'));
  assert.deepEqual(a.plans, b.plans);
});

test('불량 원자·전략은 거부된다 (실패 경로)', () => {
  assert.throws(() => makeAtom({ effect: 'x' }), /behavior 필수/);
  assert.throws(() => makeAtom({ behavior: 'b' }), /effect 필수/);
  const atoms = [makeAtom({ behavior: 'graze', effect: 'e' })];
  const ok = { id: 'X', kind: 'prey', actors: { archetypes: ['herd-beast'] }, atoms, estimate: () => ({ gain: 0, cost: 0, risk: 0 }), rationale: 'r' };
  assert.throws(() => makeStrategy({ ...ok, kind: 'mana' }), /미지 의존 계열/);
  assert.throws(() => makeStrategy({ ...ok, atoms: [] }), /행동 원자 필수/);
  assert.throws(() => makeStrategy({ ...ok, estimate: undefined }), /estimate 필수/);
  assert.throws(() => makeStrategy({ ...ok, rationale: undefined }), /근거 필수/);
  assert.throws(() => makeStrategy({ ...ok, actors: {} }), /수행 주체 필수/);

  // 아무도 수행할 수 없는 전략은 죽은 출력이다
  const dead = makeStrategy({ ...ok, id: 'DEAD', atoms: [makeAtom({ behavior: 'cast-spell', effect: 'e' })] });
  const errors = validateCatalog([dead], Object.values(buildBaseScene().state.subjects));
  assert.ok(errors.some((e) => e.includes('수행 가능한 주체가 없는')));
});
