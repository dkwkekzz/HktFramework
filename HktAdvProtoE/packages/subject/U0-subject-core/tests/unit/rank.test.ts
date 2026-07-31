import { describe, expect, it } from 'vitest';
import {
  compareSubjects,
  meansFor,
  rankNeeds,
  round,
  softmax,
  temperatureOf,
  traceOf,
  SUBJECT_NEEDS,
  TEMPERAMENT,
  type NeedSpec,
  type SubjectSample,
  type SubjectView,
  type TemperamentSpec,
} from '../../src/index.js';

const view = (over: Partial<SubjectView> = {}): SubjectView => ({
  id: 'someone',
  kind: 'person',
  needs: { hunger: 4, duty: 4, safety: 2 },
  values: { duty: 0.5, survival: 0.5, temperance: 0.5 },
  traits: { patient: 0.5, impulsive: 0.5, cautious: 0.5 },
  emotions: { fear: 0, despair: 0 },
  capabilities: [],
  resources: {},
  bodyEntityIds: [],
  ...over,
});

const rank = (over: Partial<SubjectView> = {}, book: NeedSpec[] = SUBJECT_NEEDS) =>
  rankNeeds(view(over), book, TEMPERAMENT);

describe('활성도 — 원본 9장의 N · V · T', () => {
  it('활성도는 언제나 세 항의 합이다', () => {
    for (const score of rank().scores) {
      expect(score.urgency + score.valueFit + score.traitFit).toBeCloseTo(score.activation, 9);
      expect(score.terms.map((term) => term.id)).toEqual(['N', 'V', 'T']);
    }
  });

  it('모든 항이 어느 상태에서 얼마나 왔는지 이름으로 말한다', () => {
    const hunger = rank().scores.find((score) => score.needId === 'hunger');
    const valueTerm = hunger?.terms.find((term) => term.id === 'V');
    expect(valueTerm?.contributions.map((entry) => entry.source)).toEqual(['duty', 'survival', 'temperance']);
    // 0.5 × (2 - 0.5 - 1.5) = 0
    expect(valueTerm?.value).toBe(0);
    for (const contribution of valueTerm?.contributions ?? []) {
      expect(contribution.product).toBeCloseTo(contribution.weight * contribution.level, 9);
    }
  });

  it('N 은 욕구 수위 그대로다 — 가치도 성격도 그것을 지우지 못한다', () => {
    const scores = rank({ needs: { hunger: 9, duty: 0, safety: 0 } }).scores;
    expect(scores.find((score) => score.needId === 'hunger')?.urgency).toBe(9);
  });

  it('주체가 갖지 않은 가치는 0 으로 읽힌다 — 세계를 훔쳐보지 않는다', () => {
    const scores = rank({ values: {} }).scores;
    const valueTerm = scores[0]?.terms.find((term) => term.id === 'V');
    expect(valueTerm?.value).toBe(0);
    expect(valueTerm?.contributions.every((entry) => entry.level === 0)).toBe(true);
  });
});

