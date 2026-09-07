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
//
// C013 CHANGED — 원천이 **자리를 옮긴다**. 그래도 자리는 여전히 State 가 아니다: 마디 목록은
// 데이터(presence layer 의 뿌리 곡선)가 소유하고, State 가 드는 것은 "몇 번째 마디인가"
// (siteIndex) 하나뿐이다. 무너진 자리도 원천이 아니라 **자리**가 기억한다 (collapsedSites) —
// 원천이 떠나도 옛 자리는 무너진 채 남기 때문이다 (spec R5).

import { areasOf, curvesOf, findPoint } from '../../../engine/world-authoring/description';
import { areaCoversPoint } from '../../../engine/world-authoring/query';
import {
  CONDITION_UNMET,
  FLOW_ARRIVED,
  PRESENCE_LAYER,
  RECOVERY_STALLED,
  RESOURCE_FLOWS,
  RESOURCE_LAYER,
  REGION_SPECS,
  TRACE_LAYER,
  regionSpec,
  soilStainLevel,
  type CarrierKind,
  type OpportunityRole,
  type ResourceFlowSpec,
  type SupplyMode,
} from '../../regions';
import type { WorldPosition } from './position';
import type { RegionState, ResourceSourceState } from './region-state';

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
  /** 그 방 Local Space 의 자리 — **마디 0** 이다 (C011 · C012 가 보던 그 자리 그대로) */
  position: WorldPosition;
  /**
   * 그 원천이 설 수 있는 **마디들** (C013 ADDED · spec R4) — 데이터가 소유한다.
   *
   * siteCurve 를 밝힌 원천은 그 presence 곡선의 points 가 그대로 마디 목록이고,
   * 밝히지 않은 원천은 resource point 하나가 유일한 마디다. 언제나 하나 이상이며
   * `sites[0]` 은 `position` 과 같다.
   */
  sites: readonly WorldPosition[];
  /** 되돌아오는 데 걸리는 세계 초 (C013 ADDED · D3) — 회복 세계 과정이 읽는다 */
  recoverySeconds: number;
  /** 몇 번 캘 수 있는가 (C012 ADDED · D4) — 그만큼 캐면 phase 가 depleted 다 */
  harvests: number;
  /** 고갈되면 무너져 그 자리를 막는가 (C012 ADDED) — 참인 원천만 붕괴 area 를 가진다 */
  collapses?: boolean;
  /** 이것이 매달린 원천의 id (C012 ADDED) — 그것이 고갈되면 이것에 조건이 걸린다 */
  dependsOn?: string;
  /** 마디마다의 둘레 흔적 op id (C013 CHANGED · 옛 traceOp) — 마디 순서 그대로 */
  traceOps?: readonly string[];
  /** 마디마다의 붕괴 area op id (C013 ADDED) — traceOps 와 같은 순서. 무너지는 원천만 */
  collapseOps?: readonly string[];
}

// 방 하나당 엮기 한 번. 원천이 없는 방(백왕령)도 빈 배열로 담는다 — 그것도 답이다.
const SOURCES_BY_REGION = new Map<string, readonly ResourceSource[]>();

// id → 원천. 세계가 아는 원천 전부를 한 번 훑어 만든다 (아래 sourceIndex).
let SOURCE_INDEX: Map<string, ResourceSource> | null = null;

