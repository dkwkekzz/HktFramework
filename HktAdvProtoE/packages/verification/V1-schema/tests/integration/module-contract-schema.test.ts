import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildRegistry, parseModuleContract, runScenario } from '@hkt/v0-module-contract';
import {
  contract,
  contractMissing,
  healthySet,
  OPTIONAL_FIELD_NAMES,
} from '../../../V0-module-contract/scenarios/fixtures.js';
import moduleContractSchema from '../../../V0-module-contract/schemas/module-contract.schema.json';
import { compileSchema, validate } from '../../src/compile.js';
import { SchemaRegistry } from '../../src/registry.js';
import { createV1Module } from '../../src/module.js';
import { v1Scenarios } from '../../scenarios/index.js';
import type { JsonSchema } from '../../src/types.js';

const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));
const CONTRACT_SCHEMA = moduleContractSchema as JsonSchema;

/** 저장소의 실제 MODULE.yaml 을 모두 모은다. */
function collectContracts(): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name === 'MODULE.yaml') {
        found.push({
          path: relative(WORKSPACE_ROOT, full).split(sep).join('/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };
  walk(join(WORKSPACE_ROOT, 'packages'));
  return found;
}

const documents = collectContracts();

describe('저장소의 MODULE.yaml 을 스키마로 강제한다', () => {
  it('계약 스키마가 컴파일된다 (지원 부분집합 안에 있다)', () => {
    expect(() => compileSchema(CONTRACT_SCHEMA)).not.toThrow();
  });

  it('MODULE.yaml 을 두 개 이상 찾는다', () => {
    expect(documents.length).toBeGreaterThanOrEqual(2);
  });

  it.each(documents.map((doc) => [doc.path, doc] as const))('%s 이 스키마를 지킨다', (_path, doc) => {
    const result = validate(CONTRACT_SCHEMA, parseYaml(doc.text));
    expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([]);
  });

  it('V0 파서와 V1 스키마가 실제 문서에 같은 판정을 낸다', () => {
    for (const doc of documents) {
      const v0Valid = parseModuleContract(doc).contract !== null;
      const v1Valid = validate(CONTRACT_SCHEMA, parseYaml(doc.text)).valid;
      expect(v1Valid, `${doc.path}: V0=${v0Valid} V1=${v1Valid}`).toBe(v0Valid);
    }
  });

  it('필드를 하나 지운 문서는 두 판정 모두 거부한다', () => {
    for (const field of OPTIONAL_FIELD_NAMES) {
      const broken = contractMissing('K0', 'entity-state', 'kernel', field);
      const v0Valid = parseModuleContract(broken).contract !== null;
      const v1Result = validate(CONTRACT_SCHEMA, parseYaml(broken.text));
      expect(v0Valid, `V0 이 ${field} 결손을 통과시켰다`).toBe(false);
      expect(v1Result.valid, `V1 이 ${field} 결손을 통과시켰다`).toBe(false);
      // 스키마 쪽 판정은 어느 조건에 걸렸는지 항상 남긴다
      expect(v1Result.issues.every((issue) => issue.schemaPath !== '')).toBe(true);
    }
  });

  it('스키마만 잡는 위반과 V0 만 잡는 위반의 경계가 문서대로다', () => {
    // 스키마는 문서 내부 형식만 본다 — 디렉터리 경로와 id 의 불일치는 V0 의 몫이다.
    const moved = { path: 'packages/kernel/K9-entity-state/MODULE.yaml', text: healthySet()[0]!.text };
    expect(parseModuleContract(moved).contract).toBeNull();
    expect(validate(CONTRACT_SCHEMA, parseYaml(moved.text)).valid).toBe(true);

    // 반대로 형식 위반(none 혼용)은 양쪽 모두 잡는다.
    const mixed = contract('K1', 'predicate-query', 'kernel', { depends_on: ['none', 'K0'] });
    expect(parseModuleContract(mixed).contract).toBeNull();
    expect(validate(CONTRACT_SCHEMA, parseYaml(mixed.text)).valid).toBe(false);
  });
});

describe('레지스트리 통합', () => {
  it('V0 레지스트리에 V0·V1 이 함께 등록되고 V1 의 선행이 V0 이다', () => {
    const report = buildRegistry(documents);
    expect(report.rejected).toEqual([]);
    expect(report.registered).toEqual(['V0', 'V1']);
    expect(report.registry.order).toEqual(['V0', 'V1']);
    expect(report.registry.dependents['V0']).toEqual(['V1']);
  });

  it('저장소의 모든 스키마 문서를 SchemaRegistry 에 등록할 수 있다', () => {
    const registry = new SchemaRegistry();
    const schemaFiles: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : 1,
      )) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(full);
        } else if (entry.name.endsWith('.schema.json')) {
          schemaFiles.push(full);
        }
      }
    };
    walk(join(WORKSPACE_ROOT, 'packages'));

    expect(schemaFiles.length).toBeGreaterThanOrEqual(3);
    for (const file of schemaFiles) {
      registry.add(JSON.parse(readFileSync(file, 'utf8')) as JsonSchema);
    }
    // 등록된 모든 스키마가 컴파일된다 — 저장소에 해석 불가능한 스키마가 없다는 뜻이다
    for (const id of registry.ids()) {
      expect(() => registry.validator(id), id).not.toThrow();
    }
    expect(registry.hash()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('시나리오 전량 실행', () => {
  const v1 = createV1Module(v1Scenarios);

  it('MODULE.yaml 의 scenarios 목록이 구현과 같다', () => {
    const contractDoc = documents.find((doc) => doc.path.includes('V1-schema'));
    const parsed = parseYaml(contractDoc?.text ?? '') as { scenarios: string[] };
    expect(parsed.scenarios).toEqual(v1Scenarios.map((scenario) => scenario.id));
  });

  it.each(v1Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s 통과',
    (_id, scenario) => {
      const run = runScenario(scenario, 'V1');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);

      // 원문 「24」의 구획이 모두 채워진다
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    },
  );

  it('모든 시나리오의 출력이 V1 자기 출력 스키마를 지킨다', () => {
    for (const scenario of v1Scenarios) {
      const input = scenario.arrange();
      const output = scenario.act(input, { moduleId: 'V1', seed: scenario.seed, tick: 0 });
      expect(v1.validateOutput(output), scenario.id).toEqual([]);
    }
  });

  it('시드를 바꿔도 결과가 같다 (결정성)', () => {
    for (const scenario of v1Scenarios) {
      const base = runScenario(scenario, 'V1');
      const other = runScenario(scenario, 'V1', scenario.seed + 4242n);
      expect(other.passed).toBe(base.passed);
      expect(other.view.after).toBe(base.view.after);
    }
  });
});

describe('수직 통합 슬라이스', () => {
  // VS0 은 K0~K3 을 포함한다 (원문 「20」 VS0).
  it.todo('VS0 결정적 세계 변화 — K0~K3 등록 후 실행');
});
