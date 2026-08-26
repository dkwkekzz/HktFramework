// C010 기본 공격/방어 공식 World 단독 테스트
// RULE-DAMAGE-CALCULATE-001 · RULE-STRIKE-DAMAGE-001(CHANGED) · RULE-ATTRIBUTE-SET-001(AFFECTED)
//
// Implements INTENT-ATTACK-POWER-001 · INTENT-DEFENSE-001 · INTENT-SKILL-SCALING-001 ·
//            INTENT-DAMAGE-CALCULATE-001 · INTENT-STRIKE-DAMAGE-001 ·
//            INTENT-DAMAGE-BREAKDOWN-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치: 관찰자 rabbit-swordsman (PhysicalAttack 40 · Armor 50 · hp 200)
//            자율 존재 wanderer     (PhysicalAttack 40 · Armor 30 · hp 120)
//
// C012 CHANGED — attack/defense 가 네 값으로 갈렸다. 이 파일의 기대값은 **한 값도
// 바뀌지 않았다** — 이행이 물리 쪽 값을 그대로 옮겼기 때문이다 (설계 수용 기준 §14-8).
// 바뀐 것은 속성 이름(attack→physicalAttack · defense→armor)과 경위의 항목뿐이다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { DEFAULT_SWING_BEGIN } from '../semantic/combat';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { observeFully, driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = DEFAULT_SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// 휘두름은 몸이 향한 방향으로 나간다 — +x 로 한 걸음 걸어 그쪽을 보게 한다 (C006 R1)
const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

// 순회도 인지도 없는 정지 NPC — 때릴 대상으로만 쓴다 (결정론)
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

/** 관찰자가 npc-1 을 기본 스킬로 한 번 때린 세계 */
const strikeOnce = (setup: (world: WorldDriver) => void = () => {}) => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
  aimRight(world);
  setup(world);
  world.dispatch({ interactionId: 'attack' });
  tickFor(world, AFTER_SWING_OPEN);
  return world;
};

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

describe('INTENT-ATTACK-POWER-001 — 공격 능력이 피해를 키운다', () => {
  it('모든 존재가 자기 종류의 두 능력을 갖고 시작한다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const view = world.observe();

    // 자기 것은 언제나 실린다
    expect(actor(view, PLAYER)?.attributes?.combatStats).toEqual({
      physicalAttack: 40,
      auraAttack: 40,
      armor: 50,
      resistance: 20,
      // C013 — 관찰자의 몸이다. 오라를 실은 검이 오라 방어를 가른다
      armorPenetration: 0,
      resistancePenetration: 60,
      armorMultiplier: 100 / 150,
      resistanceMultiplier: 100 / 120,
      // C015 — 관찰자의 몸이다. 넷에 하나꼴로 두 배가 터진다
      criticalChance: 0.25,
      criticalDamage: 2,
    });
    // C014 — 남의 것은 살펴본 뒤에 실린다. 값은 그대로다
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats).toEqual({
      physicalAttack: 40,
      auraAttack: 15,
      armor: 30,
      resistance: 90,
      // C013 — wanderer 는 관통을 지니지 않는다
      armorPenetration: 0,
      resistancePenetration: 0,
      armorMultiplier: 100 / 130,
      resistanceMultiplier: 100 / 190,
      // C015 — wanderer 는 터뜨리지 못한다. 그래서 관찰자가 맞는 값은 흔들리지 않는다
      criticalChance: 0,
      criticalDamage: 1,
    });
  });

  it('공격 능력이 높아지면 같은 스킬이 더 크게 깎는다', () => {
    // 기준 — Attack 40 → (6 + 20) × 100/130 = 20
    expect(actor(strikeOnce().observe(), 'npc-1')?.vitality?.health).toBe(120 - 20);

    // Attack 80 → (6 + 40) × 100/130 = 35.4 → 35
    const stronger = strikeOnce((world) => setAttribute(world, 'physicalAttack', 80));
    expect(actor(stronger.observe(), 'npc-1')?.vitality?.health).toBe(120 - 35);
  });

  it('공격 능력이 0 이어도 스킬의 기본 피해량은 들어간다', () => {
    // (6 + 0) × 100/130 = 4.6 → 5
    const world = strikeOnce((w) => setAttribute(w, 'physicalAttack', 0));
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - 5);
  });
});

