// RULE-TARGET-SELECT-001 · RULE-TARGET-CLEAR-001 · RULE-TARGET-CLEAR-STALE-001
// World 단독 테스트 — Before → Input → Rule → After (C017)
//
// Implements INTENT-TARGET-SELECT-001 · INTENT-TARGET-ELIGIBLE-001 ·
//            INTENT-TARGET-PER-OBSERVER-001 · INTENT-TARGET-PERSISTS-001 ·
//            INTENT-TARGET-RELEASE-001 · INTENT-TARGET-IS-NOT-AIM-001 ·
//            INTENT-TARGET-DIRECTS-THE-ACT-001 · INTENT-TARGET-OBSERVE-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ruleTargetClearStale } from '../simulation/target-clear-stale';
import { OBSERVE_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, selectTarget } from './drive';

const solo = { npcs: [] };
// 다가오지 않는 자율 존재 — 지목 자체를 재는 자리에서는 인지 거리를 0 으로 둔다
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const targetOf = (v: GameViewSnapshot) => v.currentTarget.entityId;
const selectOf = (v: GameViewSnapshot, id: string) =>
  v.interactions.find((i) => i.id === 'select-target' && i.targetEntityId === id);
const interactionOf = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);

describe('RULE-TARGET-SELECT-001 — 고른 관계가 세계에 선다', () => {
  it('존재 하나를 고르면 세계가 그것을 지닌다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    expect(targetOf(world.observe())).toBeUndefined(); // 시작은 아무것도 안 고른 상태다

    expect(selectTarget(world, 'npc-1')).toEqual({
      status: 'success',
      rule: 'RULE-TARGET-SELECT-001',
    });
    expect(targetOf(world.observe())).toBe('npc-1');
  });

  it('광맥도 고를 수 있다 — 고를 수 있는 것과 무엇을 할 수 있는 것은 다르다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    expect(selectTarget(world, 'deposit-1').status).toBe('success');
    expect(targetOf(world.observe())).toBe('deposit-1');
  });

  it('새로 고르면 앞의 것을 대신한다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(4, 0, 'npc-2')] });

    selectTarget(world, 'npc-1');
    selectTarget(world, 'npc-2');
    expect(targetOf(world.observe())).toBe('npc-2');
  });

  it('이미 고른 것을 다시 골라도 유지된다 — 토글 해제가 아니다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    selectTarget(world, 'npc-1');
    expect(selectTarget(world, 'npc-1').status).toBe('success');
    expect(targetOf(world.observe())).toBe('npc-1');
  });

  it('자기 몸은 고를 수 없다 — 사유가 돌아온다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    expect(selectTarget(world, PLAYER)).toEqual({
      status: 'failure',
      rule: 'RULE-TARGET-SELECT-001',
      reason: 'target-is-self',
    });
    expect(targetOf(world.observe())).toBeUndefined();
  });

  it('관찰에 실리지 않는 Id 는 고를 수 없다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    expect(selectTarget(world, '없는-것')).toMatchObject({ reason: 'no-such-target' });
    expect(targetOf(world.observe())).toBeUndefined();
  });

  it('고르는 일은 행동이 아니다 — 다른 행동 중에도 고를 수 있고 하던 행동이 끊기지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(4, 0, 'npc-2')] });

    selectTarget(world, 'npc-1');
    world.dispatch({ interactionId: 'observe' });
    world.tick(TICK_INTERVAL);
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('observe');

    // 살펴보는 중에 다른 것을 고른다 — action-busy 에 걸리지 않는다
    expect(selectTarget(world, 'npc-2').status).toBe('success');
    world.tick(TICK_INTERVAL);
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('observe');
    expect(targetOf(world.observe())).toBe('npc-2');
  });
});

