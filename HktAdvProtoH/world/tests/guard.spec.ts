// C010 막기 World 단독 테스트
// RULE-GUARD-SET-001 · RULE-GUARD-ABSORB-001 · RULE-GUARD-BREAK-001 ·
// RULE-STRIKE-DAMAGE-001(CHANGED) · RULE-ACTION-BEGIN-001(CHANGED) ·
// RULE-SWING-STRIKE-001(CHANGED) · RULE-MOVE-MODE-001(CHANGED) · RULE-DOWNED-001(CHANGED)
//
// Implements INTENT-GUARD-STANCE-001 · INTENT-GUARD-BEGIN-GATE-001 ·
//            INTENT-GUARD-EXCLUSIVE-001 · INTENT-GUARD-DIRECTION-001 ·
//            INTENT-DEFENSE-MITIGATION-001 · INTENT-GUARD-ABSORB-001 ·
//            INTENT-GUARD-KEEPS-THE-STANCE-001 · INTENT-GUARD-BREAK-001 ·
//            INTENT-GUARD-BREAK-AFTERMATH-001 · INTENT-GUARD-OBSERVE-001 ·
//            INTENT-STRIKE-BREAKDOWN-001
//
// 때리는 쪽을 자율 존재가 아니라 두 번째 관찰자의 몸으로 둔다 — 자율 존재는 스스로
// 다가오고 물러나므로 "같은 조건이면 같은 결과" 를 보이기에 적합하지 않다.
// 막는 쪽은 언제나 PLAYER, 때리는 쪽은 언제나 PLAYER_2 다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  GUARD_BREAK_LOCK,
  GUARD_CP_PER_DAMAGE,
  GUARD_DAMAGE_RATIO,
  MIN_DAMAGE_RATIO,
  SKILL_DEFINITIONS,
} from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const HEAVY = SKILL_DEFINITIONS['heavy-attack'];

// 03 WORLD STATE — 종류가 정하는 방어력
const PLAYER_DEFENSE = 5;

// 03 RULE-STRIKE-DAMAGE-001 단계 2 — 방어력은 막든 안 막든 언제나 걷어내되 0 으로 못 만든다
const mitigated = (base: number, defense = PLAYER_DEFENSE) =>
  Math.max(base * MIN_DAMAGE_RATIO, base - defense);
// 03 단계 4-A — 생명으로 새어 드는 몫과 기력으로 대신 받는 몫
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

/**
 * 막는 자(PLAYER, x=0)와 때리는 자(PLAYER_2, x=1.5)가 마주 선 세계.
 * 자율 존재는 없다 — 이 검증의 대상이 아니고, 다가와 때리면 결정론이 흔들린다.
 */
function duel(): WorldDriver {
  const world = driveWorld({ npcs: [], actorPosition: { x: 0, z: 0 } });
  world.join(OBSERVER_2);
  world.tick(0);

  // 때리는 자를 두 몸이 겹치지 않는 거리(반경 합 1.7)보다 조금 밖에 세운다 —
  // 겹치면 RULE-BODY-PUSH-001 이 계속 밀어내 자리가 흔들린다.
  world.dispatch({ interactionId: 'move', position: { x: 1.9, z: 0 } }, OBSERVER_2);
  tickFor(world, 1.0); // 걸어가 멎을 때까지
  faceEachOther(world);
  return world;
}

const positionOf = (world: WorldDriver, id: string) =>
  actor(world.observe(), id)!.position;

/**
 * 두 몸이 서로를 보게 한다 (RULE-BODY-FACING-001 — 방향은 이동이 갱신한다).
 * 아주 짧은 걸음이므로 자리는 사실상 그대로다 — 이 검증들이 보려는 것은 방향이지 거리가 아니다.
 */
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

