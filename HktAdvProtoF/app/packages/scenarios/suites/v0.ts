// V0 검증 시나리오 3종 — 레지스트리가 온전한 계약은 등록하고 결함 계약은 사유와 함께 거부하는가.

import {
  buildRegistry,
  type ContractSource,
  type Evidence,
  type ModuleRegistry,
} from '@hkt/contracts';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

/** 최소한의 온전한 계약을 만든다 — 시나리오마다 어긴 항목만 바꿔 넣는다. */
function contract(overrides: Partial<Record<string, string>> & { id: string }): ContractSource {
  const {
    id,
    purpose = `${id} 의 목적을 한 문장으로 적는다.`,
    inputs = '[A]',
    outputs = '[B]',
    depends = '[]',
    scenarios = `\n  - ${id.toLowerCase()}-normal\n  - ${id.toLowerCase()}-failure\n  - ${id.toLowerCase()}-boundary`,
    status = 'VERIFIED',
    evidence = `evidence/${id}.json`,
  } = overrides;
  return {
    name: `${id}.yaml`,
    text: [
      `id: ${id}`,
      `name: ${id.toLowerCase()}-module`,
      ...(purpose === '' ? [] : [`purpose: ${purpose}`]),
      `inputs: ${inputs}`,
      `outputs: ${outputs}`,
      `depends: ${depends}`,
      `scenarios: ${scenarios}`,
      `status: ${status}`,
      ...(evidence === '' ? [] : [`evidence: ${evidence}`]),
      '',
    ].join('\n'),
  };
}

/** 어떤 모듈이 어떤 규칙을 어겼는가 — 단언하기 쉬운 형태로 접는다. */
function violationsOf(registry: ModuleRegistry): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of registry.modules) {
    if (entry.violations.length > 0) {
      out[entry.contract.id] = entry.violations.map((violation) => violation.rule).sort();
    }
  }
  for (const violation of registry.rejected) {
    (out[violation.module] ??= []).push(violation.rule);
    out[violation.module]?.sort();
  }
  return out;
}

/** 정상 — 온전한 계약들은 등록되고, 의존 위상 순서와 착수 가능 목록이 나온다. */
export const v0RegistryAccepts = defineScenario({
  id: 'v0-registry-accepts',
  module: 'V0',
  kind: 'normal',
  purpose: '온전한 계약은 등록되고 의존 위상 순서·착수 가능 목록이 계산된다.',
  arrange: (): readonly ContractSource[] => [
    contract({ id: 'A' }),
    contract({ id: 'B', depends: '[A]' }),
    contract({ id: 'C', depends: '[A, B]', status: 'PLANNED', evidence: '' }),
  ],
  act: (sources) => {
    const registry = buildRegistry(sources);
    return {
      registered: registry.modules.filter((entry) => entry.registered).map((entry) => entry.contract.id),
      violations: violationsOf(registry),
      topologicalOrder: registry.topologicalOrder,
      ready: registry.ready,
      edges: registry.edges.map((edge) => `${edge.from}->${edge.to}`),
    };
  },
  assert: (result): Assertion[] => [
    expectState('셋 다 등록된다', ['A', 'B', 'C'], result.registered),
    expectState('거부 사유가 없다', {}, result.violations),
    expectState('위상 순서는 의존 순이다', ['A', 'B', 'C'], result.topologicalOrder),
    expectState('의존이 모두 VERIFIED 인 미완료 모듈만 착수 가능하다', ['C'], result.ready),
    expectState('의존 간선이 그려진다', ['B->A', 'C->A', 'C->B'], result.edges),
  ],
});

