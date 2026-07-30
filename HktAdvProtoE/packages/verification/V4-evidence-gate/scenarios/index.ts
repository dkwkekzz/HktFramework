import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  ModuleContractDocument,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import { ScenarioRunner, showValue } from '@hkt/v3-scenario-runner';
import type { JsonObject, ScenarioReport, ScenarioSpec, StepCall } from '@hkt/v3-scenario-runner';
import { evidenceHash, type EvidenceDocument } from '../src/evidence.js';
import { V4_STEPS } from '../src/steps.js';
import { checkOutputConsistency, executeV4, V4_PURPOSE } from '../src/module.js';
import type { V4Input, V4Output } from '../src/module.js';
import { CHAIN, CHAIN_IDS, chainState, fullPassMeasurement, issueAll, slicePendingMeasurement } from './fixtures.js';

/**
 * V4 의 대표 장면.
 *
 * 장면 자체가 Given-When-Then 이다 — *"검증된 모듈이 있다 / 선행의 계약을 바꾼다 / 하위가 BLOCKED 가 된다."*
 * 그래서 V3(scenario-runner)로 굴린다. 실행기와 판정기를 따로 만들면 둘 중 무엇이 틀렸는지 알 수 없다.
 */

const runner = new ScenarioRunner({ steps: V4_STEPS });

const BASE_SEED = { worldSeed: '20260730', subjectId: 'v4_gate' } as const;

function gwt(id: string, title: string, state: JsonObject, when: StepCall[], then: ScenarioSpec['then']): ScenarioSpec {
  return { id, title, given: { state }, when, then, seed: { ...BASE_SEED } };
}

/** 장면의 최종 상태에서 V4 가 실제로 받을 입력을 꺼낸다. */
function inputFrom(report: ScenarioReport): V4Input {
  const contracts = (report.final['contracts'] ?? {}) as Record<string, string>;
  const evidences = (report.final['evidences'] ?? {}) as Record<string, unknown>;
  return {
    contracts: Object.keys(contracts)
      .sort()
      .map((id): ModuleContractDocument => ({
        path: `packages/synthetic/${id}-${nameOf(contracts[id] as string)}/MODULE.yaml`,
        text: contracts[id] as string,
      })),
    evidences: Object.keys(evidences)
      .sort()
      .map((id) => evidences[id] as EvidenceDocument),
    regressionFailures: 0,
    requiredSlices: ['VS0'],
  };
}

function nameOf(text: string): string {
  return /^\s*name:\s*(\S+)/m.exec(text)?.[1] ?? 'unknown';
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

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  /** 이 장면의 Given-When-Then */
  spec: ScenarioSpec;
  check(input: V4Input, output: V4Output, report: ScenarioReport): AssertionResult[];
  reasons(output: V4Output, report: ScenarioReport): string[];
  candidates?(output: V4Output, report: ScenarioReport): LabRow[];
}

/** V3 의 단계별 전후를 그대로 「후보」 구획으로 옮긴다. */
function transitionRows(report: ScenarioReport): LabRow[] {
  if (report.issues.length > 0) {
    return report.issues.map((issue) => ({ label: `거부 ${issue.path}`, value: `${issue.code} · ${issue.message}` }));
  }
  return report.transitions.map((transition) => {
    const statuses = (transition.after['audit'] as JsonObject | null)?.['status'];
    return {
      label: `${transition.index}. ${transition.step} ${showValue((transition.params['moduleId'] ?? '') as string)}`,
      value: transition.error
        ? `오류 ${transition.error.message}`
        : transition.rejection
          ? `거부 ${transition.rejection.code} · ${transition.rejection.message}`
          : statuses === undefined
            ? transition.changes.map((change) => change.path).join(', ') || '변화 없음'
            : `상태 ${canonicalJson(statuses)}`,
    };
  });
}

