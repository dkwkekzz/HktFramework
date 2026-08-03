// P4-a 재료 선행 판정 — P3 이 남긴 한 줄을 갚는다.
//
// P3-c 는 관측 선행만 걸고 재료 선행은 걸지 않았다. 남긴 문장은 이랬다:
//
//   "치를 것이 없다는 것이 '막힌 것' 인지 '브레이크가 없는 것' 인지는 P4 가 판정한다."
//
// 답은 P4 가 새로 정하지 않는다 — **P3-a 가 이미 계산해 두었다.** 치르는 자리마다
// "그 자리를 세우는 원자" 목록이 붙어 있고(`AtomPrerequisite.satisfiedBy`), 그 목록이
// 비어 있으면서 예외로 선언된 자리가 넷이다(`UNSOURCED_SLOTS` — 몸·의념·빚·정당성).
// 그 갈림이 그대로 판정의 갈림이다:
//
//   세우는 원자가 있다  → **막힘.** 그 원자가 먼저다. 창고가 빈 자는 주고받을 수 없고,
//                        먼저 가져오거나 만들어야 한다 — 여기서 재료 선행이 처음 걸린다.
//   세우는 원자가 없다  → **브레이크가 없다.** 아무 행동도 그 자리를 되돌려 주지 않으므로
//                        "먼저 할 일" 자체가 생기지 않는다. 막지 않는다 — 위험으로 잰다.
//                        몸이 다 닳은 자도 협곡으로 들어갈 수 있다. 그것이 위험이다.
//
// 그래서 이 파일은 갈래를 닫지 않는다. 닫는 것은 P1·P2 의 일이고(문법), 여기는 **얼마나
// 마른 자리를 치르는가**를 값으로 남길 뿐이다 — 그 값을 비용·위험·성공률로 접는 것은 P4-b 다.
//
// 잔량을 재는 자는 세계다. O2 스키마가 상한을 적어 둔 자리(체력·신뢰)는 비율로 재고,
// 상한을 사실상 열어 둔 자리(재고·빚)는 **얼마나 넉넉한지 잴 수 없다** — 있다·없다만 안다.

import type { Id } from '../v1/id.ts';
import type { StateValue } from '../o1/being.ts';
import { matchPath, numericRange } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { worldSlots, type WorldState } from '../o2/world.ts';
import {
  atomGrounding,
  atomLabel,
  slotText,
  type ActionAtom,
  type SlotRef,
} from '../p0/index.ts';
import { prerequisitesOf, type AtomPrerequisite } from '../p3/index.ts';
import { violateGoal, type GoalViolation } from './violation.ts';

/** 치를 자리 하나의 판정. */
export const PAYMENT_VERDICTS = [
  'payable', // 지금 치를 것이 있다
  'unbraked', // 행동이 세우지 못하는 자리다 — 막지 않되 위험으로 잰다
  'blocked', // 지금은 없고, 그 자리를 세우는 원자가 있다 — 그것이 먼저다
] as const;
export type PaymentVerdict = (typeof PAYMENT_VERDICTS)[number];

/** 판정의 한국어 이름. */
export const VERDICT_LABELS: Readonly<Record<PaymentVerdict, string>> = {
  payable: '치를 수 있다',
  unbraked: '브레이크가 없다',
  blocked: '막혔다',
};

/** 나쁜 정도 — 갈래 하나를 한 판정으로 접을 때의 순서. */
const VERDICT_RANK: Readonly<Record<PaymentVerdict, number>> = {
  payable: 0,
  unbraked: 1,
  blocked: 2,
};

/**
 * 세계가 상한을 적어 둔 자리인가를 가르는 폭.
 *
 * 체력(0~1)·신뢰(-1~1)는 "얼마나 남았는가" 를 물을 수 있다. 재고(0~10억)·빚(0~10억)은
 * 그럴 수 없다 — 그 상한은 한계가 아니라 자리 표시다. 세계가 재 주지 않는 것을 P4 가
 * 지어내지 않는다 (결정론 상수이므로 헤더에 고정한다).
 */
