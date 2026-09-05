// Region Presentation — 방(Region)을 "어떻게 그릴지" 결정한다 (결정 Layer 데이터, C001).
//
// 세계는 관찰 결과에 region { id, hash } 와 depth 태그(hud region.depth)만 싣는다. 방의 바닥·이름·
// 색·출구 표식의 색은 전부 여기 표가 정한다 — 방을 더하거나 색을 바꾸는 것은 코드 변경이 아니라
// 이 표와 content/regions 데이터의 변경이다 (RegionGraphRooms §6 불변 조건).
//
// 바닥의 모양은 클라이언트가 자기 Description(content/regions)을 읽어 그린다 (Plan §3.5).
// 세계가 보낸 hash 와 그 Description 의 hash 가 다르면 — 세계와 다른 땅을 보고 있는 것이므로 —
// 그 사실을 말한다. 판정은 만들지 않는다: 그리기만 계속한다.
//
// C026 CHANGED — **지면 구역의 이름표를 전부 걷었다** (R4 · SPEC-008). 방 바닥도, 조건 셋도,
// 도시도, 구역도, 통로도 색과 경계로만 갈린다. 이름은 두 자리로 옮겨 갔다:
//   ① 들어선 순간 한 번 지나가는 제목        regionEntryTitle (확정 4)
//   ② 물었을 때 판이 답하는 줄               target-frame-presentation / place-reading
// hash 어긋남도 함께 옮겼다 — 늘 떠 있던 이름 뒤가 아니라 ①의 제목과 ②의 판에서 말한다.
//
// 색의 기준 — L2-World-Concept §16 "저기 가보고 싶다 → 근데 들어가도 되나". depth 가 깊어질수록
// 색이 어두워지고 차가워진다 (§3.2: civil = 문명권, outer = 익숙한 자연, wild = 아무도 돌보지 않는 야생).

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../engine/protocol-core/gameview';
import type { SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import { areasOf, descriptionHash, extentPolygon } from '../../engine/world-authoring/description';
import type { GameViewSnapshot, RegionView } from '../protocol/gameview';
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
  // C008 — 고대 문 너머. 여태 경계 이름이던 것이 지어진 방이 되었다
  FANTASY_MAZE: '환상의 미로',
  // C009 — 미로의 중첩 자식. 미로가 감싸고 있던 자리라는 것이 이름 하나로 읽혀야 하므로
  // 방의 이름에 '미로' 를 그대로 둔다 (Play §5.4 "미로의 심장")
  MAZE_HEART: '미로의 심장',
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

// ── 규칙을 품은 방 — 구역과 통로 (C008 ADDED) ─────────────────────────
//
// 미로의 Description 에는 구역 area 넷(cell/A~D)과 통로 area 여섯(passage/…)이 있다.
// settlement area 와 똑같이 **세계가 보내 주지 않는다** — 관찰자가 자기 Description 을 읽어
// 그린다. 다른 것은 하나뿐이다: 통로는 **지금 열려 있는가**에 따라 색이 갈리고, 그 답은
// 봉투의 region.state.pattern 과 이 방 데이터의 패턴 표에서 관찰자가 스스로 맞춘다
// (세계는 패턴 표를 싣지 않는다 — spec Observable "투영하지 않는 것").
//
// **두 축을 갈라 두었다.** 한 화면에 열 개의 zone 이 겹쳐 놓이므로 구역과 통로가 같은 축을
// 쓰면 서로를 잡아먹는다.
//   구역  색상(hue)으로 갈린다 — 넷이 서로 다른 것만 뜻하고, 어느 것이 나은 자리라는 뜻은 없다
//   통로  밝기(value)로 갈린다 — 열림은 밝고 닫힘은 거의 검다. 색맹이어도 갈리고, 멀리서도 갈린다
//
// 구역 바닥에 A·B·C·D 를 **적지 않는다.** 적는 순간 식물이 할 일이 없어지고, 이 Play 의
// 관찰 기준점(§5.3 "지도는 못 그려도 이름표는 읽는다")이 화면에서 사라진다.

// layer 이름을 데이터에서 import 하지 않고 여기 적는 것은 terrain-presentation 의
// WHITE_GIANT_TREE 와 같은 이유다 — 표현 표는 세계의 코드를 키로 받아 적는다.
// 통로 layer 만은 적지 않는다: 그것은 **규칙이 스스로 밝히는 값**이므로(rule.passageLayer)
// 데이터가 다른 이름을 쓰면 화면도 함께 따라가야 한다.
export const CELL_LAYER = 'cell';

/**
 * 구역 태그 → 바닥 색. 넷은 색상만 다르고 밝기·채도의 자리는 같다 —
 * 하나가 더 눈에 띄면 화면이 "저기가 중요하다" 는 없는 말을 하게 된다.
 *
 * 색 넷을 고른 기준은 **미로에서 이미 쓰이는 색을 피하는 것**이다. 지면은 어두운 초록
 * (SURFACE_FLAT = 0x4e7a3e)이고 방 바닥은 어두운 보라(deep = 0x3b2d6e)이므로 그 둘을 비우면
 * 청록 · 자홍 · 호박이 남고, 넷째 자리는 색상 자체를 버린 밝은 상아다 (급경사가 무채색으로
 * 나간 것과 같은 어법). 같은 넷이 그 구역 식물의 색이기도 하다 (sprites 의 a·n·o·y) —
 * 바닥과 이름표가 같은 색이면 둘이 서로를 가르치고, 하나만 보아도 답이 나온다.
 *
 * 채움을 0.16 으로 옅게 둔 것은 넷이 방 전체를 덮기 때문이다. 진하면 방의 depth 색(심부)과
 * 그 위에 선 것들이 전부 묻힌다 — 구역은 배경이지 주인공이 아니다.
 */
export const CELL_ZONE_PRESENTATIONS: Readonly<Record<string, SettlementZonePresentation>> = {
  A: { fill: 0x3fb9b0, fillOpacity: 0.16, edge: 0x1c6b66, edgeOpacity: 0.7, edgeWidth: 0.8 },
  B: { fill: 0xd2569c, fillOpacity: 0.16, edge: 0x7a2a58, edgeOpacity: 0.7, edgeWidth: 0.8 },
  C: { fill: 0xdb9138, fillOpacity: 0.16, edge: 0x87551c, edgeOpacity: 0.7, edgeWidth: 0.8 },
  D: { fill: 0xe7dcc0, fillOpacity: 0.16, edge: 0x8f8467, edgeOpacity: 0.7, edgeWidth: 0.8 },
};

export function cellZonePresentation(tag: string): SettlementZonePresentation {
  return CELL_ZONE_PRESENTATIONS[tag] ?? DEFAULT_SETTLEMENT_ZONE;
}

/**
 * 통로의 세 결정 — 열림 · 닫힘 · 모름.
 *
 * 열림은 **채우지 않고 밝은 테두리만** 둔다. 닫힘은 거의 검은 띠로 **채운다**. 그래서 갈리는
 * 것이 색이 아니라 **막대가 거기 있는가**다 — 방을 위에서 훑을 때 검은 띠 둘이 즉시 보이고,
 * 나머지 넷은 뚫린 자리로 남는다 ("한눈에" 의 뜻).
 *
 * 닫힘의 테두리만 붉은 것은 그것이 **세계가 거절하는 자리**이기 때문이다 — 출구 표식의
 * 문 색(TRANSITION_TINTS.door = 0xb05a5a)과 같은 계열이다. 거기 들어서면 "길이 닫혀 있다"
 * 가 뜬다는 것을 색이 미리 말한다.
 *
 * 모름은 무채색이다 — 규칙을 품은 방인데 봉투에 state 가 없는 경우다. 그런 일이 없어야
 * 맞지만, 없다고 화면이 열림/닫힘을 **지어내면** 세계가 하지 않은 말을 하게 된다.
 */
export const PASSAGE_OPEN_ZONE: SettlementZonePresentation = {
  fill: 0xeae2f8,
  fillOpacity: 0,
  edge: 0xfff0c8,
  edgeOpacity: 0.95,
  edgeWidth: 1.4,
};

export const PASSAGE_CLOSED_ZONE: SettlementZonePresentation = {
  fill: 0x120c1c,
  fillOpacity: 0.62,
  edge: 0xb05a5a,
  edgeOpacity: 0.95,
  edgeWidth: 1.4,
};

export const PASSAGE_UNKNOWN_ZONE: SettlementZonePresentation = {
  fill: 0x9a9a9a,
  fillOpacity: 0.2,
  edge: 0x606060,
  edgeOpacity: 0.8,
  edgeWidth: 0.8,
};

/**
 * 재배열의 순간이 화면에 남아 있는 시간 (초).
 *
 * 4 초다. 맥동은 세계 시각으로 위상을 잡고 각속도가 3 rad/s 이므로(renderer 의 drawZones)
 * 한 번 부풀었다 꺼지는 데 2π/3 ≒ 2.1 초가 든다. **한 번만 뛰면 눈은 그것을 깜박임으로 읽고,
 * 두 번 뛰어야 "뛰고 있다" 로 읽는다** — 그래서 한 주기가 아니라 두 주기다.
 *
 * 더 길게 두지 않는 이유도 같다. 압력이 다시 차는 데 걸리는 걸음에 비해 이 창이 길면
 * "방금 바뀌었다" 가 늘 켜져 있는 배경이 되어 순간이기를 그만둔다.
 */
export const REARRANGE_PULSE_SECONDS = 4;

/**
 * 지금 열려 있는 통로 태그들 — **패턴 표는 데이터의 것이고 봉투에는 없다.**
 * 세계는 "지금 패턴의 이름" 하나만 말하고, 그 이름이 어느 통로를 여는지는 관찰자가 자기
 * content/regions 의 같은 표에서 읽는다 (땅을 컴파일해 그리는 C005~C007 의 방식 그대로).
 *
 * 이름을 모르는 패턴이면 null 이다 — 빈 집합(= 전부 닫힘)으로 읽지 않는다. 그것은 세계가
 * 하지 않은 말이고, 모름과 닫힘은 다른 것이다.
 */
export function openPassageTags(
  spec: { rule?: { patterns: readonly { name: string; open: readonly string[] }[] } },
  pattern: string | undefined,
): ReadonlySet<string> | null {
  if (!spec.rule || pattern === undefined) return null;
  const found = spec.rule.patterns.find((p) => p.name === pattern);
  return found ? new Set(found.open) : null;
}

/**
 * 방이 지금 말하는 한 마디 — 없으면 없다 (C008).
 *
 * 길이 바뀐 **순간**은 봉투에 사건으로 오지 않는다. 세계는 "마지막으로 바뀐 시각" 하나만
 * 말하고(region.state.rearrangedAt), 그것이 얼마 전인지는 관찰자가 잰다 — 타격 결과의
 * 나이를 strikes.since 로 재는 것과 같은 방식이다. 그래서 새로 들어온 관찰자도, 되살린
 * 세계도 같은 답을 얻는다 (사건 큐도, 화면이 기억하는 값도 필요 없다).
 */
export function regionNotice(observed: CoreGameViewSnapshot): string | undefined {
  const snapshot = observed as GameViewSnapshot;
  const at = snapshot.region?.state?.rearrangedAt;
  if (at === undefined) return undefined;
  const elapsed = worldTimeOf(snapshot) - at;
  if (elapsed < 0 || elapsed > REARRANGE_PULSE_SECONDS) return undefined;
  return codeText('maze-rearranged');
}

/** 방 이름과 깊이(그리고 어긋남)를 잇는 말 — 목록 구분자다(문장을 짓지 않는다) */
const ENTRY_TITLE_SEPARATOR = ' — ';

/** 깊이 태그가 실린 HUD 줄 */
const DEPTH_HUD_ID = 'region.depth';

/**
 * RULE-QUIET-GROUND-001 — **방에 들어선 프레임에만** 그 방의 이름이 한 번 지나간다 (C026 R4).
 *
 * 지면에서 걷어낸 글자가 갈 자리다 (SPEC-008 · SPEC-010). 조립이 직전 프레임의 방 id 를
 * 쥐고 있다가 넘기고, 같은 방이면 여기서 침묵한다 — 같은 방에 머무는 동안 다시 뜨지 않고,
 * 방을 옮기면 다시 한 번 뜬다. 화면이 이 값을 기억하지 않는 것은 regionNotice 와 같은 규율이다.
 *
 * hash 어긋남을 여기 붙이는 이유: 그것은 **자리의 사실이 아니라 방 전체의 사실**이므로,
 * 지목하지 않은 사람도 알아야 한다. 늘 떠 있던 이름 뒤(C001)에서 이리로 옮긴 것이며,
 * 지목했을 때는 판이 같은 사실을 한 번 더 적는다 (SPEC-005).
 */
export function regionEntryTitle(
  observed: CoreGameViewSnapshot,
  previousRegionId: string | undefined,
): string | undefined {
  const snapshot = observed as GameViewSnapshot;
  const region = snapshot.region;
  if (!region || region.id === previousRegionId) return undefined;
  const parts = [regionName(region.id)];
  const depth = snapshot.hud.find((h) => h.id === DEPTH_HUD_ID)?.value;
  if (typeof depth === 'string') parts.push(codeText(depth));
  const spec = regionSpec(region.id);
  // 모르는 방은 어긋남을 말하지 않는다 — 대조할 내 데이터가 없는 것과 다른 땅을 보는 것은 다르다
  if (spec && descriptionHash(spec.space) !== region.hash) {
    parts.push(codeText('region.hash-mismatch'));
  }
  return parts.join(ENTRY_TITLE_SEPARATOR);
}

/** 봉투가 싣고 온 세계 시각 — HUD 한 줄이 그 값이다 (resolve 가 읽는 자리와 같다) */
function worldTimeOf(snapshot: GameViewSnapshot): number {
  return Number(snapshot.hud.find((h) => h.id === 'world.time')?.value ?? 0);
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
export function regionZones(
  region: RegionView | undefined,
  worldTime = 0,
): SceneGroundZone[] {
  if (!region) return [];
  const spec = regionSpec(region.id);
  if (!spec) return [];

  const depth = depthPresentation(spec.depth);

  return [
    {
      id: `region:${spec.id}`,
      shape: { kind: 'polygon', points: extentPolygon(spec.space.extent) },
      fill: { color: depth.fill, opacity: depth.fillOpacity },
      edge: { color: depth.edge, opacity: depth.edgeOpacity, width: REGION_EDGE_WIDTH },
      // 이름표를 붙이지 않는다 (C026 R4 — RULE-QUIET-GROUND-001). 방 이름은 들어선
      // 순간 regionEntryTitle 이 한 번 지나가게 하고, 그 뒤 지면에는 글자가 없다
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
        // 이름표를 걷었다 (C026 R4). 조건 셋과 도시는 색과 경계로만 갈리고, 그 자리가
        // 무엇인지는 **물었을 때** 판이 답한다 (place-reading 의 'place.settlement' 줄)
      };
    }),
    // 구역 넷 (C008) — 통로보다 **먼저** 놓는다. 통로는 구역이 맞닿는 자리에 겹쳐 놓이므로
    // 뒤에 와야 위에 그려진다. layer 안의 차례는 데이터(ops)의 것이고, layer 사이의 차례는
    // 무엇이 무엇 위에 겹치는가의 문제이므로 표현의 결정이다.
    ...areasOf(spec.space, CELL_LAYER).map((area): SceneGroundZone => {
      const p = cellZonePresentation(area.tag);
      return {
        id: `cell:${spec.id}:${area.id}`,
        shape: area.shape,
        fill: { color: p.fill, opacity: p.fillOpacity },
        edge: { color: p.edge, opacity: p.edgeOpacity, width: p.edgeWidth },
        // 이름표를 붙이지 않는다 — 구역의 이름은 식물이 말한다 (Play §5.3)
      };
    }),
    // 통로 여섯 (C008) — 열림/닫힘으로 색이 갈리고, 재배열 직후에는 맥동한다.
    // 규칙을 품지 않은 방에는 통로 layer 의 이름 자체가 없으므로 이 목록이 비고,
    // 그러면 C006 까지와 한 픽셀도 다르지 않은 화면이 남는다.
    ...(spec.rule ? areasOf(spec.space, spec.rule.passageLayer) : []).map(
      (area): SceneGroundZone => {
        const open = openPassageTags(spec, region.state?.pattern);
        const p =
          open === null
            ? PASSAGE_UNKNOWN_ZONE
            : open.has(area.tag)
              ? PASSAGE_OPEN_ZONE
              : PASSAGE_CLOSED_ZONE;
        return {
          id: `passage:${spec.id}:${area.id}`,
          shape: area.shape,
          // 열린 통로는 채우지 않는다 (fillOpacity 0) — 뚫린 자리는 비어 있어야 뚫려 보인다
          ...(p.fillOpacity > 0 ? { fill: { color: p.fill, opacity: p.fillOpacity } } : {}),
          edge: { color: p.edge, opacity: p.edgeOpacity, width: p.edgeWidth },
          // 바뀐 것은 통로의 열림/닫힘뿐이므로 맥동도 통로에만 준다 (spec R3 —
          // 구역도 식물도 재배열이 건드리지 않는다). 세기는 시간과 함께 잦아든다:
          // 순간이 지나가는 것 자체가 보여야 "방금" 이 언제까지인지 읽힌다.
          ...pulseOf(region.state?.rearrangedAt, worldTime),
        };
      },
    ),
  ];
}

/** 재배열이 방금이면 맥동 세기를, 아니면 아무것도 주지 않는다 (없으면 맥동하지 않는다) */
function pulseOf(rearrangedAt: number | undefined, worldTime: number): { intensity?: number } {
  if (rearrangedAt === undefined) return {};
  const elapsed = worldTime - rearrangedAt;
  if (elapsed < 0 || elapsed > REARRANGE_PULSE_SECONDS) return {};
  return { intensity: 1 - elapsed / REARRANGE_PULSE_SECONDS };
}
