// R4-a 짐작의 후보 — 읽은 것 하나에서 **무엇이 있었을 수 있는가**.
//
// R3 이 넘긴 지각에는 무엇이 일어났는지가 없다. 있는 것은 통로 하나, 세기 하나, 자리 하나,
// 거리 하나, 그리고 애매함 하나다. 이 중에서 짐작의 재료가 되는 것은 **통로**뿐이다.
//
// 왜 통로인가. 자리가 어느 통로로 새는지(R2-a `LEAK_CHANNELS`)는 **세계의 규칙이지 세계의
// 장부가 아니다** — 부서지는 것은 소리가 나고, 몸이 깎이면 피 냄새가 나고, 사이가 달라진 것은
// 남을 거쳐 온다. 그것은 누구나 알 수 있는 것이고(불이 뜨겁다는 것을 아는 것과 같다), 그래서
// 짐작의 재료로 써도 전지(全知)가 되지 않는다. 반대로 어느 자리가 실제로 움직였는지는 장부이고,
// 그것은 지각에 실리지 않는다(R3-b `truth-leak`).
//
// 그래서 후보는 두 걸음으로 나온다. **둘 다 앞 계층에서 읽어 온다 — R4 가 세는 것이 아니다.**
//
//   ① 통로 → 자리   그 통로로 새는 자리들 (R2-a `LEAK_CHANNELS`)
//   ② 자리 → 원자   그 자리를 움직일 수 있는 원자들 (R2-a `atomsMoving` — P0-b 걸림에서 나온다)
//
// 그러면 통로마다 후보 수가 갈린다. **소리를 들은 자는 무엇이 있었는지 안다** — 소리가 나는
// 자리는 `physical.broken` 하나뿐이고 그 자리를 움직이는 원자는 제거 하나뿐이다. 반대로 자국과
// 냄새는 열둘을 가리켜 누군가 무언가 했다는 것 말고는 말해 주지 않는다(R2-a 가 "가장 흔하고
// 가장 애매한 흔적" 이라 적은 그 자리다).
//
// 여기서 검사 하나가 선다. 후보에서 잰 애매함은 **지각이 실어 온 애매함보다 작을 수 없다.**
// 지각의 애매함은 R2 가 실제로 움직인 자리 하나에서 셌고(`ambiguityOf`), 후보의 애매함은 R4 가
// 통로가 여는 자리 **전부**에서 세기 때문이다 — 통로는 자리보다 넓다. 이것이 뒤집히면 R4 가
// 어딘가에서 진실을 몰래 본 것이다 (`guess-narrower-than-trace`).

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { PHENOMENON_CHANNELS, type PhenomenonChannel } from '../o1/operation.ts';
import { ACTION_ATOMS, atomLabel, slotText, type ActionAtom, type SlotRef } from '../p0/index.ts';
import { LEAK_CHANNELS, atomsMoving, channelLabel, type WorldPhenomenon } from '../r2/index.ts';
import type { Percept } from '../r3/index.ts';
import { violateBelief, type BeliefViolation } from './violation.ts';

/** 열여섯 중 하나만 남길 수 있는 자국이 0, 전부가 남길 수 있는 자국이 1 이 되는 눈금 (R2-b 와 같다). */
const AMBIGUITY_SPAN = ACTION_ATOMS.length - 1;

/** 애매함 눈금 — 후보 수 하나를 0~1 로 옮긴다. R2-b `ambiguityOf` 가 쓰는 것과 같은 눈금이다. */
export function spreadOf(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1, Math.max(0, (count - 1) / AMBIGUITY_SPAN));
}

/** 통로 하나가 열어 주는 짐작 — 어느 자리에서 날 수 있고, 그 자리를 무엇이 움직이는가. */
export interface ChannelGuess {
  readonly channel: PhenomenonChannel;
  /** 그 통로로 새는 자리들 (R2-a) */
  readonly slots: readonly SlotRef[];
  /** 그 자리들을 움직일 수 있는 원자들 — 이것이 후보다 */
  readonly candidates: readonly ActionAtom[];
  /** 후보가 얼마나 넓은가 0~1 — 0 이면 그 통로가 원자 하나를 가리킨다 */
  readonly spread: number;
  /** 사람이 읽는 한 줄 — 손으로 적지 않고 값에서 세운다 */
  readonly note: string;
}

