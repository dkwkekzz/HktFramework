// P3-b 확장 근거 — 무엇을 펼칠지는 세계 전체가 아니라 **이 주체가 딛고 선 것**이 정한다.
//
// 원문 P3 은 확장의 재료를 넷으로 적었다: 지금 보이는 것 · 기억 · 관계 · 능력.
// 넷은 출처가 다를 뿐 하는 일이 같다 — 각자 "이 주체에게 지금 무엇이 사실인가" 를 한 줄씩
// 보탠다. 그래서 넷을 네 타입으로 나누지 않고 **하나의 사실(`ContextFact`)에 출처 축**을 둔다.
// 나누면 P3-c 가 넷을 각각 다루어야 하고, 나중에 다섯 번째 출처(소문·기록)가 생길 때마다
// 파이프가 굵어진다.
//
// 넷은 세계에 걸리는 방식이 다르고, 그 다름이 이 하위 작업의 규율이다.
//
//   percept       **세계에 실재해야 한다.** 없는 자리를 본다고 하면 거부한다 — 관측은 세계를
//                 새로 여는 유일한 통로이므로, 여기서 거짓을 허용하면 아무 대상이나 만들 수 있다.
//   memory        **실재를 요구하지 않는다.** 사라진 창고도 기억에 남는다. 대신 지금 세계와
//                 어긋나면 `stale` 로 표시한다 — 그것이 R4 거짓 믿음의 씨앗이고, 여기서
//                 지우면 주체는 영원히 옳게 된다.
//   relationship  **손으로 주지 않고 세계에서 읽는다.** 세계의 `relational` 영역에 이 주체를
//                 보유자로 적어 둔 자리가 곧 관계다. 적히지 않은 사이는 없는 사이다.
//   capability    **문법이 준 것만.** P2 가 이미 유형·문화·금기를 지나 계산해 두었다.
//
// 그리고 한 문장: **보지 못한 것은 후보가 되지 않는다 — 다만 자기 자신은 언제나 보인다.**
// 몸은 보지 않아도 알기 때문이고(P0-b 가 `self` 원자 셋을 그렇게 세웠다), 그래서 굶주림은
// 아무것도 못 본 주체에게도 길을 남긴다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { StateValue } from '../o1/being.ts';
import type { StateDomain } from '../o2/domain.ts';
import { readHolder, readSlot, worldHolders, type WorldState } from '../o2/world.ts';
import type { SlotRef, ActionAtom } from '../p0/index.ts';
import { slotText } from '../p0/index.ts';
import type { AbilityGrant, PossibilityGrammar } from '../p2/index.ts';
import { violateExpansion, type PossibilityGraphViolation } from './violation.ts';

/** 사실 하나가 어디서 왔는가. */
export const FACT_SOURCES = [
  'percept', // 지금 보인다
  'memory', // 전에 봤다
  'relationship', // 사이에 적혀 있다
  'capability', // 내가 지녔다
] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** 출처의 한국어 이름 (화면 표기). */
export function sourceLabel(source: FactSource): string {
  switch (source) {
    case 'percept':
      return '봄';
    case 'memory':
      return '기억';
    case 'relationship':
      return '사이';
    default:
      return '능력';
  }
}

/** 주체가 지금 딛고 선 사실 하나. */
export interface ContextFact {
  readonly via: FactSource;
  /** 무엇에 대한 사실인가 — 세계의 보유자 id. 능력이면 능력 id */
  readonly holderId: Id;
  /** 어느 자리인가. 능력은 자리를 갖지 않으므로 null */
  readonly slot: SlotRef | null;
  /** 그 자리에서 읽은(또는 기억하는) 값. 자리가 없으면 null */
  readonly value: StateValue | null;
  /** 언제의 사실인가 — 봄·사이·능력은 지금, 기억은 과거 */
  readonly asOfTick: Tick;
  /** 지금 세계와 어긋나는가 — 기억만 어긋날 수 있다 */
  readonly stale: boolean;
  readonly note: string;
}

/** 호출자가 "지금 이것을 본다" 고 주장하는 것 (R3 이 갚기 전까지 손으로 준다). */
export interface PerceptClaim {
  readonly holderId: Id;
  readonly domain: StateDomain;
  readonly path: string;
}

/** 호출자가 "전에 이랬다" 고 기억하는 것. */
export interface MemoryClaim {
  readonly holderId: Id;
  readonly domain: StateDomain;
  readonly path: string;
  readonly value: StateValue;
  readonly asOfTick: Tick;
}

/** 근거를 세울 재료. */
export interface ContextSpec {
  readonly subjectId: Id;
  readonly tick: Tick;
  readonly world: WorldState;
  readonly grammar: PossibilityGrammar;
  readonly percepts?: readonly PerceptClaim[];
  readonly memories?: readonly MemoryClaim[];
  /** 이 주체가 지녔다고 주장하는 능력 — 세계의 배정·문법과 대조된다 */
  readonly capabilities?: readonly Id[];
  /** 세계가 선언한 능력↔원자 배정 (P2 와 같은 것을 넘겨받는다) */
  readonly grants?: readonly AbilityGrant[];
}

