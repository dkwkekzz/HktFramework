// World Author — brief 하나에서 방 하나의 뼈대를 낸다 (T3 ADDED).
//
//   npm run world:author -- <brief.json>            낼 것을 글자로 보인다 (파일을 쓰지 않는다)
//   npm run world:author -- <brief.json> --write    content/regions/<방>.ts 를 굳힌다
//
// 판정도 자리 고르기도 기반이 한다 (engine/world-authoring/author.ts). 이 도구가 하는 일은 셋이다:
// 템플릿(게임 명사)을 건네는 것 · 그 방을 어떻게 컴파일하는지 알려 주는 것 ·
// 나온 뼈대를 **이 저장소의 파일 모양**으로 옮기는 것.
//
// 파일 모양을 아는 것이 왜 도구인가 — 어느 폴더에 무슨 이름으로 두는지는 세계의 사실이 아니라
// 이 저장소의 사정이기 때문이다. 기반은 값을 내고, 이 도구가 그 값을 글자로 굳힌다.
//
// 굳힌 것은 **데이터다.** 방 하나가 느는 데 규칙 코드는 한 줄도 늘지 않는다 (등급 A · Tool-Scale §2).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPILE_RULES } from '../../content/regions';
import { WORLD_AUTHOR_TEMPLATES } from '../../content/authoring/templates';
import { WORLD_CONTRACTS } from '../../content/authoring/contracts';
import { authorRegion, type AuthoredRegion } from '../../engine/world-authoring/author';
import { parseRegionBrief, type RegionBrief } from '../../engine/world-authoring/brief';
import { gradeRegion, type GradeResult } from '../../engine/world-authoring/grade';
import { compileRegion } from '../../engine/world-authoring/compile';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** brief 파일 하나 → 형을 통과한 brief. 통과하지 못하면 걸린 자리를 대고 멈춘다 */
export function readBrief(path: string): RegionBrief {
  const parsed = parseRegionBrief(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.ok) {
    const lines = parsed.problems.map((p) => `    ${p.path || '(뿌리)'}  ${p.message}`);
    throw new Error(['brief 가 형을 통과하지 못했다:', ...lines].join('\n'));
  }
  return parsed.brief;
}

/** 이 세계의 계약 목록과 대조한 등급 (T4) */
export function gradeFromFile(path: string): GradeResult {
  return gradeRegion(readBrief(path), WORLD_CONTRACTS);
}

/** 빠진 것들을 GAP 형식으로 — CLAUDE.md 의 네 줄 그대로 */
export function renderGrade(grade: GradeResult): string {
  const lines = [`  등급 ${grade.grade} — ${grade.because}`];
  const block = (title: string, gaps: GradeResult['blocking']) => {
    if (gaps.length === 0) return;
    lines.push('', `  ${title}`);
    for (const gap of gaps) {
      lines.push('    GAP');
      lines.push(`      Required   ${gap.required}`);
      lines.push(`      Missing    ${gap.missing}`);
      if (gap.reason) lines.push(`      Reason     ${gap.reason}`);
      lines.push(`      Return To  ${gap.returnTo}`);
    }
  };
  block('등급을 가른 것', grade.blocking);
  block('등급을 가르지는 않으나 채워야 할 것 (여덟 답)', grade.pending);
  return lines.join('\n');
}

/** brief 파일 하나 → 뼈대 하나 */
export function authorFromFile(path: string): AuthoredRegion {
  const parsed = { ok: true as const, brief: readBrief(path) };
  return authorRegion({
    brief: parsed.brief,
    templates: WORLD_AUTHOR_TEMPLATES,
    compile: (space) => compileRegion(space, COMPILE_RULES).world,
  });
}

