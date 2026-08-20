// C012 Damage Type World 단독 테스트
// RULE-DAMAGE-CALCULATE-001(CHANGED) · RULE-ATTRIBUTE-SET-001(AFFECTED)
//
// Implements INTENT-DAMAGE-TYPE-001 · INTENT-AURA-SKILL-001 · INTENT-TYPED-OFFENSE-001 ·
//            INTENT-TYPED-DEFENSE-001 · INTENT-DAMAGE-CALCULATE-001 ·
//            INTENT-DAMAGE-BREAKDOWN-001 · INTENT-DAMAGE-TYPE-OBSERVE-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치
//   관찰자 rabbit-swordsman  PhysicalAttack 40 · AuraAttack 40 · Armor 50 · Resistance 20
//   자율 존재 wanderer       PhysicalAttack 40 · AuraAttack 15 · Armor 30 · Resistance 90

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../semantic/collision';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { ruleGuardBlock } from '../rules/guard';
import { spawnActor } from '../semantic/spawn';
import { observeFully, driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AURA = SKILL_DEFINITIONS['aura-strike'];
const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

// C018 CHANGED — 태도가 없으면 닿아도 아무 일이 일어나지 않는다 (RULE-HARM-GATE-001).
// 그래서 전투를 보는 시나리오의 상대는 **이 무대를 자기 자리로 지니는 존재**로 세운다.
// 세계를 약하게 만드는 것이 아니라, 지금까지 말하지 않고 전제해 온 것(칠 수 있는 사이다)을
// 시나리오가 드러내 적는 것이다. perceptionRange 0 이므로 쫓아오지는 않는다.
const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 64 };

const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
  guardedGround: WHOLE_STAGE,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const skill = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 관찰자가 npc-1 을 한 스킬로 한 번 때린 세계 */
const strikeWith = (interactionId: string, setup: (world: WorldDriver) => void = () => {}) => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
  aimRight(world);
  // C013 — 이 층(Damage Type)의 기준값은 **관통이 없는 조합**이다.
  // C013 이 관찰자에게 오라 관통을 주었으므로 여기서 0 으로 되돌린다.
  // 각 층은 위층 없이도 그대로 서 있어야 한다 (DC-COMBAT-ONE-LAYER-AT-A-TIME).
  setAttribute(world, 'armorPenetration', 0);
  setAttribute(world, 'resistancePenetration', 0);
  setup(world);
  world.dispatch({ interactionId });
  tickFor(world, AFTER_SWING_OPEN);
  return world;
};

describe('INTENT-DAMAGE-TYPE-001 — 스킬이 자기 피해 방식을 지닌다', () => {
  it('방식은 둘뿐이고 모든 피해 스킬이 정확히 하나를 가진다', () => {
    const types = Object.values(SKILL_DEFINITIONS).map((s) => s.damageType);
    expect(types.every((t) => t === 'physical' || t === 'aura')).toBe(true);
    expect(new Set(types)).toEqual(new Set(['physical', 'aura']));
  });

  it('기존 두 스킬은 이행 규칙대로 물리다 (설계 §9)', () => {
    expect(SKILL_DEFINITIONS.attack.damageType).toBe('physical');
    expect(SKILL_DEFINITIONS['heavy-attack'].damageType).toBe('physical');
  });

  it('방식은 스킬이 지닌 성질이다 — 어떤 Actor 도 방식을 갖지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1'); // C014 — 남의 겨루는 힘은 살펴본 뒤에 실린다
    const view = world.observe();
    const attributes = actor(view, PLAYER)?.attributes as unknown as Record<string, unknown>;
    expect(attributes.damageType).toBeUndefined();
    // 모든 Actor 는 네 능력을 **모두** 지닌다 — 물리 존재도 오라 존재도 없다
    expect(actor(view, 'npc-1')?.attributes?.combatStats?.auraAttack).toBeTypeOf('number');
    expect(actor(view, 'npc-1')?.attributes?.combatStats?.armor).toBeTypeOf('number');
  });
});

