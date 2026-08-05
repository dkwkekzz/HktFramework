import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorityServer } from '../src/authority.js';
import { DEMO_INITIAL_STATE, demoHandlers, demoReducer } from '../../verification/src/foundationDemo.js';
import { stateHash } from '../../verification/src/deterministic.js';

function newServer() {
  return new AuthorityServer({ initialState: DEMO_INITIAL_STATE, handlers: demoHandlers, reducer: demoReducer });
}

test('동시 소유권 주장은 한 번만 확정된다 (SC-C01-N0/E3 원형)', () => {
  const server = newServer();
  const h1 = server.connect('H1');
  const h2 = server.connect('H2');
  h1.submit('claim-organ', { organId: 'organ-1' });
  h2.submit('claim-organ', { organId: 'organ-1' });
  const results = server.processPending();
  assert.equal(results.filter((r) => r.accepted).length, 1);
  assert.equal(results[0].accepted, true);
  assert.match(results[1].reason, /already-owned-by:H1/);
  assert.equal(server.getSnapshot().organ.owner, 'H1');
});

test('클라이언트는 스냅샷 변형으로 권위 상태를 바꿀 수 없다 (SC-C01-N0-01 원형)', () => {
  const server = newServer();
  const h2 = server.connect('H2');
  const snap = h2.snapshot();
  snap.organ.owner = 'H2';                       // 클라이언트 측 직접 확정 시도
  assert.equal(server.getSnapshot().organ.owner, null);
});

test('미지 명령은 거부되고 상태는 변하지 않는다 (실패 경로)', () => {
  const server = newServer();
  const before = stateHash(server.getSnapshot());
  server.connect('H1').submit('hack-state', { owner: 'H1' });
  const [r] = server.processPending();
  assert.equal(r.accepted, false);
  assert.equal(stateHash(server.getSnapshot()), before);
});

test('이벤트 로그 재생이 현재 권위 상태를 재현한다 (저장·복구 경로)', () => {
  const server = newServer();
  const h1 = server.connect('H1');
  h1.submit('track', { roll: 42 });
  server.processPending();
  h1.submit('claim-organ', { organId: 'organ-1' });
  server.processPending();
  const rebuilt = server.rebuildFromLog(DEMO_INITIAL_STATE);
  assert.equal(stateHash(rebuilt), stateHash(server.getSnapshot()));
});

test('사건에는 인과 추적 ID 가 유지된다 (Handoff Gate)', () => {
  const server = newServer();
  server.connect('H1').submit('track', { roll: 5 });
  server.processPending();
  const [ev] = server.log.list();
  assert.match(ev.traceId, /^cmd-\d+$/);
  assert.equal(ev.tick, 1);
});
