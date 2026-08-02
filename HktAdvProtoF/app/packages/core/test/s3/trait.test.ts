// S3-b 성격 — 있는 값을 흔들 뿐 새 자리를 만들지 않는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import { axiomId } from '../../src/o0/index.ts';
import {
  buildTrait,
  checkTraits,
  MAX_TUNE_SCALE,
  MIN_TUNE_SCALE,
  scaleFor,
  traitSummary,
  tuned,
  tuneKey,
  tuneTable,
  TUNE_TARGETS,
  type InstanceRef,
  type InstanceViolation,
  type Trait,
  type TraitSpec,
  type TunableKeys,
  type Tune,
} from '../../src/s3/index.ts';

const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
const villagersId = deterministicId('subject', 'organization', '아랫마을 사람들');
const hunter: InstanceRef = { id: hunterId, name: '사냥꾼 04' };

/** 이 개체가 실제로 가진 자리들 — 종이 준 의존, 문화가 준 원함·읽기. */
const AVAILABLE: TunableKeys = {
  needs: ['hunger', 'vitality'],
  values: [`trust.${villagersId}`],
  readings: ['light:붉은 장막의 빛', 'trace:눌린 이끼'],
};

function traitSpec(overrides: Partial<TraitSpec> = {}): TraitSpec {
  return {
    id: deterministicId('rule', 'trait', '겁이 많다'),
    name: '겁이 많다',
    domain: 'psychic',
    when: ['혼자 어스름의 협곡에 선다'],
    then: ['허기는 더 급해지고, 빛에 대한 확신은 옅어진다'],
    axiomId: axiomId('psychic-life'),
    tunes: [
      {
        target: 'need-urgency',
        key: 'hunger',
        scale: 1.4,
        note: '겁이 많으면 배고픔을 더 빨리 위험으로 읽는다',
      },
      {
        target: 'reading-confidence',
        key: 'light:붉은 장막의 빛',
        scale: 0.6,
        note: '확신하지 못하고 한 번 더 본다',
      },
    ],
    ...overrides,
  };
}

const timid: Trait = buildTrait(traitSpec());

/** 욕심이 많다 — 다른 자리를 흔든다. */
const greedy: Trait = buildTrait(
  traitSpec({
    id: deterministicId('rule', 'trait', '욕심이 많다'),
    name: '욕심이 많다',
    domain: 'economic',
    when: ['남이 가진 것을 본다'],
    then: ['마을의 신뢰를 더 세게 민다'],
    tunes: [
      {
        target: 'value-weight',
        key: `trust.${villagersId}`,
        scale: 1.3,
        note: '얻는 쪽으로 더 세게 기운다',
      },
    ],
  }),
);

function check(
  traits: readonly Trait[],
  available: TunableKeys | null = AVAILABLE,
): readonly InstanceViolation[] {
  const out: InstanceViolation[] = [];
  checkTraits(hunter, traits, available, out);
  return out;
}

