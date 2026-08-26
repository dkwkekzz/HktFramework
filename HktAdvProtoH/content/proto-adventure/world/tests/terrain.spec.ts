// C-TERRAIN-001 땅 World 단독 테스트
// RULE-GROUND-LAW-APPLY-001
//
// Implements INTENT-GROUND-IS-DIVIDED-INTO-PLACES-001 ·
//            INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001 ·
//            INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 ·
//            INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 ·
//            INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001 ·
//            INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 ·
//            INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 ·
//            INTENT-STANDING-IS-THE-WHOLE-INPUT-001 ·
//            INTENT-GROUND-LAW-IS-OBSERVED-001 · INTENT-GROUND-PLACES-ARE-OBSERVED-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준: heat-binding rate 4.0/초 · lifeRate 2.0/초 · WARMTH_MAX 100
//   빙원 zone-ice-field   center (-11, 11) radius 7.0
//   해숨구멍 zone-sunbreath center (-13, 13) radius 2.5  ← 빙원 **안**이다

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { spawnActor } from '../semantic/spawn';
import type { ActorState } from '../semantic/actor';
import { GROUND_ZONES, WARMTH_MAX, type WorldState } from '../semantic/world-state';
import type { GroundZone } from '../semantic/terrain';
import { ruleGroundLawApply } from '../simulation/ground-law-apply';
import { driveWorld, PLAYER } from './drive';

const INSIDE_ICE = { x: -11, z: 11 }; // 빙원 한가운데 — 해숨구멍 밖 (중심 사이 2.83 > 2.5)
const INSIDE_RESPITE = { x: -13, z: 13 }; // 해숨구멍 한가운데
const OUTSIDE = { x: 0, z: 0 }; // 원점 — 어느 자리에도 들지 않는다

function body(position: { x: number; z: number }, id = 'body-1'): ActorState {
  return spawnActor({
    id,
    name: id,
    characterKind: 'wanderer',
    control: 'autonomous',
    position,
  });
}

/** 규칙이 읽는 것은 actors 와 groundZones 뿐이다 — 그 둘만 갖춘 세계로 검사한다 */
function stateOf(actors: ActorState[], zones: readonly GroundZone[] = GROUND_ZONES): WorldState {
  return { actors, groundZones: [...zones] } as unknown as WorldState;
}

const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;

// ── 자리와 그 안의 판정 ────────────────────────────────────────────────

describe('INTENT-GROUND-IS-DIVIDED-INTO-PLACES-001 — 무대가 자리로 나뉜다', () => {
  it('자리 밖에서는 아무 일도 일어나지 않는다 — 이 Cycle 이전의 세계 그대로다', () => {
    const actor = body(OUTSIDE);
    const applied = ruleGroundLawApply(stateOf([actor]), 1.0);

    expect(applied).toBe(0);
    expect(actor.warmth).toBe(WARMTH_MAX);
    expect(actor.hp).toBe(actor.hpMax);
  });

  it('자리는 겹친다 — 해숨구멍이 빙원 안에 온전히 들어 있다', () => {
    // 예외가 법칙 안에 있다는 것이 배치로도 참이어야 한다 (BT §5.3).
    const ice = GROUND_ZONES.find((z) => z.id === 'zone-ice-field');
    const respite = GROUND_ZONES.find((z) => z.id === 'zone-sunbreath');
    const between = Math.hypot(
      ice!.center.x - respite!.center.x,
      ice!.center.z - respite!.center.z,
    );

    expect(between + respite!.radius).toBeLessThanOrEqual(ice!.radius);
  });
});

describe('INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 — 머무는 동안 거두어 간다', () => {
  it('법칙의 자리 안에 있으면 지닌 열이 준다 — 1초에 4', () => {
    const actor = body(INSIDE_ICE);

    ruleGroundLawApply(stateOf([actor]), 1.0);

    expect(actor.warmth).toBe(96);
  });

  it('머문 시간에 비례한다 — 스쳐 지나가는 것과 버티는 것이 다르다', () => {
    const brief = body(INSIDE_ICE, 'brief');
    const long = body(INSIDE_ICE, 'long');

    ruleGroundLawApply(stateOf([brief]), 0.25); // 스쳐 지난다
    ruleGroundLawApply(stateOf([long]), 5.0); // 버틴다

    expect(brief.warmth).toBe(99);
    expect(long.warmth).toBe(80);
  });

  it('줄어드는 동안 몸은 상하지 않는다 — 피해가 아니라 빠져나가는 것이다 (BT §5.2)', () => {
    const actor = body(INSIDE_ICE);

    ruleGroundLawApply(stateOf([actor]), 10.0);

    expect(actor.warmth).toBe(60);
    expect(actor.hp).toBe(actor.hpMax); // 한 점도 상하지 않았다
  });
});