describe('순서', () => {
  it('활성도 내림차순이고 순위가 1 부터 이어진다', () => {
    const ranking = rank({ values: { duty: 1, survival: 0, temperance: 0 } });
    for (let index = 1; index < ranking.scores.length; index += 1) {
      const previous = ranking.scores[index - 1];
      const current = ranking.scores[index];
      expect(previous?.activation).toBeGreaterThanOrEqual(current?.activation ?? 0);
      expect(current?.rank).toBe((previous?.rank ?? 0) + 1);
    }
    expect(ranking.order).toEqual(ranking.scores.map((score) => score.needId));
    expect(ranking.top).toBe(ranking.order[0]);
  });

  it('동점은 욕구 id 오름차순으로 깬다', () => {
    const flat: NeedSpec[] = ['beta', 'alpha', 'gamma'].map((id) => ({
      id,
      title: id,
      valueWeights: {},
      traitWeights: {},
      capabilityIds: [],
      resourceIds: [],
    }));
    const ranking = rankNeeds(view({ needs: { alpha: 3, beta: 3, gamma: 3 } }), flat, TEMPERAMENT);
    expect(ranking.order).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('활성도가 0 이하인 욕구는 활성 목록에 들지 않는다', () => {
    const ranking = rank({ needs: { hunger: 0, duty: 0, safety: 0 }, values: { duty: 1 }, traits: {} });
    expect(ranking.activated).not.toContain('hunger');
    expect(ranking.scores.length).toBe(SUBJECT_NEEDS.length);
  });

  it('욕구 책이 비면 순서도 1위도 비어 있다', () => {
    const ranking = rankNeeds(view(), [], TEMPERAMENT);
    expect(ranking.order).toEqual([]);
    expect(ranking.top).toBeNull();
    expect(ranking.activated).toEqual([]);
  });
});

describe('온도 — 원본 9장', () => {
  it('충동적일수록 높고 인내할수록 낮다', () => {
    const impulsive = temperatureOf(view({ traits: { impulsive: 1, patient: 0 } }), TEMPERAMENT);
    const patient = temperatureOf(view({ traits: { impulsive: 0, patient: 1 } }), TEMPERAMENT);
    expect(impulsive).toBeGreaterThan(patient);
  });

  it('공포와 절망이 온도를 높인다', () => {
    const calm = temperatureOf(view({ emotions: { fear: 0, despair: 0 } }), TEMPERAMENT);
    const afraid = temperatureOf(view({ emotions: { fear: 0.8, despair: 0.5 } }), TEMPERAMENT);
    expect(afraid).toBeGreaterThan(calm);
  });

  it('하한 아래로는 내려가지 않는다 — 완전한 확신은 없다', () => {
    const icy: TemperamentSpec = { base: 0, traitWeights: { patient: -10 }, emotionWeights: {}, floor: 0.25 };
    expect(temperatureOf(view({ traits: { patient: 1 } }), icy)).toBe(0.25);
  });

  it('온도는 순서를 바꾸지 않는다 — 간격의 체감만 바꾼다', () => {
    const subject = view({ values: { duty: 1, survival: 0.2, temperance: 0.3 } });
    const cold = rankNeeds(subject, SUBJECT_NEEDS, { ...TEMPERAMENT, base: 0.3 });
    const hot = rankNeeds(subject, SUBJECT_NEEDS, { ...TEMPERAMENT, base: 9 });
    expect(cold.order).toEqual(hot.order);
    expect((cold.scores[0]?.probability ?? 0) > (hot.scores[0]?.probability ?? 0)).toBe(true);
  });
});

describe('softmax', () => {
  it('확률의 합은 언제나 1 이다', () => {
    for (const values of [[1], [1, 1, 1], [10, -4, 0.5], [0, 0], []]) {
      const shares = softmax(values, 1.3);
      if (values.length === 0) {
        expect(shares).toEqual([]);
        continue;
      }
      expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 9);
    }
  });

  it('활성도가 커도 넘치지 않는다 — 가장 큰 값을 빼고 지수를 취한다', () => {
    const shares = softmax([1000, 999, 0], 1);
    expect(shares.every((share) => Number.isFinite(share))).toBe(true);
    expect(shares[0]).toBeGreaterThan(shares[1] ?? 0);
  });

  it('온도가 높을수록 평평해진다', () => {
    expect(softmax([5, 1], 0.5)[0]).toBeGreaterThan(softmax([5, 1], 5)[0] ?? 0);
  });
});

describe('반올림', () => {
  it('음의 0 을 남기지 않는다 — JSON 에서 굳으면 해시가 갈린다', () => {
    expect(Object.is(round(-0.00001), -0)).toBe(false);
    expect(round(-0.00001)).toBe(0);
  });
});

describe('수단 — 표시이지 점수가 아니다', () => {
  it('능력과 자원을 따로 센다', () => {
    const need = SUBJECT_NEEDS.find((entry) => entry.id === 'hunger') as NeedSpec;
    expect(meansFor(view({ capabilities: ['forage'] }), need)).toMatchObject({
      capable: true,
      provisioned: false,
    });
    expect(meansFor(view({ resources: { provision: 2 } }), need)).toMatchObject({
      capable: false,
      provisioned: true,
    });
    expect(meansFor(view({ resources: { provision: 0 } }), need)).toMatchObject({ provisioned: false });
  });

  it('수단이 있어도 활성도는 한 칸도 바뀌지 않는다 — F 는 G2 의 몫이다', () => {
    const bare = rank();
    const equipped = rank({ capabilities: ['forage', 'fight'], resources: { provision: 5, salve: 3 } });
    expect(equipped.scores.map((score) => score.activation)).toEqual(bare.scores.map((score) => score.activation));
    expect(equipped.scores.find((score) => score.needId === 'hunger')?.means.capable).toBe(true);
  });
});

describe('결정 추적', () => {
  const sample = (): SubjectSample => {
    const subject = view({ id: 'warden' });
    return {
      tick: 0,
      views: { warden: subject },
      rankings: { warden: rankNeeds(subject, SUBJECT_NEEDS, TEMPERAMENT) },
      bodies: {},
      appliedLaws: [],
      rejections: [],
    };
  };

  it('채운 칸과 빈 칸을 함께 남긴다', () => {
    const trace = traceOf(sample(), 'warden');
    expect(Object.keys(trace.candidateGoalScores).sort()).toEqual(['duty', 'hunger', 'safety']);
    expect(trace.pendingFields.length).toBeGreaterThan(0);
    // 없는 칸을 0 으로 채워 "다 쟀다"로 읽히게 하지 않는다.
    expect(trace.pendingFields.some((field) => field.includes('selectedActionId'))).toBe(true);
  });

  it('모르는 주체를 물으면 빈 추적이 나온다 — 지어내지 않는다', () => {
    const trace = traceOf(sample(), 'nobody');
    expect(trace.activatedNeedIds).toEqual([]);
    expect(trace.candidateGoalScores).toEqual({});
  });
});

describe('두 주체 비교', () => {
  const twoSubjects = (): SubjectSample => {
    const strict = view({
      id: 'strict',
      values: { duty: 0.9, survival: 0.3, temperance: 0.7 },
      traits: { patient: 0.8, impulsive: 0.1, cautious: 0.5 },
    });
    const loose = view({
      id: 'loose',
      values: { duty: 0.1, survival: 0.9, temperance: 0.1 },
      traits: { patient: 0.1, impulsive: 0.9, cautious: 0.2 },
    });
    return {
      tick: 0,
      views: { strict, loose },
      rankings: {
        strict: rankNeeds(strict, SUBJECT_NEEDS, TEMPERAMENT),
        loose: rankNeeds(loose, SUBJECT_NEEDS, TEMPERAMENT),
      },
      bodies: {},
      appliedLaws: [],
      rejections: [],
    };
  };

  it('욕구가 같은데 순서가 다르면 갈렸다고 판정한다', () => {
    const report = compareSubjects(twoSubjects(), 'strict', 'loose');
    expect(report.sameNeeds).toBe(true);
    expect(report.diverged).toBe(true);
    expect(report.topA).not.toBe(report.topB);
  });

  it('욕구가 다르면 순서가 달라도 갈렸다고 하지 않는다 — 같음을 먼저 증명해야 한다', () => {
    const sample = twoSubjects();
    const loose = sample.views['loose'] as SubjectView;
    sample.views['loose'] = { ...loose, needs: { ...loose.needs, hunger: 9 } };
    sample.rankings['loose'] = rankNeeds(sample.views['loose'], SUBJECT_NEEDS, TEMPERAMENT);
    const report = compareSubjects(sample, 'strict', 'loose');
    expect(report.sameNeeds).toBe(false);
    expect(report.diverged).toBe(false);
    expect(report.sharedNeeds).toEqual({});
  });

  it('무엇이 갈랐는지 큰 것부터 이름으로 말한다', () => {
    const causes = compareSubjects(twoSubjects(), 'strict', 'loose').causes;
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((cause) => cause.gap !== 0)).toBe(true);
    for (let index = 1; index < causes.length; index += 1) {
      expect(Math.abs(causes[index - 1]?.gap ?? 0)).toBeGreaterThanOrEqual(Math.abs(causes[index]?.gap ?? 0));
    }
    // 두 사람의 욕구 수위는 같으므로 N 은 원인이 될 수 없다.
    expect(causes.every((cause) => cause.kind === 'value' || cause.kind === 'trait')).toBe(true);
  });

  it('같은 사람끼리는 갈리지 않는다', () => {
    const sample = twoSubjects();
    const strict = sample.views['strict'] as SubjectView;
    sample.views['loose'] = { ...strict, id: 'loose' };
    sample.rankings['loose'] = rankNeeds(sample.views['loose'], SUBJECT_NEEDS, TEMPERAMENT);
    const report = compareSubjects(sample, 'strict', 'loose');
    expect(report.diverged).toBe(false);
    expect(report.causes).toEqual([]);
  });
});
