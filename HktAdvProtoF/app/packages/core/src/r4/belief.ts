// R4-b 믿음과 확신 — 후보 중 무엇으로 읽고, 얼마나 확신하는가.
//
// R4-a 가 세운 후보는 **누구에게나 같다**. 자국으로 온 것은 누가 보든 열둘 중 하나이고, 그것은
// 세계의 규칙이 정한 것이지 보는 자가 정한 것이 아니다. 그런데 원문 §6.1 이 보인 장면은 그 다음이다
// — 같은 현상을 노련한 사냥꾼과 여행자와 종교인과 연구자가 **다르게 읽는다**.
//
// 그 갈림이 어디서 오는가. R4 가 새로 정하는 것은 여기 한 줄뿐이다:
//
//   **자기가 낼 수 있는 것으로 읽는다.**
//
// 사냥꾼은 짐승을 쫓아 봤으니 자국을 사냥으로 읽고, 죽이지 않는 사제에게 그 자국은 죽임이 아니다.
// 이 한 줄의 재료도 R4 가 만들지 않는다 — P2 `PossibilityGrammar.allowed` 가 이미 "유형이 깔고
// 능력이 얹고 금기가 덜어 낸" 목록을 갖고 있고, R4 는 후보를 그것과 겹칠 뿐이다.
//
// 대가를 숨기지 않는다. **금기가 닫은 원자는 그의 짐작에서도 서지 않으므로, 그 일이 실제로
// 일어났다면 그는 틀린다.** 그것은 이 계층의 결함이 아니라 이 계층이 있는 이유다 — 원문 §6.1 의
// "성스러운 징조다" 가 정확히 그 자리이고, 틀린 믿음이 없으면 R4 는 지연된 전지(全知)일 뿐이다.
//
// 겹침이 하나도 없을 수도 있다(금기가 후보를 다 지운 자리). 그때 믿음이 사라지지는 않는다 —
// **내가 낼 수 있는 무엇도 아니라는 것도 하나의 읽기다.** 후보 전체가 남고 확신은 바닥이 된다.
//
// 확신은 P4-c 와 같은 태도로 잰다: **요소에서 재계산되고, 손으로 고쳐 넣으면 걸린다.**
// 요소는 셋이고 출처가 각각 다르다 — 좁힘(R4 자신) · 세기(R3 지각) · 반복(R4 자신).
// 그리고 **좁힘이 확신의 상한이다**: 열둘 중 하나인 자국을 아무리 진하게, 아무리 여러 번 봐도
// 무엇이었는지 확신할 수는 없다. 여러 번 보면 "무언가 있었다" 가 확실해질 뿐이다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import { classify, type Claim } from '../o1/index.ts';
import type { PhenomenonChannel } from '../o1/operation.ts';
import { ACTION_ATOMS, atomLabel, type ActionAtom } from '../p0/index.ts';
import type { PossibilityGrammar } from '../p2/index.ts';
import { channelLabel } from '../r2/index.ts';
import type { Percept } from '../r3/index.ts';
import { candidatesOf, checkGuessFloor, guessFor, spreadOf } from './guess.ts';
import { violateBelief, type BeliefViolation } from './violation.ts';

/**
 * 믿음에 실려서는 안 되는 이름들 — 지각에도 없던 **세계의 장부** 쪽 필드다 (R3-b `TRUTH_FIELDS` 의 짝).
 *
 * `holderId` 는 여기 없다. R2 흔적에서 그것은 "자리를 지닌 자" 이지만 O1 `Claim` 에서는 "믿는 자"
 * 이기 때문이다 — 같은 이름이 다른 뜻이므로 이름만 보고 막으면 믿음이 제 주인을 못 갖는다.
 */
export const BELIEF_TRUTH_FIELDS = [
  'domain',
  'path',
  'actorId',
  'atom',
  'effectKind',
  'causeEventId',
] as const;

/** 확신을 이루는 요소 하나 — 값과 무게와 **어느 계층에서 왔는가**가 함께 선다. */
export interface ConfidenceFactor {
  readonly key: 'narrowing' | 'intensity' | 'repetition';
  readonly label: string;
  /** 0~1 */
  readonly value: number;
  readonly weight: number;
  /** 어느 계층이 준 값인가 — 셋 중 둘이 R4 자신이라는 것이 값으로 드러난다 */
  readonly source: string;
  readonly note: string;
}

