// CPU UV 래스터라이저 — 베이크의 심장 (D-4, 05-phase3 §3.3).
// Atlas UV 공간에서 2D 삼각형을 edge function 으로 채우고 정점 속성을 무게중심 보간,
// 프래그먼트 함수를 픽셀당 1회 평가한다. top-left rule 로 공유 엣지 이중 채움을 막는다
// — 이 규칙 자체가 결정성의 일부다.

// 보간 속성 목록 (frag 에 노출되는 이름)
const INTERP = [
  ["uvMetricU", (m, i) => m.uvMetric[i * 2]],
  ["uvMetricV", (m, i) => m.uvMetric[i * 2 + 1]],
  ["uvLocalU", (m, i) => m.uvLocal[i * 2]],
  ["uvLocalV", (m, i) => m.uvLocal[i * 2 + 1]],
  ["edgeWeight", (m, i) => m.attributes.edgeWeight[i]],
  ["ridgeWeight", (m, i) => m.attributes.ridgeWeight[i]],
  ["fullerWeight", (m, i) => m.attributes.fullerWeight[i]],
  ["contactWeight", (m, i) => m.attributes.contactWeight[i]],
  ["curvature", (m, i) => m.attributes.curvature[i]],
  ["cavity", (m, i) => m.attributes.cavity[i]],
];

/**
 * @param mesh   병합 메시 (uvAtlas·uvLocal·uvMetric·attributes 필요 — atlas.mergeForValidation 확장판)
 * @param size   텍스처 한 변
 * @param shade  (frag) => void — frag.out.* 에 채널 값 기록
 * @param targets {{ color: Float32Array(size²*4), rough, metal, ao, height: Float32Array(size²) }}
 * @returns {{ coverage: Uint8Array, island: Int32Array }} — dilate·normal 이 사용
 */
export function rasterizeUV(mesh, size, shade, targets) {
  const coverage = new Uint8Array(size * size);
  const island = new Int32Array(size * size).fill(-1);
  const { partId, islandId } = mesh.attributes;
  const uv = mesh.uvAtlas;

  const frag = {
    x: 0, y: 0, partId: 0, islandId: 0,
    uvMetricU: 0, uvMetricV: 0, uvLocalU: 0, uvLocalV: 0,
    edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0, contactWeight: 0,
    curvature: 0, cavity: 0,
    out: { r: 0, g: 0, b: 0, rough: 0, metal: 0, ao: 1, height: 0 },
  };

  const triCount = mesh.indices.length / 3;
  for (let t = 0; t < triCount; t++) {
    let ia = mesh.indices[t * 3], ib = mesh.indices[t * 3 + 1], ic = mesh.indices[t * 3 + 2];
    // 픽셀 좌표 (텍셀 중심 기준은 샘플 시 +0.5)
    let ax = uv[ia * 2] * size, ay = uv[ia * 2 + 1] * size;
    let bx = uv[ib * 2] * size, by = uv[ib * 2 + 1] * size;
    let cx = uv[ic * 2] * size, cy = uv[ic * 2 + 1] * size;
    // CCW 정규화 (면적 양수)
    let area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;
    if (area < 0) {
      [ib, ic] = [ic, ib];
      [bx, cx] = [cx, bx];
      [by, cy] = [cy, by];
      area = -area;
    }
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));

    // edge function: 엣지 P→Q 에 대해 E(p) = (P.y-Q.y)px + (Q.x-P.x)py + c —
    // CCW 삼각형 내부에서 세 값 모두 양수 (E(반대 정점) = 2×면적 > 0).
    // top-left rule (y-up): 왼쪽 엣지 = 올라가는 엣지(Q.y > P.y),
    // 위 엣지 = 수평이며 왼쪽으로 가는 엣지(Q.y == P.y && Q.x < P.x) 만 경계 포함.
    const e = [
      [ax, ay, bx, by], // AB → C 가중
      [bx, by, cx, cy], // BC → A 가중
      [cx, cy, ax, ay], // CA → B 가중
    ].map(([px0, py0, qx, qy]) => {
      const a = py0 - qy;
      const b = qx - px0;
      return {
        a, b,
        c: -(a * px0 + b * py0),
        topLeft: qy > py0 || (qy === py0 && qx < px0),
      };
    });

    // 정점 속성 사전 로드
    const attrA = INTERP.map(([, get]) => get(mesh, ia));
    const attrB = INTERP.map(([, get]) => get(mesh, ib));
    const attrC = INTERP.map(([, get]) => get(mesh, ic));
    const fragPartId = partId[ia];       // 정수 속성은 평면 보간 없이 첫 정점 값
    const fragIslandId = islandId[ia];
    const islandKey = fragPartId * 1000 + fragIslandId;

    for (let py = minY; py <= maxY; py++) {
      const sy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5;
        const w0 = e[1].a * sx + e[1].b * sy + e[1].c; // BC → A 가중
        const w1 = e[2].a * sx + e[2].b * sy + e[2].c; // CA → B 가중
        const w2 = e[0].a * sx + e[0].b * sy + e[0].c; // AB → C 가중
        if (!(w0 > 0 || (w0 === 0 && e[1].topLeft))) continue;
        if (!(w1 > 0 || (w1 === 0 && e[2].topLeft))) continue;
        if (!(w2 > 0 || (w2 === 0 && e[0].topLeft))) continue;

        const inv = 1 / area;
        const l0 = w0 * inv, l1 = w1 * inv, l2 = w2 * inv;
        frag.x = px; frag.y = py;
        frag.partId = fragPartId;
        frag.islandId = fragIslandId;
        for (let k = 0; k < INTERP.length; k++) {
          frag[INTERP[k][0]] = attrA[k] * l0 + attrB[k] * l1 + attrC[k] * l2;
        }
        shade(frag);

        const idx = py * size + px;
        targets.color[idx * 4] = frag.out.r;
        targets.color[idx * 4 + 1] = frag.out.g;
        targets.color[idx * 4 + 2] = frag.out.b;
        targets.color[idx * 4 + 3] = 1;
        targets.rough[idx] = frag.out.rough;
        targets.metal[idx] = frag.out.metal;
        targets.ao[idx] = frag.out.ao;
        targets.height[idx] = frag.out.height;
        coverage[idx] = 1;
        island[idx] = islandKey;
      }
    }
  }
  return { coverage, island };
}
