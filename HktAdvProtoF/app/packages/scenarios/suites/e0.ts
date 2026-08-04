// E0 검증 시나리오 3종 — 상황이 서는가, 설 수 없는 상황이 막히는가, 비어 있을 때도 서는가.

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  AFTER_AUDIT,
  AFTER_PAIRS,
  AFTER_ROWS,
  ALONE_AUDIT,
  ALONE_RESULT,
  BEFORE,
  BEFORE_AUDIT,
  BEFORE_GRAPH,
  BEFORE_PAIRS,
  BEFORE_ROWS,
  BEFORE_VERDICT,
  BLIND_NOTE,
  BROKEN_SITUATIONS,
  EMPTY_AUDIT,
  GRAPH_NOTE,
  IDEMPOTENT,
  NO_OUTCOME_NOTE,
  SHIFT,
  SHIFT_NOTE,
  SOLITUDE_NOTE,
  SOLITUDE_ROWS,
  STAKES_BY_AXIS,
  SUBJECT_IDS,
  nameOf,
  runDetect,
} from './e0-veil-situations.ts';

/** 정상 — 넷이 같은 것을 원하는데 아무도 서로를 모르고, 장부 한 줄이 그것을 바꾼다. */
export const e0RecognizedContest = defineScenario({
  id: 'e0-recognized-contest',
  module: 'E0',
  kind: 'normal',
  purpose:
    'D5 의 다툼과 R6 의 의도를 한 세계에 겹치면 상황 둘이 선다. 넷이 같은 고기 앞에 서 있는데 여섯 쌍 전부 서로를 모르고, 둘이 04 를 겨누는데 04 는 그 둘을 모른다(매복 둘). 그런데 04 의 장부에 사이 한 줄이 적히는 순간 — 겨눔은 하나도 바꾸지 않았는데 — 매복이 서로 알아본 다툼으로 바뀐다.',
  arrange: () => ({
    rows: BEFORE_ROWS,
    pairs: BEFORE_PAIRS,
    solitudes: SOLITUDE_ROWS,
    afterRows: AFTER_ROWS,
    afterPairs: AFTER_PAIRS,
  }),
  act: ({ rows, pairs, solitudes, afterRows, afterPairs }) => ({
    // ① 세계의 대부분은 상황이 아니다
    stakes: BEFORE.stakes.length,
    stakesByAxis: STAKES_BY_AXIS,
    situations: rows.length,
    solitudes: solitudes.length,
    calm: BEFORE_AUDIT.calm,
    subjects: SUBJECT_IDS.length,
    solitudeNote: SOLITUDE_NOTE,

    // ② 넷이 같은 고기 앞에 섰는데 서로를 알아본 쌍은 없다
    meat: rows
      .filter((row) => row.axis === 'target')
      .map((row) => [row.who.length, row.pairs, row.blind, row.recognized]),
    blindButKnown: pairs.filter((pair) => pair.aim === 'blind' && pair.awareness !== 'neither')
      .length,
    blindNote: BLIND_NOTE,

    // ③ 둘이 04 를 겨누는데 04 는 그 둘을 모른다
    aimedAt04: rows
      .filter((row) => row.axis === 'subject')
      .map((row) => [row.who.length, row.pairs, row.ambushes, row.recognized]),
    ambushes: BEFORE_AUDIT.ambushes,
    recognized: BEFORE_AUDIT.recognized,
    verdict: BEFORE_VERDICT,
    violations: BEFORE_AUDIT.violations.length,

    // ④ 장부 한 줄이 값을 가른다 — 겨눔은 그대로다
    shift: SHIFT,
    afterSituations: afterRows.length,
    mutualPairs: afterPairs
      .filter((pair) => pair.aim === 'mutual')
      .map((pair) => [pair.left, pair.right]),
    shiftNote: SHIFT_NOTE,

    // 이 계층이 새로 그은 선
    graphNodes: BEFORE_GRAPH.nodes.length,
    graphEdges: BEFORE_GRAPH.edges.length,
    everyEdgeBetweenSubjects: BEFORE_GRAPH.edges.every(
      (edge) => SUBJECT_IDS.includes(edge.leftId) && SUBJECT_IDS.includes(edge.rightId),
    ),
    graphNote: GRAPH_NOTE,
    noOutcomeNote: NO_OUTCOME_NOTE,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '걸림 열셋이 세 축에 놓인다 — 자리 여섯 · 사람 셋 · 대상 넷 (사람 축이 E0 가 새로 연 것이다)',
      { slot: 6, subject: 3, target: 4 },
      result.stakesByAxis,
    ),
    expectState('그런데 상황이 되는 것은 둘뿐이다', 2, result.situations),
    expectState(
      '여섯 자리는 혼자 걸렸다 — D5 의 자리 다툼 넷은 전부 제 안의 겹침이고, 의도가 바꾸려는 칸은 각자 제 장부다',
      6,
      result.solitudes,
    ),
    expectTrue('그것은 위반이 아니라 사실이다', result.solitudeNote === SOLITUDE_NOTE, SOLITUDE_NOTE),
    expectState(
      '여덟 주체 중 둘은 아무 상황에도 끼지 않는다 — 세계는 아무도 부딪히지 않는 자리를 늘 갖는다',
      [8, 2],
      [result.subjects, result.calm],
    ),

    expectState(
      '넷이 같은 고기 앞에 서고 쌍 여섯이 서는데 여섯 다 눈멂이다 — 알아본 쌍은 0',
      [[4, 6, 6, 0]],
      result.meat,
    ),
    expectState(
      '그중 하나는 서로를 아는데도 눈멂이다 — 아는 것과 겨누는 것은 다르다',
      1,
      result.blindButKnown,
    ),
    expectTrue('D5 가 멈춘 자리가 여기서 값으로 보인다', result.blindNote === BLIND_NOTE, BLIND_NOTE),

    expectState(
      '04 를 겨눈 둘과 04 자신이 한 자리에 서고, 쌍 셋 중 둘이 매복이다',
      [[3, 3, 2, 0]],
      result.aimedAt04,
    ),
    expectState('세계 전체에서 매복 둘 · 알아본 쌍 0', [2, 0], [result.ambushes, result.recognized]),
    expectState('상황장에 어긋난 것은 없다', 0, result.violations),

    expectState(
      '장부 한 줄에 04 가 아는 상대가 하나에서 둘이 된다',
      [1, 2],
      [result.shift.knownBefore, result.shift.knownAfter],
    ),
    expectState(
      '그 한 줄로 상황이 둘에서 셋이 되고',
      [2, 3],
      [result.shift.situationsBefore, result.shift.situationsAfter],
    ),
    expectState(
      '알아본 쌍이 0 에서 둘이 되며',
      [0, 2],
      [result.shift.recognizedBefore, result.shift.recognizedAfter],
    ),
    expectState(
      '매복이 둘에서 하나로 줄어든다',
      [2, 1],
      [result.shift.ambushBefore, result.shift.ambushAfter],
    ),
    expectState(
      '서로 알아본 것은 04 와 몰이꾼이다',
      [
        ['몰이꾼 04', '몰이꾼 (자국을 쫓는 자들)'],
        ['몰이꾼 04', '몰이꾼 (자국을 쫓는 자들)'],
      ],
      result.mutualPairs,
    ),
    expectTrue('겨눔은 하나도 바꾸지 않았다', result.shiftNote === SHIFT_NOTE, SHIFT_NOTE),

    expectState('그래프는 주체 여섯과 선 아홉이고', [6, 9], [result.graphNodes, result.graphEdges]),
    expectTrue(
      '선은 전부 주체에서 주체로 간다 — D5 이분 그래프가 긋지 않은 선이다',
      result.everyEdgeBetweenSubjects,
      GRAPH_NOTE,
    ),
    expectTrue(
      'E0 는 이기는 자를 정하지 않는다 — 결과를 확정하는 것은 E3 다',
      result.noOutcomeNote === NO_OUTCOME_NOTE,
      NO_OUTCOME_NOTE,
    ),
  ],
});

