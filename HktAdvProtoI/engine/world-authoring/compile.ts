// World Authoring — Region 컴파일 (ENGINE A).
//
// Description 을 재생해 두 산출물을 만든다: 세계가 규칙에 쓰는 고정 해상도 격자 하나와,
// View 가 그리는 chunk 들. 둘은 **같은 height 격자**에서 나오므로 chunk 경계의 vertex 는
// 양쪽이 같은 값을 갖는다 — seam 이 구조적으로 없다 (design/Plan-World-Authoring-Engine.md §3.2).
//
// 순수하다 — Math.random · Date 를 쓰지 않고 객체 키 순회 순서에 기대지 않는다. 같은
// (description, rules) 는 언제나 같은 hash 다. chunkSize 는 그리기 설정이므로 hash 에 섞지
// 않는다 — 세계의 판정이 View 설정에 묶이면 안 된다 (§2.2-4).

import {
  curvesOf,
  descriptionHash,
  nearestCurveDistance,
  type CurveOp,
  type RegionDescription,
} from './description';
import type {
  AreaShape,
  BlockRule,
  CompileRules,
  CompiledRegion,
  CompiledViewTerrain,
  CompiledWorldTerrain,
  HeightField,
  PassRule,
  XZ,
} from './compiled';
import { buildHeightField, sampleHeight, slopeAtVertex, vertexX, vertexZ } from './height-field';
import { evaluateSurface } from './surface';

/**
 * chunk 한 변의 **칸 수** (vertex 수 - 1) 의 기본값.
 *
 * 32 로 둔다 — 칸 크기가 1 이면 한 변 32 인 chunk 이고 vertex 33×33(약 2천 삼각형)이라
 * 그리기 단위로 흔한 크기다. 무엇보다 이 기본값에서는 **Region 하나가 chunk 하나가 아니다** —
 * 40 남짓의 Region 도 이미 2×2 로 나뉘므로, 나뉘는 길이 늘 열려 있다 (RoomBecomesLand E9).
 */
export const DEFAULT_CHUNK_SIZE = 32;

export function compileRegion(
  description: RegionDescription,
  rules: CompileRules,
  options?: { chunkSize?: number },
): CompiledRegion {
  const field = buildHeightField(description, rules.resolution);
  const { surface, surfaceTags } = evaluateSurface(field, rules.surface, description);
  const { traversable, blocked, blockedTags } = evaluateBlocked(field, description, rules);

  const world: CompiledWorldTerrain = {
    extent: field.extent,
    resolution: field.resolution,
    cols: field.cols,
    rows: field.rows,
    height: field.height,
    surface,
    surfaceTags,
    traversable,
    blocked,
    blockedTags,
    areas: collectAreas(description),
    points: collectPoints(description),
  };

  const chunkSize = Math.max(1, Math.floor(options?.chunkSize ?? DEFAULT_CHUNK_SIZE));
  const view = sliceChunks(field, surface, surfaceTags, chunkSize);
  view.instances = collectInstances(field, description, rules.instanceLayers);
  return { world, view, hash: regionHash(description, rules) };
}

/**
 * 막는 규칙 표를 격자에 편다 — vertex 마다 traversable 하나와 사유 색인 하나.
 *
 * 규칙은 **배열 순서로 첫 번째로 맞는 것**이 이기고, 한 규칙 안의 조건들(minSlope · nearCurve)은
 * AND 다. 그 뒤에 passages 가 덮는다 — 놓은 것(point)이 규칙을 이긴다.
 * blockedTags 의 색인 0 은 언제나 '' 다: 막히지 않음이 곧 기본값(0)이어야 하기 때문이다.
 */
function evaluateBlocked(
  field: HeightField,
  description: RegionDescription,
  rules: CompileRules,
): { traversable: Uint8Array; blocked: Uint8Array; blockedTags: string[] } {
  const count = field.cols * field.rows;
  const traversable = new Uint8Array(count).fill(1);
  const blocked = new Uint8Array(count);
  const blockedTags: string[] = ['']; // 0 = 막히지 않음

  const blockRules = rules.blocked ?? [];
  const tagIndexOfRule: number[] = [];
  for (const rule of blockRules) {
    let index = blockedTags.indexOf(rule.reason);
    if (index < 0) {
      index = blockedTags.length;
      blockedTags.push(rule.reason);
    }
    tagIndexOfRule.push(index);
  }

  if (blockRules.length > 0) {
    // 규칙마다 볼 curve 를 한 번만 골라 둔다 — vertex 마다 ops 를 다시 훑지 않는다.
    const curvesOfRule: (readonly CurveOp[] | null)[] = blockRules.map((rule) =>
      rule.nearCurve ? curvesOf(description, rule.nearCurve.layer, rule.nearCurve.tag) : null,
    );
    for (let iz = 0; iz < field.rows; iz++) {
      const z = vertexZ(field, iz);
      for (let ix = 0; ix < field.cols; ix++) {
        const x = vertexX(field, ix);
        const slope = slopeAtVertex(field, ix, iz);
        for (let r = 0; r < blockRules.length; r++) {
          const rule = blockRules[r] as BlockRule | undefined;
          if (!rule) continue;
          if (rule.minSlope !== undefined && !(slope >= rule.minSlope)) continue;
          if (rule.nearCurve !== undefined) {
            const curves = curvesOfRule[r];
            if (!curves) continue;
            if (!(nearestCurveDistance(curves, x, z) <= rule.nearCurve.maxDistance)) continue;
          }
          const i = iz * field.cols + ix;
          traversable[i] = 0;
          blocked[i] = tagIndexOfRule[r] ?? 0;
          break;
        }
      }
    }
  }

  for (const pass of rules.passages ?? []) {
    applyPassage(field, description, pass, traversable, blocked);
  }

  return { traversable, blocked, blockedTags };
}