/** 주체가 지금 무엇을 딛고 서 있는가. */
export interface ExpansionContext {
  readonly subjectId: Id;
  readonly tick: Tick;
  readonly facts: readonly ContextFact[];
  /** 지금 보이는 대상 (자기 자신 포함) */
  readonly seen: readonly Id[];
  /** 기억으로만 아는 대상 — 지금은 보이지 않는다 */
  readonly remembered: readonly Id[];
  /** 손댈 수 있는 대상 = 본 것 + 기억한 것 */
  readonly reachable: readonly Id[];
  /** 사이가 적힌 상대 */
  readonly counterparts: readonly Id[];
  readonly capabilities: readonly Id[];
  /** 능력이 실어 나른 원자 (문법에서 읽는다) */
  readonly empowered: readonly ActionAtom[];
  /** 기억과 세계가 어긋난 자리 */
  readonly staleFacts: readonly ContextFact[];
  readonly violations: readonly PossibilityGraphViolation[];
  readonly complete: boolean;
}

const slot = (domain: StateDomain, path: string): SlotRef => ({ domain, path });

/** 세계의 `relational` 영역에서 이 주체의 사이를 읽는다 — 관계는 주장이 아니라 기록이다. */
export function relationsOf(
  world: WorldState,
  subjectId: Id,
): readonly { readonly path: string; readonly value: StateValue }[] {
  const holder = readHolder(world, 'relational', subjectId);
  return stableSort(Object.keys(holder), compareStrings).map((path) => ({
    path,
    value: holder[path] as StateValue,
  }));
}

/**
 * `trust.subject:ab12` 처럼 자리 경로 끝에 붙은 상대 id 를 뽑는다.
 * 상대가 적히지 않은 관계 자리(`belonging` 같은 것)면 null.
 */
function counterpartOf(path: string): Id | null {
  const cut = path.indexOf('.');
  if (cut < 0) return null;
  const rest = path.slice(cut + 1);
  return rest === '' ? null : rest;
}

