// World Observe — 세계가 자기 Region 그래프를 읊고, 방 하나의 땅을 그림과 보고로 낸다
// (C004 ADDED · SPEC-008 · SPEC-009 / C007 ADDED · SPEC-001 ~ SPEC-007).
//
//   npm run world:observe            방 표 · Connector 표 · 중첩 · 경계 · 검사 를 이 순서로 출력한다
//   npm run world:observe --graph    같은 것 (인자를 주지 않으면 --graph 로 본다 —
//                                    C004 에서 이 도구가 아는 것이 그것 하나뿐이었기 때문이다)
//   npm run world:observe -- --report
//                                    **세계의 보고** (C021 · SPEC-006) — 검사 서른다섯과
//                                    **방마다의 분포**(기회 자리 · 붙잡는 것 · 흐름과 고립)를
//                                    방 차례로 편다. 두 Region 을 나란히 견주는 자리다.
//                                    C030 이 **열쇠 × 자물쇠 표**를 뒤에 더한다 — Lock 마다
//                                    답의 종류와 그 원천이 선 방을 한 장으로 편다.
//                                    C035 가 그 곁에 **조건 표**를 더한다 — 조건 자리 넷 + 기억
//                                    조건에서 읽힌 Condition 의 잎마다 한 행 (어디에 · target ·
//                                    query · operator value · qualifier · 지금)
//   npm run world:observe -- <방> [--height --surface --traversable --semantic --top-view]
//                            [--semantic=<layer>] [--report] [--out <dir>] [--at <철>]
//                                    그 방 하나를 본다 (C007). 그림을 하나도 밝히지 않으면 --report 로 본다
//   npm run world:observe -- <방> --at <철>
//                                    그 방을 **그 철의 위상으로** 읽는다 (C018). 보고에 그 시각의
//                                    덧씌움 · 그때 열리는 문 · 그때 서는 원천이 는다. 밝히지 않으면
//                                    지금까지의 보고와 한 글자도 다르지 않고, **그림은 한 값도
//                                    달라지지 않는다** — 컴파일러는 시각을 모른다 (spec 기본형 ⑪)
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
  CLOSED_CONNECTORS,
  COMPILE_RULES,
  REGION_GRAPH,
  REGION_SPECS,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  lockOfConnector,
  regionSpec,
  type RegionSpec,
  type SeasonId,
} from '../../content/regions';
import { pointsOf, type Extent } from '../../engine/world-authoring/description';
import {
  accessAnswerMap,
  checkGraph,
  type AccessAnswerCell,
  type AccessAnswerRow,
  type CheckItem,
} from '../../engine/world-authoring/check';
import { compileRegion } from '../../engine/world-authoring/compile';
import {
  conditionLeaves,
  type ConditionLeaf,
  type ConditionValue,
  type ConditionVerdict,
} from '../../engine/world-authoring/condition';
import { createWorld } from '../../content/world';
import {
  worldConditionSites,
  worldConditionVerdict,
} from '../../content/world/semantic/condition';
import type { WorldState } from '../../content/world/semantic/world-state';
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
import {
  runWorldCheck,
  worldCheckInput,
  SEASON_IDS,
  WORLD_CHECK_ACCESS,
  WORLD_CHECK_ECOLOGY,
} from './check';

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
// 판정도 셈도 이 도구의 것이 아니다 — 기반의 `checkRegions` 가 낸 것을 사람이 읽을 줄로 옮길 뿐이다
// (T1 이 아홉을 여기서 engine/world-authoring/check.ts 로 옮겼다). 게임 명사를 건네는 계약은
// 같은 폴더의 `check.ts`(world:check) 가 소유한다 — 보고와 명령이 **같은 하나**를 읊게 하기 위해서다.

/** 검사 한 줄 — 번호 · 이름 · 답. 판정하지 않는다 (좋다/나쁘다를 말하지 않는다) */
interface CheckLine {
  mark: string;
  name: string;
  answer: string;
  /** 답을 뒷받침하는 목록 — 있으면 그 아래 들여쓰기로 적는다 */
  detail?: string[];
}

