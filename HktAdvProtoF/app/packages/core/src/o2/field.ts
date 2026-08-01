// O2-b 필드 스펙 — 영역 안의 한 자리가 어떤 값을 받는지 선언한다.
//
// O1 State 는 `domain` + `path` + `value` 만 요구했다. 그래서 `biological.hungry = "매우"` 같은
// 값도 온전한 State 로 통과한다 — 존재론은 맞지만 세계가 그런 자리를 갖고 있는지는 아무도 모른다.
// 여기서 그 빈칸을 메운다: **자리는 미리 선언되고, 선언되지 않은 자리에는 값을 놓을 수 없다.**
//
// 두 가지가 특히 중요하다.
//
//   ① 매개 경로 — 관계·재고·지식은 "누구에 대한" 값이다. `trust.{subject}` 처럼 자리를
//      비워 두고, 실제 경로에서는 그 자리에 V1 결정적 ID 가 들어온다. 손으로 지은 이름은
//      거부된다 (O1 과 같은 태도 — 식별자는 유래에서 나온다).
//   ② 보유자 종류 — 허기는 주체의 값이고 파손은 사물의 값이다. 누구의 상태인지는
//      ofId 의 ID 접두사로 판별한다. 세계를 뒤지지 않고 값만 보고 판정할 수 있다.

import { idKind, type Id } from '../v1/id.ts';
import type { StateValue } from '../o1/being.ts';
import type { HolderKind, StateDomain } from './domain.ts';

/** 필드가 받는 값의 모양. */
export type ValueSpec =
  | { readonly type: 'number'; readonly min: number; readonly max: number; readonly integer?: boolean; readonly unit: string }
  | { readonly type: 'ratio' } // 0~1 — 강도·충족도처럼 비교 가능해야 하는 값
  | { readonly type: 'signed' } // -1~1 — 적대(-)와 우호(+)가 한 축에 있는 값
  | { readonly type: 'enum'; readonly options: readonly string[] }
  | { readonly type: 'flag' } // 참거짓
  | { readonly type: 'ref'; readonly idKind: string }; // 다른 존재를 가리키는 값

/** 상태 필드 하나의 선언. */
export interface FieldSpec {
  readonly domain: StateDomain;
  /** 영역 안의 경로. `{종류}` 자리에는 그 종류의 V1 ID 가 들어온다 (`trust.{subject}`) */
  readonly path: string;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  /** 누구의 상태인가 — ofId 의 ID 접두사로 판별한다 */
  readonly holder: HolderKind;
  readonly value: ValueSpec;
  /** 무엇을 뜻하는가 + 원문 근거 */
  readonly note: string;
}

/** 스키마가 값을 거부하는 사유. */
export type SchemaViolationRule =
  | 'unknown-domain' // 9영역에 없는 영역
  | 'unknown-path' // 그 영역에 선언되지 않은 자리
  | 'bad-parameter' // 매개 자리에 그 종류의 ID 가 아닌 것이 들어왔다
  | 'bad-holder' // 그 종류의 존재가 가질 수 없는 상태
  | 'bad-value-type' // 값의 종류가 다르다
  | 'out-of-range' // 범위 밖
  | 'not-an-option' // 선택지에 없는 값
  | 'bad-reference' // 가리키는 ID 의 종류가 다르다
  | 'duplicate-state'; // 같은 자리에 값이 둘

/** 스키마 위반 하나 — 세계 트리 어디가 왜 틀렸는지까지 말한다. */
export interface SchemaViolation {
  readonly rule: SchemaViolationRule;
  /** 세계 트리 안의 자리 (`biological.subject:ab12.hunger`) */
  readonly where: string;
  /** 어느 State 원소가 걸렸는가. 원소 없이 검사했으면 null */
  readonly stateId: Id | null;
  readonly message: string;
}

/** 경로가 스펙에 맞았을 때, 매개 자리에 실제로 들어온 ID 들. */
export interface PathMatch {
  readonly spec: FieldSpec;
  /** `{종류}` 자리에 들어온 ID (선언 순서) */
  readonly params: readonly Id[];
}

const SEGMENT_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const PARAM_PATTERN = /^\{([a-z][a-z0-9-]*)\}$/;

/** 스펙 경로를 조각으로 나눈다. */
export function pathSegments(path: string): readonly string[] {
  return path.split('.');
}

/** 조각이 매개 자리면 그 ID 종류, 아니면 null. */
export function parameterKind(segment: string): string | null {
  return PARAM_PATTERN.exec(segment)?.[1] ?? null;
}

/** 스펙에 매개 자리가 몇 개 있는가. */
export function parameterCount(spec: FieldSpec): number {
  return pathSegments(spec.path).filter((segment) => parameterKind(segment) !== null).length;
}

/**
 * 실제 경로가 스펙 경로에 맞는가.
 * 맞으면 매개 자리에 들어온 ID 목록(빈 목록 가능), 아니면 null.
 */
