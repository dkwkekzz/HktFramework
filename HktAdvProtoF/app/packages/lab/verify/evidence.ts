// 완료 증거 생성기 — 손으로 쓴 "완료" 를 금지하고 실제 실행 결과만 증거로 남긴다 (원문 V4).
//
// status 를 정하는 판단은 여기가 아니라 @hkt/contracts 의 buildEvidence 에 있고,
// **기록 순서**의 판단은 @hkt/contracts 의 collectEvidence 에 있다.
// 이 스크립트는 검증을 **수행하고 산출물을 모으는** 일만 한다 — 모듈이 늘면 MODULES 에 한 줄 추가.
//
//   실행: node packages/lab/verify/evidence.ts

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  MODULE_SOURCES,
  buildEvidence,
  collectEvidence,
  formatDashboard,
  formatTrace,
  recordingOrderViolations,
  type Evidence,
  type ModuleSourceSpec,
} from '@hkt/contracts';
import { hashSources } from '@hkt/contracts/load';
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
import { d0Scenarios } from '@hkt/scenarios/suites/d0';
import { d1Scenarios } from '@hkt/scenarios/suites/d1';
import { d2Scenarios } from '@hkt/scenarios/suites/d2';
import { d3Scenarios } from '@hkt/scenarios/suites/d3';
import { d4Scenarios } from '@hkt/scenarios/suites/d4';
import { d5Scenarios } from '@hkt/scenarios/suites/d5';
import { p0Scenarios } from '@hkt/scenarios/suites/p0';
import { p1Scenarios } from '@hkt/scenarios/suites/p1';
import { p2Scenarios } from '@hkt/scenarios/suites/p2';
import { p3Scenarios } from '@hkt/scenarios/suites/p3';
import { p4Scenarios } from '@hkt/scenarios/suites/p4';
import { p5Scenarios } from '@hkt/scenarios/suites/p5';
import { r0Scenarios } from '@hkt/scenarios/suites/r0';
import { r1Scenarios } from '@hkt/scenarios/suites/r1';
import { r2Scenarios } from '@hkt/scenarios/suites/r2';
import { r3Scenarios } from '@hkt/scenarios/suites/r3';
import { r4Scenarios } from '@hkt/scenarios/suites/r4';
import { r5Scenarios } from '@hkt/scenarios/suites/r5';

import { v3Scenarios } from '../suites/v3.ts';

const appRoot = new URL('../../../', import.meta.url);
const evidenceDir = new URL('packages/contracts/evidence/', appRoot);

/** 모듈 소스 명부(@hkt/contracts MODULE_SOURCES)에 시나리오 스위트를 얹은 것. */
type ModuleSpec = ModuleSourceSpec & { readonly scenarios: readonly AnyScenario[] };

/** 모듈 ID → 시나리오 스위트. 소스·테스트 패키지는 명부가 갖는다 (한 곳에만 적는다). */
const SUITES: Readonly<Record<string, readonly AnyScenario[]>> = {
  V0: v0Scenarios,
  V1: v1Scenarios,
  V2: v2Scenarios,
  V3: v3Scenarios,
  V4: v4Scenarios,
  O0: o0Scenarios,
  O1: o1Scenarios,
  O2: o2Scenarios,
  S0: s0Scenarios,
  S1: s1Scenarios,
  S2: s2Scenarios,
  S3: s3Scenarios,
  D0: d0Scenarios,
  D1: d1Scenarios,
  D2: d2Scenarios,
  D3: d3Scenarios,
  D4: d4Scenarios,
  D5: d5Scenarios,
  P0: p0Scenarios,
  P1: p1Scenarios,
  P2: p2Scenarios,
  P3: p3Scenarios,
  P4: p4Scenarios,
  P5: p5Scenarios,
  R0: r0Scenarios,
  R1: r1Scenarios,
  R2: r2Scenarios,
  R3: r3Scenarios,
  R4: r4Scenarios,
  R5: r5Scenarios,
};

const MODULES: readonly ModuleSpec[] = MODULE_SOURCES.map((spec) => {
  const scenarios = SUITES[spec.id];
  if (scenarios === undefined) {
    throw new Error(`시나리오 스위트가 없는 모듈이 명부에 있다 — ${spec.id}`);
  }
  return { ...spec, scenarios };
});

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

/** 모듈 하나의 검증 — 실제 검사를 수행하고 증거를 만든다. 파일은 여기서 쓰지 않는다. */
function verifyModule(module: ModuleSpec): Evidence {
  const tests = runTests(module.testPackage);
  const suite = runScenarios(module.scenarios);
  const coverage = suite.coverage.find((entry) => entry.module === module.id) ?? null;

  // 같은 시나리오를 다시 돌려 같은 보고가 나오는가 — 검증 도구 자신의 결정성.
  // 원본 결과가 아니라 요약을 해시한다 (요약은 항상 직렬화 가능하다).
  const digest = digestSuite(suite);
  const replayHash = stateHash(digest);
  const deterministic = replayHash === stateHash(digestSuite(runScenarios(module.scenarios)));

  return buildEvidence({
    module: module.name,
    sourceHash: hashSources(appRoot, module.sources),
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
      generator: 'packages/lab/verify/evidence.ts',
      labSubstitute: module.labSubstitute,
      testPackage: module.testPackage,
      coverage,
    },
  });
}

mkdirSync(evidenceDir, { recursive: true });

// 증거는 **검증 전량이 끝난 뒤에 일괄로** 기록된다 (V4 collectEvidence).
// 루프 안에서 즉시 쓰면 앞 모듈의 기록이 뒤 모듈(Lab 스냅샷을 재료로 쓰는 V3)의 검사 재료를
// 낡게 만들어, 아무것도 고장 나지 않았는데 V3 만 IMPLEMENTED 로 내려앉는다 (#662).
const changed: string[] = [];
const { records, trace } = collectEvidence(
  MODULES.map((module) => ({ id: module.id, verify: () => verifyModule(module) })),
  ({ id, evidence }) => {
    const target = new URL(`${id}.json`, evidenceDir);
    const text = `${JSON.stringify(evidence, null, 2)}\n`;
    const before = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (before === text) return;
    writeFileSync(target, text, 'utf8');
    changed.push(id);
  },
);

const dashboard = records.map((record) => ({
  id: record.id,
  evidence: record.evidence as Evidence | null,
  claimed: 'VERIFIED' as const,
}));
const orderViolations = recordingOrderViolations(trace);

console.log(formatDashboard(dashboard));
console.log('');
console.log(`증거 기록: ${fileURLToPath(evidenceDir)}`);
console.log(`기록 순서: ${formatTrace(trace)}`);
for (const violation of orderViolations) console.log(`  ✘ ${violation}`);
console.log(
  changed.length === 0
    ? '  내용이 달라진 증거 없음 — 파생 스냅샷도 그대로다'
    : `  내용이 달라진 증거: ${changed.join(', ')} — 파생 스냅샷(lab/src/data.generated.ts)을 다시 만든다`,
);

if (dashboard.some((row) => row.evidence?.status !== 'VERIFIED')) process.exitCode = 1;
if (orderViolations.length > 0) process.exitCode = 1;
