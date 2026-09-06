// C007 — 도구가 방 하나를 본다 (spec SPEC-001 · 002 · 004 · 005 · 006 · 007 · 008 + 회귀)
//
// 도구를 **밖에서** 돌린다 — `npx tsx tools/world-editor/observe.ts …` 를 자식 프로세스로
// 띄우고 그 글자와 그 파일만 본다. 그래야 "두 번 돌리면 같다"(SPEC-006)와 "관찰은 세계를
// 바꾸지 않는다"(SPEC-007)를 실제로 잴 수 있다 (tools/world-editor/tests/observe.spec.ts 는
// 함수로 재는 선례이고, 이 파일은 명령 표면으로 재는 짝이다).
//
// 기대값은 도구가 아니라 **컴파일 결과**에서 온다 — 수도 색인도 여기서 다시 세지 않고
// engine 의 확정 기구(rasterHeight · rasterSurface · rasterTraversable · rasterSemantic ·
// summarize)와 checkGraph 가 준 것을 그대로 견준다. 도구가 스스로 정하는 수는 하나도 없다는 것이
// 이 검사의 내용이다 (C004 observe.spec.ts 와 같은 규율).
//
// PNG 는 이 파일이 직접 푼다 (node:zlib) — 도구의 인코더를 부르지 않는다. 그림을 "밖에서" 읽어야
// 격자와 픽셀이 1:1 인지 재는 뜻이 있다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { checkGraph } from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { descriptionHash } from '../../../engine/world-authoring/description';
import {
  rasterHeight,
  rasterSemantic,
  rasterSurface,
  rasterTraversable,
  summarize,
} from '../../../engine/world-authoring/observe';
import {
  ANCHOR_LAYER,
  COMPILE_RULES,
  REGION_GRAPH,
  REGION_SPECS,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  regionSpec,
} from '../../../content/regions';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBSERVE = 'tools/world-editor/observe.ts';
const COMPILE = 'tools/world-editor/compile.ts';
const SHOT = 'tools/world-editor/shot.ts';
/**
 * 그림을 둘 자리 — 이 파일이 만들고 이 파일이 지운다 (저장소에 남기지 않는다).
 * 프로세스마다 다른 이름을 쓴다 — 같은 저장소에서 검증이 겹쳐 돌아도 서로의 그림을 지우지 않는다.
 */
const OUT = `tools/world-editor/tests/out-c007-${process.pid}`;

interface Run {
  status: number | null;
  out: string;
}

