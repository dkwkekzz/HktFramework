// World Semantic — Region (C001 ADDED)
//
// World.regions · World.graph 는 컨텐츠 데이터(content/regions)에서 온다 — WorldState 에 넣지 않고
// 저장하지도 않는다 (02-world R7 · character-catalog 와 같은 성격의 정적 사실).
// 이 파일은 그 데이터를 세계 규칙이 쓰는 형(extent · anchor 자리 · 출구 · hash)으로 읽는 얇은 층이다.
// 세계가 모르는 Region 은 데이터 오류다 — 조용히 넘기지 않고 throw 한다.

import {
  descriptionHash,
  findPoint,
  type Extent,
} from '../../../engine/world-authoring/description';
import { exitsOf, type ConnectorExit } from '../../../engine/world-authoring/graph';
import {
  ANCHOR_LAYER,
  CLOSED_CONNECTORS,
  CONNECTOR_ACTIVATIONS,
  REGION_GRAPH,
  START_REGION_ID,
  regionSpec,
  type RegionSpec,
} from '../../regions';
import type { WorldPosition } from './position';
import type { RegionState } from './region-state';

// 관찰자의 새 몸 · 기본 자율 존재 · 광맥이 놓이는 Region (02-world R3 · R4).
//
// C004 CHANGED — 어느 방인지는 이제 컨텐츠 데이터가 말한다 (content/regions 의 START_REGION_ID).
// 규칙은 시작 방이 있다는 것만 알고 그것이 백왕령인 줄은 모른다 — 이 파일이 방 이름을 적던
// 마지막 자리였다 (01-spec SPEC-003 · SPEC-004).
export const START_REGION: string = START_REGION_ID;

export function regionSpecOf(id: string): RegionSpec {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 모르는 Region 이다 — ${id}`);
  return spec;
}

/**
 * 그 Region 이 지어져 있는가 — Description 이 있는가 (C002 ADDED · 02-world Connector.isBuilt).
 * 판정이지 사고가 아니다 — 경계(frontier)의 이름을 물어도 throw 하지 않고 거짓을 준다.
 * 건너기의 region-not-built 거절이 이것으로 판정한다 (01-spec SPEC-006).
 */
export function isRegionBuilt(id: string): boolean {
  return regionSpec(id) !== undefined;
}

/**
 * RULE-CONNECTOR-ACTIVATION-001 — 그 Connector 가 지금 열려 있는가
 * (C002 ADDED · 02-world Connector.isOpen · C009 CHANGED · 01-spec R1).
 *
 * 두 가지를 함께 본다. 어느 하나라도 걸리면 닫힌 문이다.
 *   ① 정적 사실 — id 가 CLOSED_CONNECTORS 에 있으면 언제나 닫혀 있다 (C002 그대로).
 *   ② 활성 조건 — 활성 조건 표에 있는 문이면, 그 조건이 가리키는 방의 **지금 pattern** 이
 *      표의 목록에 있을 때만 활성이다. 표에 없는 문은 언제나 활성이다 (지금까지의 세계 그대로).
 *
 * C008 까지 문의 열림은 저장되지도 유도되지도 않는 정적 사실 하나였다. 이제 그것이
 * **세계 State 에서 유도되는 사실**이 된다 — 그러나 저장되는 State 는 하나도 늘지 않았다:
 * 같은 pattern 이면 언제나 같은 답이므로 저장할 이유가 없다 (terrain 과 같은 성격 ·
 * C008 이 "저장/유도" 를 가른 그 규율 그대로). 그래서 되살린 세계에서도 답이 같다.
 *
 * **규칙은 문 이름도 패턴 이름도 알지 못한다** — 여기가 아는 것은 "조건을 가진 문" 뿐이고,
 * 어느 문이 어느 방의 어느 패턴에서 열리는지는 데이터(content/regions/graph.ts)에만 있다
 * (C004 가 세운 규율 · C008 R1 과 같은 규율).
 *
 * 조건이 가리키는 방에 State 가 없으면 열지 않는다 — 읽을 pattern 이 없으므로 조건을
 * 만족했다고 말할 근거가 없다. 지어내지 않고 닫아 둔다.
 */
export function isConnectorOpen(
  regionStates: Record<string, RegionState>,
  connectorId: string,
): boolean {
  if (CLOSED_CONNECTORS.includes(connectorId)) return false;
  const activation = CONNECTOR_ACTIVATIONS[connectorId];
  if (!activation) return true;
  // C012 CHANGED — 방의 State 가 규칙과 원천을 함께 들게 되었다. 여기가 읽는 것은 규칙뿐이다.
  const regionState = regionStates[activation.region]?.rule;
  if (!regionState) return false;
  return activation.patterns.includes(regionState.pattern);
}

/** 그 Region 의 Local Space — RULE-MOVE-001 전제 1 · 관성 경계가 이것으로 판정한다 */
export function regionExtent(id: string): Extent {
  return regionSpecOf(id).space.extent;
}

/** Connector 가 가리키는 anchor 의 자리 — 없으면 데이터 오류 */
export function anchorPosition(regionId: string, anchorTag: string): WorldPosition {
  const point = findPoint(regionSpecOf(regionId).space, ANCHOR_LAYER, anchorTag);
  if (!point) throw new Error(`Region ${regionId} 에 anchor ${anchorTag} 가 없다`);
  return { x: point.position.x, z: point.position.z };
}

/** 이 Region 에서 나갈 수 있는 끝들 — exitsOf 위에 얇게 (connector 순서 보존) */
export function regionExitsOf(regionId: string): ConnectorExit[] {
  return exitsOf(REGION_GRAPH, regionId);
}

/** 같은 Description → 같은 값 — 관찰 결과의 region.hash */
export function regionHash(id: string): string {
  return descriptionHash(regionSpecOf(id).space);
}
