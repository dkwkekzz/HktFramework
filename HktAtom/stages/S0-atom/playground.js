// playground.js — 관찰자 샌드박스 (게임 프로토타입 · step-0029~0030 · 엔진 diff 0)
//
// 목적: 주기율표 거의 전 원소(Z=1~118)를 ③ levels 순수 함수에서 *유도*해 종 테이블을 만들고,
// 관찰자(실험자 아바타)가 원소를 직접 소환해 상호작용(공유결합·이온 이전·분산 응집·연소·
// 핵분열)을 관찰하는 열린 세계를 세운다. 물리는 전부 기존 모듈 재사용: engine(②힘·⑥결합) +
// catalog(R-CPLX·R-XFER) + polarization(⑧ 분산·유도) + combustion(⑱ R-ABSTRACT) — 새 물리
// author 0. step-0030 확장: 2D/3D(dim 옵션·⑬ z 해동), 항온조(열역학 실험), 중성자+핵분열
// (㉕ 동형 인월드 판·연쇄), 복셀 장 측정(field — 국소 T 열지도).
//
// step-0032 확장: 중력 — 엔진 법칙(world.g·U_grav 통)을 켜는 소비자. 법칙 자체는 engine.js
// (규모 투명 — 어느 장면이든 세계 속성으로 켠다). 여기는 토글 회계(setGravity)와 방향만 담당.
//
// 장부 원칙: 소환·가열은 "외부 주입"이다 — pgIn(주입 장부)에 Σc·E 를 기록해
// 세계 총량 − 주입 누계 ≈ 0 이 항상 성립한다 (관찰자는 회계 밖 존재가 아니라 회계된 원천).
//
// 한계 정직 (step-0029 문서에 격차 등록):
// - 간이 Slater 는 고Z 에서 IE·EA 를 과대평가 → EA 는 EA_CAP 으로 클램프(⑤ 앵커 규모 정합),
//   χ 는 [0.3,5] 클램프. 전이금속·란타넘족의 상호작용은 "경향"이지 실세계 정합 주장이 아니다.
// - 동핵 결합 깊이 D_AA 는 예산 B 프록시 author (H·O 만 ⑩ 실비 앵커) — 이핵은 폴링 식
//   D_AB=√(D_AA·D_BB)+K·Δχ² (실물리 형태 author·S0 바닥 특권).
// - 금속의 비국소 전자 풀(⑲)·핵 트랙(㉓~)은 이 샌드박스 범위 밖.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const Lv = isNode ? require('./levels.js') : window.HktS0Levels;
  const C = isNode ? require('./catalog.js') : window.HktS0Catalog;
  const Po = isNode ? require('./polarization.js') : window.HktS0Pol;
  const Cb = isNode ? require('./combustion.js') : window.HktS0Combustion;   // ⑱ 연소 (R-ABSTRACT 행)

  // ── 원소 기호 (Z=1~118) — 표기(표현층) ──
  const SYM = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn ' +
    'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd ' +
    'Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th ' +
    'Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');

  // CPK/Jmol 계열 색 (표현층 author — 물리 무관)
  const CPK = ('FFFFFF D9FFFF CC80FF C2FF00 FFB5B5 909090 3050F8 FF0D0D 90E050 B3E3F5 AB5CF2 8AFF00 ' +
    'BFA6A6 F0C8A0 FF8000 FFFF30 1FF01F 80D1E3 8F40D4 3DFF00 E6E6E6 BFC2C7 A6A6AB 8A99C7 9C7AC7 ' +
    'E06633 F090A0 50D050 C88033 7D80B0 C28F8F 668F8F BD80E3 FFA100 A62929 5CB8D1 702EB0 00FF00 ' +
    '94FFFF 94E0E0 73C2C9 54B5B5 3B9E9E 248F8F 0A7D8C 006985 C0C0C0 FFD98F A67573 668080 9E63B5 ' +
    'D47A00 940094 429EB0 57178F 00C900 70D4FF FFFFC7 D9FFC7 C7FFC7 A3FFC7 8FFFC7 61FFC7 45FFC7 ' +
    '30FFC7 1FFFC7 00FF9C 00E675 00D452 00BF38 00AB24 4DC2FF 4DA6FF 2194D6 267DAB 266696 175487 ' +
    'D0D0E0 FFD123 B8B8D0 A6544D 575961 9E4FB5 AB5C00 754F45 428296 420066 007D00 70ABFA 00BAFF ' +
    '00A1FF 008FFF 0080FF 006BFF 545CF2 785CE3 8A4FE3 A136D4 B31FD4 B31FBA B30DA6 BD0D87 C70066 ' +
    'CC0059 D1004F D90045 E00038 E6002E EB0026 EE0022 F1001E F4001A F60016 F80012 FA000E FC000A FE0006 FF0002').split(' ');

  // ⑩⑧ 이 확정한 앵커 노브(H·O·He·Ne) 는 그대로 유지 — 기존 장면과 규모 정합
  const ANCHOR = {
    H: { mass: 1.0, sigma: 1.0, alpha: 0.67 },
    O: { mass: 4.0, sigma: 1.2, alpha: 0.80 },
    He: { mass: 4.0, sigma: 1.0, alpha: 0.20 },
    Ne: { mass: 8.0, sigma: 1.1, alpha: 0.40 },
  };
  const DREF = 2.0;   // ⑩ 기준 우물 (O–H)
  const D_ANCHOR = { 'H-O': DREF, 'H-H': DREF * 436 / 463, 'O-O': DREF * 146 / 463 };  // ⑩ 실비
  // EA 클램프 — 간이 Slater EA 과대 보정. step-0031: 0.6→2.5 (⑤ 규모 정합보다 반응 체감 우선 —
  //   알칼리+음이온형 전자 이전이 ~2 규모 발열 → KE 분출이 눈에 보인다. 게임 노브·격차 등록).
  const EA_CAP = 2.5;
  const D_PAULING_K = 0.25; // 폴링 이온성 보정 계수 (author 노브)

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // ── 원소 종 유도 (③ fromZ 와 동형 — 전부 fillZ/budget/IE/EA 측정값에서) ──
  function element(Z) {
    const occ = Lv.fillZ(Z);
    let nMax = 1;
    for (const sh in occ) if (occ[sh] > 0) nMax = Math.max(nMax, +sh[0]);
    let ve = 0;   // 최외각(주양자수 최대) 전자 수 = 화학 얼굴
    for (const sh in occ) if (+sh[0] === nMax) ve += occ[sh];
    const capOuter = nMax === 1 ? 2 : 8;
    const B = Lv.budget(Z), IE = Lv.ionizationE(Z, occ), EA = Lv.affinity(Z, occ);
    const noble = (ve === capOuter && B === 0);
    // 이온 역할: 최외각 1~2개 남는 쪽이 주고(양이온형), 1~2개 모자란 쪽이 받는다(음이온형)
    let role = null;
    if (!noble) {
      if (ve <= 2 && nMax >= 2) role = 'cation';
      else if (capOuter - ve >= 1 && capOuter - ve <= 2 && EA > 0) role = 'anion';
    }
    // 질량: A≈2Z(1+Z/300) 를 √ 압축 (dt 강성 회피 — ⑩ mass 압축과 같은 취지)
    const A = Z === 1 ? 1 : 2 * Z * (1 + Z / 300);
    const an = ANCHOR[SYM[Z - 1]];
    const IEc = Math.max(IE, 0.3);
    return {
      Z, sym: SYM[Z - 1], period: nMax, ve, B, IE, EA, noble, role,
      chi: clamp((IE + Math.min(EA, IE)) / 2, 0.3, 5),          // Mulliken χ (클램프 — Slater 과대 보정)
      mass: an ? an.mass : Math.round(Math.sqrt(A) * 100) / 100,
      sigma: an ? an.sigma : Math.round((1.0 + 0.08 * (nMax - 1)) * 100) / 100,
      eps: 1.0,
      alpha: an ? an.alpha : clamp(0.67 * nMax * nMax / IEc, 0.05, 3),  // α ∝ n²/IE 경향
      color: '#' + CPK[Z - 1],
      radius: 0.30 + 0.06 * (nMax - 1),                          // 뷰어 전용
    };
  }

  // 전 원소 테이블 (기호 키 + Z 배열)
  const BY_Z = [];
  const TABLE = {};
  for (let Z = 1; Z <= 118; Z++) { const s = element(Z); BY_Z.push(s); TABLE[s.sym] = s; }

  // ── 결합 우물 D — 동핵: 예산 프록시(+⑩ 앵커) · 이핵: 폴링 식 ──
  function dHomo(s) {
    const k = s.sym + '-' + s.sym;
    if (D_ANCHOR[k] != null) return D_ANCHOR[k];
    // 예산이 클수록 깊고(다중결합 여지), 주기가 내려갈수록 얕다(궤도 확산) — author 경향
    return DREF * (0.45 + 0.12 * Math.min(s.B, 4)) / (1 + 0.15 * (s.period - 1));
  }
  function dPair(symA, symB) {
    const k = symA <= symB ? symA + '-' + symB : symB + '-' + symA;
    if (D_ANCHOR[k] != null) return D_ANCHOR[k];
    const a = TABLE[symA], b = TABLE[symB];
    const dchi = Math.min(Math.abs(a.chi - b.chi), 2.2);
    return clamp(Math.sqrt(dHomo(a) * dHomo(b)) + D_PAULING_K * dchi * dchi, 0.3, 3.2);
  }

  // ── 주기율표 배치 (뷰어 전용 데이터) — {c:1~18, r:1~7 본표 · r:9,10 f블록} ──
  function gridPos(Z) {
    if (Z === 1) return { c: 1, r: 1 };
    if (Z === 2) return { c: 18, r: 1 };
    if (Z <= 10) return Z <= 4 ? { c: Z - 2, r: 2 } : { c: Z + 8, r: 2 };
    if (Z <= 18) return Z <= 12 ? { c: Z - 10, r: 3 } : { c: Z, r: 3 };
    if (Z <= 36) return { c: Z - 18, r: 4 };
    if (Z <= 54) return { c: Z - 36, r: 5 };
    if (Z <= 56) return { c: Z - 54, r: 6 };
    if (Z <= 71) return { c: Z - 53, r: 9 };
    if (Z <= 86) return { c: Z - 68, r: 6 };
    if (Z <= 88) return { c: Z - 86, r: 7 };
    if (Z <= 103) return { c: Z - 85, r: 10 };
    return { c: Z - 100, r: 7 };
  }

  // ── 샌드박스 세계 — 전 원소 종 맵 + 공유(⑥)·이온(⑤)·분산(⑧)·연소(⑱) 통합 (mvpBox 동형) ──
  //   opts.dim: 2(기본·z 동결) | 3 (⑬ z 해동 — 같은 엔진·차원은 세계 속성)
  function buildPlayground(opts) {
    const o = opts || {};
    const L = o.L != null ? o.L : 26;
    const dim3 = o.dim === 3;
    const mass = {}, sigma = {}, eps = {}, budget = {}, alpha = {}, IE = {}, specIon = {};
    const Dpair = {};
    for (const s of BY_Z) {
      mass[s.sym] = s.mass; sigma[s.sym] = s.sigma; eps[s.sym] = s.eps;
      budget[s.sym] = s.B; alpha[s.sym] = s.alpha; IE[s.sym] = s.IE;
      if (s.role === 'cation') {
        const st = {}; st[s.ve] = 0; st[s.ve - 1] = s.IE;
        specIon[s.sym] = { role: 'cation', states: st, minNe: s.ve - 1, maxNe: s.ve };
      } else if (s.role === 'anion') {
        const st = {}; st[s.ve] = 0; st[s.ve + 1] = -Math.min(s.EA, EA_CAP);
        specIon[s.sym] = { role: 'anion', states: st, minNe: s.ve, maxNe: s.ve + 1 };
      }
    }
    for (let i = 0; i < BY_Z.length; i++) for (let j = i; j < BY_Z.length; j++) {
      const a = BY_Z[i].sym, b = BY_Z[j].sym;
      Dpair[a <= b ? a + '-' + b : b + '-' + a] = dPair(a, b);
    }
    // 중성자 종 맵 (원소 아님 — 커널 개체·q=0·B=0·작은 σ)
    mass.n = NEUTRON.mass; sigma.n = NEUTRON.sigma; eps.n = NEUTRON.eps;
    budget.n = 0; alpha.n = 0; IE.n = 0;
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'reflect' },   // 게임 상자: 벽 반사 (탈출 없음 → Σc 온전)
      frozenZ: !dim3,
      mass, sigma, eps, budget,
      computeForces: Po.polForces, rng: o.rng || Math.random,
      catalog: C.COVALENT.concat(C.IONIC).concat([Cb.R_ABSTRACT]),   // 공유+이온+연소(⑱ 라디칼 추상)
      specIon,
      rc: o.rc != null ? o.rc : 1.5,
      nu_col: 1.0, nu_xfer: o.nu_xfer != null ? o.nu_xfer : 6.0,
      Dbond: DREF, d0: o.d0 != null ? o.d0 : 1.15, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: 5, nu_rad: 0.5, nu_stab: 1.5, nu_diss: 2,
    });
    world.nu_xfer = o.nu_xfer != null ? o.nu_xfer : 6.0;
    world.Dpair = Dpair;
    world.alpha = alpha; world.ionizeE = IE; world.aDisp = 0.9;
    world._auditP = false;    // 복사 안정화(광자 빈)가 P 미보존 — ⑥⑩ 과 동일 (정직)
    world.gDir = E.V.make(0, dim3 ? -1 : 1, 0);   // "아래": 2D=+y(화면 아래)·3D=−y(지형 바닥)
    world.pgIn = { E: 0, c: {} };   // 주입 장부: 관찰자가 넣은 Σc·E
    world.pgConv = {};        // 전환 장부: 분열 U+n→파편+νn (Σc 검사 = pgIn + pgConv)
    world.pgEvents = [];      // 사건 문자열 큐 (뷰어가 소비)
    world.flashes = [];       // 핵반응 섬광 (뷰어 연출)
    world.pgFisCount = 0; world.pgFusCount = 0;
    world._meta = { name: 'pg-sandbox', L, dim: dim3 ? 3 : 2 };
    return world;
  }

  // 빈자리 탐색 — 요청 지점이 기존 원자와 겹치면(강성 척력 배치 → 적분 오차 폭발) 물러나며
  //   min d ≥ 0.95·σ_mix 인 가까운 자리를 찾는다. 소환 UX 이자 수치 안정 장치.
  //   2D(frozenZ)=나선 링 · 3D=구면 무작위 방향 (차원은 세계 속성).
  function freeSpot(world, sym, x, y, z) {
    const L = world.box.L, sg = world.sigma[sym], fz = world.frozenZ;
    z = fz ? 0 : (z != null ? z : L.z / 2);
    const ok = (px, py, pz) => {
      for (const a of world.atoms) {
        const dmin = 0.95 * (sg + world.sigma[a.sp]) / 2;
        const dx = px - a.r.x, dy = py - a.r.y, dz = fz ? 0 : pz - a.r.z;
        if (dx * dx + dy * dy + dz * dz < dmin * dmin) return false;
      }
      return true;
    };
    const cl = (v, Lk) => clamp(v, 0.4, Lk - 0.4);
    if (ok(x, y, z)) return { x, y, z };
    const rng = world.rng;
    for (let ring = 1; ring <= 8; ring++) {
      const R = ring * 0.55, n = fz ? 6 * ring : 10 * ring;
      for (let k = 0; k < n; k++) {
        let px, py, pz;
        if (fz) {
          const a = (2 * Math.PI * k) / n + ring * 0.5;
          px = cl(x + R * Math.cos(a), L.x); py = cl(y + R * Math.sin(a), L.y); pz = 0;
        } else {
          const u = 2 * rng() - 1, ph = 2 * Math.PI * rng(), s = Math.sqrt(Math.max(0, 1 - u * u));
          px = cl(x + R * s * Math.cos(ph), L.x); py = cl(y + R * s * Math.sin(ph), L.y); pz = cl(z + R * u, L.z);
        }
        if (ok(px, py, pz)) return { x: px, y: py, z: pz };
      }
    }
    return null;   // 빈자리 없음 — 소환 거부 (호출부가 알림)
  }

  // ── 소환 — 관찰자의 유일한 창조 행위. 주입 E = 세계 총 E 의 실측 증분 (정확 회계) ──
  //   opts: {T 열적 지터 온도, px/py/pz 던지기 운동량, z 3D 소환 깊이}
  //   핵연료(FISSILE)는 저장 핵에너지 Q 를 E_nuclear 통에 함께 주입 (분열이 꺼내 쓴다).
  function spawn(world, sym, x, y, opts) {
    const o = opts || {};
    const s = sym === 'n' ? NEUTRON : TABLE[sym];
    if (!s) throw new Error('알 수 없는 원소: ' + sym);
    const L = world.box.L;
    const spot = freeSpot(world, sym, clamp(x, 0.4, L.x - 0.4), clamp(y, 0.4, L.y - 0.4), o.z);
    if (!spot) return null;
    const E0 = E.energyFull(world);   // U_grav 통 포함 — 높은 곳 소환은 위치 E 만큼 비싸다
    const a = E.makeAtom(sym, E.V.make(spot.x, spot.y, spot.z), E.V.zero());
    a.Z = s.ve || 0; a.ne = s.ve || 0; a.q = 0; a.uIon = 0;   // 중성 시작 (specIon states[ve]=0 과 일치)
    if (sym === 'n') a.birth = world.t;                        // 중성자 수명 시계
    const T = o.T != null ? o.T : 0.3;
    const rng = world.rng, sd = Math.sqrt(s.mass * T);
    a.p.x = sd * E.gaussian(rng) + (o.px || 0);
    a.p.y = sd * E.gaussian(rng) + (o.py || 0);
    if (!world.frozenZ) a.p.z = sd * E.gaussian(rng) + (o.pz || 0);
    world.atoms.push(a);
    const E1 = E.energyFull(world);
    world.pgIn.E += E1 - E0;
    world.pgIn.c[sym] = (world.pgIn.c[sym] || 0) + 1;
    const fs = FISSILE[sym];
    if (fs) { world.ledger.E_nuclear += fs.Q; world.pgIn.E += fs.Q; }   // 저장 핵에너지 주입 (회계)
    if (sym === FUSION.a) { world.ledger.E_nuclear += FUSION.Q / 2; world.pgIn.E += FUSION.Q / 2; }   // 수소=융합 연료
    return a;
  }

  // ── 가열/냉각 펄스 — 반경 R 안 원자의 p 를 factor 배. 증감 E 는 주입 장부에 기록 ──
  //   VCAP: 도구 주입 속도 상한 — 점화 연타로 속도가 기하 누적되면 서브스텝 상한(48)으로도
  //   적분이 폭발한다(실측 T~1e25 — 발견). 관찰자 도구는 |v| ≤ VCAP 까지만 가열 (핵반응 방출
  //   속도 8~10 은 그대로 — 물리 아닌 도구의 한계·회계는 실측 증분이라 여전히 정확).
  function heatPulse(world, x, y, R, factor, z) {
    const E0 = E.totalEnergy(world);
    const fz = world.frozenZ;
    z = fz ? 0 : (z != null ? z : world.box.L.z / 2);
    let n = 0;
    for (const a of world.atoms) {
      const dx = a.r.x - x, dy = a.r.y - y, dz = fz ? 0 : a.r.z - z;
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      a.p.x *= factor; a.p.y *= factor; if (!fz) a.p.z *= factor;
      const m = world.mass[a.sp] || 1, v = Math.sqrt(E.V.lenSq(a.p)) / m;
      if (v > VCAP) { const s = VCAP / v; a.p.x *= s; a.p.y *= s; a.p.z *= s; }
      n++;
    }
    const E1 = E.totalEnergy(world);
    world.pgIn.E += E1 - E0;
    return n;
  }
  const VCAP = 12;   // 도구 주입 속도 상한 (서브스텝 안정 한계 안쪽)

  // ── 항온조 — 목표 T 로 부분 이완 (세기 k·호출당 배율 [0.7,1.4] 클램프). 넣고 뺀 열은 주입
  //   장부에 기록 (열역학 실험 도구 — 중성자는 제외: 빠른 중성자는 관찰 도구·문서화 한계).
  function thermostat(world, Ttar, k) {
    k = k != null ? k : 0.05;
    const E0 = E.totalEnergy(world);
    const dof = world.frozenZ ? 2 : 3;
    let K = 0, n = 0;
    for (const a of world.atoms) {
      if (a.sp === 'n') continue;
      K += E.V.lenSq(a.p) / (2 * world.mass[a.sp]); n++;
    }
    if (n === 0 || K <= 1e-12) return 0;
    const Tc = 2 * K / (n * dof);
    const s = clamp(Math.sqrt(1 + k * (Ttar / Tc - 1)), 0.7, 1.4);
    for (const a of world.atoms) {
      if (a.sp === 'n') continue;
      a.p.x *= s; a.p.y *= s; if (!world.frozenZ) a.p.z *= s;
    }
    const E1 = E.totalEnergy(world);
    world.pgIn.E += E1 - E0;
    return Tc;
  }

  // ── 중력 토글 — 법칙(F=m·g·ĝ·U_grav 장부 통)은 engine.js 의 세계 속성이다 (규모 투명 —
  //   질량=Σc 유도량·차폐 없음이라 재측정 없이 전 규모 유효). 여기서는 관찰자의 켜고 끄기만:
  //   장을 켜는 것도 회계된 행위 — 그 순간의 위치 E 증분(U_grav 통 변화)을 주입 장부에 기록.
  //   P 는 벽 반사·행성 반작용의 축약으로 비보존 (_auditP=false 와 같은 지위 — S2 본구현에서
  //   임펄스 회계). g 는 관찰자 노브 (무차원·실단위 주장 없음). 성층("무거운 건 가라앉는다")은
  //   author 0 — 오르는 비용 m·g·h 와 열운동의 경쟁에서 창발한다 (verify 32 가 측정).
  function setGravity(world, g) {
    const U0 = E.totalEnergy(world);
    world.g = g;
    world.pgIn.E += E.totalEnergy(world) - U0;
  }

  // ── 핵분열 (㉕ 동형의 인월드 판 — 가상·무차원) ──
  //   중성자 = 커널 개체 (q=0·B=0·작은 σ → 물질을 얇게 통과·핵연료와만 반응 단면).
  //   분열 행 형식은 카탈로그와 동형 {match·hazard·apply}·실행만 tick 후단 자체 실행기
  //   (원자 소멸·생성이 엔진 접촉 페어 인덱스를 흔들지 않게 — runBonding 과 같은 지위).
  //   에너지: 소환 시 U 마다 Q 를 E_nuclear 통에 저장 → 분열이 정확히 꺼내 KE 로 방출
  //   (E_nuclear −= 실측 ΔE → 총량 불변·Δm·c² 회계의 축약). Σc 는 전환 장부 pgConv 가 기록.
  const NEUTRON = { sym: 'n', ve: 0, mass: 1.0, sigma: 0.45, eps: 0.15, radius: 0.16, color: '#aeb8c4' };
  const TAU_N = 80;      // 중성자 자유 수명 (시간 단위·지나면 소멸 — 회계는 E_escape·escaped)
  const FISSILE = {      // 가상 핵연료 (author — ㉕ NuclideTable 정신: 파편 2 + ν 중성자 + Q)
    U: { frags: ['Ba', 'Kr'], nu: 2, Q: 150, nuFis: 25 },   // step-0031: Q 30→150 (열운동 ≫ 위력 체감)
  };
  // 핵융합 (㉖ 예고편·가상 무차원): 맨 H 둘이 장벽 이상의 상대 KE 로 충돌 → He + n + Q.
  //   실 D-T 처럼 중성자가 KE 대부분을 갖는다(질량 역비 분배) → 고속 중성자가 U 분열을 촉발하는
  //   커플링 창발. H 소환 시 Q/2 씩 E_nuclear 에 저장(수소=융합 연료) — 분열과 같은 저장·인출 회계.
  const FUSION = { a: 'H', b: 'H', barrier: 4.5, Q: 40, products: ['He', 'n'], nuFus: 15 };

  function fission(world, aN, aU) {
    const spec = FISSILE[aU.sp];
    if (!spec || world.ledger.E_nuclear < spec.Q * 0.5) return false;
    const saveAtoms = world.atoms.slice(), saveBonds = world.bonds.slice();
    const E0 = E.energyFull(world);   // U_grav 통 포함 (파편 질량 ≠ 연료 질량 — 위치 E 도 회계)
    const pos = E.V.clone(aU.r);
    const pTot = { x: aU.p.x + aN.p.x, y: aU.p.y + aN.p.y, z: aU.p.z + aN.p.z };
    world.atoms = world.atoms.filter((a) => a !== aU && a !== aN);
    world.bonds = world.bonds.filter((bd) => bd.i !== aU.id && bd.j !== aU.id);
    const born = [];
    const mk = (sym) => {
      const spot = freeSpot(world, sym, pos.x, pos.y, pos.z);
      if (!spot) return null;
      const s = sym === 'n' ? NEUTRON : TABLE[sym];
      const a = E.makeAtom(sym, E.V.make(spot.x, spot.y, spot.z), E.V.zero());
      a.Z = s.ve || 0; a.ne = s.ve || 0;
      if (sym === 'n') a.birth = world.t;
      world.atoms.push(a); born.push(a); return a;
    };
    const fA = mk(spec.frags[0]), fB = mk(spec.frags[1]);
    const ns = []; for (let k = 0; k < spec.nu; k++) ns.push(mk('n'));
    if (!fA || !fB || ns.some((x) => !x)) {   // 자리 없음 → 되돌림 (분열 불발)
      world.atoms = saveAtoms; world.bonds = saveBonds; E.energyFull(world); return false;
    }
    // 운동량: COM 운동 상속 (질량비 분배) + 방출쌍은 반대 방향 → P 정확 보존
    const mTot = born.reduce((s, a) => s + world.mass[a.sp], 0);
    for (const a of born) { const f = world.mass[a.sp] / mTot; a.p.x = pTot.x * f; a.p.y = pTot.y * f; a.p.z = pTot.z * f; }
    const axis = { x: fB.r.x - fA.r.x, y: fB.r.y - fA.r.y, z: fB.r.z - fA.r.z };
    const al = Math.hypot(axis.x, axis.y, axis.z) || 1;
    axis.x /= al; axis.y /= al; axis.z /= al;
    const mA = world.mass[fA.sp], mB = world.mass[fB.sp];
    const pf = Math.sqrt(0.7 * spec.Q * 2 * mA * mB / (mA + mB));      // 파편쌍 KE = 0.7Q
    fA.p.x -= axis.x * pf; fA.p.y -= axis.y * pf; fA.p.z -= axis.z * pf;
    fB.p.x += axis.x * pf; fB.p.y += axis.y * pf; fB.p.z += axis.z * pf;
    const perp = world.frozenZ ? { x: -axis.y, y: axis.x, z: 0 } : (() => {   // 수직축 (중성자쌍)
      const u = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      const c = { x: axis.y * u.z - axis.z * u.y, y: axis.z * u.x - axis.x * u.z, z: axis.x * u.y - axis.y * u.x };
      const cl2 = Math.hypot(c.x, c.y, c.z) || 1; return { x: c.x / cl2, y: c.y / cl2, z: c.z / cl2 };
    })();
    const pnEach = Math.sqrt(0.3 * spec.Q * NEUTRON.mass);   // 각 중성자 KE=0.15Q·쌍 반대 → P 보존
    ns[0].p.x += perp.x * pnEach; ns[0].p.y += perp.y * pnEach; ns[0].p.z += perp.z * pnEach;
    ns[1].p.x -= perp.x * pnEach; ns[1].p.y -= perp.y * pnEach; ns[1].p.z -= perp.z * pnEach;
    const E1 = E.energyFull(world);
    world.ledger.E_nuclear -= (E1 - E0);   // 방출 KE + 배치 ΔU 를 저장 핵에너지가 지불 — 총량 불변
    // 전환 장부: U + n → 파편 + ν n (Σc 검사는 pgIn + pgConv 합산)
    const cv = world.pgConv;
    cv[aU.sp] = (cv[aU.sp] || 0) - 1; cv.n = (cv.n || 0) - 1 + spec.nu;
    cv[spec.frags[0]] = (cv[spec.frags[0]] || 0) + 1; cv[spec.frags[1]] = (cv[spec.frags[1]] || 0) + 1;
    world.pgFisCount++;
    world.flashes.push({ x: pos.x, y: pos.y, z: pos.z, t: world.t });
    world.pgEvents.push(`☢ 핵분열! ${aU.sp} + n → ${spec.frags[0]} + ${spec.frags[1]} + ${spec.nu}n (+Q=${spec.Q})`);
    return true;
  }

  // 핵융합 apply: 맨 H 둘 → He + n. 분열과 같은 패턴 (COM 상속 + 방출쌍 반대 → P 정확·
  //   E_nuclear −= 실측 ΔE → 총량 불변). 중성자가 KE 대부분(질량 역비)을 갖는다.
  function fuse(world, a1, a2) {
    if (world.ledger.E_nuclear < FUSION.Q * 0.5) return false;
    const saveAtoms = world.atoms.slice();
    const E0 = E.energyFull(world);
    const pos = { x: (a1.r.x + a2.r.x) / 2, y: (a1.r.y + a2.r.y) / 2, z: (a1.r.z + a2.r.z) / 2 };
    const pTot = { x: a1.p.x + a2.p.x, y: a1.p.y + a2.p.y, z: a1.p.z + a2.p.z };
    world.atoms = world.atoms.filter((a) => a !== a1 && a !== a2);
    const born = [];
    const mk = (sym) => {
      const spot = freeSpot(world, sym, pos.x, pos.y, pos.z);
      if (!spot) return null;
      const s = sym === 'n' ? NEUTRON : TABLE[sym];
      const a = E.makeAtom(sym, E.V.make(spot.x, spot.y, spot.z), E.V.zero());
      a.Z = s.ve || 0; a.ne = s.ve || 0;
      if (sym === 'n') a.birth = world.t;
      world.atoms.push(a); born.push(a); return a;
    };
    const pA = mk(FUSION.products[0]), pB = mk(FUSION.products[1]);
    if (!pA || !pB) { world.atoms = saveAtoms; E.energyFull(world); return false; }
    const mTot = born.reduce((s, a) => s + world.mass[a.sp], 0);
    for (const a of born) { const f = world.mass[a.sp] / mTot; a.p.x = pTot.x * f; a.p.y = pTot.y * f; a.p.z = pTot.z * f; }
    const ax = { x: pB.r.x - pA.r.x, y: pB.r.y - pA.r.y, z: pB.r.z - pA.r.z };
    const al = Math.hypot(ax.x, ax.y, ax.z) || 1;
    const mA = world.mass[pA.sp], mB = world.mass[pB.sp];
    const pf = Math.sqrt(FUSION.Q * 2 * mA * mB / (mA + mB));          // 쌍 KE = Q (질량 역비 분배)
    pA.p.x -= ax.x / al * pf; pA.p.y -= ax.y / al * pf; pA.p.z -= ax.z / al * pf;
    pB.p.x += ax.x / al * pf; pB.p.y += ax.y / al * pf; pB.p.z += ax.z / al * pf;
    const E1 = E.energyFull(world);
    world.ledger.E_nuclear -= (E1 - E0);
    const cv = world.pgConv;
    cv[FUSION.a] = (cv[FUSION.a] || 0) - 2;
    cv[FUSION.products[0]] = (cv[FUSION.products[0]] || 0) + 1;
    cv[FUSION.products[1]] = (cv[FUSION.products[1]] || 0) + 1;
    world.pgFusCount++;
    world.flashes.push({ x: pos.x, y: pos.y, z: pos.z, t: world.t });
    world.pgEvents.push(`☀ 핵융합! H + H → He + n (+Q=${FUSION.Q}·중성자가 KE 대부분)`);
    return true;
  }

  // 핵 실행기 — tick 후단. 분열(접촉 n+핵연료)·융합(맨 H 쌍·장벽 게이트)·중성자 수명 처리.
  function runNuclear(world) {
    const dt = world.dt, rng = world.rng, rc2 = world.rc * world.rc, fz = world.frozenZ;
    // 중성자 수명: τ 지나면 소멸 — escaped 로 회계 (Σc)·KE 는 E_escape 로 (E)
    for (const a of world.atoms.slice()) {
      if (a.sp !== 'n' || world.t - a.birth < TAU_N) continue;
      world.atoms.splice(world.atoms.indexOf(a), 1);
      world.ledger.E_escape += E.V.lenSq(a.p) / (2 * NEUTRON.mass);
      E.V.addInto(world.ledger.P_escape, a.p);
      world.escaped.push(a);
      world.pgEvents.push('중성자 소멸 (수명 τ=' + TAU_N + ')');
    }
    // 분열 샘플 (사본 순회 — apply 가 배열을 바꾼다)
    const atoms = world.atoms.slice();
    for (const aN of atoms) {
      if (aN.sp !== 'n' || world.atoms.indexOf(aN) < 0) continue;
      for (const aU of atoms) {
        if (!FISSILE[aU.sp] || world.atoms.indexOf(aU) < 0) continue;
        const dx = aN.r.x - aU.r.x, dy = aN.r.y - aU.r.y, dz = fz ? 0 : aN.r.z - aU.r.z;
        if (dx * dx + dy * dy + dz * dz > rc2) continue;
        const k = FISSILE[aU.sp].nuFis;
        if (rng() < 1 - Math.exp(-k * dt)) { if (fission(world, aN, aU)) break; }
      }
    }
    // 융합 샘플: 맨(비결합) H 쌍이 접촉 + 상대 KE ≥ 장벽 (쿨롱 장벽의 게이트 근사 — 터널링은 ㉖)
    for (let i = 0; i < atoms.length; i++) {
      const a1 = atoms[i];
      if (a1.sp !== FUSION.a || world.atoms.indexOf(a1) < 0 || E.bondCount(world, a1.id) > 0) continue;
      for (let j = i + 1; j < atoms.length; j++) {
        const a2 = atoms[j];
        if (a2.sp !== FUSION.b || world.atoms.indexOf(a2) < 0 || E.bondCount(world, a2.id) > 0) continue;
        const dx = a1.r.x - a2.r.x, dy = a1.r.y - a2.r.y, dz = fz ? 0 : a1.r.z - a2.r.z;
        if (dx * dx + dy * dy + dz * dz > rc2) continue;
        const m = world.mass[FUSION.a], mu = m / 2;
        const vx = (a1.p.x - a2.p.x) / m, vy = (a1.p.y - a2.p.y) / m, vz = (a1.p.z - a2.p.z) / m;
        if (0.5 * mu * (vx * vx + vy * vy + vz * vz) < FUSION.barrier) continue;   // 장벽 미달
        if (rng() < 1 - Math.exp(-FUSION.nuFus * dt)) { if (fuse(world, a1, a2)) break; }
      }
    }
  }
  const runFission = runNuclear;   // 하위 호환 별칭

  // 편의 tick — 엔진 step + 핵 실행기 (뷰어·verify 공용).
  //   적응 서브스텝: 핵반응 파편·중성자(고 KE)가 r⁻¹² 척력 벽을 한 tick 에 관통하면 적분이
  //   폭발한다(실측 잔차 1e37 — 발견). 최고 속도 기준으로 dt 를 쪼개 같은 물리를 촘촘히 적분
  //   (이동 ≤ 0.01/서브스텝·상한 40). hazard 는 world.dt 를 읽으므로 통계적으로 동등.
  function tick(world) {
    let v2max = 0;
    for (const a of world.atoms) {
      const m = world.mass[a.sp] || 1;
      const v2 = E.V.lenSq(a.p) / (m * m);
      if (v2 > v2max) v2max = v2;
    }
    const sub = Math.min(48, Math.max(1, Math.ceil(Math.sqrt(v2max) * world.dt / 0.006)));
    if (sub === 1) E.step(world);
    else {
      const dt0 = world.dt;
      world.dt = dt0 / sub;
      for (let i = 0; i < sub; i++) E.step(world);
      world.dt = dt0;
    }
    runNuclear(world);
  }

  // ── 회계 검사 — 세계 총량(장부 전 통 합 · U_grav 포함) − 주입 누계 = 0 이어야 한다 ──
  function residual(world) { return E.totalEnergy(world) - world.pgIn.E; }
  function compositionOK(world) {
    const c = {};
    for (const a of world.atoms) c[a.sp] = (c[a.sp] || 0) + 1;
    for (const a of world.escaped) c[a.sp] = (c[a.sp] || 0) + 1;
    const cv = world.pgConv || {};
    const keys = new Set([...Object.keys(c), ...Object.keys(world.pgIn.c), ...Object.keys(cv)]);
    for (const k of keys) if ((c[k] || 0) !== (world.pgIn.c[k] || 0) + (cv[k] || 0)) return false;
    return true;
  }

  // ── 사건 피드 — 결합·전하 스냅샷 diff (엔진 훅 0 · 관찰만) ──
  function snapshot(world) {
    const bonds = {};
    for (const bd of world.bonds) bonds[bd.i < bd.j ? bd.i + '-' + bd.j : bd.j + '-' + bd.i] = bd.order;
    const q = {};
    for (const a of world.atoms) if (a.q !== 0) q[a.id] = a.q;
    return { bonds, q };
  }
  function diffEvents(world, prev) {
    const now = snapshot(world), ev = [];
    const symOf = (id) => { const a = world.atomById(id); return a ? a.sp : '?'; };
    for (const k in now.bonds) if (!(k in prev.bonds)) {
      const p = k.split('-'); ev.push({ kind: 'bond+', msg: `결합 형성 ${symOf(+p[0])}–${symOf(+p[1])}` });
    }
    for (const k in prev.bonds) if (!(k in now.bonds)) {
      const p = k.split('-'); ev.push({ kind: 'bond-', msg: `해리 ${symOf(+p[0])}–${symOf(+p[1])}` });
    }
    for (const id in now.q) if (!(id in prev.q)) ev.push({ kind: 'ion', msg: `이온화 ${symOf(+id)}${now.q[id] > 0 ? '⁺' : '⁻'} (전자 이전)` });
    for (const id in prev.q) if (!(id in now.q)) ev.push({ kind: 'ion0', msg: `중성 복귀 ${symOf(+id)}` });
    return { snap: now, events: ev };
  }

  // ── 클러스터(결합 그래프 연결 성분) — 뷰어 분자식 라벨용. 창발=측정 (라벨 author 0) ──
  function clusters(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds) {
      const ia = idx.get(bd.i), ib = idx.get(bd.j);
      if (ia != null && ib != null) par[find(ia)] = find(ib);
    }
    const groups = new Map();
    world.atoms.forEach((a, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, { comp: {}, cx: 0, cy: 0, cz: 0, n: 0 });
      const g = groups.get(r);
      g.comp[a.sp] = (g.comp[a.sp] || 0) + 1;
      g.cx += a.r.x; g.cy += a.r.y; g.cz += a.r.z; g.n++;
    });
    const out = [];
    for (const g of groups.values()) {
      if (g.n < 2) continue;
      out.push({ comp: g.comp, cx: g.cx / g.n, cy: g.cy / g.n, cz: g.cz / g.n, n: g.n });
    }
    return out;
  }

  // ── 복셀 장 측정 — 공간을 nc³(2D: nc²) 셀로 나눠 국소 상태(입자 수·T_국소)를 잰다.
  //   T_국소 = 셀 내 병진 KE 평균 (2·ΣKE / (dof·n)) — 가열·폭발·냉각이 "장"으로 보인다. 측정 전용.
  function field(world, nc) {
    nc = nc || 13;
    const L = world.box.L, fz = world.frozenZ, dof = fz ? 2 : 3;
    const hx = L.x / nc, hy = L.y / nc, hz = fz ? 1 : L.z / nc;
    const map = new Map();
    for (const a of world.atoms) {
      const ix = clamp(Math.floor(a.r.x / hx), 0, nc - 1);
      const iy = clamp(Math.floor(a.r.y / hy), 0, nc - 1);
      const iz = fz ? 0 : clamp(Math.floor(a.r.z / hz), 0, nc - 1);
      const key = ix + nc * (iy + nc * iz);
      let c = map.get(key);
      if (!c) { c = { ix, iy, iz, n: 0, K: 0 }; map.set(key, c); }
      c.n++; c.K += E.V.lenSq(a.p) / (2 * world.mass[a.sp]);
    }
    const cells = [];
    for (const c of map.values()) {
      cells.push({
        ix: c.ix, iy: c.iy, iz: c.iz, n: c.n,
        cx: (c.ix + 0.5) * hx, cy: (c.iy + 0.5) * hy, cz: fz ? 0 : (c.iz + 0.5) * hz,
        T: 2 * c.K / (dof * c.n),
      });
    }
    return { nc, hx, hy, hz, cells };
  }

  // 분자식 표기: {H:2,O:1} → 'H2O' (1 생략)
  function formula(comp) {
    return Object.keys(comp).sort().map((k) => k + (comp[k] > 1 ? comp[k] : '')).join('');
  }

  const api = {
    SYM, TABLE, BY_Z, ANCHOR, D_ANCHOR, DREF, EA_CAP,
    NEUTRON, FISSILE, FUSION, TAU_N, VCAP,
    element, dHomo, dPair, gridPos, freeSpot,
    buildPlayground, spawn, heatPulse, thermostat, residual, compositionOK,
    setGravity,
    fission, fuse, runFission, runNuclear, tick, field,
    snapshot, diffEvents, clusters, formula,
  };
  if (isNode) module.exports = api;
  else window.HktS0Playground = api;
})();
