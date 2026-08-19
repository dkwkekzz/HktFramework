// C014 Observe World 단독 테스트
// RULE-OBSERVE-BEGIN-001 · RULE-OBSERVE-COMPLETE-001 · RULE-OBSERVE-FORGET-001
// 투영 관문 (CHANGED — combatStats · versusObserver · defenseShape)
//
// Implements INTENT-OBSERVE-001 · INTENT-OBSERVE-KNOWLEDGE-001 ·
//            INTENT-UNSEEN-CAPABILITY-001 · INTENT-UNSEEN-IS-OBSERVABLE-001 ·
//            INTENT-ATTRIBUTE-OBSERVE-001(CHANGED) · INTENT-DAMAGE-TYPE-OBSERVE-001(CHANGED) ·
//            INTENT-PENETRATION-OBSERVE-001(CHANGED) · INTENT-OBSERVE-FORGET-001
//
// 기준 배치 (C013 그대로 — 이 Cycle 은 능력치를 한 값도 바꾸지 않는다)
//   관찰자 rabbit-swordsman  PhysAtk 40 · AuraAtk 40 · Armor 50 · Resist 20 · 관통 0 / 60
//   자율 존재 wanderer       PhysAtk 40 · AuraAtk 15 · Armor 30 · Resist 90 · 관통 0 / 0
//
// 기대값은 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { CONCEALABLE_ATTRIBUTE_KEYS } from '../semantic/acquaintance';
import { ACTION_DEFINITIONS } from '../semantic/action';
import { OBSERVE_RANGE, TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, type WorldDriver } from './drive';

const OBSERVE_DURATION = ACTION_DEFINITIONS.observe.duration!;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// 다가오지 않는 자율 존재 — 살펴봄 자체를 재는 테스트에서는 인지 거리를 0 으로 둔다.
// 다가오는 경우는 아래 "대가" 절이 따로 다룬다.
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const observeOf = (v: GameViewSnapshot, id: string) =>
  v.interactions.find((i) => i.id === 'observe' && i.targetEntityId === id);
const interactionOf = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);
const commandOf = (v: GameViewSnapshot, id: string) => v.commands?.find((c) => c.id === id);

const requestObserve = (world: WorldDriver, targetEntityId: string, observerId = OBSERVER) =>
  world.dispatch({ interactionId: 'observe', targetEntityId }, observerId);

const requestForget = (world: WorldDriver, targetEntityId?: string, observerId = OBSERVER) =>
  world.dispatch(
    { interactionId: 'forget-acquaintance', ...(targetEntityId ? { targetEntityId } : {}) },
    observerId,
  );

/** 살펴봄을 끝까지 마친다 */
const observeFully = (world: WorldDriver, targetEntityId: string, observerId = OBSERVER) => {
  requestObserve(world, targetEntityId, observerId);
  tickFor(world, OBSERVE_DURATION + TICK_INTERVAL);
};

