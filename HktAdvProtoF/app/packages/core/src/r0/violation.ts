// R0 위반 서식 — 세계를 담을 수 없을 때, 어느 커밋의 무엇이 왜 막혔는지를 한 모양으로 적는다.
//
// 여기서 계층이 바뀐다. P 계층까지는 전부 **아직 일어나지 않은 것**을 다뤘다 — 가능성·목적·계획은
// 세계에 적히지 않는다. R0 부터는 세계에 실제로 적히는 것을 다루고, 그래서 처음으로 **지우면
// 안 되는 것**이 생긴다.
//
// R0 이 지키는 것은 넷이다.
//
//   ① **담을 뿐 바꾸지 않는다.** 세계를 바꾸는 문법은 R1(사건)·R2(규칙)의 몫이다. R0 은 밖에서
//      들어온 세계를 받아 적고, 무엇이 달라졌는지는 O2 `worldDiff` 가 말한다.
//   ② **시간은 앞으로만 간다.** 틱은 V1 TickClock 이 주는 것이고 되돌릴 수 없다 — 같은 틱에
//      세계가 둘일 수도, 뒤로 갈 수도 없다.
//   ③ **과거는 지워지지 않는다.** 스냅샷마다 앞 스냅샷의 해시를 품으므로, 지나간 한 칸을 손대면
//      그 뒤가 전부 어긋난다 — 조용한 소급 수정이 불가능해진다 (W6 Observed 원칙의 선행 적용).
//   ④ **근거 없는 변경은 없다.** 세계가 달라졌다면 무엇 때문인지가 함께 적혀야 한다. R0 은 아직
//      사건을 볼 수 없으므로(R1 미착수) 근거의 **자리**만 열고 사람이 읽는 이름을 요구한다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 물린 커밋도 무엇이 막혔는지를 값으로 남긴다.

/** 커밋이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type StoreViolationRule =
  // R0-a 원장과 커밋 관문
  | 'backward-tick' // 앞 스냅샷보다 이른 틱에 세계를 담으려 한다 — 시간은 되돌릴 수 없다
  | 'duplicate-tick' // 같은 틱에 세계가 둘이다 — 어느 쪽이 그때의 세계인지 알 수 없다
  | 'empty-commit' // 달라진 것이 없는데 원장을 늘린다 — 원장은 시간이 아니라 변화를 센다
  | 'causeless-commit' // 무엇 때문에 달라졌는지 없이 세계가 달라진다 (R1 이 채울 자리)
  | 'rejected-state' // O2 조립 관문이 막은 값이 섞였다 — 사유를 그대로 옮겨 적는다
  | 'broken-chain' // 앞 스냅샷의 해시와 어긋난다 — 지나간 칸을 손댔다
  | 'genesis-required'; // 빈 원장의 첫 커밋이 genesis 가 아니거나, genesis 가 둘째로 온다

/** 위반 하나 — 어느 커밋의 어디가 왜 막혔는가. */
export interface StoreViolation {
  readonly rule: StoreViolationRule;
  /** 어느 틱의 커밋에서 걸렸는가. 특정할 수 없으면 -1 */
  readonly tick: number;
  /** 값 안의 경로 (`$.snapshots[2].hash`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateStore(
  out: StoreViolation[],
  tick: number,
  rule: StoreViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, tick, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function storeViolationVerdict(violations: readonly StoreViolation[]): string {
  if (violations.length === 0) return '세계를 담을 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const ticks = [...new Set(violations.map((violation) => violation.tick))].filter(
    (tick) => tick >= 0,
  );
  const where = ticks.length === 0 ? '원장' : `틱 ${ticks.join(', ')}`;
  return `${where} 을 담을 수 없다 — ${rules.join(', ')}`;
}
