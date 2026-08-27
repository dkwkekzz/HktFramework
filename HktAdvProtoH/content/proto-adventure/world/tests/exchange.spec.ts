// C024 World 단독 테스트 — Before → Input → Rule → After
//
// RULE-ITEM-EQUIP-001(CHANGED) · RULE-ITEM-EXCHANGEABLE-001(ADDED) ·
// RULE-ITEM-UNEQUIP-001(회귀 — 변하지 않아야 한다) · RULE-INVENTORY-ROOM-001 ·
// RULE-EFFECTIVE-STATS-001 · RULE-BODY-USES-001
//
// 이 파일이 확인하는 것은 **두 문장**이다 (IE §16 · §16.1).
//     ① 이미 찬 자리에 걸면 넣기와 빼내기가 한 번에 일어난다
//     ② 가방이 가득할 때 **해제는 막히고 교체는 된다**
// ② 는 반드시 **같은 세계 상태에서 두 요청을 연달아** 던져 확인한다 —
// 하나만 통과하면 §15 와 §16.1 중 하나를 잘못 구현하고도 통과하기 때문이다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, equipPickaxe, PLAYER, selectTarget, type WorldDriver } from './drive';
import { characterDefinition } from '../semantic/character-catalog';
import { EQUIP_SLOTS } from '../semantic/equipment';
import { ITEM_CATALOG } from '../semantic/item';
import { TICK_INTERVAL } from '../semantic/world-state';

const solo = { npcs: [] };
const MINE_DURATION = 1.2;

// **정의에서 읽는다** — 값을 바꿔도 이 각본이 그대로 도는 것이
// "새 장비는 정의가 늘어나는 일" 의 시험 쪽 증거다 (C023 이 세운 형태 그대로).
const PICKAXE_ATTACK = ITEM_CATALOG.pickaxe.equip?.contributions?.physicalAttack ?? 0;
const BUCKLER_ARMOR = ITEM_CATALOG.buckler.equip?.contributions?.armor ?? 0;
const BASE = characterDefinition('rabbit-swordsman').combat;

const slotOf = (v: GameViewSnapshot, slotId: string) => v.equipment.find((s) => s.slotId === slotId);
const item = (v: GameViewSnapshot, kind: string) => v.inventory.find((i) => i.kind === kind);
const count = (v: GameViewSnapshot, kind: string) => item(v, kind)?.count ?? 0;
const equipOf = (v: GameViewSnapshot, kind: string) =>
  item(v, kind)?.actions.find((a) => a.role === 'equip-item');
const exchangeOf = (v: GameViewSnapshot, kind: string) =>
  item(v, kind)?.actions.find((a) => a.role === 'exchange-item');
const unequipOf = (v: GameViewSnapshot, slotId: string) =>
  slotOf(v, slotId)?.actions.find((a) => a.role === 'unequip-item');
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');
const stats = (v: GameViewSnapshot) =>
  v.entities.find((e) => e.id === PLAYER)?.attributes?.combatStats;

function atDeposit(depositAmount = 15) {
  const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, depositAmount });
  selectTarget(world, 'deposit-1');
  return world;
}

function mineOnce(world: WorldDriver) {
  const result = world.dispatch({ interactionId: 'mine' });
  const steps = Math.ceil(MINE_DURATION / TICK_INTERVAL) + 1;
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
  return result;
}

const exchange = (world: WorldDriver, itemKind: string, equipSlotId: string) =>
  world.dispatch({ interactionId: 'equip-item', itemKind, equipSlotId });

/**
 * 가방이 **정확히 가득 찬** 세계 하나.
 *
 *     E1 곡괭이 · 가방 { 손방패 1, 돌 9 } = ⌈1/1⌉ + ⌈9/3⌉ = 4/4
 *
 * 이 상태가 이 Cycle 의 관찰 자리다 — 여기서 해제는 막히고 교체는 된다.
 */
