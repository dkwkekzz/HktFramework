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

// C016 CHANGED — 원천이 **철을 탄다**. 그래도 자리도 성질도 여전히 데이터의 것이다: 밝힌 원천은
// "지금 철이 그 목록에 드는가" 만 더 물어지고(isSourcePresentAt · sourceConditions), 밝히지 않은
// 원천은 어느 철에도 지금 그대로다. 방마다의 캐시는 **정적 사실의 것**이고 철은 정적이 아니므로,
// 거르는 자리는 캐시 밖에 따로 둔다 (spec R6).

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
  traceLevel,
  type CarrierKind,
  type HazardOverlay,
  type OpportunityRole,
  type RegionPhase,
  type ResourceFlowSpec,
  type SeasonId,
  type SupplyMode,
} from '../../regions';
import { leavingLifeSiteOf, lifeTraceOverlayIn, populationValueOf } from './life';
import type { WorldPosition } from './position';
import { isPassingRegion, leavingRouteOf, type PresencePassState } from './presence';
import { NOT_THIS_HOUR, NOT_THIS_SEASON, isDayPhaseListed, isSeasonListed } from './region-phase';
import type { RegionState, ResourceSourceState } from './region-state';
import type { WorldState } from './world-state';

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
  /**
   * 그 원천이 **서는 철들** (C016 ADDED · spec R6) — 데이터의 occurrence 를 그대로 옮긴 것이다.
   *
   * 밝히지 않은 원천은 어느 철에도 선다 (지금까지의 세계 그대로). 정적 사실이므로 캐시에
   * 함께 담기고, **지금 서는가**는 시각과 함께 물어야 하므로 캐시 밖에서 판정된다.
   */
  occurrenceSeasons?: readonly SeasonId[];
  /**
   * 그 원천이 **서는 낮밤들** (RoomBearsMaterial 실주행 판정 ADDED) — 데이터의 dayPhases 그대로다.
   * 밝히지 않은 원천은 낮에도 밤에도 선다. occurrenceSeasons 와 같은 어법의 다른 축이다.
   */
  occurrenceDayPhases?: readonly ('DAY' | 'NIGHT')[];
  /**
   * 마디마다의 **깨진 자리 자락** (C020 ADDED · spec R4) — 데이터의 depletedHazards 그대로다.
   *
   * traceOps 와 같은 순서이고, 그 마디가 깨진 마디 목록에 든 동안에만 걸린다
   * (depletedOverlaysIn). 밝히지 않은 원천은 몇 번을 캐도 걸리는 것이 한 글자도 늘지 않는다.
   */
  depletedHazards?: readonly HazardOverlay[];
  /**
   * 철마다의 되돌아옴 **배속** (C020 ADDED · spec R3) — 데이터의 recoverySpeed 그대로다.
   *
   * 되돌아옴의 세계 과정(RULE-RECOVERY-SPEED-001)만이 읽는다. 밝히지 않은 원천은
   * 어느 철에도 배속 1 이다 — 지금까지의 세계 그대로다.
   */
  recoverySpeed?: Readonly<Partial<Record<SeasonId, number>>>;
  /**
   * **다시 자란 자리**의 조건 코드 (C021 ADDED · spec R3) — 데이터의 regrownCode 그대로다.
   *
   * 밝히지 않은 원천은 어디에 서 있든 걸리는 것이 한 글자도 늘지 않는다 (숲의 노두가 그렇다) —
   * occurrence · recoverySpeed 를 밝히지 않은 원천이 그 계통 밖인 것과 같은 규율이다.
   */
  regrownCode?: string;
  /**
   * 그 되돌아옴이 **전제하는 개체군** (C024 ADDED · spec R1 · SPEC-001) — 데이터의 recoveryLife 그대로다.
   *
   * C022 가 **참조만** 세워 둔 자리다. 아래 `recoveryByLife` 와 **짝으로만** 뜻을 가진다:
   * 하나만 밝힌 원천은 한 값도 달라지지 않는다 (없는 것을 지어내지 않는다).
   */
  recoveryLife?: string;
  /**
   * 그 개체군의 **값마다의 되돌아옴 배속** (C024 ADDED) — 데이터의 recoveryByLife 그대로다.
   *
   * 되돌아옴의 세계 과정(RULE-RECOVERY-SPEED-001)과 조건 코드(RULE-SOURCE-CONDITION-001)가
   * **같은 하나**를 읽는다 (recoveryLifeSpeed). 밝히지 않은 원천은 어느 값에도 배속 1 이다.
   */
  recoveryByLife?: readonly number[];
  /**
   * 그 배속이 0 이라 **멎어 있는 동안** 지는 조건 코드 (C024 ADDED) — 데이터의 noOwnerCode 그대로다.
   * 밝히지 않은 원천은 멎어도 걸리는 것이 한 글자도 늘지 않는다.
   */
  noOwnerCode?: string;
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
      // C016 ADDED — 출현 철 목록. 밝히지 않은 원천은 자리 자체가 없다 (철을 타지 않는다).
      ...(source.occurrence === undefined ? {} : { occurrenceSeasons: source.occurrence.seasons }),
      // 낮밤을 타는 원천 (RoomBearsMaterial 실주행 판정) — 밝히지 않은 원천은 자리 자체가 없다
      ...(source.dayPhases === undefined ? {} : { occurrenceDayPhases: source.dayPhases }),
      // C020 ADDED — 깨진 마디의 자락들과 철마다의 되돌아옴 배속. 둘 다 밝히지 않은 원천은
      // 자리 자체가 없다 (빈 목록 · 배속 1 로 지어내지 않는다).
      ...(source.depletedHazards === undefined ? {} : { depletedHazards: source.depletedHazards }),
      ...(source.recoverySpeed === undefined ? {} : { recoverySpeed: source.recoverySpeed }),
      // C021 ADDED — 다시 자란 자리의 조건 코드. 밝히지 않은 원천은 자리 자체가 없다
      // (빈 글자로 지어내지 않는다 · depletedHazards 의 선례 그대로).
      ...(source.regrownCode === undefined ? {} : { regrownCode: source.regrownCode }),
      // C024 ADDED — 되돌아옴이 매인 개체군과 그 값마다의 배속, 그리고 멎었을 때의 코드.
      // 셋 다 밝히지 않은 원천은 자리 자체가 없다 (recoverySpeed 의 선례 그대로 —
      // 빈 목록이나 배속 1 로 지어내지 않는다).
      ...(source.recoveryLife === undefined ? {} : { recoveryLife: source.recoveryLife }),
      ...(source.recoveryByLife === undefined ? {} : { recoveryByLife: source.recoveryByLife }),
      ...(source.noOwnerCode === undefined ? {} : { noOwnerCode: source.noOwnerCode }),
    });
  }

  SOURCES_BY_REGION.set(regionId, sources);
  return sources;
}

