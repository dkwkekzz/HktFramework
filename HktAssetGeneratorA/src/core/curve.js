// Catmull-Rom 곡선(1D/3D) + RMF(회전 최소화 프레임) + 호길이 테이블 (03-phase1 §Step 1.1).
// Frenet 프레임은 직선 구간(곡률 0)에서 미정의라 쓰지 않는다 — 직선검이 기본인 도메인.

import { add3, sub3, scale3, dot3, cross3, normalize3, lerp3, clamp01, length3 } from "./math.js";

// ── Catmull-Rom 기본형 (uniform, tension 0.5) ────────────────────────────────
function catmullRom(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  );
}

// ── Curve1: {points: [{t, value}, ...]} — t 오름차순, [0,1] 범위 ─────────────
/** 스칼라 곡선 평가. 끝점은 클램프(양 끝 제어점 복제). */
export function evaluateCurve1(spec, t) {
  const pts = spec.points;
  const n = pts.length;
  if (n === 1) return pts[0].value;
  const tc = clamp01(t);
  // 구간 탐색 (제어점 수가 작으므로 선형 탐색으로 충분)
  let i = 0;
  while (i < n - 2 && tc > pts[i + 1].t) i++;
  const t1 = pts[i].t;
  const t2 = pts[i + 1].t;
  const u = t2 > t1 ? clamp01((tc - t1) / (t2 - t1)) : 0;
  const v0 = pts[Math.max(0, i - 1)].value;
  const v1 = pts[i].value;
  const v2 = pts[i + 1].value;
  const v3 = pts[Math.min(n - 1, i + 2)].value;
  return catmullRom(v0, v1, v2, v3, u);
}

// ── Curve3: {points: [[x,y,z], ...]} — uniform 파라미터화 ────────────────────
function evaluatePoints3(pts, t) {
  const n = pts.length;
  if (n === 1) return [...pts[0]];
  const segCount = n - 1;
  const tc = clamp01(t);
  let i = Math.min(segCount - 1, Math.floor(tc * segCount));
  const u = tc * segCount - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n - 1, i + 2)];
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], u),
    catmullRom(p0[1], p1[1], p2[1], p3[1], u),
    catmullRom(p0[2], p1[2], p2[2], p3[2], u),
  ];
}

function tangentAt(pts, t) {
  // 수치 미분 (중앙차분, 끝점은 한쪽차분)
  const h = 1e-4;
  const a = evaluatePoints3(pts, Math.max(0, t - h));
  const b = evaluatePoints3(pts, Math.min(1, t + h));
  return normalize3(sub3(b, a));
}

/**
 * 3D 곡선 + RMF 프레임.
 * frame(t) = { tangent, normal, binormal } — double reflection 법으로 전파,
 * frameSamples 개의 사전 계산 프레임을 선형 보간 + 재직교화해 조회한다.
 * 시작 normal 은 월드 +X 를 tangent 에 직교화한 것 (직선검에서 폭 방향 = +X 규약, 02 §3).
 */
export function createCurve3(spec, frameSamples = 64) {
  const pts = spec.points;
  const N = Math.max(2, frameSamples);

  // 샘플 위치·탄젠트
  const samplePos = [];
  const sampleTan = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    samplePos.push(evaluatePoints3(pts, t));
    sampleTan.push(tangentAt(pts, t));
  }

  // 시작 프레임: +X 를 우선, 탄젠트와 거의 평행하면 +Z 로 대체
  const t0 = sampleTan[0];
  let ref = Math.abs(dot3(t0, [1, 0, 0])) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  let n0 = normalize3(sub3(ref, scale3(t0, dot3(ref, t0))));

  const normals = [n0];
  for (let i = 0; i < N; i++) {
    // double reflection (Wang et al. 2008)
    const v1 = sub3(samplePos[i + 1], samplePos[i]);
    const c1 = dot3(v1, v1);
    let nL = normals[i];
    let tL = sampleTan[i];
    if (c1 > 1e-16) {
      nL = sub3(nL, scale3(v1, (2 / c1) * dot3(v1, nL)));
      tL = sub3(tL, scale3(v1, (2 / c1) * dot3(v1, tL)));
    }
    const v2 = sub3(sampleTan[i + 1], tL);
    const c2 = dot3(v2, v2);
    let nNext = c2 > 1e-16 ? sub3(nL, scale3(v2, (2 / c2) * dot3(v2, nL))) : nL;
    // 누적 오차 방지: 탄젠트에 재직교화
    const tN = sampleTan[i + 1];
    nNext = normalize3(sub3(nNext, scale3(tN, dot3(nNext, tN))));
    normals.push(nNext);
  }

  return {
    evaluate: (t) => evaluatePoints3(pts, t),

    frame(t) {
      const tc = clamp01(t);
      const x = tc * N;
      const i = Math.min(N - 1, Math.floor(x));
      const u = x - i;
      const tangent = normalize3(lerp3(sampleTan[i], sampleTan[i + 1], u));
      let normal = lerp3(normals[i], normals[i + 1], u);
      normal = normalize3(sub3(normal, scale3(tangent, dot3(normal, tangent))));
      const binormal = cross3(tangent, normal);
      return { tangent, normal, binormal };
    },
  };
}

/**
 * t 균등 샘플 n+1 지점의 누적 호길이(Float64Array).
 * 정확도를 위해 구간마다 8 서브샘플.
 */
export function buildArcLengthTable(curve, n) {
  const table = new Float64Array(n + 1);
  const SUB = 8;
  let acc = 0;
  let prev = curve.evaluate(0);
  for (let i = 1; i <= n; i++) {
    for (let k = 1; k <= SUB; k++) {
      const t = (i - 1 + k / SUB) / n;
      const p = curve.evaluate(t);
      acc += length3(sub3(p, prev));
      prev = p;
    }
    table[i] = acc;
  }
  return table;
}
