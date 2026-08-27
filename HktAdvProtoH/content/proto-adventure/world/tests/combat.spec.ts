// C007 전투 자원 World 단독 테스트
// RULE-SKILL-BEGIN-001 · RULE-SKILL-BUDGET-001 · RULE-STRIKE-DAMAGE-001 · RULE-DOWNED-001 ·
// RULE-CP-RUN-DRAIN-001 · RULE-MOVE-MODE-001 · RULE-STRIKE-EVENT-EXPIRE-001 · RULE-ATTRIBUTE-SET-001
//
// Implements INTENT-VITALITY-001 · INTENT-SKILL-BUDGET-001 · INTENT-SKILL-COST-GATE-001 ·
//            INTENT-RUN-001 · INTENT-MODIFIER-COMPOSE-001 · INTENT-STRIKE-DAMAGE-001 ·
//            INTENT-DAMAGE-APPLY-001 · INTENT-DOWNED-001 · INTENT-TEMPO-MOVE-001 ·
//            INTENT-TEMPO-ACTION-001 · INTENT-ENTITY-OBSERVE-001 · INTENT-SELF-OBSERVE-001 ·
//            INTENT-STRIKE-OBSERVE-001 · INTENT-ATTRIBUTE-OBSERVE-001 · INTENT-ATTRIBUTE-MUTATE-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  HIT_CHARGE_FACTOR,
  RUN_CHARGE_FACTOR,
  RUN_CP_DRAIN,
  SKILL_DEFINITIONS,
  STRIKE_EVENT_TTL,
} from '../semantic/combat';
import { DEFAULT_SWING_BEGIN } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, observeFully, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const HEAVY = SKILL_DEFINITIONS['heavy-attack'];
const AFTER_SWING_OPEN = DEFAULT_SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

// C010 — 피해는 더 이상 스킬의 고정값이 아니라 공식의 결과다.
// 기대값을 공식으로 다시 계산하면 구현을 구현으로 검사하는 꼴이 되므로 숫자로 박는다.
// 관찰자(rabbit-swordsman, Attack 40) → 자율 존재(wanderer, Defense 30) 기준이며,
// 두 값 모두 C007 의 고정 피해(20 · 55)와 같다 — 공격 쪽 체감이 보존되었다는 회귀 기준이다.
const BASIC_DAMAGE = 20;
const HEAVY_DAMAGE = 55;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// C019 — 자율 존재가 무엇을 고르는가에 따라 첫 타격 시각이 달라진다 (큰 기술은 선딜이
// 길다). 그래서 "맞은 직후" 를 고정 시간으로 잡지 않고 **맞을 때까지** 굴린다 —
// 검증하려는 것은 타이밍이 아니라 맞은 직후의 배율이다.
const tickUntilHit = (world: WorldDriver, limitSeconds = 6) => {
  const steps = Math.ceil(limitSeconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    world.tick(TICK_INTERVAL);
    if (actor(world.observe(), PLAYER)?.state === 'hit') return true;
  }
  return false;
};

// 휘두름은 몸이 향한 방향으로 나간다 — +x 로 한 걸음 걸어 그쪽을 보게 한다 (C006 R1).
const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

// 순회도 인지도 없는 정지 NPC — 때릴 대상으로만 쓴다 (결정론)
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

// 아무도 방해하지 않는 세계 — 기본 배치의 자율 존재는 다가와 때리므로 (행동이 hit 으로
// 끊기면 이동도 기력 누수도 멎는다) 그것이 대상이 아닌 검증에서는 비워 둔다.
const soloWorld = () => driveWorld({ npcs: [] });

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const skill = (v: GameViewSnapshot, id: string) => v.interactions.find((i) => i.id === id);

describe('INTENT-VITALITY-001 — 모든 존재가 생명과 기력을 지닌다', () => {
  it('관찰자의 몸과 자율 존재 모두 자기 종류의 자원을 갖고 시작한다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const view = world.observe();

    expect(actor(view, PLAYER)?.vitality).toEqual({
      health: 200,
      healthMaximum: 200,
      downed: false,
    });
    expect(actor(view, PLAYER)?.attributes?.energy).toBe(30);
    expect(actor(view, 'npc-1')?.vitality).toEqual({
      health: 120,
      healthMaximum: 120,
      downed: false,
    });
  });

  it('모든 존재가 이름을 가진다 — 세계가 순번으로 정한다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();
    expect(actor(view, PLAYER)?.name).toBe('Player 1');
    expect(actor(view, 'npc-1')?.name).toBe('Wanderer 1');
  });
});