describe('INTENT-DEFENSE-001 — 방어 능력이 피해를 줄인다', () => {
  it('방어 능력이 높아지면 같은 공격이 덜 아프다', () => {
    // Defense 30 → 20.  Defense 200 → 26 × 100/300 = 8.67 → 9
    const tougher = strikeOnce((world) => setAttribute(world, 'armor', 200, 'npc-1'));
    expect(actor(tougher.observe(), 'npc-1')?.vitality?.health).toBe(120 - 9);
  });

  it('방어 능력이 0 이면 공격 피해를 그대로 받는다', () => {
    // 26 × 100/100 = 26
    const bare = strikeOnce((world) => setAttribute(world, 'armor', 0, 'npc-1'));
    expect(actor(bare.observe(), 'npc-1')?.vitality?.health).toBe(120 - 26);
  });

  it('방어가 아무리 높아도 피해가 0 이 되지 않는다', () => {
    // 26 × 100/100100 = 0.026 → 반올림하면 0 이지만 하한 1 이 그것을 막는다
    const wall = strikeOnce((world) => setAttribute(world, 'armor', 100000, 'npc-1'));
    expect(actor(wall.observe(), 'npc-1')?.vitality?.health).toBe(120 - 1);
  });

  it('방어를 같은 만큼 올려도 줄어드는 폭은 점점 작아진다 (체감식)', () => {
    const damageAt = (defense: number) => {
      const world = strikeOnce((w) => setAttribute(w, 'armor', defense, 'npc-1'));
      return world.observe().strikes[0]?.amount ?? 0;
    };

    const d0 = damageAt(0); // 26
    const d100 = damageAt(100); // 13
    const d200 = damageAt(200); // 8.67 → 9
    const d300 = damageAt(300); // 6.5 → 7

    expect(d0 - d100).toBeGreaterThan(d100 - d200);
    expect(d100 - d200).toBeGreaterThan(d200 - d300);
    // 그리고 계속 줄기만 한다 — 어느 구간에서도 방어가 손해가 되지 않는다
    expect(d0).toBeGreaterThan(d100);
    expect(d200).toBeGreaterThan(d300);
  });

  it('방어 배율은 능력치와 함께 관찰된다 — 수치만으로는 효과를 알 수 없기 때문이다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    setAttribute(world, 'armor', 100);
    world.tick(TICK_INTERVAL);

    const view = world.observe();
    expect(actor(view, PLAYER)?.attributes?.combatStats?.armorMultiplier).toBe(0.5);
    expect(hud(view, 'self.combat.armor')).toBe(100);
    expect(hud(view, 'self.combat.armorMultiplier')).toBe(0.5);
  });
});

describe('INTENT-SKILL-SCALING-001 — 스킬마다 능력을 피해로 바꾸는 정도가 다르다', () => {
  it('계수가 큰 스킬일수록 공격 능력이 오를 때 더 크게 자란다', () => {
    const heavyDamage = (attack: number) => {
      const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
      aimRight(world);
      setAttribute(world, 'physicalAttack', attack);
      setAttribute(world, 'cp', 100);
      world.dispatch({ interactionId: 'skill-heavy' });
      tickFor(world, SKILL_DEFINITIONS['heavy-attack'].swingBegin * SKILL_DEFINITIONS['heavy-attack'].baseDuration + 2 * TICK_INTERVAL);
      return world.observe().strikes[0]?.amount ?? 0;
    };
    const basicDamage = (attack: number) => {
      const world = strikeOnce((w) => setAttribute(w, 'physicalAttack', attack));
      return world.observe().strikes[0]?.amount ?? 0;
    };

    // 공격 능력을 40 → 80 으로 같은 만큼 올렸을 때
    const basicGain = basicDamage(80) - basicDamage(40); // ratio 0.5
    const heavyGain = heavyDamage(80) - heavyDamage(40); // ratio 1.0

    expect(heavyGain).toBeGreaterThan(basicGain);
  });
});

