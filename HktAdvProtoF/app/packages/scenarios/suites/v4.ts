// V4 검증 시나리오 3종 — 완료를 임의로 선언할 수 없는가.

import {
  buildEvidence,
  buildRegistry,
  canPromote,
  collectEvidence,
  isFresh,
  readContract,
  recordingOrderViolations,
  parseYaml,
  type ContractSource,
  type Evidence,
  type EvidenceInput,
  type EvidenceJob,
  type EvidenceRecord,
  type EvidenceStep,
  type EvidenceTrace,
  type ModuleContract,
  type ModuleStatus,
} from '@hkt/contracts';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

/** 전부 통과한 검증 산출물 — 시나리오마다 어긴 항목만 바꿔 넣는다. */
function input(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    module: 'X-example-module',
    sourceHash: 'aaaaaaaaaaaaaaaa',
    unitTests: { result: 'passed', total: 12, passed: 12 },
    propertyTests: 'passed',
    labScenarios: 'manual',
    scenarios: {
      total: 3,
      passed: 3,
      failed: 0,
      coverageComplete: true,
      byId: { 'x-normal': 'passed', 'x-failure': 'passed', 'x-boundary': 'passed' },
    },
    replayHash: 'bbbbbbbbbbbbbbbb',
    ...overrides,
  };
}

const CLAIMED_VERIFIED: ContractSource = {
  name: 'X.yaml',
  text: [
    'id: X',
    'name: example-module',
    'purpose: 완료를 주장하는 계약이다.',
    'inputs: [A]',
    'outputs: [B]',
    'depends: []',
    'scenarios: [x-normal, x-failure, x-boundary]',
    'status: VERIFIED',
    'evidence: evidence/X.json',
    '',
  ].join('\n'),
};

function contractOf(source: ContractSource): ModuleContract {
  const { contract } = readContract(parseYaml(source.text), source.name);
  if (contract === null) throw new Error(`계약을 읽지 못했다 — ${source.name}`);
  return contract;
}

/** 정상 — 전부 통과한 산출물은 VERIFIED 증거가 되고, 완료 주장이 성립한다. */
export const v4EvidenceVerified = defineScenario({
  id: 'v4-evidence-verified',
  module: 'V4',
  kind: 'normal',
  purpose: '전부 통과한 검증 산출물은 VERIFIED 증거가 되고 완료 주장이 성립한다.',
  arrange: (): EvidenceInput => input(),
  act: (source) => {
    const evidence = buildEvidence(source);
    const contract = contractOf(CLAIMED_VERIFIED);
    const promotion = canPromote(contract, evidence, source.sourceHash);
    const registry = buildRegistry([CLAIMED_VERIFIED], {
      evidence: new Map<string, Evidence>([['X', evidence]]),
      sourceHashes: new Map([['X', source.sourceHash]]),
    });
    return {
      status: evidence.status,
      blockers: evidence.blockers,
      integrationScenario: evidence.integrationScenario,
      replayHash: evidence.replayHash,
      promotionAllowed: promotion.allowed,
      promotionReasons: promotion.reasons,
      registered: registry.modules[0]?.registered === true,
    };
  },
  assert: (result): Assertion[] => [
    expectState('증거 status 는 VERIFIED 다', 'VERIFIED', result.status),
    expectState('막는 사유가 없다', [], result.blockers),
    expectState('통합 시나리오는 통과다', 'passed', result.integrationScenario),
    expectState('리플레이 해시가 남는다', 'bbbbbbbbbbbbbbbb', result.replayHash),
    expectTrue('완료 전이가 허용된다', result.promotionAllowed),
    expectState('허용 시 사유 목록은 비어 있다', [], result.promotionReasons),
    expectTrue('레지스트리도 이 계약을 등록한다', result.registered),
  ],
});

