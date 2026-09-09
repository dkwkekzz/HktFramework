// C023 — 태어남은 소비다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-009)
//
// C022 는 방이 **생명이 될 것**을 품게 했다 — 알집이 서고, 조건 넷이 차 있는 동안 결속이
// 60 세계 초에 걸쳐 오르는 데까지. 그러나 다 차도 아무 일도 일어나지 않았다(c022 S-054).
// 이 Cycle 에서 그 자리가 **터진다**. 그래서 여기서 재는 것은 여섯이다:
//   ① 한 tick 에 다섯 — phase · 소비 · 세움 · 개체군 · 소란이 **함께** 움직인다 (반만 일어나지 않는다)
//   ② 소비 — 먹힌 원천이 캔 것과 같은 State 가 되고, 거기 매달린 것의 되돌아옴이 멎는다
//   ③ 한 바퀴 — BORN(한 tick) → SPENT(120 세계 초) → DORMANT. 아무도 없어도 돈다
//   ④ 남은 것 — 빈 껍질과 작은 껍질이 처음은 고갈이고, 되돌리는 것은 시간이 아니라 다음 탄생이다
//   ⑤ 떼 — 개체군 값만큼의 자락이 서고 상한(4)에서 멈춘다. 값 자체는 실리지 않는다
//   ⑥ 계승 — 뿌리의 알이 알집 없이 잇는다 (요구 둘 · 90 초 · 뿌리혹 하나)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// State 를 직접 읽는 자리는 spec 의 State 절이 이름으로 못 박은 셋뿐이다
// (`RegionState.lifeSites[id]` · `RegionState.populations[id]` · `RegionState.sources[id]`) —
// 결속과 머묾의 진행도 개체군 값도 관찰 봉투에 실리지 않기 때문이다 (Observable "투영하지 않는 것").
//
// 이 Cycle 의 새 구현(content/regions 의 새 데이터 · content/world/semantic/life.ts 의 새 함수 ·
// simulation/life-binding.ts 의 새 규칙 · content/view/** · tools/**)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C023-birth-is-consumption/spec.md 와 이미 있던 하네스·선례
// (c022 · c021 · c020 · c018 · c017 · c013 · persistence)뿐이다.
//
// **자리를 손으로 적지 않는다** — 탄생지 둘의 자리는 관찰 결과의 `position` 에서, 원천의 자리는
// Description 의 resource point 에서, 매달린 원천의 이름은 세계가 엮어 둔 `dependsOn` 에서 얻는다.
// 손으로 적는 것은 spec 이 이름으로 못 박은 것(방 · 원천 id · 탄생지 id · 개체군 id · 결속 60 ·
// 계승 90 · 머묾 120 · 상한 4 · 하루 360)뿐이고, 그것들은 세계에서 유도할 자리가 없다.
//
// **조건 코드의 글자도 손으로 적지 않는다** — 구조로 잰다: "서로 다른 코드가 걸린다" ·
// "그 조건이 차면 그 코드가 사라진다". 다만 C013 · C014 · C018 이 **이미 세운** 두 코드
// (`recovery-stalled` · `condition-unmet`)는 spec R4 가 "그 코드 그대로" 라고 이름했으므로
// content/regions 가 이미 내보내는 상수를 그대로 가져다 쓴다 (새로 짓지 않았다는 것이 곧 판정이다).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import {
  curvesOf,
  descriptionHash,
  nearestCurveDistance,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  BIO_ORE_FIELD,
  COMPILE_RULES,
  CONDITION_PREFIX,
  CONDITION_RIDGE,
  CONDITION_UNMET,
  CONDITION_WEAK_PREFIX,
  EXPLORER_RUIN,
  FANTASY_MAZE,
  FOREST_DEEP,
  FOREST_EDGE,
  FROST_CANYON,
  HEART_LAKE,
  ICE_CANYON,
  MAZE_HEART,
  PREDATOR_NEST,
  PRESENCE_LAYER,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  REGION_SPECS,
  RESOURCE_LAYER,
  ROOT_CURVE_TAG,
  SETTLEMENT_LAYER,
  TREE_INNER_WORLD,
  WHITE_KING_DOMAIN,
  regionSpec,
  type SeasonId,
  ORE_EATER,
  TREE_FUNGUS,
} from '../../regions';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourcesInRegion, sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 데이터 값 표) ──────────────

/** 탄생지 둘 — 붉은 알집(결속) · 뿌리의 알(계승) (C022 State 표 · C023 State 표) */
const CLUTCH = 'ROOT_CLUTCH';
const EGGS = 'ROOT_EGGS';
const SITES: readonly string[] = [CLUTCH, EGGS];
/** 그 둘이 선 방 (State 표 · Play §5.2 · §5.4) */
const ROOM = RED_EYE_TREE;
/** 개체군 하나 — 광식충 (C022 State 표 · 확정 6) */
const POPULATION = 'ORE_EATER';
/** 그 개체군의 상한 (World Change 5 · 확정 6) */
const POPULATION_SCALE = 4;

/** 소비되는 원천 둘 — 균사는 **다른 방**의 것이다 (SPEC-002 경계 ③) */
const NODULE = 'ROOT_NODULE'; // 거목의 방
const FUNGUS = 'NEST_FUNGUS'; // 둥지의 방 (PREDATOR_NEST)
/** 탄생이 남기는 원천 둘 (spec 데이터 표 · 확정 7) */
const CLUTCH_HUSK = 'CLUTCH_HUSK'; // 빈 껍질 — 결속이 남긴다
const EGG_HUSK = 'EGG_HUSK'; // 작은 껍질 — 계승이 남긴다
const HUSKS: readonly string[] = [CLUTCH_HUSK, EGG_HUSK];
/** 생명을 전제한 회복 원인이 붙는 원천 (SPEC-009 회귀 · C022 S-105) */
const MOLT = 'MOLT_LITTER'; // 숲 어귀

/** 결속의 길이 — 60 세계 초 (C022 확정 5) */
const BINDING_SECONDS = 60;
/** 계승의 길이 — 90 세계 초 (spec 데이터 표 · 확정 5) */
const INHERIT_SECONDS = 90;
/** 터진 자리가 머무는 길이 — 120 세계 초 (spec 데이터 표 · 확정 5 · 기본형 ②) */
const SPENT_SECONDS = 120;
/** 하루 — 360 세계 초 (C022 spec 데이터 · 비 표) */
const DAY_TOTAL = 360;

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/**
 * 하루 안의 비 구간 — C022 spec 의 비 표 그대로 (확정 4 · 기본형 ②).
 * 이 Cycle 은 이 눈금에 한 값도 더하지 않는다 (SPEC-009 경계).
 */
const RAIN_WINDOWS: Readonly<Record<SeasonId, readonly (readonly [number, number])[]>> = {
  STILL: [[0, 90]],
  SEEP: [
    [0, 90],
    [180, 270],
  ],
  LONG_NIGHT: [],
  TURN: [],
};
const rainsAt = (season: SeasonId, withinDay: number): boolean =>
  RAIN_WINDOWS[season].some(([from, to]) => withinDay >= from && withinDay < to);

/** phase 넷 — 이 Cycle 이 넷을 다 돈다 (State 표) */
const DORMANT = 'DORMANT';
const BINDING = 'BINDING';
const BORN = 'BORN';
const SPENT = 'SPENT';
/** phase 넷의 **차례** (SPEC-008 경계 ①) */
const PHASE_ORDER: readonly string[] = [DORMANT, BINDING, BORN, SPENT];

/** 원천의 phase (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';

/** 채취의 소요 시간 — 행동표가 소유한다. "넉넉히 지난다" 로만 쓴다 (C011~C022 어법) */
const MINE_SECONDS = 1.2;

// ── 회귀의 기준값 (SPEC-009) — C022 시나리오의 표를 그대로 옮겨 왔다 ──

interface RoomBaseline {
  hash: string;
  surface: Readonly<Record<string, number>>;
  traversable: number;
}

