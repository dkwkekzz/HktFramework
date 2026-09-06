// Resource Reading — 원천의 **지금(phase)** 을 화면이 읽는 자리 (C012 ADDED).
//
// 세계가 싣는 것은 그 원천의 state('available' | 'depleted') 하나뿐이다. 고갈이 세계에
// 남기는 나머지 — 옅어진 흔적 · 무너져 지날 수 없는 자리 — 는 **투영되지 않는다**:
// 관찰자가 자기 content/regions 와 실려 온 phase 로 스스로 얻는다 (spec Observable).
// 땅을 스스로 컴파일해 그리는 C005~C007 · 흔적을 스스로 얻는 C011 의 규율 그대로다.
//
// **세계의 판정과 같은 규칙이어야 한다** (spec R3 · R5). 갈리면 판이 말하는 것과 발밑이
// 어긋난다 — 그래서 자리 판정은 여기서 새로 만들지 않고 기반의 tagsAt 하나만 쓴다.

import type { AreaOp } from '../../engine/world-authoring/description';
import { areasOf } from '../../engine/world-authoring/description';
import type { CompiledWorldTerrain } from '../../engine/world-authoring/compiled';
import { areaCoversPoint, tagsAt } from '../../engine/world-authoring/query';
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

/** 원천 id → 지금의 phase. 봉투에 없는 원천은 **자리 자체가 없다** (모름을 고갈로 읽지 않는다) */
export type SourcePhases = Readonly<Record<string, string>>;

/** 아무것도 실려 오지 않았을 때 — 모든 원천이 "모름" 이고, 그러면 아무것도 옅어지지 않는다 */
export const NO_SOURCE_PHASES: SourcePhases = {};

/**
 * 관찰 결과가 싣고 온 원천들의 phase 표.
 *
 * 관찰은 방으로 잘리므로 이 표에는 **내가 선 방의 원천만** 있다 (spec R7). 다른 방의
 * 자국은 실리지 않고, 그래서 화면도 그것을 말하지 않는다.
 */
export function sourcePhases(snapshot: GameViewSnapshot): SourcePhases {
  const phases: Record<string, string> = {};
  for (const entity of snapshot.entities) {
    if (entity.role === SOURCE_ROLE) phases[entity.id] = entity.state;
  }
  return phases;
}

/**
 * RULE-TRACE-STRENGTH-001 (C012 R5 CHANGED) — 그 흔적 area 의 지금 단계.
 *
 * 고갈된 원천의 traceOp 면 **한 단계 낮다** (0 아래로는 내려가지 않는다). 방 바닥에 깔린
 * 흔적은 어느 원천의 traceOp 도 아니므로 한 값도 바뀌지 않는다.
 */
export function traceLevelOfArea(
  regionId: string,
  area: { id: string; tag: string },
  phases: SourcePhases,
): number {
  const level = soilStainLevel(area.tag);
  if (level <= 0) return 0;
  return isFadedTraceArea(regionId, area.id, phases) ? Math.max(0, level - 1) : level;
}

/**
 * 그 자리의 흔적 단계 — 겹치면 **가장 큰 쪽**이 이긴다 (C011 R4 그대로: 합하지 않는다).
 * 땅을 모르는 방은 0 이다.
 */
export function traceLevelAt(
  regionId: string,
  point: { x: number; z: number },
  phases: SourcePhases,
): number {
  const spec = regionSpec(regionId);
  const compiled = regionTerrain(regionId);
  if (!spec || !compiled) return 0;
  let strongest = 0;
  for (const area of areasOf(spec.space, TRACE_LAYER)) {
    if (!areaCoversPoint(area.shape, point.x, point.z)) continue;
    const level = traceLevelOfArea(regionId, area, phases);
    if (level > strongest) strongest = level;
  }
  return strongest;
}

/**
 * 지금 무너져 있는 자리들 — 그 방의 resource layer area 가운데 **고갈된 무너지는 원천**의 것.
 *
 * 고갈 전에는 빈 목록이다: 이 area 는 컴파일 결과를 한 값도 바꾸지 않고, phase 가 그 위에
 * 덧씌워질 뿐이다 (spec R3 — C008 의 통로와 같은 형).
 */
export function collapsedAreas(regionId: string, phases: SourcePhases): readonly AreaOp[] {
  const spec = regionSpec(regionId);
  if (!spec) return [];
  return areasOf(spec.space, RESOURCE_LAYER).filter((area) =>
    isCollapsedTag(regionId, area.tag, phases),
  );
}

/**
 * RULE-SOURCE-COLLAPSE-001 (C012 R3) — 그 자리가 무너진 자리인가.
 *
 * 자리 판정은 기반의 tagsAt 그대로다 (isClosedPassageAt 이 통로에 한 그대로) — 붕괴 자리는
 * 컴파일된 area 이고, phase 는 그 위에 "무너졌는가" 만 덧씌운다. 땅을 모르는 방 · 그런
 * area 가 없는 방 · 아직 고갈되지 않은 원천은 언제나 거짓이다.
 */
export function isCollapsedAt(
  regionId: string,
  point: { x: number; z: number },
  phases: SourcePhases,
): boolean {
  const compiled = regionTerrain(regionId);
  if (!compiled) return false;
  return tagsAt(compiled.world, point.x, point.z, RESOURCE_LAYER).some((tag) =>
    isCollapsedTag(regionId, tag, phases),
  );
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 그 방이 밝힌 원천들 — 없는 방(백왕령)은 빈 목록이다 */
function sourcesOf(regionId: string): readonly ResourceSourceSpec[] {
  return regionSpec(regionId)?.resourceEcology?.sources ?? [];
}

/** resource area 의 태그(= 원천의 id)가 지금 무너진 것인가 — 무너지는 원천이고 고갈되었을 때만 */
function isCollapsedTag(regionId: string, tag: string, phases: SourcePhases): boolean {
  const source = sourcesOf(regionId).find((s) => s.id === tag);
  return source?.collapses === true && phases[source.id] === PHASE_DEPLETED;
}

/** 그 흔적 area 가 고갈된 원천의 둘레인가 — traceOp 는 **op id** 이므로 태그가 아니라 id 로 잇는다 */
function isFadedTraceArea(regionId: string, areaId: string, phases: SourcePhases): boolean {
  return sourcesOf(regionId).some(
    (source) => source.traceOp === areaId && phases[source.id] === PHASE_DEPLETED,
  );
}


