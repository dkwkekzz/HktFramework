// E0-c 상황장과 감사 — 상황들을 담고, 위반과 사실을 가른다.
//
// R2-c 현상장 · R3-c 지각장 · R4-c 믿음 그래프 · D5-c 충돌장 · R5-c 기억장 · R6-c 의도장과
// **같은 모양**이다: 담기만 하고 지우지 않으며, 감사가 **위반**과 **사실**을 가른다.
//
//   위반 — 참여자 하나뿐인 상황, 걸림 없이 세운 상황, 자기 자신과의 쌍, 걸린 적 없는 참여자,
//          앎을 손으로 바꿔 적은 쌍, **조건을 갖췄는데 상황장에 없는 자리**(`missing-situation` —
//          이것이 "상황을 빠뜨리지 않는다" 를 주장이 아니라 검사로 만든다. D5-c `missing-contest`
//          와 같은 자리다), 그리고 **결과를 적은 상황**(`outcome-declared`).
//   사실 — **상황이 되지 못한 자리**(`Solitude`)와 **아무 상황에도 끼지 않은 주체**(`calm`),
//          그리고 **서로를 알아보지 못한 상황**. 이것이 이 계층의 절반이다. 세계의 대부분은
//          상황이 아니고, 상황이 서도 대부분은 서로를 알아보지 못한다.
//
// D5 가 세운 못을 그대로 진다: **E0 는 이기는 자를 정하지 않는다.** 상황에 `winnerId` 나
// `outcome` 을 적으면 걸린다 — 그것은 E3 의 몫이다. D5-b 가 `winner-declared` 로 자기 자신에게
// 건 것과 같은 검사이고, 같은 이유다. 여기서 결과를 적기 시작하면 상황이 곧 판정이 되고,
// "정보 상태만 바꿔 승패가 뒤집히는" E3 의 자리가 사라진다.
//
// 그리고 여기서 **주체↔주체 그래프**가 선다 (MODULES.md E0 시각화). D5 는 이분 그래프였다 —
// 한쪽에 주체, 다른 쪽에 그들이 함께 보는 것, 선은 언제나 주체에서 대상으로만. E0 의 그래프는
// **주체에서 주체로 간다.** 그것이 이 계층이 새로 그은 선이고, 선의 굵기는 급함이며 선의
// 종류는 겨눔 셋(서로·한쪽·눈멂)이다.

import type { Id } from '../v1/id.ts';
import { compareNumbers, compareStrings, stableSort } from '../v1/stable-sort.ts';
import {
  aimLabel,
  clusterStakes,
  type ClusterSpec,
  type Situation,
  type SituationPair,
  type Solitude,
} from './cluster.ts';
import {
  stakeAxisLabel,
  stakeKeyOf,
  stakesFrom,
  type SituationStake,
  type StakeSpec,
} from './stake.ts';
import { violateSituation, type SituationViolation } from './violation.ts';

/** 세계에 선 상황들. */
export interface SituationField {
  readonly situations: readonly Situation[];
  /** 상황이 되지 못한 자리 — 위반이 아니라 사실이다 */
  readonly solitudes: readonly Solitude[];
  /** 주체 id → 그가 낀 상황들 */
  readonly bySubject: ReadonlyMap<Id, readonly Situation[]>;
  /** 자리의 이름 → 상황 */
  readonly byKey: ReadonlyMap<string, Situation>;
}

/** 빈 상황장. */
export function openSituationField(): SituationField {
  return { situations: [], solitudes: [], bySubject: new Map(), byKey: new Map() };
}

function indexOf(
  situations: readonly Situation[],
  solitudes: readonly Solitude[],
): SituationField {
  const bySubject = new Map<Id, Situation[]>();
  const byKey = new Map<string, Situation>();
  for (const situation of situations) {
    byKey.set(stakeKeyOf(situation), situation);
    for (const subjectId of situation.participants) {
      bySubject.set(subjectId, [...(bySubject.get(subjectId) ?? []), situation]);
    }
  }
  return { situations, solitudes, bySubject, byKey };
}