describe('INTENT-STRIKE-DAMAGE-001 — 피해는 하나의 공식이 정한다 (C010 CHANGED)', () => {
  it('기본 스킬은 언제나 같은 값을 깎는다 — 흔들림이 없다', () => {
    // 맞은 몸은 밀려나므로(C006) 두 번째 휘두름은 같은 자리에 닿지 않는다.
    // 흔들림이 없음을 보이려면 같은 조건을 두 번 만드는 편이 정확하다.
    const strike = () => {
      const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
      aimRight(world);
      world.dispatch({ interactionId: 'attack' });
      tickFor(world, AFTER_SWING_OPEN);
      return actor(world.observe(), 'npc-1')?.vitality?.health;
    };

    expect(strike()).toBe(120 - BASIC_DAMAGE);
    expect(strike()).toBe(120 - BASIC_DAMAGE); // R1 — 판정도 우연도 없다
  });

  it('고급 스킬은 기본 스킬보다 크게 깎는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);

    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, HEAVY.swingBegin * HEAVY.baseDuration + 2 * TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - HEAVY_DAMAGE);
    expect(HEAVY_DAMAGE).toBeGreaterThan(BASIC_DAMAGE);
  });

  it('한 휘두름은 같은 몸을 한 번만 때린다 (C006 회귀)', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration); // 휘두름 전 구간을 지나도
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - BASIC_DAMAGE);
  });
});

describe('INTENT-SKILL-BUDGET-001 — 맞혀야 기력이 돈다', () => {
  it('기본 스킬은 맞히면 충전만 한다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    const before = hud(world.observe(), 'self.cp') as number;

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);

    expect(hud(world.observe(), 'self.cp')).toBe(before + BASIC.cpCharge);
  });

  it('허공을 가른 휘두름은 기력을 움직이지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(15, 15)] }); // 닿지 않는 자리
    aimRight(world);
    const before = hud(world.observe(), 'self.cp') as number;

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration);

    expect(hud(world.observe(), 'self.cp')).toBe(before);
  });

  it('고급 스킬은 충전하면서 더 크게 소모한다 — 결과적으로 기력을 잃는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    const before = hud(world.observe(), 'self.cp') as number;

    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, HEAVY.swingBegin * HEAVY.baseDuration + 2 * TICK_INTERVAL);

    expect(hud(world.observe(), 'self.cp')).toBe(before + HEAVY.cpCharge - HEAVY.cpCost);
    expect(HEAVY.cpCost).toBeGreaterThan(HEAVY.cpCharge);
  });

  it('여러 몸을 때려도 수지는 한 번만 정산된다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0.3), dummyAt(1.5, -0.3, 'npc-2')] });
    aimRight(world);
    const before = hud(world.observe(), 'self.cp') as number;

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration);

    const view = world.observe();
    // 둘 다 맞았지만
    expect(actor(view, 'npc-1')?.vitality?.health).toBe(120 - BASIC_DAMAGE);
    expect(actor(view, 'npc-2')?.vitality?.health).toBe(120 - BASIC_DAMAGE);
    // 정산은 한 번이다
    expect(hud(view, 'self.cp')).toBe(before + BASIC.cpCharge);
  });
});

