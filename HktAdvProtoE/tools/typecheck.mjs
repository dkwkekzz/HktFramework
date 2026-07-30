#!/usr/bin/env node
/** 워크스페이스의 모든 tsconfig 를 경로 오름차순으로 타입 검사한다. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

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

if (projects.length === 0) {
  console.error('[typecheck] tsconfig 를 찾지 못했다.');
  process.exit(2);
}

let failed = false;
for (const project of projects) {
  const label = relative(ROOT, project);
  try {
    execFileSync('pnpm', ['exec', 'tsc', '-p', join(project, 'tsconfig.json')], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log(`[typecheck] ${label}: 통과`);
  } catch {
    console.error(`[typecheck] ${label}: 실패`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
