// C022 — 허물의 주인 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-009)
//
// C011 ~ C021 까지 방이 낳는 것은 **재료**였다 — 캐면 줄고 두면 돌아오는 것. 이 Cycle 에서
// 방이 처음으로 **생명이 될 것**을 품는다. 그래서 여기서 재는 것은 여섯이다:
//   ① 탄생지 — 알집이 거목의 방에 서고, 지목하면 지금 무엇이 모자란지가 읽힌다 (캐기는 걸리지 않는다)
//   ② 자락 — BINDING 동안 그 자리에 선 몸에 코드가 붙고 둘레의 흙이 한 단계 옅어진다
//   ③ 조건 넷 — 뿌리혹 · 균사(다른 방) · 비 · 개체군 0. 하나라도 깨지면 그 tick 에 DORMANT
//   ④ 결속 — 세계 시간으로 60 초에 차고, 깨지면 **멎고 지워지지 않으며**, 다시 차면 이어 오른다
//   ⑤ 비 — 시각과 철에서 유도되고 저장되지 않는다. 긴 밤에는 없다
//   ⑥ 불변 — 앞의 방들의 땅 · hash · 원천 · 흔적 · 철의 덧씌움이 한 값도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// State 를 직접 읽는 자리는 spec 의 State 절이 이름으로 못 박은 둘뿐이다
// (`RegionState.lifeSites[id]` · `RegionState.populations[id]`) — 결속의 진행도 개체군 값도
// 관찰 봉투에 실리지 않기 때문이다 (Observable "투영하지 않는 것").
//
// 이 Cycle 의 새 구현(content/regions/lives.ts · ecology.ts · content/world/semantic/life.ts ·
// rain.ts · simulation/life-binding.ts · content/view/** · engine/world-authoring/check.ts 의
// 새 절 · tools/**)은 **읽지 않았다.** 기대값의 출처는
// cycles/C022-owner-of-the-molt/spec.md 와 이미 있던 하네스·선례(c013 · c016 · c020 · c021 ·
// persistence)뿐이다.
//
// **자리를 손으로 적지 않는다** — 알집의 자리는 관찰 결과의 `position` 에서, 그 곁의 설 자리는
// 컴파일된 통행 격자에서, 원천의 자리는 Description 의 resource point 에서 얻는다. 손으로 적는
// 것은 spec 이 이름으로 못 박은 것(방 · 원천 id 셋 · 탄생지 id · 개체군 id · 결속 60 초 ·
// 하루 360 초 · 비 구간 표)뿐이고, 그것들은 세계에서 유도할 자리가 없다 (c016 · c020 · c021 의 규율).
//
// **조건 코드의 글자도 손으로 적지 않는다** — spec 은 그 이름을 정하지 않았다. 대신 구조로 잰다:
// "요구 넷이 각각 서로 다른 코드를 건다" · "그 조건이 차면 그 코드가 사라진다" · "모자란 것이
// 없으면 conditions 자리 자체가 없다" (SPEC-004 경계 ②).
//
// **회귀의 기준값은 이 Cycle 이 시작하기 전의 세계에서 떠 왔다** — 아홉 방의 값은 C020 · C021 의
// 시나리오가 적어 둔 표 그대로이고, 나머지 넷(폐허 · 나무 속 · 심장 호수 · 거목)은 여기서 처음
// 적는다. 그 아홉이 C021 의 값과 한 글자도 다르지 않다는 것이 나머지 넷도 이 Cycle 이전의
// 것임을 받쳐 준다.
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
import { sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, PLAYER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 데이터 값 표) ──────────────

/** 탄생지 하나 — 붉은 알집 (State 표 · 확정 1) */
const CLUTCH = 'ROOT_CLUTCH';
/** 그 탄생지가 선 방 (State 표 · Play §5.2) */
const ROOM = RED_EYE_TREE;
/** 개체군 하나 — 광식충 (State 표 · 확정 6) */
const POPULATION = 'ORE_EATER';

/** 결속 조건 넷이 가리키는 원천 둘 — 균사는 **다른 방**의 것이다 (SPEC-004) */
const NODULE = 'ROOT_NODULE'; // 거목의 방
const FUNGUS = 'NEST_FUNGUS'; // 둥지의 방 (PREDATOR_NEST)
/** 생명을 전제한 회복 원인이 붙는 원천 (World Change 7 · SPEC-009 회귀) */
const MOLT = 'MOLT_LITTER'; // 숲 어귀

/** 결속의 길이 — 60 세계 초 (확정 5 · State 표) */
const BINDING_SECONDS = 60;
/** 하루 — 360 세계 초 (spec 데이터 · 비 표) */
const DAY_TOTAL = 360;

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/**
 * 하루 안의 비 구간 — spec 의 비 표 그대로 (확정 4 · 기본형 ②).
 * 고요 한 번 · 스밈 두 번 · 긴 밤과 뒤척임에는 없다.
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

/** phase 넷 가운데 이 Cycle 이 오가는 둘 (State 표) */
const DORMANT = 'DORMANT';
const BINDING = 'BINDING';

/** 원천의 phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';

/** 채취의 소요 시간 — 행동표가 소유한다. "넉넉히 지난다" 로만 쓴다 (C011~C021 어법) */
const MINE_SECONDS = 1.2;

// ── 회귀의 기준값 (SPEC-009) ─────────────────────────────────────────

interface RoomBaseline {
  hash: string;
  surface: Readonly<Record<string, number>>;
  traversable: number;
}

/**
 * **이 Cycle 이 만지지 않는 방 열둘** — 아홉은 C021 시나리오의 BASELINE 표에서 그대로 왔고,
 * 셋(폐허 · 나무 속 · 심장 호수)은 여기서 처음 적는다.
 */
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
    hash: '2b6a4c96',
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
    hash: '010d1f16',
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
 * **거목의 방**은 이 Cycle 이 데이터를 더하는 방이다 — 알집의 point 와 전조의 자락이 그 방
 * Description 에 난다 (SPEC-002 "resource layer 의 point 로 서고"). 그래서 hash 는 이 Cycle
 * 이전의 값(`d6561e16`)과 달라도 되고, **땅과 통행은 달라지면 안 된다**: 흔적도 알집도 높이와
 * 표면을 건드리지 않는다 (C011 이 원천을 세울 때 세운 그 규율). hash 는 대신 **한 세계 안에서**
 * 철 · phase · 진행에 흔들리지 않는다는 것으로 잰다 (SPEC-003 경계 ② "덧씌움이지 재컴파일이 아니다").
 */
const TREE_ROOM_GROUND: Omit<RoomBaseline, 'hash'> = {
  surface: { flat: 1681 },
  traversable: 1681,
};

/**
 * 원천 열넷의 **처음 자리** — 이 Cycle 이 시작하기 전의 값 (C011 의 흔적 사다리 · C013 · C014 · C018).
 *
 * 셋(떨어진 비늘 · 사냥의 남은 것 · 강의 앙금)은 **처음부터 고갈로 선다** — 지나가는 것과
 * 물길을 기다리는 자리이기 때문이다 (c021 S-054 가 적어 둔 그 사실). 그래서 그 셋의 둘레
 * 흔적은 데이터의 단계보다 한 단계 옅다 (C012 의 옅어짐 그대로).
 */
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

