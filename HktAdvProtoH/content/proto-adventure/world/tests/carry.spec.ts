// C020 World 단독 테스트 — Before → Input → Rule → After
//
// 03-world-semantic.md 의 SEMANTIC CLOSURE 와 BALANCE 를 실측한다.
// 기본 세계(광맥 하나 · 자원 다섯 · 자리 셋 · 돌 겹침 둘)에서 여섯 판정이 전부
// 도달한다는 것이 이 Cycle 의 핵심 주장이며, 그 주장을 여기가 재현한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, PLAYER, selectTarget } from './drive';
import { ITEM_CATALOG, itemDefinition, usesOf } from '../semantic/item';
import { canAccept, createInventory, lastWayUses, roomFor } from '../semantic/inventory';

const solo = { npcs: [] };
const AT_DEPOSIT = { x: 8, z: -5 }; // deposit(8,-6) 과 거리 1 <= InteractionRange 2
const MINE_TICKS = 40; // 1.2초 (MINE_DURATION) 를 넘기는 Tick 수 · 1/30 초씩

const carried = (v: GameViewSnapshot) => v.carried;
const room = (v: GameViewSnapshot) => v.carriedRoom;
const stone = (v: GameViewSnapshot) =>
  v.carried.filter((c) => c.kind === 'stone').reduce((n, c) => n + c.quantity, 0);
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');
const deposit = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'deposit-1');

/** 광맥 앞에 서서 n 번 캔다 */
function mineTimes(world: ReturnType<typeof driveWorld>, n: number): void {
  selectTarget(world, 'deposit-1');
  for (let i = 0; i < n; i += 1) {
    world.dispatch({ interactionId: 'mine' });
    for (let t = 0; t < MINE_TICKS; t += 1) world.tick(1 / 30);
  }
}

// ── INTENT-ITEM-CATALOG-001 — 세계가 물건을 안다 ─────────────────────────

describe('INTENT-ITEM-CATALOG-001 — 종류 이름은 열쇠이지 분기 조건이 아니다', () => {
  it('카탈로그가 정의를 소유한다 — 겹침 여부·한도·용도·상위 유래', () => {
    expect(itemDefinition('pickaxe')).toMatchObject({
      category: 'tool',
      stackable: false,
      stackLimit: 1,
      uses: ['mining'],
      itemType: 'IT-COMMON-STONE',
    });
    expect(itemDefinition('stone')).toMatchObject({
      category: 'material',
      stackable: true,
      uses: [],
    });
  });

  it('모든 정의가 존재하는 IT-* 를 가리킨다 — 없는 유래를 지어내지 않는다', () => {
    for (const definition of ITEM_CATALOG.values()) {
      expect(definition.itemType).toMatch(/^IT-[A-Z-]+$/);
    }
  });

  it('카탈로그에 없는 종류도 세계를 멈추지 않는다 — 겹치지 않는 것으로 친다', () => {
    expect(usesOf('unknown-thing')).toEqual([]);
    const inventory = createInventory({}, 2);
    expect(roomFor(inventory, 'unknown-thing')).toBe(2); // 자리당 1
  });
});

// ── INTENT-USE-COMES-FROM-DECLARATION-001 — 용도로 묻는다 ────────────────

describe('INTENT-USE-COMES-FROM-DECLARATION-001 — 종류가 아니라 용도를 묻는다', () => {
  it('캐는 용도를 지니면 캘 수 있다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    selectTarget(world, 'deposit-1');
    expect(mine(world.observe())?.available).toBe(true);
  });

  it('캐는 용도를 지니지 않으면 no-mining-tool — 곡괭이가 없어서가 아니라 용도가 없어서다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT, actorItems: {} });
    selectTarget(world, 'deposit-1');
    expect(mine(world.observe())?.available).toBe(false);
    expect(mine(world.observe())?.reason).toBe('no-mining-tool');
  });

  it('용도 없는 물건만 지녀도 캘 수 없다 — 지녔다는 사실이 아니라 무엇을 여는가다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT, actorItems: { stone: 1 } });
    selectTarget(world, 'deposit-1');
    expect(mine(world.observe())?.reason).toBe('no-mining-tool');
  });
});

