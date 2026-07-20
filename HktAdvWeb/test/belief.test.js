// C1 — epistemic 4값 + 믿음 필터
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { BeliefView, MISSING } from '../src/epistemic/belief.js';
import { evalPred } from '../src/substrate/predicate.js';

const lex = loadLexicon();
const graph = loadGraph();

test('초기 믿음이 seed 의 epistemic 필드에서 로드된다', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  assert.equal(b.stateOf('G-0'), '확인');
  assert.equal(b.stateOf('G-0.1.3'), '미발견'); // seed 미발견 노드
  assert.equal(b.stateOf('G-0.1.1.2.H1'), '추정'); // 경합 가설
});

test('미발견 노드는 봇 시점 그래프에서 "?" 로만 노출된다', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  const view = b.visibleGraph();
  const missing = view.find((n) => n.id === 'G-0.1.3');
  assert.equal(missing.masked, true);
  assert.equal(missing.label, '?');
  assert.ok('title' in view.find((n) => n.id === 'G-0'), '발견된 노드는 제목이 보인다');
});

test('발견 이벤트 후 노드가 드러난다 (미발견 → 추정)', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  const ev = b.discover('G-0.1.3', { via: '관찰' });
  assert.equal(ev.from, MISSING);
  assert.equal(ev.to, '추정');
  assert.equal(b.isDiscovered('G-0.1.3'), true);
});

test('두 액터의 BeliefView 는 독립이다 (같은 세계, 다른 그래프)', () => {
  const a = BeliefView.fromGraph(graph, 'A');
  const b = BeliefView.fromGraph(graph, 'B');
  a.discover('G-0.1.3');
  assert.equal(a.stateOf('G-0.1.3'), '추정');
  assert.equal(b.stateOf('G-0.1.3'), '미발견', 'B 의 믿음은 A 의 발견에 영향받지 않는다');
});

test('A4 epistemic 스텁 해제: belief 주입 시 done_when 이 발견 상태를 실판정한다', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  const g2 = graph.goalsById.get('G-0.1.1.2'); // done_when: epistemic tag 신.약점 is 확인
  const ctx = { constants: graph.constants, lexicon: lex, belief: b };

  // 초기: H1/H2(신.약점) 둘 다 추정 → 미충족
  assert.equal(evalPred(g2.done_when, ctx).value, false);
  // H1 을 확인으로 전이 → 충족 (어느 가설이든 확인되면 done)
  b.set('G-0.1.1.2.H1', '확인');
  assert.equal(evalPred(g2.done_when, ctx).value, true);
});

test('belief 미주입 시 epistemic 은 여전히 스텁(하위 호환)', () => {
  const g2 = graph.goalsById.get('G-0.1.1.2');
  const r = evalPred(g2.done_when, { constants: graph.constants, lexicon: lex });
  assert.equal(r.value, false);
  assert.equal(r.trace.stub, true);
});
