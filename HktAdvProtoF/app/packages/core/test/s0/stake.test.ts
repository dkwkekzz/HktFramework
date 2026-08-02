// S0-c 의존·유지 자리 — 무너지는 조건은 안에, 밀고 가는 방향은 밖에도.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  bandHolds,
  checkNeeds,
  checkValues,
  describeBand,
  MAX_COLLAPSE_TICKS,
  needSummary,
  stakeLabel,
  valueSummary,
  type Boundary,
  type Need,
  type SubjectRef,
  type SubjectViolation,
  type ValueTarget,
} from '../../src/s0/index.ts';

const hunterId = deterministicId('subject', 'veil', 'hunter');
const merchantId = deterministicId('subject', 'veil', 'merchant');
const nationId = deterministicId('subject', 'veil', 'nation');
const bodyId = deterministicId('entity', 'veil', 'hunter-body');
const herbId = deterministicId('entity', 'veil', 'herb');

const hunter: SubjectRef = { id: hunterId, name: '붉은 장막 사냥꾼', subjectKind: 'person' };
const nation: SubjectRef = { id: nationId, name: '협곡 국가', subjectKind: 'nation' };

const hunterBoundaries: readonly Boundary[] = [
  { kind: 'body', ofId: bodyId, note: '사냥꾼의 몸' },
];

/** 배고프면 죽는다 — 허기가 0.6 을 넘긴 채 30틱이 지나면 무너진다. */
const hungerNeed: Need = {
  slot: { domain: 'biological', path: 'hunger' },
  holderId: hunterId,
  band: { kind: 'range', min: 0, max: 0.6 },
  urgency: 0.8,
  collapseAfterTicks: 30,
  note: '허기가 이 위로 오래 머물면 사냥할 힘이 남지 않는다',
};

/** 행상이 나를 믿게 만들고 싶다 — 내 경계 밖의 자리다. */
const trustValue: ValueTarget = {
  slot: { domain: 'relational', path: `trust.${hunterId}` },
  holderId: merchantId,
  band: { kind: 'range', min: 0.2, max: 1 },
  weight: 0.6,
  note: '약초를 제값에 팔려면 행상의 신뢰가 필요하다',
};

function needRules(
  needs: readonly Need[],
  subject: SubjectRef = hunter,
  boundaries: readonly Boundary[] = hunterBoundaries,
): string[] {
  const out: SubjectViolation[] = [];
  checkNeeds(subject, needs, boundaries, out);
  return out.map((violation) => violation.rule);
}

function valueRules(values: readonly ValueTarget[], subject: SubjectRef = hunter): string[] {
  const out: SubjectViolation[] = [];
  checkValues(subject, values, out);
  return out.map((violation) => violation.rule);
}

describe('범위', () => {
  test('지금 값이 범위 안인지 그대로 읽힌다', () => {
    assert.equal(bandHolds({ kind: 'range', min: 0, max: 0.6 }, 0.5), true);
    assert.equal(bandHolds({ kind: 'range', min: 0, max: 0.6 }, 0.6), true);
    assert.equal(bandHolds({ kind: 'range', min: 0, max: 0.6 }, 0.7), false);
    assert.equal(bandHolds({ kind: 'is', value: '없음' }, '없음'), true);
    assert.equal(bandHolds({ kind: 'is', value: '없음' }, '마비독'), false);
    assert.equal(bandHolds({ kind: 'range', min: 0, max: 1 }, '많음'), false);
  });

  test('범위와 자리를 한 줄로 읽는다', () => {
    assert.equal(describeBand({ kind: 'range', min: 0, max: 0.6 }), '0~0.6');
    assert.equal(stakeLabel(hungerNeed), `biological.${hunterId}.hunger`);
  });
});

