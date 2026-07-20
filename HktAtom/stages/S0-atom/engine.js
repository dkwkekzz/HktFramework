// engine.js — S0 원자 단계의 연속층 + 통 분리 장부 + tick 파이프라인 뼈대
//
// 세부 단계 ① 무대·장부. 여기서 세운 구조(자료형·장부 통·파이프라인)는
// 이후 모든 세부 단계가 "채우기만" 하고 바꾸지 않는다 (design/01-stage-ledger.md).
// 커널 형태 ⟨I 국소 교환 · M 측정 · ⇧ 출력⟩ 의 I(연속 힘) 자리와
// 이산 전이(사건 큐·접촉 샘플)의 자리를 지금 전부 판다 — ①은 힘 0·전이 0.
//
// node 와 브라우저 겸용. 외부 의존 0 (단계 5원칙: 자체 완전 모듈).

(function () {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  // ── Verlet 표류 허용치 (② 가 고정 — 이후 전 단계의 E 잔차 기준) ──
  //    대표 강성 장면(s02-gas-collide, 척력 벽) 을 dt 스캔해 |ΔE|/E ≈ C·dt² (C≈10) 측정.
  //    기본 dt=0.004 에서 max|ΔE|/E ≈ 1.9e-4 → 시드 변동 여유 두고 EPS_E=5e-4 로 고정.
  const EPS_E = 5e-4;      // 상대 에너지 표류 허용치 (기본 dt 에서)
  const DT_STIFF = 0.004;  // 척력 벽 기준 기본 dt
  const MIN_DSIGMA = 0.7;  // 겹침 문턱: min d/σ 가 이 값 아래로 내려가면 침투 (위반 0)

  // ── Vec3 — 처음부터 3성분. 2D 전용 경로는 두지 않는다 (차원은 장면이 정한다) ──
  const V = {
    make: (x = 0, y = 0, z = 0) => ({ x, y, z }),
    clone: (a) => ({ x: a.x, y: a.y, z: a.z }),
    zero: () => ({ x: 0, y: 0, z: 0 }),
    addInto: (a, b) => { a.x += b.x; a.y += b.y; a.z += b.z; return a; },
    addScaledInto: (a, b, s) => { a.x += b.x * s; a.y += b.y * s; a.z += b.z * s; return a; },
    lenSq: (a) => a.x * a.x + a.y * a.y + a.z * a.z,
    len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  };

  // ── PRNG (mulberry32) — 뷰어 재현·verify 시드 고정용. 결정론은 요구하지 않으나
  //    (KERNEL §7) 테스트에서 dt 반감을 같은 초기조건으로 비교하려면 시드가 필요하다. ──
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 박스-뮐러: 표준정규 난수 (맥스웰 초기 운동량 샘플에 사용)
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ── 사건 큐 (이진 힙) — ④ 전이 엔진이 사용. ①은 자료구조·소진 루프만 존재 ──
  //    원소: { t_fire, rowId, participants:[id...], ver } · ver 로 lazy 무효화.
  function makeQueue() {
    return { heap: [] };
  }
  function queuePush(q, ev) {
    const h = q.heap; h.push(ev);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].t_fire <= h[i].t_fire) break;
      [h[p], h[i]] = [h[i], h[p]]; i = p;
    }
  }
  function queuePop(q) {
    const h = q.heap;
    if (h.length === 0) return null;
    const top = h[0], last = h.pop();
    if (h.length > 0) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let m = i;
        if (l < h.length && h[l].t_fire < h[m].t_fire) m = l;
        if (r < h.length && h[r].t_fire < h[m].t_fire) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }

  // ── 통 분리 장부 — 0 이어도 처음부터 전 통 존재 (DESIGN §2) ──
  //    E_total = Σ(전 통) 이 시간 상수. ①은 힘 0 이라 정확 보존.
  const LEDGER_BINS = [
    'K_tr',       // Σ p²/2m (병진) — ①
    'U_elec',     // 쌍 퍼텐셜(쿨롱+척력) — ②
    'U_int',      // 들뜸 에너지 (Σocc·ε − 바닥) — ④
    'U_bond',     // 결합 우물 + 스프링 — ⑥
    'U_vib',      // 진동 — ⑦
    'U_rot',      // 회전 — ⑦
    'U_pol',      // 분극 −½Σα·E² — ⑧
    'U_grav',     // 중력 위치 E = −Σ m·g·(ĝ·r) — step-0032 (g=0 이면 0·가법)
    'E_photon',   // 방출된 복사 (④ 빈 → ⑫ 광자 입자)
    'E_nuclear',  // 예약 — ㉓~
    'E_escape',   // 열린 경계로 나간 에너지
  ];
  function makeLedger() {
    const l = {};
    for (const b of LEDGER_BINS) l[b] = 0;
    l.P_escape = V.zero();  // 탈출 입자 운동량 회계 (P 보존 검사는 P + P_escape)
    return l;
  }
  function ledgerTotal(world) {
    let s = 0;
    for (const b of LEDGER_BINS) s += world.ledger[b];
    return s;
  }

  // ── 원자·월드 생성 ──
  let _nextId = 1;
  function makeAtom(sp, r, p, q) {
    return {
      id: _nextId++,
      sp,                    // 종 id (질량·σ·ε 테이블 키) — ①은 질량만 의미
      q: q || 0,             // 전하 = Z − ne (⑤부터 ne 로 유도) · ②~④ 테스트 전하만 직접
      Z: 0,                  // 핵전하 (⑤ 이온화 회계 — 중성이면 ne=Z)
      ne: 0,                 // 속박 전자 수 (⑤) — 변하면 q·uIon 갱신
      uIon: 0,               // 이온화 배치 저장 에너지 (⑤) — U_int 에 합산
      r: V.clone(r),
      p: V.clone(p),
      F: V.zero(),           // 힘 누산 (velocity Verlet) — ①은 0
      disp: V.zero(),        // 누적 변위 (주기 랩과 무관한 참 변위) — MSD 관측용
      level: 0,              // ④ 내부 준위 인덱스 (0=바닥·1=들뜸) — 2준위 근사
      ver: 0,               // 준위 변경 버전 (사건 큐 lazy 무효화)
      occ: null,             // ③ 부껍질 벡터 (세부 이온화에서 사용)
      mu: null,              // ⑧에서 채움
    };
  }

  // 자유전자 입자 (⑤ — 연속상태 E≥0). σ≈0 → 쿨롱 softening 이 발산 방지.
  function makeElectron(r, p) {
    return { id: _nextId++, isElectron: true, q: -1, r: V.clone(r), p: V.clone(p), F: V.zero() };
  }

  // ⑫ 광자 입자 — {E, r, dir(단위), t0}. 질량 0·운동량 회계 생략(|p|=E/c_ph 미소·복사압 범위 밖).
  //   에너지는 E_photon 통이 회계(생성 +E · 흡수/탈출 −E) → Σphoton.E == E_photon 불변.
  function makePhoton(E_, r, dir, t0) {
    return { id: _nextId++, isPhoton: true, E: E_, r: V.clone(r), dir: V.clone(dir), t0: t0 || 0 };
  }

  // 등방 무작위 단위 방향 (frozenZ 면 xy 평면). 방출은 방향 정보 없음(자발) → 등방.
  function randDir(rng, frozenZ) {
    const a = 2 * Math.PI * rng();
    if (frozenZ) return V.make(Math.cos(a), Math.sin(a), 0);
    const z = 2 * rng() - 1, s = Math.sqrt(Math.max(0, 1 - z * z));
    return V.make(s * Math.cos(a), s * Math.sin(a), z);
  }

  // 전자 수 변경 → 전하·저장 에너지 갱신 (⑤). states: {ne: 저장에너지}
  function setNe(world, a, ne) {
    a.ne = ne; a.q = a.Z - ne;
    const st = world.specIon && world.specIon[a.sp];
    if (st) a.uIon = st.states[ne] != null ? st.states[ne] : 0;
  }

  function makeWorld(opts) {
    const o = opts || {};
    const w = {
      t: 0,
      dt: o.dt != null ? o.dt : 0.01,
      box: o.box || { L: V.make(20, 20, 20), bc: 'periodic' },
      frozenZ: o.frozenZ !== false,   // 기본 z 동결 (초기 검증 장면)
      mass: o.mass || { X: 1.0 },     // 종별 질량 테이블
      sigma: o.sigma || { X: 1.0 },   // 종별 상호작용 지름 (② 척력·Lorentz 혼합)
      eps: o.eps || { X: 1.0 },       // 종별 척력 세기 (② Berthelot 혼합)
      // 중력 — 규모 투명 법칙 (step-0032): 질량 비례 외부 장 F = m·g·ĝ. 질량=Σc 유도량·차폐
      // 없음이라 승격을 관통해 재측정 없이 전 규모 유효 — 세계 속성으로 어느 장면이든 켠다.
      // 기본 0: 원자 규모에서 실중력은 쿨롱 대비 ~1e-36 (기존 앵커 장면들의 물리적 참값).
      g: o.g != null ? o.g : 0,       // 세기 (무차원 노브 — 장면 규모에 맞춘다)
      gDir: o.gDir || V.make(0, 1, 0),// "아래" 단위 방향 (2D 화면 아래=+y · 3D 장면은 −y 권장)
      kc: o.kc != null ? o.kc : 1.0,  // 쿨롱 상수 (노브)
      soft: o.soft != null ? o.soft : 0.1,  // softening s (d→0 발산 방지, 노브)
      virial: 0,                      // ② 비리얼 (압력 측정) — pairForces 가 갱신
      minDsigma: Infinity,            // ② 최근접 비율 min d/σ — 겹침 감시
      rng: o.rng || Math.random,      // ④ 전이 샘플용 난수원
      catalog: o.catalog || null,     // ④ 전이 카탈로그 (행 배열) — 없으면 이산층 꺼짐
      specLevels: o.specLevels || null, // ④ 종별 {dE, g0, g1} — U_int·hazard 가 사용
      rc: o.rc != null ? o.rc : 1.5,  // ④ 접촉 반경 (노브)
      nu_col: o.nu_col != null ? o.nu_col : 1.0,   // ④ 충돌 전이 시도율 노브
      nu_abs: o.nu_abs != null ? o.nu_abs : 1.0,   // ④ 흡수율 노브
      tau_rad: o.tau_rad != null ? o.tau_rad : Infinity, // ④ 복사 수명 (∞=방출 없음)
      radiativeOpen: o.radiativeOpen || false,     // ④ 방출 광자가 즉시 탈출(냉각) vs 빈 저장(공동)
      nPhotons: 0,                    // ④ 광자 빈 (단일 종 = 스칼라 개수) — bin 모드
      // ⑫ 복사장: 빈 근사 → photon 입자. radiationMode='field' 면 R-EMI/R-ABS 가 입자를 쓴다.
      radiationMode: o.radiationMode || 'bin',     // ⑫ 'bin'(④ 스칼라)|'field'(광자 입자)
      c_ph: o.c_ph != null ? o.c_ph : 15.0,        // ⑫ 광자 전파 속도 (≈10·v_th — 실 c 아님·위계만·무차원 닮음)
      gammaLine: o.gammaLine != null ? o.gammaLine : 0.25,  // ⑫ 흡수 선폭 Γ (|E_ph−ΔE|<Γ 공명 게이트)
      photonRc: o.photonRc,           // ⑫ 광자–원자 접촉 반경 (undefined → rc)
      nu_stim: o.nu_stim,             // ⑫ 유도 방출율 (undefined → 0 = 자발 방출만)
      photonBC: o.photonBC,           // ⑫ 광자 경계 (undefined → box.bc): open→탈출·reflect→반사·periodic→랩
      specIon: o.specIon || null,     // ⑤ 종별 이온화 명세 {role, states:{ne:E}, minNe, maxNe}
      m_e: o.m_e != null ? o.m_e : 0.01,   // ⑤ 전자 질량 (노브 — 실제 1/1836 은 dt 강성, 정직 근사)
      sigma_e: o.sigma_e != null ? o.sigma_e : 0.2,  // ⑤ 전자 σ (≈0 — softening 이 발산 방지)
      eps_e: o.eps_e != null ? o.eps_e : 0.05,       // ⑤ 전자 척력 세기
      budget: o.budget || null,       // ⑥ 종별 결합차수 예산 B (③ 유도·가상 author) — 원자가 포화
      Dbond: o.Dbond != null ? o.Dbond : 2.0,   // ⑥ 결합 우물 깊이 노브 (E_bond=−D·b)
      d0: o.d0 != null ? o.d0 : 1.1,  // ⑥ 결합 평형 거리 노브
      kbond: o.kbond != null ? o.kbond : 25.0,  // ⑥ 결합 스프링 강성 노브
      nu_cplx: o.nu_cplx,             // ⑥ 복합체 형성율 (undefined → 카탈로그가 nu_col 사용)
      nu_rad: o.nu_rad,               // ⑥ 복사 안정화율 (0 이면 복사 안정화 끔)
      nu_stab: o.nu_stab,             // ⑥ 삼체 안정화율 (0 이면 삼체 끔)
      nu_diss: o.nu_diss,             // ⑥ 해리율 노브
      complexes: [],                  // ⑥ 임시 복합체 (안정화 전 — 에너지 변화 0인 자격 마커)
      atoms: [],
      electrons: [],   // ⑤ 전
      photons: [],     // ⑫ 전
      bonds: [],       // ⑥ 전 — 빈 배열로 구조만 존재
      escaped: [],     // 열린 경계로 나간 원자 (Σc 회계 유지용 — 시뮬에서는 제외)
      queue: makeQueue(),
      ledger: makeLedger(),
      computeForces: o.computeForces || zeroForces,  // ①은 F=0
    };
    w.atomById = (id) => { for (const a of w.atoms) if (a.id === id) return a; return null; };
    return w;
  }

  // ①의 힘: 없음. atom.F=0, U_elec=0. (②가 쿨롱+척력으로 교체)
  function zeroForces(world) {
    for (const a of world.atoms) { a.F.x = 0; a.F.y = 0; a.F.z = 0; }
    world.ledger.U_elec = 0;
  }

  // 최소 이미지: 주기 경계에서 성분 차를 [−L/2, L/2) 로 접는다
  function minImage(dx, L) { return dx - L * Math.round(dx / L); }

  // ── ② 연속 힘: 쿨롱 + 단거리 척력, 전 쌍 O(N²) + 최소 이미지 (DESIGN §3.2) ──
  //    V(d) = k_c·qᵢqⱼ/(d+s) + ε_rep·(σᵢⱼ/d)¹²
  //    F(i←j) = [ k_c·qᵢqⱼ/(d+s)² + 12·ε_rep·σᵢⱼ¹²/d¹³ ]·d̂   (반대칭 → P 보존은 구조가 보장)
  //    부수 측정: 비리얼(압력)·최근접 비율 min d/σᵢⱼ 를 world 에 남긴다.
  function pairForces(world) {
    const L = world.box.L, periodic = world.box.bc === 'periodic';
    const kc = world.kc, s = world.soft, frozenZ = world.frozenZ;
    // 대전체 = 원자 + 자유전자(⑤). 전자는 q=−1·작은 σ/ε (softening 이 발산 방지).
    const se = world.sigma_e != null ? world.sigma_e : 0.2, ee = world.eps_e != null ? world.eps_e : 0.05;
    // ⑳ 전자 낀 쌍 전용 softening (step-0037·세계 속성 — 부재 = 기존 s 그대로): 점전자가 강성
    //   soft(0.1) 쿨롱 특이점으로 낙하하며 r⁻¹² 벽에 catapult (실측 잔차 6e19) — ⑳ 장면이 유계
    //   힘을 쓴 이유. 반응 세계는 전자 쌍만 부드럽게 (원자 물리 불변·s20 soft 0.4 준용).
    const sE = world.soft_e != null ? world.soft_e : s;
    const B = world._bodies || (world._bodies = []);
    B.length = 0;
    for (const a of world.atoms) B.push(a);
    for (const e of world.electrons) B.push(e);
    const n = B.length;
    const sigOf = (b) => b.isElectron ? se : world.sigma[b.sp];
    const epsOf = (b) => b.isElectron ? ee : world.eps[b.sp];
    for (const b of B) { b.F.x = 0; b.F.y = 0; b.F.z = 0; }
    let U = 0, virial = 0, minRatio = Infinity;
    for (let i = 0; i < n; i++) {
      const ai = B[i], sgi = sigOf(ai), epi = epsOf(ai);
      for (let j = i + 1; j < n; j++) {
        const aj = B[j];
        let dx = ai.r.x - aj.r.x, dy = ai.r.y - aj.r.y, dz = ai.r.z - aj.r.z;
        if (periodic) {
          dx = minImage(dx, L.x); dy = minImage(dy, L.y);
          dz = frozenZ ? 0 : minImage(dz, L.z);
        }
        const d2 = dx * dx + dy * dy + dz * dz;
        const d = Math.sqrt(d2);
        const sig = (sgi + sigOf(aj)) / 2;                    // Lorentz
        const eps = Math.sqrt(epi * epsOf(aj));               // Berthelot
        const q = ai.q * aj.q;
        const invS = 1 / (d + ((ai.isElectron || aj.isElectron) ? sE : s));
        // (σ/d)¹² 곱셈 전개 — Math.pow 는 ~20× 느려 전체 verify 의 지배 비용이었다 (값 동일)
        const sr = sig / d, sr2 = sr * sr, sr4 = sr2 * sr2;
        const sr12 = sr4 * sr4 * sr4;
        U += kc * q * invS + eps * sr12;                      // 쌍 퍼텐셜 → U_elec
        const fmag = kc * q * invS * invS + 12 * eps * sr12 / d;
        const fOverD = fmag / d;
        ai.F.x += fOverD * dx; ai.F.y += fOverD * dy; ai.F.z += fOverD * dz;
        aj.F.x -= fOverD * dx; aj.F.y -= fOverD * dy; aj.F.z -= fOverD * dz;
        virial += fmag * d;
        if (!ai.isElectron && !aj.isElectron) { const r = d / sig; if (r < minRatio) minRatio = r; }
      }
    }
    // ⑥ 결합 스프링: 각 결합에 ½k(d−d0)² 우물(−D·b) — 등방 스프링(형상은 ⑭)
    if (world.bonds && world.bonds.length) {
      let Ub = 0;
      for (const bd of world.bonds) {
        const a = world.atomById(bd.i), b2 = world.atomById(bd.j);
        if (!a || !b2) continue;
        let dx = a.r.x - b2.r.x, dy = a.r.y - b2.r.y, dz = a.r.z - b2.r.z;
        if (periodic) { dx = minImage(dx, L.x); dy = minImage(dy, L.y); dz = frozenZ ? 0 : minImage(dz, L.z); }
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const fs = -bd.k * (d - bd.rest), fOverD = fs / d;
        a.F.x += fOverD * dx; a.F.y += fOverD * dy; a.F.z += fOverD * dz;
        b2.F.x -= fOverD * dx; b2.F.y -= fOverD * dy; b2.F.z -= fOverD * dz;
        Ub += 0.5 * bd.k * (d - bd.rest) * (d - bd.rest) - bondD(world, bd) * bd.order;   // 진동 + 우물(⑩ 쌍별 D)
      }
      world.ledger.U_bond = Ub;
    } else world.ledger.U_bond = 0;
    if (frozenZ) for (const b of B) b.F.z = 0;                // z 동결: 힘의 z 누수 차단
    world.ledger.U_elec = U;
    world.virial = virial;
    world.minDsigma = minRatio;
  }

  // ── 중력 외부 장 — F = m·g·ĝ (모든 개체 질량 비례 · frozenZ 면 z 성분 차단) ──
  function applyGravity(world) {
    if (!world.g) return;
    const g = world.g, gd = world.gDir, fz = world.frozenZ;
    const me = world.m_e != null ? world.m_e : 0.01;
    for (const a of world.atoms) {
      const mg = g * world.mass[a.sp];
      a.F.x += mg * gd.x; a.F.y += mg * gd.y; if (!fz) a.F.z += mg * gd.z;
    }
    for (const e of world.electrons) {
      const mg = g * me;
      e.F.x += mg * gd.x; e.F.y += mg * gd.y; if (!fz) e.F.z += mg * gd.z;
    }
  }

  // ── 법칙 스택 (step-0033) — 규칙은 무대가 배선하지 않고 세계 속성이 켠다 ──
  //    중력(applyGravity — 세계 속성 g 가 게이트)의 일반화: 연속 힘 법칙을 엔진 스택에 등록하고,
  //    각 법칙은 자신의 물리 입력(종 파라미터 테이블 — 예: alpha·Dhb)이 세계에 있을 때만 기여한다.
  //    파라미터 부재 = 기여 0 이 그 세계의 물리적 참값 (g=0 과 같은 지위) — 기존 장면 불변.
  //    computeForces 슬롯은 유지(하위 호환) — stackForces 를 꽂는 무대는 법칙 배선 코드 0.
  //    계약: 기반 pairForces 가 F 초기화·U_elec·U_bond 를 담당하고, 법칙 기여는 F 에 더하기만
  //    한다(초기화 금지·반대칭 → P 보존은 각 법칙이 보장). 실행 순서는 rank 오름차순 고정.
  const LAWS = [];
  function registerLaw(law) {   // {name, rank, active(world), force(world)} — 재등록은 교체
    const i = LAWS.findIndex((l) => l.name === law.name);
    if (i >= 0) LAWS[i] = law; else LAWS.push(law);
    LAWS.sort((a, b) => a.rank - b.rank);
  }
  //    stage 'pre' (step-0035): 힘이 아니라 *상태*를 갱신하는 법칙 (예: ⑮ QEq 전하 재분배) —
  //    기반 pairForces 가 소비할 값(a.q)을 먼저 만들어야 하므로 기반보다 앞서 실행된다.
  function stackForces(world) {
    world.ledger.U_pol = 0;                 // 법칙 소유 통 초기화 (활성 법칙이 누적한다)
    for (const l of LAWS) if (l.stage === 'pre' && l.active(world)) l.force(world);
    pairForces(world);                      // 기반 ②⑥ (F 초기화 + U_elec·U_bond)
    for (const l of LAWS) if (l.stage !== 'pre' && l.active(world)) l.force(world);
  }

  // ── 장부 갱신: K_tr(원자+전자 병진)·U_int(들뜸+이온화 저장)·U_grav(중력 위치 E).
  //    E_photon·E_escape 는 전이가 증분 ──
  function recomputeLedger(world) {
    let K = 0, Uint = 0;
    for (const a of world.atoms) {
      K += V.lenSq(a.p) / (2 * world.mass[a.sp]);
      if (a.level > 0 && world.specLevels) Uint += world.specLevels[a.sp].dE;
      Uint += a.uIon;                                    // ⑤ 이온화 저장 에너지
    }
    const me = world.m_e != null ? world.m_e : 0.01;
    for (const e of world.electrons) K += V.lenSq(e.p) / (2 * me);
    world.ledger.K_tr = K;
    world.ledger.U_int = Uint;
    let Ug = 0;                                          // U = −m·g·(ĝ·r) → F = −∇U = m·g·ĝ
    if (world.g) {
      const g = world.g, gd = world.gDir, fz = world.frozenZ;
      for (const a of world.atoms)
        Ug -= g * world.mass[a.sp] * (gd.x * a.r.x + gd.y * a.r.y + (fz ? 0 : gd.z * a.r.z));
      for (const e of world.electrons)
        Ug -= g * me * (gd.x * e.r.x + gd.y * e.r.y + (fz ? 0 : gd.z * e.r.z));
    }
    world.ledger.U_grav = Ug;
  }

  // 총 에너지 (사건 단위 회계 검사용 — K·U 재계산 + 전 통)
  function totalEnergy(world) { recomputeLedger(world); return ledgerTotal(world); }

  // ── ④ 이산층: 전이 실행기 ──

  // 준위 변경 (버전 증가 → 예약된 방출 사건 lazy 무효화)
  function setLevel(a, lvl) { if (a.level !== lvl) { a.level = lvl; a.ver++; } }

  // 상대 운동에너지 ↔ 내부 에너지 교환 (COM 운동량 불변 → P 보존). dInt>0 = KE→내부(흡열)
  function collisionalTransfer(world, i, j, dInt) {
    const a = world.atoms[i], b = world.atoms[j];
    const mi = world.mass[a.sp], mj = world.mass[b.sp], Mt = mi + mj, mu = mi * mj / Mt;
    let vx = a.p.x / mi - b.p.x / mj, vy = a.p.y / mi - b.p.y / mj, vz = a.p.z / mi - b.p.z / mj;
    const v2 = vx * vx + vy * vy + vz * vz, KE = 0.5 * mu * v2;
    const KEn = KE - dInt;
    if (KEn < 0 || KE <= 0) return false;            // 에너지 부족 → 전이 불가
    const s = Math.sqrt(KEn / KE);
    const vcx = (a.p.x + b.p.x) / Mt, vcy = (a.p.y + b.p.y) / Mt, vcz = (a.p.z + b.p.z) / Mt;
    vx *= s; vy *= s; vz *= s;
    a.p.x = mi * (vcx + (mj / Mt) * vx); a.p.y = mi * (vcy + (mj / Mt) * vy); a.p.z = mi * (vcz + (mj / Mt) * vz);
    b.p.x = mj * (vcx - (mi / Mt) * vx); b.p.y = mj * (vcy - (mi / Mt) * vy); b.p.z = mj * (vcz - (mi / Mt) * vz);
    return true;
  }

  // 상대 운동에너지 ½μ|v_rel|²
  function relKE(world, i, j) {
    const a = world.atoms[i], b = world.atoms[j];
    const mi = world.mass[a.sp], mj = world.mass[b.sp], mu = mi * mj / (mi + mj);
    const vx = a.p.x / mi - b.p.x / mj, vy = a.p.y / mi - b.p.y / mj, vz = a.p.z / mi - b.p.z / mj;
    return 0.5 * mu * (vx * vx + vy * vy + vz * vz);
  }

  // Larsen–Borgnakke 충돌 내부 교환 — 세부 균형 정확판 (볼츠만이 창발한다, author 0).
  //   충돌 총에너지 E_c = 상대KE + 표적 내부에너지. 후보 준위 k(ε_k≤E_c)를 g_k 가중으로 뽑는다.
  //   (2D 상대 병진 상태밀도 ∝ E_t⁰ 이므로 가중치는 g_k 뿐 — e^{−ΔE/T} 는 어디에도 안 적는다).
  //   뽑힌 뒤 상대 KE = E_c − ε_k 로 재조정 (COM 불변 → P 보존). 들뜸·완화는 이 한 규칙의 두 결과.
  function lbRedistribute(world, i, j) {
    const rng = world.rng;
    const tgt = rng() < 0.5 ? i : j;
    const a = world.atoms[tgt], L = world.specLevels[a.sp];
    const KE = relKE(world, i, j);
    const eOld = a.level ? L.dE : 0;
    const Ec = KE + eOld;
    let nl = 0;
    if (L.dE <= Ec) nl = (rng() < L.g1 / (L.g0 + L.g1)) ? 1 : 0;   // 에너지 충분 → g 가중 선택
    const dInt = (nl ? L.dE : 0) - eOld;                          // KE 에서 뺄 양(양수=흡열)
    if (dInt !== 0 && !collisionalTransfer(world, i, j, dInt)) return false;
    const was = a.level; setLevel(a, nl);
    if (nl === 1 && was === 0) scheduleEmission(world, a);
    return dInt !== 0 || nl !== was;
  }

  // 총 에너지 (전하 변화 반영 — 힘 재계산 포함). ⑤ 전자 이전의 쿨롱 점프 회계용.
  function energyFull(world) { world.computeForces(world); recomputeLedger(world); return ledgerTotal(world); }

  // ⑤ 전자 이전 (R-XFER): from → to 로 전자 1개. 원자부(IE−EA)+쿨롱 점프의 총 ΔE 를
  //   상대 KE 에서 회수(오르막이면 부족 시 불가·역행 동일 형식). 격자에선 마델룽으로 내리막이 된다.
  function transferElectron(world, fromIdx, toIdx) {
    const A = world.atoms[fromIdx], B = world.atoms[toIdx];
    const E0 = energyFull(world);
    const neA = A.ne, neB = B.ne;
    setNe(world, A, A.ne - 1); setNe(world, B, B.ne + 1);
    const dE = energyFull(world) - E0;            // 원자부 + 쿨롱 점프
    if (!collisionalTransfer(world, fromIdx, toIdx, dE)) {   // KE 부족(오르막) → 되돌림
      setNe(world, A, neA); setNe(world, B, neB); energyFull(world); return false;
    }
    return true;
  }

  // ── ⑥ 공유결합 유틸 ──
  function bondCount(world, id) { let s = 0; for (const b of world.bonds) if (b.i === id || b.j === id) s += b.order; return s; }
  function hasBond(world, i, j) { for (const b of world.bonds) if ((b.i === i && b.j === j) || (b.i === j && b.j === i)) return true; return false; }
  function budgetB(world, sp) { return world.budget && world.budget[sp] != null ? world.budget[sp] : 0; }
  // ⑩ 쌍별 결합 우물 깊이: world.Dpair['spA-spB'](정렬 키)가 있으면 그것, 없으면 스칼라 world.Dbond.
  //   실 결합 에너지 비율(예 H-H:O-H:O-O)을 author 하면 종류별 선호가 창발한다 (등방 우물의 ⑥ gap 해결).
  function pairD(world, sp1, sp2) {
    if (world.Dpair) { const k = sp1 <= sp2 ? sp1 + '-' + sp2 : sp2 + '-' + sp1; if (world.Dpair[k] != null) return world.Dpair[k]; }
    return world.Dbond;
  }
  const bondD = (world, bd) => (bd.D != null ? bd.D : world.Dbond);

  // 결합 형성 (안정화 완료) — 우물 −D 를 광자로 배출(복사 안정화) → 계에 결합 남음·에너지 보존.
  //   2체 직접 결합 금지는 호출부(복합체 + 안정화 경로)가 강제한다.
  function formBond(world, i, j) {
    const a = world.atomById(i), b = world.atomById(j);
    if (!a || !b) return false;
    const E0 = energyFull(world);
    world.bonds.push({ i, j, order: 1, rest: world.d0, k: world.kbond, D: pairD(world, a.sp, b.sp) });
    const dE = energyFull(world) - E0;             // ≈ −D + ½k(d−d0)²  (음수 = 방출·쌍별 D)
    world.ledger.E_photon += -dE;                  // 우물 에너지 → 복사 (P 는 빈 근사라 미보존)
    return true;
  }

  // 해리 (R-DISS) — 결합 제거. 우물 +D 를 상대 KE 에서 흡수(부족하면 불가·아레니우스가 게이트).
  function dissolveBond(world, bd) {
    const i = bd.i, j = bd.j, idx = world.bonds.indexOf(bd);
    if (idx < 0) return false;
    const E0 = energyFull(world);
    world.bonds.splice(idx, 1);
    const dE = energyFull(world) - E0;             // ≈ +D (흡열)
    const ai = world.atoms.indexOf(world.atomById(i)), aj = world.atoms.indexOf(world.atomById(j));
    if (ai < 0 || aj < 0 || !collisionalTransfer(world, ai, aj, dE)) {  // KE 부족 → 되돌림
      world.bonds.push(bd); energyFull(world); return false;
    }
    return true;
  }

  // 접촉쌍 (반경 r_c 내) — ④부터 이산 채널이 사용
  function contactPairs(world) {
    const out = [], A = world.atoms, rc2 = world.rc * world.rc;
    const L = world.box.L, per = world.box.bc === 'periodic';
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
      if (per) { dx = minImage(dx, L.x); dy = minImage(dy, L.y); dz = world.frozenZ ? 0 : minImage(dz, L.z); }
      else if (world.frozenZ) dz = 0;
      if (dx * dx + dy * dy + dz * dz <= rc2) out.push([i, j]);
    }
    return out;
  }

  const expSample = (rng, tau) => -tau * Math.log(1 - rng());

  // 방출 사건 예약 (수명 채널 — ①의 큐 뼈대 실사용). τ=∞ 면 예약 안 함.
  function scheduleEmission(world, a) {
    if (!isFinite(world.tau_rad)) return;
    queuePush(world.queue, { t_fire: world.t + expSample(world.rng, world.tau_rad), rowId: 'R-EMI', part: a.id, ver: a.ver });
  }

  // 전이 apply 를 사건 단위 장부 검사로 감싼다 (전후 E·P 차 ≤ 1e-9)
  function checkedApply(world, fn) {
    const E0 = totalEnergy(world), P0 = momentumRaw(world);
    const changed = fn();
    if (changed && world._auditP !== false) {
      const E1 = totalEnergy(world), P1 = momentumRaw(world);
      if (Math.abs(E1 - E0) > 1e-9) throw new Error(`전이 E 위반: ${E1 - E0}`);
      if (world._auditP && (Math.abs(P1.x - P0.x) > 1e-9 || Math.abs(P1.y - P0.y) > 1e-9)) throw new Error('전이 P 위반');
    }
    return changed;
  }
  function momentumRaw(world) { const P = V.zero(); for (const a of world.atoms) V.addInto(P, a.p); for (const e of world.electrons) V.addInto(P, e.p); return P; }

  // 접촉 채널 실행: 접촉쌍마다 카탈로그 행 샘플 (p=1−e^{−k·dt}), 첫 성공 후 그 쌍 종료.
  //   두 시계 중 접촉 시계 (DESIGN §4.2). 방출은 수명 시계(큐), 흡수는 빈 밀도(runAbsorption).
  function runTransitions(world) {
    if (!world.catalog) return;
    const dt = world.dt, rng = world.rng;
    const pairs = contactPairs(world);
    for (const pr of pairs) {
      for (const row of world.catalog) {
        if (row.kind !== 'contact') continue;
        const ctx = row.match(world, pr[0], pr[1]);
        if (!ctx) continue;
        const k = row.hazard(world, ctx);
        if (k > 0 && rng() < 1 - Math.exp(-k * dt)) {
          const done = checkedApply(world, () => row.apply(world, ctx));
          if (done) break;   // 한 쌍 한 tick 한 전이
        }
      }
    }
    if (world.radiationMode === 'field') runPhotonField(world);   // ⑫ 광자 입자: 흡수 + 유도 방출
    else runAbsorption(world);  // ④ R-ABS — 광자 빈 밀도. 빈이 비면 no-op
    runBonding(world);          // ⑥ 복합체 안정화·해리. budget 없으면 no-op
  }

  // ⑥ 복합체 → 안정 결합(복사|삼체) · 결합 → 해리(아레니우스). 2체 직접 결합은 구조로 금지.
  function inContact(world, a, b) {
    if (!a || !b) return false;
    let dx = a.r.x - b.r.x, dy = a.r.y - b.r.y, dz = a.r.z - b.r.z;
    const L = world.box.L;
    if (world.box.bc === 'periodic') { dx = minImage(dx, L.x); dy = minImage(dy, L.y); dz = world.frozenZ ? 0 : minImage(dz, L.z); }
    const rc = world.rc;
    return dx * dx + dy * dy + dz * dz <= rc * rc;
  }
  function localT(world, a, b) {          // 간이 T_국소 = 두 원자 병진 KE 평균 (2D 에서 ⟨KE⟩≈T)
    return (V.lenSq(a.p) / (2 * world.mass[a.sp]) + V.lenSq(b.p) / (2 * world.mass[b.sp])) / 2;
  }
  function runBonding(world) {
    if (!world.budget) return;
    const dt = world.dt, rng = world.rng;
    // 복합체 처리
    const keep = [];
    for (const cx of world.complexes) {
      const a = world.atomById(cx.i), b = world.atomById(cx.j);
      if (!a || !b || hasBond(world, cx.i, cx.j) || !inContact(world, a, b)) continue;   // 결합됨/떨어짐 → 해체
      if (bondCount(world, cx.i) >= budgetB(world, a.sp) || bondCount(world, cx.j) >= budgetB(world, b.sp)) continue;
      // R-STAB-3B: 제3체 접촉 시 삼체 안정화
      let third = null;
      for (const m of world.atoms) if (m.id !== cx.i && m.id !== cx.j && (inContact(world, a, m) || inContact(world, b, m))) { third = m; break; }
      const kstab = world.nu_stab != null ? world.nu_stab : 1.0, krad = world.nu_rad != null ? world.nu_rad : 0.4;
      if (third && rng() < 1 - Math.exp(-kstab * dt)) { checkedApply(world, () => formBond(world, cx.i, cx.j)); continue; }
      if (rng() < 1 - Math.exp(-krad * dt)) { checkedApply(world, () => formBond(world, cx.i, cx.j)); continue; }
      keep.push(cx);
    }
    world.complexes = keep;
    // R-DISS: 아레니우스 해리
    const nu = world.nu_diss != null ? world.nu_diss : 2.0;
    for (const bd of world.bonds.slice()) {
      const a = world.atomById(bd.i), b = world.atomById(bd.j);
      if (!a || !b) continue;
      const Ea = bondD(world, bd) * bd.order, T = localT(world, a, b);   // ⑩ 쌍별 D → 종류별 해리율
      const k = nu * Math.exp(-Ea / Math.max(1e-6, T));
      if (rng() < 1 - Math.exp(-k * dt)) checkedApply(world, () => dissolveBond(world, bd));
    }
  }

  // R-ABS 흡수: 바닥 원자가 광자 빈에서 흡수 (E_photon → U_int). 빈 근사 → 운동량 없음(정직 한계).
  function runAbsorption(world) {
    if (world.nPhotons <= 0 || !world.specLevels) return;
    const dt = world.dt, rng = world.rng;
    const vol = world.frozenZ ? world.box.L.x * world.box.L.y : world.box.L.x * world.box.L.y * world.box.L.z;
    for (const a of world.atoms) {
      if (world.nPhotons <= 0) break;
      if (a.level !== 0) continue;
      const k = world.nu_abs * (world.nPhotons / vol);
      if (k > 0 && rng() < 1 - Math.exp(-k * dt)) {
        checkedApply(world, () => {
          const L = world.specLevels[a.sp];
          world.nPhotons--; world.ledger.E_photon -= L.dE;
          setLevel(a, 1); scheduleEmission(world, a);
          return true;
        });
      }
    }
  }

  // ── ⑫ 복사장: 광자 입자 상호작용 (R-ABS 흡수 + R-STIM 유도 방출) ──
  //   매 tick 광자마다 근방 원자 스캔(공명 게이트 |E_ph−dE|<Γ). 흡수는 광자 소멸+원자 들뜸,
  //   유도 방출은 들뜬 원자 완화+같은 dir 새 광자(2광자 결맞음 고전 근사·씨앗 방향 증폭).
  //   에너지: E_photon 통이 회계 — 흡수 −ph.E·방출 +dE (2준위라 ph.E=dE·checkedApply 가 강제).
  function runPhotonField(world) {
    if (!world.specLevels || world.photons.length === 0) return;
    const dt = world.dt, rng = world.rng, L = world.box.L, per = world.box.bc === 'periodic';
    const rc = world.photonRc != null ? world.photonRc : world.rc, rc2 = rc * rc, gam = world.gammaLine;
    const kAbs = world.nu_abs, kStim = world.nu_stim != null ? world.nu_stim : 0;
    const near = (ph, a) => {
      let dx = ph.r.x - a.r.x, dy = ph.r.y - a.r.y, dz = ph.r.z - a.r.z;
      if (per) { dx = minImage(dx, L.x); dy = minImage(dy, L.y); dz = world.frozenZ ? 0 : minImage(dz, L.z); }
      return dx * dx + dy * dy + dz * dz <= rc2;
    };
    const src = world.photons, keep = [], born = [];   // 스냅샷 순회 — 새 광자는 born(같은 tick 재처리 금지)
    for (const ph of src) {
      const grd = [], exc = [];
      for (const a of world.atoms) {
        const Lv = world.specLevels[a.sp];
        if (!Lv || Math.abs(ph.E - Lv.dE) >= gam) continue;   // 공명 게이트
        if (near(ph, a)) (a.level === 0 ? grd : exc).push(a);
      }
      // 유도 방출 우선: 들뜬 원자 접촉 → 같은 방향 결맞음 복제 (씨앗 광자는 유지)
      if (exc.length && kStim > 0 && rng() < 1 - Math.exp(-kStim * dt)) {
        const a = exc[(rng() * exc.length) | 0];
        checkedApply(world, () => {
          const Lv = world.specLevels[a.sp];
          setLevel(a, 0);
          born.push(makePhoton(Lv.dE, a.r, ph.dir, world.t));
          world.ledger.E_photon += Lv.dE;
          if (world.spectrumAdd) world.spectrumAdd(Lv.dE);
          return true;
        });
        keep.push(ph); continue;
      }
      // 흡수: 바닥 원자 하나가 광자를 먹고 들뜸 → 광자 소멸
      if (grd.length && kAbs > 0 && rng() < 1 - Math.exp(-kAbs * dt)) {
        const a = grd[(rng() * grd.length) | 0];
        checkedApply(world, () => {
          world.ledger.E_photon -= ph.E;
          setLevel(a, 1); scheduleEmission(world, a);
          return true;
        });
        continue;   // 흡수됨 → keep 안 함
      }
      keep.push(ph);
    }
    world.photons = keep.concat(born);
  }

  // ⑫ 광자 전파: 직진 r += dir·c_ph·dt · 경계(photonBC): open→탈출(E→E_escape)·reflect→반사·periodic→랩.
  function propagatePhotons(world) {
    if (!world.photons || world.photons.length === 0) return;
    const c = world.c_ph, dt = world.dt, L = world.box.L, bc = world.photonBC || world.box.bc;
    const keep = [];
    for (const ph of world.photons) {
      ph.r.x += ph.dir.x * c * dt; ph.r.y += ph.dir.y * c * dt;
      if (!world.frozenZ) ph.r.z += ph.dir.z * c * dt;
      if (bc === 'reflect') {
        reflectPhoton(ph, 'x', L.x); reflectPhoton(ph, 'y', L.y); if (!world.frozenZ) reflectPhoton(ph, 'z', L.z);
        keep.push(ph);
      } else if (bc === 'open') {
        if (outside(ph.r, L, world.frozenZ)) { world.ledger.E_photon -= ph.E; world.ledger.E_escape += ph.E; }
        else keep.push(ph);
      } else { // periodic
        ph.r.x = wrap(ph.r.x, L.x); ph.r.y = wrap(ph.r.y, L.y); if (!world.frozenZ) ph.r.z = wrap(ph.r.z, L.z);
        keep.push(ph);
      }
    }
    world.photons = keep;
  }
  function reflectPhoton(ph, k, Lk) {
    if (ph.r[k] < 0) { ph.r[k] = -ph.r[k]; ph.dir[k] = -ph.dir[k]; }
    else if (ph.r[k] > Lk) { ph.r[k] = 2 * Lk - ph.r[k]; ph.dir[k] = -ph.dir[k]; }
  }

  // 수명 채널: 큐에서 발화한 방출 사건 처리 (lazy 무효화 검사)
  function fireEvent(world, ev) {
    if (ev.rowId !== 'R-EMI') return;
    const a = world.atomById && world.atomById(ev.part);
    if (!a || a.level !== 1 || a.ver !== ev.ver) return;   // 무효화 (완화됨·재예약됨)
    checkedApply(world, () => {
      const L = world.specLevels[a.sp];
      setLevel(a, 0);
      if (world.radiationMode === 'field') {
        // ⑫ 자발 방출 = photon 입자 (등방 무작위 dir). E_photon 통이 회계 → Σphoton.E 정합.
        world.photons.push(makePhoton(L.dE, a.r, randDir(world.rng, world.frozenZ), world.t));
        world.ledger.E_photon += L.dE;
        if (world.spectrumAdd) world.spectrumAdd(L.dE);
      } else if (world.radiativeOpen) world.ledger.E_escape += L.dE;   // ④ 열린 복사 → 즉시 탈출
      else { world.nPhotons++; world.ledger.E_photon += L.dE; if (world.spectrumAdd) world.spectrumAdd(L.dE); }
      return true;
    });
  }

  // ── 경계 처리 (원자 + 자유전자) ──
  function applyBoundary(world) {
    const L = world.box.L, bc = world.box.bc, me = world.m_e != null ? world.m_e : 0.01;
    if (bc === 'periodic') {
      for (const a of world.atoms) { a.r.x = wrap(a.r.x, L.x); a.r.y = wrap(a.r.y, L.y); if (!world.frozenZ) a.r.z = wrap(a.r.z, L.z); }
      for (const e of world.electrons) { e.r.x = wrap(e.r.x, L.x); e.r.y = wrap(e.r.y, L.y); if (!world.frozenZ) e.r.z = wrap(e.r.z, L.z); }
    } else if (bc === 'reflect') {
      for (const a of world.atoms) {
        const m = world.mass[a.sp];
        reflect1(world, a, m, 'x', L.x); reflect1(world, a, m, 'y', L.y);
        if (!world.frozenZ) reflect1(world, a, m, 'z', L.z);
      }
      for (const e of world.electrons) {
        reflect1(world, e, me, 'x', L.x); reflect1(world, e, me, 'y', L.y);
        if (!world.frozenZ) reflect1(world, e, me, 'z', L.z);
      }
    } else if (bc === 'open') {
      const keep = [];
      for (const a of world.atoms) {
        if (outside(a.r, L, world.frozenZ)) {
          world.ledger.E_escape += V.lenSq(a.p) / (2 * world.mass[a.sp]);
          V.addInto(world.ledger.P_escape, a.p); world.escaped.push(a);
        } else keep.push(a);
      }
      world.atoms = keep;
      const keepE = [];
      for (const e of world.electrons) {
        if (outside(e.r, L, world.frozenZ)) {
          world.ledger.E_escape += V.lenSq(e.p) / (2 * me);
          V.addInto(world.ledger.P_escape, e.p);
        } else keepE.push(e);
      }
      world.electrons = keepE;
    }
  }
  function wrap(x, L) { x = x % L; return x < 0 ? x + L : x; }
  // 반사 벽 — 위치 거울상 + 운동량 반전. 중력이 켜져 있으면 거울상 이동이 U_grav 를 바꾸므로
  // 그 ΔU 를 반사 성분 운동량에서 정확히 상계한다 (에너지 정확 반사 — 없으면 바닥에 깔린
  // 무거운 원자의 잦은 반사가 오버슛 오차를 랜덤워크로 누적·step-0032 실측). g=0 이면 기존 동일.
  function reflect1(world, b, m, k, L) {
    const r0 = b.r[k];
    let rNew;
    if (r0 < 0) rNew = -r0;
    else if (r0 > L) rNew = 2 * L - r0;
    else return;
    b.p[k] = -b.p[k];
    if (world.g) {
      const gd = world.gDir[k] || 0;
      if (gd) {
        const dU = -m * world.g * gd * (rNew - r0);      // U = −m·g·(ĝ·r)
        const pk2 = b.p[k] * b.p[k] - 2 * m * dU;
        if (pk2 > 0) b.p[k] = (b.p[k] < 0 ? -1 : 1) * Math.sqrt(pk2);
        // pk2 ≤ 0 (극저속·희귀): 보정 생략 — 오차는 그 1회의 dU 뿐
      }
    }
    b.r[k] = rNew;
  }
  function outside(r, L, frozenZ) {
    if (r.x < 0 || r.x > L.x || r.y < 0 || r.y > L.y) return true;
    if (!frozenZ && (r.z < 0 || r.z > L.z)) return true;
    return false;
  }

  // ── tick 파이프라인 (DESIGN §4.3) ──
  //    사건 큐 소진 → 힘 → velocity Verlet → 경계 → 접촉 전이 샘플 → 장부·측정
  function step(world) {
    drainQueue(world);          // ④ 사용 · ①은 빈 큐
    const dt = world.dt;

    // velocity Verlet: p += F dt/2 ; r += (p/m) dt ; F 재계산 ; p += F dt/2
    const me = world.m_e != null ? world.m_e : 0.01;
    world.computeForces(world);            // 첫 F (①은 0)
    applyGravity(world);                   // 외부 장 — 어느 computeForces 조합이든 법칙은 적용
    for (const a of world.atoms) V.addScaledInto(a.p, a.F, dt / 2);
    for (const e of world.electrons) V.addScaledInto(e.p, e.F, dt / 2);
    for (const a of world.atoms) {
      const m = world.mass[a.sp];
      const vx = a.p.x / m, vy = a.p.y / m, vz = a.p.z / m;
      a.r.x += vx * dt; a.r.y += vy * dt; a.r.z += vz * dt;
      a.disp.x += vx * dt; a.disp.y += vy * dt; a.disp.z += vz * dt;
    }
    for (const e of world.electrons) { e.r.x += e.p.x / me * dt; e.r.y += e.p.y / me * dt; e.r.z += e.p.z / me * dt; }
    applyBoundary(world);
    propagatePhotons(world);               // ⑫ 광자 직진 전파 + 경계 (field 모드만 실효 · 없으면 no-op)
    world.computeForces(world);            // 새 위치에서 F
    applyGravity(world);
    for (const a of world.atoms) V.addScaledInto(a.p, a.F, dt / 2);
    for (const e of world.electrons) V.addScaledInto(e.p, e.F, dt / 2);

    runTransitions(world);      // ④ 접촉 전이 샘플 + 흡수 · ①②③은 catalog 없음 → no-op
    recomputeLedger(world);

    if (world.frozenZ) assertFrozenZ(world);
    world.t += dt;
  }

  // 사건 큐 소진: 발화 시각이 지난 사건을 처리 (④ 방출) · ①②③은 빈 큐
  function drainQueue(world) {
    while (world.queue.heap.length > 0 && world.queue.heap[0].t_fire <= world.t) {
      fireEvent(world, queuePop(world.queue));
    }
  }

  // z 동결 검증: 힘의 z 성분이 수치 오염을 만들면 즉시 검출 (design §01)
  function assertFrozenZ(world) {
    for (const a of world.atoms) {
      if (Math.abs(a.r.z) > 1e-12 || Math.abs(a.p.z) > 1e-12) {
        throw new Error(`frozenZ 위반: atom#${a.id} z=${a.r.z} pz=${a.p.z}`);
      }
    }
    for (const e of world.electrons) {
      if (Math.abs(e.r.z) > 1e-12 || Math.abs(e.p.z) > 1e-12) throw new Error(`frozenZ 위반: e#${e.id}`);
    }
  }

  // 여러 tick 실행
  function run(world, ticks) {
    for (let i = 0; i < ticks; i++) step(world);
    return world;
  }

  const api = {
    EPS_E, DT_STIFF, MIN_DSIGMA,
    V, makeRng, gaussian,
    makeQueue, queuePush, queuePop,
    LEDGER_BINS, makeLedger, ledgerTotal,
    makeAtom, makeElectron, makePhoton, randDir, setNe, makeWorld, zeroForces, pairForces, minImage,
    registerLaw, stackForces,
    recomputeLedger, totalEnergy, energyFull, applyBoundary, step, run,
    setLevel, collisionalTransfer, relKE, lbRedistribute, transferElectron, contactPairs, scheduleEmission, runTransitions,
    runPhotonField, propagatePhotons,
    bondCount, hasBond, budgetB, pairD, formBond, dissolveBond, runBonding,
  };

  if (isNode) module.exports = api;
  else window.HktS0Engine = api;
})();
