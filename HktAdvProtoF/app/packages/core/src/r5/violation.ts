// R5 위반 서식 — 기억·사이·말이 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R4 는 **믿는 세계**까지 세웠다. 같은 자국을 놓고 셋이 다르게 짚었고 하나는 빗나갔다. 그런데
// 그 믿음에는 두 가지가 없다.
//
//   ① **누가 냈는지가 없다.** R4 후보는 "무슨 일이 있었나" 까지이고 `actorId` 는 실리지 않는다
//      (`truth-copied` 가 그것을 막는다). 그래서 R4 의 세계에서는 아무도 아무를 원망할 수 없다.
//   ② **남의 말이 없다.** 근거가 될 수 있는 것은 제 지각뿐이다(`foreign-belief`). 그래서 R4 의
//      세계에서는 아무도 남에게 무엇을 알려 줄 수 없다.
//
// R5 가 잇는 자리가 그 둘이다. 그리고 **새로 정하는 것은 셋뿐**이다.
//
//   ① **다시 볼 수 없게 된 믿음이 기억이다.** 자국이 서 있는 동안 그것은 믿음이고 다시 볼 수
//      있다. 자국이 삭으면 다시 볼 길이 없고, 남은 것이 기억이다 — R4-c `staleBeliefs` 가 그
//      목록을 이미 갖고 있다. R5 는 목록을 만들지 않고 **이름이 바뀌는 자리를 판정**할 뿐이다.
//   ② **겪은 자만 누구인지 안다.** 지목은 짐작에서 나오지 않는다. 세계의 사건이 제 자리를 바꾼
//      자는 누가 했는지 알고(제 손으로 겪었다), 밖에서 자국만 본 자는 무언가 있었다는 것만 안다.
//   ③ **말은 흔적이 된다.** 말하면 `report` 통로의 현상이 나고 듣는 자는 **제 귀로** 그것을
//      읽는다 — R4 의 벽은 그대로 선다. 다만 **말에는 지목이 실리고, 지목은 좁혀지지 않는다.**
//
// 나머지는 전부 앞 계층에서 온다: 소문이 옅어지는 것은 R3 거리·차폐가, 왜곡되는 것은 R4 문법
// 좁힘이, 사이의 축은 O2 `relational` 이, 미는 방향은 P0-b 걸림이, 크기는 R4 확신이 정한다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 기억도 사유를 값으로 남긴다.
// **틀린 지목은 여기 없다** — 남을 잘못 원망하는 것은 위반이 아니라 이 계층이 있는 이유다
// (R4 가 빗나간 믿음을 위반으로 세지 않은 것과 정확히 같은 자리다).

/** 기억·사이·말이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type MemoryViolationRule =
  // R5-a 기억과 지목
  | 'unsealed-memory' // 아직 서 있는 자국의 기억 — 그것은 기억이 아니라 믿음이다 (다시 볼 수 있다)
  | 'groundless-memory' // 근거(믿음·전언) 없이 선 기억
  | 'unheld-memory' // 지닌 자가 없는 기억 — 기억은 언제나 누군가의 것이다
  | 'future-memory' // 아직 오지 않은 일의 기억 (P3-b 가 이미 쓴 사유와 같은 자리)
  | 'guessed-attribution' // 겪지도 듣지도 않고 상대를 짚었다 — 지목은 짐작에서 나오지 않는다
  | 'unlived-attribution' // 겪었다고 적혔는데 그 사건이 이 주체의 자리를 바꾸지 않았다
  | 'memory-drift' // 굳는 순간의 확신과 다른 값이 적혔다 — 기억은 바래지 않는다
  | 'memory-truth-copied' // 믿음에 없던 진실(어느 자리·무슨 원자였는지)이 기억에 실렸다
  // R5-b 지닌 사이
  | 'unknown-axis' // O2 `relational` 이 적어 두지 않은 축으로 사이를 셌다
  | 'regard-drift' // 기억에서 다시 세면 다른 값이다 (P4-c `score-drift` 의 짝)
  | 'regard-out-of-range' // 세계가 적어 둔 폭 밖의 사이다
  | 'unattributed-regard' // 지목 없는 기억이 사이를 밀었다 — 누구인지 모르면 아무도 못 민다
  | 'self-regard' // 자기 자신에 대한 사이를 세웠다
  // R5-c 말과 소문
  | 'unrooted-rumor' // 그 기억이 딛고 선 사건을 가리키지 않는 말이다
  | 'unheard-telling' // 듣지 않은 말에서 기억이 섰다 — R4 `foreign-belief` 벽을 넘었다
  | 'louder-hearsay' // 들은 말이 말한 자의 확신보다 세다 — 거쳐서 진해질 수는 없다
  | 'widened-hearsay' // 들으면서 내용이 넓어졌다 — 거치는 자는 좁히기만 한다
  | 'unspoken-telling' // 지니지 않은 기억을 말했다
  | 'hopless-chain'; // 거쳐 온 입의 수와 거쳐 온 자들의 수가 어긋난다

/** 위반 하나 — 누구의 어느 기억이 왜 막혔는가. */
export interface MemoryViolation {
  readonly rule: MemoryViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.memories[1].confidence`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateMemory(
  out: MemoryViolation[],
  subject: string,
  rule: MemoryViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function memoryViolationVerdict(violations: readonly MemoryViolation[]): string {
  if (violations.length === 0) return '기억이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '기억' : subjects.join(', ');
  return `${who} 이 설 수 없다 — ${rules.join(', ')}`;
}
