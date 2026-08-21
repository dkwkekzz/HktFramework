// C019 World 단독 테스트 — Implements INTENT-SKILL-PHASE-001 ·
//   INTENT-STARTUP-IS-OBSERVABLE-001 · INTENT-CANCEL-IN-STARTUP-001 ·
//   INTENT-HIT-REACTION-001 (CHANGED) · INTENT-CANCEL-COSTS-THE-CHANCE-001 ·
//   INTENT-CANCEL-IS-OBSERVABLE-001 · INTENT-NPC-AUTONOMY-001 (CHANGED)
//
// 검증 대상은 RULE-SKILL-PHASE-001 · RULE-SKILL-CANCEL-001 과 그 둘이 바꾼 세 곳
// (RULE-HIT-001 · RULE-NPC-DECIDE-001 · Observer Projection) 이다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { WorldSetup } from '../index';
import { ruleHit } from '../rules/attack';
import { beginAction } from '../rules/action-begin';
import { skillPhase, SKILL_DEFINITIONS } from '../semantic/combat';
import { spawnActor } from '../semantic/spawn';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const HEAVY = SKILL_DEFINITIONS['heavy-attack'];

const entity = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const phaseOf = (v: GameViewSnapshot, id: string) => entity(v, id)?.actionPhase;
const skillOf = (v: GameViewSnapshot, id: string) => entity(v, id)?.state;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// 규칙을 직접 부르기 위한 최소 배치 — 두 몸과 사건 목록만 있으면 된다.
function bench() {
  const attacker = spawnActor({
    id: 'a',
    name: 'A',
    characterKind: 'rabbit-swordsman',
    control: 'player',
    position: { x: 0, z: 0 },
  });
  const target = spawnActor({
    id: 'b',
    name: 'B',
    characterKind: 'wanderer',
    control: 'autonomous',
    position: { x: 1, z: 0 },
  });
  const state = {
    time: 10,
    actors: [attacker, target],
    cancelEvents: [],
    strikeEvents: [],
    unharmedContacts: [],
  } as unknown as WorldState;
  return { attacker, target, state };
}

/** 그 기술을 시작시키고 원하는 진행도까지 시간을 밀어 둔다 */
function inSkill(actor: ActorState, kind: 'attack' | 'heavy-attack', progress: number) {
  beginAction(actor, kind);
  actor.currentAction.elapsed = actor.currentAction.duration! * progress;
}

describe('RULE-SKILL-PHASE-001 — 기술의 시간은 세 구간이다', () => {
  it('기술이 아닌 행동에는 구간이 없다', () => {
    const { target } = bench();
    expect(skillPhase(target)).toBeNull(); // idle
    beginAction(target, 'hit');
    expect(skillPhase(target)).toBeNull();
  });

  it('기본 기술은 0.25 까지 선딜, 0.75 까지 판정, 그 뒤가 후딜이다', () => {
    const { target } = bench();
    inSkill(target, 'attack', 0.1);
    expect(skillPhase(target)).toBe('startup');
    inSkill(target, 'attack', 0.5);
    expect(skillPhase(target)).toBe('active');
    inSkill(target, 'attack', 0.9);
    expect(skillPhase(target)).toBe('recovery');
  });

  it('큰 기술은 경계가 다르다 — 같은 진행도가 다른 구간이다', () => {
    const { target } = bench();
    // 0.4 는 기본 기술이면 이미 판정 중이지만 큰 기술은 아직 선딜이다
    inSkill(target, 'attack', 0.4);
    expect(skillPhase(target)).toBe('active');
    inSkill(target, 'heavy-attack', 0.4);
    expect(skillPhase(target)).toBe('startup');
  });

  it('경계에 정확히 선 순간은 이미 나간 것이다', () => {
    const { target } = bench();
    inSkill(target, 'heavy-attack', HEAVY.swingBegin);
    expect(skillPhase(target)).toBe('active');
    inSkill(target, 'heavy-attack', HEAVY.swingEnd);
    expect(skillPhase(target)).toBe('recovery');
  });

  it('큰 기술의 선딜은 기본 기술의 세 배다 — 실시간으로도 그렇다', () => {
    const basicStartup = BASIC.swingBegin * BASIC.baseDuration; // 0.15초
    const heavyStartup = HEAVY.swingBegin * HEAVY.baseDuration; // 0.45초
    expect(basicStartup).toBeCloseTo(0.15, 10);
    expect(heavyStartup).toBeCloseTo(0.45, 10);
    expect(heavyStartup).toBeGreaterThan(basicStartup);
  });
});

