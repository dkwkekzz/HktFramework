// 땅 World 단독 테스트 — RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001
//
// C-TERRAIN-001 Implements
//            INTENT-GROUND-IS-DIVIDED-INTO-PLACES-001 ·
//            INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001 ·
//            INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 ·
//            INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 ·
//            INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001 ·
//            INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 ·
//            INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 ·
//            INTENT-STANDING-IS-THE-WHOLE-INPUT-001 ·
//            INTENT-GROUND-LAW-IS-OBSERVED-001 · INTENT-GROUND-PLACES-ARE-OBSERVED-001
// C-TERRAIN-002 Implements
//            INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001 ·
//            INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001 ·
//            INTENT-THE-RECORD-IS-IN-THE-LAND-NOT-THE-BODY-001 ·
//            INTENT-A-FULL-PLACE-VENTS-001 · INTENT-VENTING-STOPS-THE-LAW-THERE-001 ·
//            INTENT-VENTING-SPENDS-WHAT-WAS-KEPT-001 ·
//            INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 ·
//            INTENT-THE-EXCEPTION-IS-NOT-PLACED-001 ·
//            INTENT-WHERE-YOU-STOOD-DECIDES-WHERE-OPENS-001 ·
//            INTENT-WHAT-A-PLACE-HOLDS-IS-OBSERVED-001
//
// 기대값은 공식을 다시 계산하지 않고 숫자로 박는다 — 구현을 구현으로 검사하지 않기 위해서다.
// 기준: heat-binding rate 4.0 · lifeRate 2.0 · saturation 60 · ventRate 6.0 ·
//       escapeRate 1.5 · WARMTH_MAX 100
//
// 규칙 검사는 **자체 자리**로 돈다 — 초기 배치가 바뀌어도 규칙의 뜻은 그대로여야 한다.
// 초기 배치를 검사하는 것은 아래 "세계에 놓인 것" 절뿐이다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { spawnActor } from '../semantic/spawn';
import type { ActorState } from '../semantic/actor';
import { WARMTH_MAX, type WorldState } from '../semantic/world-state';
import { GROUND_LAWS, type GroundZone } from '../semantic/terrain';
import { ruleGroundLawApply } from '../simulation/ground-law-apply';
import { ruleGroundVent } from '../simulation/ground-vent';
import { driveWorld, PLAYER } from './drive';

const AT = { x: 0, z: 0 }; // 검사용 자리 한가운데
const AWAY = { x: 30, z: 30 }; // 어느 검사용 자리에도 들지 않는 곳

/** 검사용 맥 하나 — 기본은 빈 채로 거두는 중이다 */
function vein(over: Partial<GroundZone> = {}): GroundZone {
  return {
    id: 'vein',
    law: 'heat-binding',
    center: { x: 0, z: 0 },
    radius: 5,
    kept: 0,
    phase: 'binding',
    ...over,
  };
}

function body(position: { x: number; z: number }, id = 'body-1'): ActorState {
  return spawnActor({ id, name: id, characterKind: 'wanderer', control: 'autonomous', position });
}

/** 규칙이 읽는 것은 actors 와 groundZones 뿐이다 — 그 둘만 갖춘 세계로 검사한다 */
function stateOf(actors: ActorState[], zones: GroundZone[]): WorldState {
  return { actors, groundZones: zones } as unknown as WorldState;
}

const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;

// ══ C-TERRAIN-001 회귀 — 그 Cycle 이 세운 것이 그대로 참인가 ═══════════

describe('REGRESSION INTENT-GROUND-IS-DIVIDED-INTO-PLACES-001 — 무대가 자리로 나뉜다', () => {
  it('자리 밖에서는 아무 일도 일어나지 않는다', () => {
    const actor = body(AWAY);
    const applied = ruleGroundLawApply(stateOf([actor], [vein()]), 1.0);

    expect(applied).toBe(0);
    expect(actor.warmth).toBe(WARMTH_MAX);
    expect(actor.hp).toBe(actor.hpMax);
  });
});

