// C036 — 방이 기회를 내민다: 기회의 형(opportunity.ts)과 검사 ㊺ ㊻(check.ts).
//
// 이 파일은 **게임을 모른다** — 방도 원천도 문도 여기서 지어 준다 (`A` · `S1` · `AB`).
// 형이 아무것도 판정하지 않는가(availability 를 평가하는 자리가 없다) · Event 가 저장된 갈래가
// 아니라 조건에서 유도되는가 · 표기가 두 번 돌아도 같은가 — 그것이 형의 규율이고 그것을 재는 자리가 여기다.
//
// ㊺ 은 어휘를 컨텐츠가 건넨다는 것 자체를 잰다 (유령 ref · 자리만인 discovery · 표 밖의 op 가 fail) ·
// ㊻ 은 판정하지 않는다는 것 자체를 잰다 (기회 0 인 방이 줄로 드러나고 ok 를 떨어뜨리지 않는다).

import { describe, expect, it } from 'vitest';
import {
  checkRegions,
  type CheckContract,
  type CheckOpportunity,
  type CheckOpportunityVocabulary,
  type CheckRegion,
} from '../check';
import type { RegionDescription } from '../description';
import type { Connector, RegionGraph } from '../graph';
import {
  DECIDABLE_DISCOVERY_KINDS,
  DEFERRED_DISCOVERY_KINDS,
  formatOpportunity,
  isEventOpportunity,
  MUTATION_OPS,
  OPPORTUNITY_ACTIONS,
  OPPORTUNITY_TARGET_KINDS,
  OPPORTUNITY_YIELD_KINDS,
  type Opportunity,
} from '../opportunity';

// ── 이 시험이 쓰는 세계 — 방 셋 · 원천 둘 · 문 둘 ────────────────────

const CONTRACT: CheckContract = {
  anchorLayer: 'door',
  resourceLayer: 'ore',
  hazardLayer: 'danger',
  phenomenonLayer: 'weather',
  settlementLayer: 'living',
  settlementTags: ['camp'],
  conditionPrefix: 'because:',
  traceLayer: 'hint',
  startRegion: 'A',
};

function space(id: string, ops: RegionDescription['ops'] = []): RegionDescription {
  return { id, extent: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, seed: 1, ops };
}

const door = (tag: string) =>
  ({ id: tag, kind: 'point', layer: 'door', tag, position: { x: 0, z: 0 } }) as const;

const connector = (id: string, from: string, to: string): Connector => ({
  id,
  from: { region: from, anchor: `${from}_TO_${to}` },
  to: { region: to, anchor: `${to}_TO_${from}` },
  direction: 'bidirectional',
  transition: 'walk',
});

const GRAPH: RegionGraph = {
  regions: ['A', 'B', 'C'],
  containment: [],
  connectors: [connector('AB', 'A', 'B'), connector('BC', 'B', 'C')],
  frontiers: [],
};

const REGIONS: CheckRegion[] = [
  { id: 'A', depth: 'near', coreRules: 0, space: space('A', [door('A_TO_B')]) },
  { id: 'B', depth: 'mid', coreRules: 0, space: space('B', [door('B_TO_A'), door('B_TO_C')]) },
  { id: 'C', depth: 'far', coreRules: 0, space: space('C', [door('C_TO_B')]) },
];

const CONDITION_VOCABULARY: CheckOpportunityVocabulary['condition'] = {
  targets: { clock: [], region: ['A', 'B', 'C'], source: ['S1', 'S2'], history: ['A', 'B', 'C'] },
  queries: [
    { target: 'clock', query: 'property', paths: ['season'] },
    { target: 'region', query: 'state', paths: ['pattern'] },
    { target: 'history', query: 'history', paths: ['passages.R1'] },
  ],
};

const VOCABULARY: CheckOpportunityVocabulary = {
  targets: { source: ['S1', 'S2'], connector: ['AB', 'BC'] },
  actions: [
    { action: 'gather', role: 'role-gather' },
    { action: 'cross', role: 'role-cross' },
    { action: 'observe', role: 'role-observe' },
  ],
  progressPaths: ['sources.S1.takenTotal'],
  condition: CONDITION_VOCABULARY,
};

