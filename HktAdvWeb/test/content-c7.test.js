// C7 — 결전과 그 후: 경로 무관 판정(원칙 ①) + aftermath 대전환·재개방·신규 목적
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC7, runC7AccessGate } from '../src/content/c7.js';

const graph = loadGraph();

test('무기 파괴형·수송 차단 아사형 두 해법이 같은 0.1.1 done_when 을 충족한다 (원칙 ①)', () => {
  const r = runC7(graph);
  assert.equal(r.paths.weapon.done, true, '무기 파괴형: 신 제거 완료');
  assert.equal(r.paths.starve.done, true, '수송 차단 아사형: 신 제거 완료');
  assert.equal(r.pathIndependent, true, '경로 무관 — 완료는 상태를 묻고 경로를 묻지 않는다');
});

test('결전 방식이 신의 육체 재료 품질을 다르게 남긴다 (같은 무대, 다른 산출)', () => {
  const r = runC7(graph);
  // 파괴형은 잔향 손상, 아사형은 촉매 급감
  assert.ok(r.paths.starve.잔향 > r.paths.weapon.잔향, '아사형이 잔향 온전');
  assert.ok(r.paths.weapon.촉매 > r.paths.starve.촉매, '파괴형이 촉매 온전');
});

test('R0 은 월식 창에만 열린다 — 창 밖 봇은 접근 차단', () => {
  const r = runC7AccessGate(graph);
  assert.equal(r.eclipseOpen, false, '월식 창 밖');
  assert.equal(r.blocked, true, 'R0 진입 차단');
});

test('B3 재개방: 신 제거 후 둥지 재활성으로 0.1.2 가 다시 거짓이 된다', () => {
  const r = runC7(graph);
  assert.ok(r.aftermath.reopened.includes('G-0.1.2'), '완료가 영구 플래그가 아님의 실증');
});

test('aftermath 후 신규 목적 후보가 E2 관문을 통과해 편입된다 (다음 세대의 씨앗)', () => {
  const r = runC7(graph);
  assert.ok(r.aftermath.admittedGoals.length >= 1, '재편 세계에서 새 목적이 열린다');
});

test('audit + 결전 사건 감사 성립', () => {
  const r = runC7(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '결전'));
  assert.ok(r.events.some((e) => e.verb === 'aftermath'));
});
