// E0-a 걸린 자리 — 의도·목적·다툼이 세계의 **무엇에** 걸리는가.
//
// 상황을 묶으려면 먼저 무엇에 걸렸는지를 한 모양으로 적어야 한다. 그 모양이 걸림
// (`SituationStake`)이다. D5-a 가 다툼을 찾기 전에 요구(`DependencyClaim`)를 한 평면에 늘어놓은
// 것과 같은 걸음이고, 같은 이유다 — **평면이 있어야 겹침이 보인다.**
//
// 여기서 새로 재는 값은 없다. 급함은 D5 가 잰 것(`severity`)과 P4 가 잰 것(`score`)을 그대로
// 옮기고, 두 곳에서 재면 두 값이 갈린다는 D5-a 의 태도를 그대로 진다(`urgency-drift`).
//
// E0-a 가 실제로 여는 것은 **축 하나**다.
//
//   자리(`slot`)    어느 영역·누구의·어느 경로 — D5 `slotKeyOf` 와 **같은 이름 형식**이다.
//                   같으면 문자 그대로 한 칸을 둘이 건드린다.
//   대상(`target`)  세계에 하나뿐인 것 — D5 `targetKeyOf` 그대로.
//   목적(`goal`)    같은 가능성 노드를 둘이 좇는다 (P4 `ActiveGoal.nodeId`).
//   **사람**(`subject`)  **여기가 새로 열리는 축이다.** D5 이분 그래프는 주체에서 대상으로만
//                   갔고 주체끼리는 잇지 않았다 — "누가 누구와 싸우는지는 서로를 봐야 알고,
//                   상황으로 묶는 것은 E0 다"(D5-c). R6 가 `aim` 으로 **누구를 겨누는가**를
//                   세운 지금, 그 겨눔이 곧 사람이라는 자리에 건 걸림이다.
//
// 못박는 것이 둘 있다.
//
//   **자기 자신을 겨눌 수는 없다.** 사람 축의 *겨눔*은 남을 향할 때만 서고, 제 몸·제 칸에 건
//   걸림은 자리 축으로 간다 — 자기와 다투는 일은 D5 가 `internal` 겹침으로 이미 다루었고,
//   그것은 상황(여럿이 서로를 보는 것)이 아니다.
//
//   **겨눔당하는 자도 그 자리에 서 있다.** 사람 축의 자리는 겨눔당한 사람이므로, 그 사람 자신이
//   참여자가 아니면 "넷이 04 를 겨눈다" 가 **04 없는 상황**이 되고, 서로 겨누는 둘은 각자 혼자뿐인
//   자리 둘로 흩어져 **알아봄이 영영 서지 않는다.** 그래서 겨눔 하나는 걸림 둘을 낸다 —
//   겨누는 자의 것(`aimed: true`)과 겨눔당하는 자의 것(`aimed: false`)이다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { ActiveGoal } from '../p4/index.ts';
import type { ActionIntent } from '../r6/index.ts';
import type { DependencyConflict } from '../d5/index.ts';
import { violateSituation, type SituationViolation } from './violation.ts';

/** 걸림이 설 수 있는 축 넷. 사람 축이 E0 가 새로 여는 것이다. */
export const STAKE_AXES = ['slot', 'target', 'subject', 'goal'] as const;

export type StakeAxis = (typeof STAKE_AXES)[number];

/** 그 걸림이 어디서 왔는가 — 걸림은 지어내지 않고 앞 계층의 값에서만 편다. */
export type StakeVia = 'conflict' | 'intent' | 'goal';

/** 축의 사람이 읽는 이름. */
export function stakeAxisLabel(axis: StakeAxis): string {
  if (axis === 'slot') return '자리';
  if (axis === 'target') return '대상';
  if (axis === 'subject') return '사람';
  return '목적';
}

/**
 * 주체 하나가 세계의 한 자리에 건 걸림 — 앞 계층의 값을 상황이 읽을 수 있는 모양으로 편 것.
 *
 * 여기 있는 것은 전부 D5·P4·R6 이 이미 적어 둔 값이다. **E0 가 새로 재는 값은 없다.**
 */
