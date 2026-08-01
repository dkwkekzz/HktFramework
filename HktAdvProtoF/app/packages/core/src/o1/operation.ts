// O1-b 작동 3종 — 세계가 "굴러가는" 방식을 적는 세 타입.
//
//   Rule        조건이 성립하면 무엇이 일어나는가 (세계의 서술)
//   Event       실제로 무엇이 일어났는가 — 상태를 바꾸는 유일한 통로 (R1)
//   Phenomenon  그 사건이 세계에 남긴 관찰 가능한 흔적 (R2)
//
// 셋의 순서는 규칙 → 사건 → 현상이다. 주체는 상태를 직접 보지 못하고 현상만 감지하므로
// (원문 §6.1 객관적 상태와 관찰된 현상의 분리), 이 셋이 끊기면 세계는 관찰 불가능해진다.
//
// 규칙의 조건·효과는 여기서 **서술 문자열**이다. 술어 언어와 실행은 W2(규칙 실체화)와
// R1(사건 기록)의 몫이다 — O1 은 "규칙이 무엇으로 이루어지는가" 만 고정한다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { STATE_DOMAINS, type StateDomain } from './being.ts';
import {
  needEnum,
  needId,
  needIdList,
  needIdOrNull,
  needString,
  needStringList,
  needTick,
  needTickOrNull,
  needUnit,
  type Fields,
} from './check.ts';
import type { OnticBase, OntologyViolation } from './kinds.ts';

/**
 * 현상의 전달 통로 6종 (MODULES.md R2 행: 빛·소리·흔적·냄새·의념 잔향·보고서).
 * 원문 §6.2 의 visual/audio/smell/touch/aura/social/inference 를 "무엇을 타고 오는가"
 * 기준으로 접은 것이다 — 감각 쪽 분해(촉각·추론)는 R3 지각 프로파일이 맡는다.
 */
export const PHENOMENON_CHANNELS = [
  'light', // 빛 — 보임
  'sound', // 소리 — 들림
  'trace', // 흔적 — 발자국·파손·사체
  'smell', // 냄새 — 남아 도는 것
  'psychic', // 의념 잔향 — 능력이 남긴 것
  'report', // 보고서·전언 — 주체를 거쳐 오는 것
] as const;
export type PhenomenonChannel = (typeof PHENOMENON_CHANNELS)[number];

/** 조건이 성립하면 효과가 일어난다는 세계의 서술. 실체화는 W2. */
export interface Rule extends OnticBase<'Rule'> {
  readonly domain: StateDomain;
  readonly name: string;
  /** 언제 — 조건 서술. 비어 있으면 항상 성립하는 규칙이 되어 버리므로 최소 1개. */
  readonly when: readonly string[];
  /** 그러면 — 효과 서술. 효과 없는 규칙은 규칙이 아니다. */
  readonly then: readonly string[];
  /** 어느 공리에서 나왔는가 (O0). 근거 없는 규칙이면 null */
  readonly axiomId: Id | null;
}

/** 실제로 일어난 일. 상태는 사건으로만 바뀐다 (R1). */
export interface Event extends OnticBase<'Event'> {
  readonly tick: Tick;
  readonly name: string;
  /** 누가 일으켰나. 자연 발생이면 null */
  readonly actorId: Id | null;
  /** 무엇이 바뀌었나 — 바뀐 State 의 id 들. 아무것도 안 바뀌면 사건이 아니다. */
  readonly changedStateIds: readonly Id[];
  /** 무엇 때문에 — 앞선 사건·규칙의 id. 최초 사건이면 빈 목록 */
  readonly causeIds: readonly Id[];
}

/** 사건이 세계에 남긴 관찰 가능한 흔적. 주체는 이것만 감지한다 (R3). */
export interface Phenomenon extends OnticBase<'Phenomenon'> {
  readonly channel: PhenomenonChannel;
  /** 이 현상을 낳은 사건 — 원인 없는 현상은 없다 */
  readonly causeEventId: Id;
  /** 어디서 — place Entity 의 id */
  readonly placeId: Id;
  /** 세기 0~1 — 주체의 감지 임계와 비교된다 */
  readonly intensity: number;
  /** 언제까지 남는가 (tick). 사라지지 않으면 null */
  readonly decaysAtTick: Tick | null;
}

/** Rule 필드 검사. */
export function checkRule(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'domain', STATE_DOMAINS, out);
  needString(fields, 'name', out);
  needStringList(fields, 'when', out);
  needStringList(fields, 'then', out);
  needIdOrNull(fields, 'axiomId', out);

  // 조건 없는 규칙은 항상 발동하고, 효과 없는 규칙은 세계를 바꾸지 않는다 — 둘 다 규칙이 아니다.
  const when = fields['when'];
  if (Array.isArray(when) && when.length === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.when',
      message: '조건 없는 규칙은 항상 발동한다 — 최소 1개의 조건이 필요하다',
    });
  }
  const then = fields['then'];
  if (Array.isArray(then) && then.length === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.then',
      message: '효과 없는 규칙은 세계를 바꾸지 않는다 — 최소 1개의 효과가 필요하다',
    });
  }
}

/** Event 필드 검사. */
export function checkEvent(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needTick(fields, 'tick', out);
  needString(fields, 'name', out);
  needIdOrNull(fields, 'actorId', out);
  needIdList(fields, 'changedStateIds', out);
  needIdList(fields, 'causeIds', out);

  const changed = fields['changedStateIds'];
  if (Array.isArray(changed) && changed.length === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.changedStateIds',
      message: '아무 상태도 바꾸지 않으면 사건이 아니다 — 최소 1개의 상태를 지목해야 한다',
    });
  }
}

/** Phenomenon 필드 검사. */
export function checkPhenomenon(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needEnum(fields, 'channel', PHENOMENON_CHANNELS, out);
  needId(fields, 'causeEventId', out); // 원인 없는 현상은 없다 — null 을 허용하지 않는다
  needId(fields, 'placeId', out);
  needUnit(fields, 'intensity', out);
  needTickOrNull(fields, 'decaysAtTick', out);
}

/** 작동 3종의 검사기 묶음. */
export const operationCheckers = {
  Rule: checkRule,
  Event: checkEvent,
  Phenomenon: checkPhenomenon,
} as const;

export function isRule(value: OnticBase): value is Rule {
  return value.kind === 'Rule';
}

export function isEvent(value: OnticBase): value is Event {
  return value.kind === 'Event';
}

export function isPhenomenon(value: OnticBase): value is Phenomenon {
  return value.kind === 'Phenomenon';
}
