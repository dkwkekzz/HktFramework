// S2 위반 서식 — 문화·역할이 종 위에 얹힐 수 없을 때, 어느 문화의·어디가·왜 인지를 한 모양으로 적는다.
//
// S1 이 본 것은 "이 종에서 태어난 개체가 답을 가질 수 있는가" 였다.
// S2 가 보는 것은 그 위에 얹힌다: **이 문화가 그 종에게 얹힐 수 있는가.**
//
// 문화는 종을 넘어설 수 없다. 의념 잔향을 읽는 문화를 그것을 감지하지 못하는 종에게 씌우면,
// 그 개체는 평생 그 읽기를 쓰지 못한다 — 문화가 아니라 글자다. 마찬가지로 종이 이미 여는
// 능력을 역할이 또 여는 것은 입문 의례가 아니고, 아무도 열지 않은 능력을 금하는 것은 금기가 아니다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 문화도 사유·경로와 함께 화면에 실려야 한다.

import type { Id } from '../v1/id.ts';

/** 검사에 필요한 문화의 최소 신원. 역할 안에서 걸린 것이면 역할 이름이 함께 실린다. */
export interface CultureRef {
  readonly id: Id;
  readonly name: string;
  /** 문화 자체에서 걸렸으면 null, 역할 안에서 걸렸으면 그 역할의 이름 */
  readonly roleName: string | null;
}

/** 문화 하나의 신원 — 역할 문맥 없이. */
export function cultureRef(culture: { readonly id: Id; readonly name: string }): CultureRef {
  return { id: culture.id, name: culture.name, roleName: null };
}

/** 그 문화 안의 역할 문맥으로 좁힌다 — 위반이 어느 자리의 것인지 화면에서 읽힌다. */
export function roleRef(culture: CultureRef, roleName: string): CultureRef {
  return { id: culture.id, name: culture.name, roleName };
}

/** 문화·역할이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type CultureViolationRule =
  // S2-a 해석
  | 'bad-culture' // 문화·역할 자체가 O1 Rule 로 서지 못한다 (신원·조건·효과)
  | 'unreadable-culture' // 읽기가 하나도 없다 — 같은 세계를 똑같이 읽는 문화는 문화가 아니다
  | 'unknown-channel' // 현상 통로 6종 밖으로 읽는다고 적었다
  | 'signless-reading' // 무엇을 읽는지 비어 있다
  | 'empty-assertion' // 무엇이라고 읽는지 비어 있다
  | 'bad-confidence' // 확신이 0 초과 1 이하가 아니다
  | 'bad-stance' // 읽기가 미는 방향이 3종 밖이다
  | 'duplicate-reading' // 같은 통로의 같은 표식을 두 가지로 읽는다
  | 'unsensed-reading' // 그 종이 열지 않은 통로를 읽는다 — 문화는 종을 넘어서지 못한다
  // S2-b 가치 템플릿
  | 'valueless-culture' // 원하는 것이 없다 — 무엇을 원하는지 같으면 개체가 갈리지 않는다
  | 'phantom-slot' // 세계에 없는 자리를 원한다
  | 'bad-band' // 원하는 범위가 자리의 값 모양과 맞지 않는다
  | 'bad-value-template' // 미는 힘·근거가 범위 밖이다
  | 'duplicate-value' // 같은 자리를 두 번 원한다
  | 'bodiless-body-value' // 몸 없는 종의 문화가 몸의 자리를 원한다
  | 'need-shadowing-value' // 종이 이미 무너지는 자리로 잡은 것을 문화가 다시 민다
  // S2-c 역할
  | 'roleless-culture' // 자리가 없는 문화는 개체를 더 가르지 못한다
  | 'duplicate-role' // 같은 이름의 자리가 둘
  | 'foreign-role' // 그 문화의 자리가 아니다
  | 'empty-role' // 더하지도 막지도 원하지도 읽지도 않는다 — 그것은 자리가 아니다
  | 'bad-grant' // 능력 인용이 규칙 ID 가 아니다
  | 'unknown-grant' // 세계에 없는 능력을 연다
  | 'unlawful-grant' // 공리를 어긴 능력을 연다 — 문화도 예외가 아니다
  | 'redundant-grant' // 종이 이미 여는 능력을 역할이 또 연다 — 입문 의례가 아무것도 더하지 않는다
  | 'phantom-taboo' // 아무도 열지 않은 능력을 금한다 — 없는 것을 금할 수 없다
  | 'self-defeating-role' // 자기가 연 능력을 자기가 금한다
  // S2-d 조립
  | 'speciesless-culture' // 어느 종의 문화인지 없다
  | 'unknown-species' // 세계에 없는 종에 얹힌다
  | 'duplicate-culture-species' // 같은 종을 두 번 적었다
  | 'total-taboo'; // 금기가 개체의 능력을 전부 막는다 — 아무것도 할 수 없는 개체는 사물이다

/** 위반 하나 — 어느 문화의 어느 자리가 왜 막혔는가. */
export interface CultureViolation {
  readonly rule: CultureViolationRule;
  readonly cultureId: Id;
  /** 화면에서 읽히도록 이름을 함께 싣는다 (S0·S1 위반과 같은 태도) */
  readonly cultureName: string;
  /** 역할 안에서 걸렸으면 그 역할의 이름 */
  readonly roleName: string | null;
  /** 문화 원형 안의 경로 (`$.readings[0].channel`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateCulture(
  out: CultureViolation[],
  culture: CultureRef,
  rule: CultureViolationRule,
  path: string,
  message: string,
): void {
  out.push({
    rule,
    cultureId: culture.id,
    cultureName: culture.name,
    roleName: culture.roleName,
    path,
    message,
  });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function cultureViolationVerdict(violations: readonly CultureViolation[]): string {
  if (violations.length === 0) return '문화가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const names = [
    ...new Set(
      violations.map((violation) =>
        violation.roleName === null
          ? violation.cultureName
          : `${violation.cultureName}/${violation.roleName}`,
      ),
    ),
  ];
  return `문화 ${names.join(', ')} 가 막혔다 — ${rules.join(', ')}`;
}
