// content/regions — 이 세계를 **지나가는 것**들의 경로 (C018 ADDED · L2-World-Time §2.6 · §3).
//
// world 와 view 가 함께 읽는 정적 사실이다. 세계 State 에 들어가지 않고 저장되지도 않는다 —
// 무엇이 언제 어디를 지나는지는 언제나 이 데이터에서 다시 온다 (terrain-rules · resource-ecology ·
// phases 와 같은 갈래). 저장되는 것은 "지금 지나고 있는가" 뿐이다 (World.presences).
//
// **규칙 코드는 어떤 경로도 어떤 방도 이름으로 알지 못한다** (원칙 T1 · T4). 규칙이 아는 것은
// "시간표를 밝힌 경로" 와 "마디마다의 후보들" 이라는 형뿐이고, 어느 철에 무엇이 어디를 지나
// 무엇을 남기는지는 이 파일에만 있다. 이 파일을 비우면 세계는 C017 과 한 값도 다르지 않다.
//
// **압도적인 것은 2층에서 현상이다** (T7) — 몸도 생명도 아니고, 지나는 동안 그 방에 무엇을
// 하고 지나간 뒤에 무엇을 남길 뿐이다. 싸울 것이 아니라 때를 맞출 것이다.

import type { HazardOverlay, SeasonId } from './phases';

/**
 * 마디 하나의 **후보** 방 하나 — 그 방과 그 방에서 지나는 선.
 *
 * 후보가 여럿이면 그 가운데 **소란이 가장 높은 방**으로 휜다 (RULE-PRESENCE-BEND-001).
 * 같으면 이 배열의 앞선 것이다 (결정론).
 */
export interface PresenceNodeCandidate {
  /** 그 방의 id */
  region: string;
  /** 그 방 Description 의 presence layer 곡선 tag — 관찰자가 그 선을 자기 데이터에서 얻는다 */
  curve: string;
}

/**
 * 언제 지나가는가 (Time §2.6 시간표).
 *
 * 밝히지 않은 것은 **묻지 않는다** — 철을 밝히지 않으면 어느 철에나, 낮밤을 밝히지 않으면
 * 낮에도 밤에도 시간표가 맞는다 (원천의 occurrence · 문의 활성이 세운 그 어법 그대로).
 */
export interface PresenceSchedule {
  /** 그 철들에만 시작한다 */
  seasons?: readonly SeasonId[];
  /** 그 낮밤에만 시작한다 */
  dayPhase?: 'DAY' | 'NIGHT';
  /** 몇 바퀴에 한 번인가 — 1 이면 매 바퀴다. 0 이하는 시간표가 없는 것으로 친다 */
  everyNCycles: number;
}

/**
 * 지나는 **동안** 그 방에 하는 일 (Time §2.6).
 *
 * 밝히지 않은 것은 일어나지 않는다 (T3) — 소란만 밝힌 경로는 위험을 걸지 않고, 위험만
 * 밝힌 경로는 소란을 올리지 않는다. 형은 C016 의 덧씌움 그대로이고, 위상을 거는 **원인이
 * 셋째**(지나가는 것)가 되었을 뿐이다.
 */
export interface PresenceEffect {
  /**
   * 지나는 동안 위험으로 읽히는 자락들 — 형은 철·깨어남의 덧씌움과 **같은 것**이다.
   *
   * areaId 는 그 방 Description 의 hazard layer area op id 다. 한 경로가 여러 방을 지나므로
   * 목록에는 방마다의 자락이 함께 들고, 걸리는 것은 **지금 지나는 방**의 것뿐이다
   * (다른 방의 op id 는 그 방 Description 에 없으므로 아무것도 덮지 않는다).
   */
  hazardExtend?: readonly HazardOverlay[];
  /** 지나는 동안 그 방의 소란이 초당 얼마나 오르는가 (C017 의 올리는 그 한 자리로) */
  disturbancePerSecond?: number;
}

