// P4-b 평가 요소 아홉 — 원문 P4 가 이름으로 적은 것을 값으로 세운다.
//
// 원문은 아홉을 나열만 한다: 의존 압력 · 성공 가능성 · 비용 · 위험 · 가치관 · 관계 · 기억 ·
// 현재 약속 · 이미 투자한 비용. 이 계층이 지켜야 할 것은 그 목록이 아니라 **어디서 오는가**다.
// 아홉을 P4 가 손으로 매기면 목적 선택은 취향이 되고, 왜 그것이 뽑혔는지 아무도 말하지 못한다.
//
// 그래서 요소마다 출처를 못박는다(`FACTOR_SOURCES`). 여덟은 앞 계층에서 읽고, **P4 자신이
// 출처인 것은 매몰비용 하나뿐이다** — "이미 이 목적에 얼마나 머물렀는가" 는 앞 계층 어디에도
// 없는, 고르는 자만 아는 값이기 때문이다. 그것이 선언된 유일한 예외다.
//
// 눈여겨볼 자리 하나: **같은 신뢰 값 하나가 동의 축에 따라 반대로 읽힌다.** 사이가 두터우면
// 주고받기는 쉬워지고(재료가 있다) 등지는 것은 무거워진다(잃을 것이 있다). 두 방향은 P4 가
// 정한 것이 아니라 P0 걸림의 `consent` 축이 정한 것이다 — 세계 하나에 태도 둘이 붙는 자리다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { StateValue } from '../o1/being.ts';
import type { Possibility } from '../o1/index.ts';
import { matchPath } from '../o2/field.ts';
import type { StateSchema } from '../o2/schema.ts';
import { readSlot, worldSlots, type WorldState } from '../o2/world.ts';
import type { SlotRef } from '../o0/definition.ts';
import type { ValueTarget } from '../s0/index.ts';
import type { NarrowedTree } from '../p2/index.ts';
import {
  atomGrounding,
  atomLabel,
  slotText,
  type ActionAtom,
  type AtomGrounding,
} from '../p0/index.ts';
import { directionLabel, type StrategyDirection } from '../p1/index.ts';
import type {
  ExpansionContext,
  ExpansionTraceEntry,
  PossibilitySubgraph,
} from '../p3/index.ts';
import { bestPayment, type PayabilityReport } from './payment.ts';
import { violateGoal, type GoalViolation } from './violation.ts';

/** 원문 P4 의 평가 요소 아홉. 순서는 원문 그대로다. */
export const GOAL_FACTORS = [
  'pressure', // 의존 압력
  'feasibility', // 성공 가능성
  'cost', // 비용
  'risk', // 위험
  'values', // 가치관
  'relations', // 관계
  'memory', // 기억
  'promise', // 현재 약속
  'sunk', // 이미 투자한 비용
] as const;
export type GoalFactorId = (typeof GOAL_FACTORS)[number];

/** 요소의 한국어 이름 — 원문 표기 그대로. */
export const FACTOR_LABELS: Readonly<Record<GoalFactorId, string>> = {
  pressure: '의존 압력',
  feasibility: '성공 가능성',
  cost: '비용',
  risk: '위험',
  values: '가치관',
  relations: '관계',
  memory: '기억',
  promise: '현재 약속',
  sunk: '이미 투자한 비용',
};

/** 요소가 후보를 당기는가 미는가. */
export type FactorDirection = 'pull' | 'push' | 'both';

/** 요소 하나가 어디서 오는가 — P4 가 지어내지 않았다는 증서. */
export interface FactorSource {
  readonly id: GoalFactorId;
  /** 어느 계층이 이 값을 이미 갖고 있는가 */
  readonly layer: string;
  /** 그 계층의 무엇을 읽는가 */
  readonly reads: string;
  readonly direction: FactorDirection;
  /** 요소를 접을 때의 무게 — 결정론 상수이므로 여기 한 곳에만 적는다 */
  readonly weight: number;
  readonly note: string;
}

/**
 * 아홉의 출처. 여덟은 앞 계층이고 매몰비용 하나만 P4 자신이다.
 *
 * 무게는 원문이 적지 않았다 — 원문이 준 것은 **순서**뿐이다(압력이 먼저, 투자한 비용이 끝).
 * 그래서 무게는 그 순서를 거스르지 않는 선에서 고정하고, 근거를 한 줄씩 남긴다.
 * 결정론에 영향을 주므로 런타임에 바뀌지 않는다.
 */
