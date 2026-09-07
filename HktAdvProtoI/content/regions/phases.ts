// Region 의 위상 — 철이 방을 바꾸는 방식 (C016 ADDED).
//
// 세계에는 시계가 하나 있고(C015) 방은 그것을 **읽는다.** 무엇이 달라지는지는 전부 여기
// 데이터가 말하고, 규칙 코드는 철의 이름을 하나도 알지 못한다 (L2-World-Time 원칙 T4).
// 밝히지 않은 방은 철이 몇 번을 돌아도 한 값도 달라지지 않는다 — rule?(C008) ·
// resourceEcology?(C011) 가 없는 방이 그 계통 밖인 것과 같은 규율이다.
//
// **덧씌움이지 재컴파일이 아니다** (T4 · T6). 여기 적힌 것은 컴파일된 땅 **위에** 얹히는
// State 이고, 높이도 표면도 통행 격자도 hash 도 한 값도 바뀌지 않는다 — 닫힌 통로(C008) ·
// 무너진 자리(C012)가 세운 그 형 그대로다.
//
// 철 이름을 이 폴더가 따로 적는 이유 — content/regions 는 데이터 폴더라 content/world ·
// content/view · content/protocol 을 import 하지 않는다 (경계 규칙 4). 그래서 철의 어휘는
// 여기 한 벌, 관찰 계약(protocol 의 WorldClockView)에 한 벌 있고, 둘이 같다는 것은
// 세계 쪽이 컴파일 때 맞춰 본다.

/** 철 넷 — 뒤척임(TURN)은 철과 철 사이의 60 초다 (Play 확정 1 · 3) */
export type SeasonId = 'STILL' | 'SEEP' | 'LONG_NIGHT' | 'TURN';

/** 덧씌움 area 가 사는 layer 둘 — 땅의 layer 와 섞이지 않는다 */
export const DEPTH_LAYER = 'depth';
export const HAZARD_LAYER = 'hazard';

/**
 * 그 철에 이 area 가 **어느 깊이로 읽히는가** (Time §2.4 ①).
 *
 * 깊이는 지금까지 방 하나에 글자 하나였다. 이 덧씌움이 걸리면 **선 자리**의 깊이가 되고,
 * 덮이지 않은 자리는 여전히 방의 깊이다 — "같은 방인데 더 깊어졌다" 가 그 뜻이다
 * (Concept §13 — 깊이는 거리가 아니라 규칙의 낯섦이다).
 */
export interface DepthOverlay {
  /** Description 의 DEPTH_LAYER area op id — 컴파일 결과가 아니라 Description 을 훑는다 */
  areaId: string;
  /** 어휘 다섯 안의 값 (civil · outer · wild · deep · abyss) */
  depth: string;
}

/**
 * 그 철에 이 area 가 **위험으로 읽히는가** (Time §2.4 ①).
 *
 * "왜 여기가 안전한가"(C006 의 settlement/condition)와 **같은 자리에서 함께** 답해진다 —
 * 둘은 "여기는 무엇인가" 라는 한 물음의 두 얼굴이다.
 */
export interface HazardOverlay {
  /** Description 의 HAZARD_LAYER area op id */
  areaId: string;
  /** 위험의 종류 — 어휘 일곱 안의 값 (content/authoring/contracts.ts 의 HAZARD_KINDS) */
  hazard: string;
}

/** 그 철에 이 방이 달라지는 것. 밝히지 않은 것은 달라지지 않는다 */
export interface RegionPhase {
  depthOverlay?: readonly DepthOverlay[];
  hazardExtend?: readonly HazardOverlay[];
}

/**
 * **뒤척임**에 이 방이 하는 일 (Time §2.4 ④ · Play §5.3).
 *
 * 회복(C013)이 원천마다 제 길이로 옅어지게 하는 것과 달리 **한 번에** 일어난다.
 * 묻는다는 것은 "없던 일로 한다" 이지 "다 채워 준다" 가 아니다 — 처음부터 고갈로 서는
 * 원천(흐름에 매달린 것)은 고갈로 돌아간다.
 */
export interface RegionTurn {
  /** 이 방 원천의 캔 횟수 · 되돌아옴의 진행 · 무너진 마디를 처음 상태로 되돌린다 */
  burySigns?: boolean;
  /** 뒤척임마다 다음 마디로 옮겨 서는 원천들 (C013 의 마디 목록을 그대로 쓴다) */
  migrateSources?: readonly string[];
}

/**
 * 방의 위상 — `RegionSpec.phases`. 없으면 그 방은 철을 타지 않는다.
 *
 * 활성(Connector)과 출현(Source)의 철 조건은 여기 있지 않다 — 문의 활성은 판정하는 함수가
 * 하나여야 하므로 `graph.ts` 의 활성 표가 함께 지고, 원천의 출현은 그 원천 자신이 밝힌다.
 * (L2-World-Time §3 의 데이터 계약은 "의미 계약 — 타입과 파일 배치는 구현이 정한다" 이다.)
 */
export interface RegionPhases {
  /** 철별 덧씌움. 그 철의 열쇠가 없으면 그 철에는 달라지는 것이 없다 */
  seasons?: Readonly<Partial<Record<SeasonId, RegionPhase>>>;
  onTurn?: RegionTurn;
}
