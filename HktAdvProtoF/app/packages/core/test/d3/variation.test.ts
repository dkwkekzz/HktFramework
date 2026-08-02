// D3-b 변형 문법 — 더함·약화·끊음 셋뿐이고, 유래를 대지 못하면 서지 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVariation,
  checkVariations,
  editSummary,
  edgeOfEdit,
  hasOrigin,
  nodeByLabel,
  originLabel,
  variationsFor,
  type PersonalViolation,
  type VariationSpec,
} from '../../src/d3/index.ts';

import {
  baseGraphOf,
  cultureId,
  drawConversion,
  drawId,
  drawer,
  plain,
  roleId,
  springSupply,
  traitId,
  timid,
} from './fixture.ts';

const base = baseGraphOf(drawer);

function rules(variation: VariationSpec, instance = drawer): readonly string[] {
  const out: PersonalViolation[] = [];
  checkVariations(instance, [variation], base, out);
  return out.map((violation) => violation.rule);
}

describe('D3-b 유래', () => {
  test('다섯 유래를 개체가 실제로 가졌는지 본다', () => {
    assert.equal(hasOrigin(drawer, { kind: 'capability', abilityId: drawId }), true);
    assert.equal(hasOrigin(plain, { kind: 'capability', abilityId: drawId }), false);
    assert.equal(hasOrigin(plain, { kind: 'culture', cultureId }), true);
    assert.equal(hasOrigin(plain, { kind: 'role', roleId }), true);
    assert.equal(hasOrigin(timid, { kind: 'trait', traitId }), true);
    assert.equal(hasOrigin(plain, { kind: 'trait', traitId }), false);
    assert.equal(hasOrigin(drawer, { kind: 'history', eventName: '굴이 무너진 겨울' }), true);
    assert.equal(hasOrigin(drawer, { kind: 'history', eventName: '없던 일' }), false);
  });

  test('세계의 변형 중 자기 것만 골라 온다', () => {
    const world = [drawConversion, { ...drawConversion, id: 'other', origin: { kind: 'trait', traitId } as const }];
    assert.deepEqual(
      variationsFor(drawer, world).map((entry) => entry.id),
      ['draw-conversion'],
    );
    assert.deepEqual(variationsFor(plain, world), []);
  });

  test('유래의 이름이 한 마디로 읽힌다', () => {
    assert.equal(originLabel({ kind: 'capability', abilityId: drawId }), '능력');
    assert.equal(originLabel({ kind: 'history', eventName: 'x' }), '이력');
  });
});

describe('D3-b 편집', () => {
  test('가리키는 노드·간선을 이름으로 찾는다', () => {
    assert.equal(nodeByLabel(base, '겨울 열매')?.label, '겨울 열매');
    assert.equal(nodeByLabel(base, '여름 열매'), null);
    assert.equal(
      edgeOfEdit(base, {
        kind: 'drop',
        from: '주린 몸',
        to: '겨울 열매',
        relation: 'consumes',
      })?.strength,
      0.9,
    );
  });

  test('약화는 강도만 낮추고 나머지는 그대로 둔다', () => {
    const graph = applyVariation(base, drawConversion, drawer, null);
    const edge = graph.edges.find(
      (entry) => graph.nodes.find((node) => node.id === entry.from)?.label === '주린 몸',
    );
    assert.equal(edge?.strength, 0.4);
    assert.equal(edge?.urgency, 0.8); // 급함은 뿌리의 것이므로 흔들리지 않는다
  });

  test('더함은 노드 하나와 채우는 것마다 간선 하나를 낳는다', () => {
    const graph = applyVariation(base, drawConversion, drawer, null);
    assert.equal(graph.nodes.length, base.nodes.length + 1);
    assert.equal(graph.edges.length, base.edges.length + 1);
    const added = graph.nodes.find((node) => node.label === '의념의 샘');
    assert.equal(added?.subjectId, drawer.id);
    // 뿌리에 걸린 시한은 개체의 Need 가 정한다 — 채움이 적은 값이 아니다.
    const edge = graph.edges.find((entry) => entry.to === added?.id);
    assert.equal(edge?.failureDelayTicks, 30);
    assert.equal(edge?.urgency, 0.8);
  });

  test('끊음은 간선만 지운다 — 노드를 지우는 편집은 문법에 없다', () => {
    const graph = applyVariation(
      base,
      {
        ...drawConversion,
        edits: [{ kind: 'drop', from: '주린 몸', to: '겨울 열매', relation: 'consumes' }],
      },
      drawer,
      null,
    );
    assert.equal(graph.nodes.length, base.nodes.length);
    assert.equal(graph.edges.length, base.edges.length - 1);
  });

  test('편집 한 줄이 읽힌다', () => {
    assert.equal(editSummary({ kind: 'add', supply: springSupply }), '+ 의념의 샘');
    assert.match(
      editSummary({ kind: 'drop', from: 'a', to: 'b', relation: 'requires' }),
      /✕ a --requires--> b/,
    );
  });
});

describe('D3-b 변형 검사', () => {
  test('온전한 변형은 아무것도 걸리지 않는다', () => {
    assert.deepEqual(rules(drawConversion), []);
  });

  test('갖지 않은 유래는 거부된다', () => {
    assert.deepEqual(rules(drawConversion, plain), ['orphan-variation']);
  });

  test('없는 간선·없는 채움을 가리키면 거부된다', () => {
    assert.deepEqual(
      rules({
        ...drawConversion,
        edits: [{ kind: 'weaken', from: '주린 몸', to: '여름 열매', relation: 'consumes', strength: 0.4 }],
      }),
      ['phantom-edit'],
    );
    assert.deepEqual(
      rules({
        ...drawConversion,
        edits: [
          {
            kind: 'add',
            supply: { ...springSupply, fills: [{ kind: 'supply', label: '여름 열매' }] },
          },
        ],
      }),
      ['phantom-edit'],
    );
  });

  test('강도가 줄지 않는 약화와 0 이하의 약화는 거부된다', () => {
    assert.deepEqual(
      rules({
        ...drawConversion,
        edits: [{ kind: 'weaken', from: '주린 몸', to: '겨울 열매', relation: 'consumes', strength: 0.95 }],
      }),
      ['bad-variation'],
    );
    assert.deepEqual(
      rules({
        ...drawConversion,
        edits: [{ kind: 'weaken', from: '주린 몸', to: '겨울 열매', relation: 'consumes', strength: 0 }],
      }),
      ['bad-variation'],
    );
  });

  test('아무것도 바꾸지 않는 변형과 근거 없는 변형은 거부된다', () => {
    assert.deepEqual(rules({ ...drawConversion, edits: [] }), ['bad-variation']);
    assert.deepEqual(rules({ ...drawConversion, note: '' }), ['bad-variation']);
  });
});
