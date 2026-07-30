import type {
  AssertionResult,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { parseModuleContract } from '@hkt/v0-module-contract';
// V0 의 픽스처·스키마는 읽기만 한다 (원문 「23」: 다른 모듈의 파일을 수정하지 않는다).
import {
  contract,
  contractMissing,
  healthySet,
} from '../../V0-module-contract/scenarios/fixtures.js';
import { parse as parseYaml } from 'yaml';
import moduleContractSchema from '../../V0-module-contract/schemas/module-contract.schema.json';
import { executeV1, V1_PURPOSE, checkOutputConsistency } from '../src/module.js';
import type { V1Input, V1Output } from '../src/module.js';
import { ISSUE, type JsonSchema } from '../src/types.js';
import {
  badOneOfWorldState,
  missingRequiredWorldState,
  UNSUPPORTED_KEYWORD_SCHEMA,
  unknownPropertyWorldState,
  validWorldState,
  wrongTypeWorldState,
  WORLD_STATE_FIXTURE_SCHEMA,
} from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): V1Input;
  check(input: V1Input, output: V1Output, context: ModuleContext): AssertionResult[];
}

function defineScene(spec: SceneSpec): VerificationScenario<V1Input, V1Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeV1(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      const byLabel = new Map(output.results.map((result) => [result.label, result]));
      return {
        purpose: V1_PURPOSE,
        input: [
          {
            label: '스키마',
            value: `${input.schemaLabel ?? '(무명)'} · ${
              typeof input.schema['$id'] === 'string' ? input.schema['$id'] : '$id 없음'
            }`,
          },
          ...input.instances.map((instance) => ({
            label: `인스턴스 ${instance.label}`,
            value: preview(instance.data),
          })),
        ],
        candidates: input.instances.map((instance) => {
          const result = byLabel.get(instance.label);
          return {
            label: instance.label,
            value: !result
              ? '판정 없음 (스키마 컴파일 실패)'
              : result.valid
                ? '통과'
                : `위반 ${result.issues.length}건 (${[...new Set(result.issues.map((i) => i.code))].join(', ')})`,
          };
        }),
        result: output.compileError
          ? `스키마 컴파일 실패 — ${output.compileError.code} @ ${output.compileError.schemaPath}`
          : `통과 ${output.validCount} / 위반 ${output.invalidCount}`,
        reasons: reasonLines(output),
        before: `검증 전 · 인스턴스 ${input.instances.length}건 (판정 없음)`,
        after: output.compileError
          ? '검증 후 · 판정 0건 (스키마가 컴파일되지 않아 어떤 값도 통과시키지 않는다)'
          : `검증 후 · 통과 ${output.validCount} / 위반 ${output.invalidCount}`,
        checks: assertions.map((a) => ({
          label: a.reason ? `${a.id} — ${a.reason}` : a.id,
          passed: a.passed,
        })),
      };
    },
  };
}

/** Lab 「이유」 구획 — 위반마다 데이터 경로와 스키마 경로를 한 줄로 보여 준다. */
function reasonLines(output: V1Output): string[] {
  if (output.compileError) return [output.compileError.message];
  const lines = output.results.flatMap((result) =>
    result.issues.map(
      (issue) =>
        `${result.label} · ${issue.instancePath || '/'} · ${issue.code} · ${issue.message} [스키마 ${issue.schemaPath}]`,
    ),
  );
  return lines.length > 0 ? lines : ['위반 없음 — 모든 인스턴스가 스키마를 지켰다.'];
}

