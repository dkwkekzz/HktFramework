// metal.js — ⑲ 금속 (비국소 전자 풀). self-contained: 엔진(①–⑱) diff 0.
//
// 앵커: 응집·전도의 씨앗 · 전제 ⑤(자유전자)⑧(응집) · design/19.
//
// 큰 그림: 낮은 IE 원소의 외각 전자가 클러스터 규모로 **비국소화**(자유전자 풀)되면,
//   공유(⑥ 예산 포화)와 달리 **비포화 응집**(배위 ≫ B)·차폐·전도가 나온다. 요점: 비국소화가
//   예산 포화를 우회한다 — 방향성 결합이 아니라 이온 격자 + 풀 전자의 쿨롱이 응집을 만든다(⑤ 마델룽 연장).
//
// 정직(고전 유효 모델·design §10): 밴드·페르미 통계·양자 축퇴 없음. 고전 점전자는 이온 코어로
//   함몰(양자 운동압 부재)해 (σ/d)¹² 하드코어에 catapult 된다 → **엔진 (σ/d)¹² 대신 metal.js 가
//   전 상호작용을 유계(bounded)로 제공**: 부드러운 쿨롱(kc/(d+s)) + 소프트코어 조화 반발. 유계 힘이라
//   Verlet 안정. 풀 전자는 이온에 얹히지 않고(소프트코어) 격자 사이로 퍼진다(전자끼리 반발).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // 소프트코어 조화 반발: d<rc 면 F = krep·(rc−d) (유계·부드러움). 하드코어 (σ/d)¹² 대체.
  const softCore = (d, rc, krep) => (d < rc ? krep * (rc - d) : 0);
  const softCoreU = (d, rc, krep) => (d < rc ? 0.5 * krep * (rc - d) * (rc - d) : 0);

  // 금속 힘: 이온(+1)·풀 전자(−1). 전부 유계. 외부장 world.Efield 로 전도 구동.
  //   노브: kc(쿨롱)·soft(연화)·rcII/rcEI/rcEE(소프트코어 반경)·krep(반발 강성).
  function forcesMetal(world) {
    const bodies = world._mbodies || (world._mbodies = []);
    bodies.length = 0;
    for (const a of world.atoms) bodies.push(a);
    for (const e of world.electrons) bodies.push(e);
    const n = bodies.length, L = world.box.L, per = world.box.bc === 'periodic', fz = world.frozenZ;
    const kc = world.kc, s = world.soft, krep = world.krep != null ? world.krep : 8;
    const rcII = world.rcII != null ? world.rcII : 1.6, rcEI = world.rcEI != null ? world.rcEI : 0.5, rcEE = world.rcEE != null ? world.rcEE : 0.9;
    for (const b of bodies) { b.F.x = 0; b.F.y = 0; b.F.z = 0; }
    let U = 0;
    for (let i = 0; i < n; i++) {
      const bi = bodies[i], qi = bi.isElectron ? -1 : (bi.q || 0);
      for (let j = i + 1; j < n; j++) {
        const bj = bodies[j], qj = bj.isElectron ? -1 : (bj.q || 0);
        let dx = bi.r.x - bj.r.x, dy = bi.r.y - bj.r.y, dz = bi.r.z - bj.r.z;
        if (per) { dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); dz = fz ? 0 : dz - L.z * Math.round(dz / L.z); }
        else if (fz) dz = 0;
        const d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1e-9;
        const invS = 1 / (d + s);
        const bothIon = !bi.isElectron && !bj.isElectron;
        let fmag = 0;
        // 이온-이온: 바레 쿨롱 아니라 **금속 결합 유효 우물**(전자 풀이 이온-이온 반발을 차폐 — Thomas-Fermi).
        //   author (design §9.2-⑲ "금속 결합의 유효 모델") — 비방향성 인력 우물 → 비포화 응집(배위 ≫ B).
        if (bothIon) {
          if (world.Dmetal) {
            const rcC = world.rcCoh != null ? world.rcCoh : 2.6, wch = rcC - rcII;
            if (d >= rcII && d < rcC) {
              const x = (d - rcII) / wch;
              U += -world.Dmetal * (1 - (2 * x - 1) * (2 * x - 1));   // 우물 (x=0.5 최소·깊이 Dm)
              fmag += world.Dmetal * (-4 * (2 * x - 1) / wch);         // F=−dU/dd (x>0.5 인력)
            }
          }
        } else {
          // 전자 관여 쌍: 부드러운 쿨롱 (전자-이온 인력·전자-전자 반발) — 유계. keCouple<1: 전자는 가벼운
          //   이동 캐리어(전도·차폐)로 두되 격자 압축 안 하게 약결합(응집은 이온-이온 글루가 담당·3D 안정).
          const ke = world.keCouple != null ? world.keCouple : 1;
          fmag += ke * kc * qi * qj * invS * invS; U += ke * kc * qi * qj * invS;
        }
        // 반발 코어. 이온-이온은 **발산 (rcII/d)⁶** (무거운 이온·붕괴 절대 방지·dt 안전) — 전자 풀의
        //   과글루로도 이온이 겹치지 않게. 전자 관여 쌍은 유계 소프트코어(가벼운 전자 catapult 회피).
        if (bothIon) {
          if (d < rcII) { const r6 = Math.pow(rcII / d, 6); fmag += 6 * krep * r6 / d; U += krep * r6 - krep; }   // −krep: rcII 에서 연속(U(rcII)=0)
        } else {
          const rc = bi.isElectron === bj.isElectron ? rcEE : rcEI;
          fmag += softCore(d, rc, krep); U += softCoreU(d, rc, krep);
        }
        const fOverD = fmag / d;
        bi.F.x += fOverD * dx; bi.F.y += fOverD * dy; bi.F.z += fOverD * dz;
        bj.F.x -= fOverD * dx; bj.F.y -= fOverD * dy; bj.F.z -= fOverD * dz;
      }
    }
    if (fz) for (const b of bodies) b.F.z = 0;
    world.ledger.U_elec = U;
    // 외부장 (전도): F = qE. 외부장이라 E 비보존(정직·⑮ 동형) — 전도 장면만.
    if (world.Efield) {
      for (const a of world.atoms) a.F.x += (a.q || 0) * world.Efield;
      for (const e of world.electrons) { e.F.x += (-1) * world.Efield; if (fz) e.F.z = 0; }
    }
  }

  // 최소 이미지 거리² (3D — frozenZ 면 z 무시)
  function d2mi(world, a, b) {
    const L = world.box.L, per = world.box.bc === 'periodic';
    let dx = a.r.x - b.r.x, dy = a.r.y - b.r.y, dz = a.r.z - b.r.z;
    if (per) { dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); dz = world.frozenZ ? 0 : dz - L.z * Math.round(dz / L.z); }
    else if (world.frozenZ) dz = 0;
    return dx * dx + dy * dy + dz * dz;
  }
  // 배위수: 이온당 rc 내 다른 이온 수 (금속 조밀 쌓임·비포화 지표). 3D FCC/HCP ~12·2D ~6.
  function coordination(world, rc) {
    rc = rc != null ? rc : 1.5; const A = world.atoms; const rc2 = rc * rc;
    let sum = 0; for (let i = 0; i < A.length; i++) { let c = 0;
      for (let j = 0; j < A.length; j++) { if (i === j) continue; if (d2mi(world, A[i], A[j]) < rc2) c++; }
      sum += c; }
    return A.length ? sum / A.length : 0;
  }
  // 전자 풀 구속 위반: 전자 총에너지 E>0(탈출 가능) 개수. (클러스터 평균장에 구속 = E<0)
  function unbound(world) {
    let nb = 0; const me = world.m_e != null ? world.m_e : 1;
    for (const e of world.electrons) {
      const ke = E.V.lenSq(e.p) / (2 * me);
      let bestU = 0; for (const a of world.atoms) { const d = Math.sqrt(d2mi(world, a, e)); bestU = Math.min(bestU, -world.kc / (d + world.soft)); }
      if (ke + bestU > 0) nb++;
    }
    return nb;
  }

  // 차폐: +테스트 전하 주변 풀 전자 밀도가 먼 곳보다 높다 (전자가 몰려 장을 감쇠 — 스크리닝 클라우드).
  //   near = 반경 rNear 안 전자 밀도 · far = 그 밖 전자 밀도. 비율 > 1 = 차폐.
  function screeningRatio(world, testId, rNear) {
    rNear = rNear != null ? rNear : 2.0; const t = world.atomById(testId); if (!t) return 0;
    const L = world.box.L, rn2 = rNear * rNear; let nNear = 0, nFar = 0;
    for (const e of world.electrons) { if (d2mi(world, e, t) < rn2) nNear++; else nFar++; }
    const threeD = !world.frozenZ;
    const volNear = threeD ? (4 / 3) * Math.PI * rNear * rNear * rNear : Math.PI * rNear * rNear;
    const volTot = threeD ? L.x * L.y * L.z : L.x * L.y;
    return (nNear / volNear) / Math.max(1e-9, nFar / Math.max(1e-9, volTot - volNear));
  }

  const api = { forcesMetal, coordination, unbound, softCore, screeningRatio };
  if (isNode) module.exports = api;
  else window.HktS0Metal = api;
})();
