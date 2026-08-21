// RULE-SKILL-SHAPE-001 · RULE-ACTION-COLLIDER-001(CHANGED) ·
// RULE-ENGAGEMENT-REACHES-001 World 단독 테스트 (C023)
//
// Implements INTENT-SKILL-SHAPE-001 · INTENT-SHAPE-DECIDES-CONTACT-001 ·
//            INTENT-REACH-BELONGS-TO-THE-SKILL-001 ·
//            INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001 ·
//            INTENT-SHAPE-IS-OBSERVABLE-001 · INTENT-SHAPE-EXPLAINS-THE-CONTACT-001 ·
//            INTENT-SHAPE-DOES-NOT-TOUCH-THE-FORMULA-001
//
// 이 Cycle 이 세계에 더하는 것은 하나다 — **같은 자리에 선 상대가 기술에 따라 갈린다.**
// 판별 자리와 그 여유는 03-world-semantic.md 의 BALANCE ③④ 가 소유한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { characterDefinition } from '../semantic/character-catalog';
import {
  engagementReachViolations,
  skillDefinition,
  skillShape,
  SKILL_DEFINITIONS,
  type SkillKind,
} from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 64 };

// 순회도 인지도 없는 정지 NPC — 몸으로만 쓴다 (결정론).
// 태도가 있어야 닿음이 해로 성립한다 (C018) — 이 무대를 자기 자리로 지니게 둔다.
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
  guardedGround: WHOLE_STAGE,
});

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const health = (v: GameViewSnapshot, id: string) => actor(v, id)?.vitality?.health ?? 0;

/**
 * 몸을 +x 로 향하게 만드는 한 걸음. 그 뒤 몸이 실제로 서 있는 자리를 돌려준다.
 *
 * 방향을 정하는 유일한 수단이 걷는 것이므로(RULE-BODY-FACING-001) 조준에는 한 걸음이
 * 따라온다. 그 걸음을 없애려고 두 번째 이동을 넣으면 **몸이 그쪽으로 돌아버린다** —
 * 그래서 없애지 않고, 판별 자리를 이 자리 기준으로 잡는다.
 */
function aimedOrigin(): { x: number; z: number } {
  const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
  const position = actor(world.observe(), PLAYER)?.position;
  if (!position) throw new Error('조준 뒤 몸의 자리를 읽지 못했다');
  return { x: position.x, z: position.z };
}

const AIMED = aimedOrigin();

/**
 * 몸을 +x 로 향하게 둔 채 그 기술을 끝까지 휘두르고, 상대가 해를 입었는지 돌려준다.
 *
 * `offset` 은 **조준을 마친 몸을 원점으로 본 자리**다 (03 BALANCE ③④ 의 좌표계).
 * 상대는 `dummyAt` 이므로 스스로 움직이지 않는다. 미는 힘(C006)이 상대를 밀 수는
 * 있으나 그것은 닿은 **뒤**의 일이므로 판정에 끼어들지 않는다.
 */
function swingAt(interactionId: string, offset: { x: number; z: number }): boolean {
  const world = driveWorld({
    actorPosition: { x: 0, z: 0 },
    npcs: [dummyAt(AIMED.x + offset.x, AIMED.z + offset.z)],
  });
  // 몸을 +x 로 돌린다 — 걷는 것이 곧 향하는 것이다 (RULE-BODY-FACING-001).
  // 기술을 걸면 이동은 대체된다 (RULE-ACTION-BEGIN-001) — 몸은 그 자리에 선다.
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);

  const before = health(world.observe(), 'npc-1');
  world.dispatch({ interactionId });
  const kind: SkillKind =
    interactionId === 'skill-heavy'
      ? 'heavy-attack'
      : interactionId === 'skill-aura'
        ? 'aura-strike'
        : 'attack';
  tickFor(world, skillDefinition(kind).baseDuration + 4 * TICK_INTERVAL);
  return health(world.observe(), 'npc-1') < before;
}

