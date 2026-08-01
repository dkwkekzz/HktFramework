// V1 완료 증거 생성기 — 손으로 쓴 "완료"를 금지하고 실제 실행 결과만 증거로 남긴다 (원문 V4).
// V4 완료 증거 시스템이 구현되면 이 스크립트는 그 생성기로 대체된다.
//
//   실행: node packages/core/verify/v1-evidence.ts

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stateHash } from '../src/v1/index.ts';
import { firstDivergence, runToyWorld } from './v1-toy-world.ts';

const packageRoot = new URL('../', import.meta.url);
const evidencePath = new URL('../../contracts/evidence/V1.json', import.meta.url);

const SOURCES = [
  'src/index.ts',
  'src/v1/index.ts',
  'src/v1/tick.ts',
  'src/v1/random.ts',
  'src/v1/id.ts',
  'src/v1/stable-sort.ts',
  'src/v1/hash.ts',
] as const;

/** 검증 대상 소스의 내용 해시 — 소스가 바뀌면 증거는 무효가 된다. */
function sourceHash(): string {
  const contents = SOURCES.map((path) => ({
    path,
    text: readFileSync(new URL(path, packageRoot), 'utf8'),
  }));
  return stateHash(contents);
}

/** node --test 실행 결과. */
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

/** 같은 시드 100회 리플레이 — 사건 순서·상태 해시가 하나로 모이는지. */
function replay(seed: string, runs: number): {
  readonly result: 'passed' | 'failed';
  readonly stateHash: string;
  readonly eventHash: string;
  readonly distinctStateHashes: number;
  readonly distinctEventHashes: number;
} {
  const first = runToyWorld(seed);
  const states = new Set<string>();
  const events = new Set<string>();
  for (let run = 0; run < runs; run += 1) {
    const current = runToyWorld(seed);
    states.add(current.stateHash);
    events.add(current.eventHash);
  }
  return {
    result: states.size === 1 && events.size === 1 ? 'passed' : 'failed',
    stateHash: first.stateHash,
    eventHash: first.eventHash,
    distinctStateHashes: states.size,
    distinctEventHashes: events.size,
  };
}

/** 다른 시드를 다르다고 판정하는가 — 검출력이 없으면 결정성 통과는 의미가 없다. */
function drift(seedA: string, seedB: string): {
  readonly result: 'passed' | 'failed';
  readonly firstDivergentEventIndex: number | null;
} {
  const left = runToyWorld(seedA);
  const right = runToyWorld(seedB);
  const divergence = firstDivergence(left, right);
  return {
    result: left.stateHash !== right.stateHash && divergence !== null ? 'passed' : 'failed',
    firstDivergentEventIndex: divergence?.index ?? null,
  };
}

const SEED_A = '배고픈 인간 1 + 음식 1';
const SEED_B = '배고픈 인간 1 + 음식 2';
const RUNS = 100;

const tests = runTests();
const replayResult = replay(SEED_A, RUNS);
const driftResult = drift(SEED_A, SEED_B);

const scenarios = {
  'v1-same-seed-100': replayResult.result,
  'v1-seed-drift-detected': driftResult.result,
  'v1-boundary': tests.result, // 경계 시나리오는 test/v1/scenarios.test.ts 안에서 실행된다.
} as const;

const allPassed =
  tests.result === 'passed' && replayResult.result === 'passed' && driftResult.result === 'passed';

const evidence = {
  module: 'V1-deterministic-runtime',
  sourceHash: sourceHash(),
  unitTests: tests.result,
  propertyTests: replayResult.result, // 같은 시드 100회 = V1 의 속성 검사
  labScenarios: 'manual', // V3 Lab 미구현 — verify/v1.ts 터미널 출력으로 대체 (WORKFLOW §5 단서)
  integrationScenario: driftResult.result,
  replayHash: replayResult.stateHash,
  status: allPassed ? 'VERIFIED' : 'IMPLEMENTED',
  detail: {
    generator: 'packages/core/verify/v1-evidence.ts',
    labSubstitute: 'packages/core/verify/v1.ts',
    seeds: { normal: SEED_A, drift: SEED_B },
    runs: RUNS,
    tests: { total: tests.total, passed: tests.passed },
    replay: {
      stateHash: replayResult.stateHash,
      eventHash: replayResult.eventHash,
      distinctStateHashes: replayResult.distinctStateHashes,
      distinctEventHashes: replayResult.distinctEventHashes,
    },
    drift: { firstDivergentEventIndex: driftResult.firstDivergentEventIndex },
    scenarios,
  },
};

mkdirSync(new URL('./', evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(`증거 기록: ${fileURLToPath(evidencePath)}`);
console.log(`  단위 테스트   ${tests.result} (${String(tests.passed)}/${String(tests.total)})`);
console.log(`  리플레이 100회 ${replayResult.result} (상태 해시 종류 ${String(replayResult.distinctStateHashes)})`);
console.log(`  비결정 검출력 ${driftResult.result} (최초 분기 사건 #${String(driftResult.firstDivergentEventIndex)})`);
console.log(`  status        ${evidence.status}`);

if (!allPassed) process.exitCode = 1;
