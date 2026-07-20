// playground.js — 관찰자 샌드박스 (게임 프로토타입 · step-0029~0038)
//
// 목적: 주기율표 거의 전 원소(Z=1~118)를 ③ levels 순수 함수에서 *유도*해 종 테이블을 만들고,
// 관찰자(실험자 아바타)가 원소를 직접 소환해 전 현상을 관찰하는 열린 세계를 세운다. 새 물리
// author 0 — 전부 기존 모듈의 무대 독립 소비:
// - 연속 힘 = 엔진 **법칙 스택** (step-0033~36): 기반 pairForces + ⑮ qeq(pre)·⑧ pol·⑭ angle·
//   ⑯ hb·⑰ solv — 이 파일은 세계 속성(qeqParams·alpha·valence·Dhb/hbAcc·protSolv 등)만 싣는다.
// - 이산 전이 = 카탈로그 행: R-CPLX(⑥)·R-XFER(⑤)·R-ABSTRACT(⑱)·R-ION/R-REC3(⑳ 자유전자
//   개체·step-0037) + tick 후단 실행기: runNuclear(㉕ 분열·㉖ 융합 인월드 판)·runProton(⑰).
// - ⑫ 복사장(광자 개체·step-0038): specLevels(종별 첫 들뜸 dE — ③ IE 유도)는 base 상시 탑재
//   (물리 파라미터·부재=참값)이나, 들뜸 원천 R-COL·광자 field 모드는 enableRadiation 관찰
//   프리셋(💡)이 켠다 — 전자 들뜸은 화학 온도(dE≫kT)에서 무시할 수 있고 결합 동역학과의 적분
//   결합이 취약(완화가 근-영 상대 KE 로 카타펄트)하므로 고에너지 발광 프리셋 전용 (enableHBond 지위).
// - 세계 속성 법칙: 중력 g(step-0032)·차원 dim(⑬)·soft_e(전자 쌍 연화·⑳).
// 도구: 항온조·가열 펄스·복셀 장(field)·2D/3D·관찰자 소환.
//
// 장부 원칙: 소환·가열은 "외부 주입"이다 — pgIn(주입 장부)에 Σc·E 를 기록해
// 세계 총량 − 주입 누계 ≈ 0 이 항상 성립한다 (관찰자는 회계 밖 존재가 아니라 회계된 원천).
// 전하: 정수층(ne·⑤⑰⑳ 소유·chargeOK Σq=n_e) + 연속층(⑮ QEq dq) 이원 회계.
//
// 한계 정직 (step-0029~0037 문서에 격차 등록):
// - 간이 Slater 는 고Z 에서 IE·EA 를 과대평가 → EA_CAP·χ [0.3,5] 클램프. 전이금속·란타넘족은
//   "경향"이지 실세계 정합 주장이 아니다. 동핵 D 는 예산 프록시(H·O 만 ⑩ 실비 앵커)·이핵은 폴링 식.
// - ⑳ 사건-적분 커플링 드리프트 ~1e-2/사건 (step-0037 격차) · ⑭ 준정적 드리프트 (PG·회계 상대화).
// - ⑫ dE=clamp(0.75·IE,0.4,3.0) 는 첫 들뜸 *프록시*(수소형 n=1→2 Rydberg 분율 3/4·클램프는
//   EA_CAP 지위 격차) — 알칼리 실비(~0.4·IE)의 종별 편차는 단일 프록시가 잃는다 (step-0038 격차).
// - 미합류: ⑲ 금속 전자 풀 (개체 3/3·별도 설계).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const Lv = isNode ? require('./levels.js') : window.HktS0Levels;
  const C = isNode ? require('./catalog.js') : window.HktS0Catalog;
  const Po = isNode ? require('./polarization.js') : window.HktS0Pol;        // 로드 = pol 법칙 등록 (스택)
  const Cb = isNode ? require('./combustion.js') : window.HktS0Combustion;   // ⑱ 연소 (R-ABSTRACT 행)
  const HB = isNode ? require('./hbond.js') : window.HktS0HBond;             // 로드 = hb 법칙 등록 (스택)
  const Geo = isNode ? require('./geometry.js') : window.HktS0Geometry;      // 로드 = angle 법칙 등록 (스택)
  const Pol = isNode ? require('./polarity.js') : window.HktS0Polarity;      // 로드 = qeq 법칙 등록 (스택)
  const AB = isNode ? require('./acidbase.js') : window.HktS0AcidBase;       // 로드 = solv 법칙 등록 (⑰)
  const Iz = isNode ? require('./ionized.js') : window.HktS0Ionized;         // ⑳ R-ION/R-REC3 행 (플라스마)

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
  // ⑫ 첫 들뜸 에너지 프록시 (step-0038): dE = clamp(F_EXC·IE, DE_MIN, DE_MAX). 수소형 n=1→2
  //   Rydberg 갭 = IE·(1−1/4) 에서 F_EXC=0.75. 클램프는 간이 Slater IE 편차 보정(EA_CAP 지위 격차).
  //   g0/g1 = 바닥(s형)·첫 들뜸(p형 3중항) 축약 — 종별 세부 축퇴는 프록시가 잃는다.
  const F_EXC = 0.75, DE_MIN = 0.4, DE_MAX = 3.0, G0_EXC = 1, G1_EXC = 3;
  function excitationDE(s) { return clamp(F_EXC * s.IE, DE_MIN, DE_MAX); }

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
    const mass = {}, sigma = {}, eps = {}, budget = {}, alpha = {}, IE = {}, specIon = {}, valence = {};
    const Dpair = {};
    for (const s of BY_Z) {
      mass[s.sym] = s.mass; sigma[s.sym] = s.sigma; eps[s.sym] = s.eps;
      budget[s.sym] = s.B; alpha[s.sym] = s.alpha; IE[s.sym] = s.IE;
      valence[s.sym] = s.ve;   // ⑭ 외각 전자 맵 — angle 법칙의 물리 입력 (고립쌍 수 유도)
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
      computeForces: E.stackForces, rng: o.rng || Math.random,   // 법칙 스택 — 배선 0 (step-0033)
      // 공유+이온+연소(⑱)+플라스마(⑳ R-ION 충돌 이온화·R-REC3 3체 재결합 — step-0037).
      //   ⑳ 은 저온에선 에너지 가드(IE 문턱)가 저절로 잠근다 — 상시 탑재 = 참값.
      catalog: C.COVALENT.concat(C.IONIC).concat([Cb.R_ABSTRACT]).concat(Iz.PLASMA),
      m_e: 0.5,                                                  // 전자 질량 노브 (⑳ 준용 — dt 강성 회피·정직 근사)
      specIon,
      rc: o.rc != null ? o.rc : 1.5,
      nu_col: 1.0, nu_xfer: o.nu_xfer != null ? o.nu_xfer : 6.0,
      Dbond: DREF, d0: o.d0 != null ? o.d0 : 1.15, kbond: o.kbond != null ? o.kbond : 25,
      nu_cplx: 5, nu_rad: 0.5, nu_stab: 1.5, nu_diss: 2,
    });
    world.nu_xfer = o.nu_xfer != null ? o.nu_xfer : 6.0;
    world.Dpair = Dpair;
    world.alpha = alpha; world.ionizeE = IE; world.aDisp = 0.9;   // → 스택의 pol 법칙(⑧)이 활성
    // ⑯ H-결합 법칙도 상시 탑재 (step-0033) — 세계 속성만 싣는다: Dhb(세기)·hbAcc(수용체 종).
    //   playground 는 a.Z=최외각 관례라 Z=8 게이트 대신 종 기호 게이트를 쓴다 (hbond donGate/accGate).
    //   물 분자가 생기면 어느 프리셋에서든 H-결합 네트워크가 저절로 창발한다 — 모드 전환 0.
    world.Dhb = 0.9; world.hbAcc = { O: true };
    // ⑭ 각도(형상) 법칙 상시 탑재 (step-0034) — 물리 입력 = 외각 전자 맵. 결합이 2개 이상
    //   생긴 원자에 전자쌍 도메인 공통 반발이 걸려 굽음·직선이 창발한다 (분자별 목표각 author 0).
    valence.n = 0;   // 중성자: 전자 없음 (도메인 0)
    world.valence = valence;
    // ⑮ 극성(QEq) 법칙 상시 탑재 (step-0035) — 물리 입력 = 종별 {χ, IE} 테이블 (③ 유도).
    //   분자(연결 성분)마다 전기음성도 균등화로 부분 전하가 재분배된다 — H₂O 의 O δ⁻·H δ⁺ 창발.
    //   ⑤ 통일: qeqFromNe — 정수층 qBase = Z−ne (R-XFER 가 바꾼다) 위에 연속층이 재분배.
    //   단원자 성분은 QEq 건너뜀 (맨 이온의 ⑤ 에너지학 정확 보존 — polarity.js 주석).
    const qeqParams = {};
    for (const s of BY_Z) qeqParams[s.sym] = { chi: s.chi, IE: s.IE };
    qeqParams.n = { chi: 0, IE: 1 };   // 중성자: 전하 없음 (단원자라 어차피 건너뜀)
    world.qeqParams = qeqParams; world.qeqFromNe = true;
    // ⑰ 산·염기 상시 탑재 (step-0036) — 양성자 이전(R-PROT·tick 후단 실행기)의 종 게이트.
    //   protSolv(용매화 노브)는 기본 0 = 유전 차폐 없음이 이 모델의 참값 (자동 이온화는 동결·
    //   릴레이·재결합은 산다) — 관찰 프리셋이 노브를 켠다 (⑰ 정직 노브·design/17).
    world.protAcc = { O: true };       // 수용체 종 (고립쌍 보유)
    world.protCoord = { O: 3 };        // O 배위 상한 (배위 결합 1 여유 = H₃O⁺ 까지·H₄O²⁺ 금지)
    world.nu_prot = o.nu_prot != null ? o.nu_prot : 1.0;
    world.pgProtCount = 0;             // 양성자 이전 누계 (뷰어·verify 계수)
    // ⑳ 플라스마 노브 (step-0037) — R-ION/R-REC3 행의 물리 입력 (specIon 은 ⑤ 것 공유).
    //   문턱은 hazard 가 아니라 에너지 가드 (IE + 쿨롱 점프를 상대 KE 에서만) — 노브는 시도율.
    // 전자 = 순수 연화 쿨롱 개체 (⑳ 유계 정신): eps_e=0 → r⁻¹² 벽 없음 + soft_e 로 특이점 제거
    //   → 퍼텐셜이 유한 깊이(−kc/soft_e)로 유계 — 점전자 catapult(실측 잔차 1e32) 원천 봉쇄.
    world.dEsc = 1.5; world.rcRec = 1.5; world.soft_e = 0.45; world.eps_e = 0;
    world.nu_ion = o.nu_ion != null ? o.nu_ion : 12;
    world.nu_rec = o.nu_rec != null ? o.nu_rec : 40;
    // ⑫ specLevels 상시 탑재 (step-0038) — 종별 첫 들뜸 {dE, g0, g1} (③ IE 유도). 물리 파라미터의
    //   존재일 뿐 활성이 아니다: 들뜸 원천(R-COL)·field 모드는 enableRadiation(💡)이 켠다. 원천이
    //   없으면 어느 원자도 들뜨지 않아 U_int 기여 0 = 참값 (부재=참값·kernel §3.1). 중성자는 제외.
    const specLevels = {};
    for (const s of BY_Z) specLevels[s.sym] = { dE: excitationDE(s), g0: G0_EXC, g1: G1_EXC };
    world.specLevels = specLevels;
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
    const me = world.m_e != null ? world.m_e : 0.5;
    let K = 0, n = 0;
    for (const a of world.atoms) {
      if (a.sp === 'n') continue;
      K += E.V.lenSq(a.p) / (2 * world.mass[a.sp]); n++;
    }
    for (const el of world.electrons) { K += E.V.lenSq(el.p) / (2 * me); n++; }   // ⑳ 자유전자 포함
    if (n === 0 || K <= 1e-12) return 0;
    const Tc = 2 * K / (n * dof);
    const s = clamp(Math.sqrt(1 + k * (Ttar / Tc - 1)), 0.7, 1.4);
    for (const a of world.atoms) {
      if (a.sp === 'n') continue;
      a.p.x *= s; a.p.y *= s; if (!world.frozenZ) a.p.z *= s;
    }
    for (const el of world.electrons) { el.p.x *= s; el.p.y *= s; if (!world.frozenZ) el.p.z *= s; }
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
    // ⑳ 자유전자 (step-0037): 가볍고 빠르다 — 강성 스캔에 포함해야 서브스텝이 잡는다
    const me = world.m_e != null ? world.m_e : 0.5;
    for (const el of world.electrons) {
      const v2 = E.V.lenSq(el.p) / (me * me);
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
    // ⑰ 양성자 이전 (step-0036) — tick 후단 실행기 (runNuclear 와 같은 지위)
    const np = AB.runProton(world);
    if (np) {
      world.pgProtCount = (world.pgProtCount || 0) + np;
      world.pgEvents.push('⚡ 양성자 이전 (H⁺ 가 결합을 갈아탐 — 산·염기)');
    }
  }

  // ── ⑯ 수소 결합 정관찰 모드 — 안정 물 네트워크 실험 환경 ──
  //   step-0033: H-결합 *법칙*은 이제 스택 상시(Dhb·hbAcc 세계 속성) — 여기서는 힘을 갈아끼우지
  //   않는다. 이 함수는 "네트워크만 조용히 관찰"할 실험 환경 노브만 조정한다 (관찰자 도구).
  //   design/16: V_hb = −D_hb·w(d)·(û_DH·û_HA)ⁿ (점전하 아님·기하 방향성). E_hb/D_OH ∈ (0.03,0.3).
  function enableHBond(world) {
    world.nu_diss = 0;                        // 공유 해리 끔 → 물 분자 온전 (네트워크만 관찰)
    world.catalog = [];                       // 반응 끔 — H-결합 네트워크에 집중
    world.thermoK = 0.15;                     // 저온 항온조 세기 (결합 에너지 방출 스파이크 억제)
  }

  // ── ⑫ 복사장(발광) 관찰 프리셋 — 광자 개체를 켠다 (step-0038·enableHBond 지위) ──
  //   R-COL(충돌 들뜸)은 카탈로그 base 에 넣지 않는다: 완화(들뜸 1→0)가 근-영 상대 KE 에 dE 를
  //   쏟으면 상대 속도가 폭증(카타펄트)해 결합 동역학에서 적분이 폭발한다(실측 잔차 +9/사건). 그래서
  //   ① 자유충돌만(결합쌍 제외) ② 발광 프리셋에서만 활성. 자발 방출 R-EMI(수명 시계)는 KE 불변이라
  //   안전 — 발광의 주 채널이다. 광자는 field 모드에서 진짜 입자(방향·전파·경계).
  const R_COL_RAD = {
    id: 'R-COL', name: '충돌 들뜸(자유충돌)', kind: 'contact',
    match(world, i, j) {
      const a = world.atoms[i], b = world.atoms[j];
      if (!world.specLevels || !world.specLevels[a.sp] || !world.specLevels[b.sp]) return null;
      if (E.hasBond(world, a.id, b.id)) return null;   // 결합쌍 제외 (전자 들뜸=자유 충돌·카타펄트 회피)
      return { i, j };
    },
    hazard(world) { return world.nu_exc != null ? world.nu_exc : world.nu_col; },
    apply(world, ctx) { return E.lbRedistribute(world, ctx.i, ctx.j); },
    budget: { from: ['K_tr'], to: ['U_int'] }, reverse: 'R-COL',
  };
  // 복사장 켜기 — specLevels(base 상시)에 들뜸 원천 + 광자 field 모드를 얹는다. opts 로 경계·율 조정.
  //   photonBC: 'open'(복사 냉각 — 광자 상자 탈출) | 'reflect'(공동 — 광자 갇혀 재흡수 평형).
  function enableRadiation(world, opts) {
    const o = opts || {};
    world.catalog = world.catalog.concat([R_COL_RAD]);   // 들뜸 원천 (base 부재 = 참값)
    world.radiationMode = 'field';                       // 광자 = 진짜 입자 (④ 빈 근사 아님)
    world.c_ph = o.c_ph != null ? o.c_ph : 15.0;         // 광자 전파 속도 (≈10·v_th·위계만·무차원)
    world.gammaLine = o.gammaLine != null ? o.gammaLine : 0.25;   // 흡수 공명 선폭 Γ
    world.tau_rad = o.tau_rad != null ? o.tau_rad : 1.0;         // 자발 방출 수명 (짧을수록 밝다)
    world.nu_abs = o.nu_abs != null ? o.nu_abs : 1.0;           // 흡수율
    world.nu_stim = o.nu_stim != null ? o.nu_stim : 0;         // 유도 방출 (0=자발만)
    world.nu_exc = o.nu_exc != null ? o.nu_exc : 3.0;         // 충돌 들뜸 시도율 (가시 발광용 부양)
    world.photonBC = o.photonBC || 'open';                    // 광자 경계 (원자는 벽 반사 유지)
    world.pgRadOn = true;
  }
  // 물 분자 클러스터 직접 배치 — O + 2H 결합(정확 ~104.5° 기하). 관찰자 주입(회계 보정 포함).
  //   freeSpot 로 분자간 간격을 확보(겹침=적분 폭발 방지)하되 O–H 는 정확 결합 길이로 둔다.
  function buildWaterCluster(world, nMol, cx, cy, R) {
    const d0 = world.d0 != null ? world.d0 : 1.15, Dho = dPair('H', 'O'), HOH = 1.824;   // ~104.5°
    let made = 0;
    for (let m = 0; m < nMol; m++) {
      const ang = 2 * Math.PI * m / nMol + (m % 2) * 0.5, rr = R * (0.7 + 0.35 * world.rng());
      const O = spawn(world, 'O', cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), { T: 0.02 });
      if (!O) continue;
      // 수용체 인식은 세계 속성 hbAcc(종 기호 게이트)가 담당 — Z 덮어쓰기 불필요 (step-0033).
      //   (이전의 O.Z=8 은 ⑤ 이온화 q=Z−ne 회계와 충돌할 수 있어 제거 — 반응 공존을 위해)
      const base = world.rng() * 2 * Math.PI, hs = [];
      for (let k = 0; k < 2; k++) {
        const a2 = base + (k ? HOH : 0);
        const H = spawn(world, 'H', O.r.x + d0 * Math.cos(a2), O.r.y + d0 * Math.sin(a2), { T: 0.02 });
        if (H) hs.push(H);
      }
      const E0 = E.energyFull(world);
      for (const H of hs) world.bonds.push({ i: O.id, j: H.id, order: 1, rest: d0, k: world.kbond, D: Dho });
      world.pgIn.E += E.energyFull(world) - E0;
      made++;
    }
    world.pgIn.E += residual(world);          // 배치 상태(결합·H결합 에너지) = 관찰자 주입 (회계 보정)
    return made;
  }

  // ── 회계 검사 — 세계 총량(장부 전 통 합 · U_grav 포함) − 주입 누계 = 0 이어야 한다 ──
  function residual(world) { return E.totalEnergy(world) - world.pgIn.E; }
  // ⑳ 전하 회계 (step-0037): Σq(원자) = n_e(자유전자) — 이온화가 만든 양전하는 정확히 전자 수와
  //   같아야 한다 (벽 반사 상자·전자 소멸 경로 없음 → 등식 정확).
  function chargeOK(world) {
    let q = 0;
    for (const a of world.atoms) q += (a.Z || 0) - (a.ne != null ? a.ne : (a.Z || 0));
    return q === world.electrons.length;
  }
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
    // 이온 사건 검출은 정수층만 (|q|>0.5) — ⑮ 부분 전하(연속층·분자 전원 |q|~0.2)는 사건이 아니다.
    for (const a of world.atoms) if (Math.abs(a.q) > 0.5) q[a.id] = a.q;
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
      if (!groups.has(r)) groups.set(r, { comp: {}, cx: 0, cy: 0, cz: 0, n: 0, q: 0 });
      const g = groups.get(r);
      g.comp[a.sp] = (g.comp[a.sp] || 0) + 1;
      g.q += (a.Z || 0) - (a.ne != null ? a.ne : (a.Z || 0));   // 분자 순 전하 (정수층 — H₃O⁺ 라벨용)
      g.cx += a.r.x; g.cy += a.r.y; g.cz += a.r.z; g.n++;
    });
    const out = [];
    for (const g of groups.values()) {
      if (g.n < 2) continue;
      out.push({ comp: g.comp, cx: g.cx / g.n, cy: g.cy / g.n, cz: g.cz / g.n, n: g.n, q: g.q });
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
    buildPlayground, spawn, heatPulse, thermostat, residual, compositionOK, chargeOK,
    setGravity,
    enableHBond, enableRadiation, buildWaterCluster,
    fission, fuse, runFission, runNuclear, tick, field,
    snapshot, diffEvents, clusters, formula,
  };
  if (isNode) module.exports = api;
  else window.HktS0Playground = api;
})();
