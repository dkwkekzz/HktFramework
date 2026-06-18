// flux-kernel.js — flux 트랙 공용 유틸 (이웃 위상·rng·질량·해시).
// 단일 규칙(flux-laws.js)이 쓰는 *비국소 입력은 이웃뿐* — 그 이웃 관계를 여기서 만든다.
// atom 트랙과 동일하게 HGO.kernel 전역(브라우저) / module.exports(Node)에 등록 — 뷰어는 트랙 무관.
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).kernel = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 결정론 의사난수(mulberry32) — 시드 하나로 재현. 규칙 자체는 결정론, rng 는 *초기 배치*에만 쓴다(SPINE §3).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 렌더 계약(RENDER.md §2): render.js 가 부르는 유일한 커널 함수 = mass(크기=질량).
  //   flux 셀은 단일 원소·단일 동위원소(Z=1,N=0 고정)라 모두 같은 크기 — 색·밝기는 q(=x 채널)가 정한다.
  function mass(a) { return (a.Z || 0) + (a.N || 0) || 1; }

  // 격자(토러스) 이웃 간선 — 각 무방향 간선을 *한 번만* 나열(보존: 한 간선에서 −F/+F 한 쌍).
  //   오른쪽·아래로만 연결 → 셀당 4-이웃(von Neumann)이되 간선 중복 0. 간선 순서 고정 → 결정론·순서 무관 보존.
  function gridEdges(cols, rows) {
    const edges = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      edges.push([i, r * cols + (c + 1) % cols]);   // 오른쪽 이웃(가로 wrap)
      edges.push([i, ((r + 1) % rows) * cols + c]);  // 아래 이웃(세로 wrap)
    }
    return edges;
  }

  // 상태 해시(결정론·골든) — q 를 1e-6 격자로 양자화해 FNV-1a. 같은 코드·같은 시드 → 같은 해시.
  function hashSim(sim) {
    let h = 2166136261 >>> 0;
    for (const a of sim.atoms) {
      const q = Math.round(a.q * 1e6) | 0;
      h = Math.imul(h ^ (q & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 8) & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 16) & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 24) & 0xff), 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  return { mulberry32, mass, gridEdges, hashSim };
});
