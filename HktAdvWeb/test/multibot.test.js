// F1 — 봇 N기 + aftermath 연쇄
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runMultiSim, loadMultiFixture } from '../src/actors/multibot.js';

const graph = loadGraph();

test('경쟁: 유한 공급을 두고 선착순으로 소진된다 (한 봇 성공, 다른 봇 밀림)', () => {
  const r = runMultiSim(graph, loadMultiFixture());
  assert.equal(r.results['bot-A'], 'success');
  assert.equal(r.results['bot-B'], 'timeout', '공급 소진 후 도착한 봇은 못 얻는다');
});

test('aftermath 연쇄: 한 완료가 다른 봇의 새 목적을 낳는다 (§5 원칙 5)', () => {
  const r = runMultiSim(graph, loadMultiFixture());
  // 완료 봇(A)은 G-0.1.4 를 아직 모르고, 다른 봇(B)에게만 새 목적이 발견된다
  assert.equal(r.beliefs['bot-A']['G-0.1.4'], '미발견');
  assert.equal(r.beliefs['bot-B']['G-0.1.4'], '추정', 'aftermath 로 봇 B 에 신규 위협 목적 등장');
});

test('aftermath 가 E3 플래너를 깨워 신규 하위 목적을 계산한다', () => {
  const r = runMultiSim(graph, loadMultiFixture());
  const planned = r.newGoals.filter((n) => n.bot === 'plan');
  assert.ok(planned.length >= 1, '드러난 세계 요소로 분해 후보가 계산된다');
  assert.ok(planned.every((p) => p.serves.includes('G-0.1.4')), '계산된 하위 목적이 신규 목적을 serves');
});

test('봇별 BeliefView 는 독립이다', () => {
  const r = runMultiSim(graph, loadMultiFixture());
  assert.notEqual(r.beliefs['bot-A']['G-0.1.4'], r.beliefs['bot-B']['G-0.1.4'], '두 봇의 믿음이 갈린다');
});

test('N봇 M틱 후 원장 audit() + 사건 감사가 성립한다 (불변식 일괄)', () => {
  const r = runMultiSim(graph, loadMultiFixture());
  assert.equal(r.audit.ok, true, '에너지 보존 불변식');
  assert.ok(r.events.every((e) => typeof e.energy === 'number'), '모든 사건이 에너지 수지와 함께');
  // aftermath 도 사건으로 감사된다
  assert.ok(r.events.some((e) => e.verb === 'aftermath'), 'aftermath 가 사건으로 기록됨');
  // 채취 사건이 있고 에너지가 실렸다
  assert.ok(r.events.some((e) => e.verb === '채취' && e.energy > 0));
});
