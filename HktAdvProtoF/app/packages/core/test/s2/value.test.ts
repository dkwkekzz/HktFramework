// S2-b 가치 템플릿 — 무엇을 원하는지는 개체가 지어내지 않고 문화에서 물려받는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { checkValues, type SubjectViolation } from '../../src/s0/index.ts';
import type { NeedTemplate } from '../../src/s1/index.ts';
import {
  checkValuesPresent,
  checkValueTemplates,
  cultureRef,
  holderLabel,
  instantiateValues,
  mergeValues,
  resolveHolder,
  valueTemplateLabel,
  valueTemplateSummary,
  type CultureViolation,
  type ValuePlace,
  type ValueTemplate,
} from '../../src/s2/index.ts';

const huntCulture = cultureRef({
  id: deterministicId('rule', 'culture', '자국을 쫓는 자들'),
  name: '자국을 쫓는 자들',
});

const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
const bodyId = deterministicId('entity', 'veil', '사냥꾼 04의 몸');
const canyonId = deterministicId('entity', 'place', '국경 협곡');
const villagersId = deterministicId('subject', 'veil', '마을 사람들');

const where: ValuePlace = { subjectId: hunterId, bodyId };

/** 사냥 문화가 미는 것 — 마을의 신뢰, 협곡의 재고, 자기 확신. */
const huntValues: readonly ValueTemplate[] = [
  {
    slot: { domain: 'relational', path: `trust.${villagersId}` },
    holder: { of: 'self' },
    band: { kind: 'range', min: 0.6, max: 1 },
    weight: 0.7,
    note: '자국을 읽어 주는 대가로 마을에 얻는 자리',
  },
  {
    slot: { domain: 'economic', path: `stock.${canyonId}` },
    holder: { of: 'other', id: canyonId },
    band: { kind: 'range', min: 20, max: 1000 },
    weight: 0.4,
    note: '협곡 창고가 비면 겨울에 쫓을 것이 없다 — 내 것이 아닌 자리를 원한다',
  },
];

/** 종이 이미 무너지는 자리로 잡은 것 — 허기. */
const hunterNeeds: readonly NeedTemplate[] = [
  {
    slot: { domain: 'biological', path: 'hunger' },
    holder: 'self',
    band: { kind: 'range', min: 0, max: 0.8 },
    urgency: 0.9,
    baseTicks: 30,
    note: '굶으면 무너진다',
  },
];

function check(
  templates: readonly ValueTemplate[],
  needs: readonly NeedTemplate[] | null = hunterNeeds,
  hasBody = true,
): readonly CultureViolation[] {
  const out: CultureViolation[] = [];
  checkValueTemplates(huntCulture, templates, needs, hasBody, out);
  return out;
}