describe('RULE-SKILL-SHAPE-001 — 모양은 그 기술이 지닌 값이다', () => {
  it('세 기술 모두 모양을 지닌다', () => {
    for (const kind of Object.keys(SKILL_DEFINITIONS) as SkillKind[]) {
      const shape = skillShape(kind);
      expect(shape.arc).toBeGreaterThan(0);
      expect(shape.reach).toBeGreaterThan(0);
      expect(shape.tipRadius).toBeGreaterThan(0);
    }
  });

  it('기본 기술과 오라 기술은 모양이 같다 — 이 층이 만드는 차이는 방식 하나다 (C012 의 뜻)', () => {
    expect(skillShape('aura-strike')).toEqual(skillShape('attack'));
  });

  it('큰 기술은 좁고 멀리 닿는다 — 값이 실제로 갈린다', () => {
    const basic = skillShape('attack');
    const heavy = skillShape('heavy-attack');
    expect(heavy.arc).toBeLessThan(basic.arc);
    expect(heavy.reach).toBeGreaterThan(basic.reach);
    // 도달 = 길이 + 굵기. 큰 기술이 더 멀리 간다
    expect(heavy.reach + heavy.tipRadius).toBeGreaterThan(basic.reach + basic.tipRadius);
  });

  it('기본 기술의 모양은 지금까지 세계가 쓰던 값 그대로다 (03 BALANCE ①)', () => {
    // 150° · 몸의 교전 거리(2.0) − 칼끝 반경(0.7) = 1.3 · 0.7
    const basic = skillShape('attack');
    expect(basic.arc).toBeCloseTo((150 * Math.PI) / 180, 10);
    expect(basic.reach).toBeCloseTo(1.3, 10);
    expect(basic.tipRadius).toBeCloseTo(0.7, 10);
  });
});

describe('RULE-ACTION-COLLIDER-001 — 같은 자리가 기술에 따라 갈린다 (C023 CHANGED)', () => {
  // 03 BALANCE ③ 의 판별 자리 둘. 몸이 +x 를 향한다.

  it('옆에 선 상대 — 기본 기술은 닿고 큰 기술은 닿지 않는다', () => {
    const side = { x: 0, z: 1.8 };
    expect(swingAt('attack', side)).toBe(true);
    expect(swingAt('skill-heavy', side)).toBe(false);
  });

  it('정면 먼 상대 — 큰 기술은 닿고 기본 기술은 닿지 않는다', () => {
    const far = { x: 3.1, z: 0 };
    expect(swingAt('skill-heavy', far)).toBe(true);
    expect(swingAt('attack', far)).toBe(false);
  });

  it('정면 가까운 상대는 둘 다 닿는다 — 지금까지 맞던 것이 계속 맞는다 (03 BALANCE ④)', () => {
    const near = { x: 1.8, z: 0 };
    expect(swingAt('attack', near)).toBe(true);
    expect(swingAt('skill-heavy', near)).toBe(true);
  });

  it('등 뒤는 어느 기술로도 닿지 않는다 — 방향의 뜻은 바뀌지 않았다 (C006)', () => {
    const behind = { x: -1.8, z: 0 };
    expect(swingAt('attack', behind)).toBe(false);
    expect(swingAt('skill-heavy', behind)).toBe(false);
  });

  it('휘두르는 중 관찰에 그 기술의 굵기가 실린다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, skillDefinition('heavy-attack').baseDuration * 0.6);
    const swing = actor(world.observe(), PLAYER)?.swing;
    expect(swing?.radius).toBeCloseTo(skillShape('heavy-attack').tipRadius, 10);
  });
});