describe('REGRESSION INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 — 머무는 동안 거둔다', () => {
  it('자리 안에 있으면 지닌 열이 준다 — 1초에 4', () => {
    const actor = body(AT);
    ruleGroundLawApply(stateOf([actor], [vein()]), 1.0);
    expect(actor.warmth).toBe(96);
  });

  it('머문 시간에 비례한다 — 스쳐 지나가는 것과 버티는 것이 다르다', () => {
    const brief = body(AT, 'brief');
    const long = body(AT, 'long');

    ruleGroundLawApply(stateOf([brief], [vein()]), 0.25);
    ruleGroundLawApply(stateOf([long], [vein()]), 5.0);

    expect(brief.warmth).toBe(99);
    expect(long.warmth).toBe(80);
  });

  it('줄어드는 동안 몸은 상하지 않는다 (BT §5.2)', () => {
    const actor = body(AT);
    ruleGroundLawApply(stateOf([actor], [vein()]), 10.0);

    expect(actor.warmth).toBe(60);
    expect(actor.hp).toBe(actor.hpMax);
  });
});

describe('REGRESSION INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 — 누구인지 묻지 않는다', () => {
  it('자율 존재도 관찰자의 몸과 똑같이 겪는다', () => {
    const autonomous = spawnActor({
      id: 'npc-x', name: 'npc-x', characterKind: 'wanderer', control: 'autonomous', position: AT,
    });
    const controlled = spawnActor({
      id: 'player-x', name: 'player-x', characterKind: 'wanderer', control: 'player', position: AT,
    });

    ruleGroundLawApply(stateOf([autonomous, controlled], [vein()]), 2.0);

    expect(autonomous.warmth).toBe(92);
    expect(controlled.warmth).toBe(92);
  });
});

describe('REGRESSION INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001', () => {
  it('열이 다할 때까지는 생명이 줄지 않는다', () => {
    const actor = body(AT);
    ruleGroundLawApply(stateOf([actor], [vein()]), 25.0);

    expect(actor.warmth).toBe(0);
    expect(actor.hp).toBe(actor.hpMax);
  });

  it('열이 0 이 된 뒤에야 생명이 준다 — 1초에 2', () => {
    const actor = body(AT);
    actor.warmth = 0;
    ruleGroundLawApply(stateOf([actor], [vein()]), 3.0);

    expect(actor.hp).toBe(actor.hpMax - 6);
  });

  it('생명이 다하면 이미 있는 끝에 이른다 — 새 형태의 끝을 만들지 않는다', () => {
    const actor = body(AT);
    actor.warmth = 0;
    actor.hp = 3;
    ruleGroundLawApply(stateOf([actor], [vein()]), 5.0);

    expect(actor.hp).toBe(0);
    expect(actor.currentAction.kind).toBe('downed');
  });

  it('쓰러진 몸에서는 더 거두지 않는다', () => {
    const actor = body(AT);
    actor.warmth = 0;
    actor.hp = 1;
    ruleGroundLawApply(stateOf([actor], [vein()]), 5.0);
    expect(actor.currentAction.kind).toBe('downed');

    const applied = ruleGroundLawApply(stateOf([actor], [vein()]), 5.0);
    expect(applied).toBe(0);
    expect(actor.hp).toBe(0);
  });
});

// ══ C-TERRAIN-002 — 보존 ═══════════════════════════════════════════════