/** 캐는 기회 하나 — 철이 조건이므로 Event 가 아니다 */
const GATHER: Opportunity = {
  id: 'gather:S1',
  region: 'A',
  availability: {
    target: { kind: 'clock' },
    query: { kind: 'property', path: 'season' },
    operator: 'IN',
    value: ['s1'],
  },
  discovery: 'TRACE',
  target: { kind: 'source', ref: 'S1' },
  possibleActions: ['gather'],
  progress: { kind: 'counter', ref: 'sources.S1.takenTotal' },
  outcomes: { world: [{ group: 'entity', op: 'CHANGE_STATE' }], yield: ['Material'] },
};

/** 건너는 기회 하나 — availability 가 없으니 늘 있다 */
const CROSS: Opportunity = {
  id: 'cross:AB',
  region: 'A',
  discovery: 'VISIBLE',
  target: { kind: 'connector', ref: 'AB' },
  possibleActions: ['cross'],
  progress: { kind: 'none' },
  outcomes: { world: [], yield: ['Access'] },
};

/** 때가 실린 기회 하나 — 시간 qualifier 가 있으므로 Event 다 */
const SIGNAL: Opportunity = {
  id: 'watch:S2',
  region: 'B',
  availability: {
    target: { kind: 'history', ref: 'B' },
    query: { kind: 'history', path: 'passages.R1' },
    operator: 'EXISTS',
    qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
  },
  discovery: 'SIGNAL',
  target: { kind: 'source', ref: 'S2' },
  possibleActions: ['observe'],
  progress: { kind: 'none' },
  outcomes: { world: [], yield: ['Discovery'] },
};

/** 아무 데도 걸리지 않는 기회 계약 — 기회 셋 · 방 C 는 내미는 것이 없다 */
function sound(): CheckOpportunity {
  return {
    opportunities: [GATHER, CROSS, SIGNAL],
    vocabulary: VOCABULARY,
    relations: [
      { kind: 'space', regions: ['A', 'B', 'C'] },
      { kind: 'env', regions: ['A', 'B'] },
      { kind: 'eco', regions: ['B'] },
      { kind: 'event', regions: ['B', 'C'] },
      { kind: 'social', regions: [] },
    ],
  };
}

const run = (opportunity?: CheckOpportunity) =>
  checkRegions({ regions: REGIONS, graph: GRAPH, contract: CONTRACT, opportunity });

const itemOf = (id: string, opportunity?: CheckOpportunity) =>
  run(opportunity).items.find((item) => item.id === id)!;

/** 성한 계약에 기회 하나를 더 얹는다 — 기본은 아무 데도 걸리지 않는 기회다 */
function withOpportunity(partial: Partial<Opportunity>): CheckOpportunity {
  const world = sound();
  return {
    ...world,
    opportunities: [
      ...world.opportunities,
      {
        id: 'extra',
        region: 'A',
        discovery: 'VISIBLE',
        target: { kind: 'source', ref: 'S1' },
        possibleActions: ['gather'],
        progress: { kind: 'none' },
        outcomes: { world: [], yield: ['Material'] },
        ...partial,
      },
    ],
  };
}

/** 얹은 기회가 걸린 줄들 */
const extraRefs = (partial: Partial<Opportunity>) =>
  itemOf('opportunity-refs', withOpportunity(partial)).refs;

// ── 형 ──────────────────────────────────────────────────────────────

