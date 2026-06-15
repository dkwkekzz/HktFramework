// hgo-kernel.js — 동결 헬퍼 (결정론 PRNG · 상태 해시 · 보존 장부)
// 이 파일의 함수는 시리즈 회귀 앵커다 — 시그니처/수치 의미를 바꾸지 않는다(가법만).
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).kernel = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = 1; // 빛의 속도 = 1 (자연 단위) — e=mc² 의 c

  // 결정론 의사난수 (Math.random 금지). 같은 시드 → 같은 수열.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 원자 질량 = 양성자 + 중성자 (전자 질량 무시 — 단순화, SPINE §3 요건4-4)
  function mass(a) { return a.Z + a.N; }

  // 전자 들뜸 준위(x)의 에너지 — 이산 에너지 *고유값*(슈뢰딩거 수소 스펙트럼 E_n=−R/n², n=x+1; x=0 바닥→0).
  //   ※ 보어의 *궤도* 그림(불확정성 위배 → 하이젠베르크·슈뢰딩거가 기각)이 아니라, 그 그림이 우연히 맞힌
  //     *에너지 고유값*만 쓴다 — 궤도·반지름·각운동량 양자화는 시뮬 안 함(전이만 관측, 하이젠베르크 정신).
  //   준위 간격이 비선형 → 서로 다른 전이가 서로 다른 ΔE(=스펙트럼선) 창발(author 0).
  //   ⚠ 단순화: Z 무시 → 다전자 원자도 수소형 사다리(실제 수소형 E∝Z²·다전자 차폐 미반영, STATE §3 🔴).
  const RYDBERG = 1; // 들뜸 에너지 척도 R (자연 단위)
  const H_PLANCK = 1; // 플랑크 상수 h (자연 단위) — λ = h·c/ΔE
  function levelE(x) { const n = (x | 0) + 1; return RYDBERG * (1 - 1 / (n * n)); }
  // 광자 파장 — λ = hc/ΔE. 색은 author 가 아니라 준위 차에서 *나온다*(SPINE §3 요건3).
  function photonLambda(dE) { return H_PLANCK * C / dE; }

  // 닫힌 장부: 보존되어야 할 양들의 총합 (SPINE §2)
  //  Q 전하 = Σ(Z−e) · B 바리온 = Σ(Z+N) · L 렙톤 = Σe
  //  E 에너지-질량 = Σ(m·c² + ½m·v² + 들뜸E) + Σ 광자E  (e=mc² 정지+운동+들뜸+복사)
  //  px,py 운동량 = Σ m·v + Σ 광자운동량(p.px,p.py — step-0003 recoil 가법, 미설정 → 0)
  // 가법 규칙(SPINE §6.1): 들뜸항은 x=0 → 0, 광자항은 미존재/빈 배열 → 0 ⇒ 과거(step-0001) 장부 불변.
  function ledger(sim) {
    let Q = 0, B = 0, L = 0, E = 0, px = 0, py = 0;
    for (const a of sim.atoms) {
      const m = mass(a);
      Q += a.Z - a.e;
      B += a.Z + a.N;
      L += a.e;
      const v2 = a.vx * a.vx + a.vy * a.vy;
      E += m * C * C + 0.5 * m * v2 + levelE(a.x);  // 들뜸 에너지(x=0 → 0)
      px += m * a.vx;
      py += m * a.vy;
    }
    // 복사장: 에너지 + 운동량(recoil). px·py 미설정(step-0002 이하) → 0 가법 → 과거 장부 불변.
    if (sim.photons) for (const p of sim.photons) { E += p.E; px += p.px || 0; py += p.py || 0; }
    return { Q, B, L, E, px, py };
  }

  // 토러스 최소상(min-image) 변위 — 경계 wrap 을 가로지르는 거리 보정
  function minImage(d, max) {
    d %= max;
    if (d > max / 2) d -= max;
    if (d < -max / 2) d += max;
    return d;
  }

  // 전체 상태의 결정론 해시 (float64 비트까지) — 결정론·골든 회귀 앵커.
  // 가법 규칙: 새 필드는 *정의됐을 때만* 섞는다(미존재 시 no-op → 과거 해시 불변).
  function hashState(sim) {
    let h = 0x811c9dc5; // FNV-1a 32bit
    const buf = new ArrayBuffer(8), dv = new DataView(buf);
    function mixI(x) { h ^= (x | 0); h = Math.imul(h, 0x01000193); }
    function mixF(x) { dv.setFloat64(0, x); for (let b = 0; b < 8; b++) { h ^= dv.getUint8(b); h = Math.imul(h, 0x01000193); } }
    mixI(sim.atoms.length);
    for (const a of sim.atoms) {
      mixI(a.Z); mixI(a.N); mixI(a.e); mixI(a.x | 0);
      mixF(a.rx); mixF(a.ry); mixF(a.vx); mixF(a.vy);
    }
    // 광자: *비어 있지 않을 때만* 섞는다 → 과거(광자 0) 해시 불변(가법 규칙).
    if (sim.photons && sim.photons.length) {
      mixI(sim.photons.length);
      for (const p of sim.photons) { mixI(p.from); mixI(p.to); mixF(p.E); mixF(p.rx); mixF(p.ry); }
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  return { C, RYDBERG, H_PLANCK, mulberry32, mass, levelE, photonLambda, ledger, minImage, hashState };
});
