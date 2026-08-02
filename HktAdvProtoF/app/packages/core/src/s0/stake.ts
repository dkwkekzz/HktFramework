// S0-c 의존·유지 자리 — 원문 S0 다섯 질문의 둘째와 다섯째:
// "무엇에 의존하는가" · "어떤 상태를 유지하려 하는가".
//
// 원문 인터페이스의 `needs: NeedState[]` 와 `values: ValueState[]` 다. 둘 다 세계의 자리를
// 가리키지만 **성격이 다르다.**
//
//   Need         벗어난 채로 두면 이 주체가 무너진다. 허기·체력·구성원 수.
//   ValueTarget  벗어나도 무너지지는 않는다. 그러나 주체는 그쪽으로 움직인다. 부·명성·통행권.
//
// 갈림은 붕괴 여부이고, 그 결과 **경계 규칙도 갈린다.**
//
//   Need 는 내 경계 안이어야 한다. 무너짐은 자기 안에서 일어난다 — 남의 허기로 내가 죽지 않는다.
//     (그 허기를 무엇이 채우는가, 즉 바깥 대상과의 연결은 D 계층 의존 그래프의 몫이다.)
//   ValueTarget 은 경계 밖이어도 된다. 오히려 밖을 원하는 것이 목적의 씨앗이다 —
//     내 것이 아닌 협곡의 통행권을 원하는 데서 P 계층의 가능성이 자란다.
//
// 자리는 전부 O2 스키마의 실재하는 자리여야 한다. 세계에 없는 것을 지키거나 원할 수는 없다.

import type { Id } from '../v1/id.ts';
import type { StateValue } from '../o1/being.ts';
import type { SlotRef } from '../o0/definition.ts';
import { checkHolder, numericRange, describeValue, type FieldSpec } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { isStateDomain } from '../o2/domain.ts';
import { violateSubject, type SubjectRef, type SubjectViolation } from './violation.ts';
import { withinBoundary, type Boundary } from './boundary.ts';

/** 자리가 어디에 있어야 하는가 — 값의 범위 또는 딱 그 값. */
export type Band =
  | { readonly kind: 'range'; readonly min: number; readonly max: number }
  | { readonly kind: 'is'; readonly value: StateValue };

/** 주체가 세계의 한 자리에 건 것 — 의존과 유지가 공유하는 형태. */
export interface Stake {
  /** O2 영역 + 실제 경로 (`stock.entity:ab12`) */
  readonly slot: SlotRef;
  /** 누구의 자리인가 — O2 State.ofId */
  readonly holderId: Id;
  /** 어디에 있어야 하는가 */
  readonly band: Band;
  /** 왜 이 자리인가 — 근거 없는 자리는 주체를 설명하지 못한다 */
  readonly note: string;
}

/** 벗어나면 무너지는 자리. */
export interface Need extends Stake {
  /** 얼마나 급한가 0~1 — D4 압력의 재료가 된다 */
  readonly urgency: number;
  /** 벗어난 채 이만큼 지나면 무너진다 (tick, 1 이상). 즉사면 1 */
  readonly collapseAfterTicks: number;
}

/** 벗어나도 무너지지는 않지만 주체가 그쪽으로 움직이는 자리. */
export interface ValueTarget extends Stake {
  /** 얼마나 강하게 미는가 0 초과 1 이하 — P4 목적 선택의 가중치가 된다 */
  readonly weight: number;
}

/** 붕괴까지 걸릴 수 있는 최대 틱 — 이보다 길면 "무너진다" 가 아니라 "안 무너진다" 다. */
export const MAX_COLLAPSE_TICKS = 100000;

/** 자리 하나를 사람이 읽는 한 줄로. */
export function stakeLabel(stake: Stake): string {
  return `${stake.slot.domain}.${stake.holderId}.${stake.slot.path}`;
}

/** 범위를 사람이 읽는 한 마디로. */
export function describeBand(band: Band): string {
  return band.kind === 'range'
    ? `${String(band.min)}~${String(band.max)}`
    : JSON.stringify(band.value);
}

