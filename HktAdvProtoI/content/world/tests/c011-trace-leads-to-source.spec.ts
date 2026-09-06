// C011 — 흔적이 원천으로 데려간다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-007 · SPEC-010 + 회귀)
//
// 이 Cycle 에서 **재료가 처음으로 세계의 것이 된다.** 그래서 여기서 재는 것은 인과다:
//   ① 원천이 자기 방의 데이터가 정한 자리에 서는가 (지어낸 자리가 아닌가)
//   ② 원천이 무엇을 내는지 스스로 밝히는가 — 그리고 그 쓰임은 어디에도 없는가
//   ③ 흔적이 방을 건너, 그리고 방 안에서 **단조롭게** 짙어져 방향이 되는가
//   ④ 캔 것이 그 원천의 재료로 손에 들어오는가 (즉시가 아니라 행동을 거쳐서)
//   ⑤ 백왕령에는 이 계통이 한 자락도 닿지 않았는가 — 그러면서 방은 그대로인가
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 구현(원천을 세우는 규칙 · 흔적을 유도하는 코드 · View 의 표)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C011-trace-leads-to-source/spec.md 와 그것이 동결한 관찰 계약뿐이다.
//
// **좌표를 손으로 적지 않는다** — 원천의 자리는 그 방 Description 의 resource point 에서,
// 흔적의 세기는 traceStrengthAt 에서, 방 바닥의 세기는 그 방 격자 전체의 **가장 옅은 값**에서
// 골라 쓴다. 단계 수와 반경(배치 데이터)도 값을 적지 않고 데이터에서 읽는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import { pointsOf, areasOf, type RegionDescription, type XZ } from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import {
  ANCHOR_LAYER,
  BIO_ORE,
  BIO_ORE_FIELD,
  BRIDGE_TAG,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_PREFIX,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  EXPLORER_RUIN,
  FEATURE_LAYER,
  FOREST_DEEP,
  FOREST_EDGE,
  FORM_MOLT_LITTER,
  FORM_OUTCROP,
  FORM_ROOT_NODULE,
  FORM_SPOIL_PILE,
  HEART_LAKE,
  NEST_TRAIL,
  ORE_EATER_MOLT,
  ORE_TRAIL,
  PREDATOR_NEST,
  RED_EYE_TREE,
  REGION_SPECS,
  RESOURCE_LAYER,
  RIVER_TAG,
  RUIN_TRAIL,
  SETTLEMENT_LAYER,
  SOIL_STAIN_MAX,
  TRACE_LAYER,
  TREE_APPROACH,
  WHITE_KING_DOMAIN,
  regionSpec,
  soilStainLevel,
} from '../../regions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL } from '../semantic/world-state';
import { findResourceSource, sourcesInRegion, traceStrengthAt, type ResourceSource } from '../semantic/resource';
import { driveWorld, type WorldDriver } from './drive';

// ── spec 이 동결한 이름들 (State 절의 표 그대로) ─────────────────────
const MOLT_LITTER = 'MOLT_LITTER';
const RUIN_SPOIL = 'RUIN_SPOIL';
const ORE_OUTCROP = 'ORE_OUTCROP';
const ROOT_NODULE = 'ROOT_NODULE';

/** 원천 넷 — 방 · 재료 · 자연 형태. 자리는 데이터에서 읽는다 (여기 적지 않는다) */
const FOUR = [
  { id: MOLT_LITTER, region: FOREST_EDGE, material: ORE_EATER_MOLT, form: FORM_MOLT_LITTER },
  { id: RUIN_SPOIL, region: EXPLORER_RUIN, material: ORE_EATER_MOLT, form: FORM_SPOIL_PILE },
  { id: ORE_OUTCROP, region: BIO_ORE_FIELD, material: BIO_ORE, form: FORM_OUTCROP },
  { id: ROOT_NODULE, region: RED_EYE_TREE, material: BIO_ORE, form: FORM_ROOT_NODULE },
] as const;

/** 이 계통이 닿지 않는 방들 (SPEC-001 · SPEC-003 경계) */
const BARREN = [WHITE_KING_DOMAIN, FOREST_DEEP, PREDATOR_NEST, HEART_LAKE] as const;

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 땅과 데이터를 읽는 자리 ─────────────────────────────────────────
const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

