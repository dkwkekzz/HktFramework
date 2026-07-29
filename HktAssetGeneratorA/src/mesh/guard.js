// 가드 생성기 — 2D 윤곽을 칼날 축(-Y) 방향으로 Extrude (04-phase2 §2.2, 원본 §9 + D-1).
// UV 아일랜드 3개: 앞면(0, 칼날 쪽 +Y) / 뒷면(1, 미러 U) / 측면(2, 둘레×깊이).
// 로컬 공간: 앞면 y=0, 뒷면 y=-depth. outline 은 (x, z) 평면 — x=폭, z=두께.

import { smoothstep, clamp01 } from "../core/math.js";
import { triangulatePolygon, signedArea2D, isSimplePolygon } from "../core/earclip.js";
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
 * @param design {{ outline: Vec2[], depth: number, bevel: number, symmetry: "bilateral" }}
 */
export function buildGuardMesh(design) {
  const { outline, normalized } = prepareOutline(design.outline);
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

  const triangles = triangulatePolygon(faceOutline);
  const builder = new MeshBuilder();

  const contactAt = (x, z) => 0.6 * smoothstep(0.05, 0.005, Math.hypot(x, z));

  const addFaceVertex = (pt, norm, y, island, group, mirrorU) => {
    const u = mirrorU ? 1 - norm[0] : norm[0];
    return builder.addVertex({
      position: [pt[0], y, pt[1]],
      uvLocal: [u, norm[1]],
      uvMetric: [pt[0] / METRIC_UNIT, pt[1] / METRIC_UNIT],
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
  const perim = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    perim[i + 1] = perim[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
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
        position: [pt[0], spec.y, pt[1]],
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
    symmetry: "bilateral",
  };
}
