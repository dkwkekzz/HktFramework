// C011 완벽한 막기 World 단독 테스트
// RULE-GUARD-SET-001(CHANGED) · RULE-PERFECT-GUARD-001 · RULE-EXPOSE-001 ·
// RULE-COUNTER-001 · RULE-STRIKE-DAMAGE-001(CHANGED) · RULE-DOWNED-001(CHANGED) ·
// RULE-ATTRIBUTE-SET-001(CHANGED)
//
// Implements INTENT-GUARD-ONSET-001 · INTENT-PERFECT-GUARD-001 ·
//            INTENT-PERFECT-GUARD-ONCE-001 · INTENT-PERFECT-GUARD-REWARD-001 ·
//            INTENT-EXPOSED-001 · INTENT-EXPOSED-EXPIRES-001 · INTENT-COUNTER-001 ·
//            INTENT-PERFECT-GUARD-OBSERVE-001 · INTENT-TIMING-BREAKDOWN-001
//
// C010 과 같은 무대를 쓴다 — 막는 쪽은 언제나 PLAYER, 때리는 쪽은 언제나 PLAYER_2.
// 자율 존재는 스스로 다가오고 물러나므로 "같은 조건이면 같은 결과" 를 보이기에 맞지 않다.
//
// 이 Cycle 이 보려는 것은 **언제 세웠는가** 하나다. 그래서 대부분의 검증이
// "자세를 세운 시각" 과 "타격이 닿은 시각" 의 관계를 직접 만든다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  COUNTER_DAMAGE_BONUS,
  EXPOSED_DURATION,
  GUARD_CP_PER_DAMAGE,
  GUARD_DAMAGE_RATIO,
  GUARD_REARM_LOCK,
  MIN_DAMAGE_RATIO,
  PERFECT_GUARD_CP_GAIN,
  PERFECT_GUARD_WINDOW,
  SKILL_DEFINITIONS,
} from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const HEAVY = SKILL_DEFINITIONS['heavy-attack'];

// 03 WORLD STATE — 종류가 정하는 방어력
const PLAYER_DEFENSE = 5;

const mitigated = (base: number, defense = PLAYER_DEFENSE) =>
  Math.max(base * MIN_DAMAGE_RATIO, base - defense);
const guardedHpLoss = (base: number) => mitigated(base) * GUARD_DAMAGE_RATIO;
const guardedCpPaid = (base: number) =>
  (mitigated(base) - guardedHpLoss(base)) * GUARD_CP_PER_DAMAGE;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const interaction = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);

const now = (world: WorldDriver) => hud(world.observe(), 'world.time') as number;
const stanceOf = (world: WorldDriver, id = PLAYER) => actor(world.observe(), id)!.stance!;
const exposureOf = (world: WorldDriver, id = PLAYER) => actor(world.observe(), id)!.exposure!;
const vitalityOf = (world: WorldDriver, id = PLAYER) => actor(world.observe(), id)!.vitality!;
const energyOf = (world: WorldDriver, id = PLAYER) => actor(world.observe(), id)!.attributes!.energy;
const strikesOn = (world: WorldDriver, id = PLAYER) =>
  world.observe().strikes.filter((s) => s.targetId === id);

/** 막는 자(PLAYER, x=0)와 때리는 자(PLAYER_2)가 마주 선 세계 — C010 duel() 과 같다. */
function duel(): WorldDriver {
  const world = driveWorld({ npcs: [], actorPosition: { x: 0, z: 0 } });
  world.join(OBSERVER_2);
  world.tick(0);
  world.dispatch({ interactionId: 'move', position: { x: 1.9, z: 0 } }, OBSERVER_2);
  tickFor(world, 1.0);
  faceEachOther(world);
  return world;
}

const positionOf = (world: WorldDriver, id: string) => actor(world.observe(), id)!.position;

