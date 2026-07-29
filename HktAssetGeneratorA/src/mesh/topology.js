// 위상 검사 — 비매니폴드·개방 경계·3D degenerate·부호 부피 (02-architecture §6).
// 비매니폴드는 "위치 기준 병합 후" 판정 — seam/crease 복제 정점은 같은 정점으로 본다.

import { sub3, cross3, dot3, length3 } from "../core/math.js";

const POS_GRID = 1e7;

function weldMap(mesh) {
  const count = mesh.positions.length / 3;
  const idOf = new Int32Array(count);
  const seen = new Map();
  let next = 0;
  for (let i = 0; i < count; i++) {
    const key =
      Math.round(mesh.positions[i * 3] * POS_GRID) + "," +
      Math.round(mesh.positions[i * 3 + 1] * POS_GRID) + "," +
      Math.round(mesh.positions[i * 3 + 2] * POS_GRID);
    let id = seen.get(key);
    if (id === undefined) { id = next++; seen.set(key, id); }
    idOf[i] = id;
  }
  return idOf;
}

/**
 * @returns {{nonManifoldEdges:number, boundaryEdges:number}}
 * nonManifoldEdges: 3개 이상 삼각형이 공유하는 엣지 수.
 * boundaryEdges: 1개 삼각형만 쓰는 엣지 수 (개방 경계 — 부품별 기대 개수와 대조할 것).
 */
export function analyzeManifold(mesh) {
  const weld = weldMap(mesh);
  const edgeUse = new Map();
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const w = [weld[mesh.indices[f]], weld[mesh.indices[f + 1]], weld[mesh.indices[f + 2]]];
    for (let e = 0; e < 3; e++) {
      const a = w[e];
      const b = w[(e + 1) % 3];
      if (a === b) continue; // 병합상 퇴화 엣지는 degenerate 검사가 잡는다
      const key = a < b ? a + "|" + b : b + "|" + a;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }
  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const uses of edgeUse.values()) {
    if (uses > 2) nonManifoldEdges++;
    else if (uses === 1) boundaryEdges++;
  }
  return { nonManifoldEdges, boundaryEdges };
}

/** 3D 면적 < 1e-10 m² 인 삼각형 수 — 생성기가 만들면 버그 (D-2). */
export function countDegenerate3DTriangles(mesh) {
  let count = 0;
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const [a, b, c] = [mesh.indices[f], mesh.indices[f + 1], mesh.indices[f + 2]];
    const pa = [mesh.positions[a * 3], mesh.positions[a * 3 + 1], mesh.positions[a * 3 + 2]];
    const pb = [mesh.positions[b * 3], mesh.positions[b * 3 + 1], mesh.positions[b * 3 + 2]];
    const pc = [mesh.positions[c * 3], mesh.positions[c * 3 + 1], mesh.positions[c * 3 + 2]];
    const area = length3(cross3(sub3(pb, pa), sub3(pc, pa))) / 2;
    if (area < 1e-10) count++;
  }
  return count;
}

/** 닫힌 메시의 부호 부피 — 양수면 감김이 일관되게 바깥(CCW)을 향한다. */
export function signedVolume(mesh) {
  let vol = 0;
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const [a, b, c] = [mesh.indices[f], mesh.indices[f + 1], mesh.indices[f + 2]];
    const pa = [mesh.positions[a * 3], mesh.positions[a * 3 + 1], mesh.positions[a * 3 + 2]];
    const pb = [mesh.positions[b * 3], mesh.positions[b * 3 + 1], mesh.positions[b * 3 + 2]];
    const pc = [mesh.positions[c * 3], mesh.positions[c * 3 + 1], mesh.positions[c * 3 + 2]];
    vol += dot3(pa, cross3(pb, pc)) / 6;
  }
  return vol;
}
