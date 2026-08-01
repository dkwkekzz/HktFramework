// V4 검증 시나리오 3종 — 완료를 임의로 선언할 수 없는가.

import {
  buildEvidence,
  buildRegistry,
  canPromote,
  isFresh,
  readContract,
  parseYaml,
  type ContractSource,
  type Evidence,
  type EvidenceInput,
  type ModuleContract,
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

export const v4Scenarios = [v4EvidenceVerified, v4RefusesUnverified, v4Boundary] as const;
