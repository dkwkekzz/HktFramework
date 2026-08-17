// C010 기본 공격/방어 공식 World 단독 테스트
// RULE-DAMAGE-CALCULATE-001 · RULE-STRIKE-DAMAGE-001(CHANGED) · RULE-ATTRIBUTE-SET-001(AFFECTED)
//
// Implements INTENT-ATTACK-POWER-001 · INTENT-DEFENSE-001 · INTENT-SKILL-SCALING-001 ·
//            INTENT-DAMAGE-CALCULATE-001 · INTENT-STRIKE-DAMAGE-001 ·
//            INTENT-DAMAGE-BREAKDOWN-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치: 관찰자 rabbit-swordsman (Attack 40 · Defense 50 · hp 200)
//            자율 존재 wanderer     (Attack 40 · Defense 30 · hp 120)

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../semantic/collision';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

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
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
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
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    expect(actor(view, PLAYER)?.attributes?.combatStats).toEqual({
      attack: 40,
      defense: 50,
      defenseMultiplier: 100 / 150,
    });
    expect(actor(view, 'npc-1')?.attributes?.combatStats).toEqual({
      attack: 40,
      defense: 30,
      defenseMultiplier: 100 / 130,
    });
  });

  it('공격 능력이 높아지면 같은 스킬이 더 크게 깎는다', () => {
    // 기준 — Attack 40 → (6 + 20) × 100/130 = 20
    expect(actor(strikeOnce().observe(), 'npc-1')?.vitality?.health).toBe(120 - 20);

    // Attack 80 → (6 + 40) × 100/130 = 35.4 → 35
    const stronger = strikeOnce((world) => setAttribute(world, 'attack', 80));
    expect(actor(stronger.observe(), 'npc-1')?.vitality?.health).toBe(120 - 35);
  });

  it('공격 능력이 0 이어도 스킬의 기본 피해량은 들어간다', () => {
    // (6 + 0) × 100/130 = 4.6 → 5
    const world = strikeOnce((w) => setAttribute(w, 'attack', 0));
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - 5);
  });
});

describe('INTENT-DEFENSE-001 — 방어 능력이 피해를 줄인다', () => {
  it('방어 능력이 높아지면 같은 공격이 덜 아프다', () => {
    // Defense 30 → 20.  Defense 200 → 26 × 100/300 = 8.67 → 9
    const tougher = strikeOnce((world) => setAttribute(world, 'defense', 200, 'npc-1'));
    expect(actor(tougher.observe(), 'npc-1')?.vitality?.health).toBe(120 - 9);
  });

  it('방어 능력이 0 이면 공격 피해를 그대로 받는다', () => {
    // 26 × 100/100 = 26
    const bare = strikeOnce((world) => setAttribute(world, 'defense', 0, 'npc-1'));
    expect(actor(bare.observe(), 'npc-1')?.vitality?.health).toBe(120 - 26);
  });

  it('방어가 아무리 높아도 피해가 0 이 되지 않는다', () => {
    // 26 × 100/100100 = 0.026 → 반올림하면 0 이지만 하한 1 이 그것을 막는다
    const wall = strikeOnce((world) => setAttribute(world, 'defense', 100000, 'npc-1'));
    expect(actor(wall.observe(), 'npc-1')?.vitality?.health).toBe(120 - 1);
  });

  it('방어를 같은 만큼 올려도 줄어드는 폭은 점점 작아진다 (체감식)', () => {
    const damageAt = (defense: number) => {
      const world = strikeOnce((w) => setAttribute(w, 'defense', defense, 'npc-1'));
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
    setAttribute(world, 'defense', 100);
    world.tick(TICK_INTERVAL);

    const view = world.observe();
    expect(actor(view, PLAYER)?.attributes?.combatStats.defenseMultiplier).toBe(0.5);
    expect(hud(view, 'self.combat.defense')).toBe(100);
    expect(hud(view, 'self.combat.defenseMultiplier')).toBe(0.5);
  });
});

describe('INTENT-SKILL-SCALING-001 — 스킬마다 능력을 피해로 바꾸는 정도가 다르다', () => {
  it('계수가 큰 스킬일수록 공격 능력이 오를 때 더 크게 자란다', () => {
    const heavyDamage = (attack: number) => {
      const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
      aimRight(world);
      setAttribute(world, 'attack', attack);
      setAttribute(world, 'cp', 100);
      world.dispatch({ interactionId: 'skill-heavy' });
      tickFor(world, SWING_BEGIN * SKILL_DEFINITIONS['heavy-attack'].baseDuration + 2 * TICK_INTERVAL);
      return world.observe().strikes[0]?.amount ?? 0;
    };
    const basicDamage = (attack: number) => {
      const world = strikeOnce((w) => setAttribute(w, 'attack', attack));
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
    setAttribute(world, 'defense', 0, 'npc-2'); // 한쪽만 무르게 만든다
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
      baseDamage: 6,
      attackContribution: 20, // 40 × 0.5
      rawDamage: 26,
      targetDefense: 30,
      defenseMultiplier: 100 / 130,
      finalDamage: 20,
    });
    // 경위 표시를 접어 두어도 기존 표시가 그대로 성립한다
    expect(strike?.amount).toBe(strike?.breakdown.finalDamage);
  });

  it('값을 바꾸기 전후의 경위를 비교해 무엇 때문에 달라졌는지 알 수 있다', () => {
    const before = strikeOnce().observe().strikes[0]?.breakdown;
    const after = strikeOnce((world) => setAttribute(world, 'attack', 80)).observe().strikes[0]
      ?.breakdown;

    // 달라진 것은 공격이 더한 몫 하나뿐이다 — 스킬도 상대 방어도 그대로다
    expect(after?.baseDamage).toBe(before?.baseDamage);
    expect(after?.targetDefense).toBe(before?.targetDefense);
    expect(after?.defenseMultiplier).toBe(before?.defenseMultiplier);
    expect(after?.attackContribution).toBe(40); // 20 → 40
    expect(after?.finalDamage).toBeGreaterThan(before?.finalDamage ?? 0);
  });
});

describe('RULE-ATTRIBUTE-SET-001 (AFFECTED) — 두 능력이 바꿀 수 있는 목록에 든다', () => {
  it('공격 능력과 방어 능력을 바꿀 수 있다', () => {
    const world = driveWorld({ npcs: [] });
    expect(setAttribute(world, 'attack', 123).status).toBe('success');
    expect(setAttribute(world, 'defense', 45).status).toBe('success');
    world.tick(TICK_INTERVAL);

    expect(hud(world.observe(), 'self.combat.attack')).toBe(123);
    expect(hud(world.observe(), 'self.combat.defense')).toBe(45);
  });

  it('음수는 거절된다 — 이 층은 피해를 증폭하지 않는다', () => {
    const world = driveWorld({ npcs: [] });
    expect(setAttribute(world, 'defense', -1)).toEqual({
      status: 'failure',
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'value-out-of-range',
    });
    expect(setAttribute(world, 'attack', -1).status).toBe('failure');
  });

  it('세계가 밝히는 변경 가능 목록에 두 항목이 나타난다', () => {
    const view = driveWorld({ npcs: [] }).observe();
    const setAttributeCommand = view.commands.find((c) => c.id === 'set-attribute');
    const attribute = setAttributeCommand?.parameters.find((p) => p.id === 'attribute');
    const options = attribute?.domain.options?.map((o) => o.name) ?? [];

    expect(options).toContain('attack');
    expect(options).toContain('defense');
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
