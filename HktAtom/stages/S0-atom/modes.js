// modes.js — ⑦ 내부 모드 (진동·회전) → 열용량 계단.
//
// 열용량 계단은 순수 양자 효과다: 고전 점입자는 등분배로 모든 자유도가 항상 활성이라
// 계단을 못 만든다. 그래서 이핵 분자를 **강체 회전자 + 양자화 모드**로 다룬다:
//   · 병진: COM 2D (자유도 2 → C=1)
//   · 진동: 등간격 사다리 Eₙ=n·ħω (자유도 2=운동+퍼텐셜 → 고온 C=1)
//   · 회전: 2D 강체 회전자 E_J=B·J² (축퇴 g_J: J=0→1·J≥1→2, 자유도 1 → 고온 C=1/2)
// 모드↔병진 에너지 교환은 ④의 Larsen–Borgnakke 재분배(2D 상태밀도 평탄 → g 가중)로.
// 간격 위계 B_rot ≪ ħω 가 계단의 근원: T 가 각 간격을 넘을 때 모드가 순차 언프리즈.
//
// self-contained: 핵심 엔진(①–⑥) 을 건드리지 않는다 (회귀 0). rng·Vec 만 재사용.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  const HBW = 2.0;    // ħω 진동 양자 (노브)
  const BROT = 0.02;  // 회전 상수 B — E_J=B·J² (노브 · B ≪ ħω 로 계단 창 분리)

  const vibE = (n) => n * HBW;
  const rotE = (J) => BROT * J * J;
  const rotG = (J) => (J === 0 ? 1 : 2);

  // LB 진동 재분배: E_c=상대KE+Eₙ 에서 후보 n(Eₙ≤E_c)을 균일(g=1) 선택
  function lbVib(rng, KE, nOld) {
    const Ec = KE + vibE(nOld);
    const nmax = Math.floor(Ec / HBW + 1e-9);
    const n = (rng() * (nmax + 1)) | 0;
    return { n, KE: Ec - vibE(n) };
  }
  // LB 회전 재분배: 후보 J(E_J≤E_c)을 g_J 가중 선택 (2D 병진 상태밀도 평탄)
  function lbRot(rng, KE, JOld) {
    const Ec = KE + rotE(JOld);
    const Jmax = Math.floor(Math.sqrt(Ec / BROT) + 1e-9);
    let tot = 0; for (let J = 0; J <= Jmax; J++) tot += rotG(J);
    let x = rng() * tot, J = 0;
    for (; J <= Jmax; J++) { x -= rotG(J); if (x < 0) break; }
    if (J > Jmax) J = Jmax;
    return { J, KE: Ec - rotE(J) };
  }

  // 강체 이핵 분자 기체 (2D COM + 양자 모드)
  function makeGas(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 7007);
    const N = o.N || 120, L = o.L || 22, M = o.M || 2, T0 = o.T0 != null ? o.T0 : 1.0;
    const mols = [];
    const per = Math.ceil(Math.sqrt(N)), g = L / per;
    let k = 0;
    for (let i = 0; i < per && k < N; i++) for (let j = 0; j < per && k < N; j++, k++) {
      const s = Math.sqrt(M * T0);
      mols.push({ x: (i + 0.5) * g, y: (j + 0.5) * g, px: s * gauss(rng), py: s * gauss(rng), M, nVib: 0, J: 0, th: rng() * 6.283, om: 0 });
    }
    // 무게중심 표류 제거
    let Px = 0, Py = 0; for (const m of mols) { Px += m.px; Py += m.py; } Px /= mols.length; Py /= mols.length;
    for (const m of mols) { m.px -= Px; m.py -= Py; }
    return { mols, L, rng, rc: o.rc != null ? o.rc : 1.8, nu: o.nu != null ? o.nu : 3, dt: o.dt != null ? o.dt : 0.01, d0: o.d0 != null ? o.d0 : 1.0 };
  }
  function gauss(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }

  function comKE(w) { let k = 0; for (const m of w.mols) k += (m.px * m.px + m.py * m.py) / (2 * m.M); return k; }
  function uVib(w) { let u = 0; for (const m of w.mols) u += vibE(m.nVib); return u; }
  function uRot(w) { let u = 0; for (const m of w.mols) u += rotE(m.J); return u; }
  function energy(w) { return comKE(w) + uVib(w) + uRot(w); }
  function temperature(w) { return comKE(w) / w.mols.length; }   // 2D: ⟨comKE⟩=N·T

  function step(w) {
    const dt = w.dt, L = w.L, mols = w.mols;
    for (const m of mols) {
      m.x = ((m.x + m.px / m.M * dt) % L + L) % L;
      m.y = ((m.y + m.py / m.M * dt) % L + L) % L;
      m.th += m.om * dt;                                // 시각화용 자전 (J 에 비례)
    }
    // 접촉 충돌 → LB 모드 교환
    const rc2 = w.rc * w.rc;
    for (let i = 0; i < mols.length; i++) for (let j = i + 1; j < mols.length; j++) {
      const a = mols[i], b = mols[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L);
      if (dx * dx + dy * dy > rc2) continue;
      if (w.rng() >= 1 - Math.exp(-w.nu * dt)) continue;
      collide(w, a, b);
    }
  }

  function relKE(a, b) {
    const mu = a.M * b.M / (a.M + b.M);
    const vx = a.px / a.M - b.px / b.M, vy = a.py / a.M - b.py / b.M;
    return { KE: 0.5 * mu * (vx * vx + vy * vy), mu, vx, vy };
  }
  function setRelKE(a, b, newKE, r) {
    if (r.KE <= 0) return;
    const s = Math.sqrt(Math.max(0, newKE) / r.KE), Mt = a.M + b.M;
    const vcx = (a.px + b.px) / Mt, vcy = (a.py + b.py) / Mt;
    const nvx = r.vx * s, nvy = r.vy * s;
    a.px = a.M * (vcx + (b.M / Mt) * nvx); a.py = a.M * (vcy + (b.M / Mt) * nvy);
    b.px = b.M * (vcx - (a.M / Mt) * nvx); b.py = b.M * (vcy - (a.M / Mt) * nvy);
  }
  function collide(w, a, b) {
    const tgt = w.rng() < 0.5 ? a : b;                 // 한 분자의 한 모드와 교환
    const r = relKE(a, b);
    if (w.rng() < 0.5) {                               // 진동
      const res = lbVib(w.rng, r.KE, tgt.nVib); tgt.nVib = res.n; setRelKE(a, b, res.KE, r);
    } else {                                           // 회전
      const res = lbRot(w.rng, r.KE, tgt.J); tgt.J = res.J; setRelKE(a, b, res.KE, r);
      tgt.om = (tgt.J ? Math.sqrt(rotE(tgt.J)) : 0) * (w.rng() < 0.5 ? 1 : -1) * 0.5;
    }
  }

  function run(w, ticks) { for (let i = 0; i < ticks; i++) step(w); return w; }

  // C_v(T) 곡선: 여러 총에너지(T0)로 평형 후 (T, E) 측정 → 유한 차분 dE/dT
  function cvCurve(T0s, opts) {
    const pts = [];
    for (const T0 of T0s) {
      const w = makeGas(Object.assign({ T0, seed: (opts && opts.seed) || 11 }, opts));
      run(w, (opts && opts.ticks) || 5000);
      pts.push({ T: temperature(w), E: energy(w) / w.mols.length });   // 분자당
    }
    pts.sort((p, q) => p.T - q.T);
    const cv = [];
    for (let i = 1; i < pts.length; i++) cv.push({ T: (pts[i].T + pts[i - 1].T) / 2, Cv: (pts[i].E - pts[i - 1].E) / (pts[i].T - pts[i - 1].T) });
    return { pts, cv };
  }

  const api = { HBW, BROT, vibE, rotE, rotG, makeGas, step, run, energy, temperature, comKE, uVib, uRot, cvCurve };
  if (isNode) module.exports = api;
  else window.HktS0Modes = api;
})();
