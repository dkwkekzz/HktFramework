// P4-b 단위 테스트 — 아홉이 앞 계층에서 오는가, 같은 값이 두 방향으로 읽히는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import type { Possibility } from '../../src/o1/index.ts';
import type { ValueTarget } from '../../src/s0/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue } from '../../src/d4/index.ts';
import { expandStrategies } from '../../src/p1/index.ts';
import { narrowTree } from '../../src/p2/index.ts';
import { buildContext, expandSubgraph } from '../../src/p3/index.ts';
import {
  checkFactors,
  checkFactorSources,
  factorsOf,
  factorSourceOf,
  factorSummary,
  factorVerdict,
  FACTOR_SOURCES,
  GOAL_FACTORS,
  PROMISE_SCALE,
  SUNK_FULL_TICKS,
  type FactorSpec,
  type GoalFactorId,
} from '../../src/p4/index.ts';

import {
  berryId,
  denId,
  keeperGrammar,
  knowingGraphOf,
  lodeClaimId,
  neighborId,
  plain,
  worldAt,
} from '../p3/fixture.ts';

const graph = knowingGraphOf(plain.id);
const slots: readonly SlotValue[] = [
  { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
  { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: 0 },
  { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
  { domain: 'informational', path: `knows.${lodeClaimId}`, holderId: plain.id, value: 0 },
];
const pressure = evaluatePressure(graph, snapshotOf(slots, 100).snapshot);
const tree = narrowTree(expandStrategies(graph, pressure, {}), keeperGrammar);
const world = worldAt(4);

const context = buildContext({
  subjectId: plain.id,
  tick: 100,
  world,
  grammar: keeperGrammar,
  percepts: [
    { holderId: berryId, domain: 'physical', path: 'integrity' },
    { holderId: denId, domain: 'physical', path: 'cover' },
  ],
});
const subgraph = expandSubgraph({ tree, graph, context });

/** 이웃과의 사이를 0.5 의 무게로 미는 유지 하나 — S0 이 "P4 의 가중치" 라 적어 둔 자리다. */
const trustValue: ValueTarget = {
  slot: { domain: 'relational', path: `trust.${neighborId}` },
  holderId: plain.id,
  band: { kind: 'range', min: 0.5, max: 1 },
  weight: 0.5,
  note: '이웃과의 사이가 마르면 굴을 지킬 수 없다',
};

const spec: FactorSpec = {
  subject: { id: plain.id, values: [trustValue] },
  world,
  tree,
  context,
  subgraph,
  tick: 100,
};

const first = subgraph.active[0] as Possibility;
/** 같은 자리·같은 근거에 원자만 갈아 끼운 후보 — 동의 축 하나만 갈린다. */
const via = (atom: string): Possibility => ({ ...first, atoms: [atom] as Possibility['atoms'] });
const valueOf = (candidate: Possibility, id: GoalFactorId): number =>
  factorsOf(candidate, spec).factors.find((item) => item.id === id)?.value ?? Number.NaN;

describe('P4-b 평가 요소 아홉', () => {
  test('아홉은 원문이 적은 아홉이고, P4 자신이 출처인 것은 매몰비용 하나뿐이다', () => {
    assert.equal(GOAL_FACTORS.length, 9);
    assert.deepEqual(checkFactorSources(), []);
    assert.equal(FACTOR_SOURCES.filter((source) => source.layer === 'P4').length, 1);
    assert.equal(factorSourceOf('sunk')?.layer, 'P4');
  });

  test('출처표를 손대면 걸린다 — 요소를 하나 더 만들어 값을 넣는 길이 막힌다', () => {
    const invented = checkFactorSources([
      ...FACTOR_SOURCES,
      { id: 'mood' as GoalFactorId, layer: 'P4', reads: '', direction: 'pull', weight: 1, note: '' },
    ]);
    assert.deepEqual(
      [...new Set(invented.map((violation) => violation.rule))],
      ['unsourced-factor'],
    );

    // 앞 계층에서 오던 요소를 P4 자신에게서 온다고 적으면 걸린다.
    const seized = checkFactorSources(
      FACTOR_SOURCES.map((source) => (source.id === 'pressure' ? { ...source, layer: 'P4' } : source)),
    );
    assert.equal(seized.length, 1);
    assert.equal(seized[0]?.rule, 'unsourced-factor');

    // 아홉 중 하나가 빠져도 걸린다.
    assert.equal(
      checkFactorSources(FACTOR_SOURCES.filter((source) => source.id !== 'memory')).length,
      1,
    );
  });

  test('후보마다 아홉이 서고 값은 전부 −1~1 안이다', () => {
    for (const candidate of subgraph.active) {
      const factors = factorsOf(candidate, spec);
      assert.equal(factors.factors.length, 9);
      assert.deepEqual(
        factors.factors.map((item) => item.id),
        [...GOAL_FACTORS],
      );
      assert.deepEqual(checkFactors(factors), []);
      assert.equal(factorSummary(factors).length, 9);
      assert.ok(factorVerdict(factors).length > 0);
    }
  });

  test('압력은 P1 이 갈래에 붙인 값 그대로다 — 두 곳에서 재지 않는다', () => {
    for (const candidate of subgraph.active) {
      const branch = tree.branches.find((item) => item.nodeId === candidate.forDependencyId);
      assert.equal(valueOf(candidate, 'pressure'), branch?.pressure);
    }
  });

  test('같은 신뢰 하나가 동의 축에 따라 반대로 읽힌다', () => {
    // 사이는 세계에 0.4 로 적혀 있다. 합의로 서는 길에는 재료이고, 등지는 길에는 잃을 것이다.
    assert.equal(valueOf(via('exchange'), 'relations'), 0.4);
    assert.equal(valueOf(via('seize'), 'relations'), -0.4);
    // 남이 없어도 서는 길은 사이를 읽지 않는다.
    assert.equal(valueOf(via('acquire'), 'relations'), 0);
  });

  test('가치관은 그 자리를 세우면 당기고 깎으면 민다', () => {
    // 주고받기는 relational.trust 를 세우는 유일한 원자다 (P3-a).
    assert.equal(valueOf(via('exchange'), 'values'), trustValue.weight);
    // 빼앗기·설득은 그 자리를 치른다.
    assert.equal(valueOf(via('seize'), 'values'), -trustValue.weight);
    // 그 자리를 건드리지 않는 길은 가치관이 말이 없다.
    assert.equal(valueOf(via('acquire'), 'values'), 0);
  });

  test('약속은 빚을 더 지는 길과 등지는 길을 민다 — 그 밖의 합의는 갚을 자리다', () => {
    const owed = Math.min(1, 12 / PROMISE_SCALE); // 세계에 적힌 빚 12
    assert.equal(valueOf(via('exchange'), 'promise'), owed);
    assert.equal(valueOf(via('seize'), 'promise'), -owed);
    // 동맹은 빚 자리를 쓰는 유일한 원자다 — 합의인데도 민다.
    assert.equal(valueOf(via('ally'), 'promise'), -owed);
    assert.equal(valueOf(via('acquire'), 'promise'), 0);
  });

  test('위험은 P0 걸림 셋에서 온다 — 되돌림·되받음·되돌려 줄 행동 없음', () => {
    // 획득: 되돌릴 수 있고 남이 없으며 몸을 치른다 → 셋 중 하나
    assert.equal(Math.round(valueOf(via('acquire'), 'risk') * 3), -1);
    // 빼앗기: 되돌릴 수 없고 뜻을 거스르며 몸을 치른다 → 셋 다
    assert.equal(valueOf(via('seize'), 'risk'), -1);
    // 주고받기: 되돌릴 수 있고 합의이며 재고를 치른다(세울 수 있는 자리다) → 하나도 없다
    assert.equal(valueOf(via('exchange'), 'risk'), 0);
  });

  test('성공 가능성은 선행이 걸릴수록 깎이고, 맞설 수 있는 대상에게서 줄어든다', () => {
    // 창고가 비었으므로 주고받기는 재료 선행이 걸린다(P4-a) + 대상이 맞설 수 있다.
    const blocked = valueOf(via('exchange'), 'feasibility');
    const open = valueOf(via('acquire'), 'feasibility');
    assert.ok(blocked < open, `${String(blocked)} < ${String(open)}`);
    assert.equal(open, 1);
  });

  test('매몰비용은 이전에 좇던 그 목적에만 붙는다', () => {
    const held = factorsOf(first, {
      ...spec,
      tick: 100,
      previous: { possibilityId: first.id, sinceTick: 100 - SUNK_FULL_TICKS },
    });
    assert.equal(held.factors.find((item) => item.id === 'sunk')?.value, 1);

    const other = factorsOf(via('acquire'), {
      ...spec,
      previous: { possibilityId: 'possibility:다른것', sinceTick: 0 },
    });
    assert.equal(other.factors.find((item) => item.id === 'sunk')?.value, 0);
  });

  test('P3 이 펴지 않은 것을 후보로 들면 걸린다', () => {
    const phantom = factorsOf({ ...first, id: 'possibility:없는것' }, spec);
    assert.deepEqual(
      phantom.violations.map((violation) => violation.rule),
      ['phantom-candidate'],
    );
  });

  test('범위 밖 값·선언과 다른 계층은 요소 검사에서 걸린다', () => {
    const sound = factorsOf(first, spec);
    const broken = checkFactors({
      ...sound,
      factors: [
        { ...(sound.factors[0] as (typeof sound.factors)[number]), value: 4 },
        { ...(sound.factors[1] as (typeof sound.factors)[number]), layer: 'W9' },
      ],
    });
    assert.deepEqual(
      [...new Set(broken.map((violation) => violation.rule))],
      ['factor-out-of-range', 'unsourced-factor'].sort(),
    );
  });

  test('같은 재료면 같은 요소다', () => {
    assert.equal(stateHash(factorsOf(first, spec)), stateHash(factorsOf(first, spec)));
  });
});
