// S1-a 신체 원형 — 몸의 유무가 생물 영역 자리와 맞물린다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { axiomId, type SpeciesDefinition } from '../../src/o0/index.ts';
import {
  bodySummary,
  checkBody,
  hasOrgan,
  isBodiedKind,
  MAX_ORGAN_COUNT,
  openedChannels,
  organOpening,
  organSpec,
  ORGAN_KINDS,
  speciesRef,
  type BodyPlan,
  type SpeciesViolation,
} from '../../src/s1/index.ts';

/** 사냥꾼 — 사람. 몸이 있고 생물 자리를 연다. */
const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '사냥꾼'),
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 진다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'vitality' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** 채집 결사 — 조직. 몸이 없고 생물 자리도 없다. */
const guildSpecies: SpeciesDefinition = {
  ...hunterSpecies,
  id: deterministicId('rule', 'species', '채집 결사'),
  name: '채집 결사',
  domain: 'economic',
  subjectKind: 'organization',
  slots: [
    { domain: 'economic', path: 'stock.{entity}' },
    { domain: 'psychic', path: 'conviction' },
  ],
};

const hunterBody: BodyPlan = {
  organs: [
    { organ: 'core', count: 1, note: '몸통' },
    { organ: 'eye', count: 2, note: '어스름에서도 자국을 읽는 눈' },
    { organ: 'ear', count: 2, note: '골짜기의 울림을 듣는 귀' },
    { organ: 'mouth', count: 1, note: '먹고 말한다' },
    { organ: 'limb', count: 4, note: '기어오르고 쥔다' },
  ],
};

function bodyRules(
  body: BodyPlan | null,
  definition: SpeciesDefinition = hunterSpecies,
): string[] {
  const out: SpeciesViolation[] = [];
  checkBody(speciesRef(definition), body, definition, out);
  return out.map((violation) => violation.rule);
}

describe('S1-a 신체 원형', () => {
  test('사람은 몸으로, 조직은 몸 없이 선다', () => {
    assert.deepEqual(bodyRules(hunterBody), []);
    assert.deepEqual(bodyRules(null, guildSpecies), []);
    assert.equal(isBodiedKind('person'), true);
    assert.equal(isBodiedKind('nation'), false);
  });

  test('기관이 감각 통로를 연다 — 눈은 빛과 흔적을, 입과 사지는 아무것도', () => {
    assert.deepEqual(organSpec('eye')?.opens, ['light', 'trace']);
    assert.deepEqual(organSpec('mouth')?.opens, []);
    assert.deepEqual(openedChannels(hunterBody), ['light', 'trace', 'sound']);
    assert.equal(organOpening(hunterBody, 'light'), 'eye');
    assert.equal(organOpening(hunterBody, 'smell'), null);
    assert.equal(organOpening(null, 'light'), null);
    assert.equal(hasOrgan(hunterBody, 'limb'), true);
    assert.equal(hasOrgan(null, 'core'), false);
  });

  test('몸 없는 사람과 몸 있는 조직은 각각의 사유로 거부된다', () => {
    assert.deepEqual(bodyRules(null), ['bodiless-life']);
    assert.deepEqual(bodyRules(hunterBody, guildSpecies), ['bodied-abstraction']);
  });

  test('몸 없는 종이 생물 자리를 열면 그 자리가 지목된다 — 조직은 굶지 않는다', () => {
    const hungryGuild: SpeciesDefinition = {
      ...guildSpecies,
      slots: [...guildSpecies.slots, { domain: 'biological', path: 'hunger' }],
    };
    const out: SpeciesViolation[] = [];
    checkBody(speciesRef(hungryGuild), null, hungryGuild, out);
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['bodiless-biology'],
    );
    assert.match(out[0]?.message ?? '', /hunger/);
  });

  test('몸이 있는데 생물 자리를 열지 않으면 깎이지 않는 몸이다', () => {
    const numb: SpeciesDefinition = {
      ...hunterSpecies,
      slots: [{ domain: 'psychic', path: 'conviction' }],
    };
    assert.deepEqual(bodyRules(hunterBody, numb), ['fleshless-body']);
  });

  test('본체 없는 몸 · 두 번 선언된 기관 · 없는 기관 · 개수와 근거가 각각의 사유로 걸린다', () => {
    assert.deepEqual(bodyRules({ organs: [{ organ: 'eye', count: 2, note: '눈' }] }), [
      'coreless-body',
    ]);
    assert.deepEqual(
      bodyRules({
        organs: [
          { organ: 'core', count: 1, note: '몸통' },
          { organ: 'core', count: 1, note: '또 몸통' },
        ],
      }),
      ['duplicate-organ'],
    );
    assert.deepEqual(
      bodyRules({ organs: [{ organ: 'wing' as never, count: 2, note: '날개' }] }),
      ['unknown-organ', 'coreless-body'],
    );
    assert.deepEqual(
      bodyRules({
        organs: [
          { organ: 'core', count: 1, note: '몸통' },
          { organ: 'eye', count: 0, note: '없는 눈' },
        ],
      }),
      ['bad-organ'],
    );
    assert.deepEqual(
      bodyRules({
        organs: [
          { organ: 'core', count: 1, note: '몸통' },
          { organ: 'limb', count: MAX_ORGAN_COUNT + 1, note: '너무 많은 다리' },
        ],
      }),
      ['bad-organ'],
    );
    assert.deepEqual(
      bodyRules({ organs: [{ organ: 'core', count: 1, note: '' }] }),
      ['bad-organ'],
    );
  });

  test('기관 6종의 성격표가 다 차 있다', () => {
    for (const organ of ORGAN_KINDS) {
      const spec = organSpec(organ);
      assert.notEqual(spec, null);
      assert.notEqual(spec?.label, '');
      assert.notEqual(spec?.note, '');
    }
    assert.equal(bodySummary(hunterBody), '본체 · 눈×2 · 귀×2 · 입 · 사지×4');
    assert.equal(bodySummary(null), '몸이 없다');
  });
});
