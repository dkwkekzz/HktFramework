// S1-b 종의 감각 — 몸을 거치는 통로는 그것을 여는 기관을 요구한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { MAX_PERCEPTION_RANGE, perceives } from '../../src/s0/index.ts';
import {
  checkSenses,
  perceptionOf,
  senseSummary,
  type BodyPlan,
  type SenseSpec,
  type SpeciesRef,
  type SpeciesViolation,
} from '../../src/s1/index.ts';

const hunter: SpeciesRef = {
  id: deterministicId('rule', 'species', '사냥꾼'),
  name: '사냥꾼',
  subjectKind: 'person',
};
const guild: SpeciesRef = {
  id: deterministicId('rule', 'species', '채집 결사'),
  name: '채집 결사',
  subjectKind: 'organization',
};

const hunterBody: BodyPlan = {
  organs: [
    { organ: 'core', count: 1, note: '몸통' },
    { organ: 'eye', count: 2, note: '자국을 읽는 눈' },
    { organ: 'ear', count: 2, note: '골짜기의 울림을 듣는 귀' },
  ],
};

/** 사냥꾼의 감각 — 빛과 흔적은 눈으로, 소리는 귀로, 보고는 사람을 거쳐. */
const hunterSenses: readonly SenseSpec[] = [
  { channel: 'light', threshold: 0.2, range: 300, organ: 'eye' },
  { channel: 'sound', threshold: 0.3, range: 120, organ: 'ear' },
  { channel: 'trace', threshold: 0.1, range: 5, organ: 'eye' },
  { channel: 'report', threshold: 0.5, range: MAX_PERCEPTION_RANGE, organ: null },
];

function senseRules(
  senses: readonly SenseSpec[],
  body: BodyPlan | null = hunterBody,
  species: SpeciesRef = hunter,
): string[] {
  const out: SpeciesViolation[] = [];
  checkSenses(species, senses, body, out);
  return out.map((violation) => violation.rule);
}

describe('S1-b 종의 감각', () => {
  test('기관이 있는 통로와 남을 거쳐 오는 통로가 함께 선다', () => {
    assert.deepEqual(senseRules(hunterSenses), []);
    // 몸 없는 조직도 보고는 받는다 — 보고는 관계를 타고 온다
    assert.deepEqual(
      senseRules([{ channel: 'report', threshold: 0.4, range: 1000, organ: null }], null, guild),
      [],
    );
  });

  test('종의 감각이 개체의 감각이 된다 — 성체 배수 1 이면 선언 그대로', () => {
    const profile = perceptionOf(hunterSenses);
    assert.deepEqual(profile.channels, [
      { channel: 'light', threshold: 0.2, range: 300 },
      { channel: 'sound', threshold: 0.3, range: 120 },
      { channel: 'trace', threshold: 0.1, range: 5 },
      { channel: 'report', threshold: 0.5, range: MAX_PERCEPTION_RANGE },
    ]);
    // 그대로 S0 감지 판정에 들어간다
    assert.equal(perceives(profile, { channel: 'light', intensity: 0.6 }, 300).perceived, true);
  });

  test('유체는 덜 멀리 보고 덜 예민하다 — 같은 눈이라도 단계가 세계를 좁힌다', () => {
    const larva = perceptionOf(hunterSenses, 0.5);
    assert.deepEqual(larva.channels[0], { channel: 'light', threshold: 0.4, range: 150 });
    // 성체가 보는 세기 0.3 의 빛을 유체는 못 본다
    assert.equal(perceives(perceptionOf(hunterSenses), { channel: 'light', intensity: 0.3 }, 100).perceived, true);
    assert.equal(perceives(larva, { channel: 'light', intensity: 0.3 }, 100).perceived, false);
    // 배수가 흔들어도 문턱은 1 을, 거리는 O2 범위를 넘지 않는다
    const dull = perceptionOf([{ channel: 'report', threshold: 1, range: 100, organ: null }], 0.25);
    assert.deepEqual(dull.channels[0], { channel: 'report', threshold: 1, range: 25 });
    const keen = perceptionOf(
      [{ channel: 'report', threshold: 0.8, range: MAX_PERCEPTION_RANGE, organ: null }],
      4,
    );
    assert.deepEqual(keen.channels[0], {
      channel: 'report',
      threshold: 0.2,
      range: MAX_PERCEPTION_RANGE,
    });
  });

  test('눈 없이 빛을 보는 종은 없다', () => {
    const blind: BodyPlan = { organs: [{ organ: 'core', count: 1, note: '몸통' }] };
    assert.deepEqual(senseRules(hunterSenses, blind), ['organless-sense', 'organless-sense', 'organless-sense']);
    assert.deepEqual(
      senseRules([{ channel: 'light', threshold: 0.2, range: 300, organ: null }]),
      ['organless-sense'],
    );
  });

  test('귀로 빛을 볼 수는 없다 — 사유가 여는 기관을 알려 준다', () => {
    const out: SpeciesViolation[] = [];
    checkSenses(hunter, [{ channel: 'light', threshold: 0.2, range: 300, organ: 'ear' }], hunterBody, out);
    assert.equal(out[0]?.rule, 'mismatched-organ');
    assert.match(out[0]?.message ?? '', /눈/);
  });

  test('남을 거쳐 오는 통로에 기관을 적으면 걸린다', () => {
    assert.deepEqual(
      senseRules([{ channel: 'psychic', threshold: 0.1, range: 200, organ: 'eye' }]),
      ['mediated-organ'],
    );
  });

  test('통로 없음 · 중복 · 6종 밖 · 문턱 0 · 거리 밖이 각각의 사유로 걸린다', () => {
    assert.deepEqual(senseRules([]), ['senseless-species']);
    assert.deepEqual(
      senseRules([hunterSenses[0] as SenseSpec, hunterSenses[0] as SenseSpec]),
      ['duplicate-sense'],
    );
    assert.deepEqual(
      senseRules([{ channel: 'gossip' as never, threshold: 0.2, range: 10, organ: null }]),
      ['unknown-channel'],
    );
    assert.deepEqual(
      senseRules([{ channel: 'light', threshold: 0, range: 300, organ: 'eye' }]),
      ['omniscient-sense'],
    );
    assert.deepEqual(
      senseRules([
        { channel: 'light', threshold: 0.2, range: MAX_PERCEPTION_RANGE + 1, organ: 'eye' },
      ]),
      ['bad-sense-range'],
    );
  });

  test('감각을 한 줄로 접으면 여는 기관이 함께 보인다', () => {
    assert.equal(senseSummary([]), '아무것도 감지하지 못한다');
    assert.equal(
      senseSummary([hunterSenses[0] as SenseSpec]),
      '빛(눈) ≥0.2 · 300m',
    );
  });
});