/**
 * 요소별 무게 — **R4 의 선언이다**(원문이 주지 않았다. P4-c 무게표와 같은 처지다).
 *
 * 좁힘이 가장 무겁다: 무엇이었는지가 좁혀지는 것이 확신의 본체이고 나머지 둘은 그 위의 보탬이다.
 * 세기가 다음이다: 진하게 읽은 것은 옅게 스친 것보다 믿을 만하다.
 * 반복이 가장 가볍다: 여러 번 봐도 애매한 것은 애매하다 — 반복이 늘리는 것은 "무언가 있었다"
 * 쪽이지 "무엇이었나" 쪽이 아니다.
 */
export const CONFIDENCE_WEIGHTS: Readonly<Record<ConfidenceFactor['key'], number>> = {
  narrowing: 3,
  intensity: 2,
  repetition: 1,
};

/** 한 주체가 흔적 하나를 읽고 세운 믿음 — O1 `Claim` 에 R4 가 넷을 더한다. */
export interface Belief extends Claim {
  /** 어느 통로로 온 것에 대한 믿음인가 (지각이 실어 온 값) */
  readonly channel: PhenomenonChannel;
  /** 어디서 온 것인가 (지각이 실어 온 값) */
  readonly placeId: Id;
  /** 통로가 연 후보 — 누구에게나 같다 */
  readonly candidates: readonly ActionAtom[];
  /** 그중 자기 문법이 여는 것 — 주체마다 다르다 */
  readonly suspected: readonly ActionAtom[];
  /** 문법이 실제로 좁혔는가. `none` 이면 겹침이 없어 후보 전체가 남았다 */
  readonly narrowedBy: 'grammar' | 'none';
  /** 몇 번 읽었는가 — 처음이 1 이다 */
  readonly observations: number;
  readonly firstTick: Tick;
  readonly lastTick: Tick;
  /** 가장 진하게 읽은 세기 */
  readonly intensity: number;
  /** 확신이 무엇에서 나왔는가 — 점수는 여기서 재계산된다 */
  readonly factors: readonly ConfidenceFactor[];
}

/** 믿음의 id — 유래(믿는 자 · 흔적)에서 나온다 (V1 결정적 ID). */
export function beliefIdOf(subjectId: Id, phenomenonId: Id): Id {
  return deterministicId('claim', subjectId, phenomenonId);
}

/**
 * 후보를 문법으로 좁힌다 — 겹침이 없으면 후보 전체가 남는다(그것도 하나의 읽기다).
 *
 * **후보가 하나뿐이면 문법을 묻지 않는다.** 좁힘은 여럿 중에서 고르는 일이고, 고를 것이 없으면
 * 편향이 낄 자리도 없다 — 부서지는 소리를 들은 사제는 제가 죽이지 않아도 무언가 부서졌다는 것을
 * 안다. 세계의 규칙(자리가 어느 통로로 새는가)은 누구나 알기 때문이다.
 */
export function narrowByGrammar(
  candidates: readonly ActionAtom[],
  grammar: PossibilityGrammar | null,
): { readonly suspected: readonly ActionAtom[]; readonly narrowedBy: Belief['narrowedBy'] } {
  if (candidates.length <= 1) return { suspected: candidates, narrowedBy: 'none' };
  if (grammar === null) return { suspected: candidates, narrowedBy: 'none' };
  const mine = candidates.filter((atom) => grammar.allowed.includes(atom));
  if (mine.length === 0) return { suspected: candidates, narrowedBy: 'none' };
  return { suspected: mine, narrowedBy: 'grammar' };
}

/** 확신의 요소 셋 — 좁힘·세기·반복. 값은 전부 0~1 이다. */
export function confidenceFactors(
  suspected: readonly ActionAtom[],
  intensity: number,
  observations: number,
): readonly ConfidenceFactor[] {
  return [
    {
      key: 'narrowing',
      label: '좁힘',
      value: 1 - spreadOf(suspected.length),
      weight: CONFIDENCE_WEIGHTS.narrowing,
      source: 'R4-a 후보 × P2 문법',
      note: `열여섯 중 ${String(suspected.length)} 로 좁혀졌다 — 확신의 본체이고 동시에 상한이다`,
    },
    {
      key: 'intensity',
      label: '세기',
      value: Math.min(1, Math.max(0, intensity)),
      weight: CONFIDENCE_WEIGHTS.intensity,
      source: 'R3 Percept.intensity',
      note: '거리와 차폐를 지나 실제로 닿은 세기 — 진하게 읽은 것이 더 믿을 만하다',
    },
    {
      key: 'repetition',
      label: '반복',
      value: observations <= 0 ? 0 : 1 - 1 / observations,
      weight: CONFIDENCE_WEIGHTS.repetition,
      source: 'R4-c 재관측 (같은 흔적을 두 번 읽는다)',
      note: `${String(observations)} 번 읽었다 — 늘어나는 것은 "무언가 있었다" 쪽이다`,
    },
  ];
}

