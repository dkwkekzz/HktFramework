// C011 막기 World 단독 테스트
// RULE-GUARD-BEGIN-001 · RULE-GUARD-RELEASE-001 · RULE-GUARD-BLOCK-001 ·
// RULE-STRIKE-DAMAGE-001(CHANGED) · RULE-SKILL-BEGIN-001(CHANGED) · RULE-MOVE-MODE-001(CHANGED)
//
// Implements INTENT-GUARD-STANCE-001 · INTENT-GUARD-GATE-001 · INTENT-GUARD-RESTRICT-001 ·
//            INTENT-GUARD-DIRECTION-001 · INTENT-GUARD-MITIGATE-001 · INTENT-GUARD-COST-001 ·
//            INTENT-GUARD-IMPACT-KEPT-001 · INTENT-GUARD-COLLAPSE-001 ·
//            INTENT-GUARD-OBSERVE-001 · INTENT-GUARD-BREAKDOWN-001 ·
//            INTENT-GUARD-COMMANDABLE-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준 배치 (둘 다 rabbit-swordsman): Attack 40 · Defense 50 · hp 200 · cp 30
//   기본 스킬 한 방  raw = 6 + 40×0.5 = 26 → 26 × 100/150 = 17.33 → FinalDamage 17
//   막았을 때        applied = round(17 × 0.5) = 9,  cost = ceil(17 × 0.6) = 11

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../domains/combat/swing';
import { GUARD_BREAK_RECOVERY, SKILL_DEFINITIONS } from '../domains/combat/combat';
import { spawnActor } from '../base/spawn';
import { TICK_INTERVAL } from '../base/world-state';
import { ruleGuardBegin, ruleGuardBlock, ruleGuardRelease } from '../domains/combat/guard';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const FINAL = 17; // 막지 않았을 때 들어오는 값
const APPLIED = 9; // 막았을 때 들어오는 값
const COST = 11; // 그 대가로 치르는 기력

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const interaction = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;

// ── 규칙 단독 검증용 몸 ────────────────────────────────────────────────
// Before 상태를 직접 세운다 — 규칙의 산술과 방향 판정만 보기 위해서다.
const body = (x: number, z: number, facing = { x: 1, z: 0 }) => {
  const a = spawnActor({
    id: 'a',
    name: 'A',
    characterKind: 'rabbit-swordsman',
    control: 'player',
    position: { x, z },
  });
  a.facing = facing;
  return a;
};

describe('RULE-GUARD-BEGIN-001 — 막기를 드는 조건 (INTENT-GUARD-GATE-001)', () => {
  it('쓰러지지 않았고 기력이 있으면 막기가 든다', () => {
    const a = body(0, 0);
    expect(ruleGuardBegin(a, 0)).toEqual({ status: 'success', rule: 'RULE-GUARD-BEGIN-001' });
    expect(a.guarding).toBe(true);
  });

  it('치를 기력이 하나도 없으면 들지 못하고 사유가 남는다', () => {
    const a = body(0, 0);
    a.cp = 0;
    expect(ruleGuardBegin(a, 0)).toEqual({
      status: 'failure',
      rule: 'RULE-GUARD-BEGIN-001',
      reason: 'insufficient-cp',
    });
    expect(a.guarding).toBe(false);
  });

  it('쓰러진 몸은 막지 못한다', () => {
    const a = body(0, 0);
    a.hp = 0;
    expect(ruleGuardBegin(a, 0)).toMatchObject({ status: 'failure', reason: 'downed' });
  });

  it('무너진 직후에는 다시 들지 못하고, 회복 시간이 지나면 다시 든다', () => {
    const a = body(0, 0);
    a.guardBrokenUntil = 5;
    expect(ruleGuardBegin(a, 4.9)).toMatchObject({ status: 'failure', reason: 'guard-broken' });
    expect(ruleGuardBegin(a, 5)).toMatchObject({ status: 'success' });
  });

  it('이미 막고 있을 때 다시 걸어도 거절이 아니다 — 요청은 토글이 아니라 명시값이다', () => {
    const a = body(0, 0);
    ruleGuardBegin(a, 0);
    expect(ruleGuardBegin(a, 0)).toMatchObject({ status: 'success' });
    expect(a.guarding).toBe(true);
  });

  it('달리는 중에 막기를 들면 걷기로 내려온다 (INTENT-GUARD-RESTRICT-001)', () => {
    const a = body(0, 0);
    a.moveMode = 'run';
    ruleGuardBegin(a, 0);
    expect(a.moveMode).toBe('walk');
  });

  it('놓는 데에는 조건이 없다', () => {
    const a = body(0, 0);
    ruleGuardBegin(a, 0);
    expect(ruleGuardRelease(a)).toMatchObject({ status: 'success' });
    expect(a.guarding).toBe(false);
    // 막고 있지 않을 때 놓아도 거절이 아니다
    expect(ruleGuardRelease(a)).toMatchObject({ status: 'success' });
  });
});