export function matchPath(pattern: string, path: string): readonly Id[] | null {
  const wanted = pathSegments(pattern);
  const given = pathSegments(path);
  if (wanted.length !== given.length) return null;

  const params: Id[] = [];
  for (let index = 0; index < wanted.length; index += 1) {
    const segment = wanted[index] as string;
    const actual = given[index] as string;
    const kind = parameterKind(segment);
    if (kind === null) {
      if (segment !== actual) return null;
    } else {
      if (idKind(actual) !== kind) return null;
      params.push(actual);
    }
  }
  return params;
}

/** 값의 모양을 사람이 읽는 한 줄로 — Lab 표와 터미널이 같은 문장을 쓴다. */
export function describeValue(value: ValueSpec): string {
  switch (value.type) {
    case 'number':
      return `${value.integer === true ? '정수' : '수'} ${String(value.min)}~${String(value.max)}${value.unit === '' ? '' : ` (${value.unit})`}`;
    case 'ratio':
      return '비율 0~1';
    case 'signed':
      return '부호 비율 -1~1';
    case 'enum':
      return `선택지 [${value.options.join(' ')}]`;
    case 'flag':
      return '참거짓';
    case 'ref':
      return `${value.idKind} ID`;
  }
}

/** 수치 스펙의 실제 범위 — ratio·signed 를 number 와 같은 자리에서 다룬다. */
export function numericRange(
  value: ValueSpec,
): { readonly min: number; readonly max: number; readonly integer: boolean } | null {
  switch (value.type) {
    case 'number':
      return { min: value.min, max: value.max, integer: value.integer === true };
    case 'ratio':
      return { min: 0, max: 1, integer: false };
    case 'signed':
      return { min: -1, max: 1, integer: false };
    default:
      return null;
  }
}

/** 값 하나가 스펙에 맞는가. 맞으면 null, 아니면 사유. */
export function checkValue(
  spec: ValueSpec,
  value: StateValue,
): { readonly rule: SchemaViolationRule; readonly message: string } | null {
  const range = numericRange(spec);
  if (range !== null) {
    if (typeof value !== 'number') {
      return { rule: 'bad-value-type', message: `${describeValue(spec)} 자리에 ${typeof value} 가 왔다` };
    }
    if (!Number.isFinite(value)) {
      return { rule: 'bad-value-type', message: `유한한 수여야 한다 — ${String(value)}` };
    }
    if (range.integer && !Number.isInteger(value)) {
      return { rule: 'out-of-range', message: `정수여야 한다 — ${String(value)}` };
    }
    if (value < range.min || value > range.max) {
      return {
        rule: 'out-of-range',
        message: `${String(range.min)}~${String(range.max)} 범위여야 한다 — ${String(value)}`,
      };
    }
    return null;
  }

  switch (spec.type) {
    case 'enum':
      if (typeof value !== 'string') {
        return { rule: 'bad-value-type', message: `선택지는 문자열이다 — ${typeof value}` };
      }
      if (!spec.options.includes(value)) {
        return {
          rule: 'not-an-option',
          message: `[${spec.options.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(value)}`,
        };
      }
      return null;

    case 'flag':
      if (typeof value !== 'boolean') {
        return { rule: 'bad-value-type', message: `참거짓이어야 한다 — ${typeof value}` };
      }
      return null;

    case 'ref':
      if (typeof value !== 'string') {
        return { rule: 'bad-value-type', message: `ID 는 문자열이다 — ${typeof value}` };
      }
      if (idKind(value) !== spec.idKind) {
        return {
          rule: 'bad-reference',
          message: `${spec.idKind} 종류의 V1 ID 여야 한다 — ${JSON.stringify(value)}`,
        };
      }
      return null;

    default:
      return null;
  }
}

/** 보유자 ID 가 이 필드를 가질 수 있는 종류인가. 맞으면 null, 아니면 사유 한 줄. */
export function checkHolder(holder: HolderKind, ofId: Id): string | null {
  const kind = idKind(ofId);
  if (kind === null) return `보유자는 V1 결정적 ID 여야 한다 — ${JSON.stringify(ofId)}`;
  if (holder === 'any') return null;
  if (kind !== holder) return `${holder} 만 가질 수 있는 상태다 — 보유자는 ${kind}`;
  return null;
}

/** 스펙 자신이 온전한가 (카탈로그 무결성). 사유 목록을 돌려준다 — 비면 온전하다. */
export function checkFieldSpec(spec: FieldSpec): readonly string[] {
  const reasons: string[] = [];
  if (spec.label === '') reasons.push('이름이 없다');
  if (spec.note === '') reasons.push('뜻·근거가 없다');
  if (spec.path === '') {
    reasons.push('경로가 없다');
    return reasons;
  }
  for (const segment of pathSegments(spec.path)) {
    const kind = parameterKind(segment);
    if (kind !== null) continue;
    if (!SEGMENT_PATTERN.test(segment)) {
      reasons.push(`경로 조각 ${JSON.stringify(segment)} 는 lowerCamelCase 또는 {종류} 여야 한다`);
    }
  }
  if (spec.value.type === 'enum' && spec.value.options.length === 0) {
    reasons.push('선택지가 비었다');
  }
  if (spec.value.type === 'number' && spec.value.min > spec.value.max) {
    reasons.push('범위의 아래가 위보다 크다');
  }
  return reasons;
}
