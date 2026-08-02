// D4-b 결핍 읽기 — 조건과 값의 거리를 0~1 로 읽는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { nodeIdOf, type DependencyNode } from '../../src/d1/index.ts';
import {
  clockDeficit,
  deficitSummary,
  readDeficit,
  snapshotOf,
  type PressureViolation,
  type SlotValue,
} from '../../src/d4/index.ts';

import { baseGraphOf, berryId, denId, plain } from '../d3/fixture.ts';

const graph = baseGraphOf(plain);
const nodeOf = (label: string): DependencyNode =>
  graph.nodes.find((node) => node.label === label) as DependencyNode;

const world = (slots: readonly SlotValue[], tick = 100) => snapshotOf(slots, tick).snapshot;
const stock = (value: number): SlotValue => ({
  domain: 'economic',
  path: `stock.${berryId}`,
  holderId: plain.id,
  value,
});

describe('D4-b 결핍', () => {
  test('조건 안이면 결핍은 0 이다', () => {
    const reading = readDeficit(nodeOf('겨울 열매'), world([stock(10)]));
    assert.equal(reading.met, true);
    assert.equal(reading.deficit, 0);
    assert.equal(reading.reason, 'met');
    assert.match(deficitSummary(reading), /채워졌다/);
  });

  test('아래로 벗어나면 벗어난 거리만큼 비어 간다', () => {
    // 조건은 2 이상, 자리의 폭은 0~10억 — 2 에서 0 까지가 벗어날 수 있는 전부다.
    assert.equal(readDeficit(nodeOf('겨울 열매'), world([stock(1)])).deficit, 0.5);
    assert.equal(readDeficit(nodeOf('겨울 열매'), world([stock(0)])).deficit, 1);
    assert.equal(readDeficit(nodeOf('겨울 열매'), world([stock(1)])).reason, 'below');
  });

  test('위로 벗어나도 같은 방식으로 읽는다', () => {
    const hunger = readDeficit(
      nodeOf('주린 몸'),
      world([{ domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.8 }]),
    );
    // 조건은 0~0.6, 자리는 0~1 — 0.8 은 0.4 중 0.2 만큼 넘었다
    assert.equal(Number(hunger.deficit.toFixed(2)), 0.5);
    assert.equal(hunger.reason, 'above');
  });

  test('아무도 적지 않은 자리는 완전히 비어 있다', () => {
    const reading = readDeficit(nodeOf('겨울 열매'), world([]));
    assert.equal(reading.deficit, 1);
    assert.equal(reading.reason, 'unwritten');
    assert.equal(reading.value, null);
  });

  test('딱 그 값이어야 하는 자리는 절반이 없다', () => {
    const here: SlotValue = {
      domain: 'physical',
      path: 'region',
      holderId: plain.id,
      value: denId,
    };
    assert.equal(readDeficit(nodeOf('겨울 굴'), world([here])).deficit, 0);
    assert.equal(
      readDeficit(nodeOf('겨울 굴'), world([{ ...here, value: berryId }])).deficit,
      1,
    );
    assert.equal(
      readDeficit(nodeOf('겨울 굴'), world([{ ...here, value: berryId }])).reason,
      'mismatch',
    );
  });

  test('시계 조건은 창을 쓰고 있으면 0, 놓치면 기다림의 비율이다', () => {
    // 12틱마다 3틱의 창
    assert.deepEqual(clockDeficit(0, 12, 3), { deficit: 0, reason: 'met' });
    assert.deepEqual(clockDeficit(2, 12, 3), { deficit: 0, reason: 'met' });
    assert.equal(clockDeficit(3, 12, 3).deficit, 1); // 막 놓쳤다 — 가장 오래 기다린다
    assert.equal(Number(clockDeficit(11, 12, 3).deficit.toFixed(2)), 0.11); // 다음 창 직전
    assert.equal(clockDeficit(12, 12, 3).deficit, 0); // 다시 열렸다
  });

  test('세계에 없는 자리를 조건으로 걸면 읽을 수 없다고 남는다', () => {
    const phantom: DependencyNode = {
      ...nodeOf('겨울 열매'),
      id: nodeIdOf(plain.id, 'resource', '허깨비'),
      label: '허깨비',
      condition: {
        kind: 'slot',
        slot: { domain: 'biological', path: 'despair' },
        holderId: plain.id,
        band: { kind: 'range', min: 0, max: 0.5 },
      },
    };
    const out: PressureViolation[] = [];
    const reading = readDeficit(phantom, world([]), out);
    assert.equal(out[0]?.rule, 'unreadable-condition');
    assert.equal(reading.deficit, 1);
    assert.equal(reading.reason, 'unreadable');
  });
});
