// World Observe — 세계가 자기 Region 그래프를 읊고, 방 하나의 땅을 그림과 보고로 낸다
// (C004 ADDED · SPEC-008 · SPEC-009 / C007 ADDED · SPEC-001 ~ SPEC-007).
//
//   npm run world:observe            방 표 · Connector 표 · 중첩 · 경계 · 검사 를 이 순서로 출력한다
//   npm run world:observe --graph    같은 것 (인자를 주지 않으면 --graph 로 본다 —
//                                    C004 에서 이 도구가 아는 것이 그것 하나뿐이었기 때문이다)
//   npm run world:observe -- <방> [--height --surface --traversable --semantic --top-view]
//                            [--semantic=<layer>] [--report] [--out <dir>]
//                                    그 방 하나를 본다 (C007). 그림을 하나도 밝히지 않으면 --report 로 본다
//
// 세계를 바꾸지 않는 **읽기 전용** 관찰이다 — 파일을 하나도 쓰지 않는다 (SPEC-009).
// 두 번 돌리면 글자까지 같아야 하므로 시각·난수·Map 순회 순서에 기대지 않는다:
// 순서는 전부 컨텐츠 데이터의 배열 순서(REGION_SPECS · connectors · containment · frontiers)다.
//
// 도구는 **판정하지 않는다** — checkGraph 의 결과를 사람이 읽을 줄로 옮길 뿐 좋다/나쁘다를 말하지 않고,
// 방·Connector·중첩·경계의 수를 스스로 정하지 않는다: 데이터가 준 만큼 적는다 (SPEC-008 경계).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ANCHOR_LAYER,
  CITY_TAG,
  CLOSED_CONNECTORS,
  COMPILE_RULES,
  CONDITION_PREFIX,
  REGION_GRAPH,
  REGION_SPECS,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  regionSpec,
  type RegionSpec,
} from '../../content/regions';
import { areasOf, pointsOf, type Extent } from '../../engine/world-authoring/description';
import { checkGraph, type GraphIssue } from '../../engine/world-authoring/check';
import { compileRegion } from '../../engine/world-authoring/compile';
import type { CompiledRegion, CompiledWorldTerrain } from '../../engine/world-authoring/compiled';
import {
  rasterHeight,
  rasterSemantic,
  rasterSurface,
  rasterTraversable,
  summarize,
  type RasterMap,
  type TerrainSummary,
} from '../../engine/world-authoring/observe';
import { encodePng } from './png';

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

/**
 * 머리글 한 줄 + 몸 줄들 — 칸마다 가장 넓은 것에 맞춘다. 마지막 칸은 채우지 않는다.
 * `indent` 는 C007 이 더한 것이다 — 묶음 안에 표가 들어가면 한 단 더 들어가야 읽힌다.
 * 기본값이 C004 의 그 들여쓰기이므로 --graph 의 출력은 한 글자도 바뀌지 않는다.
 */
function table(
  header: readonly string[],
  rows: readonly (readonly string[])[],
  indent = '    ',
): string[] {
  const widths = header.map((cell, i) =>
    Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[i] ?? ''))),
  );
  const line = (cells: readonly string[]) =>
    indent +
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

// ── 방 하나를 보는 길 (C007 ADDED) ────────────────────────────────────
//
// 여기부터가 C007 이 더한 것이다. `--graph` 는 위쪽 그대로이고 한 글자도 바뀌지 않았다.
// 도구는 여전히 **읽기 전용**이다 — 세계도 컨텐츠도 건드리지 않고, 밝힌 그림 파일 말고는
// 아무것도 쓰지 않는다 (SPEC-007).

/** 그림을 둘 기본 폴더 — 밝히지 않으면 여기 (brief §2.1) */
const DEFAULT_OUT_DIR = 'tools/world-editor/out';

/** 이 도구가 낼 수 있는 그림과 그 파일 이름 조각 — 이 배열 순서로 낸다 (결정론) */
const PICTURE_KINDS = ['height', 'surface', 'traversable', 'semantic', 'top'] as const;
type PictureKind = (typeof PICTURE_KINDS)[number];

