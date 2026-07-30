// 가드 생성기 — 2D 윤곽을 칼날 축(-Y) 방향으로 Extrude (04-phase2 §2.2, 원본 §9 + D-1).
// UV 아일랜드 3개: 앞면(0, 칼날 쪽 +Y) / 뒷면(1, 미러 U) / 측면(2, 둘레×깊이).
// 로컬 공간: 앞면 y=0, 뒷면 y=-depth. outline 은 (x, z) 평면 — x=폭, z=두께.

import { smoothstep, clamp01 } from "../core/math.js";
import { triangulatePolygon, signedArea2D, isSimplePolygon, cross2 } from "../core/earclip.js";
import { MeshBuilder } from "./builder.js";
import { PartId } from "./blade.js";

export const GuardIsland = { Front: 0, Back: 1, Side: 2 };
const METRIC_UNIT = 0.1; // 1 UV 단위 = 10cm
const GROUP = { Front: 0, Back: 1, Side: 2 };

/** 윤곽 CCW 정규화 + bbox [0,1]² 정규화 좌표 계산. */
function prepareOutline(rawOutline) {
  if (rawOutline.length < 3) throw new Error("guard outline 은 3점 이상");
  if (!isSimplePolygon(rawOutline)) throw new Error("guard outline 이 자기 교차한다");
  const outline = signedArea2D(rawOutline) < 0 ? [...rawOutline].reverse() : [...rawOutline];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanZ = Math.max(maxZ - minZ, 1e-9);
  const normalized = outline.map(([x, z]) => [(x - minX) / spanX, (z - minZ) / spanZ]);
  return { outline, normalized };
}

/** 정점 노멀(miter) 2D inset — 방향 반전이 생기면 null (bevel 강등, 04-phase2 §2.2). */
function insetOutline(outline, amount) {
  const n = outline.length;
  const inset = [];
  for (let i = 0; i < n; i++) {
    const prev = outline[(i + n - 1) % n];
    const cur = outline[i];
    const next = outline[(i + 1) % n];
    // 변 노멀(안쪽): CCW 다각형에서 변 (a→b) 의 안쪽 노멀 = (-dy, dx) 정규화
    const inward = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      return [-dy / len, dx / len];
    };
    const n1 = inward(prev, cur);
    const n2 = inward(cur, next);
    let vx = n1[0] + n2[0], vy = n1[1] + n2[1];
    const vlen = Math.hypot(vx, vy) || 1;
    vx /= vlen; vy /= vlen;
    // miter 보정 — 과도한 스파이크 방지 상한 2.5
    const scale = Math.min(1 / Math.max(vx * n1[0] + vy * n1[1], 0.4), 2.5);
    inset.push([cur[0] + vx * amount * scale, cur[1] + vy * amount * scale]);
  }
  // 방향 반전 검사: 원본 변과 inset 변의 내적이 음수면 자기 교차 임박
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    const ai = inset[i], bi = inset[(i + 1) % n];
    if ((b[0] - a[0]) * (bi[0] - ai[0]) + (b[1] - a[1]) * (bi[1] - ai[1]) <= 0) return null;
  }
  return inset;
}

/**
 * 곡선 가드 변위 (D-19) — 정규 반폭 s=|x|/w 의 2차.
 *   y += droop·s²  (quillon 이 축 방향으로 휜다, + 는 칼날 쪽)
 *   z *= 1 + (endFlare-1)·s²  (끝 두께 배율)
 * s(0)=0 이라 중앙 접합부(소켓)는 고정된다. 기본값이면 항등 — 기존과 비트 동일.
 */
function makeGuardWarp(outline, droop, endFlare) {
  const active = droop !== 0 || endFlare !== 1;
  let halfWidth = 0;
  for (const [x] of outline) halfWidth = Math.max(halfWidth, Math.abs(x));
  halfWidth = Math.max(halfWidth, 1e-9);
  if (!active) return { active: false, halfWidth };
  const sq = (x) => (x / halfWidth) ** 2; // |x|² / w² — 부호 무관
  const dyAt = (x) => droop * sq(x);
  const flareAt = (x) => 1 + (endFlare - 1) * sq(x);

  // x 축 변위 경로의 호길이 테이블 (uvMetric u 보정 — D-19 ③).
  // 경로: x ↦ (x, droop·(x/w)²) — |x| 에 대해 대칭이므로 [0, w] 만 적재.
  const SAMPLES = 128;
  const arc = new Float64Array(SAMPLES + 1);
  for (let i = 1; i <= SAMPLES; i++) {
    const x0 = (halfWidth * (i - 1)) / SAMPLES;
    const x1 = (halfWidth * i) / SAMPLES;
    arc[i] = arc[i - 1] + Math.hypot(x1 - x0, dyAt(x1) - dyAt(x0));
  }
  /** 부호 있는 호길이 — 중앙(x=0) 기준. |x| > w 는 선형 연장. */
  const arcAt = (x) => {
    const a = Math.abs(x);
    const u = (a / halfWidth) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(u));
    const f = u - i;
    const len = arc[i] + (arc[i + 1] - arc[i]) * f;
    return x < 0 ? -len : len;
  };
  return { active: true, halfWidth, dyAt, flareAt, arcAt };
}

