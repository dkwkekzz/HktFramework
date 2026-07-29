// 검 전체 고정 Atlas — 아일랜드 단위 레이아웃 (04-phase2 §2.4, D-1·D-8).
// 레이아웃 숫자를 조정하면 generatorVersion 을 올리고 golden 을 갱신할 것.

import { recalculateMeshTangents } from "../mesh/builder.js";

// key = `${partId}/${islandId}`
export const SWORD_ATLAS_LAYOUT = {
  "0/0": { offset: [0.00, 0.62], scale: [1.00, 0.38] }, // blade/body
  "0/1": { offset: [0.00, 0.52], scale: [0.08, 0.08] }, // blade/rootCap
  "1/0": { offset: [0.10, 0.27], scale: [0.28, 0.23] }, // guard/front
  "1/1": { offset: [0.40, 0.27], scale: [0.28, 0.23] }, // guard/back
  "1/2": { offset: [0.70, 0.27], scale: [0.28, 0.10] }, // guard/side
  "2/0": { offset: [0.00, 0.00], scale: [0.45, 0.25] }, // grip/body
  "3/0": { offset: [0.47, 0.00], scale: [0.30, 0.25] }, // pommel/body
};

export const ATLAS_PADDING_PIXELS = 8;
// D-8 부분 보정: 방향 간 텍셀 밀도 이방성 상한. 완전 균등화(1.0)는 Atlas 공간을 크게
// 낭비하므로 2.0 으로 상한만 건다 — letterbox 는 밀도가 높은 축을 축소하는 방향으로만.
const ANISOTROPY_CAP = 2.0;

/**
 * 부품 메시들의 uvLocal → uvAtlas 배치 + 종횡비 보정 + 탄젠트 재계산 (D-9).
 * @param meshes GeneratedMesh[] (부품별)
 */
export function applySwordAtlasUV(meshes, textureSize) {
  const pad = ATLAS_PADDING_PIXELS / textureSize;
  for (const mesh of meshes) {
    const { partId, islandId } = mesh.attributes;
    // 아일랜드별 metric bbox (실측 종횡비의 근거)
    const metricBox = new Map();
    for (let i = 0; i < islandId.length; i++) {
      const key = `${partId[i]}/${islandId[i]}`;
      let box = metricBox.get(key);
      if (!box) { box = { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity }; metricBox.set(key, box); }
      const mu = mesh.uvMetric[i * 2], mv = mesh.uvMetric[i * 2 + 1];
      if (mu < box.minU) box.minU = mu;
      if (mu > box.maxU) box.maxU = mu;
      if (mv < box.minV) box.minV = mv;
      if (mv > box.maxV) box.maxV = mv;
    }
    // 아일랜드별 실제 배치 스케일 결정
    const placement = new Map();
    for (const [key, box] of metricBox) {
      const region = SWORD_ATLAS_LAYOUT[key];
      if (!region) throw new Error(`Atlas 레이아웃에 없는 아일랜드: ${key}`);
      const innerW = region.scale[0] - pad * 2;
      const innerH = region.scale[1] - pad * 2;
      const metricW = Math.max(box.maxU - box.minU, 1e-9);
      const metricH = Math.max(box.maxV - box.minV, 1e-9);
      let densU = innerW / metricW; // 영역이 주는 방향별 밀도 (uv/metric)
      let densV = innerH / metricH;
      if (densV > densU * ANISOTROPY_CAP) densV = densU * ANISOTROPY_CAP;
      if (densU > densV * ANISOTROPY_CAP) densU = densV * ANISOTROPY_CAP;
      placement.set(key, {
        offset: [region.offset[0] + pad, region.offset[1] + pad],
        scale: [densU * metricW, densV * metricH], // ≤ inner (letterbox — 늘리지 않음)
      });
    }
    for (let i = 0; i < islandId.length; i++) {
      const p = placement.get(`${partId[i]}/${islandId[i]}`);
      mesh.uvAtlas[i * 2] = p.offset[0] + mesh.uvLocal[i * 2] * p.scale[0];
      mesh.uvAtlas[i * 2 + 1] = p.offset[1] + mesh.uvLocal[i * 2 + 1] * p.scale[1];
    }
    recalculateMeshTangents(mesh);
  }
}

// 병합에 실어 나르는 정점 속성 — 검증(partId/islandId)과 베이크(의미값 전체)가 공용
const MERGE_ATTRS = [
  "partId", "islandId", "longitudinal", "perimeter",
  "edgeWeight", "ridgeWeight", "fullerWeight", "contactWeight", "curvature", "cavity",
];

/**
 * UV 검사·베이크 공용 병합 메시 (04-phase2 §2.6, 05-phase3 §3.3).
 * 위치는 로컬 그대로 병합(강체 변환은 텍셀 밀도·베이크에 영향 없음).
 */
export function mergeForValidation(meshes) {
  let vertexCount = 0, indexCount = 0;
  for (const m of meshes) { vertexCount += m.positions.length / 3; indexCount += m.indices.length; }
  const merged = {
    positions: new Float32Array(vertexCount * 3),
    uvAtlas: new Float32Array(vertexCount * 2),
    uvLocal: new Float32Array(vertexCount * 2),
    uvMetric: new Float32Array(vertexCount * 2),
    indices: new Uint32Array(indexCount),
    attributes: Object.fromEntries(MERGE_ATTRS.map((k) => [k, new Float32Array(vertexCount)])),
  };
  let vOffset = 0, iOffset = 0;
  for (const m of meshes) {
    const count = m.positions.length / 3;
    merged.positions.set(m.positions, vOffset * 3);
    merged.uvAtlas.set(m.uvAtlas, vOffset * 2);
    merged.uvLocal.set(m.uvLocal, vOffset * 2);
    merged.uvMetric.set(m.uvMetric, vOffset * 2);
    for (const k of MERGE_ATTRS) merged.attributes[k].set(m.attributes[k], vOffset);
    for (let i = 0; i < m.indices.length; i++) merged.indices[iOffset + i] = m.indices[i] + vOffset;
    vOffset += count;
    iOffset += m.indices.length;
  }
  return merged;
}
