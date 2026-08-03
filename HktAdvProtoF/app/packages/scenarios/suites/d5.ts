// D5 검증 시나리오 3종 — 다툼이 서는가, 설 수 없는 다툼이 막히는가, 겹침이 다툼이 아닌 자리가 남는가.

import { stateHash } from '@hkt/core/v1';
import { conflictFieldVerdict, conflictLine } from '@hkt/core/d5';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  ALONE,
  AUDIT,
  BIPARTITE,
  BODY_CONFLICT,
  BROKEN_CONFLICTS,
  CLAIMS,
  CONTESTS,
  CONTEST_ROWS,
  EMPTY,
  EMPTY_AUDIT,
  FOOD_CONFLICT,
  FULL,
  FULL_AUDIT,
  GRAPHS,
  PEACES,
  STOCK_WALK,
  TABLE,
} from './d5-veil-conflicts.ts';

/** 정상 — 여덟이 한 세계에 서면 다툼이 다섯 선다. */
export const d5SameTargetDifferentConflicts = defineScenario({
  id: 'd5-same-target-different-conflicts',
  module: 'D5',
  kind: 'normal',
  purpose:
    '다섯 종 여덟 주체가 한 겨울에 서면 겹침 열둘 중 다섯만 다툼이 된다 — 넷은 한 몸이 두 곳에 있을 수 없다는 제 안의 다툼이고, 하나는 창고가 바닥나 넷이 같은 고기를 놓고 갈리는 자리다. 나머지 일곱은 겹치지만 다투지 않는다.',
  arrange: () => ({
    audit: AUDIT,
    rows: CONTEST_ROWS,
    table: TABLE,
    bipartite: BIPARTITE,
  }),
  act: ({ audit, rows, table, bipartite }) => ({
    // ① 여덟이 한 세계에 선다
    graphs: GRAPHS.length,
    claims: CLAIMS.length,
    contests: CONTESTS.length,

    // ② 겹침 중 다툼이 되는 것만 갈린다
    conflicts: audit.conflicts,
    opposed: audit.opposed,
    scarcity: audit.scarcity,
    peaces: audit.peaces,
    internal: audit.internal,
    between: audit.between,
    calm: audit.calm,

    // ③ 대표 장면 둘
    food: FOOD_CONFLICT === null ? '' : FOOD_CONFLICT.reason,
    foodSides: FOOD_CONFLICT?.sides.length ?? 0,
    foodNote: FOOD_CONFLICT?.note ?? '',
    body: BODY_CONFLICT === null ? '' : BODY_CONFLICT.reason,
    bodyScope: BODY_CONFLICT?.scope ?? '',
    bodyNote: BODY_CONFLICT?.note ?? '',

    // ④ 다툼마다 까닭이 서고, 겹침마다 판정이 남는다
    verdicts: [...new Set(rows.map((row) => row.verdict))].sort(),
    axes: [...new Set(rows.map((row) => row.axis))].sort(),
    everyRowHasReason: rows.every((row) => row.reason.length > 0),

    // ⑤ 주체마다 무엇에 끼어 있는가
    perSubject: table.map((row) => [row.label, row.conflicts, row.internal, row.between]),

    // ⑥ 이분 그래프 — 선은 언제나 주체에서 대상으로만 간다
    nodes: bipartite.nodes.length,
    edges: bipartite.edges.length,
    subjectsSide: bipartite.nodes.filter((node) => node.kind === 'subject').length,
    onlySubjectToTarget: bipartite.edges.every((edge) => {
      const from = bipartite.nodes.find((node) => node.id === edge.from);
      const to = bipartite.nodes.find((node) => node.id === edge.to);
      return from?.kind === 'subject' && to?.kind !== 'subject';
    }),

    auditViolations: audit.violations.length,
    verdict: conflictFieldVerdict(audit),
  }),
  assert: (result): readonly Assertion[] => [
    expectState('여덟이 한 세계에 선다', 8, result.graphs),
    expectState('요구 쉰하나가 한 평면에 늘어선다', 51, result.claims),
    expectState('그중 열둘이 겹친다', 12, result.contests),
    expectState('다툼이 되는 것은 다섯뿐이다', 5, result.conflicts),
    expectState('넷은 양립 불가고', 4, result.opposed),
    expectState('하나는 모자람이다', 1, result.scarcity),
    expectState('나머지 일곱은 겹치지만 다투지 않는다', 7, result.peaces),
    expectState('넷은 한 주체 안의 다툼이고', 4, result.internal),
    expectState('하나만 주체 사이의 다툼이다', 1, result.between),
    expectState('아무 다툼에도 끼지 않은 주체가 넷 있다', 4, result.calm),
    expectState('넷이 같은 고기를 놓고 갈린다', 'scarcity', result.food),
    expectState('그 다툼에는 넷이 선다', 4, result.foodSides),
    expectTrue(
      '왜 다툼인지가 값으로 남는다 — 있는 것과 필요한 것을 함께 센다',
      result.foodNote.includes('모자라는 만큼이 다툼이다'),
      result.foodNote,
    ),
    expectState('한 몸이 두 곳에 있을 수 없다', 'opposed', result.body),
    expectState('그것은 제 안의 다툼이다', 'internal', result.bodyScope),
    expectTrue(
      'D2 가 D5 에 넘긴 그 자리다',
      result.bodyNote.includes('한 값이 두 곳에 동시에 있을 수는 없다'),
      result.bodyNote,
    ),
    expectState(
      '겹침마다 판정이 남는다 — 다툼이거나, 다툼이 아니거나',
      ['opposed', 'scarcity', '다툼 아님'],
      result.verdicts,
    ),
    expectState('겹침은 두 축에서 난다', ['slot', 'target'], result.axes),
    expectTrue('판정에는 언제나 까닭이 붙는다', result.everyRowHasReason, result.everyRowHasReason),
    expectState(
      '사냥꾼 넷은 제 안의 다툼과 남과의 다툼을 함께 지고, 나머지 넷은 아무 다툼에도 끼지 않는다',
      [
        ['몰이꾼 04', 2, 1, 1],
        ['감춘 몫의 11', 2, 1, 1],
        ['빈손의 07', 2, 1, 1],
        ['사제 09', 2, 1, 1],
        ['장막벌레', 0, 0, 0],
        ['채집 결사', 0, 0, 0],
        ['협곡을 낀 나라', 0, 0, 0],
        ['붉은 장막의 어미', 0, 0, 0],
      ],
      result.perSubject,
    ),
    expectState('이분 그래프의 점은 아홉이고', 9, result.nodes),
    expectState('선은 열둘이며', 12, result.edges),
    expectState('그중 넷이 주체 쪽 열이다', 4, result.subjectsSide),
    expectTrue(
      '선은 언제나 주체에서 대상으로만 간다 — 누가 누구와 싸우는지는 아직 아무도 모른다',
      result.onlySubjectToTarget,
      result.onlySubjectToTarget,
    ),
    expectState('감사가 짚는 어긋남은 없다', 0, result.auditViolations),
    expectState(
      '판정 한 줄이 겹침·다툼·다툼 아닌 것을 함께 센다',
      '겹침 12 · 다툼 5(양립 불가 4 · 모자람 1) · 다툼 아닌 겹침 7 · 주체 안 4 · 사이 1',
      result.verdict,
    ),
    expectDeterministic('같은 세계·같은 그래프면 언제나 같은 다툼이다', () =>
      stateHash(EMPTY.field.conflicts.map(conflictLine)),
    ),
  ],
});

