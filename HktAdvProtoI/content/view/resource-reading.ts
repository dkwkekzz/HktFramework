// Resource Reading — 원천의 **지금** 을 화면이 읽는 자리 (C012 ADDED · C013 CHANGED).
//
// 세계가 싣는 것은 그 원천의 state · position · siteIndex · collapsedSites 뿐이다. 그것이
// 세계에 남기는 나머지 — 옅어진 흔적 · 무너져 지날 수 없는 자리 · 마디의 좌표 — 는
// **투영되지 않는다**: 관찰자가 자기 content/regions 와 실려 온 값으로 스스로 얻는다
// (spec Observable). 땅을 스스로 컴파일해 그리는 C005~C007 · 흔적을 스스로 얻는 C011 의 규율 그대로다.
//
// **세계의 판정과 같은 규칙이어야 한다** (spec R5 · R7). 갈리면 판이 말하는 것과 발밑이
// 어긋난다 — 그래서 무너진 자리는 그리는 목록과 지나는 판정이 **같은 함수 하나**에서 나온다.

import type { AreaOp } from '../../engine/world-authoring/description';
import { areasOf } from '../../engine/world-authoring/description';
import { areaCoversPoint } from '../../engine/world-authoring/query';
import type { GameViewSnapshot } from '../protocol/gameview';
import {
  RESOURCE_LAYER,
  TRACE_LAYER,
  regionSpec,
  soilStainLevel,
  type ResourceSourceSpec,
} from '../regions/index';
import { regionTerrain } from './terrain-presentation';

/** 원천의 Semantic Role — 봉투에서 원천을 가려내는 유일한 값이다 (role-presentation 의 키와 같다) */
const SOURCE_ROLE = 'resource-source';

/** 고갈된 원천의 state 코드 — 봉투가 싣고 오는 값 그대로다 (code-text 의 `depleted` 와 같은 코드) */
const PHASE_DEPLETED = 'depleted';

/** 아직 그 자리에 있는 원천의 state 코드 — 모르는 원천을 이 값으로 읽는다 (아래 DEFAULT_OBSERVED) */
const PHASE_AVAILABLE = 'available';

/**
 * 관찰된 그 원천의 지금 (C013 CHANGED — C012 는 phase 문자열 하나였다).
 *
 * 자리를 옮기는 원천이 생기면서 phase 하나로는 흔적도 무너짐도 가릴 수 없게 되었다:
 * 흔적은 **지금 선 마디**의 것이고, 무너짐은 원천이 아니라 **자리**가 기억한다 (spec R5 · R7).
 */
export interface ObservedSource {
  phase: string;
  /** 실려 오지 않았으면 0 — 마디가 하나뿐인 원천이다 */
  siteIndex: number;
  /** 실려 오지 않았으면 빈 목록 — 무너진 자리가 없다 */
  collapsedSites: readonly number[];
}

/** 원천 id → 지금. 봉투에 없는 원천은 **자리 자체가 없다** (모름을 고갈로 읽지 않는다) */
export type SourcePhases = Readonly<Record<string, ObservedSource>>;

/** 아무것도 실려 오지 않았을 때 — 모든 원천이 "모름" 이고, 그러면 아무것도 옅어지지 않는다 */
export const NO_SOURCE_PHASES: SourcePhases = {};

/**
 * 모르는 원천을 읽는 값 — **세계가 처음 놓은 자리 그대로**다.
 *
 * 고갈로 읽지 않고(phase available), 옮기지 않은 것으로 읽고(siteIndex 0), 무너진 자리가
 * 없는 것으로 읽는다. 지어낸 값이 아니라 그 원천이 관찰되기 전의 배치 그대로이므로,
 * 아직 아무것도 실려 오지 않은 화면은 C011 의 것과 한 픽셀도 다르지 않다.
 */
const DEFAULT_OBSERVED: ObservedSource = {
  phase: PHASE_AVAILABLE,
  siteIndex: 0,
  collapsedSites: [],
};

/**
 * 관찰 결과가 싣고 온 원천들의 표.
 *
 * 관찰은 방으로 잘리므로 이 표에는 **내가 선 방의 원천만** 있다 (spec R7 · R8). 다른 방의
 * 자국은 실리지 않고, 그래서 화면도 그것을 말하지 않는다.
 *
 * siteIndex · collapsedSites 는 **없으면 없는 대로 읽는다** — 마디가 하나뿐인 원천에는
 * 세계가 그 자리를 싣지 않으므로(spec Observable), 여기서 기본값으로 메운다.
 */
export function sourcePhases(snapshot: GameViewSnapshot): SourcePhases {
  const sources: Record<string, ObservedSource> = {};
  for (const entity of snapshot.entities) {
    if (entity.role !== SOURCE_ROLE) continue;
    sources[entity.id] = {
      phase: entity.state,
      siteIndex: entity.siteIndex ?? 0,
      collapsedSites: entity.collapsedSites ?? [],
    };
  }
  return sources;
}

