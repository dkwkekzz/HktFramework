import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { NATURAL_LAWS, NATURAL_COMPONENT } from '@hkt/s1-natural-state';
import {
  compareSubjects,
  executeU0,
  traceOf,
  validateOutput,
  U0_PURPOSE,
  type U0Input,
  type U0Output,
} from '../src/module.js';
import { SUBJECT_LAW_IDS } from '../src/laws.js';
import { SUBJECT_NEEDS } from '../src/needs.js';
import { softmax } from '../src/rank.js';
import { PENDING_TERMS, type NeedRanking, type SubjectSample } from '../src/types.js';
import {
  COMPONENT_DEFINITIONS,
  EQUIPPED_AND_HELPLESS,
  FOUR_KINDS_WORLD,
  HOUND_AND_CARRION,
  LAYOUT,
  SHARED_NEEDS,
  TWO_PEOPLE,
  WORLD_SEED,
} from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): U0Input;
  check(input: U0Input, output: U0Output, context: ModuleContext): AssertionResult[];
  reasons(input: U0Input, output: U0Output): string[];
  candidates?(input: U0Input, output: U0Output): LabRow[];
  result?(output: U0Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<U0Input, U0Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeU0(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      const first = output.series[0] as SubjectSample;
      return {
        purpose: U0_PURPOSE,
        input: [
          { label: '틱', value: `${input.ticks}일 · 시드 ${input.worldSeed}` },
          { label: '주체', value: describeSubjects(first) },
          { label: '욕구 수위', value: describeNeeds(first) },
          { label: '가치·성격', value: describeCharacter(first) },
          { label: '수단 (능력·자원)', value: describeMeans(first) },
          { label: '법칙', value: SUBJECT_LAW_IDS.join(', ') },
          { label: '아직 재지 않는 항', value: PENDING_TERMS.join(' · ') },
        ],
        candidates: spec.candidates?.(input, output) ?? defaultCandidates(output),
        result: spec.result?.(output) ?? defaultResult(output),
        reasons: spec.reasons(input, output),
        before: `0일 — ${describeTop(output.series[0])}`,
        after: `${output.finalTick}일 — ${describeTop(output.series[output.series.length - 1])}`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 화면 보조
// ---------------------------------------------------------------------------

const subjectIds = (sample: SubjectSample | undefined): string[] =>
  sample ? Object.keys(sample.rankings).sort() : [];

function describeSubjects(sample: SubjectSample): string {
  return subjectIds(sample)
    .map((id) => `${id}(${sample.views[id]?.kind ?? '?'})`)
    .join(' · ');
}

function describeNeeds(sample: SubjectSample): string {
  return subjectIds(sample)
    .map((id) => {
      const needs = sample.views[id]?.needs ?? {};
      return `${id}: ${Object.entries(needs)
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([need, level]) => `${need} ${level}`)
        .join(' / ')}`;
    })
    .join('   ');
}

function describeCharacter(sample: SubjectSample): string {
  return subjectIds(sample)
    .map((id) => {
      const view = sample.views[id];
      if (!view) return id;
      const pack = (record: Record<string, number>): string =>
        Object.entries(record)
          .filter(([, level]) => level > 0)
          .sort(([left], [right]) => (left < right ? -1 : 1))
          .map(([key, level]) => `${key} ${level}`)
          .join(' ');
      return `${id}: 가치[${pack(view.values)}] 성격[${pack(view.traits)}]`;
    })
    .join('   ');
}

function describeMeans(sample: SubjectSample): string {
  return subjectIds(sample)
    .map((id) => {
      const view = sample.views[id];
      if (!view) return id;
      const stores = Object.entries(view.resources)
        .filter(([, amount]) => amount > 0)
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([key, amount]) => `${key} ${amount}`)
        .join(' ');
      return `${id}: 능력[${view.capabilities.join(' ') || '없음'}] 자원[${stores || '없음'}]`;
    })
    .join('   ');
}

function describeTop(sample: SubjectSample | undefined): string {
  if (!sample) return '';
  return subjectIds(sample)
    .map((id) => `${id} → ${sample.rankings[id]?.top ?? '없음'}`)
    .join(' · ');
}

/**
 * 활성도를 글자 막대로 그린다.
 *
 * 원문 「24」는 "그래픽 모듈이 아니더라도 표·그래프·타임라인을 통해 반드시 눈으로 확인할 수 있어야
 * 한다"고 요구한다. 우선순위는 숫자 목록보다 **길이의 대비**로 볼 때 훨씬 빨리 읽힌다.
 */
export function bar(value: number, peak: number, width = 12): string {
  if (peak <= 0) return '·'.repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((value / peak) * width)));
  return `${'█'.repeat(filled)}${'·'.repeat(width - filled)}`;
}

