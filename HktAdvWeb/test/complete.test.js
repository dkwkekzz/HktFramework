// B3 — done_when 판정 + 상향 파문
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { Substance } from '../src/substrate/substance.js';
import { checkDone, detectTransitions } from '../src/graph/complete.js';
import { ripple } from '../src/graph/ripple.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;

function ctxWithInventory(inv) {
  return { constants, lexicon: lex, actor: { id: 'bot', inventory: inv }, state: { world: {}, stage: {} } };
}

test('경로 무관: 절차 없이 세계 상태만 충족돼도 완료로 판정된다 (불변 원칙 ①)', () => {
  const term = graph.goalsById.get('G-0.1.1.2.1');
  // 채취 법칙을 거치지 않고 자격 있는 물질을 직접 인벤토리에 놓는다.
  const inv = [new Substance({ id: '직접넣은표본', kind: '물질', properties: { 신성잔향보존율: 0.72 } }, lex)];
  const r = checkDone(term, ctxWithInventory(inv));
  assert.equal(r.done, true, '제시된 절차와 무관하게 술어 충족 = 완료');
});

test('완료는 영구 플래그가 아니다 — 세계가 변하면 재개방된다', () => {
  const term = graph.goalsById.get('G-0.1.1.2.1');
  const inv = [new Substance({ id: 't', kind: '물질', properties: { 신성잔향보존율: 0.72 } }, lex)];
  assert.equal(checkDone(term, ctxWithInventory(inv)).done, true);
  // 표본을 잃으면(세계 변화) 다시 거짓
  assert.equal(checkDone(term, ctxWithInventory([])).done, false);
});

test('detectTransitions 가 완료·재개방 전이를 검출한다', () => {
  const term = 'G-0.1.1.2.1';
  const inv = [new Substance({ id: 't', kind: '물질', properties: { 신성잔향보존율: 0.72 } }, lex)];

  const t1 = detectTransitions(graph, ctxWithInventory(inv), new Map());
  assert.ok(t1.completed.includes(term), '없음→충족 = 완료 전이');

  const t2 = detectTransitions(graph, ctxWithInventory([]), t1.doneNow);
  assert.ok(t2.reopened.includes(term), '충족→없음 = 재개방 전이');
});

test('상향 파문: 절편 말단 완료가 G-0.1.1.2 → G-0.1.1 → … 로 오른다', () => {
  const term = graph.goalsById.get('G-0.1.1.2.1');
  const events = ripple(term, graph, ctxWithInventory([]));
  assert.equal(events.length, 1, 'serves 가 하나(G-0.1.1.2) → 갈래 하나');
  const anc = events[0].ancestors.map((a) => a.id);
  assert.ok(anc.includes('G-0.1.1.2'));
  assert.ok(anc.includes('G-0.1.1'));
  assert.ok(anc.includes('G-0'), '뿌리까지 경유 조상에 실린다');
  // 각 조상에 조건 서술(trace)이 실린다 — 숫자 없는 진행의 먹이
  assert.ok(events[0].ancestors.every((a) => a.condition), '조상마다 충족 조건 서술 존재');
});

test('DAG 다중 부모: 권속의 심장 완료가 두 갈래(0.2.3.2 · 0.1.1.2)로 동시 파문', () => {
  const heart = graph.goalsById.get('G-0.2.3.2.1');
  const events = ripple(heart, graph, ctxWithInventory([]));
  const branches = events.map((e) => e.branch).sort();
  assert.deepEqual(branches, ['G-0.1.1.2', 'G-0.2.3.2'], '두 계보로 동시에 오른다');
});
