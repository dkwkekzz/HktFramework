// D1-a 단위 테스트 — 노드의 조건은 그 종이 읽는 자리여야 한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  checkNode,
  checkNodes,
  conditionSummary,
  nodeIdOf,
  nodeSummary,
  targetAsOntic,
  type DependencyNode,
  type GraphViolation,
  type NodeCondition,
  type NodeTarget,
} from '../../src/d1/index.ts';

const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const ravineId = deterministicId('entity', 'place', '붉은 장막 협곡');
const meatId = deterministicId('entity', 'material', '말린 고기');

const meatTarget: NodeTarget = {
  ontology: 'Entity',
  id: meatId,
  name: '말린 고기',
  entityKind: 'material',
  domain: null,
};
const ravineTarget: NodeTarget = {
  ontology: 'Entity',
  id: ravineId,
  name: '붉은 장막 협곡',
  entityKind: 'place',
  domain: null,
};

/** 노드 하나를 짓는다 — id 는 항상 유래에서 나온다. */
function node(
  kind: DependencyNode['kind'],
  label: string,
  target: NodeTarget | null,
  condition: NodeCondition,
  note = '겨울을 나려면 필요하다',
): DependencyNode {
  return {
    id: nodeIdOf(beaterId, kind, label),
    subjectId: beaterId,
    kind,
    label,
    target,
    condition,
    note,
  };
}

const stockCondition: NodeCondition = {
  kind: 'slot',
  slot: { domain: 'economic', path: `stock.${meatId}` },
  holderId: beaterId,
  band: { kind: 'range', min: 3, max: 999 },
};

const foodNode = node('resource', '겨울 식량', meatTarget, stockCondition);

const veilCycle = node(
  'time',
  '장막이 걷히는 주기',
  null,
  { kind: 'clock', everyTicks: 12, withinTicks: 3 },
  '장막이 걷힌 사흘 안에만 협곡에 들어갈 수 있다',
);

const run = (target: DependencyNode): readonly GraphViolation[] => {
  const out: GraphViolation[] = [];
  checkNode(target, out);
  return out;
};

describe('노드는 종 위에 선다', () => {
  test('자원 노드가 재고 자리를 조건으로 걸고 선다', () => {
    assert.deepEqual(run(foodNode), []);
    assert.match(nodeSummary(foodNode), /\[자원\] 겨울 식량 → 말린 고기/);
    assert.match(conditionSummary(stockCondition), /economic\.stock\./);
  });

  test('시간 노드만 틱 조건을 갖는다', () => {
    assert.deepEqual(run(veilCycle), []);
    assert.equal(conditionSummary(veilCycle.condition), '12틱마다 · 3틱 안에');
  });

  test('ID 는 유래에서 나온다 — 같은 주체·종·이름이면 같은 노드다', () => {
    assert.equal(nodeIdOf(beaterId, 'resource', '겨울 식량'), foodNode.id);
    assert.notEqual(nodeIdOf(beaterId, 'space', '겨울 식량'), foodNode.id);
    assert.match(foodNode.id, /^dep-node:/);
  });

  test('대상 참조가 D0 관문이 읽는 모양으로 바뀐다', () => {
    const ontic = targetAsOntic(meatTarget) as { kind: string; entityKind?: string };
    assert.equal(ontic.kind, 'Entity');
    assert.equal(ontic.entityKind, 'material');
  });

  test('종류로만 걸린 노드는 대상 없이 선다', () => {
    const anyFood = node('resource', '아무 식량이든', null, stockCondition);
    assert.deepEqual(run(anyFood), []);
    assert.match(nodeSummary(anyFood), /→ 종류로만/);
  });
});