/** 실패 — 결함 계약 넷은 각각의 사유로 거부된다. */
export const v0RejectsDefective = defineScenario({
  id: 'v0-rejects-defective',
  module: 'V0',
  kind: 'failure',
  purpose: '목적 없음·입출력 없음·시나리오 없는 완료·순환 의존이 각각의 사유로 거부된다.',
  arrange: (): readonly ContractSource[] => [
    contract({ id: 'NOPURPOSE', purpose: '' }),
    contract({ id: 'NOIO', inputs: '[]', outputs: '[]' }),
    contract({ id: 'NOSCENARIO', scenarios: '[]' }),
    contract({ id: 'NOEVIDENCE', evidence: '' }),
    // 순환: CYCA → CYCB → CYCA
    contract({ id: 'CYCA', depends: '[CYCB]' }),
    contract({ id: 'CYCB', depends: '[CYCA]' }),
  ],
  act: (sources) => {
    const registry = buildRegistry(sources);
    return {
      violations: violationsOf(registry),
      registered: registry.modules.filter((entry) => entry.registered).map((entry) => entry.contract.id),
      topologicalOrder: registry.topologicalOrder,
      report: registry.modules
        .flatMap((entry) => entry.violations)
        .map((violation) => `${violation.module}:${violation.rule}`)
        .sort(),
    };
  },
  assert: (result): Assertion[] => [
    expectState('등록에 성공한 계약이 하나도 없다', [], result.registered),
    expectState(
      '목적 없는 계약은 no-purpose 로 거부된다',
      ['no-purpose'],
      result.violations['NOPURPOSE'],
    ),
    expectState('입출력 없는 계약은 no-io 로 거부된다', ['no-io'], result.violations['NOIO']),
    expectState(
      '시나리오 없는 완료는 no-scenario 로 거부된다',
      ['no-scenario'],
      result.violations['NOSCENARIO'],
    ),
    expectState(
      '증거 없는 완료는 no-evidence 로 거부된다',
      ['no-evidence'],
      result.violations['NOEVIDENCE'],
    ),
    expectTrue(
      '순환에 낀 두 모듈이 모두 dependency-cycle 로 거부된다',
      result.violations['CYCA']?.includes('dependency-cycle') === true &&
        result.violations['CYCB']?.includes('dependency-cycle') === true,
      { CYCA: result.violations['CYCA'], CYCB: result.violations['CYCB'] },
    ),
    expectState('순환이 있으면 위상 순서가 없다', null, result.topologicalOrder),
    expectTrue('거부 사유가 모듈별로 보고된다', result.report.length >= 6, result.report),
  ],
});

/** 경계 — 계약 0개·파싱 실패·중복 ID·없는 의존·미검증 의존. */
export const v0Boundary = defineScenario({
  id: 'v0-boundary',
  module: 'V0',
  kind: 'boundary',
  purpose: '계약 0개·파싱 실패·중복 ID·없는 의존·미검증 의존에서도 레지스트리가 사유를 남긴다.',
  arrange: (): {
    readonly empty: readonly ContractSource[];
    readonly broken: readonly ContractSource[];
  } => ({
    empty: [],
    broken: [
      { name: 'BROKEN.yaml', text: 'id: BROKEN\n\tpurpose: 탭으로 망가진 계약' },
      { name: 'NOID.yaml', text: 'name: 이름만 있다\npurpose: id 가 없다.' },
      contract({ id: 'DUP' }),
      { ...contract({ id: 'DUP' }), name: 'DUP-copy.yaml' },
      contract({ id: 'GHOST', depends: '[없는모듈]' }),
      contract({ id: 'PENDING', status: 'IMPLEMENTED', evidence: '' }),
      contract({ id: 'EARLY', depends: '[PENDING]' }),
    ],
  }),
  act: ({ empty, broken }) => {
    const emptyRegistry = buildRegistry(empty);
    const brokenRegistry = buildRegistry(broken);
    return {
      emptyModules: emptyRegistry.modules.length,
      emptyOrder: emptyRegistry.topologicalOrder,
      emptyReady: emptyRegistry.ready,
      rejectedRules: brokenRegistry.rejected.map((violation) => violation.rule).sort(),
      violations: violationsOf(brokenRegistry),
      registered: brokenRegistry.modules
        .filter((entry) => entry.registered)
        .map((entry) => entry.contract.id),
    };
  },
  assert: (result, state): Assertion[] => [
    expectState('계약이 0개면 모듈도 0개다', 0, result.emptyModules),
    expectState('빈 레지스트리의 위상 순서는 빈 목록이다', [], result.emptyOrder),
    expectState('빈 레지스트리에 착수 가능 모듈은 없다', [], result.emptyReady),
    expectTrue(
      '파싱 실패와 id 없음은 등록 이전에 거부된다',
      result.rejectedRules.includes('not-a-mapping') && result.rejectedRules.includes('missing-field'),
      result.rejectedRules,
    ),
    expectTrue('중복 ID 는 두 번째가 거부된다', result.rejectedRules.includes('duplicate-id'), result.rejectedRules),
    expectState(
      '없는 모듈에 의존하면 unknown-dependency',
      ['unknown-dependency'],
      result.violations['GHOST'],
    ),
    expectState(
      '미검증 모듈에 의존한 채 완료를 주장하면 거부된다',
      ['dependency-not-verified'],
      result.violations['EARLY'],
    ),
    expectState('그래도 온전한 계약은 등록된다', ['DUP', 'PENDING'], result.registered),
    expectDeterministic(
      '같은 계약을 두 번 등록해도 같은 레지스트리다',
      () => violationsOf(buildRegistry(state.broken)),
      10,
    ),
  ],
});

