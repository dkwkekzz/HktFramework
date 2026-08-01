// O2-b 단위 테스트 — 필드 스펙과 9영역 자리 카탈로그.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { STATE_DOMAINS, type State } from '../../src/o1/index.ts';
import {
  checkAgainstSchema,
  checkFieldSpec,
  checkHolder,
  checkValue,
  describeValue,
  fieldsOf,
  lookupField,
  matchPath,
  numericRange,
  ORIGINAL_FIELDS,
  parameterCount,
  parameterKind,
  schemaReport,
  schemaVerdict,
  STATE_SCHEMA,
  whereOf,
  type FieldSpec,
  type StateSchema,
} from '../../src/o2/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
const merchantId = deterministicId('subject', 'person', '행상 02');
const herbId = deterministicId('entity', 'material', '붉은 장막');

/** 검사 대상 State 하나 — O1 이 요구하는 필드는 다 갖춘 상태에서 스키마만 본다. */
function state(partial: Partial<State> & Pick<State, 'domain' | 'ofId' | 'path' | 'value'>): State {
  return {
    kind: 'State',
    id: deterministicId('state', partial.ofId, `${partial.domain}.${partial.path}`),
    ...partial,
  };
}

/** 위반을 `사유 자리` 로 접는다. */
function reasons(target: State): string[] {
  return checkAgainstSchema(STATE_SCHEMA, target).map((violation) => violation.rule);
}

describe('경로 매칭', () => {
  test('고정 경로는 글자 그대로 맞아야 한다', () => {
    assert.deepEqual(matchPath('hunger', 'hunger'), []);
    assert.equal(matchPath('hunger', 'Hunger'), null);
    assert.equal(matchPath('position.x', 'position'), null);
    assert.deepEqual(matchPath('position.x', 'position.x'), []);
  });

  test('매개 자리에는 그 종류의 V1 ID 만 들어온다', () => {
    assert.deepEqual(matchPath('trust.{subject}', `trust.${hunterId}`), [hunterId]);
    // 종류가 다르면 안 맞는다 — 사물을 신뢰할 수는 없다.
    assert.equal(matchPath('trust.{subject}', `trust.${herbId}`), null);
    // 손으로 지은 이름도 안 된다 (O1 과 같은 태도).
    assert.equal(matchPath('trust.{subject}', 'trust.행상'), null);
  });

  test('매개 자리를 세고 종류를 읽는다', () => {
    assert.equal(parameterKind('{subject}'), 'subject');
    assert.equal(parameterKind('trust'), null);
    const trust = STATE_SCHEMA.fields.find((f) => f.path === 'trust.{subject}') as FieldSpec;
    assert.equal(parameterCount(trust), 1);
  });
});

describe('값 검사', () => {
  test('비율은 0~1 양끝을 받고 그 밖은 거부한다', () => {
    assert.equal(checkValue({ type: 'ratio' }, 0), null);
    assert.equal(checkValue({ type: 'ratio' }, 1), null);
    assert.equal(checkValue({ type: 'ratio' }, 1.0001)?.rule, 'out-of-range');
    assert.equal(checkValue({ type: 'ratio' }, -0.0001)?.rule, 'out-of-range');
    assert.equal(checkValue({ type: 'ratio' }, '0.5')?.rule, 'bad-value-type');
  });

  test('부호 비율은 -1~1 — 적대와 우호가 한 축에 있다', () => {
    assert.equal(checkValue({ type: 'signed' }, -1), null);
    assert.equal(checkValue({ type: 'signed' }, -1.5)?.rule, 'out-of-range');
  });

  test('정수 자리에 소수는 못 온다', () => {
    const spec = { type: 'number', min: 0, max: 10, integer: true, unit: '개체' } as const;
    assert.equal(checkValue(spec, 3), null);
    assert.equal(checkValue(spec, 3.5)?.rule, 'out-of-range');
  });

  test('선택지·참거짓·ID 는 각자의 사유로 걸린다', () => {
    const enumSpec = { type: 'enum', options: ['씨', '성체'] } as const;
    assert.equal(checkValue(enumSpec, '성체'), null);
    assert.equal(checkValue(enumSpec, '거인')?.rule, 'not-an-option');
    assert.equal(checkValue({ type: 'flag' }, true), null);
    assert.equal(checkValue({ type: 'flag' }, 1)?.rule, 'bad-value-type');
    assert.equal(checkValue({ type: 'ref', idKind: 'entity' }, herbId), null);
    assert.equal(checkValue({ type: 'ref', idKind: 'entity' }, hunterId)?.rule, 'bad-reference');
  });

  test('값의 모양이 사람이 읽는 한 줄로 나온다', () => {
    assert.equal(describeValue({ type: 'ratio' }), '비율 0~1');
    assert.equal(describeValue({ type: 'ref', idKind: 'entity' }), 'entity ID');
    assert.equal(numericRange({ type: 'flag' }), null);
    assert.deepEqual(numericRange({ type: 'signed' }), { min: -1, max: 1, integer: false });
  });

  test('보유자 종류는 ID 접두사로 판별한다 — 세계를 뒤지지 않는다', () => {
    assert.equal(checkHolder('subject', hunterId), null);
    assert.equal(checkHolder('any', herbId), null);
    assert.match(checkHolder('subject', herbId) ?? '', /보유자는 entity/);
    assert.match(checkHolder('any', '사냥꾼') ?? '', /V1 결정적 ID/);
  });
});

