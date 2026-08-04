// R6 위반 서식 — 의도가 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// P5 까지 오면 주체는 무엇을 좇을지 알고(P4) 그것을 어떤 순서로 낼지도 안다(P5). 그런데 P5 가
// 남긴 한 줄이 있다: **"계획은 아직 요청이 아니다."** `ActionPlan` 은 일어나지 않은 것이고,
// 그것을 세계에 내놓는 통로가 없다. R6 가 그 통로다.
//
// 형식은 새로 만들지 않는다 — P0-c `ActionProposal` 이 원문 §19 `WorldChangeRequest` 를 이미
// 갖고 있고, 그것을 사건으로 세우는 것은 R1 이다. 그러면 R6 는 무엇을 하는가.
//
// **누구를 겨누는가를 정한다.**
//
// 여기가 실제로 비어 있던 자리다. P1 의 갈래는 자리와 자원에 대한 것이고 P2 는 "낼 수 있는가" 만
// 물었으며 P4 는 "무엇을 좇는가" 까지였다 — **누구에게** 는 어디에도 없었다. P4-b 조차 사이를
// 상대를 지목하지 않고 적힌 상대들의 평균으로 읽었고, 그것이 P4 가 남긴 부채였다.
//
// R6 가 새로 정하는 것은 둘뿐이고 **둘 다 결과를 갖는다.**
//
//   ① **겨눌 수 있는 것은 아는 상대뿐이다.**
//      아는 상대는 둘에서 온다 — R5 지목이 짚은 자와 세계가 사이를 적어 둔 자(D3 "적히지 않은
//      사이는 없는 사이"). 그래서 **지목 없는 자는 남을 겨눈 의도를 내지 못하고, 지목이 틀린
//      자는 엉뚱한 사람을 겨눈다.** 오해가 사건이 되는 자리가 정확히 여기다.
//
//   ② **누구를 겨누는가는 사이가 고른다.**
//      등지는 원자(P0-b `consent: against`)는 원한이 가장 큰 상대를, 내미는 원자(`mutual`)는
//      신뢰가 가장 큰 상대를 고른다. 축의 방향을 R6 가 정하지 않는다 — P4-b 가 "같은 신뢰 하나가
//      동의 축에 따라 반대로 읽힌다" 로 쓴 그 축 그대로다. 그래서 **같은 계획인데 사이가 다르면
//      다른 사람을 겨눈다.**
//
// 상대가 필요한 원자는 여섯뿐이다 — P0-b 가 `touches: 'between'` 으로 이미 갈라 두었고
// 동의 축이 그 여섯을 셋씩 나눈다. 나머지 열은 자리와 물건을 겨누므로 P5 가 준 대상 그대로 간다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 의도도 사유를 값으로 남긴다.

/** 의도가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type IntentViolationRule =
  // R6-a 의도의 모양과 겨눔
  | 'no-step' // 낼 걸음이 없는 계획이다 — 빈 계획은 의도가 되지 않는다
  | 'blocked-step' // 지금 낼 수 없는 걸음이다 (P4-a 가 막혔다고 판정했다)
  | 'ungrammatical-intent' // 그 주체의 문법이 열지 않은 원자다 (P2)
  | 'unknown-atom' // 16종 밖의 원자다
  | 'actorless-intent' // 내는 자가 없는 의도다
  | 'malformed-request' // 요청서가 P0-c 관문을 지나지 못한다
  // R6-b 사이가 상대를 고른다
  | 'aimless-intent' // 상대가 필요한 원자인데 겨눈 상대가 없다
  | 'unknown-counterpart' // 모르는 상대를 겨눴다 — 지목도 없고 사이도 적혀 있지 않다
  | 'self-aimed' // 자기 자신을 겨눴다
  | 'aim-drift' // 사이에서 다시 고르면 다른 상대다 (손으로 바꿔 적었다)
  | 'targetless-atom' // 상대를 겨누지 않는 원자인데 상대를 적었다
  // R6-c 의도장·감사·고리 닫기
  | 'unqueued-intent' // 같은 주체가 한 틱에 둘을 낸다
  | 'unrooted-intent' // 어느 목적에서 나왔는지 대지 못한다
  | 'uncaused-event'; // 의도 없이 선 사건 — 고리가 끊겼다

/** 위반 하나 — 누구의 어느 의도가 왜 막혔는가. */
export interface IntentViolation {
  readonly rule: IntentViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.intents[1].targetIds`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateIntent(
  out: IntentViolation[],
  subject: string,
  rule: IntentViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function intentViolationVerdict(violations: readonly IntentViolation[]): string {
  if (violations.length === 0) return '의도가 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '의도' : subjects.join(', ');
  return `${who} 가 설 수 없다 — ${rules.join(', ')}`;
}