describe('RULE-HIT-001 (CHANGED) — 피격이 시점을 묻는다', () => {
  it('선딜 중에 맞으면 그 기술은 캔슬된다', () => {
    const { attacker, target, state } = bench();
    inSkill(target, 'heavy-attack', 0.2); // 선딜

    expect(ruleHit(state, target, attacker)).toBe('cancelled');
    expect(target.currentAction.kind).toBe('hit');
    expect(state.cancelEvents).toHaveLength(1);
    expect(state.cancelEvents[0]).toMatchObject({
      attackerId: 'a',
      targetId: 'b',
      skill: 'heavy-attack',
      time: 10,
    });
  });

  it('이미 나간 칼은 멈추지 않는다 — 판정 구간에서는 아무 일도 하지 않는다', () => {
    const { attacker, target, state } = bench();
    inSkill(target, 'heavy-attack', 0.6); // 판정
    const elapsed = target.currentAction.elapsed;

    expect(ruleHit(state, target, attacker)).toBe('uninterrupted');
    expect(target.currentAction.kind).toBe('heavy-attack');
    expect(target.currentAction.elapsed).toBe(elapsed); // 진행도도 흔들리지 않는다
    expect(state.cancelEvents).toHaveLength(0);
  });

  it('후딜 중에도 끊이지 않는다', () => {
    const { attacker, target, state } = bench();
    inSkill(target, 'heavy-attack', 0.9); // 후딜
    expect(ruleHit(state, target, attacker)).toBe('uninterrupted');
    expect(target.currentAction.kind).toBe('heavy-attack');
  });

  it('기술이 아닌 행동은 지금까지와 같다 — 그냥 끊긴다', () => {
    const { attacker, target, state } = bench();
    beginAction(target, 'mine');

    expect(ruleHit(state, target, attacker)).toBe('struck');
    expect(target.currentAction.kind).toBe('hit');
    expect(state.cancelEvents).toHaveLength(0); // 캔슬이 아니다 — 캔슬은 기술에만 있다
  });

  it('같은 개입이 시점만으로 갈린다 — 이것이 이 Cycle 의 전부다', () => {
    const early = bench();
    inSkill(early.target, 'heavy-attack', HEAVY.swingBegin - 0.01);
    const late = bench();
    inSkill(late.target, 'heavy-attack', HEAVY.swingBegin + 0.01);

    expect(ruleHit(early.state, early.target, early.attacker)).toBe('cancelled');
    expect(ruleHit(late.state, late.target, late.attacker)).toBe('uninterrupted');
  });
});

// ── 플레이 경로 ────────────────────────────────────────────────────────
// 지키는 자리를 가진 자율 존재 하나를 사거리 안에 세운다 (C018 의 적대 성립 조건).
const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 40 };
const facing: WorldSetup = {
  actorPosition: { x: 0, z: 0 },
  npcs: [
    {
      id: 'npc-1',
      position: { x: 1.6, z: 0 },
      wanderPath: [],
      perceptionRange: 9,
      guardedGround: WHOLE_STAGE,
    },
  ],
};

/** 아무도 없는 무대 — 내 기술이 방해 없이 끝까지 도는지 볼 때 쓴다 */
const alone: WorldSetup = { actorPosition: { x: 0, z: 0 }, npcs: [] };

/** 자율 존재가 큰 기술의 선딜에 들어설 때까지 굴린다 */
function tickUntilHeavyStartup(world: WorldDriver, limitSeconds = 8): boolean {
  const steps = Math.ceil(limitSeconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    world.tick(TICK_INTERVAL);
    const view = world.observe();
    if (skillOf(view, 'npc-1') === 'heavy-attack' && phaseOf(view, 'npc-1') === 'startup') {
      return true;
    }
  }
  return false;
}

describe('RULE-NPC-DECIDE-001 (CHANGED) — 자율 존재도 큰 기술을 건다', () => {
  it('모았다가 크게 걸고 다시 모은다 — 지어낸 주기가 아니라 수지의 결과다', () => {
    const world = driveWorld(facing);
    // 시작 기력 20 < 큰 기술 비용 30 이므로 처음에는 기본 기술이다.
    expect(tickUntilHeavyStartup(world)).toBe(true); // 충전한 뒤에는 큰 기술이 나온다
  });

  it('큰 기술을 거는 동안 그 구간이 관찰에 실린다', () => {
    const world = driveWorld(facing);
    expect(tickUntilHeavyStartup(world)).toBe(true);
    expect(phaseOf(world.observe(), 'npc-1')).toBe('startup');
  });
});