/** 요소에서 점수를 다시 센다 — `Σ(값×무게) ÷ Σ무게` (P4-c 와 같은 식). */
export function scoreOf(factors: readonly ConfidenceFactor[]): number {
  const total = factors.reduce((sum, factor) => sum + factor.weight, 0);
  if (total === 0) return 0;
  return factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / total;
}

/** 확신의 상한 — **좁힘을 넘지 못한다**. 열둘 중 하나인 자국은 아무리 봐도 열둘 중 하나다. */
export function confidenceCap(factors: readonly ConfidenceFactor[]): number {
  return factors.find((factor) => factor.key === 'narrowing')?.value ?? 0;
}

/** 요소에서 확신을 센다 — 점수를 상한으로 자른다. */
export function confidenceOf(factors: readonly ConfidenceFactor[]): number {
  return Math.min(scoreOf(factors), confidenceCap(factors));
}

/** 무엇이라고 여기는가 — 손으로 적지 않고 좁힘에서 세운다. */
export function assertionOf(
  channel: PhenomenonChannel,
  suspected: readonly ActionAtom[],
  narrowedBy: Belief['narrowedBy'],
): string {
  const where = channelLabel(channel);
  const names = suspected.map((atom) => atomLabel(atom)).join('·');
  if (suspected.length === 1) {
    // 고를 것이 없다 — 통로가 원자 하나를 가리키면 누구에게나 같은 문장이다.
    return `${where} 로 온 것 — ${names} 다`;
  }
  if (narrowedBy === 'none') {
    return `${where} 로 온 것 — 내가 낼 수 있는 무엇도 아니다. 누군가 ${String(suspected.length)} 중 하나를 했다 (${names})`;
  }
  return `${where} 로 온 것 — 내가 낼 수 있는 ${String(suspected.length)} 중 하나다 (${names})`;
}

/** 믿음 하나를 세운 결과. 던지지 않는다 — 서지 못하면 사유가 남는다. */
export interface BeliefResult {
  readonly belief: Belief | null;
  readonly violations: readonly BeliefViolation[];
}

/**
 * 읽은 것 하나에서 믿음을 세운다.
 *
 * 순서: 짐작할 수 있는가(R4-a) → 후보를 문법으로 좁힌다 → 확신을 요소에서 잰다 → O1 관문.
 * 앞이 무너지면 뒤는 묻지 않는다 — 짐작할 수 없는 지각은 믿음이 되지 않는다.
 */
export function formBelief(
  percept: Percept,
  grammar: PossibilityGrammar | null,
): BeliefResult {
  const violations: BeliefViolation[] = [];

  checkGuessFloor(percept, violations, '$.percept');
  if (violations.length > 0) return { belief: null, violations };

  const candidates = candidatesOf(percept);
  const { suspected, narrowedBy } = narrowByGrammar(candidates, grammar);
  const factors = confidenceFactors(suspected, percept.intensity, 1);

  const belief: Belief = {
    kind: 'Claim',
    id: beliefIdOf(percept.subjectId, percept.phenomenonId),
    holderId: percept.subjectId,
    // 무엇에 대한 믿음인가 — 흔적의 id 다. **체계의 연결이지 주체가 아는 값이 아니다**
    // (R3-b `Percept.phenomenonId` 와 같은 자리이고 같은 이유다).
    aboutId: percept.phenomenonId,
    assertion: assertionOf(percept.channel, suspected, narrowedBy),
    confidence: confidenceOf(factors),
    sourceIds: [percept.id],
    channel: percept.channel,
    placeId: percept.placeId,
    candidates,
    suspected,
    narrowedBy,
    observations: 1,
    firstTick: percept.atTick,
    lastTick: percept.atTick,
    intensity: percept.intensity,
    factors,
  };

  // O1 관문 — 믿음도 다른 원소처럼 존재론을 지난다.
  const classified = classify(belief);
  if (classified.kind !== 'Claim') {
    for (const reason of classified.violations) {
      violateBelief(violations, percept.subjectId, 'unheld-belief', reason.path, reason.message);
    }
    return { belief: null, violations };
  }

  return { belief, violations: [] };
}

