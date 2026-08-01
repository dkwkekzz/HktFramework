// O1 공통 세계 존재론 — 모든 콘텐츠를 12타입 중 하나 이상으로 표현한다.
//
// 이 배럴이 12타입의 **유일한 판별 지점**이다. 타입 묶음이 하나 붙을 때마다
// CHECKERS 에 등록되고, 등록되지 않은 이름표는 classify 가 `kind-not-implemented` 로 돌려준다
// — 존재론이 절반만 서 있다는 사실이 값으로 드러난다.

import { asFields } from './check.ts';
import { beingCheckers, type Entity, type State, type Subject } from './being.ts';
import {
  ONTOLOGY_KINDS,
  isOntologyKind,
  type ClassifyResult,
  type OnticBase,
  type OntologyKind,
  type OntologyViolation,
} from './kinds.ts';

export * from './kinds.ts';
export * from './check.ts';
export * from './being.ts';

/** 존재론 원소 — 지금까지 정의된 타입들의 합. 묶음이 붙을 때마다 넓어진다. */
export type OnticNode = Subject | Entity | State;

type Checker = (fields: Readonly<Record<string, unknown>>, out: OntologyViolation[]) => void;

/** 12타입 검사표 — 아직 비어 있는 칸이 곧 남은 작업이다. */
const CHECKERS: Partial<Record<OntologyKind, Checker>> = {
  ...beingCheckers,
};

/** 필드까지 정의된 타입 (ONTOLOGY_KINDS 순서). */
export function implementedKinds(): readonly OntologyKind[] {
  return ONTOLOGY_KINDS.filter((kind) => CHECKERS[kind] !== undefined);
}

/**
 * 값이 12타입 중 무엇인가. 아니면 kind 는 null 이고 사유가 담긴다.
 * 던지지 않는다 — 결함 값도 화면에 사유와 함께 실려야 한다.
 */
export function classify(value: unknown): ClassifyResult {
  const violations: OntologyViolation[] = [];
  const fields = asFields(value, violations);
  if (fields === null) return { kind: null, violations };

  const kind = fields['kind'];
  if (!isOntologyKind(kind)) {
    violations.push({
      rule: 'unknown-kind',
      path: '$.kind',
      message: `kind 는 존재론 12타입 중 하나여야 한다 — ${JSON.stringify(kind)}`,
    });
    return { kind: null, violations };
  }

  const checker = CHECKERS[kind];
  if (checker === undefined) {
    violations.push({
      rule: 'kind-not-implemented',
      path: '$.kind',
      message: `${kind} 는 이름표만 있고 필드가 아직 정의되지 않았다 (O1 진행 중)`,
    });
    return { kind: null, violations };
  }

  checker(fields, violations);
  return { kind: violations.length === 0 ? kind : null, violations };
}

/** 값이 온전한 존재론 원소인가. */
export function isOntic(value: unknown): value is OnticNode {
  return classify(value).kind !== null;
}

/** 온전하지 않으면 사유를 모아 던진다 — 조립 코드에서 곧바로 쓸 때. */
export function assertOntic(value: unknown): OnticNode {
  const result = classify(value);
  if (result.kind === null) {
    const reasons = result.violations.map((v) => `${v.path} ${v.message}`).join(' · ');
    throw new TypeError(`존재론 원소가 아니다 — ${reasons}`);
  }
  return value as OnticNode;
}

/** kind 만 훑는다 (검사 없이 분류만 셀 때). */
export function kindOf(value: unknown): OntologyKind | null {
  if (typeof value !== 'object' || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  return isOntologyKind(kind) ? kind : null;
}

/** 원소 목록을 타입별로 센다 — 커버리지·화면 요약에 쓴다. */
export function countByKind(values: readonly unknown[]): Readonly<Record<OntologyKind, number>> {
  const counts = Object.fromEntries(ONTOLOGY_KINDS.map((kind) => [kind, 0])) as Record<
    OntologyKind,
    number
  >;
  for (const value of values) {
    const kind = kindOf(value);
    if (kind !== null) counts[kind] += 1;
  }
  return counts;
}

/** OnticBase 로 좁힌다 (kind 만 확인). 필드 검사는 classify 가 한다. */
export function asOnticBase(value: unknown): OnticBase | null {
  return kindOf(value) === null ? null : (value as OnticBase);
}