function faceEachOther(world: WorldDriver): void {
  const a = positionOf(world, PLAYER);
  const b = positionOf(world, PLAYER_2);
  const nudge = (from: { x: number; z: number }, to: { x: number; z: number }) => ({
    x: from.x + (to.x - from.x) * 0.02,
    z: from.z + (to.z - from.z) * 0.02,
  });
  world.dispatch({ interactionId: 'move', position: nudge(a, b) }, OBSERVER);
  world.dispatch({ interactionId: 'move', position: nudge(b, a) }, OBSERVER_2);
  tickFor(world, 3 * TICK_INTERVAL);
}

function closeIn(world: WorldDriver): void {
  tickFor(world, 1.0);
  const a = positionOf(world, PLAYER);
  world.dispatch({ interactionId: 'move', position: { x: a.x + 1.9, z: a.z } }, OBSERVER_2);
  tickFor(world, 1.5);
  faceEachOther(world);
}

type Skill = 'attack' | 'skill-heavy';
const durationOf = (skill: Skill) =>
  skill === 'attack' ? BASIC.baseDuration : HEAVY.baseDuration;

/**
 * PLAYER_2 가 휘두르고, 그 휘두름이 PLAYER 를 맞히는 순간에 멈춘다 (C010 swing 과 같다).
 * 언제 닿는지는 호가 쓸고 지나가는 자리에 달려 있으므로 고정된 시간을 기다리지 않는다.
 */
function swing(world: WorldDriver, skill: Skill = 'attack'): boolean {
  const since = now(world);
  world.dispatch({ interactionId: skill }, OBSERVER_2);
  const steps = Math.ceil((durationOf(skill) + TICK_INTERVAL) / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    world.tick(TICK_INTERVAL);
    if (world.observe().strikes.some((s) => s.targetId === PLAYER && s.since >= since)) return true;
  }
  return false;
}

/**
 * **읽어서 세우는 막기** — 이 Cycle 의 핵심 조작을 세계 안에서 재현한다.
 *
 * PLAYER_2 가 휘두르기 시작한 뒤, 칼이 실제로 나오는 것(swing.active)을 보고 나서야
 * PLAYER 가 자세를 세운다. 그래서 자세를 세운 시각과 타격이 닿은 시각의 차이가
 * 한두 Tick 으로 좁혀진다 — 사람이 공격을 보고 반응하는 것과 같은 순서다.
 * 고정된 시간을 기다리지 않으므로 스킬 길이가 달라져도 그대로 성립한다.
 */
function swingAndReadIt(world: WorldDriver, skill: Skill = 'attack'): boolean {
  const since = now(world);
  world.dispatch({ interactionId: skill }, OBSERVER_2);
  const steps = Math.ceil((durationOf(skill) + TICK_INTERVAL) / TICK_INTERVAL);
  let guarded = false;
  for (let i = 0; i < steps; i++) {
    world.tick(TICK_INTERVAL);
    if (!guarded && actor(world.observe(), PLAYER_2)?.swing?.active) {
      // 칼이 나왔다 — 지금 세운다
      world.dispatch({ interactionId: 'guard', stance: 'guard' });
      guarded = true;
    }
    if (world.observe().strikes.some((s) => s.targetId === PLAYER && s.since >= since)) return true;
  }
  return false;
}

/** 자세를 세우고 창이 확실히 닫힐 때까지 기다린다 — "세워 두고 버티는" 막기 */
function guardAndWait(world: WorldDriver): void {
  world.dispatch({ interactionId: 'guard', stance: 'guard' });
  tickFor(world, PERFECT_GUARD_WINDOW + 4 * TICK_INTERVAL);
}

// ─────────────────────────────────────────────────────────────────────

