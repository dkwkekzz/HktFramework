import type {
  AssertionResult,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '../src/contract.js';
import { buildRegistry } from '../src/registry.js';
import { V0_PURPOSE, validateOutput, type V0Input, type V0Output } from '../src/module.js';
import { ISSUE, type ModuleContractDocument } from '../src/types.js';
import { contract, healthySet } from './fixtures.js';

/** Given-When-Then 한 장면. When 은 항상 buildRegistry 이므로 Given(arrange)과 Then(check)만 쓴다. */
interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  /** Given */
  arrange(): V0Input;
  /** Then */
  check(input: V0Input, output: V0Output, context: ModuleContext): AssertionResult[];
  /** 상태 전후 표기의 Given 쪽 문장 */
  before?: string;
}

function defineScene(spec: SceneSpec): VerificationScenario<V0Input, V0Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => buildRegistry(input.documents),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      const rejectedByPath = new Map(output.rejected.map((r) => [r.path, r]));
      return {
        purpose: V0_PURPOSE,
        input: input.documents.map((doc) => ({
          label: doc.path,
          value: summarize(doc),
        })),
        candidates: input.documents.map((doc) => {
          const rejection = rejectedByPath.get(doc.path);
          return {
            label: doc.path.split('/').at(-2) ?? doc.path,
            value: rejection
              ? `거부 (${[...new Set(rejection.issues.map((i) => i.code))].join(', ')})`
              : '등록',
          };
        }),
        result: `등록 ${output.registered.length} / 거부 ${output.rejected.length}${
          output.registered.length > 0 ? ` — 순서 ${output.registry.order.join(' → ')}` : ''
        }`,
        reasons:
          output.issues.length > 0
            ? output.issues.map((issue) => `${issue.path} · ${issue.code} · ${issue.message}`)
            : ['거부 사유 없음 — 모든 계약이 규약을 지켰다.'],
        before: spec.before ?? `레지스트리 비어 있음 · 계약 문서 ${input.documents.length}건`,
        after: `모듈 ${output.registered.length}개 [${output.registered.join(', ')}] · ${output.registry.hash}`,
        checks: assertions.map((a) => ({
          label: a.reason ? `${a.id} — ${a.reason}` : a.id,
          passed: a.passed,
        })),
      };
    },
  };
}

function summarize(doc: ModuleContractDocument): string {
  const idLine = /^id:\s*(\S+)/m.exec(doc.text)?.[1] ?? '(id 없음)';
  const hasPurpose = /^purpose:/m.test(doc.text);
  const deps = /^depends_on:\n((?:\s+-\s+\S+\n)+)/m.exec(doc.text)?.[1];
  const depList = deps
    ? deps
        .trim()
        .split('\n')
        .map((line) => line.replace(/^\s*-\s*/, ''))
        .join(', ')
    : '(depends_on 없음)';
  return `id=${idLine} · purpose=${hasPurpose ? '있음' : '없음'} · depends_on=${depList}`;
}

