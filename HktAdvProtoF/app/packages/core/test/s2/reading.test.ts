// S2-a 해석 — 같은 빛을 두 문화가 다르게 읽고, 종이 열지 않은 통로는 읽지 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import type { SenseSpec } from '../../src/s1/index.ts';
import {
  checkReadings,
  checkReadingsPresent,
  cultureRef,
  divergences,
  mergeReadings,
  readingClaim,
  readingLabel,
  readingSentence,
  readingSummary,
  sensedChannels,
  type CultureViolation,
  type ReadingRule,
} from '../../src/s2/index.ts';

const huntCulture = cultureRef({
  id: deterministicId('rule', 'culture', '자국을 쫓는 자들'),
  name: '자국을 쫓는 자들',
});
const riteCulture = cultureRef({
  id: deterministicId('rule', 'culture', '어미를 섬기는 자들'),
  name: '어미를 섬기는 자들',
});

/** 사냥꾼 종의 감각 — 눈으로 빛과 흔적을, 귀로 소리를, 그리고 전언을 받는다. */
const hunterSenses: readonly SenseSpec[] = [
  { channel: 'light', threshold: 0.2, range: 300, organ: 'eye' },
  { channel: 'trace', threshold: 0.3, range: 40, organ: 'eye' },
  { channel: 'sound', threshold: 0.25, range: 120, organ: 'ear' },
  { channel: 'report', threshold: 0.5, range: 1000, organ: null },
];

/** 사냥 문화 — 붉은 빛은 지나간 자국이다. 쫓는다. */
const huntReadings: readonly ReadingRule[] = [
  {
    channel: 'light',
    sign: '붉은 빛',
    assertion: '장막벌레가 지나간 자국이다',
    confidence: 0.7,
    stance: 'approach',
  },
  {
    channel: 'trace',
    sign: '눌린 풀',
    assertion: '한 시진 안에 무엇이 지났다',
    confidence: 0.8,
    stance: 'approach',
  },
];

/** 제의 문화 — 같은 붉은 빛이 어미의 숨이다. 엎드린다. */
const riteReadings: readonly ReadingRule[] = [
  {
    channel: 'light',
    sign: '붉은 빛',
    assertion: '어미가 숨을 내쉬었다',
    confidence: 0.9,
    stance: 'avoid',
  },
  {
    channel: 'report',
    sign: '행상의 말',
    assertion: '바깥의 말은 어미를 모른다',
    confidence: 0.4,
    stance: 'observe',
  },
];

function check(
  culture: ReturnType<typeof cultureRef>,
  readings: readonly ReadingRule[],
  senses: readonly SenseSpec[] | null = hunterSenses,
): readonly CultureViolation[] {
  const out: CultureViolation[] = [];
  checkReadings(culture, readings, senses, out);
  return out;
}

