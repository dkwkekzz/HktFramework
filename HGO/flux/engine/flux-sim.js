// flux-sim.js — 셀 상태 + tick + 렌더 계약 스냅샷. 셀 = 보존량 다발 {q,rx,ry}(+ 렌더 호환 필드).
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

  // 장면 spec({ cols, rows, atoms, knobs })로 sim 을 만든다. 격자 이웃 간선은 여기서 한 번 계산(고정 위상).
  function createSim(spec) {
    const cols = spec.cols, rows = spec.rows;
    const sim = {
      W: spec.W || 100, H: spec.H || 100, cols, rows,
      atoms: spec.atoms,                          // 렌더 계약: [{rx,ry,q,x,Z,N,e,vx,vy}]
      edges: K.gridEdges(cols, rows),             // 무방향 간선(중복 0) — 보존·결정론의 토대
      knobs: Object.assign({}, DEFAULTS, spec.knobs || {}),
      tick: 0,
      // 렌더 계약 빈 채널(RENDER.md §2 "없으면 없음") — flux 엔 광자·결합·탈출이 없다.
      photons: [], bonds: [], escaped: { E: 0, px: 0, py: 0, count: 0 },
    };
    return sim;
  }

  // 한 tick — 단일 규칙 적용 + tick 증가. 그게 전부(세계의 유일한 진행).
  function step(sim) {
    L.apply(sim);
    sim.tick++;
  }

  // 보존 장부 합 — verify 가 tick 전후로 호출(닫힌 장부 알리바이).
  function sumQ(sim) { let s = 0; for (const a of sim.atoms) s += a.q; return s; }

  return { createSim, step, sumQ, DEFAULTS };
});