/** 그 방 격자의 자리 전부 — 자리를 손으로 적지 않기 위한 후보 목록 (c010 하네스 그대로) */
function gridSpots(id: string): XZ[] {
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  return out;
}

/**
 * 그 방의 **바닥** 흔적 — 원천에서 가장 먼 자리의 세기다.
 * 짙은 자리는 바닥 위에 겹쳐 얹히므로, 격자 전체에서 가장 옅은 값이 곧 바닥이다.
 * (spec SPEC-003 조건 "원천에서 먼 자리(방 바닥)" 를 좌표 없이 집는 방법)
 */
const floorTrace = (id: string): number =>
  gridSpots(id).reduce((low, at) => Math.min(low, traceAt(id, at)), Infinity);

/** 그 방에서 가장 짙은 자리의 세기 */
const peakTrace = (id: string): number =>
  gridSpots(id).reduce((high, at) => Math.max(high, traceAt(id, at)), 0);

/** anchor 의 자리 — 출구 둘레를 좌표 없이 집는다 */
const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

/** 그 방 Description 의 resource point 자리 — 원천이 서야 할 자리의 원본 (R3) */
const resourcePointAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === tag)!.position;

const sourceOf = (id: string): ResourceSource => {
  const found = findResourceSource(id);
  if (!found) throw new Error(`세계가 원천 '${id}' 를 모른다`);
  return found;
};

/** 그 자리를 덮은 흔적 태그들이 말하는 단계들 (겹침을 눈으로 세는 자리) */
function stainLevelsAt(region: string, at: XZ): number[] {
  const levels: number[] = [];
  for (const area of areasOf(spaceOf(region), TRACE_LAYER)) {
    const level = soilStainLevel(area.tag);
    if (level <= 0) continue;
    if (area.shape.kind === 'circle') {
      if (Math.hypot(at.x - area.shape.center.x, at.z - area.shape.center.z) <= area.shape.radius) {
        levels.push(level);
      }
    } else {
      // polygon — 이 Cycle 의 바닥은 방의 extent 다. 안팎 판정은 격자의 바닥값으로 대신한다
      levels.push(level);
    }
  }
  return levels;
}

// ── 세계를 세우는 자리 ───────────────────────────────────────────────
/** 그 방에 선 몸 하나 — 자리를 밝히지 않으면 그 방의 기본 자리 */
const standingIn = (region: string, at?: XZ, extra: Partial<WorldSetup> = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });

/** 그 원천의 손 닿는 곳 — InteractionRange 안이다 (좌표를 적지 않고 한 걸음 옆으로 선다) */
const besideSpot = (source: ResourceSource): XZ => ({
  x: source.position.x + INTERACTION_RANGE / 2,
  z: source.position.z,
});

const beside = (source: ResourceSource, extra: Partial<WorldSetup> = {}): WorldDriver =>
  standingIn(source.regionId, besideSpot(source), extra);

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

const mine = (w: WorldDriver, targetEntityId: string) =>
  w.dispatch({ interactionId: 'mine', targetEntityId });

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sourcesIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'resource-source');
const sourceEntity = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const mineInteractions = (v: GameViewSnapshot): InteractionView[] =>
  v.interactions.filter((i) => i.id === 'mine');
const mineOn = (v: GameViewSnapshot, targetEntityId: string): InteractionView | undefined =>
  mineInteractions(v).find((i) => i.targetEntityId === targetEntityId);
const bodyOf = (v: GameViewSnapshot): EntityView | undefined =>
  v.entities.find((e) => e.id === v.observer.characterId);

/** 지닌 재료의 자리들 — 0 이면 자리가 없다 (SPEC-010) */
const inventoryIds = (v: GameViewSnapshot): string[] =>
  v.hud.filter((h) => h.id.startsWith('inventory.')).map((h) => h.id);
const held = (v: GameViewSnapshot, material: string): number | boolean | string | undefined =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;

// ─────────────────────────────────────────────────────────────────────

// C012 CHANGED — 흔적의 세기가 원천의 phase 를 함께 본다 (고갈되면 그 둘레가 한 단계 옅어진다).
// 이 Cycle 이 재는 것은 **아무것도 캐지 않은 세계**의 사다리이므로 빈 State 로 묻는다 —
// State 가 없는 원천은 available 로 친다 (없는 것을 고갈로 읽지 않는다).
const UNTOUCHED = {};
const traceAt = (regionId: string, at: { x: number; z: number }) =>
  traceStrengthAt(UNTOUCHED, regionId, at);

