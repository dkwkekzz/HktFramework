// material.js — ㉒ MaterialModel ⇧ (실제 S1 입력). S0 의 *진짜* 출력 산출.
//
// ⑪ MVP(output.json v0)는 배관 증명이라 거시를 단일 macro 점(V·E·T·P 하나)으로만 남겼다.
// ㉒ 는 그 자리에 **굴려서 측정한 상태방정식 EOS 표** P(T,ρ)·U(T,ρ) 를 채운다 (author 0 —
//   실세계 앵커가 아니라 S0 시뮬을 T×ρ 그리드에서 NVT 로 굴린 측정값). 이것이 S1 이 굴릴
//   상태축 [T, ρ] 의 기반이며, 자기일관(C_v=∂U/∂T≈⑦)으로 검증한다.
//
// self-contained: 핵심 엔진(①–⑳)을 건드리지 않는다 (engine diff 0 — hbond/acidbase/… 동형).
//   engine·scenes·measure 만 재사용. output.json 은 CONTRACT §7 가법 확장(스키마 태그 유지·no-op 호환).
//
// 압력 정합 원칙: waterSoup(pairForces) 를 EOS 무대로 쓴다 — world.virial 이 힘 모델과 *정확히*
//   일치하기 때문(쿨롱+척력). polForces(분산 응집)는 분산 virial 을 world.virial 에 안 넣어
//   압력이 에너지와 불일치 → EOS 무대 부적합. 분산 응집의 EOS 접힘은 ㉒-b 후속(§경계).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const S = isNode ? require('./scenes.js') : window.HktS0Scenes;
  const M = isNode ? require('./measure.js') : window.HktS0Measure;

  // 물질 에너지 = 개체 안에 든 에너지만 (병진+퍼텐셜+내부). 떠난 에너지(복사·탈출·핵)는 제외
  //   — S1 개체의 u′ 로 접히는 것은 물질 에너지뿐 (promote.matterEnergy 동형·회계 정직).
  const LEFT_BINS = { E_photon: 1, E_escape: 1, E_nuclear: 1 };
  function matterEnergy(world) {
    E.recomputeLedger(world);
    let s = 0; for (const b of E.LEDGER_BINS) if (!LEFT_BINS[b]) s += world.ledger[b];
    return s;
  }

  // NVT 항온조: 목표 T 로 병진 KE 재척도. 뺀/넣은 열은 E_escape 로 회계 → 장부 닫힘
  //   (scenes.thermoReservoir 동형 — ④ 복사 냉각과 같은 정직). frozenZ 2D: T = 2K/(2N) = K/N.
  function thermostat(world, Ttar) {
    const n = world.atoms.length; if (!n) return;
    E.recomputeLedger(world);
    const dof = world.frozenZ ? 2 : 3;
    const Kb = world.ledger.K_tr, Tc = 2 * Kb / (dof * n);
    if (Tc <= 1e-12) return;
    const sc = Math.sqrt(Ttar / Tc);
    for (const a of world.atoms) { a.p.x *= sc; a.p.y *= sc; if (!world.frozenZ) a.p.z *= sc; }
    E.recomputeLedger(world);
    world.ledger.E_escape += Kb - world.ledger.K_tr;   // 저수지 회계 (장부 닫힘)
  }

  // 평형화: NVT 로 굴려 정상 상태에 도달. thermoEvery tick 마다 항온조.
  function equilibrate(world, Ttar, ticks, thermoEvery) {
    thermoEvery = thermoEvery || 20;
    for (let k = 0; k < ticks; k++) { E.step(world); if (k % thermoEvery === 0) thermostat(world, Ttar); }
  }

  // 표본화: 평형 후 NVT 유지하며 P(비리얼)·U(물질) 를 stride 마다 채집 → 시계열.
  function sample(world, Ttar, ticks, stride, thermoEvery) {
    stride = stride || 100; thermoEvery = thermoEvery || 20;
    const Ps = [], Us = [], Ts = [];
    for (let k = 0; k < ticks; k++) {
      E.step(world);
      if (k % thermoEvery === 0) thermostat(world, Ttar);
      if (k % stride === 0) { Ps.push(M.pressure(world)); Us.push(matterEnergy(world)); Ts.push(M.temperature(world)); }
    }
    return { Ps, Us, Ts };
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const stderr = (xs) => { if (xs.length < 2) return 0; const m = mean(xs); const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1); return Math.sqrt(v / xs.length); };

  // ── EOS 한 점 (T, ρ) 측정 ──
  //   ρ 를 상자 크기로 실현: frozenZ 2D 넓이 A=N/ρ → L=√(N/ρ). waterSoup(N=3n) 을 그 L·T0=T 로
  //   빌드 → 평형 → 표본. 반응성(공유 결합) 활성이라 EOS 는 *반응 혼합물*의 상태함수 (정직).
  function eosPoint(T, rho, opts) {
    opts = opts || {};
    const n = opts.n || 16;                       // waterSoup n → N = 3n 원자
    const N = 3 * n;
    const L = Math.sqrt(N / rho);                 // 2D 넓이 = N/ρ
    const w = S.waterSoup({ n, L, T0: T, seed: opts.seed || 1001 });
    equilibrate(w, T, opts.eqTicks || 4000);
    const s = sample(w, T, opts.sampleTicks || 3000, opts.stride || 150);
    return {
      T, rho, N, L: +L.toFixed(3),
      P: mean(s.Ps), Perr: stderr(s.Ps),
      U: mean(s.Us), Uerr: stderr(s.Us),
      Tmeas: mean(s.Ts),
      nSamp: s.Ps.length,
    };
  }

  // ── EOS 그리드 측정: 각 (T,ρ) 를 R 회 반복(다른 seed) → 반복 평균 + 반복 간 표준오차 ──
  function measureEOS(opts) {
    opts = opts || {};
    const Tgrid = opts.Tgrid || [0.30, 0.50, 0.70];
    const rhoGrid = opts.rhoGrid || [0.12, 0.20, 0.30];
    const R = opts.R || 3;
    const nT = Tgrid.length, nR = rhoGrid.length;
    const P = [], U = [], Perr = [], Uerr = [], Tmeas = [];
    for (let ti = 0; ti < nT; ti++) {
      P.push([]); U.push([]); Perr.push([]); Uerr.push([]); Tmeas.push([]);
      for (let ri = 0; ri < nR; ri++) {
        const Pr = [], Ur = [], Tr = [];
        for (let rep = 0; rep < R; rep++) {
          const pt = eosPoint(Tgrid[ti], rhoGrid[ri], Object.assign({}, opts, { seed: 1001 + rep * 37 + ti * 7 + ri * 3 }));
          Pr.push(pt.P); Ur.push(pt.U); Tr.push(pt.Tmeas);
        }
        P[ti].push(+mean(Pr).toFixed(5)); U[ti].push(+mean(Ur).toFixed(5));
        Perr[ti].push(+stderr(Pr).toFixed(5)); Uerr[ti].push(+stderr(Ur).toFixed(5));
        Tmeas[ti].push(+mean(Tr).toFixed(4));
        if (opts.log) opts.log(`EOS T=${Tgrid[ti]} ρ=${rhoGrid[ri]}: P=${mean(Pr).toFixed(4)} U=${mean(Ur).toFixed(3)} (R=${R})`);
      }
    }
    return { form: 'table', grid: { T: Tgrid.slice(), rho: rhoGrid.slice() }, P, U, Perr, Uerr, Tmeas, n: opts.n || 16, N: 3 * (opts.n || 16), R };
  }

  // ── ㉒-b 수송: 확산 계수 D(T,ρ) = MSD 기울기 (아인슈타인 관계) ──
  //   평형 후 disp 를 리셋하고, MSD(t)=⟨|Δr|²⟩ 의 시간 기울기를 최소제곱 적합 → D = slope/(2·dim).
  //   반응성 소프라 clus 진동(유계)은 절편에 흡수·성장분(확산)만 기울기. 무대의 MSD 도구 재사용.
  function diffusionPoint(T, rho, opts) {
    opts = opts || {};
    const n = opts.n || 16, N = 3 * n, L = Math.sqrt(N / rho);
    const w = S.waterSoup({ n, L, T0: T, seed: opts.seed || 2002 });
    equilibrate(w, T, opts.eqTicks || 4000);
    for (const a of w.atoms) { a.disp.x = 0; a.disp.y = 0; a.disp.z = 0; }   // 확산 창 시작 = disp 0
    const dim = w.frozenZ ? 2 : 3, dt = w.dt;
    const ts = [], msds = [], win = opts.winTicks || 4000, every = opts.every || 200;
    for (let k = 1; k <= win; k++) {
      E.step(w);
      if (k % (opts.thermoEvery || 20) === 0) thermostat(w, T);
      if (k % every === 0) { ts.push(k * dt); msds.push(M.msd(w)); }
    }
    // 최소제곱 기울기 (원점 강제 안 함 — 절편이 진동/초기 흡수). slope = Σ(t−t̄)(m−m̄)/Σ(t−t̄)².
    const nT = ts.length, tb = mean(ts), mb = mean(msds);
    let num = 0, den = 0; for (let i = 0; i < nT; i++) { num += (ts[i] - tb) * (msds[i] - mb); den += (ts[i] - tb) * (ts[i] - tb); }
    const slope = den > 0 ? num / den : 0;
    return { T, rho, D: Math.max(0, slope / (2 * dim)), slope, ts, msds };
  }

  function measureDiffusion(opts) {
    opts = opts || {};
    const Tgrid = opts.Tgrid || [0.30, 0.50, 0.70], rhoGrid = opts.rhoGrid || [0.12, 0.20, 0.30], R = opts.R || 3;
    const D = [], Derr = [];
    for (let ti = 0; ti < Tgrid.length; ti++) {
      D.push([]); Derr.push([]);
      for (let ri = 0; ri < rhoGrid.length; ri++) {
        const Dr = [];
        for (let rep = 0; rep < R; rep++) Dr.push(diffusionPoint(Tgrid[ti], rhoGrid[ri], Object.assign({}, opts, { seed: 2002 + rep * 41 + ti * 5 + ri * 3 })).D);
        D[ti].push(+mean(Dr).toFixed(5)); Derr[ti].push(+stderr(Dr).toFixed(5));
        if (opts.log) opts.log(`D T=${Tgrid[ti]} ρ=${rhoGrid[ri]}: ${mean(Dr).toFixed(4)} (R=${R})`);
      }
    }
    return { grid: { T: Tgrid.slice(), rho: rhoGrid.slice() }, D, Derr, R, n: opts.n || 16 };
  }

  // ── ㉒-c 반응망: 결합 해리 속도상수 k_diss(T) → 아레니우스 {A, Ea} ──
  //   결합 집합을 스냅샷 비교(atom-id 쌍 키)해 사라진 결합=해리 사건을 센다. 엔진 훅 없이 측정.
  //   k_diss = 사건수 / (직전 결합수 · Δt) — 국소 세부균형의 역방향(형성은 별도). ⑥ 해리(가열)의 정량판.
  function bondKeys(world) { const s = new Set(); for (const b of world.bonds || []) { const i = Math.min(b.i, b.j), j = Math.max(b.i, b.j); s.add(i + '-' + j); } return s; }

  function reactionRatePoint(T, rho, opts) {
    opts = opts || {};
    const n = opts.n || 16, N = 3 * n, L = Math.sqrt(N / rho);
    const w = S.waterSoup({ n, L, T0: T, seed: opts.seed || 3003 });
    equilibrate(w, T, opts.eqTicks || 3000);
    const stride = opts.stride || 40, win = opts.winTicks || 6000, dt = w.dt;
    let prev = bondKeys(w), diss = 0, bondTimeInt = 0;   // Σ(결합수·Δt) = 노출량
    for (let k = 1; k <= win; k++) {
      E.step(w);
      if (k % (opts.thermoEvery || 20) === 0) thermostat(w, T);
      if (k % stride === 0) {
        const cur = bondKeys(w); let gone = 0; for (const key of prev) if (!cur.has(key)) gone++;
        diss += gone; bondTimeInt += prev.size * stride * dt; prev = cur;
      }
    }
    const k_diss = bondTimeInt > 0 ? diss / bondTimeInt : 0;
    return { T, rho, k: k_diss, events: diss, exposure: +bondTimeInt.toFixed(2) };
  }

  // 아레니우스 적합: ln k = ln A − Ea/T. (1/T, ln k) 최소제곱 → slope=−Ea·intercept=ln A.
  //   해리는 열활성이라 k 가 T 와 함께↑ → ln k vs 1/T 음의 기울기 → Ea>0.
  function measureReactionNetwork(opts) {
    opts = opts || {};
    const Tgrid = opts.Tgrid || [0.55, 0.70, 0.85, 1.00], rho = opts.rho != null ? opts.rho : 0.20, R = opts.R || 3;
    const ks = [], kerr = [];
    for (let ti = 0; ti < Tgrid.length; ti++) {
      const kr = [];
      for (let rep = 0; rep < R; rep++) kr.push(reactionRatePoint(Tgrid[ti], rho, Object.assign({}, opts, { seed: 3003 + rep * 53 + ti * 7 })).k);
      ks.push(+mean(kr).toFixed(5)); kerr.push(+stderr(kr).toFixed(5));
      if (opts.log) opts.log(`k_diss T=${Tgrid[ti]} ρ=${rho}: ${mean(kr).toFixed(4)} (R=${R})`);
    }
    // 아레니우스 적합 (양의 k 만)
    const xs = [], ys = [];
    for (let i = 0; i < Tgrid.length; i++) if (ks[i] > 1e-9) { xs.push(1 / Tgrid[i]); ys.push(Math.log(ks[i])); }
    let Ea = null, lnA = null, r2 = null;
    if (xs.length >= 2) {
      const xb = mean(xs), yb = mean(ys); let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - xb) * (ys[i] - yb); den += (xs[i] - xb) * (xs[i] - xb); }
      const slope = den > 0 ? num / den : 0; Ea = -slope; lnA = yb - slope * xb;
      let ssRes = 0, ssTot = 0; for (let i = 0; i < xs.length; i++) { const pred = lnA + slope * xs[i]; ssRes += (ys[i] - pred) * (ys[i] - pred); ssTot += (ys[i] - yb) * (ys[i] - yb); }
      r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
    }
    return { channel: 'R-DISS(결합 해리)', grid: { T: Tgrid.slice(), rho }, k: ks, kerr, arrhenius: { A: lnA != null ? +Math.exp(lnA).toFixed(5) : null, Ea: Ea != null ? +Ea.toFixed(4) : null, r2: r2 != null ? +r2.toFixed(4) : null }, R };
  }

  // ── 자기일관: 등적 열용량 C_v(ρ) = ∂U/∂T (T 격자 유한차분). 양수·유한이어야 (열역학 안정) ──
  //   ⑦ 은 분자당 C_v 계단(1→3/2→5/2)을 냈다 — 여기 반응 혼합물 C_v 는 그 위에 반응 기여가 얹혀
  //   더 크다(가열이 결합을 끊어 U↑ 추가) — 부호·유한만 assert, 값은 기록 (반응 열용량).
  function cvColumns(eos) {
    const { T } = eos.grid, nR = eos.grid.rho.length, cols = [];
    for (let ri = 0; ri < nR; ri++) {
      const cv = [];
      for (let ti = 1; ti < T.length; ti++) {
        const dU = eos.U[ti][ri] - eos.U[ti - 1][ri], dT = T[ti] - T[ti - 1];
        cv.push(+(dU / dT).toFixed(4));
      }
      cols.push({ rho: eos.grid.rho[ri], cv });
    }
    return cols;
  }

  // ── output.json 가법 확장 (CONTRACT §7: 스키마 태그 유지·미존재 시 no-op·기존 소비자 불변) ──
  //   base = 기존 v0 출력(promote.buildOutput 또는 현 output.json). version 0.1 → 0.2.
  function buildMaterialModel(base, eos, opts) {
    opts = opts || {};
    const out = JSON.parse(JSON.stringify(base));
    out.version = '0.2';
    const Ts = eos.grid.T, rhos = eos.grid.rho;
    // 상태 변수 축 (S1 이 굴릴 축)
    out.stateVariables = [
      { name: 'T', range: [Ts[0], Ts[Ts.length - 1]] },
      { name: 'rho', range: [rhos[0], rhos[rhos.length - 1]] },
      { name: 'composition', range: null },
    ];
    // 측정된 상태방정식 (author 0)
    out.equationOfState = {
      form: 'table',
      grid: { T: Ts, rho: rhos },
      P: eos.P, U: eos.U,
      note: 'NVT 그리드 굴림 측정 (반응성 중성 수프 N=' + eos.N + '·R=' + eos.R + '). P=비리얼(비결합쌍)·U=물질 에너지. 분산 응집 virial 접힘은 ㉒-b.',
    };
    // 수송계수 (㉒-b·측정) — 확산 D(T,ρ). 존재 시만 가법 (CONTRACT §7 no-op).
    if (opts.diffusion) {
      out.transportCoefficients = {
        diffusion: { form: 'table', grid: opts.diffusion.grid, D: opts.diffusion.D, note: 'MSD 기울기 (아인슈타인 D=slope/2dim·반응성 소프·R=' + opts.diffusion.R + ')' },
      };
    }
    // 반응망 (㉒-c·측정) — 결합 해리 k(T)→아레니우스. 존재 시만 가법.
    if (opts.reaction) {
      const rn = opts.reaction;
      out.reactionNetwork = [{
        reactants: ['bond'], products: ['fragments'], channel: rn.channel,
        rateLaw: { hazard: 'arrhenius', A: rn.arrhenius.A, Ea: rn.arrhenius.Ea, form: 'k(T)=A·exp(−Ea/T)' },
        kTable: { grid: rn.grid, k: rn.k, r2: rn.arrhenius.r2 },
        note: '해리 사건 카운트 측정(author 0). Ea 는 매질 유효 장벽 — 카탈로그 결합 우물 D 와의 차가 매질 효과.',
      }];
    }
    // 자기일관 지표
    const cv = cvColumns(eos);
    // 오차 한계 (S1 오차 전파용)
    out.errorBounds = {
      P: { grid: eos.Perr, protocol: 'R런 반복 간 표준오차' },
      U: { grid: eos.Uerr, protocol: 'R런 반복 간 표준오차' },
      cv: { columns: cv, note: 'C_v=∂U/∂T 유한차분 (양수=열역학 안정)' },
    };
    if (opts.diffusion) out.errorBounds.D = { grid: opts.diffusion.Derr, protocol: 'R런 반복 간 표준오차 (MSD 기울기)' };
    // 관측량 계약에 EOS 추가 (선언 목록)
    out.observables = (base.observables || []).slice();
    if (!out.observables.some((o) => o.name === 'EOS')) {
      out.observables.push({ name: 'EOS', epsilon: 0.3, protocol: 'P(T,ρ)·U(T,ρ) 표 — NVT 굴림 측정·R런 표준오차 이내' });
    }
    if (opts.diffusion && !out.observables.some((o) => o.name === 'D(수송)')) {
      out.observables.push({ name: 'D(수송)', epsilon: 0.4, protocol: 'D(T,ρ)=MSD 기울기/2dim — 아인슈타인 관계·R런 표준오차 이내' });
    }
    if (opts.reaction && !out.observables.some((o) => o.name === 'k(반응)')) {
      out.observables.push({ name: 'k(반응)', epsilon: 0.4, protocol: 'k_diss(T)=해리 사건/노출량 — 아레니우스 ln k vs 1/T 적합(R²·Ea>0)' });
    }
    // validRange: 상단은 원본 유지 (CONTRACT §7 가법·S1 이 이미 소비 — 좁히지 않는다).
    //   EOS 의 유효 범위는 그리드 자체가 문서화 → equationOfState.validRange 로 별도 기록.
    out.validRange = base.validRange;
    out.equationOfState.validRange = { T: [Ts[0], Ts[Ts.length - 1]], rho: [rhos[0], rhos[rhos.length - 1]] };
    out.provenance = Object.assign({}, base.provenance, {
      scenes: (base.provenance && base.provenance.scenes || []).concat(['s10-water-soup(eos-grid)']),
      note: 'S0 출력 v0.2 — ⑪ MVP 배관 위에 ㉒-a 측정 EOS 표 가법. S1 상태축[T,ρ] 기반.',
    });
    return out;
  }

  // 스키마 검증 (v0 하위호환 유지 + EOS 블록 유효성)
  function validateMaterial(out) {
    const errs = [];
    const req = (c, m) => { if (!c) errs.push(m); };
    const eos = out.equationOfState;
    req(eos && eos.form === 'table' && eos.grid, 'equationOfState.grid');
    if (eos && eos.grid) {
      const nT = eos.grid.T.length, nR = eos.grid.rho.length;
      req(Array.isArray(eos.P) && eos.P.length === nT && eos.P.every((row) => row.length === nR), 'P 표 차원 = T×ρ');
      req(Array.isArray(eos.U) && eos.U.length === nT && eos.U.every((row) => row.length === nR), 'U 표 차원 = T×ρ');
      let finite = true; for (const row of (eos.P || []).concat(eos.U || [])) for (const v of row) if (!isFinite(v)) finite = false;
      req(finite, 'EOS 표 전 항 유한');
    }
    // 수송계수 (존재 시만·가법 no-op): D 표 차원 = T×ρ · 유한 · 양수.
    const tc = out.transportCoefficients;
    if (tc && tc.diffusion) {
      const g = tc.diffusion.grid, nT = g.T.length, nR = g.rho.length, D = tc.diffusion.D;
      req(Array.isArray(D) && D.length === nT && D.every((row) => row.length === nR), 'D 표 차원 = T×ρ');
      let dok = true; for (const row of D) for (const v of row) if (!isFinite(v) || v < 0) dok = false;
      req(dok, 'D 표 전 항 유한·비음');
      req(out.errorBounds && out.errorBounds.D, 'errorBounds D (수송 발효 조건)');
    }
    // 반응망 (존재 시만·가법): 아레니우스 Ea>0 (열활성)·A>0·k 표 유한.
    if (out.reactionNetwork && out.reactionNetwork.length) {
      const rn = out.reactionNetwork[0];
      req(rn.rateLaw && rn.rateLaw.hazard === 'arrhenius' && rn.rateLaw.Ea > 0 && rn.rateLaw.A > 0, '반응망 아레니우스 Ea>0·A>0 (해리=열활성)');
      req(rn.kTable && Array.isArray(rn.kTable.k) && rn.kTable.k.every((v) => isFinite(v) && v >= 0), 'k 표 유한·비음');
    }
    req(out.errorBounds && out.errorBounds.P && out.errorBounds.U, 'errorBounds P·U (발효 조건 CONTRACT §3)');
    req(out.stateVariables && out.stateVariables.length >= 2, 'stateVariables [T,ρ]');
    req(out.observables && out.observables.some((o) => o.name === 'EOS'), 'observables EOS 선언');
    return { ok: errs.length === 0, errs };
  }

  // node 헤드리스 눈 확인용 ASCII 히트맵 (field='P'|'U'). 뷰어(index.html)의 대체 스냅샷.
  function asciiHeatmap(eos, field) {
    const G = eos[field], Ts = eos.grid.T, rhos = eos.grid.rho;
    let lo = Infinity, hi = -Infinity;
    for (const row of G) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const ramp = ' .:-=+*#%@';
    const lines = [`  ${field}(T,ρ)  [${lo.toFixed(3)} … ${hi.toFixed(3)}]`];
    lines.push('  ρ→ ' + rhos.map((r) => r.toFixed(2).padStart(6)).join(''));
    for (let ti = Ts.length - 1; ti >= 0; ti--) {
      const cells = G[ti].map((v) => { const f = hi > lo ? (v - lo) / (hi - lo) : 0; const ch = ramp[Math.min(ramp.length - 1, Math.floor(f * ramp.length))]; return (ch + ' ' + v.toFixed(2)).padStart(6); }).join('');
      lines.push('T' + Ts[ti].toFixed(2) + ' ' + cells);
    }
    return lines.join('\n');
  }

  const api = { matterEnergy, thermostat, equilibrate, sample, eosPoint, measureEOS, diffusionPoint, measureDiffusion, reactionRatePoint, measureReactionNetwork, cvColumns, buildMaterialModel, validateMaterial, asciiHeatmap, mean, stderr };
  if (isNode) module.exports = api;
  else window.HktS0Material = api;
})();