// ── 색 표 ────────────────────────────────────────────────────────────
//
// **색 표는 도구의 것이고 게임의 색과 같을 필요가 없다** (spec UNRESOLVED "래스터의 크기와 색").
// 그림마다 목적이 다르므로 표도 다르다:
//
//   높이   회색 눈금 — 값 하나가 곧 밝기다. 색을 섞으면 "어디가 더 높은가" 가 색상으로 옮겨져
//          눈이 크기를 읽지 못한다. 그 방의 최소~최대를 편 값이므로 평평한 방은 전부 검다
//   표면·의미  태그 색인 → 서로 갈리는 색. 태그의 뜻(젖음·평지…)을 색이 흉내 내지 않는다 —
//          흉내 내면 표가 게임의 색 표와 갈라지는 날 거짓말이 된다. 목적은 **태그가 서로 갈리는 것**뿐
//   통행   통행/막힘이 한눈에 갈리는 것이 목적이다. 그래서 색상이 아니라 **명도**로 가른다 —
//          통행은 거의 흰색(242) · 막힘은 전부 어둡다(같은 색을 0.45 로 낮춘 것). 흑백으로 보아도
//          막힌 자리가 검게 뭉쳐 보인다. 막힘끼리는 사유별로 색상이 갈린다
//   top    **표면 그림 그대로**를 밑바닥에 깔고 그 위에 area 경계선과 point 표식을 얹는다
//          (그래서 두 그림은 얹은 자리 말고는 픽셀까지 같다). 얹은 것이 밑바닥과 같은 표에서
//          나오므로 경계선은 그 태그 색을 **어둡게** 한 것이다 — 통행 그림이 막힘을 어둡게 하는
//          것과 같은 손잡이다. 젖음(파랑) 위의 젖음 경계선도 어두운 남색이라 살아난다

type RGB = readonly [number, number, number];

/**
 * 태그 색인 → 색 (12색).
 *
 * 색상환을 고르게 돌되 명도가 이웃끼리 번갈아 오르내리도록 골랐다 — 색맹으로도, 흑백으로도
 * 이웃한 색인이 갈린다. 12 는 이 세계가 지금 쓰는 가장 큰 판(표면 4 · settlement 5)의 갑절을
 * 넘으므로 되돌아 겹치는 일이 없다. 넘치면 나머지 연산으로 되돈다 — 그림이 없느니보다 낫다.
 */
const TAG_COLORS: readonly RGB[] = [
  [0x1f, 0x77, 0xb4],
  [0xff, 0x7f, 0x0e],
  [0x2c, 0xa0, 0x2c],
  [0xd6, 0x27, 0x28],
  [0x94, 0x67, 0xbd],
  [0x8c, 0x56, 0x4b],
  [0xe3, 0x77, 0xc2],
  [0x7f, 0x7f, 0x7f],
  [0xbc, 0xbd, 0x22],
  [0x17, 0xbe, 0xcf],
  [0xff, 0xd9, 0x2f],
  [0x39, 0x3b, 0x79],
];

/** 의미 그림에서 "아무 area 도 없음"(색인 0) — 어느 태그 색과도 겹치지 않는 아주 어두운 바탕 */
const EMPTY_COLOR: RGB = [0x1a, 0x1a, 0x1a];
/** 통행 그림의 "통행 가능"(색인 0) */
const PASSABLE_COLOR: RGB = [0xf2, 0xf2, 0xf2];
/** top 그림의 경계선을 밑바닥과 가르는 어둡기 — 통행 그림이 막힘을 어둡게 하는 것과 같은 손잡이 */
const OUTLINE_RATIO = 0.45;
/** point 표식의 두 색 — 3×3 의 테두리와 가운데. 어느 밑바닥 위에서도 둘 중 하나는 살아난다 */
const MARK_EDGE: RGB = [0x00, 0x00, 0x00];
const MARK_CORE: RGB = [0xff, 0xff, 0xff];

function tagColor(index: number): RGB {
  return TAG_COLORS[index % TAG_COLORS.length]!;
}

function scale(color: RGB, ratio: number): RGB {
  return [
    Math.round(color[0] * ratio),
    Math.round(color[1] * ratio),
    Math.round(color[2] * ratio),
  ];
}

// ── 그림의 위아래 ────────────────────────────────────────────────────
//
// 기구(RasterMap)는 격자 순서 그대로 준다 — row-major 이고 바깥 축이 z 이므로 **행 0 이 minZ** 다.
// 그림은 그것을 뒤집어 **행 0 에 maxZ** 를 둔다. 즉 세계의 +z 가 그림의 **위**다.
//
// 근거 둘.
//   ① 이 세계의 +z 는 북쪽이다 — 백왕령의 anchor FOREST_PATH(z = 18)를 데이터가 "북쪽으로 가는 문"
//      이라 적었고, 능선(z = 17)도 "북쪽 능선" 이다 (content/regions/white-king-domain.ts).
//      위에서 내려다본 그림에서 북쪽을 위에 두는 것이 지도의 어법이다.
//   ② --graph 의 표와 어긋나지 않는다 — 표는 extent 를 `x[minX, maxX] z[minZ, maxZ]` 로,
//      즉 **min 을 먼저** 읽는다. x 는 그 읽는 방향이 그림의 왼→오른쪽 그대로이고(뒤집지 않는다),
//      z 는 min 이 아래·max 가 위이므로 그림에서 **아래→위**로 읽힌다. 표를 읽고 그림을 보면
//      왼쪽 아래가 (minX, minZ) 다 — 한 번 정하면 다섯 장이 전부 같다.
const FLIP_Z = true;