describe('INTENT-SKILL-COST-GATE-001 — 기력이 모자라면 시작되지 않는다', () => {
  it('고급 스킬은 기력이 소모량에 못 미치면 거절되고 사유가 남는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    // 시작 기력 30 = 소모량 30 → 한 번은 나간다.
    // 맞히면 정산되어 8 이 남고(30 + 8 - 30), 두 번째는 그 기력으로 막힌다.
    expect(world.dispatch({ interactionId: 'skill-heavy' }).status).toBe('success');
    tickFor(world, HEAVY.baseDuration + TICK_INTERVAL);

    const result = world.dispatch({ interactionId: 'skill-heavy' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-SKILL-BEGIN-001',
      reason: 'insufficient-cp',
    });
    // 사유는 관찰로도 드러난다 (INTENT-SELF-OBSERVE-001)
    const heavy = skill(world.observe(), 'skill-heavy');
    expect(heavy?.available).toBe(false);
    expect(heavy?.reason).toBe('insufficient-cp');
  });

  it('기본 스킬은 소모가 없어 기력이 없어도 나간다', () => {
    const world = driveWorld({ npcs: [dummyAt(15, 15)] });
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'cp', value: 0 } });

    expect(world.dispatch({ interactionId: 'attack' }).status).toBe('success');
  });

  it('스킬의 수지와 피해는 쓰기 전에 관찰된다', () => {
    // C010 — 실리는 것은 최종 피해가 아니라 "내가 실어 보내는 공격 피해" 다.
    // 최종 피해는 대상이 정해져야 알 수 있으므로 여기 실리지 않는다.
    const view = soloWorld().observe();
    expect(skill(view, 'attack')?.profile).toEqual({
      baseDamage: 6,
      attackRatio: 0.5,
      rawDamage: 26, // 6 + 40 × 0.5 (PhysicalAttack)
      charge: BASIC.cpCharge,
      cost: BASIC.cpCost,
      damageType: 'physical', // C012
      swingBegin: BASIC.swingBegin, // C019 — 고르기 전에 아는 선딜
      swingEnd: BASIC.swingEnd,
      swingArc: BASIC.swingArc, // C025 — 고르기 전에 아는 모양
      swingReach: BASIC.swingReach,
      swingTipRadius: BASIC.swingTipRadius,
    });
    expect(skill(view, 'skill-heavy')?.profile).toEqual({
      baseDamage: 32,
      attackRatio: 1.0,
      rawDamage: 72, // 32 + 40 × 1.0 (PhysicalAttack)
      charge: HEAVY.cpCharge,
      cost: HEAVY.cpCost,
      damageType: 'physical', // C012
      swingBegin: HEAVY.swingBegin, // C019 — 큰 기술은 선딜이 더 길다
      swingEnd: HEAVY.swingEnd,
      swingArc: HEAVY.swingArc, // C025 — 큰 기술은 좁고 멀리 닿는다
      swingReach: HEAVY.swingReach,
      swingTipRadius: HEAVY.swingTipRadius,
    });
  });
});

describe('INTENT-DOWNED-001 — 생명이 다하면 쓰러진다', () => {
  // 맞은 몸은 밀려나므로(C006) 한자리에서 연달아 때려 눕히기 어렵다.
  // 생명을 한 대로 확실히 지는 만큼만 남겨 두고 한 번 때린다 — 쓰러짐 자체가 이
  // describe 의 대상이며 한 대의 크기는 발판일 뿐이다.
  //
  // C-COMBAT-001 CHANGED — 남기는 값이 BASIC_DAMAGE 에서 1 로 바뀐다. 자율 존재는
  // 생명이 절반 아래로 내려가면 몸에 몰아 단단해지므로(RULE-NPC-ALLOCATION-001),
  // "한 대 분량" 을 남겨 두면 그 한 대가 줄어들어 3 이 남는다. 그것은 이 Cycle 이
  // 의도한 결과이고(03 BALANCE ⑤), 여기서 검증할 것은 그 크기가 아니라 쓰러짐이다.
  const downNpc = (world: WorldDriver) => {
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 1 },
    });
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration + TICK_INTERVAL);
  };

  it('생명이 0 이 되면 쓰러지고 더 이상 행동하지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    downNpc(world);

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.vitality?.health).toBe(0);
    expect(npc?.vitality?.downed).toBe(true);
    expect(npc?.state).toBe('downed');
  });

  it('쓰러진 몸은 더 이상 타격 대상이 되지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    downNpc(world);

    const before = hud(world.observe(), 'self.cp') as number;
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration);

    // 맞은 것이 없으니 기력도 돌지 않는다
    expect(hud(world.observe(), 'self.cp')).toBe(before);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('downed');
  });

  it('쓰러진 존재는 스스로 아무 행동도 시작하지 못한다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    downNpc(world);
    tickFor(world, 2.0); // 충분히 기다려도

    expect(actor(world.observe(), 'npc-1')?.state).toBe('downed');
  });
});

