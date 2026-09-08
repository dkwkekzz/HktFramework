// content/regions — **방이 묻는 것** (C029 ADDED · L2-World-Access §4.3 · §4.4).
//
// C028 까지 문의 조건과 요구는 표 둘에 흩어져 있었다 (graph.ts 의 `CONNECTOR_ACTIVATIONS` ·
// `CONNECTOR_REQUIREMENTS`). 이 파일이 그 둘을 **한 형**으로 받는다 — 세 문이 같은 글로 적히고,
// 요구의 출처는 이제 각 방의 `access.locks` 하나다 (spec World Change 2 · 빈칸 1 의 답).
//
// 두 표가 지고 있던 뜻은 그대로 여기 산다.
//   ① **무엇을 읽어 정하는가** — time · state 요구가 문의 열림을 정한다 (활성 표가 하던 일).
//      답은 세계의 시각과 그 방의 지금 pattern 에서 온다: 저장되는 State 는 하나도 늘지 않는다.
//   ② **요구는 활성을 판정하지 않는다** — property · knowledge 요구는 열림을 한 값도 건드리지
//      않는다 (K12 · C020 spec R5 경계 ①). 2층이 하는 것은 **표시**까지이고, 요구를 채워도
//      열리지 않는다. 채우는 것은 3 · 4층의 것이다.
//   ③ **판정하는 함수는 여전히 하나다** — 열림/잠김도 거절 사유도 `connectorClosedReason`
//      하나가 낸다 (C009 · C016 이 세운 규율). 늘어난 것은 그 함수가 읽는 자리뿐이다.
//
// Lock 은 State 가 아니라 **컨텐츠 데이터**다 — 세계 State 에 들어가지 않고 저장되지도 않는다
// (CLOSED_CONNECTORS · 재료 계통과 같은 갈래). Lock 을 가지지 않은 문은 언제나 활성이고,
// Lock 을 가지지 않은 방은 **묻지 않는 방**이다 (spec SPEC-002 경계 ①).
//
// **세계 규칙은 이 파일의 글자를 하나도 알지 못한다** (C004 가 세운 규율) — 규칙이 아는 것은
// "Lock 을 가진 문" 과 "몸에 보일 것을 밝힌 흔적" 뿐이고, 어느 문이 무엇을 요구하는지 ·
// 무엇을 알아낼 흔적이 어디 있는지는 각 방의 데이터에만 있다.

import type { SeasonId } from './phases';
import { REGION_SPECS } from './specs';

/**
 * 요구 하나 — **밝힌 갈래가 전부 참이어야** 그 Lock 이 열린다 (K2).
 *
 * 넷 다 선택이고, 아무것도 밝히지 않은 요구는 요구가 없는 것과 같다. 갈래가 넷인 것은
 * 새로 지은 것이 둘(property · knowledge)이고 time · state 는 있던 활성 조건 둘을 한 형으로
 * 읽은 것이다 (K2).
 *
 * **2층이 판정하는 것은 time · state 둘뿐이다** (K12) — property 는 몸의 사정이고
 * knowledge 는 아는 것의 사정이라 3층이 온 뒤의 일이다. 여기서는 갈래의 자리만 둔다.
 */
export interface LockRequirement {
  /** 성질 태그 하나 (`heat:hides`) — 어휘는 properties.ts 가 소유한다. 2층은 판정하지 않는다 */
  property?: string;
  /** 그 철에만 열린다 — 지금 철이 이 목록에 있어야 한다 */
  time?: { seasons: readonly SeasonId[] };
  /** 그 방의 지금 패턴이 이 목록에 있어야 한다. region 은 조건을 **가진** 방이지 이 문이 잇는 방이 아니다 */
  state?: { region: string; patterns: readonly string[] };
  /** 아는 것 — 3층의 자리다. 지금 이 세계에 밝힌 Lock 이 없다 */
  knowledge?: string;
}

/**
 * 그 요구를 **알아낼 흔적** 하나 (원문 §7 · K10 · 검사 ㊶).
 *
 * `op` 는 그 방(또는 이웃) Description 의 op id 다 — layer 는 묻지 않는다 (spec 기본형 ⑤):
 * 협곡의 흔적 둘은 trace layer 에 있고 미로의 식물 넷은 clue layer 에 있다. 흔적은 layer
 * 하나에 갇히지 않는다.
 *
 * `showsOnBody` 를 밝힌 흔적만 **몸에 걸린다** (RULE-LOCK-TRACE-BODY-001). 밝히지 않은 흔적은
 * 그저 그 자리에 놓인 것이고 몸에 아무것도 걸지 않는다 (spec SPEC-003 경계 ④ — 언 사체의
 * 자리가 그렇고, 그것이 대조다).
 */
