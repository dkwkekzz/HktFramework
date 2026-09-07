// World Authoring — 뼈대 생성기 (T3 ADDED · 절반: space · graph · resourceEcology).
//
// RegionBrief(T2) 하나에서 방 하나의 **뼈대**를 낸다 — Description 의 op 들, 그 방이 들이는
// Connector 들, 그리고 방 이름 한 줄. `world:author` 가 이것을 파일로 굳힌다.
//
// **뼈대이지 완성이 아니다.** 손으로 쓴 방들이 지닌 실측 근거(왜 반경 10 인가 · 왜 깊이 9 인가)를
// 생성기가 지어낼 수는 없다. 생성기가 대는 것은 **서기는 하는 방** 하나다 — 검사 아홉(T1)을
// 통과하고, 놓인 원천에 걸어 닿을 수 있는 방.
//
// **게임 명사가 없다.** 어느 갈래가 어떤 땅을 얻고 어느 역할이 얼마나 주는지는 전부
// `AuthorTemplates` 로 받는다 (content/authoring/templates). 이 파일이 아는 것은
// "갈래마다 땅 묶음이 있다 · 역할마다 기본형이 있다" 는 형뿐이다.
//
// **결정론.** 같은 brief 는 언제나 같은 방을 낸다 — seed 는 brief 를 해시한 값이고,
// 자리는 전부 그 seed 와 배열 순서에서 나온다. 시각도 난수도 쓰지 않는다.

import type { CompiledWorldTerrain } from './compiled';
import type { AnswerKey, RegionBrief } from './brief';
import { unansweredKeys } from './brief';
import type { AreaOp, PointOp, RegionDescription, RegionOp, StampOp, XZ } from './description';
import { isTraversableAt } from './query';

/**
 * 땅 한 자국 — **방 크기에 견준 비율**로 적는다. 절대 좌표를 두지 않으므로
 * 같은 묶음이 큰 방에도 작은 방에도 선다.
 */
export interface TerrainRecipe {
  id: string;
  stamp: StampOp['stamp'];
  /** 방 반지름에 대한 비 (−1 … 1) */
  center: XZ;
  /** 방 반지름에 대한 비 */
  radius: number;
  /** 방 반지름에 대한 비 */
  height: number;
  falloff?: number;
}

/** 역할별 원천 기본형 — 얼마나 주는가 · 어떻게 다시 나는가 · 무너지는가 */
export interface SourceDefaults {
  supply: string;
  harvests: number;
  collapses?: boolean;
}

/** 깊이별 방의 크기와 흔적의 바탕 세기 */
export interface DepthDefaults {
  /** 방 반지름 — extent 는 이것의 두 배 정사각형이다 */
  half: number;
  /** 이 깊이의 흔적 바탕 세기 */
  traceBase: number;
}

export interface AuthorTemplates {
  anchorLayer: string;
  resourceLayer: string;
  traceLayer: string;
  /** 흔적 세기 → 태그. 세기의 상한도 컨텐츠가 안다 */
  traceTag(level: number): string;
  byDepth: Readonly<Record<string, DepthDefaults>>;
  /** 표에 없는 깊이의 방 */
  depthFallback: DepthDefaults;
  /** 갈래별 땅 묶음 */
  terrainByKind: Readonly<Record<string, readonly TerrainRecipe[]>>;
  /** 갈래가 없거나 표에 없는 방의 땅 */
  terrainFallback: readonly TerrainRecipe[];
  sourceByRole: Readonly<Record<string, SourceDefaults>>;
}

/** 생성기가 내는 원천 하나 — 컨텐츠의 원천 표와 같은 이름들이다 */
export interface AuthoredSource {
  id: string;
  materialId: string;
  form: string;
  carrier: string;
  opportunity: string;
  supply: string;
  harvests: number;
  collapses?: boolean;
  /** 이 원천 둘레의 흔적 op — 고갈이 한 단계 낮출 자리 */
  traceOp: string;
}

export interface AuthoredConnector {
  id: string;
  from: { region: string; anchor: string };
  to: { region: string; anchor: string };
  direction: 'bidirectional' | 'one-way';
  transition: string;
}

export interface AuthoredSpec {
  id: string;
  depth: string;
  space: RegionDescription;
  resourceEcology?: { sources: AuthoredSource[] };
}

export interface AuthoredRegion {
  spec: AuthoredSpec;
  /** 이 방이 들이는 Connector 들 — graph 에 이어 붙일 줄들 */
  connectors: AuthoredConnector[];
  /** 방 이름 — view 표에 이어 붙일 줄 */
  name: string;
  /**
   * 이웃 쪽에 늘어야 하는 anchor 들. 생성기는 **그 방의 땅을 모르므로 자리를 정하지 못한다** —
   * 이름만 대고, 놓지 않으면 검사 ⑤(missing-anchor)가 잡는다.
   */
  neighbourAnchors: { region: string; anchor: string }[];
  /** 이 방이 아직 답하지 못한 질문들 — 뼈대는 서되 비어 있다는 것이 함께 나온다 */
  unanswered: AnswerKey[];
}