/** 밀려난 두 몸을 다시 사거리 안에 마주 세운다 (자세는 건드리지 않는다) */
function closeIn(world: WorldDriver): void {
  // 먼저 충격량이 마찰로 가라앉기를 기다린다 — 밀려나는 중에 거리를 재면 곧 어긋난다
  tickFor(world, 1.0);
  const a = positionOf(world, PLAYER);
  world.dispatch({ interactionId: 'move', position: { x: a.x + 1.9, z: a.z } }, OBSERVER_2);
  tickFor(world, 1.5);
  faceEachOther(world);
}

/**
 * PLAYER_2 가 한 번 휘두르고, 그 휘두름이 PLAYER 를 맞히는 순간에 멈춘다.
 * 휘두름은 호를 그리며 쓸고 지나가므로(C006 R1) 언제 닿는지는 거리에 따라 다르다 —
 * 고정된 시간을 기다리는 대신 새 타격이 실릴 때까지 진행한다.
 * 그래야 피격 반응처럼 잠깐만 참인 것도 그 자리에서 볼 수 있다.
 */
function swing(world: WorldDriver, skill: 'attack' | 'skill-heavy' = 'attack'): boolean {
  const since = hud(world.observe(), 'world.time') as number;
  world.dispatch({ interactionId: skill }, OBSERVER_2);
  const duration = skill === 'attack' ? BASIC.baseDuration : HEAVY.baseDuration;
  const steps = Math.ceil((duration + TICK_INTERVAL) / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    world.tick(TICK_INTERVAL);
    if (world.observe().strikes.some((s) => s.targetId === PLAYER && s.since >= since)) return true;
  }
  return false;
}

const guardOf = (world: WorldDriver, id = PLAYER) => actor(world.observe(), id)?.stance;
const strikeOn = (world: WorldDriver, id = PLAYER) =>
  world.observe().strikes.filter((s) => s.targetId === id);

describe('INTENT-GUARD-STANCE-001 — 앞을 향해 막는 자세를 취한다', () => {
  it('요청하면 자세가 서고, 놓으면 풀린다 — 토글이 아니라 명시값이다', () => {
    const world = duel();

    expect(guardOf(world)?.guarding).toBe(false);

    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(true);

    // 같은 요청이 두 번 와도 결과가 같다
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(true);

    world.dispatch({ interactionId: 'guard', stance: 'open' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(false);
  });

  it('자세는 스스로 끝나지 않는다 — 놓지 않으면 계속 서 있다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    tickFor(world, 5.0);
    expect(guardOf(world)?.guarding).toBe(true);
  });

  it('자세는 행동 칸을 쓰지 않는다 — 막은 채로 걸을 수 있다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'move', position: { x: 0, z: 4 } });
    expect(result.status).toBe('success');
    tickFor(world, 3 * TICK_INTERVAL);

    // 걷는 중에도 자세는 그대로다
    expect(actor(world.observe(), PLAYER)?.state).toBe('move');
    expect(guardOf(world)?.guarding).toBe(true);
  });
});

describe('INTENT-GUARD-BEGIN-GATE-001 — 아무 때나 막을 수 있는 것은 아니다', () => {
  it('휘두르는 중에는 자세를 갈아탈 수 없다 (action-busy)', () => {
    const world = duel();
    world.dispatch({ interactionId: 'attack' });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    expect(result).toEqual({ status: 'failure', rule: 'RULE-GUARD-SET-001', reason: 'action-busy' });
  });

  it('기력이 없으면 애초에 막지 못한다 (insufficient-cp)', () => {
    const world = duel();
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 0 } });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    expect(result).toMatchObject({ status: 'failure', reason: 'insufficient-cp' });
    expect(guardOf(world)?.guarding).toBe(false);
  });

  it('쓰러진 몸은 막지 못한다 (downed)', () => {
    const world = duel();
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'hp', value: 0 } });
    world.tick(TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'guard', stance: 'guard' });
    expect(result).toMatchObject({ status: 'failure', reason: 'downed' });
  });

  it('놓는 것은 언제나 된다 — 조건이 없다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.dispatch({ interactionId: 'attack' }); // 막는 중이라 실패한다
    world.tick(TICK_INTERVAL);

    expect(world.dispatch({ interactionId: 'guard', stance: 'open' }).status).toBe('success');
  });
});