describe('INTENT-RUN-001 — 달리면 기력이 샌다', () => {
  it('달리기로 바꾸면 이동이 빨라지고 기력이 줄어든다', () => {
    const walk = soloWorld();
    walk.dispatch({ interactionId: 'move', position: { x: 18, z: 0 } });
    tickFor(walk, 0.5);
    const walked = actor(walk.observe(), PLAYER)?.position.x ?? 0;

    const run = soloWorld();
    expect(run.dispatch({ interactionId: 'move-mode', mode: 'run' }).status).toBe('success');
    run.dispatch({ interactionId: 'move', position: { x: 18, z: 0 } });
    tickFor(run, 0.5);
    const ran = actor(run.observe(), PLAYER)?.position.x ?? 0;

    expect(ran).toBeGreaterThan(walked);
    expect(hud(run.observe(), 'self.cp')).toBeLessThan(30);
  });

  it('멈춰 있으면 달리기로 두어도 기력이 새지 않는다', () => {
    const world = soloWorld();
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    tickFor(world, 1.0);

    expect(hud(world.observe(), 'self.cp')).toBe(30);
  });

  it('기력이 바닥나면 달릴 수 없고 걷기로 돌아온다', () => {
    const world = soloWorld();
    // 목적지에 닿으면 이동이 끝나 누수도 멎는다 — 계속 달리도록 걸음을 늦춰 둔다.
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'moveSpeed', value: 0.5 } });
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    world.dispatch({ interactionId: 'move', position: { x: 18, z: 18 } });
    // 시작 기력 30 / 초당 6 = 5초면 바닥난다
    tickFor(world, 6.0);

    expect(hud(world.observe(), 'self.cp')).toBe(0);
    expect(hud(world.observe(), 'self.moveMode')).toBe('walk');

    const result = world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-MODE-001',
      reason: 'insufficient-cp',
    });
  });

  it('이동 모드 요청은 토글이 아니라 명시값이다 — 두 번 보내도 결과가 같다', () => {
    const world = soloWorld();
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    expect(hud(world.observe(), 'self.moveMode')).toBe('run');
  });

  it('기력이 흘러나간 양은 달린 시간에 비례한다', () => {
    const world = soloWorld();
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    world.dispatch({ interactionId: 'move', position: { x: 18, z: 18 } });
    tickFor(world, 1.0);

    const spent = 30 - (hud(world.observe(), 'self.cp') as number);
    expect(spent).toBeCloseTo(RUN_CP_DRAIN * 1.0, 1);
  });
});

describe('INTENT-MODIFIER-COMPOSE-001 — 배율은 원천들의 곱이다', () => {
  it('원천이 없으면 모든 배율이 1 이다', () => {
    const view = soloWorld().observe();
    expect(hud(view, 'self.modifier.cpCharge')).toBe(1);
    expect(hud(view, 'self.modifier.cpConsume')).toBe(1);
    expect(hud(view, 'self.modifier.moveSpeed')).toBe(1);
    expect(hud(view, 'self.modifier.actionSpeed')).toBe(1);
  });

  it('달리는 중에는 기력 충전이 억눌린다', () => {
    const world = soloWorld();
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    expect(hud(world.observe(), 'self.modifier.cpCharge')).toBe(RUN_CHARGE_FACTOR);
  });

  it('얻어맞은 직후에는 충전이 더 크게 억눌린다', () => {
    // 자율 존재가 나를 때리게 둔다
    const world = driveWorld({
      npcs: [
        { id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9, guardedGround: WHOLE_STAGE },
      ],
    });
    expect(tickUntilHit(world)).toBe(true);

    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');
    expect(hud(world.observe(), 'self.modifier.cpCharge')).toBe(HIT_CHARGE_FACTOR);
  });

  it('달리면서 맞으면 두 원천이 곱해진다', () => {
    const world = driveWorld({
      npcs: [
        { id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9, guardedGround: WHOLE_STAGE },
      ],
    });
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    expect(tickUntilHit(world)).toBe(true);

    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');
    expect(hud(world.observe(), 'self.modifier.cpCharge')).toBeCloseTo(
      RUN_CHARGE_FACTOR * HIT_CHARGE_FACTOR,
      10,
    );
  });
});

