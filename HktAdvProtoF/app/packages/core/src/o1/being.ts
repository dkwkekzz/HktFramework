// O1-a 존재 3종 — 세계에 "있는 것" 을 적는 세 타입.
//
//   Subject  스스로 의존을 갖고 목적을 만드는 존재 (사람·생물·조직·국가·신)
//   Entity   목적을 만들지 않는 존재 (사물·물질·장소·구조물·기관·기록)
//   State    그 존재들이 지금 어떤 값에 있는가
//
// 셋의 경계는 "목적을 만드는가" 다. 마물은 Subject 고, 마물의 사체는 Entity 다.
// 여기 있는 것은 **최소 형태**다 — S0 은 이 Subject 에 감각·기억·믿음 그래프를 더하고,
// O2 는 이 State 에 9영역 필드 트리를 더한다. 나중 계층은 확장하되 필드를 빼지 않는다.

import type { Id } from '../v1/id.ts';
import {
  needEnum,
  needId,
  needIdOrNull,
  needString,
  type Fields,
} from './check.ts';
import type { OnticBase, OntologyViolation } from './kinds.ts';

/** 주체의 종류 — 원문 S0 의 다섯 (사람·생물·조직·국가·신). */
export const SUBJECT_KINDS = ['person', 'creature', 'organization', 'nation', 'god'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/** 사물의 종류. */
export const ENTITY_KINDS = [
  'object', // 도구·물건
  'material', // 광물·약초 같은 재료
  'place', // 장소 (X0 의미 공간의 노드가 된다)
  'structure', // 건축·유적
  'organ', // 거대 마물의 기관 (C1)
  'record', // 문서·비석·소문의 매체
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/**
 * 상태 영역 9종 — MODULES.md O2 행의 분류를 이름표로만 먼저 고정한다.
 * 영역 안의 필드 트리는 O2 가 확정한다 (원문 §12.1 의 영역 목록과 대조 예정).
 */
export const STATE_DOMAINS = [
  'physical', // 물리 — 위치·온도·구조 안정성·차폐
  'biological', // 생물 — 체력·허기·질병·성장
  'ecological', // 생태 — 개체군·서식지·먹이사슬
  'relational', // 관계 — 신뢰·적대·부채
  'institutional', // 제도 — 법·소유권·자격
  'economic', // 경제 — 재고·가격·유통
  'informational', // 정보 — 알려짐·소문·기록
  'psychic', // 의념 — 신념 압력·주술 잔향
  'transcendent', // 초월 — 신역·앵커·정당성
] as const;
export type StateDomain = (typeof STATE_DOMAINS)[number];

/** 상태가 가질 수 있는 값 — 비교·해시 가능한 스칼라만. 구조는 State 여러 개로 쪼갠다. */
export type StateValue = number | string | boolean;

/** 스스로 의존을 갖고 목적을 만드는 존재. */
export interface Subject extends OnticBase<'Subject'> {
  readonly subjectKind: SubjectKind;
  readonly name: string;
  /** 상위 주체 (구성원→조직, 조직→국가). 독립 주체면 null */
  readonly partOfId: Id | null;
}

/** 목적을 만들지 않는 존재. */
export interface Entity extends OnticBase<'Entity'> {
  readonly entityKind: EntityKind;
  readonly name: string;
  /** 어디에 있는가 — place Entity 의 id. 장소 자신이거나 무소속이면 null */
  readonly locationId: Id | null;
}

/** 어떤 존재의 한 값. 상태는 사건(Event)으로만 바뀐다 (R1). */
export interface State extends OnticBase<'State'> {
  readonly domain: StateDomain;
  /** 누구의 상태인가 — Subject 또는 Entity 의 id */
  readonly ofId: Id;
  /** 영역 안의 경로 (`hunger`, `stock.food`) — 필드 트리는 O2 가 확정한다 */
  readonly path: string;
  readonly value: StateValue;
}

/** Subject 필드 검사. */
export function checkSubject(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'subjectKind', SUBJECT_KINDS, out);
  needString(fields, 'name', out);
  needIdOrNull(fields, 'partOfId', out);
}

/** Entity 필드 검사. */
export function checkEntity(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'entityKind', ENTITY_KINDS, out);
  needString(fields, 'name', out);
  needIdOrNull(fields, 'locationId', out);
}

/** State 필드 검사. */
export function checkState(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'domain', STATE_DOMAINS, out);
  needId(fields, 'ofId', out);
  needString(fields, 'path', out);
  const value = fields['value'];
  if (value === undefined) {
    out.push({ rule: 'missing-field', path: '$.value', message: 'value 가 없다' });
  } else if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
    out.push({
      rule: 'bad-field',
      path: '$.value',
      message: `상태 값은 수·문자열·참거짓만 가능하다 — ${typeof value}. 구조는 State 여러 개로 쪼갠다`,
    });
  } else if (typeof value === 'number' && !Number.isFinite(value)) {
    out.push({
      rule: 'bad-field',
      path: '$.value',
      message: `상태 값은 유한해야 한다 — ${String(value)}`,
    });
  }
}

/** 존재 3종의 검사기 묶음 — o1/index.ts 가 12타입 표로 합친다. */
export const beingCheckers = {
  Subject: checkSubject,
  Entity: checkEntity,
  State: checkState,
} as const;

/** 값이 이 타입인지 좁힌다 (검사는 classify 가 한다 — 여기서는 kind 만 본다). */
export function isSubject(value: OnticBase): value is Subject {
  return value.kind === 'Subject';
}

export function isEntity(value: OnticBase): value is Entity {
  return value.kind === 'Entity';
}

export function isState(value: OnticBase): value is State {
  return value.kind === 'State';
}
