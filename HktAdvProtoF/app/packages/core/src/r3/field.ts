// R3-c 지각장과 감사 — 누가 무엇을 읽었고, 무엇을 아무도 읽지 못했는가.
//
// R2 는 흔적을 세계에 놓았고 R3-b 는 그것을 한 사람이 읽는 일을 판정했다. 그런데 세계에는
// 여럿이 산다 — 같은 흔적이 어떤 이에게는 닿고 어떤 이에게는 닿지 않으며, **아무에게도 닿지
// 않는 흔적도 있다.** 그 셋을 값으로 보이는 자리다.
//
// R2-c 현상장과 같은 모양이다: 담기만 하고 지우지 않고, 감사가 **위반**과 **사실**을 가른다.
//
//   위반 — 세계에 없는 흔적을 읽었다는 지각, 진실이 실린 지각, 원래보다 센 지각,
//          감지 프로필 없는 주체의 지각, 이미 삭은 흔적의 지각.
//   사실 — **아무도 보지 못한 흔적**(`unwitnessed`). 이것은 위반이 아니다. 세계는 아무도
//          안 볼 때도 바뀌고, 그 자국은 볼 사람이 오기를 기다리며 남아 있다가 삭는다.
//          R2 가 "흔적 없이 지나간 사건" 을 사실로 센 것과 정확히 같은 자리다.
//
// 여기서 R3 이 R4 에 넘기는 것이 정해진다: 주체마다 **자기가 읽은 것들**의 묶음. R4 는 그것을
// 재료로 믿음을 세우되, 그 재료에는 무엇이 일어났는지가 들어 있지 않다 (R3-b `truth-leak`).

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import type { WorldState } from '../o2/world.ts';
import { channelSpec } from '../s0/perception.ts';
import { standingAt, type PhenomenonField, type WorldPhenomenon } from '../r2/index.ts';
import {
  checkPercept,
  perceiveAll,
  perceptsOf,
  type Observer,
  type PerceiveOptions,
  type Percept,
  type PerceptionAttempt,
} from './percept.ts';
import { violatePercept, type PerceptViolation } from './violation.ts';

/** 주체별로 무엇을 읽었는가. */
export interface PerceptField {
  readonly percepts: readonly Percept[];
  /** 주체 id → 그가 읽은 것들 */
  readonly bySubject: ReadonlyMap<Id, readonly Percept[]>;
  /** 흔적 id → 그것을 읽은 주체들 */
  readonly byPhenomenon: ReadonlyMap<Id, readonly Id[]>;
}

/** 빈 지각장. */
export function openPerceptField(): PerceptField {
  return { percepts: [], bySubject: new Map(), byPhenomenon: new Map() };
}

/** 지각들을 더한 새 지각장. 같은 id 는 두 번 담기지 않는다. */
export function recordPercepts(
  field: PerceptField,
  percepts: readonly Percept[],
): PerceptField {
  const known = new Set(field.percepts.map((entry) => entry.id));
  const added = percepts.filter((entry) => !known.has(entry.id));
  if (added.length === 0) return field;

  const bySubject = new Map(field.bySubject);
  const byPhenomenon = new Map(field.byPhenomenon);
  for (const percept of added) {
    bySubject.set(percept.subjectId, [...(bySubject.get(percept.subjectId) ?? []), percept]);
    byPhenomenon.set(percept.phenomenonId, [
      ...(byPhenomenon.get(percept.phenomenonId) ?? []),
      percept.subjectId,
    ]);
  }
  return { percepts: [...field.percepts, ...added], bySubject, byPhenomenon };
}

/** 주체 하나가 그 틱에 세계를 둘러본 결과 — 읽은 것과 못 읽은 것이 함께 남는다. */
export interface Sweep {
  readonly observer: Observer;
  readonly attempts: readonly PerceptionAttempt[];
  readonly percepts: readonly Percept[];
}

/**
 * 그 틱에 **아직 서 있는 흔적들**을 여러 주체가 둘러본다.
 *
 * 이미 삭은 흔적은 애초에 보이지 않는다 — R2-c `standingAt` 이 그것을 이미 판정하므로 R3 이
 * 다시 정하지 않는다. 그래서 늦게 온 자는 남은 것만 보고, 사라지지 않는 자국은 언제 와도 본다.
 */
export function sweep(
  observers: readonly Observer[],
  field: PhenomenonField,
  world: WorldState,
  tick: Tick,
  options: PerceiveOptions = {},
): { readonly sweeps: readonly Sweep[]; readonly field: PerceptField } {
  const standing = standingAt(field, tick);
  const sweeps = observers.map((observer) => {
    const attempts = perceiveAll(observer, standing, world, options);
    return { observer, attempts, percepts: perceptsOf(attempts) };
  });
  const perceptField = sweeps.reduce(
    (acc, entry) => recordPercepts(acc, entry.percepts),
    openPerceptField(),
  );
  return { sweeps, field: perceptField };
}

/** 그 주체가 읽은 것들. */
export function perceptsFor(field: PerceptField, subjectId: Id): readonly Percept[] {
  return field.bySubject.get(subjectId) ?? [];
}

/** 그 흔적을 읽은 주체들. */
export function witnessesOf(field: PerceptField, phenomenonId: Id): readonly Id[] {
  return field.byPhenomenon.get(phenomenonId) ?? [];
}