describe('INTENT-GUARD-ONSET-001 — 자세는 언제 세웠는가를 함께 지닌다', () => {
  it('세우는 순간의 세계 시각이 찍힌다', () => {
    const world = duel();
    expect(stanceOf(world).guarding).toBe(false);

    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    const at = stanceOf(world).startedAt;
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThanOrEqual(now(world));
  });

  it('세워 둔 자세에 같은 요청이 다시 와도 시각은 바뀌지 않는다 — 창을 두드려 열 수 없다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    const first = stanceOf(world).startedAt;

    tickFor(world, 1.0);
    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    // 요청은 받아들여지되(멱등) 세계는 아무것도 바꾸지 않는다
    expect(result.status).toBe('success');
    expect(stanceOf(world).startedAt).toBe(first);
    expect(stanceOf(world).perfectWindow).toBe(false);
  });

  it('놓아도 세운 시각은 남는다 — 재세움 간격을 재는 기준이기 때문이다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    const at = stanceOf(world).startedAt;

    world.dispatch({ interactionId: 'guard', stance: 'open' });
    world.tick(TICK_INTERVAL);

    expect(stanceOf(world).guarding).toBe(false);
    expect(stanceOf(world).startedAt).toBe(at);
  });

  it('놓았다 다시 세우면 새 시각이 된다 — 그것이 다시 읽었다는 뜻이다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    const first = stanceOf(world).startedAt;

    world.dispatch({ interactionId: 'guard', stance: 'open' });
    tickFor(world, GUARD_REARM_LOCK + TICK_INTERVAL);
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    expect(stanceOf(world).startedAt).toBeGreaterThan(first);
  });
});

describe('INTENT-PERFECT-GUARD-001 — 시점이 같은 막기를 둘로 가른다', () => {
  it('창 안에서 막으면 생명도 기력도 잃지 않고 오히려 번다', () => {
    const world = duel();
    const hpBefore = vitalityOf(world).health;
    const cpBefore = energyOf(world);

    expect(swingAndReadIt(world)).toBe(true);

    const strike = strikesOn(world).at(-1)!;
    expect(strike.timing.elapsed).not.toBeNull();
    expect(strike.timing.elapsed!).toBeLessThanOrEqual(PERFECT_GUARD_WINDOW);
    expect(strike.timing.perfect).toBe(true);
    expect(strike.breakdown.guarded).toBe(true);
    expect(strike.amount).toBe(0);
    expect(strike.breakdown.energyPaid).toBe(0);
    expect(strike.timing.energyGained).toBe(PERFECT_GUARD_CP_GAIN);

    expect(vitalityOf(world).health).toBe(hpBefore);
    expect(energyOf(world)).toBeCloseTo(cpBefore + PERFECT_GUARD_CP_GAIN, 6);
  });

  it('창이 닫힌 뒤에 막으면 C010 그대로다 — 같은 자세, 같은 타격, 다른 결과', () => {
    const world = duel();
    const hpBefore = vitalityOf(world).health;
    const cpBefore = energyOf(world);

    guardAndWait(world);
    expect(swing(world)).toBe(true);

    const strike = strikesOn(world).at(-1)!;
    expect(strike.timing.elapsed!).toBeGreaterThan(PERFECT_GUARD_WINDOW);
    expect(strike.timing.perfect).toBe(false);
    expect(strike.breakdown.guarded).toBe(true);
    expect(strike.amount).toBeCloseTo(guardedHpLoss(BASIC.damage), 6);
    expect(strike.breakdown.energyPaid).toBeCloseTo(guardedCpPaid(BASIC.damage), 6);
    expect(strike.timing.energyGained).toBe(0);

    expect(vitalityOf(world).health).toBeCloseTo(hpBefore - guardedHpLoss(BASIC.damage), 6);
    expect(energyOf(world)).toBeCloseTo(cpBefore - guardedCpPaid(BASIC.damage), 6);
  });

  it('막아 낸 몸은 자세를 잃지 않는다 — 완벽하게 막아도 마찬가지다', () => {
    const world = duel();
    expect(swingAndReadIt(world)).toBe(true);
    expect(strikesOn(world).at(-1)!.timing.perfect).toBe(true);
    expect(stanceOf(world).guarding).toBe(true);
    expect(actor(world.observe(), PLAYER)!.state).not.toBe('hit');
  });

  it('얻는 기력이 그 몸의 한계를 넘지 않는다 — 새 자원이 아니라 같은 기력이다', () => {
    const world = duel();
    const cpMax = actor(world.observe(), PLAYER)!.attributes!.energyMaximum;
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: cpMax } });
    world.tick(TICK_INTERVAL);

    expect(swingAndReadIt(world)).toBe(true);
    const strike = strikesOn(world).at(-1)!;
    expect(strike.timing.perfect).toBe(true);
    expect(strike.timing.energyGained).toBe(0);
    expect(energyOf(world)).toBe(cpMax);
  });

  it('시점이 맞아도 뒤에서 들어오면 완벽하지 않다 — 애초에 막힌 것이 아니다', () => {
    const world = duel();
    // 등을 돌린다 (막는 방향은 몸이 향한 쪽이다 — C010)
    const a = positionOf(world, PLAYER);
    world.dispatch({ interactionId: 'move', position: { x: a.x - 1.0, z: a.z } });
    tickFor(world, 0.6);

    expect(swingAndReadIt(world)).toBe(true);
    const strike = strikesOn(world).at(-1)!;
    expect(strike.breakdown.guarded).toBe(false);
    expect(strike.timing.perfect).toBe(false); // 막히지 않았으므로 완벽할 수도 없다
    expect(strike.timing.elapsed).toBeNull(); // 잴 대상이 없다
    expect(strike.amount).toBeCloseTo(mitigated(BASIC.damage), 6);
  });
});

