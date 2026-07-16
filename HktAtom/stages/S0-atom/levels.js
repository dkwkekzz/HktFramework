// levels.js — ③ 준위·예산. 전자 구조의 전부를 순수 함수로 (시뮬 불필요·①②와 독립).
//
// Z → 부껍질 점유(Aufbau+파울리) → 준위 에너지(간이 Slater) → 이온화 E·전자친화도
// → 연속 결합차수 예산 B. 실원소는 fromZ 로 유도, 가상 원소는 직접 author (바닥 특권).
// 엔진은 실/가상을 구별하지 않는다 — 인터페이스가 같기 때문.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // Aufbau 순서 · 부껍질 축퇴도 g · 유효 주양자수 n* (Slater) · Rydberg 노브
  const AUFBAU = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p'];
  const GCAP = { s: 2, p: 6, d: 10 };
  const NEFF = { 1: 1, 2: 2, 3: 3, 4: 3.7, 5: 4.0 };
  const R = 1.0;          // 노브 (무차원 — 목표는 경향, 실수치 아님)
  const D_TYP = 0.5;      // 대표 결합 에너지 (승위 이득 계산 노브)

  const nOf = (sh) => +sh[0];
  const lOf = (sh) => sh[1];
  const cap = (sh) => GCAP[lOf(sh)];

  // fillZ: Aufbau + 파울리로 Z 개 전자를 부껍질에 채운다 (Cr·Cu 등 예외 무시 — 한계 정직)
  function fillZ(Z) {
    const occ = {}; let rem = Z;
    for (const sh of AUFBAU) { if (rem <= 0) break; const c = Math.min(cap(sh), rem); occ[sh] = c; rem -= c; }
    return occ;
  }

  // zeff: 간이 Slater 차폐 — 동일 그룹 0.35(1s 0.30) · (n−1) 0.85 · 안쪽 1.0 · 바깥 0
  function zeff(Z, shell, occ) {
    const n = nOf(shell); let S = 0;
    for (const name in occ) {
      const cnt = occ[name]; if (!cnt) continue;
      const nn = nOf(name);
      if (name === shell) S += (cnt - 1) * (shell === '1s' ? 0.30 : 0.35);
      else if (nn === n) S += cnt * 0.35;
      else if (nn === n - 1) S += cnt * 0.85;
      else if (nn < n - 1) S += cnt * 1.0;
      // nn > n (바깥 껍질): 0
    }
    return Z - S;
  }

  // 준위 에너지 ε(부껍질) = −R·(Zeff/n*)²
  function eps(Z, shell, occ) {
    const ze = zeff(Z, shell, occ);
    const ne = NEFF[nOf(shell)] || nOf(shell);
    return -R * (ze / ne) * (ze / ne);
  }

  // 최고 점유 부껍질 (HOMO)
  function homo(occ) {
    let last = null;
    for (const sh of AUFBAU) if (occ[sh] > 0) last = sh;
    return last;
  }

  // 이온화 E = −ε(HOMO) (최외각을 떼는 비용)
  function ionizationE(Z, occ) { occ = occ || fillZ(Z); return -eps(Z, homo(occ), occ); }

  // 전자친화도 ≈ 새로 들어갈 부껍질의 −ε (전자 1 추가 후 zeff 재계산 — 간이)
  function affinity(Z, occ) {
    occ = occ || fillZ(Z);
    let addSh = null;
    for (const sh of AUFBAU) { if ((occ[sh] || 0) < cap(sh)) { addSh = sh; break; } }
    if (!addSh) return 0;
    const occ2 = Object.assign({}, occ); occ2[addSh] = (occ2[addSh] || 0) + 1;
    return -eps(Z + 1, addSh, occ2);   // Z+1: 추가 전자가 느끼는 핵전하 근사 유지 (간이)
  }

  // 훈트: 부껍질 내 홀전자 수 (단일 점유 우선 배치 후)
  function unpairedIn(shell, cnt) { const orb = cap(shell) / 2; return cnt <= orb ? cnt : (2 * orb - cnt); }
  function unpaired(occ) { let u = 0; for (const sh in occ) u += unpairedIn(sh, occ[sh]); return u; }

  // 결합차수 예산 B (연속량) — 바닥 홀전자 + s→p 승위 (같은 n 에서 이득>비용이면 채택)
  function budget(Z, occ) {
    occ = occ || fillZ(Z);
    const h = homo(occ); if (!h) return 0;
    const base = unpaired(occ);
    const n = nOf(h), sSh = n + 's', pSh = n + 'p';
    // p 부껍질은 n≥2 에서만 존재. 비어 있어도(occ 에 없어도) 승위 대상 (Be·Mg 의 2가 경로)
    const pOcc = occ[pSh] || 0;
    if (n >= 2 && occ[sSh] === 2 && pOcc < cap(pSh)) {
      const promo = Object.assign({}, occ); promo[sSh] = 1; promo[pSh] = pOcc + 1;
      const extra = unpaired(promo) - base;
      if (extra > 0) {
        const cost = eps(Z, pSh, occ) - eps(Z, sSh, occ);  // s→p 승위 비용 (≥0)
        const gain = extra * D_TYP;
        if (cost < gain) return unpaired(promo);            // 승위 채택 (C 가 4가 되는 경로)
      }
    }
    return base;
  }

  // 실원소 종 명세 유도 (species 인터페이스 — 가상 원소와 동일 형태)
  function fromZ(Z, extra) {
    const occ = fillZ(Z);
    const levels = AUFBAU.filter((sh) => occ[sh] > 0).map((sh) => ({ name: sh, g: cap(sh), eps: eps(Z, sh, occ) }));
    return Object.assign({
      id: 'Z' + Z, Z, m: Z, sigma: 1.0, eps_rep: 1.0,
      levels, occ0: occ, B: budget(Z, occ),
      IE: ionizationE(Z, occ), EA: affinity(Z, occ), color: '#8ab',
    }, extra || {});
  }

  // 볼츠만 점유 분포: gᵢ·e^{−(εᵢ−ε_min)/T} 정규화 (④ 검증의 기준 곡선)
  function boltzmann(levels, T) {
    const emin = Math.min.apply(null, levels.map((l) => l.eps));
    const w = levels.map((l) => l.g * Math.exp(-(l.eps - emin) / T));
    const Zsum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / Zsum);
  }

  // 가상 원소 4종 (author — 구현이 앵커 assert 로 확정). V1 준위 간격 > V2 (스펙트럼 구분).
  const VIRTUAL = {
    V1: { id: 'V1', m: 1, sigma: 1.0, eps_rep: 1.0, B: 1, alpha: 0.3, color: '#e6e6e6',
      levels: [{ name: 'g', g: 2, eps: -1.0 }, { name: 'e1', g: 2, eps: -0.30 }], occ0: { g: 1 }, like: 'H' },
    V0: { id: 'V0', m: 4, sigma: 1.0, eps_rep: 1.0, B: 0, alpha: 0.10, color: '#7bd',
      levels: [{ name: 'g', g: 2, eps: -2.0 }, { name: 'e1', g: 2, eps: -0.50 }], occ0: { g: 2 }, like: 'He/Ne' },
    V2: { id: 'V2', m: 16, sigma: 1.1, eps_rep: 1.0, B: 2, alpha: 0.80, color: '#e55',
      levels: [{ name: 'g', g: 6, eps: -1.5 }, { name: 'e1', g: 6, eps: -1.15 }], occ0: { g: 4 }, like: 'O' },
    V4: { id: 'V4', m: 12, sigma: 1.05, eps_rep: 1.0, B: 4, alpha: 1.0, color: '#555',
      levels: [{ name: 'g', g: 4, eps: -1.8 }, { name: 'e1', g: 4, eps: -1.3 }], occ0: { g: 2 }, like: 'C', Bpre: 2 },
  };

  const api = {
    AUFBAU, GCAP, NEFF, R, D_TYP,
    fillZ, zeff, eps, homo, ionizationE, affinity, unpaired, budget, fromZ, boltzmann, VIRTUAL,
  };
  if (isNode) module.exports = api;
  else window.HktS0Levels = api;
})();