describe('S2-a 해석 — 문화가 본 것에 이름을 붙인다', () => {
  test('온전한 읽기는 종의 통로 위에 그대로 선다', () => {
    assert.deepEqual(check(huntCulture, huntReadings), []);
    assert.deepEqual(check(riteCulture, riteReadings), []);
  });

  test('같은 빛을 두 문화가 다르게 읽는다 — 겹치는 표식만 갈림으로 센다', () => {
    const found = divergences(huntReadings, riteReadings);
    assert.equal(found.length, 1, '겹치는 표식은 붉은 빛 하나뿐이다');
    const first = found[0];
    assert.ok(first !== undefined);
    assert.equal(first.sign, '붉은 빛');
    assert.equal(first.differs, true);
    assert.equal(first.left.assertion, '장막벌레가 지나간 자국이다');
    assert.equal(first.right.assertion, '어미가 숨을 내쉬었다');
    assert.equal(first.left.stance, 'approach');
    assert.equal(first.right.stance, 'avoid');
  });

  test('같게 읽으면 갈림이 아니다', () => {
    assert.deepEqual(
      divergences(huntReadings, huntReadings).map((entry) => entry.differs),
      [false, false],
    );
  });

  test('읽기는 개체의 O1 Claim 이 된다 — 실제가 아니라 믿음이다', () => {
    const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
    const veilId = deterministicId('entity', 'veil', '붉은 장막');
    const reading = huntReadings[0];
    assert.ok(reading !== undefined);

    const claim = readingClaim(huntCulture.id, reading, hunterId, veilId);
    assert.equal(classify(claim).kind, 'Claim');
    assert.equal(claim.holderId, hunterId);
    assert.equal(claim.aboutId, veilId);
    assert.equal(claim.assertion, '장막벌레가 지나간 자국이다');
    assert.equal(claim.confidence, 0.7);

    // 같은 문화·같은 주체·같은 대상이면 언제나 같은 믿음이다
    assert.equal(claim.id, readingClaim(huntCulture.id, reading, hunterId, veilId).id);
    // 다른 문화가 같은 것을 보면 다른 믿음이다
    const other = riteReadings[0];
    assert.ok(other !== undefined);
    const riteClaim = readingClaim(riteCulture.id, other, hunterId, veilId);
    assert.notEqual(riteClaim.id, claim.id);
    assert.equal(riteClaim.assertion, '어미가 숨을 내쉬었다');
  });

  test('종이 열지 않은 통로는 읽지 못한다 — 문화는 종을 넘어서지 않는다', () => {
    const psychicRite: readonly ReadingRule[] = [
      {
        channel: 'psychic',
        sign: '남은 떨림',
        assertion: '어미가 아직 깨어 있다',
        confidence: 0.6,
        stance: 'avoid',
      },
    ];
    const violations = check(riteCulture, psychicRite);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'unsensed-reading');
    assert.equal(violations[0]?.path, '$.readings[0].channel');
    assert.match(violations[0]?.message ?? '', /psychic/);

    // 그 통로를 여는 종에게라면 같은 읽기가 그대로 선다
    const priestSenses: readonly SenseSpec[] = [
      ...hunterSenses,
      { channel: 'psychic', threshold: 0.4, range: 200, organ: null },
    ];
    assert.deepEqual(check(riteCulture, psychicRite, priestSenses), []);
    // 종과 대조하지 않으면(역할만 볼 때) 걸리지 않는다
    assert.deepEqual(check(riteCulture, psychicRite, null), []);
  });

  test('결함 읽기는 각자의 사유·경로로 거부된다', () => {
    const broken: readonly {
      readonly broke: string;
      readonly expected: string;
      readonly value: ReadingRule;
    }[] = [
      {
        broke: '통로 6종 밖',
        expected: 'unknown-channel',
        value: { ...huntReadings[0]!, channel: 'taste' as ReadingRule['channel'] },
      },
      {
        broke: '무엇을 읽는지 없다',
        expected: 'signless-reading',
        value: { ...huntReadings[0]!, sign: '' },
      },
      {
        broke: '무엇이라고 읽는지 없다',
        expected: 'empty-assertion',
        value: { ...huntReadings[0]!, assertion: '' },
      },
      {
        broke: '확신 0 — 믿지 않는 읽기',
        expected: 'bad-confidence',
        value: { ...huntReadings[0]!, confidence: 0 },
      },
      {
        broke: '확신 1 초과',
        expected: 'bad-confidence',
        value: { ...huntReadings[0]!, confidence: 1.2 },
      },
      {
        broke: '미는 방향이 3종 밖',
        expected: 'bad-stance',
        value: { ...huntReadings[0]!, stance: 'worship' as ReadingRule['stance'] },
      },
    ];

    for (const entry of broken) {
      const violations = check(huntCulture, [entry.value]);
      assert.equal(violations[0]?.rule, entry.expected, entry.broke);
      assert.equal(violations[0]?.cultureName, '자국을 쫓는 자들');
      assert.equal(violations[0]?.roleName, null);
    }
  });

  test('같은 표식을 두 가지로 읽으면 개체가 어느 것으로 읽을지 알 수 없다', () => {
    const first = huntReadings[0];
    const other = riteReadings[0];
    assert.ok(first !== undefined && other !== undefined);
    const violations = check(huntCulture, [first, other]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'duplicate-reading');
    assert.equal(violations[0]?.path, '$.readings[1].sign');
  });

  test('확신 1 은 통과한다 — 확신해도 틀릴 수 있다는 것이 O1 의 태도다', () => {
    const certain: ReadingRule = { ...huntReadings[0]!, confidence: 1 };
    assert.deepEqual(check(huntCulture, [certain]), []);
  });

  test('읽는 것이 없는 문화는 아무것도 가르지 못한다', () => {
    const out: CultureViolation[] = [];
    checkReadingsPresent(huntCulture, [], out);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.rule, 'unreadable-culture');
    assert.equal(out[0]?.path, '$.readings');

    const kept: CultureViolation[] = [];
    checkReadingsPresent(huntCulture, huntReadings, kept);
    assert.deepEqual(kept, []);
  });

  test('역할의 읽기가 문화의 읽기를 덮는다 — 같은 표식이면 역할이 이긴다', () => {
    const doubterOverlay: readonly ReadingRule[] = [
      {
        channel: 'light',
        sign: '붉은 빛',
        assertion: '숨이든 자국이든 먼저 확인한다',
        confidence: 0.5,
        stance: 'observe',
      },
    ];
    const merged = mergeReadings(riteReadings, doubterOverlay);
    assert.equal(merged.length, 2, '덮었지 늘지 않았다');
    assert.deepEqual(
      merged.map((reading) => readingLabel(reading)),
      ['report:행상의 말', 'light:붉은 빛'],
    );
    assert.equal(merged[1]?.stance, 'observe');
    // 덮을 것이 없으면 그대로 더해진다
    assert.equal(mergeReadings(riteReadings, huntReadings).length, 3);
    assert.deepEqual(mergeReadings(riteReadings, []), riteReadings);
  });

  test('종이 여는 통로를 중복 없이 센다', () => {
    assert.deepEqual(sensedChannels(hunterSenses), ['light', 'trace', 'sound', 'report']);
    assert.deepEqual(sensedChannels([]), []);
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.equal(
      readingSentence(huntReadings[0]!),
      '붉은 빛 → "장막벌레가 지나간 자국이다" (다가간다, 확신 0.7)',
    );
    assert.equal(readingSummary([]), '읽는 것이 없다');
    assert.match(readingSummary(riteReadings), /어미가 숨을 내쉬었다/);
  });
});