describe('INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001 — 거둔 것이 그 자리에 쌓인다', () => {
  it('몸에서 뺀 만큼이 자리에 는다 — 총량이 보존된다', () => {
    const actor = body(AT);
    const zone = vein();

    ruleGroundLawApply(stateOf([actor], [zone]), 3.0);

    expect(actor.warmth).toBe(88); // 100 − 12
    expect(zone.kept).toBe(12); // 사라지지 않았다
    expect(actor.warmth + zone.kept).toBe(WARMTH_MAX); // 세계의 열은 줄지 않았다
  });

  it('쌓이는 곳은 땅이지 몸이 아니다 — 몸에는 아무것도 적히지 않는다', () => {
    // DC-CONDITION-OPENS-WITHOUT-RECORDING 은 몸에 대해 그대로 참이다.
    const actor = body(AT);
    const zone = vein();
    ruleGroundLawApply(stateOf([actor], [zone]), 3.0);

    // 몸에는 이 Cycle 이 한 항목도 더하지 않았다 — 어디 있었는지도, 얼마나 겪었는지도,
    // 어느 자리를 채우는 중인지도 없다. (`guardedGround` 는 C018 이 존재에게 준 자리이지
    // 땅의 것이 아니다 — 그 둘을 헷갈리지 않는 것이 terrain.ts 머리의 규율이다.)
    expect(actor).not.toHaveProperty('groundZoneId');
    expect(actor).not.toHaveProperty('groundLaw');
    expect(actor).not.toHaveProperty('keptElsewhere');
    expect(Object.keys(actor).filter((k) => k.toLowerCase().includes('vein'))).toEqual([]);
  });

  it('넘침 지점을 넘겨 쌓이지 않는다 — 넘친 것은 그릇 밖으로 간다', () => {
    const actor = body(AT);
    const zone = vein({ kept: 59 });

    ruleGroundLawApply(stateOf([actor], [zone]), 5.0); // 20 을 거둔다

    expect(zone.kept).toBe(60); // saturation 에서 멎는다
    expect(actor.warmth).toBe(80); // 몸에서는 20 이 빠졌다 — 잘린 19 는 흩어진 것이다
  });

  it('생명에서 거둔 몫은 쌓이지 않는다 — 법칙이 거두는 것은 열이다', () => {
    const actor = body(AT);
    actor.warmth = 0;
    const zone = vein({ kept: 10 });

    ruleGroundLawApply(stateOf([actor], [zone]), 3.0);

    expect(actor.hp).toBe(actor.hpMax - 6);
    expect(zone.kept).toBe(10); // 한 점도 늘지 않았다
  });
});

describe('INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001 — 한 자리로만 간다', () => {
  it('겹친 자리가 둘이어도 한 번만 거두고 한 자리만 받는다', () => {
    const near = vein({ id: 'near', center: { x: 1, z: 0 } });
    const far = vein({ id: 'far', center: { x: -4, z: 0 } });
    const actor = body(AT); // near 까지 1.0 · far 까지 4.0 — 둘 다 반경 5 안

    ruleGroundLawApply(stateOf([actor], [near, far]), 2.0);

    expect(actor.warmth).toBe(92); // 8 만 빠졌다 — 두 번 거두지 않는다
    expect(near.kept).toBe(8); // 중심이 가까운 쪽이 받는다
    expect(far.kept).toBe(0); // 나누어 넣지 않는다 — 없던 열을 만들지 않는다
  });

  it('중심에 가까이 머물수록 그 맥이 빨리 찬다', () => {
    const a = vein({ id: 'a', center: { x: 0, z: 0 } });
    const b = vein({ id: 'b', center: { x: 4, z: 0 } });
    const actor = body({ x: 3, z: 0 }); // b 에 더 가깝다

    ruleGroundLawApply(stateOf([actor], [a, b]), 2.0);

    expect(b.kept).toBe(8);
    expect(a.kept).toBe(0);
  });
});

// ══ C-TERRAIN-002 — 넘침과 뿜음 ════════════════════════════════════════

describe('INTENT-A-FULL-PLACE-VENTS-001 — 넘치면 뿜는다', () => {
  it('쌓인 것이 넘침 지점에 이르면 그 자리가 뿜기 시작한다', () => {
    const zone = vein({ kept: GROUND_LAWS['heat-binding'].saturation });

    ruleGroundVent(stateOf([], [zone]), 0.1);

    expect(zone.phase).toBe('venting');
  });

  it('넘치지 않았으면 그대로 거둔다', () => {
    const zone = vein({ kept: 59.9 });

    ruleGroundVent(stateOf([], [zone]), 0.1);

    expect(zone.phase).toBe('binding');
  });

  it('머물면 열린다 — 거둠과 넘침 사이에 한 Tick 의 틈이 없다', () => {
    // 거두는 규칙이 kept 를 확정한 **같은 Tick** 에 넘침을 묻는다 (index.ts 의 순서).
    const actor = body(AT);
    const zone = vein({ kept: 58 });
    const state = stateOf([actor], [zone]);

    ruleGroundLawApply(state, 1.0); // 4 를 거둔다 → 60 (잘려서 60)
    ruleGroundVent(state, 1.0);

    expect(zone.phase).toBe('venting');
  });
});

