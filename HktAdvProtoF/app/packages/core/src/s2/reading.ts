// S2-a 해석 — 원문 S2 의 첫째 낱말, "같은 종이라도 문화에 따라 다른 **해석**".
//
// S0-b·S1-b 는 감각을 "감지하는가" 까지만 답하게 두었다. 사냥꾼의 눈이 붉은 빛을 300m 에서
// 잡는다는 것은 종의 사실이고, 같은 종의 둘은 언제나 같은 것을 본다. 그런데 **본 것을 무엇으로
// 읽는가는 종의 것이 아니다.** 같은 붉은 빛을 사냥 문화는 "장막벌레가 지나간 자국" 으로 읽고,
// 제의 문화는 "어미가 숨을 내쉬었다" 로 읽는다. 그 갈림이 곧 문화다.
//
// 읽기는 진실이 아니다. 읽기가 낳는 것은 O1 `Claim` — **주체가 참이라 여기는 것**이고,
// O1 이 이미 못박아 둔 대로 확신 1 도 틀릴 수 있다. 세계는 실제(State)를 따로 갖고 있으므로,
// 읽기가 실제와 어긋나면 그 어긋남이 그대로 남는다 (O1 장면의 마비독 ↔ 치유 효과와 같은 자리).
//
// 여기서 S1 과 맞물리는 관문이 하나 열린다. **문화는 종을 넘어서지 못한다.**
// 의념 잔향을 읽는 문화를 그것을 감지하지 못하는 종에게 씌우면, 그 개체는 평생 그 읽기를
// 쓰지 못한다 — 그것은 문화가 아니라 글자다. 그래서 읽기의 통로는 반드시 종이 여는 통로여야 한다.

import { deterministicId, type Id } from '../v1/id.ts';
import {
  PHENOMENON_CHANNELS,
  type PhenomenonChannel,
} from '../o1/operation.ts';
import type { Claim } from '../o1/relation.ts';
import type { SenseSpec } from '../s1/senses.ts';
import { violateCulture, type CultureRef, type CultureViolation } from './violation.ts';

/** 읽기가 행동을 어느 쪽으로 미는가 — P 계층 목적의 방향이 여기서 시작된다. */
export const READING_STANCES = [
  'approach', // 다가간다 — 사냥감의 자국이면 쫓는다
  'avoid', // 물러난다 — 어미의 숨이면 엎드린다
  'observe', // 지켜본다 — 판단을 미룬다
] as const;
export type ReadingStance = (typeof READING_STANCES)[number];

/** 방향 3종을 사람이 읽는 한 마디로. */
export const STANCE_LABELS: Readonly<Record<ReadingStance, string>> = {
  approach: '다가간다',
  avoid: '물러난다',
  observe: '지켜본다',
};

/** 문화가 현상 하나를 무엇으로 읽는가 — 개체의 Claim 이 될 틀. */
export interface ReadingRule {
  /** 무엇을 통해 오는가 — O1 현상 통로 6종. 종이 여는 통로여야 한다 */
  readonly channel: PhenomenonChannel;
  /** 무엇을 읽는가 — 세계의 표식 이름 (`붉은 빛`). 개체가 읽을 때 실제 대상 ID 가 채워진다 */
  readonly sign: string;
  /** 무엇이라고 읽는가 — Claim.assertion 이 된다 */
  readonly assertion: string;
  /** 얼마나 확신하는가 0 초과 1 이하 — 확신 1 도 틀릴 수 있다 (O1) */
  readonly confidence: number;
  /** 이 읽기가 행동을 어느 쪽으로 미는가 */
  readonly stance: ReadingStance;
}

/** 읽기 하나를 사람이 읽는 한 줄로. */
export function readingLabel(reading: ReadingRule): string {
  return `${reading.channel}:${reading.sign}`;
}

/** 읽기 하나를 한 문장으로 — 문화 카드용. */
export function readingSentence(reading: ReadingRule): string {
  return `${reading.sign} → "${reading.assertion}" (${STANCE_LABELS[reading.stance]}, 확신 ${String(reading.confidence)})`;
}

/**
 * 문화의 읽기를 개체의 믿음으로 찍어 낸다 — 여기서 문화가 O1 Claim 이 된다.
 * 빈칸 둘이 채워진다: 누가 믿는가(holderId), 무엇에 대한 믿음인가(aboutId).
 * 같은 문화·같은 주체·같은 대상이면 언제나 같은 믿음이다 (V1 태도 그대로).
 */
export function readingClaim(
  cultureId: Id,
  reading: ReadingRule,
  holderId: Id,
  aboutId: Id,
  sourceIds: readonly Id[] = [],
): Claim {
  return {
    kind: 'Claim',
    id: deterministicId('claim', cultureId, holderId, aboutId, readingLabel(reading)),
    holderId,
    aboutId,
    assertion: reading.assertion,
    confidence: reading.confidence,
    sourceIds,
  };
}

/** 두 문화가 같은 표식을 읽는 자리 — 무엇을 두고 갈리는가. */
export interface ReadingDivergence {
  readonly channel: PhenomenonChannel;
  readonly sign: string;
  readonly left: ReadingRule;
  readonly right: ReadingRule;
  /** 읽은 내용이 다른가 — 같으면 갈림이 아니다 */
  readonly differs: boolean;
}

