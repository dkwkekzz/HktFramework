// D5-b 겹침과 다툼 — 같은 것을 원하는 둘이 언제 부딪히는가.
//
// D5-a 가 요구들을 한 평면에 늘어놓았다. 이제 겹치는 것을 찾는다. 그런데 이 계층에서 가장
// 중요한 문장은 겹침을 찾는 규칙이 아니라 그 다음 줄이다.
//
//   **겹친다고 다툼은 아니다.**
//
// 넷이 같은 짝의 몸에 기대는 것은 겹침이지만 다툼이 아니다 — 짝이 성하면 넷 다 만족한다.
// 이것을 다툼으로 세면 세계는 모든 겹침이 싸움인 곳이 되고, 다툼이 흔해지면 아무 뜻도 없어진다.
// 그래서 겹침(`Contest`)과 다툼(`DependencyConflict`)을 두 단계로 나눈다.
//
// **겹침은 두 축에서 난다.**
//   자리 축 — `domain.holder.path` 가 같다. 문자 그대로 **한 값을 둘이 본다**.
//   대상 축 — 자리는 각자의 것인데 가리키는 대상이 하나다. 넷의 창고는 각자의 것이지만
//             말린 고기는 세계에 그만큼뿐이다.
//
// **다툼이 되는 조건은 둘이다.**
//   `opposed`  — 같은 자리에 **동시에 만족될 수 없는 대역** 둘. 한 몸이 두 곳에 있을 수 없고
//                (D2 가 D5 에 넘긴 자리), 치료사가 원하는 것과 그 몸의 주인이 원하는 것이
//                반대일 때도 여기다 (ModulePlan D5 예시).
//   `scarcity` — 같은 대상에 걸린 요구들의 **최소 필요 합이 세계에 있는 것보다 크다**.
//                이 조건만 세계를 본다 — 나머지는 그래프끼리의 일이다.
//
// **셋째 조건(배타적 점유)은 유예한다.** "이 대상은 한 번에 한 요구만 받는다"(한 짝이 넷의 등을
// 동시에 맡을 수는 없다)를 판정하려면 세계에 수용량을 적을 자리가 있어야 하는데 O2 에 없다.
// 여기서 지어내면 D5 가 정하는 것이 늘어나므로, 자리를 여는 W 계층이 갚도록 선언으로 남긴다
// (P5-b 가 접근 권한을 W2 로, R1-a 가 자연 발생 사건을 유예한 것과 같은 자리다).
//
// 그리고 하나 더 못박는다: **D5 는 이기는 자를 정하지 않는다.** 다툼이 났다는 것과 각자가
// 얼마나 급한지까지다 — 급함조차 D4 가 잰 값을 읽어 올 뿐이고(두 곳에서 재면 두 값이 갈린다),
// 누가 이기는지는 E0 가 상황으로 묶고 E3 가 확정한다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { StateValue } from '../o1/being.ts';
import { bandHolds, describeBand, type Band } from '../s0/index.ts';
import type { DependencyGraph } from '../d1/index.ts';
import { valueAt, type PressureReport, type WorldSnapshot } from '../d4/index.ts';
import {
  slotKeyOf,
  targetKeyOf,
  type DependencyClaim,
} from './claim.ts';
import { violateConflict, type ConflictViolation } from './violation.ts';

/** 겹침 하나 — 같은 것을 보는 요구 둘 이상. **아직 다툼이 아니다.** */
export interface Contest {
  readonly id: Id;
  /** 무엇이 같은가 — 자리인가 대상인가 */
  readonly axis: 'slot' | 'target';
  readonly key: string;
  readonly label: string;
  readonly claims: readonly DependencyClaim[];
  readonly subjectIds: readonly Id[];
  /** 한 주체 안의 겹침인가, 여럿 사이의 겹침인가 */
  readonly scope: 'internal' | 'between';
}

/** 다툼이 된 까닭. */
export type ConflictReason = 'opposed' | 'scarcity';