/**
 * RULE-RESOURCE-PLACEMENT-001 (C013 CHANGED) — 원천의 자리는 **마디 목록 + State** 다.
 *
 * 그 방 resourceEcology 의 원천마다, **같은 id 를 tag 로 가진** resource layer point 를 찾아
 * 그 자리에 세운다. 그런 point 가 없는 원천은 **서지 않는다** — 자리를 지어내지 않는다
 * (spec R4 경계). 순서는 resourceEcology.sources 의 순서 그대로다 (결정론).
 *
 * C013 이 더하는 것 하나 — `siteCurve` 를 밝힌 원천은 그 presence 곡선의 points 가 곧
 * **마디 목록**이다 (points 순서 그대로). 밝히지 않은 원천은 그 point 하나가 유일한 마디이고,
 * 그때 마디 목록은 C011 과 한 값도 다르지 않다. 어느 쪽이든 `position` 은 **마디 0** 이다 —
 * 지금 어느 마디에 서 있는가는 State 가 들고(siteIndex), 여기 있는 것은 데이터뿐이다.
 *
 * 곡선을 밝혔는데 그 곡선이 없거나 점이 하나도 없으면 point 하나로 되돌린다 — 밝힌 것을
 * 못 찾았다고 원천을 지우지 않는다 (자리는 이미 point 가 준다).
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
    const position: WorldPosition = { x: point.position.x, z: point.position.z };
    // 마디 목록도 Description 의 것이다 — 곡선의 points 를 그대로 옮긴다.
    const curve =
      spec && source.siteCurve
        ? curvesOf(spec.space, PRESENCE_LAYER, source.siteCurve)[0]
        : undefined;
    const sites: WorldPosition[] =
      curve && curve.points.length > 0
        ? curve.points.map((p) => ({ x: p.x, z: p.z }))
        : [position];
    sources.push({
      id: source.id,
      regionId,
      materialId: source.materialId,
      form: source.form,
      carrier: source.carrier,
      opportunity: source.opportunity,
      supply: source.supply,
      position,
      sites,
      recoverySeconds: source.recoverySeconds,
      harvests: source.harvests,
      ...(source.collapses === undefined ? {} : { collapses: source.collapses }),
      ...(source.dependsOn === undefined ? {} : { dependsOn: source.dependsOn }),
      ...(source.traceOps === undefined ? {} : { traceOps: source.traceOps }),
      ...(source.collapseOps === undefined ? {} : { collapseOps: source.collapseOps }),
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
  return (
    states[regionId]?.sources?.[sourceId] ?? {
      phase: 'available',
      taken: 0,
      progress: 0,
      siteIndex: 0,
    }
  );
}

/**
 * RULE-RESOURCE-PLACEMENT-001 (C013 CHANGED) — 그 원천이 **지금 서 있는 자리**.
 *
 * 마디 목록은 데이터의 것이고 "몇 번째인가" 는 State 의 것이다 — 둘을 잇는 자리가 여기다.
 * 목록 밖을 가리키는 번호(데이터가 바뀐 뒤 되살린 세계)면 마디 0 으로 되돌린다:
 * 없는 자리를 지어내지 않는다.
 */
export function sourcePositionOf(
  states: Record<string, RegionState>,
  source: ResourceSource,
): WorldPosition {
  const state = sourceStateOf(states, source.regionId, source.id);
  return source.sites[state.siteIndex] ?? source.position;
}

/**
 * RULE-SOURCE-RECOVERY-001 이 쓰는 **무너지지 않은 다음 마디** (C013 ADDED · spec R1 경계 ③).
 *
 * 지금 마디의 다음부터 한 바퀴 돌며 처음 만나는, 무너지지 않은 마디를 준다. 마디가 하나뿐인
 * 원천도 · 무너지지 않은 마디가 하나도 없는 원천도 **null** 이다 — 그때는 자리를 옮기지 않는다
 * (지날 수 없는 자리에 세우지 않는다).
 */
export function nextStandableSite(
  source: ResourceSource,
  from: number,
  collapsed: readonly number[] | undefined,
): number | null {
  const count = source.sites.length;
  for (let step = 1; step < count; step++) {
    const index = (from + step) % count;
    if (collapsed?.includes(index)) continue;
    return index;
  }
  return null;
}

/**
 * RULE-TRACE-STRENGTH-001 (C013 CHANGED) — 그 자리의 흔적 세기.
 *
 * trace layer area 들의 `soil-stain:<n>` 가운데 **가장 큰 n**. 하나도 없으면 0 이고,
 * 땅을 모르는 방(Description 이 없는 id)도 0 이다.
 *
 * **합하지 않는다** — 겹침은 짙기이지 양이 아니다 (spec R7 경계 ① · C011 R4 그대로). 방 바닥 위에
 * 원천 둘레가 겹쳐 있으므로, 합하면 "둘레가 두 배로 짙다" 는 없는 답이 나온다.
 *
 * 원천 둘레는 **지금 마디의 것만** 센다 (spec R7). 어떤 원천의 traceOps 에 든 area 는
 *   ① 그 원천의 지금 마디의 op 가 아니면 **0** — 원천이 떠난 마디의 둘레는 흙을 짙게 하지 않는다
 *   ② 지금 마디이면 phase 가 depleted 일 때만 한 단계 아래, recovering · available 이면 데이터 그대로
 *      (되돌아오는 중이면 흙이 다시 짙어진다 — SPEC-004 의 예보다)
 * 어느 원천의 둘레도 아닌 area(방 바닥)는 한 값도 바뀌지 않는다 (spec R7 경계 ②).
 * 마디가 하나뿐인 원천은 지금 마디가 언제나 0 이므로 C012 와 한 값도 다르지 않다 (경계 ③).
 * 0 아래로는 내려가지 않는다 — 옅어짐이지 없어짐이 아니다.
 *
 * 어느 area 가 어느 원천의 둘레인지는 **op id** 로만 알 수 있다 (traceOps). 컴파일 결과의
 * area 는 layer · tag · shape 만 들고 op id 를 잃으므로, 여기서는 그 방 Description 의 trace
 * area 를 직접 훑는다 — Description 의 area 와 컴파일 결과의 area 는 순서도 모양도 같다
 * (engine 의 collectAreas 가 ops 순서 그대로 옮긴다).
 */
