// R3-c 단위 테스트 — 여럿이 둘러보면 무엇이 갈리고, 무엇을 아무도 보지 못하는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import type { PerceptionProfile } from '../../src/s0/index.ts';
import {
  openField,
  recordPhenomena,
  type PhenomenonField,
  type WorldPhenomenon,
} from '../../src/r2/index.ts';
import {
  auditPercepts,
  openPerceptField,
  perceptFieldVerdict,
  perceptsFor,
  recordPercepts,
  sweep,
  unwitnessed,
  witnessTable,
  witnessesOf,
  type Observer,
  type Percept,
} from '../../src/r3/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const wormId = deterministicId('subject', 'beast', '장막벌레');
const guildId = deterministicId('subject', 'guild', '상단');
const canyonId = deterministicId('entity', 'place', '협곡');
const hamletId = deterministicId('entity', 'place', '마을');
const eventId = deterministicId('event', '겨울의 사건');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

const world: WorldState = assembleWorld([
  slot('physical', canyonId, 'cover', 0.4),
  slot('physical', canyonId, `distance.${hamletId}`, 200),
  slot('physical', hunterId, 'region', canyonId),
  slot('physical', wormId, 'region', canyonId),
  slot('physical', guildId, 'region', hamletId),
]).world;

const hunterProfile: PerceptionProfile = {
  channels: [
    { channel: 'light', threshold: 0.2, range: 300 },
    { channel: 'trace', threshold: 0.1, range: 5 },
    { channel: 'report', threshold: 0.5, range: 1000000 },
  ],
};
const wormProfile: PerceptionProfile = {
  channels: [
    { channel: 'smell', threshold: 0.05, range: 40 },
    { channel: 'psychic', threshold: 0.1, range: 200 },
  ],
};
const guildProfile: PerceptionProfile = {
  channels: [{ channel: 'report', threshold: 0.4, range: 1000000 }],
};

const hunter: Observer = { subjectId: hunterId, label: '몰이꾼 04', perception: hunterProfile };
const worm: Observer = { subjectId: wormId, label: '장막벌레', perception: wormProfile };
const guild: Observer = { subjectId: guildId, label: '상단', perception: guildProfile };
const observers = [hunter, worm, guild];

const trace = (
  channel: WorldPhenomenon['channel'],
  intensity: number,
  atTick: number,
  decaysAtTick: number | null,
): WorldPhenomenon => ({
  kind: 'Phenomenon',
  id: deterministicId('phenomenon', eventId, channel, `${String(intensity)}:${String(atTick)}`),
  channel,
  causeEventId: eventId,
  placeId: canyonId,
  intensity,
  decaysAtTick,
  atom: 'destroy',
  atTick,
  actorId: hunterId,
  domain: 'biological',
  holderId: hunterId,
  path: 'vitality',
  effectKind: 'change',
  ambiguity: 0.73,
});

/** 빛 하나(삭는다) · 냄새 하나(삭는다) · 흔적 하나(사라지지 않는다) · 소리 하나(아무도 못 듣는다) */
const phenomena: readonly WorldPhenomenon[] = [
  trace('light', 0.29, 405, 410),
  trace('smell', 0.6, 405, 410),
  trace('trace', 0.6, 405, null),
  trace('sound', 0.9, 405, 410),
];

const field: PhenomenonField = recordPhenomena(openField(), phenomena);

describe('R3-c 여럿이 둘러본다', () => {
  const run = sweep(observers, field, world, 405);

  test('셋이 서로 다른 것을 읽는다', () => {
    assert.deepEqual(
      run.sweeps.map((entry) => [entry.observer.label, entry.percepts.length]),
      [
        ['몰이꾼 04', 2],
        ['장막벌레', 1],
        ['상단', 0],
      ],
    );
  });

  test('흔적마다 누가 읽었는지가 남는다', () => {
    const light = phenomena[0] as WorldPhenomenon;
    const smell = phenomena[1] as WorldPhenomenon;
    assert.deepEqual(witnessesOf(run.field, light.id), [hunterId]);
    assert.deepEqual(witnessesOf(run.field, smell.id), [wormId]);
  });

  test('주체마다 자기가 읽은 것만 갖는다 — R4 가 받을 재료다', () => {
    assert.equal(perceptsFor(run.field, hunterId).length, 2);
    assert.equal(perceptsFor(run.field, wormId).length, 1);
    assert.deepEqual(perceptsFor(run.field, guildId), []);
  });

  test('아무도 듣지 못한 소리가 있다 — 위반이 아니라 사실이다', () => {
    const unseen = unwitnessed(run.field, phenomena);
    assert.deepEqual(unseen.map((entry) => entry.channel), ['sound']);
  });

  test('이미 삭은 흔적은 애초에 보이지 않는다 — R2-c 가 판정한 그대로다', () => {
    const late = sweep(observers, field, world, 411);
    assert.equal(late.field.percepts.length, 1); // 사라지지 않는 자국 하나만
    assert.equal(late.field.percepts[0]?.channel, 'trace');
  });

  test('아직 나지 않은 흔적도 보이지 않는다', () => {
    const early = sweep(observers, field, world, 404);
    assert.deepEqual(early.field.percepts, []);
  });
});