describe('INTENT-VENTING-STOPS-THE-LAW-THERE-001 — 뿜는 동안 그 자리에서 멎는다', () => {
  it('뿜는 자리 안의 몸에서는 거두지 않는다', () => {
    const actor = body(AT);
    const zone = vein({ kept: 60, phase: 'venting' });

    const applied = ruleGroundLawApply(stateOf([actor], [zone]), 5.0);

    expect(applied).toBe(0);
    expect(actor.warmth).toBe(WARMTH_MAX);
  });

  it('멎는 것은 그 자리 안에서뿐이다 — 밖은 여전히 거둔다', () => {
    const venting = vein({ id: 'venting', center: { x: 0, z: 0 }, radius: 3, kept: 60, phase: 'venting' });
    const binding = vein({ id: 'binding', center: { x: 0, z: 0 }, radius: 8 });
    const inside = body({ x: 0, z: 0 }, 'inside'); // 둘 다 안
    const outside = body({ x: 0, z: 6 }, 'outside'); // binding 만 안

    ruleGroundLawApply(stateOf([inside, outside], [venting, binding]), 1.0);

    expect(inside.warmth).toBe(WARMTH_MAX); // 멎었다
    expect(outside.warmth).toBe(96); // 멎지 않았다
  });

  it('다른 법칙의 뿜는 자리는 이 법칙을 멎게 하지 못한다', () => {
    const other = {
      ...vein({ id: 'other', kept: 60, phase: 'venting' }),
      law: 'other-law',
    } as unknown as GroundZone;
    const mine = vein({ id: 'mine' });
    const actor = body(AT);

    ruleGroundLawApply(stateOf([actor], [mine, other]), 1.0);

    expect(actor.warmth).toBe(96); // 멎지 않았다
  });

  it('영구히 안전한 자리를 적을 방법이 없다 — 형에 그 자리가 없다', () => {
    // C-TERRAIN-001 은 예외가 자기가 멎게 하는 법칙의 이름을 지니게 해서
    // "모든 것을 막는 안전지대" 를 적을 수 없게 했다. 이 Cycle 은 한 걸음 더 간다.
    const zone = vein({ kept: 60, phase: 'venting' });
    expect(Object.keys(zone)).not.toContain('role');
    // 뿜는 자리는 반드시 지닌 것을 쓰므로, 쓰지 않는 예외를 적을 수 없다
    ruleGroundVent(stateOf([], [zone]), 1.0);
    expect(zone.kept).toBeLessThan(60);
  });
});