describe('INTENT-PERFECT-GUARD-ONCE-001 — 창은 되풀이 열리지 않는다', () => {
  it('놓고 곧바로 다시 세울 수 없다 — 사유가 남는다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    world.dispatch({ interactionId: 'guard', stance: 'open' });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    expect(result.status).toBe('failure');
    expect(result.status === 'failure' && result.reason).toBe('guard-rearming');
    expect(stanceOf(world).guarding).toBe(false);
    expect(interaction(world.observe(), 'guard')?.available).toBe(false);
    expect(interaction(world.observe(), 'guard')?.reason).toBe('guard-rearming');
  });

  it('한 호흡이 지나면 다시 세워진다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    const at = stanceOf(world).startedAt;
    world.dispatch({ interactionId: 'guard', stance: 'open' });

    // 재세움 시각을 지날 때까지
    while (now(world) < at + GUARD_REARM_LOCK) world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(result.status).toBe('success');
    expect(stanceOf(world).guarding).toBe(true);
  });

  it('막기를 연타해도 창이 계속 열리지는 않는다 — 이 Cycle 의 구멍이 막혀 있다', () => {
    const world = duel();
    const since = now(world);
    world.dispatch({ interactionId: 'attack' }, OBSERVER_2);

    // 매 Tick 마다 놓고 세우기를 되풀이한다 (사람이 버튼을 연타하는 것과 같다)
    const steps = Math.ceil((BASIC.baseDuration + TICK_INTERVAL) / TICK_INTERVAL);
    for (let i = 0; i < steps; i++) {
      world.dispatch({ interactionId: 'guard', stance: 'open' });
      world.dispatch({ interactionId: 'guard', stance: 'guard' });
      world.tick(TICK_INTERVAL);
      if (world.observe().strikes.some((s) => s.targetId === PLAYER && s.since >= since)) break;
    }

    const strike = strikesOn(world).at(-1)!;
    // 연타는 오히려 자기를 연다 — 놓는 것은 언제나 되고 세우는 것은 간격이 들기 때문에,
    // 첫 요청으로 선 자세를 스스로 풀어 버린 뒤 다시 서지 못한 채로 맞는다.
    // 창을 되풀이 열려는 시도가 막히는 것을 넘어 손해가 된다.
    expect(strike.timing.perfect).toBe(false);
    expect(strike.breakdown.guarded).toBe(false);
    expect(strike.timing.elapsed).toBeNull();
    expect(stanceOf(world).guarding).toBe(false);
    // 그리고 얻어맞았으므로(막지 못했다) 지금은 자세를 세울 수조차 없다 — C010 의 관문 그대로
    expect(interaction(world.observe(), 'guard')?.available).toBe(false);
  });
});