describe('SPEC-001 네 원천이 자기 방에 선다', () => {
  it('S-011 네 방마다 원천이 정확히 하나 서고, 그 자리는 그 방 Description 의 resource point 자리다', () => {
    for (const one of FOUR) {
      // Given 관찰자가 그 방에 선다
      const world = standingIn(one.region);
      // When 그 방을 본다
      const found = sourcesIn(world.observe());
      // Then 그 방의 원천은 그것 하나다
      expect({ region: one.region, ids: found.map((e) => e.id) }).toEqual({
        region: one.region,
        ids: [one.id],
      });
      // And 자리는 데이터가 정한 그 자리다 — 지어낸 자리가 아니다 (R3)
      const point = resourcePointAt(one.region, one.id);
      expect({ region: one.region, x: found[0]!.position.x, z: found[0]!.position.z }).toEqual({
        region: one.region,
        x: point.x,
        z: point.z,
      });
    }
  });

  it('S-012 (경계) 백왕령 · 숲 깊은 곳 · 포식자 둥지 · 심장 호수에는 하나도 없다', () => {
    for (const region of BARREN) {
      const world = standingIn(region);
      expect({ region, ids: sourcesIn(world.observe()).map((e) => e.id) }).toEqual({
        region,
        ids: [],
      });
    }
  });
});

describe('SPEC-002 원천은 자기가 무엇을 내는지 밝힌다', () => {
  it('S-021 원천의 material 이 Material Seed 코드이고 kind 가 자연 형태 코드다', () => {
    for (const one of FOUR) {
      // Given 그 방에 선 관찰자 / When 원천을 관찰한다
      const entity = sourceEntity(standingIn(one.region).observe(), one.id);
      // Then 무엇인가(material)와 무엇처럼 생겼는가(kind)가 따로 실린다
      expect({
        id: one.id,
        material: entity?.material,
        kind: entity?.kind,
        state: entity?.state,
      }).toEqual({ id: one.id, material: one.material, kind: one.form, state: 'available' });
    }
  });

  it('S-022 같은 Seed 가 두 자리에서 서로 다른 형태로 난다 — 종류를 늘린 것이 아니다', () => {
    const world = standingIn(FOREST_EDGE);
    const litter = sourceEntity(world.observe(), MOLT_LITTER);
    const spoil = sourceEntity(standingIn(EXPLORER_RUIN).observe(), RUIN_SPOIL);
    expect(litter?.material).toBe(spoil?.material);
    expect(litter?.kind).not.toBe(spoil?.kind);
  });

  it('S-023 (경계) 쓰임도 남은 양도 관찰 결과에 없다 — 실리는 자리가 계약의 여섯뿐이다', () => {
    // 판정 방식 — spec 은 "쓰임이 없다" 를 코드로 말하지 않았다. 그래서 Observable 이
    // 싣는다고 적은 자리(id · role · kind · material · state · position)만 실렸는가로 잰다:
    // 남은 양(labelValue)도 그 밖의 무엇도 이 존재에는 붙지 않는다.
    const allowed = ['id', 'role', 'kind', 'material', 'state', 'position'];
    for (const one of FOUR) {
      const entity = sourceEntity(standingIn(one.region).observe(), one.id)!;
      const extra = Object.keys(entity).filter((key) => !allowed.includes(key));
      expect({ id: one.id, extra }).toEqual({ id: one.id, extra: [] });
      expect(entity.labelValue).toBeUndefined();
    }
  });
});

describe('SPEC-003 흔적이 방을 건너 짙어진다', () => {
  it('S-031 방 바닥의 세기가 경계부 → 중간부 → 핵심부로 단조롭게 짙어진다', () => {
    const edge = floorTrace(FOREST_EDGE);
    const ruin = floorTrace(EXPLORER_RUIN);
    const deep = floorTrace(FOREST_DEEP);
    const ore = floorTrace(BIO_ORE_FIELD);
    const tree = floorTrace(RED_EYE_TREE);
    // 순서 — Design 이 준 것 (경계부 옅음 → 핵심부 짙음)
    expect(edge).toBe(ruin);
    expect(edge).toBeLessThan(deep);
    expect(deep).toBeLessThan(ore);
    expect(ore).toBe(tree);
    // 지금 놓인 배치 데이터의 값 (1 · 2 · 3)
    expect({ edge, ruin, deep, ore, tree }).toEqual({ edge: 1, ruin: 1, deep: 2, ore: 3, tree: 3 });
  });

  it('S-032 (경계) 백왕령은 어느 자리에서도 0 이다', () => {
    for (const at of gridSpots(WHITE_KING_DOMAIN)) {
      const strength = traceAt(WHITE_KING_DOMAIN, at);
      if (strength !== 0) {
        throw new Error(`백왕령 (${at.x}, ${at.z}) 에 흔적이 있다 — ${strength}`);
      }
    }
    expect(peakTrace(WHITE_KING_DOMAIN)).toBe(0);
  });
});

