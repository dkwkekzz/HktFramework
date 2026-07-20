// C4 — 앎의 문: 접근권 게이트 + E2 백로그 공급 0→1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC4 } from '../src/content/c4.js';

const graph = loadGraph();

test('지식 없는 봇은 문전에서 차단되고, 지식 갖춘 봇은 문을 연다', () => {
  const r = runC4(graph);
  assert.equal(r.doorGate.noknowBlocked, true, '고대문자 지식 없으면 조율 불가');
  assert.equal(r.doorGate.knowOpened, true, '지식 봇은 접근권 확보');
});

test('지식이 물리적 문을 연다 — 해독으로 신의 정체가 확인된다', () => {
  const r = runC4(graph);
  assert.equal(r.해독Done, true);
});

test('문이 열리면 E2 백로그에서 0.1.1.3.3 이 빠진다 (공급 0→1)', () => {
  const r = runC4(graph);
  assert.equal(r.backlog.before, true, '문 열기 전엔 백로그');
  assert.equal(r.backlog.after, false, '문 열린 뒤엔 이탈');
  assert.equal(r.backlog.dropped, true, 'C4 완료의 술어');
  assert.equal(r.storeDone, true, '축전 결정 확보');
});

test('앎의 문을 지나야 무기 사슬(0.1.1.3.4)이 완성 가능해진다', () => {
  const r = runC4(graph);
  assert.equal(r.weaponReady, true);
});

test('audit + 조율 사건 감사 성립', () => {
  const r = runC4(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '조율'));
});
