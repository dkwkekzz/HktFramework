// World Semantic — Resource Source · Trace (C011 ADDED)
//
// 세계가 "이 방이 무엇을 낳는가" 와 "이 자리의 흙이 얼마나 짙은가" 를 든다.
//
// **자리와 성질은 세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 원천의 자리와 성질은
// 언제나 content/regions 의 두 데이터(resourceEcology + 그 방 Description 의 resource point)에서
// 다시 오고, 흔적은 그 방 Description 의 trace area 에서 다시 온다. semantic/terrain.ts 와
// 같은 갈래의 **유도된 사실**이다 (spec State 절 — "이 Cycle 은 세계 State 를 하나도 더하지 않는다").
//
// 방마다 한 번만 엮어 들고 있는다 (아래 캐시). 컴파일과 마찬가지로 순수하므로 언제 만들든
// 같은 목록이 나온다 — 되살린 세계도 같은 데이터에서 같은 원천을 다시 세운다.
//
// C012 CHANGED — 그 위에 **세계가 겪은 일**이 얹힌다. 원천의 자리와 성질은 여전히 데이터에서
// 오지만, "몇 번 캤고 고갈되었는가" 는 방의 State 가 든다 (semantic/region-state.ts 의
// RegionState.sources). 이 파일의 새 넷(sourceStateOf · traceStrengthAt · isCollapsedAt ·
// sourceConditions)은 그 State 를 **읽기만** 한다 — State 를 바꾸는 것은 채취의 전이뿐이다
// (원칙 4 · rules/mine.ts).
//
// 고갈이 세계에 하는 셋(흔적 · 통행 · 조건)은 전부 phase **하나에서 유도된다** — State 를
// 세 벌로 만들지 않는다 (spec R2 경계). 땅도 컴파일 결과도 한 값 바뀌지 않고, 그 위에
// State 가 덧씌워질 뿐이다 (C008 의 isClosedPassageAt 이 통로에 한 그대로).

import { areasOf, findPoint } from '../../../engine/world-authoring/description';
import { areaCoversPoint, tagsAt } from '../../../engine/world-authoring/query';
import {
  RECOVERY_STALLED,
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
import type { RegionState, ResourceSourceState } from './region-state';
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
  /** 몇 번 캘 수 있는가 (C012 ADDED · D4) — 그만큼 캐면 phase 가 depleted 다 */
  harvests: number;
  /** 고갈되면 무너져 그 자리를 막는가 (C012 ADDED) — 참인 원천만 붕괴 area 를 가진다 */
  collapses?: boolean;
  /** 이것이 매달린 원천의 id (C012 ADDED) — 그것이 고갈되면 이것에 조건이 걸린다 */
  dependsOn?: string;
  /** 그 원천 둘레의 흔적 op id (C012 ADDED) — 고갈되면 그 op 를 한 단계 낮춰 친다 */
  traceOp?: string;
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
      harvests: source.harvests,
      ...(source.collapses === undefined ? {} : { collapses: source.collapses }),
      ...(source.dependsOn === undefined ? {} : { dependsOn: source.dependsOn }),
      ...(source.traceOp === undefined ? {} : { traceOp: source.traceOp }),
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
 * 그 원천의 지금 — State 가 없으면 **available · taken 0** 으로 친다 (C012 ADDED).
 *
 * 없는 것을 고갈로 읽지 않는다: State 가 없는 것은 "아직 아무도 캐지 않았다" 와 같은 뜻이다
 * (규칙 없는 방의 통로를 닫힌 것으로 읽지 않는 것과 같은 규율).
 *
 * 돌려주는 값을 고쳐도 세계는 바뀌지 않는다 — State 가 없을 때는 새 객체이기 때문이다.
 * 세계를 바꾸는 것은 채취의 전이뿐이다 (원칙 4 · rules/mine.ts).
 */
export function sourceStateOf(
  states: Record<string, RegionState>,
  regionId: string,
  sourceId: string,
): ResourceSourceState {
  return states[regionId]?.sources?.[sourceId] ?? { phase: 'available', taken: 0 };
}

/**
 * RULE-TRACE-STRENGTH-001 (C012 CHANGED) — 그 자리의 흔적 세기.
 *
 * trace layer area 들의 `soil-stain:<n>` 가운데 **가장 큰 n**. 하나도 없으면 0 이고,
 * 땅을 모르는 방(Description 이 없는 id)도 0 이다.
 *
 * **합하지 않는다** — 겹침은 짙기이지 양이 아니다 (spec R5 경계 · C011 R4 그대로). 방 바닥 위에
 * 원천 둘레가 겹쳐 있으므로, 합하면 "둘레가 두 배로 짙다" 는 없는 답이 나온다.
 *
 * C012 가 더하는 것 하나 — **고갈된 원천의 traceOp 는 한 단계 낮춰 친다** (spec R5).
 * 데이터도 컴파일 결과도 한 값 바뀌지 않는다: 세기를 셀 때 그 area 만 한 단계 내려 볼 뿐이다.
 * 0 아래로는 내려가지 않는다 — 옅어짐이지 없어짐이 아니다. 낮춘 뒤에도 가장 큰 쪽이 이기므로,
 * 옅어진 둘레가 방 바닥보다 옅어지면 바닥의 값이 그대로 답이 된다.
 *
 * 어느 area 가 어느 원천의 둘레인지는 **op id** 로만 알 수 있다 (traceOp). 컴파일 결과의
 * area 는 layer · tag · shape 만 들고 op id 를 잃으므로, 여기서는 그 방 Description 의 trace
 * area 를 직접 훑는다 — Description 의 area 와 컴파일 결과의 area 는 순서도 모양도 같다
 * (engine 의 collectAreas 가 ops 순서 그대로 옮긴다). 그래서 답은 C011 과 한 값도 다르지 않다.
 */
export function traceStrengthAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): number {
  const spec = regionSpec(regionId);
  if (!spec) return 0;

  // 고갈된 원천들이 옅게 만든 op 들 — 한 방에 여럿일 수 있다.
  const dimmed = new Set<string>();
  for (const source of sourcesInRegion(regionId)) {
    if (!source.traceOp) continue;
    if (sourceStateOf(states, regionId, source.id).phase !== 'depleted') continue;
    dimmed.add(source.traceOp);
  }

  let strongest = 0;
  for (const area of areasOf(spec.space, TRACE_LAYER)) {
    if (!areaCoversPoint(area.shape, position.x, position.z)) continue;
    const level = soilStainLevel(area.tag);
    const here = dimmed.has(area.id) ? Math.max(0, level - 1) : level;
    if (here > strongest) strongest = here;
  }
  return strongest;
}

