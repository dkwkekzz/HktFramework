// O1-d 요구 3종 — 주체의 결핍이 세계에 대한 청구가 되기까지를 적는 세 타입.
//
//   Dependency        주체가 무엇 없이 못 사는가 (D 계층)
//   Possibility       그 결핍을 어떻게 다룰 수 있는가 (P 계층)
//   WorldRequirement  그러려면 세계가 무엇을 갖춰야 하는가 (Q 계층)
//
// 이 셋은 프로젝트의 생성 방향 그 자체다: 세계가 주체를 낳는 것이 아니라
// 주체의 결핍이 세계를 청구한다 (원문 §1.2). 그래서 셋은 반드시 id 로 이어진다 —
// 어떤 요구도 "어느 가능성에서, 어느 의존 때문에" 를 답하지 못하면 근거 없는 요구다.
//
// 값의 계산(압력·성공률·병합)은 D4·P4·W1 의 몫이다. O1 은 그 계산이 읽을
// 필드가 무엇인지만 고정한다.

import type { Id } from '../v1/id.ts';
import {
  needEnum,
  needId,
  needIdList,
  needIdOrNull,
  needString,
  needStringList,
  needUnit,
  type Fields,
} from './check.ts';
import type { OnticBase, OntologyViolation } from './kinds.ts';

/** 의존 대상 11종 (MODULES.md D0 행). */
export const DEPENDENCY_KINDS = [
  'resource', // 자원 — 식량·물·광물
  'space', // 공간 — 거처·영역·통로
  'environment', // 환경 — 기온·대기·수원
  'body', // 신체 — 기관·체력·수면
  'subject', // 주체 — 특정 인물·집단
  'relationship', // 관계 — 신뢰·소속
  'information', // 정보 — 위치·방법·소문
  'institution', // 제도 — 소유권·자격·보호
  'rule', // 규칙 — 세계 규칙 자체에의 의존
  'ritual', // 의례 — 반복 행위·숭배
  'time', // 시간 — 주기·기한
] as const;
export type DependencyKind = (typeof DEPENDENCY_KINDS)[number];

/** 결핍에 대응하는 방향 7종 (MODULES.md P1 행). */
export const STRATEGY_DIRECTIONS = [
  'fulfill', // 충족 — 그대로 채운다
  'substitute', // 대체 — 다른 것으로 채운다
  'reduce', // 감소 — 필요량을 줄인다
  'produce', // 생산 — 스스로 만든다
  'delegate', // 위임 — 남에게 맡긴다
  'removeRival', // 경쟁 제거 — 다투는 상대를 없앤다
  'removeDependency', // 의존 제거 — 의존 자체를 끊는다 (G4 가 대가를 강제한다)
] as const;
export type StrategyDirection = (typeof STRATEGY_DIRECTIONS)[number];

