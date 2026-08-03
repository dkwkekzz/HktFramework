// R2 위반 서식 — 사건이 남긴 흔적이 현상으로 서지 못할 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// R1 이 닫은 자리는 "세계를 바꾸는 길은 사건 하나뿐" 이었다. 그런데 그 다섯 사건은 세계를 바꿨을 뿐
// **아무도 그것을 보지 못했다.** 04 가 상단 11 을 친 일이 어딘가에 남지 않으면 R3 은 감지할 것이
// 없고, R4 는 오해할 것이 없으며, 세계는 관찰 불가능해진다 (MasterPlan §6.1).
//
// R2 도 새 문법을 지어내지 않는다.
//
//   통로가 몇 가지인가   O1 `PHENOMENON_CHANNELS` 6종 (빛·소리·흔적·냄새·의념 잔향·보고서)
//   현상이 무엇으로 서나  O1 `Phenomenon` (통로·원인 사건·자리·세기·수명)
//   흔적이 왜 필요한가   O0 `observable-trace` — 흔적 없는 것은 아무도 그것이 일어났음을 알 수 없다
//   원인이 왜 필요한가   O0 `caused-persistence` — 원인 없는 지속적 결과는 존재할 수 없다
//   무엇이 움직였는가    R1 `WorldEvent.effects` (from → to)
//   흔적이 남는가        P0-b `reversible`
//
// R2 가 더하는 것은 **표면**이다: 세계의 변화가 어느 통로로 새는지, 그리고 무엇이 새지 않는지.
// 그래서 관문도 표면을 지킨다 — 통로를 대지 못하는 자리가 없게, 새지 않는 자리가 몰래 새지 않게,
// 원인 없는 현상이 서지 않게, 그리고 어디서 났는지 못 대는 현상이 남지 않게.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 현상도 사유를 값으로 남긴다.

/** 현상이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type PhenomenonViolationRule =
  // R2-a 흔적의 통로
  | 'unchanneled-slot' // 원자가 움직일 수 있는 자리인데 어느 통로로 새는지 적히지 않았다
  | 'phantom-channel' // 세계(O2)에 없는 자리에 통로를 적었다
  | 'undeclared-silence' // 새지 않는다고 적어 놓고 그 이유를 선언하지 않았다
  | 'stale-silence' // 새지 않는다고 선언해 놓고 실제로는 통로를 갖는다 — 예외가 낡았다
  | 'unused-channel' // O1 이 연 통로인데 아무 자리도 그리로 새지 않는다
  | 'unknown-channel' // 6종에 없는 통로를 적었다
  // R2-b 세기·수명·자리
  | 'causeless-phenomenon' // 원인 사건이 없다 (O0 caused-persistence · O1 checkPhenomenon)
  | 'sealed-leak' // 새지 않는다고 선언된 자리에서 현상이 났다고 주장한다
  | 'still-phenomenon' // 움직이지 않은 자리에서 현상이 났다 — 세계가 그대로면 흔적도 없다
  | 'placeless-phenomenon' // 어디서 났는지 댈 수 없다 — 세계에 자리 없는 현상은 감지될 수 없다
  | 'malformed-phenomenon' // O1 Phenomenon 관문을 지나지 못한다
  // R2-c 현상장과 감사
  | 'unlogged-cause' // 원인으로 지목한 사건이 로그에 없다
  | 'missing-trace'; // 새는 자리를 움직였는데 현상이 하나도 나지 않았다

/** 위반 하나 — 어느 현상의 어디가 왜 막혔는가. */
export interface PhenomenonViolation {
  readonly rule: PhenomenonViolationRule;
  /** 어느 자리·현상인가 (사람이 읽는 이름). 특정할 수 없으면 빈 문자열 */
  readonly where: string;
  /** 값 안의 경로 (`$.effects[1]`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violatePhenomenon(
  out: PhenomenonViolation[],
  where: string,
  rule: PhenomenonViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, where, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function phenomenonViolationVerdict(
  violations: readonly PhenomenonViolation[],
): string {
  if (violations.length === 0) return '흔적이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const places = [...new Set(violations.map((violation) => violation.where))].filter(
    (where) => where !== '',
  );
  const at = places.length === 0 ? '현상' : places.join(', ');
  return `${at} 이 설 수 없다 — ${rules.join(', ')}`;
}