describe('기회의 형 — 어휘와 표', () => {
  it('discovery 는 서는 넷과 자리만인 둘로 갈린다 — 겹치지 않는다', () => {
    expect(DECIDABLE_DISCOVERY_KINDS).toEqual(['VISIBLE', 'SIGNAL', 'TRACE', 'HIDDEN']);
    expect(DEFERRED_DISCOVERY_KINDS).toEqual(['NPC', 'KNOWLEDGE']);
    const both = DECIDABLE_DISCOVERY_KINDS.filter((kind) => DEFERRED_DISCOVERY_KINDS.includes(kind));
    expect(both).toEqual([]);
  });

  it('갈래 다섯 · 동사 넷 · 남는 것 넷', () => {
    expect(OPPORTUNITY_TARGET_KINDS).toEqual(['source', 'area', 'connector', 'route', 'process']);
    expect(OPPORTUNITY_ACTIONS).toEqual(['observe', 'gather', 'cross', 'move']);
    expect(OPPORTUNITY_YIELD_KINDS).toEqual(['Material', 'Access', 'Discovery', 'WorldInfluence']);
  });

  it('op 표는 2층에 서는 짝만이다 — 자리만인 op 도 knowledge 군도 없다', () => {
    expect(MUTATION_OPS.map((row) => `${row.group}.${row.op}`)).toEqual([
      'property.SET',
      'property.ADD',
      'property.CLAMP',
      'entity.CHANGE_STATE',
      'relation.CONNECT',
      'relation.DISCONNECT',
      'process.START',
      'process.STOP',
      'process.ADVANCE',
      'process.RESET',
      'opportunity.OPEN',
      'opportunity.CLOSE',
      'opportunity.COMPLETE',
      'ownership.GRANT',
    ]);
    expect(MUTATION_OPS.some((row) => row.group === 'knowledge')).toBe(false);
  });
});

describe('isEventOpportunity — Event 는 저장된 갈래가 아니라 유도다', () => {
  it('availability 가 없으면 Event 가 아니다 — 늘 있는 기회다', () => {
    expect(isEventOpportunity(CROSS)).toBe(false);
  });

  it('시간 qualifier 가 없는 조건은 Event 가 아니다', () => {
    expect(isEventOpportunity(GATHER)).toBe(false);
  });

  it('잎 하나라도 시간 qualifier 를 가지면 Event 다 — 집합의 깊이는 묻지 않는다', () => {
    expect(isEventOpportunity(SIGNAL)).toBe(true);
    const nested: Opportunity = {
      ...GATHER,
      availability: { all: [{ any: [GATHER.availability!, SIGNAL.availability!] }] },
    };
    expect(isEventOpportunity(nested)).toBe(true);
  });

  it('변화 qualifier 는 Event 가 아니다 — 때가 아니라 바뀜이다', () => {
    const changed: Opportunity = {
      ...GATHER,
      availability: {
        target: { kind: 'region', ref: 'A' },
        query: { kind: 'state', path: 'pattern' },
        operator: '==',
        value: 'p1',
        qualifier: { kind: 'change', mode: 'BECAME' },
      },
    };
    expect(isEventOpportunity(changed)).toBe(false);
  });
});

describe('formatOpportunity — 기계가 읽는 한 줄', () => {
  it('id[discovery] 갈래(ref) 동사 → 남는 것', () => {
    expect(formatOpportunity(GATHER)).toBe('gather:S1[TRACE] source(S1) gather → Material');
    expect(formatOpportunity(CROSS)).toBe('cross:AB[VISIBLE] connector(AB) cross → Access');
  });

  it('동사와 남는 것이 여럿이면 쉼표로 잇고 · 비면 `-` 다', () => {
    expect(
      formatOpportunity({
        ...CROSS,
        possibleActions: ['observe', 'cross'],
        outcomes: { world: [], yield: ['Access', 'Discovery'] },
      }),
    ).toBe('cross:AB[VISIBLE] connector(AB) observe,cross → Access,Discovery');
    expect(
      formatOpportunity({ ...CROSS, possibleActions: [], outcomes: { world: [], yield: [] } }),
    ).toBe('cross:AB[VISIBLE] connector(AB) - → -');
  });

  it('두 번 지어도 같다 — 읽기만 하는 표기다', () => {
    expect(formatOpportunity(SIGNAL)).toBe(formatOpportunity(SIGNAL));
  });
});

// ── 검사 ㊺ ─────────────────────────────────────────────────────────