function checkLinesOf(items: readonly CheckItem[]): CheckLine[] {
  return items.map((item) => ({
    mark: item.mark,
    name: item.name,
    answer: item.answer,
    detail: item.refs.map((ref) => `${ref.where}  ${ref.detail}`),
  }));
}

function checkLines(): CheckLine[] {
  return checkLinesOf(runWorldCheck().items);
}

/**
 * 검사 줄들의 몸 — 번호 · 이름 · 답을 한 줄에 두고 딸림 목록만 그 아래로 들여쓴다.
 *
 * C021 이 보고 둘(방 하나 · 세계)에서 같은 어법을 쓰려고 뽑아 온 것이다 — 글자는
 * C007 이 세운 그대로이므로 방 하나의 보고는 한 글자도 달라지지 않는다.
 */
function checkBody(checks: readonly CheckLine[]): string[] {
  const lines: string[] = [];
  const nameWidth = Math.max(...checks.map((line) => displayWidth(line.name)));
  for (const line of checks) {
    lines.push(`    ${line.mark}  ${pad(line.name, nameWidth)}  ${line.answer}`);
    for (const detail of line.detail ?? []) lines.push(`        · ${detail}`);
  }
  return lines;
}

// ── 그 시각의 위상 (C018 ADDED · SPEC-010) ───────────────────────────
//
// `--at <철>` 을 밝히면 보고에 이 묶음 하나가 는다. **컴파일 결과는 여기에 한 값도 달라지지
// 않는다** — 덧씌움은 컴파일된 땅 *위에* 얹히는 State 이고 컴파일러는 시각을 모른다
// (C016 phases.ts 의 그 규율 · spec 기본형 ⑪). 그래서 그림 다섯도 `--at` 에 달라지지 않는다.
//
// 도구는 여기서도 **판정하지 않는다** — 데이터가 밝힌 것을 그 철로 걸러 적을 뿐이다.

/**
 * 그 철에 이 문이 어떠한가 — 그 문에 걸린 Lock 을 읽는다 (판정이 아니라 옮겨 적기다).
 *
 * C029 CHANGED — 읽는 자리가 활성 표에서 Lock 으로 바뀌었다 (그 방의 access.locks).
 * **보고의 글자는 한 자도 달라지지 않는다** — 같은 사실을 새 자리에서 읽을 뿐이다.
 * 성질 · 아는 것의 요구는 여기에 적지 않는다: 그것은 열림을 판정하지 않으므로 "그 철에 이
 * 문이 어떠한가" 의 답에 들어올 자리가 없다 (spec R1 경계 ①).
 */
function doorAtSeason(connectorId: string, season: SeasonId): string {
  if (isClosed(connectorId)) return '닫힘 (언제나)';
  const lock = lockOfConnector(connectorId);
  if (!lock) return '열림';
  const parts: string[] = [];
  const seasons = lock.requires.find((one) => one.time)?.time?.seasons;
  if (seasons) {
    parts.push(seasons.includes(season) ? '열림' : `닫힘 (${seasons.join(' · ')} 에만)`);
  }
  // 패턴 조건은 방의 지금 State 가 정한다 — 시각으로는 알 수 없으므로 조건만 적는다
  const state = lock.requires.find((one) => one.state)?.state;
  if (state) {
    parts.push(`패턴 조건 (${state.region} ${state.patterns.join(' · ')})`);
  }
  return parts.length === 0 ? '열림' : parts.join(' · ');
}