/** 통로 하나의 짐작을 세운다 — 통로 → 자리 → 원자. */
export function guessOf(
  channel: PhenomenonChannel,
  leaks: readonly (typeof LEAK_CHANNELS)[number][] = LEAK_CHANNELS,
): ChannelGuess {
  const slots = leaks
    .filter((leak) => leak.channels.includes(channel))
    .map((leak) => leak.slot);
  const candidates = stableSort(
    [...new Set(slots.flatMap((slot) => atomsMoving(slot)))],
    (left, right) => ACTION_ATOMS.indexOf(left) - ACTION_ATOMS.indexOf(right),
  );
  const spread = spreadOf(candidates.length);
  return {
    channel,
    slots: stableSort([...slots], (left, right) => compareStrings(slotText(left), slotText(right))),
    candidates,
    spread,
    note:
      candidates.length === 0
        ? `${channelLabel(channel)} 로 온 것은 자리 ${String(slots.length)} 곳을 여는데 그 자리를 움직이는 원자가 아직 하나도 없다`
        : candidates.length === 1
          ? `${channelLabel(channel)} 로 온 것은 ${atomLabel(candidates[0] as ActionAtom)} 하나를 가리킨다 — 들은 자는 무엇이 있었는지 안다`
          : `${channelLabel(channel)} 로 온 것은 자리 ${String(slots.length)} 곳에서 날 수 있고, 그 자리를 움직이는 원자가 ${String(candidates.length)} 이다`,
  };
}

/** 통로 6종 전부의 짐작 — O1 이 연 순서 그대로다. */
export const CHANNEL_GUESSES: readonly ChannelGuess[] = PHENOMENON_CHANNELS.map((channel) =>
  guessOf(channel),
);

/** 그 통로의 짐작. 6종 밖이면 null. */
export function guessFor(channel: PhenomenonChannel): ChannelGuess | null {
  return CHANNEL_GUESSES.find((guess) => guess.channel === channel) ?? null;
}

/** 읽은 것 하나의 후보 원자들 — 지각이 아는 것은 통로뿐이므로 통로에서만 나온다. */
export function candidatesOf(percept: Percept): readonly ActionAtom[] {
  return guessFor(percept.channel)?.candidates ?? [];
}

/** 그 통로가 그 원자를 후보로 갖는가. */
export function coversAtom(channel: PhenomenonChannel, atom: ActionAtom): boolean {
  return guessFor(channel)?.candidates.includes(atom) === true;
}

/** 후보표 검사 결과. */
export interface GuessReport {
  readonly channels: number;
  /** 통로별 후보 수 */
  readonly byChannel: Readonly<Record<string, number>>;
  /** 원자 하나를 가리키는 통로들 — 들은 자는 무엇이 있었는지 안다 */
  readonly sharp: readonly PhenomenonChannel[];
  /** 후보가 가장 넓은 통로들 */
  readonly vague: readonly PhenomenonChannel[];
  /** 열여섯 중 어느 통로로도 후보가 되지 못하는 원자들 — 소리 없이 지나가는 것들 */
  readonly unguessable: readonly ActionAtom[];
  readonly violations: readonly BeliefViolation[];
  readonly complete: boolean;
}

/**
 * 후보표가 온전한가.
 *
 * ① 통로 6종이 전부 후보를 갖는가 — 후보가 없는 통로로 온 지각은 아무것도 짐작하지 못한다.
 *    그런 통로가 있다면 R2-a 가 그 통로에 자리를 걸어 두고 원자가 아직 그 자리를 못 움직이는
 *    것이므로(R2 `aheadOfAtoms`), 빠뜨림이 아니라 아직 오지 않은 계층의 자리다. 다만 **그런
 *    통로가 하나라도 있으면 그 통로의 지각은 믿음으로 서지 못하므로** 값으로 드러낸다.
 * ② 6종 밖의 통로가 표에 있는가.
 */