export interface SituationStake {
  readonly id: Id;
  /** 누가 걸렸는가 */
  readonly subjectId: Id;
  readonly axis: StakeAxis;
  /** 어느 자리인가 — 자리·대상 축의 형식은 D5 의 이름 형식과 같다 */
  readonly key: string;
  readonly label: string;
  readonly via: StakeVia;
  /** 어느 값에서 왔는가 (다툼 id · 의도 id · 목적 노드 id) */
  readonly sourceId: Id;
  /** 얼마나 급한가 — **D5 severity · P4 score 그대로**다. E0 는 다시 재지 않는다 */
  readonly urgency: number;
  /** 남을 겨누는 걸림인가 — 사람 축에서만 참이다 */
  readonly aimed: boolean;
  readonly note: string;
}

/** 걸림의 id — 유래(주체 · 축 · 자리 · 출처)에서 나온다 (V1 결정적 ID). */
export function stakeIdOf(subjectId: Id, axis: StakeAxis, key: string, sourceId: Id): Id {
  return deterministicId('stake', subjectId, axis, key, sourceId);
}

/** 묶음의 이름 — 이 값이 같은 걸림들이 한 자리에 모인다. */
export function stakeKeyOf(stake: Pick<SituationStake, 'axis' | 'key'>): string {
  return `${stake.axis}:${stake.key}`;
}

/** 자리 축의 이름 — D5 `slotKeyOf` 와 같은 형식이라 두 계층의 자리가 문자로 대조된다. */
export function stakeSlotKeyOf(ref: {
  readonly domain: string;
  readonly holderId: Id;
  readonly path: string;
}): string {
  return `${ref.domain}.${ref.holderId}.${ref.path}`;
}

/** 사람이 읽는 한 줄. */
export function stakeLine(stake: SituationStake): string {
  return `${stake.subjectId} → ${stakeAxisLabel(stake.axis)} ${stake.key} (${stake.via} · 급함 ${stake.urgency.toFixed(2)})`;
}

function orderStakes(stakes: readonly SituationStake[]): readonly SituationStake[] {
  return stableSort(stakes, (left, right) => {
    const axis = compareStrings(left.axis, right.axis);
    if (axis !== 0) return axis;
    const key = compareStrings(left.key, right.key);
    if (key !== 0) return key;
    const subject = compareStrings(left.subjectId, right.subjectId);
    if (subject !== 0) return subject;
    return compareStrings(left.id, right.id);
  });
}

/**
 * 다툼 하나가 내는 걸림들 — 다투는 자마다 하나씩.
 *
 * D5 는 이미 "이 자리 앞에 이들이 함께 서 있다" 를 값으로 갖고 있다. E0-a 는 그것을 **주체별로
 * 편다** — 그래야 사람 축의 걸림과 같은 평면에 놓인다. 급함은 다툼의 `severity` 그대로다.
 */
export function stakesFromConflict(conflict: DependencyConflict): readonly SituationStake[] {
  const subjectIds = [...new Set(conflict.sides.map((side) => side.subjectId))];
  return subjectIds.map((subjectId) => ({
    id: stakeIdOf(subjectId, conflict.axis, conflict.key, conflict.id),
    subjectId,
    axis: conflict.axis,
    key: conflict.key,
    label: conflict.label,
    via: 'conflict' as const,
    sourceId: conflict.id,
    urgency: conflict.severity,
    aimed: false,
    note: `D5 다툼 — ${conflict.note}`,
  }));
}

/**
 * 의도 하나가 내는 걸림들 — **셋까지 난다.**
 *
 *   ① 바꾸려는 칸마다 자리 축 하나 (`proposal.changes`)
 *   ② 겨눈 물건마다 대상 축 하나 (`proposal.targetIds` 중 사람이 아닌 것)
 *   ③ **겨눈 상대에 사람 축 둘** (`aim`) — 겨누는 자와 겨눔당하는 자. 이것이 E0 가 새로 여는 자리다
 *
 * 치르는 자리(`payments`)는 걸림이 아니다. 남이 함께 볼 수 있는 것이 아니라 제가 내놓는 것이고,
 * 그것을 자리로 세우면 "제 몸을 깎는 둘" 이 서로 다툰다는 말이 된다.
 */
