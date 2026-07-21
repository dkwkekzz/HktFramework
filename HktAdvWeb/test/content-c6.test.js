// C6 — 기다림의 세계: H2 반증이 진행을 낭비하지 않는다 + 한파 창 판정
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC6 } from '../src/content/c6.js';

const graph = loadGraph();

test('장비 준비: 균류 단열재 정제 → 내한 장비 (0.2.2.1 = 0.4.1 동시 충족)', () => {
  const r = runC6(graph);
  assert.equal(r.equip.made, true, '내한 장비 제작');
  assert.equal(r.equip.coldAdapt, true, '한랭 적응도 함께 (DAG 다중 부모)');
});

test('§7 여는 목적: 독기 적응(0.4.2)도 열려 R3 심부가 개방된다', () => {
  const r = runC6(graph);
  assert.equal(r.equip.poisonAdapt, true, '독기내성 축적 → 0.4.2 완료');
});

test('한파 창 안에서만 H2 저온 실험이 유효하다 (환경 창 판정)', () => {
  const r = runC6(graph);
  assert.equal(r.h2.expDoneInWindow, true, '한파 창 안 유효 저온에서 실험 완료');
  assert.equal(r.h2.effectiveColdOutside, false, '한파 창 밖은 유효 저온 미달 — 실험 무효');
});

test('H2 는 반증되고 그 하위 가지가 믿음에서 붕괴한다', () => {
  const r = runC6(graph);
  assert.equal(r.h2.verdict, '반증');
  assert.ok(r.h2.collapsed.includes('G-0.1.1.2.H2'));
  assert.ok(r.h2.collapsed.includes('G-0.1.1.2.H2.1'), '하위 가지도 붕괴');
});

test('반증되어도 내한 장비·적응은 완료로 잔존한다 (실패한 가설 ≠ 낭비)', () => {
  const r = runC6(graph);
  assert.equal(r.retained.equip, true);
  assert.equal(r.retained.coldAdapt, true);
});

test('전 주기 전면 가동이 창 겹침을 만든다 (서로 소 → 드문 자연 이벤트)', () => {
  const r = runC6(graph);
  assert.ok(r.overlaps >= 1, '두 창이 겹치는 순간이 존재');
});

test('audit + 정제/실험 사건 감사 성립', () => {
  const r = runC6(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '정제'));
});