function defaultCandidates(output: U0Output): LabRow[] {
  const last = output.series[output.series.length - 1] as SubjectSample;
  const rows: LabRow[] = [];
  for (const id of subjectIds(last)) {
    const ranking = last.rankings[id];
    if (!ranking) continue;
    const peak = ranking.scores.reduce((best, score) => Math.max(best, score.activation), 0);
    rows.push({ label: `${id} (온도 ${ranking.temperature})`, value: '' });
    for (const score of ranking.scores) {
      rows.push({
        label: `  ${score.rank}. ${score.title}`,
        value: `${bar(score.activation, peak)} A ${score.activation} = N ${score.urgency} + V ${score.valueFit} + T ${score.traitFit}  ·  P ${score.probability}${
          score.means.capable || score.means.provisioned ? '  · 수단 있음' : '  · 수단 없음'
        }`,
      });
    }
  }
  return rows;
}

function defaultResult(output: U0Output): string {
  const last = output.series[output.series.length - 1] as SubjectSample;
  return subjectIds(last)
    .map((id) => `${id} → ${last.rankings[id]?.order.join(' > ') ?? ''}`)
    .join('   /   ');
}

// ---------------------------------------------------------------------------
// 단정 도우미
// ---------------------------------------------------------------------------

const eq = (id: string, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const ok = (
  id: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  reason?: string,
): AssertionResult => ({
  id,
  passed,
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const world = (operations: StoreOperation[], ticks: number, naturalLaws?: typeof NATURAL_LAWS): U0Input => ({
  world: { components: COMPONENT_DEFINITIONS, operations },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks,
  ...(naturalLaws === undefined ? {} : { naturalLaws }),
});

const at = (output: U0Output, tick: number): SubjectSample | undefined =>
  output.series.find((sample) => sample.tick === tick);

const rankingAt = (output: U0Output, tick: number, subject: string): NeedRanking | undefined =>
  at(output, tick)?.rankings[subject];

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 같은 배고픔, 다른 우선순위
// ---------------------------------------------------------------------------
const sameHungerDifferentValuesDiverge = defineScene({
  id: 'same_hunger_different_values_diverge',
  title: '동일한 배고픔 상태에서도 가치와 성격이 다른 주체의 우선순위가 달라진다',
  seed: 501n,
  arrange: () => world(TWO_PEOPLE, 2),
  check: (_input, output) => {
    const results: AssertionResult[] = [];

    // ① 배고픔이 정말로 같은가 — 이것이 무너지면 나머지는 아무것도 증명하지 않는다.
    for (const sample of output.series) {
      const sentinel = sample.views['sentinel']?.needs ?? {};
      const forager = sample.views['forager']?.needs ?? {};
      results.push(
        eq(
          `needs_are_identical_at_tick_${sample.tick}`,
          sentinel,
          forager,
          `${sample.tick}일 — 두 사람의 욕구 수위가 한 칸도 다르지 않다`,
        ),
      );
    }
    const bodies = output.series.map((sample) => [
      sample.bodies['sentinel_body']?.[NATURAL_COMPONENT.HUNGER],
      sample.bodies['forager_body']?.[NATURAL_COMPONENT.HUNGER],
    ]);
    results.push(
      ok(
        'bodies_are_equally_hungry',
        bodies.every(([left, right]) => left === right),
        '두 몸의 허기가 매 틱 같다',
        JSON.stringify(bodies),
      ),
    );

    // ② 그런데도 우선순위가 갈린다 — 매 틱.
    for (const sample of output.series) {
      const report = compareSubjects(sample, 'sentinel', 'forager');
      results.push(
        ok(
          `priorities_diverge_at_tick_${sample.tick}`,
          report.diverged,
          '같은 욕구 수위 · 다른 1위',
          `${report.topA} ≠ ${report.topB}`,
          `${sample.tick}일 — 파수꾼 ${report.orderA.join('>')} / 도둑 ${report.orderB.join('>')}`,
        ),
      );
    }

    const last = at(output, output.finalTick) as SubjectSample;
    results.push(
      eq('sentinel_puts_duty_first', 'duty', last.rankings['sentinel']?.top, '파수꾼은 맡은 자리를 앞세운다'),
      eq('forager_puts_hunger_first', 'hunger', last.rankings['forager']?.top, '도둑은 끼니를 앞세운다'),
    );

    // ③ 무엇이 갈랐는지 이름으로 나온다 (원문 「22」 8단계 인과 추적).
    const causes = compareSubjects(last, 'sentinel', 'forager').causes;
    results.push(
      ok(
        'the_divergence_names_its_causes',
        causes.length > 0 && causes.every((cause) => cause.gap !== 0),
        '가치·성격 중 무엇이 얼마나 갈랐는지가 나온다',
        causes.slice(0, 3).map((cause) => `${cause.needId}/${cause.kind}/${cause.source} ${cause.gap}`),
      ),
    );

    // ④ 성격이 온도를 만든다 — 원본 9장: 충동적인 주체는 온도가 높다.
    const sentinelTemp = last.rankings['sentinel']?.temperature ?? 0;
    const foragerTemp = last.rankings['forager']?.temperature ?? 0;
    results.push(
      ok(
        'the_impulsive_run_hotter',
        foragerTemp > sentinelTemp,
        '도둑(충동 0.9)의 온도 > 파수꾼(인내 0.8)의 온도',
        `${foragerTemp} vs ${sentinelTemp}`,
      ),
    );

    // ⑤ 온도가 무엇을 하는지는 **온도만 바꿔** 재야 보인다.
    //
    //    "충동적인 주체가 덜 확신한다"로 재면 틀린다 — 확신은 온도와 **활성도 간격**이 함께
    //    정하기 때문이다. 실제로 도둑은 온도가 높은데도 1위가 압도적으로 앞서 있어 파수꾼보다
    //    확신이 크다. 그러니 같은 활성도 벡터를 두 온도로 재어 온도만의 몫을 본다.
    const activations = (last.rankings['sentinel']?.scores ?? []).map((score) => score.activation);
    const atCold = softmax(activations, sentinelTemp)[0] ?? 0;
    const atHot = softmax(activations, foragerTemp)[0] ?? 0;
    results.push(
      ok(
        'temperature_alone_flattens_the_choice',
        atCold > atHot,
        '같은 활성도라면 온도가 낮은 쪽이 1위에 더 몰린다',
        `${atCold} (온도 ${sentinelTemp}) vs ${atHot} (온도 ${foragerTemp})`,
        '원본 9장 — 온도는 순위가 아니라 간격의 체감을 바꾼다',
      ),
    );

    results.push(eq('no_invariant_issue', [], validateOutput(output)));
    return results;
  },
  reasons: (_input, output) => {
    const last = at(output, output.finalTick) as SubjectSample;
    const report = compareSubjects(last, 'sentinel', 'forager');
    const lines = [
      `두 사람의 욕구 수위는 같다 — ${Object.entries(report.sharedNeeds)
        .map(([need, level]) => `${need} ${level}`)
        .join(' · ')}`,
    ];
    for (const cause of report.causes.slice(0, 4)) {
      lines.push(
        `${cause.needId}: ${cause.kind === 'value' ? '가치' : '성격'} ${cause.source} 가 파수꾼 쪽으로 ${cause.gap > 0 ? '+' : ''}${cause.gap}`,
      );
    }
    lines.push(
      `온도 — 파수꾼 ${last.rankings['sentinel']?.temperature} (인내) · 도둑 ${last.rankings['forager']?.temperature} (충동)`,
    );
    return lines;
  },
});

// ---------------------------------------------------------------------------
// 2. 신체 연결 — 몸이 욕구를 밀어 올리고, 먹으면 내려간다
// ---------------------------------------------------------------------------
const theBodyPushesTheNeedUp = defineScene({
  id: 'the_body_pushes_the_need_up_and_feeding_lets_it_fall',
  title: '굶은 몸은 욕구를 밀어 올리고, 몸이 먹으면 욕구가 내려간다',
  seed: 502n,
  arrange: () => world(HOUND_AND_CARRION, 3, NATURAL_LAWS),
  check: (_input, output) => {
    const levels = output.series.map((sample) => sample.views['stray_hound']?.needs['hunger'] ?? 0);
    const bodyHunger = output.series.map(
      (sample) => sample.bodies['hound_body']?.[NATURAL_COMPONENT.HUNGER] ?? 0,
    );
    const rose = levels.findIndex((level, index) => index > 0 && level > (levels[index - 1] as number));
    const fell = levels.findIndex((level, index) => index > 0 && level < (levels[index - 1] as number));

    return [
      ok('the_need_rises_while_the_body_starves', rose > 0, '올라간 틱이 있다', `${JSON.stringify(levels)}`),
      ok('the_need_falls_after_the_body_eats', fell > rose && fell > 0, '먹은 뒤 내려간다', `${JSON.stringify(levels)}`),
      ok(
        'the_body_was_fed_by_a_natural_law',
        output.appliedLaws.includes('l1_feed'),
        'S1 의 l1_feed 가 적용되었다',
        output.appliedLaws.filter((law) => law.startsWith('l1_')),
        '몸을 먹인 것은 U0 이 아니라 자연 법칙이다',
      ),
      ok(
        'the_need_followed_the_body_not_the_clock',
        bodyHunger.some((value, index) => index > 0 && value < (bodyHunger[index - 1] as number)),
        '몸의 허기도 내려간 틱이 있다',
        JSON.stringify(bodyHunger),
      ),
      ok(
        'the_subject_changed_only_through_its_own_laws',
        output.series
          .flatMap((sample) => sample.appliedLaws)
          .filter((law) => law.startsWith('u0_')).length > 0,
        'U0 법칙이 실제로 적용되었다',
        [...new Set(output.series.flatMap((sample) => sample.appliedLaws))].sort(),
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const levels = output.series.map(
      (sample) =>
        `${sample.tick}일 몸 ${sample.bodies['hound_body']?.[NATURAL_COMPONENT.HUNGER]} → 욕구 ${sample.views['stray_hound']?.needs['hunger']}`,
    );
    return [
      '몸이 굶으면 u0_hunger_grows_from_the_body 가 욕구를 밀어 올린다',
      '몸이 먹으면 u0_hunger_fades_when_the_body_is_fed 가 욕구를 내린다',
      ...levels,
    ];
  },
});

// ---------------------------------------------------------------------------
// 3. GI-01 — 주체의 모든 변화에 원인 사건이 있다
// ---------------------------------------------------------------------------
const everySubjectChangeHasACausingEvent = defineScene({
  id: 'every_subject_change_has_a_causing_event',
  title: '주체의 상태가 바뀐 자리마다 그것을 일으킨 사건이 있다',
  seed: 503n,
  arrange: () => world(HOUND_AND_CARRION, 3, NATURAL_LAWS),
  check: (_input, output) => [
    ok(
      'replayed_store_matches',
      output.audit.everyChangeHasAnEvent,
      '사건 로그로 되짚은 상태 = 실제 상태',
      `${output.audit.replayedStoreHash} vs ${output.audit.storeHash}`,
    ),
    ok(
      'subject_state_appears_in_the_log',
      output.subjectDeltaPaths.length > 0,
      '주체 컴포넌트를 바꾼 델타가 로그에 있다',
      output.subjectDeltaPaths.slice(0, 6),
    ),
    ok(
      'every_subject_delta_names_a_law',
      output.subjectDeltaLaws.length > 0 && output.subjectDeltaLaws.every((law) => law.startsWith('u0_')),
      '주체를 바꾼 것은 모두 U0 의 법칙이다',
      output.subjectDeltaLaws,
    ),
    ok('log_is_append_only', output.audit.logIsAppendOnly, true, output.audit.logIsAppendOnly),
    ok(
      'resimulation_is_identical',
      output.resimulatedLogHash === output.logHash,
      output.logHash,
      output.resimulatedLogHash,
      'GI-12 — 일지를 원인부터 다시 굴려도 같은 사건이 나온다',
    ),
    eq('no_invariant_issue', [], validateOutput(output)),
  ],
  reasons: (_input, output) => [
    `사건 ${output.events}건 · 거부 ${output.rejected}건`,
    `주체를 바꾼 법칙: ${output.subjectDeltaLaws.join(', ') || '없음'}`,
    `바뀐 자리: ${output.subjectDeltaPaths.slice(0, 5).join(' · ')}`,
  ],
});

// ---------------------------------------------------------------------------
// 4. 능력과 자원 — 수단 없는 절박은 절망을 낳는다
// ---------------------------------------------------------------------------
const withoutMeansAnUrgentNeedBreedsDespair = defineScene({
  id: 'without_means_an_urgent_need_breeds_despair',
  title: '욕구도 가치도 성격도 같지만, 손에 쥔 것이 없는 쪽만 절망이 깊어진다',
  seed: 504n,
  arrange: () => world(EQUIPPED_AND_HELPLESS, 3),
  check: (_input, output) => {
    const first = at(output, 0) as SubjectSample;
    const last = at(output, output.finalTick) as SubjectSample;
    const despairOf = (sample: SubjectSample, id: string): number => sample.views[id]?.emotions['despair'] ?? 0;

    return [
      eq(
        'the_two_start_from_the_same_mind',
        {
          needs: first.views['equipped']?.needs,
          values: first.views['equipped']?.values,
          traits: first.views['equipped']?.traits,
          emotions: first.views['equipped']?.emotions,
        },
        {
          needs: first.views['helpless']?.needs,
          values: first.views['helpless']?.values,
          traits: first.views['helpless']?.traits,
          emotions: first.views['helpless']?.emotions,
        },
        '욕구·가치·성격·감정이 처음에는 같다',
      ),
      ok(
        'only_the_means_differ',
        (first.views['equipped']?.capabilities.length ?? 0) > 0 &&
          (first.views['helpless']?.capabilities.length ?? 0) === 0,
        '한쪽만 능력과 자원을 가졌다',
        `equipped ${JSON.stringify(first.views['equipped']?.capabilities)} · helpless ${JSON.stringify(first.views['helpless']?.capabilities)}`,
      ),
      ok(
        'the_helpless_despair_deepens',
        despairOf(last, 'helpless') > despairOf(first, 'helpless'),
        '절망이 깊어진다',
        `${despairOf(first, 'helpless')} → ${despairOf(last, 'helpless')}`,
      ),
      ok(
        'the_equipped_despair_fades',
        despairOf(last, 'equipped') < despairOf(first, 'equipped'),
        '절망이 잦아든다',
        `${despairOf(first, 'equipped')} → ${despairOf(last, 'equipped')}`,
      ),
      ok(
        'despair_widens_the_choice',
        (last.rankings['helpless']?.temperature ?? 0) > (last.rankings['equipped']?.temperature ?? 0),
        '절망이 깊은 쪽의 온도가 높다',
        `${last.rankings['helpless']?.temperature} vs ${last.rankings['equipped']?.temperature}`,
        '원본 9장 — 공포나 혼란은 온도를 일시적으로 높인다',
      ),
      ok(
        'means_are_reported_not_scored',
        last.rankings['helpless']?.scores.every(
          (score) => typeof score.means.capable === 'boolean' && typeof score.means.provisioned === 'boolean',
        ) === true,
        '수단은 표시된다',
        last.rankings['helpless']?.scores.map((score) => `${score.needId} ${score.means.capable}/${score.means.provisioned}`),
        '수단은 점수에 더하지 않는다 — F(행동 가능성)는 G2 의 몫이다',
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const last = at(output, output.finalTick) as SubjectSample;
    return [
      `helpless — 능력 없음 · 자원 없음 → 절망 ${last.views['helpless']?.emotions['despair']} · 온도 ${last.rankings['helpless']?.temperature}`,
      `equipped — 능력 forage · 자원 provision 3 → 절망 ${last.views['equipped']?.emotions['despair']} · 온도 ${last.rankings['equipped']?.temperature}`,
      '가른 것은 u0_helplessness_breeds_despair 와 u0_means_at_hand_calm_the_mind 두 법칙이다',
    ];
  },
});

// ---------------------------------------------------------------------------
// 5. 사람 · 생물 · 조직 · 신 — 하나의 구조
// ---------------------------------------------------------------------------
const fourKindsShareOneStructure = defineScene({
  id: 'person_creature_organization_and_god_share_one_structure',
  title: '사람·생물·조직·신이 같은 주체 구조로 우선순위를 낸다',
  seed: 505n,
  arrange: () => world(FOUR_KINDS_WORLD, 2),
  check: (_input, output) => {
    const last = at(output, output.finalTick) as SubjectSample;
    const ids = ['border_watch', 'boundary_god', 'warden', 'wild_boar'];
    const kinds = ids.map((id) => last.views[id]?.kind);
    const shapes = ids.map((id) => (last.rankings[id]?.scores ?? []).map((score) => score.needId).sort());

    const fallen = output.series
      .flatMap((sample) => sample.rejections)
      .filter((rejection) => rejection.actor === 'border_watch');

    return [
      eq('four_kinds_are_present', ['organization', 'god', 'person', 'creature'], kinds),
      ok(
        'all_four_are_ranked_by_the_same_book',
        shapes.every((shape) => JSON.stringify(shape) === JSON.stringify(shapes[0])),
        '네 주체가 같은 욕구 목록으로 재어진다',
        JSON.stringify(shapes[0]),
      ),
      ok(
        'each_kind_reaches_its_own_answer',
        new Set(ids.map((id) => last.rankings[id]?.top)).size > 1,
        '같은 구조라도 1위는 저마다 다르다',
        ids.map((id) => `${id} → ${last.rankings[id]?.top}`),
      ),
      ok(
        'the_organization_feels_only_through_its_members',
        fallen.length > 0 && fallen.every((rejection) => rejection.path.includes('u0_the_dead_do_not_feel')),
        '쓰러진 구성원을 통한 감각은 거부된다 (GI-08)',
        fallen.slice(0, 2).map((rejection) => `${rejection.verb} → ${rejection.code} @ ${rejection.path}`),
      ),
      ok(
        'the_standing_member_still_carries_the_need_up',
        (last.views['border_watch']?.needs['hunger'] ?? 0) >
          (at(output, 0)?.views['border_watch']?.needs['hunger'] ?? 0),
        '남은 구성원을 통해서는 욕구가 올라온다',
        `${at(output, 0)?.views['border_watch']?.needs['hunger']} → ${last.views['border_watch']?.needs['hunger']}`,
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const last = at(output, output.finalTick) as SubjectSample;
    return [
      ...['warden', 'wild_boar', 'border_watch', 'boundary_god'].map(
        (id) => `${id}(${last.views[id]?.kind}) → ${last.rankings[id]?.order.join(' > ')}`,
      ),
      '조직의 몸은 구성원이고 신의 몸은 앵커다 — 몸 없이 느끼는 주체는 없다',
    ];
  },
});

// ---------------------------------------------------------------------------
// 6. 민감도 — 주체의 어느 칸도 장식이 아니다
// ---------------------------------------------------------------------------

/** 원문 「11」 U0 의 「포함」 일곱 항목 — 이름과 흔드는 방법이 한 줄에 있다. */
export const SUBJECT_PARTS: { part: string; label: string; perturb(operations: StoreOperation[]): StoreOperation[] }[] =
  [
    {
      part: 'needs',
      label: '욕구',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'needs', data: { ...SHARED_NEEDS, hunger: 10 } },
      ],
    },
    {
      part: 'values',
      label: '가치',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'values', data: { duty: 0.1, survival: 0.9, temperance: 0.1 } },
      ],
    },
    {
      part: 'traits',
      label: '특성',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'traits', data: { patient: 0.1, impulsive: 0.9, cautious: 0.2 } },
      ],
    },
    {
      part: 'emotions',
      label: '감정',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'emotions', data: { fear: 0.9, despair: 0.6 } },
      ],
    },
    {
      part: 'capabilities',
      label: '능력',
      perturb: (operations) => [...operations, { op: 'remove_tag', id: 'sentinel', tag: 'cap_stand_watch' }],
    },
    {
      part: 'resources',
      label: '자원',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'resources', data: { provision: 0, salve: 0 } },
      ],
    },
    {
      part: 'body',
      label: '신체 연결',
      perturb: (operations) => [
        ...operations,
        { op: 'set_component', id: 'sentinel', type: 'body', data: { entity_ids: [] } },
      ],
    },
  ];