/** 그 방을 이 철로 읽은 줄들 — 덧씌움 둘 · 문 · 원천 */
function phaseLines(spec: RegionSpec, season: SeasonId): string[] {
  const lines: string[] = [];
  lines.push(rule());
  lines.push(`  위상 — ${season} (그 철의 덧씌움과 조건. 땅과 그림은 이 값에 달라지지 않는다)`);

  const phase = spec.phases?.seasons?.[season];
  const depth = phase?.depthOverlay ?? [];
  const hazard = phase?.hazardExtend ?? [];
  lines.push(`    깊이 덧씌움 ${depth.length} (그 자락만 다르게 읽힌다 · 방은 ${spec.depth} 그대로다)`);
  if (depth.length > 0) {
    lines.push(...table(['area', 'depth'], depth.map((o) => [o.areaId, o.depth]), '      '));
  }
  lines.push(`    위험 덧씌움 ${hazard.length}`);
  if (hazard.length > 0) {
    lines.push(...table(['area', 'hazard'], hazard.map((o) => [o.areaId, o.hazard]), '      '));
  }

  // 이 방에 닿는 문 — connectors 배열 순서 (양 끝 어느 쪽이든 이 방이면 싣는다)
  const doors = REGION_GRAPH.connectors.filter(
    (connector) => connector.from.region === spec.id || connector.to.region === spec.id,
  );
  lines.push(`    문 ${doors.length} (connectors 순서 · 이 방에 닿는 것만)`);
  if (doors.length > 0) {
    lines.push(
      ...table(
        ['id', 'from → to', '그 철'],
        doors.map((connector) => [
          connector.id,
          `${connector.from.region} → ${connector.to.region}`,
          doorAtSeason(connector.id, season),
        ]),
        '      ',
      ),
    );
  }

  // 이 방의 원천 — 출현 조건을 밝힌 것만 철을 탄다 (밝히지 않으면 언제나 선다)
  const sources = spec.resourceEcology?.sources ?? [];
  lines.push(`    원천 ${sources.length} (sources 순서)`);
  if (sources.length > 0) {
    lines.push(
      ...table(
        ['id', '그 철'],
        sources.map((source) => [
          source.id,
          source.occurrence
            ? source.occurrence.seasons.includes(season)
              ? '선다'
              : `서지 않는다 (${source.occurrence.seasons.join(' · ')} 에만)`
            : '선다 (철을 가리지 않는다)',
        ]),
        '      ',
      ),
    );
  }
  return lines;
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
  /** 밝히면 그 철의 위상 묶음이 하나 는다 (C018). 밝히지 않으면 C014 까지의 보고와 한 글자도 같다 */
  season?: SeasonId,
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

  // 위상 — 밝힌 때만 (SPEC-010 경계 ①)
  if (season !== undefined) lines.push(...phaseLines(spec, season));

  // 검사
  lines.push(rule());
  lines.push('  검사 아홉 (판정하지 않는다 — 수와 목록만 적는다)');
  // 그 layer 에 area 가 몇인지도 함께 적는다 — 0 이면 의미 그림이 통째로 비는데,
  // 그 까닭이 "이 layer 에 놓인 것이 없다" 임이 보고에 없으면 빈 그림이 거짓말을 한다
  const semanticAreas = s.areas.filter((area) => area.layer === semanticLayer).length;
  lines.push(`    의미 그림의 layer 는 ${semanticLayer} · 그 layer 의 area ${semanticAreas}`);
  // 번호 · 이름 · 답을 한 줄에 둔다 — 한 검사가 한 줄이어야 아홉이 한눈에 읽힌다.
  // 딸림 목록(걸린 것들)만 그 아래로 들여쓴다.
  lines.push(...checkBody(checkLines()));
  lines.push('');
  return lines.join('\n');
}

// ── 방마다의 분포 (C021 ADDED · SPEC-006) ────────────────────────────
//
// 두 Region 을 **나란히 견주는** 절이다 — 협곡 둘을 백왕령 옆에 두고 읽을 수 있어야
// 계통이 무엇으로 갈리는지 사람이 본다.
//
// **새로 세는 것도 판정하는 것도 없다.** 검사 ⑲ ⑳ 이 이미 낸 refs 를 방으로 다시 묶고,
// ⑱ ㉒ 는 성한 세계에서 refs 가 비므로(끊긴 참조와 이유 없는 고립만 싣는다) 그 둘이 읽는
// 그 계약(WORLD_CHECK_ECOLOGY 의 flows · regions)을 같은 자리에서 읽는다.
//
// 차례는 REGION_SPECS 순서다 — Record 의 열쇠 순회에 기대지 않는다 (두 번 돌리면 같다).
// **원천이 없는 방도 적는다** — "원천 0" 도 사실이고, 그것이 백왕령과 협곡을 견주게 한다.

/** 검사 ⑲ 의 ref detail 은 `<원천 id> <자리 유형>` 이다 — 마지막 칸이 그 자리 유형이다 */
function opportunityOf(detail: string): string {
  const at = detail.lastIndexOf(' ');
  return at < 0 ? detail : detail.slice(at + 1);
}

