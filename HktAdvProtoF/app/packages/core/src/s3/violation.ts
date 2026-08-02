// S3 위반 서식 — 개체가 세계에 설 수 없을 때, 어느 개체의·어디가·왜 인지를 한 모양으로 적는다.
//
// S1 은 "이 종에서 태어난 개체가 답을 가질 수 있는가", S2 는 "이 문화가 그 종에게 얹힐 수 있는가"
// 를 봤다. S3 가 보는 것은 마지막 층이다: **이 개체가 자기 값의 유래를 댈 수 있는가.**
//
// 개체는 지어내는 자리가 아니다. 감각·의존은 종이, 읽기·원함은 문화·자리가 준다. 개체가 더하는
// 것은 둘뿐 — 지나온 것(이력)과 타고난 기울기(성격)다. 그 둘조차 세계에 없는 것을 만들 수는 없다:
// 과거는 지금의 자리에 값을 남겨야 하고, 성격은 이미 있는 값을 흔들 뿐이다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 개체도 사유·경로와 함께 화면에 실려야 한다.

import type { Id } from '../v1/id.ts';

/** 검사에 필요한 개체의 최소 신원. */
export interface InstanceRef {
  readonly id: Id;
  readonly name: string;
}

/** 개체가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type InstanceViolationRule =
  // S3-a 과거 사건
  | 'bad-past-event' // 과거가 O1 Event 로 서지 못한다
  | 'traceless-past' // 지금의 자리에 아무것도 남기지 않았다 — 흔적 없는 과거는 과거가 아니다
  | 'phantom-slot' // 세계에 없는 자리에 남기려 한다
  | 'bad-residue' // 남긴 값이 그 자리의 값 모양과 맞지 않는다
  | 'foreign-residue' // 그 보유자가 가질 수 없는 자리다
  | 'duplicate-residue' // 같은 개체의 같은 자리에 두 과거가 다른 값을 남긴다
  | 'future-past' // 태어나기 전이 아닌 시각이다 — 아직 오지 않은 일은 이력이 아니다
  | 'unordered-history' // 이력이 시간 순이 아니다
  | 'self-caused-past' // 자기 자신을 원인으로 삼는다
  // S3-b 성격
  | 'bad-trait' // 성격이 O1 Rule 로 서지 못한다
  | 'idle-trait' // 아무 값도 흔들지 않는다 — 흔들지 않는 기울기는 성격이 아니다
  | 'bad-tune' // 배수가 범위 밖이다
  | 'unit-tune' // 배수가 1 이다 — 흔들지 않는 것과 같다
  | 'duplicate-tune' // 같은 자리를 두 번 흔든다
  | 'phantom-tune' // 이 개체에게 없는 자리를 흔든다 — 성격은 새 자리를 만들지 못한다
  | 'conflicting-trait' // 두 성격이 같은 자리를 흔든다 — 어느 쪽이 이길지 알 수 없다
  // S3-c 개체 조립
  | 'bad-instance' // 개체가 S0 관문을 지나지 못한다
  | 'unnamed-instance' // 이름표가 없다 — ID 가 서지 않는다
  | 'off-culture-role' // 그 문화의 자리가 아니다
  | 'off-species-culture' // 그 종이 지닐 수 없는 문화다
  | 'orphan-value'; // 유래를 댈 수 없는 값이 있다 — 개체는 지어내지 않는다

/** 위반 하나 — 어느 개체의 어느 자리가 왜 막혔는가. */
export interface InstanceViolation {
  readonly rule: InstanceViolationRule;
  readonly subjectId: Id;
  /** 화면에서 읽히도록 이름을 함께 싣는다 (S0~S2 위반과 같은 태도) */
  readonly subjectName: string;
  /** 개체 안의 경로 (`$.history[0].residue[1].slot`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateInstance(
  out: InstanceViolation[],
  subject: InstanceRef,
  rule: InstanceViolationRule,
  path: string,
  message: string,
): void {
  out.push({
    rule,
    subjectId: subject.id,
    subjectName: subject.name,
    path,
    message,
  });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function instanceViolationVerdict(violations: readonly InstanceViolation[]): string {
  if (violations.length === 0) return '개체가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const names = [...new Set(violations.map((violation) => violation.subjectName))];
  return `개체 ${names.join(', ')} 가 막혔다 — ${rules.join(', ')}`;
}
