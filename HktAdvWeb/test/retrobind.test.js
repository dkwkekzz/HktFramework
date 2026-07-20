// C3 — 상향 발견 (역결합)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World, Substance } from '../src/substrate/substance.js';
import { BeliefView } from '../src/epistemic/belief.js';
import { findUnbound, discoverNode } from '../src/epistemic/retrobind.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;

// 시나리오 믿음: 진동 전달 재료 가지(3.2)와 그 속성을 요구하는 형제 수요자들을
// 아직 미발견으로 둔다 → 공명전달률/에너지손실률이 "발견된 어떤 demand 와도 무관".
function scenarioBelief() {
  const b = BeliefView.fromGraph(graph, 'bot');
  for (const id of ['G-0.1.1.3.2', 'G-0.1.1.3.4', 'G-0.1.1.2.H1.1']) b.set(id, '미발견');
  return b;
}

test('획득 시점엔 용도 불명 → 발견 시점에 역결합(retro-bind)', () => {
  const belief = scenarioBelief();
  const world = new World(lex);
  // 봇이 우연히 획득한 수정 조각 (미발견 무대 드롭)
  const actor = {
    id: 'bot',
    inventory: [new Substance({ id: '수정편', kind: '물질', properties: { 공명전달률: 0.8, 에너지손실률: 0.1 } }, lex)],
  };

  // 획득 시점: 어떤 발견된 demand 와도 안 닿는다 → 용도 불명
  const unbound = findUnbound(actor, graph, belief);
  assert.ok(unbound.some((s) => s.id === '수정편'), '획득 시점엔 용도 불명');

  // 발견 시점: 가지를 발견하면 보유 재료가 그 demand 에 역결합된다
  const { events, links } = discoverNode(belief, graph, actor, 'G-0.1.1.3.2', { constants, lexicon: lex, world, via: '탐색' });
  assert.ok(events.some((e) => e.type === 'discover'));
  const retro = events.find((e) => e.type === 'retro-bind');
  assert.ok(retro, 'retro-bind 이벤트 발화');
  assert.equal(retro.node, 'G-0.1.1.3.2');
  assert.ok(links.some((l) => l.material === '수정편' && l.property === '공명전달률'));
  assert.ok(links.some((l) => l.material === '수정편' && l.property === '에너지손실률'));
});

test('발견 후에는 더 이상 용도 불명이 아니다', () => {
  const belief = scenarioBelief();
  const world = new World(lex);
  const actor = {
    id: 'bot',
    inventory: [new Substance({ id: '수정편', kind: '물질', properties: { 공명전달률: 0.8, 에너지손실률: 0.1 } }, lex)],
  };
  discoverNode(belief, graph, actor, 'G-0.1.1.3.2', { constants, lexicon: lex, world });
  const after = findUnbound(actor, graph, belief);
  assert.ok(!after.some((s) => s.id === '수정편'), '발견 후 용도가 생겼다');
});

test('아무 demand 와도 안 맞는 재료는 발견해도 역결합되지 않는다', () => {
  const belief = scenarioBelief();
  const world = new World(lex);
  const actor = {
    id: 'bot',
    inventory: [new Substance({ id: '흙덩이', kind: '물질', properties: { 오염도: 0.9 } }, lex)],
  };
  const { events } = discoverNode(belief, graph, actor, 'G-0.1.1.3.2', { constants, lexicon: lex, world });
  assert.ok(!events.some((e) => e.type === 'retro-bind'), '속성이 안 맞으면 역결합 없음');
});
