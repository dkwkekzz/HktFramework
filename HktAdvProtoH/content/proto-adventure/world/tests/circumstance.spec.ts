// C-COMBAT-003 능력의 성립 사정 World 단독 테스트
// RULE-ABILITY-REQUIREMENT-001(ADDED) · RULE-ABILITY-CONDITION-001(ADDED) ·
// RULE-SKILL-BEGIN-001(CHANGED) · RULE-SWING-STRIKE-001(CHANGED) ·
// RULE-STRIKE-DAMAGE-001(CHANGED)
//
// Implements INTENT-ABILITY-HAS-CIRCUMSTANCES-001 · INTENT-CIRCUMSTANCES-ARE-A-LIST-001 ·
//            INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001 ·
//            INTENT-REQUIREMENT-GATES-THE-ABILITY-001 · INTENT-REFUSAL-NAMES-THE-WORLD-001 ·
//            INTENT-ALLOCATION-OPENS-WHAT-IS-POSSIBLE-001 ·
//            INTENT-CONDITION-AMPLIFIES-WITHOUT-GATING-001 ·
//            INTENT-CONDITION-CHOOSES-THE-FORCE-001 ·
//            INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001 ·
//            INTENT-CONDITION-IN-THE-CAUSE-READING-001 ·
//            INTENT-CIRCUMSTANCES-ARE-OBSERVED-001 · INTENT-NO-CIRCUMSTANCE-NO-CHANGE-001 ·
//            INTENT-THE-GATE-DOES-NOT-ASK-WHO-DRIVES-001
//
// 기대값은 공식을 다시 계산하지 않고 **숫자로 박는다** — 구현을 구현으로 검사하지 않기
// 위해서다 (C015 가 세운 방식 그대로). 근거는 03-world-semantic.md 의 BALANCE 다.
//
// 기준 배치
//   관찰자 rabbit-swordsman  AuraAtk 40 · 오라 관통 60 · Hp 200 · Cp 100(시작 30)
//   자율 존재 wanderer       Resist 90 · Armor 30 · Hp 120 · 배분 balanced
//   걷힌 오라 방어            90 × 100/160 = 56.25 → 감쇄 0.64
//   hatsu 배분의 AuraAtk      40 + (4−2)×12 = 64

import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  ABILITY_ALLOCATION_REQUIREMENT,
  ABILITY_CIRCUMSTANCES,
  abilityCircumstance,
  circumstanceHolds,
  EMPTY_NOW,
} from '../semantic/circumstance';
import { forceOfSkill, SKILL_DEFINITIONS } from '../semantic/combat';
import { ALLOCATION_CATALOG } from '../semantic/allocation';
import { spawnActor } from '../semantic/spawn';
import { ruleAllocationSet } from '../rules/allocation-set';
import { metConditions, ruleAbilityCondition, ruleAbilityRequirement } from '../rules/ability-circumstance';
import { evaluateSkillPreconditions } from '../rules/skill';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, selectTarget, type WorldDriver } from './drive';

const HATSU = SKILL_DEFINITIONS['hatsu-burst'];
// 큰 기술과 같은 구간이다 — 선딜 0.5 를 지나야 판정이 열린다.
const AFTER_SWING_OPEN = HATSU.swingBegin * HATSU.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 64 };
const dummyAt = (x: number, z: number, perceptionRange = 0, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange,
  guardedGround: WHOLE_STAGE,
});

const skill = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);
/** 거절 사유 — 성공한 판정에는 없다 */
const failureReason = (result: ActionResult) =>
  result.status === 'failure' ? result.reason : undefined;
const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 표적 하나를 세우고 관찰자가 마주 보게 한 세계. 기력은 넉넉히 채워 둔다 */
const arena = (perceptionRange = 0) => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0, perceptionRange)] });
  aimRight(world);
  setAttribute(world, 'cp', 100);
  return world;
};

