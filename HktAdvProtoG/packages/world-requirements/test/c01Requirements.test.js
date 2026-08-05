import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  makeRequirement, buildRequirementGraph, validateRequirementGraph, scoreRequirements, explainRequirement,
} from '../src/requirementGraph.js';
import { buildC01RequirementGraph, c01Extractor, C01_PLACE_REQUIREMENT_IDS } from '../src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { stockableIds } from '../../ontology/src/worldOntology.js';
import { buildBaseScene, buildSituationScene } from '../../dependencies/src/c01Scenes.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../../dependencies/src/c01Dependencies.js';
import { evaluateDependencies } from '../../dependencies/src/dependencyGraph.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const trace = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/TRACE.graph.json`, 'utf8'));
const graph = buildC01RequirementGraph(C01_STRATEGIES);
const ontology = defineC01Ontology();

const scored = (scene) => scoreRequirements(graph, {
  evaluation: evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene),
  subjects: scene.state.subjects,
});
const importanceOf = (scene, id) => scored(scene).requirements.find((r) => r.id === id).importance;

test('SC-C01-Q-01: 모든 요구가 전략·의존성 근거를 갖고, 요구를 못 내는 전략이 없다', () => {
  assert.deepEqual(validateRequirementGraph(graph, C01_STRATEGIES), []);
  assert.ok(graph.requirements.length > 0);
  for (const r of graph.requirements) {
    assert.ok(r.derivedFrom.length > 0, `${r.id} 근거 없음`);
    assert.equal(r.scope, r.derivedFrom.length);
    for (const d of r.derivedFrom) {
      assert.ok(C01_STRATEGIES.some((s) => s.id === d.strategy));
      assert.ok(d.dependencyKind && d.actors.length);
    }
  }
});

test('완료 조건: TRACE.graph.json 의 요구 노드가 전부 Q 출력에 있다', () => {
  const traceReqs = trace.nodes.filter((n) => n.layer === 'requirement').map((n) => n.id);
  assert.equal(traceReqs.length, 6);
  const ids = new Set(graph.requirements.map((r) => r.id));
  for (const t of traceReqs) assert.ok(ids.has(t), `TRACE 요구 미표현: ${t}`);
  // 장소 요구 id 는 TRACE 와 같은 이름을 쓴다 (계획-구현 정합)
  assert.deepEqual(Object.values(C01_PLACE_REQUIREMENT_IDS).sort(), [...traceReqs].sort());
});

test('요구는 존재론 어휘를 가리킨다 (Handoff: O-S02 소비)', () => {
  const stock = new Set(stockableIds(ontology));
  for (const r of graph.requirements) {
    if (r.kind === 'space')
      assert.ok(ontology.has('place', r.ref) || ontology.has('route', r.ref), `미등록 공간 요구: ${r.ref}`);
    if (r.kind === 'resource')
      assert.ok(stock.has(r.ref), `재고 불가 자원 요구: ${r.ref}`);
  }
});

test('모든 장소·경로가 최소 하나의 요구에서 불린다 — 임의 배치 없음', () => {
  const referenced = new Set(graph.requirements.filter((r) => r.kind === 'space').map((r) => r.ref));
  for (const p of ontology.idsByKind('place')) assert.ok(referenced.has(p), `요구 근거 없는 장소: ${p}`);
  // hunting-trail 은 아직 어떤 전략도 부르지 않는다 — 알려진 한계 (사냥로는 X 에서 공간화)
  const routes = ontology.idsByKind('route').filter((r) => referenced.has(r));
  assert.ok(routes.length >= 2, `요구에서 불린 경로 ${routes.length}`);
});

test('Q1: 세계 조건과 성공 결과가 분리된다', () => {
  const raid = C01_STRATEGIES.find((s) => s.id === 'P-RAID-PASTURE');
  const { conditions, outcomes } = c01Extractor(raid);
  assert.ok(conditions.some((c) => c.id === 'REQ-pasture'), '목장 공간 조건 없음');
  assert.ok(conditions.some((c) => c.id === 'REQ-RULE-ownership'), '소유 규칙 조건 없음');
  assert.deepEqual(outcomes.map((o) => o.behavior), ['stalk-prey', 'raid-pasture']);
  assert.ok(outcomes.every((o) => o.effect && o.at === 'village-pasture'));
  // 결과는 조건에 섞이지 않는다
  assert.ok(!conditions.some((c) => c.description.includes('습격')));
});

