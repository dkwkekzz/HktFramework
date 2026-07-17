// combustion.js — ⑱ 라디칼·연소 (불). self-contained: 엔진(①–⑰) diff 0.
//
// 앵커: 불 (점화·전선 전파) · 전제 ⑥(결합)⑩(실원소·쌍별 D) · **원리 0 · 행 여럿**.
//
// 큰 그림 (author 0): 연소는 새 원리가 아니라 **라디칼 연쇄**다. 라디칼 = 라벨이 아니라 측정:
//   예산 잔여(bondCount < B)인 원자. 연쇄의 심장은 **추상(abstraction)** 한 규칙 —
//   R·(라디칼) + X–Y → R–X + Y·  (R 가 X 를 빼앗고 X–Y 를 끊는다·⑰ 결합 갈아타기의 일반화).
//   · 반응 엔탈피 author 0: ΔE = D(X–Y) − D(R–X)  (⑩ 쌍별 D 회계). 발열이면 열이 나온다.
//   · **분지(라디칼 1→2)는 author 하지 않는다 — 예산에서 창발**: 공격 라디칼 R 의 잔여가 ≥2(원자 O)
//     면 R–X 후에도 R 이 여전히 라디칼 + 떨어진 Y 도 라디칼 → 2개. 잔여 1(H·)이면 1→1(전파).
//   · 발열 ΔE 를 **K_tr 로 방출**(복사 아님) → 이웃을 데워 아레니우스 속도를 올린다 → 연쇄·점화·전선.
//   개시(H₂→2H·)·종결(라디칼 재결합)은 ⑥ 엔진(R-DISS 해리·R-CPLX 안정화)이 그대로 — 여기선 추상 1행.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  const NU_ABST = 8.0;   // 추상 시도율 노브 (장벽은 에너지 가드가 — 흡열이면 KE 문턱)

  const rem = (world, a) => E.budgetB(world, a.sp) - E.bondCount(world, a.id);   // 예산 잔여 (>0 = 라디칼)
  const isRadical = (world, a) => rem(world, a) > 0;
  function bondsOf(world, id) { const out = []; for (const b of world.bonds) if (b.i === id || b.j === id) out.push(b); return out; }
  function otherEnd(world, bd, id) { return world.atomById(bd.i === id ? bd.j : bd.i); }

  function energyFull(world) { world.computeForces(world); E.recomputeLedger(world); return E.ledgerTotal(world); }

  // 추상: R·(라디칼) 이 X 로부터 결합을 빼앗는다 — R–X 형성 · X–Y 절단 · Y 방출. ΔE 는 K_tr 로 정산.
  //   발열(ΔE<0)이면 상대 KE 증가(가열·항상 진행)·흡열이면 KE 에서 흡수(부족 시 되돌림 = 문턱).
  function abstract(world, R, X, bdXY) {
    const Y = otherEnd(world, bdXY, X.id);
    if (!Y) return false;
    const E0 = energyFull(world);
    const idx = world.bonds.indexOf(bdXY);
    const d0 = world.d0 != null ? world.d0 : 1.1;
    world.bonds.splice(idx, 1);                                        // X–Y 절단
    world.bonds.push({ i: R.id, j: X.id, order: 1, rest: d0, k: world.kbond, D: E.pairD(world, R.sp, X.sp) });   // R–X 형성
    const E1 = energyFull(world);
    const dE = E1 - E0;
    const iR = world.atoms.indexOf(R), iY = world.atoms.indexOf(Y);
    if (iR < 0 || iY < 0 || !E.collisionalTransfer(world, iR, iY, dE)) {   // 흡열 문턱 부족 → 되돌림
      world.bonds.pop(); world.bonds.splice(idx, 0, bdXY); energyFull(world); return false;
    }
    return true;
  }

  // R-ABSTRACT: 라디칼 추상 (전파·분지 통합). 접촉 채널. contactPairs(i,j) 에서 (R, X) 조합 탐색.
  const R_ABSTRACT = {
    id: 'R-ABSTRACT', name: '라디칼 추상(연소 전파·분지)', kind: 'contact',
    match(world, i, j) {
      const a = world.atoms[i], b = world.atoms[j];
      for (const [R, X] of [[a, b], [b, a]]) {
        if (!isRadical(world, R)) continue;                 // 공격자는 라디칼 (예산 잔여)
        if (E.hasBond(world, R.id, X.id)) continue;         // 이미 결합됨 → 스킵
        const xb = bondsOf(world, X.id);
        if (!xb.length) continue;                            // X 는 결합을 가져야 (빼앗을 대상)
        // X 의 결합 중 R 로 옮기면 발열이 가장 큰 것 (자연 선택 — 강한 새 결합 선호)
        let best = null, bestGain = -Infinity;
        for (const bd of xb) {
          const Y = otherEnd(world, bd, X.id); if (!Y || Y.id === R.id) continue;
          const gain = E.pairD(world, R.sp, X.sp) - (bd.D != null ? bd.D : world.Dbond) * (bd.order || 1);   // 발열량 D(R-X)−D(X-Y)·order
          if (gain > bestGain) { bestGain = gain; best = bd; }
        }
        if (!best) continue;
        return { R, X, bd: best };
      }
      return null;
    },
    hazard(world) { return world.nu_abst != null ? world.nu_abst : NU_ABST; },
    apply(world, ctx) { return abstract(world, ctx.R, ctx.X, ctx.bd); },
    budget: { from: ['U_bond'], to: ['K_tr'] }, reverse: 'R-ABSTRACT',   // 자기역쌍 (미시 가역)
  };

  // ── 측정 ──
  // 라디칼 검출 (예산 잔여 원자) · 종별 · 라디칼 총수 (연쇄 증식 궤적).
  function radicals(world) {
    const out = []; let byZ = {};
    for (const a of world.atoms) { const r = rem(world, a); if (r > 0) { out.push({ id: a.id, sp: a.sp, rem: r }); byZ[a.sp] = (byZ[a.sp] || 0) + 1; } }
    return { n: out.length, byZ, list: out };
  }
  // 연결 성분 조성 히스토그램 (H₂O 생성 추적) — measure.molecules 와 동형(자체 완전).
  function species(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const comp = new Map();
    world.atoms.forEach((a, i) => { const r = find(i); if (!comp.has(r)) comp.set(r, {}); const c = comp.get(r); c[a.sp] = (c[a.sp] || 0) + 1; });
    const hist = {};
    for (const c of comp.values()) { const sig = Object.keys(c).sort().map((k) => k + c[k]).join(''); hist[sig] = (hist[sig] || 0) + 1; }
    return hist;
  }
  const nWater = (world) => (species(world)['H2O1'] || 0);

  const api = { R_ABSTRACT, abstract, isRadical, rem, radicals, species, nWater, NU_ABST };
  if (isNode) module.exports = api;
  else window.HktS0Combustion = api;
})();
