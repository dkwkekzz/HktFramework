// C020 World 단독 테스트 — Before → Input → Rule → After
//
// 03-world-semantic.md 의 SEMANTIC CLOSURE 를 항목별로 재현한다.
// 이 파일이 지는 특별한 짐 하나 — **효과의 자리가 분기가 아니라 목록임을 보인다.**
// 그것을 보이는 방법은 두 갈래가 같은 문을 지나면서 서로 다른 일을 하고 서로 다른
// 소모 성질을 지니는 것을 확인하는 것이다 (01-cycle.md SCOPE NOTE ⑤).

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ITEM_CATALOG, itemDefinition, ITEM_KINDS } from '../semantic/item';
import { driveWorld, PLAYER, selectTarget, type WorldDriver } from './drive';

const TICK = 1 / 30;

const item = (v: GameViewSnapshot, kind: string) => v.inventory.find((i) => i.kind === kind);
const count = (v: GameViewSnapshot, kind: string) => item(v, kind)?.count ?? 0;
const useAction = (v: GameViewSnapshot, kind: string) =>
  item(v, kind)?.actions.find((a) => a.role === 'use-item');
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const npc = (v: GameViewSnapshot, id = 'npc-1') => v.entities.find((e) => e.id === id);

/** 사용을 끝까지 마친다 — 완료 시점에 효과와 소모가 함께 일어난다 */
function useFully(world: WorldDriver, kind: string): void {
  world.dispatch({ interactionId: 'use-item', itemKind: kind });
  for (let i = 0; i < 30; i++) world.tick(TICK); // 1.0초 — 돌의 사용 시간 0.8 보다 길다
}

/** 사냥터를 지니는 자율 존재 하나 — 그 자리에 든 것을 사냥감으로 대한다 (C018) */
const hostileNpc = (at: { x: number; z: number }) => ({
  id: 'npc-1',
  position: at,
  wanderPath: [at],
  perceptionRange: 0, // 다가오지 않게 둔다 — 이 검증의 관심은 던지는 쪽이다
  guardedGround: { center: at, radius: 6 },
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-ITEM-DEFINITION-001 — 세계가 물건을 안다', () => {
  it('정의소가 종류마다 무엇인지 · 무엇에 쓰는지 · 겹치는지를 답한다', () => {
    const stone = itemDefinition('stone')!;
    expect(stone.category).toBe('material');
    expect(stone.stackable).toBe(true);
    expect(stone.uses).toEqual([]); // 돌은 몸에 아무 용도도 주지 않는다

    const pickaxe = itemDefinition('pickaxe')!;
    expect(pickaxe.category).toBe('tool');
    expect(pickaxe.uses).toEqual(['mine']); // 채집 용도는 **정의**가 소유한다
  });

  it('세계가 모르는 종류는 정의가 없고, 그것이 사유가 된다', () => {
    expect(itemDefinition('sword')).toBeUndefined();

    const world = driveWorld({ npcs: [] });
    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'sword' });
    expect(result).toEqual({ status: 'failure', rule: 'RULE-ITEM-USE-001', reason: 'unknown-item' });
  });
});

