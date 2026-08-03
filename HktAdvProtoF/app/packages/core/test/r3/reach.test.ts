// R3-a 단위 테스트 — 자리가 거리가 되고, 가림막이 세기를 깎는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { PHENOMENON_CHANNELS } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import {
  COVER_RESISTANCES,
  UNREACHABLE,
  attenuationVerdict,
  checkAttenuation,
  coverOf,
  coverResistance,
  distanceBetween,
  reachLine,
  reachOf,
  standsIn,
  type CoverResistance,
} from '../../src/r3/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const guildId = deterministicId('subject', 'guild', '상단');
const canyonId = deterministicId('entity', 'place', '협곡');
const hamletId = deterministicId('entity', 'place', '마을');
const nestId = deterministicId('entity', 'place', '둥지');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 협곡(차폐 0.4)과 마을(200m 떨어져 있다). 둥지까지의 거리는 세계에 적혀 있지 않다. */
const world: WorldState = assembleWorld([
  slot('physical', canyonId, 'cover', 0.4),
  slot('physical', canyonId, `distance.${hamletId}`, 200),
  slot('physical', hunterId, 'region', canyonId),
  slot('physical', guildId, 'region', hamletId),
]).world;

const trace = (channel: (typeof PHENOMENON_CHANNELS)[number], intensity: number) => ({
  placeId: canyonId,
  channel,
  intensity,
});

describe('R3-a 거리 — 적히지 않은 거리는 없는 거리다', () => {
  test('같은 자리는 0 이다', () => {
    assert.equal(distanceBetween(world, canyonId, canyonId), 0);
  });

  test('세계가 적어 둔 거리를 읽는다 — 어느 쪽에 적혀 있어도 읽는다', () => {
    assert.equal(distanceBetween(world, canyonId, hamletId), 200);
    assert.equal(distanceBetween(world, hamletId, canyonId), 200);
  });

  test('적혀 있지 않으면 닿지 않는다 — 없는 거리를 지어내지 않는다', () => {
    assert.equal(distanceBetween(world, canyonId, nestId), UNREACHABLE);
    assert.equal(distanceBetween(world, hamletId, nestId), UNREACHABLE);
  });

  test('선 곳은 세계에서 읽는다 — 적혀 있지 않은 자는 거리를 잴 수 없다', () => {
    assert.equal(standsIn(world, hunterId), canyonId);
    assert.equal(standsIn(world, guildId), hamletId);
    assert.equal(standsIn(world, nestId), null);
  });
});

describe('R3-a 차폐 — 자리를 건널 때만 든다', () => {
  test('같은 자리에 선 자는 가림막 안쪽이다', () => {
    const reach = reachOf(world, canyonId, trace('light', 0.29));
    assert.equal(reach.crossesCover, false);
    assert.equal(reach.cover, 0);
    assert.equal(reach.intensity, 0.29);
    assert.match(reachLine(reach), /같은 자리라 차폐가 들지 않는다/);
  });

  test('밖에서 보면 협곡의 가림막이 빛을 깎는다', () => {
    const reach = reachOf(world, hamletId, trace('light', 0.29));
    assert.equal(reach.crossesCover, true);
    assert.equal(reach.cover, 0.4);
    assert.equal(reach.factor, 1);
    assert.equal(Number(reach.intensity.toFixed(4)), 0.174);
    assert.equal(reach.distance, 200);
  });

  test('소리는 절반만 깎인다 — 벽을 돌아온다', () => {
    const reach = reachOf(world, hamletId, trace('sound', 0.4));
    assert.equal(Number(reach.intensity.toFixed(2)), 0.32);
  });

  test('냄새·흔적·의념·보고는 가림막과 무관하다', () => {
    for (const channel of ['smell', 'trace', 'psychic', 'report'] as const) {
      const reach = reachOf(world, hamletId, trace(channel, 0.6));
      assert.equal(reach.intensity, 0.6, `${channel} 이 차폐로 깎였다`);
    }
  });

  test('적히지 않은 차폐는 가려지지 않은 것이다', () => {
    assert.equal(coverOf(world, hamletId), 0);
    assert.equal(coverOf(world, canyonId), 0.4);
  });
});

describe('R3-a 감쇠표 — S0-b 의 문장을 값으로 옮긴 것이다', () => {
  const report = checkAttenuation();

  test('통로 6종이 전부 차폐 앞에서의 몫을 갖는다', () => {
    assert.equal(report.complete, true, attenuationVerdict(report));
    assert.deepEqual(report.violations, []);
    for (const channel of PHENOMENON_CHANNELS) {
      assert.notEqual(coverResistance(channel), null, `${channel} 의 감쇠가 없다`);
    }
  });

  test('빛이 가장 약하고 소리가 그다음이며 나머지 넷은 무관하다', () => {
    assert.equal(report.byChannel['light'], 1);
    assert.equal(report.byChannel['sound'], 0.5);
    assert.deepEqual([...report.immune].sort(), ['psychic', 'report', 'smell', 'trace']);
  });

  test('값마다 근거가 붙는다 — 지어낸 값이 아니라 옮긴 값이다', () => {
    for (const entry of COVER_RESISTANCES) {
      assert.ok(entry.note.includes('S0-b'), `${entry.channel} 의 근거가 S0-b 를 가리키지 않는다`);
    }
    assert.deepEqual(report.unsourced, []);
  });

  test('통로 하나를 빠뜨리면 걸린다 — 적히지 않은 통로는 판정을 지날 수 없다', () => {
    const missing = checkAttenuation(COVER_RESISTANCES.filter((entry) => entry.channel !== 'smell'));
    assert.equal(missing.complete, false);
    assert.ok(missing.violations.some((violation) => violation.rule === 'bad-attenuation'));
    assert.match(missing.violations[0]?.message ?? '', /냄새/);
  });

  test('1 을 넘는 감쇠는 걸린다 — 가림막이 없던 세기를 만들어 낼 수는 없다', () => {
    const loud: readonly CoverResistance[] = COVER_RESISTANCES.map((entry) =>
      entry.channel === 'light' ? { ...entry, factor: 1.5 } : entry,
    );
    const broken = checkAttenuation(loud);
    assert.ok(broken.violations.some((violation) => violation.rule === 'bad-attenuation'));
  });

  test('통로 6종 밖의 감쇠도 걸린다', () => {
    const alien = checkAttenuation([
      ...COVER_RESISTANCES,
      { channel: 'telepathy' as never, factor: 0, note: '검사용' },
    ]);
    assert.ok(alien.violations.some((violation) => violation.rule === 'unknown-channel'));
  });

  test('두 번 적힌 통로도 걸린다', () => {
    const twice = checkAttenuation([...COVER_RESISTANCES, COVER_RESISTANCES[0] as CoverResistance]);
    assert.ok(twice.violations.some((violation) => violation.rule === 'bad-attenuation'));
  });
});