/**
 * 눈금 — 격자 칸 하나를 픽셀 몇으로 그릴 것인가 (기본 1 = 격자와 1:1).
 *
 * 격자와 1:1 인 그림은 41×41 이라 **사람이 들여다볼 수가 없다**. 그런데 이 도구의 목적은
 * "내가 걸은 땅을 한 장으로 본다" 이므로, 볼 수 없는 그림은 목적을 절반만 채운다.
 * 그래서 정수 배로 늘려 찍을 수 있게 둔다 — 칸 하나가 정확히 n×n 픽셀이 되는
 * 최근접 확대라서 값이 섞이지 않고, 격자와 픽셀의 1:1 대응도 그대로다.
 */
const DEFAULT_SCALE = 1;
const MAX_SCALE = 32;

/** RasterMap 을 색으로 펴서 PNG 한 장으로 — 위아래 뒤집기는 여기 한 자리에서만 일어난다 */
function paint(
  map: RasterMap,
  colorOf: (value: number, index: number) => RGB,
  zoom: number = DEFAULT_SCALE,
): Buffer {
  const { width, height, values } = map;
  const out = { w: width * zoom, h: height * zoom };
  const rgb = new Uint8Array(out.w * out.h * 3);
  for (let row = 0; row < height; row++) {
    const destRow = FLIP_Z ? height - 1 - row : row;
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      const color = colorOf(values[index] ?? 0, index);
      // 칸 하나를 zoom×zoom 픽셀로 — 최근접이라 값이 섞이지 않는다
      for (let dy = 0; dy < zoom; dy++) {
        for (let dx = 0; dx < zoom; dx++) {
          const at = ((destRow * zoom + dy) * out.w + (col * zoom + dx)) * 3;
          rgb[at] = color[0];
          rgb[at + 1] = color[1];
          rgb[at + 2] = color[2];
        }
      }
    }
  }
  return encodePng(out.w, out.h, rgb);
}

// ── 그림 다섯 ────────────────────────────────────────────────────────

function paintHeight(world: CompiledWorldTerrain, zoom: number): Buffer {
  // 회색 눈금 — 값이 곧 밝기다
  return paint(rasterHeight(world), (value) => [value, value, value], zoom);
}

function paintSurface(world: CompiledWorldTerrain, zoom: number): Buffer {
  // 표면 태그 색인 → 색. 색인 0 도 태그이므로 EMPTY_COLOR 를 쓰지 않는다
  return paint(rasterSurface(world), (value) => tagColor(value), zoom);
}

function paintTraversable(world: CompiledWorldTerrain, zoom: number): Buffer {
  // 0 = 통행(밝다) · 그 밖 = 막힘 사유 색인(어둡다)
  return paint(
    rasterTraversable(world),
    (value) => (value === 0 ? PASSABLE_COLOR : scale(tagColor(value - 1), 0.45)),
    zoom,
  );
}

function paintSemantic(world: CompiledWorldTerrain, layer: string, zoom: number): Buffer {
  // 0 = 아무 area 도 없음 · 그 밖 = 그 layer 의 태그 색인
  return paint(
    rasterSemantic(world, layer),
    (value) => (value === 0 ? EMPTY_COLOR : tagColor(value - 1)),
    zoom,
  );
}

/**
 * 위에서 본 한 장 — 표면 색을 흐리게 깔고 그 위에 area 경계선과 point 표식을 얹는다.
 *
 * 경계선은 **의미 래스터의 경계**로 그린다 (직접 도형을 훑지 않는다): 어떤 layer 의 값이
 * 이웃 칸과 다르면 그 칸이 경계다. 그러면 겹친 area 끼리의 경계도 함께 드러나고,
 * 도형을 품는 판정은 기구 하나(rasterSemantic)에만 남는다 — 도구가 기하를 다시 짜지 않는다.
 * 얹는 순서는 layer 가 areas 에 처음 나온 순서다 (ops 순서 = 결정론).
 *
 * 표식은 3×3 이다 — 격자 한 칸 = 한 픽셀이라 점 하나는 표면색에 묻힌다. 테두리 검정에
 * 가운데 흰색이므로 밝은 밑바닥에서도 어두운 밑바닥에서도 한쪽이 살아난다.
 */
