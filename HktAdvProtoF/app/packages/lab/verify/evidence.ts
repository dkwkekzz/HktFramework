// 완료 증거 생성기 — 손으로 쓴 "완료" 를 금지하고 실제 실행 결과만 증거로 남긴다 (원문 V4).
//
// status 를 정하는 판단은 여기가 아니라 @hkt/contracts 의 buildEvidence 에 있다.
// 이 스크립트는 검증을 **수행하고 산출물을 모으는** 일만 한다 — 모듈이 늘면 MODULES 에 한 줄 추가.
//
//   실행: node packages/scenarios/verify/evidence.ts

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildEvidence, formatDashboard, type Evidence } from '@hkt/contracts';
import { stateHash } from '@hkt/core/v1';

import { digestSuite, runScenarios, type AnyScenario } from '@hkt/scenarios';
import { v0Scenarios } from '@hkt/scenarios/suites/v0';
import { v1Scenarios } from '@hkt/scenarios/suites/v1';
import { v2Scenarios } from '@hkt/scenarios/suites/v2';
import { v4Scenarios } from '@hkt/scenarios/suites/v4';
import { o0Scenarios } from '@hkt/scenarios/suites/o0';
import { o1Scenarios } from '@hkt/scenarios/suites/o1';
import { o2Scenarios } from '@hkt/scenarios/suites/o2';
import { s0Scenarios } from '@hkt/scenarios/suites/s0';
import { s1Scenarios } from '@hkt/scenarios/suites/s1';
import { s2Scenarios } from '@hkt/scenarios/suites/s2';
import { s3Scenarios } from '@hkt/scenarios/suites/s3';

import { v3Scenarios } from '../suites/v3.ts';

const appRoot = new URL('../../../', import.meta.url);
const evidenceDir = new URL('packages/contracts/evidence/', appRoot);

interface ModuleSpec {
  readonly id: string;
  readonly name: string;
  /** 검증 대상 소스 (app 루트 기준). 바뀌면 sourceHash 가 바뀌어 증거가 무효가 된다. */
  readonly sources: readonly string[];
  /** 단위 테스트를 돌릴 패키지 (app 루트 기준) */
  readonly testPackage: string;
  readonly scenarios: readonly AnyScenario[];
  /** V3 Lab 대체 스크립트 */
  readonly labSubstitute: string;
}