/** 지금 값이 그 범위 안인가. */
export function bandHolds(band: Band, value: StateValue): boolean {
  if (band.kind === 'is') return band.value === value;
  if (typeof value !== 'number') return false;
  return value >= band.min && value <= band.max;
}

/** 범위가 이 자리의 값 모양과 맞는가. 맞으면 null, 아니면 사유 한 줄. */
export function checkBand(spec: FieldSpec, band: Band): string | null {
  const range = numericRange(spec.value);
  if (band.kind === 'range') {
    if (range === null) {
      return `${describeValue(spec.value)} 자리에는 범위를 걸 수 없다 — 딱 그 값(is)으로 적어야 한다`;
    }
    if (!Number.isFinite(band.min) || !Number.isFinite(band.max)) {
      return '범위의 끝은 유한한 수여야 한다';
    }
    if (band.min > band.max) return `범위의 아래가 위보다 크다 — ${describeBand(band)}`;
    if (band.min < range.min || band.max > range.max) {
      return `자리의 범위 ${String(range.min)}~${String(range.max)} 를 벗어난다 — ${describeBand(band)}`;
    }
    // 자리 전체를 범위로 잡으면 절대 벗어나지 않는다 — 무너지지 않는 의존은 의존이 아니다.
    if (band.min <= range.min && band.max >= range.max) {
      return `자리의 값 전체를 범위로 잡았다 — 결코 벗어나지 않는 조건은 조건이 아니다 (${describeBand(band)})`;
    }
    return null;
  }
  if (range !== null) {
    if (typeof band.value !== 'number') {
      return `${describeValue(spec.value)} 자리에 ${typeof band.value} 가 왔다`;
    }
    if (!Number.isFinite(band.value) || band.value < range.min || band.value > range.max) {
      return `${String(range.min)}~${String(range.max)} 범위여야 한다 — ${describeBand(band)}`;
    }
    if (range.integer && !Number.isInteger(band.value)) {
      return `정수여야 한다 — ${describeBand(band)}`;
    }
  }
  if (spec.value.type === 'enum' && !spec.value.options.includes(String(band.value))) {
    return `[${spec.value.options.join(' ')}] 중 하나여야 한다 — ${describeBand(band)}`;
  }
  if (spec.value.type === 'flag' && typeof band.value !== 'boolean') {
    return `참거짓이어야 한다 — ${describeBand(band)}`;
  }
  return null;
}

/** 자리 자체가 세계에 있는가 + 그 보유자가 가질 수 있는 자리인가. 맞으면 스펙, 아니면 사유. */
function resolveSlot(
  stake: Stake,
  schema: StateSchema,
): { readonly spec: FieldSpec } | { readonly reason: string } {
  if (!isStateDomain(stake.slot.domain)) {
    return { reason: `9영역에 없는 영역이다 — ${JSON.stringify(stake.slot.domain)}` };
  }
  const match = lookupField(schema, stake.slot.domain, stake.slot.path);
  if (match === null) {
    return { reason: `세계에 ${stakeLabel(stake)} 자리가 없다 — 없는 것을 지키거나 원할 수는 없다` };
  }
  const holderReason = checkHolder(match.spec.holder, stake.holderId);
  if (holderReason !== null) return { reason: holderReason };
  return { spec: match.spec };
}

/** 의존·유지가 공유하는 자리 검사. 걸리면 true (뒤의 고유 검사를 건너뛴다). */
function checkStake(
  subject: SubjectRef,
  stake: Stake,
  path: string,
  schema: StateSchema,
  out: SubjectViolation[],
): boolean {
  const resolved = resolveSlot(stake, schema);
  if ('reason' in resolved) {
    violateSubject(out, subject, 'phantom-slot', `${path}.slot`, resolved.reason);
    return true;
  }
  if (stake.note === '') {
    violateSubject(
      out,
      subject,
      'bad-stake',
      `${path}.note`,
      `${resolved.spec.label} 자리를 왜 걸었는지 적지 않았다 — 근거 없는 자리는 주체를 설명하지 못한다`,
    );
  }
  const bandReason = checkBand(resolved.spec, stake.band);
  if (bandReason !== null) {
    violateSubject(out, subject, 'bad-band', `${path}.band`, `${resolved.spec.label} — ${bandReason}`);
    return true;
  }
  return false;
}

