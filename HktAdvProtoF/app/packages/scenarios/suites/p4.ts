// P4 검증 시나리오 3종 — 압력 1위가 늘 뽑히는가, 근거 없는 점수를 막는가, 고를 것이 없으면 어떻게 되는가.

import { stateHash } from '@hkt/core/v1';
import {
  checkFactors,
  checkFactorSources,
  checkSelection,
  factorsOf,
  FACTOR_SOURCES,
  GOAL_FACTORS,
  INERTIA_MARGIN,
  payabilityOf,
  scoreOf,
  selectGoal,
  selectionVerdict,
  totalWeight,
  type ActiveGoal,
  type GoalFactorId,
} from '@hkt/core/p4';
import { STATE_SCHEMA } from '@hkt/core/o2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BLIND_CASE,
  INERTIA_CASE,
  SEEING_CASE,
  STOCKED_CASE,
  SWITCH_CASE,
  UNKNOWING_CASE,
} from './p4-veil-goals.ts';

/** 후보 하나를 한 줄로 — 시나리오 기대값이 사람에게 읽히도록. */
const lineOf = (label: string, selection: (typeof SEEING_CASE)['selection']) => ({
  label,
  candidates: selection.scores.length,
  ready: selection.scores.filter((score) => score.ready).length,
  goal: selection.goal === null ? null : `${selection.goal.label}/${selection.goal.direction}`,
  via: selection.goal?.viaAtom ?? null,
  mostPressing:
    selection.mostPressing === null
      ? null
      : `${selection.mostPressing.label}/${selection.mostPressing.direction}`,
  pressingReady: selection.mostPressing?.ready ?? null,
});