/** 통과 point 둘레 radius 안을 되돌린다 — 반경의 사각형만 훑는다 */
function applyPassage(
  field: HeightField,
  description: RegionDescription,
  pass: PassRule,
  traversable: Uint8Array,
  blocked: Uint8Array,
): void {
  if (!(pass.radius > 0) || !Number.isFinite(pass.radius)) return;
  for (const op of description.ops) {
    if (op.kind !== 'point' || op.layer !== pass.layer || op.tag !== pass.tag) continue;
    const { resolution } = field;
    const ix0 = clampInt(Math.floor((op.position.x - pass.radius - field.extent.minX) / resolution), 0, field.cols - 1);
    const ix1 = clampInt(Math.ceil((op.position.x + pass.radius - field.extent.minX) / resolution), 0, field.cols - 1);
    const iz0 = clampInt(Math.floor((op.position.z - pass.radius - field.extent.minZ) / resolution), 0, field.rows - 1);
    const iz1 = clampInt(Math.ceil((op.position.z + pass.radius - field.extent.minZ) / resolution), 0, field.rows - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      const dz = vertexZ(field, iz) - op.position.z;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = vertexX(field, ix) - op.position.x;
        if (Math.hypot(dx, dz) > pass.radius) continue;
        const i = iz * field.cols + ix;
        traversable[i] = 1;
        blocked[i] = 0;
      }
    }
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * 같은 격자를 chunk 로 자른다 — 자르기만 할 뿐 값을 다시 만들지 않는다.
 *
 * chunk 는 **칸**을 나누고 vertex 는 나누지 않는다: ix 번째 chunk 의 마지막 vertex 가
 * ix+1 번째의 첫 vertex 다. 두 chunk 는 같은 격자에서 같은 자리를 읽으므로 값이 같다.
 */
function sliceChunks(
  field: HeightField,
  surface: Uint8Array,
  surfaceTags: string[],
  chunkSize: number,
): CompiledViewTerrain {
  const cellsX = field.cols - 1;
  const cellsZ = field.rows - 1;
  const countX = Math.max(1, Math.ceil(cellsX / chunkSize));
  const countZ = Math.max(1, Math.ceil(cellsZ / chunkSize));
  const chunks: CompiledViewTerrain['chunks'] = [];
  for (let cz = 0; cz < countZ; cz++) {
    for (let cx = 0; cx < countX; cx++) {
      const x0 = cx * chunkSize;
      const x1 = Math.min(x0 + chunkSize, cellsX);
      const z0 = cz * chunkSize;
      const z1 = Math.min(z0 + chunkSize, cellsZ);
      const cols = x1 - x0 + 1;
      const rows = z1 - z0 + 1;
      const positions = new Float32Array(cols * rows * 3);
      const chunkSurface = new Uint8Array(cols * rows);
      for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
          const source = (z0 + iz) * field.cols + (x0 + ix);
          const target = iz * cols + ix;
          positions[target * 3] = vertexX(field, x0 + ix);
          positions[target * 3 + 1] = field.height[source] ?? 0;
          positions[target * 3 + 2] = vertexZ(field, z0 + iz);
          chunkSurface[target] = surface[source] ?? 0;
        }
      }
      chunks.push({ ix: cx, iz: cz, cols, rows, positions, surface: chunkSurface });
    }
  }
  // instance 는 자르기와 무관하다 — 부른 쪽이 채운다
  return { chunkSize, chunks, surfaceTags, instances: [] };
}

/**
 * 그리는 쪽 instance — instanceLayers 에 든 layer 의 point 를 ops 순서 그대로 옮긴다.
 * y 는 그 자리의 지면 높이다 (격자를 bilinear 로 샘플한 값) — 그리는 쪽이 높이를 다시 재지 않는다.
 */
