// C015 Critical World 단독 테스트
// RULE-CRITICAL-STRIKE-001(ADDED) · RULE-STRIKE-DAMAGE-001(CHANGED) ·
// RULE-ATTRIBUTE-SET-001(CHANGED)
//
// Implements INTENT-CRITICAL-001 · INTENT-WORLD-CHANCE-001 · INTENT-CRITICAL-ROLL-001 ·
//            INTENT-CRITICAL-AMPLIFY-001 · INTENT-DAMAGE-BREAKDOWN-001 ·
//            INTENT-CRITICAL-OBSERVE-001 · INTENT-ATTRIBUTE-MUTATE-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치
//   관찰자 rabbit-swordsman  PhysAtk 40 · Armor 50 · Resist 20 · 관통 0/60 · Crit 0.25 / 2.0
//   자율 존재 wanderer       PhysAtk 40 · Armor 30 · Resist 90 · 관통 0/0  · Crit 0 / 1.0
//   기본 스킬 20 (터지면 40) · 고급 스킬 55 (터지면 110) · 오라 17 (터지면 34)
//
// 흔들림의 뿌리는 세계가 지니고 관찰에 실리지 않으므로, 테스트는 **뿌리를 지정해**
// 되짚는다 (WorldSetup.chanceSeed) — 이것이 03 이 말한 "되짚기는 세계 밖에서 하는 일" 이다.
// 기본 뿌리에서 흔들림의 앞자리는 0.9331 · 0.2700 · 0.1038 · 0.0875 · 0.6805 … 이다.
// 그래서 가능성 0.25 로는 세 번째와 네 번째 판정이 터진다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../semantic/collision';
import { chanceAt, forceOfSkill, SKILL_DEFINITIONS } from '../semantic/combat';
import { DEFAULT_CHANCE_SEED, TICK_INTERVAL } from '../semantic/world-state';
import { spawnActor } from '../semantic/spawn';
import { ruleCriticalStrike } from '../rules/critical-strike';
import { ruleGuardBlock } from '../rules/guard';
import { ruleStrikeDamage } from '../rules/strike-damage';
import type { WorldState } from '../semantic/world-state';
import { driveWorld, observeFully, PLAYER, type WorldDriver } from './drive';

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

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 맞을 만큼 튼튼한 표적 하나를 세우고 관찰자가 마주 보게 한 세계 */
const arena = (setup: (world: WorldDriver) => void = () => {}, chanceSeed?: number) => {
  const world = driveWorld({
    npcs: [dummyAt(1.5, 0)],
    ...(chanceSeed === undefined ? {} : { chanceSeed }),
  });
  aimRight(world);
  // 여러 대를 견디게 한다 — 이 Cycle 이 보는 것은 쓰러짐이 아니라 한 방의 크기다
  setAttribute(world, 'hpMax', 100000, 'npc-1');
  setAttribute(world, 'hp', 100000, 'npc-1');
  setup(world);
  return world;
};

/** 기본 스킬로 한 번 친 뒤 그 타격의 경위를 돌려준다 */
const strikeOnce = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'attack' });
  tickFor(world, AFTER_SWING_OPEN);
  return world.observe().strikes.at(-1)!.breakdown;
};

/**
 * 규칙 수준 시험대 — 잇달아 여러 대를 치는 검증은 여기서 한다.
 *
 * 세계 수준에서 반복해 치면 휘두름의 충격이 상대를 밀어내 사거리 밖으로 보내므로
 * (C006 INTENT-SWING-IMPACT-001) 같은 조건의 연속 타격을 만들 수 없다.
 * 이 Cycle 이 보는 것은 밀려남이 아니라 **같은 조건에서 결과가 어떻게 갈리는가**이므로
 * `Before → Input → Rule → After` 를 규칙에 직접 건다.
 * 세계 수준 검증(투영·관찰·명령)은 위의 driveWorld 쪽이 맡는다.
 */