/** 근거를 세운다. 던지지 않는다 — 설 수 없는 주장은 값으로 남는다. */
export function buildContext(spec: ContextSpec): ExpansionContext {
  const violations: PossibilityGraphViolation[] = [];
  const facts: ContextFact[] = [];
  const seen = new Set<Id>();
  const remembered = new Set<Id>();
  const counterparts = new Set<Id>();

  // 주체가 세계에 한 번도 적히지 않았으면 근거를 세울 자리가 없다.
  if (!worldHolders(spec.world).includes(spec.subjectId)) {
    violateExpansion(
      violations,
      '',
      'absent-subject',
      '$.subjectId',
      `${spec.subjectId} 가 세계에 한 번도 적히지 않았다 — 서 있지 않은 주체는 아무것도 딛지 못한다`,
    );
  }

  // ① 봄 — 자기 자신은 언제나 보인다. 몸은 보지 않아도 알기 때문이다.
  seen.add(spec.subjectId);
  facts.push({
    via: 'percept',
    holderId: spec.subjectId,
    slot: null,
    value: null,
    asOfTick: spec.tick,
    stale: false,
    note: '자기 자신은 언제나 보인다 — 몸은 보지 않아도 안다 (P0-b self 원자 셋의 자리)',
  });

  for (const [index, claim] of (spec.percepts ?? []).entries()) {
    const ref = slot(claim.domain, claim.path);
    const value = readSlot(spec.world, claim.domain, claim.holderId, claim.path);
    if (value === null) {
      violateExpansion(
        violations,
        '',
        'phantom-percept',
        `$.percepts[${String(index)}]`,
        `세계에 없는 자리 ${claim.holderId}/${slotText(ref)} 를 지금 본다고 한다 — 관측이 세계를 새로 여는 통로이므로 여기서 거짓을 허용하면 아무 대상이나 만들 수 있다`,
      );
      continue;
    }
    seen.add(claim.holderId);
    facts.push({
      via: 'percept',
      holderId: claim.holderId,
      slot: ref,
      value,
      asOfTick: spec.tick,
      stale: false,
      note: `지금 ${claim.holderId} 의 ${slotText(ref)} 가 ${JSON.stringify(value)} 로 보인다`,
    });
  }

  // ② 기억 — 실재를 요구하지 않는다. 다만 지금과 어긋나면 표시한다.
  for (const [index, claim] of (spec.memories ?? []).entries()) {
    const ref = slot(claim.domain, claim.path);
    if (claim.asOfTick > spec.tick) {
      violateExpansion(
        violations,
        '',
        'future-memory',
        `$.memories[${String(index)}]`,
        `틱 ${String(spec.tick)} 에서 틱 ${String(claim.asOfTick)} 의 일을 기억한다 — 아직 오지 않은 것은 기억이 아니다`,
      );
      continue;
    }
    const now = readSlot(spec.world, claim.domain, claim.holderId, claim.path);
    const stale = now !== claim.value;
    if (!seen.has(claim.holderId)) remembered.add(claim.holderId);
    facts.push({
      via: 'memory',
      holderId: claim.holderId,
      slot: ref,
      value: claim.value,
      asOfTick: claim.asOfTick,
      stale,
      note: stale
        ? `틱 ${String(claim.asOfTick)} 에는 ${JSON.stringify(claim.value)} 였다 — 지금은 ${now === null ? '그 자리가 없다' : JSON.stringify(now)} (R4 가 갚을 어긋남)`
        : `틱 ${String(claim.asOfTick)} 의 기억이 지금과 같다`,
    });
  }

  // ③ 사이 — 손으로 주지 않고 세계에서 읽는다.
  for (const relation of relationsOf(spec.world, spec.subjectId)) {
    const other = counterpartOf(relation.path);
    if (other !== null) counterparts.add(other);
    facts.push({
      via: 'relationship',
      holderId: other ?? spec.subjectId,
      slot: slot('relational', relation.path),
      value: relation.value,
      asOfTick: spec.tick,
      stale: false,
      note: `세계가 적어 둔 사이 — ${relation.path} = ${JSON.stringify(relation.value)}`,
    });
  }

  // ④ 능력 — 세계가 배정했고 **문법이 실제로 실어 나른** 것만.
  // P2 가 못박은 대로 능력은 유형이 막은 자리를 열지 못한다. 그래서 배정만으로는 손이 되지
  // 않는다 — 문법을 지나 `empowered` 에 남은 것이 있어야 비로소 근거가 된다.
  const empowered = new Set(spec.grammar.empowered);
  const capabilities: Id[] = [];
  for (const [index, abilityId] of (spec.capabilities ?? []).entries()) {
    const at = `$.capabilities[${String(index)}]`;
    const grant = (spec.grants ?? []).find((entry) => entry.abilityId === abilityId) ?? null;
    if (grant === null) {
      violateExpansion(
        violations,
        '',
        'ungranted-capability',
        at,
        `${abilityId} 를 지녔다는데 세계가 그 능력에 아무 원자도 배정하지 않았다 — 배정 없는 능력은 이름뿐이다`,
      );
      continue;
    }
    const carried = grant.atoms.filter((atom) => empowered.has(atom));
    if (carried.length === 0) {
      violateExpansion(
        violations,
        '',
        'ungranted-capability',
        at,
        `${abilityId} 가 실으려는 ${grant.atoms.join('·')} 를 문법이 하나도 열어 주지 않았다 — 능력은 유형이 막은 자리를 열지 못한다 (P2)`,
      );
      continue;
    }
    capabilities.push(abilityId);
    facts.push({
      via: 'capability',
      holderId: abilityId,
      slot: null,
      value: null,
      asOfTick: spec.tick,
      stale: false,
      note: `능력 ${abilityId} 가 ${carried.join('·')} 를 의념으로 실어 나른다`,
    });
  }

  const sortedSeen = stableSort([...seen], compareStrings);
  const sortedRemembered = stableSort([...remembered], compareStrings);

  return {
    subjectId: spec.subjectId,
    tick: spec.tick,
    facts,
    seen: sortedSeen,
    remembered: sortedRemembered,
    reachable: stableSort([...seen, ...remembered], compareStrings),
    counterparts: stableSort([...counterparts], compareStrings),
    capabilities,
    empowered: spec.grammar.empowered,
    staleFacts: facts.filter((fact) => fact.stale),
    violations,
    complete: violations.length === 0,
  };
}

/** 그 대상에 손이 닿는가 — P3-c 가 가지를 펼칠지 정할 때 묻는 물음이다. */
export function reaches(context: ExpansionContext, holderId: Id): boolean {
  return context.reachable.includes(holderId);
}

/** 근거를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function contextVerdict(context: ExpansionContext): string {
  if (!context.complete) {
    const rules = [...new Set(context.violations.map((violation) => violation.rule))];
    return `근거가 설 수 없다 — ${rules.join(', ')}`;
  }
  return `사실 ${String(context.facts.length)}개 · 보는 것 ${String(context.seen.length)} · 기억으로만 ${String(context.remembered.length)} · 사이 ${String(context.counterparts.length)} · 능력 ${String(context.capabilities.length)}${
    context.staleFacts.length === 0 ? '' : ` · 어긋난 기억 ${String(context.staleFacts.length)}`
  }`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function contextSummary(context: ExpansionContext): readonly string[] {
  return [
    `보는 것: ${context.seen.join(' · ')}`,
    `기억으로만: ${context.remembered.length === 0 ? '(없다)' : context.remembered.join(' · ')}`,
    `사이: ${context.counterparts.length === 0 ? '(없다)' : context.counterparts.join(' · ')}`,
    `능력이 실은 원자: ${context.empowered.length === 0 ? '(없다)' : context.empowered.join(' · ')}`,
    `어긋난 기억: ${
      context.staleFacts.length === 0
        ? '(없다)'
        : context.staleFacts.map((fact) => `${fact.holderId}/${fact.slot === null ? '?' : slotText(fact.slot)}`).join(' · ')
    }`,
  ];
}