describe('RULE-GUARD-BLOCK-001 — 막힌 타격 (INTENT-GUARD-MITIGATE-001 · COST)', () => {
  /** 대상은 원점에서 +x 를 보고, 공격자는 그 방향에 선다 */
  const frontalPair = () => {
    const target = body(0, 0, { x: 1, z: 0 });
    const attacker = body(2, 0);
    return { target, attacker };
  };

  it('막으면 절반만 들어가고 그만큼 기력을 치른다', () => {
    const { target, attacker } = frontalPair();
    ruleGuardBegin(target, 0);

    const result = ruleGuardBlock(target, attacker, FINAL, 0);

    expect(result.appliedDamage).toBe(APPLIED);
    expect(result.outcome).toEqual({
      blocked: true,
      broken: false,
      cpPaid: COST,
      prevented: FINAL - APPLIED,
    });
    expect(target.cp).toBe(30 - COST);
    expect(target.guarding).toBe(true); // 막았을 뿐 자세는 유지된다
  });

  it('큰 것을 막을수록 크게 치른다', () => {
    const small = frontalPair();
    ruleGuardBegin(small.target, 0);
    ruleGuardBlock(small.target, small.attacker, 10, 0); // ceil(6) = 6

    const big = frontalPair();
    big.target.cp = 100;
    ruleGuardBegin(big.target, 0);
    ruleGuardBlock(big.target, big.attacker, 50, 0); // ceil(30) = 30

    expect(30 - small.target.cp).toBe(6);
    expect(100 - big.target.cp).toBe(30);
  });

  it('막기가 아무리 잘 들어도 최소한의 피해는 통과한다', () => {
    const { target, attacker } = frontalPair();
    ruleGuardBegin(target, 0);
    // 1 × 0.5 = 0.5 → 반올림하면 1 이지만, 0 이 되는 경우를 하한이 막는다
    expect(ruleGuardBlock(target, attacker, 1, 0).appliedDamage).toBe(1);
  });

  it('애초에 낼 피해가 없으면 없는 피해를 만들지 않는다', () => {
    const { target, attacker } = frontalPair();
    ruleGuardBegin(target, 0);
    expect(ruleGuardBlock(target, attacker, 0, 0).appliedDamage).toBe(0);
  });

  it('같은 조건이면 언제나 같은 결과다 — 우연이 없다', () => {
    const runOnce = () => {
      const { target, attacker } = frontalPair();
      ruleGuardBegin(target, 0);
      return ruleGuardBlock(target, attacker, FINAL, 0);
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('RULE-GUARD-BLOCK-001 — 앞쪽만 막는다 (INTENT-GUARD-DIRECTION-001)', () => {
  const strikeFrom = (fx: number, fz: number) => {
    const target = body(0, 0, { x: 1, z: 0 }); // +x 를 본다
    const attacker = body(fx, fz);
    ruleGuardBegin(target, 0);
    return ruleGuardBlock(target, attacker, FINAL, 0);
  };

  it('정면에서 온 타격은 막힌다', () => {
    expect(strikeFrom(2, 0).outcome?.blocked).toBe(true);
  });

  it('정면 ±60° 안이면 막힌다', () => {
    // 60° 경계 안쪽 (dot = cos 45° ≈ 0.707)
    expect(strikeFrom(2, 2).outcome?.blocked).toBe(true);
  });

  it('옆에서 온 타격은 막지 않은 것과 같다', () => {
    const result = strikeFrom(0, 2); // dot = 0
    expect(result.outcome).toBeNull();
    expect(result.appliedDamage).toBe(FINAL);
  });

  it('뒤에서 온 타격은 막지 않은 것과 같고 기력도 치르지 않는다', () => {
    const target = body(0, 0, { x: 1, z: 0 });
    const attacker = body(-2, 0);
    ruleGuardBegin(target, 0);

    const result = ruleGuardBlock(target, attacker, FINAL, 0);

    expect(result.outcome).toBeNull();
    expect(result.appliedDamage).toBe(FINAL);
    expect(target.cp).toBe(30); // 한 방울도 치르지 않는다
    expect(target.guarding).toBe(true); // 자세는 그대로다 — 무너진 것이 아니다
  });

  it('막고 있지 않으면 정면이어도 그대로 들어간다', () => {
    const target = body(0, 0, { x: 1, z: 0 });
    const attacker = body(2, 0);

    const result = ruleGuardBlock(target, attacker, FINAL, 0);

    expect(result.outcome).toBeNull();
    expect(result.appliedDamage).toBe(FINAL);
    expect(target.cp).toBe(30);
  });
});

describe('RULE-GUARD-BLOCK-001 — 무너짐 (INTENT-GUARD-COLLAPSE-001)', () => {
  const guardedTarget = (cp: number) => {
    const target = body(0, 0, { x: 1, z: 0 });
    target.cp = cp;
    ruleGuardBegin(target, 0);
    return { target, attacker: body(2, 0) };
  };

  it('치를 기력이 모자라면 무너지고 그 타격은 온전히 들어간다', () => {
    const { target, attacker } = guardedTarget(COST - 1);

    const result = ruleGuardBlock(target, attacker, FINAL, 3);

    expect(result.appliedDamage).toBe(FINAL); // 줄지 않았다
    expect(result.outcome).toEqual({ blocked: false, broken: true, cpPaid: 0, prevented: 0 });
    expect(target.guarding).toBe(false); // 자세가 풀린다
    expect(target.cp).toBe(COST - 1); // 낼 수 없었으므로 내지 않는다
  });

  it('무너지면 잠시 다시 막을 수 없다', () => {
    const { target, attacker } = guardedTarget(COST - 1);
    ruleGuardBlock(target, attacker, FINAL, 3);

    expect(target.guardBrokenUntil).toBe(3 + GUARD_BREAK_RECOVERY);
    expect(ruleGuardBegin(target, 3.5)).toMatchObject({ reason: 'guard-broken' });
    expect(ruleGuardBegin(target, 4.1)).toMatchObject({ status: 'success' });
  });

  it('부분적으로 막아 주지 않는다 — 막았거나 무너졌거나 둘 중 하나다', () => {
    const exact = guardedTarget(COST); // 딱 맞게 있으면 막는다
    expect(ruleGuardBlock(exact.target, exact.attacker, FINAL, 0).outcome?.blocked).toBe(true);

    const short = guardedTarget(COST - 1); // 하나 모자라면 무너진다
    expect(ruleGuardBlock(short.target, short.attacker, FINAL, 0).outcome?.broken).toBe(true);
  });

  it('계속 막으면 기력이 말라 결국 무너진다 (두 번 막고 세 번째에 무너진다)', () => {
    const { target, attacker } = guardedTarget(30);

    const first = ruleGuardBlock(target, attacker, FINAL, 0);
    const second = ruleGuardBlock(target, attacker, FINAL, 1);
    const third = ruleGuardBlock(target, attacker, FINAL, 2);

    expect([first.outcome?.blocked, second.outcome?.blocked]).toEqual([true, true]);
    expect(target.cp).toBe(30 - COST - COST); // 8 남는다 — 한 번 더 치를 수 없다
    expect(third.outcome?.broken).toBe(true);
    expect(third.appliedDamage).toBe(FINAL);
  });
});

describe('INTENT-GUARD-RESTRICT-001 — 막는 동안의 제약', () => {
  it('막고 있으면 스킬이 시작되지 않고 사유가 guarding 이다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatch({ interactionId: 'guard-begin' });

    expect(world.dispatch({ interactionId: 'attack' })).toMatchObject({
      status: 'failure',
      reason: 'guarding',
    });
    expect(world.dispatch({ interactionId: 'skill-heavy' })).toMatchObject({
      status: 'failure',
      reason: 'guarding',
    });
    expect(interaction(world.observe(), 'attack')?.reason).toBe('guarding');
  });

  it('놓으면 다시 휘두를 수 있다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatch({ interactionId: 'guard-begin' });
    world.dispatch({ interactionId: 'guard-release' });

    expect(world.dispatch({ interactionId: 'attack' })).toMatchObject({ status: 'success' });
  });

  it('막으면서 걸을 수 있다 — 막기는 행동 자리를 쓰지 않는다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatch({ interactionId: 'guard-begin' });

    expect(world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } })).toMatchObject({
      status: 'success',
    });
    world.tick(TICK_INTERVAL);

    const me = actor(world.observe(), PLAYER);
    expect(me?.state).toBe('move'); // 행동은 걷기
    expect(me?.attributes?.guard.guarding).toBe(true); // 그러면서 막고 있다
  });

  it('달리기를 걸면 막기가 풀린다 — 같은 기력을 두 곳에 걸 수 없다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatch({ interactionId: 'guard-begin' });

    expect(world.dispatch({ interactionId: 'move-mode', mode: 'run' })).toMatchObject({
      status: 'success',
    });
    expect(actor(world.observe(), PLAYER)?.attributes?.guard.guarding).toBe(false);
  });
});