describe('INTENT-GUARD-EXCLUSIVE-001 — 막는 자세는 시작할 수 있는 것을 좁힌다', () => {
  it('막는 동안 어떤 스킬도 시작되지 않는다 (guarding)', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    expect(world.dispatch({ interactionId: 'attack' })).toMatchObject({
      status: 'failure',
      reason: 'guarding',
    });
    expect(world.dispatch({ interactionId: 'skill-heavy' })).toMatchObject({
      status: 'failure',
      reason: 'guarding',
    });
    // 사유가 관찰에도 같은 값으로 실린다 — 판정이 한 곳이기 때문이다
    expect(interaction(world.observe(), 'attack')?.reason).toBe('guarding');
  });

  it('막는 동안 캐지도 못한다 — 관문이 하나이므로 자동으로 막힌다', () => {
    const world = driveWorld({
      npcs: [],
      actorPosition: { x: 0, z: 0 },
      depositPosition: { x: 1, z: 0 },
      actorItems: { pickaxe: 1 },
    });
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    expect(interaction(world.observe(), 'mine')?.reason).toBe('guarding');
  });

  it('달리기로 옮겨 가는 것은 막기를 놓는 것이다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(true);

    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(false);
  });

  it('막기를 세우면 달리기가 걷기로 돌아온다 — 달리며 막지 않는다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    world.tick(TICK_INTERVAL);
    expect(hud(world.observe(), 'self.moveMode')).toBe('run');

    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(hud(world.observe(), 'self.moveMode')).toBe('walk');
  });
});

describe('INTENT-DEFENSE-MITIGATION-001 — 방어력은 줄이되 0 으로 만들지 못한다', () => {
  it('막지 않아도 방어력은 언제나 걷어낸다', () => {
    const world = duel();
    swing(world);

    const strike = strikeOn(world)[0];
    expect(strike?.breakdown.base).toBe(BASIC.damage);
    expect(strike?.breakdown.mitigated).toBe(BASIC.damage - PLAYER_DEFENSE);
    expect(strike?.breakdown.guarded).toBe(false);
    expect(strike?.amount).toBe(BASIC.damage - PLAYER_DEFENSE);
  });

  it('방어력이 아무리 커도 최소한의 몫은 반드시 통과한다', () => {
    const world = duel();
    // 세계 밖의 손으로 방어력을 본래 피해보다 크게 올린다 (C007 R2 경로)
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'defense', value: 9999 } });
    world.tick(TICK_INTERVAL);

    swing(world);
    const strike = strikeOn(world)[0];
    expect(strike?.amount).toBe(BASIC.damage * MIN_DAMAGE_RATIO);
    expect(strike?.amount).toBeGreaterThan(0);
  });
});

