// S2-c 역할 — 자리가 능력을 열고 막는다. 문화라고 공리를 비켜 가지는 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, type Id } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import { axiomId, type AbilityDefinition, type Definition } from '../../src/o0/index.ts';
import {
  applyRole,
  buildRole,
  checkRole,
  cultureRef,
  roleAdds,
  roleSummary,
  type CultureViolation,
  type ReadingRule,
  type RoleArchetype,
  type RoleSpec,
  type ValueTemplate,
} from '../../src/s2/index.ts';

const trackId = deterministicId('rule', 'ability', '자국 읽기');
const inscribeId = deterministicId('rule', 'ability', '전언 새김');
const veilCallId = deterministicId('rule', 'ability', '장막 부름');
const freeId = deterministicId('rule', 'ability', '공짜 부름');

/** 자국 읽기 — 약한 능력이라 대가가 없다 (종이 연다). */
const track: AbilityDefinition = {
  kind: 'Rule',
  id: trackId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '자국 읽기',
  when: ['땅에 남은 자국을 들여다본다'],
  then: ['지나간 것의 무게와 방향이 읽힌다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.3,
  costs: [],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${trackId}` }],
};

const inscribe: AbilityDefinition = {
  ...track,
  id: inscribeId,
  name: '전언 새김',
  when: ['상대의 눈을 마주 보고 한 문장을 말한다'],
  then: ['그 문장이 상대의 기억에 자기 것으로 새겨진다'],
  strength: 0.4,
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${inscribeId}` }],
};

/** 장막 부름 — 강한 능력이라 대가를 치른다. 입문 의례로만 열린다. */
const veilCall: AbilityDefinition = {
  ...track,
  id: veilCallId,
  name: '장막 부름',
  when: ['어미의 이름을 세 번 부른다'],
  then: ['붉은 장막이 그 자리로 흘러온다'],
  strength: 0.8,
  costs: [{ domain: 'biological', path: 'vitality', amount: 0.2 }],
  traces: [{ channel: 'light', domain: 'psychic', path: `trace.${veilCallId}` }],
};

/** 공짜 부름 — 강한데 대가가 없다. O0 가 막는다. */
const free: AbilityDefinition = { ...veilCall, id: freeId, name: '공짜 부름', costs: [] };

const DEFINITIONS: readonly Definition[] = [track, inscribe, veilCall, free];

const cultureId = deterministicId('rule', 'culture', '어미를 섬기는 자들');
const rite = cultureRef({ id: cultureId, name: '어미를 섬기는 자들' });

/** 종이 여는 능력 — 자국 읽기와 전언 새김. */
const SPECIES_CAPABILITIES: readonly Id[] = [trackId, inscribeId];

const priestReading: ReadingRule = {
  channel: 'light',
  sign: '붉은 빛',
  assertion: '어미가 부른다',
  confidence: 0.95,
  stance: 'approach',
};

const priestValue: ValueTemplate = {
  slot: { domain: 'transcendent', path: 'worship' },
  holder: { of: 'self' },
  band: { kind: 'range', min: 100, max: 1000000 },
  weight: 0.9,
  note: '기원이 쌓여야 어미가 대답한다',
};

function spec(overrides: Partial<RoleSpec> = {}): RoleSpec {
  return {
    cultureId,
    id: deterministicId('rule', 'role', '사제'),
    name: '사제',
    domain: 'transcendent',
    when: ['입문 의례를 거쳐 어미의 이름을 받는다'],
    then: ['장막을 부를 수 있게 되고, 자국을 쫓는 일이 금해진다'],
    axiomId: axiomId('psychic-life'),
    grants: [veilCallId],
    taboos: [trackId],
    readings: [priestReading],
    values: [priestValue],
    ...overrides,
  };
}

function check(
  role: RoleArchetype,
  speciesCapabilities: readonly Id[] = SPECIES_CAPABILITIES,
): readonly CultureViolation[] {
  const out: CultureViolation[] = [];
  checkRole(rite, role, { cultureId, speciesCapabilities }, DEFINITIONS, out);
  return out;
}