describe('INTENT-TEMPO-ACTION-001 — 공격 속도가 행동 길이를 정한다', () => {
  it('공격 속도를 올리면 같은 스킬이 더 짧게 끝난다', () => {
    const fast = driveWorld({ npcs: [dummyAt(15, 15)] });
    fast.dispatch({ interactionId: 'set-attribute', attribute: { id: 'actionSpeed', value: 2 } });
    fast.dispatch({ interactionId: 'attack' });
    // 0.6 / 2 = 0.3 초면 끝난다
    tickFor(fast, 0.35);
    expect(actor(fast.observe(), PLAYER)?.state).toBe('idle');

    const normal = driveWorld({ npcs: [dummyAt(15, 15)] });
    normal.dispatch({ interactionId: 'attack' });
    tickFor(normal, 0.35);
    expect(actor(normal.observe(), PLAYER)?.state).toBe('attack');
  });

  it('행동 길이는 시작할 때 확정된다 — 진행 중에 바뀌지 않는다', () => {
    const world = driveWorld({ npcs: [dummyAt(15, 15)] });
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, 0.2);
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'actionSpeed', value: 2 } });
    tickFor(world, 0.15); // 0.35 초 — 바뀐 속도였다면 벌써 끝났어야 한다

    expect(actor(world.observe(), PLAYER)?.state).toBe('attack');
  });
});

describe('INTENT-TEMPO-MOVE-001 — 이동 속도는 배율이 걸리는 능력치다', () => {
  it('이동 속도를 바꾸면 같은 시간에 나아가는 거리가 달라진다', () => {
    const slow = soloWorld();
    slow.dispatch({ interactionId: 'set-attribute', attribute: { id: 'moveSpeed', value: 3 } });
    slow.dispatch({ interactionId: 'move', position: { x: 18, z: 0 } });
    tickFor(slow, 0.5);

    const fast = soloWorld();
    fast.dispatch({ interactionId: 'move', position: { x: 18, z: 0 } });
    tickFor(fast, 0.5);

    expect(actor(fast.observe(), PLAYER)!.position.x).toBeGreaterThan(
      actor(slow.observe(), PLAYER)!.position.x,
    );
  });
});

describe('INTENT-STRIKE-OBSERVE-001 — 타격 결과가 잠시 드러났다 사라진다', () => {
  it('누가 누구를 어느 스킬로 얼마나 깎았는지가 실린다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);

    const strikes = world.observe().strikes;
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toMatchObject({
      attackerId: PLAYER,
      targetId: 'npc-1',
      skill: 'attack',
      amount: BASIC_DAMAGE,
    });
  });

  it('시간이 지나면 세계에서 사라진다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);
    expect(world.observe().strikes.length).toBe(1);

    tickFor(world, STRIKE_EVENT_TTL + 0.2);
    expect(world.observe().strikes).toHaveLength(0);
  });
});

