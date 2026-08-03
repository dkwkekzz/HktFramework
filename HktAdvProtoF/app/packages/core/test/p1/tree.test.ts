// P1-c 단위 테스트 — 압력 위에 갈래가 트리로 서는가, 그리고 열린 갈래가 세계 원소가 되는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue, type WorldSnapshot } from '../../src/d4/index.ts';
import {
  checkPossibilities,
  expandStrategies,
  possibilitiesOf,
  possibilityIdOf,
  possibilityVerdict,
  treeSummary,
  treeVerdict,
  type StrategyBranch,
} from '../../src/p1/index.ts';

import { baseGraphOf, berryId, denId, plain, timid } from '../d3/fixture.ts';

const graph = baseGraphOf(plain);

const slotsAt = (stock: number, vitality = 0.8): readonly SlotValue[] => [
  { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
  { domain: 'biological', path: 'vitality', holderId: plain.id, value: vitality },
  { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: stock },
  { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
];
const worldAt = (stock: number, tick = 100, vitality = 0.8): WorldSnapshot =>
  snapshotOf(slotsAt(stock, vitality), tick).snapshot;

const treeAt = (stock: number, tick = 100) =>
  expandStrategies(graph, evaluatePressure(graph, worldAt(stock, tick)));

describe('압력 위의 갈래 트리', () => {
  test('빈 자리에만 갈래가 선다 — 채워진 의존은 아무 목적도 만들지 않는다', () => {
    const full = treeAt(10);
    assert.deepEqual(full.branches, []);
    assert.match(treeVerdict(full), /빈 자리가 없다/);

    const empty = treeAt(0);
    assert.deepEqual(
      empty.branches.map((branch) => branch.label),
      ['겨울 열매'],
    );
    assert.deepEqual(empty.violations, []);
  });

  test('급함은 이 자리에 기댄 쪽에서 읽는다 — 창고가 비는 것이 아니라 몸이 아프다', () => {
    const branch = treeAt(0).branches[0] as StrategyBranch;
    assert.equal(branch.deficit, 1);
    assert.equal(branch.dependedBy, '주린 몸');
    assert.equal(branch.relation, 'consumes');
    assert.ok(branch.pressure > 0);
  });

  test('갈래는 압력 큰 순서로 선다', () => {
    const tree = treeAt(0);
    const pressures = tree.branches.map((branch) => branch.pressure);
    assert.deepEqual(pressures, [...pressures].sort((left, right) => right - left));
    assert.equal(tree.leadingNodeId, tree.branches[0]?.nodeId);
  });

  test('한 번도 열리지 않은 방향이 그 주체를 말한다', () => {
    const tree = treeAt(0);
    assert.deepEqual(tree.neverOpen, ['removeRival']);
    assert.equal(tree.openCounts['fulfill'], 1);
    assert.equal(tree.openCounts['removeRival'], 0);
    assert.equal(treeSummary(tree).length, 3);
  });

  test('같은 세계·같은 그래프면 같은 트리 해시다 (V1 결정성)', () => {
    const hashes = new Set(Array.from({ length: 20 }, () => treeAt(0).hash));
    assert.equal(hashes.size, 1);
    assert.notEqual(treeAt(0).hash, treeAt(1).hash);
  });

  test('트리는 직렬화 가능한 값이다 — 함수로만 존재하는 개념이 없다', () => {
    const tree = treeAt(0);
    assert.equal(typeof stateHash(JSON.parse(JSON.stringify(tree))), 'string');
  });
});

describe('열린 갈래는 O1 원소로 선다', () => {
  const tree = treeAt(0);
  const report = checkPossibilities(tree);

  test('열린 갈래마다 Possibility 하나 — 막힌 갈래는 원소가 되지 않는다', () => {
    const open = tree.branches.flatMap((branch) => branch.open);
    assert.equal(report.possibilities.length, open.length);
    assert.ok(report.kinds.every((kind) => kind === 'Possibility'));
    assert.equal(report.complete, true);
    assert.match(possibilityVerdict(report), /전부 O1 Possibility 로 선다/);
  });

  test('원소는 결핍을 가리키고 원자를 지닌다 — 원자 없는 갈래를 O1 이 거부한다', () => {
    const first = report.possibilities[0];
    assert.equal(first?.forDependencyId, tree.branches[0]?.nodeId);
    assert.ok((first?.atoms.length ?? 0) > 0);
    assert.deepEqual(first?.preconditionIds, []); // P3 이 채운다
  });

  test('갈래 ID 는 주체·결핍·방향에서 나온다 (V1 결정적 ID)', () => {
    const branch = tree.branches[0] as StrategyBranch;
    assert.equal(
      report.possibilities[0]?.id,
      possibilityIdOf(tree.subjectId, branch.nodeId, branch.open[0] as string),
    );
  });

  test('원자를 잃은 갈래는 O1 이 "가능성이 아니라 바람" 으로 거부한다', () => {
    const broken = {
      ...tree,
      branches: tree.branches.map((branch) => ({
        ...branch,
        options: branch.options.map((option) =>
          option.open ? { ...option, atoms: [] } : option,
        ),
      })),
    };
    const rejected = checkPossibilities(broken);
    assert.equal(rejected.complete, false);
    assert.match(rejected.rejections[0]?.message ?? '', /바람이다/);
    assert.match(possibilityVerdict(rejected), /O1 에서 막혔다/);
  });

  test('원소 목록은 트리에서 그대로 뽑힌다', () => {
    assert.equal(possibilitiesOf(tree).length, report.possibilities.length);
  });
});

describe('설 수 없는 전개', () => {
  const report = evaluatePressure(graph, worldAt(0));

  test('남의 압력을 내 그래프에 얹을 수 없다', () => {
    const foreign = expandStrategies(graph, { ...report, subjectId: timid.id });
    assert.equal(foreign.violations[0]?.rule, 'foreign-node');
    assert.match(foreign.violations[0]?.message ?? '', /갈래는 한 주체의 것이다/);
  });

  test('그래프에 없는 노드는 펼치지 못한다', () => {
    const ghost = deterministicId('dep-node', '없는 자리');
    const broken = expandStrategies(graph, {
      ...report,
      nodes: [
        ...report.nodes,
        { nodeId: ghost, label: '없는 자리', isRoot: false, deficit: 1, pressure: 0.5, level: 'deficient' as const, worstEdgeId: null },
      ],
    });
    assert.equal(broken.violations[0]?.rule, 'unknown-node');
  });

  test('압력이 있는데 갈래가 하나도 서지 않으면 그 사실이 남는다', () => {
    const broken = expandStrategies(graph, { ...report, nodes: [] });
    assert.equal(broken.violations[0]?.rule, 'empty-tree');
    assert.match(treeVerdict(broken), /전개가 막혔다/);
  });

  test('남의 노드가 섞이면 그 노드만 걸린다', () => {
    const stolen = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.label === '겨울 열매' ? { ...node, subjectId: timid.id } : node,
      ),
    };
    const broken = expandStrategies(stolen, report);
    assert.equal(broken.violations[0]?.rule, 'foreign-node');
    assert.match(broken.violations[0]?.message ?? '', /남의 결핍 앞에서/);
  });
});