export function stakesFromIntent(
  intent: ActionIntent,
  urgency = 0,
): readonly SituationStake[] {
  const stakes: SituationStake[] = [];
  const actorId = intent.providerId;
  const aimedAt = intent.aim === null ? null : intent.aim.counterpartId;

  for (const change of intent.proposal.changes) {
    const key = stakeSlotKeyOf(change);
    stakes.push({
      id: stakeIdOf(actorId, 'slot', key, intent.id),
      subjectId: actorId,
      axis: 'slot',
      key,
      label: key,
      via: 'intent',
      sourceId: intent.id,
      urgency,
      aimed: false,
      note: `${intent.action} 이 바꾸려는 칸이다`,
    });
  }

  for (const targetId of intent.proposal.targetIds) {
    // 겨눈 상대는 사람 축으로 간다 — 같은 것을 대상 축으로 또 세우면 한 겨눔이 두 번 센다.
    if (targetId === aimedAt) continue;
    stakes.push({
      id: stakeIdOf(actorId, 'target', targetId, intent.id),
      subjectId: actorId,
      axis: 'target',
      key: targetId,
      label: targetId,
      via: 'intent',
      sourceId: intent.id,
      urgency,
      aimed: false,
      note: `${intent.action} 이 겨눈 것이다`,
    });
  }

  if (aimedAt !== null) {
    stakes.push({
      id: stakeIdOf(actorId, 'subject', aimedAt, intent.id),
      subjectId: actorId,
      axis: 'subject',
      key: aimedAt,
      label: aimedAt,
      via: 'intent',
      sourceId: intent.id,
      urgency,
      aimed: true,
      note: `${intent.action} 로 그를 겨눈다 — ${intent.aim?.note ?? ''}`,
    });
    // **겨눔당하는 자도 그 자리에 서 있다.** 없으면 "넷이 04 를 겨눈다" 는 04 없는 상황이 되고,
    // 서로 겨누는 둘은 각자 혼자뿐인 자리 둘로 흩어져 **알아봄이 영영 서지 않는다**.
    //
    // 유래는 겨눈 의도가 아니라 **그 사람 자신**이다 — 그 자리는 그 사람이므로, 넷이 겨눠도
    // 그가 서 있다는 사실은 하나다(넷이면 걸림도 넷이 되어 한 사람이 네 번 센다).
    // 급함은 0 이다 — 겨눔당한 쪽이 얼마나 급한지는 아무도 재지 않았고, E0 는 지어내지 않는다.
    stakes.push({
      id: stakeIdOf(aimedAt, 'subject', aimedAt, aimedAt),
      subjectId: aimedAt,
      axis: 'subject',
      key: aimedAt,
      label: aimedAt,
      via: 'intent',
      sourceId: aimedAt,
      urgency: 0,
      aimed: false,
      note: '그가 겨눔당하는 자리다 — 알든 모르든 그는 여기 서 있다',
    });
  }

  return stakes;
}

/** 목적 하나가 내는 걸림 — 같은 가능성 노드를 좇는 자들이 한 자리에 모인다. 급함은 P4 점수다. */
export function stakesFromGoal(goal: ActiveGoal): readonly SituationStake[] {
  return [
    {
      id: stakeIdOf(goal.subjectId, 'goal', goal.nodeId, goal.nodeId),
      subjectId: goal.subjectId,
      axis: 'goal',
      key: goal.nodeId,
      label: goal.label,
      via: 'goal',
      sourceId: goal.nodeId,
      urgency: goal.score,
      aimed: false,
      note: `P4 가 고른 목적이다 — ${goal.note}`,
    },
  ];
}

export interface StakeSpec {
  readonly conflicts?: readonly DependencyConflict[];
  readonly intents?: readonly ActionIntent[];
  readonly goals?: readonly ActiveGoal[];
}

/**
 * 세 갈래의 값을 한 평면에 늘어놓는다 — **순서는 결정적이고, 같은 걸림은 한 번만 선다.**
 *
 * 의도의 급함은 그 의도가 나온 목적(P4 `ActiveGoal.score`)에서 읽어 온다 — 없으면 0 이다.
 * E0 가 급함을 지어내지 않는다는 뜻이고, `checkStakes` 가 그것을 검사로 만든다.
 */
