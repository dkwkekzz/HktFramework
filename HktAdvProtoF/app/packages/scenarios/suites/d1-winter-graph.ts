// D1 검증 장면 — 몰이꾼 04 의 겨울 그래프.
//
// D0 는 굶주림 앞에 열한 갈래가 있다는 것까지 보였다. 그러나 갈래의 목록은 아직 그래프가
// 아니다. 이 장면이 세우는 것은 **하나의 무너짐에서 뻗어 나간 사슬**이다.
//
//   주린 몸 ──consumes──▶ 겨울 식량 ──requires──▶ 사냥터 ──authorized_by──▶ 고개 통행권
//                                                     └──sustained_by──▶ 장막 주기
//                              └──informed_by──▶ 마비독 감별
//                              └──produced_by──▶ 행상의 신뢰
//
// 뿌리는 하나다 — 몰이꾼이 실제로 무너지는 자리(허기). 나머지 여섯은 전부 그 무너짐에
// 이어져 있고, 이어지지 않은 노드는 이 주체의 의존이 아니다.
//
// 그리고 이 사슬은 그냥 이어진 것이 아니다. **간선마다 D0 가 못박은 성격이 강제된다** —
// 식량은 소모되지만 통행권은 소모되지 않고, 협곡은 그 협곡이어야 하지만 식량은 아무것이나
// 되고, 장막 주기는 조금도 갈아탈 수 없다.

import { deterministicId, type Id } from '@hkt/core/v1';
import {
  edgeIdOf,
  graphIdOf,
  nodeIdOf,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type EdgeRelation,
  type FailureEffect,
  type NodeCondition,
  type NodeTarget,
} from '@hkt/core/d1';

export const beaterId: Id = deterministicId('subject', 'person', '몰이꾼 04');
export const priestId: Id = deterministicId('subject', 'person', '사제 09');
export const traderId: Id = deterministicId('subject', 'person', '행상 21');

export const meatId: Id = deterministicId('entity', 'material', '말린 고기');
export const ravineId: Id = deterministicId('entity', 'place', '붉은 장막 협곡');
export const lawId: Id = deterministicId('rule', 'institutional', '고개 통행법');
export const poisonClaimId: Id = deterministicId('claim', 'herb', '붉은 잎은 마비독이다');

const entity = (id: Id, name: string, entityKind: NodeTarget['entityKind']): NodeTarget => ({
  ontology: 'Entity',
  id,
  name,
  entityKind,
  domain: null,
});

function node(
  kind: DependencyNode['kind'],
  label: string,
  target: NodeTarget | null,
  condition: NodeCondition,
  note: string,
  subjectId: Id = beaterId,
): DependencyNode {
  return { id: nodeIdOf(subjectId, kind, label), subjectId, kind, label, target, condition, note };
}

/** ① 뿌리 — 몰이꾼이 실제로 무너지는 자리. */
export const hungerNode = node(
  'body',
  '주린 몸',
  {
    ontology: 'State',
    id: deterministicId('state', beaterId, 'biological.hunger'),
    name: '몰이꾼의 허기',
    entityKind: null,
    domain: 'biological',
  },
  {
    kind: 'slot',
    slot: { domain: 'biological', path: 'hunger' },
    holderId: beaterId,
    band: { kind: 'range', min: 0, max: 0.6 },
  },
  '허기가 0.6 을 넘으면 사냥을 나갈 힘이 남지 않는다 — 이 그래프는 여기서 시작한다',
);

/** ② 자원 — 아무 식량이든 된다. 먹으면 없어진다. */
export const foodNode = node(
  'resource',
  '겨울 식량',
  entity(meatId, '말린 고기', 'material'),
  {
    kind: 'slot',
    slot: { domain: 'economic', path: `stock.${meatId}` },
    holderId: beaterId,
    band: { kind: 'range', min: 3, max: 999 },
  },
  '겨울을 나려면 사흘치 이상이 창고에 있어야 한다',
);

/** ③ 공간 — 그 협곡이어야 한다. */
export const groundNode = node(
  'space',
  '사냥터',
  entity(ravineId, '붉은 장막 협곡', 'place'),
  {
    kind: 'slot',
    slot: { domain: 'physical', path: 'region' },
    holderId: beaterId,
    band: { kind: 'is', value: ravineId },
  },
  '장막벌레는 이 협곡에만 산다 — 다른 골짜기로 가면 사냥 자체가 없다',
);

