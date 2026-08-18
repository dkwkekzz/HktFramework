// C013 Penetration World 단독 테스트
// RULE-DAMAGE-CALCULATE-001(CHANGED) · RULE-ATTRIBUTE-SET-001(CHANGED)
//
// Implements INTENT-PENETRATION-001 · INTENT-PENETRATION-MATCH-001 ·
//            INTENT-EFFECTIVE-DEFENSE-001 · INTENT-DAMAGE-CALCULATE-001 ·
//            INTENT-DAMAGE-BREAKDOWN-001 · INTENT-PENETRATION-OBSERVE-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치
//   관찰자 rabbit-swordsman  PhysAtk 40 · AuraAtk 40 · Armor 50 · Resist 20 · 관통 0 / 0
//   자율 존재 wanderer       PhysAtk 40 · AuraAtk 15 · Armor 30 · Resist 90 · 관통 60 / 0

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../semantic/collision';
import { effectiveDefense, penetrationRemainingRatio, SKILL_DEFINITIONS } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { ruleDamageCalculate } from '../rules/damage-calculate';
import { spawnActor } from '../semantic/spawn';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 관찰자가 npc-1 을 한 번 때린 세계 */
const strikeWith = (interactionId: string, setup: (world: WorldDriver) => void = () => {}) => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
  aimRight(world);
  setup(world);
  world.dispatch({ interactionId });
  tickFor(world, AFTER_SWING_OPEN);
  return world;
};

/** 계산만 떼어 본다 — 두 몸을 세우고 한 방의 경위를 받는다 */
const breakdownOf = (
  attackerKind: string,
  targetKind: string,
  skill: 'attack' | 'heavy-attack' | 'aura-strike' = 'attack',
  mutate: (attacker: ReturnType<typeof spawnActor>, target: ReturnType<typeof spawnActor>) => void =
    () => {},
) => {
  const attacker = spawnActor({
    id: 'a',
    name: 'A',
    characterKind: attackerKind,
    control: 'player',
    position: { x: 0, z: 0 },
  });
  const target = spawnActor({
    id: 't',
    name: 'T',
    characterKind: targetKind,
    control: 'autonomous',
    position: { x: 1, z: 0 },
  });
  mutate(attacker, target);
  return ruleDamageCalculate(attacker, target, skill);
};

describe('INTENT-PENETRATION-001 — 관통은 존재가 지니는 능력이다', () => {
  it('모든 존재가 자기 종류의 관통 둘을 갖고 시작한다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    // rabbit-swordsman — 관통을 지니지 않는다
    expect(actor(view, PLAYER)?.attributes?.combatStats.armorPenetration).toBe(0);
    expect(actor(view, PLAYER)?.attributes?.combatStats.resistancePenetration).toBe(0);
    // wanderer — 갑주만 깎을 수 있다
    expect(actor(view, 'npc-1')?.attributes?.combatStats.armorPenetration).toBe(60);
    expect(actor(view, 'npc-1')?.attributes?.combatStats.resistancePenetration).toBe(0);
  });

  it('관통은 그 자체로 아무것도 일으키지 않는다 — 공격 피해를 한 톨도 키우지 않는다', () => {
    const without = breakdownOf('rabbit-swordsman', 'wanderer');
    const with60 = breakdownOf('rabbit-swordsman', 'wanderer', 'attack', (attacker) => {
      attacker.armorPenetration = 60;
    });

    expect(without.rawDamage).toBe(26);
    expect(with60.rawDamage).toBe(26); // 관통이 있어도 공격 피해는 같다
    expect(with60.attackContribution).toBe(without.attackContribution);
    expect(with60.offenseStat).toEqual(without.offenseStat);
  });

  it('"관통이 없다" 는 별도 상태가 아니라 값 0 이다', () => {
    const zero = breakdownOf('rabbit-swordsman', 'wanderer');
    expect(zero.penetrationStat).toEqual({ name: 'armorPenetration', value: 0 });
    expect(zero.effectiveDefense).toBe(zero.defenseStat.value);
  });
});