describe('INTENT-GUARD-OBSERVE-001 · COMMANDABLE — 세계가 밝힌다', () => {
  it('막고 있는지가 모든 존재에 대해 관찰된다', () => {
    const world = driveWorld();
    const view = world.observe();

    expect(actor(view, PLAYER)?.attributes?.guard).toEqual({ guarding: false, broken: false });
    // 자율 존재는 막지 않지만 값은 실린다 — "아무도 안 막는다" 와 "안 알려준다" 는 다르다
    expect(actor(view, 'npc-1')?.attributes?.guard).toEqual({ guarding: false, broken: false });
  });

  it('막기를 걸 수 있다는 것과 그 조건을 세계가 싣는다', () => {
    const world = driveWorld({ npcs: [] });
    const view = world.observe();

    expect(interaction(view, 'guard-begin')).toEqual({
      id: 'guard-begin',
      role: 'guard-begin',
      available: true,
    });
    expect(interaction(view, 'guard-release')).toEqual({
      id: 'guard-release',
      role: 'guard-release',
      available: true,
    });
  });

  it('막을 수 없으면 그 사유가 관찰 결과에 실린다', () => {
    const world = driveWorld({ npcs: [], debugAuthority: true });
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 0 } });

    const begin = interaction(world.observe(), 'guard-begin');
    expect(begin?.available).toBe(false);
    expect(begin?.reason).toBe('insufficient-cp');
  });

  it('내 막기 상태가 늘 눈앞에 있다', () => {
    const world = driveWorld({ npcs: [] });
    expect(hud(world.observe(), 'self.guard.guarding')).toBe(false);

    world.dispatch({ interactionId: 'guard-begin' });
    world.tick(TICK_INTERVAL);

    expect(hud(world.observe(), 'self.guard.guarding')).toBe(true);
    expect(hud(world.observe(), 'self.guard.broken')).toBe(false);
  });
});