describe('INTENT-DAMAGE-CALCULATE-001 — 계산은 하나이고 우연이 없다', () => {
  it('같은 공격자·같은 스킬·같은 대상이면 언제나 같은 값이 나온다', () => {
    const once = () => strikeOnce().observe().strikes[0]?.amount;
    expect(once()).toBe(20);
    expect(once()).toBe(20);
    expect(once()).toBe(20);
  });

  it('한 휘두름이 여럿에게 닿으면 각자의 방어 능력으로 각자의 값이 나온다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0.3), dummyAt(1.5, -0.3, 'npc-2')] });
    aimRight(world);
    setAttribute(world, 'armor', 0, 'npc-2'); // 한쪽만 무르게 만든다
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration);

    const view = world.observe();
    expect(actor(view, 'npc-1')?.vitality?.health).toBe(120 - 20); // Defense 30
    expect(actor(view, 'npc-2')?.vitality?.health).toBe(120 - 26); // Defense 0
  });
});

describe('INTENT-DAMAGE-BREAKDOWN-001 — 한 방의 크기가 나온 경위가 남는다', () => {
  it('타격 결과에 계산 경위가 함께 실린다', () => {
    const strike = strikeOnce().observe().strikes[0];

    expect(strike?.breakdown).toEqual({
      // C012 — 방식과 그 방식이 고른 두 능력이 함께 실린다
      damageType: 'physical',
      // C-COMBAT-001 — 두 몸이 어디에 몰아 두었는가. 고른 배분이므로 아래 세
      // fromAllocation 이 전부 0 이다 — 이 층이 들어온 뒤에도 값이 그대로라는 증거다
      attackerAllocation: 'balanced',
      targetAllocation: 'balanced',
      offenseStat: { name: 'physicalAttack', value: 40, fromAllocation: 0 },
      baseDamage: 6,
      attackContribution: 20, // 40 × 0.5
      rawDamage: 26,
      defenseStat: { name: 'armor', value: 30, fromAllocation: 0 },
      // C013 — 치는 쪽(rabbit-swordsman)에게 관통이 없으므로 걷힌 것이 없다.
      // 그래도 두 항목은 실린다 — 통하지 않았다는 사실도 관찰이어야 한다
      penetrationStat: { name: 'armorPenetration', value: 0, fromAllocation: 0 },
      effectiveDefense: 30,
      defenseMultiplier: 100 / 130,
      finalDamage: 20,
      // C015 AFFECTED — 터졌는가가 경위에 함께 실린다. 이 타격은 터지지 않았고
      // (세계의 첫 흔들림이 0.25 를 넘었다) 그래서 damageBeforeCritical 과 finalDamage 가
      // 같다 — **그것을 읽는 것이 "이 숫자는 흔들리지 않았다" 의 관찰이다.**
      // chance 가 0 이 아니라는 것도 함께 실린다: 터질 리 없는 몸이 아니라 이번에 안 터진 것이다
      critical: { occurred: false, chance: 0.25, multiplier: 2, damageBeforeCritical: 20 },
      // C011 AFFECTED — 실제로 빠진 값이 경위에 함께 실린다.
      // 막지 않은 타격이므로 finalDamage 와 같고, guard 는 실리지 않는다
      appliedDamage: 20,
    });
    // 경위 표시를 접어 두어도 기존 표시가 그대로 성립한다.
    // C011 — 그 기준이 appliedDamage 로 옮겨졌다. 막지 않은 타격에서는 둘이 같다
    expect(strike?.amount).toBe(strike?.breakdown.appliedDamage);
    expect(strike?.breakdown.appliedDamage).toBe(strike?.breakdown.finalDamage);
  });

  it('값을 바꾸기 전후의 경위를 비교해 무엇 때문에 달라졌는지 알 수 있다', () => {
    const before = strikeOnce().observe().strikes[0]?.breakdown;
    const after = strikeOnce((world) => setAttribute(world, 'physicalAttack', 80)).observe().strikes[0]
      ?.breakdown;

    // 달라진 것은 공격이 더한 몫 하나뿐이다 — 스킬도 상대 방어도 그대로다
    expect(after?.baseDamage).toBe(before?.baseDamage);
    expect(after?.defenseStat).toEqual(before?.defenseStat);
    expect(after?.defenseMultiplier).toBe(before?.defenseMultiplier);
    expect(after?.attackContribution).toBe(40); // 20 → 40
    expect(after?.finalDamage).toBeGreaterThan(before?.finalDamage ?? 0);
  });
});