/** 실패 — 설 수 없는 상황 여섯이 전부 사유와 함께 막힌다. */
export const e0GroundlessSituationRejected = defineScenario({
  id: 'e0-groundless-situation-rejected',
  module: 'E0',
  kind: 'failure',
  purpose:
    '참여자 하나뿐인 상황·걸림 없는 상황·자기 자신과의 쌍·서로 겨누는데 매복이라 적은 쌍·둘이 걸린 자리를 빠뜨린 상황장, 그리고 **이기는 자를 적은 상황**이 전부 사유와 함께 막힌다.',
  arrange: () => ({ broken: BROKEN_SITUATIONS }),
  act: ({ broken }) => ({
    rules: broken.map((entry) => entry.rule),
    caught: broken.map((entry) => [entry.label, entry.caught]),
    allCaught: broken.every((entry) => entry.caught),
    outcomeWhy: broken.find((entry) => entry.rule === 'outcome-declared')?.why ?? '',
    missingWhy: broken.find((entry) => entry.rule === 'missing-situation')?.why ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '막히는 사유는 여섯이다',
      [
        'solitary-situation',
        'groundless-situation',
        'outcome-declared',
        'self-pair',
        'awareness-drift',
        'missing-situation',
      ],
      result.rules,
    ),
    expectTrue('여섯 다 실제로 걸린다 — 주장이 아니라 검사다', result.allCaught, result.caught),
    expectTrue(
      '이기는 자를 적으면 걸리는 이유가 한 줄로 적혀 있다',
      result.outcomeWhy.includes('E3'),
      result.outcomeWhy,
    ),
    expectTrue(
      '빠뜨린 상황을 잡는 이유도 한 줄로 적혀 있다 — D5-c missing-contest 와 같은 자리',
      result.missingWhy.includes('missing-contest'),
      result.missingWhy,
    ),
  ],
});

