// D5-a 단위 테스트 — 요구는 D1 노드를 편 것이고, 시간은 요구가 아니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  edgeIdOf,
  graphIdOf,
  nodeIdOf,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type NodeCondition,
  type NodeTarget,
} from '../../src/d1/index.ts';
import {
  checkClaims,
  claimIdOf,
  claimLine,
  claimsFrom,
  claimsOf,
  slotKeyOf,
  substitutabilityOf,
  targetKeyOf,
  timeNodes,
  type ConflictViolation,
  type DependencyClaim,
} from '../../src/d5/index.ts';

const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const priestId = deterministicId('subject', 'person', '사제 09');
const partnerId = deterministicId('subject', 'person', '사냥꾼 07');
const meatId = deterministicId('entity', 'material', '말린 고기');
const canyonId = deterministicId('entity', 'place', '국경 협곡');
const hamletId = deterministicId('entity', 'place', '아랫마을');

const entity = (id: string, name: string): NodeTarget => ({
  ontology: 'Entity',
  id,
  name,
  entityKind: 'material',
  domain: null,
});

const range = (
  domain: string,
  path: string,
  min: number,
  max: number,
  holderId: string,
): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId,
  band: { kind: 'range', min, max },
});

const is = (domain: string, path: string, value: string, holderId: string): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId,
  band: { kind: 'is', value },
});

function node(
  subjectId: string,
  kind: DependencyNode['kind'],
  label: string,
  target: NodeTarget | null,
  condition: NodeCondition,
): DependencyNode {
  return {
    id: nodeIdOf(subjectId, kind, label),
    subjectId,
    kind,
    label,
    target,
    condition,
    note: '겨울을 나려면 필요하다',
  };
}

function edge(
  from: DependencyNode,
  to: DependencyNode,
  substitutability: number,
): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, 'requires'),
    from: from.id,
    to: to.id,
    relation: 'requires',
    strength: 0.9,
    urgency: 0.5,
    substitutability,
    failureDelayTicks: 30,
    failureEffects: [],
    note: '이것이 없으면 저것이 무너진다',
  };
}

/** 사냥꾼 하나의 겨울 — 몸(뿌리) · 식량 · 두 곳의 자리 · 짝의 몸 · 그리고 주기 하나. */
function hunterGraph(subjectId: string, name: string): DependencyGraph {
  const hunger = node(subjectId, 'body', '주린 몸', null, range('biological', 'hunger', 0, 0.6, subjectId));
  const food = node(
    subjectId,
    'resource',
    '겨울 식량',
    entity(meatId, '말린 고기'),
    range('economic', `stock.${meatId}`, 3, 1000000, subjectId),
  );
  const hunt = node(
    subjectId,
    'space',
    '사냥터',
    entity(canyonId, '국경 협곡'),
    is('physical', 'region', canyonId, subjectId),
  );
  const hut = node(
    subjectId,
    'space',
    '겨울 움막',
    entity(hamletId, '아랫마을'),
    is('physical', 'region', hamletId, subjectId),
  );
  const partner = node(
    subjectId,
    'subject',
    '등을 맡길 짝',
    entity(partnerId, '사냥꾼 07'),
    // **남의 자리를 요구한다** — 짝의 몸은 내 것이 아니다.
    range('biological', 'vitality', 0.2, 1, partnerId),
  );
  const veil = node(subjectId, 'time', '장막이 걷히는 주기', null, {
    kind: 'clock',
    everyTicks: 12,
    withinTicks: 3,
  });

  return {
    id: graphIdOf(subjectId, name),
    subjectId,
    name,
    nodes: [hunger, food, hunt, hut, partner, veil],
    edges: [
      edge(hunger, food, 0.7),
      edge(food, hunt, 0.2),
      edge(hunger, hut, 0.4),
      edge(hunger, partner, 0.3),
      edge(hunger, veil, 0),
    ],
    rootIds: [hunger.id],
  };
}

