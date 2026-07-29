// UV 검증기 — overlap·경계 밖·degenerate·padding·텍셀 밀도 (02-architecture §6 정의 구현).
// overlap = 정점을 공유하지 않는 두 삼각형의 UV 교차 면적 > (0.5텍셀)².

import { sub3, scale3, dot3, cross3, length3 } from "../core/math.js";

const uvOf = (mesh, i) => [mesh.uvAtlas[i * 2], mesh.uvAtlas[i * 2 + 1]];

function triangleAreaUV(a, b, c) {
  return ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
}

// Sutherland-Hodgman: 볼록 클리퍼(삼각형, CCW)로 다각형 클리핑
function clipPolygonByTriangle(poly, tri) {
  let output = poly;
  for (let e = 0; e < 3; e++) {
    const A = tri[e];
    const B = tri[(e + 1) % 3];
    const input = output;
    output = [];
    if (input.length === 0) break;
    const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= 0;
    const intersect = (p, q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-20) return p;
      const t = ((A[0] - p[0]) * ey - (A[1] - p[1]) * ex) / denom;
      return [p[0] + dx * t, p[1] + dy * t];
    };
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) output.push(intersect(prev, cur));
        output.push(cur);
      } else if (prevIn) {
        output.push(intersect(prev, cur));
      }
    }
  }
  return output;
}

function polygonArea(poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

const ccw = (tri) => (triangleAreaUV(tri[0], tri[1], tri[2]) >= 0 ? tri : [tri[0], tri[2], tri[1]]);

/** 02-architecture §6 — 버킷 가속 + SAT 대신 클리핑 면적 직접 판정. */
export function detectUVTriangleOverlaps(mesh, textureSize) {
  const triCount = mesh.indices.length / 3;
  const eps = Math.pow(0.5 / textureSize, 2);
  const GRID = 64;
  const buckets = new Map();
  const aabbs = new Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const ia = mesh.indices[t * 3], ib = mesh.indices[t * 3 + 1], ic = mesh.indices[t * 3 + 2];
    const a = uvOf(mesh, ia), b = uvOf(mesh, ib), c = uvOf(mesh, ic);
    const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
    const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
    aabbs[t] = [minX, minY, maxX, maxY];
    const x0 = Math.max(0, Math.floor(minX * GRID)), x1 = Math.min(GRID - 1, Math.floor(maxX * GRID));
    const y0 = Math.max(0, Math.floor(minY * GRID)), y1 = Math.min(GRID - 1, Math.floor(maxY * GRID));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const key = gy * GRID + gx;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(t);
      }
    }
  }
  const tested = new Set();
  let overlaps = 0;
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const t1 = list[i], t2 = list[j];
        const pairKey = t1 * triCount + t2;
        if (tested.has(pairKey)) continue;
        tested.add(pairKey);
        // AABB 조기 기각
        const A = aabbs[t1], B = aabbs[t2];
        if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) continue;
        // 정점 인덱스 공유 시 인접 — overlap 아님 (02 §6)
        const v1 = [mesh.indices[t1 * 3], mesh.indices[t1 * 3 + 1], mesh.indices[t1 * 3 + 2]];
        const v2 = [mesh.indices[t2 * 3], mesh.indices[t2 * 3 + 1], mesh.indices[t2 * 3 + 2]];
        if (v1.some((v) => v2.includes(v))) continue;
        const triA = ccw(v1.map((v) => uvOf(mesh, v)));
        const triB = ccw(v2.map((v) => uvOf(mesh, v)));
        const clipped = clipPolygonByTriangle(triA, triB);
        if (clipped.length >= 3 && polygonArea(clipped) > eps) overlaps++;
      }
    }
  }
  return overlaps;
}

export function countOutOfBoundsUVs(mesh) {
  const eps = 1e-6;
  let count = 0;
  for (let i = 0; i < mesh.uvAtlas.length; i += 2) {
    const u = mesh.uvAtlas[i], v = mesh.uvAtlas[i + 1];
    if (u < -eps || u > 1 + eps || v < -eps || v > 1 + eps) count++;
  }
  return count;
}

/** UV 면적 < (0.25텍셀)² (02 §6). */
export function countDegenerateUVTriangles(mesh, textureSize) {
  const eps = Math.pow(0.25 / textureSize, 2);
  let count = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = uvOf(mesh, mesh.indices[t]);
    const b = uvOf(mesh, mesh.indices[t + 1]);
    const c = uvOf(mesh, mesh.indices[t + 2]);
    if (Math.abs(triangleAreaUV(a, b, c)) < eps) count++;
  }
  return count;
}

function segmentDistance(p1, p2, p3, p4) {
  // 2D 선분 간 최소 거리
  const d = (a, b, p) => {
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + aby * t));
  };
  const intersects = (() => {
    const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2);
  })();
  if (intersects) return 0;
  return Math.min(d(p1, p2, p3), d(p1, p2, p4), d(p3, p4, p1), d(p3, p4, p2));
}

