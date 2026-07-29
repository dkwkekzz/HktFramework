// 칼날 생성기 — 메시와 의미 UV 동시 생성 (03-phase1 §1.3~1.5).
// 단면 프로파일(4종, crease 명시) → 링 스윕(seam/crease 정점 복제) → 폴-팬 tip(D-2)
// → 루트 캡(별도 아일랜드) → Local/Metric UV → Phase 1 임시 Atlas.

import { lerp, clamp01, smoothstep } from "../core/math.js";
import { createCurve3, buildArcLengthTable, evaluateCurve1 } from "../core/curve.js";
import { MeshBuilder, recalculateMeshTangents } from "./builder.js";

export const PartId = { Blade: 0, Guard: 1, Grip: 2, Pommel: 3 };
export const BladeIsland = { Body: 0, RootCap: 1 };

// uvMetric 스케일: 1 UV 단위 = 10cm (02-architecture §4)
const METRIC_UNIT = 0.1;
// 링 tipScale 하한 — 마지막 일반 링이 퇴화하지 않게 (D-2)
const MIN_RING_TIP_SCALE = 0.15;
// hexagonal 평면 폭 비율 / flat 베벨 비율 (프로파일 구조 상수 — 결정론 영향값이라 고정)
const HEX_FLAT_RATIO = 0.35;
const FLAT_BEVEL_RATIO = 0.08;
// 루트 캡 전용 스무딩 그룹
const CAP_SMOOTHING_GROUP = 999;

// ── 단면 프로파일 ────────────────────────────────────────────────────────────
// ProfilePoint: { x(±폭), y(±두께), edgeWeight, ridgeWeight, fullerWeight, crease }
// 닫힌 CCW 루프, s=0 은 seam(칼날 뒤쪽 능선/평면) — 03-phase1 §1.3.

/** n 개 샘플을 변 길이 비례로 분배 (min 1, 결정적 나머지 배분). */
function distributeSamples(n, sideLengths) {
  const total = sideLengths.reduce((a, b) => a + b, 0);
  const raw = sideLengths.map((len) => (n * len) / total);
  const counts = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  let k = 0;
  while (diff > 0) { counts[order[k % order.length].i]++; diff--; k++; }
  k = 0;
  const orderAsc = [...order].reverse();
  while (diff < 0) {
    const idx = orderAsc[k % orderAsc.length].i;
    if (counts[idx] > 1) { counts[idx]--; diff++; }
    k++;
  }
  return counts;
}

/** 꼭짓점 리스트(직선 변)에서 프로파일 샘플 생성 — 보간점 가중치는 선형 감쇠. */
function buildFromCorners(corners, n) {
  const m = corners.length;
  const lengths = [];
  for (let i = 0; i < m; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % m];
    lengths.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  const counts = distributeSamples(n, lengths);
  const points = [];
  for (let i = 0; i < m; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % m];
    for (let k = 0; k < counts[i]; k++) {
      const f = k / counts[i];
      points.push({
        x: lerp(a.x, b.x, f),
        y: lerp(a.y, b.y, f),
        edgeWeight: lerp(a.edgeWeight, b.edgeWeight, f),
        ridgeWeight: lerp(a.ridgeWeight, b.ridgeWeight, f),
        fullerWeight: 0,
        crease: k === 0 ? !!a.crease : false,
      });
    }
  }
  return points;
}

