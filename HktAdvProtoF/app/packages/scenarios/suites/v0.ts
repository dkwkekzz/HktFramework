// V0 검증 시나리오 3종 — 레지스트리가 온전한 계약은 등록하고 결함 계약은 사유와 함께 거부하는가.

import { buildRegistry, type ContractSource, type ModuleRegistry } from '@hkt/contracts';

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

export const v0Scenarios = [v0RegistryAccepts, v0RejectsDefective, v0Boundary] as const;