describe('SPEC-004 흔적이 방 안에서도 방향을 준다', () => {
  it('S-041 ① 숲 깊은 곳 — 광석 지대 쪽과 거목 쪽 출구 둘레가 둥지 쪽보다 짙다', () => {
    const ore = traceAt(FOREST_DEEP, anchorAt(FOREST_DEEP, ORE_TRAIL));
    const tree = traceAt(FOREST_DEEP, anchorAt(FOREST_DEEP, TREE_APPROACH));
    const nest = traceAt(FOREST_DEEP, anchorAt(FOREST_DEEP, NEST_TRAIL));
    expect(ore).toBeGreaterThan(nest);
    expect(tree).toBeGreaterThan(nest);
    // And 둥지 쪽은 짙어지지 않는다 — 그 방 바닥 그대로다
    expect(nest).toBe(floorTrace(FOREST_DEEP));
  });

  it('S-042 ② 원천 넷은 저마다 자기 방 바닥보다 짙은 자리 위에 서 있다', () => {
    for (const one of FOUR) {
      const source = sourceOf(one.id);
      const here = traceAt(one.region, source.position);
      expect({ id: one.id, deeper: here > floorTrace(one.region) }).toEqual({
        id: one.id,
        deeper: true,
      });
    }
  });

  it('S-043 ③ 뿌리혹의 자리가 이 세계에서 가장 짙다', () => {
    const nodule = traceAt(RED_EYE_TREE, sourceOf(ROOT_NODULE).position);
    for (const spec of REGION_SPECS) {
      const peak = peakTrace(spec.id);
      if (spec.id === RED_EYE_TREE) {
        expect({ region: spec.id, peak, nodule }).toEqual({ region: spec.id, peak: nodule, nodule });
      } else {
        expect({ region: spec.id, below: peak < nodule }).toEqual({ region: spec.id, below: true });
      }
    }
  });

  it('S-044 (경계) 겹친 흔적은 가장 짙은 것이 이긴다 — 합하지 않는다', () => {
    for (const one of FOUR) {
      const source = sourceOf(one.id);
      const levels = stainLevelsAt(one.region, source.position);
      // Given 그 자리는 바닥과 원천 둘레가 겹친 자리다 (겹친 것이 둘 이상)
      expect({ id: one.id, overlapped: levels.length > 1 }).toEqual({ id: one.id, overlapped: true });
      const strongest = Math.max(...levels);
      const summed = levels.reduce((sum, level) => sum + level, 0);
      // Then 그 자리의 세기는 가장 큰 것이지 합이 아니다
      expect({ id: one.id, at: traceAt(one.region, source.position) }).toEqual({
        id: one.id,
        at: strongest,
      });
      expect(strongest).toBeLessThan(summed);
    }
    // And 어느 자리도 단계의 상한을 넘지 않는다 (합했다면 넘는다)
    for (const spec of REGION_SPECS) {
      expect({ region: spec.id, peak: peakTrace(spec.id) <= SOIL_STAIN_MAX }).toEqual({
        region: spec.id,
        peak: true,
      });
    }
  });
});

