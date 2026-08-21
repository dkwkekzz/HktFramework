// World Semantic — Inventory.Capacity · Inventory.Slots (C020 CHANGED)
// World Authority — 변경은 World Rule 의 Transition 에서만 일어난다 (rules/carry.ts).
//
// C001 은 지닌 것을 종류→개수 Map 하나로 두었다. "몇 개인가" 만 알고 "어디에 얼마나" 는
// 몰랐으며, 담을 자리라는 개념이 없어 얼마를 지니든 아무 일도 일어나지 않았다.
//
// C020 — 지닌 것은 **자리**에 담긴다. 자리의 수는 유한하고, 한 물건은 언제나 자리
// 하나에 있으며 다른 어디도 가리키지 않는다
// (INTENT-CARRY-ROOM-001 · DC-ITEM-CAPACITY-IS-FINITE · DC-ITEM-LIVES-IN-ONE-PLACE).

import { stackLimitOf, usesOf, type ItemKind, type ItemUse } from './item';

/**
 * 담을 자리의 기본 수 (C020 BALANCE ①).
 *
 * 결정론 시뮬레이션 값이 아니라 **세계를 띄우는 쪽이 정할 수 있는 값**이다
 * (`setup.carryCapacity` — depositAmount · debugAuthority 와 같은 자리).
 * 3 인 이유는 지금 세계의 광맥 하나·자원 다섯에서 모든 판정이 플레이로 도달하게
 * 하기 위해서다. 규칙은 어디서도 3 을 묻지 않는다.
 */
export const CARRY_CAPACITY_DEFAULT = 3;

/** 비어 있지 않은 자리 하나. count 는 1 이상이고 그 종류의 stackLimit 이하다. */
export interface InventorySlot {
  kind: ItemKind;
  count: number;
}

export interface Inventory {
  /** 담을 자리의 수 */
  capacity: number;
  /** 길이가 capacity 인 자리 목록. null 은 빈 자리다 */
  slots: (InventorySlot | null)[];
}

/**
 * 초기 소지품으로 인벤토리를 만든다.
 *
 * 초기값이 자리에 다 들어가지 않으면 **들어가는 만큼만** 담는다 — 세계를 띄우는 쪽의
 * 설정 오류가 세계를 못 뜨게 만들지 않는다. 규칙 경로(rules/carry.ts)의 전량 원자성과는
 * 다른 자리다: 여기는 세계가 시작되기 전이고, 그곳은 세계가 도는 중이다.
 */
export function createInventory(
  initial: Readonly<Record<string, number | undefined>> = {},
  capacity: number = CARRY_CAPACITY_DEFAULT,
): Inventory {
  const inventory: Inventory = { capacity, slots: new Array(capacity).fill(null) };
  for (const [kind, count] of Object.entries(initial)) {
    if (count && count > 0) fillSlots(inventory, kind, count);
  }
  return inventory;
}

/** 쓴 자리의 수 — 비어 있지 않은 자리를 센다. */
export function usedSlots(inventory: Inventory): number {
  return inventory.slots.reduce((n, slot) => (slot === null ? n : n + 1), 0);
}

/** 그 종류를 전부 몇 개 지녔는가. 여러 자리에 나뉘어 있을 수 있다. */
export function itemCount(inventory: Inventory, kind: ItemKind): number {
  return inventory.slots.reduce((n, slot) => (slot?.kind === kind ? n + slot.count : n), 0);
}

/**
 * 이 몸이 지금 지닌 것들이 여는 용도의 모음 (Actor.CarriedUses — 파생).
 *
 * **이 Cycle 에서 이 값의 출처는 소지다.** 적용(몸에 걸어 두는 것)이라는 개념이 아직
 * 세계에 없기 때문이다. 장착이 오면 이 함수의 입력이 slots 에서 적용된 것들로 바뀌며,
 * **그때 고칠 곳은 여기 한 자리다** (02 INTENT-USE-COMES-FROM-DECLARATION-001).
 */
export function carriedUses(inventory: Inventory): ReadonlySet<ItemUse> {
  const uses = new Set<ItemUse>();
  for (const slot of inventory.slots) {
    if (slot === null) continue;
    for (const use of usesOf(slot.kind)) uses.add(use);
  }
  return uses;
}

/**
 * 지금 이 몸에서 **자리 하나만이** 열고 있는 용도들 (Inventory.LastWayUses — 파생).
 *
 * 덜어내기가 이 값을 보고 되돌릴 수 없는 막힘을 막는다 (INTENT-NO-DEAD-END-001).
 * 같은 용도를 여는 물건을 둘 지니면 그 용도는 여기에 없다 — 하나를 덜어내도 길이
 * 닫히지 않기 때문이다. 판정은 종류가 아니라 **마지막인가**를 본다.
 */
export function lastWayUses(inventory: Inventory): ReadonlySet<ItemUse> {
  const openers = new Map<ItemUse, number>();
  for (const slot of inventory.slots) {
    if (slot === null) continue;
    for (const use of usesOf(slot.kind)) openers.set(use, (openers.get(use) ?? 0) + 1);
  }
  const last = new Set<ItemUse>();
  for (const [use, count] of openers) if (count === 1) last.add(use);
  return last;
}

/**
 * 그 종류를 그만큼 **전부** 받을 수 있는가 (RULE-CARRY-ADD-001 의 판정부).
 *
 * 담으면서 모자라는 것을 발견하는 형태를 만들지 않는다 — 그 순간 이미 반쪽이 된다
 * (DC-ITEM-CHANGE-IS-ONE-UNIT). 그래서 세는 일과 담는 일을 가른다.
 */
export function canAccept(inventory: Inventory, kind: ItemKind, amount: number): boolean {
  return roomFor(inventory, kind) >= amount;
}

/** 그 종류를 지금 몇 개까지 더 받을 수 있는가. */
export function roomFor(inventory: Inventory, kind: ItemKind): number {
  const limit = stackLimitOf(kind);
  let room = 0;
  for (const slot of inventory.slots) {
    if (slot === null) room += limit;
    else if (slot.kind === kind) room += limit - slot.count;
  }
  return room;
}

/**
 * 자리를 채운다. **부르기 전에 canAccept 로 확인한다** — 이 함수는 판정하지 않는다.
 *
 * 채우는 순서는 쌓을 수 있는 자리가 먼저다 (IE §6). 그래야 빈 자리가 불필요하게
 * 소모되지 않는다.
 */
export function fillSlots(inventory: Inventory, kind: ItemKind, amount: number): void {
  const limit = stackLimitOf(kind);
  let remaining = amount;

  for (const slot of inventory.slots) {
    if (remaining <= 0) break;
    if (slot === null || slot.kind !== kind) continue;
    const taken = Math.min(limit - slot.count, remaining);
    slot.count += taken;
    remaining -= taken;
  }

  for (let i = 0; i < inventory.slots.length && remaining > 0; i += 1) {
    if (inventory.slots[i] !== null) continue;
    const taken = Math.min(limit, remaining);
    inventory.slots[i] = { kind, count: taken };
    remaining -= taken;
  }
}

/**
 * 자리 하나를 비운다 — 담겨 있던 수량 전부가 사라진다.
 *
 * 수량이 0 인 항목을 남기지 않는다. 그런 상태를 허용하면 쓴 자리를 세는 곳마다 그
 * 예외를 알아야 한다 (03 WORLD STATE).
 */
export function clearSlot(inventory: Inventory, slot: number): void {
  inventory.slots[slot] = null;
}

export function slotAt(inventory: Inventory, slot: number): InventorySlot | null {
  return inventory.slots[slot] ?? null;
}