/** 세계에 거는 요구의 종류 8종 (MODULES.md Q0 행). */
export const REQUIREMENT_KINDS = [
  'space', // 공간
  'resource', // 자원
  'rule', // 규칙
  'state', // 상태
  'counterpart', // 상대 주체
  'information', // 정보
  'time', // 시간
  'history', // 역사
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

/** 요구의 범위 (MODULES.md Q2 행) — 개인 요구로 대륙을 만들지 못하게 한다. */
export const REQUIREMENT_SCOPES = ['personal', 'local', 'regional', 'world'] as const;
export type RequirementScope = (typeof REQUIREMENT_SCOPES)[number];

/** 주체가 무엇 없이 못 사는가. */
export interface Dependency extends OnticBase<'Dependency'> {
  readonly subjectId: Id;
  readonly dependencyKind: DependencyKind;
  /** 특정 대상에 걸린 의존이면 그 id. 종류로만 걸리면 null (예: "아무 식량이든") */
  readonly targetId: Id | null;
  /** 어떤 상태여야 충족인가 */
  readonly desiredCondition: string;
  /** 얼마나 강한가 0~1 — 끊겼을 때의 타격 */
  readonly strength: number;
  /** 얼마나 급한가 0~1 */
  readonly urgency: number;
  /** 얼마나 갈아탈 수 있는가 0~1 — 1 이면 무엇으로든 대체 가능 */
  readonly substitutability: number;
}

/** 결핍을 다루는 한 가지 길. */
export interface Possibility extends OnticBase<'Possibility'> {
  readonly subjectId: Id;
  /** 어느 의존 때문에 생긴 길인가 — 결핍 없는 가능성은 없다 */
  readonly forDependencyId: Id;
  readonly direction: StrategyDirection;
  /** 행동 원자의 순서열 (P0 이 16원자를 확정한다). 비면 실행할 수 없다 */
  readonly atoms: readonly string[];
  /** 먼저 성립해야 하는 다른 가능성·상태의 id */
  readonly preconditionIds: readonly Id[];
}

/** 그 길이 성립하려면 세계가 갖춰야 하는 것. */
export interface WorldRequirement extends OnticBase<'WorldRequirement'> {
  readonly requirementKind: RequirementKind;
  /** 어느 가능성이 청구했는가 — 근거 없는 요구는 세계를 만들 수 없다 (Q3) */
  readonly fromPossibilityId: Id;
  readonly description: string;
  readonly scope: RequirementScope;
  /** 얼마나 무겁게 반영할 것인가 0~1 (W1 병합의 가중치) */
  readonly weight: number;
}

/** Dependency 필드 검사. */
export function checkDependency(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needId(fields, 'subjectId', out);
  needEnum(fields, 'dependencyKind', DEPENDENCY_KINDS, out);
  needIdOrNull(fields, 'targetId', out);
  needString(fields, 'desiredCondition', out);
  needUnit(fields, 'strength', out);
  needUnit(fields, 'urgency', out);
  needUnit(fields, 'substitutability', out);

  // 강도 0 의 의존은 끊겨도 아무 일이 없다 — 그것은 의존이 아니다.
  if (fields['strength'] === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.strength',
      message: '강도 0 은 의존이 아니다 — 끊겨도 아무 일이 없으면 적지 않는다',
    });
  }
}

/** Possibility 필드 검사. */
export function checkPossibility(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needId(fields, 'subjectId', out);
  needId(fields, 'forDependencyId', out); // 결핍 없는 가능성은 없다 — null 불가
  needEnum(fields, 'direction', STRATEGY_DIRECTIONS, out);
  needStringList(fields, 'atoms', out);
  needIdList(fields, 'preconditionIds', out);

  const atoms = fields['atoms'];
  if (Array.isArray(atoms) && atoms.length === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.atoms',
      message: '행동 원자가 없으면 실행할 수 없다 — 가능성이 아니라 바람이다',
    });
  }
}

/** WorldRequirement 필드 검사. */
export function checkWorldRequirement(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'requirementKind', REQUIREMENT_KINDS, out);
  needId(fields, 'fromPossibilityId', out); // 근거 없는 요구 금지 — null 불가
  needString(fields, 'description', out);
  needEnum(fields, 'scope', REQUIREMENT_SCOPES, out);
  needUnit(fields, 'weight', out);
}

/** 요구 3종의 검사기 묶음. */
export const demandCheckers = {
  Dependency: checkDependency,
  Possibility: checkPossibility,
  WorldRequirement: checkWorldRequirement,
} as const;

export function isDependency(value: OnticBase): value is Dependency {
  return value.kind === 'Dependency';
}

export function isPossibility(value: OnticBase): value is Possibility {
  return value.kind === 'Possibility';
}

export function isWorldRequirement(value: OnticBase): value is WorldRequirement {
  return value.kind === 'WorldRequirement';
}

/**
 * 요구 → 가능성 → 의존 으로 되짚어 근거 사슬이 이어지는가 (Q3 ProvenanceChain 의 최소판).
 * 끊긴 고리의 id 를 돌려준다 — 이어져 있으면 빈 목록.
 */
export function provenanceGaps(
  requirement: WorldRequirement,
  possibilities: readonly Possibility[],
  dependencies: readonly Dependency[],
): readonly string[] {
  const possibility = possibilities.find((item) => item.id === requirement.fromPossibilityId);
  if (possibility === undefined) return [requirement.fromPossibilityId];
  const dependency = dependencies.find((item) => item.id === possibility.forDependencyId);
  return dependency === undefined ? [possibility.forDependencyId] : [];
}