describe('INTENT-GUARD-ABSORB-001 — 생명 대신 기력으로 받는다', () => {
  it('막아 내면 생명이 훨씬 덜 줄고 그만큼 기력이 나간다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    const before = actor(world.observe(), PLAYER)!;
    expect(swing(world)).toBe(true);
    const after = actor(world.observe(), PLAYER)!;

    const hpLoss = before.vitality!.health - after.vitality!.health;
    const cpLoss = before.attributes!.energy - after.attributes!.energy;

    expect(hpLoss).toBeCloseTo(guardedHpLoss(BASIC.damage), 10);
    expect(cpLoss).toBeCloseTo(guardedCpPaid(BASIC.damage), 10);
    // 막지 않았다면 나갔을 값보다 분명히 적다
    expect(hpLoss).toBeLessThan(mitigated(BASIC.damage));
  });

  it('피해가 사라지지 않는다 — 두 자원으로 갈릴 뿐이다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    swing(world);

    const { breakdown, amount } = strikeOn(world)[0]!;
    const absorbed = breakdown.energyPaid / GUARD_CP_PER_DAMAGE;
    expect(amount + absorbed).toBeCloseTo(breakdown.mitigated, 10);
  });

  it('큰 것을 막는 일은 더 비싸다', () => {
    // 고급 스킬 한 대는 기력 34 를 요구한다 — 시작 기력 30 으로는 막다가 무너진다.
    // 여기서 보려는 것은 "무엇이 더 비싼가" 이므로 양쪽 모두 넉넉한 기력으로 세운다.
    const ready = (world: WorldDriver) => {
      world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 100 } });
      world.dispatch({ interactionId: 'guard', stance: 'guard' });
      world.tick(TICK_INTERVAL);
    };

    const basic = duel();
    ready(basic);
    expect(swing(basic, 'attack')).toBe(true);

    const heavy = duel();
    ready(heavy);
    expect(swing(heavy, 'skill-heavy')).toBe(true);

    expect(strikeOn(heavy)[0]!.breakdown.guarded).toBe(true);

    expect(strikeOn(heavy)[0]!.breakdown.energyPaid).toBeGreaterThan(
      strikeOn(basic)[0]!.breakdown.energyPaid,
    );
    expect(strikeOn(heavy)[0]!.breakdown.energyPaid).toBeCloseTo(guardedCpPaid(HEAVY.damage), 10);
  });
});

describe('INTENT-GUARD-DIRECTION-001 — 앞쪽만 막는다', () => {
  it('뒤에서 들어온 타격은 막지 않은 것과 같다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    // 막는 자가 등을 돌린다 — 자세는 그대로 두고 몸의 방향만 바꾼다.
    // 걸음은 막는 자세에 막히지 않으므로 이것이 가능하다 (INTENT-GUARD-EXCLUSIVE-001).
    const self = positionOf(world, PLAYER);
    world.dispatch({ interactionId: 'move', position: { x: self.x - 0.02, z: self.z } });
    tickFor(world, 3 * TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(true); // 걸음이 자세를 흔들지 않았다

    expect(swing(world)).toBe(true);

    const strike = strikeOn(world).at(-1);
    expect(strike?.breakdown.guarded).toBe(false);
    expect(strike?.amount).toBe(mitigated(BASIC.damage));
  });

  it('정면에서 들어온 타격은 막힌다 — 같은 자세, 다른 방향', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    swing(world);

    expect(strikeOn(world)[0]?.breakdown.guarded).toBe(true);
  });
});

describe('INTENT-GUARD-KEEPS-THE-STANCE-001 — 막아 낸 타격은 자세를 흩뜨리지 않는다', () => {
  it('막아 내면 피격 상태로 넘어가지 않는다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    swing(world);

    expect(actor(world.observe(), PLAYER)?.state).not.toBe('hit');
    expect(guardOf(world)?.guarding).toBe(true);
  });

  it('막지 못하면 지금까지대로 피격 상태가 된다 (C007 회귀)', () => {
    const world = duel();
    swing(world);
    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');
  });

  it('막아도 몸은 밀린다 — 충격량은 막힘과 무관하다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    const before = actor(world.observe(), PLAYER)!.position.x;
    swing(world);
    expect(actor(world.observe(), PLAYER)!.position.x).toBeLessThan(before);
  });
});