const MODULES: readonly ModuleSpec[] = [
  {
    id: 'V0',
    name: 'V0-module-contract-registry',
    sources: [
      'packages/contracts/src/index.ts',
      'packages/contracts/src/yaml.ts',
      'packages/contracts/src/contract.ts',
      'packages/contracts/src/registry.ts',
      'packages/contracts/src/load.ts',
    ],
    testPackage: 'packages/contracts',
    scenarios: v0Scenarios,
    labSubstitute: 'packages/scenarios/verify/v0.ts',
  },
  {
    id: 'V1',
    name: 'V1-deterministic-runtime',
    sources: [
      'packages/core/src/index.ts',
      'packages/core/src/v1/index.ts',
      'packages/core/src/v1/tick.ts',
      'packages/core/src/v1/random.ts',
      'packages/core/src/v1/id.ts',
      'packages/core/src/v1/stable-sort.ts',
      'packages/core/src/v1/hash.ts',
    ],
    testPackage: 'packages/core',
    scenarios: v1Scenarios,
    labSubstitute: 'packages/scenarios/verify/v1.ts',
  },
  {
    id: 'V2',
    name: 'V2-scenario-runner',
    sources: [
      'packages/scenarios/src/index.ts',
      'packages/scenarios/src/scenario.ts',
      'packages/scenarios/src/assertions.ts',
      'packages/scenarios/src/diff.ts',
      'packages/scenarios/src/digest.ts',
      'packages/scenarios/src/runner.ts',
      'packages/scenarios/src/report.ts',
    ],
    testPackage: 'packages/scenarios',
    scenarios: v2Scenarios,
    labSubstitute: 'packages/scenarios/verify/v2.ts',
  },
  {
    id: 'V3',
    name: 'V3-browser-lab',
    sources: [
      'packages/lab/src/index.ts',
      'packages/lab/src/vnode.ts',
      'packages/lab/src/page.ts',
      'packages/lab/src/shell.ts',
      'packages/lab/src/mount.ts',
      'packages/lab/src/renderers/diff.ts',
      'packages/lab/src/renderers/scenario.ts',
      'packages/lab/src/pages/index.ts',
    ],
    testPackage: 'packages/lab',
    scenarios: v3Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts (본 검증은 브라우저: npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'O0',
    name: 'O0-worldview-axioms',
    sources: [
      'packages/core/src/o0/index.ts',
      'packages/core/src/o0/axiom.ts',
      'packages/core/src/o0/definition.ts',
      'packages/core/src/o0/enforcement.ts',
      'packages/core/src/o0/derivation.ts',
    ],
    testPackage: 'packages/core',
    scenarios: o0Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o0 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'O1',
    name: 'O1-common-world-ontology',
    sources: [
      'packages/core/src/o1/index.ts',
      'packages/core/src/o1/kinds.ts',
      'packages/core/src/o1/check.ts',
      'packages/core/src/o1/being.ts',
      'packages/core/src/o1/operation.ts',
      'packages/core/src/o1/relation.ts',
      'packages/core/src/o1/demand.ts',
      'packages/core/src/o1/coverage.ts',
      'packages/core/src/o1/catalog.ts',
    ],
    testPackage: 'packages/core',
    scenarios: o1Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o1 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'O2',
    name: 'O2-world-state-schema',
    sources: [
      'packages/core/src/o2/index.ts',
      'packages/core/src/o2/domain.ts',
      'packages/core/src/o2/field.ts',
      'packages/core/src/o2/schema.ts',
      'packages/core/src/o2/world.ts',
    ],
    testPackage: 'packages/core',
    scenarios: o2Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o2 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'S0',
    name: 'S0-common-subject-model',
    sources: [
      'packages/core/src/s0/index.ts',
      'packages/core/src/s0/violation.ts',
      'packages/core/src/s0/boundary.ts',
      'packages/core/src/s0/perception.ts',
      'packages/core/src/s0/stake.ts',
      'packages/core/src/s0/subject.ts',
      'packages/core/src/s0/questions.ts',
    ],
    testPackage: 'packages/core',
    scenarios: s0Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s0 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'S1',
    name: 'S1-species-archetype',
    sources: [
      'packages/core/src/s1/index.ts',
      'packages/core/src/s1/violation.ts',
      'packages/core/src/s1/body.ts',
      'packages/core/src/s1/senses.ts',
      'packages/core/src/s1/lifecycle.ts',
      'packages/core/src/s1/needs.ts',
      'packages/core/src/s1/archetype.ts',
    ],
    testPackage: 'packages/core',
    scenarios: s1Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s1 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'S2',
    name: 'S2-culture-role-archetype',
    sources: [
      'packages/core/src/s2/index.ts',
      'packages/core/src/s2/violation.ts',
      'packages/core/src/s2/reading.ts',
      'packages/core/src/s2/value.ts',
      'packages/core/src/s2/role.ts',
      'packages/core/src/s2/culture.ts',
    ],
    testPackage: 'packages/core',
    scenarios: s2Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s2 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'S3',
    name: 'S3-subject-instance',
    sources: [
      'packages/core/src/s3/index.ts',
      'packages/core/src/s3/violation.ts',
      'packages/core/src/s3/history.ts',
      'packages/core/src/s3/trait.ts',
      'packages/core/src/s3/instance.ts',
    ],
    testPackage: 'packages/core',
    scenarios: s3Scenarios,
    labSubstitute: 'packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s3 (npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'V4',
    name: 'V4-completion-evidence',
    sources: ['packages/contracts/src/evidence.ts'],
    testPackage: 'packages/contracts',
    scenarios: v4Scenarios,
    labSubstitute: 'packages/scenarios/verify/v4.ts',
  },
];

interface TestOutcome {
  readonly result: 'passed' | 'failed';
  readonly total: number;
  readonly passed: number;
}

const testCache = new Map<string, TestOutcome>();

function runTests(packagePath: string): TestOutcome {
  const cached = testCache.get(packagePath);
  if (cached !== undefined) return cached;

  const proc = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', 'test/**/*.test.ts'],
    { cwd: fileURLToPath(new URL(packagePath, appRoot)), encoding: 'utf8' },
  );
  const output = `${proc.stdout}${proc.stderr}`;
  const total = Number(/^# tests (\d+)$/m.exec(output)?.[1] ?? '0');
  const passed = Number(/^# pass (\d+)$/m.exec(output)?.[1] ?? '0');
  const outcome: TestOutcome = {
    result: proc.status === 0 && total > 0 && total === passed ? 'passed' : 'failed',
    total,
    passed,
  };
  testCache.set(packagePath, outcome);
  return outcome;
}

function sourceHash(sources: readonly string[]): string {
  return stateHash(
    sources.map((path) => ({ path, text: readFileSync(new URL(path, appRoot), 'utf8') })),
  );
}

mkdirSync(evidenceDir, { recursive: true });

const dashboard: { id: string; evidence: Evidence | null; claimed: 'VERIFIED' }[] = [];

for (const module of MODULES) {
  const tests = runTests(module.testPackage);
  const suite = runScenarios(module.scenarios);
  const coverage = suite.coverage.find((entry) => entry.module === module.id) ?? null;

  // 같은 시나리오를 다시 돌려 같은 보고가 나오는가 — 검증 도구 자신의 결정성.
  // 원본 결과가 아니라 요약을 해시한다 (요약은 항상 직렬화 가능하다).
  const digest = digestSuite(suite);
  const replayHash = stateHash(digest);
  const deterministic = replayHash === stateHash(digestSuite(runScenarios(module.scenarios)));

  const evidence = buildEvidence({
    module: module.name,
    sourceHash: sourceHash(module.sources),
    unitTests: { result: tests.result, total: tests.total, passed: tests.passed },
    propertyTests: deterministic ? 'passed' : 'failed',
    labScenarios: 'manual', // V3 Lab 미구현 — labSubstitute 터미널 출력으로 대체
    scenarios: {
      total: suite.total,
      passed: suite.passed,
      failed: suite.failed,
      coverageComplete: coverage?.complete === true,
      byId: Object.fromEntries(
        digest.results.map((result) => [result.scenarioId, result.passed ? 'passed' : 'failed']),
      ),
    },
    replayHash,
    detail: {
      generator: 'packages/scenarios/verify/evidence.ts',
      labSubstitute: module.labSubstitute,
      testPackage: module.testPackage,
      coverage,
    },
  });

  writeFileSync(
    new URL(`${module.id}.json`, evidenceDir),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  dashboard.push({ id: module.id, evidence, claimed: 'VERIFIED' });
}

console.log(formatDashboard(dashboard));
console.log('');
console.log(`증거 기록: ${fileURLToPath(evidenceDir)}`);

if (dashboard.some((row) => row.evidence?.status !== 'VERIFIED')) process.exitCode = 1;