/** ④ 제도 — 누군가 주고 누군가 뺏는다. */
export const licenseNode = node(
  'institution',
  '고개 통행권',
  { ontology: 'Rule', id: lawId, name: '고개 통행법', entityKind: null, domain: null },
  {
    kind: 'slot',
    slot: { domain: 'institutional', path: `license.${lawId}` },
    holderId: beaterId,
    band: { kind: 'is', value: true },
  },
  '협곡을 낀 나라의 자격이 없으면 고개는 열려 있어도 못 넘는다',
);

/** ⑤ 시간 — 채울 수 없고 기다릴 뿐이다. */
export const cycleNode = node(
  'time',
  '장막이 걷히는 주기',
  null,
  { kind: 'clock', everyTicks: 12, withinTicks: 3 },
  '열두 틱마다 장막이 걷히고, 걷힌 사흘 안에만 협곡 바닥에 닿을 수 있다',
);

/** ⑥ 정보 — 나눠 줘도 내가 잃지 않는다. */
export const poisonNode = node(
  'information',
  '마비독 감별',
  {
    ontology: 'Claim',
    id: poisonClaimId,
    name: '붉은 잎은 마비독이다',
    entityKind: null,
    domain: null,
  },
  {
    kind: 'slot',
    slot: { domain: 'informational', path: `knows.${poisonClaimId}` },
    holderId: beaterId,
    band: { kind: 'is', value: true },
  },
  '모르면 굶주림을 독으로 갚는다 — 배가 고플수록 아무 잎이나 씹게 된다',
);

/** ⑦ 관계 — 청구할수록 깎인다. */
export const trustNode = node(
  'relationship',
  '행상의 신뢰',
  {
    ontology: 'State',
    id: deterministicId('state', traderId, 'relational.trust'),
    name: '행상이 몰이꾼에게 두는 신뢰',
    entityKind: null,
    domain: 'relational',
  },
  {
    kind: 'slot',
    slot: { domain: 'relational', path: `trust.${traderId}` },
    holderId: beaterId,
    band: { kind: 'range', min: 0.4, max: 1 },
  },
  '신뢰가 0.4 아래로 떨어지면 외상이 끊기고, 외상이 끊기면 겨울 식량을 미리 못 받는다',
);

export const WINTER_NODES: readonly DependencyNode[] = [
  hungerNode,
  foodNode,
  groundNode,
  licenseNode,
  cycleNode,
  poisonNode,
  trustNode,
];

/** 끊김의 흔적 — O2 의 실재하는 자리에 값이 남는다. */
const hungerRises = (by: number, note: string): FailureEffect => ({
  slot: { domain: 'biological', path: 'hunger' },
  holderId: beaterId,
  change: { kind: 'delta', by },
  note,
});

function edge(
  from: DependencyNode,
  to: DependencyNode,
  relation: EdgeRelation,
  strength: number,
  urgency: number,
  substitutability: number,
  failureDelayTicks: number,
  failureEffects: readonly FailureEffect[],
  note: string,
): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, relation),
    from: from.id,
    to: to.id,
    relation,
    strength,
    urgency,
    substitutability,
    failureDelayTicks,
    failureEffects,
    note,
  };
}

