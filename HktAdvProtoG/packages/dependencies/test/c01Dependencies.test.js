import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  makeDependency, validateDependencyGraph, evaluateDependencies, detectConflicts,
} from '../src/dependencyGraph.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../src/c01Dependencies.js';
import { buildBaseScene, buildSituationScene, BASE_FORAGE_SLACK } from '../src/c01Scenes.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));

const graphOf = (scene) => buildC01DependencyGraph(scene);
const evalOf = (scene) => evaluateDependencies(graphOf(scene), C01_SUPPLIES, scene);
const conflictsOf = (scene) => detectConflicts(graphOf(scene), C01_SUPPLIES, scene);
const findByArchetype = (scene, a) => Object.values(scene.state.subjects).find((s) => s.archetype === a);

test('의존 그래프가 배역·상태에서 생성되고 모든 대상에 공급자가 있다 (Handoff: S-S01·O-S02 실제 출력 소비)', () => {
  const scene = buildBaseScene();
  const deps = graphOf(scene);
  assert.deepEqual(validateDependencyGraph(deps, C01_SUPPLIES), []);
  const kinds = new Set(deps.map((d) => d.kind));
  assert.deepEqual([...kinds].sort(), ['byproduct', 'habitat', 'healing', 'prey', 'reputation', 'safety']);
  // 6종 NPC 주체 전부가 의존을 갖는다
  for (const a of ['villager', 'hunters-guild', 'merchant', 'herd-beast', 'apex-monster', 'resource-colony'])
    assert.ok(deps.some((d) => d.holder === findByArchetype(scene, a).id), `의존 없는 주체: ${a}`);
  assert.ok(deps.every((d) => d.rationale), '근거 없는 의존 존재');
});

const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

test('기준 장면은 어느 시드에서도 균형 상태다 — 압력 0, 충돌 0 (대조군, I-1 회귀)', () => {
  for (const seed of SEEDS) {
    const scene = buildBaseScene(seed);
    const { byHolder } = evalOf(scene);
    const maxPressure = Math.max(...Object.values(byHolder).map((h) => h.maxPressure));
    assert.equal(maxPressure, 0, `seed ${seed} 기준 장면에 압력 ${maxPressure}`);
    assert.deepEqual(conflictsOf(scene).map((c) => c.target), [], `seed ${seed} 기준 장면에 충돌`);
  }
});

test('개체군과 지형 용량의 여유가 어느 시드에서도 보장된다 (I-1 회귀)', () => {
  // I-1 의 원인은 용량과 개체수가 서로 무관하게 정해진 것이었다.
  // 이제 W 가 용량을 정하고 개체군이 그 안에 맞춰지므로 여유가 구조적으로 보장된다.
  for (const seed of SEEDS) {
    const scene = buildBaseScene(seed);
    const pop = findByArchetype(scene, 'herd-beast').population.count;
    const capacity = scene.state.region.places['herd-valley'].carryingCapacity;
    const slack = capacity - pop;
    assert.ok(capacity > pop, `seed ${seed}: 수용력 ${capacity} ≤ 개체수 ${pop}`);
    assert.ok(slack >= BASE_FORAGE_SLACK,
      `seed ${seed}: 여유 목초 ${slack} < 최소 ${BASE_FORAGE_SLACK} — 무리의 먹이+서식 요구를 못 받친다`);
  }
});

test('SC-C01-D4-01: 무리가 줄면 포식 마물의 먹이 조달이 목장으로 옮겨가고, 목장으로도 못 채우면 압력이 오른다', () => {
  const base = buildBaseScene();
  const apexId = findByArchetype(base, 'apex-monster').id;
  const preyRow = (scene) => evalOf(scene).pressures.find((p) => p.holder === apexId && p.kind === 'prey');

  // 균형: 무리만으로 충족 — 목장은 건드리지 않는다
  assert.equal(preyRow(base).pressure, 0);
  assert.deepEqual(preyRow(base).via.map((v) => v.target), ['herd-population']);

  // 1단계 완충: 무리가 마르면 조달 대상이 목장으로 확장된다 (압력은 아직 흡수됨)
  const thinned = buildBaseScene();
  findByArchetype(thinned, 'herd-beast').population.count = 2;
  assert.deepEqual(preyRow(thinned).via.map((v) => v.target), ['herd-population', 'village-pasture']);
  assert.equal(preyRow(thinned).pressure, 0);
  assert.deepEqual(conflictsOf(thinned), [], '완충 단계에서는 아직 충돌이 아니다');

  // 2단계 붕괴: 무리가 사라지면 목장 잔량으로도 못 채워 압력이 오르고 목장 경합이 생긴다
  const collapsed = buildBaseScene();
  findByArchetype(collapsed, 'herd-beast').population.count = 0;
  const row = preyRow(collapsed);
  assert.ok(row.pressure > 0, '무리 붕괴 후에도 먹이 압력이 0');
  assert.equal(evalOf(collapsed).byHolder[apexId].dominant, 'prey');
  const pasture = conflictsOf(collapsed).find((c) => c.target === 'village-pasture');
  assert.ok(pasture, '목장 경합 미탐지');
  assert.ok(pasture.claimants.some((c) => c.holder === apexId), '포식 마물이 목장 경합에 없음');
});