// C014 CHANGED — 이 describe 의 의미가 바뀌었다.
// "세계는 어떤 속성도 숨기지 않는다"(C007 R2)에서 "세계가 무엇이 언제 실리는지를
// 정하고, 가린 것이 있으면 가렸다는 사실을 밝힌다"로 옮겨간다 (Q3 · C014 02-intent).
// 테스트를 지우지 않고 새 경계로 다시 쓴다 — 무엇이 **여전히** 안 가려지는가가 이 자리다.
describe('INTENT-ATTRIBUTE-OBSERVE-001 — 세계가 무엇이 언제 실리는지를 정한다 (C014 CHANGED)', () => {
  it('살펴보기 전에도 몸에서 읽히는 속성은 하나도 가려지지 않는다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();
    const npc = actor(view, 'npc-1');

    expect(npc?.attributes).toEqual({
      energy: 20,
      energyMaximum: 60,
      moveMode: 'walk',
      control: 'autonomous',
      tempoStats: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
      modifiers: { energyCharge: 1, energyConsume: 1, moveSpeed: 1, actionSpeed: 1 },
      // C-COMBAT-001 — 지금의 배분도 가려지지 않는다. 몰아 두는 일은 몸이 드러내는
      // 것이며, 이 존재는 성한 채이므로 고르게 나눈 배분이다 (모든 값에 0 을 보탠다)
      allocation: { id: 'balanced', shares: { body: 2, ability: 2, awareness: 2 } },
      // C011 — 자율 존재는 막지 않지만 그 사실도 실린다
      guard: { guarding: false, broken: false },
      // C014 — 겨루는 힘 셋만 살펴봄 뒤로 갔고, 가렸다는 사실이 그 자리를 대신한다.
      // 몰래 가리지 않는다 — 무엇을 모르는지를 모르는 일은 없다
      acquainted: false,
      concealed: ['combatStats', 'versusObserver', 'defenseShape'],
      unacquaintedReason: 'not-observed',
      // C016 — 통찰도 가려지지 않는다. 겨루는 힘이 아니라 아는 힘이며,
      // 이 존재는 아무것도 기르지 않았으므로 0 이다
      insight: 0,
      // C018 — 둘 사이의 태도도 가려지지 않는다. 이 존재는 이 무대를 자기 자리로
      // 지니므로 나를 사냥감으로 대하고, 나는 지킬 것이 없으므로 중립이다
      stanceTowardObserver: 'hostile',
      stanceFromObserver: 'neutral',
    });
  });

  it('살펴본 뒤에는 그 셋도 예외 없이 실린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(world, 'npc-1');
    const npc = actor(world.observe(), 'npc-1');

    expect(npc?.attributes).toEqual({
      energy: 20,
      energyMaximum: 60,
      moveMode: 'walk',
      control: 'autonomous',
      tempoStats: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
      modifiers: { energyCharge: 1, energyConsume: 1, moveSpeed: 1, actionSpeed: 1 },
      // C-COMBAT-001 — 지금의 배분도 가려지지 않는다. 몰아 두는 일은 몸이 드러내는
      // 것이며, 이 존재는 성한 채이므로 고르게 나눈 배분이다 (모든 값에 0 을 보탠다)
      allocation: { id: 'balanced', shares: { body: 2, ability: 2, awareness: 2 } },
      // C010 → C012 → C013 → C015 — 새 속성도 예외 없이 실린다.
      // 여섯 능력과 두 배율과 Critical 둘이 모두 실린다
      combatStats: {
        physicalAttack: 40,
        auraAttack: 15,
        armor: 30,
        resistance: 90,
        armorPenetration: 0,
        resistancePenetration: 0,
        armorMultiplier: 100 / 130,
        resistanceMultiplier: 100 / 190,
        // C015 — wanderer 는 터뜨리지 못한다 (criticalChance 0)
        criticalChance: 0,
        criticalDamage: 1,
      },
      // C013 — 이 존재의 방어가 보는 이(관찰자)에게 얼마로 읽히는가.
      // 관찰자는 오라 관통 60 을 지니므로 오라 방어 90 이 56.25 로 읽힌다.
      // 물리 쪽은 관통이 0 이라 원래 값과 같다 — 같다는 것 자체가 관찰이다
      versusObserver: {
        armor: 30,
        resistance: 90 * (100 / 160),
        armorMultiplier: 100 / 130,
        resistanceMultiplier: 100 / (100 + 90 * (100 / 160)),
      },
      // C012 — 어느 쪽이 더 단단한지도 세계가 판정해 싣는다.
      // wanderer 는 오라 쪽(90)이 물리 쪽(30)보다 단단하다
      defenseShape: 'aura-tougher',
      // C011 — 자율 존재는 막지 않지만 그 사실도 실린다.
      // "지금은 아무도 안 막는다" 와 "세계가 안 알려준다" 는 다른 일이다
      guard: { guarding: false, broken: false },
      // C014 — 알게 되었으므로 가려진 것이 없다
      acquainted: true,
      concealed: [],
      // C016 — 살펴봄으로 열렸든 통찰로 열렸든 실리는 값은 같다
      insight: 0,
      // C018 — 둘 사이의 태도도 가려지지 않는다. 이 존재는 이 무대를 자기 자리로
      // 지니므로 나를 사냥감으로 대하고, 나는 지킬 것이 없으므로 중립이다
      stanceTowardObserver: 'hostile',
      stanceFromObserver: 'neutral',
    });
  });

  it('자기 속성은 늘 눈앞에도 있다 (hud.self)', () => {
    const view = soloWorld().observe();
    expect(hud(view, 'self.hp')).toBe(200);
    expect(hud(view, 'self.cp')).toBe(30);
    expect(hud(view, 'self.tempo.actionSpeed')).toBe(1);
  });
});