function atFullBagWearingPickaxe() {
  const world = atDeposit();
  equipPickaxe(world);
  for (let i = 0; i < 9; i++) mineOnce(world);
  return world;
}

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-EXCHANGE-APPLIED-ITEM-001 — 바꾸는 것은 한 동작이다', () => {
  it('찬 자리에 걸면 헌것이 가방으로 오고 새것이 그 자리에 든다 — 한 번에', () => {
    const world = atDeposit();
    equipPickaxe(world);
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
    expect(count(world.observe(), 'pickaxe')).toBe(0);

    expect(exchange(world, 'buckler', 'E1')).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-EQUIP-001',
    });

    const after = world.observe();
    expect(slotOf(after, 'E1')?.item?.kind).toBe('buckler'); // 새것이 들었다
    expect(count(after, 'pickaxe')).toBe(1); // 헌것이 돌아왔다
    expect(count(after, 'buckler')).toBe(0); // 새것은 가방에 없다
    // **자리는 하나뿐이다** — 밀려난 것이 다른 빈 자리로 가지 않는다
    expect(after.equipment.filter((s) => s.item)).toHaveLength(1);
  });

  it('교체 뒤 몸에는 새것이 주는 것만 있다 — 헌것의 기여가 정확히 사라진다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    expect(stats(world.observe())?.physicalAttack).toBe(BASE.physicalAttack + PICKAXE_ATTACK);
    expect(stats(world.observe())?.armor).toBe(BASE.armor);

    exchange(world, 'buckler', 'E1');

    const after = stats(world.observe());
    // **정확히 기본값으로 돌아온다.** 가산이었다면 여기 52 가 남는다 —
    // 이 한 줄이 "치환이지 누적이 아니다" 를 증명한다.
    expect(after?.physicalAttack).toBe(BASE.physicalAttack);
    expect(after?.armor).toBe(BASE.armor + BUCKLER_ARMOR);
  });

  it('곡괭이를 밀어내면 그 자리에서 캘 수 없게 된다 — 규칙은 열리지 않았다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    expect(mine(world.observe())?.available).toBe(true);

    exchange(world, 'buckler', 'E1');
    expect(mine(world.observe())?.available).toBe(false);

    // 되돌리면 다시 캘 수 있다 — 잃음이 영구적이지 않다
    exchange(world, 'pickaxe', 'E1');
    expect(mine(world.observe())?.available).toBe(true);
    expect(stats(world.observe())?.physicalAttack).toBe(BASE.physicalAttack + PICKAXE_ATTACK);
    expect(stats(world.observe())?.armor).toBe(BASE.armor);
  });

  it('백 번 바꿔 껴도 값이 표류하지 않는다 — 유효 값이 파생이기 때문이다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    for (let i = 0; i < 50; i++) {
      exchange(world, 'buckler', 'E1');
      exchange(world, 'pickaxe', 'E1');
    }
    const after = stats(world.observe());
    expect(after?.physicalAttack).toBe(BASE.physicalAttack + PICKAXE_ATTACK);
    expect(after?.armor).toBe(BASE.armor);
    expect(count(world.observe(), 'buckler')).toBe(1);
    expect(count(world.observe(), 'pickaxe')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('POSSIBILITY-A-FAILED-EXCHANGE-LEAVES-NOTHING — 실패한 교체는 넷을 그대로 둔다', () => {
  it('지니지 않은 것으로 바꿔 낄 수 없다 — 자리도 수량도 값도 용도도 그대로다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    world.dispatch({ interactionId: 'discard-item', itemKind: 'buckler' });
    const before = world.observe();

    expect(exchange(world, 'buckler', 'E1')).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'not-enough',
    });

    const after = world.observe();
    expect(slotOf(after, 'E1')?.item?.kind).toBe('pickaxe');
    expect(after.inventory).toEqual(before.inventory);
    expect(after.inventoryRoom).toEqual(before.inventoryRoom);
    expect(stats(after)).toEqual(stats(before));
    expect(mine(after)?.available).toBe(true);
  });

  it('걸 수 없는 물건으로는 바꿔 낄 수 없다 — 자리 탓이 아니다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    mineOnce(world);

    expect(exchange(world, 'stone', 'E1')).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'not-equippable',
    });
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
  });

  it('세계가 모르는 자리는 거절되고 아무것도 바뀌지 않는다', () => {
    const world = atDeposit();
    equipPickaxe(world);

    expect(exchange(world, 'buckler', 'E99')).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'unknown-slot',
    });
    expect(count(world.observe(), 'buckler')).toBe(1);
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-THE-DISPLACED-IS-NAMED-001 — 밀려날 것은 겪는 사람이 고른다', () => {
  it('자리를 밝히지 않은 걸기의 뜻은 바뀌지 않는다 — 빈 자리로 간다', () => {
    const world = atDeposit();
    equipPickaxe(world); // 자리를 밝히지 않았다 → E1
    world.dispatch({ interactionId: 'equip-item', itemKind: 'buckler' });

    const after = world.observe();
    // **아무것도 밀려나지 않았다** — 둘이 나란히 걸렸다
    expect(slotOf(after, 'E1')?.item?.kind).toBe('pickaxe');
    expect(slotOf(after, 'E2')?.item?.kind).toBe('buckler');
  });

  it('자리가 다 찬 같은 상태에서 밝히지 않은 걸기는 막히고 밝힌 걸기는 된다', () => {
    // **이 시험이 이 Intent 의 본체다.** 같은 세계 상태에서 두 요청이 다른 답을 낸다 —
    // 세계는 아무것도 밀어내지 않고, 겪는 사람이 자리를 대면 밀어낸다.
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 7, buckler: 1 } });
    for (let i = 0; i < EQUIP_SLOTS.length; i++) equipPickaxe(world);
    expect(world.observe().equipment.filter((s) => s.item)).toHaveLength(EQUIP_SLOTS.length);

    // ── 밝히지 않으면 거절된다 (C023 그대로) ──
    expect(world.dispatch({ interactionId: 'equip-item', itemKind: 'buckler' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'no-empty-slot',
    });
    expect(equipOf(world.observe(), 'buckler')?.unavailableReason).toBe('no-empty-slot');

    // ── 같은 상태에서 자리를 대면 성립한다 ──
    expect(exchangeOf(world.observe(), 'buckler')?.available).toBe(true);
    expect(exchange(world, 'buckler', 'E3')).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-EQUIP-001',
    });
    expect(slotOf(world.observe(), 'E3')?.item?.kind).toBe('buckler');
    // 나머지 다섯 자리는 손대지 않았다
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
    expect(slotOf(world.observe(), 'E6')?.item?.kind).toBe('pickaxe');
  });

  it('밝힌 자리가 비어 있으면 그냥 걸린다 — 요청을 둘로 가르지 않는다', () => {
    const world = atDeposit();
    expect(exchange(world, 'pickaxe', 'E4')).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-EQUIP-001',
    });
    expect(slotOf(world.observe(), 'E4')?.item?.kind).toBe('pickaxe');
    expect(slotOf(world.observe(), 'E1')?.item).toBeUndefined();
  });

  it('같은 종류로 바꿔 끼면 성립하고 세계는 이전과 한 톨도 다르지 않다 (03 JUDGEMENT ①)', () => {
    // 세계가 개체를 구분하지 않으므로 자리의 곡괭이와 가방의 곡괭이는 **같은 것**이다.
    // 그 교체는 성립하고, 성립한 뒤의 세계가 이전과 같다.
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 2 } });
    equipPickaxe(world);
    const before = world.observe();

    expect(exchange(world, 'pickaxe', 'E1')).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-EQUIP-001',
    });

    const after = world.observe();
    expect(after.equipment).toEqual(before.equipment);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.inventoryRoom).toEqual(before.inventoryRoom);
    expect(stats(after)).toEqual(stats(before));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('IE §15 · §16.1 — 가득 찬 가방에서 해제는 막히고 교체는 된다', () => {
  it('같은 세계 상태에서 두 요청이 다른 답을 낸다', () => {
    const world = atFullBagWearingPickaxe();

    const full = world.observe();
    expect(full.inventoryRoom).toEqual({ used: 4, capacity: 4 });

    // ── 부딪히기 전에 이미 갈려 있다 ──
    expect(unequipOf(full, 'E1')?.available).toBe(false);
    expect(unequipOf(full, 'E1')?.unavailableReason).toBe('no-room');
    expect(exchangeOf(full, 'buckler')?.available).toBe(true);

    // ── 해제는 막힌다 (C023 그대로) ──
    expect(world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-UNEQUIP-001',
      reason: 'no-room',
    });

    // ── 같은 상태에서 교체는 된다 ──
    expect(exchange(world, 'buckler', 'E1')).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-EQUIP-001',
    });

    const after = world.observe();
    expect(slotOf(after, 'E1')?.item?.kind).toBe('buckler');
    expect(count(after, 'pickaxe')).toBe(1);
    expect(count(after, 'stone')).toBe(9);
    // **자리가 달라지지 않았다** — 그것이 §16.1 의 관찰이다
    expect(after.inventoryRoom).toEqual({ used: 4, capacity: 4 });
  });

  it('교체는 가방의 자리를 새로 요구하지 않는다 — 순 증가가 0 이다', () => {
    const world = atFullBagWearingPickaxe();
    const before = world.observe().inventoryRoom.used;

    exchange(world, 'buckler', 'E1');
    expect(world.observe().inventoryRoom.used).toBe(before);

    // 되돌려도 그대로다
    exchange(world, 'pickaxe', 'E1');
    expect(world.observe().inventoryRoom.used).toBe(before);
  });

  it('가득 찬 채로 바꿔 껴도 값과 용도는 정확히 따라온다', () => {
    const world = atFullBagWearingPickaxe();
    exchange(world, 'buckler', 'E1');

    const after = world.observe();
    // C-GROWTH-001 — 여기까지 오려면 아홉 번 캐야 하고, 그 36 이 첫 문턱(20)을 넘어
    // 몸이 한 단계 자란다. 이 검사가 보는 것은 **바꿔 낀 일이 값을 옳게 옮기는가**이므로
    // 자란 몫은 세계가 스스로 밝힌 값을 그대로 견준다 — 걸린 것을 벗어도 자란 것은
    // 그대로이며, 그것이 성장이 장비가 아니라 몸의 값이라는 증거다.
    const grown = (stat: string) =>
      after.growth.contributions.find((c) => c.stat === stat)?.amount ?? 0;
    expect(after.growth.level).toBe(1);
    expect(stats(after)?.physicalAttack).toBe(BASE.physicalAttack + grown('physicalAttack'));
    expect(stats(after)?.armor).toBe(BASE.armor + BUCKLER_ARMOR + grown('armor'));
    expect(mine(after)?.available).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-ITEM-EXCHANGEABLE-001 — 관찰과 실행이 같은 판정이다', () => {
  it('걸린 것이 하나도 없으면 바꿔 걸 자리가 없다 — 가방 탓이 아니다', () => {
    const view = atDeposit().observe();
    expect(exchangeOf(view, 'buckler')?.available).toBe(false);
    expect(exchangeOf(view, 'buckler')?.unavailableReason).toBe('no-occupied-slot');
    // 같은 순간 그냥 걸기는 가능이다 — 할 일은 덜어내기가 아니라 거는 것이다
    expect(equipOf(view, 'buckler')?.available).toBe(true);
  });

  it('걸 수 없는 물건에는 equip 과 같은 사유가 온다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    mineOnce(world);
    const view = world.observe();
    expect(exchangeOf(view, 'stone')?.unavailableReason).toBe('not-equippable');
    expect(equipOf(view, 'stone')?.unavailableReason).toBe('not-equippable');
  });

  it('관찰에 가능으로 실린 것은 요청에서 성립한다', () => {
    const world = atFullBagWearingPickaxe();
    expect(exchangeOf(world.observe(), 'buckler')?.available).toBe(true);
    expect(exchange(world, 'buckler', 'E1').status).toBe('success');
  });

  it('항목마다 하나씩 실린다 — 자리 수만큼 늘지 않는다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    const entry = item(world.observe(), 'buckler');
    expect(entry?.actions.filter((a) => a.role === 'exchange-item')).toHaveLength(1);
    // 자리는 여섯인데 항목은 하나다 — 계약이 곱으로 자라지 않는다
    expect(EQUIP_SLOTS.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('DC-ITEM-KIND-IS-DATA-NOT-BRANCH — 새 종류는 정의가 늘어나는 일이다', () => {
  it('손방패는 걸 수 있고 겹치지 않으며 용도를 주지 않는다 — 전부 정의가 답한다', () => {
    const world = atDeposit();
    const view = world.observe();
    const entry = item(view, 'buckler');

    expect(entry?.category).toBe('gear');
    expect(entry?.stackable).toBe(false);
    expect(entry?.origin).toBeUndefined(); // Q36 — 상위 정의는 위층의 일이다
    // 쓸 수 없는 물건이다 — 걸기만 되는 첫 물건
    expect(entry?.actions.find((a) => a.role === 'use-item')).toBeUndefined();

    world.dispatch({ interactionId: 'equip-item', itemKind: 'buckler' });
    expect(slotOf(world.observe(), 'E1')?.grants).toEqual([]);
  });

  it('걸 수 있는 것은 어느 자리에나 걸린다 — 자리는 아무것도 묻지 않는다', () => {
    for (const slotId of EQUIP_SLOTS) {
      const world = atDeposit();
      expect(exchange(world, 'buckler', slotId).status).toBe('success');
      expect(slotOf(world.observe(), slotId)?.item?.kind).toBe('buckler');
    }
  });
});