describe('INTENT-EXPOSED-001 · EXPIRES — 열림은 세계 안의 구간이다', () => {
  it('완벽하게 막힌 자가 열린다 — 막아 낸 자가 아니라 막힌 자가 지불한다', () => {
    const world = duel();
    expect(swingAndReadIt(world)).toBe(true);
    expect(strikesOn(world).at(-1)!.timing.perfect).toBe(true);

    expect(exposureOf(world, PLAYER_2).exposed).toBe(true);
    expect(exposureOf(world, PLAYER_2).until).toBeCloseTo(
      strikesOn(world).at(-1)!.since + EXPOSED_DURATION,
      6,
    );
    expect(exposureOf(world, PLAYER).exposed).toBe(false);
  });

  it('열림은 스스로 가신다 — 닫기 위해 할 일이 없다', () => {
    const world = duel();
    expect(swingAndReadIt(world)).toBe(true);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(true);

    tickFor(world, EXPOSED_DURATION + TICK_INTERVAL);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(false);
  });

  it('열려 있어도 하던 일이 끊기지 않는다 — 받는 결과만 바뀐다', () => {
    const world = duel();
    expect(swingAndReadIt(world)).toBe(true);
    const after = actor(world.observe(), PLAYER_2)!;
    expect(after.exposure!.exposed).toBe(true);
    // 휘두름은 그대로 이어진다 (강제로 끊기지 않는다)
    expect(['attack', 'idle', 'move']).toContain(after.state);
  });

  it('보통 막기는 상대를 열지 않는다 — 여는 것은 완벽한 막기뿐이다', () => {
    const world = duel();
    guardAndWait(world);
    expect(swing(world)).toBe(true);
    expect(strikesOn(world).at(-1)!.timing.perfect).toBe(false);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(false);
  });

  it('쓰러진 몸에는 열림이 남지 않는다', () => {
    const world = duel();
    world.dispatch(
      {
        interactionId: 'set-attribute',
        targetEntityId: PLAYER_2,
        attribute: { id: 'exposedFor', value: 5 },
      },
      OBSERVER,
    );
    world.tick(TICK_INTERVAL);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(true);

    world.dispatch(
      { interactionId: 'set-attribute', targetEntityId: PLAYER_2, attribute: { id: 'hp', value: 0 } },
      OBSERVER,
    );
    world.tick(TICK_INTERVAL);

    expect(vitalityOf(world, PLAYER_2).downed).toBe(true);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(false);
    expect(exposureOf(world, PLAYER_2).until).toBe(0);
  });

  it('열린 몸도 막을 수 있다 — 막는다고 열림이 닫히지는 않는다', () => {
    const world = duel();
    world.dispatch({
      interactionId: 'set-attribute',
      attribute: { id: 'exposedFor', value: 5 },
    });
    world.tick(TICK_INTERVAL);
    expect(exposureOf(world).exposed).toBe(true);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(result.status).toBe('success');
    expect(stanceOf(world).guarding).toBe(true);
    expect(exposureOf(world).exposed).toBe(true);
  });
});

