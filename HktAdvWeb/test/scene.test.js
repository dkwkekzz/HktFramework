// D1~D3 — Scene 서술자 + ViewModel + 렌더러 의존 방향
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { BeliefView } from '../src/epistemic/belief.js';
import { buildScene, translateEffects, traceToConditions } from '../src/scene/viewmodel.js';

const here = dirname(fileURLToPath(import.meta.url));
const lex = loadLexicon();
const graph = loadGraph();

function predCtx(belief) {
  return { constants: graph.constants, lexicon: lex, belief, actor: { id: 'bot', inventory: [] }, state: { world: {}, stage: {} } };
}

test('D1: 같은 세계 시퀀스 → 같은 서술자 (스냅샷 회귀·결정론)', () => {
  const b1 = BeliefView.fromGraph(graph, 'bot');
  const b2 = BeliefView.fromGraph(graph, 'bot');
  const s1 = buildScene({ graph, belief: b1, tick: 2, focus: 'G-0.1.1.2', predCtx: predCtx(b1) });
  const s2 = buildScene({ graph, belief: b2, tick: 2, focus: 'G-0.1.1.2', predCtx: predCtx(b2) });
  assert.deepEqual(s1, s2, 'ViewModel 은 순수 — 같은 입력 같은 출력');
});

test('D1: goalGraph 는 BeliefView 파생 — 미발견은 "?"(제목 없음)', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  const scene = buildScene({ graph, belief: b, predCtx: predCtx(b) });
  const masked = scene.ui.goalGraph.nodes.find((n) => n.masked);
  assert.equal(masked.label, '?');
  assert.ok(!('title' in masked), '미발견 노드는 전역 제목을 노출하지 않는다');
});

test('D2: 발견 상태 4값이 한 서술자에 모두 실린다', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  b.set('G-0.1.1.2.H2', '반증'); // 확인/추정/미발견 은 seed 에 이미 있음
  const scene = buildScene({ graph, belief: b, predCtx: predCtx(b) });
  const states = new Set(scene.ui.goalGraph.nodes.map((n) => n.state));
  for (const s of ['확인', '추정', '미발견', '반증']) assert.ok(states.has(s), `${s} 노드가 서술자에 있다`);
});

test('D2: 조건 슬롯은 텍스트 서술이고 퍼센트를 쓰지 않는다', () => {
  const b = BeliefView.fromGraph(graph, 'bot');
  const scene = buildScene({ graph, belief: b, focus: 'G-0', predCtx: predCtx(b) });
  assert.ok(scene.ui.card.conditions.length >= 1);
  for (const c of scene.ui.card.conditions) {
    assert.equal(typeof c.text, 'string');
    assert.ok(!c.text.includes('%'), '퍼센트 금지 (숫자 없는 진행)');
  }
});

test('D3: ripple/collapse/retro-bind 이벤트 → effects 번역', () => {
  const events = [
    { type: 'ripple', completed: 'G-0.1.1.2.1', branch: 'G-0.1.1.2', ancestors: [{ id: 'G-0.1.1.2' }, { id: 'G-0.1.1' }, { id: 'G-0' }] },
    { type: 'collapse', id: 'G-0.1.1.2.H2', collapsed: ['G-0.1.1.2.H2', 'G-0.1.1.2.H2.1'] },
    { type: 'retro-bind', node: 'G-0.1.1.3.2', links: [{ material: '수정편', property: '공명전달률' }] },
  ];
  const fx = translateEffects(events);
  const ripple = fx.find((f) => f.kind === 'ripple');
  assert.deepEqual(ripple.path, ['G-0.1.1.2.1', 'G-0.1.1.2', 'G-0.1.1', 'G-0'], '파문 경로는 ViewModel 이 계산');
  assert.ok(fx.some((f) => f.kind === 'collapse' && f.nodes.length === 2));
  assert.ok(fx.some((f) => f.kind === 'retro-bind' && f.node === 'G-0.1.1.3.2'));
});

test('D1 done_when: 렌더러(demo/graph-*.js)는 src/ 를 import 하지 않는다 (불변 원칙 ⑥)', () => {
  const renderers = readdirSync(here === '' ? '.' : join(here, '..', 'demo'))
    .filter((f) => /^graph-.*\.js$/.test(f));
  assert.ok(renderers.length >= 2, '방사형·별자리 렌더러가 존재한다');
  for (const f of renderers) {
    const src = readFileSync(join(here, '..', 'demo', f), 'utf8');
    assert.ok(!/from\s+['"][^'"]*\/src\//.test(src), `${f} 는 src/ 를 import 하지 않는다`);
    assert.ok(!/import\s*\(?\s*['"][^'"]*\/src\//.test(src), `${f} 는 src/ 를 동적 import 하지 않는다`);
  }
});

test('traceToConditions 는 복합 술어(all)를 평탄한 조건 목록으로 편다', () => {
  const trace = { op: 'all', value: false, children: [
    { op: 'state', path: 'world.신.영향력', found: true, actual: 0.5, cmp: { op: '<=', value: 0.2 }, value: false },
    { op: 'state', path: 'world.신.재앙발생가능', found: false, actual: undefined, cmp: { op: '==', value: false }, value: false },
  ] };
  const lines = traceToConditions(trace);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => 'text' in l && 'met' in l));
});