function paintTopView(world: CompiledWorldTerrain, zoom: number): Buffer {
  const surface = rasterSurface(world);
  const { width, height } = surface;
  const rgb = new Uint8Array(width * height * 3);

  const put = (col: number, row: number, color: RGB): void => {
    if (col < 0 || col >= width || row < 0 || row >= height) return;
    const destRow = FLIP_Z ? height - 1 - row : row;
    const at = (destRow * width + col) * 3;
    rgb[at] = color[0];
    rgb[at + 1] = color[1];
    rgb[at + 2] = color[2];
  };

  // ① 밑바닥 — 표면 그림 그대로
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const value = surface.values[row * width + col] ?? 0;
      put(col, row, tagColor(value));
    }
  }

  // ② area 경계선 — layer 가 areas 에 처음 나온 순서
  const layers: string[] = [];
  for (const area of world.areas) if (!layers.includes(area.layer)) layers.push(area.layer);
  for (const layer of layers) {
    const map = rasterSemantic(world, layer);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const value = map.values[row * width + col] ?? 0;
        if (value === 0) continue;
        // 격자 밖은 "다른 값" 으로 친다 — 방의 변에 걸친 area 도 테두리를 갖는다
        const neighbours = [
          col > 0 ? (map.values[row * width + col - 1] ?? 0) : -1,
          col + 1 < width ? (map.values[row * width + col + 1] ?? 0) : -1,
          row > 0 ? (map.values[(row - 1) * width + col] ?? 0) : -1,
          row + 1 < height ? (map.values[(row + 1) * width + col] ?? 0) : -1,
        ];
        if (neighbours.some((n) => n !== value)) put(col, row, scale(tagColor(value - 1), OUTLINE_RATIO));
      }
    }
  }

  // ③ point 표식 — points 순서
  for (const point of world.points) {
    const col = Math.round((point.position.x - world.extent.minX) / world.resolution);
    const row = Math.round((point.position.z - world.extent.minZ) / world.resolution);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        put(col + dx, row + dz, dx === 0 && dz === 0 ? MARK_CORE : MARK_EDGE);
      }
    }
  }

  // 눈금 — 다 그린 뒤 마지막에 정수 배로 늘린다. 경계선과 표식이 칸 단위 그대로 커지므로
  // 1:1 그림을 그대로 확대한 것과 같다 (값이 섞이지 않는다)
  if (zoom <= 1) return encodePng(width, height, rgb);
  const out = { w: width * zoom, h: height * zoom };
  const big = new Uint8Array(out.w * out.h * 3);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const from = (row * width + col) * 3;
      for (let dy = 0; dy < zoom; dy++) {
        for (let dx = 0; dx < zoom; dx++) {
          const at = ((row * zoom + dy) * out.w + (col * zoom + dx)) * 3;
          big[at] = rgb[from] ?? 0;
          big[at + 1] = rgb[from + 1] ?? 0;
          big[at + 2] = rgb[from + 2] ?? 0;
        }
      }
    }
  }
  return encodePng(out.w, out.h, big);
}

// ── 검사 아홉 ────────────────────────────────────────────────────────
//
// 게임 명사(layer · tag)는 content/regions 의 상수에서 가져온다.
// 다만 resource · hazard · phenomenon 은 **이 세계에 아직 없어** 상수도 없다 (컨텐츠 층 주입의 것,
// spec Out of Scope). 그래서 그 세 이름만 이 도구가 글자로 들고 있는다 — 검사가 무엇을 찾는지를
// 적어 두기 위해서다. 찾아서 하나도 없으면 **"위반 0" 이 아니라 "놓인 것이 없다"** 로 적는다:
// 없는 것을 통과로 적으면 검사가 거짓말을 한다 (spec SPEC-005 경계).
const RESOURCE_LAYER = 'resource';
const HAZARD_LAYER = 'hazard';
const PHENOMENON_LAYER = 'phenomenon';
/** ③ 이 사람이 사는 자리로 치는 태그 — city 만 상수가 있고 나머지 둘은 아직 이 세계에 없다 */
const SETTLEMENT_TAGS = [CITY_TAG, 'village', 'refuge'] as const;

/** checkGraph 의 코드 → 검사 번호와 우리말 이름. 순서가 곧 ⑤⑥⑦⑧ 이다 */
const GRAPH_CHECKS = [
  { mark: '⑤', code: 'missing-anchor', name: 'Connector anchor 가 없는 방' },
  { mark: '⑥', code: 'containment-unlinked', name: '이어지지 않은 중첩' },
  { mark: '⑦', code: 'no-exit', name: '나갈 곳 없는 방' },
  { mark: '⑧', code: 'unreachable', name: '시작 방에서 닿지 않는 방' },
] as const;
/** 번호가 붙지 않은 나머지 코드 — 숨기지 않고 한 줄로 함께 적는다 */
const OTHER_GRAPH_CODES = ['unknown-region', 'frontier-built', 'unused-frontier'] as const;

