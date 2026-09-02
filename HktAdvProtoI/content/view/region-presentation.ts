// Region Presentation — 방(Region)을 "어떻게 그릴지" 결정한다 (결정 Layer 데이터, C001).
//
// 세계는 관찰 결과에 region { id, hash } 와 depth 태그(hud region.depth)만 싣는다. 방의 바닥·이름·
// 색·출구 표식의 색은 전부 여기 표가 정한다 — 방을 더하거나 색을 바꾸는 것은 코드 변경이 아니라
// 이 표와 content/regions 데이터의 변경이다 (RegionGraphRooms §6 불변 조건).
//
// 바닥의 모양은 클라이언트가 자기 Description(content/regions)을 읽어 그린다 (Plan §3.5).
// 세계가 보낸 hash 와 그 Description 의 hash 가 다르면 — 세계와 다른 땅을 보고 있는 것이므로 —
// 이름 뒤에 그 사실을 한 줄 붙인다. 판정은 만들지 않는다: 그리기만 계속한다.
//
// 색의 기준 — L2-World-Concept §16 "저기 가보고 싶다 → 근데 들어가도 되나". depth 가 깊어질수록
// 색이 어두워지고 차가워진다 (§3.2: civil = 문명권, outer = 익숙한 자연).

import type { SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import { descriptionHash, extentPolygon } from '../../engine/world-authoring/description';
import { regionSpec } from '../regions/index';
import { codeText } from './code-text';

/** Region id → 방 이름. 미등록 id 는 id 그대로 (폴백) */
export const REGION_NAMES: Readonly<Record<string, string>> = {
  WHITE_KING_DOMAIN: '백왕령',
  FOREST_EDGE: '숲 가장자리',
};

export function regionName(id: string): string {
  return REGION_NAMES[id] ?? id;
}

/** depth 태그 → 바닥 색. fill 은 낮은 불투명도의 면, edge 는 같은 계열의 진한 테두리 */
export interface DepthPresentation {
  fill: number;
  fillOpacity: number;
  edge: number;
  edgeOpacity: number;
}

export const DEPTH_PRESENTATIONS: Readonly<Record<string, DepthPresentation>> = {
  // 문명권 — 따뜻하고 밝다. 안전한 곳의 색
  civil: { fill: 0xf0c878, fillOpacity: 0.3, edge: 0xb8863a, edgeOpacity: 0.85 },
  // 문명의 경계 밖 — 초록이고 어둡다. "들어가도 되나" 가 시작되는 색
  outer: { fill: 0x2e7a48, fillOpacity: 0.32, edge: 0x1a4a2c, edgeOpacity: 0.85 },
};

// 미등록 depth 의 기본 결정 — 무채색. 태그가 늘어도 게임은 멈추지 않고 색만 없다
export const DEFAULT_DEPTH_PRESENTATION: DepthPresentation = {
  fill: 0x9a9a9a,
  fillOpacity: 0.25,
  edge: 0x606060,
  edgeOpacity: 0.8,
};

export function depthPresentation(depth: string): DepthPresentation {
  return DEPTH_PRESENTATIONS[depth] ?? DEFAULT_DEPTH_PRESENTATION;
}

/**
 * 전이 종류(Connector.transition = region-exit 존재의 kind) → 출구 표식에 곱할 색.
 * 지금은 road 하나다. 종류가 늘면 여기 한 줄이 는다 — 목적지 이름은 어디에도 없다.
 */
export const TRANSITION_TINTS: Readonly<Record<string, number>> = {
  road: 0xe0c48a,
};

/** 바닥 테두리의 두께 (세계 단위 — renderer 가 띠로 옮긴다) */
const REGION_EDGE_WIDTH = 2;

/**
 * 관찰자가 선 방의 바닥 — SceneGroundZone polygon 하나.
 * Spec 을 모르는 id 면 빈 배열이다 — 바닥 없이도 게임은 돈다 (폴백 규칙).
 */
export function regionZones(region: { id: string; hash: string } | undefined): SceneGroundZone[] {
  if (!region) return [];
  const spec = regionSpec(region.id);
  if (!spec) return [];

  const depth = depthPresentation(spec.depth);
  const name = regionName(spec.id);
  // 세계가 보낸 hash 와 내 데이터의 hash 가 다르다 — 그 사실을 이름 뒤에 붙인다 (최소 구현)
  const label =
    descriptionHash(spec.space) === region.hash
      ? name
      : `${name} — ${codeText('region.hash-mismatch')}`;

  return [
    {
      id: `region:${spec.id}`,
      shape: { kind: 'polygon', points: extentPolygon(spec.space.extent) },
      fill: { color: depth.fill, opacity: depth.fillOpacity },
      edge: { color: depth.edge, opacity: depth.edgeOpacity, width: REGION_EDGE_WIDTH },
      label,
    },
  ];
}
