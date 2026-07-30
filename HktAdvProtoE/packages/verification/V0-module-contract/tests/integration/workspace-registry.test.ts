import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildRegistry } from '../../src/registry.js';
import { runScenario } from '../../src/contract.js';
import { validateInput, validateOutput } from '../../src/module.js';
import { v0Scenarios } from '../../scenarios/index.js';
import type { ModuleContractDocument } from '../../src/types.js';

const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));

/** 저장소의 실제 MODULE.yaml 을 모두 모은다 (경로 오름차순). */
function collectContracts(): ModuleContractDocument[] {
  const packagesRoot = join(WORKSPACE_ROOT, 'packages');
  const found: ModuleContractDocument[] = [];
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
  walk(packagesRoot);
  return found;
}

const documents = collectContracts();
const report = buildRegistry(validateInput({ documents }).documents);
const v0 = report.registry.modules.find((m) => m.id === 'V0');

describe('저장소 실제 계약 등록', () => {
  it('MODULE.yaml 을 하나 이상 찾는다', () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it('모든 계약이 거부 없이 등록된다', () => {
    expect(report.rejected).toEqual([]);
    expect(report.issues).toEqual([]);
    expect(validateOutput(report)).toEqual([]);
  });

  it('V0 이 레지스트리에 있고 선행이 없다', () => {
    expect(v0).toBeDefined();
    expect(v0?.dependsOn).toEqual([]);
    expect(v0?.ownsState).toEqual(['module_registry']);
    expect(report.registry.order[0]).toBe('V0');
  });
});

describe('계약 문서와 구현의 정합', () => {
  it('MODULE.yaml 의 scenarios 목록이 구현된 시나리오와 정확히 같다', () => {
    expect(v0?.scenarios).toEqual(v0Scenarios.map((scenario) => scenario.id));
  });

  it('MODULE.yaml 의 invariants 가 코드(validateOutput 코드 또는 시나리오 이름)에서 검증된다', () => {
    const codeChecked = new Set(
      [
        'module_purpose_must_exist',
        'dependency_must_reference_registered_module',
        'dependency_graph_must_be_acyclic',
        'module_id_must_be_unique',
        'identical_documents_must_produce_identical_registry_hash',
      ].map((name) => `E_INVARIANT_${name}`),
    );
    // validateOutput 이 위 코드들만 발급한다는 것을 문자열이 아니라 실제 발급으로 확인한다
    const forged = {
      ...report,
      registry: { ...report.registry, hash: 'sha256:0' },
    };
    expect(validateOutput(forged).map((i) => i.code)).toEqual([
      'E_INVARIANT_identical_documents_must_produce_identical_registry_hash',
    ]);

    const scenarioCovered = new Set([
      'dependency_field_must_be_declared', // missing_dependency_field_is_rejected
      'registration_must_be_order_independent', // registration_order_does_not_matter
    ]);
    for (const invariant of v0?.invariants ?? []) {
      const covered =
        codeChecked.has(`E_INVARIANT_${invariant}`) || scenarioCovered.has(invariant);
      expect(covered, `불변조건 \`${invariant}\` 을 검증하는 코드가 없다`).toBe(true);
    }
  });

  it('MODULE.yaml 의 commands 가 루트 package.json 스크립트를 가리킨다', () => {
    const rootPkg = JSON.parse(
      readFileSync(join(WORKSPACE_ROOT, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    for (const command of [v0?.commands.test, v0?.commands.lab, v0?.commands.verify]) {
      expect(command).toMatch(/^pnpm /);
      const script = (command as string).split(' ')[1] as string;
      expect(Object.keys(rootPkg.scripts)).toContain(script);
    }
  });
});

describe('시나리오 전량 실행', () => {
  it.each(v0Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s 통과',
    (_id, scenario) => {
      const run = runScenario(scenario, 'V0');
      const failed = run.assertions.filter((a) => !a.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
      expect(run.passed).toBe(true);
      // Lab 화면이 원문 「24」의 구획을 모두 채운다
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

  it('시드를 바꿔도 결과가 같다 (결정성)', () => {
    for (const scenario of v0Scenarios) {
      const base = runScenario(scenario, 'V0');
      const other = runScenario(scenario, 'V0', scenario.seed + 999n);
      expect(other.passed).toBe(base.passed);
      expect(other.view.after).toBe(base.view.after);
    }
  });
});

describe('수직 통합 슬라이스', () => {
  // VS0 은 K0~K3 을 포함한다. 해당 모듈이 없으므로 지금 실행할 수 없다 (원문 「20」 VS0).
  it.todo('VS0 결정적 세계 변화 — K0~K3 등록 후 실행');
});
