// ionized.js — ⑳ 이온화 기체 (플라스마). self-contained: 엔진(①–⑲) diff 0.
//
// 앵커: 뜨거운 기체의 이온화 곡선 x(T) · 전제 ⑤(자유전자·이온화 회계)⑨(상태 수)⑬(3D) · design/20.
//
// 큰 그림 (author 0 — 곡선은 어디에도 안 적는다): 이온화는 새 원리가 아니라 **두 전이의 평형**이다.
//   · R-ION  (2체 충돌 이온화): A + M → A⁺ + e⁻ + M — 비용 ΔE(=IE + 쿨롱 점프)를 **상대 KE 에서만**
//     회수(에너지 출처 원칙·⑤ transferElectron 동형). 느린 충돌은 못 낸다 → 아레니우스가 창발(가드가 곧 문턱).
//   · R-REC3 (3체 재결합): A⁺ + e⁻ + M → A + M* — 이온이 이웃 전자를 포획(운동량 A.p += e.p 로 정확
//     보존)하고, 방출 에너지는 제3체 M 과의 상대 KE 로 (재결합열 = 가열).
//   평형 x(T) 는 두 hazard 의 경쟁 결과 = **측정**. 밀도 의존(사하 정성)도 author 0 로 나온다:
//     이온화/중성 ∝ n · 재결합/이온 ∝ n·n_e  →  x²/(1−x) ∝ 1/n  (재결합이 **다체**라서 — design/20).
//
// 정직(고전 유효 모델): 페르미 통계·디바이 정량·플라스마 진동·자기장 없음(design 경계). 전자 질량은
//   노브(dt 강성 — ⑤ 동형). 힘은 ⑲ 와 같은 이유로 **유계**(고전 점전자는 (σ/d)¹² 하드코어에 catapult)
//   → 부드러운 쿨롱 + 소프트코어. 엔진 pairForces 는 건드리지 않는다 (diff 0).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  const NU_ION = 12.0;    // 충돌 이온화 시도율 노브 (문턱은 에너지 가드가 — hazard 아님)
  const NU_REC = 12.0;    // 3체 재결합 시도율 노브

  // ── 힘: 유계 플라스마 (부드러운 쿨롱 + 소프트코어). ⑲ 와 동형 이유(유계 → Verlet 안정) ──
  const softCore = (d, rc, krep) => (d < rc ? krep * (rc - d) : 0);
  const softCoreU = (d, rc, krep) => (d < rc ? 0.5 * krep * (rc - d) * (rc - d) : 0);

  function forcesPlasma(world) {
    const bodies = world._pbodies || (world._pbodies = []);
    bodies.length = 0;
    for (const a of world.atoms) bodies.push(a);
    for (const e of world.electrons) bodies.push(e);
    const n = bodies.length, L = world.box.L, per = world.box.bc === 'periodic', fz = world.frozenZ;
    const kc = world.kc, s = world.soft, krep = world.krep != null ? world.krep : 12;
    const rcAA = world.rcAA != null ? world.rcAA : 1.0, rcEI = world.rcEI != null ? world.rcEI : 0.5,
      rcEE = world.rcEE != null ? world.rcEE : 0.6;
    for (const b of bodies) { b.F.x = 0; b.F.y = 0; b.F.z = 0; }
    let U = 0;
    for (let i = 0; i < n; i++) {
      const bi = bodies[i], qi = bi.isElectron ? -1 : (bi.q || 0);
      for (let j = i + 1; j < n; j++) {
        const bj = bodies[j], qj = bj.isElectron ? -1 : (bj.q || 0);
        let dx = bi.r.x - bj.r.x, dy = bi.r.y - bj.r.y, dz = bi.r.z - bj.r.z;
        if (per) { dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); dz = fz ? 0 : dz - L.z * Math.round(dz / L.z); }
        else if (fz) dz = 0;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const invS = 1 / (d + s);
        let fmag = 0;
        if (qi !== 0 && qj !== 0) { fmag += kc * qi * qj * invS * invS; U += kc * qi * qj * invS; }   // 부드러운 쿨롱 (유계)
        const bothAtom = !bi.isElectron && !bj.isElectron;
        const rc = bothAtom ? rcAA : (bi.isElectron === bj.isElectron ? rcEE : rcEI);
        fmag += softCore(d, rc, krep); U += softCoreU(d, rc, krep);
        const fOverD = fmag / d;
        bi.F.x += fOverD * dx; bi.F.y += fOverD * dy; bi.F.z += fOverD * dz;
        bj.F.x -= fOverD * dx; bj.F.y -= fOverD * dy; bj.F.z -= fOverD * dz;
      }
    }
    if (fz) for (const b of bodies) b.F.z = 0;
    world.ledger.U_elec = U;
  }

  function energyFull(world) { world.computeForces(world); E.recomputeLedger(world); return E.ledgerTotal(world); }

  function d2mi(world, a, b) {
    const L = world.box.L, per = world.box.bc === 'periodic';
    let dx = a.r.x - b.r.x, dy = a.r.y - b.r.y, dz = a.r.z - b.r.z;
    if (per) { dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); dz = world.frozenZ ? 0 : dz - L.z * Math.round(dz / L.z); }
    else if (world.frozenZ) dz = 0;
    return dx * dx + dy * dy + dz * dz;
  }

  // ── R-ION: 충돌 이온화 A + M → A⁺ + e⁻ + M ──
  //   전자는 A 에서 dEsc 만큼 떨어진 등방 방향에 **정지**로 태어난다 (P 정확 보존 — 전자 p=0 추가).
  //   비용 ΔE = (IE 저장 에너지 상승) + (쿨롱 점프)를 A–M 상대 KE 에서 회수 — 부족하면 되돌림(=문턱).
  function ionize(world, i, j) {
    const A = world.atoms[i], st = world.specIon[A.sp];
    if (!st || A.ne <= st.minNe) return false;
    const E0 = energyFull(world);
    const ne0 = A.ne;
    E.setNe(world, A, A.ne - 1);
    const dir = E.randDir(world.rng, world.frozenZ), d = world.dEsc != null ? world.dEsc : 1.5;
    world.electrons.push(E.makeElectron(E.V.make(A.r.x + dir.x * d, A.r.y + dir.y * d, A.r.z + dir.z * d), E.V.zero()));
    const dE = energyFull(world) - E0;
    if (!E.collisionalTransfer(world, i, j, dE)) {          // 상대 KE 부족 (느린 충돌) → 되돌림
      world.electrons.pop(); E.setNe(world, A, ne0); energyFull(world); return false;
    }
    return true;
  }

  const R_ION = {
    id: 'R-ION', name: '충돌 이온화', kind: 'contact',
    match(world, i, j) {
      if (!world.specIon) return null;
      const order = world.rng() < 0.5 ? [[i, j], [j, i]] : [[j, i], [i, j]];   // 편향 방지
      for (const [ia, io] of order) {
        const A = world.atoms[ia], st = world.specIon[A.sp];
        if (st && A.ne > st.minNe) return { ion: ia, other: io };
      }
      return null;
    },
    hazard(world) { return world.nu_ion != null ? world.nu_ion : NU_ION; },
    apply(world, ctx) { return ionize(world, ctx.ion, ctx.other); },
    budget: { from: ['K_tr'], to: ['U_int', 'U_elec'] }, reverse: 'R-REC3',
  };

  // ── R-REC3: 3체 재결합 A⁺ + e⁻ + M → A + M* ──
  //   접촉쌍 (A⁺, M) 이 곧 제3체 조건 — 이온 근방 rcRec 안의 **속박 전자**를 포획. 운동량은 A.p += e.p
  //   로 정확, 남은 방출 에너지(=재결합열)는 A–M 상대 KE 로. 다체이므로 rate/이온 ∝ n·n_e → 사하 밀도 의존.
  //
  //   **속박 게이트 (에너지 출처 원칙의 역방향·author 0)**: 이온 근방이라고 다 잡히지 않는다 —
  //   그 이온에 대해 국소적으로 속박(½μ|v_e−v_A|² + U_coul(e,A) < 0)인 전자만 포획 대상이다.
  //   뜨거운 전자는 스쳐 지나간다 → 재결합률이 T 와 함께 **떨어진다** → x(T) 가 S자로 오른다.
  //   (없으면 빠른 전자도 똑같이 포획 → x(T) 가 중간값에 눌러앉는다 — step-0020 발견.)
  function boundElectron(world, A) {
    const rc = world.rcRec != null ? world.rcRec : 1.2, rc2 = rc * rc;
    const me = world.m_e != null ? world.m_e : 1, mA = world.mass[A.sp], mu = me * mA / (me + mA);
    const kc = world.kc, s = world.soft, qA = A.q || 0;
    let best = -1, bd = rc2;
    for (let k = 0; k < world.electrons.length; k++) {
      const el = world.electrons[k], d2 = d2mi(world, A, el);
      if (d2 >= bd) continue;
      const vx = el.p.x / me - A.p.x / mA, vy = el.p.y / me - A.p.y / mA, vz = el.p.z / me - A.p.z / mA;
      const ke = 0.5 * mu * (vx * vx + vy * vy + vz * vz);
      const U = -kc * qA / (Math.sqrt(d2) + s);
      if (ke + U >= 0) continue;                 // 자유(스쳐 지나감) → 포획 불가
      bd = d2; best = k;
    }
    return best;
  }

  function recombine(world, iIon, iThird, ei) {
    const A = world.atoms[iIon], st = world.specIon[A.sp], el = world.electrons[ei];
    if (!st || !el || A.ne >= st.maxNe) return false;
    const E0 = energyFull(world);
    const ne0 = A.ne, p0 = E.V.clone(A.p);
    A.p.x += el.p.x; A.p.y += el.p.y; A.p.z += el.p.z;   // 포획 = 운동량 흡수 (P 정확 보존)
    world.electrons.splice(ei, 1);
    E.setNe(world, A, ne0 + 1);
    const dE = energyFull(world) - E0;                    // 보통 음수 (재결합열 방출)
    if (!E.collisionalTransfer(world, iIon, iThird, dE)) {
      E.setNe(world, A, ne0); A.p.x = p0.x; A.p.y = p0.y; A.p.z = p0.z;
      world.electrons.splice(ei, 0, el); energyFull(world); return false;
    }
    return true;
  }

  const R_REC3 = {
    id: 'R-REC3', name: '3체 재결합', kind: 'contact',
    match(world, i, j) {
      if (!world.specIon || !world.electrons.length) return null;
      const order = world.rng() < 0.5 ? [[i, j], [j, i]] : [[j, i], [i, j]];
      for (const [ia, io] of order) {
        const A = world.atoms[ia], st = world.specIon[A.sp];
        if (!st || A.ne >= st.maxNe) continue;
        const ei = boundElectron(world, A);
        if (ei >= 0) return { ion: ia, third: io, ei };
      }
      return null;
    },
    hazard(world) { return world.nu_rec != null ? world.nu_rec : NU_REC; },
    apply(world, ctx) { return recombine(world, ctx.ion, ctx.third, ctx.ei); },
    budget: { from: ['U_int', 'U_elec'], to: ['K_tr'] }, reverse: 'R-ION',
  };

  const PLASMA = [R_ION, R_REC3];

  // ── 측정 ──
  // 이온화 분율 x = n_ion/(n_ion+n_neutral). 이온 = ne < ne0(중성) — 라벨 author 0, 전자 수 측정.
  function ionization(world) {
    let nIon = 0, nNeutral = 0;
    for (const a of world.atoms) {
      const st = world.specIon && world.specIon[a.sp]; if (!st) continue;
      if (a.ne < st.maxNe) nIon++; else nNeutral++;
    }
    const n = nIon + nNeutral;
    return { x: n ? nIon / n : 0, nIon, nNeutral, nElectrons: world.electrons.length };
  }

  // 원자 병진 온도 (전자 제외 — 전자는 별도 자유도·2온도 플라스마의 이온 온도).
  function atomT(world) {
    const n = world.atoms.length; if (!n) return 0;
    let K = 0; for (const a of world.atoms) K += E.V.lenSq(a.p) / (2 * world.mass[a.sp]);
    return (2 * K) / (n * (world.frozenZ ? 2 : 3));
  }
  function electronT(world) {
    const n = world.electrons.length; if (!n) return 0;
    const me = world.m_e != null ? world.m_e : 1;
    let K = 0; for (const e of world.electrons) K += E.V.lenSq(e.p) / (2 * me);
    return (2 * K) / (n * (world.frozenZ ? 2 : 3));
  }

  // 항온조 (측정 도구 — ⑩ thermoReservoir 동형): 원자·전자를 목표 T 로 재척도.
  //   뺀/넣은 열은 E_escape 로 회계 → 장부는 닫힌 채 유지 (⑨ 캐논ical 측정 필수 — 미시정준 스캔 무효).
  function thermostat(world, Ttar) {
    E.recomputeLedger(world);
    const K0 = world.ledger.K_tr;
    const ta = atomT(world);
    if (ta > 0) { const s = Math.sqrt(Ttar / ta); for (const a of world.atoms) { a.p.x *= s; a.p.y *= s; a.p.z *= s; } }
    const te = electronT(world);
    if (te > 0) { const s = Math.sqrt(Ttar / te); for (const e of world.electrons) { e.p.x *= s; e.p.y *= s; e.p.z *= s; } }
    E.recomputeLedger(world);
    world.ledger.E_escape += K0 - world.ledger.K_tr;
  }

  // 총 운동량 (원자 + 자유전자). measure.momentum 은 원자만 세므로 ⑳ 에선 부족하다 —
  //   이온화가 운동량을 전자 자유도로 옮기기 때문 (전자 포함이 참 P · 사건별 감사는 checkedApply 와 동형).
  function momentumTotal(world) {
    const P = E.V.zero();
    for (const a of world.atoms) E.V.addInto(P, a.p);
    for (const e of world.electrons) E.V.addInto(P, e.p);
    E.V.addInto(P, world.ledger.P_escape);
    return P;
  }

  // (기록만·assert 없음 — design/20 경계) 전하 밀도 요동의 이웃 상관: −⟨qᵢqⱼ⟩ (접촉쌍) — 차폐 유사 지표.
  function chargeCorrelation(world, rc) {
    rc = rc != null ? rc : 2.0; const rc2 = rc * rc;
    const B = []; for (const a of world.atoms) B.push({ r: a.r, q: a.q || 0 });
    for (const e of world.electrons) B.push({ r: e.r, q: -1 });
    let sum = 0, cnt = 0;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      if (d2mi(world, B[i], B[j]) <= rc2) { sum += B[i].q * B[j].q; cnt++; }
    }
    return cnt ? -sum / cnt : 0;
  }

  const api = { R_ION, R_REC3, PLASMA, forcesPlasma, ionize, recombine, boundElectron, ionization, atomT, electronT, thermostat, momentumTotal, chargeCorrelation, NU_ION, NU_REC };
  if (isNode) module.exports = api;
  else window.HktS0Ionized = api;
})();
