// O0-b 단위 테스트 — 공리를 어기는 능력·종 정의가 거부되는가 (원문 O0 검증 조항 ①).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import {
  axiomId,
  checkDefinitionShape,
  definitionVerdict,
  hasSlot,
  implementedClauses,
  slotLabel,
  STRONG_EFFECT_THRESHOLD,
  validateDefinition,
  validateDefinitions,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../../src/o0/index.ts';
import { STATE_SCHEMA } from '../../src/o2/index.ts';

const veilId = deterministicId('rule', 'ability', '붉은 장막');

/** 정상 능력 — 강한 효과이고, 의념 에너지를 치르고, 빛으로 관찰된다. */
const veil: AbilityDefinition = {
  kind: 'Rule',
  id: veilId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '붉은 장막',
  when: ['둥지에 침입자가 든다'],
  then: ['둥지 전체가 붉은 안개에 잠긴다'],
  axiomId: axiomId('verifiable-cost'),
  supportIds: [axiomId('observable-trace')],
  strength: 0.9,
  costs: [{ domain: 'psychic', path: 'energy', amount: 120 }],
  traces: [{ channel: 'light', domain: 'psychic', path: `trace.${veilId}` }],
};

/** 정상 종 — 사람이고, 살아 있고, 의념 자리를 갖는다. */
const hunter: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '사냥꾼'),
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기를 지고 신념 압력을 갖는다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** 정상 신 — 유래가 있고 초월 자리를 갖는다. */
const motherGod: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '붉은 장막의 어미'),
  definitionKind: 'species',
  domain: 'transcendent',
  name: '붉은 장막의 어미',
  when: ['아랫마을이 같은 제물을 계속 바친다'],
  then: ['둥지 위에 신역이 걸린다'],
  axiomId: axiomId('emergent-divinity'),
  supportIds: [axiomId('psychic-life')],
  subjectKind: 'god',
  alive: true,
  slots: [
    { domain: 'psychic', path: 'energy' },
    { domain: 'transcendent', path: 'anchor' },
    { domain: 'transcendent', path: 'worship' },
  ],
  originId: deterministicId('subject', 'organization', '아랫마을 사람들'),
};

/** 위반 사유만 뽑는다 — 표로 비교하려고. */
function rules(definition: Definition): string[] {
  return validateDefinition(definition).map((violation) => violation.rule);
}

describe('정의는 규칙이다', () => {
  test('정의는 그대로 온전한 O1 Rule 이다 — 새 타입을 만들지 않았다', () => {
    for (const definition of [veil, hunter, motherGod]) {
      assert.equal(classify(definition).kind, 'Rule', definition.name);
    }
  });

  test('공리 위에 선 정의는 아무것도 걸리지 않는다', () => {
    for (const definition of [veil, hunter, motherGod]) {
      assert.deepEqual(rules(definition), [], definition.name);
    }
  });

  test('정의 층위 검사기는 네 조항에 붙어 있다', () => {
    assert.deepEqual(
      [...implementedClauses()],
      ['psychic-life', 'verifiable-cost', 'observable-trace', 'emergent-divinity'],
    );
  });

  test('세계의 자리는 매개 자리로도 실제 경로로도 찾힌다', () => {
    assert.ok(hasSlot(STATE_SCHEMA, 'psychic', 'trace.{rule}'));
    assert.ok(hasSlot(STATE_SCHEMA, 'psychic', `trace.${veilId}`));
    assert.ok(!hasSlot(STATE_SCHEMA, 'psychic', 'mana'));
    assert.ok(!hasSlot(STATE_SCHEMA, 'astral', 'anything'));
    assert.equal(slotLabel({ domain: 'psychic', path: 'energy' }), 'psychic.energy');
  });
});

