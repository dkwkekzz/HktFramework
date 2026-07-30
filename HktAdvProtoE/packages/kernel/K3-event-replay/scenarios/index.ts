import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { ComponentRegistry } from '@hkt/k0-entity-state';
import { RuleBook } from '@hkt/k2-rule-transaction';
import { applyStateDeltas } from '../src/delta.js';
import { WorldRuntime, resimulate } from '../src/runtime.js';
import { buildWorld, driveTicks, driveWorld, executeK3, K3_PURPOSE, validateOutput } from '../src/module.js';
import type { K3Input, K3Output } from '../src/module.js';
import type { WorldEvent } from '../src/types.js';
import { COMPONENT_DEFINITIONS, DRIVER_CANDIDATES, RULES, SHRINE_CANYON, TEMPLATES } from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): K3Input;
  check(input: K3Input, output: K3Output, context: ModuleContext): AssertionResult[];
  reasons(input: K3Input, output: K3Output): string[];
  candidates?(input: K3Input, output: K3Output): LabRow[];
  result?(output: K3Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<K3Input, K3Output> {
  /**
   * 판정 결과를 출력에 매달아 기억한다.
   *
   * `runScenario` 는 `assert` 와 `toLabView` 를 잇달아 부르고, 두 곳 모두 같은 판정을 필요로 한다.
   * K3 의 대표 장면은 1,000틱을 굴리고 재생까지 하므로, 그대로 두면 같은 일을 두 번 한다.
   */
  const memo = new WeakMap<K3Output, AssertionResult[]>();
  const check = (input: K3Input, output: K3Output, context: ModuleContext): AssertionResult[] => {
    const cached = memo.get(output);
    if (cached) return cached;
    const assertions = spec.check(input, output, context);
    memo.set(output, assertions);
    return assertions;
  };

  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeK3(input),
    assert: check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = check(input, output, context);
      return {
        purpose: K3_PURPOSE,
        input: [
          { label: '세계 시드', value: input.worldSeed },
          { label: '규칙집', value: input.rules.map((rule) => `${rule.scope}/${rule.id}`).join(' · ') },
          {
            label: '굴림',
            value: input.driver
              ? `${input.driver.ticks}틱 · 후보 ${input.driver.candidates.map((candidate) => candidate.verb).join(', ')}`
              : `손으로 적은 의도 ${(input.intents ?? []).length}개`,
          },
        ],
        candidates:
          spec.candidates?.(input, output) ??
          [
            { label: '사건 수', value: `${output.events.length} (거부 ${output.rejected})` },
            { label: '사건 해시', value: output.logHash },
            { label: '로그로 되짚은 상태', value: output.replayedStoreHash },
            { label: '실제 상태', value: output.storeHash },
            { label: '재시뮬레이션 사건 해시', value: output.resimulatedLogHash },
            { label: '스냅샷 · 복원', value: `${output.snapshotHash} · ${output.restoredSnapshotHash}` },
          ],
        result:
          spec.result?.(output) ??
          `틱 ${output.finalTick} · 사건 ${output.events.length} · 해시 ${output.logHash.slice(0, 21)}…`,
        reasons: spec.reasons(input, output),
        before: `틱 0 · 사건 0`,
        after: `틱 ${output.finalTick} · 사건 ${output.events.length} · 상태 ${output.storeHash.slice(0, 21)}…`,
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

const world = { components: COMPONENT_DEFINITIONS, operations: SHRINE_CANYON };
const registry = ComponentRegistry.of(COMPONENT_DEFINITIONS);
const base = (): Omit<K3Input, 'intents' | 'driver'> => ({
  world,
  rules: RULES,
  worldSeed: '20260730',
  templates: TEMPLATES,
});

const at = (tick: number, id: string, actor: string, verb: string, targets: string[] = []) => ({
  tick,
  intent: { id, actor, verb, targets },
});

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 1,000틱을 굴리고 재생한다
// ---------------------------------------------------------------------------
const thousandTicksReplayIsIdentical = defineScene({
  id: 'thousand_ticks_replay_is_identical',
  title: '1,000틱을 굴린 뒤 재생한 최종 상태와 사건 해시가 완전히 같다',
  seed: 401n,
  arrange: () => ({ ...base(), driver: { candidates: DRIVER_CANDIDATES, ticks: 1000 } }),
  check: (_input, output) => [
    eq('ran_a_thousand_ticks', 1000, output.finalTick),
    ok('something_actually_happened', output.events.length > 100, '사건 100건 초과', output.events.length),
    ok('rejections_are_mixed_in', output.rejected > 0, '거부도 섞였다', output.rejected),
    eq('resimulated_log_hash_is_identical', output.logHash, output.resimulatedLogHash, 'GI-12 — 같은 사건 순서'),
    eq('resimulated_store_hash_is_identical', output.storeHash, output.resimulatedStoreHash, 'GI-12 — 같은 최종 상태'),
    eq('log_replay_reproduces_the_state', output.storeHash, output.replayedStoreHash, 'GI-01 — 모든 변화에 원인 사건이 있다'),
    eq('snapshot_round_trips', output.snapshotHash, output.restoredSnapshotHash),
    eq('audit_has_no_violation', [], output.audit.violations.map((violation) => violation.code)),
    eq('store_audit_is_clean', [], output.audit.storeIssues.map((issue) => issue.code)),
    eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
  ],
  reasons: (_input, output) => [
    `1,000틱 동안 의도 ${output.accepted + output.rejected}건 중 ${output.accepted}건이 사건이 되고 ${output.rejected}건이 거부되었다.`,
    `사건 해시 ${output.logHash}`,
    '재생을 두 갈래로 확인한다. ① 사건에 **적힌 결과**만 되짚어 최종 상태를 다시 만든다(GI-01). ② 일지를 **원인부터** 다시 굴려 사건 해시를 다시 만든다(GI-12). 둘 다 같은 곳에 도착해야 한다.',
  ],
  candidates: (_input, output) => [
    { label: '틱 · 사건 · 거부', value: `${output.finalTick} · ${output.events.length} · ${output.rejected}` },
    { label: '① 로그로 되짚은 상태', value: `${output.replayedStoreHash} ${output.replayedStoreHash === output.storeHash ? '= 실제 상태' : '≠ 실제 상태'}` },
    { label: '② 다시 굴린 사건 해시', value: `${output.resimulatedLogHash} ${output.resimulatedLogHash === output.logHash ? '= 원본' : '≠ 원본'}` },
    { label: '② 다시 굴린 최종 상태', value: `${output.resimulatedStoreHash} ${output.resimulatedStoreHash === output.storeHash ? '= 원본' : '≠ 원본'}` },
    { label: '스냅샷 왕복', value: `${output.snapshotHash === output.restoredSnapshotHash ? '같다' : '달라졌다'}` },
    { label: '남은 예약', value: `${output.pending.length}건` },
  ],
  result: (output) =>
    `사건 ${output.events.length}건 · 해시 ${output.logHash} · 재생 ${output.resimulatedLogHash === output.logHash ? '일치' : '불일치'}`,
});

// ---------------------------------------------------------------------------
// 2. GI-01 — 사건 없는 상태 변경은 없다
// ---------------------------------------------------------------------------
const everyChangeHasACausingEvent = defineScene({
  id: 'every_change_has_a_causing_event',
  title: '사건 로그에 적힌 변화만 되짚어도 최종 상태가 그대로 나온다',
  seed: 402n,
  arrange: () => ({
    ...base(),
    intents: [
      at(1, 'i0', 'hunter_a', 'strike', ['beast_ka']),
      at(2, 'i1', 'hunter_a', 'pray', ['border_shrine']),
      at(3, 'i2', 'hunter_a', 'rest'),
      at(4, 'i3', 'hunter_a', 'strike', ['beast_ka']),
    ],
  }),
  check: (input, output) => {
    const initial = buildWorld(input.world);
    const replayed = output.events.reduce((store, event) => applyStateDeltas(store, event.stateDelta), initial);

    return [
      eq('replayed_equals_actual', output.storeHash, replayed.hash()),
      eq('log_replay_hash_matches', output.storeHash, output.replayedStoreHash),
      ok(
        'every_event_carries_a_change',
        output.events.every((event) => event.stateDelta.length > 0),
        '변화 없는 사건은 로그에 없다',
        output.events.map((event) => event.stateDelta.length),
      ),
      ok(
        'every_event_names_its_rule_and_intent',
        output.events.every((event) => event.appliedRuleIds.length > 0 && event.intentIds.length > 0),
        '사건마다 규칙과 의도가 적혀 있다',
        output.events.map((event) => [event.appliedRuleIds, event.intentIds]),
      ),
      ok(
        'affected_entities_are_derived_from_the_delta',
        output.events.every((event) =>
          event.affectedEntityIds.every((id) => event.stateDelta.some((change) => change.path.startsWith(`entity/${id}/`))),
        ),
        '건드린 실체가 델타에서 나온다',
        output.events.map((event) => event.affectedEntityIds),
      ),
      eq('audit_says_so', true, output.audit.everyChangeHasAnEvent),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.events
      .map((event) => `${event.tick}틱 ${event.id} ← ${event.appliedRuleIds.join(', ')} · ${event.stateDelta.map((change) => change.path).join(', ')}`)
      .join('\n'),
    '되짚을 때 규칙을 다시 돌리지 않는다 — 사건에 **적힌 결과**만 넣는다. 규칙을 다시 돌리면 "규칙이 바뀌어도 옛 로그가 재생된다"는 성질을 잃는다.',
  ],
  candidates: (_input, output) =>
    output.events.map((event) => ({
      label: `${event.tick}틱 ${event.id}`,
      value: event.stateDelta.map((change) => `${change.path} ${JSON.stringify(change.before)}→${JSON.stringify(change.after)}`).join(' · '),
    })),
});

// ---------------------------------------------------------------------------
// 3. 거부는 사건을 남기지 않는다
// ---------------------------------------------------------------------------
const rejectedIntentLeavesNoEvent = defineScene({
  id: 'rejected_intent_leaves_no_event',
  title: '거부된 의도는 사건도 상태 변화도 남기지 않는다',
  seed: 403n,
  arrange: () => ({
    ...base(),
    intents: [
      at(1, 'ok_0', 'hunter_a', 'strike', ['beast_ka']),
      at(2, 'no_rule', 'hunter_a', 'sing'),
      at(3, 'no_actor', 'nobody', 'strike', ['beast_ka']),
      at(4, 'ok_1', 'hunter_a', 'strike', ['beast_ka']),
      at(5, 'ok_2', 'hunter_a', 'strike', ['beast_ka']),
      at(6, 'too_poor', 'hunter_a', 'strike', ['beast_ka']),
    ],
  }),
  check: (input, output) => {
    const { runtime } = driveWorld(input);
    const store = runtime.store;

    return [
      eq('six_intents_three_events', [6, 3], [output.accepted + output.rejected, output.events.length]),
      eq('rejected_count', 3, output.rejected),
      eq('only_successful_intents_are_in_the_log', ['ok_0', 'ok_1', 'ok_2'], output.events.flatMap((event) => event.intentIds)),
      eq('energy_ends_at_one', { current: 1 }, store.component('hunter_a', 'energy'), '10 − 3×3 = 1'),
      eq('damage_is_thirty', { current: 870, max: 900 }, store.component('beast_ka', 'health')),
      eq('log_replay_still_matches', output.storeHash, output.replayedStoreHash),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `의도 ${output.accepted + output.rejected}건 중 사건이 된 것은 ${output.events.length}건이다.`,
    '거부된 의도는 세계를 바꾸지 않았으므로 남길 사건도 없다. 일지에는 남으므로 "무엇을 시도했다가 왜 막혔는가"는 그대로 재생된다.',
  ],
  candidates: (_input, output) =>
    output.events.map((event) => ({ label: `${event.tick}틱`, value: `${event.id} ← ${event.intentIds.join(', ')}` })),
});

// ---------------------------------------------------------------------------
// 4. 예약된 사건은 제 틱에 일어난다
// ---------------------------------------------------------------------------
const scheduledEventFiresAtItsTick = defineScene({
  id: 'scheduled_event_fires_at_its_tick',
  title: '기도가 예약한 축복이 정확히 3틱 뒤에 스스로 일어난다',
  seed: 404n,
  arrange: () => ({
    ...base(),
    intents: [at(1, 'pray_0', 'hunter_a', 'pray', ['border_shrine'])],
    driver: { candidates: [{ actor: 'hunter_a', verb: 'rest', targets: [] }], ticks: 5 },
  }),
  check: (input, output) => {
    const { runtime } = driveWorld(input);
    const blessing = output.events.find((event) => event.appliedRuleIds.includes('l4_blessing'));
    const prayer = output.events.find((event) => event.appliedRuleIds.includes('l6_pray'));

    return [
      ok('the_blessing_did_fall', blessing !== undefined, '축복 사건이 있다', blessing?.id),
      eq('it_fell_three_ticks_later', (prayer?.tick ?? 0) + 3, blessing?.tick),
      eq('it_names_the_prayer_as_its_cause', [prayer?.id], blessing?.causeEventIds, '예약을 만든 사건이 원인으로 적힌다'),
      eq('marks_are_one_plus_five', { count: 6 }, runtime.store.component('border_shrine', 'marks')),
      eq('nothing_is_left_pending', 0, output.pending.length),
      eq('resimulation_fires_it_again_the_same_way', output.logHash, output.resimulatedLogHash, '예약도 재생된다'),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.events.map((event) => `${event.tick}틱 ${event.appliedRuleIds.join(', ')} (${event.id})`).join('\n'),
    '예약은 K2 가 만들고 K3 이 일으킨다. 무엇을 하는지도 데이터(`ScheduledEventTemplate`)로 적으므로 스냅샷을 뜰 수 있고 재생된다.',
    '재시뮬레이션에서 예약 의도를 일지에서 다시 제출하지 않는다 — 틱이 흐르면 스스로 다시 태어나므로, 다시 제출하면 같은 축복이 두 번 내린다.',
  ],
  candidates: (_input, output) =>
    output.events.map((event) => ({
      label: `${event.tick}틱 ${event.id}`,
      value: `${event.appliedRuleIds.join(', ')} · 원인 ${event.causeEventIds.join(', ') || '없음'} · ${event.emittedPhenomena.map((phenomenon) => phenomenon.id).join(', ')}`,
    })),
});

// ---------------------------------------------------------------------------
// 5. 스냅샷으로 중간부터 이어 간다
// ---------------------------------------------------------------------------
const snapshotResumesFromTheMiddle = defineScene({
  id: 'snapshot_resumes_from_the_middle',
  title: '중간에서 뜬 스냅샷으로 되살려 이어 굴리면 통째로 굴린 것과 같은 곳에 도착한다',
  seed: 405n,
  arrange: () => ({ ...base(), driver: { candidates: DRIVER_CANDIDATES, ticks: 40 } }),
  check: (input, output) => {
    // 앞 20틱만 굴린 뒤 스냅샷을 뜬다.
    const half = driveWorld({ ...input, driver: { candidates: DRIVER_CANDIDATES, ticks: 20 } });
    const snapshot = half.runtime.snapshot();

    // 스냅샷에서 되살린다. 이어 굴리기 전에 되살아난 자리를 먼저 확인한다.
    const resumed = WorldRuntime.restore(snapshot, RuleBook.of(input.rules), registry, TEMPLATES);
    const resumedTick = resumed.tick;
    const resumedLogHash = resumed.logHash();

    // 통째로 굴린 40틱과, 스냅샷에서 이어 굴린 20+20틱을 나란히 둔다.
    const rest = driveWorld({ ...input, driver: { candidates: DRIVER_CANDIDATES, ticks: 40 } });
    const continued = driveTicks(resumed, input.worldSeed, input.driver as NonNullable<K3Input['driver']>, 20);

    return [
      eq('snapshot_round_trips', snapshot.hash, WorldRuntime.restore(snapshot, RuleBook.of(input.rules), registry, TEMPLATES).snapshot().hash),
      eq('resumed_tick_matches', 20, resumedTick),
      eq('resumed_log_matches_the_first_half', half.runtime.logHash(), resumedLogHash),
      eq('continued_reaches_the_same_place', rest.runtime.store.hash(), continued.store.hash(), '이어 굴린 세계 = 통째로 굴린 세계'),
      eq('continued_log_matches', rest.runtime.logHash(), continued.logHash()),
      eq('whole_run_is_the_output', output.storeHash, rest.runtime.store.hash()),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (input, output) => {
    const half = driveWorld({ ...input, driver: { candidates: DRIVER_CANDIDATES, ticks: 20 } });
    return [
      `20틱 스냅샷 ${half.runtime.snapshot().hash}`,
      `40틱 통째 ${output.storeHash}`,
      '스냅샷에는 상태뿐 아니라 시계·ID 발급기·예약 대기열·일지가 함께 들어간다. 하나라도 빠지면 이어 굴린 세계가 갈라진다 — 특히 ID 순번이 빠지면 사건 id 가 겹친다.',
    ];
  },
});

// ---------------------------------------------------------------------------
// 6. 로그는 덧붙이기만 된다
// ---------------------------------------------------------------------------
const eventLogIsAppendOnly = defineScene({
  id: 'event_log_is_append_only',
  title: '사건 id 는 겹치지 않고 틱은 뒤로 가지 않으며, 다시 굴려도 같은 id 가 나온다',
  seed: 406n,
  arrange: () => ({ ...base(), driver: { candidates: DRIVER_CANDIDATES, ticks: 60 } }),
  check: (input, output) => {
    const again = driveWorld(input);
    const ticks = output.events.map((event) => event.tick);

    return [
      eq('ids_are_unique', output.events.length, new Set(output.events.map((event) => event.id)).size),
      eq('ticks_never_go_backwards', ticks, [...ticks].sort((a, b) => a - b)),
      ok(
        'ids_follow_the_deterministic_format',
        output.events.every((event) => /^event_[0-9a-f]{12}$/.test(event.id)),
        '<종류>_<해시12>',
        output.events.slice(0, 3).map((event) => event.id),
      ),
      eq(
        'rerunning_gives_the_same_ids',
        output.events.map((event) => event.id),
        again.runtime.log().map((event: WorldEvent) => event.id),
        'UUID v4 였다면 매번 달라져 로그를 대조할 수 없다',
      ),
      eq('audit_says_append_only', true, output.audit.logIsAppendOnly),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `사건 ${output.events.length}건 · 첫 id ${output.events[0]?.id} · 마지막 id ${output.events[output.events.length - 1]?.id}`,
    '사건 id 는 `세계 시드 + 종류 + 순번` 의 해시다. 난수 기반이면 재생할 때마다 달라져 두 로그를 대조할 수 없다.',
  ],
  candidates: (_input, output) =>
    output.events.slice(0, 8).map((event) => ({ label: `${event.tick}틱`, value: event.id })),
});

// ---------------------------------------------------------------------------
// 7. 감사가 위반의 자리를 지목한다
// ---------------------------------------------------------------------------
const invariantAuditPointsAtTheViolation = defineScene({
  id: 'invariant_audit_points_at_the_violation',
  title: '사건 없이 세계를 고치면 감사가 그 사실을 잡아내고 어디가 어긋났는지 말한다',
  seed: 407n,
  arrange: () => ({
    ...base(),
    intents: [at(1, 'i0', 'hunter_a', 'strike', ['beast_ka']), at(2, 'i1', 'hunter_a', 'rest')],
  }),
  check: (input, output) => {
    const { runtime, initial } = driveWorld(input);
    const clean = runtime.audit(initial);

    // 사건을 남기지 않고 세계를 몰래 고친 상태를 만든다 (GI-01 위반).
    const tampered = WorldRuntime.restore(
      { ...runtime.snapshot(), store: runtime.store.setComponent('hunter_a', 'energy', { current: 999 }).snapshot() },
      RuleBook.of(input.rules),
      registry,
      TEMPLATES,
    );
    const tamperedReport = tampered.audit(initial);

    // 사건을 하나 지운 로그도 같은 방식으로 걸린다.
    const truncated = WorldRuntime.restore(
      { ...runtime.snapshot(), log: runtime.log().slice(0, -1) },
      RuleBook.of(input.rules),
      registry,
      TEMPLATES,
    );
    const truncatedReport = truncated.audit(initial);

    return [
      eq('clean_world_passes', [], clean.violations.map((violation) => violation.code)),
      eq('clean_world_flags', [true, true], [clean.everyChangeHasAnEvent, clean.logIsAppendOnly]),
      eq(
        'tampering_is_caught',
        ['E_UNEXPLAINED_STATE_CHANGE'],
        tamperedReport.violations.map((violation) => violation.code),
        'GI-01 — 사건 없는 상태 변경 금지',
      ),
      ok(
        'the_report_names_both_hashes',
        tamperedReport.violations[0]?.message.includes(tamperedReport.replayedStoreHash) === true &&
          tamperedReport.violations[0]?.message.includes(tamperedReport.storeHash) === true,
        '되짚은 상태와 실제 상태를 함께 적는다',
        tamperedReport.violations[0]?.message,
      ),
      eq('deleting_an_event_is_caught_too', ['E_UNEXPLAINED_STATE_CHANGE'], truncatedReport.violations.map((violation) => violation.code)),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (input, _output) => {
    const { runtime, initial } = driveWorld(input);
    const tampered = WorldRuntime.restore(
      { ...runtime.snapshot(), store: runtime.store.setComponent('hunter_a', 'energy', { current: 999 }).snapshot() },
      RuleBook.of(input.rules),
      registry,
      TEMPLATES,
    );
    return [
      tampered.audit(initial).violations.map((violation) => `${violation.code} @ ${violation.path} — ${violation.message}`).join('\n'),
      '감사는 "누가 고쳤는지"를 묻지 않는다. **사건 로그만으로 지금 상태를 다시 만들 수 있는가**를 물을 뿐이고, 만들 수 없으면 어딘가에서 사건 없이 세계가 바뀐 것이다.',
    ];
  },
  candidates: (input, _output) => {
    const { runtime, initial } = driveWorld(input);
    const clean = runtime.audit(initial);
    const tampered = WorldRuntime.restore(
      { ...runtime.snapshot(), store: runtime.store.setComponent('hunter_a', 'energy', { current: 999 }).snapshot() },
      RuleBook.of(input.rules),
      registry,
      TEMPLATES,
    ).audit(initial);
    return [
      { label: '정상 세계 — 되짚은 상태', value: clean.replayedStoreHash },
      { label: '정상 세계 — 실제 상태', value: `${clean.storeHash} (같다)` },
      { label: '조작된 세계 — 되짚은 상태', value: tampered.replayedStoreHash },
      { label: '조작된 세계 — 실제 상태', value: `${tampered.storeHash} (다르다)` },
      { label: '판정', value: tampered.violations.map((violation) => violation.code).join(', ') },
    ];
  },
});

export const k3Scenarios: VerificationScenario<K3Input, K3Output>[] = [
  thousandTicksReplayIsIdentical,
  everyChangeHasACausingEvent,
  rejectedIntentLeavesNoEvent,
  scheduledEventFiresAtItsTick,
  snapshotResumesFromTheMiddle,
  eventLogIsAppendOnly,
  invariantAuditPointsAtTheViolation,
];
