#!/usr/bin/env node
/**
 * 모듈 완료 증거 발급기 (원문 「21. 모듈 완료 증거 형식」).
 *
 * 자연어 보고는 증거로 인정하지 않는다. 이 스크립트는 실제 명령을 돌린 결과만 기록한다.
 * 최종 증거 발급 주체는 V4(evidence-gate)이며, 이 스크립트는 V4 가 없는 동안 쓰는 임시 발급기다.
 *
 *   pnpm verify V0
 *   pnpm verify V0 --lab   (브라우저 Lab 까지 실행해 스크린샷을 남긴다)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const moduleId = args.find((arg) => !arg.startsWith('-'));
const withLab = args.includes('--lab');

if (!moduleId) {
  console.error('사용법: pnpm verify <moduleId> [--lab]   예: pnpm verify V0');
  process.exit(2);
}

const packageDir = findModuleDir(moduleId);
if (!packageDir) {
  console.error(`모듈 ${moduleId} 의 패키지를 찾지 못했다.`);
  process.exit(2);
}

const moduleYaml = readFileSync(join(packageDir, 'MODULE.yaml'), 'utf8');
const moduleVersion = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;

console.log(`[verify] ${moduleId} — ${relative(ROOT, packageDir)}`);

const staticCheck = run('타입 검사', 'pnpm', ['run', 'typecheck']);
const tests = runTests();
const lab = withLab ? runLab() : { skipped: true };

const evidence = {
  moduleId,
  moduleVersion,
  sourceHash: hashTree(join(packageDir, 'src')),
  contractHash: `sha256:${createHash('sha256').update(moduleYaml, 'utf8').digest('hex')}`,
  dependencyVersions: dependencyVersions(moduleYaml),
  staticCheck: { passed: staticCheck.passed, command: staticCheck.command },
  unitTests: tests.unit,
  propertyTests: tests.property,
  integrationTests: tests.integration,
  labScenarios: lab.skipped ? { note: '--lab 미실행' } : lab.scenarios,
  // 리플레이 수치는 브라우저에서 대표 장면을 다시 실행해 얻는다 (tools/lab-shot.mjs).
  replay: lab.skipped ? { note: '--lab 미실행' } : (lab.replay ?? { note: 'lab 요약에 replay 없음' }),
  integrationSlices: { VS0: 'pending — K0~K3 미구현 (원문 「20」 VS0)' },
  status: deriveStatus({ staticCheck, tests, lab }),
  producedBy: 'tools/verify.mjs (V4 미구현 동안의 임시 발급기)',
};

const evidenceDir = join(packageDir, 'evidence');
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, 'latest.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(`[verify] status=${evidence.status}`);
console.log(`[verify] evidence → ${relative(ROOT, join(evidenceDir, 'latest.json'))}`);
process.exit(evidence.status === 'FAILED' ? 1 : 0);

// ---------------------------------------------------------------------------

function findModuleDir(id) {
  const packagesRoot = join(ROOT, 'packages');
  if (!existsSync(packagesRoot)) return null;
  for (const group of readdirSync(packagesRoot)) {
    const groupDir = join(packagesRoot, group);
    if (!statSync(groupDir).isDirectory()) continue;
    for (const entry of readdirSync(groupDir)) {
      if (entry.startsWith(`${id}-`) && existsSync(join(groupDir, entry, 'MODULE.yaml'))) {
        return join(groupDir, entry);
      }
    }
  }
  return null;
}

function run(label, command, commandArgs) {
  const printable = `${command} ${commandArgs.join(' ')}`;
  try {
    const stdout = execFileSync(command, commandArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(`[verify] ${label}: 통과`);
    return { passed: true, command: printable, stdout };
  } catch (error) {
    const stdout = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    console.error(`[verify] ${label}: 실패`);
    console.error(stdout.split('\n').slice(-40).join('\n'));
    return { passed: false, command: printable, stdout };
  }
}

/** vitest 를 JSON 리포터로 돌려 파일 경로별로 단위/속성/통합을 나눈다. */
function runTests() {
  const outFile = join(ROOT, 'node_modules', '.hkt', `vitest-${moduleId}.json`);
  mkdirSync(dirname(outFile), { recursive: true });
  const result = run('테스트', 'pnpm', [
    'exec',
    'vitest',
    'run',
    relative(ROOT, packageDir).split(sep).join('/'),
    '--reporter=json',
    `--outputFile=${outFile}`,
  ]);

  const report = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
  const buckets = {
    unit: { passed: 0, failed: 0 },
    property: { passed: 0, failed: 0 },
    integration: { passed: 0, failed: 0 },
  };
  let replaySeeds = 0;

  for (const file of report?.testResults ?? []) {
    const bucket = file.name.includes(`${sep}property${sep}`)
      ? buckets.property
      : file.name.includes(`${sep}integration${sep}`)
        ? buckets.integration
        : buckets.unit;
    for (const testCase of file.assertionResults ?? []) {
      if (testCase.status === 'passed') bucket.passed += 1;
      else if (testCase.status === 'failed') bucket.failed += 1;
    }
  }

  // 속성 테스트의 표본 수는 각 속성 테스트 파일의 fast-check 실행 설정(numRuns)에서 읽는다.
  // 파일마다 다르면 가장 작은 값을 쓴다 — 표본 수를 부풀리지 않는다.
  const propertyDir = join(packageDir, 'tests', 'property');
  if (existsSync(propertyDir)) {
    const numRuns = readdirSync(propertyDir)
      .filter((name) => name.endsWith('.test.ts'))
      .flatMap((name) => {
        const text = readFileSync(join(propertyDir, name), 'utf8');
        return [...text.matchAll(/numRuns:\s*(\d+)/g)].map((match) => Number(match[1]));
      });
    replaySeeds = numRuns.length > 0 ? Math.min(...numRuns) : 0;
  }

  return {
    passed: result.passed,
    unit: buckets.unit,
    integration: buckets.integration,
    property: {
      seeds: replaySeeds,
      invariantViolations: buckets.property.failed,
      passed: buckets.property.passed,
    },
  };
}