describe('INTENT-UNSEEN-CAPABILITY-001 — 살펴보지 않은 존재의 겨루는 힘은 알려지지 않는다', () => {
  it('처음 마주한 존재는 겨루는 힘 세 자리가 비어 있다', () => {
    const npc = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), 'npc-1');

    expect(npc?.attributes?.acquainted).toBe(false);
    expect(npc?.attributes?.combatStats).toBeUndefined();
    expect(npc?.attributes?.versusObserver).toBeUndefined();
    expect(npc?.attributes?.defenseShape).toBeUndefined();
  });

  it('몸과 움직임에서 읽히는 것은 그대로 보인다 — 가려지는 것은 겨루는 힘뿐이다', () => {
    const npc = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), 'npc-1');

    // 이름 · 종류 · 자리 · 지금 하는 행동
    expect(npc?.name).toBe('Wanderer 1');
    expect(npc?.kind).toBe('wanderer');
    expect(npc?.position).toEqual({ x: 3, z: 0 });
    expect(npc?.state).toBe('idle');
    // 생명 · 기력 · 이동 · 템포 · 배율 · 막기
    expect(npc?.vitality).toEqual({ health: 120, healthMaximum: 120, downed: false });
    expect(npc?.attributes?.energy).toBe(20);
    expect(npc?.attributes?.energyMaximum).toBe(60);
    expect(npc?.attributes?.moveMode).toBe('walk');
    expect(npc?.attributes?.tempoStats).toEqual({
      moveSpeed: 2.5,
      runSpeedMultiplier: 1.4,
      actionSpeed: 0.85,
    });
    expect(npc?.attributes?.modifiers).toEqual({
      energyCharge: 1,
      energyConsume: 1,
      moveSpeed: 1,
      actionSpeed: 1,
    });
    expect(npc?.attributes?.guard).toEqual({ guarding: false, broken: false });
    // 몸(충돌체)도 그대로다
    expect(npc?.body?.radius).toBe(0.7);
  });

  it('자기 몸은 아무것도 가려지지 않는다 (INTENT-SELF-OBSERVE-001 무변경)', () => {
    const me = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), PLAYER);

    expect(me?.attributes?.acquainted).toBe(true);
    expect(me?.attributes?.concealed).toEqual([]);
    expect(me?.attributes?.unacquaintedReason).toBeUndefined();
    expect(me?.attributes?.combatStats).toEqual({
      physicalAttack: 40,
      auraAttack: 40,
      armor: 50,
      resistance: 20,
      armorPenetration: 0,
      resistancePenetration: 60,
      armorMultiplier: 100 / 150,
      resistanceMultiplier: 100 / 120,
      // C015 — 관찰자의 몸이다. 넷에 하나꼴로 두 배가 터진다
      criticalChance: 0.25,
      criticalDamage: 2,
    });
    expect(me?.attributes?.defenseShape).toBe('physical-tougher');
  });
});

describe('INTENT-UNSEEN-IS-OBSERVABLE-001 — 모른다는 사실이 관찰에 실린다', () => {
  it('가려진 항목의 이름과 그 사유를 세계가 밝힌다', () => {
    const npc = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), 'npc-1');

    expect(npc?.attributes?.concealed).toEqual([
      'combatStats',
      'versusObserver',
      'defenseShape',
    ]);
    expect(npc?.attributes?.unacquaintedReason).toBe('not-observed');
  });

  it('가려질 수 있는 항목의 목록은 세계가 소유한다 — 관찰에 실린 이름이 그 목록이다', () => {
    const npc = actor(driveWorld({ npcs: [dummyAt(3, 0)] }).observe(), 'npc-1');

    // View 가 자기 코드에 적는 것이 아니라 세계의 단일 출처에서 온다
    expect(npc?.attributes?.concealed).toEqual([...CONCEALABLE_ATTRIBUTE_KEYS]);
  });

  it('살펴보는 일이 존재마다 실리고, 자기 몸에도 사유와 함께 실린다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    expect(observeOf(view, 'npc-1')).toMatchObject({
      role: 'observe-character',
      available: true,
    });
    // 왜 자기는 못 하는지도 세계가 말한다
    expect(observeOf(view, PLAYER)).toMatchObject({
      available: false,
      reason: 'target-is-self',
    });
  });

  it('너무 멀면 그 사유가 실린다 — 다가가야 안다', () => {
    const far = driveWorld({ npcs: [dummyAt(OBSERVE_RANGE + 1, 0)] }).observe();
    expect(observeOf(far, 'npc-1')).toMatchObject({ available: false, reason: 'out-of-range' });

    const near = driveWorld({ npcs: [dummyAt(OBSERVE_RANGE - 0.5, 0)] }).observe();
    expect(observeOf(near, 'npc-1')?.available).toBe(true);
  });
});

