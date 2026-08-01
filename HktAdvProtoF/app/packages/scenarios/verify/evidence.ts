// 완료 증거 생성기 — 손으로 쓴 "완료" 를 금지하고 실제 실행 결과만 증거로 남긴다 (원문 V4).
// 모듈이 늘어나면 아래 MODULES 에 한 줄 추가한다. V4 완료 증거 시스템이 이 스크립트를 대체한다.
//
//   실행: node packages/scenarios/verify/evidence.ts

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stateHash } from '@hkt/core/v1';

import { digestSuite, runScenarios, type AnyScenario } from '../src/index.ts';
import { v0Scenarios } from '../suites/v0.ts';
import { v1Scenarios } from '../suites/v1.ts';
import { v2Scenarios } from '../suites/v2.ts';

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

let allVerified = true;

for (const module of MODULES) {
  const tests = runTests(module.testPackage);
  const suite = runScenarios(module.scenarios);
  const coverage = suite.coverage.find((entry) => entry.module === module.id) ?? null;

  // 같은 시나리오를 다시 돌려 같은 보고가 나오는가 — 검증 도구 자신의 결정성.
  // 원본 결과가 아니라 요약을 해시한다 (요약은 항상 직렬화 가능하다).
  const digest = digestSuite(suite);
  const replayHash = stateHash(digest);
  const deterministic = replayHash === stateHash(digestSuite(runScenarios(module.scenarios)));

  const verified =
    tests.result === 'passed' &&
    suite.failed === 0 &&
    coverage?.complete === true &&
    deterministic;
  if (!verified) allVerified = false;

  const evidence = {
    module: module.name,
    sourceHash: sourceHash(module.sources),
    unitTests: tests.result,
    propertyTests: deterministic ? 'passed' : 'failed',
    labScenarios: 'manual', // V3 Lab 미구현 — labSubstitute 터미널 출력으로 대체
    integrationScenario: suite.failed === 0 ? 'passed' : 'failed',
    replayHash,
    status: verified ? 'VERIFIED' : 'IMPLEMENTED',
    detail: {
      generator: 'packages/scenarios/verify/evidence.ts',
      labSubstitute: module.labSubstitute,
      tests: { package: module.testPackage, total: tests.total, passed: tests.passed },
      suite: { total: suite.total, passed: suite.passed, failed: suite.failed },
      coverage,
      scenarios: Object.fromEntries(
        digest.results.map((result) => [result.scenarioId, result.passed ? 'passed' : 'failed']),
      ),
    },
  };

  writeFileSync(
    new URL(`${module.id}.json`, evidenceDir),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );

  console.log(`[${module.id}] ${evidence.status}`);
  console.log(`  단위 테스트   ${tests.result} (${String(tests.passed)}/${String(tests.total)}) — ${module.testPackage}`);
  console.log(
    `  시나리오      ${String(suite.passed)}/${String(suite.total)} 통과 · 커버리지 ${coverage?.complete === true ? '완결(정상·실패·경계)' : '미충족'}`,
  );
  console.log(`  재실행 동일성 ${deterministic ? 'passed' : 'failed'} (${replayHash})`);
}

console.log(`증거 기록: ${fileURLToPath(evidenceDir)}`);

if (!allVerified) process.exitCode = 1;