function collectInstances(
  field: HeightField,
  description: RegionDescription,
  instanceLayers: readonly string[] | undefined,
): CompiledViewTerrain['instances'] {
  if (!instanceLayers || instanceLayers.length === 0) return [];
  const instances: CompiledViewTerrain['instances'] = [];
  for (const op of description.ops) {
    if (op.kind !== 'point' || !instanceLayers.includes(op.layer)) continue;
    instances.push({
      tag: op.tag,
      position: { x: op.position.x, z: op.position.z },
      y: sampleHeight(field, op.position.x, op.position.z),
    });
  }
  return instances;
}

/** area op 를 ops 순서 그대로 옮긴다 — 모양도 복사한다 (컴파일 결과는 Description 과 따로 산다) */
function collectAreas(description: RegionDescription): { layer: string; tag: string; shape: AreaShape }[] {
  const areas: { layer: string; tag: string; shape: AreaShape }[] = [];
  for (const op of description.ops) {
    if (op.kind !== 'area') continue;
    const shape: AreaShape =
      op.shape.kind === 'polygon'
        ? { kind: 'polygon', points: op.shape.points.map((p) => ({ x: p.x, z: p.z })) }
        : { kind: 'circle', center: { x: op.shape.center.x, z: op.shape.center.z }, radius: op.shape.radius };
    areas.push({ layer: op.layer, tag: op.tag, shape });
  }
  return areas;
}

/** point op 를 ops 순서 그대로 옮긴다 — 자리는 복사한다 (컴파일 결과는 Description 과 따로 산다) */
function collectPoints(description: RegionDescription): { layer: string; tag: string; position: XZ }[] {
  const points: { layer: string; tag: string; position: XZ }[] = [];
  for (const op of description.ops) {
    if (op.kind !== 'point') continue;
    points.push({ layer: op.layer, tag: op.tag, position: { x: op.position.x, z: op.position.z } });
  }
  return points;
}

// ── 결정적 hash ──────────────────────────────────────────────────────
//
// descriptionHash 의 선례를 따른다 — 정규화한 글자열 위의 FNV-1a 32bit. Description 쪽은
// 이미 그 함수가 답을 주므로 여기서는 규칙만 한 줄로 펴서 함께 섞는다. 규칙의 필드를 손으로
// 적으므로 객체 키 순회 순서에 기대지 않는다.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 규칙 표를 한 줄로 — 배열 순서에는 흔들리고(순서가 우선순위다) 키 순서에는 흔들리지 않는다.
 *
 * 규칙이 바뀌면 땅이 바뀌므로 막는 규칙 · 덮는 자리 · instance layer 도 함께 섞는다. 다만
 * **비어 있는 조각은 글자에 넣지 않는다** — 없는 것과 빈 목록은 격자를 똑같이 만들고,
 * 그래야 이 항목들이 생기기 전의 규칙 표가 예전과 같은 값을 유지한다.
 * chunkSize 는 여전히 섞지 않는다 (그리기 설정이다).
 */
function canonicalRules(rules: CompileRules): string {
  const near = (n: { layer: string; tag: string; maxDistance: number } | undefined): string =>
    n === undefined ? '' : `@${JSON.stringify(n.layer)}/${JSON.stringify(n.tag)}<=${n.maxDistance}`;
  const surface = rules.surface
    .map((rule) => `${JSON.stringify(rule.tag)}<${rule.maxSlope === undefined ? '' : rule.maxSlope}${near(rule.nearCurve)}`)
    .join(',');
  let text = `r=${rules.resolution};s=[${surface}]`;
  if (rules.blocked && rules.blocked.length > 0) {
    const blocked = rules.blocked
      .map((rule) => `${JSON.stringify(rule.reason)}>${rule.minSlope === undefined ? '' : rule.minSlope}${near(rule.nearCurve)}`)
      .join(',');
    text += `;b=[${blocked}]`;
  }
  if (rules.passages && rules.passages.length > 0) {
    const passages = rules.passages
      .map((rule) => `${JSON.stringify(rule.layer)}/${JSON.stringify(rule.tag)}~${rule.radius}`)
      .join(',');
    text += `;p=[${passages}]`;
  }
  if (rules.instanceLayers && rules.instanceLayers.length > 0) {
    text += `;i=[${rules.instanceLayers.map((layer) => JSON.stringify(layer)).join(',')}]`;
  }
  return text;
}

/** 같은 (description, rules) → 같은 값. 8자리 소문자 hex */
export function regionHash(description: RegionDescription, rules: CompileRules): string {
  return fnv1a32(`${descriptionHash(description)}|${canonicalRules(rules)}`)
    .toString(16)
    .padStart(8, '0');
}