test('SC-C01-D4-BASE-01: 단일 개체의 먹이 의존 압력 계산', () => {
  const deps = [makeDependency({ holder: 'lone-beast', kind: 'prey', targets: ['forage'], demand: 10, rationale: '단일 개체 먹이' })];
  const supplies = { forage: (ctx) => ctx.forage };
  assert.equal(evaluateDependencies(deps, supplies, { forage: 10 }).pressures[0].pressure, 0);
  assert.equal(evaluateDependencies(deps, supplies, { forage: 4 }).pressures[0].pressure, 0.6);
  assert.equal(evaluateDependencies(deps, supplies, { forage: 0 }).pressures[0].pressure, 1);
});

test('SC-C01-D5-01: 무리 과잉 시 습지 군락을 두고 무리·군락·제작자 3자 충돌이 탐지된다', () => {
  for (const seed of SEEDS) {
    const scene = buildSituationScene('ST-C01-02', seed);
    const marsh = conflictsOf(scene).find((c) => c.target === 'marsh-colony');
    assert.ok(marsh, `seed ${seed} 습지 군락 충돌 미탐지`);
    const kinds = new Set(marsh.claimants.map((c) => `${scene.state.subjects[c.holder].archetype}:${c.kind}`));
    assert.ok(kinds.has('herd-beast:prey'), `seed ${seed} 무리의 먹이 신청 없음`);
    assert.ok(kinds.has('resource-colony:habitat'), `seed ${seed} 군락의 서식 신청 없음`);
    assert.ok(kinds.has('player:healing'), `seed ${seed} 제작자의 약초 채집 신청 없음`);
    assert.ok(marsh.totalDemand > marsh.supply);

    // 목초지는 무리 자신의 먹이 대 서식 경합이다 (같은 주체 내 경합)
    const forage = conflictsOf(scene).find((c) => c.target === 'herd-valley-forage');
    assert.ok(forage?.selfContention, `seed ${seed} 목초지 자체 경합 미탐지`);
  }
});

test('구간 1 종료 조건: 5개 Situation 의 경합 자원이 어느 시드에서도 D5 충돌로 표현된다', () => {
  for (const seed of SEEDS) {
    for (const st of cycleSpec.situations) {
      const conflicts = conflictsOf(buildSituationScene(st.id, seed)).map((c) => c.target);
      for (const target of st.contestedResources)
        assert.ok(conflicts.includes(target),
          `seed ${seed} ${st.id} 의 경합 자원 미표현: ${target} (탐지: ${conflicts.join(',')})`);
    }
  }
});

test('충돌 경계: 신청 = 공급 은 충돌이 아니고, +1 이면 충돌이다', () => {
  const mk = (d1, d2) => [
    makeDependency({ holder: 'A', kind: 'prey', targets: ['t'], demand: d1, rationale: 'a' }),
    makeDependency({ holder: 'B', kind: 'prey', targets: ['t'], demand: d2, rationale: 'b' }),
  ];
  const supplies = { t: () => 10 };
  assert.deepEqual(detectConflicts(mk(5, 5), supplies, {}), []);
  const over = detectConflicts(mk(5, 6), supplies, {});
  assert.equal(over.length, 1);
  assert.equal(over[0].shortfall, 1);
});

test('공급 0 은 충돌이 아니라 결핍이다 — 압력으로만 보고된다', () => {
  const deps = [
    makeDependency({ holder: 'A', kind: 'prey', targets: ['t'], demand: 3, rationale: 'a' }),
    makeDependency({ holder: 'B', kind: 'prey', targets: ['t'], demand: 3, rationale: 'b' }),
  ];
  const supplies = { t: () => 0 };
  assert.deepEqual(detectConflicts(deps, supplies, {}), []);
  assert.equal(evaluateDependencies(deps, supplies, {}).pressures[0].pressure, 1);
});

test('같은 시드·상태 → 같은 압력 해시 (결정성)', () => {
  assert.equal(evalOf(buildBaseScene()).hash, evalOf(buildBaseScene()).hash);
  assert.notEqual(evalOf(buildBaseScene()).hash, evalOf(buildSituationScene('ST-C01-01')).hash);
});

test('불량 의존·공급자 없는 대상은 거부된다 (실패 경로)', () => {
  assert.throws(() => makeDependency({ kind: 'prey', targets: ['t'], demand: 1, rationale: 'r' }), /holder 필수/);
  assert.throws(() => makeDependency({ holder: 'A', kind: 'mana', targets: ['t'], demand: 1, rationale: 'r' }), /미지 의존 종류/);
  assert.throws(() => makeDependency({ holder: 'A', kind: 'prey', targets: [], demand: 1, rationale: 'r' }), /target 필수/);
  assert.throws(() => makeDependency({ holder: 'A', kind: 'prey', targets: ['t'], demand: -1, rationale: 'r' }), /요구 불량/);
  assert.throws(() => makeDependency({ holder: 'A', kind: 'prey', targets: ['t'], demand: 1 }), /근거/);

  const orphan = [makeDependency({ holder: 'A', kind: 'prey', targets: ['ghost'], demand: 1, rationale: 'r' })];
  assert.ok(validateDependencyGraph(orphan, C01_SUPPLIES).some((e) => e.includes('공급자 없는')));
});
