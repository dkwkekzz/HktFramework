// R4-c 믿음 그래프와 감사 — 누가 무엇을 믿고, 그것이 실제와 얼마나 갈렸는가.
//
// R4-b 는 지각 하나에서 믿음 하나를 세웠다. 그런데 세계에는 여럿이 살고, 한 사람도 여러 자국을
// 읽으며, **같은 자국을 다시 읽기도 한다.** 그 셋을 담는 자리다.
//
// R3-c 지각장·R2-c 현상장과 같은 모양이다: 담기만 하고 지우지 않으며, 감사가 **위반**과 **사실**을
// 가른다. 다만 여기서는 사실 쪽이 하나 더 있다 — 그리고 그것이 이 계층의 전부다.
//
//   위반 — 근거 없는 믿음, 남의 눈을 빌린 믿음, 후보 밖의 짚음, 요소와 어긋난 확신, 실린 진실.
//   사실 — **빗나간 믿음**(`wrong`). 세계가 아무리 정직하게 흔적을 내도, 통로가 아무리 정확하게
//          후보를 열어도, 열둘 중에서 고르는 일에는 틀림이 남는다. 이것을 위반으로 세면 R4 는
//          한 틱 늦은 전지(全知)가 되고 원문 §6.1 이 갈라 놓은 "객관적 상태와 관찰된 현상" 이
//          도로 붙는다. 그래서 감사는 그것을 **세되 막지 않는다.**
//   사실 — **아무도 믿지 않는 흔적**. R3-c 가 "아무도 보지 못한 흔적" 을 사실로 센 것의 다음 칸이다.
//   사실 — **삭은 자국 위에 남는 믿음**. 자국은 사라졌는데 믿음은 남는다 — 사라진 창고가 기억에
//          남는 것과 같은 자리다(P3-b `stale`). 이것이 R5 기억과 거짓 믿음의 씨앗이다.
//
// 실제와의 대조(`compareToTruth`)는 **감사만 본다**. 주체는 이 함수를 부를 수 없다 — 부를 수
// 있으면 그 순간 세계가 전지해진다. 검사대에 세우는 것과 주체가 아는 것은 다르다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import { atomLabel, type ActionAtom } from '../p0/index.ts';
import type { PossibilityGrammar } from '../p2/index.ts';
import { channelLabel, standingAt, type PhenomenonField, type WorldPhenomenon } from '../r2/index.ts';
import type { Percept, PerceptField } from '../r3/index.ts';
import { checkBelief, formBelief, orderBeliefs, reinforce, type Belief } from './belief.ts';
import { checkCandidateCoverage } from './guess.ts';
import { violateBelief, type BeliefViolation } from './violation.ts';

/** 주체별로 무엇을 믿는가. */
export interface BeliefGraph {
  readonly beliefs: readonly Belief[];
  /** 주체 id → 그가 믿는 것들 */
  readonly bySubject: ReadonlyMap<Id, readonly Belief[]>;
  /** 흔적 id → 그것에 대해 무언가 믿는 주체들 */
  readonly byPhenomenon: ReadonlyMap<Id, readonly Id[]>;
}

/** 빈 믿음 그래프. */
export function openBeliefGraph(): BeliefGraph {
  return { beliefs: [], bySubject: new Map(), byPhenomenon: new Map() };
}

function indexOf(beliefs: readonly Belief[]): BeliefGraph {
  const bySubject = new Map<Id, Belief[]>();
  const byPhenomenon = new Map<Id, Id[]>();
  for (const belief of beliefs) {
    bySubject.set(belief.holderId, [...(bySubject.get(belief.holderId) ?? []), belief]);
    const holders = byPhenomenon.get(belief.aboutId) ?? [];
    if (!holders.includes(belief.holderId)) {
      byPhenomenon.set(belief.aboutId, [...holders, belief.holderId]);
    } else {
      byPhenomenon.set(belief.aboutId, holders);
    }
  }
  return { beliefs, bySubject, byPhenomenon };
}

/**
 * 믿음들을 그래프에 담는다 — **같은 id 는 늘어나지 않고 갈아 끼워진다.**
 *
 * 믿음의 id 는 믿는 자와 흔적에서 나오므로(R4-b `beliefIdOf`), 같은 자국에 대한 두 번째 믿음은
 * 새 믿음이 아니라 **굳은 같은 믿음**이다. 그 굳히기는 `reinforce` 가 이미 했고 여기서는 자리만 바꾼다.
 */