// ── 증거 교차검사 ──────────────────────────────────────────────────────────────
// 계약의 status 는 **주장**이다. 그 주장이 성립하려면 증거가 뒷받침해야 한다 (V4).
// 증거 맵을 넘기지 않으면 이 관문은 아예 돌지 않는다 — 그것이 이슈 #663 이었다.

/** 온전한 증거 하나 — 시나리오마다 어긴 항목만 바꿔 넣는다. */
function evidenceOf(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    module: `${id}-module`,
    sourceHash: `hash-${id}`,
    unitTests: 'passed',
    propertyTests: 'passed',
    labScenarios: 'manual',
    integrationScenario: 'passed',
    replayHash: `replay-${id}`,
    status: 'VERIFIED',
    blockers: [],
    detail: {},
    ...overrides,
  };
}

const CROSS_SOURCES: readonly ContractSource[] = [
  contract({ id: 'A' }),
  contract({ id: 'B', depends: '[A]' }),
  contract({ id: 'C', depends: '[A, B]', status: 'PLANNED', evidence: '' }),
];

const CROSS_EVIDENCE = new Map<string, Evidence>([
  ['A', evidenceOf('A')],
  ['B', evidenceOf('B')],
]);

const CROSS_HASHES = new Map<string, string>([
  ['A', 'hash-A'],
  ['B', 'hash-B'],
]);

/** 정상 — 증거가 뒷받침하면 등록되고, 착수 가능 목록이 선등록된 미착수 모듈을 가리킨다. */
export const v0EvidenceCrosscheck = defineScenario({
  id: 'v0-evidence-crosscheck',
  module: 'V0',
  kind: 'normal',
  purpose: '완료 주장이 실제 증거와 대조되어 통과하고, 착수 가능 목록이 다음 모듈을 계산한다.',
  arrange: (): readonly ContractSource[] => CROSS_SOURCES,
  act: (sources) => {
    const registry = buildRegistry(sources, { evidence: CROSS_EVIDENCE, sourceHashes: CROSS_HASHES });
    return {
      registered: registry.modules.filter((entry) => entry.registered).map((entry) => entry.contract.id),
      violations: violationsOf(registry),
      ready: registry.ready,
    };
  },
  assert: (result): Assertion[] => [
    expectState('셋 다 등록된다 — 증거가 주장을 뒷받침한다', ['A', 'B', 'C'], result.registered),
    expectState('거부 사유가 없다', {}, result.violations),
    expectState('착수 가능은 선등록된 미착수 모듈 하나다', ['C'], result.ready),
  ],
});

/** 실패 — 강등된 증거·낡은 증거·없는 증거는 완료 주장을 기각한다. */
export const v0CrosscheckRejects = defineScenario({
  id: 'v0-crosscheck-rejects',
  module: 'V0',
  kind: 'failure',
  purpose: '증거가 강등됐거나 소스가 바뀌었거나 증거가 없으면 evidence-unsupported 로 기각된다.',
  arrange: (): readonly ContractSource[] => CROSS_SOURCES,
  act: (sources) => {
    const rules = (registry: ReturnType<typeof buildRegistry>): readonly string[] =>
      (registry.modules.find((entry) => entry.contract.id === 'B')?.violations ?? []).map(
        (violation) => violation.rule,
      );
    const reasons = (registry: ReturnType<typeof buildRegistry>): readonly string[] =>
      (registry.modules.find((entry) => entry.contract.id === 'B')?.violations ?? [])
        .filter((violation) => violation.rule === 'evidence-unsupported')
        .map((violation) => violation.message);

    const demoted = buildRegistry(sources, {
      evidence: new Map([
        ...CROSS_EVIDENCE,
        ['B', evidenceOf('B', { status: 'IMPLEMENTED', blockers: ['단위 테스트가 통과하지 않았다 (89/90)'] })],
      ]),
      sourceHashes: CROSS_HASHES,
    });
    const stale = buildRegistry(sources, {
      evidence: CROSS_EVIDENCE,
      sourceHashes: new Map([...CROSS_HASHES, ['B', 'hash-B-changed']]),
    });
    const missing = buildRegistry(sources, {
      evidence: new Map([...CROSS_EVIDENCE].filter(([id]) => id !== 'B')),
      sourceHashes: CROSS_HASHES,
    });

    return {
      demoted: rules(demoted),
      demotedReasons: reasons(demoted),
      stale: rules(stale),
      staleReasons: reasons(stale),
      missing: rules(missing),
      // 셋 어디에서도 A 는 멀쩡하다 — 기각되는 것은 주장이 어긋난 모듈뿐이다.
      neighbours: [demoted, stale, missing].map(
        (registry) => registry.modules.find((entry) => entry.contract.id === 'A')?.registered === true,
      ),
    };
  },
  assert: (result): Assertion[] => [
    expectState('강등된 증거는 evidence-unsupported 로 기각된다', ['evidence-unsupported'], result.demoted),
    expectTrue(
      '무엇이 막았는지 사유가 그대로 실린다',
      result.demotedReasons.some((reason) => reason.includes('89/90')),
      result.demotedReasons,
    ),
    expectState('소스가 바뀐 낡은 증거도 기각된다', ['evidence-unsupported'], result.stale),
    expectTrue(
      '낡음의 사유는 소스 변경을 가리킨다',
      result.staleReasons.some((reason) => reason.includes('소스가 증거 이후로 바뀌었다')),
      result.staleReasons,
    ),
    expectState('증거 자체가 없어도 기각된다', ['evidence-unsupported'], result.missing),
    expectState('이웃 모듈은 멀쩡하다', [true, true, true], result.neighbours),
  ],
});