/** 경계 — 아무것도 없을 때, 하나뿐일 때, 그리고 같은 재료를 몇 번 돌리든. */
export const e0Boundary = defineScenario({
  id: 'e0-boundary',
  module: 'E0',
  kind: 'boundary',
  purpose:
    '빈 재료는 빈 상황장을 내고 아무 어긋남도 없다. 의도 하나라도 남을 겨누면 상황은 이미 선다 — 겨눔당한 자가 그 자리에 서 있기 때문이다. 그리고 같은 재료는 몇 번을 돌려도 같은 상황장이다.',
  arrange: () => ({ alone: ALONE_RESULT }),
  act: ({ alone }) => ({
    emptySituations: EMPTY_AUDIT.situations,
    emptySolitudes: EMPTY_AUDIT.solitudes,
    emptyPairs: EMPTY_AUDIT.pairs,
    emptyViolations: EMPTY_AUDIT.violations.length,

    aloneSituations: ALONE_AUDIT.situations,
    aloneParticipants: alone.field.situations.map((situation) =>
      situation.participants.map(nameOf),
    ),
    aloneAmbushes: ALONE_AUDIT.ambushes,
    aloneRecognized: ALONE_AUDIT.recognized,
    aloneSolitudes: ALONE_AUDIT.solitudes,
    aloneCalm: ALONE_AUDIT.calm,
    aloneViolations: ALONE_AUDIT.violations.length,

    idempotent: IDEMPOTENT,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '빈 재료는 상황도 자리도 쌍도 내지 않는다',
      [0, 0, 0],
      [result.emptySituations, result.emptySolitudes, result.emptyPairs],
    ),
    expectState('그때도 어긋남은 없다 — 아무 일도 없는 것은 위반이 아니다', 0, result.emptyViolations),
    expectState(
      '의도 하나라도 남을 겨누면 상황은 이미 선다 — 겨눔당한 자가 그 자리에 서 있다',
      1,
      result.aloneSituations,
    ),
    expectState(
      '그 상황의 참여자는 겨눈 자와 겨눔당한 자 둘이고',
      [['몰이꾼 04', '몰이꾼 (자국을 쫓는 자들)']],
      result.aloneParticipants,
    ),
    expectState(
      '유일한 쌍은 매복이다 — 알아본 쌍은 없다',
      [1, 0],
      [result.aloneAmbushes, result.aloneRecognized],
    ),
    expectState(
      '그가 바꾸려던 제 장부 칸은 혼자 걸린 자리로 남고, 나머지 여섯은 아무 상황에도 끼지 않는다',
      [1, 6],
      [result.aloneSolitudes, result.aloneCalm],
    ),
    expectState('그때도 어긋남은 없다', 0, result.aloneViolations),
    expectTrue('같은 재료는 같은 상황장을 낸다', result.idempotent, '같은 상황장이다'),
    expectDeterministic('같은 재료로 상황 묶기를 100번 돌려도 해시는 하나다', runDetect),
  ],
});

export const e0Scenarios = [e0RecognizedContest, e0GroundlessSituationRejected, e0Boundary];
