// C023 World 단독 테스트 — Before → Input → Rule → After
//
// RULE-ITEM-EQUIP-001 · RULE-ITEM-UNEQUIP-001 · RULE-EQUIP-SLOT-FITS-001 ·
// RULE-EFFECTIVE-STATS-001 · RULE-BODY-USES-001(CHANGED) ·
// RULE-BODY-GRANTABLE-USES-001 · RULE-ITEM-DISCARD-001(CHANGED)

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  driveWorld,
  equipPickaxe,
  observeFully,
  PLAYER,
  selectTarget,
  type WorldDriver,
} from './drive';
import { characterDefinition } from '../semantic/character-catalog';
import { EQUIP_SLOTS } from '../semantic/equipment';
import { ITEM_CATALOG } from '../semantic/item';
import { TICK_INTERVAL } from '../semantic/world-state';

const solo = { npcs: [] };
const MINE_DURATION = 1.2;

const slots = (v: GameViewSnapshot) => v.equipment;
const slotOf = (v: GameViewSnapshot, slotId: string) => v.equipment.find((s) => s.slotId === slotId);
const filled = (v: GameViewSnapshot) => v.equipment.filter((s) => s.item);
const item = (v: GameViewSnapshot, kind: string) => v.inventory.find((i) => i.kind === kind);
const count = (v: GameViewSnapshot, kind: string) => item(v, kind)?.count ?? 0;
const equipOf = (v: GameViewSnapshot, kind: string) =>
  item(v, kind)?.actions.find((a) => a.role === 'equip-item');
