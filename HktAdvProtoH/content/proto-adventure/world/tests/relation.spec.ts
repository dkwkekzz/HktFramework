// C018 World 단독 테스트 — Implements INTENT-RELATION-STANCE-001 ·
//   INTENT-STANCE-FROM-GUARDED-GROUND-001 · INTENT-HARM-GATE-001 ·
//   INTENT-WITHDRAWAL-ENDS-IT-001 · INTENT-NPC-AUTONOMY-001 (CHANGED) ·
//   INTENT-STANCE-OBSERVE-001 · INTENT-UNHARMED-IS-OBSERVABLE-001
//
// 검증 대상은 RULE-STANCE-001 · RULE-HARM-GATE-001 과 그 둘이 바꾼 세 곳
// (RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001 · Observer Projection) 이다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { WorldSetup } from '../index';
import { driveWorld, PLAYER } from './drive';
import { spawnActor } from '../semantic/spawn';
import { ruleHarmGate, ruleStance } from '../rules/relation';

const entity = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const stanceToward = (v: GameViewSnapshot, id: string) =>
  entity(v, id)?.attributes?.stanceTowardObserver;
const stanceFrom = (v: GameViewSnapshot, id: string) =>
  entity(v, id)?.attributes?.stanceFromObserver;

// 지키는 존재 하나(자리 중심 원점 · 반경 5)와 지키지 않는 존재 하나.
// 둘의 종류·능력치는 같다 — 다른 것은 지킬 것이 있는가뿐이다.
function withNeutral(playerAt: { x: number; z: number }): WorldSetup {
  return {
    actorPosition: playerAt,
    npcs: [
      {
        id: 'npc-1',
        position: { x: 0, z: 0 },
        perceptionRange: 0.1, // 이 배치의 관심사는 태도의 값이므로 상대를 세워 둔다
        wanderPath: [{ x: 0, z: 0 }],
        guardedGround: { center: { x: 0, z: 0 }, radius: 5 },
      },
      {
        id: 'npc-2',
        position: { x: 2, z: 0 },
        perceptionRange: 0.1,
        wanderPath: [{ x: 2, z: 0 }],
      },
    ],
  };
}

/** 지키는 존재 하나만 있는 배치 — 자율 판단을 볼 때 쓴다 */
function guardedOnly(playerAt: { x: number; z: number }): WorldSetup {
  return {
    actorPosition: playerAt,
    npcs: [
      {
        id: 'npc-1',
        position: { x: 0, z: 0 },
        wanderPath: [{ x: 0, z: 0 }],
        guardedGround: { center: { x: 0, z: 0 }, radius: 5 },
      },
    ],
  };
}

/** 세계 안의 행동으로 걸어서 그 자리에 선다 — 상태를 직접 밀어 넣지 않는다 */
function walkTo(world: ReturnType<typeof driveWorld>, x: number, z: number): void {
  world.dispatch({ interactionId: 'move', position: { x, z } });
  for (let i = 0; i < 120; i++) world.tick(1 / 30);
}