describe('SPEC-005 캐면 그 원천의 재료가 손에 들어온다', () => {
  it('S-051 곡괭이를 지닌 몸이 노두 곁에서 캐면 생체 광석이 하나 는다', () => {
    // Given 곡괭이를 지닌 몸이 노두의 손 닿는 곳에 선다
    const source = sourceOf(ORE_OUTCROP);
    const world = beside(source, { actorItems: { pickaxe: 1 } });
    expect(held(world.observe(), BIO_ORE)).toBeUndefined();
    // When 캐고 행동이 끝난다
    expect(mine(world, ORE_OUTCROP)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    tickFor(world, MINE_SECONDS);
    // Then 그 원천의 재료가 하나 늘었다
    const view = world.observe();
    expect(held(view, BIO_ORE)).toBe(1);
    // And 다른 재료는 늘지 않았다
    expect(held(view, ORE_EATER_MOLT)).toBeUndefined();
  });

  it('S-052 원천 넷이 저마다 자기 재료를 낸다 — 다른 재료는 늘지 않는다', () => {
    for (const one of FOUR) {
      const source = sourceOf(one.id);
      const world = beside(source, { actorItems: { pickaxe: 1 } });
      expect(mine(world, one.id).status).toBe('success');
      tickFor(world, MINE_SECONDS);
      const view = world.observe();
      const other = one.material === BIO_ORE ? ORE_EATER_MOLT : BIO_ORE;
      expect({ id: one.id, mine: held(view, one.material), other: held(view, other) }).toEqual({
        id: one.id,
        mine: 1,
        other: undefined,
      });
    }
  });

  it('S-053 (경계) 행동이 끝나기 전에는 아무것도 늘지 않는다 — 즉시 획득이 아니다', () => {
    const source = sourceOf(ORE_OUTCROP);
    const world = beside(source, { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP).status).toBe('success');
    // 절반쯤 지난 자리 — 아직 손에 든 것이 없다
    tickFor(world, MINE_SECONDS / 2 - TICK_INTERVAL);
    const midway = world.observe();
    expect(inventoryIds(midway)).toEqual([]);
    expect(bodyOf(midway)?.state).toBe('mine');
    // 다 채우면 그때 들어온다
    tickFor(world, MINE_SECONDS);
    expect(held(world.observe(), BIO_ORE)).toBe(1);
  });
});

describe('SPEC-006 채취의 거절', () => {
  const source = () => sourceOf(ORE_OUTCROP);

  it('S-061 곡괭이가 없으면 no-mining-tool 이고 소지품이 늘지 않는다', () => {
    const world = beside(source(), { actorItems: {} });
    expect(mine(world, ORE_OUTCROP)).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'no-mining-tool',
    });
    tickFor(world, MINE_SECONDS);
    expect(inventoryIds(world.observe())).toEqual([]);
    expect(mineOn(world.observe(), ORE_OUTCROP)?.reason).toBe('no-mining-tool');
  });

  it('S-062 거리 밖이면 out-of-range 이고 소지품이 늘지 않는다', () => {
    // 같은 방 안에서 가장 먼 자리 — 좌표를 적지 않고 격자에서 고른다
    const at = gridSpots(BIO_ORE_FIELD).reduce((far, spot) =>
      Math.hypot(spot.x - source().position.x, spot.z - source().position.z) >
      Math.hypot(far.x - source().position.x, far.z - source().position.z)
        ? spot
        : far,
    );
    const world = standingIn(BIO_ORE_FIELD, at, { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP)).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'out-of-range',
    });
    tickFor(world, MINE_SECONDS);
    expect(inventoryIds(world.observe())).toEqual([]);
  });

  it('S-063 이미 다른 행동 중이면 action-busy 이고 한 번만 얻는다', () => {
    const world = beside(source(), { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP).status).toBe('success');
    // 아직 캐는 중이다 (시간이 흐르지 않았다)
    expect(mine(world, ORE_OUTCROP)).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'action-busy',
    });
    tickFor(world, MINE_SECONDS);
    expect(held(world.observe(), BIO_ORE)).toBe(1);
  });

  it('S-064 모르는 대상이면 unknown-source 이고 소지품이 늘지 않는다', () => {
    const world = beside(source(), { actorItems: { pickaxe: 1 } });
    expect(mine(world, 'c011-test:no-such-source')).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'unknown-source',
    });
    tickFor(world, MINE_SECONDS);
    expect(inventoryIds(world.observe())).toEqual([]);
  });

  it('S-065 (경계) 다른 방의 원천을 걸면 out-of-range 다 — 자리가 방마다 따로다', () => {
    // Given 몸은 숲 가장자리의 허물 곁에 서 있다
    const world = beside(sourceOf(MOLT_LITTER), { actorItems: { pickaxe: 1 } });
    // When 다른 방의 노두를 건다 (세계는 그 원천을 알지만 여기 있지 않다)
    expect(mine(world, ORE_OUTCROP)).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'out-of-range',
    });
    tickFor(world, MINE_SECONDS);
    expect(inventoryIds(world.observe())).toEqual([]);
  });
});