const unequipOf = (v: GameViewSnapshot, slotId: string) =>
  slotOf(v, slotId)?.actions.find((a) => a.role === 'unequip-item');
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');
const attack = (v: GameViewSnapshot) =>
  v.entities.find((e) => e.id === PLAYER)?.attributes?.combatStats?.physicalAttack;

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

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-BODY-HAS-APPLY-PLACES-001 — 몸에 자리가 있다', () => {
  it('자리 여섯이 비어 있는 채로 실린다 — 비었다는 것도 관찰의 내용이다', () => {
    const view = atDeposit().observe();

    expect(slots(view)).toHaveLength(EQUIP_SLOTS.length);
    expect(slots(view).map((s) => s.slotId)).toEqual([...EQUIP_SLOTS]);
    expect(filled(view)).toHaveLength(0);
  });

  it('자리는 성격을 지니지 않는다 — 계약에 "무엇을 받는가" 라는 칸이 없다', () => {
    // 제한은 **물건이 선언할 때만** 생기는 예외다 (IE §10 · §11). 지금 어떤 물건도
    // 선언하지 않으므로 자리에도 계약에도 그런 칸이 없다.
    const view = atDeposit().observe();
    for (const slot of slots(view)) {
      expect(Object.keys(slot).sort()).toEqual(['actions', 'contributions', 'grants', 'slotId']);
    }
    expect(ITEM_CATALOG.pickaxe.equip?.targets).toBeUndefined();
  });

  it('세계가 빈 자리를 고른다 — 요청은 자리를 싣지 않는다', () => {
    const world = atDeposit();
    expect(equipPickaxe(world)).toEqual({ status: 'success', rule: 'RULE-ITEM-EQUIP-001' });

    // 차례가 가장 앞선 빈 자리에 들어간다 — 같은 세계 상태면 언제나 같다
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
    expect(filled(world.observe())).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001 — 정의가 답한다', () => {
  it('걸 수 없는 물건은 사유와 함께 거절된다 — 자리 탓이 아니다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    mineOnce(world); // 돌 하나를 얻는다

    const view = world.observe();
    expect(equipOf(view, 'stone')?.available).toBe(false);
    expect(equipOf(view, 'stone')?.unavailableReason).toBe('not-equippable');

    // 억지로 요청해도 같은 사유다 — 관찰과 실행이 같은 판정이다
    expect(world.dispatch({ interactionId: 'equip-item', itemKind: 'stone' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'not-equippable',
    });
  });

  it('걸 수 있는 물건은 겹치지 않는다 — 정의소가 그것을 보장한다 (IE §13.1)', () => {
    for (const [kind, definition] of Object.entries(ITEM_CATALOG)) {
      if (definition.equip) expect([kind, definition.stackLimit]).toEqual([kind, 1]);
    }
  });

  it('빈 자리가 하나도 없으면 거절된다 — 교체는 이 Cycle 의 일이 아니다', () => {
    // 곡괭이 여섯을 지닐 방법이 세계에 없으므로 자리 수를 세는 대신, 자리가 다 찼을 때의
    // 사유가 하나(no-empty-slot)임을 형태로 확인한다.
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 7 } });
    for (let i = 0; i < EQUIP_SLOTS.length; i++) equipPickaxe(world);
    expect(filled(world.observe())).toHaveLength(EQUIP_SLOTS.length);

    expect(equipPickaxe(world)).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-EQUIP-001',
      reason: 'no-empty-slot',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-ONLY-THE-APPLIED-GIVES-001 — 걸어 둔 것만이 몸을 바꾼다', () => {
  it('가지고만 있으면 캐지지 않는다 — 이 Cycle 이 해소하는 위반이다', () => {
    const world = atDeposit();
    expect(count(world.observe(), 'pickaxe')).toBe(1); // 지니고 있다

    expect(mine(world.observe())?.available).toBe(false);
    expect(mine(world.observe())?.reason).toBe('no-mining-tool');
    expect(world.dispatch({ interactionId: 'mine' })).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'no-mining-tool',
    });
  });

  it('걸면 캘 수 있고, 풀면 다시 캘 수 없다', () => {
    const world = atDeposit();

    equipPickaxe(world);
    expect(mine(world.observe())?.available).toBe(true);
    expect(slotOf(world.observe(), 'E1')?.grants).toEqual(['mine']);

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(mine(world.observe())?.available).toBe(false);
    expect(mine(world.observe())?.reason).toBe('no-mining-tool');
  });

  it('묻는 문장은 열리지 않았다 — 채집은 여전히 용도를 묻는다', () => {
    // 곡괭이를 지니지도 걸지도 않은 몸은 이전과 **같은 사유**로 거절된다.
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, actorItems: {} });
    selectTarget(world, 'deposit-1');
    expect(mine(world.observe())?.reason).toBe('no-mining-tool');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001 — 재계산이지 가감이 아니다', () => {
  it('걸면 값이 오르고 풀면 정확히 이전으로 돌아온다', () => {
    const world = atDeposit();
    const base = attack(world.observe())!;

    equipPickaxe(world);
    expect(attack(world.observe())).toBe(base + 12);
    expect(slotOf(world.observe(), 'E1')?.contributions).toEqual([
      { name: 'physicalAttack', value: 12 },
    ]);

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(attack(world.observe())).toBe(base); // **정확히** 이전이다
  });

  it('백 번 걸고 백 번 풀어도 값이 표류하지 않는다', () => {
    const world = atDeposit();
    const base = attack(world.observe())!;

    for (let i = 0; i < 100; i++) {
      equipPickaxe(world);
      world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    }
    expect(attack(world.observe())).toBe(base);
  });

  it('둘을 걸면 두 번 더해지고, 하나만 풀면 정확히 한 번어치가 남는다', () => {
    // **소지 제한이 없다는 것의 뜻이다** — 같은 종류를 여러 자리에 걸 수 있다.
    // 가감으로 구현했다면 이 각본에서 반드시 어긋난다 (03 RATIONALE 10).
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 2 } });
    const base = attack(world.observe())!;

    equipPickaxe(world);
    equipPickaxe(world);
    expect(filled(world.observe())).toHaveLength(2);
    expect(attack(world.observe())).toBe(base + 24);

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(attack(world.observe())).toBe(base + 12);

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E2' });
    expect(attack(world.observe())).toBe(base);
  });

  it('밖에서 손댄 값은 기본값이다 — 걸린 것이 있으면 넣은 수와 보이는 수가 다르다', () => {
    const world = driveWorld({ ...solo, debugOpen: true });
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'physicalAttack', value: 50 } });
    expect(attack(world.observe())).toBe(50);

    equipPickaxe(world);
    expect(attack(world.observe())).toBe(62); // 기본값 50 + 기여 12

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(attack(world.observe())).toBe(50); // 기본값은 건드려지지 않았다
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001 — 물건은 한 곳에만', () => {
  it('걸면 가방에서 빠지고, 풀면 가방으로 돌아온다', () => {
    const world = atDeposit();
    expect(world.observe().inventoryRoom.used).toBe(1);

    equipPickaxe(world);
    let view = world.observe();
    expect(item(view, 'pickaxe')).toBeUndefined(); // 가방에 없다
    expect(view.inventoryRoom.used).toBe(0); // 자리를 쓰지 않는다
    expect(slotOf(view, 'E1')?.item?.kind).toBe('pickaxe');

    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    view = world.observe();
    expect(count(view, 'pickaxe')).toBe(1);
    expect(view.inventoryRoom.used).toBe(1);
    expect(slotOf(view, 'E1')?.item).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-RELEASE-ASKS-FOR-ROOM-001 — 푸는 데에는 받을 자리가 필요하다', () => {
  it('가방이 가득 차면 풀 수 없고, 그것이 부딪히기 전에 관찰된다 (IE §15)', () => {
    const world = atDeposit();
    equipPickaxe(world);
    for (let i = 0; i < 12; i++) mineOnce(world); // 돌 12 → 자리 4/4

    const full = world.observe();
    expect(full.inventoryRoom).toEqual({ used: 4, capacity: 4 });
    expect(unequipOf(full, 'E1')?.available).toBe(false);
    expect(unequipOf(full, 'E1')?.unavailableReason).toBe('no-room');

    // 억지로 요청해도 같은 사유이며 **아무것도 바뀌지 않는다**
    expect(world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-UNEQUIP-001',
      reason: 'no-room',
    });
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
    expect(count(world.observe(), 'stone')).toBe(12);
  });

  it('덜어내면 풀린다 — 두 유한함이 여기서 만난다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    for (let i = 0; i < 12; i++) mineOnce(world);

    world.dispatch({ interactionId: 'discard-item', itemKind: 'stone' });
    expect(world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' })).toEqual({
      status: 'success',
      rule: 'RULE-ITEM-UNEQUIP-001',
    });
  });

  it('빈 자리를 풀려 하면 사유가 온다 — 세계도 화면도 같은 판정이다', () => {
    const world = atDeposit();
    expect(unequipOf(world.observe(), 'E2')?.unavailableReason).toBe('slot-empty');
    expect(world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E2' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-UNEQUIP-001',
      reason: 'slot-empty',
    });
  });

  it('세계가 모르는 자리는 사유가 온다', () => {
    const world = atDeposit();
    expect(world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E9' })).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-UNEQUIP-001',
      reason: 'unknown-slot',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-NO-SELF-INFLICTED-DEAD-END-001 — 판정이 자리까지 본다', () => {
  it('걸어 둔 곡괭이가 있으면 가방의 곡괭이는 덜어낼 수 있다', () => {
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 2 } });
    equipPickaxe(world); // 하나는 걸고 하나는 가방에

    const discard = item(world.observe(), 'pickaxe')?.actions.find(
      (a) => a.role === 'discard-item',
    );
    expect(discard?.available).toBe(true);
    expect(world.dispatch({ interactionId: 'discard-item', itemKind: 'pickaxe' }).status).toBe(
      'success',
    );
    // 걸린 것은 그대로다 — 덜어내기는 가방에서 일어난다
    expect(slotOf(world.observe(), 'E1')?.item?.kind).toBe('pickaxe');
  });

  it('풀어서 가방에 둔 마지막 곡괭이는 덜어낼 수 없다 — 막힘이 막힌다', () => {
    // **이 검증이 없으면 세계가 조용히 막힌다.** 용도가 걸린 것에서만 오게 되었으므로
    // 가방만 보는 판정은 "잃을 것이 없다" 고 답하고, 그 순간 채집이 영영 사라진다
    // (03 RATIONALE 3).
    const world = atDeposit();
    equipPickaxe(world);
    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });

    const discard = item(world.observe(), 'pickaxe')?.actions.find(
      (a) => a.role === 'discard-item',
    );
    expect(discard?.available).toBe(false);
    expect(discard?.unavailableReason).toBe('no-way-back');
  });

  it('걸린 채로도 막힘 판정은 흔들리지 않는다 — 지닐 수 있는 용도를 본다', () => {
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 1, stone: 1 } });
    equipPickaxe(world);
    // 돌은 아무 용도도 주지 않으므로 언제든 덜어낼 수 있다
    const discard = item(world.observe(), 'stone')?.actions.find((a) => a.role === 'discard-item');
    expect(discard?.available).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('DC-ITEM-KIND-IS-DATA-NOT-BRANCH — 값이 규칙에 박히지 않았다', () => {
  it('걸기와 풀기는 시간을 쓰지 않는다 — 하던 행동을 끊지 않는다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    world.dispatch({ interactionId: 'mine' });
    world.tick(TICK_INTERVAL);
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('mine');

    // 채집 중에 두 번째 곡괭이가 없으므로 풀어 본다 — 행동은 그대로다
    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('mine');
  });

  it('걸린 것도 쓸 수 있다 — C020 이 세운 입구가 사라지지 않는다', () => {
    const world = atDeposit();
    equipPickaxe(world);

    const use = slotOf(world.observe(), 'E1')?.actions.find((a) => a.role === 'use-item');
    expect(use?.available).toBe(true);
    expect(world.dispatch({ interactionId: 'use-item', itemKind: 'pickaxe' })).toEqual({
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  });

  it('남이 무엇을 걸었는지는 오지 않는다 — 적용 관찰은 내 몸의 것뿐이다', () => {
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: -8, z: 4 }, wanderPath: [], perceptionRange: 0 }],
    });
    equipPickaxe(world);

    // 자리 목록은 관찰자의 몸 하나만큼이다 — 존재 수만큼 늘지 않는다
    expect(slots(world.observe())).toHaveLength(EQUIP_SLOTS.length);
    // 그리고 존재 관찰 어디에도 적용 자리가 실리지 않는다
    for (const e of world.observe().entities) {
      expect('equipment' in e).toBe(false);
    }
  });

  it('자율 존재도 같은 자리를 지닌다 — 아무것도 걸지 않은 채이므로 값이 그대로다', () => {
    // 조종 주체가 규칙을 가르지 않는다. 자율 존재의 몸에도 자리가 있고 비어 있으며,
    // 그래서 유효 값이 기본값과 같다 — 이 Cycle 의 전투 회귀가 성립하는 이유다.
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: 1.5, z: 0 }, wanderPath: [], perceptionRange: 0 }],
    });
    observeFully(world, 'npc-1');

    const npc = world.observe().entities.find((e) => e.id === 'npc-1');
    expect(npc?.attributes?.combatStats?.physicalAttack).toBe(
      characterDefinition('rabbit-swordsman').combat.physicalAttack,
    );
  });
});