describe('9영역 자리 카탈로그', () => {
  const report = schemaReport();

  test('영역마다 자리가 있고, 원문 필드가 전부 자리를 얻었다', () => {
    assert.ok(report.complete, schemaVerdict(report));
    assert.deepEqual([...report.emptyDomains], []);
    assert.deepEqual([...report.unmappedOriginals], []);
    assert.deepEqual([...report.danglingOriginals], []);
    assert.deepEqual([...report.duplicatePaths], []);
    assert.deepEqual([...report.badSpecs], []);
  });

  test('원문 §12.1 이 나열한 필드 39개를 대조한다', () => {
    assert.equal(ORIGINAL_FIELDS.length, 39);
    for (const original of ORIGINAL_FIELDS) {
      assert.notEqual(original.paths.length, 0, original.name);
      assert.match(original.source, /MasterPlan §12\.1/, original.name);
    }
  });

  test('흡수된 두 영역의 원문 필드가 새 영역에 실려 있다', () => {
    // ability → psychic (O2-a 흡수)
    const ability = ORIGINAL_FIELDS.filter((f) => f.source.includes('능력 상태'));
    assert.equal(ability.length, 5);
    assert.ok(ability.every((f) => f.domain === 'psychic'));
    // spatial → physical: 거리 자리가 물리에 있다
    assert.notEqual(lookupField(STATE_SCHEMA, 'physical', `distance.${herbId}`), null);
  });

  test('모든 스펙이 스스로 온전하다', () => {
    for (const field of STATE_SCHEMA.fields) {
      assert.deepEqual(checkFieldSpec(field), [], `${field.domain}.${field.path}`);
    }
  });

  test('영역별 자리 수가 9영역 전부에 대해 세어진다', () => {
    assert.deepEqual(Object.keys(report.byDomain).sort(), [...STATE_DOMAINS].sort());
    assert.equal(
      Object.values(report.byDomain).reduce((sum, count) => sum + count, 0),
      report.totalFields,
    );
    assert.equal(fieldsOf(STATE_SCHEMA, 'relational').length, 7);
  });

  test('원문 밖에서 늘어난 자리는 숨지 않고 세어진다', () => {
    // 생태·경제·초월 영역과 흡수분(거리)·신념 압력은 §12.1 세부 목록 밖이다.
    assert.ok(report.extraPaths.includes('physical.distance.{entity}'));
    assert.ok(report.extraPaths.includes('psychic.conviction'));
    assert.ok(report.extraPaths.every((path) => path.includes('.')));
  });
});