/** C016 ~ C021 이 세운 덧씌움 — 이 Cycle 은 여기에 한 값도 더하지 않는다 (SPEC-009) */
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

// ── 하네스 (c013 · c016 · c020 · c021 의 선례 그대로) ─────────────────

/**
 * 이 Cycle 이 더하는 검증용 손잡이 둘 — 교집합으로 둔다.
 * (WorldSetup 이 아직 그 자리를 내지 않았어도 이 파일이 서고, 낸 뒤에도 어긋나지 않는다.)
 */
type LifeSetup = WorldSetup & {
  /** 탄생지가 어느 phase 로 서는가 — 예: `{ ROOT_CLUTCH: 'binding' }` */
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
/** 지금까지 흐른 세계 시각 — 비의 구간을 시각으로 겨눌 때 쓴다 (C015 의 시계와 같은 값) */
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

/** 표면 태그마다 vertex 수 — "땅이 한 값도 달라지지 않았는가" 를 재는 자리 (c019 ~ c021 어법) */
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

/** 그 자리에 손이 닿는, 걸어 설 수 있는 자리 하나 (c020 · c021 의 besideIn 그대로) */
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
/** 그 철에서 시작하는 세계 — C015 가 세운 clock 손잡이 (c016 · c021 의 inSeason 그대로) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: LifeSetup = {}): WorldDriver =>
  inRoom(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 세계 시간을 흘린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 ~ c021 의 wait 그대로) */
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

// ── 저장·복구 (persistence.spec · c013 ~ c021 의 선례 그대로) ─────────

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
/** server/world-store.ts 가 하는 일 그대로 — 파일에 쓰고 다시 읽는다 (persistence.spec) */
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

const siteEntity = (v: GameViewSnapshot): SiteView | undefined =>
  v.entities.find((e) => e.id === CLUTCH) as SiteView | undefined;
function seenSite(w: WorldDriver): SiteView {
  const found = siteEntity(w.observe());
  if (!found) throw new Error(`관찰 결과에 탄생지 '${CLUTCH}' 가 실리지 않았다`);
  return found;
}
/** 지금 **모자란** 조건 코드들 — 하나도 없으면 자리 자체가 없다 (관찰 계약) */
const missingCodes = (w: WorldDriver): string[] => seenSite(w).conditions ?? [];
const mineOnSite = (v: GameViewSnapshot): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'mine' && i.targetEntityId === CLUTCH);

interface LifeSiteShape {
  phase: string;
  progress: number;
}
/** `RegionState.lifeSites[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function siteStateIn(w: WorldDriver, region = ROOM, id = CLUTCH): LifeSiteShape | undefined {
  const here = statesOf(w)[region] as { lifeSites?: Record<string, LifeSiteShape> } | undefined;
  return here?.lifeSites?.[id];
}
function siteState(w: WorldDriver): LifeSiteShape {
  const found = siteStateIn(w);
  if (!found) throw new Error(`Region State 에 탄생지가 없다 — regionStates.${ROOM}.lifeSites.${CLUTCH}`);
  return found;
}
const phaseOfSite = (w: WorldDriver): string => siteState(w).phase;
const progressOfSite = (w: WorldDriver): number => siteState(w).progress;

/** `RegionState.populations[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function populationIn(w: WorldDriver, region = ROOM, id = POPULATION): { value: number } | undefined {
  const here = statesOf(w)[region] as { populations?: Record<string, { value: number }> } | undefined;
  return here?.populations?.[id];
}
function populationValue(w: WorldDriver): number {
  const found = populationIn(w);
  if (!found) throw new Error(`Region State 에 개체군이 없다 — regionStates.${ROOM}.populations.${POPULATION}`);
  return found.value;
}

interface SourceStateShape {
  phase: string;
  taken: number;
  siteIndex?: number;
}
const sourcePhaseOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w) as never, region, id) as SourceStateShape;

/**
 * 알집의 자리 — **관찰 결과에서 얻는다** (손으로 적지 않는다).
 * 이 값 하나가 서지 않으면 이 Cycle 이 아직 아무것도 세우지 않은 것이므로, 그 사실을 말한다.
 */
let clutchMemo: XZ | undefined;
function clutchAt(): XZ {
  if (clutchMemo) return clutchMemo;
  const found = siteEntity(inRoom(ROOM).observe());
  if (!found) throw new Error(`관찰 결과에 탄생지 '${CLUTCH}' 가 실리지 않았다 — 자리를 얻을 수 없다`);
  clutchMemo = { x: found.position.x, z: found.position.z };
  return clutchMemo;
}