/** 묶음의 결과를 상황장에 담는다 — 담기만 하고 지우지 않는다. */
export function fillSituationField(result: {
  readonly situations: readonly Situation[];
  readonly solitudes: readonly Solitude[];
}): SituationField {
  return indexOf(result.situations, result.solitudes);
}

/** 상황 탐지 한 바퀴 — 걸림을 펴고, 묶고, 담는다. */
export interface DetectSituationResult {
  readonly stakes: readonly SituationStake[];
  readonly field: SituationField;
}

/**
 * 여럿의 의도·목적·다툼을 한 세계에 겹쳐 놓고 상황을 찾는다.
 *
 * 세 걸음이 전부다: 걸림을 편다(E0-a) → 둘 이상 걸린 자리를 묶는다(E0-b) → 담는다(E0-c).
 * 새로 정하는 것은 없고, 순서만 있다 — D5 `detectConflicts` 와 같은 모양이다.
 */
export function detectSituations(spec: StakeSpec & Omit<ClusterSpec, 'stakes'>): DetectSituationResult {
  const stakes = stakesFrom(spec);
  const clustered = clusterStakes({ ...spec, stakes });
  return { stakes, field: fillSituationField(clustered) };
}

/** 그 주체가 낀 상황들. */
export function situationsFor(field: SituationField, subjectId: Id): readonly Situation[] {
  return field.bySubject.get(subjectId) ?? [];
}

/** 아무 상황에도 끼지 않은 주체들 — **위반이 아니라 사실이다.** */
export function calm(field: SituationField, subjectIds: readonly Id[]): readonly Id[] {
  return subjectIds.filter((id) => situationsFor(field, id).length === 0);
}

/** 상황장 감사 결과. */
export interface SituationAudit {
  readonly situations: number;
  /** 상황이 되지 못한 자리 수 (사실) */
  readonly solitudes: number;
  readonly pairs: number;
  /** 서로를 알아본 쌍 (`mutual`) */
  readonly recognized: number;
  /** 한쪽만 겨눈 쌍 */
  readonly oneSided: number;
  /** 아무도 겨누지 않은 쌍 — D5 가 멈춘 자리 */
  readonly blind: number;
  /** 매복인 쌍 — 겨누는데 상대가 그를 모른다 */
  readonly ambushes: number;
  /** 아무 상황에도 끼지 않은 주체 수 (사실) */
  readonly calm: number;
  /** 축별 상황 수 */
  readonly byAxis: Readonly<Record<string, number>>;
  /** 가장 급한 상황의 급함 */
  readonly peak: number;
  readonly violations: readonly SituationViolation[];
  readonly complete: boolean;
}

export interface AuditSpec {
  readonly field: SituationField;
  /** 상황이 나온 걸림 전부 — 빠뜨린 상황을 잡는 재료다 */
  readonly stakes?: readonly SituationStake[];
  /** 세계에 서 있는 주체들 — 아무 상황에도 끼지 않은 자를 세는 재료다 */
  readonly subjectIds?: readonly Id[];
}

function checkPair(
  violations: SituationViolation[],
  situation: Situation,
  pair: SituationPair,
  index: number,
  path: string,
): void {
  if (pair.leftId === pair.rightId) {
    violateSituation(
      violations,
      pair.leftId,
      'self-pair',
      `${path}.pairs[${String(index)}]`,
      '자기 자신과의 쌍이다 — 혼자서는 알아볼 것이 없다',
    );
  }
  const participants = new Set(situation.participants);
  for (const id of [pair.leftId, pair.rightId]) {
    if (!participants.has(id)) {
      violateSituation(
        violations,
        id,
        'phantom-participant',
        `${path}.pairs[${String(index)}]`,
        '이 상황에 걸린 적 없는 자가 쌍에 있다',
      );
    }
  }
  // 매복은 한쪽 겨눔에서만 선다 — 서로 겨누는 둘은 둘 다 상대를 알기 때문이다(R6).
  if (pair.ambush && pair.aim !== 'one-sided') {
    violateSituation(
      violations,
      pair.leftId,
      'awareness-drift',
      `${path}.pairs[${String(index)}].ambush`,
      `${aimLabel(pair.aim)} 인데 매복이라 적혀 있다 — 매복은 한쪽만 겨눌 때만 선다`,
    );
  }
}

