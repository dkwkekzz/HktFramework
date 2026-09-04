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
import { areasOf, descriptionHash, extentPolygon } from '../../engine/world-authoring/description';
import { regionSpec } from '../regions/index';
import {
  CITY_TAG,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  SETTLEMENT_LAYER,
} from './biome-rules';
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

// ── 사람이 사는 자리 (C006 ADDED) ─────────────────────────────────────
//
// 백왕령의 Description 에는 settlement layer 의 area 가 넷 있다 — 조건 셋과 도시 하나.
// **세계는 이것들을 봉투로 보내지 않는다.** 관찰자가 자기 Description 을 읽어 그린다 —
// 방 바닥 polygon 하나를 그리던 것과 같은 자리, 같은 방식이다 (Plan §3.5).
//
// 색의 기준 — **조건 zone 의 색은 그 조건을 만드는 것의 색이다.** 산 조건은 급경사의
// 무채색, 강 조건은 젖음의 청록, 거목 조건은 흰 줄기의 흰색이다 (terrain-presentation 의
// SURFACE_COLORS · sprites 의 팔레트와 같은 값 계열). 그래서 zone 을 보고 눈을 들면
// 그 색을 낸 것이 그 자리에 실제로 서 있다 — 문구를 읽기 전에 이미 이어진다.
//
// 도시만 이 규칙 밖이다. 도시는 조건이 아니라 **결과**이므로 자연의 색 셋과 계열이 갈리는
// 따뜻한 인공색(문명권 바닥과 같은 계열)을 쓰고, 채움을 가장 옅게 두는 대신 테두리를
// 가장 굵고 밝게 세운다 — 조건 셋 위에 겹쳐 놓이는 자리이므로 아래의 색을 덮으면
// "조건이 모여서 도시가 된다" 가 화면에서 사라진다 (Observable Result ⑥).

export interface SettlementZonePresentation {
  fill: number;
  fillOpacity: number;
  edge: number;
  edgeOpacity: number;
  edgeWidth: number;
}

export const SETTLEMENT_ZONE_PRESENTATIONS: Readonly<
  Record<string, SettlementZonePresentation>
> = {
  // 산맥이 막는다 — 급경사의 맨 바위 색 (SURFACE_STEEP = 0xa8a49c)
  [CONDITION_RIDGE]: {
    fill: 0xa8a49c,
    fillOpacity: 0.22,
    edge: 0x6e6a63,
    edgeOpacity: 0.8,
    edgeWidth: 0.6,
  },
  // 강이 먹인다 — 젖은 땅의 청록 (SURFACE_WET = 0x39707a)
  [CONDITION_RIVER]: {
    fill: 0x39707a,
    fillOpacity: 0.22,
    edge: 0x1d454c,
    edgeOpacity: 0.8,
    edgeWidth: 0.6,
  },
  // 거목이 포식자를 물린다 — 흰 줄기 색 (sprites 의 T = #f4f1e8)
  [CONDITION_TREE]: {
    fill: 0xf4f1e8,
    fillOpacity: 0.22,
    edge: 0x9fb98c,
    edgeOpacity: 0.85,
    edgeWidth: 0.6,
  },
  // 그래서 사람이 산다 — 문명권 바닥과 같은 따뜻한 계열. 채움은 가장 옅고 테두리는 가장 굵다
  [CITY_TAG]: {
    fill: 0xf0c878,
    fillOpacity: 0.1,
    edge: 0xffb03a,
    edgeOpacity: 0.95,
    edgeWidth: 1.4,
  },
};

// 표에 없는 settlement 태그의 기본 결정 — 무채색 (DEFAULT_DEPTH_PRESENTATION 과 같은 뜻).
// 자리는 그려지고 색만 없다: 데이터가 늘어도 화면이 그것을 감추지 않는다.
export const DEFAULT_SETTLEMENT_ZONE: SettlementZonePresentation = {
  fill: 0x9a9a9a,
  fillOpacity: 0.2,
  edge: 0x606060,
  edgeOpacity: 0.8,
  edgeWidth: 0.6,
};

export function settlementZonePresentation(tag: string): SettlementZonePresentation {
  return SETTLEMENT_ZONE_PRESENTATIONS[tag] ?? DEFAULT_SETTLEMENT_ZONE;
}

/**
 * 관찰자가 선 방의 바닥과 그 안의 settlement 자리들 — SceneGroundZone 목록.
 * Spec 을 모르는 id 면 빈 배열이다 — 바닥 없이도 게임은 돈다 (폴백 규칙).
 *
 * 순서가 곧 겹치는 차례다: 방 바닥이 맨 아래이고, 그 위에 Description 의 ops 순서 그대로
 * settlement area 가 놓인다. **ops 순서를 다시 정렬하지 않는다** — 무엇이 무엇 위에
 * 겹치는지는 데이터가 정하는 것이고, 화면이 그 차례를 바꾸면 데이터를 고쳐도 그림이
 * 따라오지 않는다.
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
    // 조건 셋과 도시 (C006) — area op 의 모양(polygon · circle)이 그대로 zone 의 모양이다.
    // area 가 없는 방에서는 이 목록이 비고, 그러면 방 바닥 하나만 그려진다 (C005 그대로).
    ...areasOf(spec.space, SETTLEMENT_LAYER).map((area): SceneGroundZone => {
      const p = settlementZonePresentation(area.tag);
      return {
        // op id 는 Description 안에서 유일하다 — 프레임 사이에 같은 구역으로 이어진다
        id: `settlement:${spec.id}:${area.id}`,
        shape: area.shape,
        fill: { color: p.fill, opacity: p.fillOpacity },
        edge: { color: p.edge, opacity: p.edgeOpacity, width: p.edgeWidth },
        // 이름표는 세계가 준 태그를 문구로 옮긴 것이다 — 모르는 태그는 코드 그대로 뜬다
        label: codeText(area.tag),
      };
    }),
  ];
}
