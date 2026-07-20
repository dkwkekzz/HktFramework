// A4 — 상태 술어 질의 (Predicate DSL v0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalPred } from '../src/substrate/predicate.js';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { Substance } from '../src/substrate/substance.js';
import { Ledger } from '../src/substrate/ledger.js';

const lex = loadLexicon();
const constants = { 잔향보존_최소: 0.6, 신영향_임계: 0.2 };

test('state: 세계 경로 비교 + const 참조', () => {
  const ctx = { constants, state: { world: { 신: { 영향력: 0.15 } } } };
  const r = evalPred({ state: { path: 'world.신.영향력', op: '<=', value: 'const.신영향_임계' } }, ctx);
  assert.equal(r.value, true);
  assert.equal(r.trace.actual, 0.15);
  assert.equal(r.trace.cmp.value, 0.2); // const 가 해석됨
});

test('state: 미정의 경로는 미충족(found=false)', () => {
  const r = evalPred({ state: { path: 'world.신.없음', op: '>', value: 0 } }, { state: { world: {} } });
  assert.equal(r.value, false);
  assert.equal(r.trace.found, false);
});

test('has: 보유 재료를 품목이 아니라 속성으로 스캔', () => {
  const inv = [
    new Substance({ id: 'x', kind: '물질', properties: { 신성잔향보존율: 0.72 } }, lex),
    new Substance({ id: 'y', kind: '물질', properties: { 신성잔향보존율: 0.2 } }, lex),
  ];
  const ctx = { constants, lexicon: lex, actor: { id: 'bot', inventory: inv } };
  const pred = { has: { kind: '물질', property: { name: '신성잔향보존율', op: '>=', value: 'const.잔향보존_최소' }, min_count: 1 } };
  const r = evalPred(pred, ctx);
  assert.equal(r.value, true);
  assert.deepEqual(r.trace.matched, ['x']);
});

test('has: 에너지·잔고는 원장을 읽는다', () => {
  const L = new Ledger();
  L.open('bot', 15);
  const ctx = { lexicon: lex, actor: { id: 'bot', inventory: [] }, ledger: L };
  assert.equal(evalPred({ has: { kind: '에너지', property: { name: '잔고', op: '>=', value: 10 } } }, ctx).value, true);
  assert.equal(evalPred({ has: { kind: '에너지', property: { name: '잔고', op: '>=', value: 20 } } }, ctx).value, false);
});

test('has: 미등재 속성명은 거부된다', () => {
  const ctx = { lexicon: lex, actor: { id: 'b', inventory: [] } };
  assert.throws(() => evalPred({ has: { kind: '물질', property: { name: '없는속성', op: '>=', value: 1 } } }, ctx), /미등재 속성/);
});

test('all / any / not 조합', () => {
  const ctx = { state: { world: { a: 1, b: 5 } } };
  const p = {
    all: [
      { state: { path: 'world.a', op: '==', value: 1 } },
      { any: [
        { state: { path: 'world.b', op: '>', value: 10 } },
        { not: { state: { path: 'world.b', op: '<', value: 0 } } },
      ] },
    ],
  };
  const r = evalPred(p, ctx);
  assert.equal(r.value, true);
  assert.equal(r.trace.op, 'all');
  assert.equal(r.trace.children.length, 2);
});

test('epistemic / event 는 ctx 미주입 시 스텁 (항상 미충족 + trace 스텁 표시)', () => {
  const er = evalPred({ epistemic: { tag: '신.약점', is: '확인', min_count: 1 } }, {});
  assert.equal(er.value, false);
  assert.equal(er.trace.stub, true);
  const vr = evalPred({ event: { verb: '실험', target_tag: '신.조직', min_count: 1 } }, {});
  assert.equal(vr.value, false);
  assert.equal(vr.trace.stub, true);
});

test('미지 연산자는 거부된다', () => {
  assert.throws(() => evalPred({ 없는연산자: 1 }, {}), /미지 술어 연산자/);
});

test('알 수 없는 상수 참조는 거부된다', () => {
  assert.throws(() => evalPred({ state: { path: 'world.x', op: '>', value: 'const.없음' } }, { constants: {}, state: {} }), /알 수 없는 상수/);
});

test('trace 형태 스냅샷 (파문·숫자 없는 진행의 먹이)', () => {
  const ctx = { constants, state: { world: { 신: { 영향력: 0.15 } } } };
  const r = evalPred({ state: { path: 'world.신.영향력', op: '<=', value: 'const.신영향_임계' } }, ctx);
  assert.deepEqual(r.trace, {
    op: 'state', path: 'world.신.영향력', found: true, actual: 0.15,
    cmp: { op: '<=', value: 0.2 }, value: true,
  });
});
