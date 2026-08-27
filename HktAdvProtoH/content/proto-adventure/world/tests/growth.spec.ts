// C-GROWTH-001 한 일이 몸을 키운다 — World 단독 테스트
// RULE-DEEDS-ADD-001(ADDED) · RULE-GROWTH-LEVEL-001(ADDED) ·
// RULE-EFFECTIVE-STATS-001(CHANGED) · RULE-STRIKE-DAMAGE-001(CHANGED) ·
// RULE-MINE-COMPLETE-001(CHANGED) · RULE-OBSERVE-COMPLETE-001(CHANGED) ·
// RULE-STRIKE-EVENT-EXPIRE-001(CHANGED) · RULE-ATTRIBUTE-SET-001(CHANGED)
//
// Implements INTENT-THE-BODY-KEEPS-WHAT-IT-DID-001 ·
//            INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001 · INTENT-ONLY-REAL-ACTS-COUNT-001 ·
//            INTENT-WHAT-IS-KEPT-ONLY-GROWS-001 · INTENT-ENOUGH-IS-A-STEP-001 ·
//            INTENT-THE-STEP-ENTERS-THE-EFFECTIVE-VALUE-001 ·
//            INTENT-WHAT-GROWS-IS-WHAT-THE-CONTEST-READS-001 ·
//            INTENT-THE-ZEROTH-STEP-ADDS-NOTHING-001 · INTENT-A-STEP-IS-A-SMALL-CHANGE-001 ·
//            INTENT-THE-STEP-OPENS-NOTHING-001 · INTENT-THE-LEDGER-IS-OBSERVED-001 ·
//            INTENT-GROWING-CARRIES-ITS-REASON-001
//
// 기대값은 공식을 다시 계산하지 않고 **숫자로 박는다** — 구현을 구현으로 검사하지 않기
// 위해서다 (C015 · C-COMBAT-001 이 세운 방식 그대로). 근거는 03-world-semantic.md 의
// BALANCE ①~⑤ 다.
//
// 기준 배치
//   관찰자 rabbit-swordsman  PhysAtk 40 · AuraAtk 40 · Armor 50 · Resist 20 · Hp 200
//   자율 존재 wanderer       PhysAtk 40 · Armor 30 · Hp 120
//   원천                      치기 1 · 쓰러뜨림 14 · 캐기 4 · 살펴봄 3
//   문턱                      20 · 50 · 90 · 140 · 200  (최대 5단계)
//   한 단계                   PhysAtk +4 · AuraAtk +4 · Armor +3 · Resist +3

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { DEFAULT_SWING_BEGIN, effectiveStat, SKILL_DEFINITIONS } from '../semantic/combat';
import {
  DEED_AMOUNTS,
  GROWABLE_STATS,
  GROWTH_LEVEL_STEPS,
  GROWTH_THRESHOLDS,
  MAX_GROWTH_LEVEL,
  deedsToNextThreshold,
  growthContribution,
  growthLevel,
  nextGrowthThreshold,
} from '../semantic/growth';
import { ruleDeedsAdd } from '../rules/deeds-add';
import { spawnActor } from '../semantic/spawn';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, equipPickaxe, observeFully, selectTarget, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const AFTER_SWING_OPEN = DEFAULT_SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

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

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const contribution = (v: GameViewSnapshot, stat: string) =>
  v.growth.contributions.find((c) => c.stat === stat)?.amount;

const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) =>
  world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });

const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

/** 표적 하나를 세우고 관찰자가 마주 보게 한 세계. 흔들림은 꺼 둔다 */
const arena = () => {
  const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
  aimRight(world);
  // C015 의 터짐이 대수를 흔들면 "몇 대에 쓰러지는가" 를 잴 수 없다.
  // 이 Cycle 이 보는 것은 쌓임과 단계이지 흔들림이 아니다.
  setAttribute(world, 'criticalChance', 0);
  return world;
};

/** 기본 스킬로 한 번 친다 */
const strikeOnce = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'attack' });
  tickFor(world, AFTER_SWING_OPEN);
};

/** 광맥 앞에 선 세계 — 고르기가 앞에 온다 (C017) */
const atDeposit = () => {
  const world = driveWorld({ npcs: [], actorPosition: { x: 8, z: -5 }, depositAmount: 15 });
  selectTarget(world, 'deposit-1');
  return world;
};

