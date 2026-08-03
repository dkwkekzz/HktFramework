// P3 검증 장면 — 같은 겨울, 같은 갈래. 본 것이 다르면 펴는 자리가 다르다.
//
// P2 의 장면은 "손이 다르면 어떻게 되는가" 를 물었다. 이 장면이 묻는 것은 그 다음이다 —
// **손이 같아도 본 것이 다르면 어떻게 되는가.**
//
//   ① 몰이꾼 04 하나를 셋으로 나눈다: 겨울 식량을 지금 보는 04 · 기억으로만 아는 04 ·
//      아무것도 못 본 04. 셋의 갈래는 완전히 같고 근거만 다르다.
//   ② 그리고 세계를 하나 더 둔다 — **마비독을 모르는 04.** 아는 04 에게는 서지 않던
//      정보 갈래가 서고, 그 갈래가 찾기를 낸다. 모르는 자에게만 찾기가 열린다.
//   ③ 원자 선행(P3-a)은 세계를 보지 않고도 서는 표다 — 뿌리 하나에서 물결 넷.

import { readSlot, type WorldState } from '@hkt/core/o2';
import { evaluatePressure, withSlot } from '@hkt/core/d4';
import { expandStrategies } from '@hkt/core/p1';
import { narrowTree, type NarrowedTree, type PossibilityGrammar } from '@hkt/core/p2';
import {
  buildContext,
  expandSubgraph,
  type ExpansionContext,
  type MemoryClaim,
  type PerceptClaim,
  type PossibilitySubgraph,
} from '@hkt/core/p3';

import { personalGraphOf, sinceFor, trackerInstance } from './d4-veil-world.ts';
import { CRISIS_TICK, CRISIS_WORLD } from './p0-veil-actions.ts';
import { CULTURE_CASES, trackerNarrowed, VEIL_GRANTS } from './p2-veil-grammars.ts';

/** 몰이꾼 04 의 문법 — P2 가 세운 것을 그대로 쓴다. */
export const trackerGrammar = CULTURE_CASES[0]?.grammar as PossibilityGrammar;

export { CRISIS_TICK, trackerInstance, trackerNarrowed };

/** 몰이꾼 04 의 의존 그래프 — 갈래가 어느 대상을 두고 선 것인지 여기서 읽는다. */
export const TRACKER_GRAPH = personalGraphOf(trackerInstance);

const nodeTarget = (label: string): string =>
  TRACKER_GRAPH.nodes.find((node) => node.label === label)?.target?.id ?? '';

/** 겨울 식량이 가리키는 것 (협곡의 고기) · 겨울 움막 · 마비독 감별의 앎. */
export const MEAT_TARGET = nodeTarget('겨울 식량');
export const HUT_TARGET = nodeTarget('겨울 움막');
export const TOXIN_CLAIM = nodeTarget('마비독 감별');

/**
 * 장면의 세계 — 위기의 세계에 **대상들의 자리**를 얹은 것.
 *
 * D4·P1·P2 의 장면까지는 주체의 값만 있으면 됐다. P3 은 처음으로 "그 대상이 지금 보이는가" 를
 * 묻기 때문에, 대상 자신이 세계에 자리를 가져야 한다 — 자리가 없으면 볼 것도 없다.
 */
export const SCENE_WORLD = [
  { domain: 'physical' as const, holderId: MEAT_TARGET, path: 'integrity', value: 0.6 },
  { domain: 'physical' as const, holderId: HUT_TARGET, path: 'cover', value: 0.4 },
].reduce((snapshot, slot) => withSlot(snapshot, slot, CRISIS_TICK).snapshot, CRISIS_WORLD);

const world: WorldState = SCENE_WORLD.world;

/** 04 가 볼 수 있는 것 둘 — 협곡의 고기와 겨울 움막. */
const percepts: readonly PerceptClaim[] = [
  { holderId: MEAT_TARGET, domain: 'physical', path: 'integrity' },
  { holderId: HUT_TARGET, domain: 'physical', path: 'cover' },
];

/** 같은 둘을 서른 틱 전의 값으로 기억한다 — 지금과 어긋나므로 stale 로 선다. */
const memories: readonly MemoryClaim[] = percepts.map((claim) => ({
  ...claim,
  value: (readSlot(world, claim.domain, claim.holderId, claim.path) as number) + 0.3,
  asOfTick: CRISIS_TICK - 30,
}));

const contextOf = (
  seen: readonly PerceptClaim[],
  remembered: readonly MemoryClaim[],
): ExpansionContext =>
  buildContext({
    subjectId: trackerInstance.id,
    tick: CRISIS_TICK,
    world,
    grammar: trackerGrammar,
    percepts: seen,
    memories: remembered,
    capabilities: [],
    grants: VEIL_GRANTS,
  });

/** 같은 04 를 셋으로 나눈다 — 갈래는 같고 근거만 다르다. */
export interface ExpansionCase {
  readonly label: string;
  readonly tells: string;
  readonly context: ExpansionContext;
  readonly subgraph: PossibilitySubgraph;
}

const caseOf = (
  label: string,
  tells: string,
  context: ExpansionContext,
  tree: NarrowedTree = trackerNarrowed,
  graph = TRACKER_GRAPH,
): ExpansionCase => ({
  label,
  tells,
  context,
  subgraph: expandSubgraph({ tree, graph, context }),
});

export const SEEING = contextOf(percepts, []);
export const REMEMBERING = contextOf([], memories);
export const BLIND = contextOf([], []);

export const EXPANSION_CASES: readonly ExpansionCase[] = [
  caseOf('지금 보는 04', '협곡의 고기와 움막이 눈앞에 있다', SEEING),
  caseOf('기억으로만 아는 04', '서른 틱 전에 본 것이 전부다', REMEMBERING),
  caseOf('아무것도 못 본 04', '창고가 비었다는 것 말고는 아는 것이 없다', BLIND),
];

/**
 * 마비독을 **모르는** 04 의 세계.
 *
 * 아는 04 에게 마비독 감별은 채워진 의존이라 갈래가 서지 않았다. 모르면 그 자리가 비고,
 * 비로소 **찾기를 내는 갈래**가 선다 — 모르는 자에게만 찾기가 열린다.
 */
export const UNKNOWING_WORLD = withSlot(
  SCENE_WORLD,
  {
    domain: 'informational',
    holderId: trackerInstance.id,
    path: `knows.${TOXIN_CLAIM}`,
    value: false,
  },
  CRISIS_TICK,
).snapshot;

export const UNKNOWING_TREE: NarrowedTree = narrowTree(
  expandStrategies(
    TRACKER_GRAPH,
    evaluatePressure(TRACKER_GRAPH, UNKNOWING_WORLD, { since: sinceFor(TRACKER_GRAPH) }),
    {},
  ),
  trackerGrammar,
);

/** 모르는 04 가 기억으로만 아는 경우 — 찾기가 선행으로 걸린다. */
export const UNKNOWING_REMEMBERING = caseOf(
  '모르는 04 · 기억으로만',
  '마비독을 모르니 정보 갈래가 서고, 그것이 찾기를 낸다',
  contextOf([], memories),
  UNKNOWING_TREE,
);

/** 모르는 04 가 아무것도 못 본 경우 — 남는 것은 찾기뿐이다. */
export const UNKNOWING_BLIND = caseOf(
  '모르는 04 · 아무것도',
  '아무것도 못 봐도 찾는 것은 할 수 있다',
  BLIND,
  UNKNOWING_TREE,
);
