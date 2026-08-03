// R4-a 단위 테스트 — 통로 하나에서 후보가 서고, 후보는 진실보다 좁지 않다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { PHENOMENON_CHANNELS } from '../../src/o1/index.ts';
import { ACTION_ATOMS } from '../../src/p0/index.ts';
import { LEAK_CHANNELS, ambiguityOf, atomsMoving, type WorldPhenomenon } from '../../src/r2/index.ts';
import type { Percept } from '../../src/r3/index.ts';
import {
  CHANNEL_GUESSES,
  candidatesOf,
  checkCandidateCoverage,
  checkGuessFloor,
  checkGuesses,
  coversAtom,
  guessFor,
  guessOf,
  guessVerdict,
  spreadOf,
  type BeliefViolation,
} from '../../src/r4/index.ts';

const subjectId = deterministicId('subject', 'person', '몰이꾼 04');
const canyonId = deterministicId('entity', 'place', '협곡');

const perceptOf = (overrides: Partial<Percept> = {}): Percept => ({
  id: deterministicId('percept', subjectId, '자국'),
  subjectId,
  phenomenonId: deterministicId('phenomenon', '자국'),
  channel: 'trace',
  intensity: 0.6,
  placeId: canyonId,
  distance: 0,
  atTick: 415,
  ambiguity: 0.73,
  ...overrides,
});

const rulesOf = (violations: readonly BeliefViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R4-a 짐작의 후보 — 통로가 정한다', () => {
  test('후보는 통로 → 자리 → 원자 두 걸음으로 나온다 — R4 가 세는 것이 아니다', () => {
    for (const guess of CHANNEL_GUESSES) {
      const slots = LEAK_CHANNELS.filter((leak) => leak.channels.includes(guess.channel));
      const atoms = new Set(slots.flatMap((leak) => atomsMoving(leak.slot)));
      assert.equal(guess.slots.length, slots.length, `${guess.channel} 의 자리 수`);
      assert.deepEqual(
        [...guess.candidates].sort(),
        [...atoms].sort(),
        `${guess.channel} 의 후보는 그 자리들을 움직이는 원자 전부다`,
      );
    }
  });

  test('통로 6종이 전부 후보를 갖는다', () => {
    const report = checkGuesses();
    assert.equal(report.channels, PHENOMENON_CHANNELS.length);
    assert.equal(report.complete, true, guessVerdict(report));
    assert.equal(report.violations.length, 0);
  });

  test('소리는 원자 하나를 가리킨다 — 들은 자는 무엇이 있었는지 안다', () => {
    const sound = guessFor('sound');
    assert.notEqual(sound, null);
    assert.deepEqual(sound?.candidates, ['destroy']);
    assert.equal(sound?.spread, 0);
    assert.equal(checkGuesses().sharp.includes('sound'), true);
    assert.match(sound?.note ?? '', /하나를 가리킨다/);
  });

  test('자국과 냄새는 열둘을 가리킨다 — 누군가 무언가 했다는 것만 말한다', () => {
    assert.equal(guessFor('trace')?.candidates.length, 12);
    assert.equal(guessFor('smell')?.candidates.length, 12);
    const report = checkGuesses();
    assert.deepEqual([...report.vague].sort(), ['smell', 'trace']);
  });

  test('아무 통로로도 짐작되지 않는 원자가 있다 — 소리 없이 지나가는 것들', () => {
    const report = checkGuesses();
    const covered = new Set(CHANNEL_GUESSES.flatMap((guess) => guess.candidates));
    assert.deepEqual(
      report.unguessable,
      ACTION_ATOMS.filter((atom) => !covered.has(atom)),
    );
    // 짐작되지 않는다고 후보표가 틀린 것은 아니다 — 새지 않는 자리만 움직이는 원자가 있을 뿐이다.
    assert.equal(report.complete, true);
  });

  test('애매함 눈금은 R2-b 와 같은 열여섯 자리다', () => {
    assert.equal(spreadOf(1), 0);
    assert.equal(spreadOf(ACTION_ATOMS.length), 1);
    assert.equal(spreadOf(12), ambiguityOf('biological', 'vitality'));
  });

  test('지각의 후보는 통로에서만 나온다 — 자리도 세기도 묻지 않는다', () => {
    const loud = candidatesOf(perceptOf({ intensity: 1 }));
    const faint = candidatesOf(perceptOf({ intensity: 0.01 }));
    assert.deepEqual(loud, faint);
    assert.deepEqual(loud, guessFor('trace')?.candidates);
  });
});