export const FACTOR_SOURCES: readonly FactorSource[] = [
  {
    id: 'pressure',
    layer: 'D4·P1',
    reads: 'NarrowedBranch.pressure — D4 가 재고 P1 이 갈래에 붙여 둔 값을 그대로 읽는다',
    direction: 'pull',
    weight: 1,
    note: '원문이 첫 요소로 적었고, 목적의 씨앗 자체가 압력이다 — 가장 큰 무게를 준다. 두 곳에서 재지 않는다: 급함을 기대는 쪽에서 읽는 규칙(P1-c)이 이미 붙여 둔 값이다',
  },
  {
    id: 'feasibility',
    layer: 'P3·P0',
    reads: 'ExpansionTrace.reason + Possibility.preconditionIds + AtomGrounding.resistable',
    direction: 'pull',
    weight: 0.8,
    note: '되지 않을 일은 목적이 되지 못한다 — 압력 다음으로 크게 민다. 선행이 걸릴수록 깎인다',
  },
  {
    id: 'cost',
    layer: 'P0·O2',
    reads: 'PayabilityReport.drain — 치르는 자리가 얼마나 말랐는가 (P4-a)',
    direction: 'push',
    weight: 0.5,
    note: '같은 원자라도 마른 자리를 치르면 비싸다 — 빚진 자에게 설득이 비싼 것이 여기서 나온다',
  },
  {
    id: 'risk',
    layer: 'P0',
    reads: 'AtomGrounding.reversible · consent + PayabilityReport.unbrakedSlots',
    direction: 'push',
    weight: 0.5,
    note: '되돌릴 수 없는가 · 되받는가 · 되돌려 줄 행동이 없는 자리를 치르는가 — 셋 다 일이 끝난 뒤의 값이다',
  },
  {
    id: 'values',
    layer: 'S0',
    reads: 'SubjectProfile.values[].weight — "P4 목적 선택의 가중치" 라고 S0 가 적어 둔 자리',
    direction: 'both',
    weight: 0.6,
    note: '내가 미는 자리를 세우면 당기고 깎으면 민다 — 같은 굶주림 앞에서 사람이 갈리는 자리다',
  },
  {
    id: 'relations',
    layer: 'O2·P0',
    reads: 'world.relational.trust.{subject} × AtomGrounding.consent',
    direction: 'both',
    weight: 0.3,
    note: '같은 신뢰가 동의 축에 따라 반대로 읽힌다 — 합의에는 재료이고 등지는 데에는 잃을 것이다',
  },
  {
    id: 'memory',
    layer: 'P3',
    reads: 'ExpansionContext.staleFacts — 그 대상에 대한 근거가 지금과 어긋나는가',
    direction: 'push',
    weight: 0.3,
    note: '어긋난 기억은 거부되지 않고 남는다(P3-b) — 그 낡음이 목적을 고를 때 값으로 선다',
  },
  {
    id: 'promise',
    layer: 'O2·P0',
    reads: 'world.relational.debt.{subject} × AtomGrounding.writes·consent',
    direction: 'both',
    weight: 0.3,
    note: '빚은 아무 행동도 세우지 못하는 자리다(P3-a) — 무게로만 읽는다. 빚을 더 지는 길과 빚진 상대를 등지는 길은 밀고, 그 밖의 합의는 갚을 자리라 당긴다',
  },
  {
    id: 'sunk',
    layer: 'P4',
    reads: '이전 틱의 ActiveGoal.sinceTick — 이 목적에 얼마나 머물렀는가',
    direction: 'pull',
    weight: 0.4,
    note: '앞 계층 어디에도 없는 값이다 — 고르는 자만 안다. P4 자신이 출처인 유일한 요소이며 선언된 예외다',
  },
];

/** 요소 하나의 출처를 찾는다. 없으면 null. */
export function factorSourceOf(id: GoalFactorId): FactorSource | null {
  return FACTOR_SOURCES.find((source) => source.id === id) ?? null;
}