/** 도구를 자식 프로세스로 돌린다 — stdout 과 stderr 를 함께 본다 */
function run(script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): Run {
  const result = spawnSync('npx', ['tsx', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const outDir = (name: string) => {
  const dir = join(ROOT, OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
};

afterAll(() => {
  rmSync(join(ROOT, OUT), { recursive: true, force: true });
});

// ── PNG 를 밖에서 푼다 ────────────────────────────────────────
//
// 8bit 의 회색(0) · RGB(2) · 팔레트(3) 를 읽는다. 도구가 무슨 색을 골랐는지는 묻지 않는다 —
// 묻는 것은 "같은 값이면 같은 색인가 · 다른 값이면 다른 색인가 · 크기가 격자인가" 뿐이다.
interface Png {
  width: number;
  height: number;
  /** 픽셀마다 (r, g, b) 셋 */
  rgb: Uint8Array;
}

function decodePng(bytes: Buffer): Png {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) throw new Error('PNG 서명이 아니다');
  }
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  const idat: Buffer[] = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('ascii', at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    at += 12 + length;
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colorType = body[9]!;
      if (body[12] !== 0) throw new Error('interlace 는 다루지 않는다');
    } else if (type === 'PLTE') palette = new Uint8Array(body);
    else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
  }
  if (depth !== 8) throw new Error(`8bit 만 다룬다 — depth ${depth}`);
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`모르는 colorType ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const flat = new Uint8Array(height * stride);
  // scanline 필터 되돌리기 (PNG 명세 9.2)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? flat[y * stride + i - channels]! : 0;
      const b = y > 0 ? flat[(y - 1) * stride + i]! : 0;
      const c = i >= channels && y > 0 ? flat[(y - 1) * stride + i - channels]! : 0;
      let value = line[i]!;
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`모르는 filter ${filter}`);
      flat[y * stride + i] = value & 0xff;
    }
  }
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 0) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = flat[i]!;
    else if (colorType === 2) {
      rgb[i * 3] = flat[i * 3]!;
      rgb[i * 3 + 1] = flat[i * 3 + 1]!;
      rgb[i * 3 + 2] = flat[i * 3 + 2]!;
    } else if (colorType === 3) {
      const p = flat[i]! * 3;
      rgb[i * 3] = palette![p]!;
      rgb[i * 3 + 1] = palette![p + 1]!;
      rgb[i * 3 + 2] = palette![p + 2]!;
    } else {
      rgb[i * 3] = flat[i * 4]!;
      rgb[i * 3 + 1] = flat[i * 4 + 1]!;
      rgb[i * 3 + 2] = flat[i * 4 + 2]!;
    }
  }
  return { width, height, rgb };
}

const readPng = (dir: string, region: string, kind: string): Png =>
  decodePng(readFileSync(join(dir, `${region}.${kind}.png`)));
const colorAt = (png: Png, i: number) => `${png.rgb[i * 3]},${png.rgb[i * 3 + 1]},${png.rgb[i * 3 + 2]}`;

/**
 * 그림의 픽셀 줄과 격자의 z 줄이 어떻게 맞물리는가.
 *
 * spec 은 **1:1** 이라고만 말하고 어느 줄이 먼저인지는 말하지 않는다 (위에서 본 그림은 +z 를
 * 위로 두는 것이 자연스럽다). 그래서 방향은 높이 그림에서 한 번 **읽고**, 나머지 넉 장이
 * 그와 같은 방향인지를 잰다 — 다섯 장의 방향이 어긋나면 그림들끼리 겹쳐 볼 수 없다.
 * 어느 쪽이든 격자 하나가 픽셀 하나라는 주장은 그대로 강제된다.
 */
type RowOrder = 'same' | 'flipped';

/** 격자 색인 → 픽셀 색인 */
const pixelOf = (order: RowOrder, i: number, cols: number, rows: number): number =>
  order === 'same' ? i : (rows - 1 - Math.floor(i / cols)) * cols + (i % cols);

/** 높이 그림(회색 눈금)에서 방향을 읽는다 — 값이 곧 밝기이므로 어긋남 없이 정해진다 */
function readRowOrder(png: Png, values: Uint8Array, cols: number, rows: number): RowOrder {
  const fits = (order: RowOrder) => {
    for (let i = 0; i < cols * rows; i++) {
      const at = pixelOf(order, i, cols, rows);
      const r = png.rgb[at * 3]!;
      if (r !== png.rgb[at * 3 + 1] || r !== png.rgb[at * 3 + 2] || r !== values[i]) return false;
    }
    return true;
  };
  if (fits('same')) return 'same';
  if (fits('flipped')) return 'flipped';
  throw new Error('높이 그림의 밝기가 높이 판과 1:1 이 아니다 (줄 순서를 뒤집어도 맞지 않는다)');
}

// ── 컴파일 결과 — 기대값의 유일한 출처 ────────────────────────
const spaceOf = (id: string) => regionSpec(id)!.space;
const compiledMemo = new Map<string, ReturnType<typeof compileRegion>>();
const compiled = (id: string) => {
  const hit = compiledMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES);
  compiledMemo.set(id, made);
  return made;
};

const DOMAIN = START_REGION_ID;
const KINDS = ['height', 'surface', 'traversable', 'semantic', 'top'] as const;
const ALL_PICTURES = ['--height', '--surface', '--traversable', '--semantic', '--top-view'];

/** 막힌 칸이 하나도 없는 방 하나 — 데이터에서 고른다 (이름을 적지 않는다) */
// C011 CHANGED — "아무것도 없는 방" 의 조건에 **area 도 없을 것**을 더했다. 이 Cycle 이
// 방 다섯에 흔적(trace area)을 깔았으므로 "막힌 칸이 없다" 만으로는 더 이상 빈 방이 아니다.
// 경계가 묻는 것은 그대로다 — 셀 것이 하나도 없는 방의 보고도 나오는가.
const openRoom = () => {
  const found = REGION_SPECS.find(
    (s) =>
      [...compiled(s.id).world.traversable].every((v) => v === 1) &&
      compiled(s.id).world.areas.length === 0,
  );
  if (!found) throw new Error('막힌 칸도 area 도 없는 방이 하나도 없다 — SPEC-002 경계를 놓을 자리가 없다');
  return found.id;
};

/** 그 글자들을 모두 담은 줄 (없으면 undefined) */
const lineWith = (text: string, ...needles: (string | RegExp)[]) =>
  text.split('\n').find((line) =>
    needles.every((n) => (typeof n === 'string' ? line.includes(n) : n.test(line))),
  );
/** 그 줄에 이 수가 **낱말로** 적혀 있는가 (1681 이 16810 에 걸리지 않게) */
const word = (value: number | string) => new RegExp(`(^|[^\\w.-])${value}([^\\w.-]|$)`);

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 — 땅이 그림 다섯 장이 된다', () => {
  const dir = outDir('five');
  const result = run(OBSERVE, [DOMAIN, ...ALL_PICTURES, '--out', dir]);

  it('S-015 밝힌 다섯 장이 <방>.<종류>.png 로 나온다 — 크기는 그 방의 격자다', () => {
    // Given 백왕령을 넷과 위에서 본 한 장으로 낸다
    expect({ status: result.status, out: result.out.slice(0, 400) }).toMatchObject({ status: 0 });
    const world = compiled(DOMAIN).world;
    // Then 다섯 장이 그 이름으로 있다
    expect([...readdirSync(dir)].sort()).toEqual(KINDS.map((k) => `${DOMAIN}.${k}.png`).sort());
    // 그리고 크기가 격자 그대로다 — vertex 하나가 픽셀 하나다 (41×41 vertex → 41×41 픽셀)
    for (const kind of KINDS) {
      const png = readPng(dir, DOMAIN, kind);
      expect({ kind, w: png.width, h: png.height }).toEqual({ kind, w: world.cols, h: world.rows });
    }
    // 이 방의 격자가 실제로 41×41 이다 (spec 이 든 예 — 도구가 해상도를 정하지 않는다)
    expect({ cols: world.cols, rows: world.rows }).toEqual({ cols: 41, rows: 41 });
  });

  it('S-016 밝힌 것만 낸다 — 한 장만 밝히면 한 장이다', () => {
    const one = outDir('one');
    const only = run(OBSERVE, [DOMAIN, '--height', '--out', one]);
    expect(only.status).toBe(0);
    expect(readdirSync(one)).toEqual([`${DOMAIN}.height.png`]);
  });

  it('S-017 (경계) 무엇도 밝히지 않으면 아무 그림도 쓰지 않는다 — 지금처럼 --graph 를 읊는다', () => {
    const empty = outDir('graph');
    const graph = run(OBSERVE, ['--out', empty]);
    expect(graph.status).toBe(0);
    // Then 파일이 하나도 없다
    expect(readdirSync(empty)).toEqual([]);
    // 그리고 C004 의 그 표다 — 묶음이 그 순서로 실린다
    let cursor = -1;
    for (const head of ['  방 ', '  Connector ', '  중첩 ', '  경계 ', '  검사 (']) {
      const at = graph.out.indexOf(head);
      expect({ head, found: at > cursor }).toEqual({ head, found: true });
      cursor = at;
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-002 — 그림이 컴파일 결과 그대로다', () => {
  const dir = outDir('raster');
  run(OBSERVE, [DOMAIN, ...ALL_PICTURES, '--out', dir]);
  const world = compiled(DOMAIN).world;
  const cols = world.cols;
  const rows = world.rows;
  const cells = cols * rows;
  /** 다섯 장이 함께 쓰는 방향 — 높이 그림에서 한 번 읽는다 */
  const order = () => readRowOrder(readPng(dir, DOMAIN, 'height'), rasterHeight(world).values, cols, rows);

  it('S-018 높이 그림의 밝기가 그 격자의 height 를 편 값이다 — 회색 눈금이다', () => {
    // Given 기구가 낸 눈금 판 (최소~최대를 0..255 로 편 값)
    const raster = rasterHeight(world);
    const png = readPng(dir, DOMAIN, 'height');
    const at = order();
    // Then 픽셀마다 그 값이고 회색이다 (r = g = b) — 어긋난 칸이 하나도 없다
    const wrong: unknown[] = [];
    for (let i = 0; i < cells; i++) {
      const p = pixelOf(at, i, cols, rows);
      const r = png.rgb[p * 3]!;
      const g = png.rgb[p * 3 + 1]!;
      const b = png.rgb[p * 3 + 2]!;
      if (r !== g || g !== b || r !== raster.values[i]) wrong.push({ i, rgb: [r, g, b], want: raster.values[i] });
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    // 눈금이 실제로 펴져 있다 — 이 방은 평평하지 않으므로 가장 어두운 칸과 가장 밝은 칸이 끝을 잡는다
    expect(raster.range!.max).toBeGreaterThan(raster.range!.min);
    expect(Math.min(...raster.values)).toBe(0);
    expect(Math.max(...raster.values)).toBe(255);
  });

  it('S-019 표면·의미 그림의 색이 그 칸의 태그 색인과 1:1 이다', () => {
    const at = order();
    for (const [kind, raster] of [
      ['surface', rasterSurface(world)],
      ['semantic', rasterSemantic(world, SETTLEMENT_LAYER)],
    ] as const) {
      const png = readPng(dir, DOMAIN, kind);
      // Given 색인마다 그림이 쓴 색
      const colorOf = new Map<number, string>();
      const wrong: unknown[] = [];
      for (let i = 0; i < cells; i++) {
        const index = raster.values[i]!;
        const color = colorAt(png, pixelOf(at, i, cols, rows));
        const seen = colorOf.get(index);
        if (seen === undefined) colorOf.set(index, color);
        else if (seen !== color) wrong.push({ kind, i, index, seen, color });
      }
      // Then 같은 색인은 언제나 같은 색이다 (그림 다섯이 같은 방향이라는 것도 여기서 함께 잰다)
      expect(wrong.slice(0, 5)).toEqual([]);
      // 그리고 다른 색인은 다른 색이다 — 색이 색인을 뭉개지 않는다
      expect({ kind, indices: colorOf.size, colors: new Set(colorOf.values()).size }).toEqual({
        kind,
        indices: colorOf.size,
        colors: colorOf.size,
      });
      // 이 방에서는 실제로 여러 색인이 쓰인다 (검사가 헛돌지 않는다)
      expect({ kind, used: colorOf.size > 1 }).toEqual({ kind, used: true });
    }
  });

  it('S-020 통행 그림은 막힘을 사유별로 가른다 — 통행 칸과 사유마다 색이 다르다', () => {
    const raster = rasterTraversable(world);
    const png = readPng(dir, DOMAIN, 'traversable');
    const at = order();
    const colorOf = new Map<number, string>();
    const wrong: unknown[] = [];
    for (let i = 0; i < cells; i++) {
      const index = raster.values[i]!;
      const color = colorAt(png, pixelOf(at, i, cols, rows));
      const seen = colorOf.get(index);
      if (seen === undefined) colorOf.set(index, color);
      else if (seen !== color) wrong.push({ i, index, seen, color });
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    // 통행(0) 과 사유 둘이 서로 다른 색이다
    expect(new Set(colorOf.values()).size).toBe(colorOf.size);
    expect(colorOf.size).toBeGreaterThan(2); // 통행 + 급경사 + 물
    expect(colorOf.has(0)).toBe(true);
  });

  it('S-021 (경계) 막힌 칸이 하나도 없는 방의 통행 그림은 한 색이다', () => {
    // Given 데이터가 없어 아무것도 막지 않는 방 (이름을 적지 않고 컴파일 결과에서 고른다)
    const room = openRoom();
    const flat = outDir('open');
    expect(run(OBSERVE, [room, '--traversable', '--out', flat]).status).toBe(0);
    // Then 그림에 색이 하나뿐이다
    const png = readPng(flat, room, 'traversable');
    const colors = new Set<string>();
    for (let i = 0; i < png.width * png.height; i++) colors.add(colorAt(png, i));
    expect([...colors].length).toBe(1);
  });

  it('S-022 위에서 본 한 장은 표면 위에 표식을 얹은 그림이다 — 같은 격자 · 같은 방향', () => {
    const at = order();
    const surface = rasterSurface(world);
    const top = readPng(dir, DOMAIN, 'top');
    // Given 크기가 격자 그대로다 (얹은 것 때문에 해상도를 키우지 않았다)
    expect({ w: top.width, h: top.height }).toEqual({ w: cols, h: rows });

    // Then 그림의 바탕은 여전히 표면이 설명한다 — 표면 색인마다 가장 흔한 색이 그 색인의 바탕이고,
    // 대부분의 칸이 자기 색인의 바탕색이다 (색 표 자체는 도구의 것이므로 값을 묻지 않는다)
    const byIndex = new Map<number, Map<string, number>>();
    for (let i = 0; i < cells; i++) {
      const index = surface.values[i]!;
      const color = colorAt(top, pixelOf(at, i, cols, rows));
      const seen = byIndex.get(index) ?? new Map<string, number>();
      seen.set(color, (seen.get(color) ?? 0) + 1);
      byIndex.set(index, seen);
    }
    let onBase = 0;
    for (const counts of byIndex.values()) onBase += Math.max(...counts.values());
    expect(onBase).toBeGreaterThan(cells / 2);

    // 그리고 무언가가 실제로 얹혀 있다 — 표면 색인 수보다 색이 많다 (area 경계선 · point 표식)
    const colors = new Set<string>();
    for (let i = 0; i < cells; i++) colors.add(colorAt(top, i));
    expect(colors.size).toBeGreaterThan(new Set(surface.values).size);
    expect(onBase).toBeLessThan(cells);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-004 — 보고가 수를 읊는다', () => {
  const report = run(OBSERVE, [DOMAIN, '--report']);

  it('S-023 격자 · chunk · instance · 태그별 칸 수 · area · point · hash 를 읊는다 — 수는 컴파일 결과다', () => {
    expect(report.status).toBe(0);
    const region = compiled(DOMAIN);
    const summary = summarize(region);
    const out = report.out;

    // 묶음이 계약의 순서로 실린다 — 방 · 땅 · 검사
    let cursor = -1;
    for (const head of [/^ {2}방(\s|$)/m, /^ {2}땅(\s|$)/m, /^ {2}검사(\s|$|\s*\()/m]) {
      const at = out.search(head);
      expect({ head: String(head), found: at > cursor }).toEqual({ head: String(head), found: true });
      cursor = at;
    }

    // 방 — 격자 · vertex 수 · 높이 최소~최대 · hash
    expect(lineWith(out, word(summary.cols), word(summary.rows))).toBeDefined();
    expect(out).toMatch(word(summary.vertices));
    expect(out).toMatch(word(summary.resolution));
    // hash — Description 의 것이든 컴파일의 것이든 그 방을 가리키는 값이 실린다
    // (spec 은 "hash" 라고만 적고 어느 쪽인지 말하지 않는다)
    expect([descriptionHash(spaceOf(DOMAIN)), region.hash].some((h) => out.includes(h))).toBe(true);

    // 땅 — 표면 태그별 칸 수 (칸 수 0 인 태그도 적는다)
    for (const { tag, cells } of summary.surface) {
      expect({ tag, line: lineWith(out, tag, word(cells)) !== undefined }).toEqual({ tag, line: true });
    }
    // 막힘 사유별 칸 수
    for (const { tag, cells } of summary.blocked) {
      expect({ tag, line: lineWith(out, tag, word(cells)) !== undefined }).toEqual({ tag, line: true });
    }
    // 통행/막힘 합
    expect(out).toMatch(word(summary.traversableCells));
    expect(out).toMatch(word(summary.blockedCells));
    // area 목록 · point 목록 — 컴파일이 준 만큼 그 태그가 적힌다
    for (const { tag } of [...summary.areas, ...summary.points]) expect(out).toContain(tag);
    // chunk 수(chunkSize) · instance 수
    expect(out).toMatch(word(summary.chunks));
    expect(out).toMatch(word(summary.chunkSize));
    expect(out).toMatch(word(summary.instances));
    // 이 방은 실제로 셀 것이 있다 — 검사가 헛돌지 않는다
    expect(summary.instances).toBeGreaterThan(0);
    expect(summary.blockedCells).toBeGreaterThan(0);
    expect(summary.areas.length).toBeGreaterThan(0);
  });

  it('S-024 (경계) 데이터가 없는 방의 보고도 나온다 — instance 0 · area 0 · 막힘 0', () => {
    // Given 아무것도 막지 않는 방
    const room = openRoom();
    const summary = summarize(compiled(room));
    expect({ instances: summary.instances, areas: summary.areas.length, blocked: summary.blockedCells }).toEqual({
      instances: 0,
      areas: 0,
      blocked: 0,
    });
    // When 그 방을 보고로 본다
    const empty = run(OBSERVE, [room, '--report']);
    // Then 보고가 나오고 0 을 적는다 — 없는 것을 감추지 않는다
    expect(empty.status).toBe(0);
    expect(empty.out).toContain(room);
    for (const { tag, cells } of summary.blocked) {
      expect({ tag, line: lineWith(empty.out, tag, word(cells)) !== undefined }).toEqual({ tag, line: true });
    }
    expect(empty.out).toMatch(word(summary.vertices));
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-005 — 보고가 검사 아홉을 읊는다', () => {
  const report = run(OBSERVE, [DOMAIN, '--report']);
  const MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'] as const;
  const section = () => {
    const at = report.out.search(/^ {2}검사/m);
    return at < 0 ? '' : report.out.slice(at);
  };
  /** 그 번호가 붙은 묶음 — 다음 번호 앞까지 (답이 다음 줄에 실릴 수 있다) */
  const block = (mark: string) => {
    const checks = section();
    const from = checks.indexOf(mark);
    if (from < 0) return '';
    const next = MARKS.slice(MARKS.indexOf(mark as never) + 1)
      .map((m) => checks.indexOf(m))
      .find((at) => at > from);
    return checks.slice(from, next === undefined ? undefined : next);
  };

  it('S-025 아홉이 다 실린다 — 그래프 넷(⑤~⑧)은 checkGraph 그대로다', () => {
    const checks = section();
    for (const mark of MARKS) {
      expect({ mark, found: checks.includes(mark) }).toEqual({ mark, found: true });
    }
    // 그래프 검사의 답은 도구가 정하지 않는다 — checkGraph 가 준 것 그대로다
    const issues = checkGraph(
      REGION_SPECS.map((s) => s.space),
      REGION_GRAPH,
      ANCHOR_LAYER,
      START_REGION_ID,
    );
    // 코드마다 그 수를 적는다 (⑤ missing-anchor · ⑥ containment-unlinked · ⑦ no-exit · ⑧ unreachable)
    const count = (code: string) => issues.filter((i) => i.code === code).length;
    for (const [mark, code] of [
      ['⑤', 'missing-anchor'],
      ['⑥', 'containment-unlinked'],
      ['⑦', 'no-exit'],
      ['⑧', 'unreachable'],
    ] as const) {
      expect({ mark, block: block(mark) }).toMatchObject({ mark, block: expect.stringMatching(word(count(code))) });
    }
    for (const issue of issues) expect(checks).toContain(issue.region);
  });

  it('S-026 (경계) 놓인 것이 없는 검사는 "놓인 것이 없다" 로 적고 ③ 은 실제로 답을 낸다 · ⑨ 는 0 이다', () => {
    // ④ phenomenon — 이 세계에 그 layer 가 아직 없다.
    // "위반 0" 이 아니라 "놓인 것이 없다" 로 적는다 (없는 것을 통과로 적으면 검사가 거짓말을 한다)
    for (const [mark, layer] of [['④', 'phenomenon']] as const) {
      // 그 layer 가 정말로 이 세계에 없다 (검사가 헛돌지 않는다)
      const placed = REGION_SPECS.flatMap((s) =>
        s.space.ops.filter((op) => op.kind === 'area' && op.layer === layer),
      );
      expect({ layer, placed: placed.length }).toEqual({ layer, placed: 0 });
      expect({ mark, block: block(mark) }).toMatchObject({
        mark,
        block: expect.stringContaining('놓인 것이 없다'),
      });
    }

    // ① 자원과 위험 — C012 CHANGED. 이 검사는 C007 때 빈 검사였다 (STATE §5 부채:
    // "검사 ①②④ 는 아직 빈 검사다 — 컨텐츠 층 주입이 채운다"). C012 가 노두의 붕괴 자리를
    // resource layer 의 area 로 놓으면서 **① 이 실제로 답을 내기 시작했다.**
    expect(
      REGION_SPECS.flatMap((s) =>
        s.space.ops.filter((op) => op.kind === 'area' && op.layer === 'resource'),
      ).length,
    ).toBeGreaterThan(0);
    expect(block('①')).not.toContain('놓인 것이 없다');

    // ③ 조건 없이 선 settlement — 이 세계에는 settlement 가 놓여 있으므로 실제로 답을 낸다
    const areasOfRegion = (id: string) =>
      REGION_SPECS.find((s) => s.id === id)!.space.ops.filter(
        (op) => op.kind === 'area' && op.layer === SETTLEMENT_LAYER,
      ) as { tag: string }[];
    const isCondition = (tag: string) => tag.startsWith('condition');
    const settled = REGION_SPECS.filter((s) => areasOfRegion(s.id).some((a) => !isCondition(a.tag)));
    const violating = settled.filter((s) => !areasOfRegion(s.id).some((a) => isCondition(a.tag)));
    // 검사가 헛돌지 않는다 — 이 세계에 settlement 를 가진 방이 있고, 그 곁에 조건이 있다
    expect(settled.length).toBeGreaterThan(0);
    expect(violating).toEqual([]);
    const third = block('③');
    expect(third).not.toContain('놓인 것이 없다');
    // 수는 데이터에서 센 값 그대로다 — settlement 를 가진 방의 수와 조건 없이 선 방의 수
    expect(third).toMatch(word(settled.length));
    expect(third).toMatch(word(violating.length));
    // 위반이 있다면 그 이름이 적힌다 (지금은 없다 — 없는 것을 지어내지도 않는다)
    for (const spec of violating) expect(third).toContain(spec.id);

    // ② 깊이 없는 자리 — 이 세계의 depth 는 Region 이 갖는다. 지금은 아홉 방이 다 갖고 있다
    const without = REGION_SPECS.filter((s) => !s.depth);
    expect(without).toEqual([]);
    expect(block('②')).toMatch(word(without.length));

    // ⑨ core rule 수 — 이 세계에는 아직 Region 별 rule 이 없다. 0 을 적는다
    expect(block('⑨')).toMatch(word(0));
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-006 — 두 번 돌리면 같다', () => {
  it('S-027 같은 명령을 두 번 돌리면 글자가 같고 PNG 의 바이트도 같다', () => {
    const dir = outDir('twice');
    const args = [DOMAIN, ...ALL_PICTURES, '--report', '--out', dir];
    // When 같은 자리에 두 번 돌린다
    const first = run(OBSERVE, args);
    const bytesA = KINDS.map((k) => readFileSync(join(dir, `${DOMAIN}.${k}.png`)));
    const second = run(OBSERVE, args);
    const bytesB = KINDS.map((k) => readFileSync(join(dir, `${DOMAIN}.${k}.png`)));
    // Then 글자가 하나까지 같다
    expect(second.status).toBe(0);
    expect(second.out).toBe(first.out);
    // 그리고 그림의 바이트도 같다 — 시각·난수·Map 순회 순서에 기대지 않는다
    for (let i = 0; i < KINDS.length; i++) {
      expect({ kind: KINDS[i], same: bytesB[i]!.equals(bytesA[i]!) }).toEqual({ kind: KINDS[i], same: true });
    }
  });

  it('S-028 (경계) world:compile 로 같은 방을 두 번 컴파일하면 hash 가 같다', () => {
    // When 도구가 같은 방을 두 번 컴파일한다
    const compile = run(COMPILE, [DOMAIN]);
    expect(compile.status).toBe(0);
    // Then 그 방의 hash 를 읊고, 두 번의 값이 같다 (Plan 완료 조건 1)
    const region = compiled(DOMAIN);
    const hash = [descriptionHash(spaceOf(DOMAIN)), region.hash].find((h) => compile.out.includes(h));
    expect({ hash: hash !== undefined }).toEqual({ hash: true });
    // 같은 값이 두 번 적힌다 — "두 번 돌려 같다" 를 도구가 스스로 보인다
    expect(compile.out.split(hash!).length - 1).toBeGreaterThanOrEqual(2);
    // 그리고 다시 돌려도 글자가 같다
    expect(run(COMPILE, [DOMAIN]).out).toBe(compile.out);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-007 — 관찰은 세계를 바꾸지 않는다', () => {
  /**
   * 저장소가 지금 어떤 상태인가.
   *
   * 세계(content · engine)와 조립(app · server)은 **한 글자도** 달라지지 않아야 한다 — 그 자리를
   * 통째로 견준다. tools 아래는 도구가 그림을 두는 자리이므로, 밝힌 폴더에 무엇이 들었는지로 따로 본다
   * (같은 저장소에서 도구가 겹쳐 돌 수 있어 tools 전체를 견주면 남의 그림을 세게 된다).
   */
  const worldState = () =>
    execFileSync('git', ['status', '--porcelain', '-uall', '--', 'engine', 'content', 'app', 'server'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  /** 커밋된 것과 견준 **추적 중인** 파일의 변경 — 저장소 전체 */
  const trackedChanges = () =>
    execFileSync('git', ['diff', '--name-only', '--', '.'], { cwd: ROOT, encoding: 'utf8' });

  it('S-029 돌린 앞뒤로 저장소에 는 것은 밝힌 그림뿐이다', () => {
    const dir = outDir('clean');
    // Given 돌리기 전의 저장소
    const worldBefore = worldState();
    const trackedBefore = trackedChanges();
    // When observe 로 그림 다섯과 보고를, compile 로 hash 를 낸다
    expect(run(OBSERVE, [DOMAIN, ...ALL_PICTURES, '--report', '--out', dir]).status).toBe(0);
    expect(run(COMPILE, [DOMAIN]).status).toBe(0);
    // Then 세계도 기반도 조립도 한 글자 달라지지 않았다
    expect(worldState()).toBe(worldBefore);
    // 추적 중인 파일은 저장소 어디에서도 달라지지 않았다 (도구가 코드를 고쳐 쓰지 않는다)
    expect(trackedChanges()).toBe(trackedBefore);
    // 그리고 밝힌 폴더에 든 것은 밝힌 다섯 장뿐이다 (보고는 글자로만 나간다)
    expect([...readdirSync(dir)].sort()).toEqual(KINDS.map((k) => `${DOMAIN}.${k}.png`).sort());
  });

  it('S-030 (경계) 모르는 인자 · 모르는 방 이름에는 아는 것을 밝히고 아무것도 하지 않는다', () => {
    const dir = outDir('unknown');
    const worldBefore = worldState();
    for (const args of [['--json'], ['NO_SUCH_REGION', '--height'], [DOMAIN, '--rainbow']]) {
      const attempt = run(OBSERVE, [...args, '--out', dir]);
      // Then 무엇을 아는지 밝힌다 (C004 renderUsage 의 어법 그대로)
      expect({ args, said: attempt.out.includes('아무것도 하지 않았다') }).toEqual({ args, said: true });
      // 그리고 파일을 하나도 쓰지 않는다
      expect({ args, files: readdirSync(dir) }).toEqual({ args, files: [] });
    }
    expect(worldState()).toBe(worldBefore);
    // 모르는 방 이름에는 아는 방들을 밝힌다
    const unknown = run(OBSERVE, ['NO_SUCH_REGION', '--report']);
    for (const spec of REGION_SPECS) expect(unknown.out).toContain(spec.id);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-008 — 띄운 게임을 찍는다', () => {
  it('S-031 (경계) 브라우저가 없으면 무엇이 없는지 말하고 멈춘다 — 조용히 빈 그림을 남기지 않는다', () => {
    const dir = outDir('shot-missing');
    const file = join(dir, 'nothing.png');
    // Given 브라우저가 없는 자리를 밝힌다
    const attempt = run(SHOT, [DOMAIN, '--out', file], { CHROMIUM_PATH: join(dir, 'no-such-browser') });
    // Then 무엇이 없는지 말한다
    expect(attempt.out).toContain('CHROMIUM_PATH');
    // 그리고 빈 그림을 남기지 않는다
    expect(existsSync(file)).toBe(false);
  });

  it(
    'S-032 실제로 띄운 게임의 그 방이 PNG 로 나온다 — 어느 자리에서 볼지 밝힐 수 있다',
    async () => {
      const dir = outDir('shot');
      const file = join(dir, 'forest-edge.png');
      // Given 방 하나와 그 방 안의 자리 (anchor 에서 본다 — 자리는 데이터가 준다)
      const at = spaceOf('FOREST_EDGE').ops.find((op) => op.kind === 'point')!;
      const position = (at as { position: { x: number; z: number } }).position;
      // When 그 방을 그 자리에서 찍는다
      const shot = run(SHOT, ['FOREST_EDGE', '--at', `${position.x},${position.z}`, '--out', file], {
        CHROMIUM_PATH: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
      });
      // Then PNG 가 나온다
      // 실패하면 도구가 한 말을 그대로 보인다 (vite 포트가 이미 쓰이면 여기서 드러난다)
      if (shot.status !== 0) throw new Error(`world:shot 이 찍지 못했다\n${shot.out.slice(-1500)}`);
      expect(existsSync(file)).toBe(true);
      const png = decodePng(readFileSync(file));
      expect(png.width).toBeGreaterThan(0);
      expect(png.height).toBeGreaterThan(0);
      // 그리고 빈 그림이 아니다 — 한 색으로 덮인 판이 아니다
      const colors = new Set<string>();
      for (let i = 0; i < png.width * png.height; i += 7) colors.add(colorAt(png, i));
      expect(colors.size).toBeGreaterThan(1);
    },
    300_000,
  );
});

// ── 회귀 — C004 의 --graph 가 그대로인가 ──────────────────────
describe('회귀', () => {
  it('R-006 (C004) --graph 가 그대로다 — 인자 없이 돌린 것과 글자까지 같다', () => {
    const bare = run(OBSERVE, []);
    const flagged = run(OBSERVE, ['--graph']);
    expect(flagged.out).toBe(bare.out);
    // 방과 Connector 를 데이터가 준 만큼 적는다 (C004 SPEC-008 의 주장)
    for (const spec of REGION_SPECS) expect(bare.out).toContain(spec.id);
    for (const connector of REGION_GRAPH.connectors) expect(bare.out).toContain(connector.id);
  });

  it('R-007 (C004) --graph 를 두 번 돌려도 글자까지 같다', () => {
    expect(run(OBSERVE, ['--graph']).out).toBe(run(OBSERVE, ['--graph']).out);
  });
});
