// 긁힘 = 캡슐 SDF 스탬프 (D-5·D-16, 06-phase4 §4.3).
// 좌표계는 부품의 uvMetric — 실측 크기 유지가 목적이므로 긁힘은 metric 공간에서 산다.
// 평가는 metric 균일 그리드로 픽셀당 후보 캡슐 수를 상수로 묶는다 (D-16) —
// 06 이 우려한 "스탬프 수 × 픽셀 수 폭발" 은 그리드로 사라지고, metric↔atlas 선형 가정
// (칼날에서 성립하지 않음)을 쓰지 않아 누락 없이 정확하다.
// 겹침은 "가장 깊은 긁힘 승리"(max) — 순서 무관이라 결정성에 유리.

import { mulberry32 } from "../core/rng.js";
import { lerp, smoothstep } from "../core/math.js";

const TAU = Math.PI * 2;
const TILT = (10 * Math.PI) / 180; // longitudinal/perpendicular 의 ±10° 흔들림
const MAX_GRID_DIM = 128;

/** ScratchSpec 기본값 (원본 §21 + depthRange). 길이·폭·깊이는 부품 metric 단위. */
export const DEFAULT_SCRATCH_SPEC = {
  count: 60,
  lengthRange: [0.25, 1.2],
  widthRange: [0.004, 0.018],
  depthRange: [0.10, 0.35],
  direction: "longitudinal",
  seed: 1,
};

export const SCRATCH_DIRECTIONS = ["longitudinal", "perpendicular", "random"];

/**
 * 방향 각도 — metric 공간 기준. longitudinal = 부품 길이 축 ±10°,
 * perpendicular = 둘레 축 ±10°, random = 균등.
 * @param lengthAxisIsU 부품 metric 의 길이 축이 U 인가 (칼날 = U, 손잡이·폼멜 = V)
 */
function resolveAngle(direction, r, lengthAxisIsU) {
  if (direction === "random") return r * TAU;
  const alongU = direction === "longitudinal" ? lengthAxisIsU : !lengthAxisIsU;
  return (alongU ? 0 : Math.PI / 2) + (r * 2 - 1) * TILT;
}

/**
 * seed 로부터 캡슐 스탬프 목록 생성 (06 §4.3).
 * 난수 추출 **순서가 곧 결정성 계약** — 항목을 끼워 넣지 말 것.
 * @param spec   ScratchSpec
 * @param region {{minU,maxU,minV,maxV}} 배치 영역 (부품 metric bbox 또는 명시 영역)
 * @param axes   {{lengthAxis:"u"|"v", perimeterAxis:"u"|"v"|null}}
 * @param perimeter {{lo:number, hi:number}|null} 둘레 축의 **부품 전체** 범위 (seam 주기).
 *   region 이 부분 영역일 수 있으므로 주기는 반드시 부품 bbox 에서 온다.
 * @returns {{ax,ay,bx,by,width,depth,alpha}[]} — metric 좌표
 */
export function generateScratchStamps(spec, region, axes, perimeter = null) {
  const rnd = mulberry32(spec.seed >>> 0);
  const lengthAxisIsU = axes.lengthAxis === "u";
  const stamps = [];
  for (let i = 0; i < spec.count; i++) {
    const u = lerp(region.minU, region.maxU, rnd());
    const v = lerp(region.minV, region.maxV, rnd());
    const len = lerp(spec.lengthRange[0], spec.lengthRange[1], rnd());
    const width = lerp(spec.widthRange[0], spec.widthRange[1], rnd());
    const depth = lerp(spec.depthRange[0], spec.depthRange[1], rnd());
    const alpha = lerp(0.25, 0.8, rnd()); // 원본 §21 globalAlpha 계승
    const angle = resolveAngle(spec.direction, rnd(), lengthAxisIsU);
    stamps.push({
      ax: u, ay: v,
      bx: u + Math.cos(angle) * len,
      by: v + Math.sin(angle) * len,
      width, depth, alpha,
    });
  }
  return wrapPerimeter(stamps, perimeter, axes.perimeterAxis);
}