/** 실패 — 아홉이 각자의 사유로 걸린다. */
export const d5GroundlessConflictRejected = defineScenario({
  id: 'd5-groundless-conflict-rejected',
  module: 'D5',
  kind: 'failure',
  purpose:
    '한쪽뿐인 다툼·겹치지도 않은 요구·없는 요구·세계를 보지 않은 모자람·손으로 고친 급함·이기는 자를 적은 다툼·까닭 없는 양립 불가·빠뜨린 다툼·시간을 요구로 세운 것이 각자의 사유로 거부된다.',
  arrange: () => ({ cases: BROKEN_CONFLICTS }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.rules.includes(entry.expected)]),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    winnerMessage: cases.find((entry) => entry.expected === 'winner-declared')?.messages[0] ?? '',
    missingMessage: cases.find((entry) => entry.expected === 'missing-contest')?.messages[0] ?? '',
    driftMessage: cases.find((entry) => entry.expected === 'severity-drift')?.messages[0] ?? '',
    clockMessage: cases.find((entry) => entry.expected === 'clock-claim')?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 아홉이 각자의 사유로 걸린다',
      [
        ['lonely-conflict', true],
        ['unrelated-conflict', true],
        ['phantom-claim', true],
        ['scarcity-without-world', true],
        ['severity-drift', true],
        ['winner-declared', true],
        ['reasonless-conflict', true],
        ['missing-contest', true],
        ['clock-claim', true],
      ],
      result.rules,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '이기는 자를 정하는 것은 D5 가 아니라는 것이 사유에 적힌다',
      result.winnerMessage.includes('E0') && result.winnerMessage.includes('E3'),
      result.winnerMessage,
    ),
    expectTrue(
      '빠뜨린 다툼이 왜 안 되는지가 사유에 적힌다',
      result.missingMessage.includes('다투는데 아무도 모르는 다툼은 없다'),
      result.missingMessage,
    ),
    expectTrue(
      '급함을 D5 가 재지 않는다는 것이 사유에 적힌다',
      result.driftMessage.includes('D5 는 급함을 다시 재지 않는다'),
      result.driftMessage,
    ),
    expectTrue(
      '시간이 왜 요구가 아닌지가 사유에 적힌다',
      result.clockMessage.includes('겹치지도 다투지도 않는다'),
      result.clockMessage,
    ),
  ],
});