/**
 * 같은 흔적을 다시 읽는다 — **새 믿음이 아니라 같은 믿음이 굳는 것이다.**
 *
 * 늘어나는 것은 관측 횟수와 근거이고, 좁힘은 그대로다(다시 봐도 후보는 통로가 정한다).
 * 세기는 가장 진하게 읽은 것을 남긴다 — 가까이서 한 번 본 것이 멀리서 열 번 본 것보다 낫다.
 */
export function reinforce(belief: Belief, percept: Percept): BeliefResult {
  const violations: BeliefViolation[] = [];

  if (percept.subjectId !== belief.holderId) {
    violateBelief(
      violations,
      belief.holderId,
      'foreign-belief',
      '$.percept.subjectId',
      '남이 읽은 것으로 내 믿음을 굳힐 수는 없다 — 남의 말이 근거가 되는 것은 소문이고, 그것은 아직 없다',
    );
    return { belief: null, violations };
  }
  if (percept.phenomenonId !== belief.aboutId) {
    violateBelief(
      violations,
      belief.holderId,
      'unperceived-belief',
      '$.percept.phenomenonId',
      '다른 흔적을 읽은 것으로 이 믿음을 굳힐 수는 없다 — 믿음은 자기가 딛고 선 자국에 매여 있다',
    );
    return { belief: null, violations };
  }

  const observations = belief.observations + 1;
  const intensity = Math.max(belief.intensity, percept.intensity);
  const factors = confidenceFactors(belief.suspected, intensity, observations);
  const sourceIds = belief.sourceIds.includes(percept.id)
    ? belief.sourceIds
    : [...belief.sourceIds, percept.id];

  return {
    belief: {
      ...belief,
      confidence: confidenceOf(factors),
      sourceIds,
      observations,
      firstTick: Math.min(belief.firstTick, percept.atTick),
      lastTick: Math.max(belief.lastTick, percept.atTick),
      intensity,
      factors,
    },
    violations: [],
  };
}

/**
 * 믿음 하나가 온전한가 — **진실을 몰래 보지 않았는가**가 첫 물음이다.
 *
 * 그다음에야 근거가 제 지각인지, 짚은 것이 후보 안인지, 확신이 요소와 맞는지를 묻는다.
 * 던지지 않는다. **틀린 믿음은 여기서 걸리지 않는다** — 빗나간 짐작은 위반이 아니다.
 */
