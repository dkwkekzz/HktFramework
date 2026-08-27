// C-COMBAT-001 힘의 배분 World 단독 테스트
// RULE-ALLOCATION-SET-001(ADDED) · RULE-NPC-ALLOCATION-001(ADDED) ·
// RULE-EFFECTIVE-STATS-001(CHANGED) · RULE-INSIGHT-REVEAL-001(CHANGED)
//
// Implements INTENT-BODY-HAS-AN-ALLOCATION-001 · INTENT-THE-SHARES-SUM-THE-SAME-001 ·
//            INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001 ·
//            INTENT-ALLOCATION-ENTERS-THE-EFFECTIVE-VALUE-001 ·
//            INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001 · INTENT-CHANGE-ALLOCATION-001 ·
//            INTENT-CHANGE-ALLOCATION-REFUSAL-001 · INTENT-ALLOCATION-IS-OBSERVED-001 ·
//            INTENT-DAMAGE-BREAKDOWN-001 · INTENT-AUTONOMOUS-BODIES-ALLOCATE-001 ·
//            INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 · INTENT-INSIGHT-001
//
// 기대값은 공식을 다시 계산하지 않고 **숫자로 박는다** — 구현을 구현으로 검사하지 않기
// 위해서다 (C015 가 세운 방식 그대로). 근거는 03-world-semantic.md 의 BALANCE 다.
//
// 기준 배치
//   관찰자 rabbit-swordsman  PhysAtk 40 · AuraAtk 40 · Armor 50 · Resist 20 · Insight 0
//   자율 존재 wanderer       PhysAtk 40 · AuraAtk 15 · Armor 30 · Resist 90 · Hp 120 · Cp 20
//   배분 몫 한 점             몸 PhysAtk 8 · Armor 10 · Resist 6 / 능력 AuraAtk 12 / 인지 Insight 20
//   바꾸는 대가               기력 15

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  ALLOCATION_CATALOG,
  ALLOCATION_EVEN_SHARE,
  ALLOCATION_IDS,
  ALLOCATION_SHARE_TOTAL,
  ALLOCATION_SWITCH_CP_COST,
  allocationContribution,
  type AllocationId,
} from '../semantic/allocation';
import { DEFAULT_SWING_BEGIN, effectiveStat, SKILL_DEFINITIONS } from '../semantic/combat';
import { spawnActor } from '../semantic/spawn';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = DEFAULT_SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

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
const choice = (v: GameViewSnapshot, id: string) => v.allocations.find((a) => a.id === id);

const setAllocation = (world: WorldDriver, allocationId: string) =>
  world.dispatch({ interactionId: 'set-allocation', allocationId });

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

/** 표적 하나를 세우고 관찰자가 마주 보게 한 세계 */
const arena = () => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
  aimRight(world);
  return world;
};

/** 기본 스킬로 한 번 친 뒤 그 타격의 경위를 돌려준다 */
const strikeOnce = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'attack' });
  tickFor(world, AFTER_SWING_OPEN);
  return world.observe().strikes.at(-1)!.breakdown;
};

const body = (kind: string) =>
  spawnActor({ id: 'x', name: 'X', characterKind: kind, control: 'player', position: { x: 0, z: 0 } });