/**
 * RULE-RESOURCE-PLACEMENT-001 (C016 CHANGED · spec R6) — 그 원천이 **지금 철에 서는가**.
 *
 * 출현 철 목록을 밝힌 원천은 지금 철이 그 목록에 없으면 서지 않는다 — 관찰 결과에 실리지
 * 않고, 그 자리에는 아무것도 없다. 밝히지 않은 원천은 언제나 선다 (spec R6 경계 ②).
 *
 * **거르는 자리가 sourcesInRegion 밖인 이유** — 그 함수는 방마다 한 번만 엮어 캐시에 담는다.
 * 캐시는 자리 · 성질 · 마디 같은 **정적 사실**의 것이고 철은 정적이 아니다. 캐시 안에서
 * 거르면 처음 물은 철의 목록이 그대로 굳어 다음 철에 그 방이 영영 달라지지 않는다.
 *
 * **그 자리의 흔적(흙)은 이것과 무관하다** (spec R6 경계 ①) — 원천이 없다고 땅이 달라지지
 * 않는다. 흔적은 여전히 Description 의 trace area 에서 오고, 이 판정을 읽지 않는다.
 */
export function isSourcePresentAt(source: ResourceSource, time: number): boolean {
  // 철과 낮밤 둘 다 들어야 선다 — 어느 쪽이든 밝히지 않은 것은 언제나 참이다
  return (
    isSeasonListed(source.occurrenceSeasons, time) &&
    isDayPhaseListed(source.occurrenceDayPhases, time)
  );
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
 * RULE-SOURCE-RECOVERY-001 이 쓰는 **설 수 있는 다음 마디** (C013 ADDED · spec R1 경계 ③).
 *
 * 지금 마디의 다음부터 한 바퀴 돌며 처음 만나는, **설 수 있는** 마디를 준다. 마디가 하나뿐인
 * 원천도 · 설 수 있는 마디가 하나도 없는 원천도 **null** 이다 — 그때는 자리를 옮기지 않는다
 * (지날 수 없는 자리에 세우지 않는다).
 *
 * C020 CHANGED — 건너뛰는 것은 **무너지는 원천의** 깨진 마디뿐이다. C013 까지는 깨진 마디를
 * 가진 원천이 곧 무너지는 원천이었으므로 둘이 같은 물음이었는데, 이제 갈린다: 결정면은
 * 마디가 깨져도 **그 자리를 지날 수 있으므로**(collapses 를 밝히지 않았다 · C020 spec R4
 * 경계 ③) 그 마디에 다시 설 수 있어야 한다 — 마디를 한 바퀴 돌면 처음 마디로 돌아온다
 * (C020 SPEC-004 경계 ②). 무너지는 원천(노두)의 답은 한 값도 달라지지 않는다: 깨진 마디가
 * 곧 지날 수 없는 자리이므로 그때는 여전히 건너뛴다.
 */
export function nextStandableSite(
  source: ResourceSource,
  from: number,
  collapsed: readonly number[] | undefined,
): number | null {
  const count = source.sites.length;
  for (let step = 1; step < count; step++) {
    const index = (from + step) % count;
    if (source.collapses && collapsed?.includes(index)) continue;
    return index;
  }
  return null;
}

/**
 * RULE-TRACE-STRENGTH-001 (C013 CHANGED · C020 CHANGED) — 그 자리의 흔적 세기.
 *
 * trace layer area 들이 밝힌 단계 가운데 **가장 큰 것**. 하나도 없으면 0 이고,
 * 땅을 모르는 방(Description 이 없는 id)도 0 이다.
 *
 * C020 CHANGED (spec R8) — **어휘가 둘이 되었다.** 숲의 흙 사다리(`soil-stain:<n>`)와
 * 협곡의 숨 사다리(`frost-breath:<n>`)를 `traceLevel` 하나가 읽는다 — 기제는 한 줄도
 * 바뀌지 않았고(아래 옅어짐 그대로) 어느 어휘인지를 여기가 묻지 않는다. 방마다 어느 어휘를
 * 쓰는지는 그 방 Description 의 태그에만 있고, 그래서 숲의 방에서 읽히는 단계는 한 값도
 * 달라지지 않는다 (spec R8 경계).
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
 *
 * C022 CHANGED (RULE-LIFE-SITE-PHASE-001 · C022 spec R4) — **탄생지도 자기 자락을 건다.**
 * 위상을 거는 원인이 여섯째가 되었고(철 · 소란 · 지나가는 것 · 상시 · 고갈 · **탄생지**)
 * 기제는 한 줄도 바뀌지 않았다: 그 방의 탄생지가 밝힌 자락은
 *   ① 그 자락이 밝힌 조건 코드가 지금 걸려 있으면 **0** — 그 자락이 서지 않는다
 *   ② 그 탄생지가 결속 중이면 데이터의 단계에서 **한 단계 아래** (재료가 그리로 간다)
 * 이고, 어느 것도 아니면 데이터 그대로다. 판정은 여기서 하지 않는다 — semantic/life.ts 의
 * `lifeTraceOverlayIn` 이 답하는 그것을 그대로 읽는다 (표시와 원인이 같은 판정이라는 규율).
 *
 * **원천 쪽 판정은 한 줄도 바뀌지 않는다** — 원천의 둘레도 아니고 탄생지의 자락도 아닌
 * area(방 바닥)는 여전히 데이터 그대로다 (C011 R4 · C012 spec R7 경계 ②). 탄생지를 밝히지
 * 않은 방은 이 Cycle 전과 한 값도 다르지 않다.
 *
 * `time` 은 탄생지의 **요구 판정**에만 쓰인다 (비가 시각에서 유도되기 때문이다). 밝히지
 * 않으면 0 이다 — 원천 쪽 판정은 시각을 묻지 않으므로 그 답은 어느 시각에도 같다.
 */
export function traceStrengthAt(
  states: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
  time = 0,
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

  // 탄생지가 건 자락들 — 가려졌는가 · 옅어졌는가 (C022 ADDED). 탄생지 없는 방은 빈 표다.
  const lifeOverlay = lifeTraceOverlayIn(states, regionId, time);

  let strongest = 0;
  for (const area of areasOf(spec.space, TRACE_LAYER)) {
    if (!areaCoversPoint(area.shape, position.x, position.z)) continue;
    const level = traceLevel(area.tag);
    const rim = rimmed.get(area.id);
    const life = lifeOverlay.get(area.id);
    const here = rim
      ? rim.here
        ? Math.max(0, level - (rim.depleted ? 1 : 0))
        : 0
      : life
        ? life.hidden
          ? 0
          : Math.max(0, level - (life.faded ? 1 : 0))
        : level;
    if (here > strongest) strongest = here;
  }
  return strongest;
}

/**
 * 그 방의 **흔적 area** 하나가 이 자리를 덮는가 — op id 로 짚는다 (C022 ADDED).
 *
 * 흔적 area 를 op id 로 짚는 자리는 이 파일 하나다 (위 traceStrengthAt 이 그렇게 하는 그
 * 이유 그대로 — 컴파일 결과의 area 는 op id 를 잃는다). 그래서 자락 위에 선 것을 묻는
 * 다른 자리(semantic/life.ts)도 여기로 와서 묻는다: 땅을 읽는 자리를 늘리지 않는다
 * (C005 R-009 가 지키는 그 규율).
 *
 * **게임 명사를 알지 못한다** — 방과 op 이름과 자리 하나를 받을 뿐이다. 땅을 모르는 방 ·
 * 그런 op 가 없는 방은 언제나 거짓이다.
 */
export function traceAreaCoversAt(
  regionId: string,
  opId: string,
  position: WorldPosition,
): boolean {
  const spec = regionSpec(regionId);
  if (!spec) return false;
  const area = areasOf(spec.space, TRACE_LAYER).find((it) => it.id === opId);
  if (!area) return false;
  return areaCoversPoint(area.shape, position.x, position.z);
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
 * 그 원천이 **깨진 마디를 기억하는가** (C020 ADDED · spec R4).
 *
 * C013 까지는 물음이 하나였다 — "무너지는가"(collapses). 무너지는 원천만이 깨진 마디를
 * 기억할 이유가 있었기 때문이다 (그 자리가 지날 수 없게 되므로). 이제 둘째 이유가 났다:
 * **깨진 마디가 자락을 거는 원천**도 그 번호를 기억해야 한다 (depletedHazards). 그래서
 * 기억하는 이유가 둘이 되었고, 기억하는 **자리**는 여전히 하나다 (collapsedSites).
 *
 * 채취의 전이(RULE-MINE-COMPLETE-001)와 초기 배치 손잡이가 이 한 물음을 읽는다 — 두 벌로
 * 나누면 캐서 닿는 State 와 손잡이가 세우는 State 가 갈린다. 밝히지 않은 원천은 몇 번을
 * 캐도 이 자리가 서지 않는다 (지금까지의 세계 그대로).
 */
export function remembersBrokenSites(source: ResourceSource): boolean {
  return source.collapses === true || (source.depletedHazards?.length ?? 0) > 0;
}

/**
 * RULE-DEPLETED-HAZARD-001 (C020 ADDED · spec R4 · SPEC-005) —
 * 그 방에서 **깨진 마디**들이 거는 덧씌움들.
 *
 * 위상을 거는 **원인이 다섯째**가 되었다 (철 · 소란 · 지나가는 것 · 늘 서 있는 것 · **고갈**).
 * 형은 C019 의 RegionPhase 그대로이고 거는 쪽이 하나 늘었을 뿐이다 — 그래서 이 답은
 * 철 · 깨어남 · 지나가는 것 · 상시의 것과 **함께** 걸린다 (spec R4 경계 ②).
 *
 * 읽는 것은 C013 이 세운 그 State 하나다 (collapsedSites) — 그 마디가 깨진 마디 목록에
 * 들어 있으면 그 번호의 자락이 걸린다. **원천이 옮겨 가도 옛 마디의 자락은 그대로 걸린다**
 * (spec R4 경계 ①) — 지금 마디가 어디인지 묻지 않기 때문이다 (무너진 자리를 자리가
 * 기억하는 그 어법 그대로 · isCollapsedAt 이 하는 그대로).
 *
 * **땅은 한 값도 바뀌지 않는다** (경계 ③) — 이 답은 hazard layer 의 자락을 가리킬 뿐이고,
 * 통행 격자도 hash 도 건드리지 않는다. 무너짐(C012)과 갈리는 자리가 여기다.
 *
 * 차례는 그 방 원천의 차례(sourcesInRegion)이고 원천 안에서는 마디 번호 차례다 — State 의
 * 배열 순서에 기대지 않는다 (결정론). 밝히지 않은 원천 · 깨진 마디가 없는 원천은 아무것도
 * 내지 않고, 그때 답은 빈 배열이다 (spec R4 ELSE — 아무것도 늘지 않는다).
 *
 * **규칙은 그것이 결정면인지 알지 못한다** — 아는 것은 "마디마다의 자락을 밝힌 원천" 이라는
 * 형뿐이고, 무엇이 무엇을 거는지는 데이터에만 있다 (R13 · C004 가 세운 규율).
 */
export function depletedOverlaysIn(state: WorldState, regionId: string): RegionPhase[] {
  const phases: RegionPhase[] = [];
  for (const source of sourcesInRegion(regionId)) {
    const hazards = source.depletedHazards;
    if (!hazards || hazards.length === 0) continue;
    const broken = sourceStateOf(state.regionStates, regionId, source.id).collapsedSites;
    if (!broken || broken.length === 0) continue;
    const hazardExtend: HazardOverlay[] = [];
    hazards.forEach((overlay, index) => {
      if (broken.includes(index)) hazardExtend.push(overlay);
    });
    if (hazardExtend.length > 0) phases.push({ hazardExtend });
  }
  return phases;
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
 * RULE-RECOVERY-SPEED-001 (C024 ADDED · spec R1 · SPEC-001) —
 * 그 원천의 되돌아옴에 **살아 있는 것이 곱하는 배속**.
 *
 * 값마다의 배속과 그 개체군을 **둘 다** 밝힌 원천만 1 이 아닌 답을 낸다 — 하나만 밝힌
 * 원천도, 아무것도 밝히지 않은 원천도 1 이다 (spec SPEC-001 경계 ④: 밝히지 않은 원천은
 * 한 값도 달라지지 않는다). 철의 배속(recoverySpeed)이 그런 그대로다.
 *
 *   값이 목록보다 크면 **목록의 마지막**이 답이다 (SPEC-001 ③)
 *   세계가 모르는 개체군은 값이 0 으로 읽혀 **첫 자리**가 답이다 (경계 ⑤ — 끊긴 참조는
 *   아무 일도 하지 않고, 데이터가 첫 자리를 0 으로 두었으면 거기서 멎는다)
 *
 * **이 답을 읽는 자리는 둘이고 그 둘이 같은 하나를 본다** — 진행을 싣는 세계 과정
 * (simulation/source-recovery.ts)과 멎음의 코드를 거는 조건(아래 sourceConditions)이다.
 * 그래서 관찰에 실리는 "벗을 것이 없다" 와 실제로 멎는 것이 **같은 판정**이다
 * (C013 이 `recovery-stalled` 에 세운 그 규율 그대로 · spec R2 — 표시가 아니라 원인이다).
 *
 * **규칙은 어떤 생명도 이름으로 알지 못한다** (Life F13 · R13) — 아는 것은 "값마다의 배속을
 * 밝힌 원천" 이라는 형과 그 개체군의 수 하나뿐이고, 그것이 광식충인지 거목균인지 · 어느
 * 값에서 얼마나 빨라지는지는 전부 데이터(content/regions)에 있다.
 */
export function recoveryLifeSpeed(
  states: Record<string, RegionState>,
  source: ResourceSource,
): number {
  const speeds = source.recoveryByLife;
  const populationId = source.recoveryLife;
  if (!speeds || speeds.length === 0 || populationId === undefined) return 1;
  const value = Math.max(0, Math.floor(populationValueOf(states, populationId)));
  return speeds[Math.min(value, speeds.length - 1)] ?? 1;
}

/**
 * RULE-SOURCE-CONDITION-001 · RULE-SOURCE-REGROWN-001
 * (C013 CHANGED · C021 CHANGED) — 그 원천에 **지금 걸린 조건 코드들**.
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
 * C016 CHANGED (spec R7) — **철도 조건이다.** 출현 철을 밝힌 원천이 그 철이 아니면
 * `not-this-season` 이 걸린다 — 바닥남(다 캤다)과도 되돌아오는 중과도 갈리는 말이고,
 * 걸린 동안에는 되돌아옴의 진행이 오르지 않는다 (그 철이 아니면 되돌아올 자리도 없다).
 *
 * 여기 실리는 코드가 곧 **되돌아옴을 멎게 하는 원인**이다 (simulation/source-recovery.ts) —
 * 표시와 원인이 같은 판정이라는 C013 의 규율 그대로다. 셋 중 `flow-arrived` 만이 진행을
 * 허락한다: 실려 오는 중인 것은 되돌아오는 중인 것이기 때문이다.
 *
 * C018 CHANGED (spec R7 · 기본형 ⑧) — **지나가는 것도 조건이다.** 누군가 지나가며 남기는
 * 원천은 그것이 지금 지나고 있지 않은 동안 `condition-unmet` 을 진다 — **새 코드를 만들지
 * 않는다**: 물길이 아직 오지 않은 것과 관찰자가 보는 사실이 같기 때문이다(거기 지금 없다).
 * 걸린 동안에는 되돌아옴의 진행이 오르지 않는다 — 되돌리는 것은 시간이 아니라 **다시
 * 지나가는 것**이다 (SPEC-006 경계 ②).
 *
 * 그래서 **지나감들의 지금을 함께 받는다.** 밝히지 않으면 아무것도 지나고 있지 않은 것으로
 * 친다 — 그것도 답이다 (남기는 원천에는 조건이 걸리고, 나머지 원천은 한 값도 달라지지 않는다).
 *
 * C021 CHANGED (RULE-SOURCE-REGROWN-001 · spec R3) — **자리도 조건이다.** 마디를 여럿 가진
 * 원천이 처음 마디가 아닌 자리에 서 있는 동안 그 원천이 밝힌 코드가 하나 실린다. 앞의
 * 것들과 갈리는 갈래다 — 저것들은 "지금 없다" 의 사유이고 이것은 **거기 있는 것에 대한 말**
 * 이라, 여기 실렸어도 되돌아옴의 진행을 멎게 하지 않는다 (표시와 원인이 같은 판정이라는
 * C013 의 규율에서 처음 갈라지는 자리이고, 그래서 아래에서 **맨 나중**에 붙는다).
 *
 * C024 CHANGED (spec R2 · SPEC-002) — **살아 있는 것도 조건이다.** 값마다의 되돌아옴 배속을
 * 밝힌 원천이 아직 거기 없고 그 배속이 지금 0 이면, 그 원천이 밝힌 멎음 코드가 실린다
 * (`no-molter` · `no-decomposer`). ① 의 매달림과 갈리는 말이다 — 저것은 "아래가 끊겼다" 이고
 * 이것은 "벗을 것이 없다" 다. 이 코드도 **원인**이지만 되돌아옴의 세계 과정이 그것을 읽지는
 * 않는다: 진행에 곱해지는 배속이 0 이라 저절로 멎기 때문이다 (recoveryLifeSpeed) — 판정이
 * 하나이므로 표시와 원인이 갈릴 자리가 없고, 규칙이 데이터의 글자를 알 자리도 생기지 않는다.
 */
export function sourceConditions(
  states: Record<string, RegionState>,
  source: ResourceSource,
  time: number,
  presences: Record<string, PresencePassState> = {},
): string[] {
  const codes: string[] = [];
  const inflow = inflowOf(source.id);

  // ⓪ 철 (C016 ADDED · spec R7) — 출현 철을 밝힌 원천이 지금 그 철이 아니면 `not-this-season`.
  // 먼저 묻는 이유는 뜻이다: 거기 **지금 없다**는 것이 다른 무엇보다 앞선 사실이다.
  // 그리고 이 코드도 원인이다 — 되돌아옴의 세계 과정이 이것을 보고 진행을 멈춘다
  // (simulation/source-recovery.ts). 그 철이 아니면 되돌아오는 일도 일어나지 않는다.
  // 철이 먼저, 낮밤이 그 다음이다 — 철이 아니면 낮밤을 묻지 않는다 (한 원천에 두 "때가 아니다" 를
  // 함께 싣지 않는다: 관찰자가 기다려야 할 것은 먼 쪽 하나다)
  if (!isSeasonListed(source.occurrenceSeasons, time)) codes.push(NOT_THIS_SEASON);
  else if (!isDayPhaseListed(source.occurrenceDayPhases, time)) codes.push(NOT_THIS_HOUR);

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

  // ③ 지나가는 때 (C018 ADDED · spec R7) — 누군가 남기는 원천이 아직 거기 없고 그것이 지금
  // 지나가고 있지도 않으면 `condition-unmet`. 흐름의 ② 와 **같은 코드**이고 같은 뜻이다:
  // 아직 그때가 아니다 (기본형 ⑧ — 흐름이 멎은 것과 **같은 사실**이다: 거기 없다는 것).
  //
  // **아직 없는 원천에만 묻는 것도 ② 그대로다** (C014 spec R3 경계) — 거기 서 있는 것을
  // 두고 "아직 그때가 아니다" 라고 말할 것이 없기 때문이다. 지나간 뒤 서 있는 비늘은
  // 캘 수 있고, 그때 이 코드는 걸리지 않는다.
  //
  // 묻는 것은 "지나고 있는가" 가 아니라 "**여기를** 지나고 있는가" 다 (SPEC-006 경계 ③) —
  // 휘어 다른 방으로 간 지나감은 이 방에서 아무 일도 하지 않으므로, 그 동안에도 멎어 있어야
  // "시간이 아니라 다시 지나가는 것이 되돌린다" 가 참이 된다 (경계 ②).
  //
  // 규칙은 무엇이 그것을 남기는지 이름으로 알지 못한다 — "누군가 남기는 원천" 이라는 형과
  // "그것이 지금 지나는가" 라는 값 하나뿐이고, 무엇이 무엇을 남기는지는 데이터에만 있다.
  const leaving = leavingRouteOf(source.id);
  if (
    leaving &&
    sourceStateOf(states, source.regionId, source.id).phase !== 'available' &&
    !isPassingRegion(presences, leaving.id, source.regionId, time)
  ) {
    codes.push(CONDITION_UNMET);
  }

  // ④ 태어남이 세우는 자리 (C023 ADDED · spec R4 · SPEC-004) — 어느 탄생지가 `leaves` 로
  // 밝힌 원천이 아직 거기 없으면 `condition-unmet`. ② ③ 과 **같은 코드**이고 같은 뜻이다:
  // 아직 그때가 아니다 (물길이 오지 않은 것 · 아직 지나가지 않은 것과 **같은 사실**이다 —
  // 거기 지금 없다는 것). 걸린 동안에는 되돌아옴의 진행이 오르지 않으므로, 시간이 아무리
  // 흘러도 스스로 돌아오지 않는다 — 되돌리는 것은 **다음 탄생**이고 그것은 RULE-LIFE-BIRTH-001
  // 이 한다 (C018 이 지나가는 것에 세운 그 어법 그대로 · 새 코드를 만들지 않는다).
  //
  // **아직 없는 원천에만 묻는 것도 ② ③ 그대로다** — 터진 뒤 서 있는 껍질은 캘 수 있고,
  // 그때 이 코드는 걸리지 않는다. 규칙은 무엇이 그것을 세우는지 이름으로 알지 못한다:
  // "어느 탄생지가 세우는 원천" 이라는 형뿐이고, 무엇이 무엇을 세우는지는 데이터에만 있다.
  if (
    leavingLifeSiteOf(source.id) &&
    sourceStateOf(states, source.regionId, source.id).phase !== 'available'
  ) {
    codes.push(CONDITION_UNMET);
  }

  // ⑤ 살아 있는 것이 없다 (C024 ADDED · spec R2 · SPEC-002) — 값마다의 배속을 밝힌 원천이
  // 아직 거기 없고 그 배속이 지금 0 이면, 그 원천이 밝힌 **멎음 코드**가 실린다.
  //
  // ① 의 매달림과 갈리는 말이다: 저것은 "아래가 끊겼다" 이고 이것은 **"벗을 것이 없다"** 다.
  // 그래서 밑동의 허물이 돌아오지 않을 때 관찰자가 사슬이 아니라 **개체군**을 의심한다.
  //
  // **아직 없는 원천에만 묻는 것은 ② ③ ④ 그대로다** (SPEC-002 경계 ③) — 거기 서 있는 것을
  // 두고 "벗을 것이 없다" 고 말할 것이 없다. 밝히지 않은 원천에는 한 글자도 늘지 않는다 (경계 ④).
  //
  // **되돌아옴의 세계 과정은 이 코드를 읽지 않는다** — 읽을 필요가 없다: 진행에 곱해지는
  // 배속이 0 이므로 저절로 멎는다 (recoveryLifeSpeed). 판정이 하나이므로 표시와 원인이
  // 갈릴 자리가 없고, 규칙이 데이터의 글자를 알아야 할 자리도 생기지 않는다 (R13).
  const noOwner = source.noOwnerCode;
  if (
    noOwner !== undefined &&
    sourceStateOf(states, source.regionId, source.id).phase !== 'available' &&
    recoveryLifeSpeed(states, source) === 0
  ) {
    codes.push(noOwner);
  }

  // ⑥ 다시 자란 자리 (C021 ADDED · RULE-SOURCE-REGROWN-001 · spec R3 · SPEC-005) —
  // 마디를 여럿 가진 원천이 **처음 마디가 아닌 자리에 서 있는 동안** 그 원천이 밝힌 코드가
  // 실린다. 앞의 것들과 갈리는 자리가 여기다: 저것들은 "지금 없다" 의 사유이고 이것은
  // **거기 있는 것에 대한 말**이다 — 그래서 되돌아옴의 진행을 한 톨도 멎게 하지 않는다
  // (simulation/source-recovery.ts 는 앞의 코드들만 읽는다). 캘 수 있는가도 달라지지 않는다.
  //
  // **어디서 옮겨 왔는지도 몇 번째 마디인지도 싣지 않는다** (경계 ③) — 실리는 것은 코드
  // 하나뿐이고, "여기서 다시 자란 것이다" 까지다 (C013 · C020 이 세운 규율 그대로).
  //
  // 마디가 하나뿐인 원천 · 처음 마디에 선 원천 · 밝히지 않은 원천에는 걸리지 않는다
  // (경계 ① ②). 규칙은 그것이 결정면인지 이름으로 알지 못한다 — 마디의 수와 지금 번호,
  // 그리고 원천이 밝힌 글자 하나를 읽을 뿐이다.
  const regrown = source.regrownCode;
  if (
    regrown !== undefined &&
    source.sites.length > 1 &&
    sourceStateOf(states, source.regionId, source.id).siteIndex !== 0
  ) {
    codes.push(regrown);
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
