// P5 검증 시나리오 3종 — 한 걸음이 몇 걸음이 되는가, 끊긴 사슬을 막는가, 닿지 못해도 죽지 않는가.

import { stateHash } from '@hkt/core/v1';
import {
  buildPlan,
  checkChain,
  checkPlan,
  CHAIN_RECONCILIATION,
  DEFERRED_STEPS,
  MAX_PLAN_DEPTH,
  P5_CHAIN,
  planVerdict,
  reconcileChain,
  type ActionPlan,
} from '@hkt/core/p5';
import { ACTION_ATOMS } from '@hkt/core/p0';
import { assembleWorld } from '@hkt/core/o2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  CHAIN_REPORT,
  CHOSEN_CASE,
  DEFERRED_CASE,
  PLAN_CASES,
  SEEING_CASE,
  SEIZE_PLAN,
  STOCKED_PLAN_CASE,
  UNKNOWING_PLAN_CASE,
  UNSEEN_CASE,
} from './p5-veil-plans.ts';

/** 계획 한 줄 — 시나리오 기대값이 사람에게 읽히도록. */
const lineOf = (label: string, plan: ActionPlan | null) => ({
  label,
  steps: plan === null ? null : plan.atoms,
  complete: plan?.complete ?? null,
});

/** 정상 — 같은 목적이 세계에 따라 다른 길이로 펴진다. */
export const p5PlansTheChain = defineScenario({
  id: 'p5-plans-the-chain',
  module: 'P5',
  kind: 'normal',
  purpose:
    '한 걸음처럼 보이던 목적이 세계에 따라 한 걸음에서 세 걸음까지 펴지고, 그 순서는 P3-a 선행과 P4-a 재료 선행이 이미 정한 것이며, 원문 P5 의 일곱 줄이 그 사슬에서 도출된다.',
  arrange: () => ({ cases: PLAN_CASES, chain: CHAIN_REPORT, seize: SEIZE_PLAN }),
  act: ({ cases, chain, seize }) => ({
    // ① 같은 목적, 다른 세계 — 사슬의 길이가 갈린다
    lines: cases.map((entry) => lineOf(entry.label, entry.plan)),

    // ② 빚진 자는 등지는 일조차 먼저 쌓아야 한다
    seize: seize.atoms,
    seizeDepth: seize.depth,

    // ③ 원문 일곱이 이 사슬에서 도출된다
    chainSteps: chain.resolutions.length,
    reached: chain.resolutions.filter((entry) => entry.reached).length,
    deferred: [...chain.deferred],
    foldedTo: chain.foldedTo,
    chainComplete: chain.complete,
    reconcileComplete: reconcileChain().complete,

    // ④ 걸음마다 왜 그 자리인지가 남는다
    reasons: (UNSEEN_CASE.plan?.steps ?? []).map((step) => step.reason),
    verdict: planVerdict(UNSEEN_CASE.plan as ActionPlan),
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '같은 04 인데 손에 쥔 것과 본 것에 따라 사슬의 길이가 갈린다',
      [
        { label: '지금 보는 04 가 고른 것', steps: ['acquire'], complete: true },
        { label: '빈손인 04 의 생산', steps: ['acquire', 'produce'], complete: true },
        { label: '아무것도 못 본 04 의 생산', steps: ['seek', 'acquire', 'produce'], complete: true },
        { label: '몫이 있는 04 의 생산', steps: ['produce'], complete: true },
        { label: '모르는 04 의 겨울 식량', steps: ['seek', 'acquire'], complete: true },
        { label: '아무것도 못 본 04', steps: null, complete: null },
      ],
      result.lines,
    ),
    expectState(
      '빚 40 이 신뢰를 다 갉아먹은 04 는 빼앗으려 해도 먼저 쌓아야 한다',
      ['acquire', 'exchange', 'seize'],
      result.seize,
    ),
    expectState('그 사슬은 두 칸 깊다 — P3-a 의 마지막 물결 그대로다', 2, result.seizeDepth),
    expectState('원문이 적은 단계는 일곱이다', 7, result.chainSteps),
    expectState('그중 여섯이 이 계획에서 도달한다', 6, result.reached),
    expectState('닿지 않는 하나는 유예로 선언돼 있다', ['접근 권한 확보'], result.deferred),
    expectState('일곱 줄이 세 걸음으로 접힌다', 3, result.foldedTo),
    expectTrue('대조가 온전하다', result.chainComplete, result.chainComplete),
    expectTrue('원문 일곱은 16원자 안에서 성립한다', result.reconcileComplete, result.reconcileComplete),
    expectState(
      '걸음마다 왜 그 자리인지가 남는다 — 봐야 한다 · 치러야 한다 · 목적',
      ['observation', 'cost', 'goal'],
      result.reasons,
    ),
    expectTrue('판정이 한 줄로 접힌다', result.verdict.includes('3 걸음'), result.verdict),
    expectDeterministic('같은 재료면 같은 계획이다', () =>
      stateHash(
        buildPlan({
          actorId: SEEING_CASE.spec.subject.id,
          goal: DEFERRED_CASE.target as NonNullable<typeof DEFERRED_CASE.target>,
          world: SEEING_CASE.spec.world,
          context: SEEING_CASE.spec.context,
          targetId: null,
        }),
      ),
    ),
  ],
});