/**
 * RULE-TRACE-STRENGTH-001 (C013 R7 CHANGED) — 그 흔적 area 의 지금 단계.
 *
 * 어떤 원천의 마디 둘레이면 **지금 선 마디의 것만** 센다 — 다른 마디의 둘레는 0 이다
 * (원천이 거기 없으므로 흙도 그것을 말하지 않는다). 지금 마디이면 C012 그대로: 고갈이면
 * 한 단계 낮고(0 아래로는 내려가지 않는다), 되돌아오는 중과 남아 있는 것은 데이터 그대로다.
 * 방 바닥에 깔린 흔적은 어느 원천의 둘레도 아니므로 한 값도 바뀌지 않는다.
 */
export function traceLevelOfArea(
  regionId: string,
  area: { id: string; tag: string },
  sources: SourcePhases,
): number {
  const level = soilStainLevel(area.tag);
  if (level <= 0) return 0;
  for (const source of sourcesOf(regionId)) {
    const site = siteOfOp(source.traceOps, area.id);
    if (site < 0) continue;
    const observed = observedSource(sources, source.id);
    // 지금 선 마디가 아니면 그 둘레는 없는 것이다 (원천이 떠난 자리의 흙은 흔적을 말하지 않는다)
    if (site !== observed.siteIndex) return 0;
    return observed.phase === PHASE_DEPLETED ? Math.max(0, level - 1) : level;
  }
  return level;
}

/**
 * 그 자리의 흔적 단계 — 겹치면 **가장 큰 쪽**이 이긴다 (C011 R4 그대로: 합하지 않는다).
 * 땅을 모르는 방은 0 이다.
 */
export function traceLevelAt(
  regionId: string,
  point: { x: number; z: number },
  sources: SourcePhases,
): number {
  const spec = regionSpec(regionId);
  const compiled = regionTerrain(regionId);
  if (!spec || !compiled) return 0;
  let strongest = 0;
  for (const area of areasOf(spec.space, TRACE_LAYER)) {
    if (!areaCoversPoint(area.shape, point.x, point.z)) continue;
    const level = traceLevelOfArea(regionId, area, sources);
    if (level > strongest) strongest = level;
  }
  return strongest;
}

/**
 * 지금 무너져 있는 자리들 — 그 방의 resource layer area 가운데 **무너진 마디**의 것.
 *
 * C013 CHANGED — C012 는 "그 원천이 고갈되었는가" 로 판정했다. 원천이 자리를 옮기므로
 * 이제 무너짐은 원천이 아니라 **자리**가 기억한다 (spec R5): collapseOps[i] 의 i 가 그
 * 원천의 collapsedSites 에 있으면 무너진 자리다. 원천이 떠난 뒤에도 그대로 남는다.
 *
 * 무너지기 전에는 빈 목록이다: 이 area 는 컴파일 결과를 한 값도 바꾸지 않고, State 가 그
 * 위에 덧씌워질 뿐이다 (C008 의 통로와 같은 형).
 */
export function collapsedAreas(regionId: string, sources: SourcePhases): readonly AreaOp[] {
  const spec = regionSpec(regionId);
  if (!spec) return [];
  return areasOf(spec.space, RESOURCE_LAYER).filter((area) =>
    isCollapsedArea(regionId, area.id, sources),
  );
}

/**
 * RULE-SOURCE-COLLAPSE-001 (C013 R5) — 그 자리가 무너진 자리인가.
 *
 * 그리는 목록(collapsedAreas)과 **같은 판정 하나**를 쓴다 — 두 벌로 만들면 화면에 그려진
 * 구덩이와 발이 멈추는 자리가 갈린다. 땅을 모르는 방 · 그런 area 가 없는 방 · 아직
 * 무너지지 않은 마디는 언제나 거짓이다.
 */
export function isCollapsedAt(
  regionId: string,
  point: { x: number; z: number },
  sources: SourcePhases,
): boolean {
  return collapsedAreas(regionId, sources).some((area) =>
    areaCoversPoint(area.shape, point.x, point.z),
  );
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 그 방이 밝힌 원천들 — 없는 방(백왕령)은 빈 목록이다 */
function sourcesOf(regionId: string): readonly ResourceSourceSpec[] {
  return regionSpec(regionId)?.resourceEcology?.sources ?? [];
}

/** 실려 온 그 원천의 지금 — 실려 오지 않았으면 처음 놓인 그대로 읽는다 */
function observedSource(sources: SourcePhases, id: string): ObservedSource {
  return sources[id] ?? DEFAULT_OBSERVED;
}

/** 그 op id 가 몇 번째 마디의 것인가 — 목록에 없으면 -1 (마디마다 op 하나이므로 차례가 번호다) */
function siteOfOp(ops: readonly string[] | undefined, opId: string): number {
  return ops ? ops.indexOf(opId) : -1;
}

/** 그 붕괴 area 가 지금 무너진 마디의 것인가 — collapseOps 는 **op id** 이므로 태그가 아니라 id 로 잇는다 */
function isCollapsedArea(regionId: string, areaId: string, sources: SourcePhases): boolean {
  for (const source of sourcesOf(regionId)) {
    const site = siteOfOp(source.collapseOps, areaId);
    if (site < 0) continue;
    return observedSource(sources, source.id).collapsedSites.includes(site);
  }
  return false;
}
