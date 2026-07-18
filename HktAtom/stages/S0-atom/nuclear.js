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
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

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

  // ══════════════════════════════════════════════════════════════════════════
  // ㉕ 분열 — 앵커: k_eff=1 경계 (CONTRACT §5 스트레스 테스트의 파라미터 공급원)
  //   중성자 입자(전자 형식 재사용·q=0·핵과만 단면)·단면 에너지 밴드·행 R-N-SCAT/CAP/FISSION.
  //   자체 완결 중성자 수송 몬테카를로 (엔진 미접촉·평균자유행로 샘플링). 매질=균질 밀도.
  // ══════════════════════════════════════════════════════════════════════════

  // 분열 핵종 F (무거운 가상 핵종). σ 는 에너지 밴드 계단표 (fast/thermal·포획 1/v).
  const FISSILE = {
    Z: 94, N: 145, m: 239 - 1.9,        // 질량 결손 큼 (BE 큰 → 분열 방출의 근원)
    Qfis: 4.0,                           // 분열당 방출 (무차원·질량 결손 유래·밸런스 노브)
    nu: 2.5,                             // 분열당 평균 중성자 (정수 샘플)
    // 단면 (무차원 유효값): thermal 에서 분열 강함 (열중성자로)
    sigFisThermal: 6.0, sigFisFast: 0.4,
    sigCapThermal: 1.0, sigCapFast: 0.2,
    sigScat: 0.8,
  };
  // 감속재 M (가벼운 핵 — 산란으로 열중성자화). 질량 작을수록 에너지 전달 큼(author 0 운동학).
  const MODERATOR = { A: 2.0, sigScat: 3.0, sigCap: 0.02 };   // A=질량수(중수소 유사)
  const E_THERMAL = 0.3;                 // 열/속 경계 (무차원)·E_FISSION 생성 에너지
  const E_FISSION_BORN = 2.0;            // 분열 중성자 생성 에너지 (fast)

  const isThermal = (E) => E < E_THERMAL;
  function sigFis(E) { return isThermal(E) ? FISSILE.sigFisThermal : FISSILE.sigFisFast; }
  function sigCapF(E) { return (isThermal(E) ? FISSILE.sigCapThermal : FISSILE.sigCapFast) * Math.sqrt(E_THERMAL / Math.max(1e-6, E)); } // 1/v 강화 근사
  const mnN = 1.0;                        // 중성자 질량 (무차원)
  const vOf = (E) => Math.sqrt(2 * Math.max(1e-9, E) / mnN);

  // 중성자 입자 (전자 형식 재사용 — 새 자료형 0): {r,p,E,gen,dir}
  function makeNeutron(r, E, dir, gen) { return { r: { x: r.x, y: r.y, z: r.z }, E, gen: gen || 0, dir }; }

  // 원자로 시뮬: 균질 매질(밀도 nF·nM)·상자 L(누설 경계)·초기 소스 중성자. 중성자 수송 몬테카를로.
  //   반환: 시계열 중성자 수·세대 카운트·분열 수·방출 E(Δm·c²)·에너지 스펙트럼·지연 중성자.
  function reactorSim(opts) {
    opts = opts || {};
    const rng = opts.rng || E.makeRng(opts.seed || 9009);
    const L = opts.L || 12, nF = opts.nF != null ? opts.nF : 0.08, nM = opts.nM != null ? opts.nM : 0.25;
    const dt = opts.dt || 0.05, steps = opts.steps || 400, rec = opts.rec || 5;
    const delayed = opts.delayed !== false;      // 지연 중성자 (파편 붕괴) on/off
    const three = opts.three !== false;
    const randDir = () => { const a = 2 * Math.PI * rng(); if (!three) return { x: Math.cos(a), y: Math.sin(a), z: 0 }; const z = 2 * rng() - 1, s = Math.sqrt(Math.max(0, 1 - z * z)); return { x: s * Math.cos(a), y: s * Math.sin(a), z }; };
    // 초기 소스 (fast·gen 0·중앙 근처)
    let neutrons = [];
    for (let i = 0; i < (opts.N0 || 200); i++) neutrons.push(makeNeutron({ x: L / 2 + (rng() - 0.5) * L * 0.3, y: L / 2 + (rng() - 0.5) * L * 0.3, z: three ? L / 2 + (rng() - 0.5) * L * 0.3 : 0 }, E_FISSION_BORN, randDir(), 0));
    const ts = [], count = [], spec = [], genProd = {}, genLost = {};   // genProd[g]=g 낳은 g+1·genLost[g]=g 소멸(흡수+누설)
    const lost = (g) => { genLost[g] = (genLost[g] || 0) + 1; };
    let fissions = 0, Erel = 0, captures = 0, leaks = 0, delayedQueue = [];   // 지연 중성자 대기 (파편)
    let dm = 0;                                            // 질량 결손 누적 (Δm — 방출 E 와 정합)
    for (let s = 0; s <= steps; s++) {
      // 지연 중성자 방출 (파편 붕괴 — 간이 지수)
      if (delayed && delayedQueue.length) {
        const keep = [];
        for (const dnu of delayedQueue) { if (rng() < 1 - Math.exp(-0.02 * dt * 50)) neutrons.push(makeNeutron(dnu.r, E_FISSION_BORN * 0.5, randDir(), dnu.gen)); else keep.push(dnu); }
        delayedQueue = keep;
      }
      const next = [];
      for (const nu of neutrons) {
        const v = vOf(nu.E);
        // 이동
        nu.r.x += nu.dir.x * v * dt; nu.r.y += nu.dir.y * v * dt; if (three) nu.r.z += nu.dir.z * v * dt;
        // 누설 (열린 경계) — 세대별 소멸 회계 (k_eff 에 누설 포함)
        if (nu.r.x < 0 || nu.r.x > L || nu.r.y < 0 || nu.r.y > L || (three && (nu.r.z < 0 || nu.r.z > L))) { leaks++; lost(nu.gen); continue; }
        // 충돌 확률: Σ_total·v·dt (거시 단면)
        const SigF = nF * (sigFis(nu.E) + sigCapF(nu.E) + FISSILE.sigScat);
        const SigM = nM * (MODERATOR.sigScat + MODERATOR.sigCap);
        const Sig = SigF + SigM, pColl = 1 - Math.exp(-Sig * v * dt);
        if (rng() >= pColl) { next.push(nu); continue; }
        // 충돌 채널 선택 (단면 비례)
        const rC = rng() * Sig; let acc = 0;
        acc += nF * sigFis(nu.E);
        if (rC < acc) {                                   // R-FISSION
          fissions++; Erel += FISSILE.Qfis; dm += FISSILE.Qfis / C2;
          const nnu = Math.floor(FISSILE.nu) + (rng() < (FISSILE.nu % 1) ? 1 : 0);   // 정수 샘플 (평균 ν)
          genProd[nu.gen] = (genProd[nu.gen] || 0) + nnu; lost(nu.gen);   // 흡수(분열)
          const promptFrac = delayed ? 0.97 : 1.0;
          for (let k = 0; k < nnu; k++) {
            if (rng() < promptFrac) next.push(makeNeutron(nu.r, E_FISSION_BORN, randDir(), nu.gen + 1));
            else delayedQueue.push({ r: { x: nu.r.x, y: nu.r.y, z: nu.r.z }, gen: nu.gen + 1 });   // 지연 (파편)
          }
          continue;                                       // 중성자 흡수됨
        }
        acc += nF * sigCapF(nu.E) + nM * MODERATOR.sigCap;
        if (rC < acc) { captures++; lost(nu.gen); continue; }   // R-N-CAP (γ) — 흡수 소멸
        // R-N-SCAT (탄성 산란 — 감속): 에너지 전달 = 운동학 (가벼운 표적일수록 큼·author 0)
        const onMod = rng() < (nM * MODERATOR.sigScat) / (nM * MODERATOR.sigScat + nF * FISSILE.sigScat);
        const A = onMod ? MODERATOR.A : (FISSILE.Z + FISSILE.N);
        const alpha = ((A - 1) / (A + 1)) ** 2;
        nu.E = nu.E * (alpha + (1 - alpha) * rng());       // 등방 CM 산란 후 E' ∈ [αE, E]
        nu.dir = randDir(); next.push(nu);
      }
      neutrons = next;
      if (s % rec === 0) { ts.push(+(s * dt).toFixed(2)); count.push(neutrons.length); let th = 0; for (const nu of neutrons) if (isThermal(nu.E)) th++; spec.push(neutrons.length ? +(th / neutrons.length).toFixed(3) : 0); }
      if (neutrons.length === 0 && delayedQueue.length === 0) break;
      if (neutrons.length > (opts.cap || 60000)) { /* 초임계 폭주 방지 캡 */ break; }
    }
    // k_eff (세대비): Σ genProd / Σ genLost (소멸=흡수+누설 — 누설 포함이라 밀도·크기 의존).
    //   초기 과도(gen0) 제외 — 전 세대 평균. k>1 초임계·<1 미임계.
    let prod = 0, lst = 0; for (const g in genLost) { if (+g >= (opts.gen0 || 1)) { prod += genProd[g] || 0; lst += genLost[g] || 0; } }
    const kGen = lst > 0 ? prod / lst : 0;
    // k_eff (시간 지수): count 지수 피팅 α → k≈exp(α·τ), 여기선 상대 성장률만 (부호=임계 영역)
    const fit = fitDecayConst(ts, count);   // count=N0·e^{−λt} → λ<0 이면 성장(초임계)
    const timeExp = -fit.lambda;            // >0 성장·<0 소멸
    return { ts, count, spec, fissions, captures, leaks, Erel, dm, kGen: +kGen.toFixed(3), timeExp: +timeExp.toFixed(4), finalN: neutrons.length, delayedRemain: delayedQueue.length };
  }

  // 임계 영역 판정: kGen 과 시간지수 부호 교차. <1 소멸 / ≈1 정상 / >1 성장.
  function criticalRegion(sim) {
    if (sim.kGen > 1.05 || sim.timeExp > 0.02) return 'supercritical';
    if (sim.kGen < 0.95 || sim.timeExp < -0.02) return 'subcritical';
    return 'critical';
  }

  // NuclideTable 산출 ⇧ (중간 해상도=중성자 수송의 파라미터·CONTRACT §5-3·측정으로 발효)
  function buildNuclideTable(opts) {
    opts = opts || {};
    // 밀도 스캔으로 임계 밀도 측정 (author 0 — 곡선에서 나옴). 크로스오버(k=1)를 담도록 저밀도 포함.
    const scan = [];
    for (const nF of (opts.scanNF || [0.008, 0.02, 0.04, 0.08, 0.15])) {
      const sims = [];
      for (let r = 0; r < (opts.R || 3); r++) sims.push(reactorSim({ nF, L: opts.L || 10, nM: opts.nM, steps: 250, N0: 400, seed: 9009 + r * 17 + Math.round(nF * 1000) }));
      const k = mean(sims.map((s) => s.kGen)), te = mean(sims.map((s) => s.timeExp));
      scan.push({ nF, kGen: +k.toFixed(3), timeExp: +te.toFixed(4), region: criticalRegion({ kGen: k, timeExp: te }) });
    }
    return {
      schema: 'nuclide-table-v0', fissile: { Z: FISSILE.Z, N: FISSILE.N },
      crossSections: { sigFisThermal: FISSILE.sigFisThermal, sigFisFast: FISSILE.sigFisFast, sigCapThermal: FISSILE.sigCapThermal, sigScat: FISSILE.sigScat, bands: ['fast', 'thermal'], note: '에너지 밴드 계단표·포획 1/v 근사' },
      nu: FISSILE.nu, Q: FISSILE.Qfis, delayedFraction: 0.03,
      moderator: MODERATOR, E_thermal: E_THERMAL,
      criticalScan: scan,
      note: '측정으로 발효 (author 0·밀도 스캔서 임계 곡선). 서버 중간 해상도(중성자 수송)의 파라미터 — CONTRACT §5.',
    };
  }

  const api = { NUCLIDES, DECAY, FISSILE, MODERATOR, MP, MN, C2, E_THERMAL, bindingEnergy, nuclideMass, tagNuclide, bundle, bondVibFreq, isotopeShift, halfToLambda, decaySim, fitDecayConst, makeNeutron, reactorSim, criticalRegion, buildNuclideTable };
  if (isNode) module.exports = api;
  else window.HktS0Nuclear = api;
})();