/** 값마다의 수를 처음 나온 차례로 — 기반의 tally · renderTally 와 같은 어법이다 */
function renderCounts(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const parts: string[] = [];
  for (const [key, count] of counts) parts.push(`${key} ${count}`);
  return parts.join(' · ');
}

/** 그 번호의 검사가 낸 refs — 없는 검사(absent 이거나 아직 없는 것)면 빈 목록이다 */
function refsOf(items: readonly CheckItem[], id: string): readonly CheckRefLike[] {
  return items.find((item) => item.id === id)?.refs ?? [];
}

/** refsOf 가 돌려주는 것 — 기반의 CheckRef 와 같은 모양이되 이 파일이 읽는 두 칸만 본다 */
interface CheckRefLike {
  where: string;
  detail: string;
}

/** 방마다의 절 — 방 하나가 세 줄이고, 딸림 목록만 그 아래로 들여쓴다 */
function roomLines(items: readonly CheckItem[]): string[] {
  const opportunity = refsOf(items, 'ecology-opportunity');
  const carrier = refsOf(items, 'ecology-carrier');
  const { flows, regions } = WORLD_CHECK_ECOLOGY;

  const labels = ['기회 자리 분포', '붙잡는 것 분포', '흐름과 고립'] as const;
  const labelWidth = Math.max(...labels.map(displayWidth));

  const lines: string[] = [];
  lines.push(rule());
  lines.push(
    `  방마다 ${REGION_SPECS.length} (REGION_SPECS 순서 · 검사 ⑱ ⑲ ⑳ ㉒ 가 낸 것을 방으로 다시 묶는다)`,
  );
  for (const spec of REGION_SPECS) {
    const row = (label: string, value: string): string => `      ${pad(label, labelWidth)}  ${value}`;
    lines.push(`    ${spec.id}`);

    // ⑲ — 그 방 원천들의 자리 유형별 수. 하나도 없으면 "원천 0" 이 그 방의 사실이다
    const mine = opportunity.filter((ref) => ref.where === spec.id);
    lines.push(
      row(labels[0], mine.length === 0 ? '원천 0' : renderCounts(mine.map((ref) => opportunityOf(ref.detail)))),
    );

    // ⑳ — 이미 방마다로 적힌 줄이므로 그대로 옮긴다 (원천 수까지 그 검사가 적는다)
    const carrierRef = carrier.find((ref) => ref.where === spec.id);
    lines.push(row(labels[1], carrierRef?.detail ?? '원천 0'));

    // ⑱ ㉒ — 드는 것 · 나가는 것 · 고립의 이유. 흐름의 차례는 RESOURCE_FLOWS 배열 순서다
    const inflow = flows.filter((flow) => flow.to.region === spec.id);
    const outflow = flows.filter((flow) => flow.from.region === spec.id);
    const reason = regions.find((region) => region.id === spec.id)?.isolationReason ?? '';
    lines.push(row(labels[2], `유입 ${inflow.length} · 유출 ${outflow.length}`));
    for (const flow of inflow) {
      lines.push(`        · 유입 ${flow.id}  ${flow.from.region} → 이 방  (${flow.connector})`);
    }
    for (const flow of outflow) {
      lines.push(`        · 유출 ${flow.id}  이 방 → ${flow.to.region}  (${flow.connector})`);
    }
    if (reason.trim() !== '') lines.push(`        · 고립 이유  ${reason}`);
  }
  return lines;
}

// ── 열쇠 × 자물쇠 (C030 ADDED · SPEC-006) ────────────────────────────
//
// Lock 마다 **답의 종류와 그 원천이 선 방**을 한 장으로 편다. 검사 ㉟ ㊴ ㊵ 이 이미 세는
// 것이고, 그것을 사람이 읽는 행과 열로 놓는 것이 이 절의 전부다.
//
// **도구가 하는 일은 글자를 놓는 것뿐이다** — 판정하지 않고(status 도 pass/fail 도 없다)
// 답을 스스로 고르지도 않는다: 답을 고르는 자리는 기반의 `accessAnswerMap` 하나이고 검사
// 아홉도 같은 자리를 부른다 (spec R4 경계 ① · 같은 답을 도구가 둘로 세면 보고가 거짓말을
// 한다). 검사와 **같은 입력**(worldCheckInput)을 받으므로 두 절의 답이 갈릴 자리가 없다.
//
// 차례는 전부 데이터의 배열 순서다 (locks · answerKinds · seeds · seedSources) —
// 두 번 돌리면 글자까지 같다 (경계 ②). 세계를 바꾸지 않는 읽기 전용이다.

