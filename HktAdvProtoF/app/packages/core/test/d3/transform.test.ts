// D3-c 전환 검사 — 능력은 의존을 제거하지 못하고 갈아탈 뿐이다 (원문 D3 조항).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { graphHash } from '../../src/d1/index.ts';
import {
  ledgerOf,
  personalizeFromWorld,
  personalizeGraph,
  personalVerdict,
  type VariationSpec,
} from '../../src/d3/index.ts';

import {
  baseGraphOf,
  DEFINITIONS,
  drawConversion,
  drawer,
  plain,
  sniffId,
  springSupply,
  timid,
} from './fixture.ts';

const base = baseGraphOf(drawer);
const options = { definitions: DEFINITIONS };

function report(variations: readonly VariationSpec[], instance = drawer) {
  return personalizeGraph(baseGraphOf(instance), instance, variations, options);
}

describe('D3-c 전환 장부', () => {
  test('덜어 낸 무게와 새로 선 무게를 센다', () => {
    const entry = ledgerOf(drawConversion, base, DEFINITIONS);
    assert.equal(entry.converts, true);
    assert.equal(Number(entry.lost.toFixed(2)), 0.5); // 0.9 → 0.4
    assert.equal(entry.gained, 0.6);
    assert.deepEqual(entry.costSlots, ['psychic.energy']);
    assert.equal(entry.onCostSlot, true);
    assert.deepEqual(entry.lostFrom, ['겨울 열매 0.9→0.4']);
  });

  test('더하기만 하는 변형은 전환이 아니다', () => {
    const entry = ledgerOf(
      { ...drawConversion, edits: [{ kind: 'add', supply: springSupply }] },
      base,
      DEFINITIONS,
    );
    assert.equal(entry.converts, false);
    assert.equal(entry.lost, 0);
  });
});

describe('D3-c 전환 검사', () => {
  test('덜어 낸 만큼 세우면 개체의 그래프가 선다', () => {
    const result = report([drawConversion]);
    assert.equal(result.complete, true);
    assert.equal(result.violations.length, 0);
    assert.equal(result.diff.addedNodes.length, 1);
    assert.equal(result.diff.changedEdges.length, 1);
    assert.deepEqual(result.diff.changedEdges[0]?.strength, [0.9, 0.4]);
    assert.match(personalVerdict(result), /전환 1건/);
  });

  test('줄이면서 아무것도 세우지 않으면 공짜다', () => {
    const result = report([{ ...drawConversion, edits: [drawConversion.edits[0] as never] }]);
    assert.equal(result.violations[0]?.rule, 'free-conversion');
    assert.match(result.violations[0]?.message ?? '', /의존은 사라지지 않고 옮겨 갈 뿐이다/);
  });

  test('더 가벼운 것으로 갈아탈 수는 없다', () => {
    const result = report([
      {
        ...drawConversion,
        edits: [
          drawConversion.edits[0] as never,
          { kind: 'add', supply: { ...springSupply, strength: 0.2 } },
        ],
      },
    ]);
    assert.equal(result.violations[0]?.rule, 'light-conversion');
  });

  test('대가 없는 능력으로는 아무것도 갈아탈 수 없다', () => {
    const result = report([
      {
        ...drawConversion,
        origin: { kind: 'capability', abilityId: sniffId },
      },
    ], { ...drawer, capabilities: [sniffId] });
    assert.equal(result.violations[0]?.rule, 'costless-conversion');
  });

  test('새 의존이 그 능력의 대가 자리에 걸리지 않으면 전환이 아니다', () => {
    const result = report([
      {
        ...drawConversion,
        edits: [
          drawConversion.edits[0] as never,
          {
            kind: 'add',
            supply: {
              ...springSupply,
              condition: {
                kind: 'slot',
                slot: { domain: 'psychic', path: 'conviction' },
                holder: { of: 'self' },
                band: { kind: 'range', min: 0.2, max: 1 },
              },
            },
          },
        ],
      },
    ]);
    assert.equal(result.violations[0]?.rule, 'costless-conversion');
    assert.match(result.violations[0]?.message ?? '', /psychic\.energy/);
  });

  test('갈아탄 것이 아니라 끊어 내면 무너짐이 빈다', () => {
    const result = report([
      {
        ...drawConversion,
        origin: { kind: 'history', eventName: '굴이 무너진 겨울' },
        edits: [
          { kind: 'drop', from: '주린 몸', to: '겨울 열매', relation: 'consumes' },
          {
            kind: 'add',
            supply: {
              ...springSupply,
              label: '두꺼운 털',
              fills: [{ kind: 'root', slot: { domain: 'biological', path: 'fertility' } }],
              strength: 1,
            },
          },
        ],
      },
    ]);
    assert.equal(
      result.violations.some((violation) => violation.rule === 'severed-need'),
      true,
    );
  });

  test('개인 그래프의 사유는 D1 관문에서 온다', () => {
    const result = report([
      {
        ...drawConversion,
        edits: [
          drawConversion.edits[0] as never,
          {
            kind: 'add',
            supply: {
              ...springSupply,
              kind: 'relationship',
              target: {
                ontology: 'State',
                id: base.subjectId,
                name: '누군가의 신뢰',
                entityKind: null,
                domain: 'relational',
              },
            },
          },
        ],
      },
    ]);
    assert.equal(
      result.violations.some((violation) => violation.rule === 'broken-graph'),
      true,
    );
  });
});

describe('D3-c 세계에서 고르기', () => {
  test('개체는 자기 유래의 변형만 받는다', () => {
    const world = [drawConversion];
    const mine = personalizeFromWorld(baseGraphOf(drawer), drawer, world, options);
    const none = personalizeFromWorld(baseGraphOf(plain), plain, world, options);

    assert.equal(mine.applied.length, 1);
    assert.equal(mine.complete, true);
    assert.equal(none.applied.length, 0);
    assert.equal(none.complete, true);
    assert.equal(graphHash(none.graph), graphHash(baseGraphOf(plain)));
  });

  test('같은 종의 둘이 같은 기본에서 갈라진다', () => {
    const one = personalizeFromWorld(baseGraphOf(timid), timid, [drawConversion], options);
    const two = personalizeFromWorld(baseGraphOf(drawer), drawer, [drawConversion], options);

    // 겁 많은 쪽은 변형 없이 급함만 흔들리고, 능력 있는 쪽은 갈래가 하나 더 선다.
    assert.equal(one.applied.length, 0);
    assert.equal(one.retunes.some((retune) => retune.moved), true);
    assert.equal(two.applied.length, 1);
    assert.equal(two.graph.nodes.length, one.graph.nodes.length + 1);
  });

  test('같은 개체를 100번 개인화해도 같은 그래프다', () => {
    const first = personalizeFromWorld(baseGraphOf(drawer), drawer, [drawConversion], options);
    for (let count = 0; count < 100; count += 1) {
      const again = personalizeFromWorld(baseGraphOf(drawer), drawer, [drawConversion], options);
      assert.equal(graphHash(again.graph), graphHash(first.graph));
    }
  });
});
