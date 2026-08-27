// C-COMBAT-004 표식 World 단독 테스트
// RULE-MARK-LEAVE-001(ADDED) · RULE-MARK-BORNE-001(ADDED) ·
// RULE-ABILITY-REQUIREMENT-001(CHANGED) · RULE-SKILL-BEGIN-001(CHANGED) ·
// RULE-SWING-STRIKE-001(CHANGED)
//
// Implements INTENT-A-MARK-RESTS-ON-THE-OTHER-001 · INTENT-THE-MARK-CLOSES-BY-ITSELF-001 ·
//            INTENT-A-BLOW-THAT-LEAVES-INSTEAD-OF-HURTS-001 · INTENT-LEAVING-IS-OBSERVED-001 ·
//            INTENT-THE-GATE-SEES-THE-CHOSEN-ONE-001 · INTENT-THE-MARK-IS-A-CIRCUMSTANCE-001 ·
//            INTENT-THE-MARK-IS-READ-ON-THE-STRUCK-001 · INTENT-THE-BORNE-IS-SEEN-BY-BOTH-001 ·
//            INTENT-THE-MARK-EXPLAINS-THE-DIFFERENCE-001 · INTENT-MARKS-DO-NOT-PILE-UP-001 ·
//            INTENT-THE-MARK-DOES-NOT-ASK-WHO-DRIVES-001
//
// 기대값은 숫자로 박는다 — 근거는 03-world-semantic.md 의 BALANCE 다.
//
// 기준 배치
//   관찰자 rabbit-swordsman  AuraAtk 40 · 오라 관통 60 · Hp 200 · Cp 100(시작 30)
//   자율 존재 wanderer       Resist 90 · Armor 30 · Hp 120 · 배분 balanced
//   hatsu 배분의 AuraAtk      64 · 걷힌 오라 방어 56.25 → 감쇄 0.64

import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { borneMarks, isMarkedBy, MARK_DURATION } from '../semantic/mark';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import { ABILITY_CIRCUMSTANCES, EMPTY_NOW } from '../semantic/circumstance';
import { spawnActor } from '../semantic/spawn';
import { ruleMarkLeave } from '../rules/mark-leave';
import { ruleAbilityRequirement } from '../rules/ability-circumstance';
import { evaluateSkillPreconditions } from '../rules/skill';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, selectTarget, type WorldDriver } from './drive';

const MARK = SKILL_DEFINITIONS['mark-strike'];
const AFTER_SWING_OPEN = MARK.swingBegin * MARK.baseDuration + 2 * TICK_INTERVAL;
const HATSU = SKILL_DEFINITIONS['hatsu-burst'];
const AFTER_HATSU_OPEN = HATSU.swingBegin * HATSU.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 64 };
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
  guardedGround: WHOLE_STAGE,
});

const actorOf = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const skill = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);
const marksOn = (w: WorldDriver, id: string) => actorOf(w.observe(), id)?.attributes?.marks;
const failureReason = (r: ActionResult) => (r.status === 'failure' ? r.reason : undefined);

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 표적 하나를 세우고 마주 본 세계. 기력은 넉넉히, 대상은 골라 둔다 */
const arena = (extra: ReturnType<typeof dummyAt>[] = []) => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0), ...extra] });
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
  setAttribute(world, 'cp', 100);
  selectTarget(world, 'npc-1');
  world.tick(TICK_INTERVAL);
  return world;
};

/** 표식을 한 대 남긴다 */
const leaveMark = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'skill-mark' });
  tickFor(world, AFTER_SWING_OPEN);
};

const body = (id = 'x') =>
  spawnActor({
    id,
    name: id,
    characterKind: 'rabbit-swordsman',
    control: 'player',
    position: { x: 0, z: 0 },
  });