const eq = (id: string, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const ok = (id: string, passed: boolean, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed,
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

/** 특정 경로의 거부 사유에 code 가 포함되는지 */
function rejectionCodes(output: V0Output, pathFragment: string): string[] {
  const rejection = output.rejected.find((r) => r.path.includes(pathFragment));
  return rejection ? [...new Set(rejection.issues.map((i) => i.code))].sort() : [];
}

/** 시드로 결정되는 순열 — Math.random 은 원문 「23」이 금지한다. */
export function permute<T>(items: readonly T[], seed: bigint): T[] {
  const out = [...items];
  let state = seed % 2147483647n;
  if (state <= 0n) state += 2147483646n;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 16807n) % 2147483647n;
    const j = Number(state % BigInt(i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. 규약을 지킨 계약은 등록된다
// ---------------------------------------------------------------------------
const validContractRegisters = defineScene({
  id: 'valid_contract_registers',
  title: '규약을 지킨 계약 4건이 위상 순서대로 등록된다',
  seed: 1n,
  arrange: () => ({ documents: healthySet() }),
  check: (_input, output) => [
    eq('registered_ids', ['V0', 'V1', 'V2', 'V3'], [...output.registered]),
    eq('no_rejection', [], output.rejected.map((r) => r.path)),
    eq('topological_order', ['V0', 'V1', 'V2', 'V3'], [...output.registry.order], '선행이 항상 앞에 온다'),
    eq('dependents_of_V0', ['V1', 'V2'], [...(output.registry.dependents['V0'] ?? [])]),
    eq('output_invariants', [], validateOutput(output).map((i) => i.code)),
  ],
});

// ---------------------------------------------------------------------------
// 2. 목적 없는 모듈은 등록 실패 (원문 V0 대표 검증)
// ---------------------------------------------------------------------------
const missingPurposeIsRejected = defineScene({
  id: 'missing_purpose_is_rejected',
  title: '목적이 없는 계약은 등록 실패하고, 그것을 선행으로 삼은 모듈도 함께 막힌다',
  seed: 2n,
  arrange: () => ({
    documents: healthySet().map((doc) =>
      doc.path.includes('V1-schema')
        ? contract('V1', 'schema', 'verification', { depends_on: ['V0'], purpose: undefined })
        : doc,
    ),
  }),
  check: (_input, output) => [
    eq('registered_ids', ['V0', 'V2'], [...output.registered], 'V1 은 거부, V3 은 연쇄 차단'),
    eq('V1_rejected_with_missing_field', [ISSUE.MISSING_FIELD], rejectionCodes(output, 'V1-schema')),
    ok(
      'V1_issue_points_to_purpose_path',
      output.issues.some(
        (i) => i.code === ISSUE.MISSING_FIELD && i.path.endsWith('V1-schema/MODULE.yaml#/purpose'),
      ),
      'packages/verification/V1-schema/MODULE.yaml#/purpose',
      output.issues.filter((i) => i.code === ISSUE.MISSING_FIELD).map((i) => i.path),
      '실패한 조건이 문서 내 경로로 지목된다',
    ),
    eq(
      'V3_blocked_by_rejected_dependency',
      [ISSUE.DEPENDENCY_REJECTED],
      rejectionCodes(output, 'V3-scenario-runner'),
    ),
  ],
});

// ---------------------------------------------------------------------------
// 3. 선행 모듈 선언이 없는 모듈은 등록 실패 (원문 V0 대표 검증)
// ---------------------------------------------------------------------------
const missingDependencyFieldIsRejected = defineScene({
  id: 'missing_dependency_field_is_rejected',
  title: 'depends_on 필드를 생략한 계약은 등록 실패한다 (선행 없음은 `none` 으로 명시해야 한다)',
  seed: 3n,
  arrange: () => ({
    documents: healthySet().map((doc) =>
      doc.path.includes('V2-determinism')
        ? contract('V2', 'determinism', 'verification', { depends_on: undefined })
        : doc,
    ),
  }),
  check: (_input, output) => [
    eq('registered_ids', ['V0', 'V1'], [...output.registered]),
    eq(
      'V2_rejected_with_missing_field',
      [ISSUE.MISSING_FIELD],
      rejectionCodes(output, 'V2-determinism'),
    ),
    ok(
      'message_demands_explicit_none',
      output.issues.some((i) => i.path.endsWith('V2-determinism/MODULE.yaml#/depends_on') && i.message.includes('none')),
      '`- none` 명시 요구',
      output.issues.map((i) => i.message),
    ),
    eq(
      'V3_blocked_by_rejected_dependency',
      [ISSUE.DEPENDENCY_REJECTED],
      rejectionCodes(output, 'V3-scenario-runner'),
    ),
  ],
});

// ---------------------------------------------------------------------------
// 4. 등록되지 않은 선행을 참조하면 실패
// ---------------------------------------------------------------------------
const unknownDependencyIsRejected = defineScene({
  id: 'unknown_dependency_is_rejected',
  title: '존재하지 않는 선행 모듈을 참조한 계약만 거부되고 나머지는 등록된다',
  seed: 4n,
  arrange: () => ({
    documents: [
      ...healthySet(),
      contract('V4', 'evidence-gate', 'verification', { depends_on: ['V3', 'V9'] }),
    ],
  }),
  check: (_input, output) => [
    eq('registered_ids', ['V0', 'V1', 'V2', 'V3'], [...output.registered]),
    eq(
      'V4_rejected_with_unknown_dependency',
      [ISSUE.UNKNOWN_DEPENDENCY],
      rejectionCodes(output, 'V4-evidence-gate'),
    ),
    ok(
      'unknown_id_is_named',
      output.issues.some((i) => i.code === ISSUE.UNKNOWN_DEPENDENCY && i.message.includes('V9')),
      'V9 를 지목',
      output.issues.map((i) => i.message),
    ),
    eq('healthy_hash_unchanged', buildRegistry(healthySet()).registry.hash, output.registry.hash, '거부된 문서는 레지스트리 해시에 섞이지 않는다'),
  ],
});

// ---------------------------------------------------------------------------
// 5. 의존성 순환은 실패
// ---------------------------------------------------------------------------
const dependencyCycleIsRejected = defineScene({
  id: 'dependency_cycle_is_rejected',
  title: '순환에 포함된 모듈은 모두 거부되고 순환 경로가 보고된다',
  seed: 5n,
  arrange: () => ({
    documents: [
      contract('V0', 'module-contract', 'verification', { owns_state: ['module_registry'] }),
      contract('K1', 'predicate-query', 'kernel', { depends_on: ['V0', 'K2'] }),
      contract('K2', 'rule-transaction', 'kernel', { depends_on: ['K1'] }),
    ],
  }),
  check: (_input, output) => [
    eq('registered_ids', ['V0'], [...output.registered]),
    eq('K1_rejected_with_cycle', [ISSUE.DEPENDENCY_CYCLE], rejectionCodes(output, 'K1-predicate-query')),
    eq('K2_rejected_with_cycle', [ISSUE.DEPENDENCY_CYCLE], rejectionCodes(output, 'K2-rule-transaction')),
    ok(
      'cycle_path_is_reported',
      output.issues.some((i) => i.code === ISSUE.DEPENDENCY_CYCLE && i.message.includes('→')),
      '순환 경로 문자열',
      output.issues.filter((i) => i.code === ISSUE.DEPENDENCY_CYCLE).map((i) => i.message),
    ),
    eq('output_invariants', [], validateOutput(output).map((i) => i.code)),
  ],
});

// ---------------------------------------------------------------------------
// 6. 등록 순서와 무관 · 같은 입력이면 같은 해시 (G5 결정성 게이트)
// ---------------------------------------------------------------------------
const registrationOrderDoesNotMatter = defineScene({
  id: 'registration_order_does_not_matter',
  title: '문서 순서를 섞어도 레지스트리와 해시가 같다 (100회 반복 동일)',
  seed: 6n,
  arrange: () => ({ documents: permute(healthySet(), 6n) }),
  check: (input, output, context) => {
    const canonical = buildRegistry(healthySet());
    const hashes = new Set<string>();
    for (let run = 0; run < 100; run += 1) {
      const shuffled = permute(input.documents, context.seed + BigInt(run));
      hashes.add(buildRegistry(shuffled).registry.hash);
    }
    return [
      eq('hash_matches_canonical_order', canonical.registry.hash, output.registry.hash),
      eq('registered_ids_match', [...canonical.registered], [...output.registered]),
      eq('topological_order_matches', [...canonical.registry.order], [...output.registry.order]),
      eq('unique_hashes_over_100_permutations', 1, hashes.size, '리플레이 불일치 금지 (GI-12)'),
    ];
  },
  before: '계약 문서 4건 (시드로 섞인 순서)',
});

export const v0Scenarios: VerificationScenario<V0Input, V0Output>[] = [
  validContractRegisters,
  missingPurposeIsRejected,
  missingDependencyFieldIsRejected,
  unknownDependencyIsRejected,
  dependencyCycleIsRejected,
  registrationOrderDoesNotMatter,
];