describe('INTENT-AURA-SKILL-001 — 오라 방식 스킬이 세계에 있다', () => {
  it('기본 스킬과 모든 값이 같고 방식만 다르다', () => {
    expect(AURA.baseDamage).toBe(BASIC.baseDamage);
    expect(AURA.attackRatio).toBe(BASIC.attackRatio);
    expect(AURA.cpCharge).toBe(BASIC.cpCharge);
    expect(AURA.cpCost).toBe(BASIC.cpCost);
    expect(AURA.baseDuration).toBe(BASIC.baseDuration);
    expect(AURA.damageType).not.toBe(BASIC.damageType);
  });

  it('세계가 표면 목록에 싣고 사유 목록이 기존 스킬과 같다', () => {
    const view = driveWorld({ npcs: [] }).observe();
    const aura = skill(view, 'skill-aura');
    expect(aura?.role).toBe('skill-aura');
    expect(aura?.available).toBe(true);
    expect(aura?.profile?.damageType).toBe('aura');
  });

  it('막는 중에는 시작되지 않는다 — 기존 관문을 그대로 지난다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatch({ interactionId: 'guard-begin' });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'skill-aura' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-SKILL-BEGIN-001',
      reason: 'guarding',
    });
    expect(skill(world.observe(), 'skill-aura')?.reason).toBe('guarding');
  });

  it('기력 수지도 기본 스킬과 같다 — 맞히면 충전만 한다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    const before = hud(world.observe(), 'self.cp') as number;

    world.dispatch({ interactionId: 'skill-aura' });
    tickFor(world, AFTER_SWING_OPEN);

    expect(hud(world.observe(), 'self.cp')).toBe(before + AURA.cpCharge);
  });
});

describe('INTENT-TYPED-OFFENSE-001 / INTENT-TYPED-DEFENSE-001 — 능력이 둘로 갈린다', () => {
  it('물리 스킬은 물리 공격력과 물리 방어만 읽는다', () => {
    const base = strikeWith('attack').observe().strikes[0]?.amount;

    // 오라 쪽 값을 아무리 흔들어도 물리 타격은 한 톨도 달라지지 않는다
    const auraMoved = strikeWith('attack', (w) => {
      setAttribute(w, 'auraAttack', 100000);
      setAttribute(w, 'resistance', 0, 'npc-1');
    })
      .observe()
      .strikes[0]?.amount;

    expect(base).toBe(20);
    expect(auraMoved).toBe(20);
  });

  it('오라 스킬은 오라 공격력과 오라 방어만 읽는다', () => {
    const base = strikeWith('skill-aura').observe().strikes[0]?.amount;

    const physicalMoved = strikeWith('skill-aura', (w) => {
      setAttribute(w, 'physicalAttack', 100000);
      setAttribute(w, 'armor', 0, 'npc-1');
    })
      .observe()
      .strikes[0]?.amount;

    // (6 + 40×0.5) × 100/190 = 13.68 → 14
    expect(base).toBe(14);
    expect(physicalMoved).toBe(14);
  });

  it('두 방어 모두 줄일 뿐 없애지 못한다 — 하한 1', () => {
    const wall = strikeWith('skill-aura', (w) => setAttribute(w, 'resistance', 100000, 'npc-1'));
    expect(wall.observe().strikes[0]?.amount).toBe(1);
  });

  it('두 방어가 같은 감쇄식을 쓴다 — 방식마다 다른 공식은 없다', () => {
    // 같은 값(0)으로 맞추면 두 방식의 결과가 같아진다.
    // 공격 능력도 관찰자는 둘 다 40 이므로 남는 차이가 없다.
    const physical = strikeWith('attack', (w) => setAttribute(w, 'armor', 77, 'npc-1'));
    const aura = strikeWith('skill-aura', (w) => setAttribute(w, 'resistance', 77, 'npc-1'));
    expect(physical.observe().strikes[0]?.amount).toBe(aura.observe().strikes[0]?.amount);
  });
});