describe('INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 — 몸이 받는다', () => {
  it('뿜는 자리 안의 몸이 열을 되찾고, 받은 만큼 자리가 빈다', () => {
    const actor = body(AT);
    actor.warmth = 40;
    const zone = vein({ kept: 60, phase: 'venting' });

    ruleGroundVent(stateOf([actor], [zone]), 2.0);

    expect(actor.warmth).toBe(52); // 6.0 × 2
    expect(zone.kept).toBe(48); // 나간 만큼 준다
    expect(actor.warmth + zone.kept).toBe(100); // 보존
  });

  it('몸이 지닐 수 있는 만큼까지만 받는다', () => {
    const actor = body(AT);
    actor.warmth = 97;
    const zone = vein({ kept: 60, phase: 'venting' });

    ruleGroundVent(stateOf([actor], [zone]), 2.0); // 12 를 줄 수 있지만

    expect(actor.warmth).toBe(WARMTH_MAX);
    expect(zone.kept).toBe(57); // 3 만 나갔다
  });

  it('가득한 몸은 분출구를 소모하지 않는다', () => {
    const actor = body(AT); // warmth = WARMTH_MAX
    const zone = vein({ kept: 60, phase: 'venting' });

    ruleGroundVent(stateOf([actor], [zone]), 1.0);

    expect(actor.warmth).toBe(WARMTH_MAX);
    // 받은 몸이 없으므로 흩어지기만 한다 (escapeRate 1.5)
    expect(zone.kept).toBeCloseTo(58.5, 6);
  });

  it('받는 몸이 없으면 흩어진다 — 아무도 없는 분출구도 언젠가는 빈다', () => {
    const zone = vein({ kept: 60, phase: 'venting' });

    ruleGroundVent(stateOf([], [zone]), 10.0);

    expect(zone.kept).toBe(45); // 1.5 × 10
    expect(zone.phase).toBe('venting'); // 아직 남았다
  });

  it('쓰러진 몸은 받지 않는다', () => {
    const actor = body(AT);
    actor.warmth = 0;
    actor.hp = 0;
    actor.currentAction = { kind: 'downed' } as ActorState['currentAction'];
    const zone = vein({ kept: 60, phase: 'venting' });

    ruleGroundVent(stateOf([actor], [zone]), 1.0);

    expect(actor.warmth).toBe(0);
  });
});

describe('INTENT-VENTING-SPENDS-WHAT-WAS-KEPT-001 — 다 쓰면 닫히고 도로 거둔다', () => {
  it('다 쓰면 닫힌다 — 그리고 그것이 반복의 한 바퀴다', () => {
    const zone = vein({ kept: 3, phase: 'venting' });

    ruleGroundVent(stateOf([], [zone]), 10.0);

    expect(zone.kept).toBe(0);
    expect(zone.phase).toBe('binding');
  });

  it('닫힌 자리는 도로 거둔다 — 차고 넘치고 비고 다시 찬다', () => {
    const actor = body(AT);
    const zone = vein({ kept: 1, phase: 'venting' });
    const state = stateOf([actor], [zone]);

    // ① 비운다 → 닫힌다
    ruleGroundVent(state, 5.0);
    expect(zone.phase).toBe('binding');

    // ② 도로 거둔다
    const before = actor.warmth;
    ruleGroundLawApply(state, 1.0);
    expect(actor.warmth).toBeLessThan(before);
    expect(zone.kept).toBeGreaterThan(0);
  });

  it('한 자리에 계속 서 있으면 준 것을 도로 받는다 — 보존의 결과다', () => {
    // 05-review.md REVIEW QUESTION 3 — 버그가 아니라 보존이다.
    // 대가는 그 몸이 그 자리에 묶이는 것이며 세계가 따로 벌을 주지 않는다.
    const actor = body(AT);
    const zone = vein();
    const state = stateOf([actor], [zone]);

    let lowest = WARMTH_MAX;
    for (let i = 0; i < 600; i++) {
      ruleGroundLawApply(state, 0.1);
      ruleGroundVent(state, 0.1);
      lowest = Math.min(lowest, actor.warmth);
    }

    expect(lowest).toBeLessThan(WARMTH_MAX); // 값을 치렀다
    expect(actor.hp).toBe(actor.hpMax); // 그러나 죽지 않는다
  });
});

// ══ 태어난 세계 — C-TERRAIN-003 부터 초기 배치는 씨앗의 함수다 ═══════════
//
// 좌표·id 를 숫자로 박지 않고 태어난 세계에서 **읽어** 자리를 정한다 — 박으면 기본
// 씨앗이 바뀔 때 검사가 세계 대신 숫자를 지키게 된다. 태어남 자체의 규칙(결정론 ·
// 조용한 자리 · 군집 · 해숨구멍)은 world-genesis.spec.ts 가 검사한다.

type ZoneView = GameViewSnapshot['ground']['zones'][number];

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

const bornZones = (v: GameViewSnapshot) => v.ground.zones;
const ventingOf = (zones: ZoneView[]) => zones.find((z) => z.phase === 'venting')!;