/** 대상이 맞설 수 있으면 성공 가능성이 이만큼으로 줄어든다 (결정론 상수). */
export const RESISTANCE_FACTOR = 0.6;
/** 기억으로만 아는 것은 성공 가능성이 이만큼으로 줄어든다 — 기억은 지금을 보증하지 않는다. */
export const REMEMBERED_FACTOR = 0.5;
/** 매몰비용이 가득 차는 데 걸리는 틱 — 이보다 오래 머물면 더 늘지 않는다. */
export const SUNK_FULL_TICKS = 20;
/**
 * 빚을 무게로 접는 눈금.
 *
 * 세계는 빚에 상한을 두지 않았다(0~10억). 상한 없는 값을 −1~1 로 접으려면 눈금이 필요하고,
 * 그 눈금은 세계가 주지 않으므로 여기 한 번만 적는다 — 이만큼이면 다른 요소 하나만큼 무겁다.
 */
export const PROMISE_SCALE = 50;

/** 후보 하나를 밀거나 당기는 힘 하나. */
export interface GoalFactor {
  readonly id: GoalFactorId;
  readonly layer: string;
  /** −1~1. 음수는 민다 */
  readonly value: number;
  readonly weight: number;
  /** 값 × 무게 — 점수에 실제로 실리는 몫 */
  readonly contribution: number;
  readonly note: string;
}

/** 이전 틱에 무엇을 좇고 있었는가 — 매몰비용의 재료. */
export interface GoalHistory {
  readonly possibilityId: Id;
  readonly sinceTick: Tick;
}

/** 요소를 세울 재료. */
export interface FactorSpec {
  /** 유지 자리를 읽는다 — S0 ValueTarget */
  readonly subject: { readonly id: Id; readonly values: readonly ValueTarget[] };
  readonly world: WorldState;
  /** 압력은 P1 이 갈래에 붙여 둔 것을 읽는다 — D4 를 두 번 재지 않는다 */
  readonly tree: NarrowedTree;
  readonly context: ExpansionContext;
  readonly subgraph: PossibilitySubgraph;
  readonly tick: Tick;
  readonly previous?: GoalHistory | null;
  readonly schema?: StateSchema;
}

/** 후보 하나의 요소 아홉 + 그것을 어떤 원자로 낼 것인가. */
export interface CandidateFactors {
  readonly possibilityId: Id;
  readonly nodeId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  /** 갈래를 낼 원자 — 가장 나은 하나 (P4-a). 순서열은 P5 의 몫이다 */
  readonly viaAtom: ActionAtom | null;
  readonly payment: PayabilityReport | null;
  readonly factors: readonly GoalFactor[];
  readonly violations: readonly GoalViolation[];
}

/** −1~1 로 접는다. 음의 0 은 0 으로 편다 — 같은 값이 두 모양으로 직렬화되면 해시가 갈린다. */
function clamp(value: number): number {
  const bounded = Math.min(1, Math.max(-1, value));
  return bounded === 0 ? 0 : bounded;
}

/** 두 자리가 같은 자리를 가리키는가 — 패턴 자리(`trust.{subject}`)와 실제 자리를 맞댄다. */
function coversSlot(pattern: SlotRef, actual: SlotRef): boolean {
  if (pattern.domain !== actual.domain) return false;
  return pattern.path === actual.path || matchPath(pattern.path, actual.path) !== null;
}

/** 이 주체가 남들에게 갖는 사이의 평균 — 상대를 지목하는 것은 D5·R 의 몫이다. */
function relationAverage(
  world: WorldState,
  subjectId: Id,
  counterparts: readonly Id[],
  prefix: string,
): number {
  if (counterparts.length === 0) return 0;
  let sum = 0;
  for (const other of counterparts) {
    const value = readSlot(world, 'relational', subjectId, `${prefix}.${other}`);
    sum += typeof value === 'number' ? value : 0;
  }
  return sum / counterparts.length;
}

/** 그 대상에 대한 근거가 지금과 어긋나 있는가. */
function staleAbout(context: ExpansionContext, targetId: Id | null): boolean {
  if (targetId === null) return false;
  return context.staleFacts.some((fact) => fact.holderId === targetId);
}