/**
 * 아무도 읽지 못한 흔적들 — **위반이 아니라 사실이다.**
 *
 * 세계는 아무도 안 볼 때도 바뀐다. 그 자국은 거기 남아 볼 사람이 오기를 기다리다가 삭고,
 * 사라지지 않는 자국이라면 영영 기다린다. 이것이 막히면 세계에 목격자가 강제되고, 그러면
 * 아무도 몰래 무언가 할 수 없다.
 */
export function unwitnessed(
  field: PerceptField,
  phenomena: readonly WorldPhenomenon[],
): readonly WorldPhenomenon[] {
  return phenomena.filter((phenomenon) => witnessesOf(field, phenomenon.id).length === 0);
}

/** 지각장 감사 결과. */
export interface PerceptAudit {
  readonly recorded: number;
  /** 무언가를 읽은 주체 수 */
  readonly seeing: number;
  /** 아무것도 읽지 못한 주체 (사실) */
  readonly blind: readonly string[];
  /** 아무도 읽지 못한 흔적 수 (사실) */
  readonly unwitnessed: number;
  readonly violations: readonly PerceptViolation[];
  readonly complete: boolean;
}

/**
 * 지각장을 감사한다 — 읽은 것이 실재하는 흔적에서 왔는가, 그리고 진실이 새지 않았는가.
 * 던지지 않는다. R2-c `auditField` 의 짝이다.
 */
export function auditPercepts(
  perceptField: PerceptField,
  phenomenonField: PhenomenonField,
  observers: readonly Observer[],
  tick: Tick,
): PerceptAudit {
  const violations: PerceptViolation[] = [];
  const standing = standingAt(phenomenonField, tick);
  const profiled = new Set(
    observers
      .filter((observer) => observer.perception.channels.length > 0)
      .map((observer) => observer.subjectId),
  );

  for (const [index, percept] of perceptField.percepts.entries()) {
    const at = `$.percepts[${String(index)}]`;
    checkPercept(percept, phenomenonField.phenomena, violations, at);

    if (!profiled.has(percept.subjectId)) {
      violatePercept(
        violations,
        percept.subjectId,
        'unprofiled-subject',
        `${at}.subjectId`,
        '감지 프로필이 없는 주체가 무언가를 읽었다고 적혔다 — 통로 없는 주체에게 세계는 일어나지 않는다 (S0-b)',
      );
      continue;
    }

    if (!standing.some((phenomenon) => phenomenon.id === percept.phenomenonId)) {
      violatePercept(
        violations,
        percept.subjectId,
        'stale-percept',
        `${at}.phenomenonId`,
        `틱 ${String(tick)} 에는 서 있지 않은 흔적을 읽었다고 적혔다 — 아직 나지 않았거나 이미 삭은 자국이다 (R2-c)`,
      );
    }
  }

  const blind = observers
    .filter((observer) => perceptsFor(perceptField, observer.subjectId).length === 0)
    .map((observer) => observer.label);

  return {
    recorded: perceptField.percepts.length,
    seeing: observers.length - blind.length,
    blind: stableSort(blind, compareStrings),
    unwitnessed: unwitnessed(perceptField, standing).length,
    violations,
    complete: violations.length === 0,
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function perceptFieldVerdict(audit: PerceptAudit): string {
  if (!audit.complete) {
    return `지각장이 어긋났다 — ${[...new Set(audit.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  return `지각 ${String(audit.recorded)} · 무언가를 읽은 주체 ${String(audit.seeing)} · 아무것도 못 읽은 주체 ${String(audit.blind.length)} · 아무도 못 본 흔적 ${String(audit.unwitnessed)}`;
}

/**
 * 같은 흔적을 놓고 누가 보고 누가 못 보는가 — Lab diff 뷰의 재료.
 * 흔적마다 한 줄이고, 각 주체가 읽었는지와 못 읽었으면 왜인지가 함께 선다.
 */
export interface WitnessRow {
  readonly phenomenonId: Id;
  readonly label: string;
  /** 주체 label → 읽었으면 세기, 못 읽었으면 사유 */
  readonly byObserver: Readonly<Record<string, string>>;
  readonly seenBy: number;
}

export function witnessTable(sweeps: readonly Sweep[]): readonly WitnessRow[] {
  const first = sweeps[0];
  if (first === undefined) return [];

  return first.attempts.map((attempt, index) => {
    const byObserver: Record<string, string> = {};
    let seenBy = 0;
    for (const entry of sweeps) {
      const mine = entry.attempts[index];
      if (mine === undefined) continue;
      if (mine.percept !== null) {
        seenBy += 1;
        byObserver[entry.observer.label] = `${mine.percept.intensity.toFixed(2)}`;
      } else {
        byObserver[entry.observer.label] = MISS_LABELS[mine.miss ?? 'no-channel'] ?? '읽지 못했다';
      }
    }
    const phenomenon = attempt.phenomenon;
    return {
      phenomenonId: phenomenon.id,
      label: `${channelSpec(phenomenon.channel)?.label ?? phenomenon.channel} 세기 ${phenomenon.intensity.toFixed(2)}`,
      byObserver,
      seenBy,
    };
  });
}

const MISS_LABELS: Readonly<Record<string, string>> = {
  'no-channel': '통로 없음',
  'too-faint': '너무 옅다',
  'too-far': '너무 멀다',
};