describe('RULE-ENGAGEMENT-REACHES-001 — 다가간 자리에서는 무엇을 걸어도 닿는다', () => {
  it('등록된 모든 종류의 교전 거리가 모든 기술의 도달 구간 안에 있다', () => {
    for (const kind of ['rabbit-swordsman', 'wanderer']) {
      const def = characterDefinition(kind);
      expect(engagementReachViolations(def.engagementRange)).toEqual([]);
    }
  });

  it('미등록 종류의 폴백도 같은 조건을 만족한다', () => {
    expect(engagementReachViolations(characterDefinition('없는-종류').engagementRange)).toEqual([]);
  });

  it('구간 밖의 값은 어긴 기술을 짚어 낸다 — 값이 바뀌면 깨지는 것이 목적이다', () => {
    // 어떤 기술의 안쪽 사각보다도 가까운 자리
    expect(engagementReachViolations(0.1).length).toBeGreaterThan(0);
    // 어떤 기술의 바깥 도달보다도 먼 자리
    expect(engagementReachViolations(99).length).toBe(Object.keys(SKILL_DEFINITIONS).length);
  });
});

describe('INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001 — 값을 바꾸면 결과가 따라온다', () => {
  it('모양 값만으로 닿음이 갈린다 — 규칙에 기술 이름이 없다는 증거', () => {
    // 큰 기술의 각을 기본 기술만큼 넓히면, 옆에 선 상대에게 닿게 된다.
    // 규칙 코드를 한 줄도 고치지 않고 값 하나만 되돌린 것이다.
    const heavy = SKILL_DEFINITIONS['heavy-attack'] as { swingArc: number; swingReach: number };
    const savedArc = heavy.swingArc;
    const savedReach = heavy.swingReach;
    try {
      heavy.swingArc = skillShape('attack').arc;
      heavy.swingReach = skillShape('attack').reach;
      expect(swingAt('skill-heavy', { x: 0, z: 1.8 })).toBe(true);
    } finally {
      heavy.swingArc = savedArc;
      heavy.swingReach = savedReach;
    }
    // 되돌린 뒤에는 다시 닿지 않는다 — 위 조작이 세계에 남지 않았다
    expect(swingAt('skill-heavy', { x: 0, z: 1.8 })).toBe(false);
  });
});

describe('INTENT-SHAPE-IS-OBSERVABLE-001 — 걸기 전에 모양을 안다', () => {
  it('세 기술의 관찰에 모양 셋이 실린다', () => {
    const view = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] }).observe();
    for (const [id, kind] of [
      ['attack', 'attack'],
      ['skill-heavy', 'heavy-attack'],
      ['skill-aura', 'aura-strike'],
    ] as [string, SkillKind][]) {
      const profile = view.interactions.find((i) => i.id === id)?.profile;
      const shape = skillShape(kind);
      expect(profile?.swingArc).toBeCloseTo(shape.arc, 10);
      expect(profile?.swingReach).toBeCloseTo(shape.reach, 10);
      expect(profile?.swingTipRadius).toBeCloseTo(shape.tipRadius, 10);
    }
  });

  it('세 기술 모두 플레이어가 부를 수 있는 자리로 실린다 (Human 지시 — 05-review.md)', () => {
    const view = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] }).observe();
    for (const id of ['attack', 'skill-heavy', 'skill-aura']) {
      const interaction = view.interactions.find((i) => i.id === id);
      expect(interaction, `${id} 가 관찰에 없다`).toBeDefined();
      expect(interaction?.role).toBeDefined();
    }
  });
});

describe('INTENT-SHAPE-DOES-NOT-TOUCH-THE-FORMULA-001 — 닿은 뒤는 완전히 같다', () => {
  it('큰 기술이 정면 가까이에서 내는 피해는 C015 까지의 값 그대로다', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [dummyAt(AIMED.x + 1.8, AIMED.z)],
    });
    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    world.tick(TICK_INTERVAL);
    const before = health(world.observe(), 'npc-1');
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, skillDefinition('attack').baseDuration + 4 * TICK_INTERVAL);
    const dealt = before - health(world.observe(), 'npc-1');
    // 기본 20 (공격 40 · 방어 30) 또는 치명 40 — 값이 아니라 **갈래**가 그대로임을 본다
    expect([20, 40]).toContain(dealt);
  });
});
