// E1 — 재해석 스캐너 (불변 원칙 ④)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World } from '../src/substrate/substance.js';
import { scan, scanForNode } from '../src/planner/reinterpret.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;

const hash = (world) => JSON.stringify(world.all().map((s) => [s.id, s.properties]));

test('스폰 금지: 세계에 없는 속성 → 후보 0건, 요소 추가 후에만 등장 (불변 원칙 ④)', () => {
  const world = new World(lex);
  const demand = { kind: '물질', property: { name: '공명전달률', op: '>=', value: 'const.공명전달_최소' } };
  assert.equal(scan(demand, world, { constants, lexicon: lex }).length, 0, '없는 것은 스폰되지 않는다');

  world.add({ id: '수정맥', archetype: '광맥', kind: '물질', properties: { 공명전달률: 0.85, 에너지손실률: 0.1 } });
  const cands = scan(demand, world, { constants, lexicon: lex });
  assert.equal(cands.length, 1, '요소를 추가한 뒤에만 후보가 나타난다');
  assert.equal(cands[0].fromElement, '수정맥');
});

test('스캐너는 읽기 전용: 스캔 전후 세계 상태 해시가 불변', () => {
  const world = new World(lex);
  world.add({ id: '수정맥', archetype: '광맥', kind: '물질', properties: { 공명전달률: 0.85 } });
  const before = hash(world);
  scan({ kind: '물질', property: { name: '공명전달률', op: '>=', value: 0.7 } }, world, { constants, lexicon: lex });
  assert.equal(hash(world), before, '스캔은 세계를 바꾸지 않는다');
});

test('supplies 는 요소의 실속성의 부분집합이다 (발명 금지)', () => {
  const world = new World(lex);
  world.add({ id: '수정맥', archetype: '광맥', kind: '물질', properties: { 공명전달률: 0.85, 에너지손실률: 0.1 } });
  const [cand] = scan({ kind: '물질', property: { name: '공명전달률', op: '>=', value: 0.7 } }, world, { constants, lexicon: lex });
  const supplyProps = cand.supplies.map((s) => s.property);
  for (const p of supplyProps) assert.ok(['공명전달률', '에너지손실률'].includes(p), `supplies 속성 ${p} 은 요소의 실속성`);
});

test('후보는 미발견 상태로 나온다 (발견은 C1 경로로만)', () => {
  const world = new World(lex);
  world.add({ id: '수정맥', archetype: '광맥', kind: '물질', properties: { 공명전달률: 0.85 } });
  const [cand] = scan({ kind: '물질', property: { name: '공명전달률', op: '>=', value: 0.7 } }, world, { constants, lexicon: lex });
  assert.equal(cand.discovered, false);
});

test('다중 해법: 서로 다른 archetype 이 같은 demand 를 재해석 후보로 준다', () => {
  const world = new World(lex);
  world.add({ id: '수정맥', archetype: '광맥', kind: '물질', properties: { 공명전달률: 0.85 } });
  world.add({ id: '고대장치', archetype: '유물', kind: '물질', properties: { 공명전달률: 0.75 } });
  world.add({ id: '진흙', archetype: '흙', kind: '물질', properties: { 공명전달률: 0.1 } });
  const cands = scan({ kind: '물질', property: { name: '공명전달률', op: '>=', value: 'const.공명전달_최소' } }, world, { constants, lexicon: lex });
  assert.deepEqual(cands.map((c) => c.fromElement).sort(), ['고대장치', '수정맥']);
});

test('scanForNode 는 노드의 보유형 demand 만 스캔한다', () => {
  const world = new World(lex);
  world.add({ id: '조직', archetype: '조직조각', kind: '물질', properties: { 신성잔향보존율: 0.7 } });
  const term = graph.goalsById.get('G-0.1.1.2.1'); // 보유형 1 + 상태형 1
  const results = scanForNode(term, world, { constants, lexicon: lex });
  assert.equal(results.length, 1, '상태형(환경 상태) demand 는 스캔 대상이 아니다');
  assert.equal(results[0].candidates[0].fromElement, '조직');
});