/** 정상 — 압력이 가장 높은 것이 항상 뽑히지는 않는다. */
export const p4PicksUnderPressure = defineScenario({
  id: 'p4-picks-under-pressure',
  module: 'P4',
  kind: 'normal',
  purpose:
    '요소 아홉이 앞 계층에서 오고, 점수가 그 아홉에서 재계산되며, 선행이 걸린 압력 1위 대신 지금 낼 수 있는 것이 뽑히고, 손에 쥔 것이 달라지면 같은 세계에서 다른 목적이 선다.',
  arrange: () => ({
    seeing: SEEING_CASE,
    unknowing: UNKNOWING_CASE,
    stocked: STOCKED_CASE,
  }),
  act: ({ seeing, unknowing, stocked }) => {
    const chosen = stocked.selection.goal;
    const stockedFactors =
      stocked.selection.scores.find((score) => score.possibilityId === chosen?.possibilityId)
        ?.factors ?? [];
    return {
      // ① 출처 — 아홉이 전부 선언돼 있고 P4 자신이 출처인 것은 하나뿐이다
      factorCount: GOAL_FACTORS.length,
      sourceViolations: checkFactorSources().length,
      selfSourced: FACTOR_SOURCES.filter((source) => source.layer === 'P4').map(
        (source) => source.id,
      ),
      weightSum: totalWeight(seeing.selection.scores[0]?.factors ?? []),

      // ② 세 장면의 선택
      lines: [
        lineOf('지금 보는 04', seeing.selection),
        lineOf('모르는 04', unknowing.selection),
        lineOf('몫이 있는 04', stocked.selection),
      ],

      // ③ 몫이 있는 04 를 당긴 것 — 가치관과 약속이 함께 선다
      pulled: stockedFactors
        .filter((factor) => factor.value > 0)
        .map((factor) => `${factor.id}:${factor.value.toFixed(2)}`),

      // ④ 점수는 요소에서 다시 나온다
      scoreDrift: [seeing, unknowing, stocked].flatMap((entry) =>
        entry.selection.scores.filter((score) => score.score !== scoreOf(score.factors)),
      ).length,
      complete: [seeing, unknowing, stocked].every((entry) => entry.selection.complete),
      verdict: selectionVerdict(unknowing.selection),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('요소는 원문이 적은 아홉이다', 9, result.factorCount),
    expectState('출처표는 온전하다', 0, result.sourceViolations),
    expectState('P4 자신이 출처인 것은 매몰비용 하나뿐이다', ['sunk'], result.selfSourced),
    expectState('무게의 총합은 4.7 이다 — 점수를 −1~1 로 접는 분모', 4.7, result.weightSum),
    expectState(
      '같은 04 인데 세계가 달라지면 다른 것을 좇는다 — 그리고 압력 1위가 늘 뽑히지는 않는다',
      [
        {
          label: '지금 보는 04',
          candidates: 9,
          ready: 8,
          goal: '겨울 식량/fulfill',
          via: 'acquire',
          mostPressing: '겨울 식량/fulfill',
          pressingReady: true,
        },
        {
          label: '모르는 04',
          candidates: 10,
          ready: 1,
          goal: '마비독 감별/fulfill',
          via: 'seek',
          mostPressing: '겨울 식량/fulfill',
          pressingReady: false,
        },
        {
          label: '몫이 있는 04',
          candidates: 9,
          ready: 9,
          goal: '겨울 식량/delegate',
          via: 'exchange',
          mostPressing: '겨울 움막/fulfill',
          pressingReady: true,
        },
      ],
      result.lines,
    ),
    expectState(
      '몫이 있는 04 를 당긴 것은 압력이 아니라 가치관과 약속이다',
      ['pressure:0.10', 'feasibility:0.60', 'values:0.70', 'promise:0.80'],
      result.pulled,
    ),
    expectState('점수는 언제나 요소 아홉에서 다시 나온다', 0, result.scoreDrift),
    expectTrue('세 장면 다 온전하다', result.complete, result.complete),
    expectTrue('판정이 한 줄로 접힌다', result.verdict.includes('마비독'), result.verdict),
    expectDeterministic('같은 재료면 같은 선택이다', () =>
      stateHash(selectGoal(SEEING_CASE.spec.subgraph.active, SEEING_CASE.spec)),
    ),
  ],
});

/** 실패 — 근거 없는 점수·목적은 서지 못한다. */
export const p4BrokenSelectionRejected = defineScenario({
  id: 'p4-broken-selection-rejected',
  module: 'P4',
  kind: 'failure',
  purpose:
    '출처 없는 요소·범위 밖 값·재계산되지 않는 점수·후보에 없는 목적·선행이 서지 않은 목적·밀어낼 것 없는 관성·펴지 않은 후보·걸림 없는 원자·세계에 없는 자리가 각각의 사유로 거부된다.',
  arrange: () => ({ scene: SEEING_CASE, unknowing: UNKNOWING_CASE }),
  act: ({ scene, unknowing }) => {
    const selection = scene.selection;
    const goal = selection.goal as ActiveGoal;
    const sound = selection.scores[0];
    const notReady = unknowing.selection.scores.find((score) => !score.ready);
    const first = scene.spec.subgraph.active[0];
    const rules = (violations: readonly { readonly rule: string }[]): readonly string[] => [
      ...new Set(violations.map((violation) => violation.rule)),
    ];

    return {
      // ① 출처표를 손대는 세 길
      invented: rules(
        checkFactorSources([
          ...FACTOR_SOURCES,
          {
            id: 'mood' as GoalFactorId,
            layer: 'P4',
            reads: '',
            direction: 'pull',
            weight: 1,
            note: '',
          },
        ]),
      ),
      seized: rules(
        checkFactorSources(
          FACTOR_SOURCES.map((source) =>
            source.id === 'pressure' ? { ...source, layer: 'P4' } : source,
          ),
        ),
      ),
      missing: checkFactorSources(
        FACTOR_SOURCES.filter((source) => source.id !== 'memory'),
      ).length,

      // ② 요소 값을 손대면
      outOfRange:
        sound === undefined
          ? []
          : rules(
              checkFactors({
                possibilityId: sound.possibilityId,
                nodeId: sound.nodeId,
                label: sound.label,
                direction: sound.direction,
                viaAtom: sound.viaAtom,
                payment: null,
                factors: [{ ...(sound.factors[0] as (typeof sound.factors)[number]), value: 9 }],
                violations: [],
              }),
            ),

      // ③ 점수·목적을 손대는 네 길
      drift: rules(
        checkSelection({
          ...selection,
          scores: selection.scores.map((score, index) =>
            index === 0 ? { ...score, score: 0.99 } : score,
          ),
        }),
      ),
      unheld: rules(
        checkSelection({ ...selection, goal: { ...goal, possibilityId: 'possibility:없는것' } }),
      ),
      premature:
        notReady === undefined
          ? []
          : rules(
              checkSelection({
                ...unknowing.selection,
                goal: {
                  ...(unknowing.selection.goal as ActiveGoal),
                  possibilityId: notReady.possibilityId,
                  score: notReady.score,
                },
              }),
            ),
      inertia: rules(checkSelection({ ...selection, goal: { ...goal, commitmentInertia: 0.5 } })),

      // ④ 펴지 않은 후보 · 걸림 없는 원자 · 세계에 없는 자리
      phantom:
        first === undefined
          ? []
          : rules(factorsOf({ ...first, id: 'possibility:없는것' }, scene.spec).violations),
      ghostAtom: rules(
        payabilityOf('없는원자' as 'seek', {
          actorId: scene.spec.subject.id,
          world: scene.spec.world,
        }).violations,
      ),
      nowhere: rules(
        payabilityOf('acquire', {
          actorId: scene.spec.subject.id,
          world: scene.spec.world,
          schema: { ...STATE_SCHEMA, fields: [] },
        }).violations,
      ),

      // 거부돼도 던지지 않는다 — 사유가 값으로 남는다
      messages: checkSelection({
        ...selection,
        goal: { ...goal, possibilityId: 'possibility:없는것' },
      }).map((violation) => violation.message.slice(0, 12)),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('원문 아홉에 없는 요소는 목록에 들지 못한다', ['unsourced-factor'], result.invented),
    expectState('앞 계층에서 오던 것을 P4 것이라 적으면 걸린다', ['unsourced-factor'], result.seized),
    expectState('아홉 중 하나가 빠져도 걸린다', 1, result.missing),
    expectState('접을 수 없는 힘은 요소가 아니다', ['factor-out-of-range'], result.outOfRange),
    expectState('손으로 적은 점수는 근거가 아니다', ['score-drift'], result.drift),
    expectState('놓이지 않은 길을 좇을 수는 없다', ['unheld-goal'], result.unheld),
    expectState('선행이 서지 않은 것을 고를 수는 없다', ['premature-goal'], result.premature),
    expectState('밀어낼 것이 없는데 문턱이 있을 수 없다', ['inertia-without-history'], result.inertia),
    expectState('P3 이 펴지 않은 것은 후보가 아니다', ['phantom-candidate'], result.phantom),
    expectState('걸림 없는 원자의 대가는 물을 수 없다', ['absent-grounding'], result.ghostAtom),
    expectState('세계에 없는 자리로는 치르지 못한다', ['unslotted-payment'], result.nowhere),
    expectTrue('거부는 사유와 함께 남는다', result.messages.length > 0, result.messages),
  ],
});

/** 경계 — 고를 것이 없을 때, 그리고 관성이 지키고 지는 자리. */
export const p4Boundary = defineScenario({
  id: 'p4-boundary',
  module: 'P4',
  kind: 'boundary',
  purpose:
    '펴 놓은 것이 없으면 목적도 없고, 관성은 문턱을 넘지 못한 1위를 막되 넘은 1위는 막지 못하며, 사라진 목적은 붙들지 않는다.',
  arrange: () => ({
    blind: BLIND_CASE,
    kept: INERTIA_CASE,
    switched: SWITCH_CASE,
    scene: SEEING_CASE,
  }),
  act: ({ blind, kept, switched, scene }) => {
    const goal = scene.selection.goal as ActiveGoal;
    const fulfilled = selectGoal(scene.spec.subgraph.active, {
      ...scene.spec,
      previousGoal: {
        ...goal,
        possibilityId: 'possibility:사라진것',
        nodeId: 'dep-node:사라진것',
      },
    });
    const gone = selectGoal(scene.spec.subgraph.active, {
      ...scene.spec,
      previousGoal: { ...goal, possibilityId: 'possibility:닫힌길' },
    });
    return {
      // ① 펴 놓은 것이 없으면 목적도 없다
      blindCandidates: blind.selection.scores.length,
      blindGoal: blind.selection.goal,
      blindComplete: blind.selection.complete,
      blindVerdict: selectionVerdict(blind.selection),

      // ② 관성이 지킨다 — 1위가 앞섰는데도 바뀌지 않는다
      keptGoal: `${kept.selection.goal?.label ?? ''}/${kept.selection.goal?.direction ?? ''}`,
      keptChange: kept.selection.goal?.change ?? null,
      keptMarginUnder: (kept.selection.margin ?? 1) <= INERTIA_MARGIN,
      keptHeld: kept.selection.goal?.heldTicks ?? -1,
      keptSince: kept.selection.goal?.sinceTick ?? -1,
      keptBest: `${kept.selection.best?.label ?? ''}/${kept.selection.best?.direction ?? ''}`,

      // ③ 관성이 진다 — 문턱을 넘으면 갈아탄다
      switchedChange: switched.selection.goal?.change ?? null,
      switchedOver: switched.selection.margin > INERTIA_MARGIN,
      switchedFrom: switched.spec.previousGoal?.direction ?? null,
      switchedTo: switched.selection.goal?.direction ?? null,

      // ④ 관성은 사라진 목적을 붙들지 않는다
      fulfilled: fulfilled.goal?.change ?? null,
      fulfilledInertia: fulfilled.goal?.commitmentInertia ?? -1,
      gone: gone.goal?.change ?? null,

      // ⑤ 문턱은 자라지 않는다 — 결정론 상수 하나다
      margin: INERTIA_MARGIN,
      firstInertia: scene.selection.goal?.commitmentInertia ?? -1,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('아무것도 못 본 자에게는 후보가 서지 않는다', 0, result.blindCandidates),
    expectState('후보가 없으면 목적도 없다', null, result.blindGoal),
    expectTrue('그래도 온전하다 — 던지지 않는다', result.blindComplete, result.blindVerdict),
    expectState('2위를 좇던 자는 그대로 2위를 좇는다', '겨울 움막/fulfill', result.keptGoal),
    expectState('바뀌지 않은 사유는 지킴이다', 'kept', result.keptChange),
    expectTrue('1위가 앞섰지만 문턱을 넘지 못했다', result.keptMarginUnder, result.keptBest),
    expectState('1위는 여전히 겨울 식량이다', '겨울 식량/fulfill', result.keptBest),
    expectState('좇기 시작한 시각은 그대로다 — 매몰비용이 여기서 자란다', 5, result.keptHeld),
    expectState('문턱을 넘으면 갈아탄다', 'outscored', result.switchedChange),
    expectTrue('그때는 차이가 문턱보다 크다', result.switchedOver, result.switchedChange),
    expectState('버리려던 길에서', 'removeDependency', result.switchedFrom),
    expectState('맡기는 길로 옮겨 간다', 'delegate', result.switchedTo),
    expectState('결핍이 사라지면 관성이 붙들 자리가 없다', 'fulfilled', result.fulfilled),
    expectState('그때 문턱은 0 이다', 0, result.fulfilledInertia),
    expectState('결핍은 남았는데 길이 닫혔으면 다른 사유다', 'gone', result.gone),
    expectState('문턱은 자라지 않는 상수 하나다', 0.15, result.margin),
    expectState('처음 고르는 목적에는 문턱이 없다', 0, result.firstInertia),
    expectTrue('좇기 시작한 시각은 지금보다 앞선다', result.keptSince > 0, result.keptSince),
  ],
});

export const p4Scenarios = [p4PicksUnderPressure, p4BrokenSelectionRejected, p4Boundary];