/** 경계 — 증거 맵을 안 넘기면 관문이 아예 돌지 않는다 (#663 의 정체). */
export const v0CrosscheckBoundary = defineScenario({
  id: 'v0-crosscheck-boundary',
  module: 'V0',
  kind: 'boundary',
  purpose: '증거 맵 없이 등록하면 강등된 증거가 있어도 통과한다 — 관문은 넘겨줘야 돈다.',
  arrange: (): readonly ContractSource[] => CROSS_SOURCES,
  act: (sources) => {
    const broken = new Map([
      ...CROSS_EVIDENCE,
      ['B', evidenceOf('B', { status: 'IMPLEMENTED', blockers: ['무너진 증거'] })],
    ]);
    const withoutEvidence = buildRegistry(sources);
    const withEvidence = buildRegistry(sources, { evidence: broken });
    // 소스 해시만 빼면 강등 여부는 여전히 보지만 신선도는 못 본다.
    const withoutHashes = buildRegistry(sources, { evidence: CROSS_EVIDENCE });
    const registeredOf = (registry: ReturnType<typeof buildRegistry>): boolean =>
      registry.modules.find((entry) => entry.contract.id === 'B')?.registered === true;

    return {
      blindPasses: registeredOf(withoutEvidence),
      crossCheckCatches: registeredOf(withEvidence),
      hashlessPasses: registeredOf(withoutHashes),
      // PLANNED 모듈은 증거가 없어도 등록된다 — 완료를 주장하지 않기 때문이다.
      plannedRegistered:
        withEvidence.modules.find((entry) => entry.contract.id === 'C')?.registered === true,
      emptyEvidenceRejects: buildRegistry(sources, { evidence: new Map<string, Evidence>() }).modules
        .filter((entry) => entry.registered)
        .map((entry) => entry.contract.id),
    };
  },
  assert: (result, state): Assertion[] => [
    expectState('증거 맵을 안 넘기면 무너진 증거도 통과한다', true, result.blindPasses),
    expectState('넘기면 그 자리에서 잡힌다', false, result.crossCheckCatches),
    expectState('해시 없이도 강등은 잡는다 — 못 보는 것은 신선도뿐이다', true, result.hashlessPasses),
    expectState('완료를 주장하지 않는 PLANNED 모듈은 증거 없이도 등록된다', true, result.plannedRegistered),
    expectState('증거가 하나도 없으면 완료 주장은 전부 기각되고 PLANNED 만 남는다', ['C'], result.emptyEvidenceRejects),
    expectDeterministic(
      '같은 증거면 항상 같은 판정이다',
      () => violationsOf(buildRegistry(state, { evidence: CROSS_EVIDENCE, sourceHashes: CROSS_HASHES })),
      10,
    ),
  ],
});

export const v0Scenarios = [
  v0RegistryAccepts,
  v0RejectsDefective,
  v0Boundary,
  v0EvidenceCrosscheck,
  v0CrosscheckRejects,
  v0CrosscheckBoundary,
] as const;