describe('INTENT-DAMAGE-CALCULATE-001 (CHANGED) — 하나의 계산, 고른 입력', () => {
  it('C010 의 물리 피해값이 한 값도 움직이지 않았다 (설계 수용 기준 §14-8)', () => {
    expect(strikeWith('attack').observe().strikes[0]?.amount).toBe(20);

    const heavy = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(heavy);
    heavy.dispatch({ interactionId: 'skill-heavy' });
    tickFor(heavy, SWING_BEGIN * SKILL_DEFINITIONS['heavy-attack'].baseDuration + 2 * TICK_INTERVAL);
    expect(heavy.observe().strikes[0]?.amount).toBe(55);
  });

  it('상대가 누구냐에 따라 답이 뒤집힌다 — 이 층이 만든 선택', () => {
    // wanderer (Armor 30 · Resistance 90) — 물리가 낫다
    expect(strikeWith('attack').observe().strikes[0]?.amount).toBe(20);
    expect(strikeWith('skill-aura').observe().strikes[0]?.amount).toBe(14);

    // 같은 상대를 rabbit-swordsman 의 방어 분포로 바꾸면 (Armor 50 · Resistance 20)
    const asSwordsman = (world: WorldDriver) => {
      setAttribute(world, 'armor', 50, 'npc-1');
      setAttribute(world, 'resistance', 20, 'npc-1');
    };
    // (6 + 20) × 100/150 = 17.33 → 17
    expect(strikeWith('attack', asSwordsman).observe().strikes[0]?.amount).toBe(17);
    // (6 + 20) × 100/120 = 21.67 → 22
    expect(strikeWith('skill-aura', asSwordsman).observe().strikes[0]?.amount).toBe(22);
  });

  it('방식이 배율을 더하거나 빼지 않는다 — 차이는 고른 값에서만 나온다', () => {
    // 두 방어를 같게 맞추면 남는 차이는 공격 능력뿐이다.
    // 관찰자는 물리·오라 공격력이 모두 40 이므로 결과가 완전히 같아야 한다 —
    // 타입 보너스가 숨어 있다면 여기서 갈린다.
    const evenDefense = (world: WorldDriver) => {
      setAttribute(world, 'armor', 40, 'npc-1');
      setAttribute(world, 'resistance', 40, 'npc-1');
    };
    const p = strikeWith('attack', evenDefense).observe().strikes[0];
    const a = strikeWith('skill-aura', evenDefense).observe().strikes[0];

    expect(p?.amount).toBe(a?.amount);
    expect(p?.breakdown.rawDamage).toBe(a?.breakdown.rawDamage);
    expect(p?.breakdown.defenseMultiplier).toBe(a?.breakdown.defenseMultiplier);
    // 다른 것은 무엇을 읽었는지뿐이다
    expect(p?.breakdown.damageType).toBe('physical');
    expect(a?.breakdown.damageType).toBe('aura');
  });

  it('우연이 없다 — 같은 입력을 세 번 돌려도 같다', () => {
    const once = () => strikeWith('skill-aura').observe().strikes[0]?.amount;
    expect(once()).toBe(14);
    expect(once()).toBe(14);
    expect(once()).toBe(14);
  });

  it('오라 방어는 확률이 아니다 — 값을 올리면 언제나 같은 정도로 줄어든다', () => {
    const at = (resistance: number) =>
      strikeWith('skill-aura', (w) => setAttribute(w, 'resistance', resistance, 'npc-1'))
        .observe()
        .strikes[0]?.amount ?? 0;

    // 어떤 타격도 통과하거나 빗나가지 않는다 — 매번 같은 값이다
    expect(at(0)).toBe(26);
    expect(at(0)).toBe(26);
    expect(at(100)).toBe(13);
    // 그리고 체감식이다 — 같은 만큼 올려도 줄어드는 폭이 작아진다
    expect(at(0) - at(100)).toBeGreaterThan(at(100) - at(200));
  });
});

describe('INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) — 무엇을 골랐는지가 실린다', () => {
  it('물리 타격의 경위', () => {
    expect(strikeWith('attack').observe().strikes[0]?.breakdown).toEqual({
      damageType: 'physical',
      offenseStat: { name: 'physicalAttack', value: 40 },
      baseDamage: 6,
      attackContribution: 20,
      rawDamage: 26,
      defenseStat: { name: 'armor', value: 30 },
      // C013 — 치는 쪽에 관통이 없다. 걷히기 전과 걷힌 뒤가 같다
      penetrationStat: { name: 'armorPenetration', value: 0 },
      effectiveDefense: 30,
      defenseMultiplier: 100 / 130,
      finalDamage: 20,
      // C015 — 터지지 않은 타격. 커지기 전과 커진 뒤가 같다
      critical: { occurred: false, chance: 0.25, multiplier: 2, damageBeforeCritical: 20 },
      appliedDamage: 20,
    });
  });

  it('오라 타격의 경위 — 같은 스킬 값에 다른 방어를 읽었다', () => {
    expect(strikeWith('skill-aura').observe().strikes[0]?.breakdown).toEqual({
      damageType: 'aura',
      offenseStat: { name: 'auraAttack', value: 40 },
      baseDamage: 6,
      attackContribution: 20,
      rawDamage: 26,
      defenseStat: { name: 'resistance', value: 90 },
      // C013 — 오라 쪽 관통도 없다. 방식이 고른 쪽의 관통만 실린다
      penetrationStat: { name: 'resistancePenetration', value: 0 },
      effectiveDefense: 90,
      defenseMultiplier: 100 / 190,
      finalDamage: 14,
      // C015 — 터지지 않은 타격. 방식이 판정을 바꾸지 않는다 (물리와 같은 chance 다)
      critical: { occurred: false, chance: 0.25, multiplier: 2, damageBeforeCritical: 14 },
      appliedDamage: 14,
    });
  });

  it('옛 이름 targetDefense 는 남지 않는다 — 별칭을 두지 않는다', () => {
    const breakdown = strikeWith('attack').observe().strikes[0]?.breakdown as unknown as Record<
      string,
      unknown
    >;
    expect(breakdown.targetDefense).toBeUndefined();
  });
});

