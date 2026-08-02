// P0 검증 장면 — 굶주림 하나 앞에 열여섯이 놓이고, 그중 지금 낼 수 있는 것은 몇 개뿐이다.
//
// D4 에서 세계는 처음으로 값을 가졌다. 창고가 비어 가고 압력이 오른다 — 그런데 아무도 움직이지
// 않는다. 무엇을 할 수 있는지가 없었기 때문이다. 이 장면이 그 자리를 채운다.
//
// 세 가지를 보인다.
//
//   ① **같은 결핍 앞에 열여섯이 다 놓이지는 않는다.** 겨울 식량(자원 의존)을 채우는 원자는 넷이고
//      지키는 것이 둘, 벗어나는 것이 셋이다. 나머지 일곱은 이 결핍과 무관하다.
//   ② **놓인 원자를 다 낼 수 있는 것도 아니다.** 원자는 저마다 치를 자리를 요구하고, 그 자리에
//      값이 없으면 그 길은 없는 길이다 — 여기서 P0 문법과 D4 세계가 만난다.
//   ③ **같은 굶주림인데 넷이 다른 길을 갖는다.** 사제는 의념을 치를 수 있어 갈아탈 수 있고,
//      빚진 몰이꾼은 마을의 신뢰가 얇아 설득이 비싸다.
//
// 세계의 지금을 읽는 것(②③)은 P0 의 일이 아니다 — P0 는 문법만 확정하고, 세계와 맞대는 것은
// 이 장면(그리고 뒤에 올 P3)의 몫이다. 여기서는 둘이 실제로 맞물리는지를 눈으로 확인한다.

import type { Id } from '@hkt/core/v1';
import { matchPath, worldSlots } from '@hkt/core/o2';
import type { DependencyKind } from '@hkt/core/d0';
import type { DependencyGraph, DependencyNode } from '@hkt/core/d1';
import { evaluatePressure, withSlot, type WorldSnapshot } from '@hkt/core/d4';
import {
  ACTION_ATOMS,
  atomGrounding,
  atomLabel,
  atomsFilling,
  ATOM_GROUNDINGS,
  type ActionAtom,
  type ActionProposal,
  type AtomBearing,
  type AtomGrounding,
  type SlotRef,
} from '@hkt/core/p0';

import {
  bareInstance,
  greedyInstance,
  NOW,
  personalGraphOf,
  priestInstance,
  sinceFor,
  trackerGraph,
  trackerInstance,
  VEIL_INSTANCES,
  villagersId,
  worldAt,
  canyonId,
  meatId,
} from './d4-veil-world.ts';
import { partnerId } from './s3-veil-instances.ts';

export {
  bareInstance,
  greedyInstance,
  NOW,
  priestInstance,
  trackerGraph,
  trackerInstance,
  VEIL_INSTANCES,
  villagersId,
  canyonId,
  meatId,
  worldAt,
};

/** 창고가 바닥나고 사흘이 지난 그때 — 굶주림이 위기로 올라선 시각. */
export const CRISIS_TICK = NOW + 21;

/**
 * 그때의 세계 — 창고는 비었고 넷이 각자 다른 것을 손에 쥐고 있다.
 *
 * D4 의 장면은 넷에게 같은 값을 주었다(그때 보려던 것은 압력이 오르는 줄이었다). 여기서 보려는
 * 것은 **같은 굶주림 앞에서 길이 갈리는가** 이므로, 손에 쥔 것을 개체마다 다르게 둔다:
 *   04 는 빚 40 이 마을의 신뢰를 다 갉아먹었고, 11 은 제 몫을 감춰 두었고,
 *   23 은 아무것도 없고, 31 만 의념이 남아 있다.
 */
