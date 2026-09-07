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

/**
 * **소란이 가라앉는 철** (C017 ADDED · Time §2.5 · spec R2).
 *
 * 규칙 코드는 어느 철에 가라앉는지 이름으로 알지 못한다 (T4) — 데이터인 이 목록과 시계가 낸
 * 지금 철을 맞춰 볼 뿐이고(RULE-DISTURBANCE-DECAY-001), 목록을 비우면 소란은 어느 철에도
 * 가라앉지 않는다. 철별 덧씌움(RegionPhases.seasons)이 데이터인 것과 같은 규율이다.
 *
 * 방마다 두지 않고 여기 한 벌 두는 이유 — 소란은 **어느 방에나 있는 값**이고(기본형 ⑩),
 * 가라앉음은 방이 아니라 **세계의 철**이 정한다 (시계가 세계에 하나인 것과 같다 · T1).
 * 미지가 가까운 철에는 세계가 흔들린 것을 잊지 않는다.
 */
export const DISTURBANCE_DECAY_SEASONS: readonly SeasonId[] = ['STILL'];

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
  /**
   * C019 ADDED — 그 자락에 선 관찰자의 **관찰 범위** (세계 단위 · spec R2 · SPEC-006).
   *
   * 위험이 지금까지는 "여기는 무엇인가" 를 말하는 코드 하나였다. 그 자락이 관찰자에게
   * **실제로 하는 일**을 밝히는 첫 자리다 — 눈보라 안에서는 낮에도 멀리 있는 몸과 원천이
   * 실리지 않는다. 겹치면 가장 좁은 것이 이기고, 때가 주는 범위(밤 20 · C015)와도 좁은
   * 쪽이 이긴다.
   *
   * **밝히지 않으면 좁히지 않는다** — 지금까지의 자락(숲의 hazard/creature)은 이 자리를
   * 밝히지 않으므로 관찰이 C015 그대로다. rule?(C008) · resourceEcology?(C011) 를 밝히지
   * 않은 방이 그 계통 밖인 것과 같은 규율이다.
   */
  observeRange?: { day: number; night: number };
  /**
   * C019 ADDED — 그 자락에 선 동안 걸린 것에 함께 실리는 **접촉 코드** (spec R3 · SPEC-007).
   *
   * 위험의 코드가 "이 자리가 무엇인가" 라면 이것은 "지금 내가 그것에 닿아 있다" 이다 —
   * 앞의 것은 내가 서지 않아도 참이고 뒤의 것은 내가 서야 참이다. 그래서 두 말이 안전의
   * 코드 곁에 **함께** 선다 (C016 이 위험의 코드를 안전의 코드 곁에 둔 그 판단의 연장).
   *
   * **밝히지 않으면 아무것도 늘지 않는다.** 몸의 값은 한 톨도 달라지지 않는다 —
   * 2층이 하는 것은 말하는 것까지다 (Play §5.1).
   */
  contact?: string;
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
  /**
   * **깨어난 방**의 덧씌움 (C017 ADDED · spec R4 · SPEC-005).
   *
   * 형은 철의 덧씌움과 **같은 것**을 그대로 쓴다 — 방을 바꾸는 **원인**이 둘(철 · 소란)이
   * 되었을 뿐 달라지는 것은 여전히 그 넷 안이다 (T3). 밝히지 않은 방은 깨어나도 값과 위상만
   * 오르고 깊이도 위험도 한 값 달라지지 않는다 (spec SPEC-005 경계 ②).
   *
   * 철의 덧씌움과 **함께** 걸린다 — 어느 한쪽이 다른 쪽을 지우지 않는다 (spec R4 경계 ① ②).
   */
  awake?: RegionPhase;
  onTurn?: RegionTurn;
  /**
   * **늘 걸리는 덧씌움** (C019 ADDED · spec R1 · SPEC-005).
   *
   * 철도(seasons) 소란도(awake) 지나가는 것도 아닌 넷째 자리이고, 방을 바꾸는 **원인이
   * 하나 더 는 것이 아니라 원인 없이** 걸리는 자리다. 숲의 위험은 무언가가 걸어 왔지만
   * (철 · 소란 · 지나가는 것) 협곡의 위험은 **방 자체**다 — 눈보라는 그치지 않고 절벽은
   * 무너지지 않는다.
   *
   * 형은 기존 RegionPhase 그대로다 — 달라지는 것은 여전히 그 넷 안이고(T3), 늘어난 것은
   * "언제 걸리는가" 의 답 하나뿐이다 (언제나).
   *
   * 걸리는 차례는 **맨 앞**이다 (상시 → 철 → 깨어남 → 지나가는 것) — 깊이가 겹치면 나중
   * 것이 이기므로, 늘 서 있는 것은 지나가는 것에 덮인다. 위험은 걸린 것이 전부 실리므로
   * 차례가 답을 바꾸지 않는다.
   *
   * **밝히지 않은 방은 이 Cycle 전과 한 값도 다르지 않다** (spec SPEC-005 경계 ①).
   */
  standing?: RegionPhase;
}