describe('INTENT-PENETRATION-MATCH-001 — 방식이 고른 쪽 관통만 작용한다', () => {
  it('물리 타격은 물리 관통만 읽는다 — 오라 관통이 아무리 높아도 달라지지 않는다', () => {
    const base = breakdownOf('rabbit-swordsman', 'wanderer');
    const auraPen = breakdownOf('rabbit-swordsman', 'wanderer', 'attack', (attacker) => {
      attacker.resistancePenetration = 100000;
    });

    expect(auraPen.finalDamage).toBe(base.finalDamage);
    expect(auraPen.penetrationStat).toEqual({ name: 'armorPenetration', value: 0 });
  });

  it('오라 타격은 오라 관통만 읽는다', () => {
    const base = breakdownOf('rabbit-swordsman', 'wanderer', 'aura-strike');
    const armorPen = breakdownOf('rabbit-swordsman', 'wanderer', 'aura-strike', (attacker) => {
      attacker.armorPenetration = 100000;
    });

    expect(armorPen.finalDamage).toBe(base.finalDamage);
    expect(armorPen.penetrationStat).toEqual({ name: 'resistancePenetration', value: 0 });
  });

  it('관통은 그 타격의 방식을 바꾸지 못한다', () => {
    const pierced = breakdownOf('rabbit-swordsman', 'wanderer', 'attack', (attacker) => {
      attacker.armorPenetration = 60;
    });
    expect(pierced.damageType).toBe('physical');
    expect(pierced.defenseStat.name).toBe('armor');
    expect(pierced.offenseStat.name).toBe('physicalAttack');
  });
});

describe('INTENT-EFFECTIVE-DEFENSE-001 — 마주한 방어가 몫만큼 걷힌다', () => {
  it('걷히는 것은 정해진 양이 아니라 몫이다', () => {
    // 남는 비율 = 100/(100+관통). 관통 60 이면 62.5% 가 남는다
    expect(penetrationRemainingRatio(0)).toBe(1);
    expect(penetrationRemainingRatio(60)).toBe(0.625);
    expect(penetrationRemainingRatio(100)).toBe(0.5);
    expect(penetrationRemainingRatio(300)).toBe(0.25);

    // 같은 관통이라도 두꺼운 방어에서 더 많이 걷힌다
    expect(effectiveDefense(50, 60)).toBe(31.25); // 18.75 걷혔다
    expect(effectiveDefense(30, 60)).toBe(18.75); // 11.25 걷혔다
    expect(50 - effectiveDefense(50, 60)).toBeGreaterThan(30 - effectiveDefense(30, 60));
  });

  it('방어가 없는 상대에게서는 걷어낼 것이 없다', () => {
    const soft = breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (_a, target) => {
      target.armor = 0;
    });
    const softNoPen = breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (attacker, target) => {
      attacker.armorPenetration = 0;
      target.armor = 0;
    });

    expect(soft.penetrationStat.value).toBe(60); // 관통은 있다
    expect(soft.effectiveDefense).toBe(0); // 그런데 걷을 것이 없다
    expect(soft.finalDamage).toBe(softNoPen.finalDamage); // 결과가 완전히 같다
    expect(soft.finalDamage).toBe(26);
  });

  it('걷어낼 몫에는 끝이 있다 — 방어가 통째로 사라지지 않는다', () => {
    const extreme = breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (attacker) => {
      attacker.armorPenetration = 100000;
    });
    expect(extreme.effectiveDefense).toBeGreaterThan(0);
    expect(penetrationRemainingRatio(100000)).toBeGreaterThan(0);
  });

  it('양의 공격 피해는 방어가 아무리 높아도 최소 1 이 들어간다 (C010 REUSED)', () => {
    const wall = breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (_a, target) => {
      target.armor = 100000;
    });
    expect(wall.finalDamage).toBe(1);
  });

  it('걷힘은 그 한 번의 타격 안에서만 일어난다 — 맞는 자의 방어는 줄지 않는다', () => {
    const attacker = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'wanderer',
      control: 'player',
      position: { x: 0, z: 0 },
    });
    const target = spawnActor({
      id: 't',
      name: 'T',
      characterKind: 'rabbit-swordsman',
      control: 'autonomous',
      position: { x: 1, z: 0 },
    });

    const first = ruleDamageCalculate(attacker, target, 'attack');
    expect(target.armor).toBe(50); // 계산이 상태를 바꾸지 않았다
    const second = ruleDamageCalculate(attacker, target, 'attack');
    expect(second).toEqual(first); // 다음 타격도 온전한 방어를 마주한다
  });
});

