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
// 색이 어두워지고 차가워진다 (§3.2: civil = 문명권, outer = 익숙한 자연, wild = 아무도 돌보지 않는 야생).

import type { SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import { descriptionHash, extentPolygon } from '../../engine/world-authoring/description';
import { regionSpec } from '../regions/index';
import { codeText } from './code-text';

/** Region id → 방 이름. 미등록 id 는 id 그대로 (폴백) */
export const REGION_NAMES: Readonly<Record<string, string>> = {
  WHITE_KING_DOMAIN: '백왕령',
  FOREST_EDGE: '숲 가장자리',
  FOREST_DEEP: '숲 안쪽',
  EXPLORER_RUIN: '탐험대 폐허',
  PREDATOR_NEST: '포식수 둥지',
  BIO_ORE_FIELD: '생체 광석 지대',
  RED_EYE_TREE: '붉은 눈의 거목',
  TREE_INNER_WORLD: '거목 내부 세계',
  HEART_LAKE: '심장 호수',
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
  // 야생 — 초록이 빠지고 푸른 그늘만 남는다. outer 보다 더 어둡고 더 차갑다:
  // "들어가도 되나" 다음 한 걸음, 아무도 돌보지 않는 땅의 색
  wild: { fill: 0x1c4a5a, fillOpacity: 0.34, edge: 0x0e2a36, edgeOpacity: 0.85 },
  // 심부 — 초록 계열을 아예 벗어나 차가운 보라·남색이 되고 wild 보다 더 어둡다:
  // "기존 생물학·자연법칙으로 설명하기 어려운 장소"(§3.2) 이므로 자연의 색에서 떨어져 나온다
  deep: { fill: 0x3b2d6e, fillOpacity: 0.36, edge: 0x17103a, edgeOpacity: 0.85 },
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
 * 종류가 늘면 여기 한 줄이 는다 — 목적지 이름은 어디에도 없다.
 *
 * 색은 종류마다 색상(hue)이 갈리게 골랐다 — 이 Cycle 의 핵심 관찰이 "출구는 **종류**만 보인다" 이므로
 * 표식 다섯이 한 화면(숲 안쪽)에 섰을 때 밝기가 아니라 색으로 즉시 갈려야 한다.
 */
export const TRANSITION_TINTS: Readonly<Record<string, number>> = {
  // 길 — 사람이 닦아 밟아 다진 흙. 문명 쪽으로 이어지는 유일한 따뜻한 색
  road: 0xe0c48a,
  // 오솔길 — 길이 되다 만 풀. 흙색에서 초록으로 한 칸 옮겨 "닦이지 않은 길" 을 뜻한다
  trail: 0x8fae6a,
  // 문 — 자연이 아니라 누군가 세운 것. 붉은 인공색 하나만 이 계열에 둔다 (닫혀 있을 수 있다는 경고)
  door: 0xb05a5a,
  // 고개 — 능선을 넘는 찬 하늘빛. 길·오솔길의 따뜻한 계열과 정반대에 두어 "넘어가는 곳" 으로 읽힌다
  pass: 0x9fd0e8,
  // 들어감 — 걸어 나가는 것이 아니라 무엇의 안으로 드는 것. 자연에 없는 보라로 성질 자체를 가른다
  interaction: 0xc79bea,
  // 추락 — 걸어 나가는 곳이 아니라 아래로 뚫린 자리. 거의 검은 값 하나만 여기 두어 구멍으로 읽힌다
  falling: 0x2b2430,
  // 물길 — 물. 고개의 옅은 하늘빛보다 훨씬 진한 청록으로 옮겨 "넘어가는 곳" 과 갈린다
  river: 0x2f9a8f,
};

/** 바닥 테두리의 두께 (세계 단위 — renderer 가 띠로 옮긴다) */
const REGION_EDGE_WIDTH = 2;

// 시점 거리의 기준 두 수 — 한 변 40 인 방을 거리 15 에서 본다.
// 40 은 지금까지의 모든 방의 한 변이고 15 는 지금 기반의 기본 시점 거리(VIEW_DISTANCE)다.
// 그래서 이 비례는 기존 방들의 그림을 하나도 바꾸지 않고, 한 변이 두 배인 방에서만 거리가 두 배가 된다.
const REFERENCE_REGION_SPAN = 40;
const REFERENCE_VIEW_DISTANCE = 15;

/** 관찰자가 선 방의 크기가 정하는 시점 거리 — 큰 방은 넓게 (Play V4) */
export function regionViewDistance(
  region: { id: string; hash: string } | undefined,
): number | undefined {
  if (!region) return undefined;
  const spec = regionSpec(region.id);
  if (!spec) return undefined;

  // 방의 한 변 — 바닥을 그릴 때와 같은 자리(자기 Description 의 extent)에서 읽는다.
  // 세계는 방의 크기를 보내지 않는다 (원칙 2 — 시점은 관찰자의 것이다)
  const { minX, maxX, minZ, maxZ } = spec.space.extent;
  const span = Math.max(maxX - minX, maxZ - minZ);
  return (span / REFERENCE_REGION_SPAN) * REFERENCE_VIEW_DISTANCE;
}

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