export function recordBeliefs(graph: BeliefGraph, beliefs: readonly Belief[]): BeliefGraph {
  if (beliefs.length === 0) return graph;
  const merged = new Map(graph.beliefs.map((belief) => [belief.id, belief]));
  let changed = false;
  for (const belief of beliefs) {
    const before = merged.get(belief.id);
    if (before === belief) continue;
    merged.set(belief.id, belief);
    changed = true;
  }
  if (!changed) return graph;
  return indexOf(orderBeliefs([...merged.values()]));
}

/** 믿는 자 하나 — 누구이고, 무엇을 낼 수 있는가(그것이 곧 짐작의 사전이다). */
export interface Believer {
  readonly subjectId: Id;
  readonly label: string;
  /** 없으면 좁히지 않는다 — 후보 전체가 남는다 */
  readonly grammar: PossibilityGrammar | null;
}

/** 주체 하나가 읽은 것들을 믿음으로 옮긴 결과. */
export interface Reading {
  readonly believer: Believer;
  readonly beliefs: readonly Belief[];
  /** 처음 선 믿음 수 */
  readonly formed: number;
  /** 다시 읽어 굳은 믿음 수 */
  readonly reinforced: number;
  /** 읽었으나 짐작하지 못한 지각 (후보 없는 통로) */
  readonly unguessed: readonly Percept[];
  readonly violations: readonly BeliefViolation[];
}

/**
 * 여럿이 각자 읽은 것을 믿음으로 옮긴다.
 *
 * 이미 그 자국에 대한 믿음이 있으면 새로 세우지 않고 굳힌다(R4-b `reinforce`) — 같은 것을 두 번
 * 본 사람이 두 개의 믿음을 갖지는 않는다.
 */
export function interpret(
  believers: readonly Believer[],
  field: PerceptField,
  graph: BeliefGraph = openBeliefGraph(),
): { readonly graph: BeliefGraph; readonly readings: readonly Reading[] } {
  let current = graph;
  const readings: Reading[] = [];

  for (const believer of believers) {
    const mine = stableSort(
      [...(field.bySubject.get(believer.subjectId) ?? [])],
      (left, right) => compareStrings(`${left.atTick}/${left.channel}/${left.id}`, `${right.atTick}/${right.channel}/${right.id}`),
    );
    const beliefs: Belief[] = [];
    const violations: BeliefViolation[] = [];
    const unguessed: Percept[] = [];
    let formed = 0;
    let reinforced = 0;

    for (const percept of mine) {
      const known = current.beliefs.find(
        (belief) => belief.holderId === percept.subjectId && belief.aboutId === percept.phenomenonId,
      );
      const result = known === undefined ? formBelief(percept, believer.grammar) : reinforce(known, percept);
      if (result.belief === null) {
        violations.push(...result.violations);
        if (result.violations.some((violation) => violation.rule === 'blind-channel')) {
          unguessed.push(percept);
        }
        continue;
      }
      if (known === undefined) formed += 1;
      else reinforced += 1;
      beliefs.push(result.belief);
      current = recordBeliefs(current, [result.belief]);
    }

    readings.push({ believer, beliefs, formed, reinforced, unguessed, violations });
  }

  return { graph: current, readings };
}

/** 그 주체가 믿는 것들. */
export function beliefsFor(graph: BeliefGraph, subjectId: Id): readonly Belief[] {
  return graph.bySubject.get(subjectId) ?? [];
}

/** 그 흔적에 대해 무언가 믿는 주체들. */
export function believersOf(graph: BeliefGraph, phenomenonId: Id): readonly Id[] {
  return graph.byPhenomenon.get(phenomenonId) ?? [];
}

/** 아무도 아무것도 믿지 않는 흔적들 — 위반이 아니라 사실이다 (R3-c `unwitnessed` 의 다음 칸). */
export function unbelieved(
  graph: BeliefGraph,
  phenomena: readonly WorldPhenomenon[],
): readonly WorldPhenomenon[] {
  return phenomena.filter((phenomenon) => believersOf(graph, phenomenon.id).length === 0);
}

