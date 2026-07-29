// MeshBuilder — 정점·삼각형 축적 + 스무딩 그룹 노멀 + Atlas 기준 탄젠트 + 곡률/캐비티.
// smoothingGroup 은 빌더 내부 전용 — build() 결과(GeneratedMesh)에는 남지 않는다 (03-phase1 §1.2).

import { add3, sub3, scale3, dot3, cross3, normalize3, length3, clamp01, computeBounds3 } from "../core/math.js";

// 위치 병합용 격자 해상도 (02-architecture §6 — 1e-7 격자)
const POS_GRID = 1e7;
const posKey = (x, y, z) =>
  `${Math.round(x * POS_GRID)},${Math.round(y * POS_GRID)},${Math.round(z * POS_GRID)}`;

const ATTR_KEYS = [
  "partId", "islandId", "longitudinal", "perimeter",
  "edgeWeight", "ridgeWeight", "fullerWeight", "contactWeight",
];

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.uvLocal = [];
    this.uvMetric = [];
    this.attrs = Object.fromEntries(ATTR_KEYS.map((k) => [k, []]));
    this.smoothingGroups = [];
    this.indices = [];
    this.normals = null;
    this.curvature = null;
    this.cavity = null;
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  /**
   * @param {{position:number[], uvLocal:number[], uvMetric:number[],
   *          attributes:Object, smoothingGroup:number}} v
   * @returns {number} 정점 인덱스
   */
  addVertex(v) {
    const index = this.vertexCount;
    this.positions.push(v.position[0], v.position[1], v.position[2]);
    this.uvLocal.push(v.uvLocal[0], v.uvLocal[1]);
    this.uvMetric.push(v.uvMetric[0], v.uvMetric[1]);
    for (const k of ATTR_KEYS) this.attrs[k].push(v.attributes[k] ?? 0);
    this.smoothingGroups.push(v.smoothingGroup | 0);
    return index;
  }

  /** CCW(바깥에서 볼 때) 감김. */
  addTriangle(a, b, c) {
    this.indices.push(a, b, c);
  }

  getPosition(i) {
    return [this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]];
  }

  /**
   * 면적 가중 노멀. 같은 위치(1e-7 격자) + 같은 smoothingGroup 인 정점끼리 노멀 공유 —
   * seam 복제(UV 만 다름)는 노멀이 이어지고, crease 복제(그룹 다름)는 갈라진다 (D-6).
   */
  recalculateNormals() {
    const count = this.vertexCount;
    const groupOf = new Array(count);
    const groupAcc = new Map(); // weldKey -> [nx, ny, nz]
    for (let i = 0; i < count; i++) {
      const key = posKey(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]) +
        "|" + this.smoothingGroups[i];
      groupOf[i] = key;
      if (!groupAcc.has(key)) groupAcc.set(key, [0, 0, 0]);
    }
    for (let f = 0; f < this.indices.length; f += 3) {
      const [a, b, c] = [this.indices[f], this.indices[f + 1], this.indices[f + 2]];
      const pa = this.getPosition(a);
      const fn = cross3(sub3(this.getPosition(b), pa), sub3(this.getPosition(c), pa)); // 면적×2 가중
      for (const vi of [a, b, c]) {
        const acc = groupAcc.get(groupOf[vi]);
        acc[0] += fn[0]; acc[1] += fn[1]; acc[2] += fn[2];
      }
    }
    this.normals = new Array(count);
    for (let i = 0; i < count; i++) this.normals[i] = normalize3(groupAcc.get(groupOf[i]));
  }

  /**
   * 곡률·캐비티 근사 (원본 §16.1 + 02 §4).
   * 위치 기준 병합(그룹 무시 — 기하 성질) 후 이웃 노멀 편차와 오목 오프셋을 계산,
   * 병합 그룹의 모든 복제 정점에 같은 값을 준다 (seam/crease 무관하게 연속).
   */
  calculateCurvature() {
    if (!this.normals) throw new Error("recalculateNormals 를 먼저 호출할 것");
    const count = this.vertexCount;
    const weldOf = new Array(count);
    const weldMembers = new Map();
    for (let i = 0; i < count; i++) {
      const key = posKey(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
      weldOf[i] = key;
      if (!weldMembers.has(key)) weldMembers.set(key, []);
      weldMembers.get(key).push(i);
    }
    // 병합 정점 간 이웃 집합 (엣지 기반)
    const neighbors = new Map();
    const link = (ka, kb) => {
      if (ka === kb) return;
      if (!neighbors.has(ka)) neighbors.set(ka, new Set());
      neighbors.get(ka).add(kb);
    };
    for (let f = 0; f < this.indices.length; f += 3) {
      const ks = [weldOf[this.indices[f]], weldOf[this.indices[f + 1]], weldOf[this.indices[f + 2]]];
      link(ks[0], ks[1]); link(ks[1], ks[0]);
      link(ks[1], ks[2]); link(ks[2], ks[1]);
      link(ks[2], ks[0]); link(ks[0], ks[2]);
    }
    // 병합 그룹 대표 노멀 = 멤버 노멀 평균 (crease 로 갈라진 노멀의 평균 — 기하 곡률 목적)
    const weldNormal = new Map();
    const weldPos = new Map();
    for (const [key, members] of weldMembers) {
      let n = [0, 0, 0];
      for (const m of members) n = add3(n, this.normals[m]);
      weldNormal.set(key, normalize3(n));
      weldPos.set(key, this.getPosition(members[0]));
    }
    this.curvature = new Array(count).fill(0);
    this.cavity = new Array(count).fill(0);
    for (const [key, members] of weldMembers) {
      const nb = neighbors.get(key);
      if (!nb || nb.size === 0) continue;
      const myN = weldNormal.get(key);
      const myP = weldPos.get(key);
      let diff = 0;
      let avg = [0, 0, 0];
      let avgDist = 0;
      for (const nk of nb) {
        diff += 1 - dot3(myN, weldNormal.get(nk));
        const np = weldPos.get(nk);
        avg = add3(avg, np);
        avgDist += length3(sub3(np, myP));
      }
      const curvatureValue = clamp01(diff / nb.size);
      avg = scale3(avg, 1 / nb.size);
      avgDist /= nb.size;
      // 이웃 평균이 노멀 방향으로 자기보다 위에 있으면 오목(cavity)
      const offset = dot3(sub3(avg, myP), myN);
      const cavityValue = offset > 0 && avgDist > 1e-12 ? clamp01((offset / avgDist) * 2) : 0;
      for (const m of members) {
        this.curvature[m] = curvatureValue;
        this.cavity[m] = cavityValue;
      }
    }
  }

  /** @returns GeneratedMesh (02-architecture §4). uvAtlas 는 uvLocal 복사본으로 시작. */
  build() {
    if (!this.normals) this.recalculateNormals();
    if (!this.curvature) this.calculateCurvature();
    const count = this.vertexCount;
    const mesh = {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(count * 3),
      tangents: new Float32Array(count * 4),
      indices: new Uint32Array(this.indices),
      uvLocal: new Float32Array(this.uvLocal),
      uvAtlas: new Float32Array(this.uvLocal),
      uvMetric: new Float32Array(this.uvMetric),
      attributes: {},
      bounds: computeBounds3(this.positions),
    };
    for (let i = 0; i < count; i++) {
      mesh.normals[i * 3] = this.normals[i][0];
      mesh.normals[i * 3 + 1] = this.normals[i][1];
      mesh.normals[i * 3 + 2] = this.normals[i][2];
    }
    for (const k of ATTR_KEYS) mesh.attributes[k] = new Float32Array(this.attrs[k]);
    mesh.attributes.curvature = new Float32Array(this.curvature);
    mesh.attributes.cavity = new Float32Array(this.cavity);
    recalculateMeshTangents(mesh); // 임시(uvAtlas=uvLocal) — Atlas 적용 후 재호출이 규약 (D-9)
    return mesh;
  }
}