describe('INTENT-ATTRIBUTE-MUTATE-001 — 세계가 허용하면 속성을 바꿀 수 있다 (R2)', () => {
  // C009 CHANGED — 이 목록은 없어지지 않고 자리를 옮겼다.
  // 이제 set-attribute 명령이 받는 값의 Domain 이다 (03 SEMANTIC DELTA CHANGED).
  it('바꿀 수 있는 목록과 범위를 세계가 알려 준다', () => {
    const view = soloWorld().observe();
    expect(view.debug.open).toBe(true);

    const attribute = view.commands
      .find((command) => command.id === 'set-attribute')
      ?.parameters.find((parameter) => parameter.id === 'attribute');
    expect(attribute?.domain.options?.map((option) => option.name)).toEqual([
      'hp',
      'hpMax',
      'cp',
      'cpMax',
      // C012 — 두 항목이 넷으로 갈린다. 목록이 바뀔 뿐 계약은 그대로다
      'physicalAttack',
      'auraAttack',
      'armor',
      'resistance',
      // C013 — 관통 둘이 더해진다. 목록이 바뀔 뿐 계약은 그대로다
      'armorPenetration',
      'resistancePenetration',
      // C015 — Critical 둘이 더해진다. 범위가 좁은 첫 항목들이지만(0~1 · 1~100)
      // 계약은 그대로다 — 범위는 원래부터 세계가 목록과 함께 싣는 것이다
      'criticalChance',
      'criticalDamage',
      // C016 — 통찰이 목록에 더해진다. 이것이 이 Cycle 의 확인 경로다
      'insight',
      // C-GROWTH-001 — 한 일이 목록에 더해진다. 이 한 줄이 다섯 단계를 만들어 보는 길이다
      'deeds',
      'moveSpeed',
      'runSpeedMultiplier',
      'actionSpeed',
      'moveMode',
    ]);
  });

  it('지목한 존재의 속성을 바꾼다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const result = world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 5 },
    });

    expect(result).toEqual({ status: 'success', rule: 'RULE-ATTRIBUTE-SET-001' });
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(5);
  });

  it('권한이 닫힌 세계에서는 아무것도 바꾸지 못한다', () => {
    const world = driveWorld({ debugAuthority: false, npcs: [dummyAt(3, 0)] });
    const result = world.dispatch({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 1 },
    });

    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'debug-closed',
    });
    expect(world.observe().debug.open).toBe(false);
    expect(hud(world.observe(), 'self.hp')).toBe(200);
    // 상호작용 자체가 가용하지 않다
    expect(skill(world.observe(), 'set-attribute')?.available).toBe(false);
  });

  it('모르는 속성·모르는 대상·범위 밖 값은 사유를 남기고 거절된다', () => {
    const world = soloWorld();
    expect(
      world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'luck', value: 1 } }).status,
    ).toBe('failure');
    expect(
      world.dispatch({
        interactionId: 'set-attribute',
        targetEntityId: 'nobody',
        attribute: { id: 'hp', value: 1 },
      }),
    ).toEqual({ status: 'failure', rule: 'RULE-ATTRIBUTE-SET-001', reason: 'unknown-target' });
    expect(
      world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'hp', value: -5 } }),
    ).toEqual({ status: 'failure', rule: 'RULE-ATTRIBUTE-SET-001', reason: 'value-out-of-range' });
  });

  it('값이 바뀐 뒤에도 세계는 자기 규칙대로 간다 — hp 를 0 으로 만들면 쓰러진다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 0 },
    });

    expect(actor(world.observe(), 'npc-1')?.state).toBe('downed');
  });

  it('규칙이 되돌리지 않는 것도 밖에서는 되돌아온다 — 쓰러진 몸에 생명을 주면 일어난다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 0 },
    });
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 50 },
    });

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.vitality?.downed).toBe(false);
    expect(npc?.state).toBe('idle');
  });

  it('최대치를 낮추면 현재값도 함께 들어온다', () => {
    const world = soloWorld();
    world.dispatch({ interactionId: 'set-attribute', attribute: { id: 'hpMax', value: 50 } });

    expect(hud(world.observe(), 'self.hp')).toBe(50);
    expect(hud(world.observe(), 'self.hpMax')).toBe(50);
  });
});

describe('결정론 회귀 — 같은 입력이면 같은 세계다', () => {
  it('두 세계를 같은 순서로 굴리면 자원까지 같은 값이 된다', () => {
    const run = () => {
      const world = driveWorld({
        npcs: [
        { id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9, guardedGround: WHOLE_STAGE },
      ],
      });
      world.dispatch({ interactionId: 'attack' });
      tickFor(world, 2.0);
      const view = world.observe();
      return {
        selfHp: hud(view, 'self.hp'),
        selfCp: hud(view, 'self.cp'),
        npcHp: actor(view, 'npc-1')?.vitality?.health,
        strikes: view.strikes.length,
      };
    };

    expect(run()).toEqual(run());
  });
});