const beaterGraph = hunterGraph(beaterId, '몰이꾼의 겨울');
const priestGraph = hunterGraph(priestId, '사제의 겨울');
const GRAPHS = [beaterGraph, priestGraph];

const rulesOf = (violations: readonly ConflictViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('D5-a 요구는 D1 노드를 편 것이다', () => {
  test('자리에 걸린 노드는 전부 요구가 되고, 값은 노드에서 그대로 온다', () => {
    const claims = claimsOf(beaterGraph);
    const slotNodes = beaterGraph.nodes.filter((entry) => entry.condition.kind === 'slot');
    assert.equal(claims.length, slotNodes.length);

    for (const claim of claims) {
      const source = beaterGraph.nodes.find((entry) => entry.id === claim.nodeId) as DependencyNode;
      const condition = source.condition as Extract<NodeCondition, { kind: 'slot' }>;
      assert.deepEqual(claim.slot, condition.slot);
      assert.equal(claim.holderId, condition.holderId);
      assert.deepEqual(claim.band, condition.band);
      assert.equal(claim.targetId, source.target?.id ?? null);
      assert.equal(claim.note, source.note);
    }
  });

  test('시간에 걸린 노드는 요구가 되지 않는다 — 빠뜨림이 아니라 결과다', () => {
    const clocks = timeNodes(GRAPHS);
    assert.equal(clocks.length, 2);
    const claimed = new Set(claimsFrom(GRAPHS).map((claim) => claim.nodeId));
    for (const clock of clocks) {
      assert.equal(claimed.has(clock.id), false, `${clock.label} 이 요구로 섰다`);
    }
  });

  test('대체 가능성은 그 노드에 기대는 간선에서 오고, 뿌리는 0 이다', () => {
    for (const claim of claimsOf(beaterGraph)) {
      const source = beaterGraph.nodes.find((entry) => entry.id === claim.nodeId) as DependencyNode;
      assert.equal(claim.substitutability, substitutabilityOf(beaterGraph, source));
    }
    const root = claimsOf(beaterGraph).find((claim) => claim.label === '주린 몸') as DependencyClaim;
    assert.equal(root.substitutability, 0, '제 몸은 대신할 수 없다');

    const food = claimsOf(beaterGraph).find((claim) => claim.label === '겨울 식량') as DependencyClaim;
    assert.equal(food.substitutability, 0.7, '먹을 것은 다른 것으로 대신할 여지가 있다');
  });

  test('요구의 id 는 유래에서 나온다 — 같은 주체·같은 노드면 언제나 같다', () => {
    for (const claim of claimsOf(beaterGraph)) {
      assert.equal(claim.id, claimIdOf(claim.subjectId, claim.nodeId));
    }
    assert.deepEqual(
      claimsOf(beaterGraph).map((claim) => claim.id),
      claimsOf(beaterGraph).map((claim) => claim.id),
    );
  });

  test('요구는 자리와 대상 두 이름을 함께 진다', () => {
    const claims = claimsOf(beaterGraph);
    const hunt = claims.find((claim) => claim.label === '사냥터') as DependencyClaim;
    assert.equal(slotKeyOf(hunt), `physical.${beaterId}.region`);
    assert.equal(targetKeyOf(hunt), canyonId);

    // 종류로만 걸린 요구는 대상 축에 서지 않는다.
    const hunger = claims.find((claim) => claim.label === '주린 몸') as DependencyClaim;
    assert.equal(targetKeyOf(hunger), null);
    assert.equal(hunger.targetName, '(종류로만)');
  });

  test('남의 자리를 요구할 수도 있다 — 짝의 몸은 내 것이 아니다', () => {
    const partner = claimsOf(beaterGraph).find(
      (claim) => claim.label === '등을 맡길 짝',
    ) as DependencyClaim;
    assert.equal(partner.subjectId, beaterId);
    assert.equal(partner.holderId, partnerId);
    assert.equal(slotKeyOf(partner), `biological.${partnerId}.vitality`);
  });
});

describe('D5-a 여러 그래프를 한 평면에 늘어놓는다', () => {
  test('둘의 요구가 한 줄로 서고 순서가 결정적이다', () => {
    const all = claimsFrom(GRAPHS);
    assert.equal(all.length, claimsOf(beaterGraph).length + claimsOf(priestGraph).length);
    assert.deepEqual(
      claimsFrom(GRAPHS).map((claim) => claim.id),
      all.map((claim) => claim.id),
    );
    assert.deepEqual(
      claimsFrom([priestGraph, beaterGraph]).map((claim) => claim.id).sort(),
      all.map((claim) => claim.id).sort(),
      '그래프 순서를 바꿔도 같은 요구들이다',
    );
  });

  test('같은 자리를 둘이 보는 데가 셋이다 — 하나는 주체 간, 둘은 주체 안이다', () => {
    const all = claimsFrom(GRAPHS);
    const counts = new Map<string, number>();
    for (const claim of all) counts.set(slotKeyOf(claim), (counts.get(slotKeyOf(claim)) ?? 0) + 1);
    const shared = [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
    assert.deepEqual(shared.sort(), [
      // 주체 간 — 둘이 같은 짝의 몸에 기댄다 (같이 만족될 수 있으므로 다툼은 아니다: D5-b)
      `biological.${partnerId}.vitality`,
      // 주체 안 — 한 몸이 사냥터와 움막 두 곳을 동시에 요구한다 (D2 가 D5 에 넘긴 자리)
      `physical.${beaterId}.region`,
      `physical.${priestId}.region`,
    ].sort());
  });

  test('둘이 같은 대상을 보는 데도 있다 — 자리는 각자의 것인데 대상이 하나다', () => {
    const all = claimsFrom(GRAPHS);
    const byTarget = new Map<string, Set<string>>();
    for (const claim of all) {
      const key = targetKeyOf(claim);
      if (key === null) continue;
      byTarget.set(key, (byTarget.get(key) ?? new Set()).add(claim.subjectId));
    }
    const contested = [...byTarget.entries()]
      .filter(([, subjects]) => subjects.size > 1)
      .map(([key]) => key)
      .sort();
    assert.deepEqual(contested, [canyonId, hamletId, meatId, partnerId].sort());
  });
});

describe('D5-a 설 수 없는 요구는 사유와 함께 물린다', () => {
  const sound = claimsOf(beaterGraph)[0] as DependencyClaim;

  test('온전한 요구에는 아무 말도 남지 않는다', () => {
    assert.deepEqual(checkClaims(claimsFrom(GRAPHS), GRAPHS), []);
  });

  test('그래프에 없는 노드의 요구가 걸린다', () => {
    const out = checkClaims([{ ...sound, nodeId: 'dep-node:ffffffffffff' }], GRAPHS);
    assert.deepEqual(rulesOf(out), ['phantom-claim']);
    assert.match(out[0]?.message ?? '', /기대지 않는 것을 놓고 다툴 수는 없다/);
  });

  test('남의 그래프의 노드를 제 요구로 적으면 걸린다', () => {
    const out = checkClaims([{ ...sound, subjectId: priestId }], GRAPHS);
    assert.deepEqual(rulesOf(out), ['foreign-claim']);
  });

  test('주기 조건을 요구로 세우면 걸린다 — 시간은 자리를 잡지 않는다', () => {
    const clock = timeNodes([beaterGraph])[0] as DependencyNode;
    const out = checkClaims([{ ...sound, nodeId: clock.id, label: clock.label }], GRAPHS);
    assert.deepEqual(rulesOf(out), ['clock-claim']);
    assert.match(out[0]?.message ?? '', /겹치지도 다투지도 않는다/);
  });

  test('0~1 밖의 대체 가능성이 걸린다', () => {
    const out = checkClaims([{ ...sound, substitutability: 2 }], GRAPHS);
    assert.deepEqual(rulesOf(out), ['bad-substitutability']);
  });

  test('요구 하나는 사람이 읽는 한 줄로 선다', () => {
    assert.match(claimLine(sound), /대체 \d\.\d\d/);
  });
});
