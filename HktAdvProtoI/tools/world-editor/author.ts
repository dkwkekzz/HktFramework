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
import { COMPILE_RULES, MATERIAL_SEEDS, REGION_GRAPH } from '../../content/regions';
import { WORLD_AUTHOR_TEMPLATES, WORLD_CONTRACTS } from '../../content/authoring';
import { authorRegion, type AuthoredRegion } from '../../engine/world-authoring/author';
import { parseRegionBrief, type RegionBrief } from '../../engine/world-authoring/brief';
import {
  checkRegions,
  type CheckEcology,
  type CheckEcologySource,
  type CheckRegion,
  type CheckReport,
} from '../../engine/world-authoring/check';
import type { RegionOp } from '../../engine/world-authoring/description';
import { gradeRegion, type GradeResult } from '../../engine/world-authoring/grade';
import { compileRegion } from '../../engine/world-authoring/compile';
import { WORLD_CHECK_CONTRACT, WORLD_CHECK_ECOLOGY, WORLD_CHECK_REGIONS } from './check';

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

/** brief 하나 → 뼈대 하나. 이 세계의 템플릿과 컴파일 규칙을 건네는 자리다 */
export function authorBrief(brief: RegionBrief): AuthoredRegion {
  return authorRegion({
    brief,
    templates: WORLD_AUTHOR_TEMPLATES,
    compile: (space) => compileRegion(space, COMPILE_RULES).world,
  });
}

/** brief 파일 하나 → 뼈대 하나 */
export function authorFromFile(path: string): AuthoredRegion {
  return authorBrief(readBrief(path));
}

/**
 * 생성한 방을 **지금 세계 곁에 세워** 검사한다 (T3 의 산출 → T1). 저장소는 건드리지 않는다 —
 * 어느 방을 세계에 들이는가는 컨텐츠 층의 결정이고 도구가 정할 일이 아니다 (Tool-Scale §4).
 *
 * 생성기는 이웃 쪽 anchor 의 **이름만** 댄다 (그 방의 땅을 모르므로). 여기서는 그것을 실제로
 * 놓아 준다 — 그러지 않으면 새 방은 언제나 ⑤ 에 걸리고, 그 걸림은 brief 를 고쳐서는 풀리지 않는다.
 * 곧 이 검사가 답하는 것은 "**들이고 나면** 이 방이 서는가" 다.
 *
 * **재료 계통 검사(⑩~㉒)도 함께 건다.** 그러려면 그 방이 새로 낳는 재료가 재료 표에 있어야 하므로
 * 여기서 실어 준다 — 이웃 쪽 anchor 를 놓아 주는 것과 같은 어법이다 (사람이 붙일 줄을
 * `renderSeams` 가 대고, 이 검사는 붙인 뒤를 잰다). 그래서 편중(⑲ ⑳ ㉒)이 후보에게도 잡힌다.
 */
export function checkAuthored(authored: AuthoredRegion): CheckReport {
  const anchorOps: RegionOp[] = authored.neighbourAnchors.map((a) => ({
    id: `anchor-${a.anchor.toLowerCase().replace(/_/g, '-')}`,
    kind: 'point',
    layer: WORLD_CHECK_CONTRACT.anchorLayer,
    tag: a.anchor,
    position: { x: 0, z: 0 },
  }));
  const regions: CheckRegion[] = [
    ...WORLD_CHECK_REGIONS.map((region) =>
      authored.neighbourAnchors.some((a) => a.region === region.id)
        ? { ...region, space: { ...region.space, ops: [...region.space.ops, ...anchorOps] } }
        : region,
    ),
    {
      id: authored.spec.id,
      depth: authored.spec.depth,
      space: authored.spec.space,
      coreRules: 0,
    },
  ];
  const sources = authored.spec.resourceEcology?.sources ?? [];
  return checkBeside(
    regions,
    {
      ...REGION_GRAPH,
      regions: [...REGION_GRAPH.regions, authored.spec.id],
      connectors: [...REGION_GRAPH.connectors, ...authored.connectors],
    },
    {
      ...WORLD_CHECK_ECOLOGY,
      // 그 방이 새로 낳는 재료 — 사람이 재료 표에 붙일 줄이다 (renderSeams 가 댄다)
      materials: [
        ...WORLD_CHECK_ECOLOGY.materials,
        ...freshMaterials(authored).map((seed) => ({ id: seed.id, worldCause: seed.worldCause })),
      ],
      sources: [
        ...WORLD_CHECK_ECOLOGY.sources,
        ...sources.map(
          (source): CheckEcologySource => ({
            id: source.id,
            region: authored.spec.id,
            materialId: source.materialId,
            worldCause: source.worldCause,
            supply: source.supply,
            // 이 세계의 원천은 전부 되돌아오고 유한하지 않다 (world:check 와 같은 답이다)
            renewable: true,
            recoveryCause: source.recoveryCause,
            finite: false,
            depletionConsequence: '',
            traces: source.traceOps,
            opportunity: source.opportunity,
            carrier: source.carrier,
          }),
        ),
      ],
      // 원천을 가진 방은 스스로 낳으므로 고립을 밝힐 것이 없다 (검사 ㉒ 가 그렇게 묻는다)
      regions: [
        ...WORLD_CHECK_ECOLOGY.regions,
        { id: authored.spec.id, isolationReason: '' },
      ],
    },
  );
}