describe('INTENT-STARTUP-IS-OBSERVABLE-001 — 구간은 세계가 판정해 싣는다', () => {
  it('기술이 아닌 행동에는 실리지 않는다', () => {
    const world = driveWorld(alone);
    expect(phaseOf(world.observe(), PLAYER)).toBeUndefined(); // idle
  });

  it('내 기술의 구간도 같은 자리에서 읽힌다 — 규칙에 예외가 없다', () => {
    const world = driveWorld(alone);
    world.dispatch({ interactionId: 'skill-heavy' });
    world.tick(TICK_INTERVAL);
    expect(phaseOf(world.observe(), PLAYER)).toBe('startup');

    tickFor(world, HEAVY.swingBegin * HEAVY.baseDuration + 2 * TICK_INTERVAL);
    expect(phaseOf(world.observe(), PLAYER)).toBe('active');
  });

  it('후딜도 같은 자리에서 읽힌다 — 판정이 끝나도 아직 행동 중이다', () => {
    const world = driveWorld(alone);
    world.dispatch({ interactionId: 'skill-heavy' });
    // 판정이 끝난 직후이자 행동이 끝나기 전 — 후딜은 0.135초뿐이라 그 안을 겨눈다
    tickFor(world, HEAVY.swingEnd * HEAVY.baseDuration + 2 * TICK_INTERVAL);
    expect(phaseOf(world.observe(), PLAYER)).toBe('recovery');
  });

  it('방해가 없으면 큰 기술은 끝까지 나간다', () => {
    const world = driveWorld(alone);
    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, HEAVY.baseDuration + 2 * TICK_INTERVAL);
    expect(skillOf(world.observe(), PLAYER)).toBe('idle'); // 캔슬이 아니라 완주다
    expect(world.observe().cancels).toHaveLength(0);
  });

  it('고르기 전에 선딜을 안다 — profile 에 구간 경계가 실린다', () => {
    const world = driveWorld(alone);
    const view = world.observe();
    const skill = (id: string) => view.interactions.find((i) => i.id === id)?.profile;
    expect(skill('attack')).toMatchObject({ swingBegin: 0.25, swingEnd: 0.75 });
    expect(skill('skill-heavy')).toMatchObject({ swingBegin: 0.5, swingEnd: 0.85 });
    expect(skill('skill-aura')).toMatchObject({ swingBegin: 0.25, swingEnd: 0.75 });
  });
});

describe('INTENT-CANCEL-IS-OBSERVABLE-001 — 끊긴 것이 보인다', () => {
  // 사거리 안에 적대하는 자율 존재가 있으면 큰 기술의 0.45초 선딜은 그냥 지나가지
  // 않는다 — 이 Cycle 이 세운 규칙이 플레이 경로에서 실제로 도는 자리다.
  // (주체가 반대일 뿐 판정은 같은 RULE-HIT-001 이다. 사람이 상대의 선딜을 노리는 쪽은
  //  같은 규칙의 거울이며, 화면에서의 확인은 08 의 Human Play 몫이다.)
  const cancelledInPlay = () => {
    const world = driveWorld(facing);
    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, HEAVY.baseDuration + 4 * TICK_INTERVAL);
    return world;
  };

  it('선딜 중에 맞은 큰 기술은 캔슬되고 관찰에 실린다', () => {
    const view = cancelledInPlay().observe();
    expect(view.cancels.length).toBeGreaterThan(0);
    expect(view.cancels[0]).toMatchObject({
      attackerId: 'npc-1',
      targetId: PLAYER,
      skill: 'heavy-attack',
    });
  });

  it('캔슬된 기술은 판정에 이르지 못한다 — 그 피해가 세계에 없다', () => {
    const view = cancelledInPlay().observe();
    const myHeavy = view.strikes.filter(
      (s) => s.attackerId === PLAYER && s.skill === 'heavy-attack',
    );
    expect(myHeavy).toHaveLength(0); // 피해 0 이 아니라 사건 자체가 없다
  });

  it('끊은 타격 자체는 성립한 타격이다 — 둘은 같은 순간의 다른 두 사실이다', () => {
    const view = cancelledInPlay().observe();
    expect(view.strikes.some((s) => s.attackerId === 'npc-1' && s.targetId === PLAYER)).toBe(true);
  });

  it('캔슬은 타격 결과·무산된 접촉과 같은 수명을 가진다', () => {
    const world = cancelledInPlay();
    expect(world.observe().cancels.length).toBeGreaterThan(0);
    tickFor(world, 2.0); // STRIKE_EVENT_TTL 을 넘긴다
    expect(world.observe().cancels).toHaveLength(0);
  });
});