/**
 * 지나가는 것 하나의 경로 — 시간표 · 마디들 · 지나는 동안 하는 일 · 지나간 뒤 남기는 것.
 *
 * 데이터가 전부 말한다. 규칙은 이 형만 알고 값은 하나도 알지 못한다.
 */
export interface PresenceRoute {
  id: string;
  /** 무엇이 지나는가 — 의미 코드. 문구도 그림도 View 의 표가 정한다 (원칙 2) */
  presence: string;
  /** 마디마다의 후보들 — 순서가 지나는 차례다. 마디 하나에 후보 하나면 휘지 않는다 */
  nodes: readonly (readonly PresenceNodeCandidate[])[];
  schedule: PresenceSchedule;
  effectWhilePassing?: PresenceEffect;
  /**
   * 지나간 뒤 **남기는 원천**들의 id — 실제로 지난 방에 있는 것만 선다 (spec R2 경계 ③).
   *
   * 원천을 이름(글자)으로 가리킨다 — 방 파일들이 이 파일을 읽지 않으므로 순환이 되지
   * 않는다. 원천의 dependsOn · 흐름의 from/to 가 이미 같은 어법이고, 그 이름이 실제로
   * 있는지는 검사가 판정한다 (끊긴 참조는 실패다).
   */
  leavesBehind?: readonly string[];
}

// ── 경로 선의 tag (presence layer) ────────────────────────────────────
//
// 뿌리 곡선(ROOT_CURVE_TAG)과 **같은 layer** 에 산다 — 땅 위에 무엇이 지나간다를 적는
// 표시선이고, 높이도 통행도 한 값 건드리지 않는다 (profile 이 없다 · T6).
// 뿌리는 늘 거기 있는 것이고 이 둘은 **때가 되면 지나는 것**이라는 것만 다르다.

/** 천공고래가 지나는 선 — 그늘이 방을 덮고 지나가는 자리 (Concept §9) */
export const WHALE_CURVE_TAG = 'sky-whale';

/** 맹목의 사냥꾼이 지나는 선 — 긴 밤에 숲으로 내려오는 자리 (Concept §11) */
export const HUNTER_CURVE_TAG = 'blind-hunter';

// ── 지나가는 것의 의미 코드 ────────────────────────────────────────────
//
// 관찰 결과의 `presences[].presence` 가 이 값이다. 사람이 읽을 문구도 그림도 여기 없다 —
// 재료 이름 · 형태 코드 · 위험 갈래가 그런 것처럼 View 의 표가 옮긴다 (원칙 2).

export const PRESENCE_SKY_WHALE = 'sky-whale';
export const PRESENCE_BLIND_HUNTER = 'blind-hunter';

// ── 이 세계를 지나는 것 둘 ────────────────────────────────────────────

/**
 * **천공고래** (Play §5.6 · 확정 9 · Concept §9).
 *
 * 낮에만 · 철 바퀴 셋에 한 번 온다 (한 바퀴가 2220 세계 초이므로 약 111 분 — "수년에 한 번"
 * 의 프로토타입 값이다). 마디 넷은 후보가 하나씩이므로 **휘지 않는다**: 고래는 소란을 좇지
 * 않고 제 길로 간다. 마디 넷 × 45 초 = 180 초이고 낮이 240 초이므로 **하루 안에 시작하고
 * 끝난다** (기본형 ②).
 *
 * 지나는 동안 그 방의 소란이 초당 2 오른다 — 포식자가 모여든다 (확정 9 · 기본형 ④).
 * 마디 하나(45 초)에 90 이 오르므로 한 방이 세 번 지나가야 임계(300)에 닿는다: 지나가는 것
 * 하나로는 깨우지 못하고 여럿의 일과 겹쳐야 넘는다 (C017 확정 5 의 뜻 그대로).
 *
 * 위험은 걸지 않는다 — 그늘은 화면과 소란으로 서고, 그것이 몸에 하는 일은 3층의 몫이다.
 */