export const WINTER_EDGES: readonly DependencyEdge[] = [
  edge(
    hungerNode,
    foodNode,
    'consumes',
    0.95,
    0.8,
    0.7,
    3,
    [hungerRises(0.15, '사흘 굶으면 허기가 0.15 오른다')],
    '먹어서 없앤다 — 그래서 이 기댐은 끝나지 않고 되풀이된다',
  ),
  edge(
    foodNode,
    groundNode,
    'requires',
    0.8,
    0.5,
    0.2,
    6,
    [
      {
        slot: { domain: 'economic', path: `stock.${meatId}` },
        holderId: beaterId,
        change: { kind: 'delta', by: -2 },
        note: '사냥을 못 나가면 엿새마다 재고가 둘 준다',
      },
    ],
    '고기는 협곡에서만 난다 — 다른 골짜기로 가면 사냥이 없다',
  ),
  edge(
    groundNode,
    licenseNode,
    'authorized_by',
    0.7,
    0.3,
    0.1,
    10,
    [
      {
        slot: { domain: 'institutional', path: 'bounty' },
        holderId: beaterId,
        change: { kind: 'delta', by: 30 },
        note: '자격 없이 넘다 걸리면 현상금이 걸린다',
      },
    ],
    '고개는 열려 있어도 자격이 없으면 못 넘는다 — 제도가 공간을 허락한다',
  ),
  edge(
    groundNode,
    cycleNode,
    'sustained_by',
    0.6,
    0.4,
    0,
    12,
    [
      {
        slot: { domain: 'physical', path: 'cover' },
        holderId: ravineId,
        change: { kind: 'delta', by: 0.5 },
        note: '장막이 걷히지 않으면 협곡 바닥이 덮여 아무것도 보이지 않는다',
      },
    ],
    '주기를 놓치면 열두 틱을 더 기다린다 — 앞당길 방법이 없다',
  ),
  edge(
    foodNode,
    poisonNode,
    'informed_by',
    0.5,
    0.6,
    0.4,
    2,
    [
      {
        slot: { domain: 'biological', path: 'toxin' },
        holderId: beaterId,
        change: { kind: 'set', value: '마비독' },
        note: '모르고 붉은 잎을 씹으면 이틀 뒤 몸에 마비독이 든다',
      },
      {
        slot: { domain: 'biological', path: 'toxicity' },
        holderId: beaterId,
        change: { kind: 'delta', by: 0.4 },
        note: '그 세기가 0.4 쌓인다 — 종류와 세기는 따로 적힌다 (O2)',
      },
    ],
    '무엇이 먹을 것인지 아는 것이 먹을 것 자체만큼 필요하다',
  ),
  edge(
    foodNode,
    trustNode,
    'produced_by',
    0.55,
    0.35,
    0.5,
    8,
    [
      {
        slot: { domain: 'relational', path: `debt.${traderId}` },
        holderId: beaterId,
        change: { kind: 'delta', by: 12 },
        note: '외상이 끊기면 남은 빚만 남는다',
      },
    ],
    '겨울 식량의 절반은 행상에게서 온다 — 신뢰가 그것을 만든다',
  ),
];

export const WINTER_GRAPH_NAME = '몰이꾼 04 의 겨울';

/** 몰이꾼 04 의 겨울 그래프 — 뿌리 하나에서 일곱 노드가 뻗는다. */
export const WINTER_GRAPH: DependencyGraph = {
  id: graphIdOf(beaterId, WINTER_GRAPH_NAME),
  subjectId: beaterId,
  name: WINTER_GRAPH_NAME,
  nodes: WINTER_NODES,
  edges: WINTER_EDGES,
  rootIds: [hungerNode.id],
};

/** 설 수 없는 그래프들 — 각자의 사유로 거부되어야 한다. */
export interface BrokenGraph {
  readonly broke: string;
  readonly expected: string;
  readonly graph: DependencyGraph;
}

const withGraph = (patch: Partial<DependencyGraph>): DependencyGraph => ({
  ...WINTER_GRAPH,
  ...patch,
});

/** 규칙을 다 써 버리려는 시도 — D0 가 줄지 않는다고 못박은 종이다. */
const consumesLicense = edge(
  hungerNode,
  licenseNode,
  'consumes',
  0.5,
  0.5,
  0,
  3,
  [hungerRises(0.1, '')],
  '통행권을 먹어 치운다',
);