describe('INTENT-DAMAGE-CALCULATE-001 (CHANGED) — 걷힌 방어가 계산에 들어간다', () => {
  it('같은 상대·같은 스킬·같은 공격 능력인데 관통을 지닌 쪽이 더 큰 피해를 넣는다', () => {
    // 둘 다 PhysicalAttack 40 → raw 26. 대상은 rabbit-swordsman (Armor 50)
    const noPen = breakdownOf('rabbit-swordsman', 'rabbit-swordsman');
    const withPen = breakdownOf('wanderer', 'rabbit-swordsman');

    expect(noPen.rawDamage).toBe(26);
    expect(withPen.rawDamage).toBe(26); // 때리는 힘은 같다
    expect(noPen.finalDamage).toBe(17);
    expect(withPen.finalDamage).toBe(20); // 다른 것은 관통뿐이다
  });

  it('두껍게 굳힌 상대일수록 관통의 몫이 커지고 무른 상대에게는 거의 달라지지 않는다', () => {
    const at = (armorValue: number, penetration: number) =>
      breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (attacker, target) => {
        attacker.armorPenetration = penetration;
        target.armor = armorValue;
      }).finalDamage;

    expect(at(0, 60) - at(0, 0)).toBe(0); // 무른 상대 — 아무 일도 없다
    expect(at(30, 60) - at(30, 0)).toBe(2);
    expect(at(50, 60) - at(50, 0)).toBe(3);

    // 걷어낸 방어의 양은 방어가 두꺼울수록 크다
    const worn = (armorValue: number) => {
      const b = breakdownOf('wanderer', 'rabbit-swordsman', 'attack', (_a, target) => {
        target.armor = armorValue;
      });
      return b.defenseStat.value - b.effectiveDefense;
    };
    expect(worn(0)).toBe(0);
    expect(worn(30)).toBe(11.25);
    expect(worn(50)).toBe(18.75);
    expect(worn(300)).toBe(112.5);
  });

  it('우연이 개입하지 않는다 — 같은 상태면 언제나 같은 값이다', () => {
    const runs = Array.from({ length: 5 }, () => breakdownOf('wanderer', 'rabbit-swordsman'));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it('감쇄율은 걷힌 방어로 계산된다', () => {
    const b = breakdownOf('wanderer', 'rabbit-swordsman');
    expect(b.defenseStat.value).toBe(50);
    expect(b.effectiveDefense).toBe(31.25);
    expect(b.defenseMultiplier).toBe(100 / 131.25);
  });
});

describe('INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) — 걷히기 전과 걷힌 뒤가 함께 실린다', () => {
  it('관통이 실제로 작용한 타격의 경위', () => {
    const world = strikeWith('attack', (w) => setAttribute(w, 'armorPenetration', 60));
    expect(world.observe().strikes[0]?.breakdown).toEqual({
      damageType: 'physical',
      offenseStat: { name: 'physicalAttack', value: 40 },
      baseDamage: 6,
      attackContribution: 20,
      rawDamage: 26,
      defenseStat: { name: 'armor', value: 30 }, // 상대가 지닌 방어
      penetrationStat: { name: 'armorPenetration', value: 60 },
      effectiveDefense: 18.75, // 걷힌 뒤 — 감쇄식이 읽은 값
      defenseMultiplier: 100 / 118.75,
      finalDamage: 22, // 관통이 없었다면 20 이다
      appliedDamage: 22,
    });
  });

  it('관통이 0 이어도 두 항목이 실린다 — 통하지 않았다는 것도 관찰이다', () => {
    const breakdown = strikeWith('attack').observe().strikes[0]?.breakdown;
    expect(breakdown?.penetrationStat).toEqual({ name: 'armorPenetration', value: 0 });
    expect(breakdown?.effectiveDefense).toBe(30);
    expect(breakdown?.effectiveDefense).toBe(breakdown?.defenseStat.value);
  });
});

describe('INTENT-PENETRATION-OBSERVE-001 — 치기 전에 무엇이 통할지 보인다', () => {
  it('상대의 방어가 나에게 얼마로 읽히는지를 세계가 계산해 싣는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    setAttribute(world, 'armorPenetration', 60);
    world.tick(TICK_INTERVAL);
    const npc = actor(world.observe(), 'npc-1');

    expect(npc?.attributes?.combatStats.armor).toBe(30); // 상대가 지닌 값
    expect(npc?.attributes?.versusObserver.armor).toBe(18.75); // 나에게 읽히는 값
    expect(npc?.attributes?.versusObserver.armorMultiplier).toBe(100 / 118.75);
    // 오라 쪽은 내 관통이 0 이라 그대로다
    expect(npc?.attributes?.versusObserver.resistance).toBe(90);
    expect(npc?.attributes?.versusObserver.resistanceMultiplier).toBe(100 / 190);
  });

  it('내 관통이 0 이면 읽히는 값이 상대의 값과 같다 — 같다는 것 자체가 관찰이다', () => {
    const npc = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), 'npc-1');
    expect(npc?.attributes?.versusObserver.armor).toBe(npc?.attributes?.combatStats.armor);
    expect(npc?.attributes?.versusObserver.resistance).toBe(npc?.attributes?.combatStats.resistance);
  });

  it('관통이 상대의 DefenseShape 판정을 흔들지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    setAttribute(world, 'armorPenetration', 100000);
    world.tick(TICK_INTERVAL);
    // wanderer 는 Armor 30 · Resistance 90 — 관통이 아무리 커도 오라 쪽이 단단하다
    expect(actor(world.observe(), 'npc-1')?.attributes?.defenseShape).toBe('aura-tougher');
  });

  it('내 관통이 늘 눈앞에 있다', () => {
    const world = driveWorld({ npcs: [] });
    expect(hud(world.observe(), 'self.combat.armorPenetration')).toBe(0);
    expect(hud(world.observe(), 'self.combat.resistancePenetration')).toBe(0);

    setAttribute(world, 'armorPenetration', 60);
    world.tick(TICK_INTERVAL);
    expect(hud(world.observe(), 'self.combat.armorPenetration')).toBe(60);
  });
});

describe('REGRESSION — 관통이 0 인 조합에서 C012 의 값이 그대로다', () => {
  it('rabbit-swordsman 의 모든 타격이 C012 와 같다', () => {
    expect(breakdownOf('rabbit-swordsman', 'wanderer', 'attack').finalDamage).toBe(20);
    expect(breakdownOf('rabbit-swordsman', 'wanderer', 'heavy-attack').finalDamage).toBe(55);
    expect(breakdownOf('rabbit-swordsman', 'wanderer', 'aura-strike').finalDamage).toBe(14);
    expect(breakdownOf('rabbit-swordsman', 'rabbit-swordsman', 'attack').finalDamage).toBe(17);
    expect(breakdownOf('rabbit-swordsman', 'rabbit-swordsman', 'aura-strike').finalDamage).toBe(22);
  });

  it('wanderer 의 오라 타격도 그대로다 — 오라 쪽 관통이 0 이기 때문이다', () => {
    expect(breakdownOf('wanderer', 'rabbit-swordsman', 'aura-strike').finalDamage).toBe(11);
  });
});
