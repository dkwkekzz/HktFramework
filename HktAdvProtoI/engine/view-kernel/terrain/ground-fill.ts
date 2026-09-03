// 지면 구역의 **채움** — 지형을 따라가는 면을 만든다.
//
// 이 층은 그것이 무엇의 구역인지 모른다 (설계 반전 ⑤). 모양과 지면 높이를 받아
// "그 지면에 붙은 면" 하나를 돌려줄 뿐이다.
//
// 왜 나누는가: 지면에 드리우는 것은 **이미 있는 vertex 를 그 자리의 높이로 올리는** 일이라,
// 면이 vertex 몇 개짜리면 그 사이는 평평한 판으로 남는다. 사각 바닥은 꼭짓점 넷이므로
// 한쪽만 올라간 기울어진 판이 되어 지형을 뚫고 떠오른다.
//
// 왜 외곽선을 촘촘히 하는 것으로는 모자란가 (실측): 40×40 사각 외곽선을 1 눈금으로 늘려
// (vertex 4 → 160) three 의 삼각분할에 넣어도 삼각형의 최장 변은 56.57 → 55.17 로 거의
// 그대로다. 삼각분할은 외곽선의 점만 쓰므로 **안쪽에 vertex 가 생기지 않는다.**
// 그래서 삼각분할 자체는 three 에게 맡기고(오목한 폴리곤도 그쪽이 안다), 그 결과를
// 변의 중점으로 **고르게 접어** 안쪽 vertex 를 만든다. 중점은 두 삼각형이 같은 키로
// 나눠 가지므로 T 자 이음(틈)이 생기지 않는다.

import * as THREE from 'three';

/** 한 면을 나눌 때의 삼각형 상한 — 프레임마다 다시 만드는 면이라 폭주를 막는다 */
const MAX_TRIANGLES = 20000;

/** 원판을 둘레로 나눌 때의 최소·최대 분할 수 */
const CIRCLE_MIN_SEGMENTS = 16;
const CIRCLE_MAX_SEGMENTS = 256;

export type GroundFillShape =
  | { kind: 'polygon'; points: readonly { x: number; z: number }[] }
  | { kind: 'circle'; center: { x: number; z: number }; radius: number };

export interface GroundFillOptions {
  /** 이보다 긴 변이 남지 않을 때까지 나눈다 (세계 단위) */
  step: number;
  /** 지면에 묻히지 않도록 띄우는 높이 */
  lift: number;
  /** 그 자리의 지면 높이 */
  heightAt: (x: number, z: number) => number;
}

/**
 * 지면을 따라가는 채움 면 하나 — 세계 좌표의 기하다 (mesh 를 옮기지 않는다).
 * 높이가 어디서나 0 이면 결과는 lift 만큼 띄운 평면이다 — 나누기 전과 같은 면이다.
 */
export function createGroundFill(
  shape: GroundFillShape,
  options: GroundFillOptions,
): THREE.BufferGeometry {
  const base = baseGeometry(shape, options.step);
  const geometry = subdivided(base, options.step);
  if (geometry !== base) base.dispose();

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, options.heightAt(position.getX(i), position.getZ(i)) + options.lift);
  }
  position.needsUpdate = true;
  return geometry;
}

/** 모양을 지면(XZ) 위의 삼각형으로 — 삼각분할은 three 의 것을 쓴다 */
function baseGeometry(shape: GroundFillShape, step: number): THREE.BufferGeometry {
  if (shape.kind === 'circle') {
    // CircleGeometry 는 가운데에서 뻗은 부채꼴이라 **안쪽에 vertex 가 없다**. 안쪽 고리를
    // 가진 RingGeometry(안지름 0) 를 눈금에 맞춰 쓴다 — 접지 않아도 이미 잘게 나뉜다.
    const rings = Math.max(1, Math.ceil(shape.radius / Math.max(1e-6, step)));
    const segments = Math.min(
      CIRCLE_MAX_SEGMENTS,
      Math.max(CIRCLE_MIN_SEGMENTS, Math.ceil((2 * Math.PI * shape.radius) / Math.max(1e-6, step))),
    );
    const disc = new THREE.RingGeometry(0, shape.radius, segments, rings);
    disc.rotateX(-Math.PI / 2);
    disc.translate(shape.center.x, 0, shape.center.z);
    return disc;
  }
  // Shape 는 XY 평면에 놓이고 rotateX(-π/2) 가 y → -z 로 보내므로 z 를 뒤집어 넣는다.
  const outline = new THREE.Shape(shape.points.map((p) => new THREE.Vector2(p.x, -p.z)));
  const geometry = new THREE.ShapeGeometry(outline);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * 모든 변이 step 이하가 될 때까지 삼각형을 중점으로 접는다 (한 번에 넷).
 * 이미 충분히 잘면 받은 것을 그대로 돌려준다 — 그때는 전과 결과가 같다.
 */
function subdivided(geometry: THREE.BufferGeometry, step: number): THREE.BufferGeometry {
  const source = geometry.getAttribute('position');
  let positions: number[] = Array.from(source.array as ArrayLike<number>);
  const sourceIndex = geometry.getIndex();
  let indices: number[] = sourceIndex
    ? Array.from(sourceIndex.array as ArrayLike<number>)
    : Array.from({ length: source.count }, (_, i) => i);

  let folded = false;
  const limit = Math.max(1e-6, step);
  while (longestEdge(positions, indices) > limit && indices.length * 4 <= MAX_TRIANGLES * 3) {
    const next = foldOnce(positions, indices);
    positions = next.positions;
    indices = next.indices;
    folded = true;
  }
  if (!folded) return geometry;

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setIndex(indices);
  return out;
}

function longestEdge(positions: readonly number[], indices: readonly number[]): number {
  let worst = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    worst = Math.max(
      worst,
      edgeLength(positions, a, b),
      edgeLength(positions, b, c),
      edgeLength(positions, c, a),
    );
  }
  return worst;
}

function edgeLength(positions: readonly number[], a: number, b: number): number {
  return Math.hypot(
    positions[a * 3]! - positions[b * 3]!,
    positions[a * 3 + 1]! - positions[b * 3 + 1]!,
    positions[a * 3 + 2]! - positions[b * 3 + 2]!,
  );
}

/** 삼각형마다 세 변의 중점을 만들어 넷으로 나눈다 — 중점은 이웃과 나눠 갖는다 */
function foldOnce(
  positions: readonly number[],
  indices: readonly number[],
): { positions: number[]; indices: number[] } {
  const out = [...positions];
  const next: number[] = [];
  // 변의 키는 두 vertex 색인(작은 쪽 먼저) — 이웃한 삼각형이 같은 중점을 얻는다
  const midpoints = new Map<string, number>();

  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const found = midpoints.get(key);
    if (found !== undefined) return found;
    const index = out.length / 3;
    out.push(
      (positions[a * 3]! + positions[b * 3]!) / 2,
      (positions[a * 3 + 1]! + positions[b * 3 + 1]!) / 2,
      (positions[a * 3 + 2]! + positions[b * 3 + 2]!) / 2,
    );
    midpoints.set(key, index);
    return index;
  };

  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    // 감는 방향은 그대로 이어진다 — 앞뒤가 뒤집히지 않는다
    next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { positions: out, indices: next };
}