describe('스키마 검사', () => {
  test('제자리에 놓인 값은 통과한다', () => {
    assert.deepEqual(reasons(state({ domain: 'biological', ofId: hunterId, path: 'hunger', value: 0.7 })), []);
    assert.deepEqual(
      reasons(state({ domain: 'relational', ofId: hunterId, path: `trust.${merchantId}`, value: -0.4 })),
      [],
    );
    assert.deepEqual(
      reasons(state({ domain: 'economic', ofId: herbId, path: `stock.${herbId}`, value: 12 })),
      [],
    );
  });

  test('없는 영역·없는 자리는 각각의 사유로 거부된다', () => {
    assert.deepEqual(
      reasons(state({ domain: 'spatial' as never, ofId: hunterId, path: 'position.x', value: 0 })),
      ['unknown-domain'],
    );
    assert.deepEqual(
      reasons(state({ domain: 'biological', ofId: hunterId, path: 'hungry', value: 0.7 })),
      ['unknown-path'],
    );
  });

  test('매개 자리가 틀리면 "자리가 없다" 대신 무엇이 와야 하는지 말해 준다', () => {
    const violations = checkAgainstSchema(
      STATE_SCHEMA,
      state({ domain: 'relational', ofId: hunterId, path: `trust.${herbId}`, value: 0.5 }),
    );
    assert.equal(violations[0]?.rule, 'bad-parameter');
    assert.match(violations[0]?.message ?? '', /subject 종류의 V1 ID/);
  });

  test('가질 수 없는 존재가 가지면 보유자 사유로 걸린다', () => {
    const violations = checkAgainstSchema(
      STATE_SCHEMA,
      state({ domain: 'biological', ofId: herbId, path: 'hunger', value: 0.3 }),
    );
    assert.equal(violations[0]?.rule, 'bad-holder');
    assert.match(violations[0]?.message ?? '', /허기/);
  });

  test('범위·종류·선택지·참조가 각자의 사유로 걸린다', () => {
    assert.deepEqual(
      reasons(state({ domain: 'biological', ofId: hunterId, path: 'hunger', value: 1.4 })),
      ['out-of-range'],
    );
    assert.deepEqual(
      reasons(state({ domain: 'biological', ofId: hunterId, path: 'hunger', value: '매우' })),
      ['bad-value-type'],
    );
    assert.deepEqual(
      reasons(state({ domain: 'biological', ofId: herbId, path: 'toxin', value: '용암독' })),
      ['not-an-option'],
    );
    assert.deepEqual(
      reasons(state({ domain: 'physical', ofId: hunterId, path: 'region', value: merchantId })),
      ['bad-reference'],
    );
  });

  test('보유자와 값이 함께 틀리면 둘 다 나온다 — 한 번 고칠 때 다 보이게', () => {
    assert.deepEqual(
      reasons(state({ domain: 'biological', ofId: herbId, path: 'hunger', value: 3 })),
      ['bad-holder', 'out-of-range'],
    );
  });

  test('위반은 세계 트리의 자리를 그대로 가리킨다', () => {
    const target = state({ domain: 'biological', ofId: hunterId, path: 'hunger', value: 9 });
    const violations = checkAgainstSchema(STATE_SCHEMA, target);
    assert.equal(violations[0]?.where, `biological.${hunterId}.hunger`);
    assert.equal(violations[0]?.where, whereOf(target));
    assert.equal(violations[0]?.stateId, target.id);
  });
});

describe('스키마의 검출력', () => {
  test('원문 필드가 가리키는 자리를 빼면 빗나간 대조로 걸린다', () => {
    const broken: StateSchema = {
      ...STATE_SCHEMA,
      fields: STATE_SCHEMA.fields.filter((field) => field.path !== 'hunger'),
    };
    const report = schemaReport(broken);
    assert.deepEqual([...report.danglingOriginals], ['허기→biological.hunger']);
    assert.ok(!report.complete);
    assert.match(schemaVerdict(report), /허기/);
  });

  test('영역을 통째로 비우면 빈 영역으로 걸린다', () => {
    const report = schemaReport({
      ...STATE_SCHEMA,
      fields: STATE_SCHEMA.fields.filter((field) => field.domain !== 'transcendent'),
    });
    assert.deepEqual([...report.emptyDomains], ['transcendent']);
  });

  test('같은 자리를 두 번 적으면 중복으로 걸린다', () => {
    const report = schemaReport({
      ...STATE_SCHEMA,
      fields: [...STATE_SCHEMA.fields, STATE_SCHEMA.fields[0] as FieldSpec],
    });
    assert.equal(report.duplicatePaths.length, 1);
  });

  test('결함 스펙은 사유와 함께 지목된다', () => {
    const bad: FieldSpec = {
      domain: 'physical',
      path: 'Position Х',
      label: '',
      holder: 'any',
      value: { type: 'enum', options: [] },
      note: '',
    };
    assert.deepEqual(checkFieldSpec(bad).length, 4);
    const report = schemaReport({ ...STATE_SCHEMA, fields: [...STATE_SCHEMA.fields, bad] });
    assert.ok(report.badSpecs.some((reason) => reason.includes('선택지가 비었다')));
    assert.ok(!report.complete);
  });

  test('자리 없는 원문 필드는 미분류로 남는다', () => {
    const report = schemaReport(STATE_SCHEMA, [
      ...ORIGINAL_FIELDS,
      { name: '기억', domain: 'informational', source: 'MasterPlan §12.1', paths: [] },
    ]);
    assert.deepEqual([...report.unmappedOriginals], ['기억']);
  });

  test('빈 스키마는 완결이 아니다', () => {
    const report = schemaReport({ domains: [], fields: [] });
    assert.ok(!report.complete);
    assert.match(schemaVerdict(report), /자리가 하나도 없다/);
  });
});
