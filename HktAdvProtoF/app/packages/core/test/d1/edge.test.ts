// D1-b 단위 테스트 — 관계 7종이 D0 의 성격과 어긋나면 거부된다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { DEPENDENCY_KINDS, kindGrounding } from '../../src/d0/index.ts';
import {
  checkEdge,
  checkEdges,
  EDGE_RELATIONS,
  edgeIdOf,
  edgeSummary,
  isEdgeRelation,
  relationAccepts,
  RELATION_SPECS,
  relationSpec,
  relationsFor,
  nodeIdOf,
  type DependencyEdge,
  type DependencyNode,
  type EdgeRelation,
  type GraphViolation,
  type NodeCondition,
  type NodeTarget,
} from '../../src/d1/index.ts';

const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const meatId = deterministicId('entity', 'material', '말린 고기');
const ravineId = deterministicId('entity', 'place', '붉은 장막 협곡');
const traderId = deterministicId('subject', 'person', '행상 21');
const lawId = deterministicId('rule', 'institutional', '고개 통행법');

const target = (
  ontology: NodeTarget['ontology'],
  id: string,
  name: string,
  entityKind: NodeTarget['entityKind'] = null,
  domain: NodeTarget['domain'] = null,
): NodeTarget => ({ ontology, id, name, entityKind, domain });

function node(
  kind: DependencyNode['kind'],
  label: string,
  targetRef: NodeTarget | null,
  condition: NodeCondition,
): DependencyNode {
  return {
    id: nodeIdOf(beaterId, kind, label),
    subjectId: beaterId,
    kind,
    label,
    target: targetRef,
    condition,
    note: '겨울을 나려면 필요하다',
  };
}

const slot = (
  domain: NodeCondition extends { slot: infer S } ? never : string,
  path: string,
  min: number,
  max: number,
): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId: beaterId,
  band: { kind: 'range', min, max },
});

const foodNode = node('resource', '겨울 식량', target('Entity', meatId, '말린 고기', 'material'), slot('economic', `stock.${meatId}`, 3, 999));
const groundNode = node('space', '사냥터', target('Entity', ravineId, '붉은 장막 협곡', 'place'), slot('physical', `distance.${ravineId}`, 0, 50));
const lawNode = node('institution', '고개 통행권', target('Rule', lawId, '고개 통행법'), slot('institutional', `license.${lawId}`, 1, 1));
const poisonNode = node('information', '마비독 감별', null, slot('informational', `knows.${deterministicId('claim', 'herb', '마비독')}`, 1, 1));
const trustNode = node('relationship', '행상의 신뢰', target('State', deterministicId('state', traderId, 'trust'), '행상의 신뢰', null, 'relational'), slot('relational', `trust.${traderId}`, 0.4, 1));
const cycleNode = node('time', '장막 주기', null, { kind: 'clock', everyTicks: 12, withinTicks: 3 });

const NODES = [foodNode, groundNode, lawNode, poisonNode, trustNode, cycleNode];

const hungerEffect = {
  slot: { domain: 'biological' as const, path: 'hunger' },
  holderId: beaterId,
  change: { kind: 'delta' as const, by: 12 },
  note: '끊긴 채 사흘이면 허기가 열둘 오른다',
};

function edge(
  from: DependencyNode,
  to: DependencyNode,
  relation: EdgeRelation,
  patch: Partial<DependencyEdge> = {},
): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, relation),
    from: from.id,
    to: to.id,
    relation,
    strength: 0.8,
    urgency: 0.5,
    substitutability: 0,
    failureDelayTicks: 3,
    failureEffects: [hungerEffect],
    note: '이것이 끊기면 겨울을 못 난다',
    ...patch,
  };
}

const run = (target: DependencyEdge, nodes = NODES): readonly GraphViolation[] => {
  const out: GraphViolation[] = [];
  checkEdge(target, nodes, out);
  return out;
};