export function traceStrengthAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): number {
  const spec = regionSpec(regionId);
  if (!spec) return 0;

  // 원천 둘레인 op 들 — 지금 마디의 것인가와 phase 를 함께 든다. 한 방에 여럿일 수 있다.
  const rimmed = new Map<string, { here: boolean; depleted: boolean }>();
  for (const source of sourcesInRegion(regionId)) {
    if (!source.traceOps) continue;
    const state = sourceStateOf(states, regionId, source.id);
    source.traceOps.forEach((op, index) => {
      rimmed.set(op, { here: index === state.siteIndex, depleted: state.phase === 'depleted' });
    });
  }

  let strongest = 0;
  for (const area of areasOf(spec.space, TRACE_LAYER)) {
    if (!areaCoversPoint(area.shape, position.x, position.z)) continue;
    const level = soilStainLevel(area.tag);
    const rim = rimmed.get(area.id);
    const here = rim
      ? rim.here
        ? Math.max(0, level - (rim.depleted ? 1 : 0))
        : 0
      : level;
    if (here > strongest) strongest = here;
  }
  return strongest;
}

/**
 * RULE-SOURCE-COLLAPSE-001 (C013 CHANGED) — 그 자리가 **무너진 자리**인가.
 *
 * 무너짐은 이제 원천이 아니라 **자리**가 기억한다 (spec R5): 그 자리를 덮은 붕괴 area 의
 * 마디 번호가 그 원천의 `collapsedSites` 에 들어 있으면 참이다. 원천이 다음 마디로 옮겨
 * 가도 옛 자리는 그대로 구덩이다 — C012 처럼 "그 원천이 지금 depleted 인가" 로 묻지 않는다.
 *
 * 어느 area 가 몇 번째 마디의 붕괴 자리인지는 **op id** 로만 알 수 있다 (collapseOps) —
 * 컴파일 결과의 area 는 op id 를 잃으므로 traceStrengthAt 과 같은 이유로 그 방 Description 의
 * resource area 를 직접 훑는다. 컴파일 결과는 한 값도 바뀌지 않는다: 높이도 표면도
 * traversable 격자도 그대로이고 그 위에 State 가 덧씌워질 뿐이다 (spec R5 경계).
 *
 * 무너지는 것으로 밝혀지지 않은 원천(허물 · 더미 · 뿌리혹)은 붕괴 area 도 collapsedSites 도
 * 없으므로 몇 번을 돌아도 통행을 막지 않는다. 땅을 모르는 방 · 그런 area 밖의 자리는 언제나 거짓이다.
 */
export function isCollapsedAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): boolean {
  const spec = regionSpec(regionId);
  if (!spec) return false;

  // 무너진 채 남은 마디의 붕괴 op 들 — 원천이 지금 어디 서 있는지는 묻지 않는다.
  const collapsed = new Set<string>();
  for (const source of sourcesInRegion(regionId)) {
    if (!source.collapseOps || !source.collapses) continue;
    const sites = sourceStateOf(states, regionId, source.id).collapsedSites;
    if (!sites || sites.length === 0) continue;
    for (const index of sites) {
      const op = source.collapseOps[index];
      if (op) collapsed.add(op);
    }
  }
  if (collapsed.size === 0) return false;

  for (const area of areasOf(spec.space, RESOURCE_LAYER)) {
    if (!collapsed.has(area.id)) continue;
    if (areaCoversPoint(area.shape, position.x, position.z)) return true;
  }
  return false;
}

/**
 * RULE-RESOURCE-FLOW-001 (C014 ADDED · spec R1) — 그 흐름이 **지금 실어 오는 중인가**.
 *
 * 세계 시각을 주기로 나눈 나머지가 활성 구간보다 작으면 활성이다. **세계 State 가 아니다** —
 * 시각에서 유도되므로 저장할 것이 없고, 되살린 세계도 같은 시각에서 같은 답을 낸다
 * (semantic/terrain.ts 의 컴파일과 같은 갈래의 유도된 사실).
 *
 * **관찰자와 무관하다** (spec R1 경계 ②) — 그 방에 몸이 없어도 물길은 불어났다 빠진다.
 * 주기가 0 이하인 흐름은 언제나 거짓이다: 나눌 수 없는 것을 나누어 없는 답을 짓지 않는다.
 * 세계 시각은 0 에서 시작해 오르기만 하지만, 음수가 들어와도 주기 안으로 접어 답한다.
 */