test('Q2: 중요도는 세계 상태에서 온다 — 균형에서는 0, 위기에서는 오른다', () => {
  assert.ok(scored(buildBaseScene()).requirements.every((r) => r.importance === 0), '균형 장면인데 중요도 발생');
  const st01 = buildSituationScene('ST-C01-01');
  assert.ok(importanceOf(st01, 'REQ-pasture') > 0, '목장 요구 중요도가 오르지 않음');
  assert.ok(importanceOf(st01, 'REQ-herd-range') > 0, '무리 서식지 요구 중요도가 오르지 않음');
  // 정렬은 중요도 내림차순
  const list = scored(st01).requirements;
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].importance >= list[i].importance);
});

test('Q3: 요구를 근거 사슬로 펼칠 수 있다 (요구 ← 전략 ← 의존 ← 주체)', () => {
  const ex = explainRequirement(graph, 'REQ-pasture');
  assert.ok(ex.chains.length >= 2, '목장 요구를 부르는 전략이 2개 미만');
  assert.ok(ex.chains.some((c) => c.includes('P-RAID-PASTURE') && c.includes('prey') && c.includes('apex-monster')));
  assert.ok(ex.chains.some((c) => c.includes('P-TEND-LIVESTOCK') && c.includes('villager')));
  assert.throws(() => explainRequirement(graph, 'REQ-NOPE'), /미지 요구/);
});

test('같은 카탈로그 → 같은 요구 그래프 해시 (결정성)', () => {
  assert.equal(buildC01RequirementGraph(C01_STRATEGIES).hash, buildC01RequirementGraph(C01_STRATEGIES).hash);
  assert.equal(buildC01RequirementGraph([...C01_STRATEGIES].reverse()).hash, graph.hash, '입력 순서가 결과를 바꾼다');
});

test('불량 요구·매핑 누락은 거부된다 (실패 경로)', () => {
  assert.throws(() => makeRequirement({ kind: 'space', ref: 'x', description: 'd' }), /id 필수/);
  assert.throws(() => makeRequirement({ id: 'R', kind: 'mana', ref: 'x', description: 'd' }), /미지 종류/);
  assert.throws(() => makeRequirement({ id: 'R', kind: 'space', description: 'd' }), /지시 대상/);
  assert.throws(() => makeRequirement({ id: 'R', kind: 'space', ref: 'x' }), /설명 필수/);

  // 매핑 없는 대상·행동 원자는 조용히 넘어가지 않는다
  const base = C01_STRATEGIES.find((s) => s.id === 'P-GRAZE-VALLEY');
  assert.throws(() => c01Extractor({ ...base, target: 'ghost-target' }), /요구 매핑 없는 전략 대상/);
  assert.throws(() => c01Extractor({ ...base, atoms: [{ behavior: 'cast-spell', effect: 'e' }] }), /요구 매핑 없는 행동 원자/);

  // 조건이 하나도 없는 전략은 오류다
  assert.throws(() => buildRequirementGraph([{ ...base, id: 'EMPTY' }], () => ({ conditions: [], outcomes: [] })), /세계 조건이 없는 전략/);
});

test('근거 없는 요구와 고아 전략은 lint 오류다 (실패 경로)', () => {
  const orphanReq = { requirements: [{ id: 'R1', kind: 'space', ref: 'x', description: 'd', derivedFrom: [], scope: 0 }], outcomes: [] };
  assert.ok(validateRequirementGraph(orphanReq, C01_STRATEGIES).some((e) => e.includes('근거 없는 요구')));
  const partial = buildC01RequirementGraph(C01_STRATEGIES.slice(0, 3));
  assert.ok(validateRequirementGraph(partial, C01_STRATEGIES).some((e) => e.includes('세계 요구를 내지 않는 전략')));
});