/** brief 를 해시한 값 — 컴파일 재현의 열쇠이자 자리를 고르는 유일한 난수원 */
export function briefSeed(brief: RegionBrief): number {
  const text = JSON.stringify(brief);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 이름 하나를 op id 로 — 손으로 쓴 방들의 규약(kebab)을 따른다 */
function slug(name: string): string {
  return name.toLowerCase().replace(/_/g, '-');
}

/** 소수 둘로 끊는다 — 좌표가 글자로 굳어도 같은 값이어야 한다 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 원 위의 i 번째 자리 — 남쪽에서 시작해 시계 반대로 돈다 */
function onRing(half: number, ratio: number, index: number, count: number, turn = 0): XZ {
  const angle = -Math.PI / 2 + (2 * Math.PI * (index + turn)) / Math.max(count, 1);
  return {
    x: round2(Math.cos(angle) * half * ratio),
    z: round2(Math.sin(angle) * half * ratio),
  };
}

/** 그 자리에서 걸어 닿는 격자 칸들 — 4방 이웃으로 번진다 */
function reachable(world: CompiledWorldTerrain, from: XZ): Set<number> {
  const { cols, rows } = world;
  const indexOf = (col: number, row: number) => row * cols + col;
  const nearest = (value: number, min: number) =>
    Math.min(Math.max(Math.round((value - min) / world.resolution), 0), Math.max(cols, rows) - 1);
  const startCol = Math.min(nearest(from.x, world.extent.minX), cols - 1);
  const startRow = Math.min(nearest(from.z, world.extent.minZ), rows - 1);
  const seen = new Set<number>();
  if (world.traversable[indexOf(startCol, startRow)] !== 1) return seen;
  const queue: number[] = [indexOf(startCol, startRow)];
  seen.add(queue[0]!);
  while (queue.length > 0) {
    const at = queue.pop()!;
    const col = at % cols;
    const row = (at - col) / cols;
    const steps: [number, number][] = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [c, r] of steps) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const next = indexOf(c, r);
      if (seen.has(next)) continue;
      if (world.traversable[next] !== 1) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** 그 자리가 닿는 칸들 안에 있는가 */
function isReached(world: CompiledWorldTerrain, reached: Set<number>, at: XZ): boolean {
  const col = Math.round((at.x - world.extent.minX) / world.resolution);
  const row = Math.round((at.z - world.extent.minZ) / world.resolution);
  if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return false;
  return reached.has(row * world.cols + col);
}

export interface AuthorInput {
  brief: RegionBrief;
  templates: AuthorTemplates;
  /**
   * 그 방을 어떻게 컴파일하는가 — 주면 생성기가 **놓은 자리에 걸어 닿는지 재 보고** 옮긴다.
   * 주지 않으면 자리만 고르고 재지 않는다 (그때도 지어내지 않는다 — 잰 적이 없을 뿐이다).
   */
  compile?: (space: RegionDescription) => CompiledWorldTerrain;
}

/**
 * brief 하나 → 방 하나의 뼈대.
 *
 * op 순서는 언제나 같다: anchor → 땅 → 흔적 바탕 → 원천 둘레 흔적 → 원천.
 * 순서가 다르면 다른 Description 이므로 (description.ts) 이 순서가 곧 결정론의 일부다.
 */
export function authorRegion(input: AuthorInput): AuthoredRegion {
  const { brief, templates, compile } = input;
  const seed = briefSeed(brief);
  const depth = templates.byDepth[brief.depth] ?? templates.depthFallback;
  const half = depth.half;

  // ── anchor — 이웃 하나에 자리 하나. 둘레를 고루 나눠 선다
  const connectors: AuthoredConnector[] = [];
  const neighbourAnchors: { region: string; anchor: string }[] = [];
  const anchorOps: PointOp[] = [];
  const used = new Map<string, number>();
  brief.neighbours.forEach((neighbour, index) => {
    const seen = (used.get(neighbour.region) ?? 0) + 1;
    used.set(neighbour.region, seen);
    // 같은 방으로 두 번 가면 이름이 갈려야 한다 — Connector 는 둘이고 자리도 둘이다
    const tag = seen === 1 ? `${brief.id}_${neighbour.region}` : `${brief.id}_${neighbour.region}_${seen}`;
    const at = onRing(half, 0.9, index, brief.neighbours.length);
    anchorOps.push({
      id: `anchor-${slug(tag)}`,
      kind: 'point',
      layer: templates.anchorLayer,
      tag,
      position: at,
    });
    connectors.push({
      id: tag,
      from: { region: brief.id, anchor: tag },
      to: { region: neighbour.region, anchor: tag },
      direction: neighbour.direction,
      transition: neighbour.transition,
    });
    // 아직 짓지 않은 곳에는 anchor 가 없어도 된다 (검사 ⑤ 도 경계는 보지 않는다)
    if (!neighbour.frontier) neighbourAnchors.push({ region: neighbour.region, anchor: tag });
  });

  // ── 땅 — 갈래가 고른다. 갈래가 없으면 기본형
  const recipes = brief.kinds.flatMap((kind) => templates.terrainByKind[kind] ?? []);
  const terrainOps: StampOp[] = (recipes.length > 0 ? recipes : templates.terrainFallback).map(
    (recipe) => ({
      id: recipe.id,
      kind: 'stamp',
      stamp: recipe.stamp,
      center: { x: round2(recipe.center.x * half), z: round2(recipe.center.z * half) },
      radius: round2(recipe.radius * half),
      height: round2(recipe.height * half),
      ...(recipe.falloff === undefined ? {} : { falloff: recipe.falloff }),
    }),
  );

  const extent = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  const base: RegionOp[] = [...anchorOps, ...terrainOps];

  // ── 원천이 없으면 여기까지가 방이다
  const sources = brief.answers.worth.sources;
  if (sources.length === 0) {
    return {
      spec: { id: brief.id, depth: brief.depth, space: { id: brief.id, extent, seed, ops: base } },
      connectors,
      name: brief.name,
      neighbourAnchors,
      unanswered: unansweredKeys(brief),
    };
  }

  // ── 원천의 자리 — 고리 위에서 고르되, 컴파일러를 받았으면 **걸어 닿는지 재고** 옮긴다
  const TURNS = 16;
  const world = compile?.({ id: brief.id, extent, seed, ops: base });
  const reached = world && anchorOps[0] ? reachable(world, anchorOps[0].position) : undefined;
  const placements: XZ[] = sources.map((_, index) => {
    for (let turn = 0; turn < TURNS; turn++) {
      // seed 가 첫 후보를 고르고, 거기서부터 한 바퀴 돈다 — 같은 brief 면 같은 자리다
      const at = onRing(half, 0.45, index, sources.length, ((seed % TURNS) + turn) / TURNS);
      if (!world || !reached) return at;
      if (isTraversableAt(world, at.x, at.z) && isReached(world, reached, at)) return at;
    }
    // 한 바퀴를 다 돌아도 닿는 자리가 없으면 첫 후보를 그대로 둔다 —
    // 지어내 옮기지 않고, 검사와 시험이 그 사실을 잡게 둔다
    return onRing(half, 0.45, index, sources.length, (seed % TURNS) / TURNS);
  });

  // ── 흔적 — 방 전체에 바탕 한 겹, 원천 둘레에 한 단계 짙게
  const traceOps: AreaOp[] = [
    {
      id: `trace-${slug(brief.id)}-base`,
      kind: 'area',
      layer: templates.traceLayer,
      tag: templates.traceTag(depth.traceBase),
      shape: {
        kind: 'polygon',
        points: [
          { x: -half, z: -half },
          { x: half, z: -half },
          { x: half, z: half },
          { x: -half, z: half },
        ],
      },
    },
    ...sources.map((source, index) => ({
      id: `trace-${slug(source.id)}`,
      kind: 'area' as const,
      layer: templates.traceLayer,
      tag: templates.traceTag(depth.traceBase + 1),
      shape: { kind: 'circle' as const, center: placements[index]!, radius: round2(half * 0.35) },
    })),
  ];

  const sourceOps: PointOp[] = sources.map((source, index) => ({
    id: `source-${slug(source.id)}`,
    kind: 'point',
    layer: templates.resourceLayer,
    tag: source.id,
    position: placements[index]!,
  }));

  const authored: AuthoredSource[] = sources.map((source, index) => {
    const role = templates.sourceByRole[source.role];
    return {
      id: source.id,
      materialId: source.material,
      form: source.form,
      carrier: source.heldBy,
      opportunity: source.role,
      supply: role?.supply ?? source.role,
      harvests: role?.harvests ?? 1,
      ...(role?.collapses ? { collapses: true } : {}),
      traceOp: traceOps[index + 1]!.id,
    };
  });

  return {
    spec: {
      id: brief.id,
      depth: brief.depth,
      space: { id: brief.id, extent, seed, ops: [...base, ...traceOps, ...sourceOps] },
      resourceEcology: { sources: authored },
    },
    connectors,
    name: brief.name,
    neighbourAnchors,
    unanswered: unansweredKeys(brief),
  };
}