/**
 * 후보 **없이** 같은 검사를 돌린다 — 편중 요약이 견줄 바탕이다 (T6).
 *
 * `checkAuthored` 와 **같은 잣대**여야 한다. 한쪽만 재료 계통 검사를 걸면 견준 차이가
 * 후보 때문인지 잣대 때문인지 갈리지 않는다. 그래서 둘 다 같은 자리(`checkBeside`)를 지난다.
 */
export function checkBaseline(): CheckReport {
  return checkBeside(WORLD_CHECK_REGIONS, REGION_GRAPH, WORLD_CHECK_ECOLOGY);
}

function checkBeside(
  regions: readonly CheckRegion[],
  graph: typeof REGION_GRAPH,
  ecology: CheckEcology,
): CheckReport {
  return checkRegions({
    regions,
    graph,
    contract: WORLD_CHECK_CONTRACT,
    compile: (region) => compileRegion(region.space, COMPILE_RULES).world,
    ecology,
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
/**
 * 그 방이 **새로 낳는 재료** — 재료 표(MATERIAL_SEEDS)에 아직 없는 것들.
 *
 * 방 하나를 들이는 일은 방 파일 하나로 끝나지 않는다. 그 방이 낳는 재료가 세계의 재료 표에
 * 서 있지 않으면 검사 ⑪(원천이 아는 재료를 가리키는가)과 ㉑(그 원천이 내는 재료가 있는가)이
 * 잡는다 — 승인해 놓고 검사가 깨지는 자리가 여기였다.
 *
 * 그래도 **도구가 그 표를 고치지 않는다.** 무엇이 이 세계의 재료인가는 방 하나의 사정이 아니라
 * 계통의 일이고(재료 셋이 사슬 하나에 매달려 있다 — A.1), 그 판단은 사람의 것이다.
 * 도구가 하는 일은 graph 줄과 view 줄에 한 것과 같다: **어디에 무엇을 붙여야 하는지 정확히 대는 것**.
 */
export function freshMaterials(
  authored: AuthoredRegion,
): { id: string; worldCause: string; forms: string[] }[] {
  const known = new Set(MATERIAL_SEEDS.map((seed) => seed.id));
  const fresh = new Map<string, { id: string; worldCause: string; forms: string[] }>();
  for (const source of authored.spec.resourceEcology?.sources ?? []) {
    if (known.has(source.materialId)) continue;
    const seed = fresh.get(source.materialId) ?? {
      id: source.materialId,
      worldCause: source.worldCause,
      forms: [],
    };
    // 같은 재료가 여러 형태로 난다 — 종류를 늘린 것이 아니라 순도를 늘린 것이다 (A.1)
    if (!seed.forms.includes(source.form)) seed.forms.push(source.form);
    fresh.set(source.materialId, seed);
  }
  return [...fresh.values()];
}

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
  const fresh = freshMaterials(authored);
  if (fresh.length > 0) {
    lines.push('');
    lines.push('  content/regions/resource-ecology.ts — MATERIAL_SEEDS 에 아래를 더한다');
    lines.push('  (그 방이 **새로 낳는 재료**다. 더하지 않으면 world:check 의 ⑪ 과 ㉑ 이 잡는다 —');
    lines.push('   원천이 아는 재료를 가리키지 않고, 그 원천이 내는 재료가 없는 것이 된다)');
    for (const material of fresh) {
      lines.push(`    ${asSource(literal(material, '    '))},`);
    }
  }
  return lines.join('\n');
}

/**
 * 뼈대 하나를 이 저장소의 자리에 굳힌다 — 어느 폴더에 무슨 이름인지는 저장소의 사정이므로
 * 도구가 안다 (기반은 값만 낸다). 굳힌 자리를 돌려준다.
 *
 * 승인 표면(T6 의 world:admit)도 같은 자리를 지난다 — 세계에 방이 들어오는 길은 하나여야 한다.
 */
export function writeRegionModule(authored: AuthoredRegion, dir = 'content/regions'): string {
  const slug = authored.spec.id.toLowerCase().replace(/_/g, '-');
  const path = `${dir}/${slug}.ts`;
  const out = resolve(ROOT, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderRegionModule(authored), 'utf8');
  return path;
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
    const written = writeRegionModule(authored);
    process.stdout.write(
      `${renderGrade(grade)}\n\n  굳혔다: ${written}\n\n${renderSeams(authored)}\n`,
    );
    return 0;
  }
  process.stdout.write(`${module}\n${renderSeams(authored)}\n\n${renderGrade(grade)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
