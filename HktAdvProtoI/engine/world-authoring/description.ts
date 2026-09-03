// World Authoring — Region Description (C001 ADDED).
//
// 하나의 Local Space 를 적는 **Source of Truth** 다. 컴파일도 그리기도 전부 이것의 파생이다
// (design/Plan-World-Authoring-Engine.md §3.1). 여기에는 게임 명사가 없다 — layer 와 tag 는
// 컨텐츠가 짓는 불투명 문자열이고, 기반은 뜻을 모른 채 **조회만** 제공한다.
//
// op 는 요구가 실제로 온 것만 있다 — 지금은 point 와 stamp 둘. curve · area 는 그 요구가
// 오는 다음 사용처가 더한다 — 여기서 미리 형을 열어 두지 않는다.

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

export type RegionOp = PointOp | StampOp;

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
