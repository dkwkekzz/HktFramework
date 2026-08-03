// R1 위반 서식 — 세계를 바꾸려는 시도가 사건으로 서지 못할 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R0 은 세계에 **주인**을 주었다. 그런데 그 원장의 근거는 아직 사람이 적은 문자열 한 줄이었다 —
// "사흘치를 먹었다". 세계는 재고가 왜 줄었는지 몰랐고, 무엇이 그것을 줄일 수 있는지도 몰랐다.
// R1 이 닫는 자리가 그것이다: **세계를 바꾸는 길이 사건 하나뿐이 되게 하는 것.**
//
// R1 도 새 문법을 지어내지 않는다.
//
//   무엇을 바꿀 수 있는가   P0-b 걸림이 원자마다 못박았다 (`writes` · `pays`)
//   그 요청이 설 수 있는가  P0-c `fitAction` 이 넷을 이미 묻는다 (대상·비용·자리·관측)
//   사건이 무엇으로 서는가  O1 `Event` 가 정했다 (틱 · 일으킨 자 · 바뀐 상태 · 까닭)
//   담기는 규칙은           R0 이 정했다 (앞으로만 · 변화만 · 사슬 · 근거)
//
// R1 이 더하는 것은 **통로**다. 그래서 관문도 통로를 지킨다: 원자가 열지 않은 자리로 새지 않게,
// 낡은 전제 위에 쓰지 않게, 되돌릴 수 없는 것을 되돌리지 않게, 그리고 사건 없이 담긴 칸이
// 원장에 남지 않게.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 사건도 사유를 값으로 남긴다.

/** 사건이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type EventViolationRule =
  // R1-a 사건의 모양과 걸림
  | 'unfit-proposal' // P0-c 가 이미 막는 요청이다 — 사유를 그대로 옮겨 적는다
  | 'changeless-event' // 아무 자리도 바꾸지 않는다 — 그러면 사건이 아니다 (O1 checkEvent)
  | 'unrequested-effect' // 요청에 없는 자리를 바꾸려 한다 — 세계는 요청한 만큼만 바뀐다
  | 'stale-effect' // 전제한 이전 값이 지금 세계와 다르다 — 낡은 전제 위에 쓴다
  | 'off-world-effect' // 세계에 없는 자리를 바꾸려 한다 (O2 스키마 밖)
  | 'actorless-event' // 일으킨 자가 없다 — 자연 발생은 규칙(W2)이 서야 근거를 댈 수 있다 (유예)
  | 'malformed-event' // O1 Event 관문을 지나지 못한다
  // R1-b 세계에 적용
  | 'irreversible-undo' // 되돌릴 수 없는 원자가 바꾼 자리를 되돌리려 한다 (P0-b reversible)
  | 'world-refused' // 사건은 섰는데 세계가 그 값을 받지 않는다 (R0·O2 관문의 사유를 옮겨 적는다)
  | 'unwitnessed-commit' // 사건 없이 담긴 칸이다 — 세계는 사건으로만 바뀐다
  | 'dangling-cause'; // 까닭으로 지목한 사건이 로그에 없다

/** 위반 하나 — 어느 사건의 어디가 왜 막혔는가. */
export interface EventViolation {
  readonly rule: EventViolationRule;
  /** 어느 사건인가 (이름). 특정할 수 없으면 빈 문자열 */
  readonly event: string;
  /** 값 안의 경로 (`$.effects[1].from`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateEvent(
  out: EventViolation[],
  event: string,
  rule: EventViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, event, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function eventViolationVerdict(violations: readonly EventViolation[]): string {
  if (violations.length === 0) return '사건이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const events = [...new Set(violations.map((violation) => violation.event))].filter(
    (event) => event !== '',
  );
  const where = events.length === 0 ? '사건' : `${events.join(', ')}`;
  return `${where} 이 설 수 없다 — ${rules.join(', ')}`;
}
