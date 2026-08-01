// O1 필드 검사 헬퍼 — 12타입의 검사기가 같은 말투로 위반을 남기게 한다.
//
// 여기서 던지지 않는다. 결함 값도 "어느 경로가 왜 틀렸는가" 와 함께 돌아와야
// Lab 화면(⑥ 실패 이유)에 그대로 실릴 수 있다 — V0 계약 검사와 같은 태도다.
//
// 추가 필드는 막지 않는다. S·D·P 계층이 여기 정의된 타입을 **확장**하기 때문이다
// (예: S0 Subject 는 O1 Subject 에 기억·믿음 그래프 id 를 더한다).

import { canonicalize } from '../v1/hash.ts';
import { idKind } from '../v1/id.ts';
import type { OntologyViolation, OntologyViolationRule } from './kinds.ts';

/** 검사 중인 원소의 필드 묶음. */
export type Fields = Readonly<Record<string, unknown>>;

/** 위반 하나를 남긴다. */
export function violate(
  out: OntologyViolation[],
  rule: OntologyViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, path, message });
}

/** 값이 평범한 레코드이고 전부 직렬화 가능한가 — 상태 원소 규칙의 관문. */
export function asFields(value: unknown, out: OntologyViolation[]): Fields | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    violate(out, 'not-a-record', '$', `존재론 원소는 레코드여야 한다 — ${typeof value}`);
    return null;
  }
  try {
    canonicalize(value);
  } catch (error) {
    // 함수·순환 참조·무한수 — 상태 원소로 남을 수 없는 값들이 여기서 걸린다.
    violate(out, 'not-serializable', '$', error instanceof Error ? error.message : String(error));
    return null;
  }
  return value as Fields;
}

function missing(out: OntologyViolation[], key: string): void {
  violate(out, 'missing-field', `$.${key}`, `${key} 가 없다`);
}

/** 비어 있지 않은 문자열. */
export function needString(fields: Fields, key: string, out: OntologyViolation[]): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (typeof value !== 'string') {
    return violate(out, 'bad-field', `$.${key}`, `${key} 는 문자열이어야 한다 — ${typeof value}`);
  }
  if (value === '') {
    violate(out, 'bad-field', `$.${key}`, `${key} 는 비어 있을 수 없다`);
  }
}

/** 정해진 값 집합 중 하나. */
export function needEnum(
  fields: Fields,
  key: string,
  allowed: readonly string[],
  out: OntologyViolation[],
): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (typeof value !== 'string' || !allowed.includes(value)) {
    violate(
      out,
      'bad-field',
      `$.${key}`,
      `${key} 는 [${allowed.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(value)}`,
    );
  }
}

/** V1 결정적 ID (`<kind>:<hex>`). 식별자는 유래에서 나와야 한다 — 손으로 지은 이름은 거부한다. */
export function needId(fields: Fields, key: string, out: OntologyViolation[]): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (typeof value !== 'string' || idKind(value) === null) {
    violate(
      out,
      'bad-field',
      `$.${key}`,
      `${key} 는 V1 결정적 ID(<kind>:<hex>) 여야 한다 — ${JSON.stringify(value)}`,
    );
  }
}

/** ID 이거나 null. 필드 자체는 있어야 한다 — "없음" 도 명시적으로 적는다. */
export function needIdOrNull(fields: Fields, key: string, out: OntologyViolation[]): void {
  if (fields[key] === null) return;
  needId(fields, key, out);
}

/** ID 목록 (빈 목록 허용 — 근거가 없는 것과 근거를 안 적은 것은 다르다). */
export function needIdList(fields: Fields, key: string, out: OntologyViolation[]): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (!Array.isArray(value)) {
    return violate(out, 'bad-field', `$.${key}`, `${key} 는 목록이어야 한다`);
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || idKind(item) === null) {
      violate(
        out,
        'bad-field',
        `$.${key}[${String(index)}]`,
        `${key} 의 항목은 V1 결정적 ID 여야 한다 — ${JSON.stringify(item)}`,
      );
    }
  });
}

/** 문자열 목록. */
export function needStringList(fields: Fields, key: string, out: OntologyViolation[]): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (!Array.isArray(value)) {
    return violate(out, 'bad-field', `$.${key}`, `${key} 는 목록이어야 한다`);
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item === '') {
      violate(
        out,
        'bad-field',
        `$.${key}[${String(index)}]`,
        `${key} 의 항목은 비어 있지 않은 문자열이어야 한다 — ${JSON.stringify(item)}`,
      );
    }
  });
}

export interface NumberRange {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/** 유한한 수. 범위·정수 여부를 함께 본다. */
export function needNumber(
  fields: Fields,
  key: string,
  out: OntologyViolation[],
  range: NumberRange = {},
): void {
  const value = fields[key];
  if (value === undefined) return missing(out, key);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return violate(out, 'bad-field', `$.${key}`, `${key} 는 유한한 수여야 한다 — ${String(value)}`);
  }
  if (range.integer === true && !Number.isInteger(value)) {
    return violate(out, 'bad-field', `$.${key}`, `${key} 는 정수여야 한다 — ${String(value)}`);
  }
  const min = range.min ?? -Infinity;
  const max = range.max ?? Infinity;
  if (value < min || value > max) {
    violate(
      out,
      'bad-field',
      `$.${key}`,
      `${key} 는 ${String(min)}~${String(max)} 범위여야 한다 — ${String(value)}`,
    );
  }
}

/** 0~1 비율 — 강도·확신·가중치처럼 비교 가능해야 하는 값에 쓴다. */
export function needUnit(fields: Fields, key: string, out: OntologyViolation[]): void {
  needNumber(fields, key, out, { min: 0, max: 1 });
}

/** 0 이상의 정수 틱 (v1/tick.ts). */
export function needTick(fields: Fields, key: string, out: OntologyViolation[]): void {
  needNumber(fields, key, out, { min: 0, integer: true });
}

/** 틱이거나 null (기한 없음·영구). */
export function needTickOrNull(fields: Fields, key: string, out: OntologyViolation[]): void {
  if (fields[key] === null) return;
  needTick(fields, key, out);
}