/** 검사 한 줄 — 번호 · 이름 · 답. 판정하지 않는다 (좋다/나쁘다를 말하지 않는다) */
interface CheckLine {
  mark: string;
  name: string;
  answer: string;
  /** 답을 뒷받침하는 목록 — 있으면 그 아래 들여쓰기로 적는다 */
  detail?: string[];
}

/** ① 자원과 위험이 같은 근원인가 — 두 layer 의 area 가 겹치거나 닿는가 (W4) */
function checkResourceHazard(): CheckLine {
  const detail: string[] = [];
  let placed = 0;
  for (const spec of REGION_SPECS) {
    const resources = areasOf(spec.space, RESOURCE_LAYER);
    const hazards = areasOf(spec.space, HAZARD_LAYER);
    placed += resources.length + hazards.length;
    if (resources.length === 0 || hazards.length === 0) continue;
    // 둘 다 놓인 방에서만 격자로 재 본다 — 겹침도 닿음도 의미 래스터에서 나온다
    const world = compileRegion(spec.space, COMPILE_RULES).world;
    const resourceMap = rasterSemantic(world, RESOURCE_LAYER);
    const hazardMap = rasterSemantic(world, HAZARD_LAYER);
    let overlap = 0;
    let touch = 0;
    const { width, height } = resourceMap;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = row * width + col;
        if ((resourceMap.values[i] ?? 0) === 0) continue;
        if ((hazardMap.values[i] ?? 0) !== 0) {
          overlap++;
          continue;
        }
        const near =
          (col > 0 && (hazardMap.values[i - 1] ?? 0) !== 0) ||
          (col + 1 < width && (hazardMap.values[i + 1] ?? 0) !== 0) ||
          (row > 0 && (hazardMap.values[i - width] ?? 0) !== 0) ||
          (row + 1 < height && (hazardMap.values[i + width] ?? 0) !== 0);
        if (near) touch++;
      }
    }
    detail.push(`${spec.id}  겹친 칸 ${overlap} · 닿은 칸 ${touch}`);
  }
  if (placed === 0) {
    return {
      mark: '①',
      name: '자원과 위험이 같은 근원인가',
      answer: `놓인 것이 없다 — ${RESOURCE_LAYER} area 0 · ${HAZARD_LAYER} area 0 (이 세계에 아직 없는 layer 다)`,
    };
  }
  return { mark: '①', name: '자원과 위험이 같은 근원인가', answer: `방 ${detail.length}`, detail };
}

/** ② 깊이 없는 자리 — depth 를 갖지 않은 Region (이 세계의 depth 는 Region 이 갖는다) */
function checkDepth(): CheckLine {
  const missing = REGION_SPECS.filter((spec) => spec.depth.trim() === '').map((spec) => spec.id);
  return {
    mark: '②',
    name: '깊이 없는 자리',
    answer: `depth 없는 Region ${missing.length} / ${REGION_SPECS.length}`,
    detail: missing,
  };
}

/** ③ 조건 없이 선 settlement — 사람이 사는 자리가 있는데 condition 이 하나도 없는 Region (W2) */
function checkSettlementCondition(): CheckLine {
  const detail: string[] = [];
  let withSettlement = 0;
  let conditionTotal = 0;
  let bare = 0;
  for (const spec of REGION_SPECS) {
    const areas = areasOf(spec.space, SETTLEMENT_LAYER);
    const settlements = areas.filter((area) =>
      (SETTLEMENT_TAGS as readonly string[]).includes(area.tag),
    );
    if (settlements.length === 0) continue;
    withSettlement++;
    const conditions = areas.filter((area) => area.tag.startsWith(CONDITION_PREFIX));
    conditionTotal += conditions.length;
    // settlement 를 가진 방을 **전부** 적는다 — 이 검사는 "조건이 몇인가" 를 묻지 "위반인가" 를
    // 묻지 않는다 (도구는 판정하지 않는다). condition 0 인 방이 곧 W2 가 가리키는 자리이고,
    // 그것은 줄에 적힌 수로 드러난다
    detail.push(
      `${spec.id}  settlement ${settlements.map((a) => a.tag).join(' · ')} · condition ${conditions.length}` +
        (conditions.length > 0 ? ` (${conditions.map((a) => a.tag).join(' · ')})` : ''),
    );
    if (conditions.length === 0) bare++;
  }
  return {
    mark: '③',
    name: '조건 없이 선 settlement',
    answer:
      withSettlement === 0
        ? `놓인 것이 없다 — ${SETTLEMENT_LAYER} 의 ${SETTLEMENT_TAGS.join(' · ')} area 0`
        : `settlement 를 가진 Region ${withSettlement} · condition 합 ${conditionTotal} · 그 가운데 condition 0 인 곳 ${bare}`,
    detail,
  };
}

