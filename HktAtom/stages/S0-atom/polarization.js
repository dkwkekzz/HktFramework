// polarization.js — ⑧ 분극·응집. 중성 입자가 뭉친다.
//
// "없는 물리는 측정에서 생기지 않는다"의 실증: 중성 인력의 **근원**을 동역학에 넣고,
// 저온 응집이 창발하며 근원을 끄면 소멸함을 보인다. 근원은 종 파라미터 α(분극률·③ author)
// 하나에 묶는다 — α=0 이면 두 인력 채널이 함께 죽는다.
//
// 두 인력 채널 (둘 다 α 에 묶임 · 둘 다 보존 중심력 쌍 퍼텐셜 → P·E 정확 닫힘):
//   ① 전하–유도쌍극자: 전하가 이웃 중성을 분극(μ=αE) → 인력 V=−½α·kc²q²/(d+s)⁴
//        쌍별 근사(교차항·상호분극 생략 — 아래 "설계 정련" 참조). 무전하계에선 0.
//   ② 분산(런던 C6): 무극성 중성(E≈0)엔 ① 이 0 이므로, 정직하게 author 하는 잔여항.
//        크기는 α·IE 에서 유도 → C6=(3/2)(IEᵢIEⱼ/(IEᵢ+IEⱼ))αᵢαⱼ. V=−C6/(d⁶+a⁶).
//        계수(3/2)만 author, 세기는 α·IE — "α=0 → 응집 소멸" 검증이 C6 까지 관통.
//   기반 척력(② pairForces 의 ε(σ/d)¹²)과 합쳐 LJ 유사 우물 → 저온 응집.
//
// 설계 정련(step-0008): DESIGN 08 은 자기일관 상호분극(SCF n_scf) 을 명세했으나,
//   (a) 무극성 중성쌍의 정적 상호분극은 E=0 이라 어차피 0 이고,
//   (b) 유한장(이온) 근방의 1차 유도가 지배적이며,
//   (c) 고전 유도-유도 상관은 런던 분산(양자 요동)이 아니라 — 그것을 고전 SCF 로 흉내내면
//       C6 잔여항과 이중 계상이 된다.
//   그래서 힘·에너지에는 비상호(쌍별) 근사를 쓰고, 상호분극이 대신하려던 인력은 정직한
//   C6 채널이 전담한다. μ 화살표(시각화)는 전하가 만든 국소장으로 계산(진단 전용).
//
// self-contained: 핵심 엔진(①–⑦)을 건드리지 않는다 (회귀 0). engine.js 만 재사용.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // ⑧ 종 — α(분극률)·IE(이온화 E)는 ③ author (바닥 특권). Ng=중성 닫힌 껍질(Ne 유사),
  //   Cat=이온(무거워 ~중심 고정 · α=0 → 스스로 분극 안 됨·분산 기여 0, 오직 장을 만든다).
  const SP8 = {
    Ng:  { mass: 1.0,  sigma: 1.0, eps: 1.0, radius: 0.5,  color: '#7fd0c4', alpha: 1.3, IE: 1.85 },
    Cat: { mass: 120.0, sigma: 1.0, eps: 1.0, radius: 0.55, color: '#e0803a', alpha: 0.0, IE: 3.0 },
  };

  const C6of = (ieI, ieJ, aI, aJ) => 1.5 * (ieI * ieJ / ((ieI + ieJ) || 1)) * aI * aJ;

  // ── ⑧ 힘: 기반 ②(쿨롱+척력) 위에 유도쌍극자·분산 인력을 더한다 ──
  //    모두 반대칭 중심력 → P 보존. U_pol 통 = 유도 + 분산 (측정용 분해는 world._Uind/_Udisp).
  //    step-0033: 기여부(polContrib)를 분리해 엔진 법칙 스택에 등록 — 세계에 alpha 테이블이
  //    있으면 어느 무대든 저절로 적용된다. polForces(기반+기여)는 기존 장면 하위 호환 그대로.
  function polContrib(world) {
    const L = world.box.L, per = world.box.bc === 'periodic', fz = world.frozenZ;
    const kc = world.kc, s = world.soft;
    const aBuf = world.aDisp != null ? world.aDisp : 0.9, a6 = Math.pow(aBuf, 6);
    const alpha = world.alpha || {}, IEm = world.ionizeE || {};
    const A = world.atoms, n = A.length;
    for (const a of A) { if (!a.mu) a.mu = E.V.zero(); a.mu.x = a.mu.y = a.mu.z = 0; }
    const Ex = new Float64Array(n), Ey = new Float64Array(n), Ez = new Float64Array(n);
    let Uind = 0, Udisp = 0;
    for (let i = 0; i < n; i++) {
      const ai = A[i], aI = alpha[ai.sp] || 0, ieI = IEm[ai.sp] || 0, qi = ai.q;
      for (let j = i + 1; j < n; j++) {
        const aj = A[j], aJ = alpha[aj.sp] || 0, ieJ = IEm[aj.sp] || 0, qj = aj.q;
        let dx = ai.r.x - aj.r.x, dy = ai.r.y - aj.r.y, dz = ai.r.z - aj.r.z;
        if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = fz ? 0 : E.minImage(dz, L.z); }
        const d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1e-9, ds = d + s;

        // 국소장 (μ 진단 전용): E_i += kc·qⱼ·r̂_ij/(d+s)²  (r̂_ij=(dx,dy,dz)/d)
        const ef = kc / (ds * ds * d);
        Ex[i] += ef * qj * dx; Ey[i] += ef * qj * dy; Ez[i] += ef * qj * dz;
        Ex[j] -= ef * qi * dx; Ey[j] -= ef * qi * dy; Ez[j] -= ef * qi * dz;

        // 채널① 전하–유도쌍극자 (쌍별): V=−K1/(d+s)⁴ · K1=½kc²(αᵢqⱼ²+αⱼqᵢ²)
        const K1 = 0.5 * kc * kc * (aI * qj * qj + aJ * qi * qi);
        if (K1 !== 0) {
          const ds4 = ds * ds * ds * ds;
          Uind += -K1 / ds4;
          const fOverD = -4 * K1 / (ds4 * ds * d);   // F=−dV/dd·r̂ = −4K1/(d+s)⁵·r̂ (인력)
          ai.F.x += fOverD * dx; ai.F.y += fOverD * dy; ai.F.z += fOverD * dz;
          aj.F.x -= fOverD * dx; aj.F.y -= fOverD * dy; aj.F.z -= fOverD * dz;
        }

        // 채널② 분산 C6: V=−C6/(d⁶+a⁶) — 크기는 α·IE 에서 유도 (근원은 α)
        const C6 = C6of(ieI, ieJ, aI, aJ);
        if (C6 !== 0) {
          const d6 = d2 * d2 * d2, D6 = d6 + a6;
          Udisp += -C6 / D6;
          const fOverD = -6 * C6 * (d2 * d2) / (D6 * D6);   // F=−6C6·d⁵/D6²·r̂ → /d 벡터화
          ai.F.x += fOverD * dx; ai.F.y += fOverD * dy; ai.F.z += fOverD * dz;
          aj.F.x -= fOverD * dx; aj.F.y -= fOverD * dy; aj.F.z -= fOverD * dz;
        }
      }
    }
    for (let i = 0; i < n; i++) { const aI = alpha[A[i].sp] || 0; A[i].mu.x = aI * Ex[i]; A[i].mu.y = aI * Ey[i]; A[i].mu.z = aI * Ez[i]; }
    if (fz) for (const a of A) a.F.z = 0;                  // z 동결: 누수 차단 (dz=0 이라 이미 0)
    world.ledger.U_pol += Uind + Udisp;          // 누적 (스택 계약 — ⑮ QEq 자기 에너지와 공존)
    world._Uind = Uind; world._Udisp = Udisp;
  }
  // 하위 호환 합성 (기존 ⑧ 장면들의 computeForces) — 수치 동일: pairForces + polContrib
  function polForces(world) {
    E.pairForces(world);                         // 기반 F 누산 + U_elec(척력·쿨롱) + min d/σ
    world.ledger.U_pol = 0;                      // 단독 경로: 통 초기화 후 기여 (스택과 동일 수치)
    polContrib(world);
  }
  // 법칙 등록 — 게이트 = 물리 입력(α 테이블) 존재. 파라미터 없음 = 기여 0 이 참값 (g=0 동형).
  E.registerLaw({ name: 'pol', rank: 10, active: (w) => !!w.alpha, force: polContrib });

  // ── 측정 ──

  // 클러스터: 이웃 반경 r_clu 안 접촉 그래프의 연결 성분 → 최대 성분 비율·평균 배위수.
  function clusters(world, rclu) {
    const A = world.atoms, n = A.length, L = world.box.L, per = world.box.bc === 'periodic';
    const rc = rclu || 1.5, rc2 = rc * rc;
    const par = new Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const deg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
      if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = world.frozenZ ? 0 : E.minImage(dz, L.z); }
      if (dx * dx + dy * dy + dz * dz <= rc2) { par[find(i)] = find(j); deg[i]++; deg[j]++; }
    }
    const size = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
    let maxc = 0; for (const v of size.values()) if (v > maxc) maxc = v;
    const cid = new Map(); let k = 0; for (const r of size.keys()) cid.set(r, k++);
    const label = new Array(n); for (let i = 0; i < n; i++) label[i] = cid.get(find(i));
    return { largest: maxc, largestFrac: maxc / Math.max(1, n), nClusters: size.size,
      meanCoord: deg.reduce((a, b) => a + b, 0) / Math.max(1, n), label };
  }

  // 이온 근방 중성 수 (반경 R) — ion-induced 밀도 상승 측정
  function nearIonCount(world, R) {
    const ion = world._ionId != null ? world.atomById(world._ionId) : null;
    if (!ion) return 0;
    const L = world.box.L; let c = 0;
    for (const a of world.atoms) {
      if (a.id === ion.id) continue;
      let dx = a.r.x - ion.r.x, dy = a.r.y - ion.r.y;
      dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y);
      if (dx * dx + dy * dy <= R * R) c++;
    }
    return c;
  }

  // 온도 (2D frozenZ): T = K_tr / N (⟨병진 KE⟩ = N·T)
  function temperature(world) { const n = world.atoms.length; return n ? world.ledger.K_tr / n : 0; }

  // ── 장면 ──

  function maxwell(world, T0, rng) {
    const P = E.V.zero();
    for (const a of world.atoms) {
      const m = world.mass[a.sp], s = Math.sqrt(m * T0);
      a.p.x = s * E.gaussian(rng); a.p.y = s * E.gaussian(rng); a.p.z = world.frozenZ ? 0 : s * E.gaussian(rng);
      E.V.addInto(P, a.p);
    }
    const n = world.atoms.length;
    if (n > 0) for (const a of world.atoms) { a.p.x -= P.x / n; a.p.y -= P.y / n; if (!world.frozenZ) a.p.z -= P.z / n; }
  }

  function specMaps8(alphaZero) {
    const mass = {}, sigma = {}, eps = {}, alpha = {}, IE = {};
    for (const k in SP8) { mass[k] = SP8[k].mass; sigma[k] = SP8[k].sigma; eps[k] = SP8[k].eps; alpha[k] = alphaZero ? 0 : SP8[k].alpha; IE[k] = SP8[k].IE; }
    return { mass, sigma, eps, alpha, IE };
  }

  function makeGas8(o) {
    o = o || {};
    const az = !!o.alphaZero, sm = specMaps8(az);
    const L = o.L || 16;
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.0015,     // 분극 우물이 강성 → ②보다 작은 dt (장부 ≤ EPS_E)
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps, computeForces: polForces,
      rng: o.rng || E.makeRng(o.seed || 8008),
      kc: o.kc != null ? o.kc : 1.0, soft: o.soft != null ? o.soft : 0.1,
    });
    world.alpha = sm.alpha; world.ionizeE = sm.IE; world.aDisp = o.aDisp != null ? o.aDisp : 0.9;
    world._alphaZero = az;
    return world;
  }

  function placeLattice8(world, N, rng, sp, jitter) {
    const L = world.box.L, per = Math.ceil(Math.sqrt(N)), gx = L.x / per, gy = L.y / per;
    const jt = jitter == null ? 0.25 : jitter;
    let k = 0;
    for (let i = 0; i < per && k < N; i++) for (let j = 0; j < per && k < N; j++, k++) {
      const r = E.V.make((i + 0.5 + (rng() - 0.5) * jt) * gx, (j + 0.5 + (rng() - 0.5) * jt) * gy, 0);
      world.atoms.push(E.makeAtom(sp, r, E.V.zero()));
    }
  }

  // s08-noble-condense: 중성 닫힌 껍질 기체 냉각 → 분산 인력으로 응집 (Ne 응축 유사).
  function nobleCondense(opts) {
    const o = opts || {};
    const w = makeGas8(Object.assign({ L: o.L || 15 }, o));
    placeLattice8(w, o.N || 100, w.rng, 'Ng');
    maxwell(w, o.T0 != null ? o.T0 : 0.1, w.rng);
    w.computeForces(w); E.recomputeLedger(w);
    w._meta = { name: o.alphaZero ? 's08-alpha-zero' : 's08-noble-condense' };
    return w;
  }

  // s08-alpha-zero: 같은 장면·α=0 (→ C6=0·유도=0) 비교런. 응집이 소멸해야 근원 검증.
  function alphaZero(opts) { return nobleCondense(Object.assign({ alphaZero: true }, opts || {})); }

  // s08-ion-induced: 이온 1개 + 중성 기체 — 전하–유도쌍극자 인력 (분극 경로 단독).
  //   분산(C6)은 이 장면에서 끈다(ionizeE=0) — 목적이 "C6 없이도 분극이 인력을 만든다"의
  //   고립 검증이라, 중성-중성 인력을 제거하면 계 전체의 유일한 인력이 이온→중성(전하유도)뿐이다.
  //   chargeOff:true → 이온 전하 0 (같은 α, 전하만 제거) = 균일 기체 기준선.
  function ionInduced(opts) {
    const o = opts || {};
    const w = makeGas8(Object.assign({ L: o.L || 18 }, o));
    for (const k in w.ionizeE) w.ionizeE[k] = 0;      // 분산 off → 중성-중성 인력 0 (고립)
    const M = o.M || 60;
    placeLattice8(w, M, w.rng, 'Ng');
    const L = w.box.L;
    const qIon = o.q != null ? o.q : 2;
    const ion = E.makeAtom('Cat', E.V.make(L.x / 2, L.y / 2, 0), E.V.zero(), o.chargeOff ? 0 : qIon);
    w.atoms.push(ion); w._ionId = ion.id;
    maxwell(w, o.T0 != null ? o.T0 : 0.25, w.rng);
    w.computeForces(w); E.recomputeLedger(w);
    w._meta = { name: 's08-ion-induced', chargeOff: !!o.chargeOff };
    return w;
  }

  function run(world, ticks) { for (let i = 0; i < ticks; i++) E.step(world); return world; }

  // 냉각 스캔: 여러 T0 로 평형 후 (T, 최대성분비율) 측정 → T_c(50% 교차) 조짐.
  function condenseScan(T0s, opts) {
    opts = opts || {};
    const out = [];
    for (const T0 of T0s) {
      const w = nobleCondense(Object.assign({}, opts, { T0 }));
      run(w, opts.ticks || 6000);
      const c = clusters(w, opts.rclu || 1.5);
      out.push({ T0, T: temperature(w), frac: c.largestFrac, coord: c.meanCoord });
    }
    return out;
  }

  const SCENES = { 's08-noble-condense': nobleCondense, 's08-alpha-zero': alphaZero, 's08-ion-induced': ionInduced };
  function build(name, opts) {
    const f = SCENES[name]; if (!f) throw new Error('알 수 없는 장면: ' + name); return f(opts);
  }

  const api = {
    SP8, C6of, polForces, polContrib, clusters, nearIonCount, temperature,
    makeGas8, nobleCondense, alphaZero, ionInduced, condenseScan, run, build, SCENES,
  };
  if (isNode) module.exports = api;
  else window.HktS0Pol = api;
})();
