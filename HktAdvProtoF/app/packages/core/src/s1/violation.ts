// S1 위반 서식 — 종이 세계에 설 수 없을 때, 어느 종의·어디가·왜 인지를 한 모양으로 적는다.
//
// S0 은 "이 개체가 다섯 질문에 답하는가" 를 봤다. S1 이 보는 것은 그보다 한 층 위다:
// **이 종에서 태어난 개체가 애초에 답을 가질 수 있는가.**
// 감각 없는 종에서 태어난 개체는 무엇을 감지하는지 답할 수 없고, 무너질 조건 없는 종에서
// 태어난 개체는 무엇에 의존하는지 답할 수 없다 — 개체를 아무리 잘 적어도 소용없다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 종도 사유·경로와 함께 화면에 실려야 한다.

import type { Id } from '../v1/id.ts';
import type { SubjectKind } from '../o1/being.ts';

/** 검사에 필요한 종의 최소 신원 — O0 SpeciesDefinition 에서 그대로 뽑힌다. */
export interface SpeciesRef {
  readonly id: Id;
  readonly name: string;
  readonly subjectKind: SubjectKind;
}

/** 종이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다 — 사유가 늘어나는 것이 보인다. */
export type SpeciesViolationRule =
  // S1-a 신체 원형
  | 'bad-species' // 종 정의 자체가 O0 를 지나지 못한다 (신원·공리)
  | 'bodiless-life' // 사람·생물인데 몸이 없다
  | 'bodied-abstraction' // 조직·국가·신인데 몸을 선언했다
  | 'coreless-body' // 본체 기관이 없다 — 나머지가 붙을 곳이 없다
  | 'unknown-organ' // 기관 6종 밖
  | 'duplicate-organ' // 같은 기관을 두 번 선언했다
  | 'bad-organ' // 개수·근거가 결함이다
  | 'fleshless-body' // 몸이 있는데 생물 영역 자리를 하나도 열지 않았다
  | 'bodiless-biology' // 몸이 없는데 생물 영역 자리를 열었다 — 조직은 굶지 않는다
  // S1-b 종의 감각
  | 'senseless-species' // 통로가 하나도 없다 — 세계가 이 종에게 일어나지 않는다
  | 'duplicate-sense' // 같은 통로를 두 번 선언했다
  | 'unknown-channel' // 현상 통로 6종 밖으로 감지한다고 적었다
  | 'organless-sense' // 몸을 거치는 통로인데 그것을 여는 기관이 몸에 없다
  | 'mismatched-organ' // 그 기관은 그 통로를 열지 않는다 (귀로 빛을 본다)
  | 'mediated-organ' // 남을 거쳐 오는 통로에 기관을 적었다
  | 'omniscient-sense' // 문턱이 0 이하다 — 전지한 감각은 은폐도 기만도 무너뜨린다
  | 'bad-sense-range' // 도달 거리가 O2 거리 범위 밖이다
  // S1-c 생애
  | 'ageless-body' // 몸이 있는데 생애 단계가 없다 — 늙지 않는 몸은 없다
  | 'aging-abstraction' // 몸 없는 종이 생애 단계를 가졌다 — 나라는 늙지 않는다
  | 'unknown-stage' // O2 growthStage 선택지 밖의 단계다
  | 'duplicate-stage' // 같은 단계를 두 번 지났다
  | 'unordered-stage' // 성장 단계가 O2 선택지 순서를 거스른다
  | 'bad-stage' // 지속 틱·대사·감각 배수가 범위 밖이다
  | 'unending-life' // 수명이 상한을 넘는다 — 죽지 않는 몸은 세계를 멈춘다
  // S1-d 기본 의존
  | 'needless-species' // 무너질 조건이 없다 — 잃을 것 없는 종에서는 목적이 자라지 않는다
  | 'off-species-slot' // 종 정의가 열지 않은 자리로 무너진다고 적었다
  | 'phantom-slot' // 세계에 없는 자리를 지킨다
  | 'bad-band' // 지켜야 하는 범위가 자리의 값 모양과 맞지 않는다
  | 'bad-template' // 급함·기준 붕괴 틱·근거가 범위 밖이다
  | 'duplicate-template' // 같은 자리에 기본 의존이 둘
  | 'bodiless-body-need' // 몸 없는 종이 몸의 자리에 의존을 걸었다
  // S1-e 종 원형 조립
  | 'incapable-species' // 종이 여는 능력이 하나도 없다
  | 'bad-capability' // 능력 인용이 규칙 ID 가 아니다
  | 'duplicate-capability' // 같은 능력을 두 번 인용했다
  | 'unknown-capability' // 세계에 없는 능력을 인용했다
  | 'unlawful-capability' // 공리를 어긴 능력을 종에 붙였다 — 누구도 예외가 아니다
  | 'unreachable-capability'; // 어느 단계에서도 열리지 않거나, 종이 갖지 않은 능력이 단계에서 열린다

/** 위반 하나 — 어느 종의 어느 자리가 왜 막혔는가. */
export interface SpeciesViolation {
  readonly rule: SpeciesViolationRule;
  readonly speciesId: Id;
  /** 화면에서 읽히도록 이름을 함께 싣는다 (S0 SubjectViolation 과 같은 태도) */
  readonly speciesName: string;
  readonly subjectKind: SubjectKind;
  /** 종 원형 안의 경로 (`$.body.organs[0].organ`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateSpecies(
  out: SpeciesViolation[],
  species: SpeciesRef,
  rule: SpeciesViolationRule,
  path: string,
  message: string,
): void {
  out.push({
    rule,
    speciesId: species.id,
    speciesName: species.name,
    subjectKind: species.subjectKind,
    path,
    message,
  });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function speciesViolationVerdict(violations: readonly SpeciesViolation[]): string {
  if (violations.length === 0) return '종이 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const names = [...new Set(violations.map((violation) => violation.speciesName))];
  return `종 ${names.join(', ')} 가 막혔다 — ${rules.join(', ')}`;
}