/** 다툼의 한쪽 — 누가, 무엇을 요구하며, 얼마나 급한가. */
export interface ConflictSide {
  readonly claimId: Id;
  readonly subjectId: Id;
  readonly nodeId: Id;
  readonly label: string;
  readonly band: Band;
  readonly substitutability: number;
  /** 얼마나 급한가 — **D4 가 잰 값**이다. D5 는 다시 재지 않는다 */
  readonly pressure: number;
}

/** 다툼 하나. */
export interface DependencyConflict {
  readonly id: Id;
  readonly contestId: Id;
  readonly axis: Contest['axis'];
  readonly key: string;
  readonly label: string;
  readonly scope: Contest['scope'];
  readonly reason: ConflictReason;
  readonly sides: readonly ConflictSide[];
  /** 얼마나 급한 다툼인가 — 양쪽 압력의 최대값 (D4 에서 읽어 온다) */
  readonly severity: number;
  /** 왜 다툼인가 — 손으로 적지 않고 판정에서 세운다 */
  readonly note: string;
}

/** 두 대역이 **동시에** 만족될 수 있는가. */
export function bandsCompatible(left: Band, right: Band): boolean {
  if (left.kind === 'is' && right.kind === 'is') return left.value === right.value;
  if (left.kind === 'is') return bandHolds(right, left.value);
  if (right.kind === 'is') return bandHolds(left, right.value);
  return left.min <= right.max && right.min <= left.max;
}

/** 겹침의 id — 축과 이름에서 나온다 (V1 결정적 ID). */
export function contestIdOf(axis: Contest['axis'], key: string): Id {
  return deterministicId('contest', axis, key);
}

function scopeOf(subjectIds: readonly Id[]): Contest['scope'] {
  return subjectIds.length === 1 ? 'internal' : 'between';
}

function groupBy(
  claims: readonly DependencyClaim[],
  keyOf: (claim: DependencyClaim) => string | null,
): ReadonlyMap<string, readonly DependencyClaim[]> {
  const groups = new Map<string, DependencyClaim[]>();
  for (const claim of claims) {
    const key = keyOf(claim);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), claim]);
  }
  return groups;
}

/**
 * 겹치는 요구들을 찾는다 — 자리 축이 먼저다.
 *
 * 대상 축의 겹침이 **어느 자리 축 겹침 안에 통째로 들어가면 남기지 않는다** — 자리 축이 더 좁고
 * 더 강한 겹침이기 때문이다(문자 그대로 한 값을 둘이 본다). 사냥꾼 둘이 벌레의 몸을 가리키는
 * 것은 대상 축으로도 겹치지만, 그 둘은 이미 "벌레의 몸이라는 한 자리" 겹침 안에 벌레 자신과
 * 함께 서 있다. 그러지 않으면 같은 다툼이 두 번 세어진다.
 */
export function contestsOf(claims: readonly DependencyClaim[]): readonly Contest[] {
  const contests: Contest[] = [];

  const slotGroups: (readonly string[])[] = [];

  for (const [key, group] of groupBy(claims, slotKeyOf)) {
    if (group.length < 2) continue;
    const subjectIds = [...new Set(group.map((claim) => claim.subjectId))];
    contests.push({
      id: contestIdOf('slot', key),
      axis: 'slot',
      key,
      label: `${group[0]?.slot.domain ?? ''}.${group[0]?.slot.path ?? ''} (한 값을 ${String(group.length)} 이 본다)`,
      claims: group,
      subjectIds,
      scope: scopeOf(subjectIds),
    });
    slotGroups.push(group.map((claim) => claim.id));
  }

  for (const [key, group] of groupBy(claims, targetKeyOf)) {
    if (group.length < 2) continue;
    const ids = group.map((claim) => claim.id);
    const swallowed = slotGroups.some((slotGroup) => ids.every((id) => slotGroup.includes(id)));
    if (swallowed) continue;
    const subjectIds = [...new Set(group.map((claim) => claim.subjectId))];
    contests.push({
      id: contestIdOf('target', key),
      axis: 'target',
      key,
      label: `${group[0]?.targetName ?? key} (하나를 ${String(group.length)} 이 가리킨다)`,
      claims: group,
      subjectIds,
      scope: scopeOf(subjectIds),
    });
  }

  return stableSort(contests, (left, right) =>
    compareStrings(`${left.axis}/${left.key}`, `${right.axis}/${right.key}`),
  );
}

