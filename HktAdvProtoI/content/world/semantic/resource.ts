// World Semantic — Resource Source · Trace (C011 ADDED)
//
// 세계가 "이 방이 무엇을 낳는가" 와 "이 자리의 흙이 얼마나 짙은가" 를 든다.
//
// **세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 원천의 자리와 성질은
// 언제나 content/regions 의 두 데이터(resourceEcology + 그 방 Description 의 resource point)에서
// 다시 오고, 흔적은 그 방 Description 의 trace area 에서 다시 온다. semantic/terrain.ts 와
// 같은 갈래의 **유도된 사실**이다 (spec State 절 — "이 Cycle 은 세계 State 를 하나도 더하지 않는다").
//
// 방마다 한 번만 엮어 들고 있는다 (아래 캐시). 컴파일과 마찬가지로 순수하므로 언제 만들든
// 같은 목록이 나온다 — 되살린 세계도 같은 데이터에서 같은 원천을 다시 세운다.

import { findPoint } from '../../../engine/world-authoring/description';
import { tagsAt } from '../../../engine/world-authoring/query';
import {
  RESOURCE_LAYER,
  REGION_SPECS,
  TRACE_LAYER,
  regionSpec,
  soilStainLevel,
  type CarrierKind,
  type OpportunityRole,
  type SupplyMode,
} from '../../regions';
import type { WorldPosition } from './position';
import { regionTerrain } from './terrain';

/**
 * 세계가 아는 원천 하나 — 성질(resourceEcology)과 자리(Description 의 resource point)를 엮은 것.
 *
 * carrier · opportunity · supply 는 **밝혀만 둔다** — 이 Cycle 의 규칙은 읽지 않는다
 * (회복은 C013, 보고는 C014 가 읽는다). 남은 양은 없다: 이 Cycle 의 원천은 캐도 줄지 않는다.
 */
export interface ResourceSource {
  id: string;
  regionId: string;
  materialId: string;
  /** 그 자리에 난 자연 형태 코드 — 관찰의 kind 가 이것이다 */
  form: string;
  carrier: CarrierKind;
  opportunity: OpportunityRole;
  supply: SupplyMode;
  /** 그 방 Local Space 의 자리 — resource layer point 가 소유한다 */
  position: WorldPosition;
}

// 방 하나당 엮기 한 번. 원천이 없는 방(백왕령)도 빈 배열로 담는다 — 그것도 답이다.
const SOURCES_BY_REGION = new Map<string, readonly ResourceSource[]>();

// id → 원천. 세계가 아는 원천 전부를 한 번 훑어 만든다 (아래 sourceIndex).
let SOURCE_INDEX: Map<string, ResourceSource> | null = null;

/**
 * RULE-RESOURCE-PLACEMENT-001 — 원천의 자리는 데이터가 정한다.
 *
 * 그 방 resourceEcology 의 원천마다, **같은 id 를 tag 로 가진** resource layer point 를 찾아
 * 그 자리에 세운다. 그런 point 가 없는 원천은 **서지 않는다** — 자리를 지어내지 않는다
 * (spec R3 경계). 순서는 resourceEcology.sources 의 순서 그대로다 (결정론).
 */
export function sourcesInRegion(regionId: string): readonly ResourceSource[] {
  const cached = SOURCES_BY_REGION.get(regionId);
  if (cached !== undefined) return cached;

  const spec = regionSpec(regionId);
  const sources: ResourceSource[] = [];
  for (const source of spec?.resourceEcology?.sources ?? []) {
    // 자리는 Description 의 것이다 — 여기서 좌표를 짓지 않는다.
    const point = spec ? findPoint(spec.space, RESOURCE_LAYER, source.id) : undefined;
    if (!point) continue;
    sources.push({
      id: source.id,
      regionId,
      materialId: source.materialId,
      form: source.form,
      carrier: source.carrier,
      opportunity: source.opportunity,
      supply: source.supply,
      position: { x: point.position.x, z: point.position.z },
    });
  }

  SOURCES_BY_REGION.set(regionId, sources);
  return sources;
}

/**
 * 세계가 아는 원천 하나 — 모르는 id 면 undefined.
 *
 * **방을 가리지 않는다.** 다른 방의 원천도 찾아지고, 그것을 거절하는 것은 채취의 전제다
 * (RULE-MINE-001 이 방과 거리로 판정한다 — spec SPEC-006 경계).
 */
export function findResourceSource(id: string): ResourceSource | undefined {
  return sourceIndex().get(id);
}

/**
 * RULE-TRACE-STRENGTH-001 — 그 자리의 흔적 세기.
 *
 * trace layer 의 `soil-stain:<n>` 태그 가운데 **가장 큰 n**. 하나도 없으면 0 이고,
 * 땅을 모르는 방(Description 이 없는 id)도 0 이다.
 *
 * **합하지 않는다** — 겹침은 짙기이지 양이 아니다 (spec R4 경계). 방 바닥 위에 원천 둘레가
 * 겹쳐 있으므로, 합하면 "둘레가 두 배로 짙다" 는 없는 답이 나온다.
 */
export function traceStrengthAt(regionId: string, position: WorldPosition): number {
  const terrain = regionTerrain(regionId);
  if (!terrain) return 0;
  let strongest = 0;
  for (const tag of tagsAt(terrain, position.x, position.z, TRACE_LAYER)) {
    const level = soilStainLevel(tag);
    if (level > strongest) strongest = level;
  }
  return strongest;
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 세계가 아는 모든 방의 원천을 id 로 엮은 표 — 첫 물음에 한 번 만든다 */
function sourceIndex(): Map<string, ResourceSource> {
  if (SOURCE_INDEX) return SOURCE_INDEX;
  const index = new Map<string, ResourceSource>();
  for (const spec of REGION_SPECS) {
    for (const source of sourcesInRegion(spec.id)) index.set(source.id, source);
  }
  SOURCE_INDEX = index;
  return index;
}