export const BROKEN_GRAPHS: readonly BrokenGraph[] = [
  {
    broke: '줄지 않는 것(제도)을 소모한다고 적었다',
    expected: 'consumes-undepleting',
    graph: withGraph({ edges: [...WINTER_EDGES, consumesLicense] }),
  },
  {
    broke: '그 협곡이어야 하는데 무엇으로든 대체 가능하다고 적었다',
    expected: 'substitutable-named',
    graph: withGraph({
      edges: WINTER_EDGES.map((entry) =>
        entry.to === groundNode.id ? { ...entry, substitutability: 1 } : entry,
      ),
    }),
  },
  {
    broke: '장막 주기를 절반쯤 갈아탈 수 있다고 적었다',
    expected: 'substitutable-named',
    graph: withGraph({
      edges: WINTER_EDGES.map((entry) =>
        entry.to === cycleNode.id ? { ...entry, substitutability: 0.5 } : entry,
      ),
    }),
  },
  {
    broke: '자원 노드가 남의 신뢰를 조건으로 걸었다',
    expected: 'off-domain-condition',
    graph: withGraph({
      nodes: WINTER_NODES.map((entry) =>
        entry.id === foodNode.id
          ? {
              ...entry,
              condition: {
                kind: 'slot' as const,
                slot: { domain: 'relational' as const, path: `trust.${traderId}` },
                holderId: beaterId,
                band: { kind: 'range' as const, min: 0.4, max: 1 },
              },
            }
          : entry,
      ),
    }),
  },
  {
    broke: '시간이 아닌 종이 틱 조건을 썼다',
    expected: 'clock-condition-misuse',
    graph: withGraph({
      nodes: WINTER_NODES.map((entry) =>
        entry.id === foodNode.id
          ? { ...entry, condition: { kind: 'clock' as const, everyTicks: 12, withinTicks: 3 } }
          : entry,
      ),
    }),
  },
  {
    broke: '알려 줄 수 없는 것(공간)에 informed_by 를 걸었다',
    expected: 'relation-kind-mismatch',
    graph: withGraph({
      edges: WINTER_EDGES.map((entry) =>
        entry.to === groundNode.id && entry.relation === 'requires'
          ? {
              ...entry,
              relation: 'informed_by' as const,
              id: edgeIdOf(entry.from, entry.to, 'informed_by'),
            }
          : entry,
      ),
    }),
  },
  {
    broke: '끊겨도 세계에 아무것도 남지 않는다',
    expected: 'traceless-failure',
    graph: withGraph({
      edges: WINTER_EDGES.map((entry, index) =>
        index === 0 ? { ...entry, failureEffects: [] } : entry,
      ),
    }),
  },
  {
    broke: '끊김의 흔적이 세계에 없는 자리를 가리킨다',
    expected: 'phantom-effect-slot',
    graph: withGraph({
      edges: WINTER_EDGES.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              failureEffects: [
                {
                  slot: { domain: 'biological' as const, path: 'despair' },
                  holderId: beaterId,
                  change: { kind: 'delta' as const, by: 0.2 },
                  note: '절망이 쌓인다',
                },
              ],
            }
          : entry,
      ),
    }),
  },
  {
    broke: '뿌리에서 닿지 않는 노드가 있다',
    expected: 'unreachable-node',
    graph: withGraph({
      edges: WINTER_EDGES.filter((entry) => entry.to !== poisonNode.id),
    }),
  },
  {
    broke: '뿌리가 없다',
    expected: 'rootless-graph',
    graph: withGraph({ rootIds: [] }),
  },
  {
    broke: '의존이 맴돈다 — 통행권이 다시 주린 몸에 기댄다',
    expected: 'dependency-cycle',
    graph: withGraph({
      edges: [
        ...WINTER_EDGES,
        edge(
          licenseNode,
          hungerNode,
          'requires',
          0.3,
          0.2,
          0,
          5,
          [hungerRises(0.05, '자격을 잃으면 허기가 조금 오른다')],
          '자격을 유지하려면 몸이 성해야 한다',
        ),
      ],
    }),
  },
  {
    broke: '다른 주체의 노드가 섞였다',
    expected: 'foreign-node',
    graph: withGraph({
      nodes: [
        ...WINTER_NODES,
        node(
          'ritual',
          '사제의 제사',
          null,
          {
            kind: 'slot',
            slot: { domain: 'transcendent', path: 'worship' },
            holderId: priestId,
            band: { kind: 'range', min: 0.3, max: 1 },
          },
          '사제가 열흘마다 치른다',
          priestId,
        ),
      ],
      edges: [
        ...WINTER_EDGES,
        edge(
          groundNode,
          node(
            'ritual',
            '사제의 제사',
            null,
            {
              kind: 'slot',
              slot: { domain: 'transcendent', path: 'worship' },
              holderId: priestId,
              band: { kind: 'range', min: 0.3, max: 1 },
            },
            '사제가 열흘마다 치른다',
            priestId,
          ),
          'sustained_by',
          0.3,
          0.2,
          0,
          20,
          [
            {
              slot: { domain: 'transcendent', path: 'worship' },
              holderId: priestId,
              change: { kind: 'delta', by: -0.2 },
              note: '제사가 끊기면 숭배량이 마른다',
            },
          ],
          '제사가 협곡의 장막을 떠받친다',
        ),
      ],
    }),
  },
];