export const MEASURABLE_SPAN = 1000;

/**
 * 그 자리가 세계 스키마에 있는가.
 *
 * 치를 자리는 패턴으로 적힌다(`stock.{entity}`). 패턴은 실제 경로가 아니므로 `lookupField`
 * 로는 찾을 수 없다 — 스키마가 같은 패턴을 적어 두었는지, 또는 이 자리가 스키마의 어느
 * 패턴에 걸리는지를 함께 본다.
 */
function knownSlot(schema: StateSchema, ref: SlotRef): boolean {
  return schema.fields.some(
    (spec) =>
      spec.domain === ref.domain &&
      (spec.path === ref.path || matchPath(spec.path, ref.path) !== null),
  );
}

/** 값 하나가 "있다" 인가 — 0·거짓·빈 문자열은 없는 것이다. */
function present(value: StateValue | null): boolean {
  return value !== null && value !== false && value !== 0 && value !== '';
}

/** 그 자리에 지금 얼마나 있는가. */
interface Holding {
  readonly held: StateValue | null;
  /** 0~1. 잴 수 없는 자리는 있다=1 · 없다=0 */
  readonly remaining: number;
  /** 세계가 상한을 적어 둔 자리인가 */
  readonly measurable: boolean;
  /** 어느 자리에서 읽었는가 — 패턴 자리는 여러 곳일 수 있다 */
  readonly path: string | null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 한 자리의 잔량을 잰다.
 *
 * 치를 수 있는 것은 **가진 것**이다. 신뢰가 -0.2 인 자는 불신을 치르지 못한다 —
 * 그래서 음수 쪽은 0 으로 접힌다(`base = max(min, 0)`). 이것은 P4 의 취향이 아니라
 * "치른다" 의 뜻이다: 없는 것을 내줄 수는 없다.
 */
function measure(value: StateValue, schema: StateSchema, ref: SlotRef, path: string): Holding {
  const field = lookupField(schema, ref.domain, path);
  const range = field === null ? null : numericRange(field.spec.value);
  if (range === null || typeof value !== 'number') {
    return { held: value, remaining: present(value) ? 1 : 0, measurable: false, path };
  }
  const base = Math.max(range.min, 0);
  const span = range.max - base;
  if (span <= 0 || span > MEASURABLE_SPAN) {
    return { held: value, remaining: present(value) ? 1 : 0, measurable: false, path };
  }
  return { held: value, remaining: clamp01((value - base) / span), measurable: true, path };
}

/**
 * 이 주체의 그 자리를 세계에서 읽는다.
 *
 * 치를 자리는 패턴이다(`stock.{entity}`). 어느 물건으로 치를지는 아직 정해지지 않았으므로
 * **가장 넉넉한 자리**로 잰다 — 하나라도 넉넉하면 그것으로 치른다.
 */
export function holdingOf(
  world: WorldState,
  actorId: Id,
  ref: SlotRef,
  schema: StateSchema = STATE_SCHEMA,
): Holding {
  let best: Holding = { held: null, remaining: 0, measurable: false, path: null };
  for (const slot of worldSlots(world)) {
    if (slot.domain !== ref.domain || slot.ofId !== actorId) continue;
    if (matchPath(ref.path, slot.path) === null) continue;
    const holding = measure(slot.value, schema, ref, slot.path);
    // 같으면 먼저 읽은 자리를 지킨다 — worldSlots 가 정렬돼 있으므로 순서가 결정적이다.
    if (best.path === null || holding.remaining > best.remaining) best = holding;
  }
  return best;
}

/** 치를 자리 하나에 대한 판정 — 자리·잔량·판정·먼저 할 일. */
export interface PaymentRequirement {
  readonly atom: ActionAtom;
  readonly slot: SlotRef;
  readonly verdict: PaymentVerdict;
  /** 지금 그 자리에 적힌 값. 적힌 적이 없으면 null */
  readonly held: StateValue | null;
  /** 0~1 */
  readonly remaining: number;
  /** 얼마나 마른 자리를 치르는가 = 1 - 잔량 — 비용·위험의 재료 */
  readonly drain: number;
  /** 세계가 잔량을 재 주는 자리인가 */
  readonly measurable: boolean;
  /** 막혔다면 무엇이 먼저인가 (P3-a 가 계산한 것 그대로) */
  readonly satisfiedBy: readonly ActionAtom[];
  readonly note: string;
}

/** 원자 하나를 지금 낼 수 있는가. */
export interface PayabilityReport {
  readonly actorId: Id;
  readonly atom: ActionAtom;
  readonly requirements: readonly PaymentRequirement[];
  /** 가장 나쁜 자리의 판정 — 하나라도 막히면 막힌 것이다 */
  readonly verdict: PaymentVerdict;
  /** 먼저 서야 할 원자들 — 재료 선행 */
  readonly blockedBy: readonly ActionAtom[];
  /** 브레이크가 없는 자리들 */
  readonly unbrakedSlots: readonly string[];
  /** 치르는 자리 중 가장 마른 것 0~1 */
  readonly drain: number;
  readonly violations: readonly GoalViolation[];
  readonly complete: boolean;
}

/** 판정에 필요한 재료. */
export interface PaymentSpec {
  readonly actorId: Id;
  readonly world: WorldState;
  readonly schema?: StateSchema;
}

function requirementFor(
  requirement: AtomPrerequisite,
  spec: PaymentSpec,
  violations: GoalViolation[],
  index: number,
): PaymentRequirement {
  const schema = spec.schema ?? STATE_SCHEMA;
  const text = slotText(requirement.slot);
  const known = knownSlot(schema, requirement.slot);
  if (!known) {
    violateGoal(
      violations,
      requirement.atom,
      'unslotted-payment',
      `$.requirements[${String(index)}].slot`,
      `${atomLabel(requirement.atom)} 가 치른다는 ${text} 가 세계 스키마에 없다 — 없는 자리로는 치르지 못한다`,
    );
  }
  const holding = known
    ? holdingOf(spec.world, spec.actorId, requirement.slot, schema)
    : { held: null, remaining: 0, measurable: false, path: null };

  // 갈림은 P3-a 가 이미 계산했다 — 세우는 원자가 있는가 없는가.
  if (requirement.waived) {
    return {
      atom: requirement.atom,
      slot: requirement.slot,
      verdict: 'unbraked',
      held: holding.held,
      remaining: holding.remaining,
      drain: 1 - holding.remaining,
      measurable: holding.measurable,
      satisfiedBy: [],
      note: `${text} 는 아무 행동도 세우지 못한다 — 막지 않되 되돌릴 길이 없다 (${requirement.note})`,
    };
  }
  if (holding.remaining > 0) {
    return {
      atom: requirement.atom,
      slot: requirement.slot,
      verdict: 'payable',
      held: holding.held,
      remaining: holding.remaining,
      drain: 1 - holding.remaining,
      measurable: holding.measurable,
      satisfiedBy: requirement.satisfiedBy,
      note: holding.measurable
        ? `${text} 가 ${String(Math.round(holding.remaining * 100))}% 남았다`
        : `${text} 에 값이 있다 — 얼마나 넉넉한지는 세계가 재 주지 않는다`,
    };
  }
  if (requirement.satisfiedBy.length === 0) {
    violateGoal(
      violations,
      requirement.atom,
      'unsourced-payment',
      `$.requirements[${String(index)}].satisfiedBy`,
      `${text} 를 세우는 원자가 없는데 예외로 선언되지도 않았다 — 치를 길도 되돌릴 길도 없는 자리다`,
    );
  }
  return {
    atom: requirement.atom,
    slot: requirement.slot,
    verdict: 'blocked',
    held: holding.held,
    remaining: 0,
    drain: 1,
    measurable: holding.measurable,
    satisfiedBy: requirement.satisfiedBy,
    note: `${text} 가 비었다 — 그 자리를 세우는 ${requirement.satisfiedBy.map(atomLabel).join('·')} 가 먼저다`,
  };
}

/** 원자 하나가 지금 치를 수 있는가를 판정한다. 던지지 않는다 — 막힘도 값으로 남는다. */
export function payabilityOf(atom: ActionAtom, spec: PaymentSpec): PayabilityReport {
  const violations: GoalViolation[] = [];
  if (atomGrounding(atom) === null) {
    violateGoal(
      violations,
      atom,
      'absent-grounding',
      '$.atom',
      `${atom} 의 세계 걸림이 없다 — 무엇을 치르는지 물을 자리가 없다`,
    );
    return {
      actorId: spec.actorId,
      atom,
      requirements: [],
      verdict: 'blocked',
      blockedBy: [],
      unbrakedSlots: [],
      drain: 1,
      violations,
      complete: false,
    };
  }

  const requirements = prerequisitesOf(atom)
    .filter((requirement) => requirement.route === 'cost')
    .map((requirement, index) => requirementFor(requirement, spec, violations, index));

  const worst = requirements.reduce<PaymentVerdict>(
    (verdict, requirement) =>
      VERDICT_RANK[requirement.verdict] > VERDICT_RANK[verdict] ? requirement.verdict : verdict,
    'payable',
  );
  return {
    actorId: spec.actorId,
    atom,
    requirements,
    verdict: worst,
    blockedBy: [
      ...new Set(
        requirements
          .filter((requirement) => requirement.verdict === 'blocked')
          .flatMap((requirement) => requirement.satisfiedBy),
      ),
    ],
    unbrakedSlots: requirements
      .filter((requirement) => requirement.verdict === 'unbraked')
      .map((requirement) => slotText(requirement.slot)),
    drain: requirements.reduce((most, requirement) => Math.max(most, requirement.drain), 0),
    violations,
    complete: violations.length === 0,
  };
}

/**
 * 갈래 하나를 어떤 원자로 낼 것인가.
 *
 * 갈래가 지닌 원자들은 순서열이 아니라 **고를 수 있는 것들**이다(P1). 그래서 가장 나은
 * 하나로 갈래를 판정한다 — 덜 막히고, 덜 마른 자리를 치르는 것. 같으면 원자 순서를 따른다
 * (결정성). 순서열로 펴는 것은 P5 계획 분해의 몫이다.
 */
export function bestPayment(
  atoms: readonly ActionAtom[],
  spec: PaymentSpec,
): PayabilityReport | null {
  let best: PayabilityReport | null = null;
  for (const atom of atoms) {
    const report = payabilityOf(atom, spec);
    if (best === null) {
      best = report;
      continue;
    }
    const better =
      VERDICT_RANK[report.verdict] < VERDICT_RANK[best.verdict] ||
      (VERDICT_RANK[report.verdict] === VERDICT_RANK[best.verdict] && report.drain < best.drain);
    if (better) best = report;
  }
  return best;
}

/** 판정 하나를 한 줄로 접는다 — 터미널·배지용. */
export function payabilityVerdict(report: PayabilityReport): string {
  if (!report.complete) {
    const rules = [...new Set(report.violations.map((violation) => violation.rule))];
    return `${atomLabel(report.atom)} 의 대가를 물을 수 없다 — ${rules.join(', ')}`;
  }
  const head = `${atomLabel(report.atom)} — ${VERDICT_LABELS[report.verdict]}`;
  if (report.verdict === 'blocked') {
    return `${head} (먼저: ${report.blockedBy.map(atomLabel).join('·') || '없음'})`;
  }
  if (report.verdict === 'unbraked') {
    return `${head} (${report.unbrakedSlots.join('·')} · 마름 ${report.drain.toFixed(2)})`;
  }
  return `${head} (마름 ${report.drain.toFixed(2)})`;
}
