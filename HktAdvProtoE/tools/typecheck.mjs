#!/usr/bin/env node
/** 워크스페이스의 모든 tsconfig 를 경로 오름차순으로 타입 검사한다. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * tsc 를 `pnpm exec` 로 부르지 않는다. Windows 에서 `pnpm` 은 `pnpm.CMD` 이고,
 * Node 는 CVE-2024-27980 대응 이후 `.cmd`/`.bat` 을 `shell: true` 없이 spawn 하면
 * EINVAL 로 던진다 — tsc 가 돌기도 전에 전 모듈이 "실패" 로 찍힌다.
 * 로컬에 설치된 tsc 의 **JS 진입점을 node 로 직접** 실행하면 셸을 타지 않아 어디서든 같다.
 */
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!existsSync(TSC)) {
  console.error(`[typecheck] tsc 를 찾지 못했다: ${TSC}`);
  console.error('[typecheck] 먼저 `pnpm install` 을 실행할 것.');
  process.exit(2);
}

const projects = [];
const collect = (dir, depth) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (existsSync(join(full, 'tsconfig.json'))) projects.push(full);
    if (depth > 0) collect(full, depth - 1);
  }
};
collect(join(ROOT, 'packages'), 1);
collect(join(ROOT, 'apps'), 0);
if (existsSync(join(ROOT, 'tests', 'tsconfig.json'))) projects.push(join(ROOT, 'tests'));

if (projects.length === 0) {
  console.error('[typecheck] tsconfig 를 찾지 못했다.');
  process.exit(2);
}

let failed = false;
for (const project of projects) {
  const label = relative(ROOT, project);
  try {
    execFileSync(process.execPath, [TSC, '-p', join(project, 'tsconfig.json')], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log(`[typecheck] ${label}: 통과`);
  } catch (error) {
    // 원인을 삼키지 않는다 — tsc 가 낸 타입 오류인지, 실행 자체가 실패한 것인지 구별되어야 한다.
    console.error(`[typecheck] ${label}: 실패`);
    if (typeof error.status !== 'number') console.error(`[typecheck]   실행 실패 — ${error.message}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