/** 가치관 — 내가 미는 자리를 세우는가 깎는가. */
function valueAlignment(
  grounding: AtomGrounding,
  subject: FactorSpec['subject'],
): { readonly value: number; readonly touched: readonly string[] } {
  let sum = 0;
  const touched: string[] = [];
  for (const target of subject.values) {
    // 경계 밖의 유지(남의 자리)는 아직 잇지 못한다 — 원자는 제 자리만 바꾼다고 P0-b 가 적었다.
    if (target.holderId !== subject.id) continue;
    const writes = grounding.writes.some((ref) => coversSlot(ref, target.slot));
    const pays = grounding.pays.some((ref) => coversSlot(ref, target.slot));
    if (writes && !pays) {
      sum += target.weight;
      touched.push(`+${slotText(target.slot)}`);
    } else if (pays && !writes) {
      sum -= target.weight;
      touched.push(`-${slotText(target.slot)}`);
    }
  }
  return { value: clamp(sum), touched };
}

function factor(id: GoalFactorId, value: number, note: string): GoalFactor {
  const source = factorSourceOf(id);
  const weight = source?.weight ?? 0;
  const bounded = clamp(value);
  return {
    id,
    layer: source?.layer ?? '',
    value: bounded,
    weight,
    contribution: clamp(bounded * weight),
    note,
  };
}

/**
 * 후보 하나의 요소 아홉을 세운다. 던지지 않는다 — 읽을 수 없는 자리는 0 으로 서고 사유가 남는다.
 */