describe('R4-a 후보는 진실보다 좁지 않다', () => {
  test('통로가 센 애매함은 지각이 실어 온 애매함보다 작지 않다', () => {
    const out: BeliefViolation[] = [];
    checkGuessFloor(perceptOf(), out);
    assert.deepEqual(out, []);
  });

  test('짐작이 실제 자리를 몰래 보면 걸린다', () => {
    const out: BeliefViolation[] = [];
    // 보고 통로의 후보는 아홉(넓이 0.53)인데 지각이 애매함 0.73 을 실어 왔다 —
    // 실제 자리가 열둘짜리였다는 뜻이므로 통로 후보가 실제보다 좁다.
    checkGuessFloor(perceptOf({ channel: 'report', ambiguity: 0.73 }), out);
    assert.deepEqual(rulesOf(out), ['guess-narrower-than-trace']);
    assert.match(out[0]?.message ?? '', /몰래 본 것이다/);
  });

  test('6종 밖의 통로로는 짐작하지 못한다', () => {
    const out: BeliefViolation[] = [];
    checkGuessFloor(perceptOf({ channel: 'telepathy' as never }), out);
    assert.deepEqual(rulesOf(out), ['unknown-channel']);
  });

  test('후보가 빈 통로의 지각은 믿음을 세우지 못한다', () => {
    const report = checkGuesses([
      { channel: 'trace', slots: [], candidates: [], spread: 0, note: '빈 통로' },
    ]);
    assert.deepEqual(rulesOf(report.violations), ['blind-channel']);
    assert.equal(report.complete, false);
    assert.match(guessVerdict(report), /후보표가 어긋났다/);
  });
});

describe('R4-a 후보가 실제를 덮는가 (감사에서만 묻는다)', () => {
  const phenomenonOf = (
    channel: WorldPhenomenon['channel'],
    atom: WorldPhenomenon['atom'],
  ): WorldPhenomenon =>
    ({
      kind: 'Phenomenon',
      id: deterministicId('phenomenon', channel, atom),
      channel,
      intensity: 0.6,
      ambiguity: 0.73,
      placeId: canyonId,
      atTick: 415,
      decaysAtTick: null,
      atom,
      actorId: subjectId,
      domain: 'biological',
      holderId: subjectId,
      path: 'vitality',
      effectKind: 'change',
    }) as WorldPhenomenon;

  test('실제 원자가 후보 안에 있으면 아무 말도 남지 않는다', () => {
    const out: BeliefViolation[] = [];
    checkCandidateCoverage(phenomenonOf('trace', 'destroy'), out);
    assert.deepEqual(out, []);
    assert.equal(coversAtom('trace', 'destroy'), true);
  });

  test('후보에 없는 원자가 낸 자국은 아무도 맞힐 수 없다 — 후보 계산이 틀렸다는 뜻이다', () => {
    const out: BeliefViolation[] = [];
    checkCandidateCoverage(phenomenonOf('sound', 'persuade'), out);
    assert.deepEqual(rulesOf(out), ['candidate-miss']);
    assert.match(out[0]?.message ?? '', /통로 → 자리 → 원자 계산이 틀렸다/);
  });

  test('통로 표를 손대면 후보가 따라 움직인다 — 두 곳에 적지 않는다', () => {
    const withoutBroken = guessOf(
      'sound',
      LEAK_CHANNELS.filter((leak) => leak.slot.path !== 'broken'),
    );
    assert.deepEqual(withoutBroken.candidates, []);
    assert.equal(withoutBroken.slots.length, 0);
  });
});