/**
 * 그 요구가 얼마나 급한가 — **D4 보고에서 읽어 온다**(보고가 없으면 0 이다. D5 는 재지 않는다).
 *
 * 어느 값을 읽는지가 중요하다. "이 자리가 채워지는 것이 얼마나 급한가" 는 **그 자리에 기대는
 * 간선**의 압력이다(D4 `EdgePressure` 는 `edge.to` 가 비어 있는 정도로 잰다) — 그 노드 자신의
 * `NodePressure` 는 반대쪽, 즉 그 노드가 무엇에 기대는지를 말한다. 대체 가능성과 같은 방향이다.
 *
 * 뿌리에는 기대는 간선이 없으므로 제 압력을 쓴다 — 뿌리의 급함은 그것을 채우려는 기댐들의 급함이다.
 */
export function pressureOf(
  claim: DependencyClaim,
  reports: readonly PressureReport[],
  graphs: readonly DependencyGraph[] = [],
): number {
  const report = reports.find((entry) => entry.subjectId === claim.subjectId);
  if (report === undefined) return 0;
  const graph = graphs.find((entry) => entry.id === claim.graphId);
  const dependentIds = (graph?.edges ?? [])
    .filter((edge) => edge.to === claim.nodeId)
    .map((edge) => edge.id);
  const dependents = report.edges.filter((entry) => dependentIds.includes(entry.edgeId));
  if (dependents.length > 0) return Math.max(...dependents.map((entry) => entry.pressure));
  return report.nodes.find((node) => node.nodeId === claim.nodeId)?.pressure ?? 0;
}

function sideOf(
  claim: DependencyClaim,
  reports: readonly PressureReport[],
  graphs: readonly DependencyGraph[] = [],
): ConflictSide {
  return {
    claimId: claim.id,
    subjectId: claim.subjectId,
    nodeId: claim.nodeId,
    label: claim.label,
    band: claim.band,
    substitutability: claim.substitutability,
    pressure: pressureOf(claim, reports, graphs),
  };
}

/** 다툼의 급함 — **양쪽 압력의 최대값**. D5 가 재는 것이 아니라 D4 에서 읽는 것이다. */
export function severityOf(sides: readonly ConflictSide[]): number {
  if (sides.length === 0) return 0;
  return Math.max(...sides.map((side) => side.pressure));
}

/** 요구 하나가 최소로 필요로 하는 양 — 수치 대역만 답을 갖는다. */
export function demandOf(claim: DependencyClaim): number | null {
  return claim.band.kind === 'range' ? claim.band.min : null;
}

/** 그 겹침에 걸린 요구들이 세계에서 끌어 쓰는 총량 — 지닌 자마다 한 번씩만 센다. */
export function supplyOf(
  contest: Contest,
  snapshot: WorldSnapshot,
): number | null {
  const holders = [...new Set(contest.claims.map((claim) => claim.holderId))];
  let total = 0;
  for (const holderId of holders) {
    const claim = contest.claims.find((entry) => entry.holderId === holderId) as DependencyClaim;
    const value: StateValue | null = valueAt(
      snapshot,
      claim.slot.domain,
      holderId,
      claim.slot.path,
    );
    if (typeof value !== 'number') return null;
    total += value;
  }
  return total;
}

export interface JudgeOptions {
  readonly reports?: readonly PressureReport[];
  readonly world?: WorldSnapshot | null;
  /** 압력을 어느 간선에서 읽을지 알려면 그래프가 있어야 한다 (`detectConflicts` 가 넣어 준다) */
  readonly graphs?: readonly DependencyGraph[];
}

