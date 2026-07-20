// C2 — 가설·실험·검증·반증 루프
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World } from '../src/substrate/substance.js';
import { Ledger } from '../src/substrate/ledger.js';
import { EventLog } from '../src/substrate/events.js';
import { defaultLawTable } from '../src/substrate/laws.js';
import { BeliefView } from '../src/epistemic/belief.js';
import { evaluateHypothesis, applyVerdict, collapseInBelief } from '../src/epistemic/hypothesis.js';
import { evalPred } from '../src/substrate/predicate.js';
import { ripple } from '../src/graph/ripple.js';

const lex = loadLexicon();
const graph = loadGraph();
const 재현_최소 = graph.constants['재현_최소'];

// 숨은 세계 진실: 신은 공명 진동(강)에 취약, 저온(약)에는 아니다.
const 진실 = { 진동: 0.9, 저온: 0.1 };
const THRESHOLD = 0.5;

test('실험 법칙이 대상에 자극을 가하고 사건을 기록한다 (event 술어 실판정)', () => {
  const world = new World(lex);
  const target = world.add({ id: '신조직', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.7 } });
  const ledger = new Ledger(); ledger.open('bot', 20);
  const events = new EventLog();
  const laws = defaultLawTable(lex);
  const actor = { id: 'bot', inventory: [] };
  laws.apply(actor, '실험', target, { 주제: '진동반응' }, { ledger, events, world });
  const r = evalPred({ event: { verb: '실험', target_tag: '신.조직', min_count: 1 } }, { events });
  assert.equal(r.value, true);
});

test('경합 가설: H1(공명진동) 확인, H2(저온) 반증', () => {
  const experiments = [
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '저온', response: 진실['저온'] },
  ];
  const h1 = evaluateHypothesis({ id: 'G-0.1.1.2.H1', stimulus: '진동', threshold: THRESHOLD }, experiments, { 재현_최소 });
  const h2 = evaluateHypothesis({ id: 'G-0.1.1.2.H2', stimulus: '저온', threshold: THRESHOLD }, experiments, { 재현_최소 });
  assert.equal(h1.verdict, '확인');
  assert.equal(h2.verdict, '반증');
});

test('반증 시 H2 가지만 붕괴하고 H1 가지는 생존한다', () => {
  const belief = BeliefView.fromGraph(graph, 'bot');
  const collapsed = collapseInBelief(belief, graph, 'G-0.1.1.2.H2');
  assert.ok(collapsed.includes('G-0.1.1.2.H2'));
  assert.ok(collapsed.includes('G-0.1.1.2.H2.1'), 'H2 에만 봉사하던 실험 말단이 함께 붕괴');
  assert.equal(belief.stateOf('G-0.1.1.2.H2.1'), '반증');
  // H1 가지는 건드리지 않는다
  assert.notEqual(belief.stateOf('G-0.1.1.2.H1.2'), '반증', 'H1 가지는 생존');
});

test('다른 부모도 섬기던 노드는 붕괴하지 않는다 (DAG 의 이점)', () => {
  // 최소 그래프: H 붕괴 시, H 에만 매달린 A 는 붕괴 / H·X 를 겸하는 B 는 생존.
  const glet = {
    goalsById: new Map([['H', {}], ['A', {}], ['B', {}], ['X', {}], ['root', {}]]),
    parentsOf: new Map([['H', ['root']], ['A', ['H']], ['B', ['H', 'X']], ['X', ['root']], ['root', []]]),
  };
  const states = {};
  const belief = { set(id, s) { states[id] = s; }, stateOf(id) { return states[id] ?? '미발견'; } };
  const collapsed = collapseInBelief(belief, glet, 'H');
  assert.ok(collapsed.includes('A'));
  assert.ok(!collapsed.includes('B'), 'B 는 살아있는 부모 X 를 가져 생존');
  assert.ok(!collapsed.includes('X'));
});

test('확인 후 상위 완료 파문까지 연쇄 (H1 확인 → G-0.1.1.2 done_when 충족)', () => {
  const belief = BeliefView.fromGraph(graph, 'bot');
  const experiments = [
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '저온', response: 진실['저온'] },
  ];
  applyVerdict(belief, graph, { id: 'G-0.1.1.2.H1' }, evaluateHypothesis({ id: 'G-0.1.1.2.H1', stimulus: '진동', threshold: THRESHOLD }, experiments, { 재현_최소 }));
  applyVerdict(belief, graph, { id: 'G-0.1.1.2.H2' }, evaluateHypothesis({ id: 'G-0.1.1.2.H2', stimulus: '저온', threshold: THRESHOLD }, experiments, { 재현_최소 }));

  const ctx = { constants: graph.constants, lexicon: lex, belief };
  const g2 = graph.goalsById.get('G-0.1.1.2');
  assert.equal(evalPred(g2.done_when, ctx).value, true, '약점 지식 확인 → 상위 목적 충족');

  // 완료가 계보를 타고 오른다
  const evs = ripple(g2, graph, ctx);
  assert.ok(evs[0].ancestors.some((a) => a.id === 'G-0.1.1'));
});