/** 의존 목록이 온전한가 — 자리는 실재하고, 무너짐은 내 경계 안에서 일어나는가. */
export function checkNeeds(
  subject: SubjectRef,
  needs: readonly Need[],
  boundaries: readonly Boundary[],
  out: SubjectViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  for (const [index, need] of needs.entries()) {
    const path = `$.needs[${String(index)}]`;
    if (checkStake(subject, need, path, schema, out)) continue;

    if (!withinBoundary(subject, boundaries, need.holderId)) {
      violateSubject(
        out,
        subject,
        'foreign-need',
        `${path}.holderId`,
        `${stakeLabel(need)} 는 이 주체의 경계 밖이다 — 남의 자리가 무너져도 내가 무너지지는 않는다. 바깥과의 연결은 의존 그래프(D)가 잇는다`,
      );
    }
    if (!(need.urgency >= 0) || need.urgency > 1) {
      violateSubject(
        out,
        subject,
        'bad-stake',
        `${path}.urgency`,
        `급함은 0~1 이어야 한다 — ${String(need.urgency)}`,
      );
    }
    if (
      !Number.isInteger(need.collapseAfterTicks) ||
      need.collapseAfterTicks < 1 ||
      need.collapseAfterTicks > MAX_COLLAPSE_TICKS
    ) {
      violateSubject(
        out,
        subject,
        'bad-stake',
        `${path}.collapseAfterTicks`,
        `붕괴까지의 틱은 1~${String(MAX_COLLAPSE_TICKS)} 의 정수여야 한다 — ${String(need.collapseAfterTicks)}. 무너지지 않는 것은 의존이 아니라 선호(values)다`,
      );
    }
  }

  if (needs.length === 0) {
    violateSubject(
      out,
      subject,
      'no-need',
      '$.needs',
      '무너질 조건이 없는 주체는 "무엇에 의존하는가" 에 답하지 못한다 — 잃을 것이 없으면 목적도 생기지 않는다',
    );
  }
}

/** 유지 목록이 온전한가 — 자리는 실재하는가. 경계 밖이어도 된다. */
export function checkValues(
  subject: SubjectRef,
  values: readonly ValueTarget[],
  out: SubjectViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  for (const [index, value] of values.entries()) {
    const path = `$.values[${String(index)}]`;
    if (checkStake(subject, value, path, schema, out)) continue;

    if (!(value.weight > 0) || value.weight > 1) {
      violateSubject(
        out,
        subject,
        'bad-stake',
        `${path}.weight`,
        `미는 힘은 0 초과 1 이하여야 한다 — ${String(value.weight)}. 0 이면 밀지 않는 것이고, 밀지 않는 방향은 가치가 아니다`,
      );
    }
  }

  if (values.length === 0) {
    violateSubject(
      out,
      subject,
      'no-value',
      '$.values',
      '유지하려는 자리가 없는 주체는 "어떤 상태를 유지하려 하는가" 에 답하지 못한다 — 무너지지만 않으면 되는 존재는 사물이다',
    );
  }
}

/** 의존을 한 줄로 접는다 — 5질문 응답표용. */
export function needSummary(needs: readonly Need[]): string {
  if (needs.length === 0) return '무너질 조건이 없다';
  return needs
    .map((need) => `${need.slot.path} ${describeBand(need.band)} (급함 ${String(need.urgency)})`)
    .join(' · ');
}

/** 유지를 한 줄로 접는다. */
export function valueSummary(values: readonly ValueTarget[]): string {
  if (values.length === 0) return '밀고 가는 방향이 없다';
  return values
    .map((value) => `${value.slot.path} → ${describeBand(value.band)} (힘 ${String(value.weight)})`)
    .join(' · ');
}