/**
 * RULE-SOURCE-COLLAPSE-001 — 그 자리가 **무너진 자리**인가 (C012 ADDED).
 *
 * 자리 판정은 컴파일 결과에 그대로 묻는다 (`tagsAt`) — 붕괴 자리는 컴파일된 resource area 이고,
 * 그 태그가 곧 원천의 id 다. State 는 그 위에 "지날 수 없음" 만 덧씌운다:
 * 높이도 표면도 traversable 격자도 한 값 바뀌지 않는다 (spec R3 경계 · C008 의 통로와 같은 형).
 *
 * 무너지는 것으로 밝혀지지 않은 원천(허물 · 더미 · 뿌리혹)은 고갈돼도 통행을 막지 않는다.
 * 땅이 없는 방 · 그런 area 밖의 자리는 언제나 거짓이다 — 이 전제가 없는 것과 같다.
 */
export function isCollapsedAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): boolean {
  const terrain = regionTerrain(regionId);
  if (!terrain) return false;
  for (const tag of tagsAt(terrain, position.x, position.z, RESOURCE_LAYER)) {
    // 태그가 원천의 id 다 — 세계가 모르는 태그는 그냥 지나간다 (지어내지 않는다).
    const source = findResourceSource(tag);
    if (!source || source.regionId !== regionId || !source.collapses) continue;
    if (sourceStateOf(states, regionId, source.id).phase === 'depleted') return true;
  }
  return false;
}

/**
 * RULE-SOURCE-CONDITION-001 — 그 원천에 **지금 걸린 조건 코드들** (C012 ADDED).
 *
 * 매달린 원천이 고갈되었으면 `recovery-stalled` 하나. 걸린 것이 없으면 빈 배열이다 —
 * 관찰에 실을지 말지는 투영이 정한다 (없으면 자리 자체를 싣지 않는다).
 *
 * 매달린 원천은 **다른 방에 있을 수 있다** (뿌리혹은 붉은눈 거목, 노두는 생체 광석 지대다) —
 * 그래서 그 원천의 방을 찾아 묻는다. 걸린다고 해서 캘 수 없는 것은 아니다 (spec R6 경계):
 * 이 코드는 **멎었다는 표시**일 뿐 아무것도 늦추지 않는다 (되돌아옴은 C013 의 것이다).
 */
export function sourceConditions(
  states: Record<string, RegionState>,
  source: ResourceSource,
): string[] {
  if (!source.dependsOn) return [];
  const upstream = findResourceSource(source.dependsOn);
  if (!upstream) return [];
  return sourceStateOf(states, upstream.regionId, upstream.id).phase === 'depleted'
    ? [RECOVERY_STALLED]
    : [];
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