function sampleDiamondProfile(width, thickness, ridgeHeight, n) {
  const w = width / 2;
  const ry = (thickness / 2) * (1 + ridgeHeight); // ridgeHeight 는 능선 돌출 비율
  return buildFromCorners([
    { x: 0, y: -ry, edgeWeight: 0, ridgeWeight: 1, crease: true }, // seam = 뒤 능선
    { x: w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
    { x: 0, y: ry, edgeWeight: 0, ridgeWeight: 1, crease: true },
    { x: -w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
  ], n);
}

function sampleHexagonalProfile(width, thickness, ridgeHeight, n) {
  const w = width / 2;
  const fx = w * HEX_FLAT_RATIO;
  const ty = (thickness / 2) * (1 + ridgeHeight * 0.5);
  return buildFromCorners([
    { x: fx, y: -ty, edgeWeight: 0, ridgeWeight: 0.5, crease: true }, // seam = 아래 평면 경계
    { x: w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
    { x: fx, y: ty, edgeWeight: 0, ridgeWeight: 0.5, crease: true },
    { x: -fx, y: ty, edgeWeight: 0, ridgeWeight: 0.5, crease: true },
    { x: -w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
    { x: -fx, y: -ty, edgeWeight: 0, ridgeWeight: 0.5, crease: true },
  ], n);
}

function sampleFlatProfile(width, thickness, n) {
  const w = width / 2;
  const bev = Math.min(width * FLAT_BEVEL_RATIO, thickness);
  const bx = w - bev;
  const ty = thickness / 2;
  return buildFromCorners([
    { x: bx, y: -ty, edgeWeight: 0, ridgeWeight: 0, crease: true },
    { x: w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
    { x: bx, y: ty, edgeWeight: 0, ridgeWeight: 0, crease: true },
    { x: -bx, y: ty, edgeWeight: 0, ridgeWeight: 0, crease: true },
    { x: -w, y: 0, edgeWeight: 1, ridgeWeight: 0, crease: true },
    { x: -bx, y: -ty, edgeWeight: 0, ridgeWeight: 0, crease: true },
  ], n);
}

function sampleLenticularProfile(width, thickness, n) {
  // seam = 아래(θ=-90°), 날 = θ=0°/180° 정확 샘플 (n % 4 === 0 전제)
  const points = [];
  for (let i = 0; i < n; i++) {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const c = Math.cos(theta);
    const isEdge = i === n / 4 || i === (3 * n) / 4;
    points.push({
      x: (width / 2) * c,
      y: (thickness / 2) * Math.sin(theta),
      edgeWeight: Math.pow(Math.abs(c), 4),
      ridgeWeight: 0,
      fullerWeight: 0,
      crease: isEdge,
    });
  }
  return points;
}

/** 홈(fuller) 적용 — |x| < halfWidth 구간의 y 를 파고 fullerWeight 기록 (03-phase1 §1.3). */
function applyFullerToProfile(points, halfWidth, depth) {
  if (depth <= 0 || halfWidth <= 0) return;
  for (const p of points) {
    const ay = Math.abs(p.y);
    if (Math.abs(p.x) >= halfWidth || ay < 1e-9) continue;
    const carve = depth * Math.pow(Math.cos((Math.PI * p.x) / (2 * halfWidth)), 2);
    const newAy = Math.max(ay - carve, ay * 0.15);
    p.fullerWeight = clamp01((ay - newAy) / depth);
    p.y = Math.sign(p.y) * newAy;
  }
}

/**
 * @param fullerState null | { halfWidth, depth } — 이 t 에서의 실효 홈 (길이 방향 envelope 반영 후)
 */
export function buildCrossSectionProfile(type, width, thickness, ridgeHeight, fullerState, segmentCount) {
  if (segmentCount < 8 || segmentCount % 4 !== 0) {
    throw new Error(`segments.crossSection 은 8 이상, 4의 배수여야 한다: ${segmentCount}`);
  }
  let points;
  switch (type) {
    case "diamond": points = sampleDiamondProfile(width, thickness, ridgeHeight, segmentCount); break;
    case "lenticular": points = sampleLenticularProfile(width, thickness, segmentCount); break;
    case "hexagonal": points = sampleHexagonalProfile(width, thickness, ridgeHeight, segmentCount); break;
    case "flat": points = sampleFlatProfile(width, thickness, segmentCount); break;
    default: throw new Error(`알 수 없는 단면 유형: ${type}`);
  }
  if (fullerState) applyFullerToProfile(points, fullerState.halfWidth, fullerState.depth);
  return points;
}

/** s=0 부터 각 점까지 둘레 누적 거리 + 전체 둘레. */
function profileDistances(points) {
  const n = points.length;
  const dist = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    dist[i + 1] = dist[i] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  return dist; // dist[n] = 전체 둘레
}

// ── 프로파일 전개 (seam/crease 정점 복제 레이아웃) ──────────────────────────
/**
 * crease 플래그 배열로부터 링 정점 전개 레이아웃을 만든다 — 링마다 구조 동일 (03-phase1 §1.4).
 * @returns {{ slots: {profileIndex:number, s:number, group:number}[],
 *             out: number[], into: number[], stride: number }}
 *  out[i]  = 프로파일 세그먼트 i(i→i+1)의 시작 정점 슬롯
 *  into[i] = 세그먼트 i-1 의 끝 정점 슬롯 (into[n] = seam 끝)
 */
export function makeExpansionLayout(creaseFlags) {
  const n = creaseFlags.length;
  // 세그먼트 i (점 i → 점 i+1)의 스무딩 그룹
  const segGroup = new Array(n);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && creaseFlags[i]) g++;
    segGroup[i] = g;
  }
  if (!creaseFlags[0]) {
    // seam 이 crease 가 아니면 마지막 그룹을 0과 병합 (노멀이 seam 을 넘어 이어짐)
    const last = segGroup[n - 1];
    for (let i = 0; i < n; i++) if (segGroup[i] === last) segGroup[i] = 0;
  }
  const slots = [];
  const out = new Array(n);
  const into = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (i === 0) {
      out[0] = slots.length;
      slots.push({ profileIndex: 0, s, group: segGroup[0] });
    } else if (i === n) {
      into[n] = slots.length;
      slots.push({ profileIndex: 0, s: 1, group: segGroup[n - 1] });
    } else if (creaseFlags[i]) {
      into[i] = slots.length;
      slots.push({ profileIndex: i, s, group: segGroup[i - 1] });
      out[i] = slots.length;
      slots.push({ profileIndex: i, s, group: segGroup[i] });
    } else {
      into[i] = out[i] = slots.length;
      slots.push({ profileIndex: i, s, group: segGroup[i] });
    }
  }
  return { slots, out, into, stride: slots.length };
}

// ── tip 감쇠 ────────────────────────────────────────────────────────────────
export function evaluateTipScale(tip, t) {
  if (t <= tip.start) return 1;
  const f = clamp01((t - tip.start) / (1 - tip.start));
  const e = tip.endScale;
  switch (tip.type) {
    case "spear": return 1 + (e - 1) * f;
    case "needle": return e + (1 - e) * (1 - f) * (1 - f);
    case "rounded": return e + (1 - e) * Math.cos((f * Math.PI) / 2);
    default: throw new Error(`알 수 없는 tip 유형: ${tip.type}`);
  }
}

/** 뿌리 근처(가드 접촉)만 약간의 contact (03-phase1 §1.4-4). */
export const evaluateBladeContactWeight = (t) => smoothstep(0.15, 0, t);

function fullerStateAt(design, t) {
  const f = design.fuller;
  if (!f || !f.enabled) return null;
  // 길이 방향 envelope — 양 끝 8% 를 부드럽게
  const env = smoothstep(f.start, f.start + 0.08, t) * smoothstep(f.end, f.end - 0.08, t);
  if (env <= 1e-6) return null;
  return { halfWidth: f.width / 2, depth: f.depth * env };
}

// ── 칼날 메시 본체 ──────────────────────────────────────────────────────────
export function buildBladeMesh(design, textureSize = 1024) {
  const builder = new MeshBuilder();
  const ringCount = design.segments.longitudinal; // 일반 링 수 (t=i/ringCount, i=0..ringCount-1)
  const n = design.segments.crossSection;
  if (ringCount < 4) throw new Error("segments.longitudinal 은 4 이상이어야 한다");

  const centerCurve = createCurve3(design.centerCurve, ringCount);
  const arcTable = buildArcLengthTable(centerCurve, ringCount);

  // 레이아웃은 t=0 프로파일의 crease 구조에서 — 모든 링에서 동일 (fuller 는 crease 를 바꾸지 않음)
  const refProfile = buildCrossSectionProfile(
    design.crossSection, 1, 0.1, design.ridgeHeight, null, n);
  const layout = makeExpansionLayout(refProfile.map((p) => p.crease));
  const { slots, out, into, stride } = layout;

  // 링 정점 생성
  let rootProfile = null;
  let lastProfile = null;
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const t = ringIndex / ringCount;
    const center = centerCurve.evaluate(t);
    const frame = centerCurve.frame(t);
    const tipScale = Math.max(evaluateTipScale(design.tip, t), MIN_RING_TIP_SCALE);
    const width = evaluateCurve1(design.widthCurve, t) * tipScale;
    const thickness = evaluateCurve1(design.thicknessCurve, t) * tipScale;
    const profile = buildCrossSectionProfile(
      design.crossSection, width, thickness, design.ridgeHeight,
      fullerStateAt(design, t), n);
    const dist = profileDistances(profile);
    if (ringIndex === 0) rootProfile = profile;
    lastProfile = profile;

    const physicalLength = arcTable[ringIndex];
    const contact = evaluateBladeContactWeight(t);

    for (const slot of slots) {
      const p = profile[slot.profileIndex];
      const metricPerimeter = slot.s === 1 ? dist[n] : dist[slot.profileIndex];
      builder.addVertex({
        position: [
          center[0] + frame.normal[0] * p.x + frame.binormal[0] * p.y,
          center[1] + frame.normal[1] * p.x + frame.binormal[1] * p.y,
          center[2] + frame.normal[2] * p.x + frame.binormal[2] * p.y,
        ],
        uvLocal: [t, slot.s],
        uvMetric: [physicalLength / METRIC_UNIT, metricPerimeter / METRIC_UNIT],
        attributes: {
          partId: PartId.Blade,
          islandId: BladeIsland.Body,
          longitudinal: t,
          perimeter: slot.s,
          edgeWeight: p.edgeWeight,
          ridgeWeight: p.ridgeWeight,
          fullerWeight: p.fullerWeight,
          contactWeight: contact,
        },
        smoothingGroup: slot.group,
      });
    }
  }

  // 링 사이 quad — 원본 §7.2 의 (a,c,b) 감김은 본 프레임 규약(binormal=tangent×normal)에서
  // 안쪽을 향해(부호 부피 음수) 반전했다. 검증: signedVolume > 0.
  for (let ring = 0; ring < ringCount - 1; ring++) {
    const base = ring * stride;
    const next = base + stride;
    for (let seg = 0; seg < n; seg++) {
      const a = base + out[seg];
      const b = base + into[seg + 1];
      const c = next + out[seg];
      const d = next + into[seg + 1];
      builder.addTriangle(a, b, c);
      builder.addTriangle(b, d, c);
    }
  }

  // ── tip 폴-팬 (D-2): 폴 정점을 세그먼트 수만큼 복제, uvLocal.v = 팬 s 중점 ──
  const tipPos = centerCurve.evaluate(1);
  const lastBase = (ringCount - 1) * stride;
  const totalLength = arcTable[ringCount];
  const lastDist = profileDistances(lastProfile);
  for (let seg = 0; seg < n; seg++) {
    const sA = slots[out[seg]].s;
    const sB = slots[into[seg + 1]].s;
    const pA = lastProfile[seg];
    const pB = lastProfile[(seg + 1) % n];
    const midPerimeter =
      (lastDist[seg] + (sB === 1 ? lastDist[n] : lastDist[(seg + 1) % n])) / 2;
    const pole = builder.addVertex({
      position: [...tipPos],
      uvLocal: [1, (sA + sB) / 2],
      uvMetric: [totalLength / METRIC_UNIT, midPerimeter / METRIC_UNIT],
      attributes: {
        partId: PartId.Blade,
        islandId: BladeIsland.Body,
        longitudinal: 1,
        perimeter: (sA + sB) / 2,
        edgeWeight: (pA.edgeWeight + pB.edgeWeight) / 2,
        ridgeWeight: (pA.ridgeWeight + pB.ridgeWeight) / 2,
        fullerWeight: 0,
        contactWeight: 0,
      },
      smoothingGroup: slots[out[seg]].group,
    });
    const a = lastBase + out[seg];
    const b = lastBase + into[seg + 1];
    builder.addTriangle(a, b, pole);
  }

  // ── 루트 캡 (별도 아일랜드, 원판 팬 — 03-phase1 §1.4-3) ──────────────────
  const rootCenter = centerCurve.evaluate(0);
  const rootFrame = centerCurve.frame(0);
  let rootRadius = 0;
  for (const p of rootProfile) rootRadius = Math.max(rootRadius, Math.hypot(p.x, p.y));
  const capMetricScale = (2 * rootRadius) / METRIC_UNIT;
  const capUV = (s) => [0.5 + 0.5 * Math.cos(2 * Math.PI * s), 0.5 + 0.5 * Math.sin(2 * Math.PI * s)];

  const capCenter = builder.addVertex({
    position: [...rootCenter],
    uvLocal: [0.5, 0.5],
    uvMetric: [0, 0],
    attributes: {
      partId: PartId.Blade, islandId: BladeIsland.RootCap,
      longitudinal: 0, perimeter: 0,
      edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0, contactWeight: 1,
    },
    smoothingGroup: CAP_SMOOTHING_GROUP,
  });
  const capRing = [];
  for (let i = 0; i < n; i++) {
    const p = rootProfile[i];
    const s = i / n;
    const [cu, cv] = capUV(s);
    capRing.push(builder.addVertex({
      position: [
        rootCenter[0] + rootFrame.normal[0] * p.x + rootFrame.binormal[0] * p.y,
        rootCenter[1] + rootFrame.normal[1] * p.x + rootFrame.binormal[1] * p.y,
        rootCenter[2] + rootFrame.normal[2] * p.x + rootFrame.binormal[2] * p.y,
      ],
      uvLocal: [cu, cv],
      uvMetric: [(cu - 0.5) * capMetricScale, (cv - 0.5) * capMetricScale],
      attributes: {
        partId: PartId.Blade, islandId: BladeIsland.RootCap,
        longitudinal: 0, perimeter: s,
        edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0, contactWeight: 1,
      },
      smoothingGroup: CAP_SMOOTHING_GROUP,
    }));
  }
  for (let i = 0; i < n; i++) {
    // 캡은 -tangent(뿌리 바깥) 방향을 향한다 — 몸통과 반대 감김
    builder.addTriangle(capCenter, capRing[(i + 1) % n], capRing[i]);
  }

  builder.recalculateNormals();
  builder.calculateCurvature();
  const mesh = builder.build();

  // cavity 에 fuller 반영 (02-architecture §4)
  const { cavity, fullerWeight } = mesh.attributes;
  for (let i = 0; i < cavity.length; i++) cavity[i] = clamp01(cavity[i] + fullerWeight[i] * 0.6);

  applyPhase1AtlasUV(mesh, textureSize);
  recalculateMeshTangents(mesh); // Atlas 적용 후 재계산 (D-9)
  return mesh;
}

// ── Phase 1 임시 Atlas (칼날 단독) — 정식 레이아웃은 Phase 2 (03-phase1 §1.6) ─
export const PHASE1_BLADE_ATLAS = {
  [BladeIsland.Body]: { offset: [0.0, 0.14], scale: [1.0, 0.86] },
  [BladeIsland.RootCap]: { offset: [0.01, 0.01], scale: [0.1, 0.1] },
};
const ATLAS_PADDING_PIXELS = 8;

export function applyPhase1AtlasUV(mesh, textureSize) {
  const pad = ATLAS_PADDING_PIXELS / textureSize;
  const { islandId } = mesh.attributes;
  for (let i = 0; i < islandId.length; i++) {
    const region = PHASE1_BLADE_ATLAS[islandId[i]];
    const sx = region.scale[0] - pad * 2;
    const sy = region.scale[1] - pad * 2;
    mesh.uvAtlas[i * 2] = region.offset[0] + pad + mesh.uvLocal[i * 2] * sx;
    mesh.uvAtlas[i * 2 + 1] = region.offset[1] + pad + mesh.uvLocal[i * 2 + 1] * sy;
  }
}

// ── 파라미터 → BladeDesign 헬퍼 (프리셋·UI 공용) ────────────────────────────
// p.curve: 칼날 중간점 ±X 오프셋(m, sagitta) — 곡선 검 지원 (D-18). 양 끝점은 축 위
// 유지(chord = 검 축). 0 이면 기존 직선과 비트 동일.
export function makeStraightBladeDesign(p) {
  return {
    length: p.length,
    centerCurve: { points: [[0, 0, 0], [p.curve ?? 0, p.length / 2, 0], [0, p.length, 0]] },
    widthCurve: {
      points: [
        { t: 0, value: p.widthRoot },
        { t: 0.5, value: p.widthMid ?? (p.widthRoot + p.widthTip) / 2 },
        { t: 1, value: p.widthTip },
      ],
    },
    thicknessCurve: {
      points: [
        { t: 0, value: p.thicknessRoot },
        { t: 1, value: p.thicknessTip },
      ],
    },
    crossSection: p.crossSection,
    ridgeHeight: p.ridgeHeight ?? 0,
    fuller: p.fuller ?? null,
    tip: { type: p.tipType, start: p.tipStart, endScale: p.tipEndScale },
    segments: { longitudinal: p.segLong, crossSection: p.segCross },
  };
}