describe('R3-c 대조표 — 같은 흔적을 놓고 누가 보고 누가 못 보는가', () => {
  const run = sweep(observers, field, world, 405);
  const rows = witnessTable(run.sweeps);

  test('흔적마다 한 줄이고 주체마다 한 칸이다', () => {
    assert.equal(rows.length, phenomena.length);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row.byObserver).sort(), ['몰이꾼 04', '상단', '장막벌레']);
    }
  });

  test('못 읽은 칸에는 왜 못 읽었는지가 선다', () => {
    const light = rows[0];
    assert.equal(light?.byObserver['몰이꾼 04'], '0.29');
    assert.equal(light?.byObserver['장막벌레'], '통로 없음');
    assert.equal(light?.byObserver['상단'], '통로 없음');
    assert.equal(light?.seenBy, 1);
  });

  test('아무도 못 본 줄은 0 이다', () => {
    const sound = rows.find((row) => row.label.startsWith('소리'));
    assert.equal(sound?.seenBy, 0);
  });
});

describe('R3-c 감사 — 위반과 사실을 가른다', () => {
  const run = sweep(observers, field, world, 405);

  test('온전한 지각장은 어긋남이 없다', () => {
    const audit = auditPercepts(run.field, field, observers, 405);
    assert.equal(audit.complete, true, perceptFieldVerdict(audit));
    assert.equal(audit.recorded, 3);
    assert.equal(audit.seeing, 2);
    assert.deepEqual(audit.blind, ['상단']);
    assert.equal(audit.unwitnessed, 1);
  });

  test('판정 한 줄이 넷을 함께 센다', () => {
    const verdict = perceptFieldVerdict(auditPercepts(run.field, field, observers, 405));
    assert.match(verdict, /지각 3/);
    assert.match(verdict, /아무것도 못 읽은 주체 1/);
    assert.match(verdict, /아무도 못 본 흔적 1/);
  });

  test('감지 프로필 없는 주체의 지각은 걸린다', () => {
    const blindOne: Observer = { subjectId: hunterId, label: '눈 없는 자', perception: { channels: [] } };
    const audit = auditPercepts(run.field, field, [blindOne, worm, guild], 405);
    assert.ok(audit.violations.some((violation) => violation.rule === 'unprofiled-subject'));
  });

  test('그 틱에 서 있지 않은 흔적의 지각은 걸린다', () => {
    const audit = auditPercepts(run.field, field, observers, 411);
    assert.ok(audit.violations.some((violation) => violation.rule === 'stale-percept'));
  });

  test('진실이 실린 지각은 감사에서도 걸린다', () => {
    const leaked = {
      ...(run.field.percepts[0] as Percept),
      path: 'vitality',
    } as unknown as Percept;
    const audit = auditPercepts(recordPercepts(openPerceptField(), [leaked]), field, observers, 405);
    assert.ok(audit.violations.some((violation) => violation.rule === 'truth-leak'));
  });

  test('같은 지각을 두 번 담아도 늘지 않는다', () => {
    const twice = recordPercepts(run.field, run.field.percepts);
    assert.equal(twice, run.field);
  });

  test('빈 지각장·빈 흔적장은 감사를 지난다', () => {
    const audit = auditPercepts(openPerceptField(), openField(), [], 405);
    assert.equal(audit.complete, true);
    assert.equal(audit.recorded, 0);
    assert.equal(audit.unwitnessed, 0);
  });
});