describe('SPEC-007 백왕령에는 이 계통이 없다', () => {
  it('S-071 캘 수 있는 존재도 mine interaction 도 하나도 없다', () => {
    const world = standingIn(WHITE_KING_DOMAIN, undefined, { actorItems: { pickaxe: 1 } });
    const view = world.observe();
    expect(sourcesIn(view)).toEqual([]);
    expect(mineInteractions(view)).toEqual([]);
    // And 세계가 백왕령에서 낳는 원천도 없다 (관찰이 가린 것이 아니다)
    expect(sourcesInRegion(WHITE_KING_DOMAIN)).toEqual([]);
  });
});

describe('SPEC-010 가지지 않은 재료의 자리는 없다', () => {
  it('S-0101 아무것도 캐지 않은 관찰자의 HUD 에는 재료 자리가 하나도 없다', () => {
    const world = standingIn(BIO_ORE_FIELD, undefined, { actorItems: { pickaxe: 1 } });
    expect(inventoryIds(world.observe())).toEqual([]);
  });

  it('S-0102 하나 캐면 그 재료의 자리 하나가 생긴다', () => {
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mine(world, ORE_OUTCROP);
    tickFor(world, MINE_SECONDS);
    expect(inventoryIds(world.observe())).toEqual([`inventory.${BIO_ORE}`]);
  });

  it('S-0103 (경계) 가지지 않은 재료는 0 으로 지어내지 않는다', () => {
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mine(world, ORE_OUTCROP);
    tickFor(world, MINE_SECONDS);
    const view = world.observe();
    // 하나 캤어도 다른 재료의 자리는 서지 않는다 — 세지 않은 것과 없는 것을 가르지 않는다
    expect(held(view, ORE_EATER_MOLT)).toBeUndefined();
    expect(view.hud.some((h) => h.id === `inventory.${ORE_EATER_MOLT}`)).toBe(false);
  });
});