export const CRISIS_WORLD: WorldSnapshot = [
  // 의념은 사제에게만 남아 있다 — 벗어나는 길 셋의 대가가 여기서 갈린다.
  ...VEIL_INSTANCES.filter((instance) => instance.id !== priestInstance.id).map((instance) => ({
    domain: 'psychic' as const,
    holderId: instance.id,
    path: 'energy',
    value: 0,
  })),
  // 빚진 04 의 말은 마을에서 값을 잃었다.
  { domain: 'relational' as const, holderId: trackerInstance.id, path: `trust.${villagersId}`, value: 0 },
  // 욕심 많은 11 은 제 몫 둘을 감춰 두었다.
  { domain: 'economic' as const, holderId: greedyInstance.id, path: `stock.${meatId}`, value: 2 },
].reduce<WorldSnapshot>(
  (snapshot, slot) => withSlot(snapshot, slot, CRISIS_TICK).snapshot,
  worldAt(CRISIS_TICK, 0),
);

/** 몰이꾼 04 의 지금 압력 — 어느 의존이 가장 급한가. */
export const CRISIS_PRESSURE = evaluatePressure(trackerGraph, CRISIS_WORLD, {
  since: sinceFor(trackerGraph),
});

/** 굶주림 사슬에서 자원 의존 노드 하나 — 겨울 식량. */
export function foodNode(graph: DependencyGraph = trackerGraph): DependencyNode {
  return graph.nodes.find((node) => node.label === '겨울 식량') as DependencyNode;
}

/** 결핍 하나 앞에 놓이는 길 — 원자와 그것이 하는 일. */
export interface OpenPath {
  readonly atom: ActionAtom;
  readonly label: string;
  readonly bearing: AtomBearing;
  /** 무엇을 치러야 하는가 */
  readonly pays: readonly SlotRef[];
}

/** 그 종의 의존 앞에 놓이는 길들 — 채우거나 지키거나 지우거나 벗어난다. */
export function pathsFor(kind: DependencyKind): readonly OpenPath[] {
  return ATOM_GROUNDINGS.filter(
    (entry) => entry.bearing === 'escape' || entry.kinds.includes(kind),
  ).map((entry) => ({
    atom: entry.atom,
    label: atomLabel(entry.atom),
    bearing: entry.bearing,
    pays: entry.pays,
  }));
}

/** 이 결핍과 무관한 원자들 — 굶주림 앞에 놓이지 않는 길. */
export function closedFor(kind: DependencyKind): readonly ActionAtom[] {
  const open = new Set(pathsFor(kind).map((path) => path.atom));
  return ACTION_ATOMS.filter((atom) => !open.has(atom));
}

/** 그 자리에 지금 값이 있는가 — 패턴 자리는 아무 하나라도 차 있으면 있다고 본다. */
function hasValue(snapshot: WorldSnapshot, holderId: Id, ref: SlotRef): boolean {
  return worldSlots(snapshot.world).some((entry) => {
    if (entry.domain !== ref.domain || entry.ofId !== holderId) return false;
    if (matchPath(ref.path, entry.path) === null) return false;
    return entry.value !== 0 && entry.value !== false;
  });
}

/** 지금 이 주체가 그 원자의 대가를 낼 자리를 갖고 있는가. */
export function canPay(
  snapshot: WorldSnapshot,
  actorId: Id,
  grounding: AtomGrounding,
): boolean {
  return grounding.pays.every((ref) => hasValue(snapshot, actorId, ref));
}

/** 한 주체 앞에 실제로 열린 길 — 문법이 놓고(P0) 세계가 고른다(D4). */
export function payablePaths(
  snapshot: WorldSnapshot,
  actorId: Id,
  kind: DependencyKind,
): readonly ActionAtom[] {
  return pathsFor(kind)
    .filter((path) => canPay(snapshot, actorId, atomGrounding(path.atom) as AtomGrounding))
    .map((path) => path.atom);
}

const toxinClaimId = trackerGraph.nodes.find((node) => node.kind === 'information')?.target?.id ?? '';
const nestClaimId = 'claim:000000000000';

/** 04 가 낼 수 있는 요청들 — 굶주림 앞의 네 갈래. */
export interface NamedProposal {
  readonly label: string;
  readonly telling: string;
  readonly proposal: ActionProposal;
}

const tracker = trackerInstance.id;