/** 아일랜드 간 최소 간격(텍셀) — 경계 엣지(1-삼각형 엣지) 간 거리 (02 §6). */
export function measureMinimumIslandPadding(mesh, textureSize) {
  const edgeUse = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = mesh.indices[t + e];
      const b = mesh.indices[t + ((e + 1) % 3)];
      const key = a < b ? a + "|" + b : b + "|" + a;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }
  const { islandId, partId } = mesh.attributes;
  const islandOf = (v) => partId[v] * 1000 + islandId[v];
  const boundary = [];
  for (const [key, uses] of edgeUse) {
    if (uses !== 1) continue;
    const [a, b] = key.split("|").map(Number);
    boundary.push({ a: uvOf(mesh, a), b: uvOf(mesh, b), island: islandOf(a) });
  }
  let min = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    for (let j = i + 1; j < boundary.length; j++) {
      if (boundary[i].island === boundary[j].island) continue;
      const dist = segmentDistance(boundary[i].a, boundary[i].b, boundary[j].a, boundary[j].b);
      if (dist < min) min = dist;
    }
  }
  return min === Infinity ? textureSize : min * textureSize;
}

/**
 * 방향별 텍셀 밀도(텍셀/미터) 편차 — 3D 면적 가중 p90/p10 비율 (02 §6, D-8).
 * 이방성(U 대 V)은 경고용 지표로만 보고.
 */
export function calculateTexelDensityDeviation(mesh, textureSize) {
  const samples = []; // {du, dv, area}
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [ia, ib, ic] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    const pa = [mesh.positions[ia * 3], mesh.positions[ia * 3 + 1], mesh.positions[ia * 3 + 2]];
    const pb = [mesh.positions[ib * 3], mesh.positions[ib * 3 + 1], mesh.positions[ib * 3 + 2]];
    const pc = [mesh.positions[ic * 3], mesh.positions[ic * 3 + 1], mesh.positions[ic * 3 + 2]];
    const e1 = sub3(pb, pa), e2 = sub3(pc, pa);
    const area = length3(cross3(e1, e2)) / 2;
    if (area < 1e-12) continue;
    const du1 = mesh.uvAtlas[ib * 2] - mesh.uvAtlas[ia * 2];
    const dv1 = mesh.uvAtlas[ib * 2 + 1] - mesh.uvAtlas[ia * 2 + 1];
    const du2 = mesh.uvAtlas[ic * 2] - mesh.uvAtlas[ia * 2];
    const dv2 = mesh.uvAtlas[ic * 2 + 1] - mesh.uvAtlas[ia * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-20) continue;
    const r = 1 / det;
    const dPdu = scale3(sub3(scale3(e1, dv2), scale3(e2, dv1)), r);
    const dPdv = scale3(sub3(scale3(e2, du1), scale3(e1, du2)), r);
    const lenU = length3(dPdu), lenV = length3(dPdv);
    if (lenU < 1e-12 || lenV < 1e-12) continue;
    samples.push({ du: textureSize / lenU, dv: textureSize / lenV, area });
  }
  const weightedPercentileRatio = (key) => {
    const sorted = [...samples].sort((a, b) => a[key] - b[key]);
    const total = sorted.reduce((s, x) => s + x.area, 0);
    let acc = 0;
    let p10 = sorted[0]?.[key] ?? 1;
    let p90 = sorted[sorted.length - 1]?.[key] ?? 1;
    for (const s of sorted) {
      acc += s.area;
      if (acc <= total * 0.1) p10 = s[key];
      if (acc <= total * 0.9) p90 = s[key];
    }
    return p90 / p10;
  };
  const median = (key) => {
    const sorted = [...samples].sort((a, b) => a[key] - b[key]);
    return sorted[Math.floor(sorted.length / 2)]?.[key] ?? 1;
  };
  return {
    u: weightedPercentileRatio("du"),
    v: weightedPercentileRatio("dv"),
    anisotropy: median("dv") / median("du"),
  };
}

export function validateUVs(mesh, textureSize) {
  const density = calculateTexelDensityDeviation(mesh, textureSize);
  return {
    overlaps: detectUVTriangleOverlaps(mesh, textureSize),
    outOfBoundsVertices: countOutOfBoundsUVs(mesh),
    degenerateTriangles: countDegenerateUVTriangles(mesh, textureSize),
    minimumPaddingPixels: measureMinimumIslandPadding(mesh, textureSize),
    texelDensityDeviation: density,
  };
}

/** 빌드 차단 조건 — 원본 §13 유지 (밀도는 보고 전용, 02 §6). */
export function assertValidUV(report) {
  if (report.overlaps > 0) throw new Error(`UV overlap detected: ${report.overlaps}`);
  if (report.outOfBoundsVertices > 0) throw new Error(`UV out of bounds: ${report.outOfBoundsVertices}`);
  if (report.degenerateTriangles > 0) throw new Error(`Degenerate UV triangles: ${report.degenerateTriangles}`);
  if (report.minimumPaddingPixels < 4) throw new Error(`Insufficient UV padding: ${report.minimumPaddingPixels.toFixed(2)}px`);
}