// ── INTENT-CARRY-ROOM-001 — 지니는 데 자리가 든다 ────────────────────────

describe('INTENT-CARRY-ROOM-001 — 담을 자리가 유한하다', () => {
  it('시작하면 곡괭이가 자리 하나를 차지한다 (1/3)', () => {
    const view = driveWorld({ ...solo }).observe();
    expect(room(view)).toEqual({ used: 1, total: 3 });
    expect(carried(view)).toHaveLength(1);
    expect(carried(view)[0]).toMatchObject({ slot: 0, kind: 'pickaxe', quantity: 1 });
  });

  it('같은 것끼리는 한 자리에 쌓이고, 한도를 넘으면 새 자리를 쓴다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 1);
    expect(room(world.observe())).toEqual({ used: 2, total: 3 }); // 새 자리
    mineTimes(world, 1);
    expect(room(world.observe())).toEqual({ used: 2, total: 3 }); // 쌓인다 (2/2)
    expect(stone(world.observe())).toBe(2);
    mineTimes(world, 1);
    expect(room(world.observe())).toEqual({ used: 3, total: 3 }); // 마지막 자리
    expect(stone(world.observe())).toBe(3);
  });

  it('자리 수는 세계를 띄우는 쪽이 정한다 — 규칙은 특정 수를 묻지 않는다', () => {
    const wide = driveWorld({ ...solo, carryCapacity: 8 }).observe();
    expect(room(wide)).toEqual({ used: 1, total: 8 });
  });
});

// ── INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 — 전량 아니면 전무 ──────────────

describe('INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 — 반쯤 받아 두지 않는다', () => {
  it('자리가 가득해도 쌓을 여유가 있으면 받는다 (IE §6)', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 3); // 3/3 — 자리는 다 찼지만 마지막 자리에 1/2 만 들어 있다
    expect(room(world.observe())).toEqual({ used: 3, total: 3 });
    expect(mine(world.observe())?.available).toBe(true);

    mineTimes(world, 1);
    expect(stone(world.observe())).toBe(4); // 받았다
    expect(room(world.observe())).toEqual({ used: 3, total: 3 });
  });

  it('쌓을 여유도 빈 자리도 없으면 carry-full — 캐기 전에 거절된다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 4); // 곡괭이 1 · 돌 2 · 돌 2 → 더 들어갈 곳이 없다

    const view = world.observe();
    expect(mine(view)?.available).toBe(false);
    expect(mine(view)?.reason).toBe('carry-full');
  });

  it('받지 못한 자원은 세계에 그대로 남는다 — 광맥이 줄지 않는다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 4);
    const before = deposit(world.observe())?.labelValue;
    expect(before).toBe(1); // 5 중 넷을 캤다

    world.dispatch({ interactionId: 'mine' });
    for (let t = 0; t < MINE_TICKS; t += 1) world.tick(1 / 30);

    expect(deposit(world.observe())?.labelValue).toBe(1); // 그대로다
    expect(stone(world.observe())).toBe(4); // 늘지도 않았다
  });

  it('부분 수용은 없다 — 여유가 모자라면 하나도 담기지 않는다', () => {
    // 돌 자리 하나(한도 2)에 1 이 들어 있고 빈 자리가 없는 몸에 2 를 건넨다
    const inventory = createInventory({ pickaxe: 1, stone: 3 }, 3);
    expect(roomFor(inventory, 'stone')).toBe(1);
    expect(canAccept(inventory, 'stone', 1)).toBe(true);
    expect(canAccept(inventory, 'stone', 2)).toBe(false);
  });

  it('고갈된 광맥에서는 자리 이야기가 나오지 않는다 — 사유의 순서', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT, depositAmount: 0 });
    selectTarget(world, 'deposit-1');
    expect(mine(world.observe())?.reason).toBe('deposit-depleted');
  });
});

// ── INTENT-CARRIED-IS-OBSERVABLE-001 — 지닌 것이 보인다 ──────────────────