/** 실패 — 끊긴 사슬·뒤집힌 순서·근거 없는 대조는 서지 못한다. */
export const p5BrokenPlanRejected = defineScenario({
  id: 'p5-broken-plan-rejected',
  module: 'P5',
  kind: 'failure',
  purpose:
    '낼 원자 없는 계획·자기를 딛는 걸음·받치는 것 없는 걸음·순서가 뒤집힌 걸음·닿지 못한 자리를 남긴 채의 완료 주장·미환원 단계·낡은 유예·계획에 서지 못하는 환원이 각각의 사유로 거부된다.',
  arrange: () => ({ sound: UNSEEN_CASE.plan as ActionPlan, scene: SEEING_CASE }),
  act: ({ sound, scene }) => {
    const rules = (violations: readonly { readonly rule: string }[]): readonly string[] => [
      ...new Set(violations.map((violation) => violation.rule)),
    ];
    const goalless = buildPlan({
      actorId: scene.spec.subject.id,
      goal: { possibilityId: 'possibility:없는것', label: '없는 것', direction: 'fulfill', viaAtom: null },
      world: scene.spec.world,
      context: scene.spec.context,
    });
    return {
      goalless: rules(goalless.violations),
      selfStanding: rules(
        checkPlan({
          ...sound,
          steps: sound.steps.map((step, index) =>
            index === 0 ? { ...step, forAtom: step.atom } : step,
          ),
        }),
      ),
      orphan: rules(
        checkPlan({
          ...sound,
          steps: sound.steps.map((step, index) =>
            index === 0 ? { ...step, forAtom: null } : step,
          ),
        }),
      ),
      unordered: rules(checkPlan({ ...sound, steps: [...sound.steps].reverse() })),
      dangling: rules(
        checkPlan({
          ...sound,
          complete: true,
          deadEnds: [
            { atom: 'produce', slot: 'economic.stock.{entity}', reason: 'no-supplier', note: '' },
          ],
        }),
      ),
      unresolved: rules(checkChain(sound, P5_CHAIN, CHAIN_RECONCILIATION, []).violations),
      staleDeferral: rules(
        checkChain(sound, P5_CHAIN, CHAIN_RECONCILIATION, [
          ...DEFERRED_STEPS,
          { original: '치료제 제작', owedTo: '아무도', reason: '' },
        ]).violations,
      ),
      unreached: rules(
        checkChain(
          sound,
          P5_CHAIN,
          CHAIN_RECONCILIATION.map((entry) =>
            entry.original === '치료제 제작' ? { ...entry, atoms: ['betray' as const] } : entry,
          ),
        ).violations,
      ),
      drift: rules(
        checkChain(
          sound,
          P5_CHAIN,
          CHAIN_RECONCILIATION.map((entry) =>
            entry.original === '이동' ? { ...entry, atoms: ['seize' as const] } : entry,
          ),
        ).violations,
      ),
      // 거부돼도 던지지 않는다 — 사유가 값으로 남는다
      messages: goalless.violations.map((violation) => violation.message.slice(0, 12)),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('낼 원자가 없으면 계획도 없다', ['goalless-plan'], result.goalless),
    expectState('자기를 딛고 설 수는 없다', ['self-standing-step'], result.selfStanding),
    expectState('목적이 아닌 걸음은 반드시 뒷걸음을 받친다', ['orphan-step'], result.orphan),
    expectState('받치는 것은 먼저 서야 한다', ['unordered-step'], result.unordered),
    expectState('닿지 못한 자리를 남긴 채 온전할 수는 없다', ['dangling-need'], result.dangling),
    expectState('환원되지 않는 단계는 유예로 선언해야 한다', ['unresolved-step'], result.unresolved),
    expectState('갚을 곳이 없는 유예는 낡은 유예다', ['stale-deferral'], result.staleDeferral),
    expectState('계획에 서지 못하는 환원은 지목된다', ['unreached-step'], result.unreached),
    expectTrue(
      'P0 과 갈리는 환원도 지목된다 — 같은 이름이 두 곳에서 갈릴 수는 없다',
      result.drift.includes('unresolved-step'),
      result.drift,
    ),
    expectTrue('거부는 사유와 함께 남는다', result.messages.length > 0, result.messages),
  ],
});

/** 경계 — 한 칸짜리 사슬과, 아무것도 쥐지 않은 세계. */
export const p5Boundary = defineScenario({
  id: 'p5-boundary',
  module: 'P5',
  kind: 'boundary',
  purpose:
    '지금 바로 낼 수 있으면 사슬은 한 칸이고, 아무것도 쥐지 않은 세계에서도 열여섯이 전부 닿으며, 브레이크 없는 자리는 사슬을 늘리지 않는다.',
  arrange: () => ({ chosen: CHOSEN_CASE, stocked: STOCKED_PLAN_CASE, unknowing: UNKNOWING_PLAN_CASE }),
  act: ({ chosen, stocked, unknowing }) => {
    const bare = assembleWorld([]).world;
    const stuck: string[] = [];
    let deepest = 0;
    for (const atom of ACTION_ATOMS) {
      const plan = buildPlan({
        actorId: SEEING_CASE.spec.subject.id,
        goal: { possibilityId: `possibility:${atom}`, label: atom, direction: 'fulfill', viaAtom: atom },
        world: bare,
        context: SEEING_CASE.spec.context,
        targetId: null,
      });
      if (!plan.complete || plan.deadEnds.length > 0) stuck.push(atom);
      deepest = Math.max(deepest, plan.depth);
    }
    const chosenPlan = chosen.plan as ActionPlan;
    return {
      // ① 지금 낼 수 있으면 한 칸이다
      oneStep: chosenPlan.atoms.length,
      oneStepDepth: chosenPlan.depth,
      oneStepReason: chosenPlan.steps[0]?.reason ?? null,

      // ② 손에 쥔 것 하나로 사슬이 접힌다
      folded: (stocked.plan as ActionPlan).atoms.length,

      // ③ 미뤄 둔 것을 펴면 선행이 첫 걸음이 된다
      deferredFirst: (unknowing.plan as ActionPlan).steps[0]?.atom ?? null,

      // ④ 브레이크 없는 자리는 사슬을 늘리지 않는다
      unbraked: chosenPlan.steps[0]?.unbrakedSlots ?? [],
      unbrakedVerdict: chosenPlan.steps[0]?.verdict ?? null,

      // ⑤ 아무것도 쥐지 않은 세계에서도 전부 닿는다
      stuck,
      deepest,
      cap: MAX_PLAN_DEPTH,
      atoms: ACTION_ATOMS.length,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('지금 낼 수 있으면 사슬은 한 칸이다', 1, result.oneStep),
    expectState('그때 깊이는 0 이다', 0, result.oneStepDepth),
    expectState('그 한 칸은 목적 자신이다', 'goal', result.oneStepReason),
    expectState('손에 쥔 것이 있으면 같은 목적이 한 칸으로 접힌다', 1, result.folded),
    expectState('미뤄 둔 것을 펴면 선행이 첫 걸음이 된다', 'seek', result.deferredFirst),
    expectState(
      '브레이크 없는 자리는 사슬을 늘리지 않고 걸음에 남는다',
      ['biological.vitality'],
      result.unbraked,
    ),
    expectState('그 걸음의 판정은 브레이크 없음이다', 'unbraked', result.unbrakedVerdict),
    expectState('아무것도 쥐지 않은 세계에서도 닿지 못하는 원자는 없다', [], result.stuck),
    expectTrue('사슬은 상한 안에서 끝난다', result.deepest <= result.cap, result.deepest),
    expectState('원자는 열여섯이다', 16, result.atoms),
    expectState('상한은 여덟이다', 8, result.cap),
  ],
});

export const p5Scenarios = [p5PlansTheChain, p5BrokenPlanRejected, p5Boundary];