describe('INTENT-COUNTER-001 — 열린 몸은 누구에게든 열려 있다', () => {
  /** 밖의 손으로 대상을 열어 두고 PLAYER 가 한 번 때린다 — 자율 존재를 기다리지 않는다 */
  function strikeExposed(exposedFor: number, skill: Skill = 'attack') {
    const world = duel();
    world.dispatch(
      {
        interactionId: 'set-attribute',
        targetEntityId: PLAYER_2,
        attribute: { id: 'exposedFor', value: exposedFor },
      },
      OBSERVER,
    );
    world.tick(TICK_INTERVAL);

    const since = now(world);
    world.dispatch({ interactionId: skill }, OBSERVER);
    const steps = Math.ceil((durationOf(skill) + TICK_INTERVAL) / TICK_INTERVAL);
    for (let i = 0; i < steps; i++) {
      world.tick(TICK_INTERVAL);
      const hit = world.observe().strikes.find((s) => s.targetId === PLAYER_2 && s.since >= since);
      if (hit) return { world, strike: hit };
    }
    throw new Error('타격이 닿지 않았다');
  }

  it('열린 상대를 때리면 본래 피해부터 커진다', () => {
    const { strike } = strikeExposed(5);
    expect(strike.timing.counter).toBe(true);
    expect(strike.breakdown.base).toBeCloseTo(BASIC.damage * (1 + COUNTER_DAMAGE_BONUS), 6);
    expect(strike.timing.counterBonus).toBeCloseTo(BASIC.damage * COUNTER_DAMAGE_BONUS, 6);
    // 증폭 전 값은 base - counterBonus 로 되짚을 수 있다
    expect(strike.breakdown.base - strike.timing.counterBonus).toBeCloseTo(BASIC.damage, 6);
  });

  it('열려 있지 않으면 그대로다', () => {
    const { strike } = strikeExposed(0);
    expect(strike.timing.counter).toBe(false);
    expect(strike.timing.counterBonus).toBe(0);
    expect(strike.breakdown.base).toBe(BASIC.damage);
  });

  it('되받아침은 방어력 감쇄보다 앞에 걸린다', () => {
    const { strike } = strikeExposed(5);
    const wandererDefense = 5; // PLAYER_2 도 관찰자의 몸이므로 같은 방어력이다
    expect(strike.breakdown.mitigated).toBeCloseTo(
      Math.max(strike.breakdown.base * MIN_DAMAGE_RATIO, strike.breakdown.base - wandererDefense),
      6,
    );
    expect(strike.amount).toBeCloseTo(strike.breakdown.mitigated, 6);
  });

  it('고급 스킬에도 같은 비율로 걸린다 — 타입도 스킬도 따지지 않는다', () => {
    const { strike } = strikeExposed(5, 'skill-heavy');
    expect(strike.timing.counter).toBe(true);
    expect(strike.breakdown.base).toBeCloseTo(HEAVY.damage * (1 + COUNTER_DAMAGE_BONUS), 6);
  });

  it('열린 상대가 막고 있어도 커진 몫이 그대로 계산에 실린다', () => {
    const world = duel();
    // PLAYER_2 를 열어 두고 자세도 세워 둔다 (둘 다 밖의 손)
    world.dispatch(
      {
        interactionId: 'set-attribute',
        targetEntityId: PLAYER_2,
        attribute: { id: 'exposedFor', value: 5 },
      },
      OBSERVER,
    );
    world.dispatch({ interactionId: 'guard', stance: 'guard' }, OBSERVER_2);
    tickFor(world, PERFECT_GUARD_WINDOW + 4 * TICK_INTERVAL);

    const since = now(world);
    world.dispatch({ interactionId: 'attack' }, OBSERVER);
    const steps = Math.ceil((BASIC.baseDuration + TICK_INTERVAL) / TICK_INTERVAL);
    let strike;
    for (let i = 0; i < steps; i++) {
      world.tick(TICK_INTERVAL);
      strike = world.observe().strikes.find((s) => s.targetId === PLAYER_2 && s.since >= since);
      if (strike) break;
    }

    expect(strike).toBeDefined();
    expect(strike!.timing.counter).toBe(true);
    expect(strike!.breakdown.base).toBeCloseTo(BASIC.damage * (1 + COUNTER_DAMAGE_BONUS), 6);
    // 막고 있었다면 그 커진 값에서 막기 계산이 이루어진다
    if (strike!.breakdown.guarded) {
      expect(strike!.amount).toBeCloseTo(strike!.breakdown.mitigated * GUARD_DAMAGE_RATIO, 6);
    }
  });

  it('자율 존재도 열리고 되받아침을 당한다 — 이 Cycle 의 플레이다', () => {
    const world = driveWorld({
      npcs: [{ id: 'npc-1', characterKind: 'wanderer', position: { x: 40, z: 40 } }],
      actorPosition: { x: 0, z: 0 },
    });
    world.tick(0);
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'exposedFor', value: 5 },
    });
    world.tick(TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')!.exposure!.exposed).toBe(true);
  });
});

