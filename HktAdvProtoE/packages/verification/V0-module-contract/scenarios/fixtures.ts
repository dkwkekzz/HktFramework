import type { ModuleContractDocument } from '../src/types.js';

/**
 * 시나리오 픽스처.
 *
 * 브라우저 Lab 에서도 같은 시나리오를 돌려야 하므로 파일 시스템을 읽지 않고 문자열로 둔다.
 * 실제 저장소의 MODULE.yaml 을 읽는 경로는 tests/integration 이 담당한다.
 */

export interface ContractFields {
  id: string;
  name: string;
  /** `undefined` 는 "필드를 아예 쓰지 않는다"는 뜻이다 — 결손 문서를 만들기 위한 것이다. */
  purpose?: string | undefined;
  depends_on?: string[] | undefined;
  owns_state?: string[] | undefined;
  inputs?: string[] | undefined;
  outputs?: string[] | undefined;
  invariants?: string[] | undefined;
  scenarios?: string[] | undefined;
  commands?: { test: string; lab: string; verify: string } | undefined;
}

const list = (field: string, items: string[]): string =>
  `${field}:\n${items.map((item) => `  - ${item}`).join('\n')}\n`;

/** 필드를 하나씩 지워볼 수 있는 MODULE.yaml 생성기 — 결손 문서를 손으로 쓰지 않기 위한 것이다. */
export function makeContractYaml(fields: ContractFields): string {
  let out = `id: ${fields.id}\nname: ${fields.name}\n`;
  if (fields.purpose !== undefined) out += `purpose: >\n  ${fields.purpose}\n`;
  if (fields.depends_on !== undefined) out += list('depends_on', fields.depends_on);
  if (fields.owns_state !== undefined) out += list('owns_state', fields.owns_state);
  if (fields.inputs !== undefined) out += list('inputs', fields.inputs);
  if (fields.outputs !== undefined) out += list('outputs', fields.outputs);
  if (fields.invariants !== undefined) out += list('invariants', fields.invariants);
  if (fields.scenarios !== undefined) out += list('scenarios', fields.scenarios);
  if (fields.commands !== undefined) {
    out += `commands:\n  test: ${fields.commands.test}\n  lab: ${fields.commands.lab}\n  verify: ${fields.commands.verify}\n`;
  }
  return out;
}

const DEFAULTS = {
  purpose: '검증용 계약 문서다.',
  depends_on: ['none'],
  owns_state: ['none'],
  inputs: ['fixture_input'],
  outputs: ['fixture_output'],
  invariants: ['fixture_invariant'],
  scenarios: ['fixture_scenario'],
  commands: { test: 'pnpm test fixture', lab: 'pnpm lab', verify: 'pnpm verify fixture' },
} as const;

/** 규약을 지키는 계약 문서 하나. overrides 로 필드를 덮거나(undefined 로) 지운다. */
export function contract(
  id: string,
  name: string,
  group: string,
  overrides: Partial<ContractFields> = {},
): ModuleContractDocument {
  const fields: ContractFields = {
    id,
    name,
    purpose: DEFAULTS.purpose,
    depends_on: [...DEFAULTS.depends_on],
    owns_state: [...DEFAULTS.owns_state],
    inputs: [...DEFAULTS.inputs],
    outputs: [...DEFAULTS.outputs],
    invariants: [...DEFAULTS.invariants],
    scenarios: [...DEFAULTS.scenarios],
    commands: { ...DEFAULTS.commands },
    ...overrides,
  };
  return {
    path: `packages/${group}/${fields.id}-${fields.name}/MODULE.yaml`,
    text: makeContractYaml(fields),
  };
}

/** 필수 필드 목록 — 하나를 지운 결손 문서를 만들 때 쓴다. */
export const OPTIONAL_FIELD_NAMES = [
  'purpose',
  'depends_on',
  'owns_state',
  'inputs',
  'outputs',
  'invariants',
  'scenarios',
  'commands',
] as const;

export type OmittableField = (typeof OPTIONAL_FIELD_NAMES)[number];

/** 필드 하나를 지운 계약 문서 — 결손 검증용. */
export function contractMissing(
  id: string,
  name: string,
  group: string,
  field: OmittableField,
  overrides: Partial<ContractFields> = {},
): ModuleContractDocument {
  const merged = { ...overrides, [field]: undefined } as Partial<ContractFields>;
  return contract(id, name, group, merged);
}

/** 정상 4모듈 집합: V0 ← V1 ← V3, V0 ← V2 ← V3 */
export function healthySet(): ModuleContractDocument[] {
  return [
    contract('V0', 'module-contract', 'verification', {
      purpose: '모든 모듈의 계약과 의존성을 등록한다.',
      owns_state: ['module_registry'],
    }),
    contract('V1', 'schema', 'verification', {
      purpose: '입력·출력 데이터가 계약을 지키도록 강제한다.',
      depends_on: ['V0'],
    }),
    contract('V2', 'determinism', 'verification', {
      purpose: '시간·ID·무작위성을 결정적으로 만든다.',
      depends_on: ['V0'],
    }),
    contract('V3', 'scenario-runner', 'verification', {
      purpose: 'Given-When-Then 시나리오를 실행한다.',
      depends_on: ['V1', 'V2'],
    }),
  ];
}
