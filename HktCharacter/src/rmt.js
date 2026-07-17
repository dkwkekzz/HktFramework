// ============================================================================
//  rmt.js — 무작위 행렬 이론(RMT) 표본기. three 무의존 순수 수학 (Node 검증 공용).
//
//  배경: 리만 제타 함수 영점의 간격 통계는 GUE(가우시안 유니터리 앙상블)의
//  고유값 간격 통계와 일치한다(Montgomery–Odlyzko). GUE 의 핵심 성질이
//  **준위 반발(level repulsion)** — 이웃 간격 s 의 밀도가 s→0 에서 s² 로
//  사라져, "완전한 무작위이면서 절대 뭉치지 않는" 배열을 만든다.
//  (푸아송/일반 난수는 P(s)=e^{-s} — s=0 근처가 가장 흔해서 뭉친다.)
//
//  제공하는 표본:
//   · gueSpacings(n, seed)  — 1D. β=2 에르미트(=GUE) 삼중대각 앙상블
//     (Dumitriu–Edelman 2002)의 고유값을 QL 로 풀고, 벌크를 국소 창
//     언폴딩해 평균 1 의 간격열로 만든다. Wigner surmise
//     P(s) = (32/π²)s²e^{-4s²/π} 를 따른다 (verify/rmt-verify.mjs 로 검증).
//   · ginibrePoints(n, seed) — 2D. 지니브르 앙상블 고유값의 결합 밀도
//     ∝ ∏|zᵢ-zⱼ|² e^{-nΣ|zᵢ|²} 는 2D 쿨롱 가스(β=2)와 동일 — 이를
//     메트로폴리스 MCMC 로 표본한다. 평형은 단위원판 균일 + 쌍 반발:
//     거시적으론 균일하게 흩어지고 미시적으론 서로 밀어낸다.
//     (일반 복소 행렬의 고유값 직접 계산 대신 로그-가스 표현을 쓴다.)
//
//  모든 함수는 시드 결정론 — 같은 seed 는 항상 같은 표본.
// ============================================================================

// ---------------------------------------------------------------------------
//  시드 PRNG + 가우시안
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller — rng 소비량이 호출마다 일정(2회)하도록 캐시 없는 단순형
export function gauss(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// ---------------------------------------------------------------------------
//  대칭 삼중대각 고유값 — 암시적 시프트 QL (고유값 전용, Numerical Recipes tqli)
//  diag: 길이 n, off: 길이 n-1 (off[i] 는 d[i]–d[i+1] 결합). 오름차순 반환.
// ---------------------------------------------------------------------------
export function tridiagEigenvalues(diag, off) {
  const n = diag.length;
  const d = Float64Array.from(diag);
  const e = new Float64Array(n); // e[n-1] = 0 패딩
  for (let i = 0; i < n - 1; i++) e[i] = off[i];
  for (let l = 0; l < n; l++) {
    let iter = 0;
    for (;;) {
      let m;
      for (m = l; m < n - 1; m++) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) + dd === dd) break; // e[m] 이 상대적으로 0 이면 분할
      }
      if (m === l) break;
      if (iter++ === 60) throw new Error('tridiagEigenvalues: QL 수렴 실패');
      let g = (d[l + 1] - d[l]) / (2 * e[l]);
      let r = Math.hypot(g, 1);
      g = d[m] - d[l] + e[l] / (g + (g >= 0 ? r : -r)); // Wilkinson 시프트
      let s = 1, c = 1, p = 0;
      let underflow = false;
      for (let i = m - 1; i >= l; i--) {
        let f = s * e[i];
        const b = c * e[i];
        r = Math.hypot(f, g);
        e[i + 1] = r;
        if (r === 0) { d[i + 1] -= p; e[m] = 0; underflow = true; break; }
        s = f / r; c = g / r;
        g = d[i + 1] - p;
        r = (d[i] - g) * s + 2 * c * b;
        p = s * r;
        d[i + 1] = g + p;
        g = c * r - b;
      }
      if (underflow) continue;
      d[l] -= p; e[l] = g; e[m] = 0;
    }
  }
  return Array.from(d).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
