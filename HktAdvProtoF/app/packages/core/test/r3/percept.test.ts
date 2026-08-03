// R3-b 단위 테스트 — 무엇이 읽히는가, 그리고 읽은 자가 무엇을 알게 되는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import type { PerceptionProfile } from '../../src/s0/index.ts';
import type { WorldPhenomenon } from '../../src/r2/index.ts';
import {
  TRUTH_FIELDS,
  checkPercept,
  perceiveAll,
  perceiveOne,
  perceiveVerdict,
  perceptIdOf,
  perceptLine,
  perceptsOf,
  type Observer,
  type Percept,
  type PerceptViolation,
} from '../../src/r3/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const wormId = deterministicId('subject', 'beast', '장막벌레');
const guildId = deterministicId('subject', 'guild', '상단');
const strayId = deterministicId('subject', 'person', '떠도는 자');
const canyonId = deterministicId('entity', 'place', '협곡');
const hamletId = deterministicId('entity', 'place', '마을');
const eventId = deterministicId('event', '상단 11 을 친다');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 협곡(차폐 0.4)에 04 와 벌레가, 마을(200m)에 상단이 서 있다. 떠도는 자는 선 곳이 없다. */
const world: WorldState = assembleWorld([
  slot('physical', canyonId, 'cover', 0.4),
  slot('physical', canyonId, `distance.${hamletId}`, 200),
  slot('physical', hunterId, 'region', canyonId),
  slot('physical', wormId, 'region', canyonId),
  slot('physical', guildId, 'region', hamletId),
]).world;

/** S1 사냥꾼의 감각 — 빛 0.2/300 · 소리 0.3/120 · 흔적 0.1/5 · 보고 0.5/∞ */
const hunterProfile: PerceptionProfile = {
  channels: [
    { channel: 'light', threshold: 0.2, range: 300 },
    { channel: 'sound', threshold: 0.3, range: 120 },
    { channel: 'trace', threshold: 0.1, range: 5 },
    { channel: 'report', threshold: 0.5, range: 1000000 },
  ],
};
/** S1 장막벌레 — 냄새 0.05/40 · 의념 0.1/200. 빛도 소리도 없다 */
const wormProfile: PerceptionProfile = {
  channels: [
    { channel: 'smell', threshold: 0.05, range: 40 },
    { channel: 'psychic', threshold: 0.1, range: 200 },
  ],
};
/** S1 상단 — 보고 0.4/∞ 만. 몸이 없다 */
const guildProfile: PerceptionProfile = {
  channels: [{ channel: 'report', threshold: 0.4, range: 1000000 }],
};

const hunter: Observer = { subjectId: hunterId, label: '몰이꾼 04', perception: hunterProfile };
const worm: Observer = { subjectId: wormId, label: '장막벌레', perception: wormProfile };
const guild: Observer = { subjectId: guildId, label: '상단', perception: guildProfile };
const stray: Observer = { subjectId: strayId, label: '떠도는 자', perception: hunterProfile };

const trace = (
  channel: WorldPhenomenon['channel'],
  intensity: number,
  placeId = canyonId,
): WorldPhenomenon => ({
  kind: 'Phenomenon',
  id: deterministicId('phenomenon', eventId, channel, `${String(intensity)}${placeId}`),
  channel,
  causeEventId: eventId,
  placeId,
  intensity,
  decaysAtTick: null,
  atom: 'destroy',
  atTick: 415,
  actorId: hunterId,
  domain: 'biological',
  holderId: hunterId,
  path: 'vitality',
  effectKind: 'change',
  ambiguity: 0.73,
});

/** 협곡에 난 다섯 — 빛 둘 · 냄새 둘 · 흔적 하나. */
const phenomena: readonly WorldPhenomenon[] = [
  trace('light', 0.29),
  trace('light', 0.11),
  trace('smell', 0.6),
  trace('smell', 0.05),
  trace('trace', 0.6),
];

describe('R3-b 같은 흔적 앞에서 서로 다른 세계에 산다', () => {
  test('사냥꾼은 문턱을 넘는 빛과 흔적만 읽는다', () => {
    const attempts = perceiveAll(hunter, phenomena, world);
    const got = perceptsOf(attempts);
    assert.deepEqual(got.map((percept) => percept.channel), ['light', 'trace']);
    // 빛 0.11 은 문턱 0.2 에 못 미친다.
    assert.equal(
      attempts.find((attempt) => attempt.phenomenon.intensity === 0.11)?.miss,
      'too-faint',
    );
  });

  test('벌레는 냄새로만 읽는다 — 빛도 소리도 없는 통로다', () => {
    const attempts = perceiveAll(worm, phenomena, world);
    const got = perceptsOf(attempts);
    assert.deepEqual(got.map((percept) => percept.channel), ['smell', 'smell']);
    assert.equal(
      attempts.find((attempt) => attempt.phenomenon.channel === 'light')?.miss,
      'no-channel',
    );
  });

  test('둘이 읽는 것은 겹치지 않는다 — 같은 자리에 서 있는데도', () => {
    const seen = new Set(perceptsOf(perceiveAll(hunter, phenomena, world)).map((p) => p.phenomenonId));
    const smelt = new Set(perceptsOf(perceiveAll(worm, phenomena, world)).map((p) => p.phenomenonId));
    assert.equal([...seen].filter((id) => smelt.has(id)).length, 0);
  });

  test('상단은 보고만 받는데 이 겨울에 보고가 나지 않아 아무것도 모른다', () => {
    const attempts = perceiveAll(guild, phenomena, world);
    assert.deepEqual(perceptsOf(attempts), []);
    assert.ok(attempts.every((attempt) => attempt.miss === 'no-channel'));
    assert.match(perceiveVerdict(guild, attempts), /아무것도 감지하지 못한다/);
  });

  test('세계에 선 곳이 없는 자는 아무것도 감지하지 못한다', () => {
    const attempts = perceiveAll(stray, phenomena, world);
    assert.deepEqual(perceptsOf(attempts), []);
    assert.match(attempts[0]?.message ?? '', /세계에 선 곳이 없다/);
  });
});

