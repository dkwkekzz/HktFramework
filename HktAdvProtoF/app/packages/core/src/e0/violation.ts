// E0 위반 서식 — 상황이 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R6 까지의 세계에는 **한 주체의 손**만 있었다. 의도는 한 사람이 내는 것이고, 그가 누구를
// 겨누는지까지는 R6 가 세웠지만 **겨눔이 겹치는 것을 보는 눈**은 아무 데도 없었다. D5 가 그
// 자리 앞에서 멈춘 것도 같은 이유다 — 이분 그래프는 주체에서 대상으로만 갔고 주체끼리는 잇지
// 않았다("누가 누구와 싸우는지는 서로를 봐야 알고, 상황으로 묶는 것은 E0 다").
//
// E0 가 잇는 자리는 이것이다: **여럿의 의도가 같은 자리에 걸리면 무엇이 서는가.**
//
// E0 도 새 문법을 지어내지 않는다.
//
//   무엇을 겨누는가       R6 `ActionIntent.aim` · `proposal.changes` · `proposal.targetIds`
//   무엇을 좇는가         P4 `ActiveGoal.nodeId`
//   무엇을 다투는가       D5 `DependencyConflict` — 급함도 D5 severity 그대로, 다시 재지 않는다
//   누구를 아는가         R6 `knownCounterparts` (R5 지목 + 세계에 적힌 사이)
//
// E0 가 더하는 것은 **둘뿐**이고 둘 다 결과를 갖는다.
//
//   ① **혼자 걸린 자리는 상황이 아니다.** 세계의 대부분은 상황이 아니다 — 이것이 없으면 모든
//      의도가 상황이 되고, 상황이 흔해지면 아무 뜻도 갖지 못한다 (D5 "겹친다고 다툼은 아니다").
//   ② **겹쳤다고 서로를 아는 것은 아니다.** 같은 자리에 걸린 둘 사이에서도 **서로 겨눈 쌍**과
//      **한쪽만 겨눈 쌍**과 **아무도 겨누지 않은 쌍**이 갈리고, 겨누는 자를 상대가 아는지까지
//      갈린다(매복). 그 값이 E3 판정의 정보 표면 입력이 된다.
//
// 그리고 D5 가 세운 못을 그대로 진다: **E0 는 이기는 자를 정하지 않는다.** 상황이 섰다는 것과
// 그 안에서 누가 누구를 알아보는가까지이고, 결과를 확정하는 것은 E3 다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 상황도 사유를 값으로 남긴다.

/** 상황이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type SituationViolationRule =
  // E0-a 걸린 자리
  | 'holderless-stake' // 누가 걸렸는지 없는 걸림이다
  | 'keyless-stake' // 어느 자리에 걸렸는지 없는 걸림이다
  | 'unknown-axis' // 축 4종 밖의 걸림이다
  | 'urgency-drift' // 급함이 D5 severity·P4 score 와 다르다 — E0 는 다시 재지 않는다
  | 'self-aimed-stake' // 자기 자신에게 걸었다 — 사람 축은 남을 겨눌 때만 선다
  // E0-b 묶음과 알아봄
  | 'solitary-situation' // 참여자가 하나뿐인 상황 — 혼자 걸린 자리는 상황이 아니다
  | 'groundless-situation' // 걸림 없이 세운 상황이다
  | 'self-pair' // 자기 자신과의 쌍이다
  | 'phantom-participant' // 걸린 적 없는 자가 참여자로 적혀 있다
  | 'awareness-drift' // 앎이 R6 `knownCounterparts` 와 다르다 — E0 는 다시 재지 않는다
  // E0-c 상황장과 감사
  | 'missing-situation' // 조건을 갖췄는데 상황장에 없다
  | 'outcome-declared'; // 이기는 자·결과를 적었다 — 그것은 E3 의 몫이다

/** 위반 하나 — 누구의 어느 상황이 왜 막혔는가. */
export interface SituationViolation {
  readonly rule: SituationViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.situations[1].participants`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateSituation(
  out: SituationViolation[],
  subject: string,
  rule: SituationViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function situationViolationVerdict(violations: readonly SituationViolation[]): string {
  if (violations.length === 0) return '상황이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '상황' : subjects.join(', ');
  return `${who} 이 설 수 없다 — ${rules.join(', ')}`;
}
