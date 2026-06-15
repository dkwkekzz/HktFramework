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
  // 준위 에너지의 Z 의존(step-0013, 노브 zScale 게이트 — 원소별 스펙트럼).
  //   ⚠ levelE 는 동결 앵커(Z 무관 수소 사다리)다 — 시그니처/수치 의미 불변. 여기 *새 함수*가 가법으로 Z 를 얹는다.
  //   단전자 *수소형* 이온(e=1)의 들뜸 E ∝ Z² (보어 닫힌 형식 E_n=−R·Z²/n² ⇒ 들뜸 E=Z²·levelE(x)).
  //   다전자(e≠1): step-0014 차폐 노브 screen 게이트 — 유효핵전하 Z_eff=Z−screen·(e−1) 로 E∝Z_eff²
  //     (다른 e−1 전자가 핵을 가림 → 실효 끌림 ↓ → 준위 얕아짐). screen=0 → 다전자 Z 무관(step-0013 보존·회귀 0).
  //   zScale 블렌드: 0 → 정확히 levelE(x)(회귀 0·바이트 동일) · 1 → 완전 Z(_eff)² 스케일 · 중간 → 보간(뷰어 슬라이더).
  //   ★ 닫힌 장부 핵심: Z·e 는 *런 중 불변*(어느 법칙도 안 바꿈) → 한 원자의 zfac(Z_eff 포함) 가 상수 →
  //     흡수(scatter·reheat·chemilum)와 방출(emit)이 *같은 zfac* 로 거래 → 들뜸 E 의 가감이 정확히 상쇄(E 보존).
  function levelEZ(x, Z, e, zScale, screen) {
    const base = levelE(x);
    if (!zScale) return base;                       // 노브=0 → 정확히 levelE (회귀 0)
    let zfac;
    if (e === 1) zfac = Z * Z;                      // 단전자 수소형 이온: 정확 E∝Z² (step-0013)
    else if (screen) { const zeff = Z - screen * (e - 1); zfac = zeff * zeff; }  // 다전자: 유효핵전하 Z_eff² (step-0014 차폐)
    else zfac = 1;                                  // 차폐 노브=0 → 다전자 Z 무관(step-0013 보존)
    return base * (1 + zScale * (zfac - 1));        // 0→levelE · 1→Z(_eff)²·levelE · 보간
  }
  // 광자 파장 — λ = hc/ΔE. 색은 author 가 아니라 준위 차에서 *나온다*(SPINE §3 요건3).
  function photonLambda(dE) { return H_PLANCK * C / dE; }

  // 닫힌 장부: 보존되어야 할 양들의 총합 (SPINE §2)
  //  Q 전하 = Σ(Z−e) · B 바리온 = Σ(Z+N) · L 렙톤 = Σe
  //  E 에너지-질량 = Σ(m·c² + ½m·v² + 들뜸E) + Σ 광자E  (e=mc² 정지+운동+들뜸+복사)
  //  px,py 운동량 = Σ m·v + Σ 광자운동량(p.px,p.py — step-0003 recoil 가법, 미설정 → 0)
  // 가법 규칙(SPINE §6.1): 들뜸항은 x=0 → 0, 광자항은 미존재/빈 배열 → 0 ⇒ 과거(step-0001) 장부 불변.
  function ledger(sim) {
    let Q = 0, B = 0, L = 0, E = 0, px = 0, py = 0;
    const lz = (sim.knobs && sim.knobs.levelZ) || 0;       // 준위 Z 의존(step-0013, 미설정/0 → levelE 그대로 = 과거 장부 불변)
    const sc = (sim.knobs && sim.knobs.levelScreen) || 0;  // 다전자 차폐(step-0014, 미설정/0 → step-0013 그대로)
    for (const a of sim.atoms) {
      const m = mass(a);
      Q += a.Z - a.e;
      B += a.Z + a.N;
      L += a.e;
      const v2 = a.vx * a.vx + a.vy * a.vy;
      E += m * C * C + 0.5 * m * v2 + levelEZ(a.x, a.Z, a.e, lz, sc);  // 들뜸 에너지(x=0 → 0; lz=0 → levelE)
      px += m * a.vx;
      py += m * a.vy;
    }
    // 복사장: 에너지 + 운동량(recoil). px·py 미설정(step-0002 이하) → 0 가법 → 과거 장부 불변.
    if (sim.photons) for (const p of sim.photons) { E += p.E; px += p.px || 0; py += p.py || 0; }
    // 복사 바스(step-0007 escape): 활성 배열에서 빠진 광자의 E·운동량 reservoir. 미존재(과거)→0 가법 → 장부 불변.
    if (sim.escaped) { E += sim.escaped.E; px += sim.escaped.px || 0; py += sim.escaped.py || 0; }
    // 결합 E reservoir(step-0010 bond): 비탄성 포획서 흡수한 상대 KE. 운동량-자유(스칼라) → E 만 가법. 미존재(과거)→0 → 장부 불변.
    if (sim.bondE) E += sim.bondE;
    // 쿨롱 PE(step-0019 coulomb): 연속 보존력의 위치 에너지 U=Σ_{i<j} kC·qa·qb/√(r²+ε²)(Plummer, 힘 법칙과 *정확히* 일치).
    //   가법 규칙: kCoulomb 미설정/0(과거 전 장면) → PE 항 0 → 장부 불변. 켜지면 KE↔PE 가 교환되며 총 E 유계 보존(반음시).
    const kc = (sim.knobs && sim.knobs.kCoulomb) || 0;
    if (kc) {
      const eps2 = ((sim.knobs.coulombSoft || 1)) ** 2;
      const A = sim.atoms;
      for (let i = 0; i < A.length; i++) {
        const qi = A[i].Z - A[i].e; if (qi === 0) continue;
        for (let j = i + 1; j < A.length; j++) {
          const qj = A[j].Z - A[j].e; if (qj === 0) continue;
          const dx = minImage(A[j].rx - A[i].rx, sim.W), dy = minImage(A[j].ry - A[i].ry, sim.H);
          E += kc * qi * qj / Math.sqrt(dx * dx + dy * dy + eps2);
        }
      }
    }
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
    // 복사 바스(step-0007): *정의됐을 때만* 섞는다 → 과거(바스 0) 해시 불변(가법 규칙).
    if (sim.escaped) { mixI(sim.escaped.count | 0); mixF(sim.escaped.E); mixF(sim.escaped.px); mixF(sim.escaped.py); }
    // 결합(step-0010): 결합 E reservoir·결합 간선 위상을 *정의됐을 때만* 섞는다 → 과거(결합 0) 해시 불변(가법 규칙).
    if (sim.bondE) mixF(sim.bondE);
    if (sim.bonds && sim.bonds.length) { mixI(sim.bonds.length); for (const e of sim.bonds) { mixI(e[0]); mixI(e[1]); } }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  return { C, RYDBERG, H_PLANCK, mulberry32, mass, levelE, levelEZ, photonLambda, ledger, minImage, hashState };
});