export const SKY_WHALE_ROUTE: PresenceRoute = {
  id: 'SKY_WHALE_ROUTE',
  presence: PRESENCE_SKY_WHALE,
  nodes: [
    [{ region: 'WHITE_KING_DOMAIN', curve: WHALE_CURVE_TAG }],
    [{ region: 'FOREST_EDGE', curve: WHALE_CURVE_TAG }],
    [{ region: 'FOREST_DEEP', curve: WHALE_CURVE_TAG }],
    [{ region: 'RED_EYE_TREE', curve: WHALE_CURVE_TAG }],
  ],
  schedule: { dayPhase: 'DAY', everyNCycles: 3 },
  effectWhilePassing: { disturbancePerSecond: 2 },
  // 떨어진 비늘 — 숲 가장자리에 선다 (기본형 ⑤). 다른 세 방에는 남기지 않는다:
  // 백왕령은 "스스로 낳지 않는 이유" 를 밝힌 방이고(isolationReason), 나머지 둘은 이미
  // 제 계통의 원천이 서 있는 자리다.
  leavesBehind: ['FALLEN_SCALE'],
};

/**
 * **맹목의 사냥꾼** (Play §5.2 · 확정 10 · 13 · Concept §11).
 *
 * 긴 밤에만 · 매 바퀴 내려온다. 마디 둘 × 45 초 = 90 초이고 긴 밤이 360 초다 (기본형 ②).
 *
 * 둘째 마디는 후보가 **둘**이다 — 소란이 높은 쪽으로 휜다 (확정 10 "진동에 반응한다").
 * 광석 지대의 소란을 올려 두면 숲 가장자리에는 오지 않는다. 소란이 같으면 이 배열의
 * 앞선 것이다 (결정론).
 *
 * **소란을 올리지 않는다** (기본형 ⑥) — 올리는 쪽으로도 두면 자기가 낸 소란으로 자기가
 * 휘게 되어 세계가 스스로를 좇는다. 대신 지나는 자락이 위험으로 읽힌다.
 */
export const BLIND_HUNTER_ROUTE: PresenceRoute = {
  id: 'BLIND_HUNTER_ROUTE',
  presence: PRESENCE_BLIND_HUNTER,
  nodes: [
    [{ region: 'FOREST_DEEP', curve: HUNTER_CURVE_TAG }],
    [
      { region: 'FOREST_EDGE', curve: HUNTER_CURVE_TAG },
      { region: 'BIO_ORE_FIELD', curve: HUNTER_CURVE_TAG },
    ],
  ],
  schedule: { seasons: ['LONG_NIGHT'], everyNCycles: 1 },
  effectWhilePassing: {
    // 방 셋의 자락 — 지나는 방의 것만 걸린다. 갈래는 어휘 일곱 안의 하나다
    // (content/authoring/contracts.ts 의 HAZARD_KINDS). 이 폴더는 그 파일을 읽지 않으므로
    // 글자로 적는다 — 흔적 태그 · 철의 덧씌움과 같은 어법.
    hazardExtend: [
      { areaId: 'hazard-deep-hunter-path', hazard: 'hazard/creature' },
      { areaId: 'hazard-edge-hunter-path', hazard: 'hazard/creature' },
      { areaId: 'hazard-ore-hunter-path', hazard: 'hazard/creature' },
    ],
  },
  // 먹이 잔해 — 숲 가장자리에만 있다. 광석 지대로 휘었으면 그 방에 이 원천이 없으므로
  // 아무것도 남지 않는다 (spec R2 경계 ③ · SPEC-006 경계 ③).
  leavesBehind: ['PREY_REMAINS'],
};

/** 세계를 지나는 것들 — 순서가 곧 관찰 결과의 순서다 (결정론) */
export const PRESENCE_ROUTES: readonly PresenceRoute[] = [SKY_WHALE_ROUTE, BLIND_HUNTER_ROUTE];

/** 그 경로 — 모르는 id 면 undefined (없는 경로를 지어내지 않는다) */
export function presenceRoute(id: string): PresenceRoute | undefined {
  return PRESENCE_ROUTES.find((route) => route.id === id);
}