/** 실패 — 미통과 산출물로는 VERIFIED 를 만들 수 없고, 계약의 완료 주장이 기각된다. */
export const v4RefusesUnverified = defineScenario({
  id: 'v4-refuses-unverified',
  module: 'V4',
  kind: 'failure',
  purpose: '시나리오 미통과·테스트 실패·커버리지 미충족은 VERIFIED 전이를 거부한다.',
  arrange: (): Readonly<Record<string, EvidenceInput>> => ({
    failingScenario: input({
      scenarios: {
        total: 3,
        passed: 2,
        failed: 1,
        coverageComplete: false,
        byId: { 'x-normal': 'passed', 'x-failure': 'failed', 'x-boundary': 'passed' },
      },
    }),
    failingTests: input({ unitTests: { result: 'failed', total: 12, passed: 9 } }),
    noCoverage: input({
      scenarios: { total: 1, passed: 1, failed: 0, coverageComplete: false, byId: { 'x-normal': 'passed' } },
    }),
    nondeterministic: input({ propertyTests: 'failed' }),
  }),
  act: (inputs) => {
    const contract = contractOf(CLAIMED_VERIFIED);
    const rows = Object.entries(inputs).map(([label, source]) => {
      const evidence = buildEvidence(source);
      const promotion = canPromote(contract, evidence, source.sourceHash);
      const registry = buildRegistry([CLAIMED_VERIFIED], {
        evidence: new Map<string, Evidence>([['X', evidence]]),
        sourceHashes: new Map([['X', source.sourceHash]]),
      });
      return {
        label,
        status: evidence.status,
        blockerCount: evidence.blockers.length,
        promotionAllowed: promotion.allowed,
        registered: registry.modules[0]?.registered === true,
        rules: (registry.modules[0]?.violations ?? []).map((violation) => violation.rule),
      };
    });
    return {
      statuses: Object.fromEntries(rows.map((row) => [row.label, row.status])),
      allowed: rows.filter((row) => row.promotionAllowed).map((row) => row.label),
      registered: rows.filter((row) => row.registered).map((row) => row.label),
      blockersMissing: rows.filter((row) => row.blockerCount === 0).map((row) => row.label),
      failingScenarioRules: rows.find((row) => row.label === 'failingScenario')?.rules ?? [],
      failingScenarioBlockers: buildEvidence(inputs['failingScenario'] as EvidenceInput).blockers,
    };
  },
  assert: (result): Assertion[] => [
    expectState(
      '넷 다 VERIFIED 가 되지 못한다',
      {
        failingScenario: 'IMPLEMENTED',
        failingTests: 'IMPLEMENTED',
        noCoverage: 'IMPLEMENTED',
        nondeterministic: 'IMPLEMENTED',
      },
      result.statuses,
    ),
    expectState('완료 전이가 허용된 것이 하나도 없다', [], result.allowed),
    expectState('레지스트리도 완료 주장을 등록하지 않는다', [], result.registered),
    expectState('사유 없이 막는 증거는 없다', [], result.blockersMissing),
    expectTrue(
      '거부 사유가 evidence-unsupported 로 보고된다',
      result.failingScenarioRules.includes('evidence-unsupported'),
      result.failingScenarioRules,
    ),
    expectTrue(
      '어떤 시나리오가 실패했는지 이름이 남는다',
      result.failingScenarioBlockers.some((blocker) => blocker.includes('x-failure')),
      result.failingScenarioBlockers,
    ),
  ],
});

