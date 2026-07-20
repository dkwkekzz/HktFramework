// E3 — 규칙 기반 하위 목적 계산 v0 (플래너)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World } from '../src/substrate/substance.js';
import { decompose } from '../src/planner/decompose.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;
const parent = graph.goalsById.get('G-0.1.1'); // 위협(거대 신) 제거

function worldWith(specs) {
  const w = new World(lex);
  for (const s of specs) w.add(s);
  return w;
}

test('두 세계 분해 차이: 같은 목적도 세계 장애물 유형이 다르면 다르게 분해된다 (M5)', () => {
  // 세계 A — 육체형 신 + 공명출력 재료 실존
  const worldA = worldWith([{ id: '공명포', kind: '물질', properties: { 공명출력: 0.8 } }]);
  const A = decompose(parent, worldA, { constants, lexicon: lex, obstacles: ['육체형'] });

  // 세계 B — 신앙형 신 + 촉매 재료 실존
  const worldB = worldWith([{ id: '독초', kind: '물질', properties: { 생체촉매활성: 0.7 } }]);
  const B = decompose(parent, worldB, { constants, lexicon: lex, obstacles: ['신앙형'] });

  assert.equal(A.admitted.length, 1);
  assert.equal(B.admitted.length, 1);
  assert.notEqual(A.admitted[0].title, B.admitted[0].title, '서로 다른 분해');
  assert.match(A.admitted[0].title, /파괴 수단/);
  assert.match(B.admitted[0].title, /교란/);
});

test('편입된 후보는 epistemic:추정 이고 상위를 serves 한다 (플래너의 출력도 믿음)', () => {
  const world = worldWith([{ id: '공명포', kind: '물질', properties: { 공명출력: 0.8 } }]);
  const { admitted } = decompose(parent, world, { constants, lexicon: lex, obstacles: ['육체형'] });
  assert.equal(admitted[0].epistemic, '추정');
  assert.deepEqual(admitted[0].serves, ['G-0.1.1']);
  assert.equal(admitted[0].generatedBy, 'decompose/v0');
});

test('E2 관문 불통과 후보는 편입되지 않는다 (응답 기회 없음 → 반려)', () => {
  // 육체형 장애물이지만 세계에 공명출력 요소가 없다 → (c) 실패
  const empty = worldWith([]);
  const { admitted, rejected } = decompose(parent, empty, { constants, lexicon: lex, obstacles: ['육체형'] });
  assert.equal(admitted.length, 0, '기회 없는 후보는 편입 거부');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reasons.some((r) => /\(c\)/.test(r)), '반려 사유에 제약 (c) 명시');
});

test('여러 장애물이면 각 유형별로 분해가 계산된다', () => {
  const world = worldWith([
    { id: '공명포', kind: '물질', properties: { 공명출력: 0.8 } },
    { id: '독초', kind: '물질', properties: { 생체촉매활성: 0.7 } },
  ]);
  const { admitted } = decompose(parent, world, { constants, lexicon: lex, obstacles: ['육체형', '신앙형'] });
  assert.equal(admitted.length, 2, '두 장애물 → 두 하위 목적');
});

test('장애물은 세계 상태(world.신.장애물)에서 읽힌다', () => {
  const world = worldWith([{ id: '공명포', kind: '물질', properties: { 공명출력: 0.8 } }]);
  const ctx = { constants, lexicon: lex, state: { world: { 신: { 장애물: ['육체형'] } } } };
  const { admitted } = decompose(parent, world, ctx);
  assert.equal(admitted.length, 1);
  assert.match(admitted[0].title, /파괴 수단/);
});