describe('INTENT-CARRIED-IS-OBSERVABLE-001 — 하나의 계약으로 실린다', () => {
  it('종류마다 따로 만든 자리가 없다 — 돌 전용 칸과 도구 유무 깃발이 사라졌다', () => {
    const view = driveWorld({ ...solo }).observe();
    expect(view.hud.find((h) => h.id === 'inventory.stone')).toBeUndefined();
    expect(view.hud.find((h) => h.id === 'tool.hasMiningTool')).toBeUndefined();
  });

  it('각 항목이 지금 무엇이 되고 왜 안 되는지를 함께 싣는다', () => {
    const view = driveWorld({ ...solo }).observe();
    const pickaxe = carried(view).find((c) => c.kind === 'pickaxe');
    expect(pickaxe?.actions).toHaveLength(1);
    expect(pickaxe?.actions[0]).toMatchObject({
      interactionId: 'let-go',
      slot: 0,
      effect: 'let-go',
      available: false,
      reason: 'last-way-locked',
    });
  });

  it('무엇이 어떤 용도를 여는지가 실린다 — "곡괭이가 있는가" 가 아니다', () => {
    const view = driveWorld({ ...solo }).observe();
    expect(carried(view).find((c) => c.kind === 'pickaxe')?.uses).toEqual(['mining']);
  });

  it('빈 자리는 실리지 않는다 — 자리 수는 carriedRoom 이 답한다', () => {
    const view = driveWorld({ ...solo, carryCapacity: 8 }).observe();
    expect(carried(view)).toHaveLength(1);
    expect(room(view).total).toBe(8);
  });
});

// ── INTENT-LET-GO-001 — 덜어낸다 ────────────────────────────────────────

describe('INTENT-LET-GO-001 — 가진 것이 사라지는 첫 경로', () => {
  it('덜어내면 그 자리가 비고 다시 캘 수 있다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 4);
    expect(mine(world.observe())?.reason).toBe('carry-full');

    const stoneSlot = carried(world.observe()).find((c) => c.kind === 'stone')!.slot;
    const result = world.dispatch({ interactionId: 'let-go', carriedSlot: stoneSlot });

    expect(result.status).toBe('success');
    expect(room(world.observe())).toEqual({ used: 2, total: 3 });
    expect(stone(world.observe())).toBe(2); // 자리 하나(2개)가 통째로 사라졌다
    expect(mine(world.observe())?.available).toBe(true); // 다시 캘 수 있다
  });

  it('덜어낸 것은 세계 어디에도 나타나지 않는다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 1);
    const before = world.observe().entities.length;

    const stoneSlot = carried(world.observe()).find((c) => c.kind === 'stone')!.slot;
    world.dispatch({ interactionId: 'let-go', carriedSlot: stoneSlot });
    world.tick(1 / 30);

    expect(world.observe().entities).toHaveLength(before); // 바닥에 아무것도 생기지 않았다
  });

  it('없는 자리를 덜어내려 하면 carried-not-found — 상태는 그대로다', () => {
    const world = driveWorld({ ...solo });
    const before = room(world.observe());

    const result = world.dispatch({ interactionId: 'let-go', carriedSlot: 2 });
    expect(result).toMatchObject({ status: 'failure', reason: 'carried-not-found' });
    expect(room(world.observe())).toEqual(before);
  });

  it('자리 번호를 싣지 않은 요청도 거절된다 — 흔적을 남기지 않는다', () => {
    const world = driveWorld({ ...solo });
    const result = world.dispatch({ interactionId: 'let-go' });
    expect(result).toMatchObject({ status: 'failure', reason: 'carried-not-found' });
    expect(room(world.observe())).toEqual({ used: 1, total: 3 });
  });

  it('덜어내기는 행동이 아니다 — 채굴 중에도 된다', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    mineTimes(world, 1);

    selectTarget(world, 'deposit-1');
    world.dispatch({ interactionId: 'mine' });
    world.tick(1 / 30); // 채굴이 진행 중이다
    expect(world.observe().entities.find((e) => e.id === PLAYER)?.state).toBe('mine');

    const stoneSlot = carried(world.observe()).find((c) => c.kind === 'stone')!.slot;
    expect(world.dispatch({ interactionId: 'let-go', carriedSlot: stoneSlot }).status).toBe(
      'success',
    );
  });
});