export function isFlowActive(flow: ResourceFlowSpec, time: number): boolean {
  if (flow.periodSeconds <= 0) return false;
  const phase = ((time % flow.periodSeconds) + flow.periodSeconds) % flow.periodSeconds;
  return phase < flow.activeSeconds;
}

/**
 * 그 원천으로 **들어오는** 흐름 (C014 ADDED) — 없으면 undefined 다.
 *
 * 데이터가 소유하는 정적 사실이다 (content/regions 의 RESOURCE_FLOWS). 한 원천에 들어오는
 * 흐름은 지금 하나뿐이므로 처음 것을 준다 — 여럿을 미리 다루지 않는다 (선행 추상화 금지).
 */
export function inflowOf(sourceId: string): ResourceFlowSpec | undefined {
  return RESOURCE_FLOWS.find((flow) => flow.to.sourceId === sourceId);
}

/**
 * RULE-SOURCE-CONDITION-001 (C013 CHANGED) — 그 원천에 **지금 걸린 조건 코드들**.
 *
 * 매달린 원천이 **available 이 아니면** `recovery-stalled` 하나. 걸린 것이 없으면 빈 배열이다 —
 * 관찰에 실을지 말지는 투영이 정한다 (없으면 자리 자체를 싣지 않는다).
 *
 * C012 는 매달린 것이 depleted 일 때만 걸었고 아무것도 늦추지 않았다. 이제 이 코드는
 * **원인이다** — 되돌아옴의 세계 과정이 이것을 보고 진행을 멈춘다 (spec R1 · R2 ·
 * simulation/source-recovery.ts). 매달린 것이 되돌아오는 중(recovering)이어도 여전히 멎어 있다:
 * 아래가 다시 available 이 되어야 위가 진행한다.
 *
 * 매달린 원천은 **다른 방에 있을 수 있다** (뿌리혹은 붉은눈 거목, 노두는 생체 광석 지대다) —
 * 그래서 그 원천의 방을 찾아 묻는다. 걸린다고 해서 캘 수 없는 것은 아니다 (spec R2 경계).
 *
 * C014 CHANGED (spec R3) — **흐름의 조건도 코드가 된다.** 유입 흐름을 가진 원천은 아직 없는
 * 동안(available 이 아닌 동안) 그 흐름이 활성이면 `flow-arrived`, 아니면 `condition-unmet` 을
 * 진다 — "지금 실려 오는 중이다" 와 "아직 그때가 아니다" 다. 그리고 그 흐름의 **출발 원천**이
 * C013 의 매달림과 같은 자리에 선다: 출발이 available 이 아니면 같은 `recovery-stalled` 다.
 *
 * **규칙은 어느 원천이 흐름을 가졌는지 이름으로 알지 못한다** — 아는 것은 "유입 흐름을 가진
 * 원천" 이라는 형뿐이고, 어느 방의 무엇이 어디로 실려 오는지는 데이터에만 있다 (R13).
 *
 * 여기 실리는 코드가 곧 **되돌아옴을 멎게 하는 원인**이다 (simulation/source-recovery.ts) —
 * 표시와 원인이 같은 판정이라는 C013 의 규율 그대로다. 셋 중 `flow-arrived` 만이 진행을
 * 허락한다: 실려 오는 중인 것은 되돌아오는 중인 것이기 때문이다.
 */
export function sourceConditions(
  states: Record<string, RegionState>,
  source: ResourceSource,
  time: number,
): string[] {
  const codes: string[] = [];
  const inflow = inflowOf(source.id);

  // ① 매달림 — C013 그대로다. 흐름을 가진 원천에게는 그 흐름의 **출발 원천**이 곧 그 매달림이다
  // (spec R3 — 호수 바닥을 캐 놓으면 물길이 불어도 어귀에 오는 것이 없다).
  const dependsOn = source.dependsOn ?? inflow?.from.sourceId;
  const upstream = dependsOn ? findResourceSource(dependsOn) : undefined;
  if (upstream && sourceStateOf(states, upstream.regionId, upstream.id).phase !== 'available') {
    codes.push(RECOVERY_STALLED);
  }

  // ② 흐름의 때 — 아직 없는 원천에만 묻는다 (spec R3 경계). 거기 있는 것을 두고
  // "실려 오는 중" 도 "아직 그때가 아니다" 도 말할 것이 없기 때문이다.
  if (inflow && sourceStateOf(states, source.regionId, source.id).phase !== 'available') {
    codes.push(isFlowActive(inflow, time) ? FLOW_ARRIVED : CONDITION_UNMET);
  }

  return codes;
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