describe('RULE-OBSERVE-BEGIN-001 — 살펴봄이 시작된다', () => {
  it('요청이 받아들여지고 그 행동으로 들어간다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    expect(requestObserve(world, 'npc-1')).toMatchObject({
      status: 'success',
      rule: 'RULE-OBSERVE-BEGIN-001',
    });
    world.tick(TICK_INTERVAL);
    expect(actor(world.observe(), PLAYER)?.state).toBe('observe');
  });

  it('사거리 밖은 거절된다', () => {
    const world = driveWorld({ npcs: [dummyAt(OBSERVE_RANGE + 2, 0)] });
    expect(requestObserve(world, 'npc-1')).toMatchObject({
      status: 'failure',
      reason: 'out-of-range',
    });
  });

  it('자기 몸은 살펴볼 대상이 아니다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    expect(requestObserve(world, PLAYER)).toMatchObject({
      status: 'failure',
      reason: 'target-is-self',
    });
  });

  it('세계에 없는 존재는 살펴볼 수 없다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    expect(requestObserve(world, 'npc-없음')).toMatchObject({
      status: 'failure',
      reason: 'no-such-target',
    });
  });

  it('다른 행동에 붙잡혀 있으면 시작되지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    requestObserve(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    // 살펴봄은 대체 불가능한 행동이다
    expect(requestObserve(world, 'npc-1')).toMatchObject({
      status: 'failure',
      reason: 'action-busy',
    });
  });

  it('살펴봄은 대상에게 아무 일도 하지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const before = actor(world.observe(), 'npc-1');

    observeFully(world, 'npc-1');
    const after = actor(world.observe(), 'npc-1');

    expect(after?.vitality).toEqual(before?.vitality);
    expect(after?.attributes?.energy).toBe(before?.attributes?.energy);
    expect(after?.state).toBe('idle'); // 살펴봐진 것으로 행동이 달라지지 않는다
  });
});

describe('RULE-OBSERVE-COMPLETE-001 — 끝까지 간 살펴봄이 앎을 남긴다', () => {
  it('마치면 세 자리가 열리고 그 순간의 값이 실린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.acquainted).toBe(true);
    expect(npc?.attributes?.concealed).toEqual([]);
    expect(npc?.attributes?.unacquaintedReason).toBeUndefined();
    // C012 · C013 이 낸 값이 그대로 나온다 — 이 Cycle 은 능력치를 바꾸지 않는다
    expect(npc?.attributes?.combatStats).toEqual({
      physicalAttack: 40,
      auraAttack: 15,
      armor: 30,
      resistance: 90,
      armorPenetration: 0,
      resistancePenetration: 0,
      armorMultiplier: 100 / 130,
      resistanceMultiplier: 100 / 190,
      // C015 — wanderer 는 터뜨리지 못한다. 그래서 관찰자가 맞는 값은 흔들리지 않는다
      criticalChance: 0,
      criticalDamage: 1,
    });
    // 관찰자의 오라 관통 60 이 Resistance 90 을 56.25 로 읽는다 (C013 그대로)
    expect(npc?.attributes?.versusObserver?.resistance).toBeCloseTo(90 * (100 / 160), 10);
    expect(npc?.attributes?.defenseShape).toBe('aura-tougher');
  });

  it('마치기 전에는 아직 열리지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    requestObserve(world, 'npc-1');
    tickFor(world, OBSERVE_DURATION - 2 * TICK_INTERVAL);

    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(false);
  });

  it('이미 아는 존재는 다시 살펴볼 수 없다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');

    expect(requestObserve(world, 'npc-1')).toMatchObject({
      status: 'failure',
      reason: 'already-known',
    });
    expect(observeOf(world.observe(), 'npc-1')).toMatchObject({
      available: false,
      reason: 'already-known',
    });
  });

  it('아는 것은 값을 베낀 것이 아니라 자리다 — 뒤에 값이 바뀌면 바뀐 값이 보인다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.resistance).toBe(90);

    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'resistance', value: 10 },
    });
    world.tick(TICK_INTERVAL);

    // 살펴본 때의 숫자(90)가 굳어 남지 않는다
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.resistance).toBe(10);
  });

  it('한 존재를 알아도 다른 존재는 여전히 모른다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(-3, 0, 'npc-2')] });
    observeFully(world, 'npc-1');

    const view = world.observe();
    expect(actor(view, 'npc-1')?.attributes?.acquainted).toBe(true);
    expect(actor(view, 'npc-2')?.attributes?.acquainted).toBe(false);
  });
});

