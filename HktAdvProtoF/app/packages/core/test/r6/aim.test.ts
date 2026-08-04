// R6-b 단위 테스트 — 사이가 상대를 고르고, 모르는 상대는 겨눌 수 없다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type WorldState } from '../../src/o2/index.ts';
import type { WorldEvent } from '../../src/r1/index.ts';
import { liveMemory, type Memory } from '../../src/r5/index.ts';
import {
  CONSENT_AXIS,
  axisFor,
  checkAim,
  chooseAim,
  knownCounterparts,
  type Aim,
  type AimSpec,
  type IntentViolation,
} from '../../src/r6/index.ts';

const strikerId = deterministicId('subject', 'person', '몰이꾼 04');
const victimId = deterministicId('subject', 'person', '상단 11');
const villagersId = deterministicId('subject', 'guild', '마을 사람들');
const strangerId = deterministicId('subject', 'person', '지나가는 자');

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 11 의 세계 — 마을과는 신뢰 0.6 이 적혀 있고 04 와는 아무것도 적혀 있지 않다. */
const world: WorldState = assembleWorld([
  slot('relational', victimId, `trust.${villagersId}`, 0.6),
]).world;

const strike: WorldEvent = {
  kind: 'Event',
  id: deterministicId('event', '친다'),
  tick: 415,
  name: '상단 11 을 친다',
  actorId: strikerId,
  changedStateIds: [],
  causeIds: [],
  atom: 'destroy',
  targetIds: [victimId],
  effects: [
    { kind: 'change', domain: 'biological', holderId: victimId, path: 'vitality', from: 0.8, to: 0.2 },
  ],
};

/** 11 은 04 에게 맞았다 — 지목이 붙은 기억 하나. */
const lived = (): Memory => liveMemory(strike, victimId, null).memory as Memory;

const everyone = [strikerId, victimId, villagersId, strangerId];

const specOf = (atom: Parameters<typeof chooseAim>[0]['atom'], memories: readonly Memory[]): AimSpec => ({
  atom,
  subjectId: victimId,
  memories,
  world,
  candidates: everyone,
});

const rulesOf = (violations: readonly IntentViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R6-b 동의 축이 사이 축을 부른다', () => {
  test('등지는 손은 원한을, 내미는 손은 신뢰를 본다', () => {
    assert.equal(CONSENT_AXIS.against, 'grudge');
    assert.equal(CONSENT_AXIS.mutual, 'trust');
    assert.equal(axisFor('seize'), 'grudge');
    assert.equal(axisFor('coerce'), 'grudge');
    assert.equal(axisFor('betray'), 'grudge');
    assert.equal(axisFor('exchange'), 'trust');
    assert.equal(axisFor('persuade'), 'trust');
    assert.equal(axisFor('ally'), 'trust');
  });

  test('상대를 겨누지 않는 원자는 볼 축이 없다', () => {
    assert.equal(axisFor('acquire'), null);
    assert.equal(axisFor('destroy'), null);
  });
});

describe('R6-b 아는 상대는 둘에서만 온다', () => {
  test('기억이 짚은 자와 세계가 사이를 적어 둔 자', () => {
    const known = knownCounterparts([lived()], world, victimId, everyone);
    assert.deepEqual(
      known.map((entry) => entry.via).sort(),
      ['attribution', 'written'],
    );
    const byId = new Map(known.map((entry) => [entry.subjectId, entry.via]));
    assert.equal(byId.get(strikerId), 'attribution', '04 는 기억이 짚었다');
    assert.equal(byId.get(villagersId), 'written', '마을은 세계가 적어 두었다');
  });

  test('둘 다 아니면 그는 이 주체에게 없는 사람이다', () => {
    const known = knownCounterparts([lived()], world, victimId, everyone);
    assert.equal(
      known.some((entry) => entry.subjectId === strangerId),
      false,
    );
  });

  test('기억이 없으면 아는 상대는 세계가 적어 둔 쪽뿐이다', () => {
    const known = knownCounterparts([], world, victimId, everyone);
    assert.deepEqual(
      known.map((entry) => entry.subjectId),
      [villagersId],
    );
  });

  test('자기 자신은 상대가 아니다', () => {
    const known = knownCounterparts([lived()], world, victimId, everyone);
    assert.equal(
      known.some((entry) => entry.subjectId === victimId),
      false,
    );
  });
});