const body = (allocation?: 'hatsu' | 'reinforce') => {
  const actor = spawnActor({
    id: 'x',
    name: 'X',
    characterKind: 'rabbit-swordsman',
    control: 'player',
    position: { x: 0, z: 0 },
  });
  if (allocation) ruleAllocationSet(actor, allocation);
  return actor;
};

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CIRCUMSTANCES-ARE-A-LIST-001 — 사정은 목록이고 판정은 읽기만 한다', () => {
  it('세계가 아는 사정이 목록으로 있고 저마다 자기 사유 코드를 지닌다', () => {
    // C-COMBAT-004 — 항목이 둘 늘었다 (표식). **관문도 관찰도 열리지 않았다** —
    // 그것이 이 검사가 지키는 것이다.
    expect(ABILITY_CIRCUMSTANCES.map((c) => c.id)).toEqual([
      'power-in-ability',
      'struck-by-them',
      'life-below-half',
      'bears-my-mark',
      'no-mark-of-mine-yet',
    ]);
    expect(ABILITY_CIRCUMSTANCES.map((c) => c.unmetReason)).toEqual([
      'power-not-in-ability',
      'not-struck-by-them',
      'life-not-below-half',
      'no-mark-on-them',
      'already-marked-by-them',
    ]);
  });

  it('기술은 사정의 이름만 가리킨다 — 사정의 내용을 자기 안에 적지 않는다', () => {
    expect(HATSU.requires).toEqual(['power-in-ability']);
    expect(HATSU.amplifiedBy).toEqual([
      { circumstance: 'struck-by-them', attackRatioShare: 0.4 },
      { circumstance: 'life-below-half', attackRatioShare: 0.4 },
      // C-COMBAT-004 — 표식. **조건이지 요구가 아니다** (아래 회귀가 그것을 지킨다)
      { circumstance: 'bears-my-mark', attackRatioShare: 0.5 },
    ]);
  });

  it('세계가 모르는 이름은 찾을 수 없다 — 목록이 단일 출처다', () => {
    // @ts-expect-error 세계가 모르는 사정
    expect(() => abilityCircumstance('no-such-circumstance')).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-NO-CIRCUMSTANCE-NO-CHANGE-001 — 사정 없는 기술은 그대로다', () => {
  it('기존 세 기술은 사정을 하나도 지지 않는다', () => {
    for (const kind of ['attack', 'heavy-attack', 'aura-strike'] as const) {
      expect(SKILL_DEFINITIONS[kind].requires).toEqual([]);
      expect(SKILL_DEFINITIONS[kind].amplifiedBy).toEqual([]);
    }
  });

  it('빈 목록은 언제나 갖춰진 것이다 — 검사가 아니라 산술이다', () => {
    const balanced = body();
    for (const kind of ['attack', 'heavy-attack', 'aura-strike'] as const) {
      expect(ruleAbilityRequirement(balanced, kind, EMPTY_NOW)).toBeNull();
      expect(metConditions(balanced, null, kind, EMPTY_NOW)).toEqual([]);
    }
  });

  it('참인 사정이 없으면 위력 정의가 이 층 이전과 완전히 같다', () => {
    const basic = forceOfSkill('attack');
    expect(basic).toEqual({ baseDamage: 6, attackRatio: 0.5, damageType: 'physical' });
    expect(forceOfSkill('attack', 0)).toEqual(basic);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-REQUIREMENT-GATES-THE-ABILITY-001 — 갖춰지지 않으면 시작되지 않는다', () => {
  it('힘을 능력에 몰지 않은 몸에서는 나가지 않고, 사유가 세계의 사실을 가리킨다', () => {
    const world = arena();
    const result = world.dispatch({ interactionId: 'skill-hatsu' });
    expect(result.status).toBe('failure');
    expect(failureReason(result)).toBe('power-not-in-ability');
  });

  it('시작한 뒤 실패하는 것이 아니다 — 아무것도 소모되지 않고 행동도 그대로다', () => {
    const world = arena();
    const before = world.observe();
    const cpBefore = before.entities.find((e) => e.id === 'player-1')?.attributes?.energy;
    world.dispatch({ interactionId: 'skill-hatsu' });
    const after = world.observe();
    expect(after.entities.find((e) => e.id === 'player-1')?.attributes?.energy).toEqual(cpBefore);
    expect(after.entities.find((e) => e.id === 'player-1')?.state).toBe(
      before.entities.find((e) => e.id === 'player-1')?.state,
    );
  });

  it('사정이 대가보다 앞에 선다 — 기력도 배분도 모자라면 세계는 사정을 말한다', () => {
    const world = arena();
    setAttribute(world, 'cp', 0);
    const result = world.dispatch({ interactionId: 'skill-hatsu' });
    expect(failureReason(result)).toBe('power-not-in-ability');
  });

  it('사정을 갖춘 뒤에야 대가가 물어진다 — 그때의 사유는 기력이다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    setAttribute(world, 'cp', 0);
    const result = world.dispatch({ interactionId: 'skill-hatsu' });
    expect(failureReason(result)).toBe('insufficient-cp');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ALLOCATION-OPENS-WHAT-IS-POSSIBLE-001 — 배분이 목록을 여닫는다', () => {
  it('문턱을 넘는 배분은 지금 세계에 하나뿐이다', () => {
    const open = Object.entries(ALLOCATION_CATALOG)
      .filter(([, shares]) => shares.ability >= ABILITY_ALLOCATION_REQUIREMENT)
      .map(([id]) => id);
    expect(open).toEqual(['hatsu']);
  });

  it('배분을 옮기면 같은 기력으로 같은 기술이 나간다', () => {
    const world = arena();
    expect(world.dispatch({ interactionId: 'skill-hatsu' }).status).toBe('failure');
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    expect(world.dispatch({ interactionId: 'skill-hatsu' }).status).toBe('success');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001 — 조건이 사라지면 저절로 닫힌다', () => {
  it('열렸던 기술이 배분을 되돌리면 닫힌다 — 닫는 규칙이 세계에 없다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    expect(skill(world.observe(), 'skill-hatsu')?.available).toBe(true);

    world.dispatch({ interactionId: 'set-allocation', allocationId: 'balanced' });
    const closed = skill(world.observe(), 'skill-hatsu');
    expect(closed?.available).toBe(false);
    expect(closed?.reason).toBe('power-not-in-ability');
  });

  it('생명이 절반 아래인가는 지금의 값에서 매번 다시 센다', () => {
    const actor = body();
    expect(circumstanceHolds('life-below-half', actor, null, EMPTY_NOW)).toBe(false);
    actor.hp = actor.hpMax / 2;
    expect(circumstanceHolds('life-below-half', actor, null, EMPTY_NOW)).toBe(true);
    actor.hp = actor.hpMax;
    expect(circumstanceHolds('life-below-half', actor, null, EMPTY_NOW)).toBe(false);
  });

  it('그 상대가 나를 쳤는가는 세계가 이미 지닌 사실에서 읽는다 — 방향이 있다', () => {
    const self = body();
    const other = spawnActor({
      id: 'other',
      name: 'O',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 1, z: 0 },
    });
    const struckMe = { time: 0, strikeEvents: [{ attackerId: 'other', targetId: 'x' }] };
    const struckThem = { time: 0, strikeEvents: [{ attackerId: 'x', targetId: 'other' }] };

    expect(circumstanceHolds('struck-by-them', self, other, struckMe)).toBe(true);
    // 내가 친 것은 이 사정이 아니다 — (a,b) 와 (b,a) 는 다른 물음이다
    expect(circumstanceHolds('struck-by-them', self, other, struckThem)).toBe(false);
    // 그 사실이 세계에서 사라지면 사정도 거짓이 된다
    expect(circumstanceHolds('struck-by-them', self, other, EMPTY_NOW)).toBe(false);
  });

  it('관문 자리에는 상대가 없다 — 상대를 읽는 사정은 거기서 언제나 거짓이다', () => {
    const self = body();
    const now = { time: 0, strikeEvents: [{ attackerId: 'other', targetId: 'x' }] };
    expect(circumstanceHolds('struck-by-them', self, null, now)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CONDITION-AMPLIFIES-WITHOUT-GATING-001 — 조건은 막지 않는다', () => {
  it('조건이 하나도 참이 아니어도 그 기술은 나간다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    expect(world.dispatch({ interactionId: 'skill-hatsu' }).status).toBe('success');
  });

  it('조건 없이 친 한 방이 같은 배분의 큰 기술보다 크다 — 관문이 값을 낸다', () => {
    const plain = arena();
    plain.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    plain.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(plain, AFTER_SWING_OPEN);
    expect(plain.observe().strikes.at(-1)?.amount).toBe(60); // 10 + 64×1.3 = 93.2 → ×0.64

    const heavy = arena();
    heavy.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    heavy.dispatch({ interactionId: 'skill-heavy' });
    tickFor(heavy, AFTER_SWING_OPEN);
    expect(heavy.observe().strikes.at(-1)?.amount).toBe(49); // 32 + 32×1.0 = 64 → ×0.769
  });

  it('조건 하나가 참이면 그 한 방이 커진다 — 같은 기술 같은 기력이다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    setAttribute(world, 'hp', 100); // 200 의 절반 — life-below-half 가 참이 된다
    world.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(world, AFTER_SWING_OPEN);
    expect(world.observe().strikes.at(-1)?.amount).toBe(76); // 10 + 64×1.7 = 118.8 → ×0.64
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CONDITION-CHOOSES-THE-FORCE-001 — 조건이 고르는 것은 위력 정의다', () => {
  it('달라지는 것은 계수 하나다 — 기본 피해도 방식도 그대로다', () => {
    const plain = forceOfSkill('hatsu-burst');
    const amplified = forceOfSkill('hatsu-burst', 0.8);
    expect(plain).toEqual({ baseDamage: 10, attackRatio: 1.3, damageType: 'aura' });
    expect(amplified).toEqual({ baseDamage: 10, attackRatio: 2.1, damageType: 'aura' });
  });

  it('참인 조건이 없으면 사정을 모르던 때와 완전히 같은 위력이다', () => {
    const self = body('hatsu');
    const conditioned = ruleAbilityCondition(self, null, 'hatsu-burst', EMPTY_NOW);
    expect(conditioned.force).toEqual(forceOfSkill('hatsu-burst'));
    expect(conditioned.conditions).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001 — 사정마다 독립이다', () => {
  it('둘이 함께 참이어도 각자의 몫을 더한 것뿐이다 — 겹침의 규칙이 없다', () => {
    const self = body('hatsu');
    self.hp = self.hpMax / 2;
    const other = spawnActor({
      id: 'other',
      name: 'O',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 1, z: 0 },
    });
    const now = { time: 0, strikeEvents: [{ attackerId: 'other', targetId: 'x' }] };

    const both = ruleAbilityCondition(self, other, 'hatsu-burst', now);
    expect(both.conditions).toEqual([
      { id: 'struck-by-them', attackRatioShare: 0.4 },
      { id: 'life-below-half', attackRatioShare: 0.4 },
    ]);
    // 1.3 + 0.4 + 0.4 — 곱해지지도, 덤이 붙지도 않는다
    expect(both.force.attackRatio).toBeCloseTo(2.1, 10);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CONDITION-IN-THE-CAUSE-READING-001 — 강화가 경위에 실린다', () => {
  it('참인 조건과 그 몫이 한 방의 경위에 남는다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    setAttribute(world, 'hp', 100);
    world.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(world, AFTER_SWING_OPEN);

    const breakdown = world.observe().strikes.at(-1)!.breakdown;
    expect(breakdown.conditions).toEqual([{ id: 'life-below-half', bonus: 0.4 }]);
    // 되짚기가 성립한다 — 계수가 1.7 이어서 raw 가 118.8 이 되었다
    expect(breakdown.rawDamage).toBeCloseTo(118.8, 6);
    expect(breakdown.offenseStat).toMatchObject({ name: 'auraAttack', value: 64, fromAllocation: 24 });
  });

  it('참인 것이 없어도 빈 목록으로 실린다 — 아무것도 하지 않았다는 것도 관찰이다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);
    expect(world.observe().strikes.at(-1)!.breakdown.conditions).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CIRCUMSTANCES-ARE-OBSERVED-001 — 사정은 쓰기 전에 보인다', () => {
  it('갖춰지지 않은 기술도 목록에 남고 사유가 실린다', () => {
    const view = arena().observe();
    const hatsu = skill(view, 'skill-hatsu');
    expect(hatsu).toBeDefined();
    expect(hatsu?.available).toBe(false);
    expect(hatsu?.reason).toBe('power-not-in-ability');
  });

  it('요구와 조건이 다른 칸에 실린다 — 갖춰졌어도 무엇을 지는지가 보인다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    const profile = skill(world.observe(), 'skill-hatsu')?.profile;
    expect(profile?.requires).toEqual([
      { id: 'power-in-ability', met: true, reason: 'power-not-in-ability' },
    ]);
    expect(profile?.conditions).toEqual([
      { id: 'struck-by-them', holds: false, bonus: 0.4 },
      { id: 'life-below-half', holds: false, bonus: 0.4 },
      { id: 'bears-my-mark', holds: false, bonus: 0.5 }, // C-COMBAT-004
    ]);
  });

  it('조건이 참이 되면 쓰기 전에 그것이 보인다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    setAttribute(world, 'hp', 100);
    const conditions = skill(world.observe(), 'skill-hatsu')?.profile?.conditions;
    expect(conditions).toContainEqual({ id: 'life-below-half', holds: true, bonus: 0.4 });
  });

  it('상대를 읽는 조건은 고른 대상에 대한 답이다 — 아무도 고르지 않았으면 거짓이다', () => {
    // 스스로 다가와 치는 자율 존재를 세운다
    const world = arena(9);
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    tickFor(world, 3.0); // 자율 존재가 다가와 친다

    const struckMe = world
      .observe()
      .strikes.some((s) => s.attackerId === 'npc-1' && s.targetId === 'player-1');
    expect(struckMe).toBe(true);

    // 아직 아무도 고르지 않았다 — 세계는 누구에 대한 물음인지 모른다
    const before = skill(world.observe(), 'skill-hatsu')?.profile?.conditions;
    expect(before).toContainEqual({ id: 'struck-by-them', holds: false, bonus: 0.4 });

    // 그 상대를 고르면 참이 된다
    selectTarget(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    const after = skill(world.observe(), 'skill-hatsu')?.profile?.conditions;
    expect(after).toContainEqual({ id: 'struck-by-them', holds: true, bonus: 0.4 });
  });

  it('기존 세 기술의 사정 칸은 비어 있다', () => {
    const view = arena().observe();
    for (const id of ['attack', 'skill-heavy', 'skill-aura']) {
      expect(skill(view, id)?.profile?.requires).toEqual([]);
      expect(skill(view, id)?.profile?.conditions).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-GATE-DOES-NOT-ASK-WHO-DRIVES-001 — 관문은 조종 주체를 묻지 않는다', () => {
  it('스스로 판단하는 몸도 같은 관문을 같은 사유로 지난다', () => {
    const autonomous = spawnActor({
      id: 'npc-x',
      name: 'N',
      characterKind: 'rabbit-swordsman',
      control: 'autonomous',
      position: { x: 0, z: 0 },
    });
    expect(evaluateSkillPreconditions(autonomous, 'hatsu-burst')).toBe('power-not-in-ability');

    ruleAllocationSet(autonomous, 'hatsu');
    autonomous.cp = 100;
    expect(evaluateSkillPreconditions(autonomous, 'hatsu-burst')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('REGRESSION — 사정을 지지 않는 것은 한 톨도 달라지지 않는다', () => {
  it('기본 기술의 한 방이 그대로다 (C010 · C012)', () => {
    const world = arena();
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);
    expect(world.observe().strikes.at(-1)?.amount).toBe(20); // 26 × 100/130
  });

  it('배분을 한 번도 바꾸지 않은 몸에서 기존 셋이 전부 열려 있다', () => {
    const view = arena().observe();
    for (const id of ['attack', 'skill-heavy', 'skill-aura']) {
      expect(skill(view, id)?.available).toBe(true);
    }
  });

  it('새 기술의 닿는 길이가 몸의 교전 거리와 어긋나지 않는다 (RULE-ENGAGEMENT-REACHES-001)', () => {
    const reach = HATSU.swingReach;
    const tip = HATSU.swingTipRadius;
    expect(reach - tip).toBeLessThanOrEqual(2.0);
    expect(reach + tip).toBeGreaterThanOrEqual(2.0);
  });
});
