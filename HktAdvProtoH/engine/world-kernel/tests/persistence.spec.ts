// 영속 — 스냅샷과 복구 (design/Design-World-Persistence.md)
//
// Engine 은 팩 State 를 해석하지 않으므로 여기서도 최소 팩(걷는 존재 하나)을 인라인으로
// 등록해 검증한다 — content/ 를 import 하지 않는다 (boundary 규칙).
//
// 사실은 영속되고 과정은 영속되지 않는다:
//   1. 스냅샷 → 복구 후 State 의 사실(자리·시간)이 동일하다
//   2. 복구 직후 모든 관찰자의 present=false, 재참여하면 새 몸이 생기지 않는다
//   3. 결정론 — 끊김 없이 2N Tick == N Tick → 스냅샷 → 복구 → N Tick
//   4. 버전 불일치 스냅샷은 복구되지 않는다 (null — 새 세계는 부르는 쪽의 일)

import { describe, expect, it } from 'vitest';
import type { WorldContent } from '../content';
import { createWorldKernel, type World } from '../kernel';
import { restoreState } from '../persistence';
import type { CoreWorldState } from '../state';

interface TestState extends CoreWorldState {
  walkers: { id: string; x: number }[];
}

const VERSION = 'test/1';
const DT = 1 / 30;

function createTestWorld(restored?: TestState): World {
  const state: TestState = restored ?? { time: 0, observers: [], walkers: [] };
  const content: WorldContent<TestState> = {
    tickInterval: DT,
    stateVersion: VERSION,
    spawnObserverBody: (s, ordinal) => {
      const id = `walker-${ordinal + 1}`;
      s.walkers.push({ id, x: 0 });
      return id;
    },
    interactions: [],
    systems: [
      (s, dt) => {
        for (const walker of s.walkers) walker.x += dt;
      },
    ],
    postTimeSystems: [],
    projectObserver: () => null,
  };
  return createWorldKernel(state, content);
}

function ticks(world: World, count: number): void {
  for (let i = 0; i < count; i += 1) world.tick(DT);
}

const stateOf = (world: World): TestState => world.snapshot().state as TestState;

describe('영속 — 스냅샷과 복구', () => {
  it('스냅샷은 그 순간의 사실을 담고, 이후의 세계 진행이 스냅샷을 바꾸지 못한다', () => {
    const world = createTestWorld();
    world.join('obs-1');
    ticks(world, 10);

    const snapshot = world.snapshot();
    expect(snapshot.version).toBe(VERSION);
    const captured = snapshot.state as TestState;
    const capturedTime = captured.time;
    const capturedX = captured.walkers[0]!.x;

    ticks(world, 10); // 세계는 계속 간다 — 스냅샷은 그대로여야 한다
    expect(captured.time).toBe(capturedTime);
    expect(captured.walkers[0]!.x).toBe(capturedX);
    expect(stateOf(world).time).toBeGreaterThan(capturedTime);
  });

  it('복구는 사실을 되살리고 이어짐은 되살리지 않는다 — 재참여해도 새 몸이 생기지 않는다', () => {
    const world = createTestWorld();
    world.join('obs-1');
    ticks(world, 10);
    const before = stateOf(world);
    expect(before.observers[0]!.present).toBe(true);

    const restored = restoreState<TestState>(world.snapshot(), VERSION);
    expect(restored).not.toBeNull();
    // 사실은 그대로다
    expect(restored!.time).toBe(before.time);
    expect(restored!.walkers).toEqual(before.walkers);
    // 이어짐은 과정이다 — 기동 직후 아무도 보고 있지 않다
    expect(restored!.observers[0]!.present).toBe(false);

    const revived = createTestWorld(restored!);
    revived.join('obs-1');
    revived.tick(DT);
    const after = stateOf(revived);
    // RULE-OBSERVER-JOIN-001 재참여 — 이전 몸이 이어진다
    expect(after.walkers).toHaveLength(before.walkers.length);
    expect(after.observers[0]!.actorId).toBe(before.observers[0]!.actorId);
    expect(after.observers[0]!.present).toBe(true);
  });

  it('결정론 — 끊김 없이 돈 세계와 스냅샷을 거쳐 돈 세계의 이야기가 같다', () => {
    const N = 20;
    const unbroken = createTestWorld();
    ticks(unbroken, 2 * N);

    const interrupted = createTestWorld();
    ticks(interrupted, N);
    const revived = createTestWorld(restoreState<TestState>(interrupted.snapshot(), VERSION)!);
    ticks(revived, N);

    expect(revived.snapshot()).toEqual(unbroken.snapshot());
  });

  it('버전이 다른 스냅샷은 복구되지 않는다', () => {
    const world = createTestWorld();
    ticks(world, 5);
    const snapshot = world.snapshot();
    expect(restoreState<TestState>(snapshot, VERSION)).not.toBeNull();
    expect(restoreState<TestState>({ ...snapshot, version: 'other/1' }, VERSION)).toBeNull();
  });
});
