// catalog.js — ④ 전이 카탈로그 (DESIGN §3.3 의 코드 형태).
//
// 모든 이산 현상은 같은 행 형식 {id, kind, match, guard, hazard, apply, budget, reverse}.
// 새 현상 = 코드가 아니라 행 추가 (KERNEL §3.1). ④의 첫 행 4종:
//   R-EXC 충돌 들뜸 · R-REL 충돌 완화 (접촉) · R-EMI 자발 방출 (수명·engine.fireEvent)
//   · R-ABS 흡수 (접촉*·engine.runAbsorption). 여기선 접촉 2행을 정의.
//
// 에너지 출처 원칙: 확률은 여부만, 에너지는 실제 자유도에서.
// 세부 균형: Larsen–Borgnakke 재분배 — 충돌 총에너지에서 후보 준위를 g 가중·에너지 가용성으로
// 뽑는다. 볼츠만 (g1/g0)e^{−ΔE/T} 가 창발한다 (e^{−ΔE/T} 는 어디에도 안 적는다 — 상대 병진
// 상태밀도 + 에너지 보존에서 저절로). R-EXC(들뜸)·R-REL(완화)은 이 한 규칙의 두 결과다.
//
// 설계 이탈(step-0004): 초안의 R-EXC/R-REL 분리(고정 hazard ∝ g)를 **한 행으로 통합**한다.
// 분리안은 충돌 빈도의 속도 편향 때문에 볼츠만 비율이 계·온도에 따라 0.6~1.1× 로 흔들렸다.
// LB 재분배는 세부 균형이 정확해 계·온도 무관하게 비율이 1.0 으로 수렴한다 (→ design/04 갱신).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // R-COL: 충돌 내부 교환 (들뜸 ⇌ 완화 — 미시 가역). 접촉쌍마다 LB 재분배 1회.
  const R_COL = {
    id: 'R-COL', name: '충돌 내부 교환(들뜸⇌완화)', kind: 'contact',
    match(world, i, j) {
      // 두 원자 다 준위를 가진 종이어야 (specLevels 존재). 국소만 본다.
      if (!world.specLevels || !world.specLevels[world.atoms[i].sp] || !world.specLevels[world.atoms[j].sp]) return null;
      return { i, j };
    },
    hazard(world) { return world.nu_col; },   // 접촉 시계 rate → p = 1−e^{−nu_col·dt}
    apply(world, ctx) { return E.lbRedistribute(world, ctx.i, ctx.j); },
    budget: { from: ['K_tr'], to: ['U_int'] }, reverse: 'R-COL',  // 자기역쌍 (LB 는 미시 가역)
  };

  // R-XFER: 전자 이전 (이온결합의 씨앗). 양이온형↔음이온형 접촉 시 전자 1개 이동.
  //   원자부 ΔE=IE−EA 는 오르막이지만 쿨롱(②)이 붙으면 접촉·격자에서 내리막(마델룽)이 된다.
  //   에너지 회계·오르막 게이트·역행은 engine.transferElectron 이 처리 (author 0 — 마델룽 창발).
  const R_XFER = {
    id: 'R-XFER', name: '전자 이전(이온결합)', kind: 'contact',
    match(world, i, j) {
      const si = world.specIon && world.specIon[world.atoms[i].sp];
      const sj = world.specIon && world.specIon[world.atoms[j].sp];
      if (!si || !sj) return null;
      let kat, an;                                    // 양이온형(전자 줌)·음이온형(전자 받음)
      if (si.role === 'cation' && sj.role === 'anion') { kat = i; an = j; }
      else if (sj.role === 'cation' && si.role === 'anion') { kat = j; an = i; }
      else return null;
      const K = world.atoms[kat], A = world.atoms[an], sk = world.specIon[K.sp], sa = world.specIon[A.sp];
      if (K.ne > sk.minNe && A.ne < sa.maxNe) return { from: kat, to: an };   // 정방향
      if (A.ne > sa.minNe && K.ne < sk.maxNe) return { from: an, to: kat };   // 역방향
      return null;
    },
    hazard(world) { return world.nu_xfer != null ? world.nu_xfer : world.nu_col; },
    apply(world, ctx) { return E.transferElectron(world, ctx.from, ctx.to); },
    budget: { from: ['K_tr'], to: ['U_int', 'U_elec'] }, reverse: 'R-XFER',
  };

  const COLLISIONAL = [R_COL];
  const IONIC = [R_XFER];

  const api = { R_COL, R_XFER, COLLISIONAL, IONIC };
  if (isNode) module.exports = api;
  else window.HktS0Catalog = api;
})();