/**
 * 거두는 자리 안이면서 뿜는 자리 밖인 점 — "taking" 을 겪는 자리.
 * 뿜는 맥에서 가장 먼 거두는 맥의 중심에서, 뿜는 맥 반대쪽으로 2.0 물러난다:
 * 그 맥 안(반경 5)이면서 뿜는 맥 밖(거리 ≥ 7 > 5)이다.
 */
function takingSpot(zones: ZoneView[]): { x: number; z: number } {
  const venting = ventingOf(zones);
  const binding = zones
    .filter((z) => z.phase === 'binding')
    .sort((a, b) => dist(b.center, venting.center) - dist(a.center, venting.center))[0]!;
  const away = {
    x: binding.center.x - venting.center.x,
    z: binding.center.z - venting.center.z,
  };
  const len = Math.hypot(away.x, away.z);
  return {
    x: binding.center.x + (away.x / len) * 2.0,
    z: binding.center.z + (away.z / len) * 2.0,
  };
}

/** takingSpot 이 물러난 그 거두는 맥 — 거기 서면 이 맥이 받는다 (중심이 가장 가깝다) */
function takingZoneId(zones: ZoneView[]): string {
  const venting = ventingOf(zones);
  return zones
    .filter((z) => z.phase === 'binding')
    .sort((a, b) => dist(b.center, venting.center) - dist(a.center, venting.center))[0]!.id;
}

describe('세계에 놓인 것 — 태어난 맥들 (RULE-WORLD-GENESIS-001)', () => {
  it('맥 넷이 태어나고 하나가 이미 뿜는 중이다 — 오늘의 해숨구멍', () => {
    const zones = bornZones(driveWorld({ npcs: [] }).observe());

    expect(zones).toHaveLength(4);
    const venting = zones.filter((z) => z.phase === 'venting');
    expect(venting).toHaveLength(1);
    expect(venting[0]!.fill).toBe(1); // 포화가 해숨구멍의 원인이다 (BT §5.3)
  });

  it('예외를 놓을 형이 없다 — 자리의 항목은 여섯뿐이고 role 이 없다', () => {
    for (const zone of bornZones(driveWorld({ npcs: [] }).observe())) {
      expect(Object.keys(zone).sort()).toEqual(['center', 'fill', 'id', 'law', 'phase', 'radius']);
    }
  });

  it('찬 정도는 전부 계산된 과거다 — 0..1 사이이고 가장 찬 것이 뿜는다', () => {
    // 손배치 시절의 "전부 kept > 0" 은 표본에서 보장되지 않는다 — 보장되는 것은
    // 범위와 "가장 찬 맥이 뿜으며 태어난다" 다 (03 Transition ③).
    const zones = bornZones(driveWorld({ npcs: [] }).observe());
    for (const zone of zones) {
      expect(zone.fill).toBeGreaterThanOrEqual(0);
      expect(zone.fill).toBeLessThanOrEqual(1);
    }
    const fills = zones.map((z) => z.fill);
    expect(ventingOf(zones).fill).toBe(Math.max(...fills));
  });

  it('맥은 시작 자리·광맥·순회 경로 어디와도 닿지 않는다 — QUIET_GROUND', () => {
    // INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001 — 씨앗이 무엇이든 규칙이 보장한다.
    // 기본 배치의 조용한 자리들 (index.ts 가 실제 배치에서 계산하는 그 목록의 점들).
    const away = [
      { x: 0, z: 0 }, { x: 3, z: 2 }, { x: -3, z: 2 }, { x: 3, z: -2 }, { x: -3, z: -2 }, // SPAWN
      { x: 8, z: -6 }, // 광맥
      { x: -10, z: -8 }, { x: -13, z: -8 }, { x: -7, z: -8 }, { x: -10, z: -12 }, // npc-1
      { x: 12, z: 8 }, { x: 4, z: 12 }, // npc-2
    ];
    const zones = bornZones(driveWorld({}).observe());
    for (const p of away) {
      for (const zone of zones) expect(dist(zone.center, p)).toBeGreaterThan(zone.radius);
    }
  });
});