describe('INTENT-TIMING-BREAKDOWN-001 · OBSERVE — 시점이 무엇을 했는지가 읽힌다', () => {
  it('자기 창과 재세움 시각이 늘 눈앞에 있다', () => {
    const world = duel();
    expect(hud(world.observe(), 'self.perfectWindow')).toBe(false);

    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    expect(hud(world.observe(), 'self.perfectWindow')).toBe(true);
    expect(hud(world.observe(), 'self.guardRearmAt')).toBeCloseTo(
      (hud(world.observe(), 'self.guardStartedAt') as number) + GUARD_REARM_LOCK,
      6,
    );
    expect(hud(world.observe(), 'self.exposed')).toBe(false);

    tickFor(world, PERFECT_GUARD_WINDOW + 2 * TICK_INTERVAL);
    expect(hud(world.observe(), 'self.perfectWindow')).toBe(false);
    expect(stanceOf(world).guarding).toBe(true); // 자세는 그대로다. 창만 닫혔다
  });

  it('남의 창과 남의 열림도 보인다 — 관찰에 예외를 만들지 않는다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' }, OBSERVER_2);
    world.tick(TICK_INTERVAL);

    const seenByOther = actor(world.observe(OBSERVER), PLAYER_2)!;
    expect(seenByOther.stance!.perfectWindow).toBe(true);
    expect(seenByOther.stance!.startedAt).toBeGreaterThan(0);
    expect(seenByOther.exposure).toBeDefined();
  });

  it('한 줄로 결과를 재구성할 수 있다 — 열한 값의 관계가 곧 계산 순서다', () => {
    const world = duel();
    expect(swingAndReadIt(world)).toBe(true);
    const s = strikesOn(world).at(-1)!;

    // 증폭 전 → 증폭 → 감쇄 → 막기
    const raw = s.breakdown.base - s.timing.counterBonus;
    expect(raw).toBeCloseTo(BASIC.damage, 6);
    expect(s.breakdown.mitigated).toBeCloseTo(
      Math.max(s.breakdown.base * MIN_DAMAGE_RATIO, s.breakdown.base - PLAYER_DEFENSE),
      6,
    );
    // 완벽하게 막았으므로 감쇄된 피해가 어디에도 나가지 않고 기력만 들어왔다
    expect(s.timing.perfect).toBe(true);
    expect(s.amount).toBe(0);
    expect(s.breakdown.energyPaid).toBe(0);
    expect(s.timing.energyGained).toBe(PERFECT_GUARD_CP_GAIN);
  });
});

describe('DC-COMBAT-PLAYER-CAUSALITY — 같은 두 시각이면 같은 내역', () => {
  it('같은 세계를 두 번 굴리면 같은 StrikeEvent 가 나온다', () => {
    const run = () => {
      const world = duel();
      swingAndReadIt(world);
      return strikesOn(world).at(-1)!;
    };
    expect(run()).toEqual(run());
  });

  it('열어 두고 때린 결과도 두 번 같다', () => {
    const run = () => {
      const world = duel();
      world.dispatch(
        {
          interactionId: 'set-attribute',
          targetEntityId: PLAYER_2,
          attribute: { id: 'exposedFor', value: 5 },
        },
        OBSERVER,
      );
      world.tick(TICK_INTERVAL);
      const since = now(world);
      world.dispatch({ interactionId: 'attack' }, OBSERVER);
      const steps = Math.ceil((BASIC.baseDuration + TICK_INTERVAL) / TICK_INTERVAL);
      for (let i = 0; i < steps; i++) {
        world.tick(TICK_INTERVAL);
        const hit = world.observe().strikes.find((s) => s.targetId === PLAYER_2 && s.since >= since);
        if (hit) return hit;
      }
      throw new Error('타격이 닿지 않았다');
    };
    expect(run()).toEqual(run());
  });
});