function defineScene(scene: SceneSpec): VerificationScenario<V4Input, V4Output> {
  const report = (): ScenarioReport => runner.run(scene.spec);

  return {
    id: scene.id,
    title: scene.title,
    seed: scene.seed,
    arrange: () => inputFrom(report()),
    act: (input) => executeV4(input),
    assert: (input, output) => scene.check(input, output, report()),
    toLabView: (input, output, _context: ModuleContext): LabViewModel => {
      const run = report();
      const assertions = scene.check(input, output, run);
      const beforeAudit = firstAudit(run);
      return {
        purpose: V4_PURPOSE,
        input: [
          { label: 'Given', value: `모듈 ${Object.keys((run.given['contracts'] ?? {}) as JsonObject).join(', ')}` },
          { label: 'When', value: run.transitions.map((t) => `${t.index}.${t.step}`).join(' → ') || '단계 없음' },
          {
            label: 'Then',
            value: scene.spec.then.map((condition) => `${condition.path} ${condition.op} ${showValue(condition.value ?? null)}`).join(' · '),
          },
          { label: '검사한 모듈', value: output.audit.modules.map((module) => module.id).join(', ') },
        ],
        candidates: scene.candidates?.(output, run) ?? transitionRows(run),
        result: `${output.audit.modules.map((module) => `${module.id}=${module.effectiveStatus}`).join(' · ')}`,
        reasons: scene.reasons(output, run),
        before: beforeAudit === null ? '감사 전 (증거 없음)' : `상태 ${canonicalJson(beforeAudit)}`,
        after: `상태 ${canonicalJson(statusMap(output))} · 무효화 ${output.audit.invalidated.join(', ') || '없음'}`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

function statusMap(output: V4Output): JsonObject {
  const map: JsonObject = {};
  for (const module of output.audit.modules) map[module.id] = module.effectiveStatus;
  return map;
}

/** 장면에서 처음으로 감사가 돌아간 시점의 상태 — 화면의 「전」 구획이 된다. */
function firstAudit(report: ScenarioReport): JsonObject | null {
  for (const transition of report.transitions) {
    if (transition.step !== 'run_audit') continue;
    const audit = transition.after['audit'] as JsonObject | null;
    if (audit) return audit['status'] as JsonObject;
  }
  return null;
}

function auditStatus(report: ScenarioReport, moduleId: string): string {
  return String(((report.final['audit'] as JsonObject | null)?.['status'] as JsonObject)?.[moduleId] ?? '없음');
}

function reasonsOf(output: V4Output, moduleId: string): string[] {
  return output.audit.modules.find((module) => module.id === moduleId)?.reasons.map((reason) => reason.code) ?? [];
}

const TWO = CHAIN.slice(0, 2); // K2 → K3

// ---------------------------------------------------------------------------
// 1. 상태는 게이트에서만 나온다
// ---------------------------------------------------------------------------
const gatesDecideStatus = defineScene({
  id: 'gates_decide_status',
  title: '측정값 하나를 낮추면 상태가 사다리를 내려온다',
  seed: 41n,
  spec: gwt(
    'gates_decide_status',
    '전부 통과 → VERIFIED · 장면 하나가 실패하면 → UNIT_PASS',
    chainState(fullPassMeasurement, TWO),
    [
      ...issueAll(TWO),
      { step: 'run_audit', note: '전부 통과한 상태' },
      { step: 'set_measurement', params: { moduleId: 'K2', path: '/labScenarios/rule_rejects', value: 'failed' } },
      { step: 'issue_evidence', params: { moduleId: 'K2' }, note: '같은 코드, 낮아진 측정' },
      { step: 'run_audit', note: 'G4 가 막힌 뒤' },
    ],
    [
      { id: 'k2_verified_before', path: '/audit/status/K2', op: 'equals', value: 'VERIFIED', at: 2 },
      { id: 'k2_falls_to_unit_pass', path: '/audit/status/K2', op: 'equals', value: 'UNIT_PASS', at: 'final' },
      { id: 'k3_cannot_stay_verified', path: '/audit/status/K3', op: 'equals', value: 'SLICE_PASS', at: 'final' },
    ],
  ),
  check: (_input, output, report) => {
    const k2 = output.audit.modules.find((module) => module.id === 'K2');
    return [
      eq('gwt_conditions_all_passed', [true, true, true], report.conditions.map((condition) => condition.passed)),
      eq('status_before_change', 'VERIFIED', String((firstAudit(report) ?? {})['K2'])),
      eq('status_after_change', 'UNIT_PASS', auditStatus(report, 'K2')),
      eq('blocking_gate_is_g4', ['G4'], k2?.gates.filter((gate) => !gate.passed).map((gate) => gate.id)),
      ok('status_is_not_hand_written', k2?.declaredStatus === 'UNIT_PASS', 'UNIT_PASS', k2?.declaredStatus, '발급기가 게이트 판정으로 적었다'),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    '증거 발급기는 status 를 인자로 받지 않는다 — 게이트 판정에서만 나온다.',
    `막힌 게이트: ${output.audit.modules
      .flatMap((module) => module.gates.filter((gate) => !gate.passed).map((gate) => `${module.id}/${gate.id} ${gate.detail}`))
      .join(' · ') || '없음'}`,
  ],
});

// ---------------------------------------------------------------------------
// 2. 손으로 올린 상태는 감사가 잡는다
// ---------------------------------------------------------------------------
const evidenceCannotClaimStatusAboveGates = defineScene({
  id: 'evidence_cannot_claim_status_above_gates',
  title: '증거의 상태를 손으로 올려도 감사가 게이트 판정으로 되돌린다',
  seed: 42n,
  spec: gwt(
    'forged_status',
    '측정은 낮은데 status 만 VERIFIED 로 고친 증거',
    chainState(slicePendingMeasurement, TWO),
    [
      ...issueAll(TWO),
      { step: 'run_audit', note: '정직한 상태' },
      { step: 'forge_status', params: { moduleId: 'K2', status: 'VERIFIED' }, note: '손으로 올린다' },
      { step: 'run_audit', note: '감사 뒤' },
    ],
    [
      { id: 'honest_status', path: '/audit/status/K2', op: 'equals', value: 'LAB_PASS', at: 2 },
      { id: 'forged_status_is_reverted', path: '/audit/status/K2', op: 'equals', value: 'LAB_PASS', at: 'final' },
      { id: 'audit_reports_the_forgery', path: '/audit/reasons/K2', op: 'changed' },
    ],
  ),
  check: (_input, output, report) => {
    const k2 = output.audit.modules.find((module) => module.id === 'K2');
    return [
      eq('gwt_conditions_all_passed', [true, true, true], report.conditions.map((condition) => condition.passed)),
      eq('declared_status_is_the_forged_one', 'VERIFIED', k2?.declaredStatus),
      eq('effective_status_follows_gates', 'LAB_PASS', k2?.effectiveStatus),
      ok(
        'forgery_is_named',
        reasonsOf(output, 'K2').includes('E_STATUS_ABOVE_GATES'),
        'E_STATUS_ABOVE_GATES',
        reasonsOf(output, 'K2'),
      ),
      ok(
        'verified_without_slice_is_also_named',
        reasonsOf(output, 'K2').includes('E_VERIFIED_WITHOUT_SLICE'),
        'E_VERIFIED_WITHOUT_SLICE',
        reasonsOf(output, 'K2'),
        '원문 「23」: 증거 없이 VERIFIED 표시 금지',
      ),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    `증거에 적힌 상태(${output.audit.modules.find((module) => module.id === 'K2')?.declaredStatus})와 감사 상태(${output.audit.modules.find((module) => module.id === 'K2')?.effectiveStatus})가 다르면, 화면과 판단은 **감사 상태**를 쓴다.`,
    '증거 파일은 사람이 고칠 수 있는 텍스트다. 그래서 그 값을 그대로 믿지 않는다.',
  ],
});

// ---------------------------------------------------------------------------
// 3. 통합 슬라이스가 남아 있으면 VERIFIED 가 나오지 않는다
// ---------------------------------------------------------------------------
const verifiedWithoutSliceIsRefused = defineScene({
  id: 'verified_without_slice_is_refused',
  title: '수직 통합 시나리오가 통과하지 않으면 어떤 경우에도 VERIFIED 가 아니다',
  seed: 43n,
  spec: gwt(
    'slice_pending',
    'VS0 이 pending 인 저장소',
    chainState(slicePendingMeasurement, TWO),
    [...issueAll(TWO), { step: 'run_audit' }],
    [
      { id: 'k2_stops_at_lab_pass', path: '/audit/status/K2', op: 'equals', value: 'LAB_PASS' },
      { id: 'k3_stops_at_lab_pass', path: '/audit/status/K3', op: 'equals', value: 'LAB_PASS' },
      { id: 'nothing_invalidated', path: '/audit/invalidated', op: 'length', value: 0 },
    ],
  ),
  check: (_input, output, report) => {
    const k2 = output.audit.modules.find((module) => module.id === 'K2');
    return [
      eq('gwt_conditions_all_passed', [true, true, true], report.conditions.map((condition) => condition.passed)),
      eq('every_module_stops_at_lab_pass', ['LAB_PASS', 'LAB_PASS'], output.audit.modules.map((module) => module.effectiveStatus)),
      eq('blocking_gate_is_g6', ['G6'], k2?.gates.filter((gate) => !gate.passed).map((gate) => gate.id)),
      eq('completion_is_not_reached', false, output.board.completion.complete),
      eq('completion_reports_the_slice', false, output.board.completion.allVerticalSlicesPassed),
      ok(
        'pending_metrics_are_listed_not_zeroed',
        output.board.completion.pending.length > 0 && output.board.completion.globalInvariantViolations === null,
        '미측정 지표는 null 로 남는다',
        { pending: output.board.completion.pending.length, gi: output.board.completion.globalInvariantViolations },
      ),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    `G6 통합 게이트가 막고 있다 — ${output.audit.modules[0]?.gates.find((gate) => gate.id === 'G6')?.detail}`,
    `아직 측정 주체가 없는 지표는 0 이 아니라 null 로 남기고 이유를 적는다: ${output.board.completion.pending.slice(0, 2).join(' / ')}`,
  ],
});

// ---------------------------------------------------------------------------
// 4. 대표 검증 — 의존 모듈 변경 시 하위 모듈이 자동으로 BLOCKED (원문 「8」 V4)
// ---------------------------------------------------------------------------
const dependencyContractChangeBlocksDependents = defineScene({
  id: 'dependency_contract_change_blocks_dependents',
  title: '선행의 계약을 바꾸면 그것을 쓰는 모듈이 자동으로 BLOCKED 가 된다',
  seed: 44n,
  spec: gwt(
    'dependency_changed',
    'K2 를 고치면 K3 의 검증이 무효가 된다',
    chainState(fullPassMeasurement, TWO),
    [
      ...issueAll(TWO),
      { step: 'run_audit', note: '둘 다 VERIFIED' },
      {
        step: 'edit_contract',
        params: { moduleId: 'K2', section: 'invariants', entry: 'transaction_must_be_atomic' },
        note: 'K2 의 계약에 불변조건을 하나 더한다',
      },
      { step: 'run_audit', note: '계약 변경 뒤' },
    ],
    [
      { id: 'k3_verified_before_change', path: '/audit/status/K3', op: 'equals', value: 'VERIFIED', at: 2 },
      { id: 'k3_blocked_after_change', path: '/audit/status/K3', op: 'equals', value: 'BLOCKED', at: 'final' },
      { id: 'k2_blocked_after_change', path: '/audit/status/K2', op: 'equals', value: 'BLOCKED', at: 'final' },
      { id: 'k3_evidence_was_not_touched', path: '/evidences/K3/status', op: 'equals', value: 'VERIFIED' },
    ],
  ),
  check: (_input, output, report) => {
    const k3 = output.audit.modules.find((module) => module.id === 'K3');
    return [
      eq('gwt_conditions_all_passed', [true, true, true, true], report.conditions.map((condition) => condition.passed)),
      eq('k3_before_change', 'VERIFIED', String((firstAudit(report) ?? {})['K3'])),
      eq('k3_after_change', 'BLOCKED', auditStatus(report, 'K3')),
      ok(
        'reason_names_the_dependency',
        reasonsOf(output, 'K3').includes('E_DEPENDENCY_CONTRACT_CHANGED'),
        'E_DEPENDENCY_CONTRACT_CHANGED',
        reasonsOf(output, 'K3'),
      ),
      eq('k3_is_marked_invalidated', true, k3?.invalidated),
      eq(
        'k3_declared_status_is_still_the_old_one',
        'VERIFIED',
        k3?.declaredStatus,
        '증거 파일은 그대로다 — 무효화는 감사가 한다',
      ),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output, report) => [
    `K2 의 계약이 바뀌자 K3 의 증거는 "지금 계약의 증거"가 아니게 되었다: ${
      output.audit.modules.find((module) => module.id === 'K3')?.reasons.find((reason) => reason.code === 'E_DEPENDENCY_CONTRACT_CHANGED')?.message ?? ''
    }`,
    `K3 의 증거 파일은 한 글자도 바뀌지 않았다(status=${String(((report.final['evidences'] as JsonObject)['K3'] as JsonObject)['status'])}). 상태를 내리는 것은 파일이 아니라 감사다 — 원문 「2.5」: "테스트를 다시 실행하는 것이 아니라, 의존 모듈의 VERIFIED 상태를 자동으로 해제한다".`,
  ],
});

// ---------------------------------------------------------------------------
// 5. 무효화는 하위 폐포 전체로 퍼진다
// ---------------------------------------------------------------------------
const invalidationPropagatesThroughTheChain = defineScene({
  id: 'invalidation_propagates_through_the_chain',
  title: 'K2 하나를 바꾸면 K3 → I3 → R3 → N0 이 함께 무효가 된다 (원문 「2.5」)',
  seed: 45n,
  spec: gwt(
    'chain_invalidation',
    '다섯 모듈 사슬',
    chainState(fullPassMeasurement),
    [
      ...issueAll(),
      { step: 'run_audit', note: '다섯 모듈 모두 VERIFIED' },
      {
        step: 'edit_contract',
        params: { moduleId: 'K2', section: 'outputs', entry: 'transaction_receipt' },
        note: 'K2 의 출력 계약을 바꾼다',
      },
      { step: 'run_audit', note: '연쇄 무효화' },
    ],
    [
      { id: 'all_verified_before', path: '/audit/invalidated', op: 'length', value: 0, at: 5 },
      { id: 'n0_blocked_at_the_end_of_the_chain', path: '/audit/status/N0', op: 'equals', value: 'BLOCKED' },
      { id: 'whole_closure_invalidated', path: '/audit/invalidated', op: 'length', value: 5 },
    ],
  ),
  check: (_input, output, report) => {
    const statuses = output.audit.modules.map((module) => `${module.id}=${module.effectiveStatus}`);
    return [
      eq('gwt_conditions_all_passed', [true, true, true], report.conditions.map((condition) => condition.passed)),
      eq('every_module_in_the_chain_is_blocked', CHAIN_IDS.map((id) => `${id}=BLOCKED`).sort(), [...statuses].sort()),
      eq('invalidated_list_is_the_whole_closure', [...CHAIN_IDS].sort(), output.audit.invalidated),
      eq(
        'downstream_reason_is_the_chain_not_the_edit',
        ['E_DEPENDENCY_INVALIDATED'],
        reasonsOf(output, 'N0'),
        'N0 은 K2 를 직접 쓰지 않는다 — 선행이 무효라서 무효다',
      ),
      eq(
        'direct_dependent_reason_is_the_contract_change',
        true,
        reasonsOf(output, 'K3').includes('E_DEPENDENCY_CONTRACT_CHANGED'),
      ),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    `원문 「2.5」의 연쇄 그대로: ${CHAIN_IDS.join(' → ')} 이 한 번의 계약 변경으로 모두 무효화되었다.`,
    `무효화 이유는 거리마다 다르다 — K3 는 "선행 계약이 바뀜", N0 는 "선행이 무효화됨": ${output.audit.modules
      .map((module) => `${module.id}[${module.reasons.map((reason) => reason.code).join(',')}]`)
      .join(' ')}`,
  ],
});

// ---------------------------------------------------------------------------
// 6. 리플레이가 갈라지면 결정성 게이트가 막는다
// ---------------------------------------------------------------------------
const replayMismatchFailsDeterminismGate = defineScene({
  id: 'replay_mismatch_fails_determinism_gate',
  title: '같은 시드에서 결과 해시가 둘이면 VERIFIED 가 나오지 않는다 (GI-12)',
  seed: 46n,
  spec: gwt(
    'replay_mismatch',
    '리플레이 해시가 2종인 모듈',
    chainState(fullPassMeasurement, TWO),
    [
      ...issueAll(TWO),
      { step: 'run_audit' },
      { step: 'set_measurement', params: { moduleId: 'K2', path: '/replay/uniqueHashes', value: 2 } },
      { step: 'issue_evidence', params: { moduleId: 'K2' } },
      { step: 'run_audit' },
    ],
    [
      { id: 'k2_verified_before', path: '/audit/status/K2', op: 'equals', value: 'VERIFIED', at: 2 },
      { id: 'k2_falls_to_slice_pass', path: '/audit/status/K2', op: 'equals', value: 'SLICE_PASS', at: 'final' },
    ],
  ),
  check: (_input, output, report) => {
    const k2 = output.audit.modules.find((module) => module.id === 'K2');
    return [
      eq('gwt_conditions_all_passed', [true, true], report.conditions.map((condition) => condition.passed)),
      eq('determinism_gate_fails', ['G5'], k2?.gates.filter((gate) => !gate.passed).map((gate) => gate.id)),
      eq('status_stops_below_verified', 'SLICE_PASS', k2?.effectiveStatus),
      eq('board_counts_the_mismatch', 1, output.board.completion.replayMismatches),
      eq('completion_is_not_reached', false, output.board.completion.complete),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    `결정성 게이트: ${output.audit.modules.find((module) => module.id === 'K2')?.gates.find((gate) => gate.id === 'G5')?.detail}`,
    'GI-12(리플레이 불일치 금지)는 사다리의 마지막 칸을 막는다 — 재생되지 않는 세계는 검증할 수 없다.',
  ],
});

// ---------------------------------------------------------------------------
// 7. V 단계 완료 화면의 여섯 구획
// ---------------------------------------------------------------------------
const boardShowsTheVPhaseCompletionScreen = defineScene({
  id: 'board_shows_the_v_phase_completion_screen',
  title: '원문 「8」의 V 단계 완료 화면 여섯 구획이 모두 채워진다',
  seed: 47n,
  spec: gwt(
    'board',
    '다섯 모듈 · 슬라이스 미통과',
    chainState(slicePendingMeasurement),
    [...issueAll(), { step: 'run_audit' }],
    [
      { id: 'audit_ran', path: '/audit/hash', op: 'present' },
      { id: 'five_modules', path: '/audit/status', op: 'present' },
    ],
  ),
  check: (_input, output, report) => {
    const board = output.board;
    return [
      eq('gwt_conditions_all_passed', [true, true], report.conditions.map((condition) => condition.passed)),
      eq('모든_모듈_상태', 5, board.statuses.length),
      ok('실패한_검증', board.failedChecks.length > 0, '막힌 게이트가 목록에 있다', board.failedChecks.map((check) => `${check.moduleId}/${check.source}`)),
      eq('의존성_그래프', 4, board.dependencyGraph.edges.length, 'K2→K3→I3→R3→N0'),
      ok(
        '최신_코드_해시',
        board.hashes.every((row) => typeof row.sourceHash === 'string' && row.contractHash.startsWith('sha256:')),
        '모든 모듈에 코드·계약 해시',
        board.hashes.length,
      ),
      ok('리플레이_해시', board.replays.every((row) => row.runs > 0), '모든 모듈에 리플레이 수치', board.replays.map((row) => `${row.moduleId}:${row.runs}/${row.uniqueHashes}`)),
      ok('자동_검증_결과', board.completion.pending.length > 0 && board.completion.complete === false, '완성 판정과 미측정 목록', board.completion.pending.length),
      eq('board_mirrors_audit', statusMapOf(output), Object.fromEntries(board.statuses.map((row) => [row.moduleId, row.effectiveStatus]))),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    `원문 「8」이 요구한 여섯 구획: 모듈 상태 ${output.board.statuses.length} · 실패한 검증 ${output.board.failedChecks.length} · 그래프 간선 ${output.board.dependencyGraph.edges.length} · 코드 해시 ${output.board.hashes.length} · 리플레이 ${output.board.replays.length} · 자동 판정 1`,
    `완성 판정(원문 「27」)은 아직 ${output.board.completion.pending.length}개 지표를 미측정으로 남겨 둔다 — 담당 모듈이 없기 때문이다.`,
  ],
  candidates: (output) => [
    { label: '모든 모듈 상태', value: output.board.statuses.map((row) => `${row.moduleId}=${row.effectiveStatus}`).join(' · ') },
    { label: '실패한 검증', value: output.board.failedChecks.map((check) => `${check.moduleId}/${check.source}`).join(' · ') || '없음' },
    { label: '의존성 그래프', value: output.board.dependencyGraph.edges.map((edge) => `${edge.from}→${edge.to}`).join(' · ') },
    { label: '최신 코드 해시', value: output.board.hashes.map((row) => `${row.moduleId}:${(row.sourceHash ?? '').slice(7, 15)}`).join(' · ') },
    { label: '리플레이 해시', value: output.board.replays.map((row) => `${row.moduleId}:${row.runs}회/${row.uniqueHashes}종`).join(' · ') },
    { label: '자동 검증 결과', value: `완성 ${output.board.completion.complete ? '예' : '아니오'} · 미측정 ${output.board.completion.pending.length}` },
  ],
});

function statusMapOf(output: V4Output): Record<string, string> {
  return Object.fromEntries(output.audit.modules.map((module) => [module.id, module.effectiveStatus]));
}

// ---------------------------------------------------------------------------
// 8. 같은 측정이면 같은 증거
// ---------------------------------------------------------------------------
const evidenceIsReproducibleFromTheSameMeasurements = defineScene({
  id: 'evidence_is_reproducible_from_the_same_measurements',
  title: '같은 측정을 다시 넣으면 글자 하나까지 같은 증거가 나온다',
  seed: 48n,
  spec: gwt(
    'reissue',
    '같은 측정으로 두 번 발급',
    chainState(fullPassMeasurement, TWO),
    [...issueAll(TWO), { step: 'issue_evidence', params: { moduleId: 'K2' }, note: '같은 측정으로 다시' }, { step: 'run_audit' }],
    [
      { id: 'k2_is_verified', path: '/audit/status/K2', op: 'equals', value: 'VERIFIED' },
      { id: 'evidence_exists', path: '/evidences/K2', op: 'present' },
    ],
  ),
  check: (input, output, report) => {
    const first = executeV4(input);
    const again = executeV4(input);
    const evidence = ((report.final['evidences'] as JsonObject)['K2'] ?? {}) as unknown as EvidenceDocument;
    const reissue = report.transitions[2];

    return [
      eq('gwt_conditions_all_passed', [true, true], report.conditions.map((condition) => condition.passed)),
      eq('reissue_changes_nothing_but_the_tick', ['/evidences/K2/issuedAtTick'], reissue?.changes.map((change) => change.path)),
      eq('audit_is_reproducible', first.digest, again.digest),
      eq('board_hash_is_stable', first.board.hash, output.board.hash),
      ok('evidence_hash_is_defined', evidenceHash(evidence).startsWith('sha256:'), 'sha256:…', evidenceHash(evidence).slice(0, 14)),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (output) => [
    '증거를 다시 발급해도 발급 틱 말고는 아무것도 달라지지 않는다 — 증거 자체가 리플레이 가능해야 증거를 대조할 수 있다.',
    `감사 해시: ${output.audit.hash} · 화면 해시: ${output.board.hash}`,
  ],
});

export const v4Scenarios: VerificationScenario<V4Input, V4Output>[] = [
  gatesDecideStatus,
  evidenceCannotClaimStatusAboveGates,
  verifiedWithoutSliceIsRefused,
  dependencyContractChangeBlocksDependents,
  invalidationPropagatesThroughTheChain,
  replayMismatchFailsDeterminismGate,
  boardShowsTheVPhaseCompletionScreen,
  evidenceIsReproducibleFromTheSameMeasurements,
];
