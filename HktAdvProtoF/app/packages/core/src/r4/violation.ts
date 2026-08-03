// R4 위반 서식 — 믿음이 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R3 은 **읽히는 것**까지 세웠다. 넷이 겨울을 둘러보고 각자 다른 것을 읽었지만, 그 지각에는
// 무엇이 일어났는지가 실려 있지 않다 — 통로·세기·자리·거리·애매함까지다(`truth-leak`).
// R4 가 잇는 자리가 그것이다: **읽은 것에서 무엇이 있었는지를 짐작한다.**
//
// R4 도 새 문법을 지어내지 않는다.
//
//   통로가 어느 자리를 여는가   R2 `LEAK_CHANNELS` — 세계의 규칙이지 장부가 아니다(누구나 안다)
//   그 자리를 무엇이 움직이는가 R2 `atomsMoving` (P0-b 걸림에서 계산된 것)
//   무엇을 낼 수 있는가         P2 `PossibilityGrammar.allowed`
//   읽은 것                     R3 `Percept`
//   애매함의 눈금               R2-b `ambiguityOf` 와 같은 열여섯 자리
//
// R4 가 더하는 것은 **짐작의 사전** 한 줄이다: **자기가 낼 수 있는 것으로 읽는다.**
// 후보는 통로가 정하므로 누구에게나 같고(세계의 규칙), 좁힘은 문법이 정하므로 주체마다 다르다.
// 그 한 줄이 원문 §6.1 의 장면을 값으로 세운다 — 같은 현상을 사냥꾼과 종교인이 다르게 읽는다.
//
// 그리고 못박는 것이 하나 더 있다:
//
//   **믿음은 진실을 몰래 보지 않는다.** 짚는 것은 통로가 연 후보 안에서여야 하고, 확신은
//   좁힘이 허락한 상한을 넘지 못하며, 지각에 없던 자리(누가 냈는지·어느 자리였는지)는 믿음에도
//   없다. 이것이 새면 R4 는 "짐작" 이 아니라 지연된 전지(全知)가 된다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 믿음도 사유를 값으로 남긴다.
// **틀린 믿음은 여기 없다** — 빗나간 짐작은 위반이 아니라 이 계층이 있는 이유다.

/** 믿음이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type BeliefViolationRule =
  // R4-a 짐작의 후보
  | 'unknown-channel' // O1 통로 6종에 없는 통로로 짐작하려 한다
  | 'blind-channel' // 통로가 여는 자리가 없거나 그 자리를 움직일 원자가 하나도 없다
  | 'guess-narrower-than-trace' // 통로가 센 애매함이 지각이 실어 온 애매함보다 작다 — 짐작이 진실을 보고 있다
  | 'candidate-miss' // 실제 원자가 후보에 없다 — 후보 계산이 틀렸다는 뜻이다
  // R4-b 믿음과 확신
  | 'unperceived-belief' // 읽지 않은 것에 대한 믿음 — 지금 근거가 될 수 있는 것은 제 지각뿐이다
  | 'foreign-belief' // 남의 지각을 근거로 삼았다 — 소문은 아직 없다
  | 'off-candidate-belief' // 통로가 열지 않은 원자를 짚었다
  | 'bad-confidence' // 확신이 0~1 밖이다
  | 'confidence-drift' // 요소에서 다시 세면 다른 값이다 (P4-c `score-drift` 의 짝)
  | 'overconfident-belief' // 좁힘이 허락한 상한을 넘는 확신이다
  | 'truth-copied' // 지각에 없던 진실(누가 냈는지·어느 자리였는지)이 믿음에 실렸다
  // R4-c 믿음 그래프와 감사
  | 'unheld-belief'; // 믿는 자가 없는 믿음 — 믿음은 언제나 누군가의 것이다

/** 위반 하나 — 누구의 어느 믿음이 왜 막혔는가. */
export interface BeliefViolation {
  readonly rule: BeliefViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.beliefs[1].confidence`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateBelief(
  out: BeliefViolation[],
  subject: string,
  rule: BeliefViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function beliefViolationVerdict(violations: readonly BeliefViolation[]): string {
  if (violations.length === 0) return '믿음이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '믿음' : subjects.join(', ');
  return `${who} 이 설 수 없다 — ${rules.join(', ')}`;
}
