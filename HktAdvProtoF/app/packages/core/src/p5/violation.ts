// P5 위반 서식 — 계획이 설 수 없을 때, 어디가 왜 끊겼는지를 한 모양으로 적는다.
//
// P4 까지 오면 주체는 무엇을 좇을지 안다. 그런데 그 목적은 아직 **한 걸음**으로 적혀 있다 —
// "마을과 주고받는다". 실제로는 그전에 가져올 것이 있고, 그전에 볼 것이 있다.
// P5 가 잇는 것이 그 자리다: **한 걸음처럼 보이던 것을 몇 걸음으로 펴는 일.**
//
// 이 계층이 지키는 것은 하나다 — **순서를 P5 가 지어내지 않는다.** 원자 사이의 먼저는
// P3-a 가 P0 걸림에서 계산했고, 세계와 맞댄 먼저 낼 원자는 P4-a 가 냈다. P5 는 그 한 칸짜리
// 먼저를 사슬이 될 때까지 되풀이할 뿐이다. 그래서 관문도 대부분 "그 먼저가 실재하는가" 를 묻는다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 닿지 못한 사슬도 막힌 자리와 사유를 값으로 남긴다.

/** 계획이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type PlanViolationRule =
  // P5-a 계획 사슬 조립
  | 'goalless-plan' // 좇는 목적이 없는데 계획을 세운다
  | 'unordered-step' // 뒤 걸음이 앞 걸음을 딛는다 — 순서가 뒤집혔다
  | 'self-standing-step' // 걸음이 자기 자신을 딛는다
  | 'orphan-step' // 아무 요구도 채우지 않는 걸음 — 왜 거기 있는지 말하지 못한다
  | 'dangling-need' // 채워지지 않은 요구를 남긴 채 계획이 온전하다고 한다
  // P5-b 원문 사슬 대조
  | 'unresolved-step' // 원문이 적은 단계가 16원자 어디로도 환원되지 않았다
  | 'unreached-step'; // 환원은 됐는데 어떤 계획에서도 그 자리에 서지 못한다

/** 위반 하나 — 어느 걸음의 어디가 왜 끊겼는가. */
export interface PlanViolation {
  readonly rule: PlanViolationRule;
  /** 어느 걸음·원문 이름에서 걸렸는가. 특정할 수 없으면 빈 문자열 */
  readonly step: string;
  /** 값 안의 경로 (`$.steps[2].needs`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violatePlan(
  out: PlanViolation[],
  step: string,
  rule: PlanViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, step, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function planViolationVerdict(violations: readonly PlanViolation[]): string {
  if (violations.length === 0) return '계획이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const steps = [...new Set(violations.map((violation) => violation.step))].filter(
    (step) => step !== '',
  );
  const where = steps.length === 0 ? '계획' : `걸음 ${steps.join(', ')}`;
  return `${where} 이 설 수 없다 — ${rules.join(', ')}`;
}
