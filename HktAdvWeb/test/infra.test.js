// A1 — 검증 인프라: 데모 서버 기동 → GET / → 200 → 종료 (자리표 테스트 금지)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../demo/server.js';

test('데모 서버가 기동하고 GET / 이 200 + HTML 을 준다', async () => {
  const s = await startServer(0);
  try {
    const res = await fetch(`${s.url}/`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /HktAdvWeb/);
    assert.match(res.headers.get('content-type'), /text\/html/);
  } finally {
    await s.close();
  }
});

test('GET /api/demo 가 200 + Phase A 스냅샷을 준다', async () => {
  const s = await startServer(0);
  try {
    const res = await fetch(`${s.url}/api/demo`);
    assert.equal(res.status, 200);
    const d = await res.json();
    // 스냅샷이 Phase A 전 구획을 담는다.
    for (const key of ['lexicon', 'substances', 'inventory', 'ledger', 'events', 'predicates']) {
      assert.ok(key in d, `스냅샷에 ${key} 가 있다`);
    }
    assert.equal(d.ledger.audit.ok, true, '데모 원장 감사가 성립한다');
  } finally {
    await s.close();
  }
});

test('없는 경로는 404', async () => {
  const s = await startServer(0);
  try {
    const res = await fetch(`${s.url}/nope.html`);
    assert.equal(res.status, 404);
  } finally {
    await s.close();
  }
});
