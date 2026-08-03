// D5-c 단위 테스트 — 담고, 감사가 위반과 사실을 가르고, 이분 그래프로 편다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { Band } from '../../src/s0/index.ts';
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
import { evaluatePressure, snapshotOf, type SlotValue, type WorldSnapshot } from '../../src/d4/index.ts';
import {
  auditConflicts,
  bipartiteOf,
  conflictFieldVerdict,
  conflictTable,
  conflictsFor,
  detectConflicts,
  openConflictField,
  unconflicted,
  type ConflictViolation,
  type DependencyConflict,
} from '../../src/d5/index.ts';

const NOW = 400;
const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const priestId = deterministicId('subject', 'person', '사제 09');
const wormId = deterministicId('subject', 'creature', '장막벌레');
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

const cond = (domain: string, path: string, holderId: string, band: Band): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId,
  band,
});

const range = (min: number, max: number): Band => ({ kind: 'range', min, max });
const is = (value: string): Band => ({ kind: 'is', value });

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

function edge(from: DependencyNode, to: DependencyNode, substitutability: number): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, 'requires'),
    from: from.id,
    to: to.id,
    relation: 'requires',
    strength: 0.9,
    urgency: 0.6,
    substitutability,
    failureDelayTicks: 30,
    failureEffects: [],
    note: '이것이 없으면 저것이 무너진다',
  };
}

function hunterGraph(subjectId: string, name: string): DependencyGraph {
  const hunger = node(subjectId, 'body', '주린 몸', null, cond('biological', 'hunger', subjectId, range(0, 0.6)));
  const food = node(
    subjectId,
    'resource',
    '겨울 식량',
    entity(meatId, '말린 고기'),
    cond('economic', `stock.${meatId}`, subjectId, range(3, 1000000)),
  );
  const hunt = node(subjectId, 'space', '사냥터', entity(canyonId, '국경 협곡'), cond('physical', 'region', subjectId, is(canyonId)));
  const hut = node(subjectId, 'space', '겨울 움막', entity(hamletId, '아랫마을'), cond('physical', 'region', subjectId, is(hamletId)));
  const prey = node(
    subjectId,
    'subject',
    '사냥감',
    entity(wormId, '장막벌레'),
    cond('biological', 'vitality', wormId, range(0, 0.2)),
  );
  return {
    id: graphIdOf(subjectId, name),
    subjectId,
    name,
    nodes: [hunger, food, hunt, hut, prey],
    edges: [edge(hunger, food, 0.7), edge(food, hunt, 0.2), edge(hunger, hut, 0.4), edge(food, prey, 0.5)],
    rootIds: [hunger.id],
  };
}

function wormGraph(): DependencyGraph {
  const body = node(wormId, 'body', '성한 몸', null, cond('biological', 'vitality', wormId, range(0.3, 1)));
  return {
    id: graphIdOf(wormId, '장막벌레의 겨울'),
    subjectId: wormId,
    name: '장막벌레의 겨울',
    nodes: [body],
    edges: [],
    rootIds: [body.id],
  };
}

/** 아무와도 겹치지 않는 자 — 제 몸 하나만 지고 산다. */
function hermitGraph(): DependencyGraph {
  const hermitId = deterministicId('subject', 'person', '떠도는 자');
  const body = node(hermitId, 'body', '성한 몸', null, cond('biological', 'vitality', hermitId, range(0.2, 1)));
  return {
    id: graphIdOf(hermitId, '떠도는 자의 겨울'),
    subjectId: hermitId,
    name: '떠도는 자의 겨울',
    nodes: [body],
    edges: [],
    rootIds: [body.id],
  };
}

const GRAPHS = [hunterGraph(beaterId, '몰이꾼의 겨울'), hunterGraph(priestId, '사제의 겨울'), wormGraph()];

const slot = (domain: string, holderId: string, path: string, value: SlotValue['value']): SlotValue => ({
  domain: domain as never,
  holderId,
  path,
  value,
});