/**
 * 두 읽기 묶음이 **같은 표식을 두고** 어디서 갈리는가.
 * 문화가 개체를 가르는 것은 남이 못 보는 것을 보아서가 아니라 같은 것을 다르게 읽어서다 —
 * 그래서 겹치는 표식만 센다.
 */
export function divergences(
  left: readonly ReadingRule[],
  right: readonly ReadingRule[],
): readonly ReadingDivergence[] {
  const out: ReadingDivergence[] = [];
  for (const one of left) {
    const other = right.find(
      (candidate) => candidate.channel === one.channel && candidate.sign === one.sign,
    );
    if (other === undefined) continue;
    out.push({
      channel: one.channel,
      sign: one.sign,
      left: one,
      right: other,
      differs: one.assertion !== other.assertion || one.stance !== other.stance,
    });
  }
  return out;
}

/** 종이 여는 통로 — 읽기가 딛고 설 수 있는 바닥. */
export function sensedChannels(senses: readonly SenseSpec[]): readonly PhenomenonChannel[] {
  return [...new Set(senses.map((sense) => sense.channel))];
}

/**
 * 읽기 묶음이 온전한가 — 그리고 이 종에게 얹힐 수 있는가.
 * `senses` 를 넘기지 않으면 종과의 대조는 건너뛴다 (역할의 읽기를 문화만으로 볼 때).
 */
export function checkReadings(
  culture: CultureRef,
  readings: readonly ReadingRule[],
  senses: readonly SenseSpec[] | null,
  out: CultureViolation[],
  base = '$.readings',
): void {
  const seen = new Set<string>();
  const open = senses === null ? null : sensedChannels(senses);

  for (const [index, reading] of readings.entries()) {
    const path = `${base}[${String(index)}]`;

    if (!PHENOMENON_CHANNELS.includes(reading.channel)) {
      violateCulture(
        out,
        culture,
        'unknown-channel',
        `${path}.channel`,
        `현상 통로 6종 밖으로 읽는다 — ${JSON.stringify(reading.channel)}. [${PHENOMENON_CHANNELS.join(' ')}] 중 하나여야 한다`,
      );
      continue;
    }

    if (reading.sign === '') {
      violateCulture(
        out,
        culture,
        'signless-reading',
        `${path}.sign`,
        '무엇을 읽는지 적지 않았다 — 표식 없는 읽기는 어떤 현상에도 걸리지 않는다',
      );
      continue;
    }

    const key = readingLabel(reading);
    if (seen.has(key)) {
      violateCulture(
        out,
        culture,
        'duplicate-reading',
        `${path}.sign`,
        `${key} 를 두 가지로 읽는다 — 한 문화 안에서 같은 표식은 하나로 읽힌다. 다르게 읽는 것은 다른 문화다`,
      );
      continue;
    }
    seen.add(key);

    if (reading.assertion === '') {
      violateCulture(
        out,
        culture,
        'empty-assertion',
        `${path}.assertion`,
        `${reading.sign} 를 무엇으로 읽는지 적지 않았다 — 내용 없는 읽기는 개체에게 믿음을 주지 못한다`,
      );
    }
    if (!(reading.confidence > 0) || reading.confidence > 1) {
      violateCulture(
        out,
        culture,
        'bad-confidence',
        `${path}.confidence`,
        `확신은 0 초과 1 이하여야 한다 — ${String(reading.confidence)}. 0 이면 믿지 않는 것이고, 믿지 않는 읽기는 행동을 밀지 못한다`,
      );
    }
    if (!READING_STANCES.includes(reading.stance)) {
      violateCulture(
        out,
        culture,
        'bad-stance',
        `${path}.stance`,
        `[${READING_STANCES.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(reading.stance)}`,
      );
    }

    // 문화는 종을 넘어서지 못한다 — 이 관문이 S2 를 S1 위에 묶는다.
    if (open !== null && !open.includes(reading.channel)) {
      violateCulture(
        out,
        culture,
        'unsensed-reading',
        `${path}.channel`,
        `이 종은 ${reading.channel} 통로를 열지 않는다 — 감지하지 못하는 것을 읽을 수는 없다. 문화는 종 위에 얹히지 종을 대신하지 않는다`,
      );
    }
  }
}

/** 문화 전체의 읽기가 비어 있지 않은가 — 문화 자체에만 묻는다 (역할은 덧대는 것이므로 비어도 된다). */
export function checkReadingsPresent(
  culture: CultureRef,
  readings: readonly ReadingRule[],
  out: CultureViolation[],
  base = '$.readings',
): void {
  if (readings.length > 0) return;
  violateCulture(
    out,
    culture,
    'unreadable-culture',
    base,
    '읽는 것이 없는 문화는 같은 세계를 남과 똑같이 본다 — 아무것도 가르지 못하는 것은 문화가 아니다',
  );
}

/** 역할의 읽기가 문화의 읽기를 덮는다 — 같은 표식이면 역할이 이긴다. */
export function mergeReadings(
  base: readonly ReadingRule[],
  overlay: readonly ReadingRule[],
): readonly ReadingRule[] {
  const out = base.filter(
    (reading) =>
      !overlay.some(
        (over) => over.channel === reading.channel && over.sign === reading.sign,
      ),
  );
  return [...out, ...overlay];
}

/** 읽기를 한 줄로 접는다 — 문화 카드용. */
export function readingSummary(readings: readonly ReadingRule[]): string {
  if (readings.length === 0) return '읽는 것이 없다';
  return readings.map((reading) => readingSentence(reading)).join(' · ');
}
