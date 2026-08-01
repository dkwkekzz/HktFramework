// V1 검증 시나리오 3종 — 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1).
// V2 시나리오 실행기가 아직 없으므로 node:test 로 수동 수행한다 (WORKFLOW §5 단서).
// V2 완성 시 아래 세 시나리오를 Scenario{arrange,act,assert} 로 소급 등록한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createRandom, nextInt, pick, shuffle, stateHash } from '../../src/v1/index.ts';
import { firstDivergence, runToyWorld } from '../../verify/v1-toy-world.ts';

describe('v1-same-seed-100 (정상)', () => {
  test('같은 시드로 100회 실행 → 사건 순서와 최종 상태 해시가 전부 같다', () => {
    const first = runToyWorld('배고픈 인간 1 + 음식 1');
    const stateHashes = new Set<string>([first.stateHash]);
    const eventHashes = new Set<string>([first.eventHash]);

    for (let run = 1; run < 100; run += 1) {
      const again = runToyWorld('배고픈 인간 1 + 음식 1');
      stateHashes.add(again.stateHash);
      eventHashes.add(again.eventHash);
      assert.equal(firstDivergence(first, again), null, `${String(run)}회차에서 사건이 갈라졌다`);
    }

    assert.equal(stateHashes.size, 1, `상태 해시 종류: ${[...stateHashes].join(', ')}`);
    assert.equal(eventHashes.size, 1, `사건 해시 종류: ${[...eventHashes].join(', ')}`);
    assert.equal(first.events.length, 60);
  });

  test('난수 상태를 저장·복원해 이어 돌려도 같은 결과다', () => {
    const original = runToyWorld('replay');
    const revived = JSON.parse(JSON.stringify(original)) as typeof original;
    assert.equal(stateHash(revived.world), original.stateHash);
    assert.equal(stateHash(revived.events), original.eventHash);
  });
});

describe('v1-seed-drift-detected (실패)', () => {
  test('시드가 한 글자만 달라도 해시가 갈라지고, 최초 분기 지점이 지목된다', () => {
    const left = runToyWorld('배고픈 인간 1 + 음식 1');
    const right = runToyWorld('배고픈 인간 1 + 음식 2');

    assert.notEqual(left.stateHash, right.stateHash);
    assert.notEqual(left.eventHash, right.eventHash);

    const divergence = firstDivergence(left, right);
    assert.ok(divergence !== null, '갈라진 지점을 찾지 못했다');
    assert.ok(divergence.index >= 0 && divergence.index < left.events.length);
    // 분기 지점은 기대/실제를 함께 보여줘야 한다 (원문 V2 실패 출력 요건의 선행 형태).
    assert.ok(divergence.left !== null && divergence.right !== null);
    assert.notEqual(stateHash(divergence.left), stateHash(divergence.right));
  });

  test('결과에 손을 대면 해시가 즉시 달라진다 — 비결정을 검출한다', () => {
    const run = runToyWorld('tamper');
    const tampered = { ...run.world, stock: { ...run.world.stock, injected: 1 } };
    assert.notEqual(stateHash(tampered), run.stateHash);
  });
});

describe('v1-boundary (경계)', () => {
  test('틱 0 · 주체 0 — 빈 실행도 결정적이다', () => {
    const empty = runToyWorld('empty', 0, 0);
    assert.equal(empty.events.length, 0);
    assert.equal(empty.world.tick, 0);
    assert.equal(empty.stateHash, runToyWorld('empty', 0, 0).stateHash);
    // 사건이 없는 두 실행은 사건 해시가 같지만 상태 해시는 세계마다 다를 수 있다.
    assert.equal(empty.eventHash, runToyWorld('other-seed', 0, 0).eventHash);
  });

  test('시드 0 과 시드 "0" 은 서로 다른 시드다', () => {
    assert.notEqual(runToyWorld(0, 5, 1).eventHash, runToyWorld('0', 5, 1).eventHash);
    assert.equal(runToyWorld(0, 5, 1).eventHash, runToyWorld(0, 5, 1).eventHash);
  });

  test('1틱 1주체 — 최소 실행에서도 사건이 정확히 1개다', () => {
    const minimal = runToyWorld('minimal', 1, 1);
    assert.equal(minimal.events.length, 1);
    assert.equal(minimal.events[0]?.tick, 1);
  });

  test('빈 입력에 대한 난수 연산은 거부되거나 빈 결과를 준다', () => {
    const state = createRandom('boundary');
    assert.throws(() => pick(state, []), RangeError);
    assert.throws(() => nextInt(state, 0, 0), RangeError);
    assert.deepEqual(shuffle(state, [])[1], []);
    assert.deepEqual(shuffle(state, ['혼자'])[1], ['혼자']);
  });
});
