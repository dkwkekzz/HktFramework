import {
  PENDING_TERMS,
  type DivergenceCause,
  type DivergenceReport,
  type MeansReport,
  type NeedRanking,
  type NeedScore,
  type NeedSpec,
  type PriorityTrace,
  type ScoreContribution,
  type ScoreTerm,
  type SubjectSample,
  type SubjectView,
  type TemperamentSpec,
} from './types.js';

/**
 * 우선순위 — 원문 「11」 U0 의 대표 검증이 걸려 있는 자리.
 *
 * ## 무엇을 재는가
 *
 * 세계 설계 원본 9장은 활성도를 이렇게 적는다.
 *
 * ```text
 * A(v) = N(v) + V(v) + T(v) + M(v) + R(v) + F(v) * C(v) - Risk(v) - Taboo(v)
 * ```
 *
 * U0 이 재는 것은 **앞의 셋뿐**이다.
 *
 * | 항 | 무엇 | 누가 |
 * |---|---|---|
 * | N | 현재 욕구의 긴급도 | U0 — 몸에서 올라온 수위 |
 * | V | 가치관과의 일치 | U0 |
 * | T | 성격과의 일치 | U0 |
 * | M | 관련 기억 | U3 |
 * | R | 대상과의 관계 | U3 |
 * | F · C | 행동 가능성 · 비용 | G2 · G3 |
 * | Risk · Taboo | 위험 · 금기 | G3 |
 *
 * 나머지 항을 0 으로 슬쩍 채워 넣지 않는다. 0 을 넣으면 "이미 다 쟀다"로 읽히고, 뒤에 오는
 * 모듈은 자기 자리가 비어 있다는 것을 모른다. `NeedRanking.pending` 이 그 이름을 들고 있다.
 *
 * ## 왜 저장소를 받지 않는가
 *
 * 이 파일의 어느 함수도 `EntityStore` 를 인자로 받지 않는다. 받을 수 있게 열어 두면 언젠가
 * "이 판정만 세계를 한 번 들여다보면 쉬운데" 하는 자리가 생기고, 그 순간 GI-02 가 무너진다.
 * 주체가 볼 수 있는 것은 `SubjectView` 가 전부다.
 */

/** 점수와 확률의 자릿수. 두 곳에서 다르게 자르면 해시가 흔들린다. */
const PRECISION = 4;