describe('근거 — O1 이 허용하는 것을 O0 가 거부한다', () => {
  test('근거 공리 없는 정의는 거부된다 (O1 Rule 로서는 온전하다)', () => {
    const orphan = { ...veil, axiomId: null };
    assert.equal(classify(orphan).kind, 'Rule'); // O1 은 통과시킨다
    assert.deepEqual(rules(orphan), ['ungrounded-definition']); // O0 가 막는다
  });

  test('없는 공리를 근거로 들면 거부된다', () => {
    const invented = { ...veil, axiomId: deterministicId('axiom', 'free-lunch') };
    assert.deepEqual(rules(invented), ['unknown-axiom']);
    const badSupport = { ...veil, supportIds: [deterministicId('axiom', 'free-lunch')] };
    assert.deepEqual(rules(badSupport), ['unknown-axiom']);
    assert.equal(validateDefinition(badSupport)[0]?.path, '$.supportIds[0]');
  });

  test('형태가 무너진 정의에는 공리를 들이대지 않는다 — 사유가 두 겹으로 쌓이지 않게', () => {
    const broken = { ...veil, then: [], traces: [] };
    const found = validateDefinition(broken);
    assert.deepEqual(
      found.map((violation) => violation.rule),
      ['bad-definition'],
    );
    assert.equal(found[0]?.path, '$.then');
  });

  test('정의 ID 는 규칙 ID 여야 한다 — 흔적 자리가 이 ID 를 매개로 받는다', () => {
    assert.deepEqual(checkDefinitionShape({ ...veil, id: 'subject:abcd1234' }), [
      '$.id 정의의 ID 는 rule 종류여야 한다 — "subject:abcd1234"',
    ]);
  });

  test('강도가 0~1 밖이면 형태부터 거부된다', () => {
    assert.deepEqual(rules({ ...veil, strength: 1.5 }), ['bad-definition']);
  });
});

describe('psychic-life — 생명은 의념을 발생시킨다', () => {
  test('의념 자리 없는 생명은 거부된다', () => {
    const mindless = { ...hunter, slots: [{ domain: 'biological' as const, path: 'hunger' }] };
    assert.deepEqual(rules(mindless), ['mindless-life']);
    assert.equal(validateDefinition(mindless)[0]?.clause, 'psychic-life');
    assert.equal(validateDefinition(mindless)[0]?.path, '$.slots');
  });

  test('사람과 생물은 생명이 아니라고 선언될 수 없다', () => {
    assert.deepEqual(rules({ ...hunter, alive: false }), ['life-denied']);
    assert.deepEqual(
      rules({ ...hunter, subjectKind: 'creature', alive: false }),
      ['life-denied'],
    );
  });

  test('생명이 아닌 종에는 의념 자리를 요구하지 않는다 — 조직은 스스로 굶지 않는다', () => {
    const guild: SpeciesDefinition = {
      ...hunter,
      id: deterministicId('rule', 'species', '아랫마을 상단'),
      name: '아랫마을 상단',
      subjectKind: 'organization',
      alive: false,
      slots: [{ domain: 'economic', path: 'stock.{entity}' }],
    };
    assert.deepEqual(rules(guild), []);
  });

  test('능력 정의에는 이 공리가 걸리지 않는다 — appliesTo 가 종뿐이다', () => {
    assert.deepEqual(rules({ ...veil, strength: 0.9 }), []);
  });
});

describe('verifiable-cost — 강한 의념 효과에는 검증 가능한 비용이 필요하다', () => {
  test('아무것도 치르지 않는 대능력은 거부된다', () => {
    const free = { ...veil, costs: [] };
    assert.deepEqual(rules(free), ['free-strong-effect']);
    assert.match(validateDefinition(free)[0]?.message ?? '', /0\.9/);
  });

  test('임계 그 자체는 강하지 않다 — 넘어야 비용을 요구한다', () => {
    assert.deepEqual(rules({ ...veil, strength: STRONG_EFFECT_THRESHOLD, costs: [] }), []);
    assert.deepEqual(rules({ ...veil, strength: 0.5000001, costs: [] }), ['free-strong-effect']);
  });

  test('세계에 없는 자리를 깎는 비용은 확인할 수 없다', () => {
    const fake = { ...veil, costs: [{ domain: 'psychic' as const, path: 'mana', amount: 10 }] };
    assert.deepEqual(rules(fake), ['unverifiable-cost']);
    assert.match(validateDefinition(fake)[0]?.message ?? '', /psychic\.mana/);
  });

  test('양이 0 이하면 치른 것이 아니다', () => {
    const zero = { ...veil, costs: [{ domain: 'psychic' as const, path: 'energy', amount: 0 }] };
    assert.deepEqual(rules(zero), ['weightless-cost']);
  });

  test('약한 효과는 비용 없이도 선다 — 원문은 "강한" 효과에만 대가를 요구한다', () => {
    assert.deepEqual(rules({ ...veil, strength: 0.2, costs: [] }), []);
  });
});