// ══ 관찰 ═══════════════════════════════════════════════════════════════

const OUTSIDE = { x: 0, z: 0 }; // 원점 — 시작 자리라 어느 맥에도 들지 않는 것이 보장된다

describe('INTENT-WHAT-A-PLACE-HOLDS-IS-OBSERVED-001 — 자리가 지닌 것이 실린다', () => {
  it('자리마다 지금 어느 단계이고 얼마나 찼는지가 실린다', () => {
    const world = driveWorld({ npcs: [] });
    const zones = world.observe().ground.zones;

    expect(zones).toHaveLength(4);
    for (const zone of zones) {
      expect(zone.law).toBe('heat-binding');
      expect(['binding', 'venting']).toContain(zone.phase);
      expect(zone.radius).toBe(5);
    }
  });

  it('날값도 넘침 지점도 실리지 않는다 — 화면이 넘침을 스스로 판정할 수 없다', () => {
    const world = driveWorld({ npcs: [] });
    const zone = world.observe().ground.zones[0] as unknown as Record<string, unknown>;

    expect(zone.kept).toBeUndefined();
    expect(zone.saturation).toBeUndefined();
    expect(typeof zone.fill).toBe('number'); // 비율만 온다
  });

  it('차오르는 것이 관찰로 보인다 — 넘침이 원인 없는 사건이 되지 않는다', () => {
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const world = driveWorld({ npcs: [], actorPosition: takingSpot(zones0) });
    const id = takingZoneId(zones0);
    const before = world.observe().ground.zones.find((z) => z.id === id)!.fill;

    world.tick(2.0);

    expect(world.observe().ground.zones.find((z) => z.id === id)!.fill).toBeGreaterThan(before);
  });
});

describe('INTENT-GROUND-LAW-IS-OBSERVED-001 — 지금 걸린 법칙이 실린다', () => {
  it('자리 밖 — none', () => {
    const world = driveWorld({ npcs: [], actorPosition: OUTSIDE });
    expect(world.observe().ground.self).toEqual({ state: 'none' });
  });

  it('거두는 맥 안 — taking 과 그 사유가 함께 온다', () => {
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const world = driveWorld({ npcs: [], actorPosition: takingSpot(zones0) });
    expect(world.observe().ground.self).toEqual({
      law: 'heat-binding', state: 'taking', takes: 'warmth',
    });
  });

  it('뿜는 맥 안에서 가득하면 sheltered — none 과 구분된다', () => {
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const world = driveWorld({ npcs: [], actorPosition: ventingOf(zones0).center });
    const self = world.observe().ground.self;

    expect(self).toEqual({ law: 'heat-binding', state: 'sheltered', takes: 'warmth' });
    expect(self.state).not.toBe('none');
  });

  it('뿜는 맥 안에서 받는 중이면 warming — sheltered 와 구분된다', () => {
    // 이것이 갈리지 않으면 플레이어는 자기 열이 왜 늘었는지 알 수 없다.
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const world = driveWorld({ npcs: [], actorPosition: takingSpot(zones0) });
    world.tick(3.0); // 열을 좀 잃는다
    expect(hud(world.observe(), 'self.warmth')).toBeLessThan(WARMTH_MAX);

    world.dispatch({ interactionId: 'move', position: ventingOf(zones0).center });

    // 걸어 들어가면 **받는 중**이 먼저 온다. 다 채우고 나면 sheltered 로 바뀌므로
    // (가득한 몸은 분출구를 소모하지 않는다) 그 사이를 잡는다.
    const seen: string[] = [];
    for (let i = 0; i < 120; i++) {
      world.tick(0.1);
      seen.push(world.observe().ground.self.state);
    }

    expect(seen).toContain('warming');
    // 그리고 실제로 열이 돌아왔다 — 상태 코드만 바뀐 것이 아니다
    expect(hud(world.observe(), 'self.warmth')).toBe(WARMTH_MAX);
    // 다 채운 뒤에는 sheltered 다 — 더 소모하지 않는다는 것이 여기서 읽힌다
    expect(seen[seen.length - 1]).toBe('sheltered');
  });

  it('지닌 열과 그 최대가 함께 실린다', () => {
    const world = driveWorld({ npcs: [], actorPosition: OUTSIDE });
    expect(hud(world.observe(), 'self.warmth')).toBe(WARMTH_MAX);
    expect(hud(world.observe(), 'self.warmthMax')).toBe(WARMTH_MAX);
  });
});