describe('R3-b 거리와 차폐가 판정에 든다', () => {
  test('마을에서 보면 협곡의 가림막이 빛을 죽인다', () => {
    const outsider: Observer = { subjectId: guildId, label: '마을의 사냥꾼', perception: hunterProfile };
    const attempt = perceiveOne(outsider, trace('light', 0.29), world);
    assert.equal(attempt.percept, null);
    assert.equal(attempt.miss, 'too-faint'); // 0.29 × (1 − 0.4) = 0.174 < 0.2
    assert.equal(Number(attempt.reach.intensity.toFixed(3)), 0.174);
  });

  test('가림막이 죽이지 못한 흔적도 거리에서 걸린다 — 자국은 현장에 있다', () => {
    const outsider: Observer = { subjectId: guildId, label: '마을의 사냥꾼', perception: hunterProfile };
    const attempt = perceiveOne(outsider, trace('trace', 0.6), world);
    assert.equal(attempt.reach.intensity, 0.6); // 차폐가 흔적을 깎지 않는다
    assert.equal(attempt.miss, 'too-far'); // 그러나 도달 거리가 5m 다
  });

  test('같은 자리에 선 자에게는 차폐가 들지 않는다', () => {
    const attempt = perceiveOne(hunter, trace('light', 0.29), world);
    assert.notEqual(attempt.percept, null);
    assert.equal(attempt.percept?.intensity, 0.29);
    assert.equal(attempt.percept?.distance, 0);
  });

  test('거리가 세계에 적혀 있지 않으면 닿지 않는다', () => {
    const elsewhere = deterministicId('entity', 'place', '둥지');
    const attempt = perceiveOne(hunter, trace('trace', 0.9, elsewhere), world);
    assert.equal(attempt.miss, 'too-far');
    assert.equal(attempt.reach.distance, Number.POSITIVE_INFINITY);
  });
});

describe('R3-b 지각에는 진실이 실리지 않는다', () => {
  const percept = perceiveOne(hunter, trace('light', 0.29), world).percept as Percept;

  test('감지한 자가 얻는 것은 통로·세기·자리·거리·애매함까지다', () => {
    assert.deepEqual([...Object.keys(percept)].sort(), [
      'ambiguity',
      'atTick',
      'channel',
      'distance',
      'id',
      'intensity',
      'phenomenonId',
      'placeId',
      'subjectId',
    ]);
  });

  test('어느 자리가 움직였는지도 누가 냈는지도 실리지 않는다', () => {
    for (const field of TRUTH_FIELDS) {
      assert.ok(!(field in percept), `${field} 가 지각에 실렸다`);
    }
  });

  test('id 는 유래에서 나온다 — 같은 자가 같은 흔적을 보면 같은 지각이다', () => {
    assert.equal(percept.id, perceptIdOf(hunterId, percept.phenomenonId));
  });

  test('한 줄 요약도 무엇이었는지 말하지 않는다', () => {
    const line = perceptLine(percept);
    assert.match(line, /빛 세기 0.29/);
    assert.doesNotMatch(line, /vitality|destroy/);
  });
});

describe('R3-b 설 수 없는 지각', () => {
  const good = perceiveOne(hunter, trace('light', 0.29), world).percept as Percept;
  const check = (percept: Percept): readonly PerceptViolation[] => {
    const out: PerceptViolation[] = [];
    checkPercept(percept, phenomena, out);
    return out;
  };

  test('흔적을 통째로 스프레드하면 걸린다 — 이것이 truth-leak 의 실제 모습이다', () => {
    const leaked = { ...trace('light', 0.29), ...good } as unknown as Percept;
    const violations = check(leaked);
    assert.equal(violations[0]?.rule, 'truth-leak');
    assert.match(violations[0]?.message ?? '', /본 순간 다 알아 버려/);
  });

  test('세계에 없는 흔적은 감지될 수 없다', () => {
    const violations = check({ ...good, phenomenonId: deterministicId('phenomenon', '없던 것') });
    assert.equal(violations[0]?.rule, 'phantom-percept');
  });

  test('원래보다 센 감지는 걸린다 — 거리와 차폐는 깎기만 한다', () => {
    const violations = check({ ...good, intensity: 0.95 });
    assert.equal(violations[0]?.rule, 'bad-intensity');
    assert.match(violations[0]?.message ?? '', /깎기만 한다/);
  });

  test('통로나 자리를 바꿔 적으면 걸린다', () => {
    assert.equal(check({ ...good, channel: 'smell' })[0]?.rule, 'phantom-percept');
    assert.equal(check({ ...good, placeId: hamletId })[0]?.rule, 'phantom-percept');
  });

  test('6종 밖의 통로도 걸린다', () => {
    const violations = check({ ...good, channel: 'telepathy' as never });
    assert.equal(violations[0]?.rule, 'unknown-channel');
  });

  test('온전한 지각은 아무 사유도 남기지 않는다', () => {
    assert.deepEqual(check(good), []);
  });
});
