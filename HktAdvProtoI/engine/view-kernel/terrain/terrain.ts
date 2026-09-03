// 3D Terrain — **컴파일된 지형**을 그리고, 그 지형의 높이를 잰다.
//
// 높이는 함수가 아니라 주어지는 격자다. 그리는 것도 재는 것도 같은 컴파일 결과에서 나오므로
// 눈에 보이는 지면과 높이를 물어 얻는 값이 어긋나지 않는다
// (design/Plan-World-Authoring-Engine.md §3.2).
//
// 이 층은 자기가 무엇을 그리는지 모른다 (설계 반전 ⑤). surface 태그는 불투명 문자열이고,
// 그것을 색으로 옮기는 것은 인자로 오는 palette 의 몫이다.

import * as THREE from 'three';
import type { CompiledViewTerrain, CompiledWorldTerrain } from '../../world-authoring/compiled';

/**
 * 법선을 잇기 위해 세계 좌표를 키로 만들 때의 눈금 (세계 단위).
 *
 * 격자 색인(정수)이 있으면 그것을 쓰는 편이 낫지만 CompiledViewTerrain 에는 extent 도
 * resolution 도 없다 — chunk 가 들고 오는 것은 세계 좌표뿐이다. 그래서 좌표를 이 눈금으로
 * 양자화해 정수 키로 만든다. 부동소수 좌표를 그대로 문자열로 쓰면 -0 과 0 이 갈리고
 * 미세 오차가 다른 자리로 보이므로 키가 되지 못한다 (Math.round 를 거치면 -0 도 "0" 이 된다).
 *
 * 눈금은 격자 칸보다 한참 작고 자리 오차보다는 크게 잡는다 — 이웃한 vertex 를 같은 자리로
 * 뭉치지 않으면서, 같은 자리를 두 chunk 가 적어 온 것은 하나로 본다.
 */
const WELD_QUANTUM = 1e-3;

function weldKey(x: number, z: number): string {
  return `${Math.round(x / WELD_QUANTUM)}|${Math.round(z / WELD_QUANTUM)}`;
}

/** surface 태그 → 색. 모르는 태그에는 기본색을 돌려주면 된다 — 기반은 태그의 뜻을 모른다 */
export interface TerrainPalette {
  colorOf(surfaceTag: string): number;
}

/**
 * 컴파일된 지형 하나를 그린다 — chunk 마다 mesh 하나, vertex color 는 surface 태그에서.
 *
 * chunk 의 positions 는 세계 좌표의 (x, y, z) 셋씩이다 — CompiledViewTerrain 에는 extent 가
 * 없으므로 위치를 되살릴 다른 근거가 없다. ix · iz 는 chunk 를 가리키는 이름일 뿐이다.
 * vertex 격자는 row-major (z 바깥 · x 안쪽) 이며, 이웃한 chunk 는 경계 vertex 를 공유한다.
 *
 * 자리를 공유하는 vertex 는 법선도 공유한다 — 그리기 단위로 자른 자국이 음영으로 비치지
 * 않게 하려면 chunk 안에서 잰 법선을 그 자리에서 다시 모아야 한다 (weldSharedNormals).
 */
export function createTerrain(view: CompiledViewTerrain, palette: TerrainPalette): THREE.Object3D {
  // 태그마다 한 번만 묻는다 — 같은 표를 vertex 수만큼 다시 뒤지지 않는다.
  const tagColors = view.surfaceTags.map((tag) => new THREE.Color(palette.colorOf(tag)));
  const fallback = new THREE.Color(0xffffff); // surface 색인이 표 밖일 때 (컴파일 결과가 어긋난 자리)

  const group = new THREE.Group();
  group.name = 'terrain-ground';

  for (const chunk of view.chunks) {
    const count = chunk.cols * chunk.rows;
    if (count <= 0) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(chunk.positions, 3));

    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const color = tagColors[chunk.surface[i] ?? -1] ?? fallback;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // 칸마다 삼각형 둘. 위(+Y)에서 보아 앞면이 되도록 감는다.
    const cells = Math.max(0, chunk.cols - 1) * Math.max(0, chunk.rows - 1);
    if (cells > 0) {
      const indices = count > 65535 ? new Uint32Array(cells * 6) : new Uint16Array(cells * 6);
      let n = 0;
      for (let r = 0; r < chunk.rows - 1; r++) {
        for (let c = 0; c < chunk.cols - 1; c++) {
          const i0 = r * chunk.cols + c;
          const i1 = i0 + 1;
          const i2 = i0 + chunk.cols;
          const i3 = i2 + 1;
          indices[n++] = i0;
          indices[n++] = i2;
          indices[n++] = i1;
          indices[n++] = i1;
          indices[n++] = i2;
          indices[n++] = i3;
        }
      }
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    // 법선은 chunk 안에서만 계산된다 — 경계 vertex 는 자리를 공유하므로 틈은 없다.
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = `terrain-chunk-${chunk.ix}-${chunk.iz}`;
    group.add(mesh);
  }

  weldSharedNormals(group);
  return group;
}

