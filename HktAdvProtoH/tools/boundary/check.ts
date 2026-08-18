// Boundary Check — 기반(engine)/컨텐츠(content) 경계를 import 그래프로 검사한다.
//
//   npm run boundary:check           위반 목록을 보고한다 — 위반이 있으면 실패
//   npm run boundary:check -- --all  미이주(legacy) 파일 목록까지 전부 출력한다
//
// 규칙 (design/Design-System-Content-Separation.md):
//   1. engine/**       은 content/** · app/** · server/** 를 import 하지 않는다
//   2. content/A/**    은 content/B/** 를 import 하지 않는다 (팩 간 격리)
//   3. content/**      은 app/** · server/** (조립) 를 import 하지 않는다
//   4. content/** 를 import 할 수 있는 것은 조립(app/·server/·content/active.ts)뿐이다
//
// 이주 전 디렉터리(world/·view/·protocol/)는 legacy 로 분류해 수만 보고한다 —
// P1~P4 가 진행되며 legacy 0 이 되는 것이 이주의 완료 관찰값이다.
// 코드는 아무것도 바꾸지 않는다 — 읽기 전용 관찰 도구다.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 검사 대상 최상위 디렉터리 — 코드가 사는 곳만 본다.
const SCAN_DIRS = ['engine', 'content', 'app', 'server', 'world', 'view', 'protocol'] as const;

type Layer =
  | { kind: 'engine' }
  | { kind: 'content'; pack: string }
  | { kind: 'assembly' } // app/ · server/ · content/active.ts — 어느 팩을 띄울지 아는 유일한 곳
  | { kind: 'legacy'; dir: string }; // 아직 이주하지 않은 옛 자리

function layerOf(relPath: string): Layer | null {
  const parts = relPath.split(sep);
  const top = parts[0];
  if (top === 'engine') return { kind: 'engine' };
  if (top === 'content') {
    // content/active.ts 는 조립의 것이다 — "어느 팩인가" 를 아는 단 하나의 파일.
    if (parts.length === 2 && parts[1] === 'active.ts') return { kind: 'assembly' };
    const pack = parts[1];
    return pack ? { kind: 'content', pack } : null;
  }
  if (top === 'app' || top === 'server') return { kind: 'assembly' };
  if (top === 'world' || top === 'view' || top === 'protocol') return { kind: 'legacy', dir: top };
  return null;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // 아직 없는 디렉터리 — 이주가 만들 것이다
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(path);
    }
  }
}

// import 문에서 상대 경로만 뽑는다 — 경계는 프로젝트 안 파일 사이의 일이다.
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function relativeImportsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1]!;
    if (spec.startsWith('.')) specifiers.push(spec);
  }
  return specifiers;
}

interface Violation {
  file: string;
  imports: string;
  rule: string;
}

function judge(from: Layer, to: Layer): string | null {
  if (from.kind === 'engine' && to.kind === 'content')
    return '규칙 1 — engine 은 content 를 import 하지 않는다';
  if (from.kind === 'engine' && to.kind === 'assembly')
    return '규칙 1 — engine 은 조립(app/server)을 import 하지 않는다';
  if (from.kind === 'content' && to.kind === 'content' && from.pack !== to.pack)
    return `규칙 2 — 팩 간 격리 (${from.pack} → ${to.pack})`;
  if (from.kind === 'content' && to.kind === 'assembly')
    return '규칙 3 — content 는 조립(app/server)을 import 하지 않는다';
  if (from.kind === 'legacy' && to.kind === 'content')
    return '규칙 4 — content 를 import 하는 것은 조립뿐이다 (legacy 는 engine 경유로 이주할 것)';
  return null;
}

function main(): void {
  const showAll = process.argv.includes('--all');

  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);

  const violations: Violation[] = [];
  const legacyFiles: string[] = [];
  const counts = new Map<string, number>();

  for (const file of files) {
    const rel = relative(ROOT, file);
    const from = layerOf(rel);
    if (!from) continue;

    const label =
      from.kind === 'content' ? `content/${from.pack}` : from.kind === 'legacy' ? `legacy:${from.dir}` : from.kind;
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (from.kind === 'legacy') legacyFiles.push(rel);

    for (const spec of relativeImportsOf(file)) {
      const target = relative(ROOT, resolve(dirname(file), spec));
      const to = layerOf(target + '.ts') ?? layerOf(target);
      if (!to) continue;
      const rule = judge(from, to);
      if (rule) violations.push({ file: rel, imports: spec, rule });
    }
  }

  console.log('── Boundary Check ─────────────────────────────');
  for (const [label, count] of [...counts.entries()].sort()) {
    console.log(`  ${label.padEnd(24)} ${count} files`);
  }

  const legacyTotal = legacyFiles.length;
  if (legacyTotal > 0) {
    console.log(`\n  미이주(legacy) ${legacyTotal} files — P1~P4 가 0 으로 만든다`);
    if (showAll) for (const file of legacyFiles.sort()) console.log(`    ${file}`);
  }

  if (violations.length === 0) {
    console.log('\n  경계 위반 0 — OK');
    return;
  }

  console.log(`\n  경계 위반 ${violations.length}:`);
  for (const v of violations) {
    console.log(`    ${v.file}`);
    console.log(`      → ${v.imports}`);
    console.log(`      ${v.rule}`);
  }
  process.exitCode = 1;
}

main();