describe('㊺ 기회가 가리키는 것', () => {
  it('㊺ ㊻ 이 ㊹ 뒤에 선다 — 번호가 아니라 계약이 는 차례다', () => {
    const items = run(sound()).items;
    expect(items.slice(-3).map((item) => item.mark)).toEqual(['㊹', '㊺', '㊻']);
    expect(items.slice(-2).map((item) => item.id)).toEqual([
      'opportunity-refs',
      'opportunity-summary',
    ]);
  });

  it('기회 쪽 계약을 주지 않으면 둘 다 absent 다 — 통과로 적지 않는다', () => {
    const two = run(undefined).items.slice(-2);
    expect(two.map((item) => item.status)).toEqual(['absent', 'absent']);
    expect(two.map((item) => item.answer)).toEqual([
      '기회 쪽 계약이 주어지지 않았다',
      '기회 쪽 계약이 주어지지 않았다',
    ]);
    expect(two.flatMap((item) => item.refs)).toEqual([]);
  });

  it('어휘 안의 기회뿐이면 통과이고 수가 적힌다', () => {
    const item = itemOf('opportunity-refs', sound());
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('기회 3 · 걸린 것 0');
    expect(item.refs).toEqual([]);
  });

  it('두 번 돌리면 글자까지 같다 — 읽기 전용 관찰이다', () => {
    expect(JSON.stringify(run(sound()))).toBe(JSON.stringify(run(sound())));
  });

  it('① 유령 ref 와 어휘에 없는 갈래가 잡힌다', () => {
    expect(extraRefs({ target: { kind: 'source', ref: 'Z' } })).toEqual([
      {
        where: 'opportunity:extra',
        detail: 'extra[VISIBLE] source(Z) gather → Material — ref Z 은 아는 source 이 아니다',
      },
    ]);
    expect(extraRefs({ target: { kind: 'area', ref: 'x' } })).toEqual([
      {
        where: 'opportunity:extra',
        detail: 'extra[VISIBLE] area(x) gather → Material — Target 갈래 area 은 어휘에 없다',
      },
    ]);
  });

  it('② 자리만인 discovery 도 지금은 걸린다 — 그 층이 오면 어휘가 연다', () => {
    expect(extraRefs({ discovery: 'NPC' })[0]!.detail).toBe(
      'extra[NPC] source(S1) gather → Material — discovery NPC 은 아직 자리만이다',
    );
    expect(extraRefs({ discovery: 'WHISPER' as 'VISIBLE' })[0]!.detail.endsWith(
      'discovery WHISPER 은 아는 갈래가 아니다',
    )).toBe(true);
    // 서는 넷은 그대로 통과한다
    for (const discovery of DECIDABLE_DISCOVERY_KINDS) {
      expect(extraRefs({ discovery })).toEqual([]);
    }
  });

  it('③ 빈 possibleActions 와 role 이 아닌 동사가 잡힌다', () => {
    expect(extraRefs({ possibleActions: [] })[0]!.detail.endsWith('possibleActions 가 비었다')).toBe(
      true,
    );
    expect(extraRefs({ possibleActions: ['gather', 'move'] })).toEqual([
      {
        where: 'opportunity:extra',
        detail:
          'extra[VISIBLE] source(S1) gather,move → Material — 동사 move 은 이 세계의 Interaction role 이 아니다',
      },
    ]);
  });

  it('④ progress 의 경로가 잡힌다 — 요구 · 받지 않음 · 모르는 경로 · 셋 밖', () => {
    const detailOf = (partial: Partial<Opportunity>) => extraRefs(partial)[0]!.detail;
    expect(detailOf({ progress: { kind: 'counter' } }).endsWith('progress counter 은 ref 를 요구한다')).toBe(true);
    expect(detailOf({ progress: { kind: 'phase' } }).endsWith('progress phase 은 ref 를 요구한다')).toBe(true);
    expect(detailOf({ progress: { kind: 'none', ref: 'x' } }).endsWith('progress none 은 ref 를 받지 않는다')).toBe(true);
    expect(detailOf({ progress: { kind: 'counter', ref: 'sources.Z.takenTotal' } }).endsWith(
      'progress 의 ref sources.Z.takenTotal 은 읽을 수 있는 경로에 없다',
    )).toBe(true);
    expect(detailOf({ progress: { kind: 'tally' as 'counter', ref: 'x' } }).endsWith(
      'progress 의 kind tally 은 셋 밖이다',
    )).toBe(true);
    // 어휘가 경로를 밝히지 않으면 ref 를 재지 않는다
    const world = withOpportunity({ progress: { kind: 'counter', ref: 'anything' } });
    const loose: CheckOpportunity = {
      ...world,
      vocabulary: { ...VOCABULARY, progressPaths: undefined },
    };
    expect(itemOf('opportunity-refs', loose).status).toBe('pass');
  });

  it('⑤ 표 밖의 (군, op) 짝과 넷 밖의 yield 가 잡힌다', () => {
    expect(
      extraRefs({ outcomes: { world: [{ group: 'knowledge', op: 'GRANT' }], yield: ['Material'] } })[0]!
        .detail,
    ).toBe('extra[VISIBLE] source(S1) gather → Material — knowledge GRANT 은 op 표에 없는 짝이다');
    expect(
      extraRefs({ outcomes: { world: [{ group: 'property', op: 'GRANT' }], yield: ['Material'] } })[0]!
        .detail.endsWith('property GRANT 은 op 표에 없는 짝이다'),
    ).toBe(true);
    expect(
      extraRefs({ outcomes: { world: [], yield: ['Gold' as 'Material'] } })[0]!.detail.endsWith(
        'yield Gold 은 넷 밖이다',
      ),
    ).toBe(true);
    // 표 안의 짝은 전부 통과한다
    for (const row of MUTATION_OPS) {
      expect(extraRefs({ outcomes: { world: [row], yield: ['Material'] } })).toEqual([]);
    }
  });

  it('⑥ availability 는 ㊹ 과 같은 잣대로 재어진다 — 두 벌로 적지 않는다', () => {
    expect(
      extraRefs({
        availability: {
          target: { kind: 'region', ref: 'Z' },
          query: { kind: 'state', path: 'pattern' },
          operator: '==',
          value: 'p1',
        },
      }),
    ).toEqual([
      {
        where: 'opportunity:extra',
        detail:
          'extra[VISIBLE] source(S1) gather → Material — availability region(Z).state(pattern) == p1 — ref Z 은 아는 region 이 아니다',
      },
    ]);
    // 잎이 여럿이면 걸린 잎마다 한 줄이다
    expect(
      extraRefs({
        availability: {
          all: [
            { target: { kind: 'region', ref: 'Z' }, query: { kind: 'state', path: 'pattern' }, operator: '==', value: 'p1' },
            { target: { kind: 'region', ref: 'A' }, query: { kind: 'state', path: 'mood' }, operator: '==', value: 'p1' },
          ],
        },
      }).length,
    ).toBe(2);
  });

  it('⑦ 빈 id · 겹친 id · 아는 방이 아닌 region 이 잡힌다', () => {
    expect(extraRefs({ id: '  ' })[0]!.detail.endsWith('id 가 비었다')).toBe(true);
    expect(extraRefs({ region: 'Z' })[0]!.detail.endsWith('region Z 은 아는 방이 아니다')).toBe(true);
    // 겹친 id 는 겹친 쪽 모두에 적힌다 — 어느 쪽을 고칠지는 사람이 본다
    const twins = extraRefs({ id: 'cross:AB' });
    expect(twins.map((ref) => ref.where)).toEqual(['opportunity:cross:AB', 'opportunity:cross:AB']);
    expect(twins.every((ref) => ref.detail.endsWith('id cross:AB 이 둘 이상이다'))).toBe(true);
  });

  it('기회 하나에 까닭이 여럿이면 줄도 여럿이다 — ①~⑦ 의 차례로', () => {
    const all = extraRefs({
      id: 'gather:S1',
      region: 'Z',
      discovery: 'NPC',
      target: { kind: 'source', ref: 'Z' },
      possibleActions: [],
      progress: { kind: 'none', ref: 'x' },
      outcomes: { world: [{ group: 'knowledge', op: 'GRANT' }], yield: ['Gold' as 'Material'] },
      availability: {
        target: { kind: 'region', ref: 'Z' },
        query: { kind: 'state', path: 'pattern' },
        operator: '==',
        value: 'p1',
      },
    });
    // 겹친 id 는 겹친 쪽 모두에 적히므로 먼저 선 기회에도 한 줄이 섰다 — 얹은 쪽만 골라 차례를 본다
    expect(all[0]!.detail.startsWith('gather:S1[TRACE]')).toBe(true);
    const refs = all.filter((ref) => ref.detail.startsWith('gather:S1[NPC]'));
    expect(refs.map((ref) => ref.detail.split(' — ').slice(1).join(' — '))).toEqual([
      'ref Z 은 아는 source 이 아니다',
      'discovery NPC 은 아직 자리만이다',
      'possibleActions 가 비었다',
      'progress none 은 ref 를 받지 않는다',
      'knowledge GRANT 은 op 표에 없는 짝이다',
      'yield Gold 은 넷 밖이다',
      'availability region(Z).state(pattern) == p1 — ref Z 은 아는 region 이 아니다',
      'id gather:S1 이 둘 이상이다',
      'region Z 은 아는 방이 아니다',
    ]);
    expect(itemOf('opportunity-refs', withOpportunity({ id: 'x', region: 'Z' })).answer).toBe(
      '기회 4 · 걸린 것 1',
    );
  });

  it('걸린 것이 있으면 보고가 ok 를 잃는다', () => {
    expect(run(sound()).ok).toBe(true);
    expect(run(withOpportunity({ region: 'Z' })).ok).toBe(false);
  });
});