/**
 * 그 답 하나를 글자로 — `재료 (성질 @ 그 원천이 선 방들)`.
 *
 * C031 CHANGED — 성질이 **빈 글자**로 오는 답이 생겼다 (무르게 하는 것은 성질로 답하지 않는다 ·
 * 기반의 LockAnswer.property 주석). 그때는 성질 자리를 지운다 — 빈 자리를 괄호 안에 남기면
 * 표가 없는 것을 있는 척한다. 어느 답이 그런지는 이 도구가 알지 못한다: 온 글자를 볼 뿐이다.
 */
function answerText(answer: { id: string; property: string; regions: readonly string[] }): string {
  const where = answer.regions.length === 0 ? '원천 없음' : answer.regions.join(' · ');
  const what = answer.property === '' ? '' : `${answer.property} `;
  return `${answer.id} (${what}@ ${where})`;
}

/** 열쇠 × 자물쇠 표 — Lock 하나가 한 행, 답의 종류가 열, 칸은 그 종류의 답의 수다 */
function answerMapLines(): string[] {
  const rows = accessAnswerMap(worldCheckInput());
  const kinds = WORLD_CHECK_ACCESS.answerKinds;
  const lines: string[] = [];
  lines.push(rule());
  lines.push(
    `  열쇠 × 자물쇠 ${rows.length} (locks 순서 · 검사 ㉟ ㊴ ㊵ 이 세는 것을 행과 열로 놓는다)`,
  );
  if (rows.length === 0) {
    lines.push('    묻는 것이 하나도 없다');
    return lines;
  }
  const cellOf = (row: AccessAnswerRow, kind: string): AccessAnswerCell | undefined =>
    row.cells.find((one) => one.kind === kind);
  // 칸에는 **수**만 둔다 — 이름을 칸에 넣으면 한 답이 길어질 때 표의 다른 행까지 넓어져
  // 행과 열이 읽히지 않는다. 답이 된 것의 이름과 그 원천의 방은 그 행 아래로 들여쓴다
  // (방마다의 분포 절이 딸림 목록을 그렇게 다는 그 어법 그대로).
  lines.push(
    ...table(
      ['Lock', '방', '중요', '묻는 것', ...kinds],
      rows.map((row) => [
        row.lock,
        row.region,
        row.important ? '중요' : '·',
        row.requirements.length === 0 ? '·' : row.requirements.join(' · '),
        ...kinds.map((kind) => String(cellOf(row, kind)?.answers.length ?? 0)),
      ]),
      '    ',
    ),
  );
  // 딸림 목록 — Lock 차례 · answerKinds 차례 · 그 종류의 답 차례다. 답이 하나도 없는
  // Lock 은 줄이 나지 않는다 (표의 0 이 이미 그 사실이다).
  for (const row of rows) {
    for (const kind of kinds) {
      for (const answer of cellOf(row, kind)?.answers ?? []) {
        lines.push(`        · ${row.lock}  ${kind}  ${answerText(answer)}`);
      }
    }
  }
  return lines;
}

// ── 조건 표 (C035 · Observable Result 4 · 기본형 ⑤) ─────────────────
//
// 조건 자리 넷(문의 요구 · 원천의 때 · 방의 철 위상 · 결속의 요구)과 기억 조건이 **한 형**으로
// 읽힌 것을 잎마다 한 행으로 편다. 행의 출처는 worldConditionSites() 하나다 — 이 도구는 조건을
// 하나도 스스로 짓지 않고, 검사 ㊹ 이 세는 그 잎을 그 차례로 놓는다.
//
// "지금" 열은 판정이 아니라 **평가기가 낸 것을 옮긴 것**이다 (도구는 판정하지 않는다). 그 값은
// **갓 선 세계**(createWorld() · t=0 · 아무것도 지나지 않았고 아무도 들지 않은)의 것이다 —
// 방 하나의 보고가 받는 `--at <철>` 은 이 표에 닿지 않는다: 조건 표는 보고에만 서고(기본형 ⑤)
// 세계의 보고는 시각을 받지 않는다. 그래서 두 번 돌리면 글자까지 같다.