function preview(data: unknown): string {
  const text = JSON.stringify(data);
  return text === undefined ? 'undefined' : text.length > 140 ? `${text.slice(0, 137)}...` : text;
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

const issuesOf = (output: V1Output, label: string) =>
  output.results.find((result) => result.label === label)?.issues ?? [];

/** 같은 입력을 두 번 돌려 위반 목록이 완전히 같은지 확인한다 (결정성). */
const deterministic = (input: V1Input, output: V1Output): AssertionResult =>
  eq(
    'identical_input_produces_identical_issues',
    JSON.stringify(output),
    JSON.stringify(executeV1(input)),
    '같은 스키마·같은 값이면 같은 위반 목록',
  );

/** 검증이 입력 데이터를 건드리지 않았는지 확인한다. */
function nonMutating(input: V1Input): AssertionResult {
  const before = JSON.stringify(input.instances);
  executeV1(input);
  return eq('validation_does_not_mutate_instance', before, JSON.stringify(input.instances));
}

const worldStateInput = (label: string, data: unknown): V1Input => ({
  schemaLabel: '세계 상태 (픽스처)',
  schema: WORLD_STATE_FIXTURE_SCHEMA,
  instances: [{ label, data }],
});

// ---------------------------------------------------------------------------
// 1. 스키마를 지킨 값은 통과한다
// ---------------------------------------------------------------------------
const validStatePasses = defineScene({
  id: 'valid_state_passes',
  title: '스키마를 지킨 세계 상태는 위반 없이 통과한다',
  seed: 11n,
  arrange: () => ({
    schemaLabel: '세계 상태 (픽스처)',
    schema: WORLD_STATE_FIXTURE_SCHEMA,
    instances: [
      { label: '정상 상태', data: validWorldState() },
      { label: '실체 1개 · 태그 없음', data: { tick: 0, entities: [{ id: 'e7', energy: 0, position: { x: 1, y: 2 } }] } },
    ],
  }),
  check: (input, output) => [
    eq('all_valid', 2, output.validCount),
    eq('no_issue', [], output.results.flatMap((result) => result.issues)),
    eq('output_invariants', [], checkOutputConsistency(output).map((i) => i.code)),
    deterministic(input, output),
    nonMutating(input),
  ],
});

// ---------------------------------------------------------------------------
// 2. 타입이 틀리면 구체적인 경로와 함께 실패한다 (원문 V1 대표 검증)
// ---------------------------------------------------------------------------
const wrongTypeReportsPointerPath = defineScene({
  id: 'wrong_type_reports_pointer_path',
  title: '잘못된 상태 JSON 은 `/entities/1/energy` 처럼 정확한 경로로 거부된다',
  seed: 12n,
  arrange: () => worldStateInput('두 번째 실체의 energy 가 문자열', wrongTypeWorldState()),
  check: (input, output) => {
    const issues = issuesOf(output, '두 번째 실체의 energy 가 문자열');
    return [
      eq('one_violation', 1, issues.length),
      eq('instance_path', '/entities/1/energy', issues[0]?.instancePath, '데이터의 어디가 틀렸는지'),
      eq(
        'schema_path',
        '/$defs/entity/properties/energy/type',
        issues[0]?.schemaPath,
        '스키마의 어느 조건에 걸렸는지',
      ),
      eq('code', ISSUE.TYPE, issues[0]?.code),
      ok(
        'message_names_actual_type',
        (issues[0]?.message ?? '').includes('string'),
        'string 을 지목',
        issues[0]?.message,
      ),
      eq('valid_count', 0, output.validCount),
      deterministic(input, output),
    ];
  },
});

// ---------------------------------------------------------------------------
// 3. 필수 속성 누락
// ---------------------------------------------------------------------------
const missingRequiredFieldIsRejected = defineScene({
  id: 'missing_required_field_is_rejected',
  title: '필수 속성이 없으면 그 속성이 있어야 할 자리를 지목한다',
  seed: 13n,
  arrange: () => worldStateInput('position 없음', missingRequiredWorldState()),
  check: (input, output) => {
    const issues = issuesOf(output, 'position 없음');
    return [
      eq('one_violation', 1, issues.length),
      eq('code', ISSUE.REQUIRED, issues[0]?.code),
      eq('instance_path', '/entities/0/position', issues[0]?.instancePath),
      eq('schema_path', '/$defs/entity/required', issues[0]?.schemaPath),
      deterministic(input, output),
    ];
  },
});

// ---------------------------------------------------------------------------
// 4. 선언되지 않은 속성
// ---------------------------------------------------------------------------
const unknownPropertyIsRejected = defineScene({
  id: 'unknown_property_is_rejected',
  title: '선언되지 않은 속성은 거부하고 허용 속성 목록을 함께 보여 준다',
  seed: 14n,
  arrange: () => worldStateInput('mana 속성 추가', unknownPropertyWorldState()),
  check: (input, output) => {
    const issues = issuesOf(output, 'mana 속성 추가');
    return [
      eq('one_violation', 1, issues.length),
      eq('code', ISSUE.ADDITIONAL_PROPERTY, issues[0]?.code),
      eq('instance_path', '/entities/0/mana', issues[0]?.instancePath),
      ok(
        'message_lists_allowed_properties',
        (issues[0]?.message ?? '').includes('energy'),
        '허용 속성 목록',
        issues[0]?.message,
      ),
      deterministic(input, output),
    ];
  },
});

// ---------------------------------------------------------------------------
// 5. oneOf 후보 전부 실패 — 왜 안 맞는지 설명한다
// ---------------------------------------------------------------------------
const oneOfBranchFailureIsExplained = defineScene({
  id: 'one_of_branch_failure_is_explained',
  title: 'oneOf 후보 어디에도 맞지 않으면 후보별 실패 이유를 요약한다',
  seed: 15n,
  arrange: () => worldStateInput('position 이 z 만 가짐', badOneOfWorldState()),
  check: (input, output) => {
    const issues = issuesOf(output, 'position 이 z 만 가짐');
    const oneOf = issues.find((issue) => issue.code === ISSUE.ONE_OF_NO_MATCH);
    return [
      ok('one_of_issue_exists', oneOf !== undefined, ISSUE.ONE_OF_NO_MATCH, issues.map((i) => i.code)),
      eq('instance_path', '/entities/0/position', oneOf?.instancePath),
      eq('schema_path', '/$defs/entity/properties/position/oneOf', oneOf?.schemaPath),
      ok(
        'message_summarizes_each_branch',
        (oneOf?.message ?? '').includes('[0]') && (oneOf?.message ?? '').includes('[1]'),
        '후보 0·1 의 실패 요약',
        oneOf?.message,
      ),
      deterministic(input, output),
    ];
  },
});

// ---------------------------------------------------------------------------
// 6. 지원하지 않는 키워드는 컴파일 단계에서 막는다
// ---------------------------------------------------------------------------
const unsupportedKeywordFailsCompilation = defineScene({
  id: 'unsupported_keyword_fails_compilation',
  title: '모르는 키워드가 있으면 검증을 시작하지 않는다 (조건 완화 금지)',
  seed: 16n,
  arrange: () => ({
    schemaLabel: '지원하지 않는 키워드를 쓴 스키마',
    schema: UNSUPPORTED_KEYWORD_SCHEMA,
    instances: [{ label: '아무 값', data: { energy: -5 } }],
  }),
  check: (input, output) => [
    ok('compile_error_reported', output.compileError !== null, 'compileError', output.compileError),
    eq('compile_error_code', 'E_UNSUPPORTED_KEYWORD', output.compileError?.code),
    eq(
      'compile_error_path',
      '/properties/energy/exclusiveMinimumValue',
      output.compileError?.schemaPath,
      '스키마의 어느 위치가 문제인지',
    ),
    eq('no_instance_judged', 0, output.results.length, '통과도 위반도 만들지 않는다'),
    eq('output_invariants', [], checkOutputConsistency(output).map((i) => i.code)),
    deterministic(input, output),
  ],
});

// ---------------------------------------------------------------------------
// 7. V0 의 계약 스키마와 V0 파서의 판정이 일치한다
// ---------------------------------------------------------------------------
const contractFixtures = (): { label: string; text: string; path: string }[] => {
  const healthy = healthySet();
  return [
    ...healthy.map((doc) => ({
      label: `정상 ${doc.path.split('/').at(-2) as string}`,
      text: doc.text,
      path: doc.path,
    })),
    {
      label: '목적 없음',
      ...pick(contractMissing('K0', 'entity-state', 'kernel', 'purpose')),
    },
    {
      label: 'depends_on 없음',
      ...pick(contractMissing('K1', 'predicate-query', 'kernel', 'depends_on')),
    },
    {
      label: 'commands 없음',
      ...pick(contractMissing('K2', 'rule-transaction', 'kernel', 'commands')),
    },
    {
      label: 'none 을 다른 값과 섞음',
      ...pick(contract('K3', 'event-replay', 'kernel', { depends_on: ['none', 'K2'] })),
    },
  ];
};

function pick(doc: { path: string; text: string }): { text: string; path: string } {
  return { text: doc.text, path: doc.path };
}

const moduleContractSchemaAgreesWithV0 = defineScene({
  id: 'module_contract_schema_agrees_with_v0',
  title: 'MODULE.yaml 스키마의 판정이 V0 파서의 판정과 일치한다',
  seed: 17n,
  arrange: () => ({
    schemaLabel: 'MODULE.yaml (V0 소유)',
    schema: moduleContractSchema as JsonSchema,
    instances: contractFixtures().map((fixture) => ({
      label: fixture.label,
      data: parseYaml(fixture.text) as unknown,
    })),
  }),
  check: (input, output) => {
    const fixtures = contractFixtures();
    const v0Verdicts = fixtures.map(
      (fixture) => parseModuleContract({ path: fixture.path, text: fixture.text }).contract !== null,
    );
    const v1Verdicts = fixtures.map(
      (fixture) => output.results.find((result) => result.label === fixture.label)?.valid ?? null,
    );
    return [
      eq('verdicts_agree', v0Verdicts, v1Verdicts, 'V0 파서와 V1 스키마가 같은 문서를 같게 판정한다'),
      eq('four_valid_four_invalid', [4, 4], [output.validCount, output.invalidCount]),
      ok(
        'invalid_documents_have_paths',
        output.results
          .filter((result) => !result.valid)
          .every((result) => result.issues.every((issue) => issue.schemaPath !== '')),
        '모든 위반이 스키마 경로를 갖는다',
        output.results.filter((r) => !r.valid).map((r) => r.issues.map((i) => i.schemaPath)),
      ),
      deterministic(input, output),
    ];
  },
});

export const v1Scenarios: VerificationScenario<V1Input, V1Output>[] = [
  validStatePasses,
  wrongTypeReportsPointerPath,
  missingRequiredFieldIsRejected,
  unknownPropertyIsRejected,
  oneOfBranchFailureIsExplained,
  unsupportedKeywordFailsCompilation,
  moduleContractSchemaAgreesWithV0,
];
