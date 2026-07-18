// nuclear.js — ㉓~㉕ 핵 (확장팩·게이트 G-핵 개방 시). self-contained: 엔진(①–⑳) diff 0.
//
// 게이트 개방: 게임플레이가 핵분열을 요구 (CONTRACT §6-② · DESIGN §9.3). 가상 핵종을 쓴다
//   (실수치 정합 불요 — 임계 조건은 밸런스 자유도·CONTRACT §5). 핵 내부 구조는 여전히 동결 —
//   핵종은 상태표(질량·수명·붕괴 채널·단면)로 다룬다 (바닥 특권 데이터).
//
// ㉓ 핵종·동위원소: c=(Z,e) → (Z,N,e) 확장 (KERNEL §5 핵 동결의 1안 — c 에 N 추가).
//   질량 Σ 회계 m = Z·m_p + N·m_n − BE (c²=1 무차원 노브) — **질량 결손이 장부의 실물**.
//   앵커: 동위원소 진동수 비 ω_D/ω_H ≈ √(μ_H/μ_D) — 결합 스프링 ω=√(k/μ) 가 질량에서
//   유도되므로 자동 (author 0). N 은 화학을 안 건드린다 (질량만·핵 에너지 회계만).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // ── 핵종 상태표 (가상·바닥 특권 데이터) ──
  //   질량 Σ 회계: m = Z·MP + N·MN − BE. MP≈MN≈1 (무차원)·BE 는 결합 에너지(양수=안정화).
  //   화학 질량 정합: H1 m=1·O16 m=4 (REAL 테이블과 일치 — 화학 회귀 불변). BE 로 맞춘다.
  const MP = 1.0, MN = 1.0;         // 양성자·중성자 질량 (무차원 노브)
  const C2 = 1.0;                    // 질량-에너지 환산 (무차원 — 질량결손 규모 노브)
  // BE(결합 에너지) 는 m = Z·MP + N·MN − BE·C2 를 목표 질량에 맞춰 역산한 값 (핵종 데이터).
  const NUCLIDES = {
    //        Z  N   m(목표)  halfLife   decays(채널·분기)          fissile
    H1:  { Z: 1, N: 0, m: 1.0 },                                              // 경수소
    D2:  { Z: 1, N: 1, m: 2.0 },                                              // 중수소 (안정·무거운 H)
    O16: { Z: 8, N: 8, m: 4.0 },                                             // 산소 (화학 O 와 동일 질량)
    // 아래는 ㉔㉕ 에서 쓰는 가상 핵종 (붕괴·분열) — ㉓ 에선 데이터만 예약
    N1:  { Z: 0, N: 1, m: 1.0 },                                             // 자유 중성자 c=(0,1,0)
  };
  // BE 역산: BE·C2 = Z·MP + N·MN − m
  function bindingEnergy(nuc) { return (nuc.Z * MP + nuc.N * MN - nuc.m) / C2; }
  // 질량 = Σ 회계 (핵종 데이터로부터). 화학은 world.mass 테이블을 계속 쓰되, 핵 사건의 에너지는
  //   이 질량 결손 회계에서 나온다 (Δm·c² — ㉕ 분열 방출의 근원).
  function nuclideMass(nuc) { return nuc.Z * MP + nuc.N * MN - bindingEnergy(nuc) * C2; }

  // ── 개체에 핵 정체(Z,N) 부여 — 화학 미접촉 (질량·핵 회계만) ──
  //   atom 에 .N(중성자 수)·.nuc(핵종 라벨) 을 얹는다. 엔진 화학은 a.sp·world.mass 만 보므로
  //   N 추가가 화학을 안 건드린다 (㉓ 검증: 전 장면 회귀).
  function tagNuclide(atom, label) {
    const nuc = NUCLIDES[label]; if (!nuc) throw new Error('unknown nuclide ' + label);
    atom.nucZ = nuc.Z; atom.N = nuc.N; atom.nuc = label;
    return atom;
  }

  // ── 보존 다발 Σc = (Z, N, e) 3성분 회계 (활성 원자 + 자유 중성자 + 전자) ──
  function bundle(world) {
    let Z = 0, N = 0, e = 0;
    for (const a of world.atoms) { Z += (a.nucZ != null ? a.nucZ : (a.Z || 0)); N += (a.N || 0); e += (a.ne || 0); }
    for (const n of world.neutrons || []) N += 1;               // 자유 중성자 c=(0,1,0)
    e += (world.electrons || []).length;
    return { Z, N, e };
  }

  // ── ㉓ 앵커: 동위원소 진동수 이동 (author 0) ──
  //   O–H vs O–D 결합의 신축 진동 주파수를 측정. 스프링 k 동일·환산질량 μ 만 다르므로
  //   ω=√(k/μ) → ω_D/ω_H = √(μ_OH/μ_OD). N(중성자)이 D 의 질량을 2 로 만든 결과 (author 0).
  function bondVibFreq(mH, mX, k, opts) {
    opts = opts || {};
    // 2체 결합 진동을 직접 적분 (엔진 bond 스프링과 동형 F=−k(d−rest)). 축소 1D.
    const mu = mH * mX / (mH + mX), rest = opts.rest || 1.1, dt = opts.dt || 0.002;
    let d = rest + (opts.amp || 0.15), v = 0;                  // 신축 변위 초기
    // 반주기 카운트: (d−rest) 부호 변화 (제로 크로싱) 사이 시간 → 주기 T → ω=2π/T
    const cross = []; let prev = d - rest;
    for (let step = 0; step < (opts.steps || 20000); step++) {
      const F = -k * (d - rest); const a = F / mu;             // 축소질량 1D 진자
      v += a * dt; d += v * dt;
      const s = d - rest;
      if (prev < 0 && s >= 0) cross.push(step * dt);           // 상승 제로크로싱 = 주기 경계
      prev = s;
    }
    if (cross.length < 3) return { omega: 0, period: 0, mu };
    let Tsum = 0; for (let i = 1; i < cross.length; i++) Tsum += cross[i] - cross[i - 1];
    const period = Tsum / (cross.length - 1), omega = 2 * Math.PI / period;
    return { omega, period, mu };
  }

  // 동위원소 이동 측정: H(m1)·D(m2) 가 O(m4)와 결합할 때 진동수 비 vs √(μ 비) 예측.
  function isotopeShift(opts) {
    opts = opts || {};
    const mO = opts.mO || NUCLIDES.O16.m, mH = NUCLIDES.H1.m, mD = NUCLIDES.D2.m, k = opts.k || 25;
    const vH = bondVibFreq(mH, mO, k, opts), vD = bondVibFreq(mD, mO, k, opts);
    const ratioMeas = vD.omega / vH.omega;
    const ratioPred = Math.sqrt(vH.mu / vD.mu);                // ω∝1/√μ → ω_D/ω_H=√(μ_H/μ_D)
    return { omegaH: +vH.omega.toFixed(4), omegaD: +vD.omega.toFixed(4), muH: +vH.mu.toFixed(4), muD: +vD.mu.toFixed(4), ratioMeas: +ratioMeas.toFixed(4), ratioPred: +ratioPred.toFixed(4), relErr: +Math.abs(ratioMeas / ratioPred - 1).toFixed(4) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ㉔ 붕괴 채널 — 앵커: 지수 감쇠·계열 붕괴·붕괴열 (낙진 시간 감쇠의 근원)
  //   핵종 상태표에 {halfLife, channels:[{type, branch, Q, dZ, dN, daughter}]} 예약.
  //   Q값 회계: 질량 결손 → 방출 KE + γ + E_escape (중성미자). 사건 큐의 최장 시간 규모.
  //   자체 완결 몬테카를로 (엔진 미접촉) — 개체군 붕괴를 지수 대기시간으로 굴린다.
  // ══════════════════════════════════════════════════════════════════════════

  // 붕괴 핵종 (가상). halfLife=반감기(무차원 시간)·Q=방출 에너지(질량 결손 유래)·daughter=딸핵.
  //   type: 'beta−'(N→Z·중성미자 E_escape) 'alpha'(Z−2,N−2·He 방출) 'gamma'(들뜸 완화) 'n'(중성자 방출).
  const DECAY = {
    // 모핵 FPa → 딸 FPb (β⁻·짧은 반감기·지연 중성자 일부) → 안정 FPc
    FPa: { Z: 40, N: 58, halfLife: 3.0, channels: [{ type: 'beta-', branch: 0.97, Q: 1.2, dZ: 1, dN: -1, daughter: 'FPb' }, { type: 'n', branch: 0.03, Q: 0.5, dZ: 0, dN: -1, daughter: 'FPa_n' }] },
    FPb: { Z: 41, N: 57, halfLife: 12.0, channels: [{ type: 'beta-', branch: 1.0, Q: 0.8, dZ: 1, dN: -1, daughter: 'FPc' }] },
    FPc: { Z: 42, N: 56, halfLife: Infinity, channels: [] },     // 안정 (딸의 끝)
    FPa_n: { Z: 40, N: 57, halfLife: Infinity, channels: [] },   // 중성자 방출 후 (안정 근사)
    // α 방출체 (무거운 핵)
    Aa: { Z: 92, N: 146, halfLife: 20.0, channels: [{ type: 'alpha', branch: 1.0, Q: 4.2, dZ: -2, dN: -2, daughter: 'Ab' }] },
    Ab: { Z: 90, N: 144, halfLife: Infinity, channels: [] },
  };
  function halfToLambda(hl) { return hl === Infinity ? 0 : Math.log(2) / hl; }

  // 개체군 붕괴 몬테카를로. pops={label:count}. 사건: 각 핵 dt 당 확률 λ·dt 로 붕괴 → 채널 분기 →
  //   딸핵 +1·Q 방출 회계. 반환: 시계열 N(label,t)·붕괴열 누적·방출 중성자·중성미자(E_escape).
  function decaySim(pops0, opts) {
    opts = opts || {};
    const rng = opts.rng || E.makeRng(opts.seed || 7007);
    const dt = opts.dt || 0.05, steps = opts.steps || 2000, rec = opts.rec || 20;
    const pops = Object.assign({}, pops0);
    const ts = [], series = {}, heat = [], neut = [], nu = [];   // heat=붕괴열 누적·neut=방출 중성자·nu=중성미자 E
    let heatCum = 0, neutCum = 0, nuCum = 0;
    for (const k in pops) series[k] = [];
    const ensure = (k) => { if (series[k] === undefined) { series[k] = new Array(ts.length).fill(0); } if (pops[k] === undefined) pops[k] = 0; };
    for (let s = 0; s <= steps; s++) {
      // 붕괴 사건 (이항 근사 — 각 핵 독립 λdt)
      for (const label in DECAY) {
        const nuc = DECAY[label], n = pops[label] || 0; if (!n) continue;
        const lam = halfToLambda(nuc.halfLife); if (lam <= 0) continue;
        const p = 1 - Math.exp(-lam * dt);
        let decayed = 0; for (let i = 0; i < n; i++) if (rng() < p) decayed++;
        if (!decayed) continue;
        pops[label] -= decayed;
        // 채널 분기별 배분
        for (let d = 0; d < decayed; d++) {
          let r = rng(), acc = 0, ch = nuc.channels[0];
          for (const c of nuc.channels) { acc += c.branch; if (r <= acc) { ch = c; break; } }
          if (!ch) continue;
          ensure(ch.daughter); pops[ch.daughter] = (pops[ch.daughter] || 0) + 1;
          heatCum += ch.Q;                              // Q → 방출 KE+γ (붕괴열)
          if (ch.type === 'beta-') { nuCum += ch.Q * 0.35; }   // 중성미자 몫 → E_escape (탈출)
          if (ch.type === 'n') { neutCum += 1; }               // 지연 중성자 방출
        }
      }
      if (s % rec === 0) {
        ts.push(+(s * dt).toFixed(3));
        for (const k in series) series[k].push(pops[k] || 0);
        heat.push(+heatCum.toFixed(4)); neut.push(neutCum); nu.push(+nuCum.toFixed(4));
      }
    }
    return { ts, series, heat, neut, nu, pops };
  }

  // 지수 감쇠 상수 적합: ln N(t) vs t 최소제곱 → λ. 반감기 재현 검증(λ ≈ ln2/halfLife).
  function fitDecayConst(ts, Ns) {
    const xs = [], ys = [];
    for (let i = 0; i < ts.length; i++) if (Ns[i] > 0) { xs.push(ts[i]); ys.push(Math.log(Ns[i])); }
    if (xs.length < 2) return { lambda: 0, r2: 0 };
    const xb = xs.reduce((a, b) => a + b, 0) / xs.length, yb = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - xb) * (ys[i] - yb); den += (xs[i] - xb) * (xs[i] - xb); }
    const slope = den > 0 ? num / den : 0;
    let ssRes = 0, ssTot = 0; for (let i = 0; i < xs.length; i++) { const pred = yb + slope * (xs[i] - xb); ssRes += (ys[i] - pred) ** 2; ssTot += (ys[i] - yb) ** 2; }
    return { lambda: -slope, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1 };
  }

  const api = { NUCLIDES, DECAY, MP, MN, C2, bindingEnergy, nuclideMass, tagNuclide, bundle, bondVibFreq, isotopeShift, halfToLambda, decaySim, fitDecayConst };
  if (isNode) module.exports = api;
  else window.HktS0Nuclear = api;
})();
