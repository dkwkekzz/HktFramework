// 영속 — 이 팩의 세계로 실측 (design/Design-World-Persistence.md)
//
// 커널 수준의 계약은 engine/world-kernel/tests/persistence.spec.ts 가 검증한다.
// 여기서는 "걸어 둔 것이 재접속 후 그대로인가" 를 이 팩의 실제 State(소지품·장비·광맥)로
// 확인하고, 기본 배치(자율 존재 포함) 세계의 결정론이 스냅샷을 거쳐도 이어지는지 본다.

import { describe, expect, it } from 'vitest';
import { createWorld, restoreWorld, type World } from '../index';
import { STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';

const OBSERVER = 'observer-1';

function ticks(world: World, count: number): void {
  for (let i = 0; i < count; i += 1) world.tick(TICK_INTERVAL);
}

const stateOf = (world: World): WorldState => world.snapshot().state as WorldState;

describe('영속 — proto-adventure 실측', () => {
  it('걸어 둔 것이 재접속 후 그대로다 — 몸·소지품·장비·광맥이 스냅샷을 거쳐 이어진다', () => {
    const world = createWorld({ npcs: [] });
    world.join(OBSERVER);
    ticks(world, 10);
    const before = stateOf(world);
    const player = before.actors[0]!;
    expect(before.observers[0]!.actorId).toBe(player.id);

    const restored = restoreWorld(world.snapshot());
    expect(restored).not.toBeNull();
    expect(restored!.observers[0]!.present).toBe(false);

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(TICK_INTERVAL);
    const after = stateOf(revived);

    // 재참여 — 새 몸이 생기지 않고 이전 몸이 이어진다
    expect(after.actors).toHaveLength(before.actors.length);
    expect(after.observers[0]!.actorId).toBe(player.id);
    // 걸어 둔 것 · 지닌 것 · 세계의 남은 것이 그대로다
    const revivedPlayer = after.actors.find((a) => a.id === player.id)!;
    expect(revivedPlayer.equipment).toEqual(player.equipment);
    expect(revivedPlayer.inventory).toEqual(player.inventory);
    expect(after.deposits).toEqual(before.deposits);
  });

  it('결정론 — 기본 배치 세계가 스냅샷을 거쳐도 같은 이야기를 이어 간다', () => {
    const N = 60;
    const unbroken = createWorld();
    ticks(unbroken, 2 * N);

    const interrupted = createWorld();
    ticks(interrupted, N);
    const revived = createWorld({}, restoreWorld(interrupted.snapshot())!);
    ticks(revived, N);

    expect(revived.snapshot()).toEqual(unbroken.snapshot());
  });

  it('버전이 다른 스냅샷은 복구되지 않는다', () => {
    const world = createWorld({ npcs: [] });
    ticks(world, 5);
    const snapshot = world.snapshot();
    expect(snapshot.version).toBe(STATE_VERSION);
    expect(restoreWorld({ ...snapshot, version: 'other-pack/1' })).toBeNull();
  });
});
