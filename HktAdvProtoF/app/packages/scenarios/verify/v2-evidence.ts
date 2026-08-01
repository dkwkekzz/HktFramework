// V2 완료 증거 생성기 — 실행 결과만 증거로 남긴다 (원문 V4).
// V1 과 달리 시나리오 결과를 실행기 자신이 만들므로, 증거의 scenarios 항목은 SuiteResult 에서 나온다.
//
//   실행: node packages/scenarios/verify/v2-evidence.ts

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stateHash } from '@hkt/core/v1';

import { digestSuite, runScenarios } from '../src/index.ts';
import { v2Scenarios } from '../suites/v2.ts';

const packageRoot = new URL('../', import.meta.url);
const evidencePath = new URL('../../contracts/evidence/V2.json', import.meta.url);

const SOURCES = [
  'src/index.ts',
  'src/scenario.ts',
  'src/assertions.ts',
  'src/diff.ts',
  'src/runner.ts',
  'src/report.ts',
  'suites/v2.ts',
] as const;

function sourceHash(): string {
  const contents = SOURCES.map((path) => ({
    path,
    text: readFileSync(new URL(path, packageRoot), 'utf8'),
  }));
  return stateHash(contents);
}

function runTests(): { readonly result: 'passed' | 'failed'; readonly total: number; readonly passed: number } {
  const proc = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', 'test/**/*.test.ts'],
    { cwd: fileURLToPath(packageRoot), encoding: 'utf8' },
  );
  const output = `${proc.stdout}${proc.stderr}`;
  const total = Number(/^# tests (\d+)$/m.exec(output)?.[1] ?? '0');
  const passed = Number(/^# pass (\d+)$/m.exec(output)?.[1] ?? '0');
  return {
    result: proc.status === 0 && total > 0 && total === passed ? 'passed' : 'failed',
    total,
    passed,
  };
}

const tests = runTests();
const suite = runScenarios(v2Scenarios);
const coverage = suite.coverage.find((entry) => entry.module === 'V2');

// 실행기가 두 번 돌려도 같은 보고를 내는가 — 검증 도구 자신의 결정성.
// 원본 결과가 아니라 요약을 해시한다 — 요약은 항상 직렬화 가능하다 (src/digest.ts).
const replayHash = stateHash(digestSuite(runScenarios(v2Scenarios)));
const deterministic = replayHash === stateHash(digestSuite(suite));

const scenarios = Object.fromEntries(
  suite.results.map((result) => [result.scenarioId, result.passed ? 'passed' : 'failed']),
);

const allPassed =
  tests.result === 'passed' && suite.failed === 0 && coverage?.complete === true && deterministic;

const evidence = {
  module: 'V2-scenario-runner',
  sourceHash: sourceHash(),
  unitTests: tests.result,
  propertyTests: deterministic ? 'passed' : 'failed', // 실행기 자신의 재실행 동일성
  labScenarios: 'manual', // V3 Lab 미구현 — verify/v2.ts 터미널 출력으로 대체
  integrationScenario: suite.failed === 0 ? 'passed' : 'failed',
  replayHash,
  status: allPassed ? 'VERIFIED' : 'IMPLEMENTED',
  detail: {
    generator: 'packages/scenarios/verify/v2-evidence.ts',
    labSubstitute: 'packages/scenarios/verify/v2.ts',
    tests: { total: tests.total, passed: tests.passed },
    suite: { total: suite.total, passed: suite.passed, failed: suite.failed },
    coverage: coverage ?? null,
    scenarios,
  },
};

mkdirSync(new URL('./', evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(`증거 기록: ${fileURLToPath(evidencePath)}`);
console.log(`  단위 테스트   ${tests.result} (${String(tests.passed)}/${String(tests.total)})`);
console.log(`  자체 시나리오 ${String(suite.passed)}/${String(suite.total)} 통과 · 커버리지 ${coverage?.complete === true ? '완결' : '미충족'}`);
console.log(`  재실행 동일성 ${deterministic ? 'passed' : 'failed'} (${replayHash})`);
console.log(`  status        ${evidence.status}`);

if (!allPassed) process.exitCode = 1;
