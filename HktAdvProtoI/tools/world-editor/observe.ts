// World Observe — 세계가 자기 Region 그래프를 읊는다 (C004 ADDED · SPEC-008 · SPEC-009).
//
//   npm run world:observe            방 표 · Connector 표 · 중첩 · 경계 · 검사 를 이 순서로 출력한다
//   npm run world:observe --graph    같은 것 (인자를 주지 않으면 --graph 로 본다 —
//                                    이 도구가 지금 아는 것이 그것 하나뿐이기 때문이다)
//
// 세계를 바꾸지 않는 **읽기 전용** 관찰이다 — 파일을 하나도 쓰지 않는다 (SPEC-009).
// 두 번 돌리면 글자까지 같아야 하므로 시각·난수·Map 순회 순서에 기대지 않는다:
// 순서는 전부 컨텐츠 데이터의 배열 순서(REGION_SPECS · connectors · containment · frontiers)다.
//
// 도구는 **판정하지 않는다** — checkGraph 의 결과를 사람이 읽을 줄로 옮길 뿐 좋다/나쁘다를 말하지 않고,
// 방·Connector·중첩·경계의 수를 스스로 정하지 않는다: 데이터가 준 만큼 적는다 (SPEC-008 경계).

import { resolve } from 'node:path';
import {
  ANCHOR_LAYER,
  CLOSED_CONNECTORS,
  REGION_GRAPH,
  REGION_SPECS,
  START_REGION_ID,
  regionSpec,
  type RegionSpec,
} from '../../content/regions';
import { pointsOf, type Extent } from '../../engine/world-authoring/description';
import { checkGraph } from '../../engine/world-authoring/check';

// ── 표 그리기 ────────────────────────────────────────────────────────
//
// tools/catalog/print.ts 의 방식(들여쓴 줄 · padEnd 로 맞춘 칸 · 가로줄로 나눈 묶음)을 따른다.
// 다만 칸 너비는 데이터에서 잰다 — 이름이 길어지면 표가 따라 넓어진다.
// 한글은 터미널에서 두 칸을 먹으므로 글자 수가 아니라 **보이는 너비**로 맞춘다.

const RULE_WIDTH = 100;

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // 한글·한자·전각 기호 — 두 칸
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

function pad(text: string, width: number): string {
  const gap = width - displayWidth(text);
  return gap > 0 ? text + ' '.repeat(gap) : text;
}

/** 머리글 한 줄 + 몸 줄들 — 칸마다 가장 넓은 것에 맞춘다. 마지막 칸은 채우지 않는다 */
function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const widths = header.map((cell, i) =>
    Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[i] ?? ''))),
  );
  const line = (cells: readonly string[]) =>
    '    ' +
    cells
      .map((cell, i) => (i === cells.length - 1 ? cell : pad(cell, widths[i]!)))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

function rule(): string {
  return '  ' + '-'.repeat(RULE_WIDTH);
}

// ── 값을 글자로 ──────────────────────────────────────────────────────

function formatExtent(extent: Extent): string {
  return `x[${extent.minX}, ${extent.maxX}] z[${extent.minZ}, ${extent.maxZ}]`;
}

function anchorCount(spec: RegionSpec): number {
  return pointsOf(spec.space, ANCHOR_LAYER).length;
}

/** 닫힌 목록에 있는가 — 열림/닫힘은 CLOSED_CONNECTORS 가 정한다 */
function isClosed(connectorId: string): boolean {
  return CLOSED_CONNECTORS.includes(connectorId);
}

/** 그 region 에 regionSpec 이 있는가 — 없으면 아직 짓지 않은 경계다 */
function isBuilt(regionId: string): boolean {
  return regionSpec(regionId) !== undefined;
}

// ── 그래프 읊기 ──────────────────────────────────────────────────────

export function renderGraph(): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  World Observe — 이 세계의 Region 그래프 (content/regions 데이터 그대로 · 읽기 전용)');

  // 방 — REGION_SPECS 순서
  lines.push(rule());
  lines.push(`  방 ${REGION_SPECS.length} (REGION_SPECS 순서)`);
  lines.push(
    ...table(
      ['id', 'depth', 'extent', 'anchor'],
      REGION_SPECS.map((spec) => [
        spec.id,
        spec.depth,
        formatExtent(spec.space.extent),
        String(anchorCount(spec)),
      ]),
    ),
  );

  // Connector — connectors 배열 순서
  lines.push(rule());
  lines.push(`  Connector ${REGION_GRAPH.connectors.length} (connectors 순서)`);
  lines.push(
    ...table(
      ['id', 'from → to', 'direction', 'transition', '문', '건너간 곳'],
      REGION_GRAPH.connectors.map((connector) => [
        connector.id,
        `${connector.from.region} → ${connector.to.region}`,
        connector.direction,
        connector.transition,
        isClosed(connector.id) ? '닫힘' : '열림',
        isBuilt(connector.to.region) ? '지어짐' : '경계',
      ]),
    ),
  );

  // 중첩 — containment 배열 순서
  lines.push(rule());
  lines.push(`  중첩 ${REGION_GRAPH.containment.length} (containment 순서)`);
  for (const { parent, child } of REGION_GRAPH.containment) {
    lines.push(`    ${parent} ⊃ ${child}`);
  }

  // 경계 — frontiers 배열 순서
  const frontiers = REGION_GRAPH.frontiers ?? [];
  lines.push(rule());
  lines.push(`  경계 ${frontiers.length} — 아직 짓지 않은 이름 (frontiers 순서)`);
  for (const name of frontiers) {
    lines.push(`    ${name}`);
  }

  // 검사 — checkGraph 의 결과를 옮긴다. 시작 방은 컨텐츠가 소유한다 (START_REGION_ID)
  const issues = checkGraph(
    REGION_SPECS.map((spec) => spec.space),
    REGION_GRAPH,
    ANCHOR_LAYER,
    START_REGION_ID,
  );
  lines.push(rule());
  lines.push(`  검사 (checkGraph · 시작 방 ${START_REGION_ID})`);
  if (issues.length === 0) {
    lines.push('    검사 오류 0');
  } else {
    for (const issue of issues) {
      lines.push(`    ${issue.code}  ${issue.region}  ${issue.detail}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** `--graph` 말고 다른 것을 받았을 때 — 무엇을 아는지 밝히고 아무것도 하지 않는다 (SPEC-009 경계) */
export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' ')}`,
    '  이 도구가 아는 것은 하나다 — --graph (방 · Connector · 중첩 · 경계 · 검사를 표로 읊는다)',
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다 — catalog/print.ts 선례)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  // 인자를 아예 주지 않으면 --graph 로 본다: 지금 아는 것이 그것 하나뿐이므로
  // "아무 말 없이 부르면 그래프를 읊는다" 가 이 도구의 기본이다.
  const unknown = args.filter((arg) => arg !== '--graph');
  if (unknown.length > 0) {
    console.log(renderUsage(unknown));
  } else {
    console.log(renderGraph());
  }
}