describe('INTENT-GUARD-BREAK-001 — 치를 기력이 없으면 무너진다', () => {
  /** 한 번 막아 내기에 모자란 기력만 남긴다 */
  const starve = (world: WorldDriver) => {
    world.dispatch({
      interactionId: 'set-attribute',
      attribute: { id: 'cp', value: guardedCpPaid(BASIC.damage) - 0.01 },
    });
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
  };

  it('무너지면 그 타격은 막지 못한 것이 되어 본래대로 생명에서 나간다', () => {
    const world = duel();
    starve(world);
    const before = actor(world.observe(), PLAYER)!.vitality!.health;

    swing(world);

    const strike = strikeOn(world)[0]!;
    expect(strike.breakdown.guardBroken).toBe(true);
    expect(strike.breakdown.guarded).toBe(false);
    expect(strike.amount).toBe(mitigated(BASIC.damage));
    expect(before - actor(world.observe(), PLAYER)!.vitality!.health).toBe(mitigated(BASIC.damage));
  });

  it('남아 있던 기력을 마지막 대가로 다 쓴다', () => {
    const world = duel();
    starve(world);
    swing(world);
    expect(actor(world.observe(), PLAYER)!.attributes!.energy).toBe(0);
  });

  it('무너지면 자세가 풀리고 그대로 얻어맞는다', () => {
    const world = duel();
    starve(world);
    swing(world);

    expect(guardOf(world)?.guarding).toBe(false);
    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');
  });

  it('막기만 해서는 버틸 수 없다 — 이어 맞으면 결국 무너진다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    // 시작 기력 30 으로 몇 대를 막아 내는가.
    // 03 WORLD STATE 의 수치 감각 — 한 대당 기력 10.2 이므로 2대를 막고 3대째에 무너진다.
    let blocked = 0;
    let broken = false;
    for (let i = 0; i < 8 && !broken; i++) {
      const since = hud(world.observe(), 'world.time') as number;
      expect(swing(world)).toBe(true);
      const last = world.observe().strikes.filter((s) => s.targetId === PLAYER && s.since >= since).at(-1)!;
      if (last.breakdown.guardBroken) broken = true;
      else if (last.breakdown.guarded) blocked++;
      // 막을 때마다 몸이 밀리므로(충격량은 막힘과 무관하다) 사거리 안으로 다시 세운다 —
      // 이 검증의 대상은 자리가 아니라 "몇 대를 막아 내는가" 다.
      // 걸음은 막는 자세에 막히지 않으므로 자세를 놓지 않고 다시 붙을 수 있다.
      closeIn(world);
    }

    expect(blocked).toBe(2);
    expect(broken).toBe(true);
  });
});

describe('INTENT-GUARD-BREAK-AFTERMATH-001 — 무너진 여파', () => {
  const breakGuard = (world: WorldDriver) => {
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 0.01 } });
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    swing(world);
  };

  it('여파 동안 다시 막지 못한다 (guard-broken)', () => {
    const world = duel();
    breakGuard(world);

    expect(actor(world.observe(), PLAYER)?.stance?.broken).toBe(true);
    // 기력을 되돌려 줘도 막지 못한다 — 무너진 이유는 이제 여파다
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 100 } });
    world.tick(TICK_INTERVAL);
    expect(world.dispatch({ interactionId: 'guard', stance: 'guard' })).toMatchObject({
      status: 'failure',
      reason: 'guard-broken',
    });
  });

  it('여파는 스스로 가신다 — 되돌리기 위해 할 일이 없다', () => {
    const world = duel();
    breakGuard(world);
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 100 } });

    tickFor(world, GUARD_BREAK_LOCK + 2 * TICK_INTERVAL);

    expect(actor(world.observe(), PLAYER)?.stance?.broken).toBe(false);
    expect(world.dispatch({ interactionId: 'guard', stance: 'guard' }).status).toBe('success');
  });

  it('여파가 언제 가시는지가 관찰된다', () => {
    const world = duel();
    breakGuard(world);

    const view = world.observe();
    const brokenUntil = actor(view, PLAYER)!.stance!.brokenUntil;
    const now = hud(view, 'world.time') as number;
    expect(brokenUntil - now).toBeGreaterThan(0);
    expect(brokenUntil - now).toBeLessThanOrEqual(GUARD_BREAK_LOCK);
  });
});

