// P3-c 단위 테스트 — 전체를 만들지 않고 지금 걸린 것만 편다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue } from '../../src/d4/index.ts';
import { expandStrategies } from '../../src/p1/index.ts';
import { narrowTree } from '../../src/p2/index.ts';
import {
  buildContext,
  checkSubgraph,
  expandSubgraph,
  subgraphSummary,
  subgraphVerdict,
  type ExpansionContext,
} from '../../src/p3/index.ts';

import {
  berryId,
  denId,
  keeperGrammar,
  knowingGraphOf,
  lodeClaimId,
  plain,
  worldAt,
} from './fixture.ts';

const graph = knowingGraphOf(plain.id);

const slots: readonly SlotValue[] = [
  { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
  { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: 0 },
  { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
  { domain: 'informational', path: `knows.${lodeClaimId}`, holderId: plain.id, value: 0 },
];
const tree = narrowTree(
  expandStrategies(graph, evaluatePressure(graph, snapshotOf(slots, 100).snapshot), {}),
  keeperGrammar,
);
const world = worldAt(0);

const contextWith = (
  percepts: NonNullable<Parameters<typeof buildContext>[0]['percepts']>,
  memories: NonNullable<Parameters<typeof buildContext>[0]['memories']>,
): ExpansionContext =>
  buildContext({
    subjectId: plain.id,
    tick: 100,
    world,
    grammar: keeperGrammar,
    percepts,
    memories,
  });

/** 열매를 지금 보는 자 · 기억으로만 아는 자 · 아무것도 못 본 자. */
const seeing = contextWith(
  [{ holderId: berryId, domain: 'physical', path: 'integrity' }],
  [],
);
const remembering = contextWith(
  [],
  [{ holderId: berryId, domain: 'physical', path: 'integrity', value: 0.8, asOfTick: 80 }],
);
const blind = contextWith([], []);

const expand = (context: ExpansionContext) => expandSubgraph({ tree, graph, context });
const seen = expand(seeing);
const remembered = expand(remembering);
const nothing = expand(blind);

describe('같은 트리인데 근거가 다르면 편 자리가 갈린다', () => {
  test('세 근거가 같은 갈래 여덟을 놓고 여섯·여섯·하나를 편다', () => {
    for (const subgraph of [seen, remembered, nothing]) {
      assert.equal(subgraph.complete, true);
      assert.equal(subgraph.all.length, 8); // 회색도 자리를 지킨다 — 셋 다 같은 여덟이다
    }
    assert.equal(seen.trace.expanded, 6);
    assert.equal(remembered.trace.expanded, 6);
    assert.equal(nothing.trace.expanded, 1);
  });

  test('아무것도 못 본 자에게 남는 길은 찾기 하나다 — P3-a 의 뿌리와 같은 자리다', () => {
    const only = nothing.active[0];
    assert.equal(nothing.active.length, 1);
    assert.deepEqual(only?.atoms, ['seek']);
    const entry = nothing.trace.entries.find((item) => item.possibilityId === only?.id);
    assert.equal(entry?.reason, 'blind');
    assert.match(entry?.note ?? '', /관측을 만드는 갈래/);
  });

  test('본 것에는 찾기가 필요 없다 — 선행이 하나도 걸리지 않는다', () => {
    const withPrecondition = seen.active.filter(
      (possibility) => possibility.preconditionIds.length > 0,
    );
    assert.deepEqual(withPrecondition, []);
    assert.equal(seen.trace.byReason['seen'], 5);
    assert.equal(seen.trace.byReason['blind'], 1);
  });

  test('펴지 않은 가지는 사라지지 않고 사유와 함께 회색으로 남는다', () => {
    assert.equal(nothing.trace.skipped, 7);
    const grey = nothing.trace.entries.filter((entry) => !entry.active && entry.reason !== 'closed');
    assert.equal(grey.length, 7);
    for (const entry of grey) {
      assert.equal(entry.reason, 'unreached');
      assert.match(entry.note, /사라진 것이 아니라 아직인 것이다/);
    }
  });
});

describe('preconditionIds 가 처음으로 찬다', () => {
  test('기억으로만 아는 다섯 갈래가 전부 "찾기가 먼저" 를 단다', () => {
    const withPrecondition = remembered.active.filter(
      (possibility) => possibility.preconditionIds.length > 0,
    );
    assert.equal(withPrecondition.length, 5);
    const supplierIds = new Set(
      withPrecondition.flatMap((possibility) => possibility.preconditionIds),
    );
    assert.equal(supplierIds.size, 1);
  });

  test('선행으로 가리킨 것은 실제로 선 갈래이고, 그것이 찾기를 낸다', () => {
    const target = [...remembered.active]
      .flatMap((possibility) => possibility.preconditionIds)
      .at(0);
    assert.ok(target !== undefined);
    assert.ok(remembered.activeIds.includes(target));
    const supplier = remembered.active.find((possibility) => possibility.id === target);
    assert.deepEqual(supplier?.atoms, ['seek']);
    // 선행은 선행을 갖지 않는다 — 이 계층의 사슬은 한 칸이다 (긴 사슬은 P5 의 몫).
    assert.deepEqual(supplier?.preconditionIds, []);
  });

  test('펴진 가능성은 전부 O1 관문을 지난다', () => {
    for (const subgraph of [seen, remembered, nothing]) {
      for (const possibility of subgraph.active) {
        assert.deepEqual(classify(possibility).violations, []);
      }
    }
  });
});

describe('설 수 없는 조립은 사유와 함께 거부된다', () => {
  test('갈래가 선 노드가 그래프에 없으면 무엇을 두고 하는 말인지 물을 수 없다', () => {
    const stripped = { ...graph, nodes: graph.nodes.filter((node) => node.label !== '겨울 열매') };
    const result = expandSubgraph({ tree, graph: stripped, context: seeing });
    assert.ok(result.violations.some((violation) => violation.rule === 'unknown-branch-node'));
    assert.equal(result.complete, false);
  });

  test('서지 않은 것을 선행으로 가리키면 거부된다', () => {
    const broken = {
      ...remembered,
      active: remembered.active.map((possibility, index) =>
        index === 0 ? { ...possibility, preconditionIds: ['possibility:없는것'] } : possibility,
      ),
    };
    const violations = checkSubgraph(broken);
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['dangling-precondition'],
    );
    assert.match(violations[0]?.message ?? '', /서지 못한 것에 기대어/);
  });

  test('자기 자신을 선행으로 가지면 아무것도 먼저 설 수 없다', () => {
    const first = remembered.active[0];
    assert.ok(first !== undefined);
    const broken = {
      ...remembered,
      active: [{ ...first, preconditionIds: [first.id] }],
    };
    assert.match(checkSubgraph(broken)[0]?.message ?? '', /자기 자신을 선행으로/);
  });
});

describe('경계 · 결정성', () => {
  test('아무 갈래도 없는 트리는 아무것도 펴지 않되 온전하다', () => {
    const empty = expandSubgraph({
      tree: { ...tree, branches: [] },
      graph,
      context: seeing,
    });
    assert.deepEqual(empty.all, []);
    assert.deepEqual(empty.active, []);
    assert.equal(empty.complete, true);
    assert.match(subgraphVerdict(empty), /갈래 0 중 0/);
  });

  test('기억이 하나 늘면 그만큼만 더 펴진다 — 전체를 다시 만들지 않는다', () => {
    assert.equal(nothing.trace.expanded, 1);
    assert.equal(remembered.trace.expanded, 6);
    // 편 것이 늘어도 놓인 갈래는 그대로다.
    assert.equal(nothing.all.length, remembered.all.length);
  });

  test('같은 재료를 100번 조립해도 같은 해시가 나온다', () => {
    const first = stateHash(expand(remembering));
    for (let index = 0; index < 100; index += 1) {
      assert.equal(stateHash(expand(remembering)), first);
    }
  });

  test('요약이 사유 일곱을 그대로 편다', () => {
    assert.equal(subgraphSummary(seen).length, 7);
    assert.match(subgraphVerdict(remembered), /선행이 걸린 것 5/);
  });
});
