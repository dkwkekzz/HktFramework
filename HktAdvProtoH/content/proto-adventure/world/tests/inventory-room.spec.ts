// C022 World 단독 테스트 — Before → Input → Rule → After
//
// RULE-INVENTORY-ROOM-001 · RULE-INVENTORY-ADD-001(CHANGED) · RULE-ITEM-DISCARD-001 ·
// RULE-WORLD-ACQUIRABLE-KINDS-001 · RULE-MINE-001/COMPLETE-001(CHANGED)

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  driveWorld,
  equipBuckler,
  equipPickaxe,
  PLAYER,
  selectTarget,
  type WorldDriver,
} from './drive';
import { TICK_INTERVAL } from '../semantic/world-state';

const solo = { npcs: [] };
const MINE_DURATION = 1.2;

const room = (v: GameViewSnapshot) => v.inventoryRoom;
const item = (v: GameViewSnapshot, kind: string) => v.inventory.find((i) => i.kind === kind);
const count = (v: GameViewSnapshot, kind: string) => item(v, kind)?.count ?? 0;
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');
const deposit = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'deposit-1');
/** 광맥에 남은 것 — 관찰이 이미 싣는다 (labelValue). 세계 내부를 들여다보지 않는다 */
const depositLeft = (v: GameViewSnapshot) => deposit(v)?.labelValue;
const discardOf = (v: GameViewSnapshot, kind: string) =>
  item(v, kind)?.actions.find((a) => a.role === 'discard-item');

/** 광맥 옆에 서서 한 번 캔다 (완료까지) */
function mineOnce(world: WorldDriver) {
  const result = world.dispatch({ interactionId: 'mine' });
  const steps = Math.ceil(MINE_DURATION / TICK_INTERVAL) + 1;
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
  return result;
}

/** 광맥에 붙은 세계 하나 — 곡괭이는 아직 **가방에** 있다 (걸지 않은 채다) */
function atDeposit(depositAmount = 15) {
  const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, depositAmount });
  selectTarget(world, 'deposit-1');
  return world;
}

/**
 * 캘 수 있는 몸 — C023 이후 채집은 **걸린 것**에서 온다.
 *
 * 걸면 곡괭이가 가방을 떠나므로 이 파일의 자리 수가 C022 판에서 하나씩 줄었다.
 * 담을 수 있는 돌은 9 에서 12 로 늘었고, 그래서 광맥의 기본값도 함께 옮겼다
 * (world/index.ts — C023 12 → 15). 규칙은 한 줄도 열리지 않았다.
 */
function atDepositReady(depositAmount = 15) {
  const world = atDeposit(depositAmount);
  equipPickaxe(world);
  // C024 — 시작한 몸이 걸 수 있는 것을 **둘** 지닌다. 둘 다 걸어야 가방이 비어서
  // 시작하며, 그래야 아래 자리 실측이 확인하려는 것(⌈수량 / 한도⌉)이 시작 소지품에
  // 흔들리지 않는다. 걸린 것은 가방의 자리를 쓰지 않는다 (C023).
  equipBuckler(world);
  return world;
}