describe('R6-b 사이가 상대를 고른다', () => {
  test('등지는 손은 원한이 가장 큰 자를 겨눈다 — 04 다', () => {
    const result = chooseAim(specOf('seize', [lived()]));
    assert.equal(result.aim?.counterpartId, strikerId);
    assert.equal(result.aim?.axis, 'grudge');
    assert.equal(result.aim?.via, 'attribution');
  });

  test('같은 주체·같은 사이인데 내미는 손은 다른 사람을 겨눈다 — 마을이다', () => {
    const result = chooseAim(specOf('exchange', [lived()]));
    assert.equal(result.aim?.counterpartId, villagersId);
    assert.equal(result.aim?.axis, 'trust');
    assert.equal(result.aim?.value, 0.6);
  });

  test('안 골린 상대도 값으로 남는다 — 왜 안 골렸는지가 적힌다', () => {
    const result = chooseAim(specOf('seize', [lived()]));
    assert.equal(result.candidates.length, 2);
    const rejected = result.candidates.find((entry) => !entry.chosen);
    assert.ok(rejected?.note.includes('겨눌 이유가 없다'), rejected?.note);
    assert.equal(rejected?.value, 0, '마을과의 원한은 서 있지 않다');
  });

  test('겨눌 상대가 하나도 없으면 서지 못한다 — 아무나 겨누지 않는다', () => {
    const result = chooseAim({
      atom: 'seize',
      subjectId: strangerId,
      memories: [],
      world,
      candidates: everyone,
    });
    assert.equal(result.aim, null);
    assert.deepEqual(rulesOf(result.violations), ['aimless-intent']);
  });

  test('밖에서 본 자는 빼앗을 상대가 없다 — 원한이 선 자가 하나도 없다', () => {
    const seen: Memory = { ...lived(), attribution: null, ground: 'seen', slot: null };
    const result = chooseAim(specOf('seize', [seen]));
    assert.equal(result.aim, null);
    assert.deepEqual(rulesOf(result.violations), ['aimless-intent']);
    // 마을은 아는 상대이지만 그와의 원한은 서 있지 않다 — 안다고 겨눌 수 있는 것이 아니다
    assert.equal(result.candidates.length, 1);
    assert.ok(result.violations[0]?.message.includes('그 축(원한)이 선 자가 하나도 없다'));
  });

  test('그런데 소문을 들으면 그 순간 겨눌 수 있게 된다 — R5 가 R6 로 흘러드는 자리', () => {
    const seen: Memory = { ...lived(), attribution: null, ground: 'seen', slot: null };
    assert.equal(chooseAim(specOf('seize', [seen])).aim, null);
    assert.equal(chooseAim(specOf('seize', [lived()])).aim?.counterpartId, strikerId);
  });

  test('신뢰가 서 있지 않은 상대와는 주고받지 않는다', () => {
    const bare = assembleWorld([slot('relational', victimId, `fear.${villagersId}`, 0.4)]).world;
    const result = chooseAim({
      atom: 'exchange',
      subjectId: victimId,
      memories: [],
      world: bare,
      candidates: everyone,
    });
    assert.equal(result.aim, null, '아는 상대지만 신뢰가 0 이라 내밀 손이 없다');
  });

  test('상대를 겨누지 않는 원자에는 겨눔이 서지 않는다', () => {
    const result = chooseAim(specOf('acquire', [lived()]));
    assert.equal(result.aim, null);
    assert.deepEqual(result.violations, []);
  });

  test('같은 재료면 언제나 같은 상대를 고른다 (결정성)', () => {
    const a = chooseAim(specOf('seize', [lived()])).aim as Aim;
    const b = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.deepEqual(a, b);
  });
});

describe('R6-b 설 수 없는 겨눔이 걸린다', () => {
  const check = (aim: Aim, atom: Parameters<typeof chooseAim>[0]['atom'] = 'seize') => {
    const out: IntentViolation[] = [];
    checkAim(aim, specOf(atom, [lived()]), out);
    return rulesOf(out);
  };

  test('사이에서 고른 겨눔은 아무 사유도 내지 않는다', () => {
    const aim = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.deepEqual(check(aim), []);
  });

  test('모르는 상대를 겨누면 걸린다', () => {
    const aim = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.deepEqual(check({ ...aim, counterpartId: strangerId }), ['unknown-counterpart']);
  });

  test('아는 상대라도 사이가 고른 자가 아니면 aim-drift 로 걸린다', () => {
    const aim = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.ok(check({ ...aim, counterpartId: villagersId }).includes('aim-drift'));
  });

  test('사이 값을 손으로 고치면 걸린다', () => {
    const aim = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.deepEqual(check({ ...aim, value: 0.99 }), ['aim-drift']);
  });

  test('자기 자신을 겨누면 걸린다', () => {
    const aim = chooseAim(specOf('seize', [lived()])).aim as Aim;
    assert.deepEqual(check({ ...aim, counterpartId: victimId }), ['self-aimed']);
  });
});