describe('회귀', () => {
  it('R-001 (SPEC-007 경계) 백왕령의 능선 · 강 · 다리 · 도시 · 조건 셋이 한 값도 바뀌지 않았다', () => {
    const space = spaceOf(WHITE_KING_DOMAIN);
    // 강 하나와 다리 하나 — 건너는 자리는 여전히 하나다
    const rivers = space.ops.filter((op) => op.kind === 'curve' && op.layer === FEATURE_LAYER && op.tag === RIVER_TAG);
    expect(rivers.length).toBe(1);
    const bridges = pointsOf(space, FEATURE_LAYER).filter((p) => p.tag === BRIDGE_TAG);
    expect(bridges.length).toBe(1);
    // 능선 (지면을 들어 올리는 편집) 이 그대로 있다
    expect(space.ops.some((op) => op.kind === 'stamp' && op.stamp === 'ridge')).toBe(true);
    // 조건 셋과 도시 — settlement layer 의 태그가 그대로다
    const tags = areasOf(space, SETTLEMENT_LAYER).map((a) => a.tag).sort();
    expect(tags).toEqual([CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE, CITY_TAG].sort());
    for (const tag of [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE]) {
      expect(tag.startsWith(CONDITION_PREFIX)).toBe(true);
    }
    // 그리고 그 방에는 이 Cycle 의 layer 가 한 자락도 들어오지 않았다
    expect(areasOf(space, TRACE_LAYER)).toEqual([]);
    expect(pointsOf(space, RESOURCE_LAYER)).toEqual([]);
  });

  it('R-002 채취는 즉시 획득이 아니라 행동 진행을 거친다 (RULE-ACTION-PROGRESS-001 그대로)', () => {
    const world = beside(sourceOf(ROOT_NODULE), { actorItems: { pickaxe: 1 } });
    mine(world, ROOT_NODULE);
    tickFor(world, MINE_SECONDS / 2);
    const midway = world.observe();
    const body = bodyOf(midway);
    expect(body?.state).toBe('mine');
    expect(body?.progress).toBeGreaterThan(0);
    expect(body?.progress).toBeLessThan(1);
    expect(inventoryIds(midway)).toEqual([]);
    tickFor(world, MINE_SECONDS);
    const after = world.observe();
    expect(bodyOf(after)?.state).toBe('idle');
    expect(held(after, BIO_ORE)).toBe(1);
  });

  it('R-003 방을 건너면 다른 방의 원천이 실리지 않는다 (RULE-OBSERVE-PROJECTION 그대로)', () => {
    // Given 숲 가장자리의 폐허 쪽 출구 앞에 선다
    const world = standingIn(FOREST_EDGE, anchorAt(FOREST_EDGE, RUIN_TRAIL), {
      actorItems: { pickaxe: 1 },
    });
    const before = world.observe();
    expect(sourcesIn(before).map((e) => e.id)).toEqual([MOLT_LITTER]);
    // When 폐허로 건넌다
    expect(world.dispatch({ interactionId: 'transit', targetEntityId: RUIN_TRAIL }).status).toBe(
      'success',
    );
    world.tick(TICK_INTERVAL);
    // Then 이 방의 원천만 실린다 — 건너온 방의 것은 따라오지 않는다
    const after = world.observe();
    expect(after.region.id).toBe(EXPLORER_RUIN);
    expect(sourcesIn(after).map((e) => e.id)).toEqual([RUIN_SPOIL]);
    expect(mineInteractions(after).map((i) => i.targetEntityId)).toEqual([RUIN_SPOIL]);
  });

  it('R-004 광맥과 stone 은 이 세계에서 사라졌다 — 그 자리에 원천이 왔다', () => {
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mine(world, ORE_OUTCROP);
    tickFor(world, MINE_SECONDS);
    const view = world.observe();
    expect(view.entities.some((e) => e.role === 'resource-deposit')).toBe(false);
    expect(view.hud.some((h) => h.id === 'inventory.stone')).toBe(false);
    // mine interaction 은 남았고, 겨냥하는 것이 원천이다
    expect(mineOn(view, ORE_OUTCROP)?.role).toBe('harvest-source');
  });

  // C012 CHANGED — 이 Cycle 이 "원천은 캐도 줄지 않는다" 를 확정으로 두었고 C012 가 그것을
  // 뒤집었다 (고갈이 섰다 — C011 TODO 가 부채로 적어 둔 그대로). 이 회귀가 지키는 것은
  // 뒤집힌 절반이 아니라 **뒤집히지 않은 절반**이다: 세 번 캐면 재료 셋이 손에 들어온다.
  // 고갈 자체는 C012 의 시나리오가 잰다.
  it('R-005 세 번 캐면 재료가 셋 들어온다 (채취가 세는 것은 그대로다)', () => {
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    for (let i = 0; i < 3; i++) {
      expect(mine(world, ORE_OUTCROP).status).toBe('success');
      tickFor(world, MINE_SECONDS);
    }
    expect(held(world.observe(), BIO_ORE)).toBe(3);
  });

  it('R-006 세계를 두 번 세워도 원천의 자리와 흔적이 같다 (데이터에서 온다 — 결정론)', () => {
    const once = sourcesInRegion(RED_EYE_TREE).map((s) => ({ ...s, position: { ...s.position } }));
    const twice = sourcesInRegion(RED_EYE_TREE).map((s) => ({ ...s, position: { ...s.position } }));
    expect(twice).toEqual(once);
    const world = createWorld({ ...solo, actorRegion: RED_EYE_TREE });
    void world;
    expect(traceAt(RED_EYE_TREE, sourceOf(ROOT_NODULE).position)).toBe(
      traceAt(RED_EYE_TREE, sourceOf(ROOT_NODULE).position),
    );
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 흔적을 따라 걸어 방을 넘는 한 판 — 백왕령 → 숲 가장자리 → 숲 깊은 곳 → 광석 지대까지 걸어서 잇는 시나리오는 Connector 넷을 걸어 건너야 하고, 걸음 시간이 수십 초여서 한 it 에 들어가지 않는다 (방마다 세워 재는 위의 방식으로 갈랐다)',
  );
  it.todo(
    'GAP: 관찰자가 흔적의 짙기를 "보고" 방향을 고르는가 — 흔적은 관찰 결과에 실리지 않고 관찰자가 스스로 컴파일해 얻는다 (spec Observable). 세계 쪽에서 잴 수 있는 것은 데이터의 단조성까지다',
  );
});