// ─────────────────────────────────────────────────────────────────
describe('INTENT-A-BLOW-THAT-LEAVES-INSTEAD-OF-HURTS-001 — 피해 0 인 한 대', () => {
  it('그 기술은 피해를 한 톨도 내지 않는다 — 값이 작은 것이 아니라 0 이다', () => {
    expect(MARK.baseDamage).toBe(0);
    expect(MARK.attackRatio).toBe(0);
  });

  it('닿았는데 생명이 한 톨도 줄지 않는다', () => {
    const world = arena();
    const before = actorOf(world.observe(), 'npc-1')?.vitality?.health;
    leaveMark(world);
    expect(actorOf(world.observe(), 'npc-1')?.vitality?.health).toBe(before);
    expect(world.observe().strikes.at(-1)?.amount).toBe(0);
  });

  it('그래도 닿은 일은 타격 결과로 관찰된다 (INTENT-LEAVING-IS-OBSERVED-001)', () => {
    const world = arena();
    leaveMark(world);
    const strike = world.observe().strikes.at(-1);
    expect(strike?.skill).toBe('mark-strike');
    expect(strike?.targetId).toBe('npc-1');
    expect(strike?.breakdown.rawDamage).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-A-MARK-RESTS-ON-THE-OTHER-001 — 표식은 걸린 쪽에 남는다', () => {
  it('닿은 몸에 표식이 생기고, 남긴 자와 남긴 시각을 지닌다', () => {
    const world = arena();
    expect(marksOn(world, 'npc-1')).toEqual([]);
    leaveMark(world);
    const marks = marksOn(world, 'npc-1');
    expect(marks).toHaveLength(1);
    expect(marks?.[0]?.byId).toBe('player-1');
    expect(marks?.[0]?.since).toBeGreaterThan(0);
  });

  it('건 쪽에는 아무것도 남지 않는다 — 지목과 다른 자리다', () => {
    const world = arena();
    leaveMark(world);
    expect(marksOn(world, 'player-1')).toEqual([]);
  });

  it('다른 곳을 골라도 남아 있다 — 이것이 지목과 표식을 가르는 성질이다', () => {
    const world = arena([dummyAt(1.5, 3, 'npc-2')]);
    leaveMark(world);
    selectTarget(world, 'npc-2');
    world.tick(TICK_INTERVAL);
    expect(marksOn(world, 'npc-1')).toHaveLength(1);
  });

  it('표식은 그 자체로 아무 일도 하지 않는다 — 값도 생명도 그대로다', () => {
    const world = arena();
    const before = actorOf(world.observe(), 'npc-1');
    leaveMark(world);
    tickFor(world, 1.0);
    const after = actorOf(world.observe(), 'npc-1');
    expect(after?.vitality).toEqual(before?.vitality);
    expect(after?.attributes?.allocation).toEqual(before?.attributes?.allocation);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-MARK-CLOSES-BY-ITSELF-001 — 시간이 닫는다', () => {
  it('담기는 것은 시각 하나다 — 붙어 있는가는 매번 다시 센다', () => {
    const bearer = body('bearer');
    ruleMarkLeave(body('giver'), bearer, 10);
    expect(bearer.marks).toEqual({ giver: 10 });
    expect(isMarkedBy(bearer.marks, 'giver', 10)).toBe(true);
    expect(isMarkedBy(bearer.marks, 'giver', 10 + MARK_DURATION - 0.001)).toBe(true);
    expect(isMarkedBy(bearer.marks, 'giver', 10 + MARK_DURATION)).toBe(false);
  });

  it('닫힌 표식은 관찰에 실리지 않는다 — 지우는 규칙 없이 사라진다', () => {
    const world = arena();
    leaveMark(world);
    expect(marksOn(world, 'npc-1')).toHaveLength(1);
    tickFor(world, MARK_DURATION + 0.2);
    expect(marksOn(world, 'npc-1')).toEqual([]);
  });

  it('닫힌 뒤에도 몸이 지닌 시각은 그대로다 — 세우는 규칙만 있고 지우는 규칙이 없다', () => {
    const bearer = body('bearer');
    ruleMarkLeave(body('giver'), bearer, 10);
    expect(borneMarks(bearer.marks, 10 + MARK_DURATION + 1)).toEqual([]);
    expect(bearer.marks.giver).toBe(10); // 지워지지 않았다 — 다만 참이 아니다
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-MARKS-DO-NOT-PILE-UP-001 — 쌍마다 하나다', () => {
  it('같은 자가 다시 남기면 그 자리가 새 시각을 갖는다 — 둘이 되지 않는다', () => {
    const bearer = body('bearer');
    const giver = body('giver');
    ruleMarkLeave(giver, bearer, 10);
    ruleMarkLeave(giver, bearer, 12);
    expect(bearer.marks).toEqual({ giver: 12 });
  });

  it('다른 자가 남긴 것은 다른 자리다 — 한 몸이 여럿에게 지닐 수 있다', () => {
    const bearer = body('bearer');
    ruleMarkLeave(body('a'), bearer, 10);
    ruleMarkLeave(body('b'), bearer, 11);
    expect(borneMarks(bearer.marks, 12)).toEqual([
      { byId: 'a', since: 10 },
      { byId: 'b', since: 11 },
    ]);
  });

  it('한 휘두름이 둘에게 닿으면 둘 다에게 남는다 — 표식은 지목이 아니다', () => {
    // 두 몸을 칼끝 앞에 나란히 둔다
    const world = driveWorld({ npcs: [dummyAt(1.4, -0.4), dummyAt(1.4, 0.4, 'npc-2')] });
    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    world.tick(TICK_INTERVAL);
    setAttribute(world, 'cp', 100);
    selectTarget(world, 'npc-1');
    world.tick(TICK_INTERVAL);
    // 칼끝은 한쪽에서 다른 쪽으로 쓸고 지나가므로 휘두름이 끝날 때까지 본다
    world.dispatch({ interactionId: 'skill-mark' });
    tickFor(world, MARK.baseDuration + TICK_INTERVAL);
    expect(marksOn(world, 'npc-1')).toHaveLength(1);
    expect(marksOn(world, 'npc-2')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-GATE-SEES-THE-CHOSEN-ONE-001 — 관문이 상대를 본다', () => {
  it('아무도 고르지 않았으면 상대를 읽는 요구는 갖춰지지 않은 것이다', () => {
    const self = body();
    expect(ruleAbilityRequirement(self, 'mark-strike', EMPTY_NOW, null)).toBe(
      'already-marked-by-them',
    );
  });

  it('고른 상대에게 표식이 없으면 갖춰진 것이다', () => {
    const self = body('me');
    const other = body('them');
    expect(ruleAbilityRequirement(self, 'mark-strike', { time: 0, strikeEvents: [] }, other)).toBeNull();
  });

  it('이미 걸어 둔 상대에게는 나가지 않고 사유가 실린다', () => {
    const world = arena();
    leaveMark(world);
    tickFor(world, MARK.baseDuration); // 휘두름이 끝나기를 기다린다
    const result = world.dispatch({ interactionId: 'skill-mark' });
    expect(result.status).toBe('failure');
    expect(failureReason(result)).toBe('already-marked-by-them');
  });

  it('표식이 닫히면 다시 걸 수 있다 — 닫는 규칙 없이 열린다', () => {
    const world = arena();
    leaveMark(world);
    tickFor(world, MARK_DURATION + 0.2);
    expect(skill(world.observe(), 'skill-mark')?.available).toBe(true);
  });

  it('상대를 읽지 않는 요구는 넘어온 상대가 무엇이든 같은 답이다 (회귀)', () => {
    const self = body('me');
    const other = body('them');
    expect(evaluateSkillPreconditions(self, 'hatsu-burst', EMPTY_NOW, null)).toBe(
      'power-not-in-ability',
    );
    expect(evaluateSkillPreconditions(self, 'hatsu-burst', EMPTY_NOW, other)).toBe(
      'power-not-in-ability',
    );
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-MARK-IS-A-CIRCUMSTANCE-001 — 표식은 사정이다', () => {
  it('목록에 항목이 둘 늘었을 뿐이다 — 서로의 부정이다', () => {
    const ids = ABILITY_CIRCUMSTANCES.map((c) => c.id);
    expect(ids).toContain('bears-my-mark');
    expect(ids).toContain('no-mark-of-mine-yet');

    const bearer = body('bearer');
    const giver = body('giver');
    ruleMarkLeave(giver, bearer, 0);
    const now = { time: 1, strikeEvents: [] };
    const bears = ABILITY_CIRCUMSTANCES.find((c) => c.id === 'bears-my-mark')!;
    const notYet = ABILITY_CIRCUMSTANCES.find((c) => c.id === 'no-mark-of-mine-yet')!;
    expect(bears.holds(giver, bearer, now)).toBe(true);
    expect(notYet.holds(giver, bearer, now)).toBe(false);
  });

  it('`hatsu-burst` 는 표식을 **조건**으로 진다 — 요구가 아니다 (회귀의 근거)', () => {
    expect(HATSU.requires).toEqual(['power-in-ability']);
    expect(HATSU.amplifiedBy.map((s) => s.circumstance)).toContain('bears-my-mark');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-MARK-IS-READ-ON-THE-STRUCK-001 — 표식이 다음을 바꾼다', () => {
  it('표식 없이 친 발현 일격이 60 이다 (C-COMBAT-003 그대로)', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    world.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(world, AFTER_HATSU_OPEN);
    expect(world.observe().strikes.at(-1)?.amount).toBe(60);
  });

  it('표식을 남긴 뒤 친 같은 기술이 80 이다 — 한 대를 치르고 20 을 얻는다', () => {
    const world = arena();
    leaveMark(world);
    tickFor(world, MARK.baseDuration);
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    world.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(world, AFTER_HATSU_OPEN);
    expect(world.observe().strikes.at(-1)?.amount).toBe(80);
  });

  it('표식이 만든 차이가 경위에 남는다 (INTENT-THE-MARK-EXPLAINS-THE-DIFFERENCE-001)', () => {
    const world = arena();
    leaveMark(world);
    tickFor(world, MARK.baseDuration);
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    world.dispatch({ interactionId: 'skill-hatsu' });
    tickFor(world, AFTER_HATSU_OPEN);
    const breakdown = world.observe().strikes.at(-1)!.breakdown;
    expect(breakdown.conditions).toEqual([{ id: 'bears-my-mark', bonus: 0.5 }]);
    expect(breakdown.rawDamage).toBeCloseTo(125.2, 6);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-BORNE-IS-SEEN-BY-BOTH-001 — 붙은 것이 가려지지 않는다', () => {
  it('살펴보지 않은 존재의 표식도 실린다 — 겨루는 힘과 다른 자리다', () => {
    const world = arena();
    leaveMark(world);
    const npc = actorOf(world.observe(), 'npc-1');
    expect(npc?.attributes?.acquainted).toBe(false); // 아직 살펴보지 않았다
    expect(npc?.attributes?.concealed).toContain('combatStats'); // 겨루는 힘은 가려져 있다
    expect(npc?.attributes?.marks).toHaveLength(1); // 그래도 표식은 보인다
  });

  it('붙은 것이 없으면 빈 목록이 실린다 — 모름과 없음은 다른 일이다', () => {
    expect(marksOn(arena(), 'npc-1')).toEqual([]);
  });

  it('언제까지인지는 실리지 않는다 — 그것은 규칙이고 세계가 이미 답한다', () => {
    const world = arena();
    leaveMark(world);
    expect(Object.keys(marksOn(world, 'npc-1')![0]!).sort()).toEqual(['byId', 'since']);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-MARK-DOES-NOT-ASK-WHO-DRIVES-001 — 조종 주체를 묻지 않는다', () => {
  it('자율 존재가 남긴 표식도 사람의 몸에 붙는다', () => {
    const autonomous = spawnActor({
      id: 'npc-x',
      name: 'N',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 0, z: 0 },
    });
    const player = body('player-1');
    ruleMarkLeave(autonomous, player, 5);
    expect(borneMarks(player.marks, 6)).toEqual([{ byId: 'npc-x', since: 5 }]);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('REGRESSION — 표식이 없는 세계는 그대로다', () => {
  it('기존 넷은 표식을 지지 않는다', () => {
    for (const kind of ['attack', 'heavy-attack', 'aura-strike'] as const) {
      expect(SKILL_DEFINITIONS[kind].requires).toEqual([]);
      expect(SKILL_DEFINITIONS[kind].amplifiedBy).toEqual([]);
      expect(SKILL_DEFINITIONS[kind].leavesMark).toBe(false);
    }
    expect(HATSU.leavesMark).toBe(false);
  });

  it('표식을 걸지 않으면 기존 기술의 한 방이 그대로다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, 0.25 * 0.6 + 2 * TICK_INTERVAL);
    expect(world.observe().strikes.at(-1)?.amount).toBe(20);
  });

  it('`hatsu-burst` 는 배분만 갖추면 나간다 — 표식은 요구가 아니다', () => {
    const world = arena();
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hatsu' });
    expect(world.dispatch({ interactionId: 'skill-hatsu' }).status).toBe('success');
  });

  it('새 기술의 닿는 길이가 몸의 교전 거리와 어긋나지 않는다', () => {
    expect(MARK.swingReach - MARK.swingTipRadius).toBeLessThanOrEqual(2.0);
    expect(MARK.swingReach + MARK.swingTipRadius).toBeGreaterThanOrEqual(2.0);
  });
});
