// acidbase.js — ⑰ 산·염기 (양성자 릴레이). self-contained: 엔진(①–⑯) diff 0.
//
// 앵커: 물 자동 이온화 2H₂O ⇌ H₃O⁺ + OH⁻ · 양성자 릴레이(Grotthuss) · 전제 ⑯.
//
// 큰 그림 (author 0): 산성도를 author 하지 않는다. **양성자(H, Z=1)가 수소 결합 링크 위에서
//   결합을 갈아탄다** — D–H···A → D⁻···H–A. 이온 정체(H₃O⁺·OH⁻)는 라벨이 아니라 *측정*이다:
//   O 의 형식 전하 = (현재 H 결합 수) − (중성 결합 수 nv). 2결합 O=중성·1결합 O=OH⁻(−1)·3결합 O=H₃O⁺(+1).
//   전이 전후 형식전하 합은 불변(한 결합이 D→A 로 이동 → D −1·A +1 → 합 0) ⇒ 전하 보존 정확.
//
// 장벽·방향은 미시 회계에서 창발한다 (에너지 출처 원칙, KERNEL §3.1):
//   전이 ΔE = energyFull(후) − energyFull(전) (결합 우물·부분전하 QEq·쿨롱·용매화 전부 포함).
//   collisionalTransfer 가 ΔE 를 상대 KE 에서 정확히 회수(부족하면 전이 불가·되돌림). 그래서:
//     · 자동 이온화(중성→이온쌍): 크게 흡열 → 볼츠만 꼬리로 희귀 (K_w ≪ 1).
//     · 재결합(이온쌍→중성): 발열 → 빠름 (역쌍·같은 행).
//     · 릴레이(H₃O⁺+H₂O→H₂O+H₃O⁺): ~열중립 → 빠름 → 전하가 분자보다 빨리 이동 (D_H>D_mol).
//   "이온 관여 시 Eₐ 급감"(Grotthuss)은 별도 author 가 아니라 에너지 가드에서 저절로 나온다.
//
// 정직 노브(⑯ R-HB D_hb 와 같은 지위·숨김 0): 우리 모델은 명시 점전하만 있고 유전 차폐가 없어
//   이온쌍 자기에너지를 과대평가(측정 ΔE_autoion≈+9)한다 → 냉수(T~0.02)에선 자동 이온화가 완전 동결.
//   실제 물의 유전 용매화(ε~80)를 대신할 **용매화 안정화 노브 protSolv**(이온 성분당 −protSolv·Q²)를
//   명시 author 로 더한다 — 방향(흡열)·온도 응답·공통이온은 여전히 창발하고 *크기*만 노브가 정한다.
//   위상(순 전하)만의 함수라 힘 0(에너지 오프셋) → 장부는 닫힌다(전이 ΔE 에 포함되어 KE 로 정산).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const HB = isNode ? require('./hbond.js') : window.HktS0HBond;

  const RPX = 2.4;       // 양성자 이전 거리 컷오프 (H···A) — ⑯ R_HB(2.6) 근방
  const C_MIN = 0.30;    // 선형성 게이트 c=û_DH·û_HA > C_MIN (H 가 D 반대편·A 쪽)
  const NU_PROT = 1.0;   // 이전 시도율 노브 (아레니우스 hazard 의 전지수 — 장벽은 에너지 가드가)

  const isH = (a) => (a.Z || 0) === 1;
  // 수용체 species: 고립쌍 보유 중원자 (O=8) · 산 짝염기 (예 F=9). world.protAcc 로 지정 가능.
  function isAcc(world, a) {
    if (isH(a)) return false;
    if (world.protAcc) return !!world.protAcc[a.sp];
    return (a.Z || 0) === 8;
  }
  // 여분 배위 허용 (배위 결합): O 는 nv+1(H₃O⁺)까지 · 그 외 nv 까지.
  const maxCoord = (a) => (a.nv || 0) + ((a.Z || 0) === 8 ? 1 : 0);

  function bondsOf(world, id) { const out = []; for (const b of world.bonds) if (b.i === id || b.j === id) out.push(b); return out; }
  function donorOf(world, H) { for (const b of world.bonds) { if (b.i === H.id) return world.atomById(b.j); if (b.j === H.id) return world.atomById(b.i); } return null; }
  // 형식 전하 = 현재 결합 수 − 중성 결합 수 nv (author 0 — 위상 측정).
  function formal(world, a) { return bondsOf(world, a.id).length - (a.nv || 0); }

  // 중성 결합 수 캡처 (장면 빌드 직후 1회) — 이후 형식 전하의 기준.
  function setNeutralValence(world) { for (const a of world.atoms) a.nv = bondsOf(world, a.id).length; }

  // 최소 이미지 벡터 성분
  function mim(world, v, Lk) { return world.box.bc === 'periodic' ? v - Lk * Math.round(v / Lk) : v; }

  // 이전 가능한 (H, D, A) 링크 열거 — H 가 D 에 결합·A 는 다른 분자의 수용체·근접·선형·배위 여유.
  function links(world) {
    const lab = HB.molLabels(world), L = world.box.L, out = [];
    for (const H of world.atoms) {
      if (!isH(H)) continue;
      const D = donorOf(world, H); if (!D) continue;
      for (const A of world.atoms) {
        if (A.id === D.id || !isAcc(world, A)) continue;
        if (lab.get(A.id) === lab.get(H.id)) continue;                 // 분자간만
        if (bondsOf(world, A.id).length >= maxCoord(A)) continue;      // 배위 포화 (H₄O²⁺ 금지)
        let ax = mim(world, A.r.x - H.r.x, L.x), ay = mim(world, A.r.y - H.r.y, L.y), az = world.frozenZ ? 0 : mim(world, A.r.z - H.r.z, L.z);
        const d = Math.sqrt(ax * ax + ay * ay + az * az);
        if (d >= RPX || d < 1e-6) continue;
        let hx = mim(world, H.r.x - D.r.x, L.x), hy = mim(world, H.r.y - D.r.y, L.y), hz = world.frozenZ ? 0 : mim(world, H.r.z - D.r.z, L.z);
        const dDH = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1e-9;
        const c = (hx * ax + hy * ay + hz * az) / (dDH * d);           // û_DH·û_HA
        if (c < C_MIN) continue;
        out.push({ H, D, A, d, c });
      }
    }
    return out;
  }

  function energyFull(world) { world.computeForces(world); E.recomputeLedger(world); return E.ledgerTotal(world); }

  // 양성자를 A 로부터 결합거리 d0 로 재배치 (D–H···A → D···H–A: H 가 A 쪽으로 이동).
  function placeAt(world, H, A, d0) {
    const L = world.box.L;
    let ux = mim(world, H.r.x - A.r.x, L.x), uy = mim(world, H.r.y - A.r.y, L.y), uz = world.frozenZ ? 0 : mim(world, H.r.z - A.r.z, L.z);
    const un = Math.hypot(ux, uy, uz) || 1; ux /= un; uy /= un; uz /= un;
    H.r.x = A.r.x + ux * d0; H.r.y = A.r.y + uy * d0; if (!world.frozenZ) H.r.z = A.r.z + uz * d0; else H.r.z = 0;
  }

  // 결합 갈아타기: bond(D,H) 제거 · bond(A,H) 추가 · H 재배치 · 형식전하 갱신. (에너지 회계는 호출부)
  function rewire(world, H, D, A) {
    const bd = world.bonds.find((b) => (b.i === D.id && b.j === H.id) || (b.i === H.id && b.j === D.id));
    const idx = world.bonds.indexOf(bd);
    world.bonds.splice(idx, 1);
    const d0 = world.d0 != null ? world.d0 : 1.15;
    world.bonds.push({ i: A.id, j: H.id, order: 1, rest: d0, k: world.kbond, D: bd.D });
    const oldR = { x: H.r.x, y: H.r.y, z: H.r.z };
    placeAt(world, H, A, d0);
    return { bd, idx, oldR };
  }
  function unwire(world, H, D, A, saved) {
    const nb = world.bonds.find((b) => (b.i === A.id && b.j === H.id) || (b.i === H.id && b.j === A.id));
    world.bonds.splice(world.bonds.indexOf(nb), 1);
    world.bonds.push(saved.bd);
    H.r.x = saved.oldR.x; H.r.y = saved.oldR.y; H.r.z = saved.oldR.z;
  }

  // 양성자 이전 (에너지 가드) — 흡열이면 상대 KE 부족 시 되돌림(false). checkedApply 로 감싸 호출.
  function protonTransfer(world, H, D, A) {
    const E0 = energyFull(world);
    const saved = rewire(world, H, D, A);
    const E1 = energyFull(world);
    const dE = E1 - E0;
    const iH = world.atoms.indexOf(H), iA = world.atoms.indexOf(A);
    if (iH < 0 || iA < 0 || !E.collisionalTransfer(world, iH, iA, dE)) { unwire(world, H, D, A, saved); energyFull(world); return false; }
    return true;
  }

  // R-PROT: 양성자 이전 (자동이온화·릴레이·재결합 한 행 — 장벽 비대칭은 에너지 가드가). 접촉 채널.
  //   contactPairs(i,j) 에서 (H,A) 조합을 찾는다 → world.rc 는 RPX 이상이어야 (장면이 설정).
  const R_PROT = {
    id: 'R-PROT', name: '양성자 이전(산·염기)', kind: 'contact',
    match(world, i, j) {
      const a = world.atoms[i], b = world.atoms[j];
      for (const [H, A] of [[a, b], [b, a]]) {
        if (!isH(H) || !isAcc(world, A)) continue;
        const D = donorOf(world, H); if (!D || D.id === A.id) continue;
        const lab = HB.molLabels(world); if (lab.get(A.id) === lab.get(H.id)) continue;
        if (bondsOf(world, A.id).length >= maxCoord(A)) continue;
        const L = world.box.L;
        let ax = mim(world, A.r.x - H.r.x, L.x), ay = mim(world, A.r.y - H.r.y, L.y), az = world.frozenZ ? 0 : mim(world, A.r.z - H.r.z, L.z);
        const d = Math.sqrt(ax * ax + ay * ay + az * az); if (d >= RPX || d < 1e-6) continue;
        let hx = mim(world, H.r.x - D.r.x, L.x), hy = mim(world, H.r.y - D.r.y, L.y), hz = world.frozenZ ? 0 : mim(world, H.r.z - D.r.z, L.z);
        const dDH = Math.hypot(hx, hy, hz) || 1e-9;
        if ((hx * ax + hy * ay + hz * az) / (dDH * d) < C_MIN) continue;
        return { H, D, A };
      }
      return null;
    },
    hazard(world) { return world.nu_prot != null ? world.nu_prot : NU_PROT; },
    apply(world, ctx) { return protonTransfer(world, ctx.H, ctx.D, ctx.A); },
    budget: { from: ['K_tr'], to: ['U_bond', 'U_pol', 'U_elec'] }, reverse: 'R-PROT',   // 자기역쌍 (미시 가역)
  };

  // 강제 이전 (에너지 가드 무시) — 장면 준비용(이온 주입). 준비는 측정 아님(maxwellInit 동형).
  function forceTransfer(world, H, D, A) { rewire(world, H, D, A); energyFull(world); return true; }

  // computeForces 합성: ⑯(극성+쿨롱+각도+H결합) → 용매화 안정화(순 전하 성분당 −protSolv·Q²).
  //   용매화는 위상(순 전하)만의 함수 → 힘 0(에너지 오프셋). U_pol 에 회계(⑮ 통 공유·비공존).
  function forcesAB(world) {
    HB.forcesHB(world);
    const ks = world.protSolv || 0;
    if (ks) {
      let Us = 0;
      for (const comp of components(world)) {
        let Q = 0; for (const i of comp) Q += formal(world, world.atoms[i]);
        if (Math.abs(Q) > 0.5) Us += -ks * Q * Q;
      }
      world.ledger.U_pol += Us;
    }
  }

  // 연결 성분 (분자) — bonds 그래프.
  function components(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const comp = new Map();
    world.atoms.forEach((a, i) => { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); });
    return [...comp.values()];
  }

  // 측정: 양이온(H₃O⁺ 등)·음이온(OH⁻ 등) 성분 수·K_w 유사·최대 O 배위(예산 검증)·이온 O 위치.
  function ions(world) {
    const cat = [], an = []; let maxCoordO = 0;
    for (const comp of components(world)) {
      let Q = 0, centerId = null, sp = {};
      for (const i of comp) { const a = world.atoms[i]; Q += formal(world, a); sp[a.sp] = (sp[a.sp] || 0) + 1; if ((a.Z || 0) === 8) { centerId = a.id; maxCoordO = Math.max(maxCoordO, bondsOf(world, a.id).length); } }
      if (Q > 0.5) cat.push({ Q, centerId, n: comp.length });
      else if (Q < -0.5) an.push({ Q, centerId, n: comp.length });
    }
    const L = world.box.L, vol = world.frozenZ ? L.x * L.y : L.x * L.y * L.z;
    return { nCat: cat.length, nAn: an.length, cat, an, Kw: (cat.length / vol) * (an.length / vol), maxCoordO };
  }

  // 릴레이 추적기: 양이온(H₃O⁺) O 의 위치를 따라가며 (정체 이동 포함) 누적 경로·MSD 를 잰다.
  //   전하가 hop 하면 위치가 이웃 O 로 점프 → 분자(O) 자체 이동보다 멀리 간다 (Grotthuss).
  function makeTracker(world) {
    const info = ions(world); const first = info.cat[0];
    return { prevId: first ? first.centerId : null, prev: first ? posOf(world, first.centerId) : null, path2: 0, net: { x: 0, y: 0, z: 0 } };
  }
  function posOf(world, id) { const a = world.atomById(id); return a ? { x: a.r.x, y: a.r.y, z: a.r.z } : null; }
  function trackStep(world, tr) {
    const info = ions(world); if (!info.cat.length) { tr.prevId = null; tr.prev = null; return; }
    // 이전 양이온에 가장 가까운 현재 양이온을 이어 추적 (동일 전하 정체 근사)
    let cur = info.cat[0];
    if (tr.prev) { let best = Infinity; for (const c of info.cat) { const p = posOf(world, c.centerId); const dd = seg(world, tr.prev, p); if (dd < best) { best = dd; cur = c; } } }
    const p = posOf(world, cur.centerId);
    if (tr.prev) { const d2 = seg(world, tr.prev, p); tr.path2 += d2; const L = world.box.L; tr.net.x += mim(world, p.x - tr.prev.x, L.x); tr.net.y += mim(world, p.y - tr.prev.y, L.y); tr.net.z += world.frozenZ ? 0 : mim(world, p.z - tr.prev.z, L.z); }
    tr.prevId = cur.centerId; tr.prev = p;
  }
  function seg(world, a, b) { const L = world.box.L; const dx = mim(world, b.x - a.x, L.x), dy = mim(world, b.y - a.y, L.y), dz = world.frozenZ ? 0 : mim(world, b.z - a.z, L.z); return dx * dx + dy * dy + dz * dz; }

  const api = { R_PROT, forcesAB, protonTransfer, forceTransfer, links, ions, components, setNeutralValence, formal, bondsOf, makeTracker, trackStep, RPX, NU_PROT };
  if (isNode) module.exports = api;
  else window.HktS0AcidBase = api;
})();