/** 알집 곁(그 자락 위)에 선 세계 — 넷이 다 차 있는 고요의 첫 비 */
const atClutch = (extra: LifeSetup = {}): WorldDriver => inSeason(STILL, ROOM, clutchAt(), extra);
/** 알집에서 가장 먼, 걸어 설 수 있는 자리 — 자락 밖 */
const awayFromClutch = (): XZ => maxBy(walkableSpots(ROOM), (p) => distanceBetween(p, clutchAt()));

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 생명 계약이 세계에 선다 (경계 ① 만 잰다)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 생명 계약이 세계에 선다', () => {
  it('S-011 (경계 ①) 탄생지도 개체군도 거목의 방 하나에만 선다 — 나머지 방은 한 값도 달라지지 않는다', () => {
    // Given 세계가 아는 방들
    for (const spec of REGION_SPECS) {
      const w = inRoom(spec.id);
      const here = statesOf(w)[spec.id] as
        | { lifeSites?: Record<string, unknown>; populations?: Record<string, unknown> }
        | undefined;
      const sites = Object.keys(here?.lifeSites ?? {});
      const pops = Object.keys(here?.populations ?? {});
      if (spec.id === ROOM) {
        // Then 거목의 방은 탄생지 하나와 개체군 하나를 밝힌다
        // C023 CHANGED — 이 방의 탄생지가 둘이 되었다 (알집 · 뿌리의 알). 이 Cycle 이 세운
        // 것은 알집이므로 **그것이 있는가**만 잰다 (전체 개수를 단언하지 않는다).
        expect({ region: spec.id, hasClutch: sites.includes(CLUTCH), pops }).toEqual({
          region: spec.id,
          hasClutch: true,
          pops: [POPULATION],
        });
        continue;
      }
      // C024 CHANGED — 뒤의 Cycle 이 밝힌 방은 지나간다 (둥지가 변성지와 거목균을 밝혔다).
      // 이 항이 재는 것은 **밝히지 않은 방에 자리 자체가 없는가** 이지 "하나뿐인가" 가 아니다.
      if (spec.ecology) continue;
      // Then 밝히지 않은 방에는 자리 자체가 없다 (빈 것으로 지어내지 않는다)
      expect({ region: spec.id, sites, pops }).toEqual({ region: spec.id, sites: [], pops: [] });
      // And 그 방의 관찰 결과에도 탄생지가 실리지 않는다
      expect({
        region: spec.id,
        lifeSites: w.observe().entities.filter((e) => e.role === 'life-site').map((e) => e.id),
      }).toEqual({ region: spec.id, lifeSites: [] });
    }
  }, 120_000);

  it.todo(
    'GAP: 탄생 방식 넷의 어휘 · 재료 셋 · 소비 둘 · 생태 역할이 데이터에 다 섰는가(SPEC-001 본문 · 경계 ②)는 ' +
      '이 Cycle 이 처음 내는 데이터 계약(content/regions/ecology.ts · authoring/contracts.ts)을 읽어야 재진다 — ' +
      '검사 ㉗ ~ ㉝(SPEC-008)가 그 자리를 소유한다 (engine/world-authoring/tests)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 탄생지가 방에 서고, 물으면 답한다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 탄생지가 방에 서고, 물으면 답한다', () => {
  it('S-021 알집이 거목의 방 뿌리 곡선 위에 서고, 지금 phase 를 말한다', () => {
    // Given 알집 곁에 선 세계
    const w = atClutch();
    const seen = seenSite(w);
    // Then 존재 하나로 실린다 — 역할은 탄생지이고 종류는 자연 형태 코드다
    expect({ id: seen.id, role: seen.role }).toEqual({ id: CLUTCH, role: 'life-site' });
    expect({ kind: typeof seen.kind, empty: seen.kind === '' , isId: seen.kind === CLUTCH }).toEqual({
      kind: 'string',
      empty: false,
      isId: false,
    });
    // And 실리는 state 는 지금 phase 의 소문자다 (State 는 대문자 · 관찰 계약)
    expect({ state: seen.state }).toEqual({ state: phaseOfSite(w).toLowerCase() });
    expect([DORMANT, BINDING]).toContain(phaseOfSite(w));
    // And 자리는 거목의 **뿌리 곡선 위**이고 뿌리혹과 다른 마디다 (State 표 · 기본형 ①)
    const root = curvesOf(spaceOf(ROOM), PRESENCE_LAYER, ROOT_CURVE_TAG);
    expect({ rootCurve: root.length > 0 }).toEqual({ rootCurve: true });
    const offCurve = nearestCurveDistance(root, clutchAt().x, clutchAt().z);
    // 3.0 은 이 파일이 고른 여유다 — spec 은 "뿌리 곡선 위의 마디 곁" 까지만 말한다
    expect({ offCurve: offCurve <= 3, measured: offCurve }).toEqual({ offCurve: true, measured: offCurve });
    expect({ apart: distanceBetween(clutchAt(), pointOf(ROOM, NODULE)) > 0 }).toEqual({ apart: true });
    // And 걸어 설 수 있는 땅 위다 (닿을 수 있어야 지목이 뜻을 가진다)
    expect(isTraversableAt(terrainOf(ROOM), clutchAt().x, clutchAt().z)).toBe(true);
  });

  it('S-022 지목하면 지금 무엇이 모자란지가 읽힌다 — 다 차 있으면 자리 자체가 없다', () => {
    // Given 넷이 다 차 있는 고요의 첫 비
    const full = atClutch();
    expect({ phase: phaseOfSite(full) }).toEqual({ phase: BINDING });
    // Then 모자란 것이 하나도 없으므로 conditions 자리가 없다 (C012 의 규율 그대로)
    expect({ conditions: seenSite(full).conditions }).toEqual({ conditions: undefined });
    // When 요구 하나(개체군이 0)를 깨뜨린다
    const broken = atClutch({ populations: { [POPULATION]: 1 } });
    // Then 코드 하나가 실린다
    expect({ count: missingCodes(broken).length }).toEqual({ count: 1 });
    expect({ empty: missingCodes(broken)[0] === '' }).toEqual({ empty: false });
  });

  it('S-023 (경계 ①) 캐기가 걸리지 않는다 — 알집은 원천이 아니다', () => {
    // Given 알집 곁에 곡괭이를 들고 선 세계
    const w = atClutch({ actorItems: { pickaxe: 1 } });
    const asked = mineOnSite(w.observe());
    // Then 판에 캐기가 실리되 가용하지 않고 사유가 그것을 말한다
    expect({ standing: asked !== undefined }).toEqual({ standing: true });
    expect({ available: asked!.available }).toEqual({ available: false });
    const reason = asked!.reason;
    expect({ reason: typeof reason, empty: reason === '' }).toEqual({ reason: 'string', empty: false });
    // And 요청해도 거절된다
    const result = mine(w, CLUTCH);
    expect({ status: result.status, reason: reasonOf(result) }).toEqual({
      status: 'failure',
      reason,
    });
    // And 그 사유는 **몸의 사정이 아니다** — 곡괭이가 없어도 멀리 서도 같은 말이다
    const noTool = atClutch();
    expect({ reason: mineOnSite(noTool.observe())?.reason }).toEqual({ reason });
    const far = inSeason(STILL, ROOM, awayFromClutch(), { actorItems: { pickaxe: 1 } });
    expect({ reason: mineOnSite(far.observe())?.reason }).toEqual({ reason });
    // And 대조 — 같은 방의 **원천**은 곁에 서면 캐기가 걸린다 (알집만 갈린다)
    const beside = inSeason(STILL, ROOM, besideIn(ROOM, pointOf(ROOM, NODULE)), {
      actorItems: { pickaxe: 1 },
    });
    const onNodule = beside.observe().interactions.find(
      (i) => i.id === 'mine' && i.targetEntityId === NODULE,
    );
    expect({ id: NODULE, available: onNodule?.available }).toEqual({ id: NODULE, available: true });
  });

  it('S-024 (경계 ②) 세계 위에 늘 떠 있는 글자는 하나도 늘지 않는다', () => {
    const w = atClutch();
    // Then 알집에도, 그 방의 어느 존재에도 글자가 실리지 않는다 (C026 ~ C028 의 규율)
    for (const entity of w.observe().entities) {
      expect({ id: entity.id, label: (entity as { labelValue?: unknown }).labelValue }).toEqual({
        id: entity.id,
        label: undefined,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 전조 흔적 넷이 알집으로 이끈다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 전조 흔적 넷이 알집으로 이끈다', () => {
  it('S-031 BINDING 동안 그 자락에 선 몸의 걸린 것에 코드 하나가 뒤에 이어 붙는다', () => {
    // Given 알집 자리에 선, 조건이 깨진 세계 (DORMANT)
    const quiet = atClutch({ populations: { [POPULATION]: 1 } });
    expect({ phase: phaseOfSite(quiet) }).toEqual({ phase: DORMANT });
    const before = quiet.observe().standingConditions;
    // When 같은 자리에 조건이 다 찬 세계로 선다 (BINDING)
    const bound = atClutch();
    expect({ phase: phaseOfSite(bound) }).toEqual({ phase: BINDING });
    const after = bound.observe().standingConditions;
    // Then 앞의 것이 하나도 지워지지 않고 코드 하나가 **뒤에 이어 붙는다** (경계 ① · 관찰 계약)
    expect({ length: after.length }).toEqual({ length: before.length + 1 });
    expect(after.slice(0, before.length)).toEqual(before);
    const tremor = after[after.length - 1]!;
    expect({ empty: tremor === '' }).toEqual({ empty: false });
    // And 그 코드는 DORMANT 인 세계 어디에도 없다
    expect(before).not.toContain(tremor);
  });

  it('S-032 (경계 ①) 그 자락 밖에 선 몸에는 실리지 않는다', () => {
    const at = awayFromClutch();
    const bound = inSeason(STILL, ROOM, at);
    expect({ phase: phaseOfSite(bound) }).toEqual({ phase: BINDING });
    // Then 자락 밖의 걸린 것은 땅이 말하는 것 그대로다 (C006)
    expect([...bound.observe().standingConditions].sort()).toEqual([...conditionTagsAt(ROOM, at)].sort());
    // And 알집 자리에서 뒤에 붙던 코드가 여기엔 없다
    const tremor = atClutch().observe().standingConditions;
    for (const code of tremor.filter((c) => !conditionTagsAt(ROOM, clutchAt()).includes(c))) {
      expect({ code, seenAway: bound.observe().standingConditions.includes(code) }).toEqual({
        code,
        seenAway: false,
      });
    }
  });

  it('S-033 알집 둘레의 흙이 **결속하는 동안** 한 단계 옅어진다', () => {
    // Given 결속이 서지 않는 세계 (이미 주인이 있다) — 자락은 데이터의 단계 그대로다
    const idle = atClutch({ populations: { [POPULATION]: 1 } });
    wait(idle, 1);
    const base = traceStrengthAt(statesOf(idle) as never, ROOM, clutchAt());
    expect({ base: base > 0, phase: phaseOfSite(idle) }).toEqual({ base: true, phase: 'DORMANT' });

    // When 조건이 다 찬 세계에서 결속이 선다 — 진행은 아직 절반에 못 미친다
    const w = atClutch();
    wait(w, BINDING_SECONDS * 0.4);
    expect({ phase: phaseOfSite(w), half: progressOfSite(w) < 0.5 }).toEqual({
      phase: 'BINDING',
      half: true,
    });
    // Then **이미** 한 단계 옅다 — 옅어짐은 진행이 아니라 결속에 매인다.
    // (spec 기본형 ④ 는 "진행 절반" 을 들었으나 진행은 관찰 결과에 실리지 않는다 —
    //  세계와 화면이 같은 자리에서 같은 단계를 내야 하므로 phase 를 묻는 것으로 통합했다.
    //  spec 의 판정문 "진행에 따라 한 단계 옅어진다" 는 그대로 참이다.)
    expect({ when: '결속 앞쪽', trace: traceStrengthAt(statesOf(w) as never, ROOM, clutchAt()) }).toEqual({
      when: '결속 앞쪽',
      trace: base - 1,
    });

    // And 더 굴려도 **한 단계**다 — 두 번 옅어지지 않는다
    wait(w, BINDING_SECONDS * 0.2);
    expect({ when: '결속 뒤쪽', trace: traceStrengthAt(statesOf(w) as never, ROOM, clutchAt()) }).toEqual({
      when: '결속 뒤쪽',
      trace: base - 1,
    });

    // And 그 방의 **바닥** 흔적은 한 값도 달라지지 않는다 (옅어지는 것은 알집 둘레뿐이다)
    const floor = traceStrengthAt(statesOf(w) as never, ROOM, awayFromClutch());
    expect({ floor }).toEqual({
      floor: traceStrengthAt(statesOf(idle) as never, ROOM, awayFromClutch()),
    });
  });

  it('S-034 (경계 ②) 땅도 통행 격자도 hash 도 한 값 바뀌지 않는다 — 덧씌움이지 재컴파일이 아니다', () => {
    const hash = descriptionHash(spaceOf(ROOM));
    // Given 같은 방을 phase 둘 · 진행 앞뒤 · 철 넷으로 세운다
    const worlds: { at: string; w: WorldDriver }[] = [
      { at: 'DORMANT', w: atClutch({ populations: { [POPULATION]: 1 } }) },
      { at: 'BINDING/0', w: atClutch() },
      ...SEASONS.map((season) => ({ at: `season/${season}`, w: inSeason(season, ROOM, clutchAt()) })),
    ];
    const bound = atClutch();
    wait(bound, BINDING_SECONDS + 1);
    worlds.push({ at: 'BINDING/full', w: bound });
    for (const one of worlds) {
      // Then 관찰 결과의 방 id 도 hash 도 그 값 하나다
      expect({ at: one.at, id: one.w.observe().region.id, hash: one.w.observe().region.hash }).toEqual({
        at: one.at,
        id: ROOM,
        hash,
      });
    }
    // And 표면 태그와 통행 자리 수는 이 Cycle 이전과 같다 (땅은 컴파일이 소유한다)
    expect(surfaceCounts(ROOM)).toEqual(TREE_ROOM_GROUND.surface);
    expect(walkableSpots(ROOM).length).toBe(TREE_ROOM_GROUND.traversable);
    // And 같은 자리에 같은 대답이다 — 통행은 땅의 것이다
    const sample = [...walkableSpots(ROOM).filter((_, i) => i % 211 === 0).slice(0, 5)];
    for (const one of worlds) {
      for (const at of sample) {
        expect({ at: one.at, spot: [at.x, at.z], accepted: move(one.w, at).status === 'success' }).toEqual({
          at: one.at,
          spot: [at.x, at.z],
          accepted: true,
        });
      }
    }
  }, 60_000);

  it.todo(
    'GAP: 부푼 균사의 자락(curve · NEST_FUNGUS 가 있음일 때만)과 뿌리 마디의 붉은 빛(point · BINDING 동안만)은 ' +
      '관찰 봉투에 실리지 않는다 — 흔적 자락은 관찰자가 자기 content/regions 를 컴파일해 스스로 그리는 것이고 ' +
      '(C011 이 세운 규율 · spec Observable "place 의 흔적 줄"), 세계 쪽에서 잴 수 있는 것은 ' +
      'traceStrengthAt 의 단계까지다(S-033). 그 둘이 실제로 서는가는 content/view 의 몫이다',
  );

  it.todo(
    'GAP: "알집을 가리키는 아이콘 · 타이머 · 좌표가 어디에도 없다"(경계 ③)의 절반은 화면의 일이다 — ' +
      '세계 쪽에서 잰 것은 봉투에 글자가 늘지 않았다는 것(S-024)과 진행 · 길이 · 비가 실리지 않는다는 것뿐이다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 결속 조건은 넷이고, 하나라도 모자라면 서지 않는다
// ─────────────────────────────────────────────────────────────────────

/**
 * **비가 모자랄 때의 코드** (C023 CHANGED) — 글자를 손으로 적지 않고 세계에서 얻는다.
 *
 * 비가 아예 없는 철에서는 요구 넷 중 비 하나만 모자라므로, 그때 걸린 코드가 곧 그것이다.
 * 이 Cycle 부터 비의 눈금을 phase 로 잴 수 없어(결속이 60 초에 다 차 태어난다) 코드로 잰다.
 */
let RAIN_CODE_MEMO: string | null = null;
const rainCode = (): string => {
  if (RAIN_CODE_MEMO !== null) return RAIN_CODE_MEMO;
  const seen = missingCodes(inSeason(LONG_NIGHT, ROOM, clutchAt()));
  expect({ only: seen.length }).toEqual({ only: 1 });
  RAIN_CODE_MEMO = seen[0]!;
  return RAIN_CODE_MEMO;
};

/** 긴 밤이 시작한 자리에서 다음 고요가 시작하기까지 — 긴 밤 360 + 뒤척임 60 (C015 의 시계) */
const LONG_NIGHT_TO_STILL = 420;

/**
 * 그 관찰 결과 어딘가에 **값이 꼭 그것인** 자리가 있는가 (C023 CHANGED).
 *
 * 부분 문자열로 재면 다른 코드가 그 이름을 품기만 해도 거짓 양성이 난다
 * (껍질의 재료 코드가 개체군 이름을 품는다). 값 하나하나를 견준다.
 */
function carriesExactly(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value === needle;
  if (Array.isArray(value)) return value.some((v) => carriesExactly(v, needle));
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => carriesExactly(v, needle));
  }
  return false;
}

/** 요구 넷을 하나씩 깨뜨리는 네 가지 세움 — 무엇이 깨졌는지는 이름으로만 적는다 */
const BREAKERS: readonly { name: string; build: () => WorldDriver }[] = [
  { name: '뿌리혹이 없다', build: () => atClutch({ sourcePhases: { [NODULE]: DEPLETED } }) },
  { name: '균사가 없다', build: () => atClutch({ sourcePhases: { [FUNGUS]: DEPLETED } }) },
  {
    name: '비가 오지 않는다',
    // C023 CHANGED — 고요의 비 밖으로 나가려면 90 초를 굴려야 하는데 결속은 60 초에 다 차
    // **태어나 버린다**. 비가 아예 없는 철에서 잰다 — 요구 넷 중 비 하나만 모자란 세계다.
    build: () => inSeason(LONG_NIGHT, ROOM, clutchAt()),
  },
  { name: '광식충이 0 이 아니다', build: () => atClutch({ populations: { [POPULATION]: 1 } }) },
];

describe('SPEC-004 결속 조건은 넷이고, 하나라도 모자라면 서지 않는다', () => {
  it('S-041 넷이 다 차 있는 동안에만 BINDING 이다', () => {
    // Given 고요의 첫 비 — 뿌리혹도 균사도 서 있고 개체군은 0 이다
    const w = atClutch();
    expect({ nodule: sourcePhaseOf(w, ROOM, NODULE).phase }).toEqual({ nodule: AVAILABLE });
    expect({ fungus: sourcePhaseOf(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: AVAILABLE });
    expect({ population: populationValue(w) }).toEqual({ population: 0 });
    // Then phase 가 BINDING 이고 모자란 것이 없다
    expect({ phase: phaseOfSite(w), missing: missingCodes(w) }).toEqual({ phase: BINDING, missing: [] });
  });

  it('S-042 (경계 ①) 하나라도 깨지면 그 tick 에 DORMANT 로 돌아간다', () => {
    for (const one of BREAKERS) {
      const w = one.build();
      expect({ broken: one.name, phase: phaseOfSite(w) }).toEqual({ broken: one.name, phase: DORMANT });
      // And 실린 state 도 그 값이다
      expect({ broken: one.name, state: seenSite(w).state }).toEqual({
        broken: one.name,
        state: DORMANT.toLowerCase(),
      });
    }
  }, 60_000);

  it('S-042b (경계 ①) BINDING 으로 세워 놓아도 조건이 모자라면 그 tick 에 되돌아온다', () => {
    // Given 손잡이로 결속을 세운 세계 — 그러나 개체군이 0 이 아니다
    const w = atClutch({ lifeSitePhases: { [CLUTCH]: 'binding' }, populations: { [POPULATION]: 1 } });
    // When 한 tick 이 돈다
    w.tick(TICK_INTERVAL);
    // Then 조건이 phase 를 정한다 — 세워 둔 것이 아니라 (R3)
    expect({ phase: phaseOfSite(w) }).toEqual({ phase: DORMANT });
    // And 조건이 다 찬 세계에서 같은 손잡이는 그대로 선다
    const kept = atClutch({ lifeSitePhases: { [CLUTCH]: 'binding' } });
    kept.tick(TICK_INTERVAL);
    expect({ phase: phaseOfSite(kept) }).toEqual({ phase: BINDING });
  });

  it('S-043 (경계 ②) 모자란 요구마다 **다른 코드**가 걸린다', () => {
    // Given 요구를 하나씩 깨뜨린 네 세계
    const codes = BREAKERS.map((one) => {
      const seen = missingCodes(one.build());
      expect({ broken: one.name, count: seen.length }).toEqual({ broken: one.name, count: 1 });
      return { broken: one.name, code: seen[0]! };
    });
    // Then 넷이 서로 다르다 — 무엇이 모자란지가 갈린다
    expect({ distinct: new Set(codes.map((c) => c.code)).size, all: codes }).toEqual({
      distinct: 4,
      all: codes,
    });
    // And 넷을 다 깨뜨리면 넷이 다 실린다 (차 있는 것의 코드는 실리지 않는다)
    // C023 CHANGED — 비를 굴려서 깨면 그 사이 태어나 버린다. 비가 없는 철에서 넷을 깨뜨린다
    const all = inSeason(LONG_NIGHT, ROOM, clutchAt(), {
      sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED },
      populations: { [POPULATION]: 1 },
    });
    expect({ missing: [...missingCodes(all)].sort() }).toEqual({
      missing: [...codes.map((c) => c.code)].sort(),
    });
  }, 60_000);

  it('S-044 (경계 ③) 관찰자가 그 방에 없어도 판정은 돈다 — 다른 방의 균사를 캐면 그 tick 에 멎는다', () => {
    // Given 관찰자는 **둥지의 방**에 있다. 알집은 거목의 방에 홀로 있다
    const w = inSeason(STILL, PREDATOR_NEST, besideIn(PREDATOR_NEST, pointOf(PREDATOR_NEST, FUNGUS)), {
      actorItems: { pickaxe: 1 },
    });
    expect({ phase: phaseOfSite(w) }).toEqual({ phase: BINDING });
    // When 세계 시간이 흐른다 (아무도 그 방을 보고 있지 않다)
    wait(w, 20);
    const rising = progressOfSite(w);
    expect({ rising: rising > 0 }).toEqual({ rising: true });
    // When 다른 방의 균사를 캐 바닥낸다
    expect({ ...mineOnce(w, FUNGUS) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect({ fungus: sourcePhaseOf(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: DEPLETED });
    // Then 그 tick 에 알집이 DORMANT 로 돌아간다 — 다른 방의 원천이 이 방의 결속을 정한다
    expect({ phase: phaseOfSite(w) }).toEqual({ phase: DORMANT });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 결속은 세계 시간으로 오르고, 조건이 깨지면 멎는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 결속은 세계 시간으로 오르고, 조건이 깨지면 멎는다', () => {
  it('S-051 60 세계 초에 다 찬다', () => {
    const w = atClutch();
    expect({ start: progressOfSite(w) }).toEqual({ start: 0 });
    // When 절반의 세계 시간이 흐른다
    wait(w, BINDING_SECONDS / 2);
    expect(progressOfSite(w)).toBeCloseTo(0.5, 2);
    // Then 60 초에 다 찬다 — C023 CHANGED: 다 차는 그 tick 에 결속이 **끝난다**
    // (태어나는 것을 재는 것은 C023 이다). 그래서 "다 찼다" 는 BINDING 을 벗어나는 것으로 읽는다.
    wait(w, BINDING_SECONDS / 2 - 2);
    expect({ almost: progressOfSite(w) > 0.9, phase: phaseOfSite(w) }).toEqual({
      almost: true,
      phase: BINDING,
    });
    wait(w, 3);
    expect({ done: phaseOfSite(w) !== BINDING }).toEqual({ done: true });
  });

  it('S-052 (경계 ①) 진행은 1 을 넘지 않는다', () => {
    // C023 CHANGED — 다 차면 태어나므로 "1 에 머무는 자리" 가 없다. 결속하는 **동안 내내**
    // 1 을 넘지 않는가를 훑어서 잰다 (그것이 이 경계가 말하려던 것이다).
    const w = atClutch();
    let highest = 0;
    for (let i = 0; i < BINDING_SECONDS - 1; i++) {
      wait(w, 1);
      if (phaseOfSite(w) !== BINDING) break;
      highest = Math.max(highest, progressOfSite(w));
    }
    expect({ phase: phaseOfSite(w), overflowed: highest > 1, near: highest > 0.9 }).toEqual({
      phase: BINDING,
      overflowed: false,
      near: true,
    });
  }, 60_000);

  it('S-053 조건이 깨지면 **그 자리에 멎고 지워지지 않으며**, 다시 차면 이어서 오른다', () => {
    // Given 관찰자는 둥지의 방에 있고, 거목의 방에서 결속이 오르고 있다 (Observable Result 4)
    const w = inSeason(STILL, PREDATOR_NEST, besideIn(PREDATOR_NEST, pointOf(PREDATOR_NEST, FUNGUS)), {
      actorItems: { pickaxe: 1 },
    });
    wait(w, 20);
    const risen = progressOfSite(w);
    expect({ risen: risen > 0 && risen < 1 }).toEqual({ risen: true });
    // When 균사를 캐 바닥낸다 — 조건 하나가 깨진다
    expect({ ...mineOnce(w, FUNGUS) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect({ fungus: sourcePhaseOf(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: DEPLETED });
    // Then 진행이 **그 자리에 멎는다** — 지워지지 않는다
    const frozen = progressOfSite(w);
    expect({ phase: phaseOfSite(w), kept: frozen >= risen && frozen < 1 }).toEqual({
      phase: DORMANT,
      kept: true,
    });
    // And 균사가 되돌아오는 동안에도, 비가 그친 뒤에도 한 톨도 오르지 않는다
    wait(w, 150);
    expect({ still: progressOfSite(w), phase: phaseOfSite(w) }).toEqual({ still: frozen, phase: DORMANT });
    expect({ fungus: sourcePhaseOf(w, PREDATOR_NEST, FUNGUS).phase }).toEqual({ fungus: AVAILABLE });
    // When 다음 날의 비가 온다 (하루 360 · 다음 비는 [360, 450))
    wait(w, DAY_TOTAL + 5 - worldTime(w));
    expect({ phase: phaseOfSite(w) }).toEqual({ phase: BINDING });
    // Then **멎은 자리에서 이어서** 오른다 (처음부터 다시가 아니다)
    expect({ resumed: progressOfSite(w) > frozen }).toEqual({ resumed: true });
    // And 이어 올라 다 찬다 — 처음부터 다시라면 60 초가 더 걸려 이 안에 끝나지 않는다
    // (C023 CHANGED: 다 차는 그 tick 에 결속이 끝나므로 "다 찼다" 는 BINDING 을 벗어남이다)
    wait(w, BINDING_SECONDS - 5);
    expect({ done: phaseOfSite(w) !== BINDING }).toEqual({ done: true });
  }, 60_000);

  it('S-054 (경계 ②) **다 차기 전에는** 아무것도 태어나지 않고 아무것도 소비되지 않는다', () => {
    const w = atClutch();
    const noduleBefore = sourcePhaseOf(w, ROOM, NODULE);
    const fungusBefore = sourcePhaseOf(w, PREDATOR_NEST, FUNGUS);
    // When 결속이 다 차기 직전까지 굴린다 (C023 CHANGED — 다 차면 태어난다)
    wait(w, BINDING_SECONDS - 2);
    expect({ rising: progressOfSite(w) > 0.9 }).toEqual({ rising: true });
    // Then phase 는 BINDING 그대로다 (BORN 으로 가는 것은 C023 이다)
    expect({ phase: phaseOfSite(w), state: seenSite(w).state }).toEqual({
      phase: BINDING,
      state: BINDING.toLowerCase(),
    });
    // And 뿌리혹도 균사도 개체군도 한 값 달라지지 않는다
    expect({ nodule: sourcePhaseOf(w, ROOM, NODULE) }).toEqual({ nodule: noduleBefore });
    expect({ fungus: sourcePhaseOf(w, PREDATOR_NEST, FUNGUS) }).toEqual({ fungus: fungusBefore });
    expect({ population: populationValue(w) }).toEqual({ population: 0 });
  });

  it('S-055 (경계 ③) 저장된다 — 되살린 세계가 phase 와 진행을 그대로 잇는다', () => {
    // Given 얼마쯤 오른 결속
    const w = atClutch();
    wait(w, 30);
    const before = { phase: phaseOfSite(w), progress: progressOfSite(w) };
    // When 파일을 지나 저장하고 되살린다 (persistence.spec 의 그 길)
    const stored = throughFile(w.world.snapshot());
    const storedSite = (
      (stored.state as WorldState).regionStates[ROOM] as unknown as {
        lifeSites?: Record<string, LifeSiteShape>;
      }
    )?.lifeSites?.[CLUTCH];
    // Then 저장된 것에 그 자리가 있다
    expect({ stored: storedSite }).toEqual({ stored: before });
    // And 되살린 세계가 그 값을 그대로 잇는다
    const again = revive(w);
    expect({ phase: phaseOfSite(again), progress: progressOfSite(again) }).toEqual(before);
    // And 개체군 값도 함께 저장된다 (SPEC-007)
    expect({ population: populationValue(again) }).toEqual({ population: 0 });
    // And 이어서 굴리면 이어서 오른다 (C023 CHANGED — 다 차면 결속이 끝나므로 그 앞까지 잰다)
    wait(again, 20);
    expect({ rose: progressOfSite(again) > before.progress, phase: phaseOfSite(again) }).toEqual({
      rose: true,
      phase: BINDING,
    });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 비는 시각과 철에서 유도되고 저장되지 않는다
// ─────────────────────────────────────────────────────────────────────

/** 하루 안의 표본 자리 — 고요·스밈·긴 밤은 하루(360)를 다 돌고, 뒤척임은 60 초뿐이다 */
const DAY_SAMPLES = [5, 95, 185, 265, 350];
const TURN_SAMPLES = [5, 30, 55];

describe('SPEC-006 비는 시각과 철에서 유도되고 저장되지 않는다', () => {
  it('S-061 하루 안의 비 구간이 철마다 다르다 — 결속이 그 구간에만 선다', () => {
    for (const season of SEASONS) {
      const samples = season === TURN ? TURN_SAMPLES : DAY_SAMPLES;
      // Given 그 철이 시작하는 자리에 선 세계 (다른 요구 셋은 다 차 있다)
      const w = inSeason(season, ROOM, clutchAt());
      let now = 0;
      for (const offset of samples) {
        wait(w, offset - now);
        now = offset;
        // Then **비가 모자란가**가 그 시각에 비가 오는가 그대로다.
        // C023 CHANGED — phase 로는 잴 수 없다: 결속이 60 초에 다 차 태어나 버리므로
        // 90 초 뒤의 phase 는 SPENT 다. 비는 여전히 조건 코드가 말한다 (그것이 이 SPEC 의 주장이다).
        expect({ season, offset, dry: missingCodes(w).includes(rainCode()) }).toEqual({
          season,
          offset,
          dry: !rainsAt(season, offset),
        });
      }
    }
  }, 120_000);

  it('S-062 긴 밤과 뒤척임에는 넷이 아무리 차 있어도 결속이 서지 않는다', () => {
    for (const season of [LONG_NIGHT, TURN]) {
      const w = inSeason(season, ROOM, clutchAt());
      expect({ season, phase: phaseOfSite(w) }).toEqual({ season, phase: DORMANT });
      // And 굴려도 진행이 한 톨도 오르지 않는다
      wait(w, 50);
      expect({ season, progress: progressOfSite(w) }).toEqual({ season, progress: 0 });
    }
  }, 60_000);

  it('S-063 (경계 ②) 관찰자와 무관하다 — 온 세계에 같이 온다', () => {
    // Given 알집 곁에 선 세계와 **다른 방**에 선 세계
    const here = inSeason(STILL, ROOM, clutchAt());
    const elsewhere = inSeason(STILL, WHITE_KING_DOMAIN);
    wait(here, 30);
    wait(elsewhere, 30);
    // Then 결속의 지금이 한 값도 다르지 않다
    expect({ where: 'elsewhere', ...siteState(elsewhere) }).toEqual({
      where: 'elsewhere',
      ...siteState(here),
    });
  }, 60_000);

  it('S-064 (경계 ①) 저장되지 않는다 — 되살린 세계가 같은 시각에 같은 답을 낸다', () => {
    // Given 비가 없는 철의 세계 (C023 CHANGED — 비를 굴려서 그치게 하면 그 사이 태어난다)
    const w = inSeason(LONG_NIGHT, ROOM, clutchAt());
    wait(w, 95);
    expect({ dry: missingCodes(w).includes(rainCode()), phase: phaseOfSite(w) }).toEqual({
      dry: true,
      phase: DORMANT,
    });
    // Then 저장된 탄생지의 자리에는 phase 와 진행뿐이다 — 비도 조건의 충족도 없다
    const stored = throughFile(w.world.snapshot());
    const storedSite = (
      (stored.state as WorldState).regionStates[ROOM] as unknown as {
        lifeSites?: Record<string, Record<string, unknown>>;
      }
    )?.lifeSites?.[CLUTCH];
    expect({ keys: Object.keys(storedSite ?? {}).sort() }).toEqual({ keys: ['phase', 'progress'] });
    // And 되살린 세계는 같은 시각에 같은 답을 낸다
    const again = revive(w);
    expect({ dry: missingCodes(again).includes(rainCode()) }).toEqual({ dry: true });
    // And 비가 오는 철로 넘어가면 다시 선다 — 유도된 사실이기 때문이다
    // (긴 밤 360 초 뒤는 뒤척임 60 초, 그 뒤가 다음 바퀴의 고요다)
    wait(again, LONG_NIGHT_TO_STILL - 95 + 5);
    expect({ dry: missingCodes(again).includes(rainCode()), phase: phaseOfSite(again) }).toEqual({
      dry: false,
      phase: BINDING,
    });
  }, 60_000);

  it('S-065 (경계 ③) 비는 땅 · 표면 · 통행 · 관찰 범위를 한 값도 바꾸지 않는다', () => {
    // Given 비가 오는 때와 그치는 때
    // C023 CHANGED — 비를 굴려서 그치게 하면 그 사이 **태어나** 세계가 달라진다. 그래서
    // 두 세계 다 **광식충이 가득한 숲**으로 세운다: 결속이 서지 않으므로 아무것도 태어나지
    // 않고, 그러면 달라지는 것은 비 하나뿐이다 (철도 낮밤도 같은 하루 안이다).
    const noBirth = { populations: { [POPULATION]: 99 } };
    const raining = atClutch(noBirth);
    const dry = atClutch(noBirth);
    wait(dry, 95);
    expect({
      raining: missingCodes(raining).includes(rainCode()),
      dry: missingCodes(dry).includes(rainCode()),
    }).toEqual({ raining: false, dry: true });
    // Then 방의 hash 도 통행의 대답도 같다
    expect({ hash: dry.observe().region.hash }).toEqual({ hash: raining.observe().region.hash });
    const sample = walkableSpots(ROOM).filter((_, i) => i % 307 === 0).slice(0, 5);
    for (const at of sample) {
      expect({ spot: [at.x, at.z], dry: move(dry, at).status }).toEqual({
        spot: [at.x, at.z],
        dry: move(raining, at).status,
      });
    }
    // And 그 방에서 보이는 원천들도 같다 — 비가 관찰 범위를 좁히지 않는다
    const sourcesOf = (w: WorldDriver) =>
      w.observe().entities.filter((e) => e.role === 'resource-source').map((e) => e.id).sort();
    expect({ dry: sourcesOf(dry) }).toEqual({ dry: sourcesOf(raining) });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 개체군 값이 서고, 0 이라는 사실이 조건이다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 개체군 값이 서고, 0 이라는 사실이 조건이다', () => {
  it('S-071 거목의 방이 개체군 하나를 밝히고 값이 0 으로 선다', () => {
    const w = atClutch();
    expect({ value: populationValue(w) }).toEqual({ value: 0 });
    // And 관찰 봉투에는 그 값이 실리지 않는다 (Observable "투영하지 않는 것").
    // C023 CHANGED — 부분 문자열로 재면 껍질의 **재료 코드**(ORE_EATER_MOLT)가 개체군 이름을
    // 품어 거짓 양성이 난다. 값이 **꼭 그것인** 자리만 훑는다.
    expect({ leaked: carriesExactly(w.observe(), POPULATION) }).toEqual({ leaked: false });
  });

  it('S-072 (경계 ①) **결속이 다 차기 전에는** 값을 올리거나 내리는 것이 하나도 없다', () => {
    // C023 CHANGED — 다 차면 값이 오른다 (그것을 재는 것은 C023 이다). 여기서 남는 주장은
    // "결속하는 동안에는 아무것도 값을 건드리지 않는다" 이고, 그것은 여전히 참이다.
    const w = atClutch();
    wait(w, BINDING_SECONDS - 2);
    expect({ rising: progressOfSite(w) > 0.9, value: populationValue(w) }).toEqual({
      rising: true,
      value: 0,
    });
    // And 비가 없는 철에서는 하루를 굴려도 0 이다 (결속이 서지 않으므로)
    const dry = inSeason(LONG_NIGHT, ROOM, clutchAt());
    wait(dry, 300);
    expect({ value: populationValue(dry) }).toEqual({ value: 0 });
  }, 60_000);

  it('S-073 (경계 ②) 값이 0 이 아니면 결속이 서지 않는다', () => {
    // Given 손잡이로 개체군을 하나 세운 세계
    const w = atClutch({ populations: { [POPULATION]: 1 } });
    expect({ value: populationValue(w) }).toEqual({ value: 1 });
    // Then 나머지 셋이 다 차 있어도 결속이 서지 않는다 (최초는 결속이고 이후는 계승이다)
    expect({ phase: phaseOfSite(w) }).toEqual({ phase: DORMANT });
    wait(w, 30);
    expect({ progress: progressOfSite(w), phase: phaseOfSite(w) }).toEqual({
      progress: 0,
      phase: DORMANT,
    });
  });

  it.todo(
    'GAP: 개체군의 상한(scale 4)과 값이 내리는 세계 안의 원인(CONDITION_LOST)이 데이터에 적혀 있는가는 ' +
      '이 Cycle 이 처음 내는 데이터(content/regions/lives.ts)를 읽어야 재진다 — 관찰 봉투에도 State 에도 ' +
      '그 둘이 실리지 않는다(값 하나뿐이다). 검사 ㉝ 과 engine 쪽 검사가 그 자리를 소유한다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — SPEC-009 앞의 세계는 그대로다
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-101 이 Cycle 이 만지지 않는 방 열둘의 hash · 표면 · 통행이 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
      // And 그 방의 hash 는 관찰 결과에서도 철 넷에 흔들리지 않는다
      for (const season of SEASONS) {
        expect({ region, season, hash: inSeason(season, region).observe().region.hash }).toEqual({
          region,
          season,
          hash: base.hash,
        });
      }
    }
  }, 120_000);

  it('S-102 거목의 방의 땅과 통행도 그대로다 — 는 것은 Description 의 자리뿐이다', () => {
    expect(surfaceCounts(ROOM)).toEqual(TREE_ROOM_GROUND.surface);
    expect(walkableSpots(ROOM).length).toBe(TREE_ROOM_GROUND.traversable);
  });

  it('S-103 원천 열넷의 처음 phase · 캔 횟수 · 마디 · 둘레 흔적 단계가 그대로다', () => {
    for (const one of SOURCE_BASELINE) {
      const w = inRoom(one.region, undefined, { populations: { [POPULATION]: 1 } });
      const stored = sourcePhaseOf(w, one.region, one.id);
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
      // And 그 둘레의 흔적 단계는 이 Cycle 이전의 값이다
      expect({
        region: one.region,
        id: one.id,
        trace: traceStrengthAt(statesOf(w) as never, one.region, pointOf(one.region, one.id)),
      }).toEqual({ region: one.region, id: one.id, trace: one.trace });
    }
  }, 120_000);

  it('S-104 (경계) 거목의 방에서도 ROOT_NODULE 의 캐기와 되돌아옴이 그대로다', () => {
    // Given 뿌리혹 곁에 곡괭이를 들고 선 세계
    const at = besideIn(ROOM, pointOf(ROOM, NODULE));
    const w = inSeason(STILL, ROOM, at, { actorItems: { pickaxe: 1 } });
    expect({ phase: sourcePhaseOf(w, ROOM, NODULE).phase }).toEqual({ phase: AVAILABLE });
    // When 한 번 캔다 (harvests 1 — 한 번에 바닥난다)
    expect({ ...mineOnce(w, NODULE) }).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect({ phase: sourcePhaseOf(w, ROOM, NODULE).phase }).toEqual({ phase: DEPLETED });
    // Then 그동안 알집은 조건이 깨져 멎어 있다 (뿌리혹이 없다)
    expect({ site: phaseOfSite(w) }).toEqual({ site: DORMANT });
    // When 되돌아옴의 길이(180)를 기다린다
    wait(w, 180);
    // Then 그 자리에 되돌아온다 — 알집은 아직 아무것도 먹지 않는다 (캔 횟수도 되돌아옴도 그대로다)
    const back = sourcePhaseOf(w, ROOM, NODULE);
    expect({ phase: back.phase, taken: back.taken, site: back.siteIndex ?? 0 }).toEqual({
      phase: AVAILABLE,
      taken: 0,
      site: 0,
    });
  }, 60_000);

  it('S-105 숲 어귀의 MOLT_LITTER 의 캐기와 되돌아옴이 그대로다', () => {
    const at = besideIn(FOREST_EDGE, pointOf(FOREST_EDGE, MOLT));
    // C024 CHANGED — **광식충을 배속 1 의 자리에 세운다.** C024 부터 허물의 되돌아옴이
    // 벗는 것의 수에 매인다 (C024 SPEC-001): 값이 0 이면 아주 멎고 상한이면 두 배다.
    // 이 회귀가 말하려는 것은 "이 Cycle 이 그 길이를 건드리지 않았다" 이므로, 배속이 1 이
    // 되는 값에 세워 아래의 60 이 데이터 그대로임을 그대로 잰다.
    const w = inSeason(STILL, FOREST_EDGE, at, { actorItems: { pickaxe: 1 }, populations: { [ORE_EATER]: 2 } });
    // Given 세 번 캘 수 있다 (C011 이 세운 데이터 그대로)
    for (let i = 0; i < 3; i++) {
      expect({ nth: i + 1, ...mineOnce(w, MOLT) }).toEqual({
        nth: i + 1,
        status: 'success',
        rule: 'RULE-MINE-001',
      });
    }
    expect({ phase: sourcePhaseOf(w, FOREST_EDGE, MOLT).phase }).toEqual({ phase: DEPLETED });
    // When 되돌아옴의 길이(60)를 기다린다 — 생명을 전제한 회복 원인이 붙어도 길이는 그대로다
    wait(w, 60);
    expect({ phase: sourcePhaseOf(w, FOREST_EDGE, MOLT).phase, taken: sourcePhaseOf(w, FOREST_EDGE, MOLT).taken }).toEqual({
      phase: AVAILABLE,
      taken: 0,
    });
  }, 60_000);

  it('S-106 C016 ~ C021 이 세운 철 · 소란 · 상시의 덧씌움이 한 값도 달라지지 않는다', () => {
    // Given 위상을 밝힌 방 넷의 데이터
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
    expect(inSeason(STILL, WHITE_KING_DOMAIN, at).observe().standingConditions).toEqual([CONDITION_RIDGE]);
    for (const season of [SEEP, LONG_NIGHT]) {
      expect({ season, seen: inSeason(season, WHITE_KING_DOMAIN, at).observe().standingConditions }).toEqual({
        season,
        seen: [`${CONDITION_WEAK_PREFIX}${CONDITION_RIDGE.slice(CONDITION_PREFIX.length)}`],
      });
    }
  }, 60_000);

  it('S-107 거목의 방 밖에서는 이 Cycle 의 코드가 하나도 실리지 않는다', () => {
    // Given 알집 자락 위에서 뒤에 붙는 코드
    const tremor = atClutch().observe().standingConditions.filter(
      (c) => !conditionTagsAt(ROOM, clutchAt()).includes(c),
    );
    expect({ tremor: tremor.length }).toEqual({ tremor: 1 });
    // Then 다른 방 어디에도, 어느 철에도 그 코드가 서지 않는다
    for (const spec of REGION_SPECS.filter((s) => s.id !== ROOM)) {
      for (const season of SEASONS) {
        const seen = inSeason(season, spec.id).observe().standingConditions;
        expect({ region: spec.id, season, leaked: seen.includes(tremor[0]!) }).toEqual({
          region: spec.id,
          season,
          leaked: false,
        });
      }
    }
  }, 120_000);
});