/**
 * 상황장을 감사한다 — **빠뜨린 상황이 여기서 잡힌다.**
 *
 * 걸림을 함께 주면 "둘 이상이 걸렸는데 상황장에 없는 자리" 를 세어 `missing-situation` 으로
 * 낸다. 이것이 D5-c `missing-contest` 와 같은 자리이고, 같은 이유다 — 빠뜨리지 않는다는 것은
 * 주장이 아니라 검사여야 한다.
 */
export function auditSituations(spec: AuditSpec): SituationAudit {
  const violations: SituationViolation[] = [];
  const { field } = spec;
  const stakes = spec.stakes ?? [];
  const subjectIds = spec.subjectIds ?? [];

  const byAxis: Record<string, number> = {};
  let pairs = 0;
  let recognized = 0;
  let oneSided = 0;
  let blind = 0;
  let ambushes = 0;
  let peak = 0;

  field.situations.forEach((situation, index) => {
    const path = `$.situations[${String(index)}]`;
    byAxis[situation.axis] = (byAxis[situation.axis] ?? 0) + 1;
    peak = Math.max(peak, situation.urgency);

    if (situation.participants.length < 2) {
      violateSituation(
        violations,
        situation.participants[0] ?? '',
        'solitary-situation',
        `${path}.participants`,
        '참여자가 하나뿐인 상황이다 — 혼자 걸린 자리는 상황이 아니다',
      );
    }
    if (situation.stakes.length === 0) {
      violateSituation(
        violations,
        '',
        'groundless-situation',
        `${path}.stakes`,
        '걸림 없이 세운 상황이다 — 무엇에 걸렸는지 대지 못한다',
      );
    }
    // **이기는 자를 적으면 걸린다.** D5-b 가 자기에게 건 검사를 E0 도 그대로 진다.
    const record = situation as unknown as Record<string, unknown>;
    for (const field_ of ['winnerId', 'outcome', 'resolution']) {
      if (field_ in record) {
        violateSituation(
          violations,
          '',
          'outcome-declared',
          `${path}.${field_}`,
          '상황에 결과를 적었다 — 상황이 섰다는 것까지가 E0 이고, 결과를 확정하는 것은 E3 다',
        );
      }
    }

    situation.pairs.forEach((pair, pairIndex) => {
      pairs += 1;
      if (pair.aim === 'mutual') recognized += 1;
      else if (pair.aim === 'one-sided') oneSided += 1;
      else blind += 1;
      if (pair.ambush) ambushes += 1;
      checkPair(violations, situation, pair, pairIndex, path);
    });
  });

  // 빠뜨린 상황 — 둘 이상이 걸린 자리인데 상황장에 없다.
  const subjectsByKey = new Map<string, Set<Id>>();
  for (const stake of stakes) {
    const key = stakeKeyOf(stake);
    const set = subjectsByKey.get(key) ?? new Set<Id>();
    set.add(stake.subjectId);
    subjectsByKey.set(key, set);
  }
  for (const [key, subjects] of stableSort(
    [...subjectsByKey.entries()],
    (left, right) => compareStrings(left[0], right[0]),
  )) {
    if (subjects.size < 2) continue;
    if (field.byKey.has(key)) continue;
    violateSituation(
      violations,
      '',
      'missing-situation',
      `$.byKey[${key}]`,
      `${String(subjects.size)} 이 함께 걸린 자리인데 상황장에 없다`,
    );
  }

  return {
    situations: field.situations.length,
    solitudes: field.solitudes.length,
    pairs,
    recognized,
    oneSided,
    blind,
    ambushes,
    calm: calm(field, subjectIds).length,
    byAxis,
    peak,
    violations,
    complete: violations.length === 0,
  };
}