/** 경계 — 증거 없음·낡은 증거·시나리오 0개·테스트 0개. */
export const v4Boundary = defineScenario({
  id: 'v4-boundary',
  module: 'V4',
  kind: 'boundary',
  purpose: '증거 없음·소스 변경으로 낡은 증거·시나리오 0개·테스트 0개를 모두 거부한다.',
  arrange: (): { readonly base: EvidenceInput; readonly changedSourceHash: string } => ({
    base: input(),
    changedSourceHash: 'cccccccccccccccc',
  }),
  act: ({ base, changedSourceHash }) => {
    const contract = contractOf(CLAIMED_VERIFIED);
    const fresh = buildEvidence(base);

    const noEvidence = canPromote(contract, null);
    const stale = canPromote(contract, fresh, changedSourceHash);
    const noScenarios = buildEvidence(
      input({ scenarios: { total: 0, passed: 0, failed: 0, coverageComplete: false, byId: {} } }),
    );
    const noTests = buildEvidence(input({ unitTests: { result: 'passed', total: 0, passed: 0 } }));
    const noReplay = buildEvidence(input({ replayHash: '' }));

    return {
      noEvidenceAllowed: noEvidence.allowed,
      noEvidenceReason: noEvidence.reasons[0] ?? null,
      staleAllowed: stale.allowed,
      staleReason: stale.reasons[0] ?? null,
      staleIsFresh: isFresh(fresh, changedSourceHash),
      sameSourceIsFresh: isFresh(fresh, base.sourceHash),
      noScenariosStatus: noScenarios.status,
      noTestsStatus: noTests.status,
      noReplayStatus: noReplay.status,
    };
  },
  assert: (result, state): Assertion[] => [
    expectTrue('증거가 없으면 완료할 수 없다', !result.noEvidenceAllowed),
    expectTrue(
      '증거 없음의 사유가 남는다',
      String(result.noEvidenceReason).includes('증거 파일이 없다'),
      result.noEvidenceReason,
    ),
    expectTrue('소스가 바뀌면 완료가 무너진다', !result.staleAllowed),
    expectTrue(
      '낡은 증거의 사유는 소스 변경을 가리킨다',
      String(result.staleReason).includes('소스가 증거 이후로 바뀌었다'),
      result.staleReason,
    ),
    expectState('바뀐 소스에 대해 증거는 낡았다', false, result.staleIsFresh),
    expectState('같은 소스에 대해서는 신선하다', true, result.sameSourceIsFresh),
    expectState('시나리오 0개는 완료할 수 없다', 'IMPLEMENTED', result.noScenariosStatus),
    expectState('단위 테스트 0개는 완료할 수 없다', 'IMPLEMENTED', result.noTestsStatus),
    expectState('리플레이 해시 없이는 완료할 수 없다', 'IMPLEMENTED', result.noReplayStatus),
    expectDeterministic(
      '같은 산출물이면 항상 같은 증거다',
      () => buildEvidence(state.base),
      10,
    ),
  ],
});

// ── 기록 순서 ──────────────────────────────────────────────────────────────────
// 증거 파일은 다른 모듈의 검사 재료다. 아래 축소판 세계가 그 사실을 그대로 갖는다:
// 모듈 A·B 는 증거 내용이 바뀌었고(소스를 고쳤다), 모듈 LAB 은 "수집 시작 때 굳힌 스냅샷이
// 지금 디스크와 같은가" 를 단위 테스트로 검사한다 — 실제 V3 의 스냅샷 신선도 테스트다.

export type RecordingOrder = 'batch' | 'eager';

export interface RecordingWorld {
  readonly order: RecordingOrder;
  readonly trace: EvidenceTrace;
  readonly statuses: Readonly<Record<string, ModuleStatus>>;
  readonly labTests: { readonly total: number; readonly passed: number };
  readonly violations: readonly string[];
}

/** 수집이 끝난 뒤 디스크에 남을 증거 내용 — A·B 만 바뀌고 LAB 은 그대로다. */
const NEXT_CONTENT: Readonly<Record<string, string>> = {
  A: 'evidence-A-v2',
  B: 'evidence-B-v2',
  LAB: 'evidence-LAB-v1',
};

const INITIAL_DISK: Readonly<Record<string, string>> = {
  A: 'evidence-A-v1',
  B: 'evidence-B-v1',
  LAB: 'evidence-LAB-v1',
};

function freeze(disk: ReadonlyMap<string, string>): string {
  return [...disk]
    .map(([id, content]) => `${id}=${content}`)
    .sort()
    .join('|');
}

function evidenceWith(id: string, unitTests: EvidenceInput['unitTests']): Evidence {
  return buildEvidence(input({ module: `${id}-mini`, sourceHash: `hash-${id}`, unitTests }));
}