describe('관계 7종이 선다', () => {
  test('원문이 적은 일곱 개가 그대로 서고 성격을 갖는다', () => {
    assert.equal(EDGE_RELATIONS.length, 7);
    assert.equal(RELATION_SPECS.length, 7);
    assert.deepEqual(
      RELATION_SPECS.map((spec) => spec.relation),
      [...EDGE_RELATIONS],
    );
    for (const spec of RELATION_SPECS) {
      assert.notEqual(spec.label, '', spec.relation);
      assert.notEqual(spec.note, '', spec.relation);
    }
    assert.equal(isEdgeRelation('consumes'), true);
    assert.equal(isEdgeRelation('eats'), false);
  });

  test('requires 는 열한 종 전부에 걸리고, 나머지 여섯은 갈린다', () => {
    for (const kind of DEPENDENCY_KINDS) {
      assert.equal(relationAccepts('requires', kind), true, kind);
    }
    assert.deepEqual(relationSpec('requires')?.targetKinds, []);
    assert.deepEqual(relationsFor('rule'), ['requires', 'protected_by', 'authorized_by']);
    assert.deepEqual(relationsFor('time'), ['requires', 'sustained_by']);
  });

  test('소모 관계는 D0 가 쓰면 준다고 못박은 종과 정확히 같다', () => {
    const depleting = DEPENDENCY_KINDS.filter((kind) => kindGrounding(kind)?.depletes === true);
    assert.deepEqual(relationSpec('consumes')?.targetKinds, [...depleting]);
  });

  test('알려 주는 것은 정보뿐이고, 허락은 제도·규칙뿐이다', () => {
    assert.deepEqual(relationSpec('informed_by')?.targetKinds, ['information']);
    assert.deepEqual(relationSpec('authorized_by')?.targetKinds, ['institution', 'rule']);
  });

  test('식량을 소모하고 협곡을 요구하는 간선이 선다', () => {
    assert.deepEqual(run(edge(groundNode, foodNode, 'consumes')), []);
    assert.deepEqual(run(edge(foodNode, groundNode, 'requires')), []);
    assert.deepEqual(run(edge(groundNode, lawNode, 'authorized_by')), []);
    assert.deepEqual(run(edge(foodNode, poisonNode, 'informed_by', { substitutability: 0.5 })), []);
    assert.deepEqual(run(edge(foodNode, cycleNode, 'sustained_by')), []);
  });

  test('간선 ID 는 유래에서 나오고 요약이 방향을 말한다', () => {
    const e = edge(foodNode, groundNode, 'requires');
    assert.equal(e.id, edgeIdOf(foodNode.id, groundNode.id, 'requires'));
    assert.match(edgeSummary(e, NODES), /겨울 식량 --requires--> 사냥터/);
  });
});

describe('D0 의 성격을 어기면 거부된다', () => {
  test('줄지 않는 것을 소모하면 걸 수 있는 관계를 함께 알려 준다', () => {
    const violations = run(edge(foodNode, lawNode, 'consumes'));
    assert.equal(violations[0]?.rule, 'consumes-undepleting');
    assert.match(violations[0]?.message ?? '', /써도 줄지 않는다/);
    assert.match(violations[0]?.message ?? '', /requires protected_by produced_by authorized_by/);
  });

  test('알려 줄 수 없는 것에 informed_by 를 걸면 걸린다', () => {
    const violations = run(edge(foodNode, groundNode, 'informed_by'));
    assert.equal(violations[0]?.rule, 'relation-kind-mismatch');
    assert.match(violations[0]?.message ?? '', /「알게 해 준다」/);
  });

  test('사람이 허락해도 그것을 세우는 것은 제도다', () => {
    const violations = run(edge(foodNode, trustNode, 'authorized_by'));
    assert.equal(violations[0]?.rule, 'relation-kind-mismatch');
  });

  test('그 대상이어야 하는 종은 무엇으로든 대체 가능할 수 없다', () => {
    const violations = run(edge(foodNode, groundNode, 'requires', { substitutability: 1 }));
    assert.equal(violations[0]?.rule, 'substitutable-named');
    assert.match(violations[0]?.message ?? '', /D0 targeting=named/);
    // 종류로만 걸리는 종은 1 이어도 된다 — "아무 식량이든"
    assert.deepEqual(run(edge(groundNode, foodNode, 'requires', { substitutability: 1 })), []);
  });

  test('시간은 조금도 갈아탈 수 없다', () => {
    const violations = run(edge(foodNode, cycleNode, 'requires', { substitutability: 0.1 }));
    assert.equal(violations[0]?.rule, 'substitutable-named');
    assert.match(violations[0]?.message ?? '', /기다리는 것 말고 방법이 없다/);
  });
});