describe('INTENT-DAMAGE-TYPE-OBSERVE-001 — 고를 근거가 보인다', () => {
  it('네 능력과 두 배율이 모든 존재에 실린다 (C014 — 살펴본 뒤)', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats).toEqual({
      physicalAttack: 40,
      auraAttack: 15,
      armor: 30,
      resistance: 90,
      armorPenetration: 0, // C013 — wanderer 는 관통을 지니지 않는다
      resistancePenetration: 0,
      armorMultiplier: 100 / 130,
      resistanceMultiplier: 100 / 190,
      // C015 — wanderer 는 터뜨리지 못한다. 그래서 관찰자가 맞는 값은 흔들리지 않는다
      criticalChance: 0,
      criticalDamage: 1,
    });
  });

  it('어느 쪽이 단단한지를 세계가 판정한다 (C014 — 남은 살펴본 뒤 · 자기는 언제나)', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    const view = world.observe();
    // wanderer — 오라 쪽(90)이 물리 쪽(30)보다 단단하다
    expect(actor(view, 'npc-1')?.attributes?.defenseShape).toBe('aura-tougher');
    // rabbit-swordsman — 물리 쪽(50)이 오라 쪽(20)보다 단단하다
    expect(actor(view, PLAYER)?.attributes?.defenseShape).toBe('physical-tougher');
    expect(hud(view, 'self.combat.defenseShape')).toBe('physical-tougher');
  });

  it('약점은 고정된 성질이 아니라 값의 관계다 — 바꾸면 판정이 따라 바뀐다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1'); // C014
    setAttribute(world, 'resistance', 10, 'npc-1'); // 30 > 10
    world.tick(TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.attributes?.defenseShape).toBe('physical-tougher');

    setAttribute(world, 'resistance', 30, 'npc-1'); // 30 === 30
    world.tick(TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.attributes?.defenseShape).toBe('even');
  });

  it('각 스킬의 방식이 표면에 실린다 — View 가 짐작하지 않는다', () => {
    const view = driveWorld({ npcs: [] }).observe();
    expect(skill(view, 'attack')?.profile?.damageType).toBe('physical');
    expect(skill(view, 'skill-heavy')?.profile?.damageType).toBe('physical');
    expect(skill(view, 'skill-aura')?.profile?.damageType).toBe('aura');
  });

  it('스킬 profile 의 rawDamage 는 그 방식에 대응하는 내 공격 능력으로 계산된다', () => {
    const world = driveWorld({ npcs: [] });
    setAttribute(world, 'auraAttack', 100);
    world.tick(TICK_INTERVAL);

    const view = world.observe();
    expect(skill(view, 'attack')?.profile?.rawDamage).toBe(26); // 6 + 40×0.5 — 그대로
    expect(skill(view, 'skill-aura')?.profile?.rawDamage).toBe(56); // 6 + 100×0.5
  });
});

describe('REGRESSION — 막기는 방식을 읽지 않는다 (C011)', () => {
  // RULE-GUARD-BLOCK-001 은 finalDamage 하나만 받는다 — 방식을 알 방법이 없다.
  // 그것이 이 층의 경계다 (설계 §15 — 능동 방어의 타입별 효율은 이 문서가 정하지 않는다).
  it('같은 finalDamage 면 방식이 달라도 막기 결과가 완전히 같다', () => {
    const guardingActor = () => {
      const actor = spawnActor({
        id: 'g',
        name: 'G',
        characterKind: 'rabbit-swordsman',
        control: 'player',
        position: { x: 0, z: 0 },
      });
      actor.guarding = true;
      return actor;
    };
    const attacker = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 0, z: 1 }, // 막는 몸의 정면 (facing 은 +z)
    });

    const physical = ruleGuardBlock(guardingActor(), attacker, 17, 0);
    const aura = ruleGuardBlock(guardingActor(), attacker, 17, 0);

    expect(physical).toEqual(aura);
    expect(physical.appliedDamage).toBe(9); // round(17 × 0.5)
    expect(physical.outcome?.cpPaid).toBe(11); // ceil(17 × 0.6)
  });

  it('막힌 오라 타격에도 guard 자리가 C011 과 같은 형태로 남는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'skill-aura' });
    tickFor(world, AFTER_SWING_OPEN);

    const breakdown = world.observe().strikes[0]?.breakdown;
    // 막지 않은 타격이므로 guard 는 실리지 않는다 — C010·C011 과 완전히 같다
    expect(breakdown?.guard).toBeUndefined();
    expect(breakdown?.appliedDamage).toBe(breakdown?.finalDamage);
  });
});