/** 같은 재료를 두 순서로 돌려 본다 — 바뀌는 것은 순서뿐이다. */
export function simulateRecording(order: RecordingOrder): RecordingWorld {
  const disk = new Map(Object.entries(INITIAL_DISK));
  const snapshot = freeze(disk); // Lab 스냅샷은 수집 시작 시점의 디스크를 굳힌 것이다.

  /** LAB 의 단위 테스트 — 스냅샷이 지금 디스크와 어긋나면 한 건이 실패한다. */
  const labUnitTests = (): EvidenceInput['unitTests'] =>
    freeze(disk) === snapshot
      ? { result: 'passed', total: 90, passed: 90 }
      : { result: 'failed', total: 90, passed: 89 };

  const jobs: readonly EvidenceJob[] = [
    { id: 'A', verify: () => evidenceWith('A', { result: 'passed', total: 12, passed: 12 }) },
    { id: 'B', verify: () => evidenceWith('B', { result: 'passed', total: 12, passed: 12 }) },
    { id: 'LAB', verify: () => evidenceWith('LAB', labUnitTests()) },
  ];

  const write = (record: EvidenceRecord): void => {
    disk.set(record.id, NEXT_CONTENT[record.id] ?? record.id);
  };

  let records: readonly EvidenceRecord[];
  let trace: EvidenceTrace;

  if (order === 'batch') {
    const collection = collectEvidence(jobs, write);
    records = collection.records;
    trace = collection.trace;
  } else {
    // 즉시 기록 — 옛 순서를 그대로 흉내 낸다: 루프 안에서 검증하고 바로 쓴다.
    const eagerRecords: EvidenceRecord[] = [];
    const eagerTrace: EvidenceStep[] = [];
    for (const job of jobs) {
      const record: EvidenceRecord = { id: job.id, evidence: job.verify() };
      eagerTrace.push({ phase: 'verify', module: job.id });
      eagerRecords.push(record);
      write(record);
      eagerTrace.push({ phase: 'record', module: job.id });
    }
    records = eagerRecords;
    trace = eagerTrace;
  }

  const lab = records.find((record) => record.id === 'LAB');
  return {
    order,
    trace,
    statuses: Object.fromEntries(records.map((record) => [record.id, record.evidence.status])),
    labTests: {
      total: Number(
        (lab?.evidence.detail['tests'] as { total?: number } | undefined)?.total ?? 0,
      ),
      passed: Number(
        (lab?.evidence.detail['tests'] as { passed?: number } | undefined)?.passed ?? 0,
      ),
    },
    violations: recordingOrderViolations(trace),
  };
}

/** 정상 — 일괄 기록이면 앞 모듈의 증거가 바뀌어도 뒤 모듈이 온전히 선다. */
export const v4RecordingBatch = defineScenario({
  id: 'v4-recording-batch',
  module: 'V4',
  kind: 'normal',
  purpose: '증거를 검증 전량 뒤에 일괄 기록하면 앞 모듈의 기록이 뒤 모듈의 재료를 낡게 하지 않는다.',
  arrange: (): RecordingOrder => 'batch',
  act: (order) => simulateRecording(order),
  assert: (result): Assertion[] => [
    expectState(
      '세 모듈이 전부 VERIFIED 다',
      { A: 'VERIFIED', B: 'VERIFIED', LAB: 'VERIFIED' },
      result.statuses,
    ),
    expectState('뒤 모듈의 단위 테스트가 하나도 깨지지 않는다', { total: 90, passed: 90 }, result.labTests),
    expectState('순서 위반이 없다', [], result.violations),
    expectTrue(
      '검증 셋이 모두 끝난 뒤에 기록이 시작된다',
      result.trace.slice(0, 3).every((step) => step.phase === 'verify') &&
        result.trace.slice(3).every((step) => step.phase === 'record'),
      result.trace,
    ),
  ],
});