// ── 검사 ㊻ ─────────────────────────────────────────────────────────

describe('㊻ 방마다 내미는 것과 관계', () => {
  it('판정하지 않는다 — report 이고 ok 를 떨어뜨리지 않는다', () => {
    const item = itemOf('opportunity-summary', sound());
    expect(item.status).toBe('report');
    expect(run(sound()).counts.fail).toBe(0);
  });

  it('answer 는 한 줄로 센다', () => {
    expect(itemOf('opportunity-summary', sound()).answer).toBe(
      '기회 3 · 기회 0 인 방 1 · Event 1 · 관계 갈래 5',
    );
  });

  it('방마다 한 줄 — 기회가 0 인 방도 그 줄로 드러난다 (input.regions 차례)', () => {
    const refs = itemOf('opportunity-summary', sound()).refs.slice(0, 3);
    expect(refs).toEqual([
      { where: 'A', detail: '기회 2 · Event 0 · VISIBLE 1 TRACE 1' },
      { where: 'B', detail: '기회 1 · Event 1 · SIGNAL 1' },
      { where: 'C', detail: '기회 0 · Event 0 · 갈래 없음' },
    ]);
  });

  it('관계는 갈래마다 한 줄 — 준 차례로, 닿지 않는 방이 이름으로 선다', () => {
    const refs = itemOf('opportunity-summary', sound()).refs.slice(3);
    expect(refs).toEqual([
      { where: 'relation:space', detail: '닿는 방 3 · 닿지 않는 방 0' },
      { where: 'relation:env', detail: '닿는 방 2 · 닿지 않는 방 1 (C)' },
      { where: 'relation:eco', detail: '닿는 방 1 · 닿지 않는 방 2 (A · C)' },
      { where: 'relation:event', detail: '닿는 방 2 · 닿지 않는 방 1 (A)' },
      { where: 'relation:social', detail: '닿는 방 0 · 닿지 않는 방 3 (A · B · C)' },
    ]);
  });

  it('아는 방 밖을 가리키는 기회는 어느 줄에도 서지 않는다 — 그것은 ㊺ 가 잡을 일이다', () => {
    const item = itemOf('opportunity-summary', withOpportunity({ id: 'ghost', region: 'Z' }));
    expect(item.refs.slice(0, 3).map((ref) => ref.where)).toEqual(['A', 'B', 'C']);
    expect(item.answer).toBe('기회 4 · 기회 0 인 방 1 · Event 1 · 관계 갈래 5');
  });

  it('두 번 돌리면 글자까지 같다', () => {
    const once = itemOf('opportunity-summary', sound());
    const twice = itemOf('opportunity-summary', sound());
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});