/**
 * 여러 chunk 가 같은 자리에 적어 온 법선을 하나로 모은다 (평균 → 정규화).
 *
 * 자리는 이미 공유되므로 틈은 없지만, 법선을 chunk 안에서만 재면 경계에서 값이 갈려
 * 음영에 자국이 남는다. 그 자국만 지운다 — **자리를 나눠 갖지 않은 vertex 는 손대지 않는다**
 * (혼자인 vertex 는 값을 다시 쓰지 않으므로 chunk 가 하나거나 서로 닿지 않으면 결과가 같다).
 */
function weldSharedNormals(group: THREE.Object3D): void {
  if (group.children.length < 2) return; // 나눠 가질 상대가 없다

  interface Sum {
    x: number;
    y: number;
    z: number;
    count: number;
  }
  const sums = new Map<string, Sum>();
  const meshes = group.children as THREE.Mesh[];

  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      const key = weldKey(position.getX(i), position.getZ(i));
      const sum = sums.get(key);
      if (sum) {
        sum.x += normal.getX(i);
        sum.y += normal.getY(i);
        sum.z += normal.getZ(i);
        sum.count++;
      } else {
        sums.set(key, { x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i), count: 1 });
      }
    }
  }

  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    let touched = false;
    for (let i = 0; i < position.count; i++) {
      const sum = sums.get(weldKey(position.getX(i), position.getZ(i)));
      if (!sum || sum.count < 2) continue;
      const length = Math.hypot(sum.x, sum.y, sum.z);
      if (!(length > 0)) continue; // 서로 마주 보는 법선 — 평균이 없다. 재던 값을 둔다
      normal.setXYZ(i, sum.x / length, sum.y / length, sum.z / length);
      touched = true;
    }
    if (touched) normal.needsUpdate = true;
  }
}

/**
 * 그 지형의 높이를 재는 함수 — 격자를 bilinear 로 샘플한다. 격자 밖은 0.
 *
 * 그리는 쪽(chunk)과 재는 쪽(격자)은 같은 height 에서 나오므로 chunk 경계에서도 값이 튀지 않는다.
 */
export function terrainHeightSampler(
  world: CompiledWorldTerrain,
): (x: number, z: number) => number {
  const { extent, resolution, cols, rows, height } = world;
  if (cols < 1 || rows < 1 || !(resolution > 0)) return () => 0;

  return (x, z) => {
    const fx = (x - extent.minX) / resolution;
    const fz = (z - extent.minZ) / resolution;
    // 격자 밖 · 숫자가 아닌 자리는 0 — 부정 비교로 NaN 도 함께 걸러진다.
    if (!(fx >= 0 && fx <= cols - 1 && fz >= 0 && fz <= rows - 1)) return 0;

    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, cols - 1);
    const z1 = Math.min(z0 + 1, rows - 1);
    const tx = fx - x0;
    const tz = fz - z0;

    const h00 = height[z0 * cols + x0] ?? 0;
    const h10 = height[z0 * cols + x1] ?? 0;
    const h01 = height[z1 * cols + x0] ?? 0;
    const h11 = height[z1 * cols + x1] ?? 0;
    const top = h00 + (h10 - h00) * tx;
    const bottom = h01 + (h11 - h01) * tx;
    return top + (bottom - top) * tz;
  };
}