describe('S3-b 성격 — 기울기는 값을 흔들 뿐이다', () => {
  test('온전한 성격은 그대로 서고, 여전히 O1 Rule 이다', () => {
    assert.deepEqual(check([timid, greedy]), []);
    assert.equal(classify(timid).kind, 'Rule');
    assert.equal(classify(greedy).kind, 'Rule');
  });

  test('흔들 수 있는 것은 셋뿐이다', () => {
    assert.deepEqual([...TUNE_TARGETS], [
      'need-urgency',
      'value-weight',
      'reading-confidence',
    ]);
  });

  test('배수는 값을 흔들되 0~1 범위를 넘기지 못한다', () => {
    assert.equal(tuned(0.5, 1.4), 0.7);
    assert.equal(tuned(0.5, 0.6), 0.3);
    // 상한을 넘기면 성격이 아니라 능력이다 — 1 에서 멈춘다
    assert.equal(tuned(0.9, 4), 1);
    // 0 으로 지우지도 못한다 — 지우는 일은 문화·자리의 몫이다
    assert.ok(tuned(0.5, MIN_TUNE_SCALE) > 0);
    assert.ok(tuned(1, 0) > 0);
  });

  test('성격 여럿이 한 표로 모이고 자리마다 배수가 나온다', () => {
    const table = tuneTable([timid, greedy]);
    assert.equal(table.size, 3);
    assert.equal(scaleFor(table, 'need-urgency', 'hunger'), 1.4);
    assert.equal(scaleFor(table, 'value-weight', `trust.${villagersId}`), 1.3);
    assert.equal(scaleFor(table, 'reading-confidence', 'light:붉은 장막의 빛'), 0.6);
    // 흔들지 않는 자리는 1 이다
    assert.equal(scaleFor(table, 'need-urgency', 'vitality'), 1);
    assert.equal(tuneTable([]).size, 0);
  });

  test('같은 종에서 태어난 둘이 성격으로 갈린다', () => {
    const timidTable = tuneTable([timid]);
    const greedyTable = tuneTable([greedy]);
    assert.equal(tuned(0.8, scaleFor(timidTable, 'need-urgency', 'hunger')), 1);
    assert.equal(tuned(0.8, scaleFor(greedyTable, 'need-urgency', 'hunger')), 0.8);
    assert.notEqual(
      scaleFor(timidTable, 'reading-confidence', 'light:붉은 장막의 빛'),
      scaleFor(greedyTable, 'reading-confidence', 'light:붉은 장막의 빛'),
    );
  });

  test('성격은 새 자리를 만들지 못한다', () => {
    const strange = buildTrait(
      traitSpec({
        tunes: [
          {
            target: 'need-urgency',
            key: 'wanderlust',
            scale: 1.5,
            note: '떠돌고 싶다',
          },
        ],
      }),
    );
    const violations = check([strange]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'phantom-tune');
    assert.equal(violations[0]?.path, '$.traits[0].tunes[0].key');
    assert.match(violations[0]?.message ?? '', /hunger, vitality/);

    // 자리 목록을 넘기지 않으면(성격만 따로 볼 때) 걸리지 않는다
    assert.deepEqual(check([strange], null), []);
  });

  test('흔들지 않는 기울기는 성격이 아니다', () => {
    assert.equal(check([buildTrait(traitSpec({ tunes: [] }))])[0]?.rule, 'idle-trait');
    assert.equal(
      check([buildTrait(traitSpec({ tunes: [{ ...(timid.tunes[0] as Tune), scale: 1 }] }))])[0]
        ?.rule,
      'unit-tune',
    );
  });

  test('배수의 양끝을 넘기면 다른 개체다', () => {
    const first = timid.tunes[0];
    assert.ok(first !== undefined);
    assert.deepEqual(check([buildTrait(traitSpec({ tunes: [{ ...first, scale: MIN_TUNE_SCALE }] }))]), []);
    assert.deepEqual(check([buildTrait(traitSpec({ tunes: [{ ...first, scale: MAX_TUNE_SCALE }] }))]), []);
    assert.equal(
      check([buildTrait(traitSpec({ tunes: [{ ...first, scale: MIN_TUNE_SCALE - 0.01 }] }))])[0]?.rule,
      'bad-tune',
    );
    assert.equal(
      check([buildTrait(traitSpec({ tunes: [{ ...first, scale: MAX_TUNE_SCALE + 0.01 }] }))])[0]?.rule,
      'bad-tune',
    );
    assert.equal(
      check([buildTrait(traitSpec({ tunes: [{ ...first, scale: 0 }] }))])[0]?.rule,
      'bad-tune',
    );
  });

  test('결함 성격은 각자의 사유·경로로 거부된다', () => {
    const first = timid.tunes[0];
    assert.ok(first !== undefined);
    assert.equal(check([buildTrait(traitSpec({ when: [] }))])[0]?.rule, 'bad-trait');
    assert.equal(check([buildTrait(traitSpec({ then: [] }))])[0]?.rule, 'bad-trait');
    assert.equal(check([buildTrait(traitSpec({ name: '' }))])[0]?.rule, 'bad-trait');
    assert.equal(
      check([
        buildTrait(
          traitSpec({ tunes: [{ ...first, target: 'body-size' as Tune['target'] }] }),
        ),
      ])[0]?.rule,
      'bad-tune',
    );
    assert.equal(check([buildTrait(traitSpec({ tunes: [{ ...first, key: '' }] }))])[0]?.rule, 'bad-tune');
    assert.equal(check([buildTrait(traitSpec({ tunes: [{ ...first, note: '' }] }))])[0]?.rule, 'bad-tune');
  });

  test('같은 자리를 두 번 흔들면 어느 쪽이 이길지 알 수 없다', () => {
    const first = timid.tunes[0];
    assert.ok(first !== undefined);
    // 한 성격 안에서
    assert.equal(
      check([buildTrait(traitSpec({ tunes: [first, { ...first, scale: 0.5 }] }))])[0]?.rule,
      'duplicate-tune',
    );
    // 두 성격 사이에서
    const bold = buildTrait(
      traitSpec({
        id: deterministicId('rule', 'trait', '겁이 없다'),
        name: '겁이 없다',
        tunes: [{ ...first, scale: 0.7, note: '배고픔쯤은 견딘다' }],
      }),
    );
    const violations = check([timid, bold]);
    assert.equal(violations[0]?.rule, 'conflicting-trait');
    assert.match(violations[0]?.message ?? '', /겁이 많다.*겁이 없다/);
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.equal(tuneKey(timid.tunes[0] as Tune), 'need-urgency:hunger');
    assert.equal(traitSummary([]), '기울기가 없다');
    assert.match(traitSummary([timid]), /겁이 많다 \(hunger ×1.4, light:붉은 장막의 빛 ×0.6\)/);
  });

  test('기울기 없는 개체도 선다 — 성격은 있으면 흔들고 없으면 그대로다', () => {
    assert.deepEqual(check([]), []);
  });
});