describe('S2-c 역할 — 자리가 행동 가능성을 가른다', () => {
  test('온전한 자리는 그대로 서고, 여전히 O1 Rule 이다', () => {
    const role = buildRole(spec());
    assert.deepEqual(check(role), []);
    assert.equal(classify(role).kind, 'Rule');
    assert.equal(roleAdds(role), true);
  });

  test('같은 종의 둘이 자리로 갈린다 — 하나는 열리고 하나는 막힌다', () => {
    const priest = buildRole(spec());
    const follower = buildRole(
      spec({
        id: deterministicId('rule', 'role', '신도'),
        name: '신도',
        grants: [],
        taboos: [inscribeId],
        readings: [],
      }),
    );

    const priestCan = applyRole(SPECIES_CAPABILITIES, priest.grants, priest.taboos);
    const followerCan = applyRole(SPECIES_CAPABILITIES, follower.grants, follower.taboos);

    assert.deepEqual(priestCan, [inscribeId, veilCallId], '사제는 자국을 못 쫓고 장막을 부른다');
    assert.deepEqual(followerCan, [trackId], '신도는 자국만 쫓는다');
    assert.notDeepEqual(priestCan, followerCan);
    assert.deepEqual(check(follower), []);
  });

  test('빈 목록은 아무것도 바꾸지 않는다', () => {
    assert.deepEqual(applyRole(SPECIES_CAPABILITIES, [], []), SPECIES_CAPABILITIES);
    assert.deepEqual(applyRole([], [veilCallId], []), [veilCallId]);
    assert.deepEqual(applyRole([], [], [trackId]), []);
  });

  test('같은 능력을 종과 자리가 함께 가리켜도 한 번만 선다', () => {
    assert.deepEqual(applyRole([trackId, trackId], [trackId], []), [trackId]);
  });

  test('종이 이미 여는 능력을 또 여는 것은 입문 의례가 아니다', () => {
    const violations = check(buildRole(spec({ grants: [inscribeId], taboos: [trackId] })));
    assert.equal(violations[0]?.rule, 'redundant-grant');
    assert.equal(violations[0]?.path, '$.grants[0]');
    assert.equal(violations[0]?.roleName, '사제');
  });

  test('공리를 어긴 능력은 입문 의례로도 열리지 않는다', () => {
    const violations = check(buildRole(spec({ grants: [freeId] })));
    assert.equal(violations[0]?.rule, 'unlawful-grant');
    assert.match(violations[0]?.message ?? '', /공짜 부름/);
  });

  test('세계에 없는 능력·규칙 아닌 ID 는 각자의 사유로 거부된다', () => {
    assert.equal(
      check(buildRole(spec({ grants: [deterministicId('rule', 'ability', '없는 것')] })))[0]?.rule,
      'unknown-grant',
    );
    assert.equal(
      check(buildRole(spec({ grants: [deterministicId('entity', 'ability', '사물')] })))[0]?.rule,
      'bad-grant',
    );
  });

  test('아무도 열지 않은 능력을 금하는 것은 금기가 아니다', () => {
    const violations = check(buildRole(spec({ taboos: [veilCallId], grants: [] })));
    assert.equal(violations[0]?.rule, 'phantom-taboo');
    assert.equal(violations[0]?.path, '$.taboos[0]');

    // 자리가 스스로 연 것은 금할 수 있는 것이 아니라 스스로를 무너뜨리는 것이다
    const selfDefeating = check(buildRole(spec({ grants: [veilCallId], taboos: [veilCallId] })));
    assert.equal(selfDefeating[0]?.rule, 'self-defeating-role');
  });

  test('아무것도 덧대지 않는 자리는 이름표일 뿐이다', () => {
    const empty = buildRole(spec({ grants: [], taboos: [], readings: [], values: [] }));
    assert.equal(roleAdds(empty), false);
    const violations = check(empty);
    assert.equal(violations[0]?.rule, 'empty-role');
    assert.equal(violations[0]?.path, '$');
  });

  test('다른 문화의 자리는 이 문화에 서지 못한다', () => {
    const violations = check(
      buildRole(spec({ cultureId: deterministicId('rule', 'culture', '자국을 쫓는 자들') })),
    );
    assert.equal(violations[0]?.rule, 'foreign-role');
    assert.equal(violations[0]?.path, '$.cultureId');
  });

  test('자리의 읽기·원함도 문화와 같은 관문을 지난다', () => {
    const out: CultureViolation[] = [];
    checkRole(
      rite,
      buildRole(spec({ readings: [{ ...priestReading, confidence: 0 }] })),
      { cultureId, speciesCapabilities: SPECIES_CAPABILITIES },
      DEFINITIONS,
      out,
    );
    assert.equal(out[0]?.rule, 'bad-confidence');
    assert.equal(out[0]?.roleName, '사제', '어느 자리에서 걸렸는지가 함께 실린다');

    const valueOut: CultureViolation[] = [];
    checkRole(
      rite,
      buildRole(spec({ values: [{ ...priestValue, note: '' }] })),
      { cultureId, speciesCapabilities: SPECIES_CAPABILITIES },
      DEFINITIONS,
      valueOut,
    );
    assert.equal(valueOut[0]?.rule, 'bad-value-template');
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.equal(roleSummary(buildRole(spec())), '사제 — +1능력 · −1금기 · 읽기 1 · 원함 1');
    assert.equal(
      roleSummary(buildRole(spec({ grants: [], taboos: [], readings: [], values: [] }))),
      '사제 — 덧대는 것이 없다',
    );
  });
});
