// playground.js — 관찰자 샌드박스 (게임 프로토타입 · step-0029 · 엔진 diff 0)
//
// 목적: 주기율표 거의 전 원소(Z=1~118)를 ③ levels 순수 함수에서 *유도*해 종 테이블을 만들고,
// 관찰자(실험자 아바타)가 원소를 직접 소환해 상호작용(공유결합·이온 이전·분산 응집)을
// 관찰하는 열린 세계를 세운다. 물리는 전부 기존 모듈 재사용: engine(②힘·⑥결합) +
// catalog(R-CPLX·R-XFER) + polarization(⑧ 분산·유도) — 새 물리 author 0.
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
  const EA_CAP = 0.6;      // 간이 Slater EA 과대 보정 (⑤ 가상 앵커 EA_An=0.6 규모 정합 — author 노브)
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

  // ── 샌드박스 세계 — 전 원소 종 맵 + 공유(⑥)·이온(⑤)·분산(⑧) 통합 (mvpBox 동형) ──
  function buildPlayground(opts) {
    const o = opts || {};
    const L = o.L != null ? o.L : 26;
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
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.004,
      box: { L: E.V.make(L, L, L), bc: 'reflect' },   // 게임 상자: 벽 반사 (탈출 없음 → Σc 온전)
      frozenZ: true,
      mass, sigma, eps, budget,
      computeForces: Po.polForces, rng: o.rng || Math.random,
      catalog: C.COVALENT.concat(C.IONIC), specIon,
      rc: o.rc != null ? o.rc : 1.5,
      nu_col: 1.0, nu_xfer: o.nu_xfer != null ? o.nu_xfer : 3.0,
      Dbond: DREF, d0: o.d0 != null ? o.d0 : 1.15, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: 5, nu_rad: 0.5, nu_stab: 1.5, nu_diss: 2,
    });
    world.nu_xfer = o.nu_xfer != null ? o.nu_xfer : 3.0;
    world.Dpair = Dpair;
    world.alpha = alpha; world.ionizeE = IE; world.aDisp = 0.9;
    world._auditP = false;    // 복사 안정화(광자 빈)가 P 미보존 — ⑥⑩ 과 동일 (정직)
    world.pgIn = { E: 0, c: {} };   // 주입 장부: 관찰자가 넣은 Σc·E
    world._meta = { name: 'pg-sandbox', L };
    return world;
  }

  // 빈자리 탐색 — 요청 지점이 기존 원자와 겹치면(강성 척력 배치 → 적분 오차 폭발) 나선으로
  //   물러나며 min d ≥ 0.95·σ_mix 인 가장 가까운 자리를 찾는다. 소환 UX 이자 수치 안정 장치.
  function freeSpot(world, sym, x, y) {
    const L = world.box.L, sg = world.sigma[sym];
    const ok = (px, py) => {
      for (const a of world.atoms) {
        const dmin = 0.95 * (sg + world.sigma[a.sp]) / 2;
        const dx = px - a.r.x, dy = py - a.r.y;
        if (dx * dx + dy * dy < dmin * dmin) return false;
      }
      return true;
    };
    if (ok(x, y)) return { x, y };
    for (let ring = 1; ring <= 8; ring++) {
      const R = ring * 0.55, n = 6 * ring;
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n + ring * 0.5;
        const px = clamp(x + R * Math.cos(a), 0.4, L.x - 0.4), py = clamp(y + R * Math.sin(a), 0.4, L.y - 0.4);
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return null;   // 빈자리 없음 — 소환 거부 (호출부가 알림)
  }

  // ── 소환 — 관찰자의 유일한 창조 행위. 주입 E = 세계 총 E 의 실측 증분 (정확 회계) ──
  //   opts: {T 열적 지터 온도, px/py 던지기 운동량}
  function spawn(world, sym, x, y, opts) {
    const o = opts || {};
    const s = TABLE[sym];
    if (!s) throw new Error('알 수 없는 원소: ' + sym);
    const L = world.box.L;
    const spot = freeSpot(world, sym, clamp(x, 0.4, L.x - 0.4), clamp(y, 0.4, L.y - 0.4));
    if (!spot) return null;
    const E0 = E.energyFull(world);
    const a = E.makeAtom(sym, E.V.make(spot.x, spot.y, 0), E.V.zero());
    a.Z = s.ve; a.ne = s.ve; a.q = 0; a.uIon = 0;   // 중성 시작 (specIon states[ve]=0 과 일치)
    const T = o.T != null ? o.T : 0.3;
    const rng = world.rng, sd = Math.sqrt(s.mass * T);
    a.p.x = sd * E.gaussian(rng) + (o.px || 0);
    a.p.y = sd * E.gaussian(rng) + (o.py || 0);
    world.atoms.push(a);
    const E1 = E.energyFull(world);
    world.pgIn.E += E1 - E0;
    world.pgIn.c[sym] = (world.pgIn.c[sym] || 0) + 1;
    return a;
  }

  // ── 가열/냉각 펄스 — 반경 R 안 원자의 p 를 factor 배. 증감 E 는 주입 장부에 기록 ──
  function heatPulse(world, x, y, R, factor) {
    const E0 = E.totalEnergy(world);
    let n = 0;
    for (const a of world.atoms) {
      const dx = a.r.x - x, dy = a.r.y - y;
      if (dx * dx + dy * dy <= R * R) { a.p.x *= factor; a.p.y *= factor; n++; }
    }
    const E1 = E.totalEnergy(world);
    world.pgIn.E += E1 - E0;
    return n;
  }

  // ── 회계 검사 — 세계 총량(장부 전 통 합) − 주입 누계 = 0 이어야 한다 ──
  function residual(world) { return E.totalEnergy(world) - world.pgIn.E; }
  function compositionOK(world) {
    const c = {};
    for (const a of world.atoms) c[a.sp] = (c[a.sp] || 0) + 1;
    for (const a of world.escaped) c[a.sp] = (c[a.sp] || 0) + 1;
    const keys = new Set([...Object.keys(c), ...Object.keys(world.pgIn.c)]);
    for (const k of keys) if ((c[k] || 0) !== (world.pgIn.c[k] || 0)) return false;
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
      if (!groups.has(r)) groups.set(r, { comp: {}, cx: 0, cy: 0, n: 0 });
      const g = groups.get(r);
      g.comp[a.sp] = (g.comp[a.sp] || 0) + 1;
      g.cx += a.r.x; g.cy += a.r.y; g.n++;
    });
    const out = [];
    for (const g of groups.values()) {
      if (g.n < 2) continue;
      out.push({ comp: g.comp, cx: g.cx / g.n, cy: g.cy / g.n, n: g.n });
    }
    return out;
  }

  // 분자식 표기: {H:2,O:1} → 'H2O' (1 생략)
  function formula(comp) {
    return Object.keys(comp).sort().map((k) => k + (comp[k] > 1 ? comp[k] : '')).join('');
  }

  const api = {
    SYM, TABLE, BY_Z, ANCHOR, D_ANCHOR, DREF, EA_CAP,
    element, dHomo, dPair, gridPos, freeSpot,
    buildPlayground, spawn, heatPulse, residual, compositionOK,
    snapshot, diffEvents, clusters, formula,
  };
  if (isNode) module.exports = api;
  else window.HktS0Playground = api;
})();
