// flux-sim.js — 셀 상태 + tick + 렌더 계약 스냅샷. 셀 = 보존량 다발 {q,rx,ry,rz}(+ 렌더 호환 필드).
//   tick = 단일 규칙(flux-laws.apply) 한 번. 스냅샷은 RENDER.md §2 계약을 그대로 만족 → 렌더러 불변 재사용.
// atom 트랙과 동일하게 HGO.sim 전역(브라우저) / module.exports(Node)에 등록.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./flux-kernel.js') : root.HGO.kernel;
  const L = (typeof require !== 'undefined') ? require('./flux-laws.js') : root.HGO.laws;
  const mod = factory(K, L);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).sim = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K, L) {
  'use strict';

  // 규칙의 4 자유도(노브)가 전부 — 새 노브를 더하지 않는다(SPINE §3). 장면이 *미존재 시 가법*으로만 덮어쓴다.
  const DEFAULTS = { kappa: 0.2, theta: 0, alpha: 1 };

  // 장면 spec({ cols, rows, depth, atoms, knobs })로 sim 을 만든다. 격자 이웃 간선은 여기서 한 번 계산(고정 위상).
  //   depth 미지정 → 1(2D 단층, 옛 장면 회귀 호환). depth>1 이면 3D 6-이웃 토러스.
  function createSim(spec) {
    const cols = spec.cols, rows = spec.rows, depth = spec.depth || 1;
    const sim = {
      W: spec.W || 100, H: spec.H || 100, D: spec.D || 100, cols, rows, depth,
      atoms: spec.atoms,                          // 렌더 계약: [{rx,ry,rz,q,x,Z,N,e,vx,vy}]
      edges: K.gridEdges(cols, rows, depth),      // 무방향 간선(중복 0) — 보존·결정론의 토대
      knobs: Object.assign({}, DEFAULTS, spec.knobs || {}),
      tick: 0,
      // 렌더 계약 빈 채널(RENDER.md §2 "없으면 없음") — flux 엔 광자·탈출이 없다. bonds 는 decorate 가 전선으로 채움.
      photons: [], bonds: [], escaped: { E: 0, px: 0, py: 0, count: 0 },
    };
    decorate(sim);                                  // 초기 스냅샷 장식(tick0 도 구조 보이게) + 기준 범위 고정
    return sim;
  }

  // 렌더 스냅샷 장식 — q 에서 *측정한* 구조를 렌더가 읽을 채널로 내보낸다(SPINE §7·author 0: q 의 함수일 뿐).
  //   c0 = q-레벨 밴드(기준 범위[refMin,refRange] 정규화 → L-population 이 밴드별 색): 높은 q 영역·낮은 q 영역이
  //        다른 색. 확산하면 q 가 평균으로 모여 한 색으로 합쳐지고, 동결하면 여러 색이 굳어 남는다(현상=색 변화).
  //   bonds = 전선(가파른 경계 간선 [i,j,|Δq|]): θ>0 면 동결 경계(≈θ)가, θ=0 면 큰 기울기가 선으로.
  //        → L-bond 선 + L-Ebond 밝기. 사태 때 선이 많다가 동결하면 경계선만 남거나(θ>0) 사라진다(θ=0).
  //   q 만 읽어 파생 — 규칙·보존·해시(q)에 환류 0. 기준 범위는 첫 호출(tick0) 값으로 고정(시간 변화가 보이게).
  const NBANDS = 6;
  function decorate(sim) {
    const S = K.SCALE, a = sim.atoms, edges = sim.edges, n = a.length;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { const q = a[i].q; if (q < mn) mn = q; if (q > mx) mx = q; }
    if (sim._refMin === undefined) { sim._refMin = mn; sim._refRange = mx - mn; }   // tick0 기준 고정
    const ref = sim._refRange || 1, lo = sim._refMin;
    for (let i = 0; i < n; i++) {                   // c0 = q 밴드(기준 범위 정규화·클램프)
      let b = Math.floor((a[i].q - lo) / ref * NBANDS);
      a[i].c0 = b < 0 ? 0 : (b >= NBANDS ? NBANDS - 1 : b);
    }
    const thetaFix = Math.round((sim.knobs.theta || 0) * S);
    const frontFix = thetaFix > 0 ? thetaFix : Math.round(0.3 * sim._refRange);   // θ>0: 동결 경계(≈θ)만 성기게
    const bonds = [];
    if (frontFix > 0) for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const d = a[i].q - a[j].q, ad = d < 0 ? -d : d;
      if (ad >= frontFix) bonds.push([i, j, ad / S]);    // [i,j,Eabs=|Δq|] → L-bond 선 + L-Ebond 밝기
    }
    sim.bonds = bonds;
  }

  // 한 tick — 단일 규칙 적용 + tick 증가. 그게 전부(세계의 유일한 진행).
  //   sim.render 일 때만 렌더 채널 장식(뷰어용 — verify/골든은 끄고 빠르게, 해시는 q 만이라 무관).
  function step(sim) {
    L.apply(sim);
    sim.tick++;
    if (sim.render) decorate(sim);
  }

  // 보존 장부 합 — verify 가 tick 전후로 호출(닫힌 장부 알리바이).
  function sumQ(sim) { let s = 0; for (const a of sim.atoms) s += a.q; return s; }

  return { createSim, step, sumQ, decorate, DEFAULTS };
});