describe('RULE-STRIKE-DAMAGE-001 (CHANGED) — 실제 타격에서 막기가 작동한다', () => {
  /**
   * 관찰자 둘. player-2 가 (3,2) 에서 (1.5,0) 으로 걸어와 서면
   * 그 걸음 방향이 곧 몸이 향한 방향이고, 그 방향은 (0,0) 의 player-1 쪽이다
   * (dot ≈ 0.6 ≥ 0.5 — 정면). player-1 은 +x 로 한 걸음 떼어 player-2 를 본 뒤 휘두른다.
   */
  const facingDuel = () => {
    const world = driveWorld({ npcs: [] });
    world.join(OBSERVER_2);
    world.tick(TICK_INTERVAL);

    world.dispatch({ interactionId: 'move', position: { x: 1.5, z: 0 } }, OBSERVER_2);
    tickFor(world, 6); // 도착할 때까지

    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } }, OBSERVER);
    world.tick(TICK_INTERVAL);
    return world;
  };

  const swing = (world: WorldDriver) => {
    world.dispatch({ interactionId: 'attack' }, OBSERVER);
    tickFor(world, AFTER_SWING_OPEN);
    return world.observe().strikes.find((s) => s.targetId === PLAYER_2);
  };

  it('막지 않으면 C010 그대로다 — 경위에 막기가 실리지 않는다', () => {
    const world = facingDuel();
    const strike = swing(world);

    expect(strike?.amount).toBe(FINAL);
    expect(strike?.breakdown.finalDamage).toBe(FINAL);
    expect(strike?.breakdown.appliedDamage).toBe(FINAL);
    expect(strike?.breakdown.guard).toBeUndefined();
    expect(actor(world.observe(), PLAYER_2)?.vitality?.health).toBe(200 - FINAL);
  });

  it('막으면 생명이 덜 줄고 기력이 그만큼 줄어든다 — 맞바꾼 것이다', () => {
    const world = facingDuel();
    world.dispatch({ interactionId: 'guard-begin' }, OBSERVER_2);

    const strike = swing(world);
    const target = actor(world.observe(), PLAYER_2);

    expect(strike?.amount).toBe(APPLIED);
    expect(strike?.breakdown.finalDamage).toBe(FINAL); // 막지 않았다면 이만큼이었다
    expect(strike?.breakdown.appliedDamage).toBe(APPLIED);
    expect(strike?.breakdown.guard).toEqual({
      blocked: true,
      broken: false,
      cpPaid: COST,
      prevented: FINAL - APPLIED,
    });
    expect(target?.vitality?.health).toBe(200 - APPLIED);
    expect(target?.attributes?.energy).toBe(30 - COST);
  });

  it('막아도 몸은 밀린다 (INTENT-GUARD-IMPACT-KEPT-001)', () => {
    const world = facingDuel();
    world.dispatch({ interactionId: 'guard-begin' }, OBSERVER_2);
    swing(world);

    const pushed = actor(world.observe(), PLAYER_2)?.body?.velocity;
    expect(pushed?.x).toBeGreaterThan(0); // 휘두른 몸에서 멀어지는 쪽으로 밀렸다
  });

  it('막아도 하던 행동은 끊긴다 — 피격 반응은 그대로다', () => {
    const world = facingDuel();
    world.dispatch({ interactionId: 'guard-begin' }, OBSERVER_2);
    swing(world);

    expect(actor(world.observe(), PLAYER_2)?.state).toBe('hit');
  });
});

describe('REGRESSION — 막지 않는 세계는 C007·C010 그대로다', () => {
  it('아무도 막지 않으면 타격 결과가 C010 과 같다', () => {
    // C010 damage.spec 의 기준값 — 관찰자(Attack 40)가 npc-1(Defense 30)을 친다
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: 1.5, z: 0 }, wanderPath: [], perceptionRange: 0 }],
    });
    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    world.tick(TICK_INTERVAL);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);

    const strike = world.observe().strikes[0];
    expect(strike?.amount).toBe(20); // C010 과 같은 값
    expect(strike?.breakdown.appliedDamage).toBe(20);
    expect(strike?.breakdown.guard).toBeUndefined();
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - 20);
  });
});