export function checkBelief(
  belief: Belief,
  percepts: readonly Percept[],
  out: BeliefViolation[],
  path = '$.belief',
): void {
  const fields = belief as unknown as Record<string, unknown>;
  const carried = BELIEF_TRUTH_FIELDS.filter((field) => field in fields);
  if (carried.length > 0) {
    violateBelief(
      out,
      belief.holderId,
      'truth-copied',
      path,
      `믿음에 지각에도 없던 ${carried.join(', ')} 가 실렸다 — 짐작하는 자는 무엇이 일어났는지 모르기 때문에 짐작한다. 이것이 새면 R4 는 짐작이 아니라 한 틱 늦은 전지(全知)다`,
    );
  }

  if (belief.holderId === '') {
    violateBelief(
      out,
      '',
      'unheld-belief',
      `${path}.holderId`,
      '믿는 자가 없는 믿음이다 — 믿음은 세계가 아니라 언제나 누군가의 것이다',
    );
  }

  if (belief.sourceIds.length === 0) {
    violateBelief(
      out,
      belief.holderId,
      'unperceived-belief',
      `${path}.sourceIds`,
      '읽은 것 없이 선 믿음이다 — 지금 근거가 될 수 있는 것은 제 지각뿐이고, 남의 말이 근거가 되는 것(소문)은 아직 없다',
    );
  }
  for (const sourceId of belief.sourceIds) {
    const source = percepts.find((percept) => percept.id === sourceId);
    if (source === undefined) {
      violateBelief(
        out,
        belief.holderId,
        'unperceived-belief',
        `${path}.sourceIds`,
        `읽은 적 없는 지각 ${sourceId} 를 근거로 삼았다 — 보지 않고 아는 것은 없다`,
      );
      continue;
    }
    if (source.subjectId !== belief.holderId) {
      violateBelief(
        out,
        belief.holderId,
        'foreign-belief',
        `${path}.sourceIds`,
        '남의 눈으로 읽은 것을 제 근거로 삼았다 — 거치는 주체가 왜곡 지점이 되는 소문은 아직 없다 (R5)',
      );
    }
  }

  const guess = guessFor(belief.channel);
  if (guess === null) {
    violateBelief(
      out,
      belief.holderId,
      'unknown-channel',
      `${path}.channel`,
      `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(belief.channel)} 의 믿음이다`,
    );
  } else {
    const off = belief.suspected.filter((atom) => !guess.candidates.includes(atom));
    if (off.length > 0) {
      violateBelief(
        out,
        belief.holderId,
        'off-candidate-belief',
        `${path}.suspected`,
        `${channelLabel(belief.channel)} 가 열지 않은 ${off.map((atom) => atomLabel(atom)).join('·')} 를 짚었다 — 짐작은 통로가 연 후보 안에서만 선다`,
      );
    }
    const stray = belief.candidates.filter((atom) => !guess.candidates.includes(atom));
    if (stray.length > 0) {
      violateBelief(
        out,
        belief.holderId,
        'off-candidate-belief',
        `${path}.candidates`,
        `후보를 손으로 늘렸다 — ${stray.map((atom) => atomLabel(atom)).join('·')} 는 ${channelLabel(belief.channel)} 로 나지 않는다`,
      );
    }
  }

  if (!Number.isFinite(belief.confidence) || belief.confidence < 0 || belief.confidence > 1) {
    violateBelief(
      out,
      belief.holderId,
      'bad-confidence',
      `${path}.confidence`,
      `확신 ${String(belief.confidence)} 이 설 수 없다 — 0 이상 1 이하여야 한다`,
    );
    return;
  }

  const recomputed = confidenceOf(
    confidenceFactors(belief.suspected, belief.intensity, belief.observations),
  );
  if (Math.abs(recomputed - belief.confidence) > 1e-9) {
    violateBelief(
      out,
      belief.holderId,
      'confidence-drift',
      `${path}.confidence`,
      `확신 ${belief.confidence.toFixed(3)} 이 요소에서 다시 센 ${recomputed.toFixed(3)} 과 다르다 — 확신은 손으로 적는 값이 아니라 좁힘·세기·반복에서 나오는 값이다`,
    );
    return;
  }

  const cap = confidenceCap(belief.factors);
  if (belief.confidence > cap + 1e-9) {
    violateBelief(
      out,
      belief.holderId,
      'overconfident-belief',
      `${path}.confidence`,
      `확신 ${belief.confidence.toFixed(2)} 이 좁힘이 허락한 ${cap.toFixed(2)} 을 넘는다 — ${String(belief.suspected.length)} 중 하나인 것을 아무리 진하게 여러 번 봐도 무엇이었는지 확신할 수는 없다`,
    );
  }
}

/** 믿음 하나를 사람이 읽는 한 줄로 — 터미널·화면이 같은 문장을 쓴다. */
export function beliefLine(belief: Belief): string {
  return `${belief.assertion} · 확신 ${belief.confidence.toFixed(2)} (${String(belief.observations)}회 · 세기 ${belief.intensity.toFixed(2)})`;
}

/** 확신이 어디서 왔는지를 아홉 자리로 편다 — P4-c 가 점수를 펴는 것과 같다. */
export function confidenceTrace(belief: Belief): readonly string[] {
  const lines = belief.factors.map(
    (factor) =>
      `${factor.label} ${factor.value.toFixed(2)} × 무게 ${String(factor.weight)} — ${factor.source}`,
  );
  return [
    ...lines,
    `점수 ${scoreOf(belief.factors).toFixed(3)} → 상한 ${confidenceCap(belief.factors).toFixed(3)} 로 잘린 확신 ${belief.confidence.toFixed(3)}`,
  ];
}

/** 믿음들을 통로·흔적 순으로 세운다 — 순서가 결정적이어야 그림도 해시도 결정적이다. */
export function orderBeliefs(beliefs: readonly Belief[]): readonly Belief[] {
  return stableSort(beliefs, (left, right) =>
    compareStrings(`${left.channel}/${left.aboutId}`, `${right.channel}/${right.aboutId}`),
  );
}

/** 짐작되지 않는 원자들 — 어느 통로로도 후보가 되지 못하는 것들 (R4-a 가 센 것을 그대로 쓴다). */
export function atomsOutsideGuessing(candidates: readonly ActionAtom[]): readonly ActionAtom[] {
  return ACTION_ATOMS.filter((atom) => !candidates.includes(atom));
}