describe('의존 검사', () => {
  test('사냥꾼의 허기·체력 의존이 선다', () => {
    assert.deepEqual(
      needRules([
        hungerNeed,
        {
          slot: { domain: 'biological', path: 'vitality' },
          holderId: hunterId,
          band: { kind: 'range', min: 0.3, max: 1 },
          urgency: 1,
          collapseAfterTicks: 1,
          note: '체력이 바닥나면 그 자리에서 끝난다',
        },
      ]),
      [],
    );
  });

  test('국가는 정당성으로 무너진다 — 몸 없는 주체도 무너질 조건을 갖는다', () => {
    assert.deepEqual(
      needRules(
        [
          {
            slot: { domain: 'transcendent', path: 'legitimacy' },
            holderId: nationId,
            band: { kind: 'range', min: 0.35, max: 1 },
            urgency: 0.5,
            collapseAfterTicks: 400,
            note: '정당성이 이 아래로 오래 머물면 국가는 조직으로 흩어진다',
          },
        ],
        nation,
        [{ kind: 'membership', ofId: hunterId, note: '국민' }],
      ),
      [],
    );
  });

  test('남의 자리는 내 붕괴 조건이 될 수 없다 — 바깥은 D 계층이 잇는다', () => {
    const out: SubjectViolation[] = [];
    checkNeeds(hunter, [{ ...hungerNeed, holderId: merchantId }], hunterBoundaries, out);
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['foreign-need'],
    );
    assert.ok(out[0]?.message.includes('의존 그래프(D)'), out[0]?.message);
  });

  test('세계에 없는 자리는 지킬 수 없다', () => {
    assert.deepEqual(
      needRules([{ ...hungerNeed, slot: { domain: 'biological', path: 'mood' } }]),
      ['phantom-slot'],
    );
    assert.deepEqual(
      needRules([{ ...hungerNeed, slot: { domain: '기분' as never, path: 'hunger' } }]),
      ['phantom-slot'],
    );
    // 허기는 주체의 값이다 — 사물이 배고파할 수는 없다 (O2 보유자 규칙).
    assert.deepEqual(needRules([{ ...hungerNeed, holderId: bodyId }]), ['phantom-slot']);
  });

  test('자리 전체를 범위로 잡으면 조건이 아니다', () => {
    assert.deepEqual(needRules([{ ...hungerNeed, band: { kind: 'range', min: 0, max: 1 } }]), [
      'bad-band',
    ]);
  });

  test('값 모양이 어긋난 범위는 무엇이 와야 하는지와 함께 걸린다', () => {
    const out: SubjectViolation[] = [];
    checkNeeds(
      hunter,
      [
        { ...hungerNeed, band: { kind: 'is', value: '조금' } },
        {
          ...hungerNeed,
          slot: { domain: 'biological', path: 'toxin' },
          band: { kind: 'range', min: 0, max: 0.5 },
        },
        {
          ...hungerNeed,
          slot: { domain: 'biological', path: 'toxin' },
          band: { kind: 'is', value: '용암독' },
        },
        { ...hungerNeed, band: { kind: 'range', min: 0.6, max: 0.2 } },
      ],
      hunterBoundaries,
      out,
    );
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['bad-band', 'bad-band', 'bad-band', 'bad-band'],
    );
    assert.ok(out[1]?.message.includes('딱 그 값(is)'), out[1]?.message);
    assert.ok(out[2]?.message.includes('마비독'), out[2]?.message);
    assert.ok(out[3]?.message.includes('아래가 위보다'), out[3]?.message);
  });

  test('급함·붕괴 지연·근거가 범위 밖이면 걸린다', () => {
    assert.deepEqual(needRules([{ ...hungerNeed, urgency: 1.5 }]), ['bad-stake']);
    assert.deepEqual(needRules([{ ...hungerNeed, collapseAfterTicks: 0 }]), ['bad-stake']);
    assert.deepEqual(needRules([{ ...hungerNeed, collapseAfterTicks: 2.5 }]), ['bad-stake']);
    assert.deepEqual(needRules([{ ...hungerNeed, collapseAfterTicks: MAX_COLLAPSE_TICKS + 1 }]), [
      'bad-stake',
    ]);
    assert.deepEqual(needRules([{ ...hungerNeed, note: '' }]), ['bad-stake']);
  });

  test('무너질 조건이 없는 주체는 둘째 질문에 답하지 못한다', () => {
    assert.deepEqual(needRules([]), ['no-need']);
    assert.equal(needSummary([]), '무너질 조건이 없다');
    assert.equal(needSummary([hungerNeed]), 'hunger 0~0.6 (급함 0.8)');
  });
});

describe('유지 검사', () => {
  test('경계 밖의 자리를 원해도 된다 — 밖을 원하는 데서 목적이 자란다', () => {
    assert.deepEqual(valueRules([trustValue]), []);
  });

  test('세계에 없는 자리는 원할 수도 없다', () => {
    assert.deepEqual(
      valueRules([{ ...trustValue, slot: { domain: 'economic', path: 'glory' } }]),
      ['phantom-slot'],
    );
  });

  test('밀지 않는 방향은 가치가 아니다', () => {
    assert.deepEqual(valueRules([{ ...trustValue, weight: 0 }]), ['bad-stake']);
    assert.deepEqual(valueRules([{ ...trustValue, weight: 1.2 }]), ['bad-stake']);
  });

  test('재고처럼 사물도 가질 수 있는 자리는 사물 보유자로 선다', () => {
    assert.deepEqual(
      valueRules([
        {
          slot: { domain: 'economic', path: `stock.${herbId}` },
          holderId: hunterId,
          band: { kind: 'range', min: 5, max: 1000 },
          weight: 0.4,
          note: '약초를 늘 다섯 뿌리는 쥐고 있으려 한다',
        },
      ]),
      [],
    );
  });

  test('유지하려는 자리가 없는 주체는 다섯째 질문에 답하지 못한다', () => {
    assert.deepEqual(valueRules([]), ['no-value']);
    assert.equal(valueSummary([]), '밀고 가는 방향이 없다');
    assert.ok(valueSummary([trustValue]).includes('힘 0.6'), valueSummary([trustValue]));
  });
});