// ══ 플레이 ═════════════════════════════════════════════════════════════

describe('Cycle Goal — 어디에 서 있었는가가 어디가 안전한지를 바꾼다', () => {
  it('머물면 발밑의 땅이 넘쳐 분출구가 되고, 그 사이 열려 있던 자리는 닫힌다', () => {
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const spot = takingSpot(zones0);
    const bornVenting = ventingOf(zones0).id;
    const underfoot = takingZoneId(zones0);
    const world = driveWorld({ npcs: [], actorPosition: spot });

    expect(world.observe().ground.self.state).toBe('taking');

    // 머문다 — 요청은 걷기 하나뿐이고 그마저 하지 않는다. 발밑이 얼마나 차 있었든
    // 몸이 지닌 100 으로 넘침 지점(60)까지 채울 수 있다 (최대 15초).
    let vented = false;
    for (let i = 0; i < 200 && !vented; i++) {
      world.tick(0.1);
      vented = world.observe().ground.zones.find((z) => z.id === underfoot)!.phase === 'venting';
    }

    // 발밑이 열렸다 — 내가 준 열이 그 자리에 쌓여 넘쳤다
    expect(vented).toBe(true);
    expect(world.observe().ground.self.state).toBe('warming');
    expect(hud(world.observe(), 'self.warmth')).toBeLessThan(WARMTH_MAX);

    // 그 사이 태어날 때 열려 있던 자리는 흩어져 닫힌다 — 어제 쉬어 간 자리가
    // 오늘은 닫혀 있다 (아무도 받지 않으면 40초)
    for (let i = 0; i < 450; i++) world.tick(0.1);
    expect(world.observe().ground.zones.find((z) => z.id === bornVenting)!.phase).toBe('binding');
  });

  it('가로지르는 것으로는 열리지 않는다 — 머무는 것과 지나는 것이 갈린다', () => {
    // 덜 찬 맥(fill ≤ 0.6 — 기본 씨앗의 세계에 존재함을 world-genesis.spec 이 지킨다)을
    // 곧장 가로지른다. 지나는 동안 치르는 열(≈7)로는 넘침 지점에 닿지 않는다.
    const zones0 = bornZones(driveWorld({ npcs: [] }).observe());
    const venting = ventingOf(zones0);
    const target = zones0
      .filter((z) => z.phase === 'binding' && z.fill <= 0.6 && dist(z.center, venting.center) >= 7)
      [0]!;
    const away = {
      x: (target.center.x - venting.center.x), z: (target.center.z - venting.center.z),
    };
    const len = Math.hypot(away.x, away.z);
    const u = { x: away.x / len, z: away.z / len };
    const from = { x: target.center.x + u.x * 6.0, z: target.center.z + u.z * 6.0 }; // 맥 밖
    const to = { x: target.center.x - u.x * 6.0, z: target.center.z - u.z * 6.0 }; // 반대편 밖

    const world = driveWorld({ npcs: [], actorPosition: from });
    world.dispatch({ interactionId: 'move', position: to });
    for (let i = 0; i < 40; i++) world.tick(0.1);

    expect(world.observe().ground.zones.find((z) => z.id === target.id)!.phase).toBe('binding');
  });

  it('원점에서 시작하는 기존 플레이는 땅에 닿지 않는다 — 회귀', () => {
    const world = driveWorld({ npcs: [] });

    world.tick(5.0);

    expect(world.observe().ground.self).toEqual({ state: 'none' });
    expect(hud(world.observe(), 'self.warmth')).toBe(WARMTH_MAX);
    expect(player(world.observe())?.state).toBe('idle');
  });
});