describe('observable-trace — 모든 능력은 관찰 가능한 흔적을 남긴다', () => {
  test('흔적 없는 능력은 거부된다 — 강하든 약하든', () => {
    assert.deepEqual(rules({ ...veil, traces: [] }), ['traceless-ability']);
    assert.deepEqual(rules({ ...veil, strength: 0.1, costs: [], traces: [] }), [
      'traceless-ability',
    ]);
  });

  test('현상 통로 6종 밖으로는 관찰되지 않는다', () => {
    const gossip = {
      ...veil,
      traces: [{ channel: 'rumor' as never, domain: 'psychic' as const, path: `trace.${veilId}` }],
    };
    assert.deepEqual(rules(gossip), ['unknown-channel']);
  });

  test('세계에 적힐 자리가 없는 흔적은 관찰되지 않는다', () => {
    const nowhere = {
      ...veil,
      traces: [{ channel: 'light' as const, domain: 'psychic' as const, path: 'afterglow' }],
    };
    assert.deepEqual(rules(nowhere), ['unobservable-trace']);
    assert.equal(validateDefinition(nowhere)[0]?.path, '$.traces[0]');
  });

  test('흔적은 의념 자리 말고 다른 영역에도 적힐 수 있다 — 전언도 흔적이다', () => {
    const claimId = deterministicId('claim', '장막이 걷혔다');
    const inscribe: AbilityDefinition = {
      ...veil,
      id: deterministicId('rule', 'ability', '전언 새김'),
      name: '전언 새김',
      strength: 0.3,
      costs: [],
      traces: [
        { channel: 'report', domain: 'informational', path: `rumorSpread.${claimId}` },
      ],
    };
    assert.deepEqual(rules(inscribe), []);
  });
});

describe('emergent-divinity — 집단의 반복 행동이 신을 만든다', () => {
  test('유래 없는 신은 거부된다', () => {
    const selfMade = { ...motherGod, originId: null };
    assert.deepEqual(rules(selfMade), ['ungrounded-god']);
    assert.equal(validateDefinition(selfMade)[0]?.path, '$.originId');
  });

  test('초월 자리 없는 신은 세계에 걸리지 않는다', () => {
    const floating = { ...motherGod, slots: [{ domain: 'psychic' as const, path: 'energy' }] };
    assert.deepEqual(rules(floating), ['unanchored-god']);
  });

  test('두 조항이 함께 무너지면 둘 다 나온다', () => {
    assert.deepEqual(rules({ ...motherGod, originId: null, slots: [] }), [
      'mindless-life',
      'ungrounded-god',
      'unanchored-god',
    ]);
  });

  test('신이 아닌 종은 집단의 반복 행동을 유래로 들 수 없다', () => {
    const born = { ...hunter, originId: deterministicId('subject', 'organization', '아랫마을') };
    assert.deepEqual(rules(born), ['origin-without-divinity']);
  });
});

describe('관문 — 어긴 정의는 세계에 들어가지 않는다', () => {
  test('통과한 것만 서고, 막힌 것은 사유로 남는다', () => {
    const report = validateDefinitions([veil, hunter, motherGod, { ...veil, traces: [] }]);
    assert.equal(report.accepted.length, 3);
    assert.deepEqual(
      report.rejected.map((definition) => definition.name),
      ['붉은 장막'],
    );
    assert.deepEqual(
      report.violations.map((violation) => violation.rule),
      ['traceless-ability'],
    );
    assert.ok(!report.complete);
    assert.match(definitionVerdict(report), /traceless-ability/);
  });

  test('전부 통과하면 완결이다', () => {
    const report = validateDefinitions([veil, hunter, motherGod]);
    assert.ok(report.complete);
    assert.match(definitionVerdict(report), /정의 3개가 공리 위에 섰다/);
  });

  test('들일 정의가 없으면 완결이 아니다 — 아무것도 확인하지 않은 것이다', () => {
    const blank = validateDefinitions([]);
    assert.ok(!blank.complete);
    assert.equal(definitionVerdict(blank), '들일 정의가 없다');
  });

  test('위반은 어느 정의의 어느 자리인지를 그대로 가리킨다', () => {
    const violation = validateDefinition({ ...veil, traces: [] })[0];
    assert.equal(violation?.definitionId, veilId);
    assert.equal(violation?.definitionName, '붉은 장막');
    assert.equal(violation?.axiomId, axiomId('observable-trace'));
    assert.equal(violation?.clause, 'observable-trace');
  });
});