/** 다툼이 되지 못한 겹침 — **사유가 함께 남는다**(빠뜨림이 아니라 결과다). */
export interface Peace {
  readonly contestId: Id;
  readonly label: string;
  readonly reason: string;
}

/** 겹침 하나를 판정한 결과. */
export interface Judgement {
  readonly conflict: DependencyConflict | null;
  readonly peace: Peace | null;
}

/**
 * 겹침 하나가 다툼인가.
 *
 * 순서: 자리 축이면 대역이 부딪히는가(`opposed`) → 대상 축이면 모자라는가(`scarcity`) →
 * 둘 다 아니면 **다툼이 아니다**(사유와 함께 남는다).
 */
export function judge(contest: Contest, options: JudgeOptions = {}): Judgement {
  const reports = options.reports ?? [];
  const sides = contest.claims.map((claim) => sideOf(claim, reports, options.graphs ?? []));
  const build = (reason: ConflictReason, note: string): Judgement => ({
    conflict: {
      id: deterministicId('conflict', contest.id, reason),
      contestId: contest.id,
      axis: contest.axis,
      key: contest.key,
      label: contest.label,
      scope: contest.scope,
      reason,
      sides,
      severity: severityOf(sides),
      note,
    },
    peace: null,
  });
  const peace = (reason: string): Judgement => ({
    conflict: null,
    peace: { contestId: contest.id, label: contest.label, reason },
  });

  if (contest.axis === 'slot') {
    for (const [index, left] of contest.claims.entries()) {
      for (const right of contest.claims.slice(index + 1)) {
        if (bandsCompatible(left.band, right.band)) continue;
        return build(
          'opposed',
          `${left.label}(${describeBand(left.band)})와 ${right.label}(${describeBand(right.band)})가 같은 자리에 서로 다른 것을 요구한다 — 한 값이 두 곳에 동시에 있을 수는 없다`,
        );
      }
    }
    return peace(
      `${String(contest.claims.length)} 이 같은 자리를 보지만 대역이 함께 설 수 있다 — 겹친다고 다툼은 아니다`,
    );
  }

  const demands = contest.claims.map((claim) => demandOf(claim));
  if (demands.some((demand) => demand === null)) {
    return peace(
      '수치로 재지 않는 대역이 섞여 있어 모자람을 잴 수 없다 — 배타적 점유는 세계에 수용량을 적을 자리가 서야 판정된다 (W 계층으로 유예)',
    );
  }
  const world = options.world ?? null;
  if (world === null) {
    return peace('세계를 보지 않고는 모자람을 알 수 없다 — 모자람만이 세계를 묻는 조건이다');
  }
  const supply = supplyOf(contest, world);
  if (supply === null) {
    return peace('세계가 그 자리를 수로 적어 두지 않았다 — 모자람을 잴 수 없다');
  }
  const demand = demands.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (supply >= demand) {
    return peace(
      `${String(contest.claims.length)} 이 같은 것을 가리키지만 세계에 ${String(supply)} 이 있고 필요한 것은 ${String(demand)} 이다 — 모자라지 않으면 다툼이 아니다`,
    );
  }
  return build(
    'scarcity',
    `${String(contest.claims.length)} 이 같은 것을 가리키는데 세계에 ${String(supply)} 뿐이고 필요한 것은 ${String(demand)} 이다 — 모자라는 만큼이 다툼이다`,
  );
}

/** 겹침들을 한꺼번에 판정한다. */
export function judgeAll(
  contests: readonly Contest[],
  options: JudgeOptions = {},
): { readonly conflicts: readonly DependencyConflict[]; readonly peaces: readonly Peace[] } {
  const conflicts: DependencyConflict[] = [];
  const peaces: Peace[] = [];
  for (const contest of contests) {
    const judgement = judge(contest, options);
    if (judgement.conflict !== null) conflicts.push(judgement.conflict);
    if (judgement.peace !== null) peaces.push(judgement.peace);
  }
  return {
    conflicts: stableSort(conflicts, (left, right) =>
      compareStrings(`${left.axis}/${left.key}`, `${right.axis}/${right.key}`),
    ),
    peaces,
  };
}

