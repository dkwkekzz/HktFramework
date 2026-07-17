// scenes.js — 장면(초기 조건) 명세. 차원은 장면이 정한다 (z 동결은 장면 속성).
//
// 세부 단계 ①: 이상 기체(맥스웰 초기 p·힘 0)로 무대·장부·수치 불변식을 검증한다.
// 노브(상자 크기·입자 수·초기 온도)는 여기 상수 — 수식형이 아니므로 조정은 step 기록으로 충분.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const C = isNode ? require('./catalog.js') : window.HktS0Catalog;
  const Lv = isNode ? require('./levels.js') : window.HktS0Levels;   // ⑩ 실원소 B/IE (③ 순수 함수)
  const Geo = isNode ? require('./geometry.js') : window.HktS0Geometry; // ⑭ 각도 반발 (VSEPR)
  const Pol = isNode ? require('./polarity.js') : window.HktS0Polarity;  // ⑮ 부분 전하 (QEq)

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

  // ⑩ 실원소 종 — CPK 색. B(원자가)는 ③ levels.budget(Z) 유도값(author 아님). σ·mass 는 앵커 노브
  //   (무차원 닮음: 절대값 아닌 원소 간 비율). mass 는 dt 강성 회피로 실비(1:16)보다 압축(1:4).
  //   alpha(분극률)는 ⑧ 분산 C6 용 — 실 원자 분극률 비율(H 0.67·He 0.20·O 0.80·Ne 0.40 Å³) 앵커.
  const REAL = {
    H:  { Z: 1,  mass: 1.0, sigma: 1.0, eps: 1.0, radius: 0.32, color: '#eef2f5', alpha: 0.67 },
    O:  { Z: 8,  mass: 4.0, sigma: 1.2, eps: 1.0, radius: 0.48, color: '#e0403a', alpha: 0.80 },
    He: { Z: 2,  mass: 4.0, sigma: 1.0, eps: 1.0, radius: 0.30, color: '#b9f2e6', alpha: 0.20 },
    Ne: { Z: 10, mass: 8.0, sigma: 1.1, eps: 1.0, radius: 0.38, color: '#9ec7f0', alpha: 0.40 },
  };
  // ⑩ 쌍별 결합 우물 D — 실 결합 에너지 비율 H–H:O–H:O–O = 436:463:146 kJ/mol 에 앵커 (D_OH=2.0 기준).
  //   O–H 가 최강·O–O 최약 → O 가 H 를 2개 잡아 H₂O 창발(등방 우물의 ⑥ gap 해결). 손 튜닝 아님(실비율).
  const DREF = 2.0;
  const DPAIR_REAL = { 'H-O': DREF, 'H-H': DREF * 436 / 463, 'O-O': DREF * 146 / 463 };

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

  // 격자 위 초기 배치 (겹침 방지 — ①은 힘이 없지만 뷰어 가독성·후속 단계 습관).
  //   차원은 장면 속성(①): frozenZ → xy 정사각 격자·해동 → xyz 큐빅 격자 (⑬ — 엔진 변경 0).
  function latticePlace(world, N, rng, sp) {
    sp = sp || 'X';
    const L = world.box.L, jitter = 0.15;
    if (world.frozenZ) {
      const per = Math.ceil(Math.sqrt(N));         // z 동결 → xy 격자
      const gx = L.x / per, gy = L.y / per;
      let k = 0;
      for (let i = 0; i < per && k < N; i++) for (let j = 0; j < per && k < N; j++, k++) {
        const r = E.V.make((i + 0.5 + (rng() - 0.5) * jitter) * gx, (j + 0.5 + (rng() - 0.5) * jitter) * gy, 0);
        world.atoms.push(E.makeAtom(sp, r, E.V.zero()));
      }
    } else {
      const per = Math.ceil(Math.cbrt(N));         // ⑬ 해동 → xyz 큐빅 격자
      const gx = L.x / per, gy = L.y / per, gz = L.z / per;
      let k = 0;
      for (let i = 0; i < per && k < N; i++) for (let j = 0; j < per && k < N; j++) for (let m = 0; m < per && k < N; m++, k++) {
        const r = E.V.make((i + 0.5 + (rng() - 0.5) * jitter) * gx, (j + 0.5 + (rng() - 0.5) * jitter) * gy, (m + 0.5 + (rng() - 0.5) * jitter) * gz);
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

  // ── ⑫ 복사장 장면 (photon 입자) — ④의 빈 근사를 방향·공간 가진 입자로 교체. 2준위 종 A 재사용 ──

  // s12-open-cooling: field 모드 + 광자 open 경계 → 방출 광자가 상자를 나가며 냉각 (④ 냉각 회귀·입자판).
  function openCooling(opts) {
    const o = opts || {};
    // dt=DT_STIFF(0.004): 고T(3.0) 냉각은 병진이 빨라 Verlet 표류가 dt=0.005 에선 EPS_E 를 넘긴다
    //   (EPS_E 는 dt=0.004 기준 교정값 — ②). 냉각 자체는 그대로 재현(T 3.0→~1.3).
    const w = buildA(Object.assign({ T0: 3.0, N: 100, dt: E.DT_STIFF, seed: o.seed || 1205 }, o),
      { tau_rad: o.tau_rad != null ? o.tau_rad : 2.0, radiationMode: 'field',
        c_ph: o.c_ph != null ? o.c_ph : 15.0, photonBC: 'open' });
    w._meta = { name: 's12-open-cooling' };
    return w;
  }

  // s12-cavity: field 모드 + 광자 reflect 경계 → 광자가 상자에 갇혀 재흡수(정상 상태) (④ 공동 회귀·입자판).
  function cavityField(opts) {
    const o = opts || {};
    const w = buildA(Object.assign({ T0: 2.0, N: 120, seed: o.seed || 1206 }, o),
      { tau_rad: o.tau_rad != null ? o.tau_rad : 1.2, radiationMode: 'field',
        c_ph: o.c_ph != null ? o.c_ph : 12.0, photonBC: 'reflect',
        nu_abs: o.nu_abs != null ? o.nu_abs : 2.5 });
    w._meta = { name: 's12-cavity' };
    return w;
  }

  // s12-stim: 밀도 반전(들뜸 다수) + 씨앗 광자 +x 주입 → 유도 방출로 방향성 증폭(빔).
  //   nu_stim=0(대조)이면 자발 방출만 → 등방(축 정렬 이방성 없음). 흡수·충돌 꺼 반전 유지.
  function stimField(opts) {
    const o = opts || {};
    const w = buildA(Object.assign({ T0: 0.5, N: 80, L: o.L || 16, seed: o.seed || 1207 }, o),
      { tau_rad: o.tau_rad != null ? o.tau_rad : 8.0, radiationMode: 'field',
        c_ph: o.c_ph != null ? o.c_ph : 15.0, photonBC: 'reflect',
        nu_abs: o.nu_abs != null ? o.nu_abs : 0.0,          // 흡수 끔 — 증폭만 관찰
        nu_stim: o.stim != null ? o.stim : 6.0, nu_col: 0.0 });  // 충돌 끔 — 준위 반전 유지
    // 밀도 반전: 원자 대부분 들뜸(level 1) + 자발 방출 예약(대조군의 등방 방출원)
    const frac = o.invFrac != null ? o.invFrac : 0.85;
    for (const a of w.atoms) if (w.rng() < frac) { E.setLevel(a, 1); E.scheduleEmission(w, a); }
    // 씨앗 광자 +x 주입 (한 방향)
    const nSeed = o.seed_n != null ? o.seed_n : 8, dE = SPECIES.A.dE;
    for (let i = 0; i < nSeed; i++) {
      const r = E.V.make(1 + w.rng() * 2, w.rng() * w.box.L.y, 0);
      w.photons.push(E.makePhoton(dE, r, E.V.make(1, 0, 0), 0));
      w.ledger.E_photon += dE;
    }
    E.recomputeLedger(w);
    w._meta = { name: 's12-stim' };
    return w;
  }

  // ── ⑬ z 해동 (3D 전환) — `frozenZ:false` 만으로 3D 가 켜짐(차원=장면 속성·①·엔진 변경 0) ──

  // s13-gas-3d: 3D 이상 기체 (힘 0·자유 비행). 등분배 ⟨p_z²⟩=⟨p_x²⟩·탄도 MSD 의 3D 판.
  function gas3d(opts) {
    const o = opts || {};
    const w = idealGas(Object.assign({ N: 64, T0: 1.0, L: 12, seed: o.seed || 1301 }, o, { frozenZ: false }));
    w._meta = { name: 's13-gas-3d' }; return w;
  }

  // s13-collide-3d: 3D 척력 산란. 충돌이 z 로 에너지를 퍼뜨려 등분배·겹침 0 유지(3D).
  function collide3d(opts) {
    const o = opts || {};
    const w = gasCollide(Object.assign({ N: 80, T0: 1.5, L: 11, seed: o.seed || 1302 }, o, { frozenZ: false }));
    w._meta = { name: 's13-collide-3d', T0: o.T0 != null ? o.T0 : 1.5, N: o.N || 80 }; w._auditP = true; return w;
  }

  // s13-bond-3d: 3D 공유결합 — C4 허브 + 4 H1 → CH₄ 위상(각도는 ⑭·여기선 3D 무대만).
  function bond3d(opts) {
    const o = opts || {}; const n = o.n || 8;
    const w = buildCovalent(Object.assign({ T0: 0.3, seed: o.seed || 1303 }, o, { frozenZ: false }), { C4: n, H1: 4 * n });
    w._meta = { name: 's13-bond-3d', n }; return w;
  }

  // ── ⑭ 형상 (VSEPR·결합각) — 미리 결합된 독립 분자 배치, 공통 각도 반발이 형상을 만든다 ──
  //   외각 전자(valence)는 ③ fillZ 유도(author 0). 결합은 고정(catalog 없음) — 형상만 관찰. 3D(⑬) 필수.
  const GEO_SPEC = {
    H1: { Z: 1, mass: 1.0, sigma: 0.9, eps: 1.0, color: '#e6edf3', radius: 0.34 },
    O2: { Z: 8, mass: 8.0, sigma: 1.1, eps: 1.0, color: '#e0403a', radius: 0.5 },
    C4: { Z: 6, mass: 6.0, sigma: 1.05, eps: 1.0, color: '#556070', radius: 0.5 },
    Be2:{ Z: 4, mass: 6.0, sigma: 1.05, eps: 1.0, color: '#c9a6f0', radius: 0.46 },
  };
  // 외각 전자 수 = ③ fillZ(Z) 의 최고 주양자수 껍질 점유 합 (author 0 — 유도값).
  function valenceElectrons(Z) {
    const occ = Lv.fillZ(Z); let maxN = 0;
    for (const sh in occ) maxN = Math.max(maxN, +sh[0]);
    let v = 0; for (const sh in occ) if (+sh[0] === maxN) v += occ[sh];
    return v;
  }

  // 무작위 균일 회전 행렬 (4 가우시안 → 단위 쿼터니언 → R). 분자를 무작위 배향(⑮ 장 응답의 등방 시작).
  function randRot(rng) {
    let a = E.gaussian(rng), b = E.gaussian(rng), c = E.gaussian(rng), d = E.gaussian(rng);
    const n = Math.hypot(a, b, c, d) || 1; a /= n; b /= n; c /= n; d /= n;
    return [
      [1 - 2 * (c * c + d * d), 2 * (b * c - a * d), 2 * (b * d + a * c)],
      [2 * (b * c + a * d), 1 - 2 * (b * b + d * d), 2 * (c * d - a * b)],
      [2 * (b * d - a * c), 2 * (c * d + a * b), 1 - 2 * (b * b + c * c)],
    ];
  }
  function placeMolecule(world, center, ligand, nLig, cx, cy, cz, rng, d0) {
    const c = E.makeAtom(center, E.V.make(cx, cy, cz), E.V.zero()); c.Z = GEO_SPEC[center].Z; c.qBase = 0; world.atoms.push(c);
    // 피보나치 구면 배치 + 작은 무작위 회전 지터 — 겹침 없이 시작(비최적 각) → 각도 반발이 형상으로 이완.
    const gold = 2.399963229728653, jit = 0.4, R = world._randOrient ? randRot(rng) : null;
    for (let k = 0; k < nLig; k++) {
      const y = nLig === 1 ? 1 : 1 - 2 * (k + 0.5) / nLig;
      const r = Math.sqrt(Math.max(0, 1 - y * y)), phi = k * gold + (rng() - 0.5) * jit;
      let dx = r * Math.cos(phi), dy = y, dz = r * Math.sin(phi);
      if (world.frozenZ) { dx = Math.cos(phi + y); dy = Math.sin(phi + y); dz = 0; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
      if (R) { const nx = R[0][0] * dx + R[0][1] * dy + R[0][2] * dz, ny = R[1][0] * dx + R[1][1] * dy + R[1][2] * dz, nz = R[2][0] * dx + R[2][1] * dy + R[2][2] * dz; dx = nx; dy = ny; dz = nz; }
      const lg = E.makeAtom(ligand, E.V.make(cx + dx * d0, cy + dy * d0, cz + dz * d0), E.V.zero()); lg.Z = GEO_SPEC[ligand].Z; lg.qBase = 0; world.atoms.push(lg);
      world.bonds.push({ i: c.id, j: lg.id, order: 1, rest: d0, k: world.kbond, D: world.Dbond });
    }
  }

  function buildShape(o, mol) {
    const rng = o.rng || E.makeRng(o.seed || 1401);
    const count = o.count || 12, d0 = 1.15, T0 = o.T0 != null ? o.T0 : 0.006, L = o.L || 18;
    const mass = {}, sigma = {}, eps = {}, valence = {};
    for (const k in GEO_SPEC) { mass[k] = GEO_SPEC[k].mass; sigma[k] = GEO_SPEC[k].sigma; eps[k] = GEO_SPEC[k].eps; valence[k] = valenceElectrons(GEO_SPEC[k].Z); }
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.0025,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: false,   // ⑬ 3D 무대
      mass, sigma, eps,
      computeForces: Geo.forcesWithAngles, rng, catalog: null,          // 결합 고정(해리 없음) — 형상만
      Dbond: o.Dbond != null ? o.Dbond : 4.0, kbond: o.kbond != null ? o.kbond : 30, d0,
    });
    world.valence = valence;   // makeWorld 는 미지 필드를 버림 → ⑭ 외각 전자 맵을 직접 부착(고립쌍 수 유도)
    if (o.kang != null) world._kang = o.kang; if (o.lam != null) world._lam = o.lam; if (o.c0 != null) world._c0 = o.c0;   // 튜닝 override
    if (o.polar) {   // ⑮ 부분 전하: QEq(전하 균등화) → pairForces(부분 전하 쿨롱) → 각도(⑭ 형상) 합성
      world._geoAngular = Geo.angularForces; world.computeForces = Pol.forcesPolar;
      if (o.field) world.Efield = o.field;
      if (o.randOrient) world._randOrient = true;   // ⑮ 장 응답: 무작위 배향 시작(장 없으면 등방 유지)
    }
    const per = Math.ceil(Math.cbrt(count)), g = L / per;
    let m = 0;
    for (let i = 0; i < per && m < count; i++) for (let j = 0; j < per && m < count; j++) for (let kk = 0; kk < per && m < count; kk++, m++)
      placeMolecule(world, mol.center, mol.ligand, mol.nLig, (i + 0.5) * g, (j + 0.5) * g, (kk + 0.5) * g, rng, d0);
    Geo.initGeometry(world);
    // 형상 이완 (초기 조건 준비 — maxwellInit 과 동형): 과감쇠 하강으로 분자를 각도 최소에 안착시킨다.
    //   초기 배치의 굽힘 에너지를 빼야(감쇠는 여기서만) 측정 런이 최소 근방 열진동을 본다. 측정 런은 보존.
    const eq = o.eqSteps != null ? o.eqSteps : 9000, damp = o.damp != null ? o.damp : 0.96;
    for (let k = 0; k < eq; k++) { E.step(world); for (const a of world.atoms) { a.p.x *= damp; a.p.y *= damp; a.p.z *= damp; } }
    maxwellInit(world, T0, rng);
    world.computeForces(world); E.recomputeLedger(world);   // polar 면 Pol.forcesPolar(전하 갱신+U_pol)·아니면 forcesWithAngles
    world._auditP = false;
    return world;
  }
  // s14-methane: CH₄ 정사면체(C 4결합·0고립) · s14-water: H₂O 굽음(O 2결합·2고립) · s14-linear: BeH₂ 직선(Be 2결합·0고립)
  function shapeMethane(o) { o = o || {}; const w = buildShape(o, { center: 'C4', ligand: 'H1', nLig: 4 }); w._meta = { name: 's14-methane', geo: 1 }; return w; }
  function shapeWater(o) { o = o || {}; const w = buildShape(o, { center: 'O2', ligand: 'H1', nLig: 2 }); w._meta = { name: 's14-water', geo: 1 }; return w; }
  function shapeLinear(o) { o = o || {}; const w = buildShape(o, { center: 'Be2', ligand: 'H1', nLig: 2 }); w._meta = { name: 's14-linear', geo: 1 }; return w; }

  // ── ⑮ 극성 (부분 전하·QEq) — ⑭ 형상 위에 전기음성도 균등화. 극성 = 전하×형상 창발 ──
  //   O₂ 무극성(동핵) · BeH₂ 무극성 분자(극성 결합 상쇄·CO₂ 대역·⑩ 이중결합 격차) · H₂O 극성(굽음+χ_O>χ_H).
  function polO2(o) { o = o || {}; const w = buildShape(Object.assign({ polar: true }, o), { center: 'O2', ligand: 'O2', nLig: 1 }); w._meta = { name: 's15-o2', geo: 1, polar: 1 }; return w; }
  function polBeH2(o) { o = o || {}; const w = buildShape(Object.assign({ polar: true }, o), { center: 'Be2', ligand: 'H1', nLig: 2 }); w._meta = { name: 's15-beh2', geo: 1, polar: 1 }; return w; }
  function polH2O(o) { o = o || {}; const w = buildShape(Object.assign({ polar: true }, o), { center: 'O2', ligand: 'H1', nLig: 2 }); w._meta = { name: 's15-h2o', geo: 1, polar: 1 }; return w; }
  // s15-field: 균일 외부장 속 H₂O — dq·배향의 장 응답 (유전 응답 정성).
  function polField(o) { o = o || {}; const ex = o.Ex != null ? o.Ex : 0.6; const w = buildShape(Object.assign({ polar: true, randOrient: true, field: ex > 0 ? E.V.make(ex, 0, 0) : null, count: o.count || 12, T0: o.T0 != null ? o.T0 : 0.03, eqSteps: o.eqSteps != null ? o.eqSteps : 4000 }, o), { center: 'O2', ligand: 'H1', nLig: 2 }); w._meta = { name: 's15-field', geo: 1, polar: 1, field: 1 }; return w; }

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
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: o.frozenZ !== false,   // ⑬ 해동 가능
      mass: mass, sigma: sigma, eps: eps, budget: budget,
      computeForces: E.pairForces, rng, catalog: C.COVALENT,
      rc: o.rc != null ? o.rc : 1.5,
      Dbond: o.Dbond != null ? o.Dbond : 2.0, d0: o.d0 != null ? o.d0 : 1.1, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: o.nu_cplx != null ? o.nu_cplx : 5, nu_rad: o.nu_rad != null ? o.nu_rad : 0.5,
      nu_stab: o.nu_stab != null ? o.nu_stab : 1.5, nu_diss: o.nu_diss != null ? o.nu_diss : 2,
    });
    // 무작위 배치 (종을 섞어) — 차원은 장면 속성(①): 동결 xy 격자·해동 xyz 큐빅.
    const bag = [];
    for (const k of specs) for (let n = 0; n < counts[k]; n++) bag.push(k);
    for (let i = bag.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    if (world.frozenZ) {
      const per = Math.ceil(Math.sqrt(N)), gx = L / per, gy = L / per;
      for (let idx = 0; idx < bag.length; idx++) {
        const ix = idx % per, iy = (idx / per) | 0;
        const r = E.V.make((ix + 0.5 + (rng() - 0.5) * 0.3) * gx, (iy + 0.5 + (rng() - 0.5) * 0.3) * gy, 0);
        world.atoms.push(E.makeAtom(bag[idx], r, E.V.zero()));
      }
    } else {
      const per = Math.ceil(Math.cbrt(N)), g = L / per;
      for (let idx = 0; idx < bag.length; idx++) {
        const ix = idx % per, iy = ((idx / per) | 0) % per, iz = (idx / (per * per)) | 0;
        const r = E.V.make((ix + 0.5 + (rng() - 0.5) * 0.3) * g, (iy + 0.5 + (rng() - 0.5) * 0.3) * g, (iz + 0.5 + (rng() - 0.5) * 0.3) * g);
        world.atoms.push(E.makeAtom(bag[idx], r, E.V.zero()));
      }
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

  // ── ⑩ 수프 관문 장면 (실원소 합류) ──

  // 실원소 수프 빌더 — 실원소 종 + 쌍별 D. 고T 시작 → 냉각 스케줄(annealSoup)로 조성 정착.
  function buildSoup(o, counts) {
    o = o || {};
    const rng = o.rng || E.makeRng(o.seed || 1010);
    const specs = Object.keys(counts);
    const N = specs.reduce((s, k) => s + counts[k], 0);
    const L = o.L || Math.ceil(Math.sqrt(N)) * 1.7;
    const mass = {}, sigma = {}, eps = {}, budget = {};
    for (const k of ['H', 'O', 'He', 'Ne']) { mass[k] = REAL[k].mass; sigma[k] = REAL[k].sigma; eps[k] = REAL[k].eps; budget[k] = Lv.budget(REAL[k].Z); }
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass, sigma, eps, budget, computeForces: E.pairForces, rng, catalog: C.COVALENT,
      rc: o.rc != null ? o.rc : 1.5,
      Dbond: o.Dbond != null ? o.Dbond : DREF, d0: o.d0 != null ? o.d0 : 1.1, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: o.nu_cplx != null ? o.nu_cplx : 5, nu_rad: o.nu_rad != null ? o.nu_rad : 0.5,
      nu_stab: o.nu_stab != null ? o.nu_stab : 1.5, nu_diss: o.nu_diss != null ? o.nu_diss : 2,
    });
    world.Dpair = DPAIR_REAL;   // ⑩ 쌍별 우물 (실 결합 에너지 비율)
    // 무작위 배치 (종 섞어)
    const bag = [];
    for (const k of specs) for (let n = 0; n < counts[k]; n++) bag.push(k);
    for (let i = bag.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    const per = Math.ceil(Math.sqrt(N)), gx = L / per, gy = L / per;
    for (let idx = 0; idx < bag.length; idx++) {
      const ix = idx % per, iy = (idx / per) | 0;
      const r = E.V.make((ix + 0.5 + (rng() - 0.5) * 0.3) * gx, (iy + 0.5 + (rng() - 0.5) * 0.3) * gy, 0);
      world.atoms.push(E.makeAtom(bag[idx], r, E.V.zero()));
    }
    maxwellInit(world, o.T0 != null ? o.T0 : 1.3, rng);
    E.pairForces(world); E.recomputeLedger(world);
    world._auditP = false;   // 복사 안정화 P 미보존 (⑥과 동일·정직)
    return world;
  }

  // 냉각 스케줄 [목표T, ticks] — 고T 평형 탐색 → 서서히 냉각. 열역학 최소(H₂O)로 어닐링.
  const ANNEAL_SCHED = [[1.1, 4000], [0.85, 4000], [0.65, 4000], [0.5, 4000], [0.38, 4000], [0.28, 4000]];

  // annealSoup: 냉각 스케줄로 세계를 굴린다. 항온조가 뺀/넣은 열은 E_escape 로 회계 → **장부 닫힘**
  //   (냉각 저수지에 열을 넘김 = ④ 복사 냉각과 같은 정직·닫힌 회계). 어닐링이 활성화 장벽을 넘게 해
  //   준안정 중간체(H₂·OH)를 열역학 산물(H₂O)로 이완시킨다.
  function annealSoup(world, sched) {
    sched = sched || ANNEAL_SCHED;
    for (const st of sched) { const Ttar = st[0], ticks = st[1]; for (let k = 0; k < ticks; k++) { E.step(world); if (k % 20 === 0) thermoReservoir(world, Ttar); } }
    return world;
  }
  function thermoReservoir(world, Ttar) {
    const n = world.atoms.length; if (!n) return;
    E.recomputeLedger(world);
    const Kb = world.ledger.K_tr, Tc = Kb / n;    // 2D frozenZ: T = K_tr/N
    if (Tc <= 0) return;
    const s = Math.sqrt(Ttar / Tc);
    for (const a of world.atoms) { a.p.x *= s; a.p.y *= s; }
    E.recomputeLedger(world);
    world.ledger.E_escape += Kb - world.ledger.K_tr;   // 제거(+)/공급(−)된 열 → 저수지 회계 (장부 닫힘)
  }

  // 뷰어용: world.t 기준 냉각 목표로 1회 항온조 (E_escape 회계) — 라이브 어닐링 애니메이션.
  function coolStep(world) {
    const sched = world._meta && world._meta.cool; if (!sched) return;
    let acc = 0, Ttar = sched[sched.length - 1][0];
    for (const st of sched) { acc += st[1] * world.dt; if (world.t <= acc) { Ttar = st[0]; break; } }
    thermoReservoir(world, Ttar);
  }

  // s10-water-soup: H 2N + O N 수프. 빌드 후 annealSoup 로 굴리면 H₂O 우세 창발.
  function waterSoup(opts) { const o = opts || {}; const n = o.n || 16; const w = buildSoup(o, { H: 2 * n, O: n }); w._meta = { name: 's10-water-soup', n, cool: ANNEAL_SCHED }; return w; }

  // ── ⑪ 승격 배관 MVP 장면 ──

  // s11-mvp-box: 밀폐 상자. 결합(⑥⑩)+응집(⑧)을 함께 — polForces(분산 인력)+catalog(결합)+Dpair.
  //   5막 대본(runScenario)을 열욕 스케줄로 굴린다: 형성→응집→가열→반응→냉각 (하나의 장부).
  function mvpBox(opts) {
    const o = opts || {};
    const Po = isNode ? require('./polarization.js') : window.HktS0Pol;
    const n = o.n || 12;                          // H 2n + O n
    const counts = { H: 2 * n, O: n };
    const rng = o.rng || E.makeRng(o.seed || 1111);
    const N = counts.H + counts.O, L = o.L || Math.ceil(Math.sqrt(N)) * 1.7;
    const mass = {}, sigma = {}, eps = {}, budget = {}, alpha = {}, IE = {};
    for (const k of ['H', 'O', 'He', 'Ne']) { mass[k] = REAL[k].mass; sigma[k] = REAL[k].sigma; eps[k] = REAL[k].eps; budget[k] = Lv.budget(REAL[k].Z); alpha[k] = REAL[k].alpha; IE[k] = Lv.ionizationE(REAL[k].Z); }
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass, sigma, eps, budget, computeForces: Po.polForces, rng, catalog: C.COVALENT,
      rc: o.rc != null ? o.rc : 1.5,
      Dbond: DREF, d0: o.d0 != null ? o.d0 : 1.1, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: 5, nu_rad: 0.5, nu_stab: 1.5, nu_diss: 2,
    });
    world.Dpair = DPAIR_REAL; world.alpha = alpha; world.ionizeE = IE; world.aDisp = 0.9;
    const bag = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) bag.push(k);
    for (let i = bag.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    const per = Math.ceil(Math.sqrt(N)), gx = L / per, gy = L / per;
    for (let idx = 0; idx < bag.length; idx++) { const ix = idx % per, iy = (idx / per) | 0; world.atoms.push(E.makeAtom(bag[idx], E.V.make((ix + 0.5 + (rng() - 0.5) * 0.3) * gx, (iy + 0.5 + (rng() - 0.5) * 0.3) * gy, 0), E.V.zero())); }
    maxwellInit(world, o.T0 != null ? o.T0 : 1.3, rng);
    world.computeForces(world); E.recomputeLedger(world);
    world._auditP = false;
    // 5막 대본 (열욕 목표 T · ticks). 물리 조작 0 — 열욕 스케줄만.
    world._meta = { name: 's11-mvp-box', n, acts: o.acts || [
      { name: '형성', T: 0.55, ticks: 3500 }, { name: '응집', T: 0.32, ticks: 3500 },
      { name: '가열·조짐', T: 1.30, ticks: 3000 }, { name: '반응', T: 0.90, ticks: 3000 },
      { name: '냉각', T: 0.30, ticks: 3500 } ] };
    world._actIdx = -1; world._actLeft = 0;
    return world;
  }

  // 5막 시나리오 드라이버 — 각 막의 목표 T 로 열욕(thermoReservoir·E_escape 회계) 유지. 한 장부.
  //   record(world, tag) 콜백에 막·관측량 궤적을 남긴다 (뷰어·검증 공용).
  function runScenario(world, record) {
    const acts = world._meta.acts;
    for (let ai = 0; ai < acts.length; ai++) {
      const act = acts[ai];
      for (let k = 0; k < act.ticks; k++) {
        E.step(world);
        if (k % 20 === 0) thermoReservoir(world, act.T);
        if (record && k % 200 === 0) record(world, ai, act);
      }
      if (record) record(world, ai, act);
    }
    return world;
  }

  // 뷰어용 1프레임 진행: 현재 막의 목표 T 로 열욕. 막 경계 자동 전환.
  function scenarioStep(world) {
    const acts = world._meta && world._meta.acts; if (!acts) return;
    if (world._actIdx < 0) { world._actIdx = 0; world._actLeft = acts[0].ticks; }
    if (world._actIdx >= acts.length) return;   // 완료
    thermoReservoir(world, acts[world._actIdx].T);
    world._actLeft -= (world._speed || 1);
    if (world._actLeft <= 0) { world._actIdx++; if (world._actIdx < acts.length) world._actLeft = acts[world._actIdx].ticks; }
  }

  // ── ⑨ 통계 관문 장면 (새 물리 0 — 초기 조건만) ──

  // s09-entropy-corner: N 원자를 좌하단 구석(frac×frac)에 몰아넣고 힘 0(이상기체) 자유 팽창.
  //   위상공간 엔트로피가 앙상블 평균으로 증가 (열역학 제2법칙 창발). 저엔트로피 → 고엔트로피.
  function entropyCorner(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 909);
    const N = o.N || 100, T0 = o.T0 != null ? o.T0 : 1.0, L = o.L || 20;
    const frac = o.corner != null ? o.corner : 0.4;
    const sm = specMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.01,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: o.frozenZ !== false,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps,   // 힘 0 (computeForces 미지정 = zeroForces)
    });
    for (let i = 0; i < N; i++) world.atoms.push(E.makeAtom('X', E.V.make(rng() * L * frac, rng() * L * frac, 0), E.V.zero()));
    maxwellInit(world, T0, rng);
    E.recomputeLedger(world);
    world._meta = { name: 's09-entropy-corner', N };
    return world;
  }

  // s09-gradient: 좌 절반 뜨겁게·우 절반 차갑게 → 충돌 확산으로 온도 프로파일 이완 (비평형).
  //   T_국소 프로파일이 시간에 따라 평탄해진다 — 아레니우스 hazard 의 국소 T 추종 관찰용.
  function tempGradient(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 910);
    const N = o.N || 120, L = o.L || 16;
    const Thot = o.Thot != null ? o.Thot : 3.0, Tcold = o.Tcold != null ? o.Tcold : 0.4;
    const sm = specMaps();
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'periodic' }, frozenZ: true,
      mass: sm.mass, sigma: sm.sigma, eps: sm.eps, computeForces: E.pairForces,
    });
    latticePlace(world, N, rng);
    const P = E.V.zero();
    for (const a of world.atoms) {
      const T = a.r.x < L / 2 ? Thot : Tcold, s = Math.sqrt(world.mass[a.sp] * T);
      a.p.x = s * E.gaussian(rng); a.p.y = s * E.gaussian(rng);
      E.V.addInto(P, a.p);
    }
    const n = world.atoms.length;
    for (const a of world.atoms) { a.p.x -= P.x / n; a.p.y -= P.y / n; }
    E.pairForces(world); E.recomputeLedger(world);
    world._meta = { name: 's09-gradient', Thot, Tcold };
    return world;
  }

  const SCENES = {
    's11-mvp-box': mvpBox,
    's10-water-soup': waterSoup,
    's09-entropy-corner': entropyCorner,
    's09-gradient': tempGradient,
    's01-ideal-gas': idealGas,
    's01-open-box': openBox,
    's02-gas-collide': gasCollide,
    's02-scatter-2': scatter2,
    's02-charge-pair': chargePair,
    's04-thermal-bath': thermalBath,
    's04-radiative-cooling': radiativeCooling,
    's04-cavity': cavity,
    's12-open-cooling': openCooling,
    's12-cavity': cavityField,
    's12-stim': stimField,
    's13-gas-3d': gas3d,
    's13-collide-3d': collide3d,
    's13-bond-3d': bond3d,
    's14-methane': shapeMethane,
    's14-water': shapeWater,
    's14-linear': shapeLinear,
    's15-o2': polO2,
    's15-beh2': polBeH2,
    's15-h2o': polH2O,
    's15-field': polField,
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

  const api = { SPECIES, REAL, DPAIR_REAL, ANNEAL_SCHED, SCENES, build, idealGas, openBox, gasCollide, scatter2, chargePair, thermalBath, radiativeCooling, cavity, openCooling, cavityField, stimField, gas3d, collide3d, bond3d, shapeMethane, shapeWater, shapeLinear, polO2, polBeH2, polH2O, polField, ionLattice, ionPair, specIonMap, v1Dimer, mixedWater, quadMethane, noStab, entropyCorner, tempGradient, waterSoup, annealSoup, coolStep, mvpBox, runScenario, scenarioStep, maxwellInit };
  if (isNode) module.exports = api;
  else window.HktS0Scenes = api;
})();