describe('INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 — 누구인지 묻지 않는다', () => {
  it('자율 존재도 관찰자의 몸과 똑같이 겪는다', () => {
    const autonomous = spawnActor({
      id: 'npc-x',
      name: 'npc-x',
      characterKind: 'wanderer',
      control: 'autonomous',
      position: INSIDE_ICE,
    });
    const controlled = spawnActor({
      id: 'player-x',
      name: 'player-x',
      characterKind: 'wanderer',
      control: 'player',
      position: INSIDE_ICE,
    });

    ruleGroundLawApply(stateOf([autonomous, controlled]), 2.0);

    expect(autonomous.warmth).toBe(92);
    expect(controlled.warmth).toBe(92); // 조종 주체가 판정을 가르지 않는다
  });
});

// ── 예외 자리 ──────────────────────────────────────────────────────────

describe('INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 — 법칙이 멎는 자리', () => {
  it('해숨구멍 안에서는 멎는다 — 빙원 안인데도 거두어 가지 않는다', () => {
    const actor = body(INSIDE_RESPITE);

    const applied = ruleGroundLawApply(stateOf([actor]), 5.0);

    expect(applied).toBe(0);
    expect(actor.warmth).toBe(WARMTH_MAX);
  });

  it('멎게 할 뿐 되돌리지 않는다 — 채우는 것은 다음 후보의 몫이다', () => {
    const actor = body(INSIDE_ICE);
    ruleGroundLawApply(stateOf([actor]), 5.0);
    expect(actor.warmth).toBe(80);

    actor.position = { ...INSIDE_RESPITE };
    ruleGroundLawApply(stateOf([actor]), 5.0);

    expect(actor.warmth).toBe(80); // 한 점도 돌아오지 않는다
  });

  it('다른 법칙의 예외 자리는 이 법칙을 멎게 하지 못한다', () => {
    // 예외는 법칙 **옆**에 놓인 다른 규칙이 아니라 그 법칙이 만든 것이다.
    // 그러므로 "모든 것을 막는 안전지대" 는 이 형태로 적을 수 없다.
    const zones = [
      { id: 'ice', law: 'heat-binding', role: 'law', center: OUTSIDE, radius: 5 },
      // 같은 자리에 있으나 다른 법칙의 예외다 — 지금 세계에 법칙이 하나뿐이므로
      // 두 번째 법칙 이름은 이 검사 안에서만 쓴다 (형태를 검사하는 것이다).
      { id: 'other-respite', law: 'other-law', role: 'respite', center: OUTSIDE, radius: 5 },
    ] as unknown as GroundZone[];
    const actor = body(OUTSIDE);

    ruleGroundLawApply(stateOf([actor], zones), 1.0);

    expect(actor.warmth).toBe(96); // 멎지 않았다
  });

  it('나오면 다시 겪는다 — 멎게 하는 규칙도 되돌리는 규칙도 없다', () => {
    // 어디에도 적히지 않으므로 매 Tick 위치에서 다시 계산된다
    // (DC-CONDITION-OPENS-WITHOUT-RECORDING).
    const actor = body(INSIDE_RESPITE);
    ruleGroundLawApply(stateOf([actor]), 5.0);
    expect(actor.warmth).toBe(WARMTH_MAX);

    actor.position = { ...INSIDE_ICE };
    ruleGroundLawApply(stateOf([actor]), 1.0);

    expect(actor.warmth).toBe(96);
  });
});

// ── 다한 뒤 ────────────────────────────────────────────────────────────

describe('INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 — 다하면 생명에 닿는다', () => {
  it('열이 다할 때까지는 생명이 줄지 않는다', () => {
    const actor = body(INSIDE_ICE);

    ruleGroundLawApply(stateOf([actor]), 25.0); // 100 / 4.0 = 25초

    expect(actor.warmth).toBe(0);
    expect(actor.hp).toBe(actor.hpMax);
  });

  it('열이 0 이 된 뒤에야 생명이 준다 — 1초에 2', () => {
    const actor = body(INSIDE_ICE);
    actor.warmth = 0;

    ruleGroundLawApply(stateOf([actor]), 3.0);

    expect(actor.hp).toBe(actor.hpMax - 6);
  });

  it('생명이 다하면 이미 있는 끝에 이른다 — 새 형태의 끝을 만들지 않는다', () => {
    const actor = body(INSIDE_ICE);
    actor.warmth = 0;
    actor.hp = 3;

    ruleGroundLawApply(stateOf([actor]), 5.0);

    expect(actor.hp).toBe(0);
    expect(actor.currentAction.kind).toBe('downed'); // RULE-DOWNED-001 그대로
  });

  it('쓰러진 몸에서는 더 거두지 않는다 — 이미 끝에 이른 몸을 두 번 끝내지 않는다', () => {
    const actor = body(INSIDE_ICE);
    actor.warmth = 0;
    actor.hp = 1;
    ruleGroundLawApply(stateOf([actor]), 5.0);
    expect(actor.currentAction.kind).toBe('downed');

    const applied = ruleGroundLawApply(stateOf([actor]), 5.0);

    expect(applied).toBe(0);
    expect(actor.hp).toBe(0);
  });
});

