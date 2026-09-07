// World Authoring — Region Description (C001 ADDED).
//
// 하나의 Local Space 를 적는 **Source of Truth** 다. 컴파일도 그리기도 전부 이것의 파생이다
// (design/Plan-World-Authoring-Engine.md §3.1). 여기에는 게임 명사가 없다 — layer 와 tag 는
// 컨텐츠가 짓는 불투명 문자열이고, 기반은 뜻을 모른 채 **조회만** 제공한다.
//
// op 는 요구가 실제로 온 것만 있다 — point · stamp · curve · area 넷. 그 밖의 것(규칙이 놓는
// 장식 · seed 를 쓰는 흩뿌리기)은 그 요구가 오는 다음 사용처가 더한다 — 미리 열어 두지 않는다.

export interface XZ {
  x: number;
  z: number;
}

/** 지면 위의 축 정렬 범위 — 한 Region 의 Local Space 가 차지하는 곳 */
export interface Extent {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Description 의 편집 하나 — 자리에 이름(layer · tag)을 붙인다 */
export interface PointOp {
  id: string;
  kind: 'point';
  layer: string;
  tag: string;
  position: XZ;
}

/**
 * 지면을 들어 올리거나 내리는 편집 하나 — `center` 에서 `radius` 안쪽에만 닿는다.
 *
 * 세 종류의 차이는 **높이의 부호와 감쇠 모양뿐**이다 (기반은 그 이상을 뜻하지 않는다).
 *   hill    둥근 봉우리 — 중심에서 기울기가 0 인 돔
 *   ridge   뾰족한 마루 — 중심에서 꺾이는 원뿔
 *   basin   hill 을 뒤집은 것 — 양의 `height` 가 아래로 판다
 *
 * `falloff` 는 감쇠 지수다 (없으면 1). 클수록 가장자리가 빨리 0 으로 떨어진다.
 */
export interface StampOp {
  id: string;
  kind: 'stamp';
  stamp: 'hill' | 'ridge' | 'basin';
  center: XZ;
  radius: number;
  height: number;
  falloff?: number;
}

/**
 * 중심선 하나를 따라 흐르는 편집 — `points` 의 polyline 에서 `width / 2` 안쪽에만 닿는다.
 *
 * `profile` 이 없으면 높이를 건드리지 않는 **표시선**이다 (자리에 이름만 붙인다).
 *   carve   중심선을 따라 `depth` 만큼 판다 (양수 = 아래로)
 * 다른 profile 은 그 요구가 오는 사용처가 더한다.
 */
export interface CurveOp {
  id: string;
  kind: 'curve';
  layer: string;
  tag: string;
  /** 중심선 polyline — 2점 이상이어야 뜻이 있다 */
  points: XZ[];
  /** 전체 폭 (중심선에서 좌우 width / 2) */
  width: number;
  profile?: 'carve';
  /** carve 가 파는 깊이 (양수 = 아래로) */
  depth?: number;
}

/** 자리의 **범위**에 이름을 붙이는 편집 — 높이를 건드리지 않는다. 조회로만 쓰인다 */
export interface AreaOp {
  id: string;
  kind: 'area';
  layer: string;
  tag: string;
  shape: { kind: 'polygon'; points: XZ[] } | { kind: 'circle'; center: XZ; radius: number };
}

export type RegionOp = PointOp | StampOp | CurveOp | AreaOp;

/** 하나의 Local Space — identity(id · extent · seed) + 순서 있는 편집 목록 */
export interface RegionDescription {
  id: string;
  extent: Extent;
  /** 컴파일 재현의 열쇠 — 세계 State 가 아니다 */
  seed: number;
  /** 순서 있는 편집. 순서가 다르면 다른 Description 이다 */
  ops: readonly RegionOp[];
}

/** 경계 포함 — 변 위의 점은 안에 있는 것으로 친다 */
export function extentContains(extent: Extent, p: XZ): boolean {
  return p.x >= extent.minX && p.x <= extent.maxX && p.z >= extent.minZ && p.z <= extent.maxZ;
}

/**
 * 네 꼭짓점 — 그리기용. (minX, minZ) 에서 출발해 x 를 먼저 늘리고 z 를 늘리는 순서로
 * 일관되게 돈다 (위에서 내려다본 지면 기준 한 방향).
 */
export function extentPolygon(extent: Extent): XZ[] {
  return [
    { x: extent.minX, z: extent.minZ },
    { x: extent.maxX, z: extent.minZ },
    { x: extent.maxX, z: extent.maxZ },
    { x: extent.minX, z: extent.maxZ },
  ];
}

export function extentCenter(extent: Extent): XZ {
  return { x: (extent.minX + extent.maxX) / 2, z: (extent.minZ + extent.maxZ) / 2 };
}

/** 그 layer 의 point 들 — ops 순서 그대로 */
export function pointsOf(d: RegionDescription, layer: string): PointOp[] {
  const out: PointOp[] = [];
  for (const op of d.ops) {
    if (op.kind === 'point' && op.layer === layer) out.push(op);
  }
  return out;
}

/** 그 layer 의 area 들 — ops 순서 그대로 */
export function areasOf(d: RegionDescription, layer: string): AreaOp[] {
  const out: AreaOp[] = [];
  for (const op of d.ops) {
    if (op.kind === 'area' && op.layer === layer) out.push(op);
  }
  return out;
}

/** 그 (layer, tag) 의 curve 들 — ops 순서 그대로 */
export function curvesOf(d: RegionDescription, layer: string, tag: string): CurveOp[] {
  const out: CurveOp[] = [];
  for (const op of d.ops) {
    if (op.kind === 'curve' && op.layer === layer && op.tag === tag) out.push(op);
  }
  return out;
}

/**
 * 중심선까지의 최단 거리 — 점이 아니라 **선분**까지의 거리다 (꺾인 곳에서도 값이 이어진다).
 * points 가 2점 미만이면 잴 선분이 없으므로 Infinity — "닿지 않는다" 로 읽힌다.
 */
export function distanceToPolyline(points: readonly XZ[], x: number, z: number): number {
  if (points.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const d = distanceToSegment(a, b, x, z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 중심선 polyline 을 폭만큼 부풀린 **닫힌 다각형 하나** (C013 ADDED).
 *
 * 각 선분의 법선으로 좌우 `width / 2` 만큼 밀어 낸 점들을 만들고, 왼쪽 가장자리를 앞으로,
 * 오른쪽 가장자리를 뒤로 이어 하나의 고리로 돌려준다 — 곧은 두 점이면 정확히 사각형이다.
 *
 * 꼭짓점은 선분마다 좌우 점을 그대로 이어 붙인 것이다 (miter 조인 같은 것을 만들지 않는다).
 * 각이 급한 모서리에서 살짝 겹치는 것은 지면에 띠를 그리는 쓰임에서 문제가 되지 않는다.
 *
 * 점이 둘 미만이거나 `width <= 0` 이면 빈 배열 — 부풀릴 것이 없다 (지어내지 않는다).
 * 길이 0 인 선분(같은 점이 이어진 것)은 건너뛴다 — 0 으로 나누지 않는다.
 */
export function polylineStrip(points: readonly XZ[], width: number): XZ[] {
  if (points.length < 2 || !(width > 0)) return [];
  const half = width / 2;
  const left: XZ[] = [];
  const right: XZ[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0) continue;
    // 진행 방향에 수직인 단위 법선 — 왼쪽이 +, 오른쪽이 -
    const nx = (-dz / length) * half;
    const nz = (dx / length) * half;
    // 첫 유효 선분에서만 시작점을 넣는다 — 이어지는 선분은 끝점만 더해 고리가 2N 점이 된다
    if (left.length === 0) {
      left.push({ x: a.x + nx, z: a.z + nz });
      right.push({ x: a.x - nx, z: a.z - nz });
    }
    left.push({ x: b.x + nx, z: b.z + nz });
    right.push({ x: b.x - nx, z: b.z - nz });
  }
  if (left.length < 2) return [];
  return [...left, ...right.reverse()];
}

/** curve 여럿 가운데 가장 가까운 중심선까지의 거리 — 하나도 없으면 Infinity */
export function nearestCurveDistance(curves: readonly CurveOp[], x: number, z: number): number {
  let best = Infinity;
  for (const curve of curves) {
    const d = distanceToPolyline(curve.points, x, z);
    if (d < best) best = d;
  }
  return best;
}

/** 선분 ab 위로 자리를 투영해 [0, 1] 로 자른다 — 길이가 0 이면 점까지의 거리다 */
function distanceToSegment(a: XZ, b: XZ, x: number, z: number): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0) return Math.hypot(x - a.x, z - a.z);
  let t = ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

/** (layer, tag) 의 첫 point — 없으면 undefined */
export function findPoint(d: RegionDescription, layer: string, tag: string): PointOp | undefined {
  for (const op of d.ops) {
    if (op.kind === 'point' && op.layer === layer && op.tag === tag) return op;
  }
  return undefined;
}

// ── 결정적 hash ──────────────────────────────────────────────────────
//
// "같은 Description → 같은 값" 만이 의미다 (01-spec UNRESOLVED 판정). 산법은 기구의 것 —
// 객체 키를 정렬한 정규화 JSON 위의 FNV-1a 32bit. 키 순서·공백·undefined 필드에 흔들리지
// 않고, 배열(ops) 순서에는 흔들린다 — 편집 순서는 Description 의 일부다.

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}

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

/** 같은 Description → 같은 값. 8자리 소문자 hex */
export function descriptionHash(d: RegionDescription): string {
  return fnv1a32(canonical(d)).toString(16).padStart(8, '0');
}