describe('설 수 없는 간선은 사유와 함께 거부된다', () => {
  test('자기 자신에 기대면 스스로 채워지는 결핍이라고 말한다', () => {
    const self = edge(foodNode, foodNode, 'requires');
    const violations = run({ ...self, id: edgeIdOf(foodNode.id, foodNode.id, 'requires') });
    assert.equal(violations[0]?.rule, 'self-edge');
  });

  test('없는 노드를 가리키면 어느 쪽인지 지목한다', () => {
    const ghost = edge(foodNode, groundNode, 'requires');
    const violations = run({ ...ghost, to: 'dep-node:000000000000', id: edgeIdOf(foodNode.id, 'dep-node:000000000000', 'requires') });
    assert.equal(violations[0]?.rule, 'dangling-edge');
    assert.match(violations[0]?.path ?? '', /\.to$/);
  });

  test('관계 7종 밖이면 그 자체로 걸린다', () => {
    const violations = run(edge(foodNode, groundNode, 'eats' as never));
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'unknown-relation');
  });

  test('강도 0 은 기댐이 아니다', () => {
    const violations = run(edge(foodNode, groundNode, 'requires', { strength: 0 }));
    assert.equal(violations[0]?.rule, 'bad-edge');
    assert.match(violations[0]?.message ?? '', /끊겨도 아무 일이 없고/);
  });

  test('수치의 범위와 끊김의 시한이 각각 걸린다', () => {
    assert.match(run(edge(foodNode, groundNode, 'requires', { urgency: 1.5 }))[0]?.path ?? '', /urgency/);
    assert.match(
      run(edge(foodNode, groundNode, 'requires', { substitutability: -1 }))[0]?.path ?? '',
      /substitutability/,
    );
    assert.match(
      run(edge(foodNode, groundNode, 'requires', { failureDelayTicks: 0 }))[0]?.path ?? '',
      /failureDelayTicks/,
    );
  });

  test('끊겨도 아무것도 남지 않으면 아무도 눈치채지 못한다', () => {
    const violations = run(edge(foodNode, groundNode, 'requires', { failureEffects: [] }));
    assert.equal(violations[0]?.rule, 'traceless-failure');
    assert.match(violations[0]?.message ?? '', /목적을 만들지 못한다/);
  });

  test('세계에 없는 자리에는 흔적이 남지 않는다', () => {
    const violations = run(
      edge(foodNode, groundNode, 'requires', {
        failureEffects: [{ ...hungerEffect, slot: { domain: 'biological', path: 'despair' } }],
      }),
    );
    assert.equal(violations[0]?.rule, 'phantom-effect-slot');
  });

  test('0 만큼 움직이는 흔적은 흔적이 아니다', () => {
    const violations = run(
      edge(foodNode, groundNode, 'requires', {
        failureEffects: [{ ...hungerEffect, change: { kind: 'delta', by: 0 } }],
      }),
    );
    assert.equal(violations[0]?.rule, 'traceless-failure');
  });

  test('수치 자리가 아닌 곳에 얼마나 움직이는지를 적을 수 없다', () => {
    const violations = run(
      edge(foodNode, groundNode, 'requires', {
        failureEffects: [
          {
            slot: { domain: 'physical', path: 'broken' },
            holderId: meatId,
            change: { kind: 'delta', by: 1 },
            note: '부서진다',
          },
        ],
      }),
    );
    assert.equal(violations[0]?.rule, 'phantom-effect-slot');
    assert.match(violations[0]?.message ?? '', /수치 자리가 아니다/);
  });

  test('손으로 지은 ID 와 근거 없는 간선은 각각 걸린다', () => {
    assert.match(
      run(edge(foodNode, groundNode, 'requires', { id: 'dep-edge:0000' }))[0]?.message ?? '',
      /손으로 지은 ID/,
    );
    assert.equal(run(edge(foodNode, groundNode, 'requires', { note: '' }))[0]?.rule, 'bad-edge');
  });
});

describe('같은 기댐을 두 번 적지 않는다', () => {
  test('같은 두 노드를 같은 관계로 두 번 이으면 걸린다', () => {
    const out: GraphViolation[] = [];
    const twice = edge(foodNode, groundNode, 'requires');
    checkEdges([twice, { ...twice, strength: 0.2 }], NODES, out);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.rule, 'duplicate-edge');
  });

  test('관계가 다르면 같은 두 노드를 두 번 이어도 된다', () => {
    const out: GraphViolation[] = [];
    checkEdges(
      [edge(groundNode, foodNode, 'requires'), edge(groundNode, foodNode, 'consumes')],
      NODES,
      out,
    );
    assert.deepEqual(out, []);
  });

  test('검사는 결정적이다', () => {
    const wrong = edge(foodNode, lawNode, 'consumes');
    assert.deepEqual(run(wrong), run(wrong));
  });
});