const nothingInTheSubjectIsDecoration = defineScene({
  id: 'nothing_in_the_subject_is_decoration',
  title: '원문 「11」 U0 의 포함 일곱 항목은 하나도 빠짐없이 결과를 바꾼다',
  seed: 506n,
  // 굶주림을 끝까지 밀어 보려면 몇 틱이 더 필요하다.
  arrange: () => world(TWO_PEOPLE, 4),
  check: (_input, output) => {
    const baseline = output.digest;
    const results = SUBJECT_PARTS.map((entry) =>
      ok(
        `${entry.part}_changes_the_outcome`,
        executeU0(world(entry.perturb(TWO_PEOPLE), 4)).digest !== baseline,
        '결과가 달라진다',
        entry.label,
        `${entry.label}만 흔들어도 우선순위나 사건이 달라진다`,
      ),
    );

    // 욕구가 죽은 항이 아니라는 것을 한 번 더 — 굶주림이 충분히 커지면 파수꾼도 끼니를 앞세운다.
    const tops = output.series.map((sample) => sample.rankings['sentinel']?.top);
    results.push(
      ok(
        'even_the_dutiful_yield_to_hunger_eventually',
        tops[0] === 'duty' && tops[tops.length - 1] === 'hunger',
        'duty → … → hunger',
        JSON.stringify(tops),
        '가치는 우선순위를 기울일 뿐, 욕구를 지우지는 않는다',
      ),
    );
    results.push(eq('no_invariant_issue', [], validateOutput(output)));
    return results;
  },
  reasons: (_input, output) => [
    `기준 결과 해시 ${output.digest.slice(0, 24)}…`,
    `흔든 항목: ${SUBJECT_PARTS.map((entry) => entry.label).join(' · ')}`,
    `파수꾼의 1위 변화: ${output.series.map((sample) => `${sample.tick}일 ${sample.rankings['sentinel']?.top}`).join(' → ')}`,
  ],
});

