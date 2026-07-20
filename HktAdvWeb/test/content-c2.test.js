// C2 — 가설의 탄생: 심장 이중 파문 + 가설 경합·H1 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph/loader.js';
import { runC2 } from '../src/content/c2.js';

const graph = loadGraph();

test('심장 1개 채취가 약물(0.2.3.2)·약점(0.1.1.2) 두 계보로 동시 파문한다', () => {
  const r = runC2(graph);
  assert.equal(r.heart.done, true, '심장 채취로 0.2.3.2.1 완료');
  assert.ok(r.heart.branches.includes('G-0.2.3.2'), '약물 계보 파문');
  assert.ok(r.heart.branches.includes('G-0.1.1.2'), '약점 계보 파문');
  assert.equal(r.heart.branches.length, 2, '정확히 두 갈래');
});

test('가설 경합: H1(공명)은 확인으로 굳고, H2(저온)는 미검증 경합으로 남는다', () => {
  const r = runC2(graph);
  assert.equal(r.hypothesis.h1, '확인');
  assert.equal(r.hypothesis.h2, '추정', 'H2 는 C2 에선 경합만 (반증은 C6)');
  assert.equal(r.hypothesis.h11Done, true, '진동 수단 제작 완료');
  assert.equal(r.hypothesis.h12Done, true, '진동 실험 완료');
});

test('H1 확인이 0.1.1.2(약점 발견)를 완료시켜 상향 파문한다', () => {
  const r = runC2(graph);
  assert.equal(r.weakness.done, true);
  const anc = r.weakness.ripples.flatMap((e) => e.ancestors.map((a) => a.id));
  assert.ok(anc.includes('G-0.1.1.2') && anc.includes('G-0.1.1'));
});

test('audit + 사건 감사 성립 (채취·결합·실험이 에너지 수지와 함께)', () => {
  const r = runC2(graph);
  assert.equal(r.audit.ok, true);
  assert.ok(r.events.some((e) => e.verb === '결합' && e.energy > 0));
  assert.ok(r.events.some((e) => e.verb === '실험' && e.energy > 0));
});