describe('INTENT-TARGET-PER-OBSERVER-001 — 고른 것은 보는 이의 것이다', () => {
  it('두 사람이 같은 세계에서 서로 다른 상대를 고른 채 선다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(4, 0, 'npc-2')] });
    world.join(OBSERVER_2);
    world.tick(0);

    selectTarget(world, 'npc-1', OBSERVER);
    selectTarget(world, 'npc-2', OBSERVER_2);

    expect(targetOf(world.observe(OBSERVER))).toBe('npc-1');
    expect(targetOf(world.observe(OBSERVER_2))).toBe('npc-2');
  });

  it('남이 무엇을 고르는지도, 누가 나를 고르는지도 관찰에 실리지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    world.join(OBSERVER_2);
    world.tick(0);

    selectTarget(world, PLAYER_2, OBSERVER); // 내가 남의 몸을 고른다
    const seenByTarget = world.observe(OBSERVER_2);

    // 골라진 쪽의 관찰 어디에도 그 사실이 없다
    expect(targetOf(seenByTarget)).toBeUndefined();
    expect(JSON.stringify(seenByTarget)).not.toContain('observer-1');
  });

  it('대상은 골라졌다는 이유만으로 달라지지 않는다 (DC-TARGET-IS-INTENT-NOT-AIM)', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const before = world.observe().entities.find((e) => e.id === 'npc-1');

    selectTarget(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    const after = world.observe().entities.find((e) => e.id === 'npc-1');

    expect(after?.vitality).toEqual(before?.vitality);
    expect(after?.attributes?.energy).toBe(before?.attributes?.energy);
    expect(after?.state).toBe(before?.state);
    // 고른다고 가려진 것이 열리지 않는다 — 앎의 길은 살펴봄과 통찰 둘뿐이다
    expect(after?.attributes?.acquainted).toBe(false);
    expect(after?.attributes?.concealed).toEqual(before?.attributes?.concealed);
  });

  it('고른다고 세계가 대신 다가가지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(10, 0)] });
    const before = world.observe().entities.find((e) => e.id === PLAYER)?.position;

    selectTarget(world, 'npc-1');
    for (let i = 0; i < 30; i++) world.tick(TICK_INTERVAL);

    expect(world.observe().entities.find((e) => e.id === PLAYER)?.position).toEqual(before);
  });
});

describe('INTENT-TARGET-PERSISTS-001 — 스스로 풀리지 않는다', () => {
  it('멀어져도 고른 것은 유지되고 사유만 갱신된다', () => {
    const world = driveWorld({ npcs: [dummyAt(OBSERVE_RANGE - 1, 0)] });
    selectTarget(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    expect(interactionOf(world.observe(), 'observe')?.available).toBe(true);

    // 반대쪽으로 걸어간다
    world.dispatch({ interactionId: 'move', position: { x: -15, z: 0 } });
    for (let i = 0; i < 120; i++) world.tick(TICK_INTERVAL);

    expect(targetOf(world.observe())).toBe('npc-1'); // 풀리지 않았다
    expect(interactionOf(world.observe(), 'observe')).toMatchObject({
      available: false,
      reason: 'out-of-range',
    });
  });

  it('쓰러진 대상도 고른 채로 남는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    selectTarget(world, 'npc-1');
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 0 },
    });
    world.tick(TICK_INTERVAL);

    expect(world.observe().entities.find((e) => e.id === 'npc-1')?.vitality?.downed).toBe(true);
    expect(targetOf(world.observe())).toBe('npc-1');
  });
});

describe('RULE-TARGET-CLEAR-001 — 명시적으로 푼다', () => {
  it('풀면 아무것도 고르지 않은 상태로 돌아간다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    selectTarget(world, 'npc-1');

    expect(world.dispatch({ interactionId: 'clear-target' })).toEqual({
      status: 'success',
      rule: 'RULE-TARGET-CLEAR-001',
    });
    expect(targetOf(world.observe())).toBeUndefined();
  });

  it('고른 것이 없어도 성공이다 — 같은 요청이 두 번 와도 결과가 같다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    expect(world.dispatch({ interactionId: 'clear-target' }).status).toBe('success');
    expect(world.dispatch({ interactionId: 'clear-target' }).status).toBe('success');
    expect(targetOf(world.observe())).toBeUndefined();
  });

  it('푸는 일은 언제나 가용하다 — 한 번도 고른 적 없어도 목록에 실린다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();
    expect(interactionOf(view, 'clear-target')).toMatchObject({
      role: 'clear-target',
      available: true,
    });
  });
});

describe('RULE-TARGET-CLEAR-STALE-001 — 성립하지 않게 된 관계를 세계가 비운다', () => {
  // REACHABILITY — 이 규칙은 **지금 세계에서 플레이로 도달하지 않는다** (03 · simulation 주석).
  // 존재가 세계에서 사라지는 경로가 0건이기 때문이다. 요청으로도 Tick 으로도 그 사건을
  // 만들 수 없으므로 여기서는 세계 State 를 직접 만들어 규칙을 부른다.
  // **이것은 플레이 검증이 아니다** — 08 이 그 사실을 그대로 적는다.
  const stateWith = (entityIds: string[], target: string): WorldState =>
    ({
      actors: entityIds.map((id) => ({ id })),
      deposits: [],
      targetSelections: [{ observerId: OBSERVER, targetEntityId: target }],
    }) as unknown as WorldState;

  it('대상이 세계에서 사라지면 그 관계가 비워진다', () => {
    const state = stateWith([], 'npc-1'); // 골랐던 존재가 이제 세계에 없다
    ruleTargetClearStale(state);
    expect(state.targetSelections).toEqual([]);
  });

  it('대상이 그대로 있으면 아무것도 비우지 않는다', () => {
    const state = stateWith(['npc-1'], 'npc-1');
    ruleTargetClearStale(state);
    expect(state.targetSelections).toEqual([
      { observerId: OBSERVER, targetEntityId: 'npc-1' },
    ]);
  });

  it('매 Tick 도는 자리에 있다 — 도는 세계에서 고른 것이 저절로 풀리지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    selectTarget(world, 'npc-1');
    for (let i = 0; i < 30; i++) world.tick(TICK_INTERVAL);
    expect(targetOf(world.observe())).toBe('npc-1');
  });
});