const MINE_DURATION = 1.2;
const mineOnce = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'mine' });
  const steps = Math.ceil(MINE_DURATION / TICK_INTERVAL) + 1;
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

/** 기술 하나가 끝까지 나가고 몸이 다시 자유로워질 때까지 */
const strikeAndRecover = (world: WorldDriver) => {
  strikeOnce(world);
  tickFor(world, BASIC.baseDuration);
};

const body = (kind: string) =>
  spawnActor({ id: 'x', name: 'X', characterKind: kind, control: 'player', position: { x: 0, z: 0 } });

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-BODY-KEEPS-WHAT-IT-DID-001 — 한 일이 몸에 남는다', () => {
  it('어떤 몸이든 아무것도 하지 않은 채로 태어난다 — 종류가 정하는 값이 아니다', () => {
    expect(body('rabbit-swordsman').deeds).toBe(0);
    expect(body('wanderer').deeds).toBe(0);
    // 미등록 종류도 마찬가지다 — 카탈로그에 없는 값이기 때문이다
    expect(body('unknown-kind').deeds).toBe(0);
  });

  it('쌓이는 자리는 하나다 — 무엇을 했든 같은 곳에 쌓인다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    mineOnce(world); // 4
    mineOnce(world); // 4
    // 갈래가 없으므로 둘이 같은 값에 더해진다. 나뉘면 그것은 숙련 축이다
    expect(world.observe().growth.deeds).toBe(2 * DEED_AMOUNTS.mine);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001 — 세계의 규칙이 쌓는다', () => {
  it('한 대가 들어가면 1 이 쌓인다 — 얼마나 아팠는지는 묻지 않는다', () => {
    const world = arena();
    expect(world.observe().growth.deeds).toBe(0);
    strikeOnce(world);
    expect(world.observe().growth.deeds).toBe(DEED_AMOUNTS.strike);
  });

  it('쓰러뜨리면 그 한 대와 함께 쓰러뜨림도 쌓인다 — 1 + 14', () => {
    const world = arena();
    setAttribute(world, 'hp', 5, 'npc-1'); // 한 대에 쓰러질 몸으로 만든다
    strikeOnce(world);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('downed');
    expect(world.observe().growth.deeds).toBe(DEED_AMOUNTS.strike + DEED_AMOUNTS.down);
  });

  it('캐면 4 가 쌓인다', () => {
    const world = atDeposit();
    equipPickaxe(world);
    mineOnce(world);
    expect(world.observe().growth.deeds).toBe(DEED_AMOUNTS.mine);
  });

  it('살펴봐 알게 되면 3 이 쌓인다', () => {
    const world = arena();
    observeFully(world, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.acquainted).toBe(true);
    expect(world.observe().growth.deeds).toBe(DEED_AMOUNTS.observe);
  });

  it('같은 일은 언제나 같은 양을 쌓는다 — 쌓임에 흔들림이 없다', () => {
    // 되풀이할 수 있는 일로 잰다. 같은 일을 네 번 하면 네 번 다 같은 양이 붙는다 —
    // 피해의 크기도, 캔 것의 종류도, 세계의 흔들림도 이 양에 들어가지 않는다.
    const world = atDeposit();
    equipPickaxe(world);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = world.observe().growth.deeds;
      mineOnce(world);
      seen.push(world.observe().growth.deeds - before);
    }
    expect(seen).toEqual([4, 4, 4, 4]);
  });

  it('밖의 손이 만든 쓰러짐은 아무의 일도 아니다 — 아무에게도 쌓이지 않는다', () => {
    const world = arena();
    const before = world.observe().growth.deeds;
    setAttribute(world, 'hp', 0, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.state).toBe('downed');
    // RULE-DOWNED-001 은 돌았지만 쓰러뜨린 몸이 없다
    expect(world.observe().growth.deeds).toBe(before);
  });

  it('자율 존재도 쌓는다 — 규칙이 조종 주체를 가리지 않는다', () => {
    // 규칙을 직접 부른다. **조종 주체를 묻는 자리가 규칙 안에 없다**는 것이
    // 이 검사가 보는 전부이며, 세계를 굴려 확인할 수 있는 것이 아니다 —
    // 자율 존재의 쌓임은 관찰에 실리지 않기 때문이다 (설계대로).
    const npc = spawnActor({
      id: 'npc-x',
      name: 'N',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: { x: 0, z: 0 },
    });
    const state = { time: 0, growthEvents: [] } as unknown as WorldState;
    ruleDeedsAdd(state, npc, 'strike');
    ruleDeedsAdd(state, npc, 'down');
    expect(npc.deeds).toBe(DEED_AMOUNTS.strike + DEED_AMOUNTS.down);
    expect(state.growthEvents.map((e) => e.actorId)).toEqual(['npc-x', 'npc-x']);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ONLY-REAL-ACTS-COUNT-001 — 세계에 없는 일은 원천이 아니다', () => {
  it('원천은 넷뿐이다 — 탐험과 사건 해결은 세계에 없으므로 지어내지 않았다', () => {
    expect(Object.keys(DEED_AMOUNTS).sort()).toEqual(['down', 'mine', 'observe', 'strike']);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-WHAT-IS-KEPT-ONLY-GROWS-001 — 쌓인 것은 줄지 않는다', () => {
  it('쓰러져도 그대로다', () => {
    const world = arena();
    strikeOnce(world);
    const kept = world.observe().growth.deeds;
    setAttribute(world, 'hp', 0);
    expect(world.observe().growth.deeds).toBe(kept);
  });

  it('시간이 지나도 바래지 않는다 — 사건은 사라지지만 쌓인 것은 남는다', () => {
    const world = arena();
    strikeOnce(world);
    const kept = world.observe().growth.deeds;
    tickFor(world, 5); // STRIKE_EVENT_TTL(1.2) 을 한참 넘긴다
    expect(world.observe().growthEvents).toHaveLength(0); // 사건은 사라졌다
    expect(world.observe().growth.deeds).toBe(kept); // 쌓인 것은 그대로다
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-ENOUGH-IS-A-STEP-001 — 충분해지면 단계가 오른다', () => {
  it('문턱은 세계가 지닌 값이다 — 다섯 칸에서 멈춘다', () => {
    expect(GROWTH_THRESHOLDS).toEqual([20, 50, 90, 140, 200]);
    expect(MAX_GROWTH_LEVEL).toBe(5);
  });

  it('단계는 넘어선 문턱의 개수다 — 저장하지 않고 쌓인 것에서 읽는다', () => {
    expect(growthLevel(0)).toBe(0);
    expect(growthLevel(19)).toBe(0);
    expect(growthLevel(20)).toBe(1);
    expect(growthLevel(49)).toBe(1);
    expect(growthLevel(200)).toBe(5);
    expect(growthLevel(100000)).toBe(5); // 표가 끝나면 더 오르지 않는다
  });

  it('한 번의 늘어남이 문턱 둘을 넘으면 단계도 둘 오른다 — 붙잡아 두지 않는다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 49); // 둘째 문턱(50) 코앞
    setAttribute(world, 'hp', 5, 'npc-1');
    expect(world.observe().growth.level).toBe(1);
    strikeOnce(world); // 1 + 14 = 15 → 64
    expect(world.observe().growth.deeds).toBe(64);
    expect(world.observe().growth.level).toBe(2);
  });

  it('다음 문턱과 남은 양은 세계가 세어서 싣는다 — 최대 단계면 오지 않는다', () => {
    expect(nextGrowthThreshold(0)).toBe(20);
    expect(deedsToNextThreshold(0)).toBe(20);
    expect(nextGrowthThreshold(20)).toBe(50);
    expect(deedsToNextThreshold(20)).toBe(30);
    expect(nextGrowthThreshold(200)).toBeNull();
    expect(deedsToNextThreshold(200)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-STEP-ENTERS-THE-EFFECTIVE-VALUE-001 — 단계가 유효 값에 들어간다', () => {
  it('넷째 항이다 — 기본값은 한 톨도 바뀌지 않는다', () => {
    const self = body('rabbit-swordsman');
    self.deeds = 20; // 단계 1
    expect(self.physicalAttack).toBe(40); // 기본값 그대로다
    expect(effectiveStat(self, 'physicalAttack')).toBe(44); // 유효 값만 커진다
    // 걸린 것도 배분도 건드리지 않았다 — 자란 몫은 그 둘 옆에 서는 다른 항이다
    expect(self.allocation).toBe('balanced');
  });

  it('밖의 손과 안의 성장이 서로를 지우지 않는다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 20); // 단계 1
    setAttribute(world, 'physicalAttack', 100); // 밖에서 기본값을 덮는다
    // 유효 값 = 덮인 기본값 100 + 자란 몫 4. 둘 중 어느 쪽도 사라지지 않았다
    expect(hud(world.observe(), 'self.combat.physicalAttack')).toBe(104);
    expect(contribution(world.observe(), 'physicalAttack')).toBe(4);
  });

  it('자란 몫은 걸어 둔 것도 배분도 아니다 — 벗어도 바꿔도 그대로 얹힌다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 20);
    const grownAlone = world.observe().growth;
    expect(grownAlone.level).toBe(1);
    equipPickaxe(world);
    world.dispatch({ interactionId: 'unequip-item', equipSlotId: 'E1' });
    world.dispatch({ interactionId: 'set-allocation', allocationId: 'hunter' });
    expect(contribution(world.observe(), 'physicalAttack')).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-WHAT-GROWS-IS-WHAT-THE-CONTEST-READS-001 — 겨루는 값만 자란다', () => {
  it('자라는 것은 넷뿐이다', () => {
    expect(GROWABLE_STATS).toEqual(['physicalAttack', 'auraAttack', 'armor', 'resistance']);
    expect(GROWTH_LEVEL_STEPS).toEqual({
      physicalAttack: 4,
      auraAttack: 4,
      armor: 3,
      resistance: 3,
    });
  });

  it('관통 둘 · 치명 둘 · 통찰은 자라지 않는다 — 결손이 아니라 성질이다', () => {
    for (const stat of [
      'armorPenetration',
      'resistancePenetration',
      'criticalChance',
      'criticalDamage',
      'insight',
    ]) {
      expect(growthContribution(200, stat)).toBe(0);
    }
  });

  it('그릇과 걸음도 자라지 않는다 — 아직 유효 값이라는 자리가 없기 때문이다', () => {
    const world = arena();
    const before = world.observe();
    setAttribute(world, 'deeds', 200); // 최대 단계
    const after = world.observe();
    expect(hud(after, 'self.hpMax')).toBe(hud(before, 'self.hpMax'));
    expect(hud(after, 'self.cpMax')).toBe(hud(before, 'self.cpMax'));
    expect(hud(after, 'self.tempo.moveSpeed')).toBe(hud(before, 'self.tempo.moveSpeed'));
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-ZEROTH-STEP-ADDS-NOTHING-001 — 자라지 않은 몸은 지금까지와 같다', () => {
  it('단계 0 은 어느 값에도 0 을 보탠다 — 검사가 아니라 산술이다', () => {
    for (const stat of GROWABLE_STATS) expect(growthContribution(0, stat)).toBe(0);
  });

  it('아무것도 쌓지 않은 몸의 값은 C-COMBAT-001 까지와 한 톨도 다르지 않다', () => {
    const world = arena();
    expect(world.observe().growth.deeds).toBe(0);
    expect(hud(world.observe(), 'self.combat.physicalAttack')).toBe(40);
    expect(hud(world.observe(), 'self.combat.armor')).toBe(50);
    expect(hud(world.observe(), 'self.combat.auraAttack')).toBe(40);
    expect(hud(world.observe(), 'self.combat.resistance')).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-A-STEP-IS-A-SMALL-CHANGE-001 — 한 단계의 폭은 작다 (BALANCE ①)', () => {
  // 기대값은 03-world-semantic.md 의 BALANCE ① 표에서 그대로 가져온다.
  const EXPECTED: Array<[number, number, number]> = [
    // [단계, physicalAttack 유효 값, wanderer 에게 남기는 값]
    [0, 40, 20],
    [1, 44, 22],
    [2, 48, 23],
    [3, 52, 25],
    [4, 56, 26],
    [5, 60, 28],
  ];

  for (const [level, attack, damage] of EXPECTED) {
    it(`단계 ${level} — 유효 공격 ${attack} · 한 대가 남기는 값 ${damage}`, () => {
      const world = arena();
      setAttribute(world, 'deeds', GROWTH_THRESHOLDS[level - 1] ?? 0);
      expect(world.observe().growth.level).toBe(level);
      expect(hud(world.observe(), 'self.combat.physicalAttack')).toBe(attack);
      strikeOnce(world);
      expect(world.observe().strikes.at(-1)?.amount).toBe(damage);
    });
  }

  it('한 단계로는 대수가 바뀌지 않고 세 단계를 모아야 바뀐다 — 넓은 만큼 얕다', () => {
    const HP = 120; // wanderer
    expect(Math.ceil(HP / 20)).toBe(6); // 단계 0
    expect(Math.ceil(HP / 22)).toBe(6); // 단계 1 — 그대로다
    expect(Math.ceil(HP / 25)).toBe(5); // 단계 3 — 여기서 바뀐다
  });

  it('첫 문턱은 자율 존재 하나를 넘어뜨리면 닿는 값이다 (BALANCE ②)', () => {
    // 03 의 BALANCE ② 는 여섯 대로 셈했으나 **실제 각본은 일곱 대**다 —
    // 생명이 절반 아래로 내려간 방랑자가 몸에 몰아 단단해지기 때문이다
    // (C-COMBAT-001 · RULE-NPC-ALLOCATION-001). 08 이 그것을 실측해 보고한다.
    // 문턱을 넘는다는 결론은 그대로이고 **여유가 늘었을 뿐**이다.
    const sixHitKill = 6 * DEED_AMOUNTS.strike + DEED_AMOUNTS.down; // 셈으로 본 바닥
    const sevenHitKill = 7 * DEED_AMOUNTS.strike + DEED_AMOUNTS.down; // 실제로 도는 각본
    const heavyRoute = 3 * DEED_AMOUNTS.strike + DEED_AMOUNTS.down; // 고급 기술을 섞은 길
    expect(sixHitKill).toBe(GROWTH_THRESHOLDS[0]); // 가장 짧은 길이 정확히 닿는다
    expect(sevenHitKill).toBeGreaterThan(GROWTH_THRESHOLDS[0] as number);
    expect(heavyRoute + DEED_AMOUNTS.mine).toBeGreaterThanOrEqual(GROWTH_THRESHOLDS[0] as number);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-STEP-OPENS-NOTHING-001 — 단계는 아무 관문도 열지 않는다', () => {
  it('최대 단계여도 못 하던 일은 못 한다 — 곡괭이 없이는 캐지 못한다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 200);
    expect(world.observe().growth.level).toBe(5);
    expect(world.dispatch({ interactionId: 'mine' })).toMatchObject({ status: 'failure' });
  });

  it('땅이 거두어 가는 것은 단계가 높아도 그대로 거둔다', () => {
    const world = driveWorld({});
    setAttribute(world, 'deeds', 200);
    const before = hud(world.observe(), 'self.warmth') as number;
    // 관찰자를 법칙의 자리로 옮긴다 — 자리는 세계가 이미 지녀 있다
    const zone = world.observe().ground.zones.find((z) => z.role === 'law');
    if (!zone) return; // 자리가 없는 세계면 이 검사는 성립하지 않는다
    world.dispatch({ interactionId: 'move', position: { x: zone.center.x, z: zone.center.z } });
    tickFor(world, 8);
    expect(hud(world.observe(), 'self.warmth') as number).toBeLessThan(before);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-THE-LEDGER-IS-OBSERVED-001 — 쌓임과 문턱이 읽힌다', () => {
  it('세계가 세어서 싣는다 — 화면이 나누지도 빼지도 곱하지도 않는다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 35);
    const g = world.observe().growth;
    expect(g).toMatchObject({
      deeds: 35,
      level: 1,
      maxLevel: 5,
      nextThreshold: 50,
      deedsToNext: 15,
    });
    expect(g.contributions).toEqual([
      { stat: 'physicalAttack', amount: 4 },
      { stat: 'auraAttack', amount: 4 },
      { stat: 'armor', amount: 3 },
      { stat: 'resistance', amount: 3 },
    ]);
  });

  it('아무것도 쌓지 않았어도 실린다 — 0 이라는 사실과 자리가 없다는 사실은 다르다', () => {
    const g = arena().observe().growth;
    expect(g.deeds).toBe(0);
    expect(g.level).toBe(0);
    expect(g.contributions).toHaveLength(4);
    expect(g.contributions.every((c) => c.amount === 0)).toBe(true);
  });

  it('최대 단계면 다음 문턱과 남은 양이 오지 않는다 — 없음이 곧 "더 오를 곳이 없다" 이다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 200);
    const g = world.observe().growth;
    expect(g.level).toBe(5);
    expect(g.nextThreshold).toBeUndefined();
    expect(g.deedsToNext).toBeUndefined();
    expect(hud(world.observe(), 'self.growth.nextThreshold')).toBeUndefined();
  });

  it('남의 쌓임은 오지 않는다 — 세계에 그 관찰이 없다', () => {
    const world = arena();
    observeFully(world, 'npc-1'); // 다 살펴본 뒤에도
    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.attributes?.acquainted).toBe(true);
    expect(JSON.stringify(npc)).not.toContain('deeds');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('INTENT-GROWING-CARRIES-ITS-REASON-001 — 자란 까닭이 읽힌다', () => {
  it('무엇을 해서 얼마가 쌓였는지가 남는다', () => {
    const world = arena();
    strikeOnce(world);
    expect(world.observe().growthEvents).toEqual([
      { source: 'strike', amount: 1, deedsAfter: 1, levelBefore: 0, levelAfter: 0, since: expect.any(Number) },
    ]);
  });

  it('오르지 않은 쌓임도 실린다 — 오르지 않았다는 사실도 관찰이다', () => {
    const world = arena();
    strikeOnce(world);
    const event = world.observe().growthEvents[0];
    expect(event?.levelBefore).toBe(event?.levelAfter);
  });

  it('오른 순간에는 전후 단계가 갈린다 — 화면이 이전 값을 기억하지 않는다', () => {
    const world = arena();
    setAttribute(world, 'deeds', 19);
    strikeOnce(world);
    const event = world.observe().growthEvents.at(-1);
    expect(event).toMatchObject({ source: 'strike', levelBefore: 0, levelAfter: 1, deedsAfter: 20 });
  });

  it('쓰러뜨린 한 순간이 두 사실을 남긴다 — 친 것과 쓰러뜨린 것', () => {
    const world = arena();
    setAttribute(world, 'hp', 5, 'npc-1');
    strikeOnce(world);
    expect(world.observe().growthEvents.map((e) => e.source)).toEqual(['strike', 'down']);
  });

  it('한 방의 경위에 단계가 보탠 몫이 실린다 — 0 이어도 실린다', () => {
    const flat = arena();
    strikeOnce(flat);
    const before = flat.observe().strikes.at(-1)!.breakdown;
    expect(before.offenseStat).toMatchObject({
      name: 'physicalAttack',
      value: 40,
      fromGrowth: 0,
    });

    const grown = arena();
    setAttribute(grown, 'deeds', 20); // 단계 1
    strikeOnce(grown);
    const after = grown.observe().strikes.at(-1)!.breakdown;
    expect(after.offenseStat).toMatchObject({
      name: 'physicalAttack',
      value: 44,
      fromGrowth: 4,
    });
    // 관통은 자라지 않으므로 언제나 0 이다 — 그래도 자리를 비우지 않는다
    expect(after.penetrationStat.fromGrowth).toBe(0);
  });

  it('사건은 같은 수명으로 사라진다 — 수명 규칙을 넷으로 나누지 않는다', () => {
    const world = arena();
    strikeOnce(world);
    expect(world.observe().growthEvents).toHaveLength(1);
    tickFor(world, 2); // STRIKE_EVENT_TTL = 1.2
    expect(world.observe().growthEvents).toHaveLength(0);
    expect(world.observe().strikes).toHaveLength(0);
  });

  it('내 것만 실린다 — 남이 무엇으로 자랐는지는 오지 않는다', () => {
    // 자율 존재가 관찰자를 친다 (지키는 자리 안에 있으므로 사냥감으로 대한다).
    const world = driveWorld({ npcs: [{ ...dummyAt(1.2, 0), perceptionRange: 9 }] });
    tickFor(world, 6);
    // 관찰자는 한 대도 치지 않았다 — 그러므로 내 목록은 비어 있다.
    // 상대가 그 사이에 쌓았더라도 그것은 내 관찰에 오지 않는다.
    expect(world.observe().strikes.length).toBeGreaterThan(0); // 맞기는 했다
    expect(world.observe().growthEvents).toHaveLength(0);
    expect(world.observe().growth.deeds).toBe(0);
  });
});
