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
  MIN_DAMAGE_RATIO,
  RUN_CHARGE_FACTOR,
  RUN_CP_DRAIN,
  SKILL_DEFINITIONS,
  STRIKE_EVENT_TTL,
} from '../semantic/combat';
import { SWING_BEGIN } from '../semantic/collision';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const BASIC = SKILL_DEFINITIONS.attack;
const HEAVY = SKILL_DEFINITIONS['heavy-attack'];

// C010 AFFECTED — 피해는 이제 "본래 피해" 이며, 맞은 자의 방어력이 걷어낸 뒤 남은 몫이
// 생명에서 나간다 (RULE-STRIKE-DAMAGE-001 CHANGED, 단계 2).
// 여기 아래 검증들은 막지 않은 몸을 다루므로 자세는 관여하지 않는다 — 방어력만 걸린다.
const WANDERER_DEFENSE = 3;
const mitigated = (base: number) =>
  Math.max(base * MIN_DAMAGE_RATIO, base - WANDERER_DEFENSE);
const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// 휘두름은 몸이 향한 방향으로 나간다 — +x 로 한 걸음 걸어 그쪽을 보게 한다 (C006 R1).
const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

// 순회도 인지도 없는 정지 NPC — 때릴 대상으로만 쓴다 (결정론)
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
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

describe('INTENT-STRIKE-DAMAGE-001 — 피해는 스킬이 정한 고정값이다', () => {
  it('기본 스킬은 언제나 같은 값을 깎는다 — 흔들림이 없다', () => {
    // 맞은 몸은 밀려나므로(C006) 두 번째 휘두름은 같은 자리에 닿지 않는다.
    // 고정 피해임을 보이려면 같은 조건을 두 번 만드는 편이 정확하다.
    const strike = () => {
      const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
      aimRight(world);
      world.dispatch({ interactionId: 'attack' });
      tickFor(world, AFTER_SWING_OPEN);
      return actor(world.observe(), 'npc-1')?.vitality?.health;
    };

    expect(strike()).toBe(120 - mitigated(BASIC.damage));
    expect(strike()).toBe(120 - mitigated(BASIC.damage)); // R1 — 판정도 우연도 없다
  });

  it('고급 스킬은 기본 스킬보다 크게 깎는다', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);

    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, SWING_BEGIN * HEAVY.baseDuration + 2 * TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - mitigated(HEAVY.damage));
    expect(HEAVY.damage).toBeGreaterThan(BASIC.damage);
  });

  it('한 휘두름은 같은 몸을 한 번만 때린다 (C006 회귀)', () => {
    const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(world);

    world.dispatch({ interactionId: 'attack' });
    tickFor(world, BASIC.baseDuration); // 휘두름 전 구간을 지나도
    expect(actor(world.observe(), 'npc-1')?.vitality?.health).toBe(120 - mitigated(BASIC.damage));
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
    tickFor(world, SWING_BEGIN * HEAVY.baseDuration + 2 * TICK_INTERVAL);

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
    expect(actor(view, 'npc-1')?.vitality?.health).toBe(120 - mitigated(BASIC.damage));
    expect(actor(view, 'npc-2')?.vitality?.health).toBe(120 - mitigated(BASIC.damage));
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
    const view = soloWorld().observe();
    expect(skill(view, 'attack')?.profile).toEqual({
      damage: BASIC.damage,
      charge: BASIC.cpCharge,
      cost: BASIC.cpCost,
    });
    expect(skill(view, 'skill-heavy')?.profile).toEqual({
      damage: HEAVY.damage,
      charge: HEAVY.cpCharge,
      cost: HEAVY.cpCost,
    });
  });
});

describe('INTENT-DOWNED-001 — 생명이 다하면 쓰러진다', () => {
  // 맞은 몸은 밀려나므로(C006) 한자리에서 연달아 때려 눕히기 어렵다.
  // 생명을 한 대 분량만 남겨 두고 한 번 때린다 — 쓰러짐 자체가 이 describe 의 대상이다.
  const downNpc = (world: WorldDriver) => {
    world.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      // C010 — 한 대 분량은 이제 방어력이 걷어낸 뒤의 값이다
      attribute: { id: 'hp', value: mitigated(BASIC.damage) },
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
      npcs: [{ id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9 }],
    });
    tickFor(world, 1.5);

    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');
    expect(hud(world.observe(), 'self.modifier.cpCharge')).toBe(HIT_CHARGE_FACTOR);
  });

  it('달리면서 맞으면 두 원천이 곱해진다', () => {
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9 }],
    });
    world.dispatch({ interactionId: 'move-mode', mode: 'run' });
    tickFor(world, 1.5);

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
      amount: mitigated(BASIC.damage),
      // C010 — 값 하나가 아니라 그 값을 만든 내역이 함께 실린다
      breakdown: {
        base: BASIC.damage,
        mitigated: mitigated(BASIC.damage),
        guarded: false,
        energyPaid: 0,
        guardBroken: false,
      },
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

describe('INTENT-ATTRIBUTE-OBSERVE-001 — 세계는 어떤 속성도 숨기지 않는다', () => {
  it('남의 속성도 모두 관찰된다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();
    const npc = actor(view, 'npc-1');

    expect(npc?.attributes).toEqual({
      energy: 20,
      energyMaximum: 60,
      moveMode: 'walk',
      control: 'autonomous',
      defense: WANDERER_DEFENSE, // C010
      tempoStats: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
      modifiers: { energyCharge: 1, energyConsume: 1, moveSpeed: 1, actionSpeed: 1 },
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
      'moveSpeed',
      'runSpeedMultiplier',
      'actionSpeed',
      'moveMode',
      'defense', // C010
      'stance', // C010
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
        npcs: [{ id: 'npc-1', position: { x: 1.2, z: 0 }, wanderPath: [], perceptionRange: 9 }],
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