describe('INTENT-TARGET-DIRECTS-THE-ACT-001 — 행동이 고른 하나로 나간다', () => {
  it('아무것도 고르지 않으면 살펴봄도 채집도 사유와 함께 거절된다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    expect(world.dispatch({ interactionId: 'observe' })).toMatchObject({
      status: 'failure',
      reason: 'no-target-selected',
    });
    expect(world.dispatch({ interactionId: 'mine' })).toMatchObject({
      status: 'failure',
      reason: 'no-target-selected',
    });
    // 목록에서 사라지지 않는다 — 걸 수 있는 일은 언제나 먼저 밝혀져 있다
    expect(interactionOf(world.observe(), 'mine')).toMatchObject({
      available: false,
      reason: 'no-target-selected',
    });
  });

  it('요청이 실은 대상은 무시된다 — 대상을 정하는 곳은 하나다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    selectTarget(world, 'deposit-1');

    // 요청에 엉뚱한 대상을 실어도 세계는 고른 것을 캔다
    expect(
      world.dispatch({ interactionId: 'mine', targetEntityId: '없는-것' }).status,
    ).toBe('success');
    world.tick(TICK_INTERVAL);
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('mine');
  });

  it('고른 것의 종류가 맞지 않으면 그 사유가 온다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)], actorPosition: { x: 8, z: -5 } });

    selectTarget(world, 'npc-1'); // 존재를 고르고 캐려 한다
    expect(world.dispatch({ interactionId: 'mine' })).toMatchObject({
      status: 'failure',
      reason: 'target-kind-mismatch',
    });

    selectTarget(world, 'deposit-1'); // 광맥을 고르고 살펴보려 한다
    expect(world.dispatch({ interactionId: 'observe' })).toMatchObject({
      status: 'failure',
      reason: 'target-kind-mismatch',
    });
  });

  it('시작한 뒤에 다른 것을 골라도 진행 중인 행동의 대상은 바뀌지 않는다', () => {
    const world = driveWorld({
      npcs: [dummyAt(3, 0)],
      actorPosition: { x: 8, z: -5 },
      depositAmount: 5,
    });

    selectTarget(world, 'deposit-1');
    world.dispatch({ interactionId: 'mine' });
    selectTarget(world, 'npc-1'); // 캐는 도중에 다른 것을 고른다
    for (let i = 0; i < 60; i++) world.tick(TICK_INTERVAL);

    // 원래 고른 광맥이 줄었다 — 지목이 진행 중인 행동을 따라다니지 않는다
    expect(world.observe().entities.find((e) => e.id === 'deposit-1')?.labelValue).toBe(4);
    expect(targetOf(world.observe())).toBe('npc-1');
  });
});

describe('INTENT-TARGET-OBSERVE-001 — 고른 것과 그 판정이 관찰에 실린다', () => {
  it('고르기가 존재마다 실리고, 자기 몸에는 사유가 실린다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    expect(selectOf(view, 'npc-1')).toMatchObject({ role: 'select-target', available: true });
    expect(selectOf(view, 'deposit-1')).toMatchObject({ available: true });
    expect(selectOf(view, PLAYER)).toMatchObject({
      available: false,
      reason: 'target-is-self',
    });
  });

  it('살펴봄과 채집은 각각 하나씩만 실린다 — 대상마다 흩어지지 않는다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(4, 0, 'npc-2')] }).observe();

    expect(view.interactions.filter((i) => i.id === 'observe')).toHaveLength(1);
    expect(view.interactions.filter((i) => i.id === 'mine')).toHaveLength(1);
    expect(interactionOf(view, 'observe')?.targetEntityId).toBeUndefined();
    expect(interactionOf(view, 'mine')?.targetEntityId).toBeUndefined();
  });

  it('고른 자리는 사본이 아니다 — 대상이 달라지면 지금 값이 읽힌다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    selectTarget(world, 'npc-1');
    const id = targetOf(world.observe())!;
    const before = world.observe().entities.find((e) => e.id === id)?.vitality?.health;

    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 10 },
    });
    world.tick(TICK_INTERVAL);

    const after = world.observe().entities.find((e) => e.id === id)?.vitality?.health;
    expect(before).not.toBe(10);
    expect(after).toBe(10);
    expect(targetOf(world.observe())).toBe('npc-1'); // 고른 것은 Id 하나뿐이다
  });
});
