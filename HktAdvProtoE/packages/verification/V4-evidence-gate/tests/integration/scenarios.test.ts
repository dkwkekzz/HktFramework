import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runScenario } from '@hkt/v0-module-contract';
import { compileSchema } from '@hkt/v1-schema';
import { v4Scenarios } from '../../scenarios/index.js';
import { labModule, v4Module } from '../../lab/index.js';
import { V4_INPUT_SCHEMA, V4_OUTPUT_SCHEMA, executeV4 } from '../../src/module.js';
import { auditRepository } from '../../src/audit.js';
import { validateEvidenceDocument, type EvidenceDocument } from '../../src/evidence.js';
import { statusRank } from '../../src/status.js';

describe('V4 대표 장면', () => {
  it.each(v4Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 장면이 통과하고 원문 「24」 8구획이 채워진다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'V4');
      expect(run.passed, JSON.stringify(run.assertions.filter((a) => !a.passed), null, 2)).toBe(true);
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

  it('Lab 이 계약의 시나리오 목록과 같은 장면을 돌린다', () => {
    expect(labModule.scenarioIds).toEqual(v4Scenarios.map((scenario) => scenario.id));
    expect(labModule.run(0n).map((run) => run.scenarioId)).toEqual(labModule.scenarioIds);
  });

  it('입력·출력 스키마가 V1 로 컴파일되고 출력이 그 스키마를 지킨다', () => {
    expect(() => compileSchema(V4_INPUT_SCHEMA)).not.toThrow();
    const validator = compileSchema(V4_OUTPUT_SCHEMA);
    for (const scenario of v4Scenarios) {
      const input = scenario.arrange();
      const output = executeV4(input);
      const result = validator.validate(output);
      expect(result.issues, `${scenario.id}: ${JSON.stringify(result.issues.slice(0, 3), null, 2)}`).toEqual([]);
      expect(v4Module.validateOutput(output)).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 실제 저장소를 대상으로 한 감사 — V4 가 자기 저장소를 실제로 본다
// ---------------------------------------------------------------------------

const ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));
const PACKAGES = join(ROOT, 'packages');

interface RepoModule {
  id: string;
  path: string;
  absolute: string;
}

function repositoryModules(): RepoModule[] {
  const found: RepoModule[] = [];
  for (const group of readdirSync(PACKAGES, { withFileTypes: true })) {
    if (!group.isDirectory() || group.name === 'node_modules') continue;
    for (const entry of readdirSync(join(PACKAGES, group.name), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const absolute = join(PACKAGES, group.name, entry.name);
      if (!existsSync(join(absolute, 'MODULE.yaml'))) continue;
      found.push({
        id: (/^([A-Z][0-9]+)-/.exec(entry.name) ?? [])[1] as string,
        path: relative(ROOT, absolute).split(sep).join('/'),
        absolute,
      });
    }
  }
  return found.sort((a, b) => (a.id < b.id ? -1 : 1));
}

describe('저장소 감사', () => {
  const modules = repositoryModules();
  const contracts = modules.map((module) => ({
    path: `${module.path}/MODULE.yaml`,
    text: readFileSync(join(module.absolute, 'MODULE.yaml'), 'utf8'),
  }));
  const evidences = modules
    .filter((module) => existsSync(join(module.absolute, 'evidence', 'latest.json')))
    .map(
      (module) =>
        JSON.parse(readFileSync(join(module.absolute, 'evidence', 'latest.json'), 'utf8')) as EvidenceDocument,
    );

  it('저장소에 모듈이 있다', () => {
    expect(modules.length).toBeGreaterThan(0);
  });

  it('발급된 증거는 모두 원문 「21」 형식을 지킨다', () => {
    for (const evidence of evidences) {
      expect(
        validateEvidenceDocument(evidence, { label: `${evidence.moduleId} 증거` }),
        `${evidence.moduleId}`,
      ).toEqual([]);
    }
  });

  it('어떤 모듈도 게이트보다 높은 상태를 주장하지 않는다', () => {
    const report = auditRepository({ contracts, evidences });
    const forged = report.issues.filter((issue) => issue.code === 'E_STATUS_ABOVE_GATES');
    expect(forged, JSON.stringify(forged, null, 2)).toEqual([]);
  });

  it('통합 슬라이스가 남아 있는 동안 어떤 모듈도 VERIFIED 가 아니다 (원문 「23」)', () => {
    const report = auditRepository({ contracts, evidences });
    for (const module of report.modules) {
      if (statusRank(module.effectiveStatus) < statusRank('VERIFIED')) continue;
      const slices = Object.entries(module.integrationSlices);
      expect(slices.length, `${module.id}`).toBeGreaterThan(0);
      for (const [, verdict] of slices) expect(verdict).toBe('passed');
    }
  });

  it('감사 결과는 다시 돌려도 같다', () => {
    expect(auditRepository({ contracts, evidences }).hash).toBe(
      auditRepository({ contracts, evidences }).hash,
    );
  });
});