describe('INTENT-DOWNED-001 (C010 CHANGED) — 쓰러진 몸에는 자세가 남지 않는다', () => {
  it('막고 있다가 쓰러지면 자세가 풀린다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    expect(guardOf(world)?.guarding).toBe(true);

    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'hp', value: 0 } });
    world.tick(TICK_INTERVAL);

    expect(actor(world.observe(), PLAYER)?.state).toBe('downed');
    expect(guardOf(world)?.guarding).toBe(false);
  });
});

describe('INTENT-GUARD-OBSERVE-001 / INTENT-STRIKE-BREAKDOWN-001 — 관찰', () => {
  it('누가 어느 쪽을 막고 있는지 모든 관찰자가 본다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    // 때리는 쪽의 눈으로도 상대가 막고 있는 것이 보인다
    const seenByOther = actor(world.observe(OBSERVER_2), PLAYER)?.stance;
    expect(seenByOther?.guarding).toBe(true);
    expect(seenByOther?.facing).toEqual(actor(world.observe(), PLAYER)?.body?.facing);
  });

  it('막을 수 있는지와 그 사유가 자기 눈앞에 있다', () => {
    const world = duel();
    expect(interaction(world.observe(), 'guard')?.available).toBe(true);
    expect(hud(world.observe(), 'self.stance')).toBe('open');
    expect(hud(world.observe(), 'self.defense')).toBe(PLAYER_DEFENSE);

    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 0 } });
    world.tick(TICK_INTERVAL);
    expect(interaction(world.observe(), 'guard')?.reason).toBe('insufficient-cp');
  });

  it('타격 결과에 그 값을 만든 내역이 전부 실린다', () => {
    const world = duel();
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);
    swing(world);

    const strike = strikeOn(world)[0]!;
    expect(strike.breakdown.base).toBe(BASIC.damage);
    expect(strike.breakdown.mitigated).toBe(BASIC.damage - PLAYER_DEFENSE);
    expect(strike.breakdown.guarded).toBe(true);
    expect(strike.breakdown.energyPaid).toBeCloseTo(guardedCpPaid(BASIC.damage), 10);
    expect(strike.breakdown.guardBroken).toBe(false);
    expect(strike.amount).toBeCloseTo(guardedHpLoss(BASIC.damage), 10);
    // 방어력의 몫도 내역에서 읽힌다
    expect(strike.breakdown.base - strike.breakdown.mitigated).toBe(PLAYER_DEFENSE);
  });
});

describe('DC-COMBAT-PLAYER-CAUSALITY — 같은 상태면 언제나 같은 내역', () => {
  it('같은 위치·같은 방향·같은 자세·같은 기력이면 같은 결과가 나온다', () => {
    const run = () => {
      const world = duel();
      world.dispatch({ interactionId: 'guard', stance: 'guard' });
      world.tick(TICK_INTERVAL);
      swing(world);
      return strikeOn(world)[0]!;
    };

    expect(run()).toEqual(run());
  });
});

describe('DC-COMBAT-SHARED-BUDGET — 방어가 같은 예산을 쓴다', () => {
  it('막느라 쓴 기력은 고급 스킬에 쓸 수 없다', () => {
    const world = duel();
    // 고급 스킬 한 번 분량만 있는 기력으로 시작한다
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: HEAVY.cpCost } });
    world.dispatch({ interactionId: 'guard', stance: 'guard' });
    world.tick(TICK_INTERVAL);

    swing(world); // 막느라 기력을 치른다
    world.dispatch({ interactionId: 'guard', stance: 'open' });
    world.tick(TICK_INTERVAL);

    expect(actor(world.observe(), PLAYER)!.attributes!.energy).toBeLessThan(HEAVY.cpCost);
    expect(interaction(world.observe(), 'skill-heavy')?.reason).toBe('insufficient-cp');
  });
});