/**
 * 딛고 선 자국이 이미 삭은 믿음들 — **위반이 아니라 사실이다.**
 *
 * 자국은 사라졌는데 믿음은 남는다. 사라진 창고가 기억에 남는 것과 같은 자리이고(P3-b `stale`),
 * 이것이 없으면 세계가 바뀔 때마다 모두의 머릿속이 함께 고쳐지는 세계가 된다.
 */
export function staleBeliefs(
  graph: BeliefGraph,
  field: PhenomenonField,
  tick: Tick,
): readonly Belief[] {
  const standing = new Set(standingAt(field, tick).map((phenomenon) => phenomenon.id));
  return graph.beliefs.filter((belief) => !standing.has(belief.aboutId));
}

/** 믿음 하나를 실제와 대조한 결과 — **감사만 본다**. */
export interface BeliefCheck {
  readonly beliefId: Id;
  readonly subjectId: Id;
  readonly label: string;
  readonly phenomenonId: Id;
  /** 실제로 무슨 원자였는가 (세계의 장부) */
  readonly actual: ActionAtom;
  readonly suspected: readonly ActionAtom[];
  /** exact = 정확히 짚었다 · narrowed = 틀리진 않았으나 좁히지 못했다 · wrong = 빗나갔다 */
  readonly verdict: 'exact' | 'narrowed' | 'wrong';
  readonly confidence: number;
  readonly note: string;
}

/**
 * 믿음을 실제와 대조한다 — **검사대에 세우는 것이지 주체가 아는 것이 아니다.**
 *
 * 빗나간 믿음(`wrong`)은 여기서 세어질 뿐 아무것도 막지 않는다. 막는 것은 후보가 실제를 아예
 * 덮지 못하는 자리뿐이고(`candidate-miss`), 그것은 짐작하는 자의 잘못이 아니라 후보 계산의 잘못이다.
 */
export function compareToTruth(
  graph: BeliefGraph,
  phenomena: readonly WorldPhenomenon[],
  labels: ReadonlyMap<Id, string> = new Map(),
): readonly BeliefCheck[] {
  const checks: BeliefCheck[] = [];
  for (const belief of graph.beliefs) {
    const truth = phenomena.find((phenomenon) => phenomenon.id === belief.aboutId);
    if (truth === undefined) continue;
    const inside = belief.suspected.includes(truth.atom);
    const verdict = !inside ? 'wrong' : belief.suspected.length === 1 ? 'exact' : 'narrowed';
    checks.push({
      beliefId: belief.id,
      subjectId: belief.holderId,
      label: labels.get(belief.holderId) ?? belief.holderId,
      phenomenonId: belief.aboutId,
      actual: truth.atom,
      suspected: belief.suspected,
      verdict,
      confidence: belief.confidence,
      note:
        verdict === 'exact'
          ? `${atomLabel(truth.atom)} 를 정확히 짚었다 — ${channelLabel(truth.channel)} 가 그것 하나를 가리켰다`
          : verdict === 'narrowed'
            ? `${atomLabel(truth.atom)} 가 짐작 ${String(belief.suspected.length)} 안에 있다 — 틀리지는 않았으나 무엇인지는 모른다`
            : `${atomLabel(truth.atom)} 였는데 짐작 ${String(belief.suspected.length)} 어디에도 없다 — 낼 손이 없는 일은 떠오르지도 않는다`,
    });
  }
  return checks;
}

/** 믿음 그래프 감사 결과. */
export interface BeliefAudit {
  readonly recorded: number;
  /** 무언가를 믿는 주체 수 */
  readonly believing: number;
  /** 아무것도 믿지 않는 주체 (사실) */
  readonly empty: readonly string[];
  /** 아무도 아무것도 믿지 않는 흔적 수 (사실) */
  readonly unbelieved: number;
  /** 딛고 선 자국이 이미 삭은 믿음 수 (사실) */
  readonly stale: number;
  /** 정확히 짚은 믿음 (사실) */
  readonly exact: number;
  /** 틀리진 않았으나 좁히지 못한 믿음 (사실) */
  readonly narrowed: number;
  /** 빗나간 믿음 — **위반이 아니다** */
  readonly wrong: number;
  readonly violations: readonly BeliefViolation[];
  readonly complete: boolean;
}

/**
 * 믿음 그래프를 감사한다 — 근거가 제 지각인가, 짚은 것이 후보 안인가, 확신이 요소와 맞는가.
 * 던지지 않는다. R3-c `auditPercepts` 의 짝이다.
 */