const bench = (chanceSeed: number = DEFAULT_CHANCE_SEED) => {
  const attacker = spawnActor({
    id: 'a',
    name: 'A',
    characterKind: 'rabbit-swordsman',
    control: 'player',
    position: { x: 0, z: 0 },
  });
  const target = spawnActor({
    id: 't',
    name: 'T',
    characterKind: 'wanderer',
    control: 'autonomous',
    position: { x: 1, z: 0 },
  });
  // 여러 대를 견디게 한다 — 이 Cycle 이 보는 것은 쓰러짐이 아니라 한 방의 크기다
  target.hpMax = 100000;
  target.hp = 100000;
  const state = {
    time: 0,
    strikeEvents: [],
    chanceSeed,
    chanceCursor: 0,
  } as unknown as WorldState;

  return {
    attacker,
    target,
    state,
    /** 기본 스킬로 n 번 친 뒤 각 타격의 경위를 순서대로 돌려준다 */
    strike(n = 1, skill: 'attack' | 'heavy-attack' | 'aura-strike' = 'attack') {
      const from = state.strikeEvents.length;
      for (let i = 0; i < n; i++)
        ruleStrikeDamage(state, attacker, target, forceOfSkill(skill), skill);
      return state.strikeEvents.slice(from).map((event) => event.breakdown);
    },
  };
};

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CRITICAL-001 — 터뜨리는 힘은 존재가 지니는 능력이다', () => {
  it('모든 존재가 자기 종류의 Critical 둘을 갖고 시작한다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    // 관찰자의 몸(rabbit-swordsman) — 터뜨리는 쪽이다. 자기 것은 언제나 보인다
    expect(actor(world.observe(), PLAYER)?.attributes?.combatStats?.criticalChance).toBe(0.25);
    expect(actor(world.observe(), PLAYER)?.attributes?.combatStats?.criticalDamage).toBe(2);

    // wanderer — 터뜨리지 못한다. C014 — 남의 것은 살펴본 뒤에 실린다
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.criticalChance).toBe(0);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.criticalDamage).toBe(1);
  });

  it('성질만으로는 아무것도 일어나지 않는다 — 자원도 평소 피해도 그대로다', () => {
    const world = arena();
    const before = world.observe();
    const cpBefore = actor(before, PLAYER)?.attributes?.energy;
    const hpBefore = actor(before, PLAYER)?.vitality?.health;

    // Critical 을 크게 올려도 치기 전에는 아무 일도 없다
    setAttribute(world, 'criticalChance', 1);
    setAttribute(world, 'criticalDamage', 10);
    const after = world.observe();

    expect(actor(after, PLAYER)?.attributes?.energy).toBe(cpBefore);
    expect(actor(after, PLAYER)?.vitality?.health).toBe(hpBefore);
    // 상대의 생명도 줄지 않았다
    expect(actor(after, 'npc-1')?.vitality?.health).toBe(actor(before, 'npc-1')?.vitality?.health);
  });

  it('판정은 치는 자의 성질만 읽는다 — 맞는 자의 값은 들어가지 않는다', () => {
    // 대상의 Critical 을 가득 채워도 내가 맞는 것이 아니라 내가 치는 것이므로 무관하다
    const world = arena((w) => {
      setAttribute(w, 'criticalChance', 1, 'npc-1');
      setAttribute(w, 'criticalDamage', 10, 'npc-1');
      setAttribute(w, 'criticalChance', 0);
    });
    const b = strikeOnce(world);

    expect(b.critical.occurred).toBe(false);
    expect(b.critical.chance).toBe(0); // 내 가능성이다. 상대의 1 이 아니다
    expect(b.finalDamage).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-WORLD-CHANCE-001 — 흔들림은 세계가 지닌다', () => {
  it('같은 뿌리로 같은 순서를 굴리면 같은 이야기가 나온다', () => {
    const run = () => bench(0x1234abcd).strike(12).map((b) => b.finalDamage);
    expect(run()).toEqual(run());
  });

  it('뿌리가 다르면 같은 순서라도 다른 이야기가 된다', () => {
    const story = (seed: number) => bench(seed).strike(12).map((b) => b.critical.occurred);
    // 두 뿌리가 같은 터짐 순서를 낼 이유가 없다 — 우연이 세계마다 다르다는 관찰이다
    expect(story(0x1111_1111)).not.toEqual(story(0x9999_9999));
  });

  it('세계가 지닌 흔들림은 관찰에 실리지 않는다 — 실으면 앞날이 읽힌다', () => {
    const view = arena().observe() as unknown as Record<string, unknown>;
    const flat = JSON.stringify(view);

    expect(view.chanceSeed).toBeUndefined();
    expect(view.chanceCursor).toBeUndefined();
    expect(flat).not.toContain('chanceSeed');
    expect(flat).not.toContain('chanceCursor');
    // Roll 값도 실리지 않는다 — 연이은 Roll 은 뿌리를 되짚게 한다
    expect(flat).not.toContain('"roll"');
  });

  it('흔들림을 소비하는 자리는 하나뿐이다 — 치지 않으면 커서가 흐르지 않는다', () => {
    // 세계가 한참을 굴러도(움직임·막기·살펴봄·속성 변경·시간) 커서는 그대로다.
    // 커서가 흘렀는지는 관찰에 실리지 않으므로 **결과로** 확인한다 —
    // 그 뒤 처음 친 한 방이 커서 0 의 흔들림(0.9331)을 읽어야 한다.
    const world = arena();
    world.dispatch({ interactionId: 'guard-begin' });
    tickFor(world, 0.5);
    world.dispatch({ interactionId: 'guard-release' });
    observeFully(world, 'npc-1');
    setAttribute(world, 'physicalAttack', 40);
    tickFor(world, 1.0);
    aimRight(world);

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);
    const b = world.observe().strikes.at(-1)!.breakdown;
    expect(b.critical.occurred).toBe(chanceAt(DEFAULT_CHANCE_SEED, 0) < 0.25);
    expect(b.critical.occurred).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CRITICAL-ROLL-001 — 한 타격에 판정은 하나다', () => {
  it('가능성이 0 이면 결코 터지지 않고 흔들림도 쓰이지 않는다', () => {
    const b = bench();
    b.attacker.criticalChance = 0;
    const seen = b.strike(8);

    expect(seen).toHaveLength(8);
    expect(seen.every((x) => x.critical.occurred === false)).toBe(true);
    expect(seen.every((x) => x.finalDamage === 20)).toBe(true);
    // **이미 정해진 일에 우연을 쓰지 않는다** — 이것이 Regression 의 바닥이다
    expect(b.state.chanceCursor).toBe(0);
  });

  it('가능성이 1 이면 언제나 터지고 흔들림도 쓰이지 않는다', () => {
    const b = bench();
    b.attacker.criticalChance = 1;
    const seen = b.strike(8);

    expect(seen.every((x) => x.critical.occurred === true)).toBe(true);
    expect(seen.every((x) => x.finalDamage === 40)).toBe(true);
    expect(b.state.chanceCursor).toBe(0);
  });

  it('그 사이의 가능성에서는 판정마다 흔들림이 한 칸씩 흐른다', () => {
    const b = bench();
    b.strike(5);
    expect(b.state.chanceCursor).toBe(5);
  });

  it('두 끝을 오가도 쓴 만큼만 흐른다 — 정해진 판정은 커서를 건드리지 않는다', () => {
    const b = bench();
    b.strike(2); // 흔들리는 판정 둘 — 커서 2
    b.attacker.criticalChance = 0;
    b.strike(5); // 정해진 판정 다섯 — 커서 그대로
    b.attacker.criticalChance = 1;
    b.strike(5); // 반대쪽 끝도 마찬가지
    b.attacker.criticalChance = 0.25;
    b.strike(1); // 다시 흔들리는 판정 하나 — 커서 3
    expect(b.state.chanceCursor).toBe(3);
  });

  it('기본 뿌리에서 앞의 다섯 판정이 정확히 어떻게 갈리는가', () => {
    // 뿌리 0x5EEDC015 의 앞자리 — 0.9331 · 0.2700 · 0.1038 · 0.0875 · 0.6805
    // 가능성 0.25 이므로 세 번째와 네 번째만 터진다. 이 순서가 곧 결정론의 증거다
    const seen = bench().strike(5);
    expect(seen.map((x) => x.critical.occurred)).toEqual([false, false, true, true, false]);
    expect(seen.map((x) => x.finalDamage)).toEqual([20, 20, 40, 40, 20]);
  });

  it('판정은 지난 타격을 기억하지 않는다 — 연속 실패 보정이 없다', () => {
    // 흔들림 값이 곧 결과다. 앞의 실패 횟수가 뒤의 판정을 밀어 올리지 않는다
    bench()
      .strike(20)
      .forEach((x, i) => {
        expect(x.critical.occurred).toBe(chanceAt(DEFAULT_CHANCE_SEED, i) < 0.25);
      });
  });

  it('방식도 시각도 판정을 바꾸지 않는다 — 같은 자리의 흔들림이면 같은 결과다', () => {
    const firstOf = (skill: 'attack' | 'heavy-attack' | 'aura-strike') =>
      bench().strike(1, skill)[0]!.critical.occurred;
    // 물리 · 오라 · 고급 — 셋 다 커서 0 의 흔들림을 읽으므로 결과가 같다
    expect(firstOf('attack')).toBe(false);
    expect(firstOf('aura-strike')).toBe(false);
    expect(firstOf('heavy-attack')).toBe(false);

    // 세계 시각이 아무리 흘러도 커서가 그대로면 결과도 그대로다
    const late = bench();
    late.state.time = 9999;
    expect(late.strike(1)[0]!.critical.occurred).toBe(false);
  });

  it('한 휘두름이 둘에게 닿으면 몸마다 따로 정해진다', () => {
    // 가능성을 0.5 로 두고 두 몸을 같은 호 안에 세운다.
    // 커서 0(0.9331) 과 1(0.2700) 을 각각 읽으므로 한쪽만 터진다
    const world = driveWorld({ npcs: [dummyAt(1.5, 0.3), dummyAt(1.5, -0.3, 'npc-2')] });
    aimRight(world);
    setAttribute(world, 'criticalChance', 0.5);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration);

    const strikes = world.observe().strikes;
    expect(strikes).toHaveLength(2);
    // 한 사람에게 터졌다고 옆 사람에게도 터지지 않는다
    expect(strikes.map((s) => s.breakdown.critical.occurred).sort()).toEqual([false, true]);
    expect(strikes.map((s) => s.breakdown.finalDamage).sort((x, y) => x - y)).toEqual([20, 40]);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CRITICAL-AMPLIFY-001 — 계산이 내놓은 값이 커진다', () => {
  it('계산 안의 어떤 값도 흔들리지 않는다 — 커지는 것은 마지막 값 하나다', () => {
    const world = arena((w) => setAttribute(w, 'criticalChance', 1));
    const b = strikeOnce(world);

    // C010 · C012 · C013 이 낸 값이 한 톨도 다르지 않다
    expect(b.damageType).toBe('physical');
    expect(b.offenseStat).toEqual({ name: 'physicalAttack', value: 40 });
    expect(b.rawDamage).toBe(26);
    expect(b.defenseStat).toEqual({ name: 'armor', value: 30 });
    expect(b.penetrationStat).toEqual({ name: 'armorPenetration', value: 0 });
    expect(b.effectiveDefense).toBe(30);
    expect(b.defenseMultiplier).toBe(100 / 130);
    // 달라진 것은 마지막 값과 그 경위뿐이다
    expect(b.critical.damageBeforeCritical).toBe(20);
    expect(b.finalDamage).toBe(40);
  });

  it('증폭은 언제나 키우는 쪽이다 — 1 미만은 세계가 받지 않는다', () => {
    const world = arena((w) => setAttribute(w, 'criticalChance', 1));
    // 범위 밖이므로 거절된다 (value-out-of-range)
    expect(setAttribute(world, 'criticalDamage', 0.5).status).toBe('failure');
    // 규칙 자체도 1 아래로 내려가지 않는다 — 값이 새어 들어와도 작아지지 않는다
    const attacker = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'rabbit-swordsman',
      control: 'player',
      position: { x: 0, z: 0 },
    });
    attacker.criticalChance = 1;
    attacker.criticalDamage = 0.1;
    const state = { chanceSeed: 1, chanceCursor: 0 } as WorldState;
    expect(ruleCriticalStrike(state, attacker, 20).amplified).toBe(20);
  });

  it('배율이 자라면 터진 값도 자란다 — 빈도와 크기는 따로 자란다', () => {
    const at = (multiplier: number) => {
      const world = arena((w) => {
        setAttribute(w, 'criticalChance', 1);
        setAttribute(w, 'criticalDamage', multiplier);
      });
      return strikeOnce(world).finalDamage;
    };
    expect(at(1)).toBe(20); // 터져도 커지지 않는다
    expect(at(2)).toBe(40);
    expect(at(3)).toBe(60);
  });

  it('낼 피해가 없으면 터져도 없는 피해를 만들지 않는다', () => {
    const attacker = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'rabbit-swordsman',
      control: 'player',
      position: { x: 0, z: 0 },
    });
    attacker.criticalChance = 1;
    const state = { chanceSeed: 1, chanceCursor: 0 } as WorldState;
    expect(ruleCriticalStrike(state, attacker, 0).amplified).toBe(0);
  });

  it('최소 1 피해의 하한이 증폭 뒤에도 깨지지 않는다', () => {
    // 방어를 극단으로 올려 하한 1 로 밀어 넣는다
    const world = arena((w) => {
      setAttribute(w, 'armor', 100000, 'npc-1');
      setAttribute(w, 'criticalChance', 1);
    });
    const b = strikeOnce(world);
    expect(b.critical.damageBeforeCritical).toBe(1);
    expect(b.finalDamage).toBe(2); // 1 × 2 — 커졌을 뿐 하한은 그대로다
    expect(b.finalDamage).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CRITICAL-AMPLIFY-001 — 막기는 커진 값을 마주한다', () => {
  /** 막는 몸 하나와 치는 몸 하나 — 막기 규칙에 곧바로 건다 */
  const guardBench = () => {
    const target = spawnActor({
      id: 't',
      name: 'T',
      characterKind: 'rabbit-swordsman',
      control: 'player',
      position: { x: 0, z: 0 },
    });
    const attacker = spawnActor({
      id: 'a',
      name: 'A',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 0, z: 1 },
    });
    target.guarding = true;
    target.facing = { x: 0, z: 1 };
    target.cpMax = 100;
    target.cp = 100;
    return { target, attacker };
  };

  it('막기의 비율과 대가 기준은 그대로이고 마주하는 크기만 달라진다', () => {
    // 막기는 들어온 값의 같은 몫을 덜어낼 뿐이다 — 달라지는 것은 들어온 값이다
    const { target, attacker } = guardBench();

    const plain = ruleGuardBlock(target, attacker, 55, 0);
    expect(plain.appliedDamage).toBe(28); // round(55 × 0.5)
    expect(plain.outcome?.cpPaid).toBe(33); // ceil(55 × 0.6)

    target.cp = 100;
    const burst = ruleGuardBlock(target, attacker, 110, 0);
    expect(burst.appliedDamage).toBe(55); // round(110 × 0.5) — 같은 비율
    expect(burst.outcome?.cpPaid).toBe(66); // ceil(110 × 0.6) — 같은 기준, 두 배 크기
  });

  it('크게 터진 한 방 앞에서 방어가 더 쉽게 무너진다 — 무너짐 조건은 그대로다', () => {
    const { target, attacker } = guardBench();

    // 기력 40 — 55 는 막아 낸다 (대가 33)
    target.cp = 40;
    expect(ruleGuardBlock(target, attacker, 55, 0).outcome?.blocked).toBe(true);

    // 같은 기력으로 110 은 막지 못한다 (대가 66). 무너지는 조건은 한 줄도 안 바뀌었다
    target.guarding = true;
    target.cp = 40;
    const broken = ruleGuardBlock(target, attacker, 110, 0);
    expect(broken.outcome?.broken).toBe(true);
    expect(broken.appliedDamage).toBe(110); // 무너지면 부분적으로 막아 주지 않는다
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) — 터진 것이 끝까지 읽힌다', () => {
  it('터진 타격의 경위', () => {
    const world = arena((w) => setAttribute(w, 'criticalChance', 1));
    expect(strikeOnce(world).critical).toEqual({
      occurred: true,
      chance: 1,
      multiplier: 2,
      damageBeforeCritical: 20,
    });
  });

  it('터지지 않은 타격에서도 네 항목이 모두 실린다', () => {
    const b = strikeOnce(arena());
    expect(b.critical).toEqual({
      occurred: false,
      chance: 0.25,
      multiplier: 2,
      damageBeforeCritical: 20,
    });
    // 커지기 전과 커진 뒤가 같다는 것이 "이 숫자는 흔들리지 않았다" 의 관찰이다
    expect(b.critical.damageBeforeCritical).toBe(b.finalDamage);
  });

  it('"터질 리 없는 몸" 과 "이번엔 운이 없었다" 를 경위만으로 가른다', () => {
    const unlucky = strikeOnce(arena()).critical;
    const cannot = strikeOnce(arena((w) => setAttribute(w, 'criticalChance', 0))).critical;

    // 결과는 같다 — 둘 다 안 터졌다
    expect(unlucky.occurred).toBe(false);
    expect(cannot.occurred).toBe(false);
    // 그러나 가능성이 다르다. 이것이 없으면 두 일이 같은 모양이 된다
    expect(unlucky.chance).toBe(0.25);
    expect(cannot.chance).toBe(0);
  });

  it('가능성 0 인 자의 타격에도 배율이 실린다', () => {
    const b = strikeOnce(arena((w) => setAttribute(w, 'criticalChance', 0)));
    expect(b.critical.multiplier).toBe(2); // 터질 일이 없어도 얼마나 커질 몸인지는 사실이다
  });

  it('타격 경위는 살펴봄 관문 뒤가 아니다 — 모르는 상대에게 터진 것도 보인다', () => {
    const world = arena((w) => setAttribute(w, 'criticalChance', 1));
    const b = strikeOnce(world);

    // 상대를 살펴보지 않았다
    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(false);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats).toBeUndefined();
    // 그래도 이 한 방이 터졌다는 것은 보인다
    expect(b.critical.occurred).toBe(true);
    expect(b.finalDamage).toBe(40);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CRITICAL-OBSERVE-001 — 남의 것은 살펴본 뒤에 열린다', () => {
  it('살펴보기 전에는 Critical 둘이 함께 가려져 있다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const npc = actor(world.observe(), 'npc-1');

    expect(npc?.attributes?.combatStats).toBeUndefined();
    // 가려지는 항목의 이름은 늘지 않는다 — 새 관문을 만들지 않았다
    expect(npc?.attributes?.concealed).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
  });

  it('한 번의 살펴봄이 Critical 둘도 함께 연다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    const stats = actor(world.observe(), 'npc-1')?.attributes?.combatStats;

    expect(stats?.criticalChance).toBe(0);
    expect(stats?.criticalDamage).toBe(1);
    // 두 성질만 따로 열리거나 따로 가려지지 않는다
    expect(stats?.armor).toBe(30);
  });

  it('열린 뒤에는 그 순간의 값이 실린다 — 베껴 두지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    setAttribute(world, 'criticalChance', 0.8, 'npc-1');

    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.criticalChance).toBe(0.8);
  });

  it('versusObserver 에는 Critical 이 들어가지 않는다 — 두 존재 사이의 값이 아니다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    const versus = actor(world.observe(), 'npc-1')?.attributes?.versusObserver as unknown as Record<
      string,
      unknown
    >;

    expect(versus.criticalChance).toBeUndefined();
    expect(versus.criticalDamage).toBeUndefined();
  });

  it('자기 것은 언제나 화면에 있다 — 바꾼 직후 즉시 읽힌다', () => {
    const world = arena();
    expect(hud(world.observe(), 'self.combat.criticalChance')).toBe(0.25);
    expect(hud(world.observe(), 'self.combat.criticalDamage')).toBe(2);

    setAttribute(world, 'criticalChance', 0.6);
    setAttribute(world, 'criticalDamage', 3);
    expect(hud(world.observe(), 'self.combat.criticalChance')).toBe(0.6);
    expect(hud(world.observe(), 'self.combat.criticalDamage')).toBe(3);
  });

  it('0 인 쪽도 싣는다 — 없다는 것을 아는 것이 "나는 터뜨릴 수 없다" 를 아는 것이다', () => {
    const world = arena((w) => setAttribute(w, 'criticalChance', 0));
    expect(hud(world.observe(), 'self.combat.criticalChance')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ATTRIBUTE-MUTATE-001 (CHANGED) — 범위가 좁은 두 성질', () => {
  it('가능성은 0 과 1 사이만 받는다', () => {
    const world = arena();
    expect(setAttribute(world, 'criticalChance', 0).status).toBe('success');
    expect(setAttribute(world, 'criticalChance', 1).status).toBe('success');
    expect(setAttribute(world, 'criticalChance', 1.01).status).toBe('failure');
    expect(setAttribute(world, 'criticalChance', -0.01).status).toBe('failure');
  });

  it('증폭은 1 아래로 내려가지 않는다', () => {
    const world = arena();
    expect(setAttribute(world, 'criticalDamage', 1).status).toBe('success');
    expect(setAttribute(world, 'criticalDamage', 0.99).status).toBe('failure');
  });

  it('허용 범위를 세계가 목록과 함께 싣는다 — View 가 적어 두지 않는다', () => {
    const options = arena()
      .observe()
      .commands.find((c) => c.id === 'set-attribute')
      ?.parameters.find((p) => p.id === 'attribute')?.domain.options;

    const chance = options?.find((o) => o.name === 'criticalChance');
    const damage = options?.find((o) => o.name === 'criticalDamage');
    expect(chance?.thenDomain).toEqual({ kind: 'number', minimum: 0, maximum: 1 });
    expect(damage?.thenDomain).toEqual({ kind: 'number', minimum: 1, maximum: 100 });
  });
});

// ─────────────────────────────────────────────────────────────────
describe('REGRESSION — 확률 0 이면 세계가 C013 과 한 톨도 다르지 않다', () => {
  it('물리 · 고급 · 오라 세 스킬의 값이 그대로다', () => {
    const damageOf = (skill: 'attack' | 'heavy-attack' | 'aura-strike') => {
      const b = bench();
      b.attacker.criticalChance = 0;
      return b.strike(1, skill)[0]!.finalDamage;
    };

    expect(damageOf('attack')).toBe(20); // C010 · C012 · C013
    expect(damageOf('heavy-attack')).toBe(55); // C010
    expect(damageOf('aura-strike')).toBe(17); // C013 — 관통이 걷어낸 값
  });

  it('자율 존재가 내는 값은 흔들리지 않는다 — 그 종류의 가능성이 0 이다', () => {
    // C007 이래의 체감 기준: 관찰자의 몸(200)은 자율 존재의 기본 스킬 12대를 견딘다
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.criticalChance).toBe(0);
  });
});