// ── 관찰 ───────────────────────────────────────────────────────────────

describe('INTENT-GROUND-PLACES-ARE-OBSERVED-001 — 자리의 범위가 실린다', () => {
  it('무대의 자리들이 관찰에 실린다 — 몸이 아닌 것이 실리는 첫 항목이다', () => {
    const world = driveWorld({ npcs: [] });

    const zones = world.observe().ground.zones;

    expect(zones).toEqual([
      { id: 'zone-ice-field', law: 'heat-binding', role: 'law', center: { x: -11, z: 11 }, radius: 7 },
      {
        id: 'zone-sunbreath',
        law: 'heat-binding',
        role: 'respite',
        center: { x: -13, z: 13 },
        radius: 2.5,
      },
    ]);
  });
});

describe('INTENT-GROUND-LAW-IS-OBSERVED-001 — 지금 걸린 법칙이 실린다', () => {
  it('자리 밖 — none 이고 법칙도 거두는 것도 없다', () => {
    const world = driveWorld({ npcs: [], actorPosition: OUTSIDE });

    expect(world.observe().ground.self).toEqual({ state: 'none' });
  });

  it('빙원 안 — taking 과 그 사유가 함께 온다', () => {
    const world = driveWorld({ npcs: [], actorPosition: INSIDE_ICE });

    expect(world.observe().ground.self).toEqual({
      law: 'heat-binding',
      state: 'taking',
      takes: 'warmth',
    });
  });

  it('해숨구멍 안 — sheltered 다. none 과 구분되는 것이 요점이다', () => {
    const world = driveWorld({ npcs: [], actorPosition: INSIDE_RESPITE });

    const self = world.observe().ground.self;
    expect(self).toEqual({ law: 'heat-binding', state: 'sheltered', takes: 'warmth' });
    expect(self.state).not.toBe('none'); // 법칙이 멎어서 조용한 것과 애초에 조용한 것은 다르다
  });

  it('지닌 열과 그 최대가 함께 실린다', () => {
    const world = driveWorld({ npcs: [], actorPosition: OUTSIDE });

    expect(hud(world.observe(), 'self.warmth')).toBe(WARMTH_MAX);
    expect(hud(world.observe(), 'self.warmthMax')).toBe(WARMTH_MAX);
  });
});

// ── 플레이 ─────────────────────────────────────────────────────────────

describe('Cycle Goal — 어디에 서 있는가가 결과를 바꾼다', () => {
  it('빙원에 서 있으면 열이 계속 줄고, 해숨구멍으로 걸어 들어가면 멎는다', () => {
    // 빙원 가장자리 바로 안쪽에 선다 (중심에서 6.5 — 반경 7.0 안, 해숨구멍 밖)
    const world = driveWorld({ npcs: [], actorPosition: { x: -6, z: 8 } });

    world.tick(1.0);
    expect(world.observe().ground.self.state).toBe('taking');
    const afterOneSecond = hud(world.observe(), 'self.warmth') as number;
    expect(afterOneSecond).toBeLessThan(WARMTH_MAX);

    world.tick(1.0);
    expect(hud(world.observe(), 'self.warmth')).toBeLessThan(afterOneSecond); // 계속 준다

    // 해숨구멍으로 걸어 들어간다 — 요청은 걷기 하나뿐이다
    world.dispatch({ interactionId: 'move', position: INSIDE_RESPITE });
    for (let i = 0; i < 40; i++) world.tick(0.1);

    expect(player(world.observe())?.state).toBe('idle'); // 도착했다
    expect(world.observe().ground.self.state).toBe('sheltered');
    const sheltered = hud(world.observe(), 'self.warmth') as number;

    world.tick(3.0);
    expect(hud(world.observe(), 'self.warmth')).toBe(sheltered); // 멎었다
  });

  it('원점에서 시작하는 기존 플레이는 땅에 닿지 않는다 — 회귀', () => {
    const world = driveWorld({ npcs: [] });

    world.tick(5.0);

    expect(world.observe().ground.self).toEqual({ state: 'none' });
    expect(hud(world.observe(), 'self.warmth')).toBe(WARMTH_MAX);
  });
});