describe('INTENT-OBSERVE-001 — 끝까지 가지 못하면 아무것도 알게 되지 않는다', () => {
  it('맞아서 중단되면 앎이 남지 않는다', () => {
    // 다가와 때리는 자율 존재 — 인지 거리를 열어 둔다
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: 1.5, z: 0 }, wanderPath: [], perceptionRange: 9 }],
    });
    requestObserve(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    expect(actor(world.observe(), PLAYER)?.state).toBe('observe');

    // 맞을 때까지 진행시킨다
    tickFor(world, OBSERVE_DURATION + 4 * TICK_INTERVAL);

    const me = actor(world.observe(), PLAYER);
    // 맞았다는 것과, 그래서 아무것도 얻지 못했다는 것
    expect(me?.vitality?.health).toBeLessThan(200);
    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(false);
  });
});

describe('INTENT-OBSERVE-KNOWLEDGE-001 — 앎은 보는 이의 것이다', () => {
  it('내가 안다고 다른 사람이 알게 되지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    world.join(OBSERVER_2);
    world.tick(TICK_INTERVAL);

    observeFully(world, 'npc-1', OBSERVER);

    expect(actor(world.observe(OBSERVER), 'npc-1')?.attributes?.acquainted).toBe(true);
    expect(actor(world.observe(OBSERVER_2), 'npc-1')?.attributes?.acquainted).toBe(false);
    expect(actor(world.observe(OBSERVER_2), 'npc-1')?.attributes?.combatStats).toBeUndefined();
  });

  it('다른 관찰자의 몸도 살펴봐야 그 겨루는 힘이 열린다', () => {
    const world = driveWorld({ npcs: [dummyAt(12, 12)] });
    world.join(OBSERVER_2);
    world.tick(TICK_INTERVAL);

    // 두 번째 몸은 SPAWN_POINTS[1] = (3, 2) 에 선다 — 살펴봄 거리 안이다
    const before = actor(world.observe(OBSERVER), 'player-2');
    expect(before?.attributes?.acquainted).toBe(false);

    observeFully(world, 'player-2', OBSERVER);
    expect(actor(world.observe(OBSERVER), 'player-2')?.attributes?.acquainted).toBe(true);
  });

  it('떠나도 알던 것은 남는다 — 몸이 남듯 앎도 남는다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');

    world.leave(OBSERVER);
    world.tick(TICK_INTERVAL);
    world.join(OBSERVER);
    world.tick(TICK_INTERVAL);

    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(true);
  });
});

describe('INTENT-UNSEEN-CAPABILITY-001 — 타격 경위는 가려지지 않는다', () => {
  it('모르는 상대를 쳐도 경위는 전부 실리지만, 그것이 앎이 되지는 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    // 앞을 보게 한 뒤 오라로 친다
    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    world.tick(TICK_INTERVAL);
    world.dispatch({ interactionId: 'skill-aura' });
    tickFor(world, 0.6 + TICK_INTERVAL);

    const strike = world.observe().strikes[0];
    expect(strike).toBeDefined();
    // 맞아 본 것은 겨뤄 본 것이다 — 그 타격이 마주한 방어가 경위에 그대로 있다
    expect(strike?.breakdown.defenseStat).toEqual({ name: 'resistance', value: 90 });
    expect(strike?.breakdown.penetrationStat).toEqual({
      name: 'resistancePenetration',
      value: 60,
    });
    // 그러나 그 존재를 아는 것으로 바뀌지는 않는다
    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(false);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats).toBeUndefined();
  });
});