/**
 * Atlas UV 기준 탄젠트 재계산 (D-9) — Atlas 적용 후 반드시 재호출.
 * 병합 키 = 위치 + 노멀: 같은 노멀(=같은 스무딩 그룹 결과)인 복제 정점끼리 탄젠트를 공유해
 * seam 에서 탄젠트가 갈라지지 않게 한다.
 */
export function recalculateMeshTangents(mesh) {
  const count = mesh.positions.length / 3;
  const keyOf = new Array(count);
  const acc1 = new Map(); // key -> tan1 누적
  const acc2 = new Map();
  const NORMAL_GRID = 1e4;
  for (let i = 0; i < count; i++) {
    const key =
      posKey(mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]) + "|" +
      Math.round(mesh.normals[i * 3] * NORMAL_GRID) + "," +
      Math.round(mesh.normals[i * 3 + 1] * NORMAL_GRID) + "," +
      Math.round(mesh.normals[i * 3 + 2] * NORMAL_GRID);
    keyOf[i] = key;
    if (!acc1.has(key)) { acc1.set(key, [0, 0, 0]); acc2.set(key, [0, 0, 0]); }
  }
  const uv = mesh.uvAtlas;
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const [a, b, c] = [mesh.indices[f], mesh.indices[f + 1], mesh.indices[f + 2]];
    const pa = [mesh.positions[a * 3], mesh.positions[a * 3 + 1], mesh.positions[a * 3 + 2]];
    const e1 = sub3([mesh.positions[b * 3], mesh.positions[b * 3 + 1], mesh.positions[b * 3 + 2]], pa);
    const e2 = sub3([mesh.positions[c * 3], mesh.positions[c * 3 + 1], mesh.positions[c * 3 + 2]], pa);
    const du1 = uv[b * 2] - uv[a * 2];
    const dv1 = uv[b * 2 + 1] - uv[a * 2 + 1];
    const du2 = uv[c * 2] - uv[a * 2];
    const dv2 = uv[c * 2 + 1] - uv[a * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-20) continue;
    const r = 1 / det;
    const tan1 = scale3(sub3(scale3(e1, dv2), scale3(e2, dv1)), r);
    const tan2 = scale3(sub3(scale3(e2, du1), scale3(e1, du2)), r);
    for (const vi of [a, b, c]) {
      const t1 = acc1.get(keyOf[vi]);
      const t2 = acc2.get(keyOf[vi]);
      t1[0] += tan1[0]; t1[1] += tan1[1]; t1[2] += tan1[2];
      t2[0] += tan2[0]; t2[1] += tan2[1]; t2[2] += tan2[2];
    }
  }
  for (let i = 0; i < count; i++) {
    const n = [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]];
    const t1 = acc1.get(keyOf[i]);
    const t2 = acc2.get(keyOf[i]);
    // Gram-Schmidt 정규직교화
    let t = sub3(t1, scale3(n, dot3(n, t1)));
    if (length3(t) < 1e-12) {
      // 퇴화 UV(폴 등) — 노멀에 직교하는 임의 안정 축
      const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      t = sub3(ref, scale3(n, dot3(n, ref)));
    }
    t = normalize3(t);
    const w = dot3(cross3(n, t), t2) < 0 ? -1 : 1;
    mesh.tangents[i * 4] = t[0];
    mesh.tangents[i * 4 + 1] = t[1];
    mesh.tangents[i * 4 + 2] = t[2];
    mesh.tangents[i * 4 + 3] = w;
  }
}
