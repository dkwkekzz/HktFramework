// O0-b 정의 검사 — 세계에 들이려는 능력·종이 공리를 어기면 거부한다.
//
// 원문 O0 의 검증 조항 ①이 그대로 여기 있다: "공리를 위반하는 능력이나 생물 정의가 거부되는가?"
//
// **정의는 새 타입이 아니다.** 능력은 규칙이고, 종이 세계에 서는 조건도 규칙이다 —
// 둘 다 O1 Rule 이며, 어느 공리에서 나왔는지를 적는 자리(`Rule.axiomId`)는 O1 이 이미 비워 두었다.
// O0 는 그 자리를 강제한다: O1 은 근거 없는 규칙(`axiomId: null`)을 허용하지만, O0 는 거부한다.
//
// 검사는 두 겹이다.
//
//   ① 정의가 정의로서 온전한가        — O1 Rule 검사 + O0 고유 필드
//   ② 정의가 공리를 어기지 않는가      — 공리의 `appliesTo` 에 걸린 정의를 조항별 검사기가 본다
//
// ②는 정의가 그 공리를 근거로 인용했는지와 무관하다. 공리는 인용한 자에게만 적용되는 것이 아니다.

import { idKind, type Id } from '../v1/id.ts';
import { classify } from '../o1/index.ts';
import { SUBJECT_KINDS, type SubjectKind } from '../o1/being.ts';
import { PHENOMENON_CHANNELS, type PhenomenonChannel, type Rule } from '../o1/operation.ts';
import { isStateDomain, type StateDomain } from '../o2/domain.ts';
import { fieldsOf, lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import {
  AXIOM_SET,
  axiomById,
  type Axiom,
  type AxiomClause,
  type DefinitionKind,
} from './axiom.ts';

/** 세계의 한 자리 — O2 스키마의 `영역.경로`. 매개 자리(`trace.{rule}`)도 실제 ID 도 온다. */
export interface SlotRef {
  readonly domain: StateDomain;
  readonly path: string;
}

/** 능력이 치르는 대가 하나 — 어느 자리를 얼마나 깎는가. */
export interface CostSpec extends SlotRef {
  /** 깎이는 양 (0 초과). 0 이면 치르지 않은 것이다 */
  readonly amount: number;
}

/** 능력이 남기는 흔적 하나 — 무엇을 타고 와서 어느 자리에 적히는가. */
export interface TraceSpec extends SlotRef {
  readonly channel: PhenomenonChannel;
}

/** 능력 정의 — 조건이 성립하면 무엇이 일어나는가 + 무엇을 치르고 무엇을 남기는가. */
export interface AbilityDefinition extends Rule {
  readonly definitionKind: 'ability';
  /** 대표 근거 말고 함께 따르는 공리들 (대표 근거는 Rule.axiomId) */
  readonly supportIds: readonly Id[];
  /** 효과 강도 0~1 — 임계를 넘으면 "강한 의념 효과" 다 */
  readonly strength: number;
  readonly costs: readonly CostSpec[];
  readonly traces: readonly TraceSpec[];
}

/** 종 정의 — 이 종이 세계에 서려면 무엇을 갖춰야 하는가. */
export interface SpeciesDefinition extends Rule {
  readonly definitionKind: 'species';
  readonly supportIds: readonly Id[];
  readonly subjectKind: SubjectKind;
  /** 생명인가 — 사람과 생물은 언제나 참이어야 한다 (psychic-life) */
  readonly alive: boolean;
  /** 이 종이 갖는 상태 자리들 */
  readonly slots: readonly SlotRef[];
  /** 신이라면 어느 집단의 반복 행동에서 왔는가 (emergent-divinity). 아니면 null */
  readonly originId: Id | null;
}

export type Definition = AbilityDefinition | SpeciesDefinition;

/** 공리가 정의를 거부하는 사유. */
export type AxiomViolationRule =
  // 공리 이전 — 정의가 정의로서 온전하지 않다
  | 'bad-definition'
  | 'ungrounded-definition' // 근거 공리가 없다 (O1 은 허용하지만 O0 는 거부한다)
  | 'unknown-axiom' // 공리 집합에 없는 것을 근거로 들었다
  // psychic-life
  | 'mindless-life' // 생명인데 의념 자리가 없다
  | 'life-denied' // 사람·생물인데 생명이 아니라고 선언했다
  // verifiable-cost
  | 'free-strong-effect' // 강한 효과인데 아무것도 치르지 않는다
  | 'weightless-cost' // 치른다고 적었으나 양이 0 이하다
  | 'unverifiable-cost' // 세계에 없는 자리를 깎는다 — 확인할 방법이 없다
  // observable-trace
  | 'traceless-ability' // 흔적을 남기지 않는다
  | 'unknown-channel' // 현상 통로 6종 밖으로 관찰한다고 적었다
  | 'unobservable-trace' // 세계에 없는 자리에 흔적이 적힌다
  // emergent-divinity
  | 'ungrounded-god' // 유래 없는 신
  | 'unanchored-god' // 초월 영역에 자리가 없는 신
  | 'origin-without-divinity'; // 신이 아닌데 집단의 반복 행동을 유래로 들었다

/** 위반 하나 — 어느 공리가, 정의의 어느 자리를, 왜 거부했는가. */
export interface AxiomViolation {
  readonly rule: AxiomViolationRule;
  /** 어느 공리가 거부했는가. 공리 이전의 결함이면 null */
  readonly clause: AxiomClause | null;
  readonly axiomId: Id | null;
  readonly definitionId: Id;
  /** 화면에서 읽히도록 이름을 함께 싣는다 */
  readonly definitionName: string;
  /** 정의 안의 경로 (`$.traces[0].path`) */
  readonly path: string;
  readonly message: string;
}

/** 강한 의념 효과의 임계 — 이 값을 **넘으면** 검증 가능한 비용이 필요하다. */
export const STRONG_EFFECT_THRESHOLD = 0.5;

/** 언제나 생명인 주체 종류 — 사람과 생물은 생명이 아니라고 선언될 수 없다. */
export const ALWAYS_ALIVE_KINDS: readonly SubjectKind[] = ['person', 'creature'];

/** 세계에 그런 자리가 있는가 — 매개 자리(`trace.{rule}`)와 실제 경로 둘 다 받는다. */
export function hasSlot(schema: StateSchema, domain: string, path: string): boolean {
  if (!isStateDomain(domain)) return false;
  if (fieldsOf(schema, domain).some((field) => field.path === path)) return true;
  return lookupField(schema, domain, path) !== null;
}

/** 자리 하나를 사람이 읽는 한 줄로. */
export function slotLabel(slot: SlotRef): string {
  return `${slot.domain}.${slot.path}`;
}

function violate(
  out: AxiomViolation[],
  definition: Definition,
  axiom: Axiom | null,
  rule: AxiomViolationRule,
  path: string,
  message: string,
): void {
  out.push({
    rule,
    clause: axiom?.clause ?? null,
    axiomId: axiom?.id ?? null,
    definitionId: definition.id,
    definitionName: definition.name,
    path,
    message,
  });
}

/** 정의가 정의로서 온전한가 — O1 Rule 검사 + O0 고유 필드. 사유 목록을 돌려준다. */
export function checkDefinitionShape(definition: Definition): readonly string[] {
  const reasons: string[] = [];
  for (const violation of classify(definition).violations) {
    reasons.push(`${violation.path} ${violation.message}`);
  }
  // 정의의 ID 는 규칙의 ID 다 — 흔적 자리(`trace.{rule}`)가 이 ID 를 매개로 받는다.
  if (idKind(definition.id) !== 'rule') {
    reasons.push(`$.id 정의의 ID 는 rule 종류여야 한다 — ${JSON.stringify(definition.id)}`);
  }
  for (const [index, id] of definition.supportIds.entries()) {
    if (idKind(id) !== 'axiom') {
      reasons.push(`$.supportIds[${String(index)}] 공리 ID 여야 한다 — ${JSON.stringify(id)}`);
    }
  }
  if (definition.axiomId !== null && idKind(definition.axiomId) !== 'axiom') {
    reasons.push(`$.axiomId 공리 ID 여야 한다 — ${JSON.stringify(definition.axiomId)}`);
  }

  if (definition.definitionKind === 'ability') {
    if (
      typeof definition.strength !== 'number' ||
      !Number.isFinite(definition.strength) ||
      definition.strength < 0 ||
      definition.strength > 1
    ) {
      reasons.push(`$.strength 강도는 0~1 이어야 한다 — ${String(definition.strength)}`);
    }
  } else if (definition.definitionKind === 'species') {
    if (!SUBJECT_KINDS.includes(definition.subjectKind)) {
      reasons.push(
        `$.subjectKind [${SUBJECT_KINDS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(definition.subjectKind)}`,
      );
    }
    if (typeof definition.alive !== 'boolean') {
      reasons.push('$.alive 생명 여부는 참거짓으로 적는다');
    }
    if (definition.originId !== null && idKind(definition.originId) === null) {
      reasons.push(`$.originId 유래는 V1 결정적 ID 여야 한다 — ${JSON.stringify(definition.originId)}`);
    }
  } else {
    reasons.push(
      `$.definitionKind [ability species] 중 하나여야 한다 — ${JSON.stringify((definition as { definitionKind?: unknown }).definitionKind)}`,
    );
  }
  return reasons;
}

type ClauseChecker = (
  definition: Definition,
  axiom: Axiom,
  schema: StateSchema,
  out: AxiomViolation[],
) => void;

/** 생명은 의념을 발생시킨다 — 의념 자리 없는 생명은 서지 못한다. */
const checkPsychicLife: ClauseChecker = (definition, axiom, _schema, out) => {
  if (definition.definitionKind !== 'species') return;

  if (!definition.alive && ALWAYS_ALIVE_KINDS.includes(definition.subjectKind)) {
    violate(
      out,
      definition,
      axiom,
      'life-denied',
      '$.alive',
      `${definition.subjectKind} 은 언제나 생명이다 — 생명이 아니라고 선언할 수 없다`,
    );
    return;
  }
  if (!definition.alive) return;

  if (!definition.slots.some((slot) => slot.domain === 'psychic')) {
    violate(
      out,
      definition,
      axiom,
      'mindless-life',
      '$.slots',
      '생명은 의념을 발생시킨다 — 의념 영역의 자리를 하나 이상 가져야 한다',
    );
  }
};

/** 강한 의념 효과에는 검증 가능한 비용이 필요하다. */
const checkVerifiableCost: ClauseChecker = (definition, axiom, schema, out) => {
  if (definition.definitionKind !== 'ability') return;

  const strong = definition.strength > STRONG_EFFECT_THRESHOLD;
  if (strong && definition.costs.length === 0) {
    violate(
      out,
      definition,
      axiom,
      'free-strong-effect',
      '$.costs',
      `강도 ${String(definition.strength)} 은 임계 ${String(STRONG_EFFECT_THRESHOLD)} 를 넘는다 — 아무것도 치르지 않는 큰 변화는 세계를 무너뜨린다`,
    );
  }
  for (const [index, cost] of definition.costs.entries()) {
    if (!(cost.amount > 0)) {
      violate(
        out,
        definition,
        axiom,
        'weightless-cost',
        `$.costs[${String(index)}].amount`,
        `치르는 양은 0 보다 커야 한다 — ${String(cost.amount)}`,
      );
    }
    if (!hasSlot(schema, cost.domain, cost.path)) {
      violate(
        out,
        definition,
        axiom,
        'unverifiable-cost',
        `$.costs[${String(index)}]`,
        `세계에 ${slotLabel(cost)} 자리가 없다 — 확인할 수 없는 대가는 대가가 아니다`,
      );
    }
  }
};

/** 모든 능력은 관찰 가능한 흔적을 남긴다. */
const checkObservableTrace: ClauseChecker = (definition, axiom, schema, out) => {
  if (definition.definitionKind !== 'ability') return;

  if (definition.traces.length === 0) {
    violate(
      out,
      definition,
      axiom,
      'traceless-ability',
      '$.traces',
      '흔적 없는 능력은 세계에 설 수 없다 — 아무도 그것이 일어났음을 알 수 없다',
    );
  }
  for (const [index, trace] of definition.traces.entries()) {
    if (!PHENOMENON_CHANNELS.includes(trace.channel)) {
      violate(
        out,
        definition,
        axiom,
        'unknown-channel',
        `$.traces[${String(index)}].channel`,
        `현상 통로는 [${PHENOMENON_CHANNELS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(trace.channel)}`,
      );
    }
    if (!hasSlot(schema, trace.domain, trace.path)) {
      violate(
        out,
        definition,
        axiom,
        'unobservable-trace',
        `$.traces[${String(index)}]`,
        `세계에 ${slotLabel(trace)} 자리가 없다 — 적힐 곳 없는 흔적은 관찰되지 않는다`,
      );
    }
  }
};

/** 집단의 반복 행동은 독립된 신적 주체를 만들 수 있다 — 그렇게 생긴 신에게는 유래가 있다. */
const checkEmergentDivinity: ClauseChecker = (definition, axiom, _schema, out) => {
  if (definition.definitionKind !== 'species') return;

  if (definition.subjectKind !== 'god') {
    if (definition.originId !== null) {
      violate(
        out,
        definition,
        axiom,
        'origin-without-divinity',
        '$.originId',
        `집단의 반복 행동에서 나오는 것은 신적 주체뿐이다 — ${definition.subjectKind} 은 유래를 들 수 없다`,
      );
    }
    return;
  }

  if (definition.originId === null) {
    violate(
      out,
      definition,
      axiom,
      'ungrounded-god',
      '$.originId',
      '유래 없는 신은 세계에 설 수 없다 — 어느 집단의 반복 행동이 이 신을 낳았는지 지목해야 한다',
    );
  }
  if (!definition.slots.some((slot) => slot.domain === 'transcendent')) {
    violate(
      out,
      definition,
      axiom,
      'unanchored-god',
      '$.slots',
      '신은 초월 영역의 자리를 하나 이상 가져야 한다 — 세계에 걸리지 않은 신은 아무것도 바꾸지 못한다',
    );
  }
};

/** 조항별 검사기 표 — 빈 칸은 "정의 층위에서는 검사하지 않는다" 는 뜻이다 (O0-c 가 그 사실을 센다). */
const CLAUSE_CHECKERS: Partial<Record<AxiomClause, ClauseChecker>> = {
  'psychic-life': checkPsychicLife,
  'verifiable-cost': checkVerifiableCost,
  'observable-trace': checkObservableTrace,
  'emergent-divinity': checkEmergentDivinity,
};

/** 정의 층위 검사기가 붙은 조항들. */
export function implementedClauses(): readonly AxiomClause[] {
  return AXIOM_SET.filter((axiom) => CLAUSE_CHECKERS[axiom.clause] !== undefined).map(
    (axiom) => axiom.clause,
  );
}

/**
 * 정의 하나가 공리를 어기는가.
 * 던지지 않는다 — 거부된 정의도 사유·경로와 함께 화면에 실려야 한다 (O1·O2 와 같은 태도).
 */
export function validateDefinition(
  definition: Definition,
  axioms: readonly Axiom[] = AXIOM_SET,
  schema: StateSchema = STATE_SCHEMA,
): readonly AxiomViolation[] {
  const out: AxiomViolation[] = [];

  const shapeReasons = checkDefinitionShape(definition);
  for (const reason of shapeReasons) {
    const cut = reason.indexOf(' ');
    violate(out, definition, null, 'bad-definition', reason.slice(0, cut), reason.slice(cut + 1));
  }
  // 형태가 무너진 정의에 공리를 들이대면 사유가 두 겹으로 쌓여 읽을 수 없게 된다.
  if (out.length > 0) return out;

  // 근거 — O1 은 근거 없는 규칙을 허용하지만 세계는 허용하지 않는다.
  if (definition.axiomId === null) {
    violate(
      out,
      definition,
      null,
      'ungrounded-definition',
      '$.axiomId',
      '어느 공리에서 나왔는지 적지 않은 정의는 세계에 설 수 없다',
    );
  }
  for (const [index, id] of [definition.axiomId, ...definition.supportIds].entries()) {
    if (id === null) continue;
    if (axiomById(id, axioms) === null) {
      violate(
        out,
        definition,
        null,
        'unknown-axiom',
        index === 0 ? '$.axiomId' : `$.supportIds[${String(index - 1)}]`,
        `공리 집합에 없는 근거다 — ${JSON.stringify(id)}`,
      );
    }
  }

  // 조항 — 인용 여부와 무관하게, 이 종류의 정의에 걸리는 공리는 전부 적용된다.
  for (const axiom of axioms) {
    if (!axiom.appliesTo.includes(definition.definitionKind)) continue;
    CLAUSE_CHECKERS[axiom.clause]?.(definition, axiom, schema, out);
  }
  return out;
}

/** 정의 여러 개를 한 번에 들일 때의 결과 — 무엇이 섰고 무엇이 왜 막혔는가. */
export interface DefinitionReport {
  /** 세계에 선 정의 (입력 순서) */
  readonly accepted: readonly Definition[];
  /** 막힌 정의 */
  readonly rejected: readonly Definition[];
  readonly violations: readonly AxiomViolation[];
  readonly complete: boolean;
}

/**
 * 정의 목록을 관문에 통과시킨다.
 * 어긴 정의는 **세계에 들어가지 않고** 사유로 남는다 — O2 의 조립과 같은 태도다.
 */
export function validateDefinitions(
  definitions: readonly Definition[],
  axioms: readonly Axiom[] = AXIOM_SET,
  schema: StateSchema = STATE_SCHEMA,
): DefinitionReport {
  const accepted: Definition[] = [];
  const rejected: Definition[] = [];
  const violations: AxiomViolation[] = [];

  for (const definition of definitions) {
    const reasons = validateDefinition(definition, axioms, schema);
    if (reasons.length === 0) {
      accepted.push(definition);
      continue;
    }
    rejected.push(definition);
    violations.push(...reasons);
  }

  return {
    accepted,
    rejected,
    violations,
    complete: definitions.length > 0 && rejected.length === 0,
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function definitionVerdict(report: DefinitionReport): string {
  if (report.complete) {
    return `정의 ${String(report.accepted.length)}개가 공리 위에 섰다`;
  }
  if (report.accepted.length + report.rejected.length === 0) return '들일 정의가 없다';
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `정의 ${String(report.rejected.length)}개가 막혔다 — ${rules.join(', ')}`;
}

/** 정의 종류를 한글 한 마디로 (화면 표기). */
export const DEFINITION_LABELS: Readonly<Record<DefinitionKind, string>> = {
  ability: '능력',
  species: '종',
};