function worldAt(stock: number): WorldSnapshot {
  return snapshotOf(
    [
      slot('biological', beaterId, 'hunger', 0.3),
      slot('biological', priestId, 'hunger', 0.3),
      slot('biological', wormId, 'vitality', 0.7),
      slot('physical', beaterId, 'region', canyonId),
      slot('physical', priestId, 'region', canyonId),
      slot('economic', beaterId, `stock.${meatId}`, stock),
      slot('economic', priestId, `stock.${meatId}`, stock),
    ],
    NOW,
  ).snapshot;
}

const reportsAt = (stock: number) => GRAPHS.map((graph) => evaluatePressure(graph, worldAt(stock)));
const optionsAt = (stock: number) => ({ reports: reportsAt(stock), world: worldAt(stock) });

const rulesOf = (violations: readonly ConflictViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('D5-c 다툼들을 담는다', () => {
  test('세 걸음이면 다툼이 선다 — 요구를 펴고, 겹침을 찾고, 판정한다', () => {
    const result = detectConflicts(GRAPHS, optionsAt(0));
    assert.ok(result.claims.length > 0);
    assert.ok(result.contests.length > 0);
    assert.equal(
      result.field.conflicts.length + result.field.peaces.length,
      result.contests.length,
      '겹침은 다툼이거나 다툼이 아니거나 둘 중 하나로 남는다',
    );
  });

  test('주체마다 제가 낀 다툼을 찾아볼 수 있다', () => {
    const { field } = detectConflicts(GRAPHS, optionsAt(0));
    const mine = conflictsFor(field, beaterId);
    assert.ok(mine.length > 0);
    for (const conflict of mine) {
      assert.equal(conflict.sides.some((side) => side.subjectId === beaterId), true);
    }
  });

  test('아무 다툼에도 끼지 않은 주체가 있을 수 있다 — 위반이 아니다', () => {
    const graphs = [...GRAPHS, hermitGraph()];
    const { field } = detectConflicts(graphs, optionsAt(0));
    const calm = unconflicted(field, graphs);
    assert.equal(calm.length, 1);
    assert.equal(calm[0], hermitGraph().subjectId);
  });

  test('빈 충돌장은 아무것도 담지 않는다', () => {
    const empty = openConflictField();
    assert.deepEqual(empty.conflicts, []);
    assert.equal(unconflicted(empty, GRAPHS).length, GRAPHS.length);
  });
});

describe('D5-c 감사가 위반과 사실을 가른다', () => {
  test('온전한 충돌장은 그대로 감사를 지난다', () => {
    const result = detectConflicts(GRAPHS, optionsAt(0));
    const audit = auditConflicts(result.field, result, GRAPHS, optionsAt(0));
    assert.equal(audit.complete, true, conflictFieldVerdict(audit));
    assert.equal(audit.conflicts, result.field.conflicts.length);
    assert.ok(audit.peaces > 0, '다툼이 아닌 겹침도 값으로 남는다');
    assert.equal(audit.opposed + audit.scarcity, audit.conflicts);
    assert.equal(audit.internal + audit.between, audit.conflicts);
  });

  test('빠뜨린 다툼이 걸린다 — 다투는데 아무도 모르는 다툼은 없다', () => {
    const result = detectConflicts(GRAPHS, optionsAt(0));
    const short = {
      ...result.field,
      conflicts: result.field.conflicts.slice(1),
      byKey: new Map(result.field.conflicts.slice(1).map((conflict) => [conflict.key, conflict])),
    };
    const audit = auditConflicts(short, result, GRAPHS, optionsAt(0));
    assert.equal(rulesOf(audit.violations).includes('missing-contest'), true);
    assert.equal(audit.complete, false);
    assert.match(conflictFieldVerdict(audit), /충돌장이 어긋났다/);
  });

  test('이기는 자를 적으면 감사에서 걸린다', () => {
    const result = detectConflicts(GRAPHS, optionsAt(0));
    const first = result.field.conflicts[0] as DependencyConflict;
    const decided = { ...first, winnerId: beaterId } as unknown as DependencyConflict;
    const field = {
      ...result.field,
      conflicts: [decided, ...result.field.conflicts.slice(1)],
    };
    const audit = auditConflicts(field, result, GRAPHS, optionsAt(0));
    assert.equal(rulesOf(audit.violations).includes('winner-declared'), true);
  });

  test('가장 급한 다툼의 급함이 값으로 선다', () => {
    const result = detectConflicts(GRAPHS, optionsAt(0));
    const audit = auditConflicts(result.field, result, GRAPHS, optionsAt(0));
    assert.equal(
      audit.peak,
      Math.max(...result.field.conflicts.map((conflict) => conflict.severity)),
    );
  });

  test('창고를 채우면 다툼이 줄고 다툼 아닌 겹침이 는다 — 같은 그래프인데', () => {
    const poor = detectConflicts(GRAPHS, optionsAt(0));
    const rich = detectConflicts(GRAPHS, optionsAt(10));
    const poorAudit = auditConflicts(poor.field, poor, GRAPHS, optionsAt(0));
    const richAudit = auditConflicts(rich.field, rich, GRAPHS, optionsAt(10));
    assert.equal(poorAudit.conflicts - richAudit.conflicts, 1);
    assert.equal(richAudit.peaces - poorAudit.peaces, 1);
    assert.equal(poorAudit.contests, richAudit.contests, '겹침 자체는 그대로다');
  });
});

describe('D5-c 이분 그래프', () => {
  const labels = new Map([
    [beaterId, '몰이꾼 04'],
    [priestId, '사제 09'],
    [wormId, '장막벌레'],
  ]);

  test('한쪽 열은 주체, 다른 열은 그들이 함께 보는 것이다', () => {
    const { field } = detectConflicts(GRAPHS, optionsAt(0));
    const bipartite = bipartiteOf(field, labels);
    const subjects = bipartite.nodes.filter((entry) => entry.kind === 'subject');
    const targets = bipartite.nodes.filter((entry) => entry.kind !== 'subject');
    assert.ok(subjects.length > 0);
    assert.equal(targets.length, field.conflicts.length);
    assert.equal(subjects.every((entry) => entry.root), true, '주체 쪽이 한 열이 된다');
  });

  test('선은 언제나 주체에서 대상으로만 간다 — 주체끼리는 잇지 않는다', () => {
    const { field } = detectConflicts(GRAPHS, optionsAt(0));
    const bipartite = bipartiteOf(field, labels);
    const subjectIds = new Set(
      bipartite.nodes.filter((entry) => entry.kind === 'subject').map((entry) => entry.id),
    );
    for (const line of bipartite.edges) {
      assert.equal(subjectIds.has(line.from), true, '선의 시작은 언제나 주체다');
      assert.equal(subjectIds.has(line.to), false, '선의 끝은 주체가 아니다');
    }
  });

  test('선의 굵기는 그 요구의 압력이다 — D4 에서 온다', () => {
    const { field } = detectConflicts(GRAPHS, optionsAt(0));
    const bipartite = bipartiteOf(field, labels);
    for (const line of bipartite.edges) {
      const conflict = field.conflicts.find((entry) => entry.id === line.to) as DependencyConflict;
      const side = conflict.sides.find(
        (entry) => entry.subjectId === line.from && entry.label === line.relation,
      );
      assert.equal(line.strength, side?.pressure);
    }
  });

  test('그림은 결정적이다 — 같은 충돌장이면 같은 점과 선이다', () => {
    const first = bipartiteOf(detectConflicts(GRAPHS, optionsAt(0)).field, labels);
    const again = bipartiteOf(detectConflicts(GRAPHS, optionsAt(0)).field, labels);
    assert.deepEqual(first, again);
  });

  test('주체마다 무엇에 끼어 있는지가 표로 선다', () => {
    const { field } = detectConflicts(GRAPHS, optionsAt(0));
    const rows = conflictTable(field, GRAPHS, labels);
    assert.equal(rows.length, GRAPHS.length);
    for (const row of rows) {
      assert.equal(row.internal + row.between, row.conflicts);
      if (row.conflicts === 0) assert.equal(row.worst, '(다툼 없음)');
    }
    // 사냥꾼은 제 안의 다툼(두 곳)과 남과의 다툼(벌레의 몸·고기)을 함께 진다.
    const beater = rows.find((row) => row.subjectId === beaterId);
    assert.ok((beater?.internal ?? 0) > 0);
    assert.ok((beater?.between ?? 0) > 0);
  });
});