/**
 * 둘레 seam 처리 (06 §4.3) — 캡슐이 둘레 범위를 넘으면 mod 둘레로 감아 한 번 더 스탬프.
 * 둘레 축이 없는 부품(가드)은 그대로 둔다.
 */
function wrapPerimeter(stamps, perimeter, perimeterAxis) {
  if (!perimeterAxis || !perimeter) return stamps;
  const isU = perimeterAxis === "u";
  const { lo, hi } = perimeter;
  const period = hi - lo;
  if (!(period > 0)) return stamps;
  const out = stamps.slice();
  for (const s of stamps) {
    const half = s.width * 0.5;
    const min = Math.min(isU ? s.ax : s.ay, isU ? s.bx : s.by) - half;
    const max = Math.max(isU ? s.ax : s.ay, isU ? s.bx : s.by) + half;
    let shift = 0;
    if (min < lo) shift = period;
    else if (max > hi) shift = -period;
    if (shift === 0) continue;
    out.push(isU
      ? { ...s, ax: s.ax + shift, bx: s.bx + shift }
      : { ...s, ay: s.ay + shift, by: s.by + shift });
  }
  return out;
}

/**
 * metric 균일 그리드 — 캡슐을 자기 footprint AABB 가 닿는 셀에 전부 담는다.
 * 조회는 점이 속한 셀 하나만 보면 되므로 누락이 없다.
 */
export function buildScratchGrid(stamps) {
  if (!stamps || stamps.length === 0) return null;
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity, lenSum = 0;
  for (const s of stamps) {
    const half = s.width * 0.5;
    minU = Math.min(minU, s.ax - half, s.bx - half);
    maxU = Math.max(maxU, s.ax + half, s.bx + half);
    minV = Math.min(minV, s.ay - half, s.by - half);
    maxV = Math.max(maxV, s.ay + half, s.by + half);
    lenSum += Math.hypot(s.bx - s.ax, s.by - s.ay);
  }
  // 셀 크기 = 평균 캡슐 길이 — 셀당 후보 수를 상수로 유지 (너무 잘게 쪼개도 중복만 늘어남)
  const cell = Math.max(lenSum / stamps.length, 1e-4);
  const cols = Math.max(1, Math.min(MAX_GRID_DIM, Math.ceil((maxU - minU) / cell)));
  const rows = Math.max(1, Math.min(MAX_GRID_DIM, Math.ceil((maxV - minV) / cell)));
  const cellU = (maxU - minU) / cols || 1;
  const cellV = (maxV - minV) / rows || 1;
  const cells = new Array(cols * rows).fill(null);
  for (const s of stamps) {
    const half = s.width * 0.5;
    const x0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - half - minU) / cellU));
    const x1 = Math.min(cols - 1, Math.floor((Math.max(s.ax, s.bx) + half - minU) / cellU));
    const y0 = Math.max(0, Math.floor((Math.min(s.ay, s.by) - half - minV) / cellV));
    const y1 = Math.min(rows - 1, Math.floor((Math.max(s.ay, s.by) + half - minV) / cellV));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * cols + x;
        if (!cells[k]) cells[k] = [];
        cells[k].push(s);
      }
    }
  }
  return { minU, minV, cellU, cellV, cols, rows, cells, count: stamps.length };
}

function distanceToSegment(px, py, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - s.ax) * dx + (py - s.ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (s.ax + dx * t), py - (s.ay + dy * t));
}

/**
 * metric 좌표에서 긁힘 깊이 [0, ∞) — 프래그먼트가 부르는 유일한 진입점.
 * `depth × alpha × smoothstep(width/2, width/4, dist)` 의 최댓값 (가장 깊은 긁힘 승리).
 */
export function sampleScratchDepth(grid, u, v) {
  if (!grid) return 0;
  const cx = Math.floor((u - grid.minU) / grid.cellU);
  const cy = Math.floor((v - grid.minV) / grid.cellV);
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return 0;
  const list = grid.cells[cy * grid.cols + cx];
  if (!list) return 0;
  let best = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const coverage = smoothstep(s.width * 0.5, s.width * 0.25, distanceToSegment(u, v, s));
    if (coverage <= 0) continue;
    const amount = s.depth * s.alpha * coverage;
    if (amount > best) best = amount;
  }
  return best;
}