export const VEIL_PROPOSALS: readonly NamedProposal[] = [
  {
    label: '붉은 빛이 걷힌 자국을 따라 둥지를 찾는다',
    telling: '아직 아무것도 보지 못한 채로 낼 수 있는 유일한 요청 — 보는 일 자체를 만드는 원자다',
    proposal: {
      atom: 'seek',
      actorId: tracker,
      targetIds: [canyonId],
      changes: [{ domain: 'informational', holderId: tracker, path: `knows.${nestClaimId}` }],
      payments: [{ domain: 'biological', holderId: tracker, path: 'vitality' }],
      observedIds: [],
    },
  },
  {
    label: '협곡으로 들어가 사체에서 고기를 떼어 온다',
    telling: '주인 없는 것을 가져온다 — 치르는 것은 제 몸뿐이다',
    proposal: {
      atom: 'acquire',
      actorId: tracker,
      targetIds: [canyonId],
      changes: [
        { domain: 'economic', holderId: tracker, path: `stock.${meatId}` },
        { domain: 'physical', holderId: tracker, path: 'region' },
      ],
      payments: [{ domain: 'biological', holderId: tracker, path: 'vitality' }],
      observedIds: [canyonId, meatId],
    },
  },
  {
    label: '마을에 겨울을 넘길 방법을 설명하고 창고를 열게 한다',
    telling: '말이 값을 갖는 것은 신뢰가 있기 때문이다 — 그 신뢰를 청구한다',
    proposal: {
      atom: 'persuade',
      actorId: tracker,
      targetIds: [villagersId],
      changes: [
        { domain: 'informational', holderId: villagersId, path: `knows.${toxinClaimId}` },
        { domain: 'relational', holderId: villagersId, path: `reliance.${tracker}` },
      ],
      payments: [{ domain: 'relational', holderId: tracker, path: `trust.${villagersId}` }],
      observedIds: [villagersId],
    },
  },
  {
    label: '짝과 등을 맡기고 잡은 것을 나누기로 한다',
    telling: '아직 치르지 않은 것을 걸어 둘을 묶는다 — 약속은 미래의 빚이다',
    proposal: {
      atom: 'ally',
      actorId: tracker,
      targetIds: [partnerId],
      changes: [
        { domain: 'relational', holderId: tracker, path: `belongsTo.${partnerId}` },
        { domain: 'relational', holderId: tracker, path: `debt.${partnerId}` },
      ],
      payments: [{ domain: 'relational', holderId: tracker, path: `debt.${partnerId}` }],
      observedIds: [partnerId],
    },
  },
  {
    label: '오래 굶은 몸의 대사를 늦춘다',
    telling: '채우지 않고 덜 쓴다 — 대상도 상대도 없는 유일한 갈래다',
    proposal: {
      atom: 'adapt',
      actorId: tracker,
      targetIds: [],
      changes: [{ domain: 'biological', holderId: tracker, path: 'metabolism' }],
      payments: [
        { domain: 'biological', holderId: tracker, path: 'vitality' },
        { domain: 'psychic', holderId: tracker, path: 'energy' },
      ],
      observedIds: [],
    },
  },
];

