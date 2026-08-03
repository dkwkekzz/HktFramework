// P3 검증 시나리오 3종 — 지금 걸린 것만 펴는가, 근거가 거짓이면 막는가, 아무것도 못 봐도 서는가.

import { stateHash } from '@hkt/core/v1';
import { ACTION_ATOMS } from '@hkt/core/p0';
import {
  buildContext,
  checkPrerequisites,
  checkSubgraph,
  contextVerdict,
  expandSubgraph,
  prerequisiteVerdict,
  sourcesBefore,
  subgraphVerdict,
  UNSOURCED_SLOTS,
} from '@hkt/core/p3';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BLIND,
  CRISIS_TICK,
  EXPANSION_CASES,
  REMEMBERING,
  SCENE_WORLD,
  SEEING,
  TOXIN_CLAIM,
  TRACKER_GRAPH,
  trackerGrammar,
  trackerInstance,
  trackerNarrowed,
  UNKNOWING_BLIND,
  UNKNOWING_REMEMBERING,
} from './p3-veil-expansion.ts';

/** 정상 — 같은 갈래를 놓고 본 것이 다르면 펴는 자리가 다르다. */
export const p3ExpandsRelevantOnly = defineScenario({
  id: 'p3-expands-relevant-only',
  module: 'P3',
  kind: 'normal',
  purpose:
    '원자 선행이 P0 걸림에서 계산되고, 같은 갈래 앞에서 본 것이 다른 셋이 서로 다른 부분만 펴며, 기억으로만 아는 자에게는 찾기가 선행으로 걸린다.',
  arrange: () => ({ cases: EXPANSION_CASES, unknowing: UNKNOWING_REMEMBERING }),
  act: ({ cases, unknowing }) => {
    const prerequisites = checkPrerequisites();
    return {
      // ① 선행은 세계를 보지 않고도 선다 (P3-a)
      roots: prerequisites.roots,
      waves: prerequisites.waves.map((wave) => wave.length),
      lastWave: prerequisites.waves.at(-1) ?? [],
      waived: prerequisites.waivedSlots,
      seizeNeeds: sourcesBefore('seize'),
      prerequisiteVerdict: prerequisiteVerdict(prerequisites),

      // ② 같은 갈래, 다른 근거 (P3-b·c)
      byContext: cases.map((entry) => ({
        label: entry.label,
        seen: entry.context.seen.length,
        remembered: entry.context.remembered.length,
        placed: entry.subgraph.all.length,
        expanded: entry.subgraph.trace.expanded,
      })),

      // ③ 모르는 자에게만 정보 갈래가 서고, 그것이 찾기를 낸다
      unknowing: {
        placed: unknowing.subgraph.all.length,
        expanded: unknowing.subgraph.trace.expanded,
        withPrecondition: unknowing.subgraph.active.filter(
          (possibility) => possibility.preconditionIds.length > 0,
        ).length,
        supplierAtoms:
          unknowing.subgraph.active.find(
            (possibility) =>
              possibility.id === unknowing.subgraph.active.find(
                (candidate) => candidate.preconditionIds.length > 0,
              )?.preconditionIds[0],
          )?.atoms ?? [],
      },
      verdict: subgraphVerdict(unknowing.subgraph),
      contextVerdict: contextVerdict(unknowing.context),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('뿌리는 찾다 하나뿐이다', ['seek'], result.roots),
    expectState('열여섯이 물결 넷으로 선다', [1, 7, 4, 4], result.waves),
    expectState(
      '마지막에 서는 넷은 남과 등지는 것들이다 — 쌓인 것이 있어야 치를 수 있다',
      ['seize', 'persuade', 'coerce', 'betray'],
      result.lastWave,
    ),
    expectState(
      '행동 밖에서 오는 자리는 넷이다 — 몸·의념·빚·정당성',
      [
        'biological.vitality',
        'psychic.energy',
        'relational.debt.{subject}',
        'transcendent.legitimacy',
      ],
      result.waived,
    ),
    expectTrue('먼저 찾아야 빼앗을 수 있다', result.seizeNeeds.includes('seek'), result.seizeNeeds),
    expectState(
      '같은 갈래 아홉을 놓고 본 자만 전부 편다 — 아는 자는 기억에 갇힌다',
      [
        { label: '지금 보는 04', seen: 3, remembered: 0, placed: 9, expanded: 9 },
        { label: '기억으로만 아는 04', seen: 1, remembered: 2, placed: 9, expanded: 0 },
        { label: '아무것도 못 본 04', seen: 1, remembered: 0, placed: 9, expanded: 0 },
      ],
      result.byContext,
    ),
    expectState('모르는 04 에게는 정보 갈래가 서서 열셋이 놓인다', 13, result.unknowing.placed),
    expectState('그중 열을 펴고 아홉에 선행이 걸린다', 10, result.unknowing.expanded),
    expectState('선행이 걸린 것은 아홉이다', 9, result.unknowing.withPrecondition),
    expectState('그 선행을 대는 갈래가 내는 것은 찾기다', ['seek', 'exchange'], result.unknowing.supplierAtoms),
    expectDeterministic('같은 재료면 같은 부분 그래프다', () =>
      stateHash(
        expandSubgraph({
          tree: trackerNarrowed,
          graph: TRACKER_GRAPH,
          context: SEEING,
        }),
      ),
    ),
  ],
});

/** 실패 — 근거가 거짓이면 부분 그래프가 서지 않는다. */
export const p3BrokenExpansionRejected = defineScenario({
  id: 'p3-broken-expansion-rejected',
  module: 'P3',
  kind: 'failure',
  purpose:
    '세계에 없는 자리를 봤다는 주장·아직 오지 않은 기억·배정 없는 능력·세계에 서지 않은 주체·그래프에 없는 노드의 갈래·서지 않은 것을 가리키는 선행이 각각의 사유로 거부된다.',
  arrange: () => ({
    world: SCENE_WORLD.world,
    grammar: trackerGrammar,
    subjectId: trackerInstance.id,
    tick: CRISIS_TICK,
  }),
  act: (base) => {
    const rulesOf = (spec: Parameters<typeof buildContext>[0]): readonly string[] => [
      ...new Set(buildContext(spec).violations.map((violation) => violation.rule)),
    ];
    const stripped = {
      ...TRACKER_GRAPH,
      nodes: TRACKER_GRAPH.nodes.filter((node) => node.label !== '겨울 식량'),
    };
    const broken = expandSubgraph({
      tree: trackerNarrowed,
      graph: stripped,
      context: SEEING,
    });
    const sample = EXPANSION_CASES[0]?.subgraph;
    const first = sample?.active[0];
    const dangling =
      sample === undefined || first === undefined
        ? []
        : checkSubgraph({
            ...sample,
            active: [{ ...first, preconditionIds: ['possibility:없는것'] }],
          });
    return {
      phantomPercept: rulesOf({
        ...base,
        percepts: [{ holderId: trackerInstance.id, domain: 'economic', path: 'stock.없는것' }],
      }),
      futureMemory: rulesOf({
        ...base,
        memories: [
          {
            holderId: trackerInstance.id,
            domain: 'biological',
            path: 'hunger',
            value: 0.1,
            asOfTick: base.tick + 1,
          },
        ],
      }),
      ungrantedCapability: rulesOf({ ...base, capabilities: ['rule:없는능력'] }),
      absentSubject: rulesOf({ ...base, subjectId: 'subject:세계에없는것' }),
      unknownNode: [...new Set(broken.violations.map((violation) => violation.rule))],
      dangling: dangling.map((violation) => violation.rule),
      // 거부돼도 던지지 않는다 — 사유가 값으로 남는다
      messages: broken.violations.map((violation) => violation.message.slice(0, 20)),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('세계에 없는 자리를 본다고 하면 걸린다', ['phantom-percept'], result.phantomPercept),
    expectState('아직 오지 않은 것은 기억이 아니다', ['future-memory'], result.futureMemory),
    expectState('배정 없는 능력은 이름뿐이다', ['ungranted-capability'], result.ungrantedCapability),
    expectState('세계에 서 있지 않은 주체는 아무것도 딛지 못한다', ['absent-subject'], result.absentSubject),
    expectState('그래프에 없는 노드의 갈래는 대상을 물을 수 없다', ['unknown-branch-node'], result.unknownNode),
    expectState('서지 않은 것에 기대어 설 수는 없다', ['dangling-precondition'], result.dangling),
    expectTrue('거부는 사유와 함께 남는다', result.messages.length > 0, result.messages),
  ],
});

/** 경계 — 아무것도 못 봐도 찾는 것은 할 수 있다. */
export const p3Boundary = defineScenario({
  id: 'p3-boundary',
  module: 'P3',
  kind: 'boundary',
  purpose:
    '아무것도 보지 못한 주체에게도 근거는 서고(자기 자신), 모르는 자에게는 찾기 하나가 남으며, 기억이 세계와 어긋나도 거부되지 않고 stale 로 남는다.',
  arrange: () => ({ blind: UNKNOWING_BLIND, knowing: EXPANSION_CASES[2] }),
  act: ({ blind, knowing }) => ({
    // ① 아무것도 못 본 주체의 근거 — 자기 자신 하나
    blindSeen: BLIND.seen.length,
    blindComplete: BLIND.complete,
    blindCounterparts: BLIND.counterparts.length,

    // ② 모르는 자에게 남는 길 하나 — 찾기
    onlyPath: blind.subgraph.active.map((possibility) => possibility.atoms),
    onlyReason: blind.subgraph.trace.entries.find((entry) => entry.active)?.reason ?? null,
    greyKept: blind.subgraph.all.length,

    // ③ 아는 자에게는 그 하나도 없다 — 정보 갈래가 서지 않았기 때문이다
    knowingExpanded: knowing?.subgraph.trace.expanded ?? -1,

    // ④ 어긋난 기억은 거부되지 않는다
    staleCount: REMEMBERING.staleFacts.length,
    staleComplete: REMEMBERING.complete,

    // ⑤ 예외로 선언된 자리와 원자 수는 세계와 무관하게 고정이다
    atoms: ACTION_ATOMS.length,
    exceptions: UNSOURCED_SLOTS.length,
    toxinClaim: TOXIN_CLAIM !== '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState('아무것도 못 봐도 자기 자신은 보인다', 1, result.blindSeen),
    expectTrue('그것만으로도 근거는 온전하다', result.blindComplete, result.blindSeen),
    expectState('사이는 보지 않아도 세계에 적혀 있다', 1, result.blindCounterparts),
    expectState('모르는 자에게 남는 길은 찾기 하나다', [['seek', 'exchange']], result.onlyPath),
    expectState('그것이 보지 않고 낼 수 있는 갈래이기 때문이다', 'blind', result.onlyReason),
    expectState('나머지 열둘은 사라지지 않고 회색으로 남는다', 13, result.greyKept),
    expectState('아는 자에게는 그 하나도 없다 — 정보 갈래가 서지 않았다', 0, result.knowingExpanded),
    expectState('어긋난 기억 둘이 stale 로 남는다', 2, result.staleCount),
    expectTrue('어긋나도 거부되지 않는다 — R4 가 갚을 자리다', result.staleComplete, result.staleCount),
    expectState('원자는 열여섯이다', 16, result.atoms),
    expectState('행동 밖에서 오는 자리는 넷이다', 4, result.exceptions),
    expectTrue('마비독 감별은 세계에 실재하는 앎이다', result.toxinClaim, result.toxinClaim),
  ],
});

export const p3Scenarios = [p3ExpandsRelevantOnly, p3BrokenExpansionRejected, p3Boundary];