/** 브라우저에서 Lab 을 실제로 띄워 시나리오 판정을 읽고 스크린샷을 남긴다. */
function runLab() {
  const result = run('Lab', 'node', ['tools/lab-shot.mjs', moduleId]);
  if (!result.passed) return { scenarios: { error: 'lab 실행 실패' }, passed: false, replay: null };
  const summaryPath = join(ROOT, 'node_modules', '.hkt', 'lab-summary.json');
  if (!existsSync(summaryPath)) return { scenarios: { error: 'lab 요약 없음' }, passed: false, replay: null };
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  return {
    scenarios: summary.scenarios,
    passed: summary.allPassed,
    screenshot: summary.screenshot,
    replay: summary.replay,
  };
}

function dependencyVersions(yamlText) {
  const block = /^depends_on:\n((?:\s+-\s+\S+\n)+)/m.exec(yamlText)?.[1] ?? '';
  const ids = block
    .trim()
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter((id) => id !== '' && id !== 'none');
  const versions = {};
  for (const id of ids) {
    const dir = findModuleDir(id);
    versions[id] = dir
      ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
      : 'MISSING';
  }
  return versions;
}

/** 디렉터리 전체의 내용 해시 — 파일 경로 오름차순으로 고정한다. */
function hashTree(dir) {
  const hash = createHash('sha256');
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        hash.update(relative(dir, full).split(sep).join('/'));
        hash.update(readFileSync(full));
      }
    }
  };
  walk(resolve(dir));
  return `sha256:${hash.digest('hex')}`;
}

/**
 * 원문 「4. 검증 상태」의 상태값만 쓴다.
 * 통합 슬라이스(VS0)가 남아 있으므로 여기서 VERIFIED 를 발급하지 않는다 — 원문 「23」이 금지한다.
 */
function deriveStatus({ staticCheck, tests, lab }) {
  if (!staticCheck.passed || !tests.passed) return 'FAILED';
  if (!lab.skipped && lab.passed !== true) return 'FAILED';
  if (lab.skipped) return 'UNIT_PASS';
  return 'LAB_PASS';
}