// ---------------------------------------------------------------------------
// 7. 결정성 — 같은 주체는 같은 순서로 잰다
// ---------------------------------------------------------------------------
const theSameSubjectRanksTheSameWay = defineScene({
  id: 'the_same_subject_ranks_the_same_way',
  title: '같은 주체와 같은 시드는 같은 순서와 같은 사건을 만든다',
  seed: 507n,
  arrange: () => world(FOUR_KINDS_WORLD, 3),
  check: (input, output) => {
    const again = executeU0(input);
    const trace = traceOf(at(output, output.finalTick) as SubjectSample, 'warden');
    return [
      eq('same_digest', output.digest, again.digest, '같은 입력 → 같은 결과 (GI-12)'),
      eq('same_log_hash', output.logHash, again.logHash),
      eq('resimulated_log_hash', output.logHash, output.resimulatedLogHash),
      eq('same_store_hash', output.storeHash, again.storeHash),
      ok(
        'ties_break_by_need_id',
        output.series.every((sample) =>
          Object.values(sample.rankings).every((ranking) => isTotalOrder(ranking)),
        ),
        '동점은 욕구 id 오름차순으로 깨진다',
        true,
      ),
      ok(
        'the_trace_names_what_it_cannot_fill',
        trace.pendingFields.length > 0,
        'DecisionTrace 의 빈 칸이 이름으로 남는다',
        trace.pendingFields,
      ),
      eq(
        'the_trace_carries_the_scores',
        (at(output, output.finalTick)?.rankings['warden']?.order ?? []).length,
        Object.keys(trace.candidateGoalScores).length,
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => [
    `사건 해시 ${output.logHash.slice(0, 24)}…`,
    `재시뮬레이션 해시 ${output.resimulatedLogHash.slice(0, 24)}…`,
    '동점은 활성도 → 욕구 id 오름차순으로 깨진다',
  ],
});

/** 순위가 전순서인가 — 활성도 내림차순이고, 같으면 id 오름차순이다. */
export function isTotalOrder(ranking: NeedRanking): boolean {
  for (let index = 1; index < ranking.scores.length; index += 1) {
    const previous = ranking.scores[index - 1];
    const current = ranking.scores[index];
    if (!previous || !current) return false;
    if (previous.activation < current.activation) return false;
    if (previous.activation === current.activation && previous.needId > current.needId) return false;
    if (previous.rank + 1 !== current.rank) return false;
  }
  return ranking.order.length === new Set(ranking.order).size;
}

export const u0Scenarios: VerificationScenario<U0Input, U0Output>[] = [
  sameHungerDifferentValuesDiverge,
  theBodyPushesTheNeedUp,
  everySubjectChangeHasACausingEvent,
  withoutMeansAnUrgentNeedBreedsDespair,
  fourKindsShareOneStructure,
  nothingInTheSubjectIsDecoration,
  theSameSubjectRanksTheSameWay,
];

export { SUBJECT_NEEDS };
