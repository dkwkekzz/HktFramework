// V0-b 레지스트리 단위 테스트 — 등록 규칙과 의존 DAG.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildRegistry, formatRegistry, readContract, type ContractSource } from '../src/index.ts';
import { loadContractSources } from '../src/load.ts';
import { parseYaml } from '../src/yaml.ts';

const contractsDir = new URL('../', import.meta.url);

function source(id: string, body: readonly string[]): ContractSource {
  return { name: `${id}.yaml`, text: [`id: ${id}`, ...body, ''].join('\n') };
}

const HEALTHY = [
  'name: healthy-module',
  'purpose: 온전한 계약이다.',
  'inputs: [A]',
  'outputs: [B]',
  'depends: []',
  'scenarios: [x-normal, x-failure, x-boundary]',
  'status: VERIFIED',
  'evidence: evidence/X.json',
] as const;

const rulesOf = (registry: ReturnType<typeof buildRegistry>, id: string): string[] =>
  (registry.modules.find((entry) => entry.contract.id === id)?.violations ?? [])
    .map((violation) => violation.rule)
    .sort();

describe('계약 읽기', () => {
  test('필드가 서식대로 좁혀진다', () => {
    const { contract, violations } = readContract(
      parseYaml(source('X', [...HEALTHY]).text),
      'X.yaml',
    );
    assert.deepEqual(violations, []);
    assert.equal(contract?.id, 'X');
    assert.deepEqual(contract?.inputs, ['A']);
    assert.equal(contract?.status, 'VERIFIED');
    assert.deepEqual(contract?.elements, []);
  });

  test('id 없는 계약은 좁혀지지 않는다', () => {
    const { contract, violations } = readContract(parseYaml('purpose: 목적만 있다.'), 'X.yaml');
    assert.equal(contract, null);
    assert.equal(violations[0]?.rule, 'missing-field');
  });

  test('모르는 status 는 거부된다', () => {
    const { contract, violations } = readContract(
      parseYaml('id: X\nstatus: 아무거나'),
      'X.yaml',
    );
    assert.equal(contract, null);
    assert.equal(violations[0]?.rule, 'bad-type');
  });

  test('공용 렌더러 5종 밖의 렌더러는 거부된다', () => {
    const { violations } = readContract(
      parseYaml(
        [...['id: X'], 'elements:', '  - name: Seed', '    ontology: State', '    renderer: hologram'].join('\n'),
      ),
      'X.yaml',
    );
    assert.equal(violations[0]?.rule, 'bad-type');
    assert.match(violations[0]?.message ?? '', /렌더러/);
  });
});