describe('RULE-ATTRIBUTE-SET-001 (AFFECTED) — 네 능력이 바꿀 수 있는 목록에 든다', () => {
  it('네 능력을 모두 바꿀 수 있다', () => {
    const world = driveWorld({ npcs: [] });
    expect(setAttribute(world, 'physicalAttack', 123).status).toBe('success');
    expect(setAttribute(world, 'auraAttack', 77).status).toBe('success');
    expect(setAttribute(world, 'armor', 45).status).toBe('success');
    expect(setAttribute(world, 'resistance', 12).status).toBe('success');
    world.tick(TICK_INTERVAL);

    expect(hud(world.observe(), 'self.combat.physicalAttack')).toBe(123);
    expect(hud(world.observe(), 'self.combat.auraAttack')).toBe(77);
    expect(hud(world.observe(), 'self.combat.armor')).toBe(45);
    expect(hud(world.observe(), 'self.combat.resistance')).toBe(12);
  });

  it('옛 이름은 더 이상 통하지 않는다 — 두 이름을 함께 두지 않는다', () => {
    const world = driveWorld({ npcs: [] });
    expect(setAttribute(world, 'attack', 80)).toEqual({
      status: 'failure',
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'unknown-attribute',
    });
    expect(setAttribute(world, 'defense', 80)).toEqual({
      status: 'failure',
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'unknown-attribute',
    });
  });

  it('음수는 거절된다 — 이 층은 피해를 증폭하지 않는다', () => {
    const world = driveWorld({ npcs: [] });
    expect(setAttribute(world, 'armor', -1)).toEqual({
      status: 'failure',
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'value-out-of-range',
    });
    expect(setAttribute(world, 'physicalAttack', -1).status).toBe('failure');
  });

  it('세계가 밝히는 변경 가능 목록에 네 항목이 나타난다', () => {
    const view = driveWorld({ npcs: [] }).observe();
    const setAttributeCommand = view.commands.find((c) => c.id === 'set-attribute');
    const attribute = setAttributeCommand?.parameters.find((p) => p.id === 'attribute');
    const options = attribute?.domain.options?.map((o) => o.name) ?? [];

    expect(options).toContain('physicalAttack');
    expect(options).toContain('auraAttack');
    expect(options).toContain('armor');
    expect(options).toContain('resistance');
    // 옛 이름은 사라졌다
    expect(options).not.toContain('attack');
    expect(options).not.toContain('defense');
  });
});

describe('C007 회귀 — 공격 쪽 체감이 보존된다', () => {
  it('자율 존재는 기본 6대 또는 고급 2대에 쓰러진다', () => {
    // 기본 20 × 6 = 120 = hp.  고급 55 × 2 = 110 이므로 고급 2대 + 기본 1대다.
    const basic = strikeOnce().observe().strikes[0]?.amount;
    expect(basic).toBe(20);
    expect(Math.ceil(120 / (basic ?? 1))).toBe(6);
  });

  it('기력 수지는 이 Cycle 이 건드리지 않았다', () => {
    expect(BASIC.cpCharge).toBe(12);
    expect(BASIC.cpCost).toBe(0);
    expect(SKILL_DEFINITIONS['heavy-attack'].cpCharge).toBe(8);
    expect(SKILL_DEFINITIONS['heavy-attack'].cpCost).toBe(30);
  });
});