// ── INTENT-NO-DEAD-END-001 — 스스로 막히지 않는다 ────────────────────────

describe('INTENT-NO-DEAD-END-001 — 되돌릴 수 없는 막힘을 만들 수 없다', () => {
  it('지금 열려 있는 유일한 길을 여는 물건은 덜어낼 수 없다', () => {
    const world = driveWorld({ ...solo });
    const pickaxeSlot = carried(world.observe()).find((c) => c.kind === 'pickaxe')!.slot;

    const result = world.dispatch({ interactionId: 'let-go', carriedSlot: pickaxeSlot });
    expect(result).toMatchObject({ status: 'failure', reason: 'last-way-locked' });
    expect(carried(world.observe()).some((c) => c.kind === 'pickaxe')).toBe(true);
  });

  it('판정은 종류가 아니라 마지막인가를 본다 — 둘 지니면 하나는 덜어낼 수 있다', () => {
    const world = driveWorld({ ...solo, actorItems: { pickaxe: 2 } });
    // 겹치지 않는 물건이므로 자리 둘을 쓴다
    expect(room(world.observe())).toEqual({ used: 2, total: 3 });

    const first = carried(world.observe()).find((c) => c.kind === 'pickaxe')!.slot;
    expect(world.dispatch({ interactionId: 'let-go', carriedSlot: first }).status).toBe('success');

    // 하나 남으면 그것이 마지막이 되어 다시 잠긴다
    const last = carried(world.observe()).find((c) => c.kind === 'pickaxe')!.slot;
    expect(world.dispatch({ interactionId: 'let-go', carriedSlot: last })).toMatchObject({
      reason: 'last-way-locked',
    });
  });

  it('용도를 열지 않는 물건은 잠기지 않는다', () => {
    const inventory = createInventory({ pickaxe: 1, stone: 2 }, 3);
    expect([...lastWayUses(inventory)]).toEqual(['mining']);
    // 돌은 아무 용도도 열지 않으므로 lastWayUses 와 무관하다
    expect(usesOf('stone')).toEqual([]);
  });
});

// ── 03 BALANCE — 여섯 판정이 기본 세계에서 전부 도달한다 ─────────────────

describe('C020 BALANCE — 기본 세계에서 여섯 판정이 모두 도달한다', () => {
  it('새 자리 → 쌓임 → 가득 참 → 가득해도 받음 → 거절 → 덜어내고 다시 캐기', () => {
    const world = driveWorld({ ...solo, actorPosition: AT_DEPOSIT });
    const steps: string[] = [];

    mineTimes(world, 1);
    steps.push(`새 자리 ${room(world.observe()).used}/3`);
    mineTimes(world, 1);
    steps.push(`쌓임 ${room(world.observe()).used}/3 · 돌 ${stone(world.observe())}`);
    mineTimes(world, 1);
    steps.push(`가득 참 ${room(world.observe()).used}/3`);
    mineTimes(world, 1);
    steps.push(`가득해도 받음 돌 ${stone(world.observe())}`);
    steps.push(`거절 ${mine(world.observe())?.reason}`);

    const stoneSlot = carried(world.observe()).find((c) => c.kind === 'stone')!.slot;
    world.dispatch({ interactionId: 'let-go', carriedSlot: stoneSlot });
    steps.push(`덜어냄 ${room(world.observe()).used}/3 · 다시 캘 수 있는가 ${mine(world.observe())?.available}`);

    expect(steps).toEqual([
      '새 자리 2/3',
      '쌓임 2/3 · 돌 2',
      '가득 참 3/3',
      '가득해도 받음 돌 4',
      '거절 carry-full',
      '덜어냄 2/3 · 다시 캘 수 있는가 true',
    ]);
  });
});
