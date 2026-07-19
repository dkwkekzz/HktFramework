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
  const STEP_CAP = 0.15; // 경사하강 1회 최대 구면 이동 (강성 진동 방지 — step-0034)
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

  // 고립쌍 씨앗 — 결합 평균 반대 방향 + 지터 (완전 대칭 시 정체 방지)
  function seedLones(world, a, nl) {
    a.lones = [];
    if (nl === 0) return;
    const bs = bondNeighbors(world, a).map((bn) => bondDir(world, a, bn.nb));
    let sx = 0, sy = 0, sz = 0; for (const b of bs) { sx += b.x; sy += b.y; sz += b.z; }
    const rng = world.rng || Math.random;
    for (let k = 0; k < nl; k++) {
      let dir = V.make(-sx + (rng() - 0.5), -sy + (rng() - 0.5), world.frozenZ ? 0 : -sz + (rng() - 0.5));
      const n = V.len(dir) || 1; dir.x /= n; dir.y /= n; dir.z /= n;
      a.lones.push(dir);
    }
  }

  // 초기화: 각 원자에 고립쌍 방향 배열(단위) 부여 — 정적 결합 장면(⑭⑮)용 일괄 경로.
  function initGeometry(world) {
    for (const a of world.atoms) seedLones(world, a, loneCount(world, a));
    world._geoInit = true;
  }

  // step-0034: 동적 세계용 고립쌍 동기화 (법칙 스택 소비자) — 결합 수가 바뀐 원자만 재씨앗.
  //   비결합 원자는 도메인 생략: 고립쌍만으로는 원자 힘이 0(방향 보조 변수뿐)이라 물리 불변,
  //   자유 원자 재이완 비용과 V_ang 상수 오프셋만 던다. 결합이 생기는 순간 씨앗된다.
  //   기존 ⑭⑮ 장면(전원 결합·정적)은 initGeometry 경로 그대로 — 회귀 0.
  function syncLones(world) {
    for (const a of world.atoms) {
      const nl = bondNeighbors(world, a).length ? loneCount(world, a) : 0;
      if (a.lones && a.lones.length === nl) continue;
      seedLones(world, a, nl);
      // 씨앗 직후 국소 수렴 이완 — 복수 고립쌍 씨앗이 거의 평행(collinear)하게 태어나면
      //   V_ang 인위 스파이크(실측 +45)가 사건 회계를 오염시킨다(발견). 이완된 상태로 태어나면
      //   스파이크 자체가 없고, 최소 V_ang 의 실제 증분만 사건(formBond 등)의 dE 에 잡힌다.
      if (nl > 0) relaxAtom(world, a, 200, 1e-3);
    }
    world._geoInit = true;   // 일괄 초기화 불필요 (동기화가 대체)
  }

  // 원자의 전 도메인 방향+가중치 (bond: w=1·lone: w=λ_lp). bonds 는 현재 위치에서 매번 갱신.
  function domains(world, a) {
    const doms = [];
    for (const bn of bondNeighbors(world, a)) { const bd = bondDir(world, a, bn.nb); doms.push({ dir: bd, w: 1, bond: bn.nb, d: bd.d }); }
    for (const lp of a.lones || []) doms.push({ dir: lp, w: lam(world), bond: null });
    return doms;
  }

  // 고립쌍 재이완 (원자 하나): bonds 고정, 각 lone 을 V_ang 최소로 경사하강(구면 접선).
  //   tol 지정 시 수렴 판정 (한 바퀴 최대 이동 < tol 이면 종료) — 법칙 스택 경로는 수렴 이완을
  //   쓴다: 최소에 있어야 포락선 정리가 성립해 힘이 보존적이 된다 (12회 고정 이완의 지연 소산
  //   −5 실측 → 수렴 이완으로 제거·step-0034).
  // 원자 하나의 V_ang (도메인 쌍 합 — 수락/기각 판정용)
  function atomV(world, doms) {
    const KK = kang(world), CC = c0(world);
    let Vt = 0;
    for (let i = 0; i < doms.length; i++) for (let j = i + 1; j < doms.length; j++) {
      const di = doms[i].dir, dj = doms[j].dir;
      const cos = di.x * dj.x + di.y * dj.y + di.z * dj.z;
      Vt += KK * doms[i].w * doms[j].w / (1 - cos + CC);
    }
    return Vt;
  }

  function relaxAtom(world, a, iters, tol) {
    const CC = c0(world), LL = lam(world);
    const doms = domains(world, a);
    // 단조 하강 보장 (수락/기각 + 감쇠) — 강성 협곡(1/s²·s→c0)에서 고정 보폭은 두 상태를
    //   왕복하는 핑퐁 진동에 갇힌다(실측: 이완 종료 위상 따라 V 21.8↔12.3 널뜀 → 방출 회계가
    //   +9/평가 오염·발견). 한 바퀴 후 V 가 오르면 되돌리고 보폭을 반감 — V 는 단조 감소.
    let damp = 1, Vprev = atomV(world, doms);
    for (let it = 0; it < iters; it++) {
      let mv = 0;
      const save = a.lones.map((lp) => ({ x: lp.x, y: lp.y, z: lp.z }));
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
        const gmag = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1e-12;
        const sc = Math.min(ETA, STEP_CAP / gmag) * damp;                // 보폭 상한 × 감쇠
        const ox = lp.x, oy = lp.y, oz = lp.z;
        lp.x -= sc * gx; lp.y -= sc * gy; if (!world.frozenZ) lp.z -= sc * gz; else lp.z = 0;
        const n = V.len(lp) || 1; lp.x /= n; lp.y /= n; lp.z /= n;
        mv = Math.max(mv, Math.abs(lp.x - ox), Math.abs(lp.y - oy), Math.abs(lp.z - oz));
      }
      const Vnow = atomV(world, doms);
      if (Vnow > Vprev + 1e-12) {                                        // 올랐다 → 기각·보폭 반감
        a.lones.forEach((lp, i) => { lp.x = save[i].x; lp.y = save[i].y; lp.z = save[i].z; });
        damp *= 0.5;
        if (damp < 1e-3) break;
        continue;
      }
      Vprev = Vnow;
      if (tol != null && mv < tol) break;
    }
  }

  // 전 원자 재이완: 준정적 → 포락선 보존.
  function relaxLones(world) {
    for (const a of world.atoms) {
      if (!a.lones || a.lones.length === 0) continue;
      relaxAtom(world, a, N_RELAX);
    }
  }

  // V_ang 만 계산 (힘 없음·현재 lones 그대로) — 이완 방출 회계용 (step-0034)
  function angEnergy(world) {
    const KK = kang(world), CC = c0(world);
    let Vtot = 0;
    for (const a of world.atoms) {
      const doms = domains(world, a);
      if (doms.length < 2) continue;
      for (let i = 0; i < doms.length; i++) for (let j = i + 1; j < doms.length; j++) {
        const di = doms[i].dir, dj = doms[j].dir;
        const cos = di.x * dj.x + di.y * dj.y + di.z * dj.z;
        Vtot += KK * doms[i].w * doms[j].w / (1 - cos + CC);
      }
    }
    return Vtot;
  }

  // 각도 반발: V_ang 계산 + 결합 도메인의 접선 힘을 이웃·중심 원자에 (P·L 정확 보존). U_bond 에 가산.
  //   computeForces 합성으로 호출 (pairForces 뒤). lones 는 먼저 재이완(준정적 최소).
  function angularForces(world) {
    if (!world._geoInit) initGeometry(world);
    relaxLones(world);
    return angularCore(world);
  }
  function angularCore(world) {
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

  // computeForces 합성 헬퍼 (하위 호환 — ⑭⑮ 장면): pairForces(②⑥) + 각도(⑭).
  function forcesWithAngles(world) { E.pairForces(world); angularForces(world); }
  // ── 위상별 이상 배치 기준선 (step-0034) — V̂ = V_atom − V_min(위상) 정규화 ──
  //   반응 세계에서 V_ang 을 절대값으로 장부에 넣으면 첫 결합의 위상 전이(도메인 0→3)가
  //   +V_min(≈10) 오르막이 되어 결합 우물(−D)을 압도한다(실측: 결합 플리커가 E_photon 통을
  //   음수로 빨며 KE 펌프·T 10배 폭주 — 발견). 기준선 = 그 위상(결합수·고립쌍수·차원)의
  //   *자유 이완 최소* V — 평형 형상에서 V̂ ≈ 0, 변형(각 압박)만 에너지로 남는다.
  //   힘은 불변(원자 위치와 무관한 위상별 상수의 이동)·위상 전이는 사건 회계(formBond dE)가 잡는다.
  function baseV(world, nb, nl) {
    const key = nb + '-' + nl + '-' + (world.frozenZ ? 2 : 3);
    const cache = world._angBase || (world._angBase = {});
    if (cache[key] != null) return cache[key];
    const n = nb + nl;
    if (n < 2) return (cache[key] = 0);
    const KK = kang(world), CC = c0(world), LL = lam(world);
    const rng = world.rng || Math.random;
    const dirs = [], ws = [];
    for (let k = 0; k < n; k++) {
      const d = V.make(rng() - 0.5, rng() - 0.5, world.frozenZ ? 0 : rng() - 0.5);
      const l = V.len(d) || 1; d.x /= l; d.y /= l; d.z /= l;
      dirs.push(d); ws.push(k < nb ? 1 : LL);
    }
    for (let it = 0; it < 400; it++) {         // 전 방향 자유 이완 (원자 좌표 무관 — 방향 다발만)
      let mv = 0;
      for (let i = 0; i < n; i++) {
        const di = dirs[i];
        let gx = 0, gy = 0, gz = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const dj = dirs[j];
          const cos = di.x * dj.x + di.y * dj.y + di.z * dj.z;
          const s = 1 - cos + CC, coef = (ws[i] * ws[j]) / (s * s);
          gx += coef * dj.x; gy += coef * dj.y; gz += coef * dj.z;
        }
        const gl = gx * di.x + gy * di.y + gz * di.z;
        gx -= gl * di.x; gy -= gl * di.y; gz -= gl * di.z;
        const gmag = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1e-12;
        const sc = Math.min(ETA, STEP_CAP / gmag);                       // 스텝 상한 (relaxAtom 과 동일)
        const ox = di.x, oy = di.y, oz = di.z;
        di.x -= sc * gx; di.y -= sc * gy; if (!world.frozenZ) di.z -= sc * gz; else di.z = 0;
        const l = V.len(di) || 1; di.x /= l; di.y /= l; di.z /= l;
        mv = Math.max(mv, Math.abs(di.x - ox), Math.abs(di.y - oy), Math.abs(di.z - oz));
      }
      if (mv < 1e-4) break;
    }
    let Vb = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const cos = dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z;
      Vb += KK * ws[i] * ws[j] / (1 - cos + CC);
    }
    return (cache[key] = Vb);
  }

  // 법칙 등록 (step-0034) — 게이트 = 물리 입력(외각 전자 맵 valence) 존재. 부재 = 기여 0 이 참값.
  //   rank 15: 기반 pair(⑧ pol 10) 뒤·H-결합(20) 앞 — 형상이 잡힌 위에 방향성 약결합.
  //   수렴 이완: 고립쌍이 최소에 있어야 포락선 정리로 힘이 보존적 (고정 12회의 지연 소산 제거).
  //   장부: U_bond += Σ(V_atom − 기준선) — 평형 ≈ 0·변형만 에너지 (위 baseV 주석 참조).
  function angularLaw(world) {
    syncLones(world);
    // 이완 → 측정 순서가 전부다. V(이완 전)−V(이완 후) 를 "방출"로 계상하면 안 된다 — 그 차는
    //   소산이 아니라 상태 지연 아티팩트다: 회전하는 분자에서 고립쌍이 평가 시점마다 스테일이라
    //   +9/평가가 잡히지만, V*(이완 최소)는 회전 불변이라 이상적 준정적 극한에선 에너지 교환이
    //   0 이다 (실측: 회전 이원자에서 가짜 방출 +55 발견 — 그래서 회계하지 않는다). 힘·장부는
    //   전부 이완 *후* 상태에서 평가 — 포락선 정리로 보존적, 잔여 드리프트는 지연의 2차뿐.
    for (const a of world.atoms) if (a.lones && a.lones.length) relaxAtom(world, a, 120, 1e-4);
    const raw = angularCore(world);
    let base = 0;
    for (const a of world.atoms) {
      const nb = bondNeighbors(world, a).length;
      if (nb + (a.lones ? a.lones.length : 0) >= 2) base += baseV(world, nb, a.lones ? a.lones.length : 0);
    }
    world.ledger.U_bond -= base;               // angularCore 가 raw V 를 더했으니 기준선을 뺀다
    return raw - base;
  }
  E.registerLaw({ name: 'angle', rank: 15, active: (w) => !!w.valence, force: angularLaw });

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

  const api = { K_ANG, C0, LAMBDA_LP, initGeometry, syncLones, angEnergy, baseV, angularForces, angularLaw, forcesWithAngles, relaxLones, angleStats, loneCount, bondNeighbors, bondDir, domains };
  if (isNode) module.exports = api;
  else window.HktS0Geometry = api;
})();