/** 값을 글자로 — 키 순서가 값의 순서 그대로여야 두 번 내도 같다 */
function literal(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((v) => `${indent}  ${literal(v, `${indent}  `)}`).join(',\n');
    return `[\n${inner},\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(([key, v]) => `${indent}  ${key}: ${literal(v, `${indent}  `)}`)
      .join(',\n');
    return `{\n${inner},\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** 값 글자를 이 저장소의 글자꼴로 — 키에 따옴표를 두지 않고 홑따옴표를 쓴다 */
function asSource(text: string): string {
  return text.replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:').replace(/"/g, "'");
}

/** 방 하나의 파일 — content/regions/<slug>.ts 에 그대로 들어간다 */
export function renderRegionModule(authored: AuthoredRegion): string {
  const { spec } = authored;
  const missing = authored.unanswered.length;
  const body = [
    `// ${authored.name} — depth ${spec.depth}. **world:author 가 낸 뼈대다** (T3).`,
    '//',
    '// 손으로 쓴 방들이 지닌 실측 근거(왜 이 반경인가 · 왜 이 깊이인가)가 이 파일에는 없다.',
    '// 생성기가 댄 것은 서기는 하는 방 하나다 — 검사 아홉을 통과하고, 놓인 원천에 걸어 닿는다.',
    '// 값을 손으로 고치는 순간 이 파일은 생성물이 아니라 손으로 쓴 방이 된다 (그래도 좋다).',
    '//',
    missing > 0
      ? `// 이 방의 brief 는 아직 ${missing} 가지를 답하지 못했다: ${authored.unanswered.join(' · ')}.`
      : '// 이 방의 brief 는 여덟 답을 다 채웠다.',
    '//',
    `// seed ${spec.space.seed} 는 brief 를 해시한 값이다 — 같은 brief 는 언제나 같은 방을 낸다.`,
    '',
    "import type { RegionSpec } from './spec';",
    "import { ANCHOR_LAYER } from './spec';",
    "import { RESOURCE_LAYER, TRACE_LAYER } from './resource-ecology';",
    '',
    `export const ${spec.id} = '${spec.id}';`,
    '',
    `export const ${spec.id}_SPEC: RegionSpec = ${literal(spec, '')};`,
    '',
  ].join('\n');
  // layer 이름과 방 이름을 글자가 아니라 상수로 — 컨텐츠의 표가 바뀌면 이 파일도 따라간다
  return asSource(
    body
      .replace(new RegExp(`"${WORLD_AUTHOR_TEMPLATES.anchorLayer}"`, 'g'), 'ANCHOR_LAYER')
      .replace(new RegExp(`"${WORLD_AUTHOR_TEMPLATES.resourceLayer}"`, 'g'), 'RESOURCE_LAYER')
      .replace(new RegExp(`"${WORLD_AUTHOR_TEMPLATES.traceLayer}"`, 'g'), 'TRACE_LAYER')
      .replace(new RegExp(`"${spec.id}"`, 'g'), spec.id),
  );
}

/** graph 와 view 표에 이어 붙일 줄들 — 손으로 옮겨 넣는 자리를 정확히 댄다 */
export function renderSeams(authored: AuthoredRegion): string {
  const lines: string[] = [];
  lines.push('  content/regions/graph.ts — regions 에 이름 하나, connectors 끝에 아래를 이어 붙인다');
  for (const c of authored.connectors) {
    lines.push(`    ${asSource(literal(c, '    '))},`);
  }
  lines.push('');
  lines.push('  content/view/region-presentation.ts — REGION_NAMES 에 한 줄');
  lines.push(`    ${authored.spec.id}: '${authored.name}',`);
  if (authored.neighbourAnchors.length > 0) {
    lines.push('');
    lines.push('  이웃 쪽에 늘어야 하는 anchor — 자리는 그 방의 땅을 아는 쪽이 정한다');
    lines.push('  (놓지 않으면 world:check 의 ⑤ missing-anchor 가 잡는다)');
    for (const a of authored.neighbourAnchors) {
      lines.push(`    ${a.region}  point(layer=${WORLD_AUTHOR_TEMPLATES.anchorLayer}, tag=${a.anchor})`);
    }
  }
  return lines.join('\n');
}

function main(argv: readonly string[]): number {
  const files = argv.filter((a) => !a.startsWith('-'));
  const flags = argv.filter((a) => a.startsWith('-'));
  const unknown = flags.filter((f) => f !== '--write');
  if (files.length !== 1 || unknown.length > 0) {
    process.stderr.write(
      [
        '  world:author — brief 하나에서 방 하나의 뼈대를 낸다',
        unknown.length > 0 ? `    모르는 인자: ${unknown.join(' ')}` : '    brief 파일 하나를 밝힌다',
        '    사용: npm run world:author -- <brief.json> [--write]',
        '',
      ].join('\n'),
    );
    return 2;
  }
  const path = resolve(ROOT, files[0]!);
  const grade = gradeFromFile(path);
  // 등급 C 의 방은 굳히지 않는다 — 지금 없는 의미를 요구하므로 뼈대가 서도 세계에 붙지 못한다
  if (grade.grade === 'C' && flags.includes('--write')) {
    process.stderr.write(`${renderGrade(grade)}\n\n  등급 C 는 굳히지 않는다 — 기반 층의 그 행이 먼저다.\n`);
    return 1;
  }
  const authored = authorFromFile(path);
  const module = renderRegionModule(authored);
  if (flags.includes('--write')) {
    const slug = authored.spec.id.toLowerCase().replace(/_/g, '-');
    const out = resolve(ROOT, 'content/regions', `${slug}.ts`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, module, 'utf8');
    process.stdout.write(
      `${renderGrade(grade)}\n\n  굳혔다: content/regions/${slug}.ts\n\n${renderSeams(authored)}\n`,
    );
    return 0;
  }
  process.stdout.write(`${module}\n${renderSeams(authored)}\n\n${renderGrade(grade)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