describe('INTENT-ITEM-ORIGIN-TRACE-001 — 어디서 왔는가', () => {
  it('돌은 상위 정의를 밝힌다', () => {
    expect(itemDefinition('stone')?.origin).toBe('IT-COMMON-STONE');
  });

  it('곡괭이는 상위 정의가 없다 — 지닌 것이 성질이 아니라 용도이기 때문이다', () => {
    expect(itemDefinition('pickaxe')?.origin).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-INVENTORY-IS-ONE-CONTRACT-001 — 가진 것 전부가 한 목록', () => {
  it('지닌 종류만 항목이 되고, 지니지 않은 종류는 항목이 없다', () => {
    const world = driveWorld({ npcs: [], actorItems: { pickaxe: 1 } });
    const view = world.observe();

    expect(view.inventory.map((i) => i.kind)).toEqual(['pickaxe']);
    expect(item(view, 'stone')).toBeUndefined();
  });

  it('두 종류를 지니면 정확히 두 항목이 나온다', () => {
    const world = driveWorld({ npcs: [], actorItems: { stone: 3, pickaxe: 1 } });
    const view = world.observe();

    expect(view.inventory).toHaveLength(2);
    expect(count(view, 'stone')).toBe(3);
    expect(count(view, 'pickaxe')).toBe(1);
  });

  it('종류 전용 HUD 칸이 세계의 관찰에서 사라졌다', () => {
    const world = driveWorld({ npcs: [], actorItems: { stone: 1, pickaxe: 1 } });
    const ids = world.observe().hud.map((h) => h.id);

    expect(ids).not.toContain('inventory.stone');
    expect(ids).not.toContain('tool.hasMiningTool');
  });

  it('순서는 세계가 아는 종류의 순서다 — 같은 상태면 언제나 같다', () => {
    const world = driveWorld({ npcs: [], actorItems: { pickaxe: 1, stone: 2 } });
    const kinds = world.observe().inventory.map((i) => i.kind);

    expect(kinds).toEqual(ITEM_KINDS.filter((k) => kinds.includes(k)));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-USE-ITEM-001 · INTENT-EFFECT-DELIVER-FORCE-001 — 던진 돌이 닿는다', () => {
  const near = { x: 1, z: 0 };

  const throwWorld = () =>
    driveWorld({
      npcs: [hostileNpc(near)],
      actorPosition: { x: 0, z: 0 }, // 거리 1 <= InteractionRange 2
      actorItems: { stone: 3, pickaxe: 1 },
    });

  it('쓰면 use-item 행동에 들어가고, 그 시점에는 아직 아무것도 줄지 않는다', () => {
    const world = throwWorld();
    selectTarget(world, 'npc-1');

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-ITEM-USE-001' });
    const view = world.observe();
    expect(player(view)?.state).toBe('use-item');
    expect(count(view, 'stone')).toBe(3); // 시작만으로는 줄지 않는다
  });

  it('끝까지 가면 생명이 줄고 돌이 하나 준다', () => {
    const world = throwWorld();
    selectTarget(world, 'npc-1');
    const before = npc(world.observe())?.vitality?.health ?? 0;

    useFully(world, 'stone');

    const view = world.observe();
    expect(npc(view)?.vitality?.health).toBeLessThan(before);
    expect(count(view, 'stone')).toBe(2);
    expect(player(view)?.state).not.toBe('use-item'); // 행동이 끝났다
  });

  it('타격 사건의 이름표에 쓰인 것의 이름이 실린다', () => {
    const world = throwWorld();
    selectTarget(world, 'npc-1');
    useFully(world, 'stone');

    const strike = world.observe().strikes.at(-1);
    expect(strike?.skill).toBe('stone');
    expect(strike?.targetId).toBe('npc-1');
  });

  it('위력은 물건의 것이다 — 던진 이의 공격 능력을 타지 않는다', () => {
    const world = throwWorld();
    selectTarget(world, 'npc-1');
    useFully(world, 'stone');

    const breakdown = world.observe().strikes.at(-1)?.breakdown;
    expect(breakdown?.baseDamage).toBe(ITEM_CATALOG.stone.use!.effect.kind === 'deliver-force'
      ? ITEM_CATALOG.stone.use!.effect.force.baseDamage
      : -1);
    expect(breakdown?.attackContribution).toBe(0); // AttackRatio 0
  });

  it('기력을 쓰지 않는다 — 치르는 것은 지닌 것이다', () => {
    const world = throwWorld();
    selectTarget(world, 'npc-1');
    const before = world.observe().hud.find((h) => h.id === 'self.cp')?.value;

    useFully(world, 'stone');

    expect(world.observe().hud.find((h) => h.id === 'self.cp')?.value).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-ITEM-ATOMIC-CHANGE-001 — 되지 않은 시도는 흔적을 남기지 않는다', () => {
  it('끊긴 사용은 효과도 소모도 남기지 않는다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 1, z: 0 })],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 3 },
    });
    selectTarget(world, 'npc-1');
    world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });

    // 완료 전에 다른 것으로 갈아탈 수는 없다(대체 불가) — 세계를 그냥 조금만 굴린다
    for (let i = 0; i < 5; i++) world.tick(TICK); // 0.17초 — 0.8 에 못 미친다

    const view = world.observe();
    expect(player(view)?.state).toBe('use-item'); // 아직 진행 중이다
    expect(count(view, 'stone')).toBe(3); // 아무것도 줄지 않았다
    expect(view.strikes).toHaveLength(0); // 아무 일도 일어나지 않았다
  });

  it('지니지 않은 것은 쓸 수 없고, 그 시도는 아무것도 바꾸지 않는다', () => {
    const world = driveWorld({ npcs: [], actorItems: { pickaxe: 1 } });

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-ITEM-USE-001', reason: 'not-enough' });
    expect(player(world.observe())?.state).toBe('idle');
  });

  it('수량이 음수가 되는 상태는 존재하지 않는다 — 마지막 하나를 쓰면 항목이 사라진다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 1, z: 0 })],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 1 },
    });
    selectTarget(world, 'npc-1');
    useFully(world, 'stone');

    expect(item(world.observe(), 'stone')).toBeUndefined();
    expect(count(world.observe(), 'stone')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-USE-TARGET-POLICY-001 — 대상 요구는 정의가 밝힌다', () => {
  it('아무것도 고르지 않으면 쓸 수 없다', () => {
    const world = driveWorld({ npcs: [], actorItems: { stone: 2 } });

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-USE-001',
      reason: 'no-target-selected',
    });
  });

  it('고른 것이 존재가 아니면 종류가 맞지 않는다', () => {
    const world = driveWorld({
      npcs: [],
      actorPosition: { x: 8, z: -5 },
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'deposit-1');

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });
    expect(result.status).toBe('failure');
    expect((result as { reason: string }).reason).toBe('target-kind-mismatch');
  });

  it('그 물건이 닿는 거리 밖이면 쓸 수 없다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 9, z: 0 })],
      actorPosition: { x: 0, z: 0 }, // 거리 9 > 돌의 사거리 5
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'npc-1');

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-ITEM-USE-001',
      reason: 'out-of-range',
    });
  });

  it('시작한 사용은 처음 고른 것을 끝까지 지닌다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 1, z: 0 }), { ...hostileNpc({ x: -1, z: 0 }), id: 'npc-2' }],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'npc-1');
    world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });

    selectTarget(world, 'npc-2'); // 도중에 다른 것을 고른다
    for (let i = 0; i < 30; i++) world.tick(TICK);

    expect(world.observe().strikes.at(-1)?.targetId).toBe('npc-1');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-HARM-GATE-001 재사용 — 아이템도 관문 밖에 있지 않다', () => {
  it('사냥감으로 대하지 않는 것에게 던지면 아무 일도 일어나지 않는다', () => {
    const world = driveWorld({
      // 지키는 자리가 없는 존재 — 둘 사이에 적대의 사정이 없다
      npcs: [{ id: 'npc-1', position: { x: 1, z: 0 }, wanderPath: [{ x: 1, z: 0 }], perceptionRange: 0 }],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'npc-1');
    const before = npc(world.observe())?.vitality?.health;

    useFully(world, 'stone');

    const view = world.observe();
    expect(npc(view)?.vitality?.health).toBe(before); // 상하지 않았다
    expect(view.strikes).toHaveLength(0);
    expect(view.contacts.at(-1)).toMatchObject({ targetId: 'npc-1', reason: 'not-hostile' });
  });

  it('그래도 돌은 준다 — 던진 돌은 던진 것이다 (05-review 판단 4)', () => {
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: 1, z: 0 }, wanderPath: [{ x: 1, z: 0 }], perceptionRange: 0 }],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'npc-1');

    useFully(world, 'stone');

    expect(count(world.observe(), 'stone')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-EFFECT-BEGIN-DECLARED-ACT-001 — 둘째 갈래', () => {
  const mineWorld = () =>
    driveWorld({ npcs: [], actorPosition: { x: 8, z: -5 }, depositAmount: 5 });

  it('곡괭이를 쓰면 채집이 시작된다', () => {
    const world = mineWorld();
    selectTarget(world, 'deposit-1');

    const result = world.dispatch({ interactionId: 'use-item', itemKind: 'pickaxe' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect(player(world.observe())?.state).toBe('mine');
  });

  it('입구가 둘이어도 판정은 하나다 — 같은 조건에서 같은 사유가 나온다', () => {
    const world = mineWorld(); // 아무것도 고르지 않은 상태

    const viaMine = world.dispatch({ interactionId: 'mine' });
    const viaItem = world.dispatch({ interactionId: 'use-item', itemKind: 'pickaxe' });

    expect((viaMine as { reason: string }).reason).toBe('no-target-selected');
    expect((viaItem as { reason: string }).reason).toBe('no-target-selected');

    const view = world.observe();
    expect(view.interactions.find((i) => i.id === 'mine')?.reason).toBe('no-target-selected');
    expect(useAction(view, 'pickaxe')?.unavailableReason).toBe('no-target-selected');
  });

  it('곡괭이는 써도 줄지 않는다 — 소모 여부도 정의가 정한다', () => {
    const world = mineWorld();
    selectTarget(world, 'deposit-1');
    world.dispatch({ interactionId: 'use-item', itemKind: 'pickaxe' });
    for (let i = 0; i < 45; i++) world.tick(TICK); // 채집 1.2초를 넘긴다

    const view = world.observe();
    expect(count(view, 'pickaxe')).toBe(1); // 도구는 닳지 않는다
    expect(count(view, 'stone')).toBe(1); // 대신 캔 것이 늘었다
  });

  it('사거리도 정의가 지닌다 — 물건마다 다른 값이며 규칙은 읽기만 한다', () => {
    // 돌은 손이 닿는 거리(2.0)보다 멀리 닿는다. 곡괭이는 자기 거리를 밝히지 않으므로
    // 그 행동의 판정이 쓰는 거리를 그대로 쓴다.
    expect(ITEM_CATALOG.stone.use?.range).toBe(5);
    expect(ITEM_CATALOG.pickaxe.use?.range).toBeUndefined();
  });

  it('손이 닿는 거리 밖 · 자기 사거리 안이면 쓸 수 있다 (Stage 8 반환의 해소)', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 4, z: 0 })],
      actorPosition: { x: 0, z: 0 }, // 거리 4 — InteractionRange 2 밖, 돌의 사거리 5 안
      actorItems: { stone: 2 },
    });
    selectTarget(world, 'npc-1');

    expect(useAction(world.observe(), 'stone')?.available).toBe(true);

    const before = npc(world.observe())?.vitality?.health ?? 0;
    useFully(world, 'stone');

    // 다가가지 않고도 위력이 전해진다 — "붙기 전에 한 발"
    expect(npc(world.observe())?.vitality?.health).toBeLessThan(before);
    expect(count(world.observe(), 'stone')).toBe(1);
  });

  it('사거리가 늘어도 손이 닿는 거리는 그대로다 — 채집은 영향받지 않는다', () => {
    const world = driveWorld({
      npcs: [],
      actorPosition: { x: 8, z: -2 }, // 광맥(8,-6)과 거리 4 — 돌의 사거리 안이지만
      depositAmount: 5, //              채집의 거리(2) 밖이다
    });
    selectTarget(world, 'deposit-1');

    expect(world.observe().interactions.find((i) => i.id === 'mine')?.reason).toBe('out-of-range');
  });

  it('두 갈래가 서로 다른 소모 성질을 지닌다 — 자리가 분기가 아니다', () => {
    expect(ITEM_CATALOG.stone.use?.consumes).toBe(1);
    expect(ITEM_CATALOG.pickaxe.use?.consumes).toBe(0);
    expect(ITEM_CATALOG.stone.use?.effect.kind).toBe('deliver-force');
    expect(ITEM_CATALOG.pickaxe.use?.effect.kind).toBe('begin-declared-act');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-CAPABILITY-FROM-DECLARED-USE-001 — 용도가 판정한다', () => {
  it('채집 용도를 주는 것이 없으면 캘 수 없다', () => {
    const world = driveWorld({ npcs: [], actorPosition: { x: 8, z: -5 }, actorItems: { stone: 5 } });
    selectTarget(world, 'deposit-1');

    const result = world.dispatch({ interactionId: 'mine' });

    // **사유 코드는 그대로다** — 사람이 겪는 일이 달라지지 않았다
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-mining-tool' });
  });

  it('돌을 아무리 많이 지녀도 채집 용도가 생기지 않는다', () => {
    const world = driveWorld({ npcs: [], actorPosition: { x: 8, z: -5 }, actorItems: { stone: 99 } });
    selectTarget(world, 'deposit-1');

    expect(world.observe().interactions.find((i) => i.id === 'mine')?.available).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('INTENT-USE-AVAILABILITY-001 — 관찰과 실행이 같은 판정이다', () => {
  it('화면에 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다', () => {
    const world = driveWorld({ npcs: [], actorItems: { stone: 1, pickaxe: 1 } });

    const shown = useAction(world.observe(), 'stone');
    expect(shown?.available).toBe(false);

    const forced = world.dispatch({ interactionId: 'use-item', itemKind: 'stone' });
    expect((forced as { reason: string }).reason).toBe(shown?.unavailableReason);
  });

  it('조건이 갖춰지면 가능으로 바뀐다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 1, z: 0 })],
      actorPosition: { x: 0, z: 0 },
      actorItems: { stone: 1 },
    });
    expect(useAction(world.observe(), 'stone')?.available).toBe(false);

    selectTarget(world, 'npc-1');

    expect(useAction(world.observe(), 'stone')?.available).toBe(true);
    expect(useAction(world.observe(), 'stone')?.unavailableReason).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('C001 · C007 REGRESSION — 이 Cycle 이 바꾸지 않은 것', () => {
  it('참여한 몸은 곡괭이 하나를 지니고 시작한다', () => {
    const world = driveWorld({ npcs: [] });
    expect(count(world.observe(), 'pickaxe')).toBe(1);
  });

  it('휘두름의 피해는 이 Cycle 전과 같은 길을 지난다 — 내역의 자리가 그대로다', () => {
    const world = driveWorld({
      npcs: [hostileNpc({ x: 1, z: 0 })],
      actorPosition: { x: 0, z: 0 },
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(TICK);

    const strike = world.observe().strikes.at(-1);
    expect(strike?.skill).toBe('attack'); // 스킬의 이름표는 그대로다
    expect(strike?.breakdown.baseDamage).toBe(6); // 기본 스킬의 값 그대로
    expect(strike?.breakdown.attackContribution).toBeGreaterThan(0); // 능력을 탄다
  });
});
