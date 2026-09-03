// World Authoring — Region 컴파일 (ENGINE A).
//
// Description 을 재생해 두 산출물을 만든다: 세계가 규칙에 쓰는 고정 해상도 격자 하나와,
// View 가 그리는 chunk 들. 둘은 **같은 height 격자**에서 나오므로 chunk 경계의 vertex 는
// 양쪽이 같은 값을 갖는다 — seam 이 구조적으로 없다 (design/Plan-World-Authoring-Engine.md §3.2).
//
// 순수하다 — Math.random · Date 를 쓰지 않고 객체 키 순회 순서에 기대지 않는다. 같은
// (description, rules) 는 언제나 같은 hash 다. chunkSize 는 그리기 설정이므로 hash 에 섞지
// 않는다 — 세계의 판정이 View 설정에 묶이면 안 된다 (§2.2-4).

import { descriptionHash, type RegionDescription } from './description';
import type {
  CompileRules,
  CompiledRegion,
  CompiledViewTerrain,
  CompiledWorldTerrain,
  HeightField,
  XZ,
} from './compiled';
import { buildHeightField, vertexX, vertexZ } from './height-field';
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
  const { surface, surfaceTags } = evaluateSurface(field, rules.surface);

  const world: CompiledWorldTerrain = {
    extent: field.extent,
    resolution: field.resolution,
    cols: field.cols,
    rows: field.rows,
    height: field.height,
    surface,
    surfaceTags,
    // area op 는 아직 Description 에 없다 — 없는 op 를 지어내지 않는다
    areas: [],
    points: collectPoints(description),
  };

  const chunkSize = Math.max(1, Math.floor(options?.chunkSize ?? DEFAULT_CHUNK_SIZE));
  return { world, view: sliceChunks(field, surface, surfaceTags, chunkSize), hash: regionHash(description, rules) };
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
  return { chunkSize, chunks, surfaceTags };
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

/** 규칙 표를 한 줄로 — 배열 순서에는 흔들리고(순서가 우선순위다) 키 순서에는 흔들리지 않는다 */
function canonicalRules(rules: CompileRules): string {
  const surface = rules.surface
    .map((rule) => `${JSON.stringify(rule.tag)}<${rule.maxSlope === undefined ? '' : rule.maxSlope}`)
    .join(',');
  return `r=${rules.resolution};s=[${surface}]`;
}

/** 같은 (description, rules) → 같은 값. 8자리 소문자 hex */
export function regionHash(description: RegionDescription, rules: CompileRules): string {
  return fnv1a32(`${descriptionHash(description)}|${canonicalRules(rules)}`)
    .toString(16)
    .padStart(8, '0');
}
