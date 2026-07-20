// E2 — 생성 제약 검사기 (a)(b)(c)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World } from '../src/substrate/substance.js';
import { checkBranch, backlogAgainstWorld, MATERIAL_KINDS } from '../src/planner/constraints.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;

function sliceWorld() {
  const w = new World(lex);
  w.add({ id: '조직조각-A', archetype: '조직조각', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.8, 오염도: 0.1, 소멸타이머: 3 } });
  return w;
}
const sliceState = { world: {}, stage: { 'S-0045': { 잔여시간: 3 } } };
const ctx = { constants, lexicon: lex, state: sliceState };

test('제약 (a): 재료 10종 밖의 kind 는 반려', () => {
  const bad = { id: 'X', done_when: { state: { path: 'world.x', op: '>=', value: 0 } }, demand: [{ kind: '용', property: { name: '오염도', op: '>=', value: 0 } }] };
  const r = checkBranch(bad, sliceWorld(), ctx);
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.constraint === 'a'));
});

test('제약 (b): done_when 이 DSL 로 판정 불가면 반려', () => {
  const bad = { id: 'X', done_when: { 없는연산자: 1 }, demand: [] };
  const r = checkBranch(bad, sliceWorld(), ctx);
  assert.ok(r.failures.some((f) => f.constraint === 'b'));
});

test('제약 (c): 응답 기회가 세계에 없으면 반려', () => {
  const node = { id: 'X', done_when: { state: { path: 'world.x', op: '>=', value: 0 } }, demand: [{ kind: '물질', property: { name: '공명전달률', op: '>=', value: 'const.공명전달_최소' } }] };
  const empty = new World(lex);
  assert.equal(checkBranch(node, empty, ctx).ok, false, '빈 세계 → (c) 실패');
  // 요소를 추가하면 기회가 생겨 통과
  empty.add({ id: '수정', kind: '물질', properties: { 공명전달률: 0.9 } });
  assert.equal(checkBranch(node, empty, ctx).ok, true);
});

test('MATERIAL_KINDS 는 정확히 10 갈래', () => {
  assert.equal(MATERIAL_KINDS.size, 10);
});

test('Slice-1 말단(G-0.1.1.2.1)은 절편 세계에서 관문을 통과한다', () => {
  const term = graph.goalsById.get('G-0.1.1.2.1');
  const r = checkBranch(term, sliceWorld(), ctx);
  assert.equal(r.ok, true, '조직 조각 + 시간 창 → (a)(b)(c) 통과');
});

test('백로그: seed 를 절편 세계에 대고 돌리면 미대응 무대 노드가 검출된다', () => {
  const { passed, backlog } = backlogAgainstWorld(graph, sliceWorld(), ctx);
  const backlogIds = backlog.map((b) => b.id);
  // 공명 전달 재료(S-0201/0202) 필요 노드와 무대 없는 노드(3.3)가 백로그에 오른다
  assert.ok(backlogIds.includes('G-0.1.1.3.2'), '진동 전달 재료 노드는 아직 무대 없음');
  assert.ok(backlogIds.includes('G-0.1.1.3.3'), '에너지 저장 재료 노드는 무대 미발견');
  // 절편 말단은 통과 목록에 있고 백로그엔 없다
  assert.ok(passed.includes('G-0.1.1.2.1'));
  assert.ok(!backlogIds.includes('G-0.1.1.2.1'));
});