/** 경계 — 창고가 비어 가는 걸음, 혼자 선 세계, 빈 충돌장. */
export const d5Boundary = defineScenario({
  id: 'd5-boundary',
  module: 'D5',
  kind: 'boundary',
  purpose:
    '창고가 넉넉하면 같은 것을 원해도 다툼이 아니고, 바닥나는 그 칸에서 다툼이 선다. 혼자 선 세계에도 제 안의 다툼은 남고, 빈 충돌장은 아무 어긋남도 내지 않는다.',
  arrange: () => ({
    walk: STOCK_WALK,
    full: FULL_AUDIT,
    empty: EMPTY_AUDIT,
    alone: ALONE,
    peaces: PEACES,
  }),
  act: ({ walk, full, empty, alone, peaces }) => ({
    // ① 창고가 비어 가는 걸음 — 어느 칸에서 다툼이 서는가
    walk: walk.map((step) => [step.stock, step.conflicts, step.scarcity, step.peaces]),
    born: walk.find((step) => step.scarcity > 0)?.stock ?? -1,

    // ② 가득한 겨울과 바닥난 겨울 — 겹침은 그대로인데 다툼만 갈린다
    fullConflicts: full.conflicts,
    fullPeaces: full.peaces,
    sameContests: full.contests === AUDIT.contests,
    fullComplete: full.complete,

    // ③ 혼자 선 세계 — 남과의 다툼만 사라진다
    aloneContests: alone.contests.length,
    aloneConflicts: alone.field.conflicts.length,
    aloneScopes: [...new Set(alone.field.conflicts.map((conflict) => conflict.scope))],

    // ④ 다툼이 되지 못한 겹침에는 저마다 사유가 있다
    peaceReasons: [
      ...new Set(
        peaces.map((peace) =>
          peace.reason.includes('W 계층으로 유예')
            ? '수용량이 없다 (유예)'
            : peace.reason.includes('모자라지 않으면')
              ? '모자라지 않는다'
              : peace.reason.includes('대역이 함께 설 수 있다')
                ? '대역이 함께 선다'
                : '수로 적히지 않았다',
        ),
      ),
    ].sort(),

    // ⑤ 빈 충돌장
    emptyConflicts: empty.conflicts,
    emptyComplete: empty.complete,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '창고가 비어 가면 어느 칸에서 다툼이 하나 는다',
      [
        [10, 4, 0, 8],
        [6, 4, 0, 8],
        [4, 4, 0, 8],
        [2, 5, 1, 7],
        [0, 5, 1, 7],
      ],
      result.walk,
    ),
    expectState('넷의 요구 합(12)이 세계에 있는 것을 넘어서는 칸이 그 자리다', 2, result.born),
    expectState('가득한 겨울에는 다툼이 넷이고', 4, result.fullConflicts),
    expectState('다툼 아닌 겹침이 여덟이다', 8, result.fullPeaces),
    expectTrue('겹침 자체는 그대로다 — 갈리는 것은 판정뿐이다', result.sameContests, result.sameContests),
    expectTrue('가득한 겨울도 그대로 감사를 지난다', result.fullComplete, result.fullComplete),
    expectState('혼자 선 세계에도 겹침이 하나 남고', 1, result.aloneContests),
    expectState('그것은 다툼이다', 1, result.aloneConflicts),
    expectState(
      '남과의 다툼만 사라진다 — 제 안의 다툼은 혼자여도 남는다',
      ['internal'],
      result.aloneScopes,
    ),
    expectState(
      '다툼이 되지 못한 겹침에는 저마다 사유가 있다',
      ['대역이 함께 선다', '수로 적히지 않았다', '수용량이 없다 (유예)'],
      result.peaceReasons,
    ),
    expectState('빈 충돌장은 아무것도 담지 않고', 0, result.emptyConflicts),
    expectTrue('그대로 감사를 지난다', result.emptyComplete, result.emptyComplete),
  ],
});

export const d5Scenarios = [
  d5SameTargetDifferentConflicts,
  d5GroundlessConflictRejected,
  d5Boundary,
];