/**
 * 변위 전 윤곽을 x 방향으로 세분 (D-19) — 변위는 윤곽 정점에만 적용되므로 원본 템플릿의
 * x 해상도(bar 는 양 끝 2점뿐)로는 2차 곡선이 표현되지 않는다. 세분 없이는 `bar` 가
 * 휘지 않고 **평행이동**하고, `tapered` 는 중앙이 V 로 꺾인다.
 * 직선 구간 위의 공선점만 늘리므로 다각형은 단순성·감김을 유지한다 (earclip 은 공선
 * 정점을 귀로 잡지 않아 퇴화 삼각형이 생기지 않고, 결과는 삼각형 스트립이 된다).
 */
function subdivideOutlineX(outline, maxStep) {
  const out = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    out.push(a);
    const steps = Math.ceil(Math.abs(b[0] - a[0]) / maxStep);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** 변위 가드의 x 세분 간격 = 반폭 / 이 값 (튜닝 노브 — 삼각형 수 vs 곡선 매끄러움) */
export const WARP_X_SEGMENTS = 12;

/**
 * x-monotone 다각형의 스트립 삼각분할 (D-19) — 세분된 윤곽 전용.
 * 세분은 직선 변 위에 공선점을 많이 만들고, ear clipping 은 그때 생기는 얇은 귀에서
 * 후보를 잃는다(diamond 윤곽 12분할에서 "귀를 찾지 못함" 실측). 가드 윤곽 4종은 전부
 * x-monotone 이므로 최좌·최우 정점이 나누는 두 체인을 x 순서로 병합하면 스트립이 되고,
 * 이 경로는 공선점·얇은 삼각형에 영향받지 않는다. 직선 가드는 기존 earclip 을 그대로 쓴다
 * (golden 비트 동일 유지). monotone 이 아닌 윤곽은 조용히 뭉개지 말고 던진다.
 */
function triangulateMonotoneX(pts) {
  const n = pts.length;
  const idx = pts.map((_, i) => i);
  if (signedArea2D(pts) < 0) idx.reverse();

  let li = 0, ri = 0;
  for (let k = 0; k < n; k++) {
    if (pts[idx[k]][0] < pts[idx[li]][0]) li = k;
    if (pts[idx[ri]][0] < pts[idx[k]][0]) ri = k;
  }
  const chainFrom = (dir) => {
    const out = [];
    for (let k = li; ; k = (k + dir + n) % n) {
      out.push(idx[k]);
      if (k === ri) return out;
      if (out.length > n) throw new Error("guard outline 이 x-monotone 이 아니다");
    }
  };
  const lower = chainFrom(1);
  const upper = chainFrom(-1);
  for (const chain of [lower, upper]) {
    for (let k = 1; k < chain.length; k++) {
      if (pts[chain[k]][0] < pts[chain[k - 1]][0] - 1e-12) {
        throw new Error("guard outline 이 x-monotone 이 아니다");
      }
    }
  }

  // 두 체인을 x 순서로 병합 — 삼각형 감김은 부호 면적으로 CCW 정규화, 퇴화는 버린다
  const triangles = [];
  const push = (a, b, c) => {
    const area = cross2(pts[a], pts[b], pts[c]);
    if (Math.abs(area) <= 1e-18) return; // 공선(= 면적 0) — 표면에 기여하지 않는다
    triangles.push(area > 0 ? [a, b, c] : [a, c, b]);
  };
  let i = 0, j = 0;
  while (i < lower.length - 1 || j < upper.length - 1) {
    const takeLower = j >= upper.length - 1
      || (i < lower.length - 1 && pts[lower[i + 1]][0] <= pts[upper[j + 1]][0]);
    if (takeLower) {
      push(lower[i], lower[i + 1], upper[j]);
      i++;
    } else {
      push(lower[i], upper[j + 1], upper[j]);
      j++;
    }
  }
  return triangles;
}

/**
 * @param design {{ outline: Vec2[], depth: number, bevel: number, symmetry: "bilateral",
 *                  droop?: number, endFlare?: number }}
 */
export function buildGuardMesh(design) {
  // 곡선 가드 변위 (D-19) — 변위가 있으면 윤곽을 x 방향으로 먼저 세분한다.
  const warp = makeGuardWarp(design.outline, design.droop ?? 0, design.endFlare ?? 1);
  const rawOutline = warp.active
    ? subdivideOutlineX(design.outline, warp.halfWidth / WARP_X_SEGMENTS)
    : design.outline;
  const { outline, normalized } = prepareOutline(rawOutline);
  const n = outline.length;
  const depth = design.depth;

  let bevel = design.bevel ?? 0;
  let faceOutline = outline;
  let faceNormalized = normalized;
  if (bevel > 0) {
    const inset = insetOutline(outline, bevel);
    if (inset === null || bevel * 2 >= depth) {
      bevel = 0; // 오목 윤곽 자기 교차 → 강등 (04-phase2 §2.2)
    } else {
      faceOutline = inset;
      // 정규화 좌표는 원본 bbox 기준 유지 (앞면 UV 가 살짝 안쪽으로 — 일관성 우선)
      const { normalized: insetNorm } = prepareOutline(inset);
      faceNormalized = insetNorm;
    }
  }

  // 변위 가드는 세분된 윤곽이라 monotone 스트립으로 분할한다 (D-19 — earclip 은 얇은 귀에서 실패)
  const triangles = warp.active
    ? triangulateMonotoneX(faceOutline)
    : triangulatePolygon(faceOutline);
  const builder = new MeshBuilder();

  /** (x,z) 윤곽점 + 링 y → 변위된 3D 위치. */
  const placeAt = (pt, y) => (warp.active
    ? [pt[0], y + warp.dyAt(pt[0]), pt[1] * warp.flareAt(pt[0])]
    : [pt[0], y, pt[1]]);
  /** 앞/뒷면 uvMetric — u 는 변위 경로 호길이, v 는 flare 반영 두께 (D-19 ③). */
  const faceMetric = (pt) => (warp.active
    ? [warp.arcAt(pt[0]) / METRIC_UNIT, (pt[1] * warp.flareAt(pt[0])) / METRIC_UNIT]
    : [pt[0] / METRIC_UNIT, pt[1] / METRIC_UNIT]);

  const contactAt = (x, z) => 0.6 * smoothstep(0.05, 0.005, Math.hypot(x, z));

  const addFaceVertex = (pt, norm, y, island, group, mirrorU) => {
    const u = mirrorU ? 1 - norm[0] : norm[0];
    return builder.addVertex({
      position: placeAt(pt, y),
      uvLocal: [u, norm[1]],
      uvMetric: faceMetric(pt),
      attributes: {
        partId: PartId.Guard, islandId: island,
        longitudinal: 0, perimeter: 0,
        edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
        contactWeight: contactAt(pt[0], pt[1]),
      },
      smoothingGroup: group,
    });
  };

  // ── 앞면 (y=0, 노멀 +Y) ──
  const frontIdx = faceOutline.map((pt, i) =>
    addFaceVertex(pt, faceNormalized[i], 0, GuardIsland.Front, GROUP.Front, false));
  // ── 뒷면 (y=-depth, 노멀 -Y, U 미러 — D-1) ──
  const backIdx = faceOutline.map((pt, i) =>
    addFaceVertex(pt, faceNormalized[i], -depth, GuardIsland.Back, GROUP.Back, true));

  // 면 감김: 노멀 방향 테스트로 경험 확정 — (x,z) CCW 삼각형을 (a,b,c) 로 감으면
  // 3D 노멀이 -Y 가 되므로 앞면은 (a,c,b), 뒷면은 (a,b,c).
  // (부호 부피는 면이 y=0 평면이라 면 기여가 0 에 가까워 판정에 못 쓴다)
  for (const [a, b, c] of triangles) {
    builder.addTriangle(frontIdx[a], frontIdx[c], frontIdx[b]);
    builder.addTriangle(backIdx[a], backIdx[b], backIdx[c]);
  }

  // ── 측면 (둘레 링 시퀀스: bevel 유무에 따라 2~4개 링) ──
  // 링 경로: faceOutline@0 → [outline@-bevel] → [outline@-(depth-bevel)] → faceOutline@-depth
  const ringSpecs = bevel > 0
    ? [
      { pts: faceOutline, y: 0 },
      { pts: outline, y: -bevel },
      { pts: outline, y: -(depth - bevel) },
      { pts: faceOutline, y: -depth },
    ]
    : [
      { pts: faceOutline, y: 0 },
      { pts: faceOutline, y: -depth },
    ];

  // 둘레 누적 거리 (u) — 원본 outline 기준, seam = outline[0] (검 뒤쪽에 두는 규약)
  // 변위된 가드는 실제 3D 둘레로 재계산한다 (D-19 ③ — metric 계약 유지).
  const perim = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    if (warp.active) {
      const pa = placeAt(a, 0), pb = placeAt(b, 0);
      perim[i + 1] = perim[i] + Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
    } else {
      perim[i + 1] = perim[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  const totalPerim = perim[n];

  // 링 경로 누적 거리 (v)
  const pathDist = [0];
  for (let r = 1; r < ringSpecs.length; r++) {
    const prev = ringSpecs[r - 1], cur = ringSpecs[r];
    // 대표 이동량: y 차 + 윤곽 차(0번 점) — bevel 경사 길이 근사
    const dy = Math.abs(cur.y - prev.y);
    const dxz = Math.hypot(cur.pts[0][0] - prev.pts[0][0], cur.pts[0][1] - prev.pts[0][1]);
    pathDist.push(pathDist[r - 1] + Math.hypot(dy, dxz));
  }
  const totalPath = pathDist[pathDist.length - 1];

  const sideRings = ringSpecs.map((spec, r) => {
    const v = pathDist[r] / totalPath;
    const ring = [];
    for (let j = 0; j <= n; j++) {
      const pt = spec.pts[j % n];
      const u = perim[j] / totalPerim;
      ring.push(builder.addVertex({
        position: placeAt(pt, spec.y),
        uvLocal: [u, v],
        uvMetric: [perim[j] / METRIC_UNIT, (pathDist[r]) / METRIC_UNIT],
        attributes: {
          partId: PartId.Guard, islandId: GuardIsland.Side,
          longitudinal: v, perimeter: u,
          edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
          contactWeight: contactAt(pt[0], pt[1]),
        },
        smoothingGroup: GROUP.Side,
      }));
    }
    return ring;
  });

  for (let r = 0; r < sideRings.length - 1; r++) {
    const cur = sideRings[r], next = sideRings[r + 1];
    for (let j = 0; j < n; j++) {
      builder.addTriangle(cur[j], cur[j + 1], next[j]);
      builder.addTriangle(cur[j + 1], next[j + 1], next[j]);
    }
  }

  builder.recalculateNormals();
  builder.calculateCurvature();
  const mesh = builder.build();
  // bevel 안쪽 모서리 cavity 보강 (04-phase2 §2.2)
  if (bevel > 0) {
    const { cavity, islandId } = mesh.attributes;
    for (let i = 0; i < cavity.length; i++) {
      if (islandId[i] === GuardIsland.Side) cavity[i] = clamp01(cavity[i] + 0.15);
    }
  }
  return mesh;
}

// ── 윤곽 프리셋 (04-phase2 §2.6 — 4종) ──────────────────────────────────────
/** width×thickness 박스 안에서 좌우 대칭 윤곽 생성. */
export function makeGuardOutline(shape, width, thickness) {
  const w = width / 2, t = thickness / 2;
  switch (shape) {
    case "bar": { // 둥근 끝 직선 바 (끝을 3점 아크 근사)
      const e = w * 0.06;
      return [
        [-w + e, -t], [w - e, -t], [w, 0], [w - e, t],
        [-w + e, t], [-w, 0],
      ];
    }
    case "tapered": // 중앙이 두껍고 끝이 가는 바
      return [
        [-w * 0.9, -t * 0.45], [0, -t], [w * 0.9, -t * 0.45], [w, 0],
        [w * 0.9, t * 0.45], [0, t], [-w * 0.9, t * 0.45], [-w, 0],
      ];
    case "oval": { // 타원 12각 근사
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push([Math.cos(a) * w, Math.sin(a) * t]);
      }
      return pts;
    }
    case "diamond":
      return [[-w, 0], [0, -t], [w, 0], [0, t]];
    default:
      throw new Error(`알 수 없는 guard 윤곽: ${shape}`);
  }
}

export function makeGuardDesign(p) {
  return {
    outline: makeGuardOutline(p.shape, p.width, p.thickness),
    depth: p.depth,
    bevel: p.bevel ?? 0,
    // D-19: quillon 휨(축 방향 변위, m — + 는 칼날 쪽) · 끝 두께 배율. 기본값 = 직선 가드.
    droop: p.droop ?? 0,
    endFlare: p.endFlare ?? 1,
    symmetry: "bilateral",
  };
}