describe('CYCLE GOAL — 읽어 낸 막기가 자원을 벌고 상대를 연다', () => {
  it('완벽하게 막고 → 자세를 놓고 → 되받아쳐 평소보다 크게 때린다', () => {
    const world = duel();
    const cpStart = energyOf(world);

    // 1. 읽어서 막는다
    expect(swingAndReadIt(world)).toBe(true);
    const guardStrike = strikesOn(world).at(-1)!;
    expect(guardStrike.timing.perfect).toBe(true);
    expect(vitalityOf(world).health).toBe(200); // 생명이 전혀 줄지 않았다
    expect(energyOf(world)).toBeCloseTo(cpStart + PERFECT_GUARD_CP_GAIN, 6);

    // 2. 상대가 열렸다
    expect(exposureOf(world, PLAYER_2).exposed).toBe(true);

    // 3. 자세를 놓고 되받아친다 (놓는 것에는 조건이 없다 — C010).
    //    막아도 몸은 밀린다(C006·C010)므로 한 걸음 좁히고 나서 친다 —
    //    그 한 걸음까지 포함해서 열림 안에 닿아야 이 Cycle 의 한 바퀴가 성립한다.
    const released = world.dispatch({ interactionId: 'guard', stance: 'open' });
    expect(released.status).toBe('success');

    const foe = positionOf(world, PLAYER_2);
    world.dispatch({ interactionId: 'move', position: { x: foe.x, z: foe.z } }, OBSERVER);
    tickFor(world, 4 * TICK_INTERVAL);

    const since = now(world);
    const counterBegan = world.dispatch({ interactionId: 'attack' }, OBSERVER);
    expect(counterBegan.status).toBe('success'); // 자세를 놓았으므로 스킬이 열린다

    const steps = Math.ceil((BASIC.baseDuration + TICK_INTERVAL) / TICK_INTERVAL);
    let counterStrike;
    for (let i = 0; i < steps; i++) {
      world.tick(TICK_INTERVAL);
      counterStrike = world.observe().strikes.find((s) => s.targetId === PLAYER_2 && s.since >= since);
      if (counterStrike) break;
    }

    // 열림(0.8초)이 밀려난 거리를 좁히고 되받아치기에 충분했다
    expect(counterStrike).toBeDefined();
    expect(counterStrike!.since).toBeLessThan(guardStrike.since + EXPOSED_DURATION);
    expect(counterStrike!.timing.counter).toBe(true);
    expect(counterStrike!.breakdown.base).toBeCloseTo(BASIC.damage * (1 + COUNTER_DAMAGE_BONUS), 6);

    // 4. 그리고 번 기력은 고급 스킬로 이어진다 (C007 소모 30)
    //    시작 30 + 완벽 10 + 기본 스킬 충전 12 = 52
    tickFor(world, BASIC.baseDuration); // 되받아친 휘두름이 끝나기를 기다린다
    expect(energyOf(world)).toBeGreaterThanOrEqual(HEAVY.cpCost);
    expect(interaction(world.observe(), 'skill-heavy')?.available).toBe(true);
  });

  it('읽지 못하면 그대로 C010 이다 — 버티는 막기는 여전히 기력을 태운다', () => {
    const world = duel();
    const cpStart = energyOf(world);

    guardAndWait(world);
    expect(swing(world)).toBe(true);

    expect(strikesOn(world).at(-1)!.timing.perfect).toBe(false);
    expect(energyOf(world)).toBeCloseTo(cpStart - guardedCpPaid(BASIC.damage), 6);
    expect(exposureOf(world, PLAYER_2).exposed).toBe(false);
  });
});
