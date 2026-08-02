// D4-b 결핍 읽기 — 조건과 실제 값을 대어 "얼마나 비었는가" 를 0~1 로 낸다.
//
// D1 은 노드마다 조건을 적게 했다(자리 + Band, 시간 종은 틱). 그 조건은 지금까지 **참/거짓**으로만
// 읽혔다 — 서 있는가 아닌가. 그러나 압력은 정도를 요구한다: 재고가 하나 모자란 것과 창고가 텅 빈
// 것은 같은 결핍이 아니다.
//
// 그래서 결핍을 **거리**로 읽는다. 조건이 요구하는 범위에서 얼마나 벗어났는지를, 그 자리가 가질 수
// 있는 값의 폭(O2 FieldSpec)으로 나눈다. 자리마다 단위가 다르므로(재고는 개, 허기는 비율) 폭으로
// 나누어야만 서로 견줄 수 있다.
//
//   범위 조건  벗어난 거리 ÷ 벗어날 수 있는 최대 거리
//   딱 그 값   같으면 0, 다르면 1 — 통행권은 절반만 있을 수 없다
//   시계 조건  창을 쓰고 있으면 0, 놓쳤으면 다음 창까지 남은 기다림의 비율
//   빈 자리    1 — 아무도 적지 않은 것은 채워지지 않은 것이다
//
// 결핍은 어긋남이 아니다. 굶주림은 세계의 사실이고, 그래서 여기서 나오는 것은 위반이 아니라 **읽기**다.

import type { Id } from '../v1/id.ts';
import type { StateValue } from '../o1/being.ts';
import { describeBand, type Band } from '../s0/stake.ts';
import { numericRange } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { conditionSummary, type DependencyNode } from '../d1/index.ts';
import { valueForNode, type WorldSnapshot } from './snapshot.ts';
import { violatePressure, type PressureViolation } from './violation.ts';

/** 결핍을 그렇게 읽은 까닭. */
export type DeficitReason =
  | 'met' // 조건 안에 있다
  | 'below' // 아래로 벗어났다 (재고가 모자라다)
  | 'above' // 위로 벗어났다 (허기가 넘친다)
  | 'mismatch' // 딱 그 값이어야 하는데 다르다
  | 'unwritten' // 세계에 그 자리가 아직 없다
  | 'waiting' // 시계 조건 — 창을 놓쳤고 다음 창을 기다린다
  | 'unreadable'; // 그 자리를 세계 스키마에서 찾을 수 없다

/** 노드 하나의 결핍 읽기. */
export interface DeficitReading {
  readonly nodeId: Id;
  readonly label: string;
  /** 무엇을 보고 읽었는가 (`economic.stock.entity:…` 또는 `12틱마다 · 3틱 안에`) */
  readonly where: string;
  /** 누구의 자리인가. 시계 조건이면 null */
  readonly holderId: Id | null;
  /** 지금 값. 없거나 시계 조건이면 null */
  readonly value: StateValue | null;
  /** 무엇을 요구했는가 */
  readonly band: Band | null;
  readonly met: boolean;
  /** 0~1 — 0 이면 채워졌고 1 이면 완전히 비었다 */
  readonly deficit: number;
  readonly reason: DeficitReason;
}

/** 0~1 로 자른다. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** 수치 자리의 결핍 — 벗어난 거리를 벗어날 수 있는 폭으로 나눈다. */
function numericDeficit(
  value: number,
  band: Band,
  range: { readonly min: number; readonly max: number },
): { readonly deficit: number; readonly reason: DeficitReason } {
  if (band.kind === 'is') {
    return value === band.value ? { deficit: 0, reason: 'met' } : { deficit: 1, reason: 'mismatch' };
  }
  if (value < band.min) {
    const room = band.min - range.min;
    return { deficit: room > 0 ? clamp01((band.min - value) / room) : 1, reason: 'below' };
  }
  if (value > band.max) {
    const room = range.max - band.max;
    return { deficit: room > 0 ? clamp01((value - band.max) / room) : 1, reason: 'above' };
  }
  return { deficit: 0, reason: 'met' };
}

/** 시계 조건의 결핍 — 창 안이면 0, 놓쳤으면 다음 창까지의 기다림. */
export function clockDeficit(
  tick: number,
  everyTicks: number,
  withinTicks: number,
): { readonly deficit: number; readonly reason: DeficitReason } {
  if (everyTicks < 1) return { deficit: 1, reason: 'waiting' };
  const phase = ((tick % everyTicks) + everyTicks) % everyTicks;
  if (phase < withinTicks) return { deficit: 0, reason: 'met' };
  const maxWait = everyTicks - withinTicks;
  const remaining = everyTicks - phase;
  return { deficit: maxWait > 0 ? clamp01(remaining / maxWait) : 0, reason: 'waiting' };
}

/**
 * 노드 하나의 결핍을 읽는다. 던지지 않는다 — 읽을 수 없으면 그 사실이 값으로 남는다.
 * @param out 읽을 수 없는 조건은 여기에 사유로 쌓인다 (결핍 자체는 사유가 아니다).
 */
export function readDeficit(
  node: DependencyNode,
  snapshot: WorldSnapshot,
  out: PressureViolation[] = [],
  schema: StateSchema = STATE_SCHEMA,
): DeficitReading {
  const base = {
    nodeId: node.id,
    label: node.label,
    where: conditionSummary(node.condition),
  } as const;

  if (node.condition.kind === 'clock') {
    const { deficit, reason } = clockDeficit(
      snapshot.tick,
      node.condition.everyTicks,
      node.condition.withinTicks,
    );
    return {
      ...base,
      holderId: null,
      value: null,
      band: null,
      met: deficit === 0,
      deficit,
      reason,
    };
  }

  const condition = node.condition;
  const match = lookupField(schema, condition.slot.domain, condition.slot.path);
  if (match === null) {
    violatePressure(
      out,
      node.id,
      node.label,
      'unreadable-condition',
      '$.graph.nodes',
      `세계에 ${condition.slot.domain}.${condition.slot.path} 자리가 없다 — 없는 자리는 채워졌는지도 물을 수 없다`,
    );
    return {
      ...base,
      holderId: condition.holderId,
      value: null,
      band: condition.band,
      met: false,
      deficit: 1,
      reason: 'unreadable',
    };
  }

  const value = valueForNode(snapshot, node);
  if (value === null) {
    return {
      ...base,
      holderId: condition.holderId,
      value: null,
      band: condition.band,
      met: false,
      deficit: 1,
      reason: 'unwritten',
    };
  }

  const range = numericRange(match.spec.value);
  const measured =
    range !== null && typeof value === 'number'
      ? numericDeficit(value, condition.band, range)
      : condition.band.kind === 'is' && value === condition.band.value
        ? ({ deficit: 0, reason: 'met' } as const)
        : ({ deficit: 1, reason: 'mismatch' } as const);

  return {
    ...base,
    holderId: condition.holderId,
    value,
    band: condition.band,
    met: measured.deficit === 0,
    deficit: measured.deficit,
    reason: measured.reason,
  };
}

/** 읽기 하나를 한 줄로 접는다 — 표·화면용. */
export function deficitSummary(reading: DeficitReading): string {
  const want = reading.band === null ? reading.where : describeBand(reading.band);
  const has = reading.value === null ? '(빈 자리)' : String(reading.value);
  if (reading.met) return `${reading.label} — 채워졌다 (${has} ${want})`;
  return `${reading.label} — ${has} / ${want} · 결핍 ${reading.deficit.toFixed(2)} (${reading.reason})`;
}