/** ④ Region 의 phenomenon 수 — phenomenon layer 의 area 가 Region 마다 몇인가 (W5) */
function checkPhenomenon(): CheckLine {
  const detail: string[] = [];
  let total = 0;
  for (const spec of REGION_SPECS) {
    const count = areasOf(spec.space, PHENOMENON_LAYER).length;
    total += count;
    if (count > 0) detail.push(`${spec.id}  ${count}`);
  }
  if (total === 0) {
    return {
      mark: '④',
      name: 'Region 의 phenomenon 수',
      answer: `놓인 것이 없다 — ${PHENOMENON_LAYER} area 0 (이 세계에 아직 없는 layer 다)`,
    };
  }
  return { mark: '④', name: 'Region 의 phenomenon 수', answer: `합 ${total}`, detail };
}

/** ⑤⑥⑦⑧ — checkGraph 의 결과를 그대로 옮긴다 (C004 의 그 호출 그대로) */
function graphCheckLines(issues: readonly GraphIssue[]): CheckLine[] {
  const lines: CheckLine[] = [];
  for (const check of GRAPH_CHECKS) {
    const hit = issues.filter((issue) => issue.code === check.code);
    lines.push({
      mark: check.mark,
      name: check.name,
      answer: `${check.code} ${hit.length}`,
      detail: hit.map((issue) => `${issue.region}  ${issue.detail}`),
    });
  }
  const others = OTHER_GRAPH_CODES.map(
    (code) => `${code} ${issues.filter((issue) => issue.code === code).length}`,
  );
  lines.push({ mark: '·', name: '번호 밖의 checkGraph 코드', answer: others.join(' · ') });
  return lines;
}

/** ⑨ core rule 수 — 이 세계에는 아직 Region 별 rule 이 없다 */
function checkCoreRules(): CheckLine {
  return {
    mark: '⑨',
    name: 'core rule 수',
    answer: '0 — 이 세계에는 아직 Region 별 rule 이 없다 (RegionSpec 에 그 자리가 없다)',
  };
}

function checkLines(): CheckLine[] {
  const issues = checkGraph(
    REGION_SPECS.map((spec) => spec.space),
    REGION_GRAPH,
    ANCHOR_LAYER,
    START_REGION_ID,
  );
  return [
    checkResourceHazard(),
    checkDepth(),
    checkSettlementCondition(),
    checkPhenomenon(),
    ...graphCheckLines(issues),
    checkCoreRules(),
  ];
}

// ── 보고 ─────────────────────────────────────────────────────────────

function formatHeight(value: number): string {
  return value.toFixed(2);
}

/**
 * 보고 한 장 — 묶음은 `방 · 땅 · 검사` 순서다 (brief §2.2). --graph 의 어법을 그대로 따른다:
 * 들여쓴 줄 · 가로줄로 나눈 묶음 · 보이는 너비로 맞춘 칸.
 *
 * 수는 하나도 도구가 세지 않는다 — summarize 가 센 것을 옮길 뿐이다 (SPEC-004).
 */
