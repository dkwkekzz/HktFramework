// P5 검증 장면 — 같은 목적, 다른 세계. 한 걸음이 몇 걸음이 되는가.
//
// P4 의 장면은 "펴 놓은 것 중 무엇을 좇는가" 를 물었다. 이 장면이 묻는 것은 그 다음이다 —
// **그 하나를 실제로 내려면 몇 걸음인가.**
//
//   ① **지금 고른 것.** P4 가 고른 목적은 정의상 지금 낼 수 있는 것이라(`ready`) 한 걸음이다.
//      계획이 길어지는 자리는 거기가 아니다.
//   ② **P4 가 미뤄 둔 것.** P4 는 한 칸만 보고 "지금은 못 고른다" 고 했다. P5 가 그 한 칸을
//      사슬로 펴면 원문이 일곱 줄로 적은 모양이 나온다 — **찾다 → 획득 → 생산.**
//   ③ **손에 쥔 것 하나로 사슬이 접힌다.** 같은 생산이 몫이 있는 04 에게는 한 걸음이다.
//   ④ **등지는 일조차 세 걸음이다.** 빚 40 이 신뢰를 다 갉아먹은 04 는 빼앗으려 해도
//      먼저 쌓아야 한다 — 획득 → 주고받기 → 빼앗기. P3-a 의 마지막 물결이 계획으로 펴진 것이다.
//   ⑤ **고를 것이 없으면 계획도 없다.**

import type { Id } from '@hkt/core/v1';
import { buildPlan, checkChain, type ActionPlan, type ChainReport } from '@hkt/core/p5';
import type { GoalScore } from '@hkt/core/p4';

import {
  SEEING_CASE,
  STOCKED_CASE,
  UNKNOWING_CASE,
  BLIND_CASE,
  type GoalCase,
  MEAT_TARGET,
} from './p4-veil-goals.ts';

export { SEEING_CASE, STOCKED_CASE, UNKNOWING_CASE, BLIND_CASE, MEAT_TARGET };

/** 계획 하나가 서는 장면. */
export interface PlanCase {
  readonly label: string;
  readonly tells: string;
  /** 어느 후보를 펴는가 — P4 가 고른 것일 수도, 미뤄 둔 것일 수도 있다 */
  readonly target: GoalScore | null;
  readonly plan: ActionPlan | null;
  /** 그 대상을 지금 보는가 */
  readonly seen: boolean;
}

/** 그 후보가 가리키는 대상 — P3 이 갈래마다 적어 둔 것을 읽는다. */
function targetOf(scene: GoalCase, score: GoalScore): Id | null {
  return (
    scene.spec.subgraph.trace.entries.find(
      (entry) => entry.possibilityId === score.possibilityId,
    )?.targetId ?? null
  );
}

function planCase(
  label: string,
  tells: string,
  scene: GoalCase,
  pick: (score: GoalScore) => boolean,
  blind = false,
): PlanCase {
  const target = scene.selection.scores.find(pick) ?? null;
  if (target === null) return { label, tells, target: null, plan: null, seen: false };
  const targetId = blind ? null : targetOf(scene, target);
  return {
    label,
    tells,
    target,
    seen: targetId !== null && scene.spec.context.seen.includes(targetId),
    plan: buildPlan({
      actorId: scene.spec.subject.id,
      goal: target,
      world: scene.spec.world,
      context: scene.spec.context,
      targetId,
    }),
  };
}

const isGoal = (scene: GoalCase) => (score: GoalScore): boolean =>
  score.possibilityId === scene.selection.goal?.possibilityId;
const isDirection = (direction: string) => (score: GoalScore): boolean =>
  score.direction === direction;

/** ① P4 가 고른 것 — 지금 낼 수 있는 것이므로 한 걸음이다. */
export const CHOSEN_CASE = planCase(
  '지금 보는 04 가 고른 것',
  'P4 가 고른 목적은 정의상 지금 낼 수 있는 것이다 — 계획이 길어지는 자리가 아니다',
  SEEING_CASE,
  isGoal(SEEING_CASE),
);

/** ② P4 가 미뤄 둔 것 — 여기서 사슬이 길어진다. */
export const DEFERRED_CASE = planCase(
  '빈손인 04 의 생산',
  'P4 가 "지금은 못 고른다" 고 미뤄 둔 후보다 — 그 한 칸을 펴면 사슬이 나온다',
  SEEING_CASE,
  isDirection('produce'),
);

/** ③ 같은 생산인데 대상을 못 본 04 — 원문이 일곱 줄로 적은 모양이 여기서 나온다. */
export const UNSEEN_CASE = planCase(
  '아무것도 못 본 04 의 생산',
  '치를 것도 없고 볼 것도 못 봤다 — 찾다 → 획득 → 생산',
  SEEING_CASE,
  isDirection('produce'),
  true,
);

/** ④ 몫이 있는 04 의 같은 목적 — 손에 쥔 것 하나로 사슬이 접힌다. */
export const STOCKED_PLAN_CASE = planCase(
  '몫이 있는 04 의 생산',
  '감춰 둔 몫 둘이 있으면 같은 목적이 한 걸음으로 접힌다',
  STOCKED_CASE,
  isDirection('produce'),
);

/** ⑤ 모르는 04 가 미뤄 둔 것 — 찾기가 앞칸에 선다. */
export const UNKNOWING_PLAN_CASE = planCase(
  '모르는 04 의 겨울 식량',
  'P4 는 선행이 걸려 미뤘다 — P5 가 그 선행을 첫 걸음으로 세운다',
  UNKNOWING_CASE,
  (score) => score.label === '겨울 식량' && score.direction === 'fulfill',
);

/** ⑥ 고를 것이 없는 04. */
export const BLIND_PLAN_CASE: PlanCase = {
  label: '아무것도 못 본 04',
  tells: '펴 놓은 것이 없으면 고를 것도 없고, 고른 것이 없으면 계획도 없다',
  target: null,
  plan: null,
  seen: false,
};

export const PLAN_CASES: readonly PlanCase[] = [
  CHOSEN_CASE,
  DEFERRED_CASE,
  UNSEEN_CASE,
  STOCKED_PLAN_CASE,
  UNKNOWING_PLAN_CASE,
  BLIND_PLAN_CASE,
];

/**
 * 빚진 04 가 빼앗으려면 — 먼저 쌓아야 한다.
 *
 * 04 의 신뢰는 0 이고 창고도 비었다(P0 장면: 빚 40 이 마을의 신뢰를 다 갉아먹었다).
 * 빼앗기는 신뢰를 치르고 그 자리를 세우는 것은 주고받기 하나이며, 주고받기는 재고를 치른다.
 */
export const SEIZE_PLAN: ActionPlan = buildPlan({
  actorId: SEEING_CASE.spec.subject.id,
  goal: {
    possibilityId: 'possibility:빼앗기',
    label: '겨울 식량',
    direction: 'fulfill',
    viaAtom: 'seize',
  },
  world: SEEING_CASE.spec.world,
  context: SEEING_CASE.spec.context,
  // 04 는 협곡의 고기를 지금 보고 있다 — 관측 선행은 걸리지 않고, 남는 것은 쌓아 둔 것뿐이다.
  targetId: MEAT_TARGET,
});

/** 원문 P5 일곱 줄을 ③의 계획에 대조한 결과 — 도달 판정의 재료는 실제 사슬이다. */
export const CHAIN_REPORT: ChainReport = checkChain(
  UNSEEN_CASE.plan ?? SEIZE_PLAN,
);