/** Target · Query 를 한 칸으로 — `clock` · `region FOREST_EDGE` · `history passages.R1` 식 */
function conditionTargetText(leaf: ConditionLeaf): string {
  return leaf.target.ref === undefined ? leaf.target.kind : `${leaf.target.kind} ${leaf.target.ref}`;
}

function conditionQueryText(leaf: ConditionLeaf): string {
  return leaf.query.path === undefined ? leaf.query.kind : `${leaf.query.kind} ${leaf.query.path}`;
}

/** 값 — 목록은 `[a · b]`, 스칼라는 글자 그대로. 값이 없는 operator(EXISTS 류)는 operator 만 */
function conditionValueText(value: ConditionValue | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(String).join(' · ')}]`;
  return String(value);
}

function conditionOperatorText(leaf: ConditionLeaf): string {
  const value = conditionValueText(leaf.value);
  return value === '' ? leaf.operator : `${leaf.operator} ${value}`;
}

/** qualifier — `WITHIN 240` · `BECAME` · 없으면 `·` */
function conditionQualifierText(leaf: ConditionLeaf): string {
  const qualifier = leaf.qualifier;
  if (qualifier === undefined) return '·';
  return qualifier.kind === 'time' ? `${qualifier.mode} ${qualifier.seconds}` : qualifier.mode;
}

/** 판정 셋을 글자로 — 판정 불가는 거짓이 아니다 (engine condition 의 지키는 것 ②) */
function conditionVerdictText(verdict: ConditionVerdict): string {
  return verdict === 'met' ? '참' : verdict === 'unmet' ? '거짓' : '판정 불가';
}

/** 조건 표 — 잎 하나가 한 행. 자리(where) 차례 · 그 조건에 적힌 잎 차례 */
function conditionTableLines(): string[] {
  const sites = worldConditionSites();
  const rows: string[][] = [];
  if (sites.length > 0) {
    const state = createWorld().snapshot().state as WorldState;
    for (const site of sites) {
      for (const leaf of conditionLeaves(site.condition)) {
        rows.push([
          site.where,
          conditionTargetText(leaf),
          conditionQueryText(leaf),
          conditionOperatorText(leaf),
          conditionQualifierText(leaf),
          conditionVerdictText(worldConditionVerdict(state, leaf)),
        ]);
      }
    }
  }
  const lines: string[] = [];
  lines.push(rule());
  lines.push(
    `  조건 ${rows.length} (조건 자리 순 · 검사 ㊹ 이 세는 잎을 행으로 놓는다 · 지금 은 갓 선 세계의 것)`,
  );
  if (rows.length === 0) {
    lines.push('    조건이 하나도 없다');
    return lines;
  }
  lines.push(
    ...table(['어디에', 'target', 'query', 'operator value', 'qualifier', '지금'], rows, '    '),
  );
  return lines;
}

/**
 * 세계의 보고 한 장 (C021 ADDED · SPEC-006 / C030 · C035 CHANGED) — 검사 서른다섯 ·
 * 방마다의 분포 · 열쇠 × 자물쇠 · 조건 표.
 *
 * 방 하나의 보고(`renderRegionReport`)와 달리 땅을 컴파일하지 않는다 — 여기서 읽는 것은
 * 계통과 검사가 이미 낸 것뿐이다. **읽기 전용**이고 파일을 하나도 쓰지 않는다 (경계 ①).
 */
export function renderWorldReport(): string {
  const report = runWorldCheck();
  const checks = checkLinesOf(report.items);
  const lines: string[] = [];
  lines.push('');
  lines.push('  World Observe — 이 세계의 보고 (검사와 방마다의 분포 · 읽기 전용)');
  lines.push(rule());
  lines.push(`  검사 ${checks.length} (판정하지 않는다 — 수와 목록만 적는다)`);
  lines.push(...checkBody(checks));
  lines.push(...roomLines(report.items));
  lines.push(...answerMapLines());
  lines.push(...conditionTableLines());
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
  /** `--at <철>` — 밝히면 보고에 그 철의 위상이 는다. **그림은 달라지지 않는다** (C018) */
  season?: SeasonId;
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
  // 그림은 `options.season` 을 읽지 않는다 — 컴파일 결과가 시각을 모르므로 얹을 것이 없다
  const text = options.report
    ? renderRegionReport(spec, region, options.semanticLayer, options.season)
    : '';
  return { text, pictures };
}

/** 인자 해석의 결과 — 셋 중 하나다 */
type Parsed =
  | { kind: 'graph' }
  | { kind: 'world' }
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
  let season: SeasonId | undefined;

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
    } else if (arg === '--at') {
      // 모르는 철은 조용히 지금으로 읽지 않는다 — 무엇이 없는지 밝히고 멈춘다 (SPEC-010 경계 ②).
      // 철의 어휘는 world:check 이 소유한다 (SEASON_IDS) — 도구 둘이 따로 들지 않는다
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) unknown.push(arg);
      else if (!SEASON_IDS.includes(value as SeasonId)) {
        unknown.push(`--at ${value}`);
        i++;
      } else {
        season = value as SeasonId;
        i++;
      }
    } else if (arg.startsWith('-')) unknown.push(arg);
    else positional.push(arg);
  }

  if (unknown.length > 0) return { kind: 'usage', unknown };
  if (positional.length === 0) {
    // 방을 주지 않았다 — 그림은 방이 있어야 한다 (그 자리는 C007 그대로다)
    if (pictures.length > 0) return { kind: 'usage', unknown: ['(방 이름이 없다)'] };
    // `--report` 하나면 **세계의 보고**다 (C021 SPEC-006) — 검사 서른다섯과 방마다의 분포.
    // 방과 함께 쓰는 것들(--graph · --at)과는 섞이지 않는다: 무엇을 볼지가 갈리기 때문이다
    if (report) {
      if (graph) return { kind: 'usage', unknown: ['--report (--graph 와 함께 쓸 수 없다)'] };
      if (season !== undefined) return { kind: 'usage', unknown: [`--at ${season} (방과 함께 쓴다)`] };
      return { kind: 'world' };
    }
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
    options: { pictures, semanticLayer, report: wantReport, outDir, scale: pictureScale, season },
  };
}

/** 모르는 것을 받았을 때 — 무엇을 아는지 밝히고 아무것도 하지 않는다 (SPEC-007 경계) */
export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' ')}`,
    '  이 도구가 아는 것은 셋이다.',
    '    --graph                       방 · Connector · 중첩 · 경계 · 검사를 표로 읊는다',
    '    --report                      세계의 보고 — 검사와 방마다의 분포를 읊는다 (방 없이)',
    '    <REGION_ID> [옵션…]           그 방 하나의 땅을 본다',
    '        --height --surface --traversable --semantic --top-view   낼 그림 (여럿 가능)',
    `        --semantic=<layer>        의미 그림의 layer (기본 ${SETTLEMENT_LAYER})`,
    '        --report                  수와 검사 아홉을 글자로 읊는다',
    `        --out <dir>               그림을 둘 폴더 (기본 ${DEFAULT_OUT_DIR})`,
    `        --scale <n>               칸 하나를 n×n 픽셀로 (기본 ${DEFAULT_SCALE} · 최대 ${MAX_SCALE})`,
    '        --at <철>                 그 철의 위상으로 보고를 읽는다 (그림은 달라지지 않는다)',
    `  아는 방: ${REGION_SPECS.map((spec) => spec.id).join(' · ')}`,
    `  아는 철: ${SEASON_IDS.join(' · ')}`,
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다 — catalog/print.ts 선례)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === 'graph') {
    console.log(renderGraph());
  } else if (parsed.kind === 'world') {
    console.log(renderWorldReport());
  } else if (parsed.kind === 'usage') {
    // 아무것도 하지 않았으므로 성공으로 끝내지 않는다 — world:check 의 어법 그대로 2 다
    // (SPEC-010 경계 ② "모르는 철 이름은 조용히 지금으로 읽지 않는다")
    console.log(renderUsage(parsed.unknown));
    process.exitCode = 2;
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