/** 감사 한 줄 — 터미널·배지용. */
export function situationFieldVerdict(audit: SituationAudit): string {
  if (!audit.complete) {
    const rules = [...new Set(audit.violations.map((violation) => violation.rule))];
    return `상황장이 어긋났다 — ${rules.join(', ')}`;
  }
  return `상황 ${String(audit.situations)} · 쌍 ${String(audit.pairs)} (알아봄 ${String(audit.recognized)} · 한쪽 ${String(audit.oneSided)} · 눈멂 ${String(audit.blind)} · 매복 ${String(audit.ambushes)}) · 혼자 걸린 자리 ${String(audit.solitudes)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 주체↔주체 그래프 — D5 이분 그래프가 긋지 않은 선
// ─────────────────────────────────────────────────────────────────────────────

/** 그래프의 노드 하나 — **전부 주체다.** 대상은 노드가 아니라 간선의 이름이 된다. */
export interface SituationNode {
  readonly id: Id;
  readonly label: string;
  /** 이 주체가 낀 상황 수 */
  readonly situations: number;
  /** 이 주체가 겨눈 수 */
  readonly aiming: number;
  /** 이 주체를 겨눈 수 */
  readonly aimedAt: number;
}

/** 간선 하나 — 주체에서 주체로 간다. */
export interface SituationEdge {
  readonly situationId: Id;
  readonly leftId: Id;
  readonly rightId: Id;
  readonly aim: SituationPair['aim'];
  /** 겨눈 자들 — **화살의 방향이다.** 한쪽만 겨누면 하나, 서로 겨누면 둘, 눈멂이면 빈 배열 */
  readonly aimerIds: readonly Id[];
  readonly ambush: boolean;
  /** 굵기 — 그 상황의 급함이다 */
  readonly weight: number;
  readonly label: string;
}

/** 상황 클러스터 맵의 재료 (MODULES.md E0 시각화). */
export interface SituationGraph {
  readonly nodes: readonly SituationNode[];
  readonly edges: readonly SituationEdge[];
}

/**
 * 상황장을 주체↔주체 그래프로 편다.
 *
 * **D5 와 다른 점이 여기서 눈에 보인다.** D5 `bipartiteOf` 는 한쪽에 주체를, 다른 쪽에 대상을
 * 놓고 선을 주체→대상으로만 그었다. 여기서는 노드가 전부 주체이고 선이 주체↔주체로 간다 —
 * 그 선을 그을 수 있게 된 것이 이 계층의 산출이다.
 */
export function situationGraphOf(field: SituationField): SituationGraph {
  const nodes = new Map<Id, { situations: number; aiming: number; aimedAt: number }>();
  const edges: SituationEdge[] = [];

  const bump = (id: Id): { situations: number; aiming: number; aimedAt: number } => {
    const entry = nodes.get(id) ?? { situations: 0, aiming: 0, aimedAt: 0 };
    nodes.set(id, entry);
    return entry;
  };

  for (const situation of field.situations) {
    for (const subjectId of situation.participants) bump(subjectId).situations += 1;
    for (const pair of situation.pairs) {
      for (const aimerId of pair.aimerIds) {
        bump(aimerId).aiming += 1;
        const otherId = aimerId === pair.leftId ? pair.rightId : pair.leftId;
        bump(otherId).aimedAt += 1;
      }
      edges.push({
        situationId: situation.id,
        leftId: pair.leftId,
        rightId: pair.rightId,
        aim: pair.aim,
        aimerIds: pair.aimerIds,
        ambush: pair.ambush,
        weight: situation.urgency,
        label: `${stakeAxisLabel(situation.axis)} ${situation.key} — ${aimLabel(pair.aim)}${pair.ambush ? ' · 매복' : ''}`,
      });
    }
  }

  return {
    nodes: stableSort(
      [...nodes.entries()].map(([id, counts]) => ({
        id,
        label: id,
        situations: counts.situations,
        aiming: counts.aiming,
        aimedAt: counts.aimedAt,
      })),
      (left, right) => {
        const aimedAt = compareNumbers(right.aimedAt, left.aimedAt);
        if (aimedAt !== 0) return aimedAt;
        return compareStrings(left.id, right.id);
      },
    ),
    edges: stableSort(edges, (left, right) => {
      const weight = compareNumbers(right.weight, left.weight);
      if (weight !== 0) return weight;
      const situation = compareStrings(left.situationId, right.situationId);
      if (situation !== 0) return situation;
      const leftId = compareStrings(left.leftId, right.leftId);
      if (leftId !== 0) return leftId;
      return compareStrings(left.rightId, right.rightId);
    }),
  };
}