export function factorsOf(candidate: Possibility, spec: FactorSpec): CandidateFactors {
  const violations: GoalViolation[] = [];
  const entry: ExpansionTraceEntry | undefined = spec.subgraph.trace.entries.find(
    (item) => item.possibilityId === candidate.id,
  );
  if (entry === undefined) {
    violateGoal(
      violations,
      candidate.id,
      'phantom-candidate',
      '$.candidate',
      `${candidate.id} 는 이 부분 그래프가 펴지 않은 후보다 — P3 이 놓지 않은 것을 고를 수는 없다`,
    );
  }
  const payment = bestPayment(candidate.atoms as readonly ActionAtom[], {
    actorId: spec.subject.id,
    world: spec.world,
    ...(spec.schema === undefined ? {} : { schema: spec.schema }),
  });
  const grounding = payment === null ? null : atomGrounding(payment.atom);
  const label = entry?.label ?? candidate.forDependencyId;

  // ① 의존 압력 (D4 가 재고 P1 이 갈래에 붙인 값)
  const branch = spec.tree.branches.find((item) => item.nodeId === candidate.forDependencyId);
  const pressure = factor(
    'pressure',
    branch?.pressure ?? 0,
    branch === undefined
      ? `${label} 의 압력이 갈래에 붙어 있지 않다 — 급하지 않은 것으로 선다`
      : `${label} 이 ${branch.level} 이다 (압력 ${branch.pressure.toFixed(2)})`,
  );

  // ② 성공 가능성 (P3 근거 · 선행 · P0 저항)
  const reasonFactor = entry?.reason === 'remembered' ? REMEMBERED_FACTOR : 1;
  const resistFactor = grounding?.resistable === true ? RESISTANCE_FACTOR : 1;
  const blocked = payment?.verdict === 'blocked' ? payment.blockedBy.length : 0;
  const steps = candidate.preconditionIds.length + (blocked > 0 ? 1 : 0);
  const feasibility = factor(
    'feasibility',
    (reasonFactor * resistFactor) / (1 + steps),
    `근거 ${entry?.reason ?? '없음'} · 선행 ${String(steps)}칸${
      grounding?.resistable === true ? ' · 대상이 맞설 수 있다' : ''
    }`,
  );

  // ③ 비용 (P4-a 마름)
  const cost = factor(
    'cost',
    -(payment?.drain ?? 1),
    payment === null
      ? '낼 원자가 없다 — 치를 것을 물을 수 없다'
      : `${atomLabel(payment.atom)} 가 치르는 자리 중 가장 마른 곳 ${payment.drain.toFixed(2)}`,
  );

  // ④ 위험 (P0 걸림 — 일이 끝난 뒤의 값 셋)
  const flags = [
    grounding !== null && !grounding.reversible,
    grounding?.consent === 'against',
    (payment?.unbrakedSlots.length ?? 0) > 0,
  ];
  const risk = factor(
    'risk',
    -(flags.filter(Boolean).length / flags.length),
    [
      flags[0] === true ? '되돌릴 수 없다' : null,
      flags[1] === true ? '상대의 뜻을 거스른다' : null,
      flags[2] === true ? `되돌려 줄 행동이 없는 자리를 치른다(${payment?.unbrakedSlots.join('·') ?? ''})` : null,
    ]
      .filter((line): line is string => line !== null)
      .join(' · ') || '되돌릴 수 있고 되받지 않는다',
  );

  // ⑤ 가치관 (S0 유지 자리)
  const alignment =
    grounding === null ? { value: 0, touched: [] as readonly string[] } : valueAlignment(grounding, spec.subject);
  const values = factor(
    'values',
    alignment.value,
    alignment.touched.length === 0
      ? '내가 미는 자리를 건드리지 않는다'
      : `유지 자리를 건드린다 — ${alignment.touched.join(' · ')}`,
  );

  // ⑥ 관계 (O2 사이 × P0 동의 축)
  const trust = relationAverage(spec.world, spec.subject.id, spec.context.counterparts, 'trust');
  const consent = grounding?.consent ?? 'none';
  const relations = factor(
    'relations',
    consent === 'mutual' ? trust : consent === 'against' ? -trust : 0,
    consent === 'none'
      ? '남이 없어도 서는 길이다'
      : consent === 'mutual'
        ? `합의로 서는 길이다 — 사이 ${trust.toFixed(2)} 가 재료가 된다`
        : `등지는 길이다 — 사이 ${trust.toFixed(2)} 가 잃을 것이 된다`,
  );

  // ⑦ 기억 (P3 어긋난 근거)
  const stale = staleAbout(spec.context, entry?.targetId ?? null);
  const memory = factor(
    'memory',
    stale ? -1 : 0,
    stale ? `${label} 에 대해 아는 것이 지금과 어긋난다 — 기억은 지금을 보증하지 않는다` : '어긋난 근거가 없다',
  );

  // ⑧ 현재 약속 (O2 빚 × P0 걸림)
  //
  // 빚을 **더 지는** 길(동맹 — 빚 자리를 쓰는 유일한 원자)과 빚진 상대를 **등지는** 길은 민다.
  // 그 밖의 합의는 갚을 자리라 당긴다. 셋의 갈림은 P0 걸림이 정한다.
  const debt = debtTotal(spec.world, spec.subject.id);
  const owed = Math.min(1, debt / PROMISE_SCALE);
  const incurs =
    grounding !== null && grounding.writes.some((ref) => coversSlot(ref, DEBT_SLOT));
  const promise = factor(
    'promise',
    incurs || consent === 'against' ? -owed : consent === 'mutual' ? owed : 0,
    debt === 0
      ? '갚아야 할 것이 적혀 있지 않다'
      : incurs
        ? `빚 ${String(debt)} 를 지고 있는데 이 길은 빚을 더 진다`
        : consent === 'against'
          ? `빚 ${String(debt)} 를 진 채로 등지는 길이다 — 더 무겁다`
          : consent === 'mutual'
            ? `빚 ${String(debt)} 가 적혀 있다 — 합의로 얽히는 길은 갚을 자리다`
            : `빚 ${String(debt)} 는 이 길과 얽히지 않는다`,
  );

  // ⑨ 이미 투자한 비용 (P4 자신 — 선언된 예외)
  const held =
    spec.previous != null && spec.previous.possibilityId === candidate.id
      ? Math.min(1, Math.max(0, spec.tick - spec.previous.sinceTick) / SUNK_FULL_TICKS)
      : 0;
  const sunk = factor(
    'sunk',
    held,
    held === 0 ? '이 목적에 머문 적이 없다' : `${String(spec.tick - (spec.previous?.sinceTick ?? spec.tick))} 틱을 여기에 썼다`,
  );

  return {
    possibilityId: candidate.id,
    nodeId: candidate.forDependencyId,
    label,
    direction: candidate.direction,
    viaAtom: payment?.atom ?? null,
    payment,
    factors: [pressure, feasibility, cost, risk, values, relations, memory, promise, sunk],
    violations: [...violations, ...(payment?.violations ?? [])],
  };
}

/** 빚이 적히는 자리 — P3-a 가 "행동이 세우지 못하는 자리" 로 선언한 넷 중 하나다. */
const DEBT_SLOT: SlotRef = { domain: 'relational', path: 'debt.{subject}' };

