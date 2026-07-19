// hbond.js — ⑯ 수소 결합 (방향성 약결합). self-contained: 엔진(①–⑮) diff 0.
//
// 2단 접근 (design/16):
//   1차 (측정만·새 물리 0): ⑮ 부분 전하 + ⑭ 형상이면 H-결합이 창발하는가? → `detect` 로 측정.
//     발견(step-0016): 방향성(θ~140°)·거리(H···O~2.0)는 창발하나 에너지가 E_hb/D_OH≈2.5e-3 로
//     목표(0.03~0.3)의 ~1/10 — 점전하 근사가 실제 H-결합의 일부만 준다(design 예측).
//   2차 (정직 보정 행 R-HB): 방향 가중 단거리 인력을 **노브로 명시 author**(숨기지 않음·C6 과 같은 지위):
//     V_hb = −D_hb · w(d) · (û_DH·û_HA)₊ⁿ   (공여체 선형성 — 이웃 O 의 고립쌍 정합은 검출 게이트로).
//     힘 = −∇V_hb (D·H·A 3체·F_H=−F_D−F_A → **P·L 정확 보존**). U_bond 하위 항목(U_hb)로 회계.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // R-HB 파라미터 (author 노브 — 앵커 assert 가 확정). D_hb 는 E_hb/D_OH ∈(0.03,0.3) 로 튜닝.
  const D_HB = 1.0;      // 인력 세기 (well 깊이 스케일) — E_hb/D_OH∈(0.03,0.3)·배위 ~3.5/mol 로 튜닝
  const R_HB = 2.6;      // 거리 컷오프 (공유 d0~1.15 의 ~2.3배)
  const N_ANG = 2;       // 각도 지수 (û_DH·û_HA)ⁿ — 클수록 선형 H-결합 선호
  const dhb = (w) => (w.Dhb != null ? w.Dhb : D_HB);

  const isH = (a) => (a.Z || 0) === 1;      // 공여체의 H (수소)
  const isAcc = (a) => (a.Z || 0) === 8;    // 수용체 (산소 — 고립쌍 보유)
  // step-0033: 종 게이트를 세계 속성으로 열어둔다 — Z 관례(⑮⑯⑰ 장면)가 기본, 세계가
  //   hbDon/hbAcc(종 기호 맵)를 실으면 그것을 쓴다 (playground 는 Z=최외각 관례라 필수).
  const donGate = (w) => (w.hbDon ? (a) => !!w.hbDon[a.sp] : isH);
  const accGate = (w) => (w.hbAcc ? (a) => !!w.hbAcc[a.sp] : isAcc);

  // 최소 이미지 벡터
  function mi(world, ax, ay, az) {
    const L = world.box.L, per = world.box.bc === 'periodic';
    if (per) { ax -= L.x * Math.round(ax / L.x); ay -= L.y * Math.round(ay / L.y); if (!world.frozenZ) az -= L.z * Math.round(az / L.z); else az = 0; }
    return { x: ax, y: az === undefined ? 0 : ay, z: world.frozenZ ? 0 : az };
  }

  // 분자(연결 성분) 라벨 — 분자간 쌍만 H-결합 (성분 내는 공유결합).
  function molLabels(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const lab = new Map(); world.atoms.forEach((a, i) => lab.set(a.id, find(i)));
    return lab;
  }

  // 공여체 D (H 에 결합된 중원자) 찾기
  function donorOf(world, H) {
    for (const b of world.bonds || []) { if (b.i === H.id) return world.atomById(b.j); if (b.j === H.id) return world.atomById(b.i); }
    return null;
  }

  // 근방 H···A 쌍 열거 (분자간·거리 컷오프). 각 쌍: {D,H,A, rHA, d, rDH, dDH, uHA, uDH, c}
  function pairs(world) {
    const lab = molLabels(world), L = world.box.L, per = world.box.bc === 'periodic';
    const mim = (v, Lx) => per ? v - Lx * Math.round(v / Lx) : v;
    const isDon = donGate(world), isA = accGate(world);
    const out = [];
    for (const H of world.atoms) {
      if (!isDon(H)) continue;
      const D = donorOf(world, H); if (!D) continue;
      for (const A of world.atoms) {
        if (!isA(A) || lab.get(A.id) === lab.get(H.id)) continue;
        let ax = A.r.x - H.r.x, ay = A.r.y - H.r.y, az = A.r.z - H.r.z;
        ax = mim(ax, L.x); ay = mim(ay, L.y); az = world.frozenZ ? 0 : mim(az, L.z);
        const d = Math.sqrt(ax * ax + ay * ay + az * az);
        if (d >= R_HB || d < 1e-6) continue;
        let hx = H.r.x - D.r.x, hy = H.r.y - D.r.y, hz = H.r.z - D.r.z;
        hx = mim(hx, L.x); hy = mim(hy, L.y); hz = world.frozenZ ? 0 : mim(hz, L.z);
        const dDH = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1e-9;
        const uHA = { x: ax / d, y: ay / d, z: az / d }, uDH = { x: hx / dDH, y: hy / dDH, z: hz / dDH };
        const c = uDH.x * uHA.x + uDH.y * uHA.y + uDH.z * uHA.z;   // 공여체 선형성 (1=직선 D–H···A)
        out.push({ D, H, A, d, dDH, uHA, uDH, c });
      }
    }
    return out;
  }

  const wSwitch = (d) => 0.5 * (1 + Math.cos(Math.PI * d / R_HB));       // 1(d→0)→0(d=R_HB)
  const wSwitchP = (d) => -0.5 * (Math.PI / R_HB) * Math.sin(Math.PI * d / R_HB);

  // R-HB 방향성 인력 힘 + U_hb. computeForces 합성으로 호출 (극성 힘 뒤). 보존: F_H=−F_D−F_A.
  function hbForces(world) {
    const D = dhb(world);
    let Uhb = 0;
    for (const pr of pairs(world)) {
      if (pr.c <= 0) continue;                                // A 가 D 반대편일 때만 (선형 H-결합)
      const cn = Math.pow(pr.c, N_ANG), w = wSwitch(pr.d);
      Uhb += -D * w * cn;
      // 힘 성분: V = −D·w(d)·c^n
      const dpc = N_ANG * Math.pow(pr.c, N_ANG - 1);          // dp/dc
      const wp = wSwitchP(pr.d);
      const uHA = pr.uHA, uDH = pr.uDH, d = pr.d, dDH = pr.dDH, c = pr.c;
      // ∂c/∂A = (uDH − c·uHA)/d · ∂c/∂D = −(uHA − c·uDH)/dDH
      const gAx = (uDH.x - c * uHA.x) / d, gAy = (uDH.y - c * uHA.y) / d, gAz = (uDH.z - c * uHA.z) / d;
      const gDx = -(uHA.x - c * uDH.x) / dDH, gDy = -(uHA.y - c * uDH.y) / dDH, gDz = -(uHA.z - c * uDH.z) / dDH;
      // F_A = −∂V/∂A = D·[w'·uHA·cn + w·dpc·∂c/∂A] · (∂d/∂A = uHA)
      let fax = D * (wp * uHA.x * cn + w * dpc * gAx), fay = D * (wp * uHA.y * cn + w * dpc * gAy), faz = D * (wp * uHA.z * cn + w * dpc * gAz);
      // F_D = −∂V/∂D = D·[w·dpc·∂c/∂D]  (∂d/∂D = 0)
      let fdx = D * (w * dpc * gDx), fdy = D * (w * dpc * gDy), fdz = D * (w * dpc * gDz);
      if (world.frozenZ) { faz = 0; fdz = 0; }
      pr.A.F.x += fax; pr.A.F.y += fay; pr.A.F.z += faz;
      pr.D.F.x += fdx; pr.D.F.y += fdy; pr.D.F.z += fdz;
      pr.H.F.x -= fax + fdx; pr.H.F.y -= fay + fdy; pr.H.F.z -= faz + fdz;   // F_H = −F_A−F_D (P·L 보존)
    }
    world.ledger.U_bond += Uhb;
    world._Uhb = Uhb;
    return Uhb;
  }

  // computeForces 합성 (하위 호환 — ⑯⑰ 장면): 극성(전하·형상·쿨롱) → R-HB.
  function forcesHB(world) {
    if (world._polForces) world._polForces(world); else E.pairForces(world);
    hbForces(world);
  }
  // 법칙 등록 (step-0033) — 게이트 = 세기 노브 Dhb 존재. 없음 = 기여 0 이 참값.
  //   기여는 U_bond 에 더하기(+=)라 기반 pairForces 와 자연 합성 (스택 계약 준수).
  E.registerLaw({ name: 'hb', rank: 20, active: (w) => w.Dhb != null && w.Dhb !== 0, force: hbForces });

  // 검출 (측정 라벨·힘 아님): d(H···A)<r_hb ∧ θ(D–H···A)>θ_hb. 반환 통계.
  function detect(world, opts) {
    const o = opts || {}, thHb = o.thetaHb != null ? o.thetaHb : 130, rHb = o.rHb != null ? o.rHb : R_HB;
    const hb = [];
    for (const pr of pairs(world)) {
      if (pr.d >= rHb) continue;
      const th = Math.acos(Math.max(-1, Math.min(1, pr.c))) * 180 / Math.PI;   // θ(D–H···A): c=1→0°(직선)
      const angle = 180 - th;   // 관례 각 (직선=180°)
      if (angle < thHb) continue;
      hb.push({ H: pr.H.id, A: pr.A.id, D: pr.D.id, d: pr.d, angle, Ehb: -dhb(world) * wSwitch(pr.d) * Math.pow(Math.max(0, pr.c), N_ANG) });
    }
    return hb;
  }

  // 통계: H-결합 수·분자당 배위·거리/각 평균·E_hb 평균.
  function stats(world, opts) {
    const hb = detect(world, opts);
    const lab = molLabels(world);
    const nMol = new Set([...lab.values()]).size;
    const perMol = {};
    for (const h of hb) { const m = lab.get(h.H); perMol[m] = (perMol[m] || 0) + 1; const ma = lab.get(h.A); perMol[ma] = (perMol[ma] || 0) + 1; }
    const coords = Object.values(perMol);
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    return {
      n: hb.length, perMol: hb.length * 2 / Math.max(1, nMol),
      meanD: avg(hb.map((h) => h.d)), meanAngle: avg(hb.map((h) => h.angle)),
      meanEhb: avg(hb.map((h) => h.Ehb)), coordMean: avg(coords), hb,
    };
  }

  const api = { D_HB, R_HB, N_ANG, hbForces, forcesHB, detect, stats, pairs, molLabels };
  if (isNode) module.exports = api;
  else window.HktS0HBond = api;
})();