export interface LockTrace {
  op: string;
  /** 그 자락에 든 몸에 실리는 조건 코드 — 밝히지 않으면 몸에 아무것도 걸지 않는다 */
  showsOnBody?: string;
}

/** Lock 이 매달리는 자리의 갈래 — 도구 계약이 이 글자를 그대로 받는다 (원문 §3) */
export const LOCK_AT_CONNECTOR = 'connector';
export const LOCK_AT_AREA = 'area';

/**
 * 세계가 묻는 것 하나 (Access §4.3).
 *
 * **특정 물건을 요구하는 장치가 아니다** — "이곳을 지나려면 이 조건에 답할 방법이 필요하다"
 * 까지이고, 무엇이 그것을 채우는지는 어디에도 적히지 않는다 (원문 §2.1).
 */
export interface Lock {
  id: string;
  /** 실제로 있는 자리 — 문(connector id) 또는 자락(area op id) */
  at: { kind: 'connector' | 'area'; ref: string };
  /** area 면 soft 가 · connector 면 hard 가 기본이다 (원문 §3) */
  strength: 'soft' | 'hard';
  /** 하나 이상. **전부 참이어야** 열린다 (K2) */
  requires: readonly LockRequirement[];
  /** 검사 ㊴ ㊵ 가 세게 보는가 — 밝히지 않으면 거짓이다. 무엇이 중요한가는 그 방의 Play 가 적는다 */
  important?: boolean;
  /** 이 요구를 알아낼 흔적들 — 하나 이상 (㊶) */
  traces: readonly LockTrace[];
  /**
   * 지목했을 때 판이 말하는 **현상**의 코드 — 밝히지 않으면 그 표식은 한 값도 달라지지 않는다
   * (RULE-LOCK-REASON-001). 요구의 이름을 말하지 않는다: 세계는 답을 알려 주지 않는다 (K8).
   */
  reason?: string;
}

/** 그 방이 묻는 것 — 없으면 **묻지 않는 방**이다 (원문 §12 아홉째) */
export interface RegionAccess {
  locks: readonly Lock[];
}

/**
 * 현상 코드 — **체열이 감지된다** (Play §6 V25 · spec R3).
 *
 * 요구의 이름(`heat:hides`)이 아니라 그 자리에서 **일어나는 일**의 코드다. C020 의
 * `requires-stored-heat`("저장된 열이 있어야 한다")가 이것으로 바뀌었고, 자리도 형도
 * 그대로이며 바뀐 것은 그 코드가 무엇을 말하는가 하나다 — 무엇이 그것을 채우는지도 ·
 * 어디서 나는지도 여전히 말하지 않는다 (K8). 사람이 읽을 문구는 View 의 표가 옮긴다.
 */
export const ASKS_WARMTH = 'asks-warmth';

/**
 * 조건 코드 — **김이 푸르게 빛난다** (spec 기본형 ④ · D4 의 첫째 흔적).
 *
 * 문 앞의 자락에 든 **몸**에 실린다 (RULE-LOCK-TRACE-BODY-001). 자락 밖으로 나오면 사라지는
 * 유도된 사실이고 저장되지 않는다 — 차가운 것(원천 · 출구 표식)에는 어느 자리에서도 실리지
 * 않는다. 코드의 이름은 구현이 지었다 (`recovery-stalled` · `frost-vein-regrown` 의 선례).
 */
export const BREATH_GLOWS = 'breath-glows';

/**
 * 세계의 Lock 전부 — **방 차례 그대로**, 한 방 안에서는 그 방이 적은 차례 그대로다.
 *
 * 사본이 아니다: 출처는 각 방의 `access.locks` 하나이고 여기는 그것을 펴 놓은 색인이다.
 * 도구도 검사도 이 차례로 읽으므로 두 번 돌리면 글자까지 같다.
 */
export const LOCKS: readonly (Lock & { region: string })[] = REGION_SPECS.flatMap((spec) =>
  (spec.access?.locks ?? []).map((lock) => ({ ...lock, region: spec.id })),
);

/** 그 방이 묻는 것들 — 묻지 않는 방이면 빈 목록이다 */
export function locksOfRegion(regionId: string): readonly Lock[] {
  return REGION_SPECS.find((spec) => spec.id === regionId)?.access?.locks ?? [];
}

/**
 * 그 문에 걸린 Lock — 없으면 없다(undefined).
 *
 * 문 하나에 Lock 은 하나다. 둘을 걸면 "전부 참이어야 한다" 는 요구의 어법(K2)으로 이미
 * 적을 수 있는 것을 형이 두 벌로 말하게 된다 — 먼저 선 것을 답으로 준다.
 */
export function lockOfConnector(connectorId: string): Lock | undefined {
  return LOCKS.find((lock) => lock.at.kind === LOCK_AT_CONNECTOR && lock.at.ref === connectorId);
}
