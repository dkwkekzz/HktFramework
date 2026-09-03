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
  REGION_GRAPH,
  WHITE_KING_DOMAIN,
  regionSpec,
  type RegionSpec,
} from '../../regions';
import type { WorldPosition } from './position';

// 관찰자의 새 몸 · 기본 자율 존재 · 광맥이 놓이는 Region (02-world R3 · R4)
export const START_REGION: string = WHITE_KING_DOMAIN;

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
 * 그 Connector 가 열려 있는가 (C002 ADDED · 02-world Connector.isOpen).
 * 닫힘은 컨텐츠 데이터의 목록에서 온다 — 세계 State 에 들어가지 않는다.
 * 이 Cycle 에는 여는 규칙도 닫는 규칙도 없다 (01-spec SPEC-005).
 */
export function isConnectorOpen(connectorId: string): boolean {
  return !CLOSED_CONNECTORS.includes(connectorId);
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