describe('RULE-STANCE-001 — 태도는 지키는 자리에서 나온다', () => {
  it('자리 안에 든 것은 사냥감이고, 밖에 선 것은 아니다', () => {
    const inside = driveWorld(withNeutral({ x: 3, z: 0 })).observe();
    expect(stanceToward(inside, 'npc-1')).toBe('hostile');

    const outside = driveWorld(withNeutral({ x: 12, z: 0 })).observe();
    expect(stanceToward(outside, 'npc-1')).toBe('neutral');
  });

  it('지킬 것이 없는 존재는 자리 안에 있어도 누구도 사냥감으로 대하지 않는다', () => {
    const view = driveWorld(withNeutral({ x: 3, z: 0 })).observe();
    // npc-2 는 플레이어 바로 옆(2,0)에 있지만 지킬 것이 없다
    expect(stanceToward(view, 'npc-2')).toBe('neutral');
  });

  it('태도는 방향값이다 — 내 쪽은 중립인데 상대 쪽은 적대일 수 있다', () => {
    const view = driveWorld(withNeutral({ x: 3, z: 0 })).observe();
    expect(stanceToward(view, 'npc-1')).toBe('hostile'); // 저것이 나를
    expect(stanceFrom(view, 'npc-1')).toBe('neutral'); //  내가 저것을 (내겐 지킬 것이 없다)
  });

  it('주체의 종류가 판정을 바꾸지 않는다 — 사람의 몸이 지키면 사람도 적대의 한쪽이 된다', () => {
    // 규칙에 직접 묻는다. 세계를 거치지 않아야 "판정이 무엇을 입력으로 받는가" 가 드러난다.
    const asPlayer = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'rabbit-swordsman',
      control: 'player',
      position: { x: 0, z: 0 },
      guardedGround: { center: { x: 0, z: 0 }, radius: 5 },
    });
    const asCreature = spawnActor({
      id: 'b',
      name: 'B',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 2, z: 0 },
    });
    // 사람이 조종하는 몸이 지키고 있고 자율 존재가 그 안에 들어와 있다
    expect(ruleStance(asPlayer, asCreature)).toBe('hostile');
    expect(ruleStance(asCreature, asPlayer)).toBe('neutral');
    // 그리고 관문은 그것만으로 열린다 — 어느 쪽이 사람인지 묻지 않는다
    expect(ruleHarmGate(asCreature, asPlayer).status).toBe('allowed');
    expect(ruleHarmGate(asPlayer, asCreature).status).toBe('allowed');
  });

  it('보는 이의 몸은 지킬 것 없이 태어난다 — 초기값이지 예외가 아니다', () => {
    const born = spawnActor({
      id: 'c',
      name: 'C',
      characterKind: 'rabbit-swordsman',
      control: 'player',
      position: { x: 0, z: 0 },
    });
    expect(born.guardedGround).toBeNull();
    const creature = spawnActor({
      id: 'd',
      name: 'D',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 0, z: 0 },
    });
    expect(creature.guardedGround).toBeNull(); // 자율 존재도 같은 초기값이다
  });

  it('자기 몸에는 언제나 중립이 실린다 — 자기 자리 안의 자기 자신은 침입자가 아니다', () => {
    const view = driveWorld(withNeutral({ x: 3, z: 0 })).observe();
    expect(stanceToward(view, PLAYER)).toBe('neutral');
    expect(stanceFrom(view, PLAYER)).toBe('neutral');
  });

  it('태도는 가려지지 않는다 — 살펴보지 않아도, 통찰이 0 이어도 실린다', () => {
    const view = driveWorld(withNeutral({ x: 3, z: 0 })).observe();
    const npc = entity(view, 'npc-1');
    expect(npc?.attributes?.insight).toBe(0);
    expect(npc?.attributes?.concealed.length).toBeGreaterThan(0); // 겨루는 힘은 가려져 있다
    expect(npc?.attributes?.stanceTowardObserver).toBe('hostile'); // 그런데 태도는 보인다
  });
});

