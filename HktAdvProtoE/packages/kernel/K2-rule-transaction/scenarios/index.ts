import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { buildWorld, executeK2, K2_PURPOSE, totalOf, validateOutput } from '../src/module.js';
import type { K2Input, K2Output } from '../src/module.js';
import { RuleBook } from '../src/rulebook.js';
import { runTransaction } from '../src/transaction.js';
import type { Intent, StateDelta, TransactionOutcome } from '../src/types.js';
import { CANYON, COMPONENT_DEFINITIONS, RULES } from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): K2Input;
  check(input: K2Input, output: K2Output, context: ModuleContext): AssertionResult[];
  reasons(input: K2Input, output: K2Output): string[];
  candidates?(input: K2Input, output: K2Output): LabRow[];
  result?(output: K2Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<K2Input, K2Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeK2(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: K2_PURPOSE,
        input: [
          { label: '규칙집', value: input.rules.map((rule) => `${rule.scope}/${rule.id}`).join(' · ') },
          ...input.intents.map((intent) => ({
            label: `의도 ${intent.id}`,
            value: `${intent.actor} —${intent.verb}→ ${(intent.targets ?? []).join(', ') || '(없음)'}`,
          })),
        ],
        candidates:
          spec.candidates?.(input, output) ??
          output.outcomes.map((outcome) => ({
            label: `${outcome.ok ? '○' : '×'} ${outcome.intentId}`,
            value: outcome.ok
              ? `규칙 ${outcome.appliedRuleId} · ${outcome.delta.map(describeDelta).join(' · ')}`
              : `${outcome.rejection?.code} @ ${outcome.rejection?.path} — ${outcome.rejection?.message}`,
          })),
        result:
          spec.result?.(output) ??
          output.outcomes.map((outcome) => `${outcome.intentId}=${outcome.ok ? outcome.appliedRuleId : outcome.rejection?.code}`).join(' / '),
        reasons: spec.reasons(input, output),
        before: `세계 해시 ${output.worldHashBefore.slice(0, 21)}…`,
        after: `세계 해시 ${output.worldHashAfter.slice(0, 21)}… · 성공 ${output.outcomes.filter((outcome) => outcome.ok).length}/${output.outcomes.length}`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

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

function describeDelta(change: StateDelta): string {
  return `${change.path} ${JSON.stringify(change.before)}→${JSON.stringify(change.after)}`;
}

const world = { components: COMPONENT_DEFINITIONS, operations: CANYON };

const strike = (index: number, actor: string, target: string): Intent => ({
  id: `strike_${index}`,
  actor,
  verb: 'strike',
  targets: [target],
});

/** 장면이 끝난 뒤의 세계를 다시 만든다 — 최종 상태를 눈으로 확인하는 데 쓴다. */
function replayWorld(input: K2Input): ReturnType<typeof buildWorld> {
  const rules = RuleBook.of(input.rules);
  let store = buildWorld(input.world);
  for (const intent of input.intents) store = runTransaction(store, rules, intent).store;
  return store;
}

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 에너지가 모자라면 피해도 비용도 없다 (원문 「20」 VS0 의 장면)
// ---------------------------------------------------------------------------
const attackFailsWhenEnergyIsShort = defineScene({
  id: 'attack_fails_when_energy_is_short',
  title: '에너지 10 으로 3 짜리 타격을 네 번 시도하면 세 번 성공하고 네 번째는 아무것도 바꾸지 않는다',
  seed: 301n,
  arrange: () => ({
    world,
    rules: RULES,
    intents: [0, 1, 2, 3].map((index) => strike(index, 'hunter_a', 'beast_ka')),
  }),
  check: (input, output) => {
    const store = replayWorld(input);
    const fourth = output.outcomes[3] as TransactionOutcome;

    return [
      eq('three_succeed_one_fails', [true, true, true, false], output.outcomes.map((outcome) => outcome.ok)),
      eq('energy_ends_at_one', { current: 1 }, store.component('hunter_a', 'energy'), '10 − 3×3 = 1'),
      eq('damage_is_thirty', { current: 870, max: 900 }, store.component('beast_ka', 'health')),
      eq('fourth_is_unaffordable', 'E_UNAFFORDABLE_COST', fourth.rejection?.code),
      eq(
        'fourth_points_at_the_cost',
        'rule/l1_strike/costs/0',
        fourth.rejection?.path,
        '어느 비용을 못 냈는지까지 지목한다',
      ),
      eq('fourth_applies_nothing', [0, 0, 0], [fourth.costDelta.length, fourth.effectDelta.length, fourth.delta.length]),
      eq('fourth_does_not_move_the_world', false, output.hashes[3]?.changed, '네 번째 행동은 상태를 전혀 변경하지 않는다'),
      eq('world_hash_is_stable_across_the_failure', output.hashes[3]?.before, output.hashes[3]?.after),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.hashes
      .map((hash, index) => `#${index} ${hash.changed ? '세계가 바뀜' : '세계 그대로'} — ${output.outcomes[index]?.ok ? output.outcomes[index]?.appliedRuleId : output.outcomes[index]?.rejection?.code}`)
      .join('\n'),
    '“에너지가 모자라면 실패한다”를 K2 안에 적지 않았다. `energy.current` 의 스키마가 `minimum: 0` 이라, 1 에서 3 을 더 빼는 순간 K0 이 거부한다. 그 거부를 비용을 치르는 자리에서 E_UNAFFORDABLE_COST 로 옮긴다.',
    '원자성은 순서가 아니라 **작업용 저장소를 버리는 것**에서 온다. 비용이든 효과든 하나라도 어긋나면 그때까지 만든 저장소를 통째로 버리므로, “피해는 들어갔는데 비용은 안 냈다”가 생길 자리가 없다.',
    '순서(비용 → 효과)는 다른 것을 정한다 — 지불 능력을 **효과가 일어나기 전 상태**로 재는 것이다. 효과가 자원을 늘리는 규칙이라면 그 늘어난 자원으로 비용을 낼 수는 없다.',
  ],
  candidates: (_input, output) =>
    output.outcomes.map((outcome, index) => ({
      label: `#${index} ${outcome.ok ? '성공' : '실패'}`,
      value: outcome.ok
        ? outcome.delta.map(describeDelta).join(' · ')
        : `${outcome.rejection?.code} @ ${outcome.rejection?.path} · 델타 ${outcome.delta.length}건`,
    })),
  result: (output) => `성공 ${output.outcomes.filter((outcome) => outcome.ok).length} / 시도 ${output.outcomes.length}`,
});

// ---------------------------------------------------------------------------
// 2. 성공이면 비용과 효과가 함께 간다
// ---------------------------------------------------------------------------
const attackSucceedsAndPaysItsCost = defineScene({
  id: 'attack_succeeds_and_pays_its_cost',
  title: '성공한 타격은 비용과 효과가 한 덩어리로 적용되고 델타에 모두 남는다',
  seed: 302n,
  arrange: () => ({ world, rules: RULES, intents: [strike(0, 'hunter_a', 'beast_ka')] }),
  check: (_input, output) => {
    const outcome = output.outcomes[0] as TransactionOutcome;
    return [
      eq('applied_rule', 'l1_strike', outcome.appliedRuleId),
      eq(
        'cost_delta',
        [{ path: 'entity/hunter_a/components/energy/current', op: 'add', before: 10, after: 7 }],
        outcome.costDelta,
      ),
      eq(
        'effect_delta',
        [{ path: 'entity/beast_ka/components/health/current', op: 'add', before: 900, after: 890 }],
        outcome.effectDelta,
      ),
      eq('delta_is_cost_then_effect', [...outcome.costDelta, ...outcome.effectDelta], outcome.delta),
      eq('phenomenon_is_emitted', ['strike_sound'], outcome.emitted.map((phenomenon) => phenomenon.id), '흔적·소리는 I 페이즈가 전파한다'),
      eq('world_changed', true, output.hashes[0]?.changed),
      ok(
        'every_change_is_in_the_delta',
        outcome.delta.every((change) => change.path.startsWith('entity/')),
        '모든 변화가 세계 좌표로 적힌다',
        outcome.delta.map((change) => change.path),
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    (output.outcomes[0] as TransactionOutcome).delta.map(describeDelta).join('\n'),
    '델타에 없는 변화는 K3 이 사건으로 기록할 수 없다 — 그것이 곧 GI-01(사건 없는 상태 변경) 위반이다. 그래서 효과를 적용하는 자리가 델타를 만드는 유일한 자리다.',
  ],
});

// ---------------------------------------------------------------------------
// 3. 규칙 우선순위 사다리
// ---------------------------------------------------------------------------
const ruleMatchingFollowsThePriorityLadder = defineScene({
  id: 'rule_matching_follows_the_priority_ladder',
  title: '두 규칙이 함께 맞으면 더 국소적인 예외(L4)가 기본 규칙(L1)을 대신한다',
  seed: 303n,
  arrange: () => ({
    world,
    rules: RULES,
    intents: [strike(0, 'hunter_a', 'beast_ka'), strike(1, 'blessed_knight', 'beast_ka')],
  }),
  check: (input, output) => {
    const plain = output.outcomes[0] as TransactionOutcome;
    const blessed = output.outcomes[1] as TransactionOutcome;
    const store = replayWorld(input);

    return [
      eq('plain_actor_uses_the_base_rule', 'l1_strike', plain.appliedRuleId),
      eq('blessed_actor_uses_the_local_exception', 'l4_border_blessing', blessed.appliedRuleId),
      eq(
        'all_three_rules_allowed_the_blessed_actor',
        ['l1_living_only', 'l1_strike', 'l4_border_blessing'],
        blessed.matches.filter((match) => match.matched && match.allowed === true).map((match) => match.ruleId).sort(),
        'l1_living_only 은 비용·효과가 없는 제약 규칙이라 골라지지 않는다',
      ),
      eq('blessing_is_cheaper', { current: 9 }, store.component('blessed_knight', 'energy'), '10 − 1'),
      eq('plain_cost_is_three', { current: 7 }, store.component('hunter_a', 'energy')),
      eq(
        'rules_are_reviewed_in_authority_order',
        ['L1', 'L1', 'L4', 'L4', 'L5', 'L6', 'L6'],
        plain.matches.map((match) => match.scope),
        'scope 오름차순 · priority 내림차순 · id 오름차순',
      ),
      eq('emitted_phenomenon_differs', ['blessed_strike_glow'], blessed.emitted.map((phenomenon) => phenomenon.id)),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    (output.outcomes[1] as TransactionOutcome).matches
      .map((match) => `${match.scope} ${match.ruleId}: 맞음=${match.matched} 허용=${match.allowed}`)
      .join('\n'),
    '원본 15.1 은 “낮은 단계의 규칙은 높은 단계의 규칙이 허용하는 범위 안에서만 예외를 만들 수 있다”고 한다. 그래서 고르는 기준은 **가장 국소적인 것**(scope 번호가 큰 것)이다.',
    '검토 순서는 규칙집이 한 번 고정한다 — 선언 순서가 결과를 바꾸면 같은 세계가 서버마다 다르게 굴러간다.',
  ],
  candidates: (_input, output) =>
    (output.outcomes[1] as TransactionOutcome).matches.map((match) => ({
      label: `${match.scope} ${match.ruleId} (p${match.priority})`,
      value: `맞음 ${match.matched} · 허용 ${match.allowed ?? '-'}`,
    })),
});

// ---------------------------------------------------------------------------
// 4. 국소 예외는 상위 규칙의 선을 넘지 못한다
// ---------------------------------------------------------------------------
const localExceptionCannotBreakAMetaAxiom = defineScene({
  id: 'local_exception_cannot_break_a_meta_axiom',
  title: '죽은 자를 위한 지역 규칙(L4)이 있어도 “죽은 신체는 행동할 수 없다”(L1)를 넘지 못한다',
  seed: 304n,
  arrange: () => ({ world, rules: RULES, intents: [strike(0, 'dead_knight', 'beast_ka')] }),
  check: (input, output) => {
    const outcome = output.outcomes[0] as TransactionOutcome;
    const store = replayWorld(input);
    const undead = outcome.matches.find((match) => match.ruleId === 'l4_undead_rite');
    const living = outcome.matches.find((match) => match.ruleId === 'l1_living_only');

    return [
      eq('rejected', false, outcome.ok),
      eq('rejection_code', 'E_FORBIDDEN_BY_HIGHER_AUTHORITY', outcome.rejection?.code),
      eq('blocker_is_the_l1_rule', 'rule/l1_living_only/requires', outcome.rejection?.path),
      eq('local_rule_did_match_and_was_allowed', [true, true], [undead?.matched, undead?.allowed]),
      eq('higher_rule_matched_but_forbade', [true, false], [living?.matched, living?.allowed]),
      eq(
        'cause_points_at_the_health',
        ['actor.health.current'],
        outcome.rejection?.causes.map((cause) => cause.at),
        '무엇이 그 선을 긋는지가 남는다',
      ),
      eq('nothing_changed', false, output.hashes[0]?.changed),
      eq('beast_is_untouched', { current: 900, max: 900 }, store.component('beast_ka', 'health')),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    (output.outcomes[0] as TransactionOutcome).matches
      .filter((match) => match.matched)
      .map((match) => `${match.scope} ${match.ruleId}: 허용=${match.allowed} ${match.causes.map((cause) => cause.reason).join(' · ')}`)
      .join('\n'),
    'L4 규칙은 스스로의 조건을 모두 만족한다. 그런데도 성립하지 않는 이유는 더 권위 있는 L1 규칙이 이 의도에 대해 조건을 어겼기 때문이다 — 예외는 상위 규칙이 허용하는 범위 안에서만 가능하다.',
  ],
});

// ---------------------------------------------------------------------------
// 5. 옮기기는 총량을 지킨다
// ---------------------------------------------------------------------------
const transferConservesTheTotal = defineScene({
  id: 'transfer_conserves_the_total',
  title: '동전을 옮겨도 세계의 총량은 늘지도 줄지도 않고, 낼 수 없으면 받는 쪽도 늘지 않는다',
  seed: 305n,
  arrange: () => ({
    world,
    rules: RULES,
    intents: [
      { id: 'pay_0', actor: 'hunter_a', verb: 'pay', targets: ['beast_ka'] },
      { id: 'pay_1', actor: 'hunter_a', verb: 'pay', targets: ['beast_ka'] },
      { id: 'pay_2', actor: 'hunter_a', verb: 'pay', targets: ['beast_ka'] },
    ],
  }),
  check: (input, output) => {
    const before = buildWorld(input.world);
    const after = replayWorld(input);
    const third = output.outcomes[2] as TransactionOutcome;

    return [
      eq('two_succeed_one_fails', [true, true, false], output.outcomes.map((outcome) => outcome.ok)),
      eq('total_is_conserved', totalOf(before, 'purse', 'coins'), totalOf(after, 'purse', 'coins')),
      eq('payer_is_down_to_two', { coins: 2 }, after.component('hunter_a', 'purse'), '12 − 5 − 5'),
      eq('payee_is_up_to_ten', { coins: 10 }, after.component('beast_ka', 'purse')),
      eq('third_payment_is_unaffordable', 'E_UNAFFORDABLE_COST', third.rejection?.code),
      eq(
        'failed_transfer_did_not_credit_the_payee',
        { coins: 10 },
        after.component('beast_ka', 'purse'),
        '내보내는 쪽을 먼저 깎으므로 받는 쪽이 먼저 늘 수 없다',
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (input, output) => [
    `총량 ${totalOf(buildWorld(input.world), 'purse', 'coins')} → ${totalOf(replayWorld(input), 'purse', 'coins')}`,
    'transfer 는 내보내는 쪽을 먼저 깎는다. 받는 쪽을 먼저 늘리면, 내보내는 쪽이 모자라 멈추는 순간 세계에 없던 동전이 생긴다.',
    `세 번째 지불은 남은 2 로 5 를 낼 수 없어 거부되었다: ${output.outcomes[2]?.rejection?.path}`,
  ],
});

// ---------------------------------------------------------------------------
// 6. 다루는 규칙이 없으면 거부하고 이유를 남긴다
// ---------------------------------------------------------------------------
const unknownVerbIsRejectedWithACause = defineScene({
  id: 'unknown_verb_is_rejected_with_a_cause',
  title: '규칙 없는 행동·없는 행위자·사거리 밖은 각각 다른 이유로 거부된다',
  seed: 306n,
  arrange: () => ({
    world,
    rules: RULES,
    intents: [
      { id: 'sing', actor: 'hunter_a', verb: 'sing', targets: [] },
      { id: 'ghost_acts', actor: 'no_such_hunter', verb: 'strike', targets: ['beast_ka'] },
      { id: 'strike_far', actor: 'hunter_a', verb: 'strike', targets: ['far_beast'] },
      { id: 'charge_far', actor: 'hunter_a', verb: 'charge', targets: ['far_beast'] },
    ],
  }),
  check: (input, output) => {
    const store = replayWorld(input);
    const outcome = (id: string): TransactionOutcome | undefined =>
      output.outcomes.find((entry) => entry.intentId === id);

    return [
      eq('all_rejected', [false, false, false, false], output.outcomes.map((entry) => entry.ok)),
      eq('no_rule', 'E_NO_RULE_FOR_INTENT', outcome('sing')?.rejection?.code),
      eq('unknown_actor', 'E_UNKNOWN_ACTOR', outcome('ghost_acts')?.rejection?.code),
      eq('out_of_reach', 'E_REQUIRES_UNMET', outcome('strike_far')?.rejection?.code),
      eq(
        'reach_cause_names_the_distance',
        ['actor↔target'],
        outcome('strike_far')?.rejection?.causes.map((cause) => cause.at),
      ),
      eq('energy_untouched', { current: 10 }, store.component('hunter_a', 'energy'), '거부는 비용을 치르지 않는다'),
      eq(
        'declared_failure_effect_did_apply',
        true,
        store.get('hunter_a')?.tags.includes('stumbled'),
        '실패 효과를 선언한 규칙만 실패해도 흔적을 남긴다',
      ),
      eq(
        'failure_effect_is_recorded_in_the_delta',
        ['entity/hunter_a/tags'],
        outcome('charge_far')?.delta.map((change) => change.path),
      ),
      eq(
        'failure_effect_is_not_a_cost_or_effect',
        [0, 0],
        [outcome('charge_far')?.costDelta.length, outcome('charge_far')?.effectDelta.length],
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.outcomes
      .map((outcome) => `${outcome.intentId}: ${outcome.rejection?.code} @ ${outcome.rejection?.path}`)
      .join('\n'),
    '실패해도 세계가 바뀌는 유일한 경로는 규칙이 `failureEffects` 를 **미리 선언**한 경우다. 그 변화도 델타에 남으므로 기록 없는 상태 변경이 아니다 (GI-01).',
  ],
});

// ---------------------------------------------------------------------------
// 7. 같은 의도는 같은 델타를 낸다
// ---------------------------------------------------------------------------
const identicalIntentProducesIdenticalDelta = defineScene({
  id: 'identical_intent_produces_identical_delta',
  title: '같은 세계·같은 규칙집·같은 의도면 언제나 같은 델타와 같은 규칙이 나온다',
  seed: 307n,
  arrange: () => ({
    world,
    rules: RULES,
    intents: [strike(0, 'hunter_a', 'beast_ka'), { id: 'swear_0', actor: 'hunter_a', verb: 'swear', targets: [] }],
  }),
  check: (input, output) => {
    const rerun = executeK2(input);
    // 규칙 선언 순서를 뒤집어도 같은 결과가 나와야 한다.
    const shuffled = executeK2({ ...input, rules: [...RULES].reverse() });
    const store = replayWorld(input);
    const swear = output.outcomes[1] as TransactionOutcome;

    return [
      eq('rerun_is_identical', output.digest, rerun.digest),
      eq('rule_order_does_not_matter', output.digest, shuffled.digest),
      eq('rule_book_hash_is_order_independent', output.ruleBookHash, shuffled.ruleBookHash),
      eq('commitment_was_created', { open: ['oath_of_protection'], breached: [] }, store.component('hunter_a', 'commitments')),
      eq('tag_was_attached', true, store.get('hunter_a')?.tags.includes('sworn')),
      eq(
        'scheduled_event_is_handed_to_k3',
        [{ eventTemplateId: 'oath_reminder', delayTicks: 5 }],
        swear.scheduled,
        'K2 는 예약만 하고 일으키지 않는다',
      ),
      eq('schedule_did_not_change_state', 3, swear.delta.length, '에너지 · 약속 · 태그 셋뿐 — 예약은 델타에 없다'),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `digest ${output.digest}`,
    `규칙집 해시 ${output.ruleBookHash}`,
    '규칙집은 만들 때 권위 순서로 한 번 정렬한다. 그래서 선언 순서가 달라도 같은 규칙집이고, 같은 세계에서 같은 델타가 나온다 (GI-12).',
  ],
  candidates: (_input, output) =>
    output.outcomes.flatMap((outcome) =>
      outcome.delta.map((change) => ({ label: outcome.intentId, value: describeDelta(change) })),
    ),
});

export const k2Scenarios: VerificationScenario<K2Input, K2Output>[] = [
  attackFailsWhenEnergyIsShort,
  attackSucceedsAndPaysItsCost,
  ruleMatchingFollowsThePriorityLadder,
  localExceptionCannotBreakAMetaAxiom,
  transferConservesTheTotal,
  unknownVerbIsRejectedWithACause,
  identicalIntentProducesIdenticalDelta,
];