export function auditBeliefs(
  graph: BeliefGraph,
  perceptField: PerceptField,
  phenomenonField: PhenomenonField,
  believers: readonly Believer[],
  tick: Tick,
): BeliefAudit {
  const violations: BeliefViolation[] = [];
  const standing = standingAt(phenomenonField, tick);
  const known = new Set(believers.map((believer) => believer.subjectId));

  for (const [index, belief] of graph.beliefs.entries()) {
    const at = `$.beliefs[${String(index)}]`;
    checkBelief(belief, perceptField.percepts, violations, at);
    if (!known.has(belief.holderId)) {
      violateBelief(
        violations,
        belief.holderId,
        'unheld-belief',
        `${at}.holderId`,
        '세계에 서 있지 않은 자의 믿음이 그래프에 담겼다 — 믿음은 언제나 누군가의 것이다',
      );
    }
  }

  // 후보가 실제를 덮는가 — 짐작하는 자의 잘못이 아니라 후보 계산의 잘못을 잡는다.
  for (const [index, phenomenon] of standing.entries()) {
    checkCandidateCoverage(phenomenon, violations, `$.standing[${String(index)}]`);
  }

  const labels = new Map(believers.map((believer) => [believer.subjectId, believer.label]));
  const checks = compareToTruth(graph, phenomenonField.phenomena, labels);
  const empty = believers
    .filter((believer) => beliefsFor(graph, believer.subjectId).length === 0)
    .map((believer) => believer.label);

  return {
    recorded: graph.beliefs.length,
    believing: believers.length - empty.length,
    empty: stableSort(empty, compareStrings),
    unbelieved: unbelieved(graph, standing).length,
    stale: staleBeliefs(graph, phenomenonField, tick).length,
    exact: checks.filter((check) => check.verdict === 'exact').length,
    narrowed: checks.filter((check) => check.verdict === 'narrowed').length,
    wrong: checks.filter((check) => check.verdict === 'wrong').length,
    violations,
    complete: violations.length === 0,
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function beliefGraphVerdict(audit: BeliefAudit): string {
  if (!audit.complete) {
    return `믿음 그래프가 어긋났다 — ${[...new Set(audit.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  return `믿음 ${String(audit.recorded)} · 믿는 주체 ${String(audit.believing)} · 정확 ${String(audit.exact)} · 좁히지 못함 ${String(audit.narrowed)} · 빗나감 ${String(audit.wrong)} · 아무도 믿지 않는 흔적 ${String(audit.unbelieved)}`;
}

/**
 * 같은 자국을 놓고 누가 무엇으로 읽는가 — Lab 대조표의 재료.
 * 흔적마다 한 줄이고, 주체마다 그가 짚은 것과 확신이 선다.
 */
export interface ReadingRow {
  readonly phenomenonId: Id;
  readonly label: string;
  /** 주체 label → 믿으면 짚은 수와 확신, 안 믿으면 '(읽지 못했다)' */
  readonly byBeliever: Readonly<Record<string, string>>;
  /** 실제로 무엇이었는가 — **감사의 열이다** */
  readonly actual: string;
  readonly believedBy: number;
}

export function readingTable(
  graph: BeliefGraph,
  phenomena: readonly WorldPhenomenon[],
  believers: readonly Believer[],
): readonly ReadingRow[] {
  return phenomena.map((phenomenon) => {
    const byBeliever: Record<string, string> = {};
    let believedBy = 0;
    for (const believer of believers) {
      const mine = beliefsFor(graph, believer.subjectId).find(
        (belief) => belief.aboutId === phenomenon.id,
      );
      if (mine === undefined) {
        byBeliever[believer.label] = '(읽지 못했다)';
        continue;
      }
      believedBy += 1;
      byBeliever[believer.label] =
        mine.suspected.length === 1
          ? `${atomLabel(mine.suspected[0] as ActionAtom)} · 확신 ${mine.confidence.toFixed(2)}`
          : `${String(mine.suspected.length)} 중 하나 · 확신 ${mine.confidence.toFixed(2)}${mine.suspected.includes(phenomenon.atom) ? '' : ' ✘'}`;
    }
    return {
      phenomenonId: phenomenon.id,
      label: `${channelLabel(phenomenon.channel)} 세기 ${phenomenon.intensity.toFixed(2)}`,
      byBeliever,
      actual: atomLabel(phenomenon.atom),
      believedBy,
    };
  });
}