/**
 * 다툼 하나가 온전한가 — 둘 이상인가, 겹치기는 하는가, 까닭을 대는가, 급함이 D4 와 같은가.
 * 던지지 않는다. **이기는 자를 적으면 걸린다.**
 */
export function checkConflict(
  conflict: DependencyConflict,
  claims: readonly DependencyClaim[],
  options: JudgeOptions = {},
  out: ConflictViolation[] = [],
  path = '$.conflict',
): readonly ConflictViolation[] {
  const subject = conflict.sides[0]?.subjectId ?? '';

  if (conflict.sides.length < 2) {
    violateConflict(
      out,
      subject,
      'lonely-conflict',
      `${path}.sides`,
      '한쪽뿐인 다툼이다 — 다투려면 둘이 있어야 한다',
    );
    return out;
  }

  const mine = conflict.sides.map(
    (side) => claims.find((claim) => claim.id === side.claimId) ?? null,
  );
  if (mine.some((claim) => claim === null)) {
    violateConflict(
      out,
      subject,
      'phantom-claim',
      `${path}.sides`,
      '요구 목록에 없는 요구가 다툼의 한쪽으로 섰다',
    );
    return out;
  }

  const keys = (mine as DependencyClaim[]).map((claim) =>
    conflict.axis === 'slot' ? slotKeyOf(claim) : targetKeyOf(claim),
  );
  if (new Set(keys).size !== 1 || keys[0] !== conflict.key) {
    violateConflict(
      out,
      subject,
      'unrelated-conflict',
      `${path}.key`,
      `${conflict.axis === 'slot' ? '같은 자리' : '같은 대상'}를 보지 않는 요구들을 다툼이라 적었다 — 겹치지 않으면 부딪힐 수 없다`,
    );
  }

  if (conflict.reason === 'opposed') {
    const opposed = (mine as DependencyClaim[]).some((left, index) =>
      (mine as DependencyClaim[])
        .slice(index + 1)
        .some((right) => !bandsCompatible(left.band, right.band)),
    );
    if (!opposed) {
      violateConflict(
        out,
        subject,
        'reasonless-conflict',
        `${path}.reason`,
        '양립 불가라고 적었으나 대역이 함께 설 수 있다 — 겹친다고 다툼은 아니다',
      );
    }
  } else if (options.world == null) {
    violateConflict(
      out,
      subject,
      'scarcity-without-world',
      `${path}.reason`,
      '모자람을 주장하면서 세계를 보지 않았다 — 모자람만이 세계를 묻는 조건이다',
    );
  }

  const recomputed = severityOf(
    (mine as DependencyClaim[]).map((claim) =>
      sideOf(claim, options.reports ?? [], options.graphs ?? []),
    ),
  );
  if (Math.abs(recomputed - conflict.severity) > 1e-9) {
    violateConflict(
      out,
      subject,
      'severity-drift',
      `${path}.severity`,
      `급함 ${conflict.severity.toFixed(3)} 이 D4 압력에서 다시 센 ${recomputed.toFixed(3)} 과 다르다 — D5 는 급함을 다시 재지 않는다`,
    );
  }

  if ('winnerId' in (conflict as unknown as Record<string, unknown>)) {
    violateConflict(
      out,
      subject,
      'winner-declared',
      `${path}.winnerId`,
      '이기는 자를 적었다 — D5 는 다툼이 났다는 것까지이고, 상황으로 묶는 것은 E0, 확정하는 것은 E3 다',
    );
  }

  return out;
}

/** 다툼 하나를 사람이 읽는 한 줄로. */
export function conflictLine(conflict: DependencyConflict): string {
  const who = conflict.scope === 'internal' ? '한 주체 안' : `${String(conflict.sides.length)} 사이`;
  return `[${conflict.reason}] ${conflict.label} — ${who} · 급함 ${conflict.severity.toFixed(2)} · ${conflict.note}`;
}
