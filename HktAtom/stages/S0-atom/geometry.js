// geometry.js — ⑭ 형상 (결합각·VSEPR). self-contained: 엔진(①–⑬)을 건드리지 않는다 (회귀 0).
//
// 큰 그림: 분자 형상은 author 하지 않는다. 같은 원자의 **전자쌍 방향(도메인)들 사이 공통 반발 하나**
// 로 굽음·직선·정사면체가 전부 창발한다 (VSEPR 의 동역학 구현). 분자별 목표각은 없다 — 상수 2개
// (k_ang·λ_lp)와 도메인 수(③ 유도)만이 입력이다.
//
// 도메인 = 결합 도메인(이웃 방향·b>1.5 는 1개) + 고립쌍 도메인(수 = (외각전자−결합)/2·③ occ 유도).
//   V_ang(원자) = k_ang · Σ_{a<b} w_a·w_b / (1 − cosθ_ab + c0)     w = 1(bond) | λ_lp(lone, >1)
//
// 에너지·보존 (정직):
//   · 결합 도메인의 각도 힘 = −∂V_ang/∂r 를 이웃 원자에 접선 방향으로, 반작용은 중심 원자에
//     (F_center = −Σ F_neighbor). V_ang 은 도메인 방향의 각도(회전·병진 불변)에만 의존하므로 이
//     정확 그래디언트는 **P·L 을 정확 보존**(뇌터). U_bond 통에 귀속.
//   · 고립쌍 방향은 질량 없는 보조 변수 — 매 force 평가마다 V_ang 최소로 재이완(warm-start 경사하강).
//     최소에서 ∂V/∂lone≈0 이라 포락선 정리로 V_ang*(bond) 이 원자 위치의 보존 퍼텐셜이 된다 →
//     별도 에너지 라우팅 없이 장부가 닫힌다 (design/14 의 "n_relax+잉여 K_tr" 를 준정적 최소화로 대체).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const V = E.V;

  // 상수 (author — 전 원소 공통·분자별 분기 0). 앵커 assert 가 확정. world._kang 등으로 튜닝 override 가능.
  const K_ANG = 4.0;     // 각도 반발 세기 (U_bond 규모와 맞춤)
  const C0 = 0.20;       // 특이점 완화 (1−cosθ+c0) — 180° 근처 발산 방지·기울기 유지
  const LAMBDA_LP = 1.5; // 고립쌍 배율 λ_lp>1 (고립쌍이 결합보다 넓게 퍼짐 → 결합각 압박)
  const N_RELAX = 12;    // 고립쌍 경사하강 반복 (warm-start)
  const ETA = 0.25;      // 경사하강 학습률
  const kang = (w) => (w._kang != null ? w._kang : K_ANG);
  const lam = (w) => (w._lam != null ? w._lam : LAMBDA_LP);
  const c0 = (w) => (w._c0 != null ? w._c0 : C0);

  // 최소 이미지 이웃 방향 (주기 상자)
  function bondDir(world, a, b) {
    const L = world.box.L, per = world.box.bc === 'periodic';
    let dx = b.r.x - a.r.x, dy = b.r.y - a.r.y, dz = b.r.z - a.r.z;
    if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = world.frozenZ ? 0 : E.minImage(dz, L.z); }
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    return { x: dx / d, y: dy / d, z: dz / d, d };
  }

  // 원자의 결합 이웃 목록 (도메인: 다중결합 b>1.5 는 1개로 — 여기선 order 로 근사)
  function bondNeighbors(world, a) {
    const out = [];
    for (const bd of world.bonds || []) {
      let other = null;
      if (bd.i === a.id) other = world.atomById(bd.j);
      else if (bd.j === a.id) other = world.atomById(bd.i);
      if (other) out.push({ nb: other, order: bd.order || 1 });
    }
    return out;
  }

  // 고립쌍 수 유도 = (외각 전자 − 결합에 쓴 전자)/2. 외각 전자는 scenes 가 ③ fillZ 로 넘긴 valence.
  function loneCount(world, a) {
    const val = world.valence && world.valence[a.sp];
    if (val == null) return 0;
    let used = 0; for (const bn of bondNeighbors(world, a)) used += bn.order;   // 결합당 전자 1 (공유쌍의 원자 몫)
    return Math.max(0, Math.floor((val - used) / 2 + 1e-9));
  }

  // 초기화: 각 원자에 고립쌍 방향 배열(단위) 부여 — 결합 반대쪽 근사에서 출발(전이 최소).
  function initGeometry(world) {
    for (const a of world.atoms) {
      const nl = loneCount(world, a);
      a.lones = [];
      if (nl === 0) continue;
      const bs = bondNeighbors(world, a).map((bn) => bondDir(world, a, bn.nb));
      // 결합 평균 반대 방향 씨앗 + 지터 (완전 대칭 시 정체 방지)
      let sx = 0, sy = 0, sz = 0; for (const b of bs) { sx += b.x; sy += b.y; sz += b.z; }
      const rng = world.rng || Math.random;
      for (let k = 0; k < nl; k++) {
        let dir = V.make(-sx + (rng() - 0.5), -sy + (rng() - 0.5), world.frozenZ ? 0 : -sz + (rng() - 0.5));
        const n = V.len(dir) || 1; dir.x /= n; dir.y /= n; dir.z /= n;
        a.lones.push(dir);
      }
    }
    world._geoInit = true;
  }

  // 원자의 전 도메인 방향+가중치 (bond: w=1·lone: w=λ_lp). bonds 는 현재 위치에서 매번 갱신.
  function domains(world, a) {
    const doms = [];
    for (const bn of bondNeighbors(world, a)) { const bd = bondDir(world, a, bn.nb); doms.push({ dir: bd, w: 1, bond: bn.nb, d: bd.d }); }
    for (const lp of a.lones || []) doms.push({ dir: lp, w: lam(world), bond: null });
    return doms;
  }

  // 고립쌍 재이완: bonds 고정, 각 lone 을 V_ang 최소로 경사하강(구면 접선). 준정적 → 포락선 보존.
  function relaxLones(world) {
    const CC = c0(world), LL = lam(world);
    for (const a of world.atoms) {
      if (!a.lones || a.lones.length === 0) continue;
      const doms = domains(world, a);
      for (let it = 0; it < N_RELAX; it++) {
        for (const lp of a.lones) {
          let gx = 0, gy = 0, gz = 0;
          for (const dm of doms) {
            if (dm.bond === null && dm.dir === lp) continue;              // 자기 자신 제외
            const cos = lp.x * dm.dir.x + lp.y * dm.dir.y + lp.z * dm.dir.z;
            const s = 1 - cos + CC, coef = (LL * dm.w) / (s * s);         // ∂V/∂cos = w_L w_j/s²
            gx += coef * dm.dir.x; gy += coef * dm.dir.y; gz += coef * dm.dir.z;
          }
          const gl = gx * lp.x + gy * lp.y + gz * lp.z;                    // 접선 성분만 (구면 제약)
          gx -= gl * lp.x; gy -= gl * lp.y; gz -= gl * lp.z;
          lp.x -= ETA * gx; lp.y -= ETA * gy; if (!world.frozenZ) lp.z -= ETA * gz; else lp.z = 0;
          const n = V.len(lp) || 1; lp.x /= n; lp.y /= n; lp.z /= n;
        }
      }
    }
  }

  // 각도 반발: V_ang 계산 + 결합 도메인의 접선 힘을 이웃·중심 원자에 (P·L 정확 보존). U_bond 에 가산.
  //   computeForces 합성으로 호출 (pairForces 뒤). lones 는 먼저 재이완(준정적 최소).
  function angularForces(world) {
    if (!world._geoInit) initGeometry(world);
    relaxLones(world);
    const KK = kang(world), CC = c0(world);
    let Vtot = 0;
    for (const a of world.atoms) {
      const doms = domains(world, a);
      if (doms.length < 2) continue;
      // 에너지
      for (let i = 0; i < doms.length; i++) for (let j = i + 1; j < doms.length; j++) {
        const di = doms[i].dir, dj = doms[j].dir;
        const cos = di.x * dj.x + di.y * dj.y + di.z * dj.z;
        Vtot += KK * doms[i].w * doms[j].w / (1 - cos + CC);
      }
      // 결합 도메인의 힘 (중심 a·이웃 nb). lone 은 힘 없음(방향만). F_center = −Σ F_nb.
      let fcx = 0, fcy = 0, fcz = 0;
      for (let i = 0; i < doms.length; i++) {
        const Di = doms[i]; if (Di.bond === null) continue;             // 결합 도메인만 원자 힘
        const ui = Di.dir, di = Di.d;
        let fx = 0, fy = 0, fz = 0;
        for (let j = 0; j < doms.length; j++) {
          if (j === i) continue;
          const uj = doms[j].dir;
          const cos = ui.x * uj.x + ui.y * uj.y + ui.z * uj.z;
          const s = 1 - cos + CC;
          const coef = KK * Di.w * doms[j].w / (s * s);                 // ∂V/∂cosθ
          // ∂cosθ/∂r_nb = (uj − cos·ui)/di  (구면 접선·거리로 나눔). 힘 = −∂V/∂r_nb.
          const tx = (uj.x - cos * ui.x) / di, ty = (uj.y - cos * ui.y) / di, tz = (uj.z - cos * ui.z) / di;
          fx -= coef * tx; fy -= coef * ty; fz -= coef * tz;
        }
        const nb = Di.bond;
        nb.F.x += fx; nb.F.y += fy; if (!world.frozenZ) nb.F.z += fz;
        fcx -= fx; fcy -= fy; fcz -= fz;
      }
      a.F.x += fcx; a.F.y += fcy; if (!world.frozenZ) a.F.z += fcz;
    }
    world.ledger.U_bond += Vtot;
    return Vtot;
  }

  // computeForces 합성 헬퍼: pairForces(②⑥) + 각도(⑭). 장면이 이걸 computeForces 로 지정.
  function forcesWithAngles(world) { E.pairForces(world); angularForces(world); }

  // 측정: 결합각 분포 (중심 원자별 이웃쌍 각도) · 도메인 각 표준편차(사면체성).
  //   반환: {angles:[deg...], bondAngles:{sp:[deg]}, domStd:{sp:[deg]}}
  function angleStats(world) {
    const bondAngles = {}, domStd = {};
    for (const a of world.atoms) {
      const bs = bondNeighbors(world, a).map((bn) => bondDir(world, a, bn.nb));
      if (bs.length >= 2) {
        const arr = bondAngles[a.sp] || (bondAngles[a.sp] = []);
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const cos = Math.max(-1, Math.min(1, bs[i].x * bs[j].x + bs[i].y * bs[j].y + bs[i].z * bs[j].z));
          arr.push(Math.acos(cos) * 180 / Math.PI);
        }
      }
      const doms = domains(world, a);
      if (doms.length >= 2) {
        const angs = [];
        for (let i = 0; i < doms.length; i++) for (let j = i + 1; j < doms.length; j++) {
          const di = doms[i].dir, dj = doms[j].dir;
          const cos = Math.max(-1, Math.min(1, di.x * dj.x + di.y * dj.y + di.z * dj.z));
          angs.push(Math.acos(cos) * 180 / Math.PI);
        }
        const m = angs.reduce((x, y) => x + y, 0) / angs.length;
        const sd = Math.sqrt(angs.reduce((x, y) => x + (y - m) * (y - m), 0) / angs.length);
        (domStd[a.sp] || (domStd[a.sp] = [])).push(sd);
      }
    }
    return { bondAngles, domStd };
  }

  const api = { K_ANG, C0, LAMBDA_LP, initGeometry, angularForces, forcesWithAngles, relaxLones, angleStats, loneCount, bondNeighbors, bondDir, domains };
  if (isNode) module.exports = api;
  else window.HktS0Geometry = api;
})();