describe('RULE-OBSERVE-FORGET-001 — 알게 된 것을 되돌린다', () => {
  it('지목한 존재 하나를 되돌린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');

    expect(requestForget(world, 'npc-1')).toMatchObject({
      status: 'success',
      rule: 'RULE-OBSERVE-FORGET-001',
    });
    world.tick(TICK_INTERVAL);

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.acquainted).toBe(false);
    expect(npc?.attributes?.concealed).toEqual([...CONCEALABLE_ATTRIBUTE_KEYS]);
    // 다시 살펴볼 수 있다 — 살펴보기 전과 후를 몇 번이고 견줄 수 있다
    expect(observeOf(world.observe(), 'npc-1')?.available).toBe(true);
  });

  it('지목하지 않으면 알고 있는 전부를 되돌린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(-3, 0, 'npc-2')] });
    observeFully(world, 'npc-1');
    observeFully(world, 'npc-2');

    requestForget(world);
    world.tick(TICK_INTERVAL);

    const view = world.observe();
    expect(actor(view, 'npc-1')?.attributes?.acquainted).toBe(false);
    expect(actor(view, 'npc-2')?.attributes?.acquainted).toBe(false);
  });

  it('모르는 존재를 되돌리려 하면 그 사유가 온다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    expect(requestForget(world, 'npc-1')).toMatchObject({
      status: 'failure',
      reason: 'not-known',
    });
  });

  it('세계가 권한을 닫아 두면 되돌릴 수 없고 그 사유가 관찰에 실린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)], debugAuthority: false });
    observeFully(world, 'npc-1');

    expect(requestForget(world, 'npc-1')).toMatchObject({
      status: 'failure',
      reason: 'debug-closed',
    });
    expect(interactionOf(world.observe(), 'forget-acquaintance')).toMatchObject({
      available: false,
      reason: 'debug-closed',
    });
  });

  it('되돌림이 세계가 싣는 요청 목록에 있다 — 계약 모양은 바뀌지 않는다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();
    const command = commandOf(view, 'forget-acquaintance');

    expect(command).toMatchObject({ effect: 'forget-acquaintance', available: true });
    expect(command?.parameters).toHaveLength(1);
    expect(command?.parameters[0]).toMatchObject({
      id: 'target',
      required: false,
      omittedMeaning: 'all-known',
    });
    // C009 가 세운 항목도 그대로 있다 — 항목이 하나 더해질 뿐이다
    expect(commandOf(view, 'set-attribute')).toBeDefined();
  });
});

describe('DC-WORLD-PLAYER-UNFIXED-PATH — 살펴봄은 관문이 아니다', () => {
  it('모르는 상대에게도 세 스킬이 그대로 가용하다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    expect(interactionOf(view, 'attack')?.available).toBe(true);
    expect(interactionOf(view, 'skill-aura')?.available).toBe(true);
    expect(interactionOf(view, 'guard-begin')?.available).toBe(true);
  });

  it('내 스킬 값(profile)은 내 것이므로 살펴봄과 무관하게 실린다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    // rawDamage 는 내 공격 능력으로 계산된다 — 상대를 몰라도 알 수 있다
    expect(interactionOf(view, 'skill-aura')?.profile?.rawDamage).toBe(6 + 40 * 0.5);
  });
});

describe('03 BALANCE — 두 수가 함께 만드는 국면', () => {
  it('살펴봄은 기본 스킬보다 길고 채굴보다 짧다', () => {
    expect(OBSERVE_DURATION).toBe(1.0);
    expect(OBSERVE_DURATION).toBeGreaterThan(ACTION_DEFINITIONS.attack.duration!);
    expect(OBSERVE_DURATION).toBeLessThan(ACTION_DEFINITIONS.mine.duration!);
  });

  it('살펴봄 거리는 사거리보다 멀고 인지 거리보다 가깝다', () => {
    // 두 종류의 사거리 2.0 · 인지 거리 9.0 (character-catalog)
    expect(OBSERVE_RANGE).toBeGreaterThan(2.0);
    expect(OBSERVE_RANGE).toBeLessThan(9.0);
  });

  it('최대 거리에서 시작한 살펴봄은 다가오는 상대가 붙기 전에 끝난다', () => {
    // wanderer 는 2.5/초로 3.0 을 좁히는 데 1.2 초 — 살펴봄은 1.0 초다
    const closingTime = (OBSERVE_RANGE - 2.0) / 2.5;
    expect(OBSERVE_DURATION).toBeLessThan(closingTime);

    const world = driveWorld({
      npcs: [
        { id: 'npc-1', position: { x: OBSERVE_RANGE, z: 0 }, wanderPath: [], perceptionRange: 9 },
      ],
    });
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(true);
  });
});