/** **이 Cycle 이 만지지 않는 방 열둘** — c022 의 BASELINE 표 그대로다 (한 글자도 고치지 않는다) */
const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    hash: '1c57fb5f',
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1328,
  },
  [FOREST_EDGE]: {
    hash: 'da66b8e9',
    surface: { flat: 1386, slope: 127, steep: 168 },
    traversable: 1513,
  },
  [FOREST_DEEP]: {
    hash: 'b0cabbb8',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [EXPLORER_RUIN]: {
    hash: 'a1cfb66b',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [PREDATOR_NEST]: {
    // C024 CHANGED — 둥지는 C024 가 만졌다 (사체 · 변성지 · 자락 넷). **표면도 통행도 한 값
    // 달라지지 않았고**(아래 두 수가 그것을 그대로 잰다) 달라진 것은 Description 에 선 자리뿐이다.
    hash: 'c9a53392',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [BIO_ORE_FIELD]: {
    hash: 'f111570c',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [TREE_INNER_WORLD]: {
    // C030 CHANGED — 거목 안에 온기의 흔적 셋과 원천 하나가 서서 hash 가 바뀐다
    // (24bc11c0 → fed501ba). 이 방의 땅은 여전히 평지 그대로다
    hash: 'fed501ba',
    surface: { flat: 6561 },
    traversable: 6561,
  },
  [HEART_LAKE]: {
    hash: 'dfb3a6cf',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [FANTASY_MAZE]: {
    hash: '53ca6a70',
    surface: { flat: 6561 },
    traversable: 6561,
  },
  [MAZE_HEART]: {
    hash: 'b9b77a14',
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [ICE_CANYON]: {
    hash: '5928ed79',
    surface: { steep: 810, slope: 164, frost: 697, flat: 10 },
    traversable: 871,
  },
  [FROST_CANYON]: {
    // C029 CHANGED — 빙결 심층의 문 앞에 자락 하나가 서서 이 방의 hash 가 바뀐다
    // (e5d9cd3d → ba0afb9e). 땅도 표면도 통행도 한 값 그대로다 — 자락은 얹히는 것이다
    hash: 'ba0afb9e',
    surface: { steep: 902, slope: 72, frost: 697, flat: 10 },
    traversable: 779,
  },
};

/**
 * **거목의 방**은 이 Cycle 도 데이터를 더하는 방이다 — 뿌리의 알의 point · 원천 둘의 point ·
 * after 자락 둘 · 떼의 자락 넷이 그 방 Description 에 난다. 그래서 hash 는 C022 의 값과
 * 달라도 되고, **땅과 통행은 달라지면 안 된다**: 흔적도 원천도 탄생지도 높이와 표면을
 * 건드리지 않는다 (C011 이 원천을 세울 때 세운 그 규율 · c022 S-102 가 이은 그 규율).
 * hash 는 대신 **한 세계 안에서** 철 · phase · 진행에 흔들리지 않는다는 것으로 잰다.
 */
const TREE_ROOM_GROUND: Omit<RoomBaseline, 'hash'> = {
  surface: { flat: 1681 },
  traversable: 1681,
};

/** 원천 열넷의 **처음 자리** — c022 의 SOURCE_BASELINE 표 그대로다 (이 Cycle 이 더한 둘은 뺀다) */
const SOURCE_BASELINE: readonly {
  region: string;
  id: string;
  phase: string;
  taken: number;
  trace: number;
}[] = [
  { region: FOREST_EDGE, id: MOLT, phase: AVAILABLE, taken: 0, trace: 2 },
  { region: FOREST_EDGE, id: 'SEEP_CRUST', phase: AVAILABLE, taken: 0, trace: 2 },
  { region: FOREST_EDGE, id: 'FALLEN_SCALE', phase: DEPLETED, taken: 1, trace: 1 },
  { region: FOREST_EDGE, id: 'PREY_REMAINS', phase: DEPLETED, taken: 1, trace: 1 },
  { region: FOREST_DEEP, id: 'RIVER_SILT', phase: DEPLETED, taken: 2, trace: 2 },
  { region: EXPLORER_RUIN, id: 'RUIN_SPOIL', phase: AVAILABLE, taken: 0, trace: 2 },
  { region: PREDATOR_NEST, id: FUNGUS, phase: AVAILABLE, taken: 0, trace: 4 },
  { region: BIO_ORE_FIELD, id: 'ORE_OUTCROP', phase: AVAILABLE, taken: 0, trace: 4 },
  { region: RED_EYE_TREE, id: NODULE, phase: AVAILABLE, taken: 0, trace: 5 },
  { region: HEART_LAKE, id: 'LAKE_SILT_BED', phase: AVAILABLE, taken: 0, trace: 4 },
  { region: ICE_CANYON, id: 'PASS_RIME', phase: AVAILABLE, taken: 0, trace: 2 },
  { region: FROST_CANYON, id: 'CLIFF_FROST_VEIN', phase: AVAILABLE, taken: 0, trace: 3 },
  { region: FROST_CANYON, id: 'SNOW_DRIFT_DUST', phase: AVAILABLE, taken: 0, trace: 3 },
  { region: FROST_CANYON, id: 'FROZEN_REMAINS', phase: AVAILABLE, taken: 0, trace: 3 },
];

/** C016 ~ C021 이 세운 덧씌움 — 이 Cycle 도 여기에 한 값을 더하지 않는다 (c022 PHASES_BASELINE 그대로) */
const PHASES_BASELINE: Readonly<Record<string, unknown>> = {
  [FOREST_EDGE]: {
    seasons: {
      SEEP: {
        depthOverlay: [
          {
            areaId: 'depth-edge-deep-trail',
            depth: 'wild',
          },
        ],
        hazardExtend: [
          {
            areaId: 'hazard-edge-deep-trail',
            hazard: 'hazard/creature',
          },
        ],
      },
    },
  },
  [FOREST_DEEP]: {
    seasons: {
      SEEP: {
        depthOverlay: [
          {
            areaId: 'depth-deep-toward-ore',
            depth: 'deep',
          },
        ],
        hazardExtend: [
          {
            areaId: 'hazard-deep-toward-ore',
            hazard: 'hazard/creature',
          },
        ],
      },
      LONG_NIGHT: {
        hazardExtend: [
          {
            areaId: 'hazard-deep-ancient-gate',
            hazard: 'hazard/phenomenon',
          },
        ],
      },
    },
  },
  [EXPLORER_RUIN]: {
    seasons: {
      SEEP: {
        hazardExtend: [
          {
            areaId: 'hazard-ruin-rot',
            hazard: 'hazard/ecology',
          },
        ],
      },
    },
  },
  [PREDATOR_NEST]: {
    seasons: {
      LONG_NIGHT: {
        depthOverlay: [
          {
            areaId: 'depth-nest-den',
            depth: 'deep',
          },
        ],
        hazardExtend: [
          {
            areaId: 'hazard-nest-den',
            hazard: 'hazard/creature',
          },
        ],
      },
    },
  },
  [BIO_ORE_FIELD]: {
    seasons: {
      LONG_NIGHT: {
        hazardExtend: [
          {
            areaId: 'hazard-ore-outcrop',
            hazard: 'hazard/creature',
          },
        ],
      },
    },
    awake: {
      depthOverlay: [
        {
          areaId: 'depth-ore-outcrop',
          depth: 'deep',
        },
      ],
      hazardExtend: [
        {
          areaId: 'hazard-ore-outcrop',
          hazard: 'hazard/creature',
        },
      ],
    },
    onTurn: {
      burySigns: true,
      migrateSources: [
        'ORE_OUTCROP',
      ],
    },
  },
  [RED_EYE_TREE]: {
    seasons: {
      SEEP: {
        depthOverlay: [
          {
            areaId: 'depth-tree-nodule',
            depth: 'deep',
          },
        ],
      },
      LONG_NIGHT: {
        hazardExtend: [
          {
            areaId: 'hazard-tree-nodule',
            hazard: 'hazard/creature',
          },
        ],
      },
    },
  },
  [ICE_CANYON]: {
    standing: {
      hazardExtend: [
        {
          areaId: 'hazard-ice-cliff-west',
          hazard: 'hazard/terrain',
        },
        {
          areaId: 'hazard-ice-cliff-east',
          hazard: 'hazard/terrain',
        },
      ],
    },
  },
  [FROST_CANYON]: {
    seasons: {
      SEEP: {
        outflow: [
          {
            region: 'WHITE_KING_DOMAIN',
            areaId: 'condition-ridge-foot',
            throughConnector: 'ICE_CANYON_PASS',
            carrier: 'wind',
          },
        ],
      },
      LONG_NIGHT: {
        outflow: [
          {
            region: 'WHITE_KING_DOMAIN',
            areaId: 'condition-ridge-foot',
            throughConnector: 'ICE_CANYON_PASS',
            carrier: 'wind',
          },
        ],
      },
    },
    standing: {
      hazardExtend: [
        {
          areaId: 'hazard-blizzard',
          hazard: 'hazard/climate',
          observeRange: {
            day: 20,
            night: 10,
          },
        },
        {
          areaId: 'hazard-crystal-face',
          hazard: 'hazard/matter',
          contact: 'crystallizing',
        },
        {
          areaId: 'hazard-ice-cliff-west',
          hazard: 'hazard/terrain',
        },
        {
          areaId: 'hazard-ice-cliff-east',
          hazard: 'hazard/terrain',
        },
      ],
    },
  },
};

// ── 하네스 (c013 · c016 · c020 · c021 · c022 의 선례 그대로) ──────────

/**
 * 검증용 손잡이 — 교집합으로 둔다 (c022 의 LifeSetup 그대로).
 * `lifeSitePhases` 는 이 Cycle 에서 phase **넷을 다** 받는다.
 */
type LifeSetup = WorldSetup & {
  /** 탄생지가 어느 phase 로 서는가 — 예: `{ ROOT_CLUTCH: 'spent' }` */
  lifeSitePhases?: Record<string, string>;
  /** 개체군이 어느 값으로 서는가 — 예: `{ ORE_EATER: 1 }` */
  populations?: Record<string, number>;
};

/**
 * C024 CHANGED — **거목균을 배속 1 의 자리에 세운다.**
 *
 * C024 부터 균사의 되돌아옴이 거목균의 수에 매인다 (C024 SPEC-008). 이 파일이 재는 것은
 * 거목의 방의 결속과 탄생이지 둥지의 생태가 아니므로, **배속이 1 이 되는 값**에 세워
 * 균사가 C022·C023 이 잰 그 초 그대로 돌아오게 둔다 — 값이 0 이면 아주 멎고 상한이면
 * 두 배로 빨라지는데, 둘 다 이 파일이 말하려는 것과 무관한 흔들림이다.
 */
const solo: LifeSetup = {
  npcs: [],
  populations: { [TREE_FUNGUS]: 1 },
  // 그리고 **둥지의 사체를 비워 둔다** — 그래야 변성이 서지 않아 위의 1 이 재는 동안
  // 흔들리지 않는다 (변성 한 번이면 값이 2 가 되어 균사가 두 배로 빨라진다).
  sourcePhases: { NEST_CARCASS: 'depleted' },
};

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const statesOf = (w: WorldDriver) => state(w).regionStates as Record<string, unknown>;
const worldTime = (w: WorldDriver) => state(w).time;

function spaceOf(id: string): RegionDescription {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 방 '${id}' 를 알지 못한다`);
  return spec.space;
}

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

const gridMemo = new Map<string, XZ[]>();
function gridSpots(id: string): XZ[] {
  const hit = gridMemo.get(id);
  if (hit) return hit;
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  gridMemo.set(id, out);
  return out;
}
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

/** 표면 태그마다 vertex 수 — "땅이 한 값도 달라지지 않았는가" 를 재는 자리 (c019 ~ c022 어법) */
function surfaceCounts(region: string): Record<string, number> {
  const t = terrainOf(region);
  const out: Record<string, number> = {};
  for (let i = 0; i < t.surface.length; i++) {
    const tag = t.surfaceTags[t.surface[i]!] ?? '?';
    out[tag] = (out[tag] ?? 0) + 1;
  }
  return out;
}

const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`${region} 의 resource layer 에 '${id}' 자리가 없다`);
  return found.position;
};

/** 그 자리에 손이 닿는, 걸어 설 수 있는 자리 하나 (c020 ~ c022 의 besideIn 그대로) */
function besideIn(region: string, at: XZ): XZ {
  const near = walkableSpots(region).filter((p) => distanceBetween(p, at) <= INTERACTION_RANGE * 0.9);
  if (near.length === 0) throw new Error(`(${at.x}, ${at.z}) 곁에 걸어 설 자리가 없다 (${region})`);
  return minBy(near, (p) => distanceBetween(p, at));
}

const conditionTagsAt = (region: string, at: XZ): string[] =>
  tagsAt(terrainOf(region), at.x, at.z, SETTLEMENT_LAYER).filter((tag) =>
    tag.startsWith(CONDITION_PREFIX),
  );

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const inRoom = (region: string, at?: XZ, extra: LifeSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
    // C024 CHANGED — 개체군은 **덮지 않고 겹친다.** 아래의 세움들은 광식충 하나만 말하는데,
    // 통째로 갈아 끼우면 solo 가 세운 거목균이 함께 사라져 균사가 돌아오지 않게 된다
    // (C024 SPEC-008). 부르는 쪽이 밝힌 값이 언제나 이긴다.
    populations: { ...solo.populations, ...extra.populations },
    sourcePhases: { ...solo.sourcePhases, ...extra.sourcePhases },
  } as WorldSetup);
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: LifeSetup = {}): WorldDriver =>
  inRoom(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 세계 시간을 흘린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 ~ c022 의 wait 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

const move = (w: WorldDriver, at: XZ): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } });
const mine = (w: WorldDriver, targetEntityId: string): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId });
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

function mineOnce(w: WorldDriver, id: string): ActionResult {
  const result = mine(w, id);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}

// ── 저장·복구 (persistence.spec · c013 ~ c022 의 선례 그대로) ─────────

function wrap(world: World): WorldDriver {
  return {
    dispatch(action, observerId = OBSERVER) {
      world.request(observerId, action);
      const result = world.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    },
    dispatchForOutcome(action, observerId = OBSERVER) {
      world.request(observerId, action);
      return world.tick(0).outcomes.get(observerId) ?? [];
    },
    tick: (dt) => void world.tick(dt),
    join: (observerId) => world.join(observerId),
    leave: (observerId) => world.leave(observerId),
    mark: (value, observerId = OBSERVER) => world.mark(observerId, value),
    observe(observerId = OBSERVER) {
      const snapshot = world.latestObservation(observerId);
      if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
      return snapshot as GameViewSnapshot;
    },
    world,
  };
}
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;

function revive(base: WorldDriver): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

// ── 관찰 결과와 State 를 읽는 자리 (spec Observable · State 의 점 경로) ──

type SiteView = EntityView & { conditions?: string[] };

const siteEntity = (v: GameViewSnapshot, id: string): SiteView | undefined =>
  v.entities.find((e) => e.role === 'life-site' && e.id === id) as SiteView | undefined;
function seenSite(w: WorldDriver, id: string): SiteView {
  const found = siteEntity(w.observe(), id);
  if (!found) throw new Error(`관찰 결과에 탄생지 '${id}' 가 실리지 않았다`);
  return found;
}
/** 지금 **모자란** 조건 코드들 — 하나도 없으면 자리 자체가 없다 (관찰 계약) */
const missingCodes = (w: WorldDriver, id: string): string[] => seenSite(w, id).conditions ?? [];

interface LifeSiteShape {
  phase: string;
  progress: number;
}
/** `RegionState.lifeSites[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function siteStateIn(w: WorldDriver, id: string, region = ROOM): LifeSiteShape | undefined {
  const here = statesOf(w)[region] as { lifeSites?: Record<string, LifeSiteShape> } | undefined;
  return here?.lifeSites?.[id];
}
function siteState(w: WorldDriver, id: string): LifeSiteShape {
  const found = siteStateIn(w, id);
  if (!found) throw new Error(`Region State 에 탄생지가 없다 — regionStates.${ROOM}.lifeSites.${id}`);
  return found;
}
const phaseOf = (w: WorldDriver, id: string): string => siteState(w, id).phase;
const progressOf = (w: WorldDriver, id: string): number => siteState(w, id).progress;

/** `RegionState.populations[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function populationValue(w: WorldDriver, region = ROOM, id = POPULATION): number {
  const here = statesOf(w)[region] as { populations?: Record<string, { value: number }> } | undefined;
  const found = here?.populations?.[id];
  if (!found) {
    throw new Error(`Region State 에 개체군이 없다 — regionStates.${region}.populations.${id}`);
  }
  return found.value;
}

interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
  siteIndex?: number;
}
const sourceAt = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w) as never, region, id) as SourceStateShape;
/** 원천 하나의 지금 — 견주기 좋게 세 값만 뽑는다 */
const sourceShot = (w: WorldDriver, region: string, id: string) => {
  const held = sourceAt(w, region, id);
  return { id, phase: held.phase, taken: held.taken, progress: held.progress ?? 0 };
};

const sourceEntity = (v: GameViewSnapshot, id: string): SiteView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id) as SiteView | undefined;
const mineOn = (v: GameViewSnapshot, id: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'mine' && i.targetEntityId === id);

/** 그 방의 소란 — 몸이 있으면 봉투로, 없으면 세계 State 로 읽는다 (c017 · c018 의 그 자리) */
const seenDisturbance = (w: WorldDriver) => w.observe().region.disturbance;
const heldDisturbance = (w: WorldDriver, region = ROOM): number => {
  const here = statesOf(w)[region] as { disturbance?: { value: number } } | undefined;
  if (!here?.disturbance) throw new Error(`Region State 에 소란이 없다 — ${region}`);
  return here.disturbance.value;
};

/** 지나는 것과 **서 있는 떼**가 같은 자리에 실린다 — 떼만 `area` 를 진다 (관찰 계약) */
type PresenceShape = { presence: string; curve?: string; area?: string };
const presencesOf = (w: WorldDriver): PresenceShape[] =>
  w.observe().presences as unknown as PresenceShape[];
const herdAreas = (w: WorldDriver): string[] =>
  presencesOf(w)
    .filter((p) => p.area !== undefined)
    .map((p) => p.area!);

/** 그 봉투 안에 **값이 꼭 그것인** 자리가 있는가 — 부분 문자열은 세지 않는다 */
function carriesExactly(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value === needle;
  if (value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((one) => carriesExactly(one, needle));
}

/** 세계가 엮어 둔 **매달림** — 뿌리혹에 매달린 원천의 이름을 손으로 적지 않는다 (C012 dependsOn) */
function hangingOn(sourceId: string): { id: string; region: string } {
  for (const spec of REGION_SPECS) {
    for (const source of sourcesInRegion(spec.id)) {
      if (source.dependsOn === sourceId) return { id: source.id, region: spec.id };
    }
  }
  throw new Error(`세계에 '${sourceId}' 에 매달린 원천이 없다 — C012 가 세운 그 사슬이 끊겼다`);
}

/**
 * 탄생지 하나의 자리 — **관찰 결과에서 얻는다** (손으로 적지 않는다).
 */
const siteAtMemo = new Map<string, XZ>();
function siteAt(id: string): XZ {
  const hit = siteAtMemo.get(id);
  if (hit) return hit;
  const found = siteEntity(inRoom(ROOM).observe(), id);
  if (!found) throw new Error(`관찰 결과에 탄생지 '${id}' 가 실리지 않았다 — 자리를 얻을 수 없다`);
  const at = { x: found.position.x, z: found.position.z };
  siteAtMemo.set(id, at);
  return at;
}
const clutchAt = () => siteAt(CLUTCH);
const eggsAt = () => siteAt(EGGS);

/** 알집 곁에 선 세계 — 넷이 다 차 있는 고요의 첫 비 (c022 의 atClutch 그대로) */
const atClutch = (extra: LifeSetup = {}): WorldDriver => inSeason(STILL, ROOM, clutchAt(), extra);
/** 알집에서 가장 먼, 걸어 설 수 있는 자리 — 자락 밖 */
const awayFromClutch = (): XZ => maxBy(walkableSpots(ROOM), (p) => distanceBetween(p, clutchAt()));

/**
 * **아무것도 태어나지 않는 세계** — 개체군이 상한이면 결속은 요구(값 0)가 막고 계승은
 * 전이 자체가 서지 않는다 (SPEC-001 경계 ③). 회귀와 대조군의 Given 으로 쓴다.
 */
const capped: LifeSetup = { populations: { [POPULATION]: POPULATION_SCALE } };

// ── 태어남을 짚는 자리 ───────────────────────────────────────────────

/** 한 걸음마다 찍는 세계의 지금 — "한 tick 에 다섯" 을 견주는 판 */
interface Frame {
  time: number;
  phase: string;
  progress: number;
  population: number;
  disturbance: number;
  sources: Record<string, { phase: string; taken: number; progress: number }>;
}
const SHOT_SOURCES: readonly { region: string; id: string }[] = [
  { region: ROOM, id: NODULE },
  { region: PREDATOR_NEST, id: FUNGUS },
  { region: ROOM, id: CLUTCH_HUSK },
  { region: ROOM, id: EGG_HUSK },
];
function frameOf(w: WorldDriver, site: string): Frame {
  const sources: Frame['sources'] = {};
  for (const one of SHOT_SOURCES) {
    const shot = sourceShot(w, one.region, one.id);
    sources[one.id] = { phase: shot.phase, taken: shot.taken, progress: shot.progress };
  }
  return {
    time: worldTime(w),
    phase: phaseOf(w, site),
    progress: progressOf(w, site),
    population: populationValue(w),
    disturbance: heldDisturbance(w),
    sources,
  };
}

/**
 * 결속(또는 계승)이 다 차 **BINDING 을 벗어나는 그 tick** 까지 굴린다.
 * 한 걸음이 1 세계 초 = 한 tick 이므로, 그 tick 의 앞과 그 tick 을 나란히 얻는다.
 */
function runToLeaveBinding(
  w: WorldDriver,
  site: string,
  limitSeconds = 600,
): { before: Frame; at: Frame; elapsed: number } {
  if (phaseOf(w, site) !== BINDING) {
    throw new Error(`'${site}' 가 결속하고 있지 않다 — 지금 ${phaseOf(w, site)}`);
  }
  const from = worldTime(w);
  let before = frameOf(w, site);
  for (let s = 0; s < limitSeconds; s++) {
    w.tick(1);
    if (phaseOf(w, site) !== BINDING) {
      const at = frameOf(w, site);
      return { before, at, elapsed: at.time - from };
    }
    before = frameOf(w, site);
  }
  throw new Error(
    `'${site}' 가 ${limitSeconds} 세계 초 안에 결속을 벗어나지 않았다 — 진행 ${progressOf(w, site)}`,
  );
}

/** 그 조건이 참이 될 때까지 굴린다 (1 세계 초 걸음) */
function runUntil(w: WorldDriver, done: () => boolean, limitSeconds: number, what: string): number {
  for (let s = 0; s < limitSeconds; s++) {
    if (done()) return s;
    w.tick(1);
  }
  if (done()) return limitSeconds;
  throw new Error(`${limitSeconds} 세계 초 안에 일어나지 않았다 — ${what}`);
}

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 태어남은 한 tick 에 일어나고 다섯이 함께 움직인다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 태어남은 한 tick 에 일어나고 다섯이 함께 움직인다', () => {
  it('S-111 결속이 다 찬 그 tick 에 phase · 소비 · 세움 · 개체군 · 소란이 함께 움직인다', () => {
    // Given 넷이 다 차 있는 고요의 첫 비 — 알집이 결속한다
    const w = atClutch();
    expect({ phase: phaseOf(w, CLUTCH) }).toEqual({ phase: BINDING });

    // When 결속이 다 차는 그 tick 까지 굴린다
    const { before, at, elapsed } = runToLeaveBinding(w, CLUTCH);

    // Then ⓪ 그 tick 은 결속의 길이(60 세계 초)에 온다
    expect({ elapsed }).toEqual({ elapsed: BINDING_SECONDS });
    // And ① phase 가 넘어간다
    expect({ phase: at.phase }).toEqual({ phase: BORN });
    // And ② 소비하는 원천 둘이 그 tick 에 고갈된다 (다른 방의 균사도 함께)
    expect({ nodule: at.sources[NODULE]!.phase, fungus: at.sources[FUNGUS]!.phase }).toEqual({
      nodule: DEPLETED,
      fungus: DEPLETED,
    });
    // And ③ 탄생이 세우는 원천이 캘 수 있게 된다 (거기 없던 것이 선다)
    expect({ husk: at.sources[CLUTCH_HUSK]!.phase, taken: at.sources[CLUTCH_HUSK]!.taken }).toEqual({
      husk: AVAILABLE,
      taken: 0,
    });
    // And ④ 개체군 값이 1 오른다
    expect({ population: at.population }).toEqual({ population: before.population + 1 });
    // And ⑤ 그 방의 소란이 오른다
    expect({ rose: at.disturbance > before.disturbance }).toEqual({ rose: true });

    // And **그 앞의 tick 에는 다섯 가운데 아무것도 움직이지 않았다** (경계 ①)
    expect({
      phase: before.phase,
      nodule: before.sources[NODULE]!.phase,
      fungus: before.sources[FUNGUS]!.phase,
      husk: before.sources[CLUTCH_HUSK]!.phase,
      population: before.population,
    }).toEqual({
      phase: BINDING,
      nodule: AVAILABLE,
      fungus: AVAILABLE,
      husk: DEPLETED,
      population: 0,
    });
  }, 60_000);

  it('S-112 (경계 ①) 진행이 다 차기 전에는 다섯 가운데 아무것도 움직이지 않는다', () => {
    const w = atClutch();
    const start = frameOf(w, CLUTCH);
    // When 결속의 길이에 못 미치는 만큼 굴린다
    wait(w, BINDING_SECONDS - 5);
    const midway = frameOf(w, CLUTCH);
    // Then 진행만 올랐고 나머지 넷은 한 값도 달라지지 않았다
    expect({ rising: midway.progress > 0 && midway.progress < 1 }).toEqual({ rising: true });
    expect({
      phase: midway.phase,
      sources: midway.sources,
      population: midway.population,
      disturbance: midway.disturbance,
    }).toEqual({
      phase: BINDING,
      sources: start.sources,
      population: start.population,
      disturbance: start.disturbance,
    });
  }, 60_000);

  it('S-113 (경계 ②) 요구가 깨져 진행이 멎은 동안에는 일어나지 않는다', () => {
    // Given 관찰자는 둥지의 방에 있고, 거목의 방에서 결속이 오르고 있다 (c022 S-053 의 그 자리)
    const w = inSeason(STILL, PREDATOR_NEST, besideIn(PREDATOR_NEST, pointOf(PREDATOR_NEST, FUNGUS)), {
      actorItems: { pickaxe: 1 },
    });
    expect({ phase: phaseOf(w, CLUTCH) }).toEqual({ phase: BINDING });
    wait(w, 20);
    // When 다른 방의 균사를 캐 조건 하나를 깨뜨린다
    expect({ ...mineOnce(w, FUNGUS) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const frozen = frameOf(w, CLUTCH);
    expect({ phase: frozen.phase, kept: frozen.progress > 0 }).toEqual({ phase: DORMANT, kept: true });

    // When 결속의 길이를 넘고도 남을 만큼 굴린다 (균사가 되돌아오기 전까지)
    wait(w, BINDING_SECONDS + 20);
    // Then 진행도 phase 도 원천도 개체군도 그대로다 — 다 차지 않았으므로 아무것도 태어나지 않는다
    const still = frameOf(w, CLUTCH);
    expect({
      phase: still.phase,
      progress: still.progress,
      nodule: still.sources[NODULE]!.phase,
      husk: still.sources[CLUTCH_HUSK]!.phase,
      population: still.population,
    }).toEqual({
      phase: DORMANT,
      progress: frozen.progress,
      nodule: AVAILABLE,
      husk: DEPLETED,
      population: 0,
    });
  }, 60_000);

  it('S-114 (경계 ③) 개체군 값이 상한이면 전이 자체가 일어나지 않는다 — phase 도 원천도 그대로다', () => {
    // Given 개체군이 상한인 세계 — 계승(뿌리의 알)은 요구 둘이 차 있어 결속한다
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), capped);
    expect({ population: populationValue(w) }).toEqual({ population: POPULATION_SCALE });
    expect({ phase: phaseOf(w, EGGS) }).toEqual({ phase: BINDING });

    // When 계승의 길이를 넘고도 남을 만큼 굴린다
    wait(w, INHERIT_SECONDS + 30);
    // Then 진행은 다 찼으나 phase 는 넘어가지 않는다
    expect({ phase: phaseOf(w, EGGS), progress: progressOf(w, EGGS) }).toEqual({
      phase: BINDING,
      progress: 1,
    });
    // And 소비도 세움도 값도 일어나지 않는다 (반만 일어나는 자리를 만들지 않는다)
    expect({
      nodule: sourceShot(w, ROOM, NODULE).phase,
      husk: sourceShot(w, ROOM, EGG_HUSK).phase,
      population: populationValue(w),
    }).toEqual({ nodule: AVAILABLE, husk: DEPLETED, population: POPULATION_SCALE });
  }, 60_000);

  it('S-115 관찰자가 그 방에 없어도 일어난다', () => {
    // Given 관찰자는 백왕령에 있다 — 거목의 방은 아무도 보고 있지 않다
    const w = inSeason(STILL, WHITE_KING_DOMAIN, undefined, {});
    expect({ phase: phaseOf(w, CLUTCH) }).toEqual({ phase: BINDING });
    const before = heldDisturbance(w);
    // When 결속의 길이만큼 굴린다
    wait(w, BINDING_SECONDS + 2);
    // Then 다섯이 다 움직여 있다
    expect({
      phase: phaseOf(w, CLUTCH),
      nodule: sourceShot(w, ROOM, NODULE).phase,
      fungus: sourceShot(w, PREDATOR_NEST, FUNGUS).phase,
      husk: sourceShot(w, ROOM, CLUTCH_HUSK).phase,
      population: populationValue(w),
      disturbanceRose: heldDisturbance(w) > before,
    }).toEqual({
      phase: SPENT,
      nodule: DEPLETED,
      fungus: DEPLETED,
      husk: AVAILABLE,
      population: 1,
      disturbanceRose: true,
    });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 태어남은 세계의 것을 먹는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 태어남은 세계의 것을 먹는다', () => {
  it('S-121 먹힌 원천이 **캔 것과 같은 State** 가 된다 — 원인만 다르다', () => {
    // Given 뿌리혹을 손으로 캐 바닥낸 세계 (대조군)
    const mined = inSeason(STILL, ROOM, besideIn(ROOM, pointOf(ROOM, NODULE)), {
      actorItems: { pickaxe: 9 },
      ...capped, // 아무것도 태어나지 않는 세계 — 캔 것 말고는 원인이 없다
    });
    expect({ ...mineOnce(mined, NODULE) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const byHand = sourceShot(mined, ROOM, NODULE);
    expect({ phase: byHand.phase }).toEqual({ phase: DEPLETED });

    // When 탄생이 그것을 먹는다
    const w = atClutch();
    const { at } = runToLeaveBinding(w, CLUTCH);
    const byBirth = at.sources[NODULE]!;
    // Then 다 캔 것과 같은 State 이고 되돌아옴이 0 에서 시작한다
    expect({ phase: byBirth.phase, taken: byBirth.taken, progress: byBirth.progress }).toEqual({
      phase: byHand.phase,
      taken: byHand.taken,
      progress: 0,
    });
  }, 60_000);

  it('S-122 (경계 ③) 다른 방의 원천도 같은 규칙으로 먹힌다 — 균사는 둥지의 것이다', () => {
    // Given 관찰자는 거목의 방에 있고 균사는 둥지의 방에 있다
    const w = atClutch();
    expect({ fungus: sourceShot(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: AVAILABLE });
    // When 태어난다
    const { at } = runToLeaveBinding(w, CLUTCH);
    // Then 다른 방의 균사도 캔 것과 같은 State 다
    expect({ phase: at.sources[FUNGUS]!.phase, progress: at.sources[FUNGUS]!.progress }).toEqual({
      phase: DEPLETED,
      progress: 0,
    });
  }, 60_000);

  it('S-123 고갈된 뿌리혹에 매달린 것의 되돌아옴이 멎는다 — 그 코드는 C013 의 것 그대로다', () => {
    // Given 세계가 엮어 둔 매달림 — 이름을 손으로 적지 않는다
    const hung = hangingOn(NODULE);
    // Given 그 원천 곁에 곡괭이를 들고 선 세계 (거목의 방은 아무도 보지 않는다)
    const w = inSeason(STILL, hung.region, besideIn(hung.region, pointOf(hung.region, hung.id)), {
      actorItems: { pickaxe: 9 },
    });
    // When 탄생이 일어난다
    runUntil(w, () => phaseOf(w, CLUTCH) === SPENT, 200, '알집이 태어나 머무는 자리로 가는 것');
    expect({ nodule: sourceShot(w, ROOM, NODULE).phase }).toEqual({ nodule: DEPLETED });
    // Then 매달린 것에 **되돌아옴이 멎었다**가 걸린다 (새 코드를 만들지 않는다)
    const seen = sourceEntity(w.observe(), hung.id);
    expect({ id: hung.id, standing: seen !== undefined }).toEqual({ id: hung.id, standing: true });
    expect({ id: hung.id, stalled: (seen!.conditions ?? []).includes(RECOVERY_STALLED) }).toEqual({
      id: hung.id,
      stalled: true,
    });

    // And 캐 놓으면 되돌아옴의 진행이 한 톨도 오르지 않는다
    for (let i = 0; i < 9 && sourceShot(w, hung.region, hung.id).phase === AVAILABLE; i++) {
      mineOnce(w, hung.id);
    }
    const justMined = sourceShot(w, hung.region, hung.id);
    expect({ id: hung.id, phase: justMined.phase }).toEqual({ id: hung.id, phase: DEPLETED });
    wait(w, 100);
    expect({ ...sourceShot(w, hung.region, hung.id), id: hung.id }).toEqual({
      ...justMined,
      id: hung.id,
    });

    // And 대조 — 아무것도 태어나지 않는 세계에서는 같은 만큼 기다리면 진행이 오른다
    const control = inSeason(STILL, hung.region, besideIn(hung.region, pointOf(hung.region, hung.id)), {
      actorItems: { pickaxe: 9 },
      ...capped,
    });
    for (let i = 0; i < 9 && sourceShot(control, hung.region, hung.id).phase === AVAILABLE; i++) {
      mineOnce(control, hung.id);
    }
    wait(control, 100);
    const moved = sourceShot(control, hung.region, hung.id);
    expect({
      id: hung.id,
      moved: moved.phase === AVAILABLE || moved.progress > justMined.progress,
    }).toEqual({ id: hung.id, moved: true });
  }, 120_000);

  it('S-124 (경계 ①) 되돌아옴의 길이는 그 원천 데이터 그대로다 — 탄생이 그 값을 바꾸지 않는다', () => {
    // Given 세계가 아는 뿌리혹의 되돌아오는 길이 (데이터가 소유한다)
    const nodule = sourcesInRegion(ROOM).find((s) => s.id === NODULE);
    expect({ known: nodule !== undefined }).toEqual({ known: true });
    const recovery = nodule!.recoverySeconds;
    expect({ positive: recovery > 0 }).toEqual({ positive: true });

    // When 탄생이 뿌리혹을 먹는다 (관찰자는 거목의 방에 있다)
    const w = atClutch();
    const { at } = runToLeaveBinding(w, CLUTCH);
    const eaten = at.time;
    expect({ phase: sourceShot(w, ROOM, NODULE).phase }).toEqual({ phase: DEPLETED });
    // Then 되돌아옴에 걸리는 세계 초가 **손으로 캤을 때와 한 값도 다르지 않다**.
    //
    // 데이터의 값(180)을 그대로 견주지 않는 이유는 하나다 — 탄생은 뿌리혹과 균사를 **같은
    // tick 에** 먹는데, 뿌리혹은 균사에 매달려 있으므로(C014 의 사슬) 균사가 돌아올 때까지
    // 뿌리혹의 되돌아옴이 멎는다. 그것은 C013·C014 가 이미 세운 규칙이고 탄생이 만든 것이
    // 아니다. 이 경계가 말하려는 것은 "탄생이 그 값을 바꾸지 않는다" 이므로, 같은 둘을
    // **손으로 캔** 세계와 견주는 것이 그 문장을 그대로 재는 길이다.
    runUntil(
      w,
      () => sourceShot(w, ROOM, NODULE).phase === AVAILABLE,
      recovery * 6,
      '먹힌 뿌리혹이 되돌아오는 것',
    );
    const bornElapsed = worldTime(w) - eaten;

    // 대조 — 아무것도 태어나지 않는 세계에서 **같은 둘이 같은 순간에** 바닥나 있다
    // (손잡이가 세우는 State 는 캐서 닿는 그것과 같다 — C012 가 세운 규율)
    const hand = inSeason(STILL, ROOM, clutchAt(), {
      ...capped,
      sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED },
    });
    const handEaten = worldTime(hand);
    expect({ phase: sourceShot(hand, ROOM, NODULE).phase }).toEqual({ phase: DEPLETED });
    runUntil(
      hand,
      () => sourceShot(hand, ROOM, NODULE).phase === AVAILABLE,
      recovery * 6,
      '캐어 바닥난 뿌리혹이 되돌아오는 것',
    );
    expect({ elapsed: bornElapsed }).toEqual({ elapsed: worldTime(hand) - handEaten });
    // And 그 길이는 데이터의 값보다 짧지 않다 (데이터가 여전히 그 값을 소유한다)
    expect({ atLeast: bornElapsed >= recovery }).toEqual({ atLeast: true });
    // And 돌아온 자리는 캔 뒤 돌아온 자리와 같다
    expect({ after: sourceShot(w, ROOM, NODULE) }).toEqual({
      after: { id: NODULE, phase: AVAILABLE, taken: 0, progress: 0 },
    });
  }, 60_000);

  it('S-125 (경계 ②) 밝히지 않은 원천은 한 값도 달라지지 않는다', () => {
    // Given 태어나는 세계와, 아무것도 태어나지 않는 대조 세계 (개체군이 상한이다)
    //
    // 견주는 자리를 "같은 세계의 앞 tick" 이 아니라 **같은 만큼 굴린 대조 세계**로 둔 것은,
    // 되돌아오는 중인 원천과 물길을 탄 원천이 어느 tick 에나 스스로 움직이기 때문이다
    // (C013 · C014). 탄생이 원인인 것만 갈라 보려면 시간이 같아야 한다.
    const w = atClutch();
    const control = inSeason(STILL, ROOM, clutchAt(), capped);
    const everySource = REGION_SPECS.flatMap((spec) =>
      sourcesInRegion(spec.id).map((s) => ({ region: spec.id, id: s.id })),
    );
    const shotAll = (d: WorldDriver) =>
      everySource.map((one) => ({ region: one.region, ...sourceShot(d, one.region, one.id) }));

    // When 태어나는 그 tick 을 지나고, 대조 세계도 그만큼 굴린다
    const { elapsed } = runToLeaveBinding(w, CLUTCH);
    wait(control, elapsed);

    // Then 밝힌 것 셋(먹은 둘 · 세운 하나) 말고는 한 값도 달라지지 않았다
    const touched = new Set([NODULE, FUNGUS, CLUTCH_HUSK]);
    expect(shotAll(w).filter((one) => !touched.has(one.id))).toEqual(
      shotAll(control).filter((one) => !touched.has(one.id)),
    );
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 알집은 터진 채 남았다가 되돌아온다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 알집은 터진 채 남았다가 되돌아온다', () => {
  it('S-131 BORN 은 한 tick 이고 곧 SPENT 가 된다', () => {
    const w = atClutch();
    const { at } = runToLeaveBinding(w, CLUTCH);
    // Then 그 tick 의 phase 는 BORN 이고 진행은 0 이다
    expect({ phase: at.phase, progress: at.progress }).toEqual({ phase: BORN, progress: 0 });
    // And 실리는 state 도 그 값의 소문자다
    expect({ state: seenSite(w, CLUTCH).state }).toEqual({ state: BORN.toLowerCase() });
    // When 한 tick 이 더 돈다
    w.tick(1);
    // Then SPENT 다 — BORN 은 한 tick 뿐이다
    expect({ phase: phaseOf(w, CLUTCH), state: seenSite(w, CLUTCH).state }).toEqual({
      phase: SPENT,
      state: SPENT.toLowerCase(),
    });
  }, 60_000);

  it('S-132 SPENT 는 120 세계 초 머문 뒤 DORMANT 로 돌아가며 진행이 0 이 된다', () => {
    // Given 손잡이로 터진 자리를 세운 세계 (요구 넷은 다 차 있다)
    const w = atClutch({ lifeSitePhases: { [CLUTCH]: 'spent' } });
    w.tick(1);
    expect({ phase: phaseOf(w, CLUTCH) }).toEqual({ phase: SPENT });
    // When 머무는 길이에 못 미치는 만큼 굴린다
    wait(w, SPENT_SECONDS - 10 - worldTime(w));
    expect({ phase: phaseOf(w, CLUTCH), rising: progressOf(w, CLUTCH) > 0 }).toEqual({
      phase: SPENT,
      rising: true,
    });
    // Then 120 세계 초가 지나면 DORMANT 로 돌아가고 진행이 0 이다
    wait(w, 20);
    expect({ phase: phaseOf(w, CLUTCH), progress: progressOf(w, CLUTCH) }).toEqual({
      phase: DORMANT,
      progress: 0,
    });
  }, 60_000);

  it('S-133 (경계 ①) SPENT 인 동안에는 요구가 다 차 있어도 결속이 오르지 않는다', () => {
    // Given 터진 자리로 세운 세계 — 요구 넷은 다 차 있다 (고요의 첫 비 · 개체군 0)
    const w = atClutch({ lifeSitePhases: { [CLUTCH]: 'spent' } });
    w.tick(1);
    expect({ phase: phaseOf(w, CLUTCH), missing: missingCodes(w, CLUTCH) }).toEqual({
      phase: SPENT,
      missing: [],
    });
    // When 결속의 길이보다 오래 굴린다 (그러나 머무는 길이보다는 짧게)
    wait(w, BINDING_SECONDS + 10);
    // Then 여전히 SPENT 다 — 결속이 서지도 오르지도 않았다
    expect({ phase: phaseOf(w, CLUTCH) }).toEqual({ phase: SPENT });
    // And 원천도 개체군도 한 값 달라지지 않았다 (SPENT 는 아무것도 먹지 않는다)
    expect({
      nodule: sourceShot(w, ROOM, NODULE).phase,
      husk: sourceShot(w, ROOM, CLUTCH_HUSK).phase,
      population: populationValue(w),
    }).toEqual({ nodule: AVAILABLE, husk: DEPLETED, population: 0 });
  }, 60_000);

  it('S-134 (경계 ②) DORMANT 로 돌아온 뒤에도 개체군이 있으면 결속은 서지 않는다', () => {
    // Given 실제로 한 번 태어난 세계
    const w = atClutch();
    runUntil(w, () => phaseOf(w, CLUTCH) === SPENT, 200, '알집이 터지는 것');
    expect({ population: populationValue(w) }).toEqual({ population: 1 });
    // When 머무는 길이가 지나 DORMANT 로 돌아온다
    runUntil(w, () => phaseOf(w, CLUTCH) === DORMANT, SPENT_SECONDS + 30, '알집이 되돌아오는 것');
    // Then 요구가 그것을 막는다 — 모자란 것이 하나 걸려 있다
    expect({ missing: missingCodes(w, CLUTCH).length > 0 }).toEqual({ missing: true });
    // And 하루를 더 굴려도 결속이 서지 않는다
    wait(w, DAY_TOTAL, 5);
    expect({ phase: phaseOf(w, CLUTCH), progress: progressOf(w, CLUTCH) }).toEqual({
      phase: DORMANT,
      progress: 0,
    });
  }, 120_000);

  it('S-135 (경계 ③) phase 와 진행은 저장된다 — 세계를 다시 세워도 그대로다', () => {
    // Given 얼마쯤 머문 터진 자리
    const w = atClutch({ lifeSitePhases: { [CLUTCH]: 'spent' } });
    wait(w, 30);
    const before = { phase: phaseOf(w, CLUTCH), progress: progressOf(w, CLUTCH) };
    expect({ phase: before.phase, rising: before.progress > 0 }).toEqual({
      phase: SPENT,
      rising: true,
    });
    // When 파일을 지나 저장하고 되살린다 (persistence.spec 의 그 길)
    const stored = throughFile(w.world.snapshot());
    const storedSite = (
      (stored.state as WorldState).regionStates[ROOM] as unknown as {
        lifeSites?: Record<string, LifeSiteShape>;
      }
    )?.lifeSites?.[CLUTCH];
    expect({ stored: storedSite }).toEqual({ stored: before });
    // Then 되살린 세계가 그 값을 그대로 잇고 이어서 돈다
    const again = revive(w);
    expect({ phase: phaseOf(again, CLUTCH), progress: progressOf(again, CLUTCH) }).toEqual(before);
    runUntil(
      again,
      () => phaseOf(again, CLUTCH) === DORMANT,
      SPENT_SECONDS + 30,
      '되살린 세계에서 터진 자리가 되돌아오는 것',
    );
    expect({ progress: progressOf(again, CLUTCH) }).toEqual({ progress: 0 });
  }, 60_000);

  it('S-136 아무도 보고 있지 않아도 한 바퀴가 돈다', () => {
    // Given 관찰자는 백왕령에 있다
    const w = inSeason(STILL, WHITE_KING_DOMAIN);
    const seen: string[] = [phaseOf(w, CLUTCH)];
    // When 한 바퀴가 돌고도 남을 만큼 굴린다
    for (let s = 0; s < BINDING_SECONDS + SPENT_SECONDS + 30; s++) {
      w.tick(1);
      const now = phaseOf(w, CLUTCH);
      if (now !== seen[seen.length - 1]) seen.push(now);
    }
    // Then phase 넷을 차례대로 돌아 DORMANT 로 돌아왔다
    expect({ seen }).toEqual({ seen: [BINDING, BORN, SPENT, DORMANT] });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 남은 것이 재료가 된다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 남은 것이 재료가 된다', () => {
  it('S-141 (경계 ①) 세계가 설 때 그 원천 둘은 거기 없다 — 캐기가 걸리되 사유가 그것을 말한다', () => {
    for (const husk of HUSKS) {
      // Given 그 자리 곁에 곡괭이를 들고 선, 갓 선 세계
      const w = inSeason(STILL, ROOM, besideIn(ROOM, pointOf(ROOM, husk)), {
        actorItems: { pickaxe: 1 },
      });
      // Then 처음은 고갈이다
      expect({ husk, phase: sourceShot(w, ROOM, husk).phase }).toEqual({ husk, phase: DEPLETED });
      // And 캐기가 판에 걸리되 가용하지 않고 사유가 실린다
      const asked = mineOn(w.observe(), husk);
      expect({ husk, standing: asked !== undefined }).toEqual({ husk, standing: true });
      expect({ husk, available: asked!.available }).toEqual({ husk, available: false });
      expect({ husk, empty: asked!.reason === '' || asked!.reason === undefined }).toEqual({
        husk,
        empty: false,
      });
      // And 요청해도 거절된다
      expect({ husk, status: mine(w, husk).status }).toEqual({ husk, status: 'failure' });
      // And 그 원천에 "아직 그때가 아니다" 가 걸린다 — C014 · C018 의 그 코드 그대로다
      const seen = sourceEntity(w.observe(), husk);
      expect({ husk, unmet: (seen?.conditions ?? []).includes(CONDITION_UNMET) }).toEqual({
        husk,
        unmet: true,
      });
    }
  }, 60_000);

  it('S-142 (경계 ②) 세계 시간이 아무리 흘러도 스스로 돌아오지 않는다', () => {
    // Given 아무것도 태어나지 않는 세계 (개체군이 상한이다)
    const w = inSeason(STILL, ROOM, clutchAt(), capped);
    // When 하루를 훌쩍 넘겨 굴린다
    wait(w, DAY_TOTAL * 2, 5);
    // Then 둘 다 여전히 고갈이고 되돌아옴의 진행이 한 톨도 오르지 않았다
    for (const husk of HUSKS) {
      const held = sourceShot(w, ROOM, husk);
      expect({ husk, phase: held.phase, progress: held.progress }).toEqual({
        husk,
        phase: DEPLETED,
        progress: 0,
      });
      // And 캐기가 가용해지지도 않는다
      expect({ husk, available: mineOn(w.observe(), husk)?.available === true }).toEqual({
        husk,
        available: false,
      });
    }
  }, 120_000);

  it('S-143 탄생이 세우고, 한 번 캐면 다시 고갈된다', () => {
    // Given 빈 껍질의 자리 곁에 곡괭이를 들고 선 세계
    const w = inSeason(STILL, ROOM, besideIn(ROOM, pointOf(ROOM, CLUTCH_HUSK)), {
      actorItems: { pickaxe: 9 },
    });
    // When 탄생이 일어난다
    runUntil(w, () => phaseOf(w, CLUTCH) === SPENT, 200, '알집이 터지는 것');
    // Then 그 자리에 서고 캘 수 있다
    expect({ ...sourceShot(w, ROOM, CLUTCH_HUSK) }).toEqual({
      id: CLUTCH_HUSK,
      phase: AVAILABLE,
      taken: 0,
      progress: 0,
    });
    expect({ available: mineOn(w.observe(), CLUTCH_HUSK)?.available }).toEqual({ available: true });
    // When 한 번 캔다
    expect({ ...mineOnce(w, CLUTCH_HUSK) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    // Then 다시 고갈이다 — 한 번 캐는 원천이다
    expect({ phase: sourceShot(w, ROOM, CLUTCH_HUSK).phase }).toEqual({ phase: DEPLETED });
    // And 세계 시간이 흘러도 돌아오지 않는다
    wait(w, DAY_TOTAL, 5);
    expect({ phase: sourceShot(w, ROOM, CLUTCH_HUSK).phase, progress: sourceShot(w, ROOM, CLUTCH_HUSK).progress }).toEqual({
      phase: DEPLETED,
      progress: 0,
    });
  }, 120_000);

  it('S-144 되돌리는 것은 시간이 아니라 **다음 탄생**이다', () => {
    // Given 작은 껍질의 자리 곁에 곡괭이를 들고 선 세계 — 개체군이 하나라 계승이 잇는다
    const w = inSeason(LONG_NIGHT, ROOM, besideIn(ROOM, pointOf(ROOM, EGG_HUSK)), {
      actorItems: { pickaxe: 9 },
      populations: { [POPULATION]: 1 },
    });
    // When 첫 계승이 일어나고 그것을 캔다
    runUntil(w, () => sourceShot(w, ROOM, EGG_HUSK).phase === AVAILABLE, 300, '첫 계승이 껍질을 세우는 것');
    expect({ ...mineOnce(w, EGG_HUSK) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect({ phase: sourceShot(w, ROOM, EGG_HUSK).phase }).toEqual({ phase: DEPLETED });
    // Then 다음 탄생이 그것을 다시 세운다
    runUntil(
      w,
      () => sourceShot(w, ROOM, EGG_HUSK).phase === AVAILABLE,
      900,
      '다음 계승이 껍질을 다시 세우는 것',
    );
    expect({ ...sourceShot(w, ROOM, EGG_HUSK) }).toEqual({
      id: EGG_HUSK,
      phase: AVAILABLE,
      taken: 0,
      progress: 0,
    });
  }, 120_000);

  it('S-145 (경계 ③) 그 자락은 SPENT 가 아닌 동안에는 서지 않는다', () => {
    const at = pointOf(ROOM, CLUTCH_HUSK);
    // Given 같은 자리를 phase 셋으로 세운 세계들
    const dormant = atClutch({ populations: { [POPULATION]: 1 } });
    const binding = atClutch();
    const spent = atClutch({ lifeSitePhases: { [CLUTCH]: 'spent' } });
    for (const one of [dormant, binding, spent]) one.tick(1);
    expect({
      dormant: phaseOf(dormant, CLUTCH),
      binding: phaseOf(binding, CLUTCH),
      spent: phaseOf(spent, CLUTCH),
    }).toEqual({ dormant: DORMANT, binding: BINDING, spent: SPENT });

    const strengthAt = (w: WorldDriver, spot: XZ) =>
      traceStrengthAt(statesOf(w) as never, ROOM, spot);
    /**
     * **자락이 어디에 서는지는 데이터가 소유한다** (C011 R3) — 그래서 자리를 짚지 않고
     * 그 방을 훑어 "SPENT 인 동안에만 달라지는 자리가 있는가" 를 잰다. 껍질이 선 자리의
     * 값은 견주기 좋게 함께 적는다.
     */
    const sweep = walkableSpots(ROOM).filter((_, i) => i % 7 === 0);
    const differs = (a: WorldDriver, b: WorldDriver) =>
      sweep.filter((spot) => strengthAt(a, spot) !== strengthAt(b, spot)).length;
    expect({
      spentDiffersFromDormant: differs(spent, dormant) > 0,
      spentDiffersFromBinding: differs(spent, binding) > 0,
      atHusk: {
        dormant: strengthAt(dormant, at),
        binding: strengthAt(binding, at),
        spent: strengthAt(spent, at),
      },
    }).toEqual({
      spentDiffersFromDormant: true,
      spentDiffersFromBinding: true,
      atHusk: {
        dormant: strengthAt(dormant, at),
        binding: strengthAt(binding, at),
        spent: strengthAt(spent, at),
      },
    });
    // And 그 방의 바닥 흔적은 셋이 다 같다 (달라지는 것은 그 둘레뿐이다)
    const floor = (w: WorldDriver) => strengthAt(w, awayFromClutch());
    expect({ binding: floor(binding), spent: floor(spent) }).toEqual({
      binding: floor(dormant),
      spent: floor(dormant),
    });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 개체군 값이 오르고 상한에서 멈춘다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 개체군 값이 오르고 상한에서 멈춘다', () => {
  it('S-151 탄생 하나가 값을 1 올린다', () => {
    const w = atClutch();
    expect({ value: populationValue(w) }).toEqual({ value: 0 });
    const { before, at } = runToLeaveBinding(w, CLUTCH);
    expect({ value: at.population }).toEqual({ value: before.population + 1 });
  }, 60_000);

  it('S-152 값은 상한을 넘지 않는다 — 상한에 닿으면 탄생이 멎는다', () => {
    // Given 개체군 하나로 시작하는 세계 — 계승이 알집 없이 잇는다 (비도 균사도 묻지 않는다)
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } });
    // When 값이 상한에 닿을 때까지 굴린다
    runUntil(w, () => populationValue(w) >= POPULATION_SCALE, 3000, '개체군 값이 상한에 닿는 것');
    expect({ value: populationValue(w) }).toEqual({ value: POPULATION_SCALE });
    // Then 더 굴려도 넘지 않는다 — 값을 올릴 수 없는 전이는 일어나지 않는다
    wait(w, INHERIT_SECONDS * 4, 5);
    expect({ value: populationValue(w) }).toEqual({ value: POPULATION_SCALE });
  }, 180_000);

  it('S-153 (경계 ①) 값 자체는 관찰 결과에 실리지 않는다 — 떼의 자락이 그것을 보인다', () => {
    for (let value = 0; value <= POPULATION_SCALE; value++) {
      const w = inSeason(STILL, ROOM, clutchAt(), { populations: { [POPULATION]: value } });
      // Then 봉투 어디에도 개체군의 이름이 그대로 실리지 않는다
      //
      // **글자가 든 것을 세지 않고 값이 그것인 자리를 센다** — 이 방의 껍질이 내는 재료 코드가
      // 개체군의 이름을 부분 문자열로 품기 때문이다 (같은 것의 이름을 나눠 쓰는 어법).
      expect({ value, leaked: carriesExactly(w.observe(), POPULATION) }).toEqual({
        value,
        leaked: false,
      });
      // And 대신 자락의 수가 값 그대로다
      expect({ value, areas: herdAreas(w).length }).toEqual({ value, areas: value });
    }
  }, 60_000);

  it('S-154 (경계 ②) 값은 저장된다', () => {
    // Given 한 번 태어나 값이 오른 세계
    const w = atClutch();
    runUntil(w, () => populationValue(w) === 1, 200, '개체군 값이 오르는 것');
    // When 파일을 지나 저장하고 되살린다
    const stored = throughFile(w.world.snapshot());
    const storedPop = (
      (stored.state as WorldState).regionStates[ROOM] as unknown as {
        populations?: Record<string, { value: number }>;
      }
    )?.populations?.[POPULATION];
    expect({ stored: storedPop?.value }).toEqual({ stored: 1 });
    // Then 되살린 세계도 그 값이다
    expect({ value: populationValue(revive(w)) }).toEqual({ value: 1 });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 떼가 돌고 방이 술렁인다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 떼가 돌고 방이 술렁인다', () => {
  it('S-161 값만큼의 자락이 앞에서부터 선다 — 값이 오를수록 넓어진다', () => {
    const seen: string[][] = [];
    for (let value = 0; value <= POPULATION_SCALE; value++) {
      const w = inSeason(STILL, ROOM, clutchAt(), { populations: { [POPULATION]: value } });
      seen.push(herdAreas(w));
    }
    // Then 값 0 이면 하나도 서지 않는다
    expect({ zero: seen[0] }).toEqual({ zero: [] });
    // And 값마다 하나씩 는다
    expect({ counts: seen.map((one) => one.length) }).toEqual({ counts: [0, 1, 2, 3, 4] });
    // And 앞에서부터 선다 — 앞의 것이 뒤의 것에 그대로 들어 있다
    for (let value = 1; value <= POPULATION_SCALE; value++) {
      expect({ value, prefix: seen[value]!.slice(0, value - 1) }).toEqual({
        value,
        prefix: seen[value - 1],
      });
    }
    // And 넷이 서로 다른 이름이다
    expect({ distinct: new Set(seen[POPULATION_SCALE]).size }).toEqual({
      distinct: POPULATION_SCALE,
    });
  }, 60_000);

  it('S-162 (경계 ③) 다른 방에는 떼가 서지 않는다', () => {
    for (const spec of REGION_SPECS.filter((s) => s.id !== ROOM)) {
      const w = inSeason(STILL, spec.id, undefined, capped);
      expect({ region: spec.id, areas: herdAreas(w) }).toEqual({ region: spec.id, areas: [] });
    }
  }, 120_000);

  it('S-163 탄생 하나가 그 방의 소란을 올린다 — 그것만으로는 방이 깨어나지 않는다', () => {
    const w = atClutch();
    const before = seenDisturbance(w);
    expect({ phase: before.phase }).toEqual({ phase: 'dormant' });
    const { at } = runToLeaveBinding(w, CLUTCH);
    const after = seenDisturbance(w);
    // Then 그 tick 에 값이 오른다
    expect({ rose: after.value > before.value, at: at.disturbance }).toEqual({
      rose: true,
      at: at.disturbance,
    });
    // And 임계에는 한참 못 미친다 — 탄생만으로 방이 깨어나지 않는다 (경계 ① · C017 의 규칙 그대로)
    expect({ under: after.value < after.threshold, phase: after.phase }).toEqual({
      under: true,
      phase: 'dormant',
    });
  }, 60_000);

  it('S-164 (경계 ②) 떼의 자락은 땅도 통행 격자도 hash 도 바꾸지 않는다', () => {
    const hash = descriptionHash(spaceOf(ROOM));
    const sample = walkableSpots(ROOM).filter((_, i) => i % 211 === 0).slice(0, 5);
    for (let value = 0; value <= POPULATION_SCALE; value++) {
      const w = inSeason(STILL, ROOM, clutchAt(), { populations: { [POPULATION]: value } });
      expect({ value, id: w.observe().region.id, hash: w.observe().region.hash }).toEqual({
        value,
        id: ROOM,
        hash,
      });
      for (const at of sample) {
        expect({ value, spot: [at.x, at.z], accepted: move(w, at).status === 'success' }).toEqual({
          value,
          spot: [at.x, at.z],
          accepted: true,
        });
      }
    }
    expect(surfaceCounts(ROOM)).toEqual(TREE_ROOM_GROUND.surface);
    expect(walkableSpots(ROOM).length).toBe(TREE_ROOM_GROUND.traversable);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 개체군이 있으면 알집 없이 뿌리의 알이 잇는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 개체군이 있으면 알집 없이 뿌리의 알이 잇는다', () => {
  it('S-171 뿌리의 알이 뿌리 곡선의 **다른 마디**에 선다', () => {
    const w = inSeason(STILL, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } });
    const seen = seenSite(w, EGGS);
    // Then 존재 하나로 실린다 — 역할은 탄생지다
    expect({ id: seen.id, role: seen.role }).toEqual({ id: EGGS, role: 'life-site' });
    // And 자리는 뿌리 곡선 위이고 알집과 다른 마디다 (State 표 · 기본형 ①)
    const root = curvesOf(spaceOf(ROOM), PRESENCE_LAYER, ROOT_CURVE_TAG);
    expect({ rootCurve: root.length > 0 }).toEqual({ rootCurve: true });
    const offCurve = nearestCurveDistance(root, eggsAt().x, eggsAt().z);
    expect({ offCurve: offCurve <= 3, measured: offCurve }).toEqual({
      offCurve: true,
      measured: offCurve,
    });
    expect({ apart: distanceBetween(eggsAt(), clutchAt()) > 0 }).toEqual({ apart: true });
    // And 걸어 설 수 있는 땅 위다
    expect(isTraversableAt(terrainOf(ROOM), eggsAt().x, eggsAt().z)).toBe(true);
  });

  it('S-172 요구는 둘뿐이고 90 세계 초에 찬다', () => {
    // Given 광식충이 하나 있고 뿌리혹이 선 세계
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } });
    expect({ phase: phaseOf(w, EGGS), missing: missingCodes(w, EGGS) }).toEqual({
      phase: BINDING,
      missing: [],
    });
    expect({ start: progressOf(w, EGGS) }).toEqual({ start: 0 });
    // When 절반의 세계 시간이 흐른다
    wait(w, INHERIT_SECONDS / 2);
    expect(progressOf(w, EGGS)).toBeCloseTo(0.5, 2);

    // Then 처음부터 굴린 세계는 90 세계 초에 차고 그 tick 에 태어난다
    const fresh = inSeason(LONG_NIGHT, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } });
    const { at, elapsed } = runToLeaveBinding(fresh, EGGS);
    expect({ elapsed, phase: at.phase }).toEqual({ elapsed: INHERIT_SECONDS, phase: BORN });
  }, 60_000);

  it('S-173 (경계 ②) 비가 오지 않아도 · 균사가 끊겨도 선다', () => {
    // Given 비가 없는 철(긴 밤)이고 균사도 끊긴 세계
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), {
      populations: { [POPULATION]: 1 },
      sourcePhases: { [FUNGUS]: DEPLETED },
    });
    expect({ fungus: sourceShot(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: DEPLETED });
    // Then 계승은 선다 — 요구는 둘뿐이다
    expect({ phase: phaseOf(w, EGGS), missing: missingCodes(w, EGGS) }).toEqual({
      phase: BINDING,
      missing: [],
    });
    // And 알집은 서지 않는다 (비도 균사도 개체군도 그것을 막는다)
    expect({ clutch: phaseOf(w, CLUTCH) }).toEqual({ clutch: DORMANT });
  });

  it('S-174 먹는 것은 뿌리혹 하나뿐이고 남기는 것은 작은 껍질이다', () => {
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), {
      populations: { [POPULATION]: 1 },
    });
    const { at } = runToLeaveBinding(w, EGGS);
    // Then 뿌리혹만 먹혔다 — 균사는 한 값도 달라지지 않는다 (결속은 둘을 먹는다)
    expect({
      nodule: at.sources[NODULE]!.phase,
      fungus: at.sources[FUNGUS]!.phase,
    }).toEqual({ nodule: DEPLETED, fungus: AVAILABLE });
    // And 작은 껍질이 서고 빈 껍질은 서지 않는다
    expect({
      egg: at.sources[EGG_HUSK]!.phase,
      clutch: at.sources[CLUTCH_HUSK]!.phase,
    }).toEqual({ egg: AVAILABLE, clutch: DEPLETED });
    // And 개체군 값이 오른다
    expect({ population: at.population }).toEqual({ population: 2 });
  }, 60_000);

  it('S-175 (경계 ①) 개체군이 0 이면 서지 않는다 — 그때는 결속이 선다', () => {
    const w = atClutch();
    expect({ population: populationValue(w) }).toEqual({ population: 0 });
    // Then 계승은 서지 않고 모자란 것이 걸린다
    expect({ eggs: phaseOf(w, EGGS), missing: missingCodes(w, EGGS).length > 0 }).toEqual({
      eggs: DORMANT,
      missing: true,
    });
    // And 그때 서는 것은 결속이다 — 둘이 겹치지 않는다
    expect({ clutch: phaseOf(w, CLUTCH) }).toEqual({ clutch: BINDING });
  });

  it('S-176 (경계 ③) 뿌리혹이 고갈된 동안에는 서지 않고 그 사유가 걸린다', () => {
    const w = inSeason(LONG_NIGHT, ROOM, eggsAt(), {
      populations: { [POPULATION]: 1 },
      sourcePhases: { [NODULE]: DEPLETED },
    });
    expect({ nodule: sourceShot(w, ROOM, NODULE).phase }).toEqual({ nodule: DEPLETED });
    // Then 계승이 서지 않고 코드 하나가 걸린다
    expect({ phase: phaseOf(w, EGGS), count: missingCodes(w, EGGS).length }).toEqual({
      phase: DORMANT,
      count: 1,
    });
    // And 그 코드는 개체군이 모자랄 때의 코드와 다르다 (무엇이 모자란지가 갈린다)
    const noPopulation = missingCodes(atClutch(), EGGS);
    expect({ count: noPopulation.length }).toEqual({ count: 1 });
    expect({ same: noPopulation[0] === missingCodes(w, EGGS)[0] }).toEqual({ same: false });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 결속과 계승이 눈으로 갈린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-008 결속과 계승이 눈으로 갈린다', () => {
  it('S-181 둘은 다른 이름 · 다른 종류 · 다른 자리다', () => {
    const w = inSeason(STILL, ROOM, clutchAt());
    const clutch = seenSite(w, CLUTCH);
    const eggs = seenSite(w, EGGS);
    // Then 이름이 다르다
    expect({ same: clutch.id === eggs.id }).toEqual({ same: false });
    // And 종류(자연 형태 코드)가 다르고, 둘 다 id 를 그대로 쓰지 않는다
    expect({
      sameKind: clutch.kind === eggs.kind,
      clutchIsId: clutch.kind === CLUTCH,
      eggsIsId: eggs.kind === EGGS,
      empty: clutch.kind === '' || eggs.kind === '',
    }).toEqual({ sameKind: false, clutchIsId: false, eggsIsId: false, empty: false });
    // And 자리가 다르다
    expect({ apart: distanceBetween(clutchAt(), eggsAt()) > 0 }).toEqual({ apart: true });
  });

  it('S-182 지목하면 모자란 것의 목록이 다르다', () => {
    // Given 개체군이 0 인 세계 — 결속은 서고 계승은 서지 않는다
    const zero = atClutch();
    expect({ clutch: missingCodes(zero, CLUTCH), eggsMissing: missingCodes(zero, EGGS).length }).toEqual({
      clutch: [],
      eggsMissing: 1,
    });
    // And 개체군이 하나이고 비가 없는 세계 — 계승은 서고 결속은 서지 않는다
    const one = inSeason(LONG_NIGHT, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } });
    expect({ eggs: missingCodes(one, EGGS), clutchMissing: missingCodes(one, CLUTCH).length > 0 }).toEqual({
      eggs: [],
      clutchMissing: true,
    });
    // Then 결속이 모자랄 때의 목록과 계승이 모자랄 때의 목록은 한 코드도 겹치지 않는다
    const clutchCodes = new Set(missingCodes(one, CLUTCH));
    const eggsCodes = new Set(missingCodes(zero, EGGS));
    expect({
      shared: [...eggsCodes].filter((c) => clutchCodes.has(c)),
    }).toEqual({ shared: [] });
  }, 60_000);

  it('S-183 (경계 ①) 둘 다 phase 넷을 같은 차례로 돈다', () => {
    /** 그 탄생지가 도는 차례를 그대로 적어 온다 */
    const cycleOf = (w: WorldDriver, site: string, seconds: number): string[] => {
      const seen: string[] = [phaseOf(w, site)];
      for (let s = 0; s < seconds; s++) {
        w.tick(1);
        const now = phaseOf(w, site);
        if (now !== seen[seen.length - 1]) seen.push(now);
      }
      return seen;
    };
    // Given 결속이 도는 세계와 계승이 도는 세계
    const clutch = cycleOf(atClutch(), CLUTCH, BINDING_SECONDS + SPENT_SECONDS + 30);
    const eggs = cycleOf(
      inSeason(LONG_NIGHT, ROOM, eggsAt(), { populations: { [POPULATION]: 1 } }),
      EGGS,
      INHERIT_SECONDS + SPENT_SECONDS + 30,
    );
    // Then 둘이 같은 차례다 — 방식마다 규칙이 갈리지 않는다
    expect({ clutch }).toEqual({ clutch: [BINDING, BORN, SPENT, DORMANT] });
    expect({ eggs }).toEqual({ eggs: [BINDING, BORN, SPENT, DORMANT] });
    // And 그 차례는 phase 넷의 차례 그대로다
    for (const seen of [clutch, eggs]) {
      expect({ order: seen.map((p) => PHASE_ORDER.indexOf(p)) }).toEqual({ order: [1, 2, 3, 0] });
    }
  }, 120_000);

  it('S-184 (경계 ②) 세계 위에 늘 떠 있는 글자는 하나도 늘지 않는다', () => {
    for (const value of [0, 1, POPULATION_SCALE]) {
      const w = inSeason(STILL, ROOM, clutchAt(), { populations: { [POPULATION]: value } });
      for (const entity of w.observe().entities) {
        expect({ value, id: entity.id, label: (entity as { labelValue?: unknown }).labelValue }).toEqual({
          value,
          id: entity.id,
          label: undefined,
        });
      }
    }
  }, 60_000);

  it.todo(
    'GAP: "다른 그림" — 알집의 BORN · SPENT 외형, 뿌리의 알의 phase 별 외형, 빈 껍질과 작은 껍질의 ' +
      '그림과 문구, 붉은 가루의 색은 관찰 봉투에 실리지 않는다 (세계는 코드만 낸다 · 원칙 2). ' +
      '세계 쪽에서 잰 것은 이름 · 종류 코드 · 자리 · 모자란 것의 목록이 갈린다는 것뿐이다 (S-181 · S-182) — ' +
      '그림이 실제로 갈리는가는 content/view 의 몫이다',
  );

  it.todo(
    'GAP: "규칙은 둘을 **같은 한 규칙**으로 굴린다"(W40 — mode 마다 규칙을 따로 두지 않는다)는 ' +
      '구현의 형태에 대한 말이라 세계 밖에서 잴 수 없다. 여기서 잰 것은 그 결과뿐이다 — ' +
      '둘이 phase 넷을 같은 차례로 돌고(S-183) 같은 어법의 State 를 쓴다는 것',
  );

  it.todo(
    'GAP: 탄생이 올리는 소란의 **눈금(5)** 은 spec 데이터 표가 이름한 값이나 관찰 봉투에는 ' +
      '"그 방의 소란 값" 하나뿐이라 무엇이 얼마를 올렸는지 갈리지 않는다 (C017 이 세운 규율). ' +
      '여기서 잰 것은 "탄생 하나가 올린다 · 임계에 못 미친다" 까지다 (S-163)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — SPEC-009 앞의 세계는 그대로다
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-191 이 Cycle 이 만지지 않는 방 열둘의 hash · 표면 · 통행이 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
      for (const season of SEASONS) {
        expect({ region, season, hash: inSeason(season, region, undefined, capped).observe().region.hash }).toEqual({
          region,
          season,
          hash: base.hash,
        });
      }
    }
  }, 180_000);

  it('S-192 거목의 방의 땅과 통행도 그대로다 — 는 것은 Description 의 자리뿐이다', () => {
    // 이 Cycle 이 데이터를 더하는 방이므로 hash 는 달라도 된다. 땅과 통행은 달라지면 안 된다.
    expect(surfaceCounts(ROOM)).toEqual(TREE_ROOM_GROUND.surface);
    expect(walkableSpots(ROOM).length).toBe(TREE_ROOM_GROUND.traversable);
    // And 한 세계 안에서 hash 는 철 · phase · 개체군 값에 흔들리지 않는다 (덧씌움이지 재컴파일이 아니다)
    const hash = descriptionHash(spaceOf(ROOM));
    const worlds: { at: string; w: WorldDriver }[] = [
      ...SEASONS.map((season) => ({ at: `season/${season}`, w: inSeason(season, ROOM, clutchAt()) })),
      ...(['dormant', 'binding', 'born', 'spent'] as const).map((phase) => ({
        at: `phase/${phase}`,
        w: atClutch({ lifeSitePhases: { [CLUTCH]: phase } }),
      })),
      ...[0, 1, POPULATION_SCALE].map((value) => ({
        at: `population/${value}`,
        w: inSeason(STILL, ROOM, clutchAt(), { populations: { [POPULATION]: value } }),
      })),
    ];
    for (const one of worlds) {
      expect({ at: one.at, id: one.w.observe().region.id, hash: one.w.observe().region.hash }).toEqual({
        at: one.at,
        id: ROOM,
        hash,
      });
    }
  }, 120_000);

  it('S-193 원천 열넷의 처음 phase · 캔 횟수 · 마디 · 둘레 흔적 단계가 그대로다', () => {
    for (const one of SOURCE_BASELINE) {
      // 아무것도 태어나지 않는 세계에서 잰다 — 처음 자리는 t = 0 의 값이다
      const w = inRoom(one.region, undefined, capped);
      const stored = sourceAt(w, one.region, one.id);
      expect({
        region: one.region,
        id: one.id,
        phase: stored.phase,
        taken: stored.taken,
        site: stored.siteIndex ?? 0,
      }).toEqual({
        region: one.region,
        id: one.id,
        phase: one.phase,
        taken: one.taken,
        site: 0,
      });
      expect({
        region: one.region,
        id: one.id,
        trace: traceStrengthAt(statesOf(w) as never, one.region, pointOf(one.region, one.id)),
      }).toEqual({ region: one.region, id: one.id, trace: one.trace });
    }
  }, 180_000);

  it('S-194 (경계) 거목의 방에서 ROOT_NODULE 의 캐기와 되돌아옴이 그대로다', () => {
    const at = besideIn(ROOM, pointOf(ROOM, NODULE));
    const w = inSeason(STILL, ROOM, at, { actorItems: { pickaxe: 1 } });
    expect({ phase: sourceAt(w, ROOM, NODULE).phase }).toEqual({ phase: AVAILABLE });
    // When 한 번 캔다 (harvests 1 — 한 번에 바닥난다)
    expect({ ...mineOnce(w, NODULE) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect({ phase: sourceAt(w, ROOM, NODULE).phase }).toEqual({ phase: DEPLETED });
    // Then 그동안 알집은 조건이 깨져 멎어 있다 (뿌리혹이 없다)
    expect({ site: phaseOf(w, CLUTCH) }).toEqual({ site: DORMANT });
    // When 되돌아옴의 길이(180)를 기다린다
    wait(w, 180);
    const back = sourceAt(w, ROOM, NODULE);
    expect({ phase: back.phase, taken: back.taken, site: back.siteIndex ?? 0 }).toEqual({
      phase: AVAILABLE,
      taken: 0,
      site: 0,
    });
  }, 60_000);

  it('S-195 숲 어귀의 MOLT_LITTER 의 캐기와 되돌아옴이 그대로다', () => {
    const at = besideIn(FOREST_EDGE, pointOf(FOREST_EDGE, MOLT));
    // C024 CHANGED — **광식충을 배속 1 의 자리에 세운다.** C024 부터 허물의 되돌아옴이
    // 벗는 것의 수에 매인다 (C024 SPEC-001): 값이 0 이면 아주 멎고 상한이면 두 배다.
    // 이 회귀가 말하려는 것은 "이 Cycle 이 그 길이를 건드리지 않았다" 이므로, 배속이 1 이
    // 되는 값에 세워 아래의 60 이 데이터 그대로임을 그대로 잰다.
    const w = inSeason(STILL, FOREST_EDGE, at, { actorItems: { pickaxe: 1 }, populations: { [ORE_EATER]: 2 } });
    for (let i = 0; i < 3; i++) {
      expect({ nth: i + 1, ...mineOnce(w, MOLT) }).toEqual({
        nth: i + 1,
        status: 'success',
        rule: 'RULE-MINE-001',
      });
    }
    expect({ phase: sourceAt(w, FOREST_EDGE, MOLT).phase }).toEqual({ phase: DEPLETED });
    // When 되돌아옴의 길이(60)를 기다린다 — 이 Cycle 의 탄생은 그 길이를 건드리지 않는다
    wait(w, 60);
    expect({
      phase: sourceAt(w, FOREST_EDGE, MOLT).phase,
      taken: sourceAt(w, FOREST_EDGE, MOLT).taken,
    }).toEqual({ phase: AVAILABLE, taken: 0 });
  }, 60_000);

  it('S-196 C022 가 세운 결속의 조건 넷이 한 줄도 바뀌지 않았다', () => {
    /**
     * 요구 넷을 하나씩 깨뜨리는 네 가지 세움 — 모두 **t = 0 에서** 잰다.
     * (c022 는 "비가 오지 않는다" 를 고요에서 95 초 기다려 만들었으나, 이 Cycle 에서는 그 사이
     *  60 초에 태어나 버린다. 깨진 요구는 같고 세우는 길만 다르다 — 비 없는 철로 세운다.)
     */
    const breakers: readonly { name: string; build: () => WorldDriver }[] = [
      { name: '뿌리혹이 없다', build: () => atClutch({ sourcePhases: { [NODULE]: DEPLETED } }) },
      { name: '균사가 없다', build: () => atClutch({ sourcePhases: { [FUNGUS]: DEPLETED } }) },
      { name: '비가 오지 않는다', build: () => inSeason(LONG_NIGHT, ROOM, clutchAt()) },
      { name: '광식충이 0 이 아니다', build: () => atClutch({ populations: { [POPULATION]: 1 } }) },
    ];
    const codes = breakers.map((one) => {
      const w = one.build();
      // Then 하나라도 깨지면 그 tick 에 DORMANT 다
      expect({ broken: one.name, phase: phaseOf(w, CLUTCH), state: seenSite(w, CLUTCH).state }).toEqual({
        broken: one.name,
        phase: DORMANT,
        state: DORMANT.toLowerCase(),
      });
      const seen = missingCodes(w, CLUTCH);
      expect({ broken: one.name, count: seen.length }).toEqual({ broken: one.name, count: 1 });
      return { broken: one.name, code: seen[0]! };
    });
    // And 넷이 서로 다른 코드다
    expect({ distinct: new Set(codes.map((c) => c.code)).size, all: codes }).toEqual({
      distinct: 4,
      all: codes,
    });
    // And 넷이 다 차 있으면 BINDING 이고 모자란 것이 없다
    const full = atClutch();
    expect({ phase: phaseOf(full, CLUTCH), missing: missingCodes(full, CLUTCH) }).toEqual({
      phase: BINDING,
      missing: [],
    });
  }, 60_000);

  it('S-197 C022 가 세운 전조 자락이 한 줄도 바뀌지 않았다', () => {
    // Given 결속이 서지 않는 세계와 서는 세계 (둘 다 알집 자리에 선다)
    const quiet = atClutch({ populations: { [POPULATION]: 1 } });
    const bound = atClutch();
    expect({ quiet: phaseOf(quiet, CLUTCH), bound: phaseOf(bound, CLUTCH) }).toEqual({
      quiet: DORMANT,
      bound: BINDING,
    });
    // Then 걸린 것에 코드 하나가 **뒤에 이어 붙는다**
    const before = quiet.observe().standingConditions;
    const after = bound.observe().standingConditions;
    expect({ length: after.length }).toEqual({ length: before.length + 1 });
    expect(after.slice(0, before.length)).toEqual(before);
    const tremor = after[after.length - 1]!;
    expect(before).not.toContain(tremor);
    // And 그 자락 밖에는 실리지 않는다
    const away = awayFromClutch();
    const outside = inSeason(STILL, ROOM, away);
    expect({ phase: phaseOf(outside, CLUTCH) }).toEqual({ phase: BINDING });
    expect([...outside.observe().standingConditions].sort()).toEqual(
      [...conditionTagsAt(ROOM, away)].sort(),
    );
    // And 둘레의 흙이 결속하는 동안 **한 단계** 옅어진다 (두 번 옅어지지 않는다)
    wait(quiet, 1);
    const base = traceStrengthAt(statesOf(quiet) as never, ROOM, clutchAt());
    wait(bound, BINDING_SECONDS * 0.4);
    expect({ when: '결속 앞쪽', trace: traceStrengthAt(statesOf(bound) as never, ROOM, clutchAt()) }).toEqual({
      when: '결속 앞쪽',
      trace: base - 1,
    });
    wait(bound, BINDING_SECONDS * 0.2);
    expect({ when: '결속 뒤쪽', trace: traceStrengthAt(statesOf(bound) as never, ROOM, clutchAt()) }).toEqual({
      when: '결속 뒤쪽',
      trace: base - 1,
    });
  }, 60_000);

  it('S-198 C022 가 세운 비의 눈금이 한 줄도 바뀌지 않았다', () => {
    /**
     * **비는 아무것도 태어나지 않는 세계에서 잰다** — 개체군이 상한이면 결속은 요구(값 0)가
     * 막으므로 알집은 하루를 다 돌아도 한 번도 태어나지 않고, 그때 모자란 코드는 개체군의
     * 것 하나(비가 올 때) 또는 둘(비가 그쳤을 때)이다. 그 차이가 곧 **비의 코드**다.
     * (c022 는 phase 로 쟀으나 이 Cycle 에서는 그 사이 태어나 버린다 — 재는 것은 같다.)
     */
    const rainCodeOf = (): string => {
      const wet = missingCodes(inSeason(STILL, ROOM, clutchAt(), capped), CLUTCH);
      const dry = missingCodes(inSeason(LONG_NIGHT, ROOM, clutchAt(), capped), CLUTCH);
      const only = dry.filter((c) => !wet.includes(c));
      expect({ wet: wet.length, dry: dry.length, only: only.length }).toEqual({
        wet: 1,
        dry: 2,
        only: 1,
      });
      return only[0]!;
    };
    const rainCode = rainCodeOf();

    const DAY_SAMPLES = [5, 95, 185, 265, 350];
    const TURN_SAMPLES = [5, 30, 55];
    for (const season of SEASONS) {
      const samples = season === TURN ? TURN_SAMPLES : DAY_SAMPLES;
      const w = inSeason(season, ROOM, clutchAt(), capped);
      let now = 0;
      for (const offset of samples) {
        wait(w, offset - now);
        now = offset;
        // Then 비의 코드가 걸렸는가는 그 시각에 비가 오는가 그대로다
        expect({ season, offset, dry: missingCodes(w, CLUTCH).includes(rainCode) }).toEqual({
          season,
          offset,
          dry: !rainsAt(season, offset),
        });
      }
    }
  }, 180_000);

  it('S-199 C016 ~ C021 이 세운 철 · 소란 · 상시의 덧씌움이 한 값도 달라지지 않는다', () => {
    for (const [region, before] of Object.entries(PHASES_BASELINE)) {
      expect({ region, phases: regionSpec(region)?.phases }).toEqual({ region, phases: before });
    }
    // And 백왕령 산기슭에서 C021 이 세운 옅어짐이 그대로다
    const ridge = walkableSpots(WHITE_KING_DOMAIN).filter(
      (p) => conditionTagsAt(WHITE_KING_DOMAIN, p).length === 1
        && conditionTagsAt(WHITE_KING_DOMAIN, p)[0] === CONDITION_RIDGE,
    );
    expect({ ridge: ridge.length > 0 }).toEqual({ ridge: true });
    const at = ridge[Math.floor(ridge.length / 2)]!;
    expect(inSeason(STILL, WHITE_KING_DOMAIN, at, capped).observe().standingConditions).toEqual([
      CONDITION_RIDGE,
    ]);
    for (const season of [SEEP, LONG_NIGHT]) {
      expect({
        season,
        seen: inSeason(season, WHITE_KING_DOMAIN, at, capped).observe().standingConditions,
      }).toEqual({
        season,
        seen: [`${CONDITION_WEAK_PREFIX}${CONDITION_RIDGE.slice(CONDITION_PREFIX.length)}`],
      });
    }
  }, 60_000);

  // C024 CHANGED — **밝힌 방이 둘이 되었다** (둥지가 변성지와 거목균을 밝힌다 · C024 SPEC-006).
  // 이 항이 재는 것은 "하나뿐인가" 가 아니라 **밝히지 않은 방에는 자리 자체가 없는가** 이므로
  // (빈 것으로 지어내지 않는다 — C022 SPEC-001 경계 ①), 거목의 방이 이 Cycle 이 세운 둘을
  // 그대로 들고 있는지만 보고 **밝힌 다른 방은 지나간다.**
  it('S-19a 탄생지도 개체군도 밝힌 방에만 선다 — 밝히지 않은 방은 그대로다', () => {
    for (const spec of REGION_SPECS) {
      const w = inRoom(spec.id, undefined, capped);
      const here = statesOf(w)[spec.id] as
        | { lifeSites?: Record<string, unknown>; populations?: Record<string, unknown> }
        | undefined;
      const sites = Object.keys(here?.lifeSites ?? {}).sort();
      const pops = Object.keys(here?.populations ?? {});
      if (spec.id === ROOM) {
        expect({ region: spec.id, sites, pops }).toEqual({
          region: spec.id,
          sites: [...SITES].sort(),
          pops: [POPULATION],
        });
        continue;
      }
      // 뒤의 Cycle 이 밝힌 방 — 그것이 무엇을 세우는지는 그 Cycle 의 시나리오가 잰다
      if (spec.ecology) continue;
      expect({ region: spec.id, sites, pops }).toEqual({ region: spec.id, sites: [], pops: [] });
      expect({
        region: spec.id,
        lifeSites: w.observe().entities.filter((e) => e.role === 'life-site').map((e) => e.id),
      }).toEqual({ region: spec.id, lifeSites: [] });
    }
  }, 180_000);
});