export function stakesFrom(spec: StakeSpec): readonly SituationStake[] {
  const goals = spec.goals ?? [];
  const scoreOf = new Map(goals.map((goal) => [`${goal.subjectId} ${goal.nodeId}`, goal.score]));
  const stakes: SituationStake[] = [];
  for (const conflict of spec.conflicts ?? []) stakes.push(...stakesFromConflict(conflict));
  for (const intent of spec.intents ?? []) {
    const urgency = scoreOf.get(`${intent.providerId} ${intent.goalId}`) ?? 0;
    stakes.push(...stakesFromIntent(intent, urgency));
  }
  for (const goal of goals) stakes.push(...stakesFromGoal(goal));

  const unique = new Map<Id, SituationStake>();
  for (const stake of stakes) unique.set(stake.id, stake);
  return orderStakes([...unique.values()]);
}

/**
 * 걸림들이 설 수 있는가 — **E0 는 급함을 다시 재지 않는다**가 여기서 검사가 된다.
 *
 * 출처를 함께 주면 급함이 D5 severity·P4 score 와 같은지 대조한다. 주지 않으면 모양만 본다.
 */
export function checkStakes(
  stakes: readonly SituationStake[],
  spec: StakeSpec = {},
): readonly SituationViolation[] {
  const violations: SituationViolation[] = [];
  const severityOf = new Map((spec.conflicts ?? []).map((conflict) => [conflict.id, conflict.severity]));
  const scoreOf = new Map((spec.goals ?? []).map((goal) => [goal.nodeId, goal.score]));

  stakes.forEach((stake, index) => {
    const path = `$.stakes[${String(index)}]`;
    if (stake.subjectId === '') {
      violateSituation(violations, '', 'holderless-stake', `${path}.subjectId`, '누가 걸렸는지 없는 걸림이다');
    }
    if (stake.key === '') {
      violateSituation(violations, stake.subjectId, 'keyless-stake', `${path}.key`, '어느 자리에 걸렸는지 없는 걸림이다');
    }
    if (!(STAKE_AXES as readonly string[]).includes(stake.axis)) {
      violateSituation(violations, stake.subjectId, 'unknown-axis', `${path}.axis`, `축 넷 밖의 걸림이다 — ${stake.axis}`);
    }
    // **겨누는 걸림만 본다.** 사람 축에서 `aimed: false` 이고 자리가 자기인 걸림은 "겨눔당한 자
    // 자신" 이고, 그것은 옳다 — 그가 그 자리에 서 있다는 뜻이다.
    // 빈 자리는 위쪽에서 이미 걸렸다 — 빈 문자열끼리 같다고 "자기를 겨눴다" 고 적으면 사유가 겹친다.
    if (stake.aimed && stake.axis === 'subject' && stake.key !== '' && stake.key === stake.subjectId) {
      violateSituation(
        violations,
        stake.subjectId,
        'self-aimed-stake',
        `${path}.key`,
        '자기 자신에게 걸었다 — 사람 축은 남을 겨눌 때만 선다',
      );
    }
    if (stake.via === 'conflict') {
      const severity = severityOf.get(stake.sourceId);
      if (severity !== undefined && severity !== stake.urgency) {
        violateSituation(
          violations,
          stake.subjectId,
          'urgency-drift',
          `${path}.urgency`,
          `급함이 D5 가 잰 값과 다르다 — 다툼 ${String(severity)} vs 걸림 ${String(stake.urgency)}`,
        );
      }
    }
    if (stake.via === 'goal') {
      const score = scoreOf.get(stake.sourceId);
      if (score !== undefined && score !== stake.urgency) {
        violateSituation(
          violations,
          stake.subjectId,
          'urgency-drift',
          `${path}.urgency`,
          `급함이 P4 가 잰 점수와 다르다 — 목적 ${String(score)} vs 걸림 ${String(stake.urgency)}`,
        );
      }
    }
  });

  return violations;
}

/** 자리별로 누가 걸렸는가 — 묶음(E0-b)의 재료다. */
export function stakesByKey(
  stakes: readonly SituationStake[],
): ReadonlyMap<string, readonly SituationStake[]> {
  const byKey = new Map<string, SituationStake[]>();
  for (const stake of stakes) {
    const key = stakeKeyOf(stake);
    byKey.set(key, [...(byKey.get(key) ?? []), stake]);
  }
  return byKey;
}

/** 그 주체가 건 걸림들. */
export function stakesOf(
  stakes: readonly SituationStake[],
  subjectId: Id,
): readonly SituationStake[] {
  return stakes.filter((stake) => stake.subjectId === subjectId);
}