describe('RULE-HARM-GATE-001 — 적대가 아니면 해가 일어나지 않는다', () => {
  it('중립인 것을 휘둘러 맞혀도 생명이 줄지 않고 하던 행동도 끊기지 않는다', () => {
    // npc-2 (지킬 것 없음) 바로 앞에 선다. npc-1 의 자리 밖이다.
    const world = driveWorld({
      actorPosition: { x: 19, z: 0 },
      npcs: [{ id: 'npc-2', position: { x: 20, z: 0 }, wanderPath: [{ x: 20, z: 0 }] }],
    });
    const before = entity(world.observe(), 'npc-2')?.vitality?.health;
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    const view = world.observe();
    expect(entity(view, 'npc-2')?.vitality?.health).toBe(before); // 한 톨도 줄지 않았다
    expect(view.strikes).toHaveLength(0); // 타격이 아니다
  });

  it('닿았으나 성립하지 않은 것이 사유와 함께 관찰된다 — 빗나감과 구분된다', () => {
    const world = driveWorld({
      actorPosition: { x: 19, z: 0 },
      npcs: [{ id: 'npc-2', position: { x: 20, z: 0 }, wanderPath: [{ x: 20, z: 0 }] }],
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    const contacts = world.observe().contacts;
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      attackerId: PLAYER,
      targetId: 'npc-2',
      skill: 'attack',
      reason: 'not-hostile',
    });
  });

  it('한 휘두름에 같은 몸의 무산은 한 번만 쌓인다', () => {
    const world = driveWorld({
      actorPosition: { x: 19, z: 0 },
      npcs: [{ id: 'npc-2', position: { x: 20, z: 0 }, wanderPath: [{ x: 20, z: 0 }] }],
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    expect(world.observe().contacts).toHaveLength(1);
  });

  it('빗나가면 아무것도 오지 않는다 — 무산과 빗나감은 다르다', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-2', position: { x: 18, z: 0 }, wanderPath: [{ x: 18, z: 0 }] }],
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    expect(world.observe().contacts).toHaveLength(0);
    expect(world.observe().strikes).toHaveLength(0);
  });

  it('적대인 것은 그대로 맞는다 — 관문 뒤의 계산은 한 글자도 바뀌지 않았다', () => {
    const world = driveWorld(withNeutral({ x: 1, z: 0 })); // npc-1 의 자리 안 · 사거리 안
    const before = entity(world.observe(), 'npc-1')?.vitality?.health ?? 0;
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    const view = world.observe();
    expect(entity(view, 'npc-1')!.vitality!.health).toBeLessThan(before);
    expect(view.strikes.some((s) => s.targetId === 'npc-1')).toBe(true);
  });

  it('밖에서는 칠 수 없다 — 싸움을 걸려면 그 자리에 들어가야 한다', () => {
    // 자리 경계(반경 5) 밖이면서 몸이 닿는 거리에 선다
    const world = driveWorld({
      actorPosition: { x: 6.2, z: 0 },
      npcs: [
        {
          id: 'npc-1',
          position: { x: 5.6, z: 0 },
          wanderPath: [{ x: 5.6, z: 0 }],
          perceptionRange: 0.1, // 이 검증에서는 상대가 움직이지 않게 둔다
          guardedGround: { center: { x: 0, z: 0 }, radius: 5 },
        },
      ],
    });
    // 지키는 존재가 자기 자리 밖에 서 있고, 나도 그 자리 밖이다 → 양쪽 다 중립
    expect(stanceToward(world.observe(), 'npc-1')).toBe('neutral');
    const before = entity(world.observe(), 'npc-1')?.vitality?.health;
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    expect(entity(world.observe(), 'npc-1')?.vitality?.health).toBe(before);
  });
});

describe('INTENT-WITHDRAWAL-ENDS-IT-001 — 물러나면 풀린다', () => {
  it('자리 밖으로 걸어 나가면 적대가 사라지고, 다시 들어가면 다시 선다', () => {
    const world = driveWorld(withNeutral({ x: 3, z: 0 }));
    expect(stanceToward(world.observe(), 'npc-1')).toBe('hostile');

    walkTo(world, 12, 0);
    expect(stanceToward(world.observe(), 'npc-1')).toBe('neutral');

    // 다시 들어가면 다시 적대다 — 기억이 아니라 지금의 사실이다
    walkTo(world, 3, 0);
    expect(stanceToward(world.observe(), 'npc-1')).toBe('hostile');
  });

  it('때린 뒤 나가도 원한이 남지 않는다 — 태도는 기록이 아니다', () => {
    const world = driveWorld(withNeutral({ x: 1, z: 0 }));
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    expect(world.observe().strikes.length).toBeGreaterThan(0); // 실제로 때렸다

    walkTo(world, 14, 0);
    expect(stanceToward(world.observe(), 'npc-1')).toBe('neutral');
  });
});

describe('RULE-NPC-DECIDE-001 (CHANGED) — 사냥감으로 대하는 것만 쫓는다', () => {
  it('지킬 것이 있는 존재는 자리에 든 침입자를 쫓는다', () => {
    const world = driveWorld(guardedOnly({ x: 4, z: 0 }));
    for (let i = 0; i < 5; i++) world.tick(1 / 30);
    expect(entity(world.observe(), 'npc-1')?.state).toBe('move');
  });

  it('지킬 것이 없는 존재는 눈앞의 상대를 쫓지 않는다 — 자기 일을 계속한다', () => {
    const world = driveWorld({
      actorPosition: { x: 20, z: 1 },
      npcs: [
        {
          id: 'npc-2',
          position: { x: 20, z: 0 },
          wanderPath: [
            { x: 20, z: 0 },
            { x: 20, z: -10 },
          ],
        },
      ],
    });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    // 플레이어(20,1)를 향해 z 가 커지지 않고 순회 지점(20,-10)으로 간다
    const p = entity(world.observe(), 'npc-2')?.position;
    expect(p?.z).toBeLessThan(0);
  });

  it('침입자가 자리 밖으로 나가면 더 쫓지 않는다', () => {
    const world = driveWorld(guardedOnly({ x: 4, z: 0 }));
    for (let i = 0; i < 5; i++) world.tick(1 / 30);
    expect(entity(world.observe(), 'npc-1')?.state).toBe('move'); // 쫓기 시작했다

    walkTo(world, 16, 0);
    const chased = entity(world.observe(), 'npc-1')?.position?.x ?? 0;
    // 순회 지점이 자기 자리(0,0) 하나뿐이므로 쫓기를 멈추면 그리로 돌아간다.
    // 침입자(16,0) 쪽으로 계속 갔다면 자리 반경(5)을 훌쩍 넘었을 것이다.
    expect(chased).toBeLessThan(5);
    expect(stanceToward(world.observe(), 'npc-1')).toBe('neutral');
  });
});

describe('수명 — 무산도 타격 결과와 같은 시간을 산다', () => {
  it('시간이 지나면 사라진다', () => {
    const world = driveWorld({
      actorPosition: { x: 19, z: 0 },
      npcs: [{ id: 'npc-2', position: { x: 20, z: 0 }, wanderPath: [{ x: 20, z: 0 }] }],
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    expect(world.observe().contacts).toHaveLength(1);

    for (let i = 0; i < 60; i++) world.tick(1 / 30); // 2초 — STRIKE_EVENT_TTL(1.2) 초과
    expect(world.observe().contacts).toHaveLength(0);
  });
});

describe('결정론 — 성립하지 않은 접촉은 흔들림을 쓰지 않는다', () => {
  // 같은 뿌리의 두 세계를 견준다. 하나에는 무산될 상대가 앞에 하나 더 서 있다.
  // 무산이 흔들림을 소비했다면 그 뒤 성립한 타격의 Critical 판정이 달라진다.
  function struckCritical(withNeutralInTheWay: boolean) {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      chanceSeed: 0x5eedc018,
      npcs: [
        // 지킬 것이 없는 존재 — 닿아도 성립하지 않는다 (앞에 선다)
        ...(withNeutralInTheWay
          ? [{ id: 'npc-2', position: { x: 0.9, z: 1.4 }, perceptionRange: 0.1, wanderPath: [] }]
          : []),
        // 나를 자기 자리에 들인 존재 — 이쪽은 성립한다
        {
          id: 'npc-1',
          position: { x: -0.9, z: 1.4 },
          perceptionRange: 0.1,
          wanderPath: [],
          guardedGround: { center: { x: 0, z: 0 }, radius: 5 },
        },
      ],
    });
    world.dispatch({ interactionId: 'attack' });
    for (let i = 0; i < 20; i++) world.tick(1 / 30);
    const view = world.observe();
    const hit = view.strikes.find((s) => s.targetId === 'npc-1');
    return { hit, contacts: view.contacts.length };
  }

  it('무산이 앞서 일어나도 그 뒤 타격의 흔들림 판정이 달라지지 않는다', () => {
    const withNeutralOne = struckCritical(true);
    const control = struckCritical(false);

    expect(withNeutralOne.contacts).toBe(1); // 실제로 무산이 하나 있었다
    expect(control.contacts).toBe(0);
    expect(withNeutralOne.hit).toBeDefined();
    expect(control.hit).toBeDefined();
    expect(withNeutralOne.hit!.breakdown.critical).toEqual(control.hit!.breakdown.critical);
    expect(withNeutralOne.hit!.amount).toBe(control.hit!.amount);
  });
});