export function renderRegionReport(
  spec: RegionSpec,
  region: CompiledRegion,
  semanticLayer: string,
): string {
  const s: TerrainSummary = summarize(region);
  const lines: string[] = [];
  lines.push('');
  lines.push(`  World Observe — ${spec.id} 의 땅 (컴파일 결과 그대로 · 읽기 전용)`);

  // 방
  lines.push(rule());
  lines.push('  방');
  // 머리글이 없는 두 칸 — 이름은 표의 칸이 아니라 항목이므로 머리글 줄을 두지 않는다
  const facts: [string, string][] = [
    ['id', spec.id],
    ['depth', spec.depth],
    ['extent', formatExtent(s.extent)],
    ['격자', `${s.cols}×${s.rows} (resolution ${s.resolution})`],
    ['vertex', String(s.vertices)],
    ['높이', `${formatHeight(s.height.min)} ~ ${formatHeight(s.height.max)}`],
    ['hash', region.hash],
  ];
  const factWidth = Math.max(...facts.map(([name]) => displayWidth(name)));
  for (const [name, value] of facts) lines.push(`    ${pad(name, factWidth)}  ${value}`);

  // 땅
  lines.push(rule());
  lines.push('  땅');
  lines.push(`    표면 ${s.surface.length} (surfaceTags 순서 · 칸 수 0 인 태그도 적는다)`);
  lines.push(...table(['tag', '칸'], s.surface.map((row) => [row.tag, String(row.cells)]), '      '));
  lines.push(`    막힘 ${s.blocked.length} (blockedTags 순서)`);
  if (s.blocked.length === 0) {
    lines.push('      막는 규칙에 걸린 자리가 없다');
  } else {
    lines.push(...table(['사유', '칸'], s.blocked.map((row) => [row.tag, String(row.cells)]), '      '));
  }
  lines.push(`    통행 ${s.traversableCells} · 막힘 ${s.blockedCells}`);
  lines.push(`    area ${s.areas.length} (areas 순서)`);
  if (s.areas.length > 0) {
    lines.push(...table(['layer', 'tag'], s.areas.map((a) => [a.layer, a.tag]), '      '));
  }
  lines.push(`    point ${s.points.length} (points 순서)`);
  if (s.points.length > 0) {
    lines.push(...table(['layer', 'tag'], s.points.map((p) => [p.layer, p.tag]), '      '));
  }
  lines.push(`    chunk ${s.chunks} (chunkSize ${s.chunkSize}) · instance ${s.instances}`);

  // 검사
  lines.push(rule());
  lines.push('  검사 아홉 (판정하지 않는다 — 수와 목록만 적는다)');
  // 그 layer 에 area 가 몇인지도 함께 적는다 — 0 이면 의미 그림이 통째로 비는데,
  // 그 까닭이 "이 layer 에 놓인 것이 없다" 임이 보고에 없으면 빈 그림이 거짓말을 한다
  const semanticAreas = s.areas.filter((area) => area.layer === semanticLayer).length;
  lines.push(`    의미 그림의 layer 는 ${semanticLayer} · 그 layer 의 area ${semanticAreas}`);
  // 번호 · 이름 · 답을 한 줄에 둔다 — 한 검사가 한 줄이어야 아홉이 한눈에 읽힌다.
  // 딸림 목록(걸린 것들)만 그 아래로 들여쓴다.
  const checks = checkLines();
  const nameWidth = Math.max(...checks.map((line) => displayWidth(line.name)));
  for (const line of checks) {
    lines.push(`    ${line.mark}  ${pad(line.name, nameWidth)}  ${line.answer}`);
    for (const detail of line.detail ?? []) lines.push(`        · ${detail}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── 인자 · 실행 ──────────────────────────────────────────────────────

export interface ObserveOptions {
  pictures: readonly PictureKind[];
  semanticLayer: string;
  report: boolean;
  outDir: string;
  /** 칸 하나를 픽셀 몇으로 그릴 것인가 (기본 1 = 격자와 1:1) */
  scale: number;
}

export interface ObservePicture {
  kind: PictureKind;
  /** `<REGION_ID>.<종류>.png` */
  file: string;
  png: Buffer;
}

/** 방 하나를 본다 — 그림 바이트와 보고 글자를 만들 뿐, 파일은 부르는 쪽이 쓴다 */
export function observeRegion(
  spec: RegionSpec,
  options: ObserveOptions,
): { text: string; pictures: ObservePicture[] } {
  const region = compileRegion(spec.space, COMPILE_RULES);
  const world = region.world;
  const pictures: ObservePicture[] = [];
  // PICTURE_KINDS 순서로 낸다 — 인자를 어떤 차례로 주어도 결과가 같다 (SPEC-006)
  for (const kind of PICTURE_KINDS) {
    if (!options.pictures.includes(kind)) continue;
    const png =
      kind === 'height'
        ? paintHeight(world, options.scale)
        : kind === 'surface'
          ? paintSurface(world, options.scale)
          : kind === 'traversable'
            ? paintTraversable(world, options.scale)
            : kind === 'semantic'
              ? paintSemantic(world, options.semanticLayer, options.scale)
              : paintTopView(world, options.scale);
    pictures.push({ kind, file: `${spec.id}.${kind}.png`, png });
  }
  const text = options.report ? renderRegionReport(spec, region, options.semanticLayer) : '';
  return { text, pictures };
}

/** 인자 해석의 결과 — 셋 중 하나다 */
type Parsed =
  | { kind: 'graph' }
  | { kind: 'region'; spec: RegionSpec; options: ObserveOptions }
  | { kind: 'usage'; unknown: string[] };

/**
 * 인자를 읽는다. 아는 것만 받고, 하나라도 모르면 **아무것도 하지 않는다** (SPEC-007 경계).
 *
 *   (없음) · --graph        그래프 (C004 그대로)
 *   <방> [옵션…]            그 방 하나 — 그림을 하나도 밝히지 않으면 --report 로 본다
 */
export function parseArgs(args: readonly string[]): Parsed {
  const unknown: string[] = [];
  const positional: string[] = [];
  const pictures: PictureKind[] = [];
  let semanticLayer = SETTLEMENT_LAYER;
  let report = false;
  let graph = false;
  let outDir = DEFAULT_OUT_DIR;
  let pictureScale = DEFAULT_SCALE;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--graph') graph = true;
    else if (arg === '--height') pictures.push('height');
    else if (arg === '--surface') pictures.push('surface');
    else if (arg === '--traversable') pictures.push('traversable');
    else if (arg === '--semantic') pictures.push('semantic');
    else if (arg.startsWith('--semantic=')) {
      pictures.push('semantic');
      semanticLayer = arg.slice('--semantic='.length);
      if (semanticLayer === '') unknown.push(arg);
    } else if (arg === '--top-view') pictures.push('top');
    else if (arg === '--report') report = true;
    else if (arg.startsWith('--scale=')) {
      const value = Number(arg.slice('--scale='.length));
      if (!Number.isInteger(value) || value < 1 || value > MAX_SCALE) unknown.push(arg);
      else pictureScale = value;
    } else if (arg === '--scale') {
      const value = Number(args[i + 1]);
      if (!Number.isInteger(value) || value < 1 || value > MAX_SCALE) unknown.push(arg);
      else {
        pictureScale = value;
        i++;
      }
    } else if (arg === '--out') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) unknown.push(arg);
      else {
        outDir = value;
        i++;
      }
    } else if (arg.startsWith('-')) unknown.push(arg);
    else positional.push(arg);
  }

  if (unknown.length > 0) return { kind: 'usage', unknown };
  if (positional.length === 0) {
    // 방을 주지 않았다 — 그래프 말고는 볼 것이 없다. 그림·보고를 밝혔다면 방이 빠진 것이다
    if (pictures.length > 0 || report) return { kind: 'usage', unknown: ['(방 이름이 없다)'] };
    return { kind: 'graph' };
  }
  if (positional.length > 1) return { kind: 'usage', unknown: positional.slice(1) };
  if (graph) return { kind: 'usage', unknown: ['--graph (방과 함께 쓸 수 없다)'] };

  const spec = regionSpec(positional[0]!);
  if (!spec) return { kind: 'usage', unknown: [positional[0]!] };
  // 아무 그림도 밝히지 않고 방만 주면 --report 로 본다 (brief §2.1)
  const wantReport = report || pictures.length === 0;
  return {
    kind: 'region',
    spec,
    options: { pictures, semanticLayer, report: wantReport, outDir, scale: pictureScale },
  };
}

/** 모르는 것을 받았을 때 — 무엇을 아는지 밝히고 아무것도 하지 않는다 (SPEC-007 경계) */
export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' ')}`,
    '  이 도구가 아는 것은 둘이다.',
    '    --graph                       방 · Connector · 중첩 · 경계 · 검사를 표로 읊는다',
    '    <REGION_ID> [옵션…]           그 방 하나의 땅을 본다',
    '        --height --surface --traversable --semantic --top-view   낼 그림 (여럿 가능)',
    `        --semantic=<layer>        의미 그림의 layer (기본 ${SETTLEMENT_LAYER})`,
    '        --report                  수와 검사 아홉을 글자로 읊는다',
    `        --out <dir>               그림을 둘 폴더 (기본 ${DEFAULT_OUT_DIR})`,
    `        --scale <n>               칸 하나를 n×n 픽셀로 (기본 ${DEFAULT_SCALE} · 최대 ${MAX_SCALE})`,
    `  아는 방: ${REGION_SPECS.map((spec) => spec.id).join(' · ')}`,
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다 — catalog/print.ts 선례)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === 'graph') {
    console.log(renderGraph());
  } else if (parsed.kind === 'usage') {
    console.log(renderUsage(parsed.unknown));
  } else {
    const { text, pictures } = observeRegion(parsed.spec, parsed.options);
    // 밝힌 그림 말고는 아무것도 쓰지 않는다 (SPEC-007)
    if (pictures.length > 0) mkdirSync(parsed.options.outDir, { recursive: true });
    const written: string[] = [];
    for (const picture of pictures) {
      const path = join(parsed.options.outDir, picture.file);
      writeFileSync(path, picture.png);
      written.push(`    ${path}  ${picture.png.length} bytes`);
    }
    if (text) console.log(text);
    if (written.length > 0) {
      console.log(`  그림 ${written.length}`);
      console.log(written.join('\n'));
      console.log('');
    }
  }
}
