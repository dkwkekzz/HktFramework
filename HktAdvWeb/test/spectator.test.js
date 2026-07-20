// F2 — 관전 데모 통합: 방송 서술자 스키마 + 서버 기동 회귀
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemo } from '../demo/scenario.js';
import { startServer } from '../demo/server.js';

test('데모 스냅샷이 봇 N기 관전(multibot) 구획을 담는다', () => {
  const d = buildDemo();
  assert.ok(d.multibot, 'multibot 구획 존재');
  assert.equal(d.multibot.results['bot-A'], 'success');
  assert.equal(d.multibot.results['bot-B'], 'timeout');
  assert.equal(d.multibot.audit.ok, true);
});

test('관전 Scene 서술자가 스키마를 만족한다 (방송 대상)', () => {
  const scene = buildDemo().multibot.scene;
  assert.ok(scene.ui?.goalGraph?.nodes?.length, 'goalGraph.nodes');
  assert.ok(Array.isArray(scene.effects), 'effects 배열');
  // 완료 파문이 관전 화면에 흐른다 (타인의 완료 링)
  assert.ok(scene.effects.some((e) => e.kind === 'ripple'), '완료 파문 effect');
  // 봇 B 시점에 신규 목적 G-0.1.4 가 드러난다 (aftermath 연쇄의 관전 근거)
  const g14 = scene.ui.goalGraph.nodes.find((n) => n.id === 'G-0.1.4');
  assert.equal(g14.masked, false, 'aftermath 로 발견된 목적이 관전 뷰에 보인다');
});

test('서버가 관전 스냅샷을 방송한다 (GET /api/demo → multibot 포함)', async () => {
  const s = await startServer(0);
  try {
    const res = await fetch(`${s.url}/api/demo`);
    assert.equal(res.status, 200);
    const d = await res.json();
    assert.ok(d.multibot?.scene?.ui?.goalGraph, '방송 서술자에 관전 Scene 이 실린다');
  } finally {
    await s.close();
  }
});