export function checkGuesses(
  guesses: readonly ChannelGuess[] = CHANNEL_GUESSES,
): GuessReport {
  const violations: BeliefViolation[] = [];

  for (const [index, guess] of guesses.entries()) {
    const at = `$.guesses[${String(index)}]`;
    if (!(PHENOMENON_CHANNELS as readonly string[]).includes(guess.channel)) {
      violateBelief(
        violations,
        '',
        'unknown-channel',
        `${at}.channel`,
        `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(guess.channel)} 로 짐작하려 한다`,
      );
      continue;
    }
    if (guess.candidates.length === 0) {
      violateBelief(
        violations,
        '',
        'blind-channel',
        `${at}.candidates`,
        `${channelLabel(guess.channel)} 로 온 것에는 후보가 하나도 없다 — 그 통로의 지각은 아무 믿음도 세우지 못한다`,
      );
    }
  }

  const covered = new Set(guesses.flatMap((guess) => guess.candidates));
  const widest = Math.max(0, ...guesses.map((guess) => guess.candidates.length));

  return {
    channels: guesses.length,
    byChannel: Object.fromEntries(guesses.map((guess) => [guess.channel, guess.candidates.length])),
    sharp: guesses.filter((guess) => guess.candidates.length === 1).map((guess) => guess.channel),
    vague: guesses
      .filter((guess) => guess.candidates.length === widest && widest > 0)
      .map((guess) => guess.channel),
    unguessable: ACTION_ATOMS.filter((atom) => !covered.has(atom)),
    violations,
    complete: violations.length === 0,
  };
}

/**
 * 지각 하나를 짐작할 수 있는가 — **후보가 진실보다 좁지 않은가**.
 *
 * 지각의 애매함은 실제로 움직인 자리 하나에서 세어 온 값이고(R2-b), 후보의 애매함은 통로가
 * 여는 자리 전부에서 센 값이다. 통로는 자리보다 넓으므로 후보 쪽이 언제나 같거나 넓다.
 * 뒤집히면 R4 가 어딘가에서 실제 자리를 보고 후보를 깎았다는 뜻이다.
 */
export function checkGuessFloor(
  percept: Percept,
  out: BeliefViolation[],
  path = '$.percept',
): void {
  const guess = guessFor(percept.channel);
  if (guess === null) {
    violateBelief(
      out,
      percept.subjectId,
      'unknown-channel',
      `${path}.channel`,
      `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(percept.channel)} 의 지각을 짐작하려 한다`,
    );
    return;
  }
  if (guess.candidates.length === 0) {
    violateBelief(
      out,
      percept.subjectId,
      'blind-channel',
      `${path}.channel`,
      `${channelLabel(percept.channel)} 로 온 것에는 후보가 없다 — 읽었으나 무엇이었는지 짐작할 수 없다`,
    );
    return;
  }
  if (guess.spread + Number.EPSILON < percept.ambiguity) {
    violateBelief(
      out,
      percept.subjectId,
      'guess-narrower-than-trace',
      `${path}.ambiguity`,
      `통로가 센 애매함 ${guess.spread.toFixed(2)} 이 지각이 실어 온 애매함 ${percept.ambiguity.toFixed(2)} 보다 좁다 — 통로는 자리보다 넓으므로 이것이 뒤집혔다면 짐작이 실제 자리를 몰래 본 것이다`,
    );
  }
}

/**
 * 후보가 실제를 덮는가 — **감사에서만 묻는다**(주체는 실제를 볼 수 없다).
 *
 * 흔적을 낸 원자가 그 통로의 후보에 없으면 아무리 잘 짐작해도 맞을 수 없다. 그것은 짐작하는
 * 자의 잘못이 아니라 후보 계산(통로 → 자리 → 원자)이 틀렸다는 뜻이므로 위반이다.
 */
export function checkCandidateCoverage(
  phenomenon: WorldPhenomenon,
  out: BeliefViolation[],
  path = '$.phenomenon',
): void {
  if (coversAtom(phenomenon.channel, phenomenon.atom)) return;
  violateBelief(
    out,
    phenomenon.actorId,
    'candidate-miss',
    `${path}.atom`,
    `${channelLabel(phenomenon.channel)} 로 난 자국을 ${atomLabel(phenomenon.atom)} 가 냈는데 그 통로의 후보에 없다 — 아무리 짐작해도 맞을 수 없으므로 통로 → 자리 → 원자 계산이 틀렸다`,
  );
}

/** 후보표를 한 줄로 접는다 — 터미널·배지용. */
export function guessVerdict(report: GuessReport): string {
  if (!report.complete) {
    return `후보표가 어긋났다 — ${[...new Set(report.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  const sharp = report.sharp.map((channel) => channelLabel(channel)).join('·');
  return `통로 ${String(report.channels)} · 원자 하나를 가리키는 통로 ${sharp === '' ? '없음' : sharp} · 짐작되지 않는 원자 ${String(report.unguessable.length)}`;
}

/** 짐작 하나를 사람이 읽는 한 줄로. */
export function guessLine(guess: ChannelGuess): string {
  return `${guess.note} (넓이 ${guess.spread.toFixed(2)})`;
}