/** 실패 — 즉시 기록이면 같은 재료로도 뒤 모듈이 강등된다 (#662 재현). */
export const v4RecordingEager = defineScenario({
  id: 'v4-recording-eager',
  module: 'V4',
  kind: 'failure',
  purpose: '루프 안에서 증거를 즉시 쓰면 뒤 모듈이 낡은 재료로 검증되어 IMPLEMENTED 로 내려앉는다.',
  arrange: (): { readonly batch: RecordingOrder; readonly eager: RecordingOrder } => ({
    batch: 'batch',
    eager: 'eager',
  }),
  act: ({ batch, eager }) => {
    const good = simulateRecording(batch);
    const bad = simulateRecording(eager);
    return {
      batchLab: good.statuses['LAB'],
      eagerLab: bad.statuses['LAB'],
      eagerLabTests: bad.labTests,
      eagerBlockers: bad.violations,
      // 앞 두 모듈은 순서와 무관하게 멀쩡하다 — 강등되는 것은 재료를 읽는 뒤 모듈뿐이다.
      eagerHead: [bad.statuses['A'], bad.statuses['B']],
    };
  },
  assert: (result): Assertion[] => [
    expectState('일괄 기록에서는 뒤 모듈이 VERIFIED 다', 'VERIFIED', result.batchLab),
    expectState('같은 재료인데 즉시 기록에서는 IMPLEMENTED 로 내려앉는다', 'IMPLEMENTED', result.eagerLab),
    expectState('강등의 정체는 스냅샷 신선도 테스트 한 건이다', { total: 90, passed: 89 }, result.eagerLabTests),
    expectState('앞 모듈들은 순서와 무관하게 멀쩡하다', ['VERIFIED', 'VERIFIED'], result.eagerHead),
    expectTrue(
      '위반 지점이 이름으로 짚힌다',
      result.eagerBlockers.some((reason) => reason.includes('LAB 검증이 A 기록보다 뒤다')),
      result.eagerBlockers,
    ),
  ],
});

/** 경계 — 작업 0개, 그리고 재료를 읽지 않는 모듈만 있을 때. */
export const v4RecordingBoundary = defineScenario({
  id: 'v4-recording-boundary',
  module: 'V4',
  kind: 'boundary',
  purpose: '작업 0개는 기록도 추적도 비어 있고, 순서 규칙은 그때도 성립한다.',
  arrange: (): readonly EvidenceJob[] => [],
  act: (jobs) => {
    const written: string[] = [];
    const empty = collectEvidence(jobs, (record) => written.push(record.id));
    const single = collectEvidence(
      [{ id: 'ONLY', verify: (): Evidence => buildEvidence(input({ module: 'ONLY-mini' })) }],
      () => {},
    );
    return {
      emptyRecords: empty.records.length,
      emptyTrace: empty.trace.length,
      emptyWritten: written,
      emptyViolations: recordingOrderViolations(empty.trace),
      singleTrace: single.trace.map((step) => `${step.phase}:${step.module}`),
      singleViolations: recordingOrderViolations(single.trace),
    };
  },
  assert: (result, state): Assertion[] => [
    expectState('기록할 것이 없다', 0, result.emptyRecords),
    expectState('추적도 비어 있다', 0, result.emptyTrace),
    expectState('기록 함수는 한 번도 불리지 않는다', [], result.emptyWritten),
    expectState('빈 수집에도 위반은 없다', [], result.emptyViolations),
    expectState('작업 하나면 검증 한 줄 · 기록 한 줄이다', ['verify:ONLY', 'record:ONLY'], result.singleTrace),
    expectState('작업 하나에는 순서 문제가 생길 수 없다', [], result.singleViolations),
    expectDeterministic('빈 작업 목록은 언제나 같은 결과다', () => collectEvidence(state, () => {}), 10),
  ],
});

export const v4Scenarios = [
  v4EvidenceVerified,
  v4RefusesUnverified,
  v4Boundary,
  v4RecordingBatch,
  v4RecordingEager,
  v4RecordingBoundary,
] as const;
