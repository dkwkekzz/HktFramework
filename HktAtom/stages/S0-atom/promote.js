// promote.js — ⑪ 승격 배관 ⇧ / 재해동 ⇩ (MVP). 프로젝트 진짜 핵심 산출물의 첫 실물.
//
// KERNEL §3.3 · CONTRACT §3 의 의무를 구현한다:
//   ⇧ 승격  coarse(world) → 거시 상태 {종별 개수·V·E·T·P} (미시 배치는 버린다)
//   ⇩ 재해동 rethaw(coarse, template) → world' : 위치=겹침 회피 무작위·p=맥스웰(T)·내부=볼츠만(T)
//            → **E·Σc·P 를 회계상 정확히** 맞춘다 (보존은 정확·미시 배치는 분포로 — 이 비대칭이 엔트로피)
//   왕복 검증: coarse→rethaw 후 Σc·E·P 정확 + 선언 관측량 |O−O'|<ε.
//   출력: output.json v0 (species·pairPotential(PMF)·observables·validRange·provenance) + 스키마 검증기.
//
// self-contained: 핵심 엔진(①–⑩)을 건드리지 않는다 (회귀 0). engine.js 만 재사용.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // ── 측정 유틸 (measure.js 와 독립 — promote 자체 완결) ──
  const V = E.V;
  function temperatureOf(world) { const n = world.atoms.length; if (!n) return 0; const dof = world.frozenZ ? 2 : 3; return 2 * world.ledger.K_tr / (n * dof); }
  function volumeOf(world) { const L = world.box.L; return world.frozenZ ? L.x * L.y : L.x * L.y * L.z; }
  function pressureOf(world) { const n = world.atoms.length; if (!n) return 0; const dim = world.frozenZ ? 2 : 3; return (n * temperatureOf(world) + world.virial / dim) / volumeOf(world); }
  function momentumOf(world) { const P = V.zero(); for (const a of world.atoms) V.addInto(P, a.p); return P; }
  // 물질 에너지 = 개체 안에 든 에너지만 (병진+퍼텐셜+내부). E_photon·E_escape·E_nuclear 는 물질을
  //   떠난 에너지라 승격 대상(S1 개체의 u′)이 아니다 — 이걸 빼야 왕복이 물질 에너지를 정확히 보존.
  const LEFT_BINS = { E_photon: 1, E_escape: 1, E_nuclear: 1 };
  function matterEnergy(world) { E.recomputeLedger(world); let s = 0; for (const b of E.LEDGER_BINS) if (!LEFT_BINS[b]) s += world.ledger[b]; return s; }

  // 연결 성분 → 분자 목록 {members:[atomIdx], sig, comp}
  function components(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const groups = new Map();
    world.atoms.forEach((a, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
    const mols = [];
    for (const members of groups.values()) {
      const comp = {}; for (const i of members) { const sp = world.atoms[i].sp; comp[sp] = (comp[sp] || 0) + 1; }
      const sig = Object.keys(comp).sort().map((k) => k + comp[k]).join('');
      mols.push({ members, sig, comp });
    }
    return mols;
  }

  // 배위수 (측정 관측량) — 결합 반경 r_clu 이웃 평균
  function coordination(world, rclu) {
    const A = world.atoms, n = A.length, L = world.box.L, per = world.box.bc === 'periodic';
    if (!n) return 0; const rc2 = (rclu || 1.5) * (rclu || 1.5); let deg = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
      if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = world.frozenZ ? 0 : E.minImage(dz, L.z); }
      if (dx * dx + dy * dy + dz * dz <= rc2) deg += 2;
    }
    return deg / n;
  }

  // ── ⇧ 승격: coarse(world) — 거시 상태만. 미시 배치(위치·개별 운동량)는 버린다 ──
  function coarse(world) {
    const mols = components(world);
    const species = {};              // 분자종 → 개수 (구조 카탈로그)
    for (const m of mols) species[m.sig] = (species[m.sig] || 0) + 1;
    const atomCount = {};            // 원자종 → 개수 (Σc 보존 검사용)
    for (const a of world.atoms) atomCount[a.sp] = (atomCount[a.sp] || 0) + 1;
    // 분자 위상(별 구조) 재구성용: 종별 대표 comp
    const topo = {};
    for (const m of mols) if (!topo[m.sig]) topo[m.sig] = m.comp;
    world.computeForces(world); E.recomputeLedger(world);
    return {
      species, atomCount, topo,
      V: volumeOf(world), E_total: matterEnergy(world),   // 물질 에너지만 (복사·탈출 제외)
      T: temperatureOf(world), P: pressureOf(world),
      box: { L: { x: world.box.L.x, y: world.box.L.y, z: world.box.L.z }, bc: world.box.bc },
      frozenZ: world.frozenZ,
    };
  }

  // ── ⇩ 재해동: rethaw(coarse, template) — 거시 상태에서 미시 배치를 통계 복원 ──
  //   위치=겹침 회피 무작위(거부 샘플링)·분자는 별 구조로 결합 재구성·p=맥스웰(T)·E 정확 보정.
  function rethaw(cs, template, rng) {
    rng = rng || E.makeRng(12345);
    // 템플릿 파라미터를 그대로 (같은 MaterialModel 파라미터 — S0 내부 왕복)
    const w = E.makeWorld({
      dt: template.dt, box: { L: E.V.make(cs.box.L.x, cs.box.L.y, cs.box.L.z), bc: cs.box.bc }, frozenZ: cs.frozenZ,
      mass: template.mass, sigma: template.sigma, eps: template.eps, budget: template.budget,
      computeForces: template.computeForces, rng,
      kc: template.kc, soft: template.soft, Dbond: template.Dbond, d0: template.d0, kbond: template.kbond,
    });
    if (template.Dpair) w.Dpair = template.Dpair;
    if (template.alpha) w.alpha = template.alpha;          // ⑧ 분극 (cohesion)
    if (template.ionizeE) w.ionizeE = template.ionizeE;
    if (template.aDisp != null) w.aDisp = template.aDisp;
    if (template.catalog) w.catalog = template.catalog;    // ⑥ 결합 (재개 시)
    if (template.specLevels) w.specLevels = template.specLevels;
    const L = w.box.L, d0 = template.d0 != null ? template.d0 : 1.1;
    const budgetB = (sp) => (template.budget && template.budget[sp] != null ? template.budget[sp] : 0);
    // 분자 목록 전개 (별 구조: 최대 예산 원자를 중심, 나머지 위성)
    const molList = [];
    for (const sig in cs.species) for (let c = 0; c < cs.species[sig]; c++) molList.push(cs.topo[sig]);
    const Mn = molList.length;
    // 겹침 회피: 분자 중심을 격자 셀에 하나씩 (셀 크기 ≥ 분자 반경+σ → 분자 간 겹침 최소)
    const per = Math.max(1, Math.ceil(Math.sqrt(Mn))), gx = L.x / per, gy = L.y / per;
    let mi = 0;
    for (const comp of molList) {
      const spList = []; for (const sp in comp) for (let k = 0; k < comp[sp]; k++) spList.push(sp);
      let ci = 0; for (let k = 1; k < spList.length; k++) if (budgetB(spList[k]) > budgetB(spList[ci])) ci = k;
      const gxi = mi % per, gyi = (mi / per) | 0; mi++;
      const cx = (gxi + 0.5 + (rng() - 0.5) * 0.2) * gx, cy = (gyi + 0.5 + (rng() - 0.5) * 0.2) * gy;
      const centerAtom = E.makeAtom(spList[ci], E.V.make(cx, cy, 0), E.V.zero());
      w.atoms.push(centerAtom); const centerId = centerAtom.id;
      let ang = rng() * 6.283;
      const nSat = spList.length - 1, dSat = Math.min(d0, gx * 0.4, gy * 0.4);   // 위성 거리 (셀 안에)
      for (let k = 0; k < spList.length; k++) {
        if (k === ci) continue;
        const sx = cx + Math.cos(ang) * dSat, sy = cy + Math.sin(ang) * dSat; ang += 6.283 / Math.max(1, nSat);
        const wx = ((sx % L.x) + L.x) % L.x, wy = ((sy % L.y) + L.y) % L.y;
        const sat = E.makeAtom(spList[k], E.V.make(wx, wy, 0), E.V.zero());
        w.atoms.push(sat);
        w.bonds.push({ i: centerId, j: sat.id, order: 1, rest: d0, k: template.kbond, D: E.pairD(w, spList[ci], spList[k]) });
      }
    }
    // 겹침 제거 (위치 기반·힘 무관·안정): 결합 안 된 근접쌍을 최소 간격까지 밀어낸다 (동역학 폭발 방지).
    pushApart(w, 40, 0.88);
    // 감쇠 완화: 남은 인공 U 를 점성 감쇠로 소산 → 원자가 낮은 U(우물)로 정착. catalog·복사 없이 순수 힘.
    const cat = w.catalog; w.catalog = null;
    maxwellP(w, Math.max(cs.T, 0.3), rng);      // 완화용 초기 운동 (겹침 탈출)
    const relaxSteps = template._rethawRelax != null ? template._rethawRelax : 500;
    for (let k = 0; k < relaxSteps; k++) { E.step(w); if (k % 3 === 0) for (const a of w.atoms) { a.p.x *= 0.85; a.p.y *= 0.85; } }
    // p = 맥스웰(T) · COM 표류 제거 (P=0) · E 정확 보정 (목표 KE = 물질 E − 나머지 통)
    maxwellP(w, Math.max(1e-6, cs.T), rng);
    w.computeForces(w); E.recomputeLedger(w);
    const nonK = matterEnergy(w) - w.ledger.K_tr;
    w._Kdeficit = scaleKE(w, cs.E_total - nonK);   // 부족분 (음수) 회계 정직
    w.computeForces(w); E.recomputeLedger(w);
    w.ledger.E_escape = 0; w.ledger.E_photon = 0;   // 재해동 세계는 물질만 (떠난 에너지 0)
    w.catalog = cat;
    w._meta = { name: 's11-rethaw' };
    return w;
  }

  // 위치 기반 겹침 제거 (Jacobi 밀어내기) — 결합쌍은 rest≈d0>sep 라 안 밀림. 힘 없이 안정.
  function pushApart(world, iters, minSep) {
    const A = world.atoms, n = A.length, L = world.box.L;
    for (let it = 0; it < iters; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y;
        dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y);
        let d = Math.sqrt(dx * dx + dy * dy);
        const sep = minSep * (world.sigma[A[i].sp] + world.sigma[A[j].sp]) / 2;
        if (d < sep) {
          if (d < 1e-6) { dx = (world.rng() - 0.5); dy = (world.rng() - 0.5); d = Math.sqrt(dx * dx + dy * dy) || 1e-6; }
          const push = (sep - d) / 2 / d;
          A[i].r.x += dx * push; A[i].r.y += dy * push; A[j].r.x -= dx * push; A[j].r.y -= dy * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const a of A) { a.r.x = ((a.r.x % L.x) + L.x) % L.x; a.r.y = ((a.r.y % L.y) + L.y) % L.y; }
  }

  function maxwellP(world, T, rng) {
    const P = V.zero();
    for (const a of world.atoms) { const m = world.mass[a.sp], s = Math.sqrt(m * Math.max(1e-9, T)); a.p.x = s * E.gaussian(rng); a.p.y = s * E.gaussian(rng); a.p.z = world.frozenZ ? 0 : s * E.gaussian(rng); V.addInto(P, a.p); }
    const n = world.atoms.length; if (n > 0) for (const a of world.atoms) { a.p.x -= P.x / n; a.p.y -= P.y / n; if (!world.frozenZ) a.p.z -= P.z / n; }
  }
  // 현재 병진 KE 를 목표로 정확히 스케일 (COM 이미 0 → P 보존). 목표<0 이면 0 으로 (에너지 부족 정직 기록).
  function scaleKE(world, targetK) {
    E.recomputeLedger(world); const cur = world.ledger.K_tr;
    if (cur <= 1e-12) return 0;
    const tk = Math.max(0, targetK), s = Math.sqrt(tk / cur);
    for (const a of world.atoms) { a.p.x *= s; a.p.y *= s; if (!world.frozenZ) a.p.z *= s; }
    return targetK < 0 ? targetK : 0;   // 음수면 부족분 반환 (회계 정직)
  }

  // ── V′ 측정: 평균 힘 퍼텐셜 (PMF) — 종 쌍의 COM 거리 r 구속·열 앙상블 평균 힘 적분 ──
  //   두 원자(또는 분자 대표)를 거리 r 로 고정, 나머지 자유도를 T 로 굴려 평균 힘 ⟨F_r⟩ → V′(r)=−∫⟨F⟩dr.
  //   MVP: 단원자 종 쌍(예 O–O)의 힘을 직접 (분자 내부 자유도 없이) — 인력 꼬리 존재만 확인.
  function pmf(template, spA, spB, opts) {
    opts = opts || {};
    const rs = opts.rs || [];
    if (!rs.length) for (let r = 0.9; r <= 4.0; r += 0.15) rs.push(+r.toFixed(3));
    const kc = template.kc != null ? template.kc : 1.0, soft = template.soft != null ? template.soft : 0.1;
    const sig = (template.sigma[spA] + template.sigma[spB]) / 2, eps = Math.sqrt(template.eps[spA] * template.eps[spB]);
    const alpha = template.alpha || {}, IEm = template.ionizeE || {};
    const aI = alpha[spA] || 0, aJ = alpha[spB] || 0, ieI = IEm[spA] || 0, ieJ = IEm[spB] || 0;
    const a6 = Math.pow(opts.aDisp != null ? opts.aDisp : 0.9, 6);
    const C6 = 1.5 * (ieI * ieJ / ((ieI + ieJ) || 1)) * aI * aJ;
    // 중성 쌍의 쌍 퍼텐셜 (② 척력 + ⑧ 분산). 전하 0 가정 (중성 종). 방사형 힘 → 적분.
    const Vr = rs.map((r) => {
      const rep = eps * Math.pow(sig / r, 12);
      const disp = -C6 / (Math.pow(r, 6) + a6);
      return rep + disp;
    });
    let hasTail = false, rmin = null, vmin = Infinity;
    for (let i = 0; i < rs.length; i++) { if (Vr[i] < vmin) { vmin = Vr[i]; rmin = rs[i]; } if (Vr[i] < -1e-6) hasTail = true; }
    return { rs, V: Vr, hasTail, rmin, vmin, table: rs.map((r, i) => [r, Vr[i]]) };
  }

  // ── output.json v0 (CONTRACT §2 부분집합) ──
  function buildOutput(worldOrCoarse, template, opts) {
    opts = opts || {};
    const cs = worldOrCoarse.species ? worldOrCoarse : coarse(worldOrCoarse);
    // species: 분자종별 조성·질량·결합E·u/cv 곡선 (u/cv 는 template 이 제공하거나 생략)
    const species = [];
    for (const sig in cs.species) {
      const comp = cs.topo[sig];
      let m = 0; for (const sp in comp) m += (template.mass[sp] || 0) * comp[sp];
      // E_bind: 별 구조 결합 우물 합 (근사)
      let Ebind = 0; const spList = []; for (const sp in comp) for (let k = 0; k < comp[sp]; k++) spList.push(sp);
      if (spList.length > 1) { let ci = 0; const bB = (s) => (template.budget && template.budget[s] != null ? template.budget[s] : 0); for (let k = 1; k < spList.length; k++) if (bB(spList[k]) > bB(spList[ci])) ci = k; for (let k = 0; k < spList.length; k++) if (k !== ci) Ebind += -E.pairD({ Dpair: template.Dpair, Dbond: template.Dbond }, spList[ci], spList[k]); }
      species.push({ id: sig, composition: comp, m: +m.toFixed(4), E_bind: +Ebind.toFixed(4), count: cs.species[sig] });
    }
    // pairPotential (PMF) — 가능한 중성 종 쌍
    const pairPotential = {};
    if (opts.pmfPairs) for (const [a, b] of opts.pmfPairs) { const p = pmf(template, a, b); pairPotential[a + '|' + b] = p.table.map(([r, v]) => [+r.toFixed(3), +v.toFixed(5)]); }
    return {
      schema: 's0-output-v0', version: '0.1',
      species,
      pairPotential,
      observables: (opts.observables || [{ name: '조성', epsilon: 0, protocol: 'coarse→rethaw 왕복 조성 일치' }]),
      validRange: opts.validRange || { T: [0, cs.T * 3], rho: [0, (cs.atomCount ? Object.values(cs.atomCount).reduce((a, b) => a + b, 0) : 0) / cs.V] },
      macro: { V: +cs.V.toFixed(4), E_total: +cs.E_total.toFixed(4), T: +cs.T.toFixed(4), P: +cs.P.toFixed(5), atomCount: cs.atomCount },
      provenance: { stage: 'S0', scenes: opts.scenes || [], runs: opts.runs || 1 },
    };
  }

  // 스키마 검증기 (output.json v0 유효성) — 필드 존재·타입·observables ≥ 1·species ≥ 1·인력 꼬리 존재.
  function validateOutput(out) {
    const errs = [];
    const req = (c, m) => { if (!c) errs.push(m); };
    req(out && out.schema === 's0-output-v0', 'schema 태그');
    req(Array.isArray(out.species) && out.species.length >= 1, 'species ≥ 1');
    for (const s of out.species || []) { req(s.id && s.composition && typeof s.m === 'number' && typeof s.E_bind === 'number', 'species 필드 ' + (s && s.id)); }
    req(out.pairPotential && typeof out.pairPotential === 'object', 'pairPotential 객체');
    req(Array.isArray(out.observables) && out.observables.length >= 1, 'observables ≥ 1');
    req(out.validRange && out.macro && out.provenance, 'validRange·macro·provenance');
    // 인력 꼬리: 어떤 쌍 퍼텐셜에 음수(인력) 구간이 있는가
    let tail = false; for (const k in (out.pairPotential || {})) for (const [r, v] of out.pairPotential[k]) if (v < -1e-6) tail = true;
    if (Object.keys(out.pairPotential || {}).length) req(tail, '쌍 퍼텐셜 인력 꼬리 (반데르발스)');
    return { ok: errs.length === 0, errs };
  }

  const api = { coarse, rethaw, pmf, buildOutput, validateOutput, components, coordination, temperatureOf, volumeOf, pressureOf, momentumOf };
  if (isNode) module.exports = api;
  else window.HktS0Promote = api;
})();
