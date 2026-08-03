// R3 위반 서식 — 감지가 지각으로 서지 못할 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R2 는 세계에 **표면**을 만들었다. 다섯 사건이 열다섯 흔적을 남겼고, 그 흔적은 통로를 타고
// 세계에 놓였다. 그런데 놓인 것과 읽히는 것은 다르다 — 냄새는 코가 있어야 오고, 빛은 가려지면
// 죽고, 보고는 말해 주는 자가 있어야 온다. R3 이 잇는 자리가 그것이다.
//
// R3 도 새 문법을 지어내지 않는다.
//
//   통로가 몇 가지인가      O1 `PHENOMENON_CHANNELS`
//   통로별 문턱과 거리      S0-b `PerceptionProfile` — 판정(`perceives`)까지 이미 있다
//   종마다 무엇이 열리는가  S1 `SenseSpec` (개체 배정은 S3)
//   무엇이 났는가           R2 `WorldPhenomenon`
//   누가 어디에 서 있는가   O2 `physical.region` · 가려졌는가 `physical.cover`
//
// R3 이 더하는 것은 **거리와 차폐를 세계에서 읽는 규칙** 하나다. 그리고 못박는 것이 하나 더 있다:
//
//   **지각에는 진실이 실리지 않는다.** 감지한 자가 얻는 것은 통로·세기·자리·애매함까지이고,
//   어느 자리가 움직였는지·누가 냈는지·무슨 원자였는지는 실리지 않는다. 이것이 새면 R4 의
//   거짓 믿음도 오인도 설 자리가 없다 — 본 순간 다 알아 버리기 때문이다. 그래서 그것을
//   **주장이 아니라 검사**로 만든다 (`truth-leak`).
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 지각도 사유를 값으로 남긴다.

/** 지각이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type PerceptViolationRule =
  // R3-a 거리와 차폐
  | 'placeless-observer' // 관측자가 세계에 선 곳이 없다 — 거리를 잴 수 없다
  | 'bad-attenuation' // 차폐 감쇠 계수가 0~1 밖이거나 통로 6종을 다 덮지 못한다
  | 'unknown-channel' // O1 통로 6종에 없는 통로다
  // R3-b 감지와 Percept
  | 'truth-leak' // 지각에 흔적의 유래(자리·일으킨 자·원자)가 실렸다
  | 'unsensed-percept' // 감지되지 않은 현상을 지각으로 세웠다
  | 'phantom-percept' // 세계에 없는 현상을 지각했다고 적었다
  | 'bad-intensity' // 감지 세기가 0~1 밖이거나 원래 세기보다 세다 — 감쇠는 키우지 않는다
  // R3-c 지각장과 감사
  | 'unprofiled-subject' // 감지 프로필이 없는 주체가 지각을 가졌다
  | 'stale-percept'; // 현상이 이미 삭은 틱의 지각이다

/** 위반 하나 — 누구의 어느 지각이 왜 막혔는가. */
export interface PerceptViolation {
  readonly rule: PerceptViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.percepts[1].intensity`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violatePercept(
  out: PerceptViolation[],
  subject: string,
  rule: PerceptViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function perceptViolationVerdict(violations: readonly PerceptViolation[]): string {
  if (violations.length === 0) return '지각이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '지각' : subjects.join(', ');
  return `${who} 이 설 수 없다 — ${rules.join(', ')}`;
}