/** 이 주체에게 적힌 빚의 총합 — 상대를 가리지 않는다. */
function debtTotal(world: WorldState, subjectId: Id): number {
  let sum = 0;
  for (const slot of worldSlots(world)) {
    if (slot.domain !== 'relational' || slot.ofId !== subjectId) continue;
    if (matchPath('debt.{subject}', slot.path) === null) continue;
    const value: StateValue = slot.value;
    if (typeof value === 'number') sum += value;
  }
  return sum;
}

/** 요소 목록이 성립하는가 — 출처 없는 요소·범위 밖 값은 거부된다. */
export function checkFactors(candidate: CandidateFactors): readonly GoalViolation[] {
  const violations: GoalViolation[] = [];
  for (const [index, item] of candidate.factors.entries()) {
    const source = factorSourceOf(item.id);
    if (source === null) {
      violateGoal(
        violations,
        candidate.possibilityId,
        'unsourced-factor',
        `$.factors[${String(index)}].id`,
        `${item.id} 는 출처가 선언되지 않은 요소다 — 앞 계층에서 오지 않은 힘은 목적을 밀지 못한다`,
      );
      continue;
    }
    if (item.layer !== source.layer) {
      violateGoal(
        violations,
        candidate.possibilityId,
        'unsourced-factor',
        `$.factors[${String(index)}].layer`,
        `${FACTOR_LABELS[item.id]} 가 ${item.layer} 에서 왔다고 하는데 선언된 출처는 ${source.layer} 다`,
      );
    }
    if (!Number.isFinite(item.value) || item.value < -1 || item.value > 1) {
      violateGoal(
        violations,
        candidate.possibilityId,
        'factor-out-of-range',
        `$.factors[${String(index)}].value`,
        `${FACTOR_LABELS[item.id]} 의 값 ${String(item.value)} 이 −1~1 밖이다 — 접을 수 없는 힘이다`,
      );
    }
  }
  return violations;
}

/**
 * 출처표 자체가 성립하는가 — 아홉이 전부 있고, P4 자신을 출처로 삼는 것이 매몰비용 하나뿐인가.
 *
 * 이 검사가 있어야 "요소를 하나 더 만들어 손으로 값을 넣는" 길이 막힌다.
 */
export function checkFactorSources(
  sources: readonly FactorSource[] = FACTOR_SOURCES,
): readonly GoalViolation[] {
  const violations: GoalViolation[] = [];
  const declared = new Map(sources.map((source) => [source.id, source]));
  for (const id of GOAL_FACTORS) {
    if (!declared.has(id)) {
      violateGoal(
        violations,
        id,
        'unsourced-factor',
        '$.sources',
        `원문이 적은 ${FACTOR_LABELS[id]} 의 출처가 선언되지 않았다`,
      );
    }
  }
  for (const source of sources) {
    if (!(GOAL_FACTORS as readonly string[]).includes(source.id)) {
      violateGoal(
        violations,
        source.id,
        'unsourced-factor',
        '$.sources',
        `${source.id} 는 원문 아홉에 없는 요소다 — 목록을 늘리려면 원문을 다시 읽어야 한다`,
      );
      continue;
    }
    if (source.layer === 'P4' && source.id !== 'sunk') {
      violateGoal(
        violations,
        source.id,
        'unsourced-factor',
        '$.sources',
        `${FACTOR_LABELS[source.id]} 가 P4 자신에게서 온다 — 앞 계층이 출처가 아닌 것은 매몰비용 하나뿐이다`,
      );
    }
  }
  return violations;
}

/** 요소 목록을 한 줄로 접는다 — 터미널·배지용. */
export function factorVerdict(candidate: CandidateFactors): string {
  const pulls = candidate.factors.filter((item) => item.contribution > 0);
  const pushes = candidate.factors.filter((item) => item.contribution < 0);
  return `${directionLabel(candidate.direction)} — 당김 ${String(pulls.length)} · 밀침 ${String(pushes.length)} (${
    candidate.viaAtom === null ? '낼 원자 없음' : atomLabel(candidate.viaAtom)
  })`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function factorSummary(candidate: CandidateFactors): readonly string[] {
  return candidate.factors.map(
    (item) => `${FACTOR_LABELS[item.id]}(${item.layer}): ${item.value.toFixed(2)} × ${item.weight.toFixed(1)}`,
  );
}