describe('등록 규칙', () => {
  test('온전한 계약은 등록된다', () => {
    const registry = buildRegistry([source('X', [...HEALTHY])]);
    assert.equal(registry.modules[0]?.registered, true);
    assert.deepEqual(registry.rejected, []);
  });

  test('목적 없는 모듈 등록 불가', () => {
    const registry = buildRegistry([
      source('X', HEALTHY.filter((entry) => !entry.startsWith('purpose'))),
    ]);
    assert.deepEqual(rulesOf(registry, 'X'), ['no-purpose']);
  });

  test('입출력 없는 처리 모듈 등록 불가', () => {
    const registry = buildRegistry([
      source('X', HEALTHY.map((entry) => entry.replace('[A]', '[]').replace('[B]', '[]'))),
    ]);
    assert.deepEqual(rulesOf(registry, 'X'), ['no-io']);
  });

  test('시나리오 없는 모듈 완료 불가 — 미완료 상태에서는 문제되지 않는다', () => {
    const withoutScenarios = HEALTHY.map((entry) =>
      entry.startsWith('scenarios') ? 'scenarios: []' : entry,
    );
    assert.deepEqual(rulesOf(buildRegistry([source('X', withoutScenarios)]), 'X'), ['no-scenario']);

    const planned = withoutScenarios.map((entry) =>
      entry.startsWith('status') ? 'status: PLANNED' : entry,
    );
    assert.deepEqual(rulesOf(buildRegistry([source('X', planned)]), 'X'), []);
  });

  test('증거 없는 VERIFIED 불가', () => {
    const registry = buildRegistry([
      source('X', HEALTHY.filter((entry) => !entry.startsWith('evidence'))),
    ]);
    assert.deepEqual(rulesOf(registry, 'X'), ['no-evidence']);
  });

  test('열린 하위 작업이 있으면 완료 불가', () => {
    const registry = buildRegistry([
      source('X', [
        ...HEALTHY,
        'subtasks:',
        '  - id: X-a',
        '    name: 일부',
        '    purpose: 하위 작업.',
        '    status: IN_PROGRESS',
      ]),
    ]);
    assert.deepEqual(rulesOf(registry, 'X'), ['open-subtask']);
  });

  test('순환 의존 등록 불가 — 자기 참조 포함', () => {
    const self = buildRegistry([
      source('X', HEALTHY.map((entry) => (entry.startsWith('depends') ? 'depends: [X]' : entry))),
    ]);
    assert.deepEqual(rulesOf(self, 'X'), ['dependency-cycle']);
    assert.equal(self.topologicalOrder, null);

    const pair = buildRegistry([
      source('A', HEALTHY.map((entry) => (entry.startsWith('depends') ? 'depends: [B]' : entry))),
      source('B', HEALTHY.map((entry) => (entry.startsWith('depends') ? 'depends: [A]' : entry))),
    ]);
    assert.equal(pair.topologicalOrder, null);
    assert.ok(rulesOf(pair, 'A').includes('dependency-cycle'));
    assert.ok(rulesOf(pair, 'B').includes('dependency-cycle'));
  });

  test('중복 ID 는 먼저 등록된 쪽을 남기고 사본만 거부한다', () => {
    // 등록 순서는 파일명 사전순으로 고정된다 — 같은 입력이면 항상 같은 쪽이 남는다.
    const registry = buildRegistry([
      { ...source('X', [...HEALTHY]), name: 'X-2.yaml' },
      { ...source('X', [...HEALTHY]), name: 'X-1.yaml' },
    ]);
    assert.equal(registry.modules.length, 1);
    assert.equal(registry.modules[0]?.registered, true);
    assert.equal(registry.rejected[0]?.rule, 'duplicate-id');
    assert.match(registry.rejected[0]?.message ?? '', /X-2\.yaml/);
  });

  test('파싱 실패는 등록 이전에 거부된다', () => {
    const registry = buildRegistry([{ name: 'X.yaml', text: 'id: X\n\tbad: 1' }]);
    assert.equal(registry.modules.length, 0);
    assert.equal(registry.rejected[0]?.rule, 'not-a-mapping');
    assert.match(registry.rejected[0]?.message ?? '', /2행/);
  });
});

describe('의존 DAG', () => {
  const chain = (): ContractSource[] => [
    source('A', [...HEALTHY]),
    source('B', HEALTHY.map((entry) => (entry.startsWith('depends') ? 'depends: [A]' : entry))),
    // C 는 아직 미완료 — 의존이 전부 VERIFIED 이므로 "착수 가능" 이어야 한다.
    source(
      'C',
      HEALTHY.filter((entry) => !entry.startsWith('evidence')).map((entry) =>
        entry.startsWith('depends')
          ? 'depends: [B]'
          : entry.startsWith('status')
            ? 'status: PLANNED'
            : entry,
      ),
    ),
  ];

  test('위상 순서는 의존을 앞세운다', () => {
    assert.deepEqual(buildRegistry(chain()).topologicalOrder, ['A', 'B', 'C']);
  });

  test('착수 가능 = 의존이 전부 VERIFIED 인 미완료 모듈', () => {
    assert.deepEqual(buildRegistry(chain()).ready, ['C']);
  });

  test('등록 순서가 달라도 결과는 같다', () => {
    const forward = buildRegistry(chain());
    const backward = buildRegistry([...chain()].reverse());
    assert.deepEqual(backward.topologicalOrder, forward.topologicalOrder);
    assert.deepEqual(
      backward.modules.map((entry) => entry.contract.id),
      forward.modules.map((entry) => entry.contract.id),
    );
  });

  test('없는 모듈에 의존하면 사유가 남는다', () => {
    const registry = buildRegistry([
      source('X', HEALTHY.map((entry) => (entry.startsWith('depends') ? 'depends: [없음]' : entry))),
    ]);
    assert.deepEqual(rulesOf(registry, 'X'), ['unknown-dependency']);
  });
});

describe('실제 계약 디렉터리', () => {
  const registry = buildRegistry(loadContractSources(contractsDir));

  test('모든 계약이 등록된다', () => {
    assert.deepEqual(
      registry.modules.filter((entry) => !entry.registered).map((entry) => entry.violations),
      [],
      formatRegistry(registry),
    );
    assert.deepEqual(registry.rejected, []);
  });

  test('순환 의존이 없다', () => {
    assert.notEqual(registry.topologicalOrder, null);
  });

  test('보고 표에 모든 모듈이 나온다', () => {
    const text = formatRegistry(registry);
    for (const entry of registry.modules) {
      assert.ok(text.includes(entry.contract.id));
    }
  });
});
