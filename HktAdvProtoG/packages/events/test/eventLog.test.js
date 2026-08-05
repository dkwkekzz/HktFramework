import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventLog, ReplayStore } from '../src/eventLog.js';
import { stateHash } from '../../verification/src/deterministic.js';

const reducer = (state, ev) => (ev.type === 'add' ? { n: state.n + ev.payload.v } : state);

test('이벤트 재생은 상태를 재현한다 (사건 기반 상태 변경)', () => {
  const log = new EventLog();
  log.append('add', { v: 3 }, { tick: 1 });
  log.append('add', { v: 4 }, { tick: 2 });
  assert.deepEqual(log.replay({ n: 0 }, reducer), { n: 7 });
});

test('직렬화 왕복 후 재생 해시가 같다 (리플레이 저장소 왕복)', () => {
  const log = new EventLog();
  log.append('add', { v: 1 }, { tick: 1, traceId: 'cmd-0' });
  log.append('add', { v: 2 }, { tick: 1, traceId: 'cmd-1' });
  const restored = EventLog.fromJSON(JSON.parse(JSON.stringify(log.toJSON())));
  assert.equal(
    stateHash(restored.replay({ n: 0 }, reducer)),
    stateHash(log.replay({ n: 0 }, reducer)),
  );
  assert.deepEqual(restored.list(), log.list());
});

test('ReplayStore 저장·로드 왕복 (Foundation 리플레이 저장소)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'advprotog-replay-'));
  const store = new ReplayStore(dir);
  const log = new EventLog();
  log.append('add', { v: 9 }, { tick: 1 });
  store.save('demo', log);
  const loaded = store.load('demo');
  assert.deepEqual(loaded.replay({ n: 0 }, reducer), { n: 9 });
});

test('type 없는 이벤트는 거부한다 (실패 경로)', () => {
  const log = new EventLog();
  assert.throws(() => log.append(undefined, {}));
});