describe('설 수 없는 노드는 사유와 함께 거부된다', () => {
  test('종이 읽지 않는 자리를 조건으로 걸면 다른 종의 의존이라고 말한다', () => {
    const wrong = node('resource', '겨울 식량', meatTarget, {
      kind: 'slot',
      slot: { domain: 'relational', path: `trust.${beaterId}` },
      holderId: beaterId,
      band: { kind: 'range', min: 0.5, max: 0.9 },
    });
    const violations = run(wrong);
    assert.equal(violations[0]?.rule, 'off-domain-condition');
    assert.match(violations[0]?.message ?? '', /다른 종의 의존이다/);
    assert.match(violations[0]?.path ?? '', /condition\.slot\.domain/);
  });

  test('세계에 없는 자리는 기다릴 수 없다', () => {
    const ghost = node('resource', '겨울 식량', meatTarget, {
      kind: 'slot',
      slot: { domain: 'economic', path: 'abundance' },
      holderId: beaterId,
      band: { kind: 'range', min: 1, max: 2 },
    });
    assert.equal(run(ghost)[0]?.rule, 'phantom-slot');
  });

  test('9영역 밖의 영역은 그 자체로 걸린다', () => {
    const ghost = node('resource', '겨울 식량', meatTarget, {
      kind: 'slot',
      slot: { domain: 'wealth' as never, path: 'stock' },
      holderId: beaterId,
      band: { kind: 'range', min: 1, max: 2 },
    });
    assert.equal(run(ghost)[0]?.rule, 'phantom-slot');
  });

  test('자리 전체를 범위로 잡으면 결코 벗어나지 않는 조건으로 걸린다', () => {
    const always = node('resource', '겨울 식량', meatTarget, {
      kind: 'slot',
      slot: { domain: 'economic', path: `stock.${meatId}` },
      holderId: beaterId,
      band: { kind: 'range', min: 0, max: 1000000000 },
    });
    const violations = always.condition.kind === 'slot' ? run(always) : [];
    assert.equal(violations[0]?.rule, 'bad-band');
    assert.match(violations[0]?.message ?? '', /결코 벗어나지 않는 조건/);
  });

  test('시간이 아닌 종이 틱 조건을 쓰면 걸린다', () => {
    const wrong = node('resource', '겨울 식량', meatTarget, {
      kind: 'clock',
      everyTicks: 12,
      withinTicks: 3,
    });
    const violations = run(wrong);
    assert.equal(violations[0]?.rule, 'clock-condition-misuse');
    assert.match(violations[0]?.message ?? '', /시간 종만 쓴다/);
  });

  test('시간 종이 자리 조건을 쓰면 적힐 자리가 없다고 말한다', () => {
    const wrong = node('time', '장막이 걷히는 주기', null, stockCondition);
    const violations = run(wrong);
    assert.equal(violations[0]?.rule, 'slot-condition-missing');
    assert.match(violations[0]?.message ?? '', /D0 가 남긴 부채/);
  });

  test('오지 않는 주기와 늘 열린 창은 각각 걸린다', () => {
    const never = node('time', '주기', null, { kind: 'clock', everyTicks: 0, withinTicks: 1 });
    assert.match(run(never)[0]?.path ?? '', /everyTicks/);
    const always = node('time', '주기', null, { kind: 'clock', everyTicks: 12, withinTicks: 20 });
    assert.match(run(always)[0]?.message ?? '', /주기보다 긴 창/);
  });

  test('선언한 종과 대상이 어긋나면 D0 관문이 그대로 잡는다', () => {
    const wrong = node('resource', '겨울 식량', ravineTarget, stockCondition);
    const violations = run(wrong);
    assert.equal(violations[0]?.rule, 'kind-target-mismatch');
    assert.match(violations[0]?.message ?? '', /\[space\] 로 걸 수 있다/);
  });

  test('그 대상이어야 하는 종은 종류로만 걸 수 없다', () => {
    const named = node('space', '사냥터', null, {
      kind: 'slot',
      slot: { domain: 'physical', path: `distance.${ravineId}` },
      holderId: beaterId,
      band: { kind: 'range', min: 0, max: 50 },
    });
    assert.equal(run(named)[0]?.rule, 'kind-target-mismatch');
  });

  test('11종 밖의 종은 조건을 따지기 전에 걸린다', () => {
    const wrong = { ...foodNode, kind: 'supply' as never };
    const violations = run(wrong);
    // 종이 바뀌면 유래에서 나온 ID 도 함께 어긋난다 — 둘 다 지목하고 거기서 멈춘다.
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['bad-node', 'unknown-kind'],
    );
  });

  test('이름·근거 없는 노드와 손으로 지은 ID 는 각각 걸린다', () => {
    const bare: DependencyNode = { ...foodNode, note: '' };
    assert.equal(run(bare)[0]?.rule, 'bad-node');
    const forged: DependencyNode = { ...foodNode, id: 'dep-node:deadbeef0000' };
    const violations = run(forged);
    assert.equal(violations[0]?.rule, 'bad-node');
    assert.match(violations[0]?.message ?? '', /손으로 지은 ID/);
  });
});

describe('같은 것에 두 번 기대지 않는다', () => {
  test('종·대상·조건이 같은 노드가 둘이면 걸린다', () => {
    const twin = node('resource', '비상 식량', meatTarget, stockCondition);
    const out: GraphViolation[] = [];
    checkNodes([foodNode, twin], out);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.rule, 'duplicate-node');
    assert.match(out[0]?.message ?? '', /「겨울 식량」/);
  });

  test('조건이 다르면 같은 대상에 두 번 기대도 된다 — 급함이 다른 두 문턱이다', () => {
    const urgent = node('resource', '굶어 죽지 않을 만큼', meatTarget, {
      kind: 'slot',
      slot: { domain: 'economic', path: `stock.${meatId}` },
      holderId: beaterId,
      band: { kind: 'range', min: 1, max: 999 },
    });
    const out: GraphViolation[] = [];
    checkNodes([foodNode, urgent], out);
    assert.deepEqual(out, []);
  });

  test('검사는 결정적이다 — 같은 노드면 같은 사유', () => {
    const wrong = node('resource', '겨울 식량', ravineTarget, stockCondition);
    assert.deepEqual(run(wrong), run(wrong));
  });
});
