// O1 존재론 골격 — 세계에 적을 수 있는 것의 이름표 12종과, 그것들이 공유하는 최소 형태.
//
// 원칙: 존재론 원소는 **데이터일 뿐**이다. 함수·클래스·클로저로만 존재하는 개념은 금지된다
// (WORKFLOW §6-1). 그래서 모든 타입은 `kind` 로 자기를 밝히는 평범한 레코드이고,
// 판별은 값 자체를 읽어서 한다 — instanceof 도, 등록된 생성자도 없다.
//
// 순서는 원문 O1 의 나열 그대로다. 이름을 바꾸면 원문과의 대조가 끊기므로 바꾸지 않는다.

import type { Id } from '../v1/id.ts';

/** 존재론 12타입. */
export const ONTOLOGY_KINDS = [
  'Subject',
  'Entity',
  'State',
  'Rule',
  'Phenomenon',
  'Claim',
  'Commitment',
  'Affordance',
  'Event',
  'Dependency',
  'Possibility',
  'WorldRequirement',
] as const;

export type OntologyKind = (typeof ONTOLOGY_KINDS)[number];

/** 12타입이 공유하는 최소 형태 — 자기가 무엇인지(kind)와 누구인지(id). */
export interface OnticBase<K extends OntologyKind = OntologyKind> {
  readonly kind: K;
  /** V1 결정적 ID — `<kind>:<hex>` (v1/id.ts) */
  readonly id: Id;
}

/** 존재론 위반 사유. */
export type OntologyViolationRule =
  | 'not-a-record' // 값이 레코드(평범한 객체)가 아니다
  | 'unknown-kind' // kind 가 12타입에 없다
  | 'kind-not-implemented' // 이름표는 있으나 아직 필드가 정의되지 않았다 (O1 진행 중)
  | 'missing-field' // 필수 필드가 없다
  | 'bad-field' // 필드 값이 계약과 다르다
  | 'not-serializable'; // 상태 원소 규칙 위반 — 직렬화할 수 없다

/** 위반 하나 — 어느 경로가 왜 틀렸는지까지 말한다. 눈으로 고칠 수 있어야 한다. */
export interface OntologyViolation {
  readonly rule: OntologyViolationRule;
  /** 값 안의 경로 (`$.strength`). 값 전체면 `$` */
  readonly path: string;
  readonly message: string;
}

/** 값이 12타입 중 하나인가 — 아니면 그 사유. */
export interface ClassifyResult {
  readonly kind: OntologyKind | null;
  readonly violations: readonly OntologyViolation[];
}

/** kind 문자열이 12타입에 있는가. */
export function isOntologyKind(value: unknown): value is OntologyKind {
  return typeof value === 'string' && (ONTOLOGY_KINDS as readonly string[]).includes(value);
}