describe('S2-b 가치 템플릿 — 문화가 무엇을 원할지 물려준다', () => {
  test('온전한 유지 템플릿은 그대로 선다', () => {
    assert.deepEqual(check(huntValues), []);
  });

  test('템플릿에서 찍어 낸 유지가 S0 관문을 그대로 지난다', () => {
    const values = instantiateValues(huntValues, where);
    const out: SubjectViolation[] = [];
    checkValues(
      { id: hunterId, name: '사냥꾼 04', subjectKind: 'person' },
      values,
      out,
    );
    assert.deepEqual(out, []);

    // 빈칸 하나가 채워진다 — 누구의 자리인가
    assert.deepEqual(
      values.map((value) => value.holderId),
      [hunterId, canyonId],
      '자기 것은 자기에게, 세계의 자리는 그 대상에게 적힌다',
    );
    // 같은 문화·같은 자리면 언제나 같은 유지다
    assert.deepEqual(instantiateValues(huntValues, where), values);
  });

  test('유지는 경계 밖이어도 된다 — 밖을 원하는 데서 목적이 자란다', () => {
    const values = instantiateValues(huntValues, where);
    assert.equal(values[1]?.holderId, canyonId);
    assert.notEqual(values[1]?.holderId, hunterId);
  });

  test('몸 없는 종의 문화는 몸의 자리를 원할 수 없다', () => {
    const bodily: readonly ValueTemplate[] = [
      {
        slot: { domain: 'economic', path: `stock.${canyonId}` },
        holder: { of: 'body' },
        band: { kind: 'range', min: 20, max: 1000 },
        weight: 0.4,
        note: '몸에 지고 다니는 것',
      },
    ];
    assert.deepEqual(check(bodily, null, true), []);
    const violations = check(bodily, null, false);
    assert.equal(violations[0]?.rule, 'bodiless-body-value');
    assert.equal(violations[0]?.path, '$.values[0].holder');

    // 몸이 없으면 몸의 자리는 개체에게서 자기로 접힌다
    assert.equal(
      resolveHolder({ of: 'body' }, { subjectId: hunterId, bodyId: null }),
      hunterId,
    );
    assert.equal(resolveHolder({ of: 'body' }, where), bodyId);
  });

  test('종이 무너지는 자리를 문화가 다시 밀 수는 없다', () => {
    const hungerValue: readonly ValueTemplate[] = [
      {
        slot: { domain: 'biological', path: 'hunger' },
        holder: { of: 'self' },
        band: { kind: 'range', min: 0, max: 0.2 },
        weight: 0.5,
        note: '배부름을 미덕으로 삼는다',
      },
    ];
    const violations = check(hungerValue);
    assert.equal(violations[0]?.rule, 'need-shadowing-value');
    assert.equal(violations[0]?.path, '$.values[0].slot');
    assert.match(violations[0]?.message ?? '', /무너지는 자리/);

    // 종의 의존을 대조하지 않으면(문화만 볼 때) 걸리지 않는다
    assert.deepEqual(check(hungerValue, null), []);
  });

  test('결함 템플릿은 각자의 사유·경로로 거부된다', () => {
    const good = huntValues[0];
    assert.ok(good !== undefined);
    const broken: readonly {
      readonly broke: string;
      readonly expected: string;
      readonly value: ValueTemplate;
    }[] = [
      {
        broke: '9영역 밖',
        expected: 'phantom-slot',
        value: {
          ...good,
          slot: { domain: 'historical' as ValueTemplate['slot']['domain'], path: 'trust' },
        },
      },
      {
        broke: '세계에 없는 자리',
        expected: 'phantom-slot',
        value: { ...good, slot: { domain: 'relational', path: 'envy.someone' } },
      },
      {
        broke: '자리 전체를 범위로 잡았다',
        expected: 'bad-band',
        value: { ...good, band: { kind: 'range', min: -1, max: 1 } },
      },
      {
        broke: '미는 힘 0 — 밀지 않는 방향',
        expected: 'bad-value-template',
        value: { ...good, weight: 0 },
      },
      {
        broke: '미는 힘 1 초과',
        expected: 'bad-value-template',
        value: { ...good, weight: 1.5 },
      },
      {
        broke: '왜 미는지 없다',
        expected: 'bad-value-template',
        value: { ...good, note: '' },
      },
      {
        broke: '주체의 자리를 사물에게 적었다',
        expected: 'bad-value-template',
        value: { ...good, holder: { of: 'other', id: canyonId } },
      },
    ];

    for (const entry of broken) {
      const violations = check([entry.value]);
      assert.equal(violations[0]?.rule, entry.expected, entry.broke);
      assert.equal(violations[0]?.cultureName, '자국을 쫓는 자들');
    }
  });

  test('같은 자리를 두 번 원하면 어느 쪽으로 미는지 알 수 없다', () => {
    const good = huntValues[0];
    assert.ok(good !== undefined);
    const violations = check([good, { ...good, band: { kind: 'range', min: -1, max: -0.5 } }]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'duplicate-value');
    assert.equal(violations[0]?.path, '$.values[1].slot');
  });

  test('원하는 것이 없는 문화는 개체를 가르지 못한다', () => {
    const out: CultureViolation[] = [];
    checkValuesPresent(huntCulture, [], out);
    assert.equal(out[0]?.rule, 'valueless-culture');
    assert.equal(out[0]?.path, '$.values');

    const kept: CultureViolation[] = [];
    checkValuesPresent(huntCulture, huntValues, kept);
    assert.deepEqual(kept, []);
  });

  test('역할의 유지가 문화의 유지를 덮는다 — 같은 자리면 역할이 이긴다', () => {
    const good = huntValues[0];
    assert.ok(good !== undefined);
    const elderOverlay: readonly ValueTemplate[] = [
      { ...good, band: { kind: 'range', min: 0.9, max: 1 }, weight: 1, note: '우두머리는 더 큰 신뢰로 산다' },
    ];
    const merged = mergeValues(huntValues, elderOverlay);
    assert.equal(merged.length, 2, '덮었지 늘지 않았다');
    assert.equal(merged[1]?.weight, 1);
    assert.deepEqual(mergeValues(huntValues, []), huntValues);
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.equal(valueTemplateLabel(huntValues[0]!), `relational.trust.${villagersId}`);
    assert.equal(holderLabel({ of: 'self' }), '자기');
    assert.equal(holderLabel({ of: 'body' }), '몸');
    assert.match(holderLabel({ of: 'other', id: canyonId }), /^바깥 /);
    assert.equal(valueTemplateSummary([]), '원하는 것이 없다');
    assert.match(valueTemplateSummary(huntValues), /힘 0.7/);
  });
});