//  GUE (β=2) 고유값 — Dumitriu–Edelman 삼중대각 모형.
//  대각 dᵢ ~ N(0,1), 부대각 eₖ ~ χ_{2(n-k)}/√2 (χ² 은 정수 자유도라 제곱합으로 정확).
// ---------------------------------------------------------------------------
export function gueEigenvalues(n, rng) {
  const d = new Float64Array(n);
  const e = new Float64Array(n - 1);
  for (let i = 0; i < n; i++) d[i] = gauss(rng);
  for (let k = 1; k < n; k++) {
    const dof = 2 * (n - k);
    let sum = 0;
    for (let j = 0; j < dof; j++) { const g = gauss(rng); sum += g * g; }
    e[k - 1] = Math.sqrt(sum) / Math.SQRT2;
  }
  return tridiagEigenvalues(d, e);
}

// GUE 벌크의 언폴딩된 이웃 간격열 (평균 1). 스펙트럼 가장자리(밀도 급변)는
// bulkTrim 비율만큼 버리고, 국소 창 평균 간격으로 나눠 밀도 변화를 제거한다.
export function gueSpacings(n, seed, { bulkTrim = 0.1, window = 21 } = {}) {
  const ev = gueEigenvalues(n, mulberry32(seed));
  const lo = Math.floor(n * bulkTrim);
  const bulk = ev.slice(lo, n - lo);
  const gaps = [];
  for (let i = 0; i + 1 < bulk.length; i++) gaps.push(bulk[i + 1] - bulk[i]);
  const h = window >> 1;
  const s = gaps.map((g, i) => {
    const a = Math.max(0, i - h), b = Math.min(gaps.length, i + h + 1);
    let m = 0;
    for (let j = a; j < b; j++) m += gaps[j];
    return g / (m / (b - a));
  });
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return s.map(v => v / mean);
}

// ---------------------------------------------------------------------------
//  지니브르 2D 점과정 — 로그-가스 메트로폴리스.
//  logL = Σ_{i<j} log|zᵢ-zⱼ|² − n Σ|zᵢ|². 초기 배치를 평형 거시 분포(원판 균일)
//  로 두므로 MCMC 는 미시 반발 구조만 형성하면 된다 → 적은 sweep 로 수렴.
//  반환 점은 대략 단위원판 안 (호출자가 원하는 반경으로 스케일).
// ---------------------------------------------------------------------------
export function ginibrePoints(n, seed, sweeps = 260) {
  const rng = mulberry32(seed);
  const x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rng()), t = 2 * Math.PI * rng();
    x[i] = r * Math.cos(t); y[i] = r * Math.sin(t);
  }
  const sigma = 0.7 / Math.sqrt(n); // 제안 폭 ≈ 평균 점간격 절반 — 채택률 균형
  for (let sw = 0; sw < sweeps; sw++) {
    for (let i = 0; i < n; i++) {
      const nx = x[i] + gauss(rng) * sigma;
      const ny = y[i] + gauss(rng) * sigma;
      let dL = -n * (nx * nx + ny * ny - x[i] * x[i] - y[i] * y[i]);
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dxn = nx - x[j], dyn = ny - y[j];
        const dn = dxn * dxn + dyn * dyn;
        if (dn < 1e-18) { ok = false; break; } // 정확히 겹치는 제안은 기각 (log 0 가드)
        const dxo = x[i] - x[j], dyo = y[i] - y[j];
        dL += Math.log(dn) - Math.log(dxo * dxo + dyo * dyo);
      }
      if (ok && Math.log(rng() + 1e-12) < dL) { x[i] = nx; y[i] = ny; }
    }
  }
  return { x: Array.from(x), y: Array.from(y) };
}

// 비교용 — 흔한 "일반 난수" 배치 (원판 균일, 반발 없음 → 뭉침/공백 발생)
export function uniformDiskPoints(n, seed) {
  const rng = mulberry32(seed);
  const x = new Array(n), y = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rng()), t = 2 * Math.PI * rng();
    x[i] = r * Math.cos(t); y[i] = r * Math.sin(t);
  }
  return { x, y };
}
