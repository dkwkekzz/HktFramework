// scenes.js — 장면(초기 조건) 명세. 차원은 장면이 정한다 (z 동결은 장면 속성).
//
// 세부 단계 ①: 이상 기체(맥스웰 초기 p·힘 0)로 무대·장부·수치 불변식을 검증한다.
// 노브(상자 크기·입자 수·초기 온도)는 여기 상수 — 수식형이 아니므로 조정은 step 기록으로 충분.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const C = isNode ? require('./catalog.js') : window.HktS0Catalog;

  // 종 레지스트리 — 가상 원소. ①은 질량만, ②부터 σ(상호작용 지름)·ε(척력 세기).
  // ③에서 Z·occ 로 확장. radius/color 는 뷰어용. A = ④ 2준위 종(dE·g0·g1).
  const SPECIES = {
    X: { mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.5, color: '#5ab' },
    A: { mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.5, color: '#c9a', dE: 1.0, g0: 1, g1: 2 },
    // ⑤ 이온결합용 가상 원소 — Kat(저 IE·양이온형)·An(고 EA·음이온형). NaCl 유사.
    Kat: { mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.5, color: '#e0803a', role: 'cation', ion: { states: { 0: 0.8, 1: 0 }, minNe: 0, maxNe: 1 } },
    An: { mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.5, color: '#3a7ae0', role: 'anion', ion: { states: { 1: 0, 2: -0.6 }, minNe: 1, maxNe: 2 } },
    // ⑥ 공유결합용 가상 원소 — 결합차수 예산 B (원자가). H1=1가·O2=2가·C4=4가.
    H1: { mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.42, color: '#dfe6ee', B: 1 },
    O2: { mass: 4.0, sigma: 1.15, eps: 1.0, radius: 0.55, color: '#e0574a', B: 2 },
    C4: { mass: 3.0, sigma: 1.1, eps: 1.0, radius: 0.52, color: '#556070', B: 4 },
  };

  // ⑤ 종별 이온화 명세 맵 (engine.specIon 형식)
  function specIonMap() {
    return {
      Kat: Object.assign({ role: 'cation' }, SPECIES.Kat.ion),
      An: Object.assign({ role: 'anion' }, SPECIES.An.ion),
    };
  }

  // makeWorld 에 종 파라미터 맵을 넘기는 헬퍼
  function specMaps() {
    const mass = {}, sigma = {}, eps = {};
    for (const k in SPECIES) { mass[k] = SPECIES[k].mass; sigma[k] = SPECIES[k].sigma; eps[k] = SPECIES[k].eps; }
    return { mass, sigma, eps };
  }

  // 맥스웰 분포 초기 운동량: 각 활성 성분 p_k ~ Normal(0, √(m·T₀)).
  // 이후 총 운동량(무게중심 표류)을 정확히 0 으로 뺀다 — 장부 P 검사를 깨끗하게.
  function maxwellInit(world, T0, rng) {
    const P = E.V.zero();
    for (const a of world.atoms) {
      const m = world.mass[a.sp];
      const s = Math.sqrt(m * T0);
      a.p.x = s * E.gaussian(rng);
      a.p.y = s * E.gaussian(rng);
      a.p.z = world.frozenZ ? 0 : s * E.gaussian(rng);
      E.V.addInto(P, a.p);
    }
    const n = world.atoms.length;
    if (n > 0) {  // 무게중심 표류 제거 → 총 P = 0
      for (const a of world.atoms) {
        a.p.x -= P.x / n; a.p.y -= P.y / n;
        if (!world.frozenZ) a.p.z -= P.z / n;
      }
    }
  }

  // 격자 위 초기 배치 (겹침 방지 — ①은 힘이 없지만 뷰어 가독성·후속 단계 습관)
  function latticePlace(world, N, rng, sp) {
    sp = sp || 'X';
    const L = world.box.L;
    const per = Math.ceil(Math.sqrt(N));           // z 동결 → xy 격자
    const gx = L.x / per, gy = L.y / per;
    let k = 0;
    for (let i = 0; i < per && k < N; i++) {
      for (let j = 0; j < per && k < N; j++, k++) {
        const jitter = 0.15;
        const r = E.V.make(
          (i + 0.5 + (rng() - 0.5) * jitter) * gx,
          (j + 0.5 + (rng() - 0.5) * jitter) * gy,
          0
        );
        world.atoms.push(E.makeAtom(sp, r, E.V.zero()));
      }
    }
  }

  // s01-ideal-gas: 주기 상자·z 동결·이상 기체. 무대·장부·dt 불변식의 기본 장면.
  function idealGas(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 12345);
    const N = o.N || 64;
    const T0 = o.T0 != null ? o.T0 : 1.0;
    const L = o.L || 20;
    const sm = specMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.01,
      box: { L: E.V.make(L, L, L), bc: o.bc || 'periodic' },
      frozenZ: o.frozenZ !== false,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps,
      // ①은 힘 0 (기본 zeroForces) — computeForces 미지정
    });
    latticePlace(world, N, rng);
    maxwellInit(world, T0, rng);
    E.recomputeLedger(world);
    world._meta = { name: 's01-ideal-gas', T0, N };
    return world;
  }

  // s01-open-box: 열린 경계 — 탈출 회계 확인용. 입자가 상자 밖으로 탄도 비행해 나간다.
  function openBox(opts) {
    const o = opts || {};
    return idealGas(Object.assign({ bc: 'open', T0: 2.0, seed: o.seed || 777, N: o.N || 64 }, o, { bc: 'open' }));
  }

  // ── ② 힘·충돌 장면 ──

  // s02-gas-collide: 중성 N체 고밀도 기체 — 척력 산란 반복. 겹침·장부 감시 + EPS_E 대표 장면.
  //   중성 q=0 → 척력만 실효 (쿨롱 경로는 charge 장면에서). dt 는 척력 벽 강성이 정한다.
  function gasCollide(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 2002);
    const N = o.N || 80;
    const T0 = o.T0 != null ? o.T0 : 1.5;
    const L = o.L || 14;
    const sm = specMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: o.bc || 'periodic' },
      frozenZ: o.frozenZ !== false,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps,
      computeForces: E.pairForces,
    });
    latticePlace(world, N, rng);       // 격자 시작 → 겹침 없이 출발
    maxwellInit(world, T0, rng);
    E.pairForces(world); E.recomputeLedger(world);
    world._meta = { name: 's02-gas-collide', T0, N };
    return world;
  }

  // s02-scatter-2: 2체 산란. 무거운 표적(≈고정) + 동전하(+1/+1) 발사체, 충돌 파라미터 b.
  //   설계도의 "±1 쌍" → 동전하 +1/+1 로 채택(반발 러더퍼드): θ(b) 단조 감소가 깨끗하고
  //   쿨롱 힘 경로까지 한 장면에서 검증된다(±는 s02-charge-pair 가 인력 경로로 담당).
  function scatter2(opts) {
    const o = opts || {};
    const b = o.b != null ? o.b : 1.0;      // 충돌 파라미터
    const v0 = o.v0 != null ? o.v0 : 1.5;   // 입사 속도
    const D = o.D != null ? o.D : 40;       // 시작 거리 (상호작용 밖)
    const sm = specMaps();
    sm.mass = Object.assign({}, sm.mass, { T: 1e6 });   // 표적 종 T: 초중량 ≈ 고정
    sm.sigma = Object.assign({}, sm.sigma, { T: SPECIES.X.sigma });
    sm.eps = Object.assign({}, sm.eps, { T: SPECIES.X.eps });
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(1000, 1000, 1000), bc: 'open' },  // 큰 열린 상자 — 벽 상호작용 0
      frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps,
      computeForces: E.pairForces,
    });
    // 표적: 원점 근방, 정지, +1. 발사체: (−D, b) 에서 +x 로 v0, +1.
    world.atoms.push(E.makeAtom('T', E.V.make(500, 500, 0), E.V.zero(), +1));
    world.atoms.push(E.makeAtom('X', E.V.make(500 - D, 500 + b, 0), E.V.make(v0, 0, 0), +1));
    E.pairForces(world); E.recomputeLedger(world);
    world._meta = { name: 's02-scatter-2', b, v0, projectileId: world.atoms[1].id };
    return world;
  }

  // s02-charge-pair: +1/−1 쌍 — 쿨롱 인력 경로 검증 (궤도/산란). 장부 닫힘 확인.
  function chargePair(opts) {
    const o = opts || {};
    const sm = specMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.002,
      box: { L: E.V.make(60, 60, 60), bc: 'periodic' },
      frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps,
      computeForces: E.pairForces,
    });
    // 두 반대 전하를 서로 스쳐 지나가게 배치 (인력 편향)
    world.atoms.push(E.makeAtom('X', E.V.make(24, 30, 0), E.V.make(1.0, 0, 0), +1));
    world.atoms.push(E.makeAtom('X', E.V.make(36, 33, 0), E.V.make(-1.0, 0, 0), -1));
    // 무게중심 표류 제거
    const P = E.V.zero(); for (const a of world.atoms) E.V.addInto(P, a.p);
    for (const a of world.atoms) { a.p.x -= P.x / 2; a.p.y -= P.y / 2; }
    E.pairForces(world); E.recomputeLedger(world);
    world._meta = { name: 's02-charge-pair' };
    return world;
  }

  // ── ④ 전이 엔진 장면 (볼츠만 3장면) — 2준위 종 A ──

  function specLevelsA() { const s = SPECIES.A; return { A: { dE: s.dE, g0: s.g0, g1: s.g1 } }; }

  function buildA(o, over) {
    const rng = o.rng || E.makeRng(o.seed || 4004);
    const N = o.N || 120, T0 = o.T0 != null ? o.T0 : 2.0, L = o.L || 16;
    const world = E.makeWorld(Object.assign({
      dt: o.dt != null ? o.dt : 0.005,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass: { A: SPECIES.A.mass }, sigma: { A: SPECIES.A.sigma }, eps: { A: SPECIES.A.eps },
      computeForces: E.pairForces, rng,
      catalog: C.COLLISIONAL, specLevels: specLevelsA(),
      rc: o.rc != null ? o.rc : 1.6, nu_col: o.nu_col != null ? o.nu_col : 2.0,
    }, over));
    latticePlace(world, N, rng, 'A');
    maxwellInit(world, T0, rng);
    E.pairForces(world); E.recomputeLedger(world);
    world._auditP = over && over.audP;      // 충돌 전용 장면만 P 감사
    return world;
  }

  // s04-thermal-bath: 고밀도·복사 꺼짐(τ→∞) — 충돌 지배. 점유가 볼츠만으로 창발.
  function thermalBath(opts) {
    const o = opts || {};
    const w = buildA(o, { tau_rad: Infinity, audP: true });
    w._meta = { name: 's04-thermal-bath' };
    return w;
  }

  // s04-radiative-cooling: 방출 광자 즉시 탈출 — 냉각. T 단조 하강 · E_escape 증가.
  function radiativeCooling(opts) {
    const o = opts || {};
    const w = buildA(Object.assign({ T0: 3.0, N: 100, seed: o.seed || 4005 }, o),
      { tau_rad: o.tau_rad != null ? o.tau_rad : 2.0, radiativeOpen: true });
    w._meta = { name: 's04-radiative-cooling' };
    return w;
  }

  // s04-cavity: 닫힌 상자 — 방출 광자가 빈에 저장되고 재흡수. 물질↔복사 정상 상태.
  function cavity(opts) {
    const o = opts || {};
    const w = buildA(Object.assign({ T0: 2.0, N: 120, seed: o.seed || 4006 }, o),
      { tau_rad: o.tau_rad != null ? o.tau_rad : 2.0, radiativeOpen: false, nu_abs: o.nu_abs != null ? o.nu_abs : 6.0 });
    w._meta = { name: 's04-cavity' };
    return w;
  }

  // ── ⑤ 이온화·이온결합 장면 ──

  function ionSpecMaps() {
    const mass = {}, sigma = {}, eps = {};
    for (const k of ['Kat', 'An']) { mass[k] = SPECIES[k].mass; sigma[k] = SPECIES[k].sigma; eps[k] = SPECIES[k].eps; }
    return { mass, sigma, eps };
  }
  function placeNeutral(world, sp, r, rng) {
    const a = E.makeAtom(sp, r, E.V.zero());
    a.Z = 1; E.setNe(world, a, 1);   // 중성: ne=1, q=0
    world.atoms.push(a); return a;
  }

  // s05-lattice: Kat/An 반반 수프 저T — 전자 이전 → 이온 → 쿨롱 격자(교대 배열) 창발.
  function ionLattice(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 5005);
    const per = o.per || 8, N = per * per, L = o.L || (per * 1.4), T0 = o.T0 != null ? o.T0 : 0.2;
    const sm = ionSpecMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.003,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps, computeForces: E.pairForces, rng,
      catalog: C.IONIC, specIon: specIonMap(),
      rc: o.rc != null ? o.rc : 1.6, nu_col: o.nu_col != null ? o.nu_col : 5.0,
    });
    const gx = L / per, gy = L / per;
    let k = 0;
    for (let i = 0; i < per; i++) for (let j = 0; j < per; j++, k++) {
      const sp = ((i + j) % 2 === 0) ? 'Kat' : 'An';   // 체커보드 씨앗(느슨) — 재배열은 동역학
      const r = E.V.make((i + 0.5 + (rng() - 0.5) * 0.3) * gx, (j + 0.5 + (rng() - 0.5) * 0.3) * gy, 0);
      placeNeutral(world, sp, r, rng);
    }
    maxwellInit(world, T0, rng);
    E.pairForces(world); E.recomputeLedger(world);
    world._auditP = true; world._meta = { name: 's05-lattice', N };
    return world;
  }

  // s05-ion-pair: Kat–An 2체를 멀리 떨어뜨림 — 전자 이전이 오르막(ΔE=IE−EA>0)인지 확인.
  function ionPair(opts) {
    const o = opts || {};
    const sm = ionSpecMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.003,
      box: { L: E.V.make(80, 80, 80), bc: 'periodic' }, frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps, computeForces: E.pairForces,
      rng: o.rng || E.makeRng(o.seed || 5006),
      catalog: C.IONIC, specIon: specIonMap(), rc: o.rc != null ? o.rc : 1.6, nu_col: 4.0,
    });
    placeNeutral(world, 'Kat', E.V.make(40, 40, 0));
    placeNeutral(world, 'An', E.V.make(41.0, 40, 0));   // 접촉 거리
    E.pairForces(world); E.recomputeLedger(world);
    world._auditP = true; world._meta = { name: 's05-ion-pair' };
    return world;
  }

  // ── ⑥ 공유결합 장면 ──

  // 여러 종을 개수대로 섞어 배치 (예산 결합용)
  function buildCovalent(o, counts) {
    const rng = o.rng || E.makeRng(o.seed || 6006);
    const specs = Object.keys(counts);
    const N = specs.reduce((s, k) => s + counts[k], 0);
    const L = o.L || Math.ceil(Math.sqrt(N)) * 1.8;
    const mass = {}, sigma = {}, eps = {}, budget = {};
    for (const k of ['H1', 'O2', 'C4']) { mass[k] = SPECIES[k].mass; sigma[k] = SPECIES[k].sigma; eps[k] = SPECIES[k].eps; budget[k] = SPECIES[k].B; }
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass: mass, sigma: sigma, eps: eps, budget: budget,
      computeForces: E.pairForces, rng, catalog: C.COVALENT,
      rc: o.rc != null ? o.rc : 1.5,
      Dbond: o.Dbond != null ? o.Dbond : 2.0, d0: o.d0 != null ? o.d0 : 1.1, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: o.nu_cplx != null ? o.nu_cplx : 5, nu_rad: o.nu_rad != null ? o.nu_rad : 0.5,
      nu_stab: o.nu_stab != null ? o.nu_stab : 1.5, nu_diss: o.nu_diss != null ? o.nu_diss : 2,
    });
    // 무작위 배치 (종을 섞어)
    const bag = [];
    for (const k of specs) for (let n = 0; n < counts[k]; n++) bag.push(k);
    for (let i = bag.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    const per = Math.ceil(Math.sqrt(N)), gx = L / per, gy = L / per;
    for (let idx = 0; idx < bag.length; idx++) {
      const ix = idx % per, iy = (idx / per) | 0;
      const r = E.V.make((ix + 0.5 + (rng() - 0.5) * 0.3) * gx, (iy + 0.5 + (rng() - 0.5) * 0.3) * gy, 0);
      world.atoms.push(E.makeAtom(bag[idx], r, E.V.zero()));
    }
    maxwellInit(world, o.T0 != null ? o.T0 : 0.35, rng);
    E.pairForces(world); E.recomputeLedger(world);
    world._auditP = false;   // 복사 안정화(광자 빈)가 P 미보존 — ④와 동일 (정직)
    return world;
  }

  function v1Dimer(opts) { const o = opts || {}; const w = buildCovalent(o, { H1: o.N || 64 }); w._meta = { name: 's06-v1-dimer' }; return w; }
  function mixedWater(opts) { const o = opts || {}; const n = o.n || 16; const w = buildCovalent(Object.assign({ T0: 0.3 }, o), { H1: 2 * n, O2: n }); w._meta = { name: 's06-mixed' }; return w; }
  function quadMethane(opts) { const o = opts || {}; const n = o.n || 10; const w = buildCovalent(Object.assign({ T0: 0.3 }, o), { C4: n, H1: 4 * n }); w._meta = { name: 's06-quad' }; return w; }
  function noStab(opts) { const o = opts || {}; const w = buildCovalent(Object.assign({ nu_rad: 0, nu_stab: 0 }, o), { H1: o.N || 64 }); w._meta = { name: 's06-no-stab' }; return w; }

  const SCENES = {
    's01-ideal-gas': idealGas,
    's01-open-box': openBox,
    's02-gas-collide': gasCollide,
    's02-scatter-2': scatter2,
    's02-charge-pair': chargePair,
    's04-thermal-bath': thermalBath,
    's04-radiative-cooling': radiativeCooling,
    's04-cavity': cavity,
    's05-lattice': ionLattice,
    's05-ion-pair': ionPair,
    's06-v1-dimer': v1Dimer,
    's06-mixed': mixedWater,
    's06-quad': quadMethane,
    's06-no-stab': noStab,
  };

  function build(name, opts) {
    const f = SCENES[name];
    if (!f) throw new Error('알 수 없는 장면: ' + name);
    return f(opts);
  }

  const api = { SPECIES, SCENES, build, idealGas, openBox, gasCollide, scatter2, chargePair, thermalBath, radiativeCooling, cavity, ionLattice, ionPair, specIonMap, v1Dimer, mixedWater, quadMethane, noStab, maxwellInit };
  if (isNode) module.exports = api;
  else window.HktS0Scenes = api;
})();