export function round(value: number): number {
  const scale = 10 ** PRECISION;
  // -0 이 나오면 JSON 에서 `-0` 으로 굳어 해시가 갈린다.
  const rounded = Math.round(value * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** 무게 표 하나를 주체의 상태에 대어 한 항을 만든다. */
function term(
  id: ScoreTerm['id'],
  label: string,
  weights: Record<string, number>,
  levels: Record<string, number>,
): ScoreTerm {
  const contributions: ScoreContribution[] = Object.keys(weights)
    .sort()
    .map((source) => {
      const weight = weights[source] ?? 0;
      const level = levels[source] ?? 0;
      return { source, weight, level, product: round(weight * level) };
    });
  return {
    id,
    label,
    value: round(contributions.reduce((sum, contribution) => sum + contribution.product, 0)),
    contributions,
  };
}

/** 이 욕구를 감당할 수단이 손에 있는가 — 표시일 뿐 점수가 아니다. */
export function meansFor(view: SubjectView, need: NeedSpec): MeansReport {
  const capabilities = need.capabilityIds.filter((id) => view.capabilities.includes(id)).sort();
  const resources: Record<string, number> = {};
  for (const id of [...need.resourceIds].sort()) {
    const amount = view.resources[id] ?? 0;
    if (amount > 0) resources[id] = amount;
  }
  return {
    capable: capabilities.length > 0,
    provisioned: Object.keys(resources).length > 0,
    capabilities,
    resources,
  };
}

/**
 * 선택의 온도 (원본 9장).
 *
 * 순위를 바꾸지 않고 **간격을 얼마나 크게 느끼는가**를 바꾼다. 충동적이거나 겁에 질린 주체는
 * 온도가 높아 1위와 2위가 비슷해 보이고, 엄격한 주체는 1위 하나만 또렷하다.
 */
export function temperatureOf(view: SubjectView, temperament: TemperamentSpec): number {
  let value = temperament.base;
  for (const [trait, weight] of Object.entries(temperament.traitWeights).sort()) {
    value += weight * (view.traits[trait] ?? 0);
  }
  for (const [emotion, weight] of Object.entries(temperament.emotionWeights).sort()) {
    value += weight * (view.emotions[emotion] ?? 0);
  }
  return round(Math.max(temperament.floor, value));
}

/**
 * 욕구를 재어 순서를 낸다.
 *
 * 동점은 욕구 id 오름차순으로 깬다 — 순서가 흔들리면 같은 세계가 다르게 굴러간다(GI-12).
 */
export function rankNeeds(
  view: SubjectView,
  book: readonly NeedSpec[],
  temperament: TemperamentSpec,
): NeedRanking {
  const temperature = temperatureOf(view, temperament);

  const scored = book
    .map((need) => {
      const urgency = round(view.needs[need.id] ?? 0);
      const valueTerm = term('V', '가치관과의 일치', need.valueWeights, view.values);
      const traitTerm = term('T', '성격과의 일치', need.traitWeights, view.traits);
      const urgencyTerm: ScoreTerm = {
        id: 'N',
        label: '현재 욕구의 긴급도',
        value: urgency,
        contributions: [{ source: need.id, weight: 1, level: urgency, product: urgency }],
      };
      return {
        needId: need.id,
        title: need.title,
        activation: round(urgency + valueTerm.value + traitTerm.value),
        urgency,
        valueFit: valueTerm.value,
        traitFit: traitTerm.value,
        terms: [urgencyTerm, valueTerm, traitTerm],
        means: meansFor(view, need),
      };
    })
    .sort((left, right) =>
      left.activation === right.activation
        ? left.needId < right.needId
          ? -1
          : 1
        : right.activation - left.activation,
    );

  const probabilities = softmax(
    scored.map((entry) => entry.activation),
    temperature,
  );

  const scores: NeedScore[] = scored.map((entry, index) => ({
    ...entry,
    probability: probabilities[index] ?? 0,
    rank: index + 1,
  }));

  return {
    subjectId: view.id,
    kind: view.kind,
    temperature,
    scores,
    order: scores.map((score) => score.needId),
    top: scores[0]?.needId ?? null,
    activated: scores.filter((score) => score.activation > 0).map((score) => score.needId),
    pending: PENDING_TERMS,
  };
}

/**
 * Softmax (원본 9장).
 *
 * 가장 큰 값을 빼고 지수를 취한다 — 활성도가 크면 `exp` 가 무한대로 넘쳐 확률이 전부 `NaN` 이
 * 되고, 그러면 해시도 판정도 함께 무너진다. 빼기는 결과를 바꾸지 않는다.
 *
 * **U0 은 여기서 뽑지 않는다.** 확률을 내보이기만 하고, 하나를 고르는 것은 G3 의 몫이다.
 * 뽑으려면 난수가 필요하고, 난수는 V2 의 결정적 시드를 거쳐야 한다.
 */
export function softmax(values: readonly number[], temperature: number): number[] {
  if (values.length === 0) return [];
  const peak = values.reduce((best, value) => (value > best ? value : best), values[0] as number);
  const weights = values.map((value) => Math.exp((value - peak) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return values.map(() => round(1 / values.length));

  // 반올림 뒤에도 합이 1 이 되도록 마지막 칸에서 잔돈을 맞춘다.
  const shares = weights.map((weight) => round(weight / total));
  const drift = round(1 - shares.reduce((sum, share) => sum + share, 0));
  const last = shares.length - 1;
  shares[last] = round((shares[last] as number) + drift);
  return shares;
}

/**
 * 원문 「11」 끝의 `DecisionTrace` 중 U0 이 채울 수 있는 칸.
 *
 * 없는 칸을 지어내지 않고 **누구의 것인지 이름으로** 남긴다.
 */
export function traceOf(sample: SubjectSample, subjectId: string): PriorityTrace {
  const ranking = sample.rankings[subjectId];
  const candidateGoalScores: Record<string, number> = {};
  for (const score of ranking?.scores ?? []) candidateGoalScores[score.needId] = score.activation;
  return {
    subjectId,
    activatedNeedIds: ranking?.activated ?? [],
    candidateGoalScores,
    pendingFields: [
      'perceivedPhenomenonIds — U1 지각',
      'relevantMemoryIds — U3 기억',
      'candidateActionScores — G2 가능성 그래프',
      'selectedActionId — G3 목적·행동 선택',
      'rejectedReasons — G3',
    ],
  };
}

/**
 * 두 주체를 나란히 놓는다 — 대표 검증이 읽는 값.
 *
 * "같은 배고픔인데 순위가 다르다"를 말하려면 **같음을 먼저 증명해야** 한다. 그래서 이 보고는
 * 순위를 비교하기 전에 욕구 수위가 한 칸도 다르지 않은지부터 판정한다.
 */
export function compareSubjects(sample: SubjectSample, a: string, b: string): DivergenceReport {
  const left = sample.views[a];
  const right = sample.views[b];
  const rankingA = sample.rankings[a];
  const rankingB = sample.rankings[b];
  const sameNeeds =
    left !== undefined && right !== undefined && JSON.stringify(left.needs) === JSON.stringify(right.needs);

  const causes: DivergenceCause[] = [];
  for (const score of rankingA?.scores ?? []) {
    const other = rankingB?.scores.find((entry) => entry.needId === score.needId);
    if (!other) continue;
    for (const termA of score.terms) {
      if (termA.id === 'N') continue;
      const termB = other.terms.find((entry) => entry.id === termA.id);
      if (!termB) continue;
      for (const contribution of termA.contributions) {
        const mirror = termB.contributions.find((entry) => entry.source === contribution.source);
        const gap = round(contribution.product - (mirror?.product ?? 0));
        if (gap === 0) continue;
        causes.push({
          needId: score.needId,
          kind: termA.id === 'V' ? 'value' : 'trait',
          source: contribution.source,
          gap,
        });
      }
    }
  }
  causes.sort((first, second) =>
    Math.abs(first.gap) === Math.abs(second.gap)
      ? first.needId < second.needId
        ? -1
        : first.needId > second.needId
          ? 1
          : first.source < second.source
            ? -1
            : 1
      : Math.abs(second.gap) - Math.abs(first.gap),
  );

  const orderA = rankingA?.order ?? [];
  const orderB = rankingB?.order ?? [];
  return {
    a,
    b,
    sameNeeds,
    sharedNeeds: sameNeeds ? { ...(left?.needs ?? {}) } : {},
    orderA,
    orderB,
    topA: rankingA?.top ?? null,
    topB: rankingB?.top ?? null,
    diverged: sameNeeds && orderA.length > 0 && JSON.stringify(orderA) !== JSON.stringify(orderB),
    causes,
  };
}