// ─────────────────────────────────────────────────────────────────────
describe('RULE-INVENTORY-ROOM-001 — 자리는 분기 없는 한 식이다', () => {
  it('시작한 몸은 겹치지 않는 것 둘로 자리 둘을 쓴다', () => {
    const view = atDeposit().observe();

    // C024 — 손방패가 늘어 자리가 하나 더 찬다. **식은 한 글자도 바뀌지 않았다** —
    // 둘 다 StackLimit 1 이므로 ⌈1/1⌉ + ⌈1/1⌉ = 2 다.
    expect(room(view)).toEqual({ used: 2, capacity: 4 });
    expect(item(view, 'buckler')?.stackable).toBe(false);
    // C022 — 곡괭이는 StackLimit 1 이므로 겹치지 않는다. 세계에 겹치지 않는 종류가
    // 처음 하나 생긴 것이며, 그래서 ⌈n/한도⌉ 가 두 갈래 모두에서 관찰된다.
    expect(item(view, 'pickaxe')?.stackable).toBe(false);
  });

  it('겹치는 종류는 한도까지 한 자리에 쌓이고, 넘으면 자리를 하나 더 쓴다', () => {
    // C023 — 곡괭이를 걸었으므로 가방은 비어서 시작한다. 자리 수가 C022 판보다
    // 하나씩 작은 것은 그 때문이며, ⌈n/한도⌉ 라는 식은 한 글자도 바뀌지 않았다.
    const world = atDepositReady();
    expect(room(world.observe())).toEqual({ used: 0, capacity: 4 });

    mineOnce(world); // 돌 1 → 돌 자리 1
    expect(room(world.observe())).toEqual({ used: 1, capacity: 4 });

    mineOnce(world);
    mineOnce(world); // 돌 3 → **아직** 돌 자리 1 (한도 3)
    expect(count(world.observe(), 'stone')).toBe(3);
    expect(room(world.observe())).toEqual({ used: 1, capacity: 4 });

    mineOnce(world); // 돌 4 → 돌 자리 2
    expect(room(world.observe())).toEqual({ used: 2, capacity: 4 });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 — 자리가 없으면 받지 못한다', () => {
  it('자리가 차면 캘 수 없고, 그것이 부딪히기 전에 관찰된다', () => {
    const world = atDepositReady();

    for (let i = 0; i < 12; i++) mineOnce(world); // 돌 12 = 자리 4 (⌈12/3⌉)
    const full = world.observe();
    expect(count(full, 'stone')).toBe(12);
    expect(room(full)).toEqual({ used: 4, capacity: 4 });

    // **부딪히기 전에 보인다** — 요청하기 전부터 불가이고 사유가 함께 온다
    expect(mine(full)?.available).toBe(false);
    expect(mine(full)?.reason).toBe('no-room');
  });

  it('억지로 요청해도 같은 사유로 거절된다 — 관찰과 실행이 같은 판정이다', () => {
    const world = atDepositReady();
    for (let i = 0; i < 12; i++) mineOnce(world);

    const result = world.dispatch({ interactionId: 'mine' });
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-room' });
  });

  it('거절된 채집은 광맥을 축내지 않는다 — 세계의 것은 그대로 남는다', () => {
    const world = atDepositReady();
    for (let i = 0; i < 12; i++) mineOnce(world);

    expect(depositLeft(world.observe())).toBe(3); // 15 - 12

    mineOnce(world); // 자리가 없어 받지 못하는 채집
    expect(depositLeft(world.observe())).toBe(3); // **줄지 않았다**
    expect(count(world.observe(), 'stone')).toBe(12);
  });

  it('완료 시점에 자리가 없어져도 광맥도 수량도 그대로다 (원자성)', () => {
    const world = atDepositReady();
    for (let i = 0; i < 11; i++) mineOnce(world); // 돌 11 → 자리 4 (⌈11/3⌉)

    // 아직 한 자리에 여유가 있어 캘 수 있다
    expect(mine(world.observe())?.available).toBe(true);
    const startResult = world.dispatch({ interactionId: 'mine' });
    expect(startResult.status).toBe('success');

    // 채집이 도는 동안 자리를 다른 것으로 채울 방법이 지금 세계에 없으므로,
    // 여기서는 **완료 시점 재검증이 존재한다는 것**을 열두 번째 획득으로 확인한다.
    const steps = Math.ceil(MINE_DURATION / TICK_INTERVAL) + 1;
    for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
    expect(count(world.observe(), 'stone')).toBe(12);
    expect(room(world.observe())).toEqual({ used: 4, capacity: 4 });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-ITEM-DISCARD-001 — 스스로 줄이는 첫 경로', () => {
  it('덜어내면 그 종류가 전부 사라지고 자리가 빈다 — 즉시 일어난다', () => {
    const world = atDepositReady();
    for (let i = 0; i < 12; i++) mineOnce(world);

    const result = world.dispatch({ interactionId: 'discard-item', itemKind: 'stone' });
    expect(result).toEqual({ status: 'success', rule: 'RULE-ITEM-DISCARD-001' });

    // **시간이 흐르지 않았는데 이미 비었다** — Action 얼개를 지나지 않는다
    const after = world.observe();
    expect(count(after, 'stone')).toBe(0);
    expect(item(after, 'stone')).toBeUndefined(); // 지니지 않은 종류는 항목이 없다
    // C023 — 걸린 곡괭이는 가방의 자리를 쓰지 않으므로 0 이다
    expect(room(after)).toEqual({ used: 0, capacity: 4 });
  });

  it('덜어내면 다시 캘 수 있다 — 자리와 덜어내기가 한 몸이다', () => {
    const world = atDepositReady();
    for (let i = 0; i < 12; i++) mineOnce(world);
    expect(mine(world.observe())?.available).toBe(false);

    world.dispatch({ interactionId: 'discard-item', itemKind: 'stone' });
    expect(mine(world.observe())?.available).toBe(true);

    mineOnce(world);
    expect(count(world.observe(), 'stone')).toBe(1);
  });

  it('덜어낸 것은 세계에 놓이지 않는다 — 광맥도 늘지 않고 아무 존재도 생기지 않는다', () => {
    const world = atDepositReady();
    for (let i = 0; i < 4; i++) mineOnce(world);
    const entitiesBefore = world.observe().entities.length;
    const depositBefore = depositLeft(world.observe());

    world.dispatch({ interactionId: 'discard-item', itemKind: 'stone' });

    expect(world.observe().entities.length).toBe(entitiesBefore);
    expect(depositLeft(world.observe())).toBe(depositBefore);
  });

  it('하던 행동을 끊지 않는다 — 덜어내기는 몸의 행동이 아니다', () => {
    const world = atDepositReady();
    mineOnce(world);
    world.dispatch({ interactionId: 'mine' });
    world.tick(TICK_INTERVAL);
    const acting = world.observe().entities.find((e) => e.id === PLAYER)?.state;
    expect(acting).toBe('mine');

    world.dispatch({ interactionId: 'discard-item', itemKind: 'stone' });
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('mine');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-NO-SELF-INFLICTED-DEAD-END-001 — 돌아올 길을 지킨다', () => {
  it('곡괭이는 덜어낼 수 없다 — 세계에 곡괭이를 내는 곳이 없다', () => {
    const world = atDeposit();

    const view = world.observe();
    expect(discardOf(view, 'pickaxe')?.available).toBe(false);
    expect(discardOf(view, 'pickaxe')?.unavailableReason).toBe('no-way-back');

    const result = world.dispatch({ interactionId: 'discard-item', itemKind: 'pickaxe' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-DISCARD-001',
      reason: 'no-way-back',
    });
  });

  it('돌은 언제든 덜어낼 수 있다 — 아무 용도도 잃지 않는다', () => {
    const world = atDepositReady();
    mineOnce(world);
    expect(discardOf(world.observe(), 'stone')?.available).toBe(true);
  });

  it('막힘 판정은 종류 이름이 아니라 **용도**를 본다 — 광맥이 마르면 돌도 막히지 않는다', () => {
    // 돌은 어떤 용도도 주지 않으므로, 광맥이 말라 다시 얻을 수 없게 되어도
    // 덜어내기가 막히지 않는다. 막는 것은 "다시 못 얻는 것" 이 아니라
    // "다시 못 얻는데 그것으로 할 수 있던 일이 사라지는 것" 이다.
    const world = atDepositReady(2);
    mineOnce(world);
    mineOnce(world);
    expect(depositLeft(world.observe())).toBe(0);

    expect(discardOf(world.observe(), 'stone')?.available).toBe(true);

    // 그리고 곡괭이는 여전히 막힌다 — 채집 용도가 사라지기 때문이다.
    // C023 — 걸린 것은 덜어내기의 대상이 아니므로 먼저 푼다. 그래도 답은 같다:
    // 막힘 판정은 **지닐 수 있는 용도**를 보므로 가방에 있든 걸려 있든 흔들리지 않는다.
    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(discardOf(world.observe(), 'pickaxe')?.unavailableReason).toBe('no-way-back');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('DC-ITEM-CAPACITY-IS-FINITE — 값이 규칙에 박히지 않았다', () => {
  it('관찰이 자리 둘을 함께 싣고, 화면이 셀 것이 남지 않는다', () => {
    const view = atDeposit().observe();
    // 한 자리에 몇까지인지(StackLimit)는 실리지 않는다 — 실으면 화면이 자리를 센다
    expect(Object.keys(view.inventoryRoom).sort()).toEqual(['capacity', 'used']);
    expect(view.inventory.every((i) => !('stackLimit' in i))).toBe(true);
  });

  it('지닌 것이 없어도 자리가 관찰된다', () => {
    // C023 — **이제 빈 가방을 세계에서 만들 수 있다.** 곡괭이를 걸면 그것이 가방을
    // 떠나기 때문이다. C022 판은 "곡괭이를 덜어낼 수 없어 빈 가방을 만들 수 없다" 며
    // 형태만 확인했는데, 이제 값으로 확인한다.
    const view = atDepositReady().observe();
    expect(view.inventory).toEqual([]);
    expect(view.inventoryRoom).toEqual({ used: 0, capacity: 4 });
  });
});