// ─────────────────────────────────────────────────────────────────
describe('INTENT-BODY-HAS-AN-ALLOCATION-001 — 몸에 지금의 배분이 있다', () => {
  it('어떤 몸이든 태어날 때 정확히 하나를 지닌다 — 비어 있는 값이 없다', () => {
    expect(body('rabbit-swordsman').allocation).toBe('balanced');
    expect(body('wanderer').allocation).toBe('balanced');
    // 미등록 종류도 마찬가지다 — 배분은 종류가 정하는 값이 아니기 때문이다
    expect(body('unknown-kind').allocation).toBe('balanced');
  });

  it('세계가 지닌 목록이며 판정은 그 이름을 조건으로 삼지 않는다', () => {
    expect(ALLOCATION_IDS).toEqual(['balanced', 'reinforce', 'hatsu', 'hunter']);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-SHARES-SUM-THE-SAME-001 — 몰면 그만큼 다른 쪽이 얇아진다', () => {
  it('어느 배분이든 세 몫의 합이 같다 — 검사가 아니라 생김새다', () => {
    for (const id of ALLOCATION_IDS) {
      const s = ALLOCATION_CATALOG[id];
      expect(s.body + s.ability + s.awareness).toBe(ALLOCATION_SHARE_TOTAL);
    }
  });

  it('한 축에 몰면 나머지 두 축이 고른 몫 아래로 내려간다', () => {
    const r = ALLOCATION_CATALOG.reinforce;
    expect(r.body).toBeGreaterThan(ALLOCATION_EVEN_SHARE);
    expect(r.ability).toBeLessThan(ALLOCATION_EVEN_SHARE);
    expect(r.awareness).toBeLessThan(ALLOCATION_EVEN_SHARE);
  });

  it('총량을 키우지 않는다 — 세 축의 기여 합이 어느 배분에서나 0 이다', () => {
    // 몫 한 점의 크기가 축마다 다르므로 값의 합이 아니라 **몫의 합**으로 견준다.
    for (const id of ALLOCATION_IDS) {
      const s = ALLOCATION_CATALOG[id];
      const deltas =
        s.body - ALLOCATION_EVEN_SHARE +
        (s.ability - ALLOCATION_EVEN_SHARE) +
        (s.awareness - ALLOCATION_EVEN_SHARE);
      expect(deltas).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001 — 세 축은 겹치지 않는다', () => {
  it('몸에 몰면 때리고 막고 버티는 값만 오른다', () => {
    expect(allocationContribution('reinforce', 'physicalAttack')).toBe(16);
    expect(allocationContribution('reinforce', 'armor')).toBe(20);
    expect(allocationContribution('reinforce', 'resistance')).toBe(12);
    // 다른 두 축은 실제로 얇아진다
    expect(allocationContribution('reinforce', 'auraAttack')).toBe(-12);
    expect(allocationContribution('reinforce', 'insight')).toBe(-20);
  });

  it('능력에 몰면 기술이 오라로 내는 힘만 오른다', () => {
    expect(allocationContribution('hatsu', 'auraAttack')).toBe(24);
    expect(allocationContribution('hatsu', 'physicalAttack')).toBe(-8);
    expect(allocationContribution('hatsu', 'armor')).toBe(-10);
  });

  it('인지에 몰면 아는 범위만 오른다', () => {
    expect(allocationContribution('hunter', 'insight')).toBe(40);
    expect(allocationContribution('hunter', 'physicalAttack')).toBe(-8);
    expect(allocationContribution('hunter', 'auraAttack')).toBe(-12);
  });

  it('관통 둘과 치명 둘은 어느 축에도 들지 않는다 — 배분을 바꿔도 움직이지 않는다', () => {
    for (const id of ALLOCATION_IDS) {
      for (const stat of [
        'armorPenetration',
        'resistancePenetration',
        'criticalChance',
        'criticalDamage',
      ]) {
        expect(allocationContribution(id, stat)).toBe(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001 — 고른 배분은 아무것도 보태지 않는다', () => {
  it('모든 값에 0 이다 — 회귀의 근거', () => {
    for (const stat of [
      'physicalAttack',
      'auraAttack',
      'armor',
      'resistance',
      'insight',
      'armorPenetration',
      'criticalChance',
    ]) {
      expect(allocationContribution('balanced', stat)).toBe(0);
    }
  });

  it('고른 배분의 몸에서 유효 값이 기본값과 같다', () => {
    const self = body('rabbit-swordsman');
    expect(effectiveStat(self, 'physicalAttack')).toBe(40);
    expect(effectiveStat(self, 'armor')).toBe(50);
    expect(effectiveStat(self, 'auraAttack')).toBe(40);
    expect(effectiveStat(self, 'insight')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ALLOCATION-ENTERS-THE-EFFECTIVE-VALUE-001 — 판정이 읽는 값에 들어간다', () => {
  it('배분을 바꾸면 유효 값이 곧바로 맞바뀐다', () => {
    const self = body('rabbit-swordsman');
    self.allocation = 'reinforce';
    expect(effectiveStat(self, 'physicalAttack')).toBe(56); // 40 + 16
    expect(effectiveStat(self, 'armor')).toBe(70); // 50 + 20
    expect(effectiveStat(self, 'resistance')).toBe(32); // 20 + 12
    expect(effectiveStat(self, 'auraAttack')).toBe(28); // 40 - 12

    self.allocation = 'hatsu';
    expect(effectiveStat(self, 'auraAttack')).toBe(64); // 40 + 24
    expect(effectiveStat(self, 'physicalAttack')).toBe(32); // 40 - 8
    expect(effectiveStat(self, 'armor')).toBe(40); // 50 - 10
  });

  it('기본값은 건드려지지 않는다 — 배분은 저장되는 값을 바꾸지 않는다', () => {
    const self = body('rabbit-swordsman');
    self.allocation = 'reinforce';
    expect(self.armor).toBe(50); // 기본값 그대로
    expect(effectiveStat(self, 'armor')).toBe(70); // 판정이 읽는 값만 다르다
  });

  it('백 번 바꾸어도 값이 표류하지 않는다 — 가감이 아니라 재계산이기 때문이다', () => {
    const self = body('rabbit-swordsman');
    const order: AllocationId[] = ['reinforce', 'hatsu', 'hunter', 'balanced'];
    for (let i = 0; i < 100; i++) self.allocation = order[i % order.length]!;
    self.allocation = 'balanced';
    expect(effectiveStat(self, 'armor')).toBe(50);
    expect(effectiveStat(self, 'auraAttack')).toBe(40);
  });

  it('유효 값은 0 아래로 내려가지 않는다 — 통찰 0 인 몸에서 인지를 덜어도 0 이다', () => {
    const self = body('rabbit-swordsman'); // insight 0
    self.allocation = 'reinforce'; // 인지 -20
    expect(effectiveStat(self, 'insight')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('RULE-ALLOCATION-SET-001 — 배분을 바꾸는 일 (INTENT-CHANGE-ALLOCATION-001)', () => {
  it('바꾸면 그 배분이 되고 기력이 대가만큼 준다', () => {
    const world = arena();
    const before = hud(world.observe(), 'self.cp') as number;

    expect(setAllocation(world, 'reinforce').status).toBe('success');

    const view = world.observe();
    expect(hud(view, 'self.allocation')).toBe('reinforce');
    expect(hud(view, 'self.cp')).toBe(before - ALLOCATION_SWITCH_CP_COST);
    // 유효 값이 곧바로 관찰에 실린다
    expect(hud(view, 'self.combat.armor')).toBe(70);
    expect(hud(view, 'self.combat.physicalAttack')).toBe(56);
  });

  it('요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다', () => {
    const world = arena();
    setAllocation(world, 'reinforce');
    const cpAfterFirst = hud(world.observe(), 'self.cp');

    expect(setAllocation(world, 'reinforce').status).toBe('success');
    expect(hud(world.observe(), 'self.allocation')).toBe('reinforce');
    // 이미 그 자리에 있으므로 대가도 들지 않는다 — 거절이 아니다
    expect(hud(world.observe(), 'self.cp')).toBe(cpAfterFirst);
  });

  it('세 몫이 hud 에 실린다', () => {
    const world = arena();
    setAllocation(world, 'hunter');
    const view = world.observe();
    expect(hud(view, 'self.allocation.share.body')).toBe(1);
    expect(hud(view, 'self.allocation.share.ability')).toBe(1);
    expect(hud(view, 'self.allocation.share.awareness')).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-CHANGE-ALLOCATION-REFUSAL-001 — 거절은 아무것도 남기지 않는다', () => {
  it('기력이 모자라면 거절되고 배분도 기력도 그대로다', () => {
    const world = arena();
    setAttribute(world, 'cp', 10);
    const before = world.observe();

    const result = setAllocation(world, 'reinforce');
    expect(result.status).toBe('failure');
    expect(result.status === 'failure' && result.reason).toBe('insufficient-cp');

    const after = world.observe();
    expect(hud(after, 'self.allocation')).toBe(hud(before, 'self.allocation'));
    expect(hud(after, 'self.cp')).toBe(10);
  });

  it('세계가 모르는 이름은 거절된다', () => {
    const world = arena();
    const result = setAllocation(world, 'god-mode');
    expect(result.status).toBe('failure');
    expect(result.status === 'failure' && result.reason).toBe('unknown-allocation');
  });

  it('쓰러진 몸은 어느 배분으로도 가지 않는다', () => {
    const world = arena();
    setAttribute(world, 'hp', 0);
    const result = setAllocation(world, 'reinforce');
    expect(result.status).toBe('failure');
    expect(result.status === 'failure' && result.reason).toBe('downed');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ALLOCATION-IS-OBSERVED-001 — 배분은 읽힌다', () => {
  it('모든 존재에 실리고 가려지지 않는다 — 살펴보지 않은 상대의 것도 온다', () => {
    const world = arena();
    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.allocation).toEqual({
      id: 'balanced',
      shares: { body: 2, ability: 2, awareness: 2 },
    });
    // 형태는 왔지만 값은 여전히 관문 안이다
    expect(npc?.attributes?.combatStats).toBeUndefined();
    expect(npc?.attributes?.concealed).toContain('combatStats');
  });

  it('고를 수 있는 배분 넷이 언제나 전부 실린다 — 못 고르는 것도 실린다', () => {
    const world = arena();
    setAttribute(world, 'cp', 10); // 어느 것으로도 못 간다
    const view = world.observe();

    expect(view.allocations).toHaveLength(4);
    expect(choice(view, 'balanced')).toMatchObject({
      current: true,
      available: true, // 지금 있는 자리는 거절이 아니다
      cpCost: 0,
    });
    expect(choice(view, 'reinforce')).toMatchObject({
      current: false,
      available: false,
      unavailableReason: 'insufficient-cp',
      cpCost: ALLOCATION_SWITCH_CP_COST,
      shares: { body: 4, ability: 1, awareness: 1 },
      interactionId: 'set-allocation',
    });
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) — 경위에 배분이 실린다', () => {
  it('고른 배분으로 친 한 방은 C015 까지와 값이 같고 몫이 0 이다', () => {
    const b = strikeOnce(arena());
    expect(b.attackerAllocation).toBe('balanced');
    expect(b.targetAllocation).toBe('balanced');
    expect(b.offenseStat).toEqual({ name: 'physicalAttack', value: 40, fromAllocation: 0, fromGrowth: 0 });
    expect(b.finalDamage).toBe(20); // C007 이래의 기준값
  });

  it('몸에 몰고 친 한 방은 경위에 그 몫이 실린다', () => {
    const world = arena();
    setAllocation(world, 'reinforce');
    const b = strikeOnce(world);

    expect(b.attackerAllocation).toBe('reinforce');
    expect(b.offenseStat).toEqual({ name: 'physicalAttack', value: 56, fromAllocation: 16, fromGrowth: 0 });
    expect(b.rawDamage).toBe(34); // 6 + 56 × 0.5
    expect(b.finalDamage).toBe(26); // 34 × 100/130 = 26.15 → 26
  });

  it('능력에 몰면 오라 타격이 커지고 물리 타격은 작아진다 — 맞바뀜이 경위에 남는다', () => {
    const world = arena();
    setAllocation(world, 'hatsu');
    const b = strikeOnce(world);
    expect(b.offenseStat).toEqual({ name: 'physicalAttack', value: 32, fromAllocation: -8, fromGrowth: 0 });
    expect(b.finalDamage).toBe(17); // 22 × 100/130 = 16.9 → 17
  });

  it('관통의 몫은 언제나 0 이다 — 배분으로는 이 값을 움직일 수 없다', () => {
    const world = arena();
    setAllocation(world, 'reinforce');
    const b = strikeOnce(world);
    expect(b.penetrationStat.fromAllocation).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-INSIGHT-001 (CHANGED) — 인지에 몰면 아는 범위가 넓어진다', () => {
  it('사냥꾼은 살펴보지 않고도 상대의 무른 쪽을 본다 — 문턱 하나만 열린다', () => {
    const world = arena();
    // 고른 배분에서는 통찰 0 이므로 셋 다 가려져 있다
    expect(actor(world.observe(), 'npc-1')?.attributes?.concealed).toEqual([
      'combatStats',
      'versusObserver',
      'defenseShape',
    ]);

    setAllocation(world, 'hunter');
    const npc = actor(world.observe(), 'npc-1');

    expect(hud(world.observe(), 'self.insight')).toBe(40);
    // 얕은 자리 하나만 열린다 (문턱 30) — 60·90 은 여전히 닫혀 있다
    expect(npc?.attributes?.concealed).toEqual(['combatStats', 'versusObserver']);
    // wanderer 는 armor 30 · resistance 90 이므로 오라 쪽이 단단하다 —
    // **살펴보지 않고도 "물리로 쳐라" 를 알게 되는 것**이 이 축이 사는 값어치다
    expect(npc?.attributes?.defenseShape).toBe('aura-tougher');
  });

  it('인지에서 몫을 빼면 열렸던 자리가 다시 닫힌다 — 연 것을 적어 두지 않기 때문이다', () => {
    const world = arena();
    setAllocation(world, 'hunter');
    expect(actor(world.observe(), 'npc-1')?.attributes?.concealed).toHaveLength(2);

    setAllocation(world, 'balanced');
    expect(actor(world.observe(), 'npc-1')?.attributes?.concealed).toHaveLength(3);
  });

  it('통찰은 여전히 겨루는 일에 닿지 않는다 — 인지에 몰아도 피해가 커지지 않는다', () => {
    const world = arena();
    setAllocation(world, 'hunter');
    const b = strikeOnce(world);
    // 인지에 몬 대가로 몸이 얇아졌을 뿐, 통찰이 피해에 들어가지는 않는다
    expect(b.offenseStat).toEqual({ name: 'physicalAttack', value: 32, fromAllocation: -8, fromGrowth: 0 });
    expect(b.finalDamage).toBe(17);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('RULE-NPC-ALLOCATION-001 — 자율 존재도 배분을 지닌다', () => {
  it('성한 채로는 고른 배분이다 — 그래서 첫 절반의 전투가 지금까지와 같다', () => {
    const world = arena();
    tickFor(world, 0.5);
    expect(actor(world.observe(), 'npc-1')?.attributes?.allocation?.id).toBe('balanced');
  });

  it('생명이 절반 아래로 내려가면 몸으로 몰고 기력을 치른다', () => {
    const world = arena();
    setAttribute(world, 'hp', 50, 'npc-1'); // 120 의 절반 아래
    tickFor(world, TICK_INTERVAL);

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.allocation?.id).toBe('reinforce');
    expect(npc?.attributes?.energy).toBe(20 - ALLOCATION_SWITCH_CP_COST);
  });

  it('몸으로 몬 상대는 실제로 단단해진다 — 같은 기술이 덜 들어간다', () => {
    const world = arena();
    setAttribute(world, 'hp', 50, 'npc-1');
    tickFor(world, TICK_INTERVAL);

    const b = strikeOnce(world);
    expect(b.targetAllocation).toBe('reinforce');
    expect(b.defenseStat).toEqual({ name: 'armor', value: 50, fromAllocation: 20, fromGrowth: 0 });
    expect(b.finalDamage).toBe(17); // 26 × 100/150 = 17.3 → 17 (고른 배분에서는 20)
  });

  it('기력이 모자라면 다쳐도 몸으로 몰지 못한다 — 자율 존재에게 예외를 두지 않는다', () => {
    const world = arena();
    setAttribute(world, 'cp', 5, 'npc-1');
    setAttribute(world, 'hp', 50, 'npc-1');
    tickFor(world, TICK_INTERVAL);

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.allocation?.id).toBe('balanced');
    expect(npc?.attributes?.energy).toBe(5); // 거절은 아무것도 남기지 않는다
  });

  it('생명이 문턱 위로 돌아오면 균형으로 내려온다 — 한 번 넘으면 끝이 아니다', () => {
    const world = arena();
    setAttribute(world, 'cp', 60, 'npc-1');
    setAttribute(world, 'hp', 50, 'npc-1');
    tickFor(world, TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.attributes?.allocation?.id).toBe('reinforce');

    setAttribute(world, 'hp', 120, 'npc-1');
    tickFor(world, TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.attributes?.allocation?.id).toBe('balanced');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('회귀 — 배분을 한 번도 바꾸지 않으면 지금까지의 세계와 같다', () => {
  it('C007 이래의 두 체감 기준이 고른 배분에서 그대로다', () => {
    // 관찰자 → 자율 존재 기본 20
    expect(strikeOnce(arena()).finalDamage).toBe(20);

    // 자율 존재 → 관찰자 기본 17 (관찰자 armor 50)
    const self = body('rabbit-swordsman');
    const npc = body('wanderer');
    expect(effectiveStat(npc, 'physicalAttack')).toBe(40);
    expect(effectiveStat(self, 'armor')).toBe(50);
  });

  it('관찰자의 몸은 관찰자가 바꾸기 전까지 스스로 배분을 바꾸지 않는다', () => {
    const world = arena();
    setAttribute(world, 'hp', 10); // 절반 아래로 내려가도
    tickFor(world, 0.5);
    // 자율 존재의 습성이지 세계의 법칙이 아니다 (control = player 는 지나지 않는다)
    expect(hud(world.observe(), 'self.allocation')).toBe('balanced');
  });
});