/** 설 수 없는 요청 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenProposal {
  readonly broke: string;
  readonly expected: string;
  readonly proposal: ActionProposal;
}

const acquireBase = VEIL_PROPOSALS[1]?.proposal as ActionProposal;
const persuadeBase = VEIL_PROPOSALS[2]?.proposal as ActionProposal;

/** 설 수 없는 요청 아홉 — 사유마다 하나씩. */
export const BROKEN_PROPOSALS: readonly BrokenProposal[] = [
  {
    broke: '"사냥한다" 를 그대로 행동으로 적었다',
    expected: 'unknown-action',
    proposal: { ...acquireBase, atom: 'hunt' },
  },
  {
    broke: '아무 자리도 바꾸지 않겠다고 적었다',
    expected: 'changeless-action',
    proposal: { ...acquireBase, changes: [] },
  },
  {
    broke: '획득으로 남의 몸을 깎으려 한다',
    expected: 'off-atom-change',
    proposal: {
      ...acquireBase,
      changes: [{ domain: 'biological', holderId: partnerId, path: 'vitality' }],
      observedIds: [...acquireBase.observedIds, partnerId],
    },
  },
  {
    broke: '세계에 없는 자리를 바꾸겠다고 적었다',
    expected: 'phantom-slot',
    proposal: {
      ...acquireBase,
      changes: [{ domain: 'economic', holderId: tracker, path: 'karma' }],
    },
  },
  {
    broke: '대가를 적지 않았다',
    expected: 'unpaid-action',
    proposal: { ...acquireBase, payments: [] },
  },
  {
    broke: '설득의 대가로 신뢰가 아니라 제 체력을 내밀었다',
    expected: 'off-atom-payment',
    proposal: {
      ...persuadeBase,
      payments: [{ domain: 'biological', holderId: tracker, path: 'vitality' }],
    },
  },
  {
    broke: '설득할 상대를 적지 않았다',
    expected: 'targetless-action',
    proposal: { ...persuadeBase, targetIds: [] },
  },
  {
    broke: '남을 대신 적응시키려 한다',
    expected: 'self-atom-on-other',
    proposal: {
      atom: 'adapt',
      actorId: tracker,
      targetIds: [partnerId],
      changes: [{ domain: 'biological', holderId: partnerId, path: 'metabolism' }],
      payments: [{ domain: 'biological', holderId: tracker, path: 'vitality' }],
      observedIds: [partnerId],
    },
  },
  {
    broke: '아직 찾지 못한 둥지의 고기를 빼앗으려 한다',
    expected: 'unobserved-action',
    proposal: {
      atom: 'seize',
      actorId: tracker,
      targetIds: [partnerId],
      changes: [{ domain: 'economic', holderId: partnerId, path: `stock.${meatId}` }],
      payments: [{ domain: 'relational', holderId: tracker, path: `trust.${partnerId}` }],
      observedIds: [],
    },
  },
];

/** 아직 아무도 적지 않은 앎 — 둥지가 어디 있는가. 찾다가 채우는 자리다. */
export const UNSEEN_CLAIM_ID = nestClaimId;

/** 개체 넷이 굶주림 앞에서 갖는 길 — 같은 결핍, 다른 갈래. */
export interface SubjectPaths {
  readonly label: string;
  readonly subjectId: Id;
  /** 문법이 놓는 길 (채우는 원자만) */
  readonly filling: readonly ActionAtom[];
  /** 그중 지금 대가를 낼 수 있는 것 */
  readonly payable: readonly ActionAtom[];
  /** 벗어나는 길 중 지금 낼 수 있는 것 */
  readonly escapes: readonly ActionAtom[];
}

const LABELS: Readonly<Record<string, string>> = {
  [trackerInstance.id]: '몰이꾼 04 (빚 40)',
  [greedyInstance.id]: '몰이꾼 11 (욕심)',
  [bareInstance.id]: '몰이꾼 23 (맨몸)',
  [priestInstance.id]: '사제 31 (의념 200)',
};

/** 네 개체가 같은 굶주림 앞에서 갖는 길을 잰다. */
export function subjectPaths(snapshot: WorldSnapshot = CRISIS_WORLD): readonly SubjectPaths[] {
  return VEIL_INSTANCES.map((instance) => {
    const payable = payablePaths(snapshot, instance.id, 'resource');
    return {
      label: LABELS[instance.id] ?? instance.id,
      subjectId: instance.id,
      filling: atomsFilling('resource'),
      payable: payable.filter((atom) => atomsFilling('resource').includes(atom)),
      escapes: payable.filter(
        (atom) => atomGrounding(atom)?.bearing === 'escape',
      ),
    };
  });
}

/** 개체의 개인 그래프 — 화면이 압력과 길을 나란히 세울 때 쓴다. */
export function graphOf(instance: typeof trackerInstance): DependencyGraph {
  return personalGraphOf(instance);
}
