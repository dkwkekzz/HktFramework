// flux-kernel.js — flux 트랙 공용 유틸 (이웃 위상·rng·질량·해시).
// 단일 규칙(flux-laws.js)이 쓰는 *비국소 입력은 이웃뿐* — 그 이웃 관계를 여기서 만든다.
// atom 트랙과 동일하게 HGO.kernel 전역(브라우저) / module.exports(Node)에 등록 — 뷰어는 트랙 무관.
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).kernel = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 고정소수점 스케일(SCALE) — 보존량 q 는 *정수 fixed-point*(qᵢ = round(q·SCALE))로 저장한다.
  //   왜: float 누적·Math.pow 는 크로스플랫폼 비트 동일성이 없어(libm 차이) net 트랙(공유 결정론 세계)의
  //   lockstep 을 깬다. 정수 −F/+F 쌍은 비트 단위로 상쇄 → Σq *정확* 보존(머신 정밀도보다 강함, SPINE §2/§9).
  //   2¹⁶: 정수 곱(qmax·κfix ≈ 11·65536·13107 ≈ 9.4e9)이 2⁵³ 안 → +,−,×,floor 만 쓰면 IEEE754 비트 결정론.
  const SCALE = 1 << 16;

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

  // 격자(토러스) 이웃 간선 — 3D von Neumann 6-이웃. 각 무방향 간선을 *한 번만* 나열(보존: −F/+F 한 쌍).
  //   인덱스 i = (z·rows + r)·cols + c. +x·+y·+z 세 방향만 연결 → 셀당 6-이웃이되 간선 중복 0.
  //   depth 미지정/1(2D 장면) → 단층: +z 간선 생략 → 옛 2D 4-이웃 간선과 정확히 동일(회귀 호환).
  //   간선 순서 고정 → 결정론·순서 무관 보존. 위상(이웃)은 규칙의 4 자유도 중 하나(SPINE §3) — 법칙 추가 아님.
  function gridEdges(cols, rows, depth) {
    depth = depth || 1;
    const edges = [];
    const idx = (c, r, z) => (z * rows + r) * cols + c;
    // 한 축의 +방향 이웃 좌표(없으면 −1). 경계 wrap 은 크기≥3 에서만 — 크기 2 는 wrap 이 내부 간선과
    //   중복(쌍 두 번 나열), 크기 1 은 자기 루프가 됨. 크기≥3 에선 (i+1)%n 과 동일(12³ 격자 비트 불변).
    const fwd = (i, n) => (i + 1 < n) ? i + 1 : (n >= 3 ? 0 : -1);
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = idx(c, r, z);
      const nc = fwd(c, cols); if (nc >= 0) edges.push([i, idx(nc, r, z)]);              // +x 이웃(가로 wrap)
      const nr = fwd(r, rows); if (nr >= 0) edges.push([i, idx(c, nr, z)]);              // +y 이웃(세로 wrap)
      if (depth > 1) { const nz = fwd(z, depth); if (nz >= 0) edges.push([i, idx(c, r, nz)]); } // +z 이웃(깊이 wrap)
    }
    return edges;
  }

  // 상태 해시(결정론·골든) — q 는 이미 고정소수점 *정수*라 양자화 불필요(비트 그대로 FNV-1a). 같은 코드·같은 시드 → 같은 해시.
  function hashSim(sim) {
    let h = 2166136261 >>> 0;
    for (const a of sim.atoms) {
      const q = a.q | 0;
      h = Math.imul(h ^ (q & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 8) & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 16) & 0xff), 16777619);
      h = Math.imul(h ^ ((q >>> 24) & 0xff), 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  return { SCALE, mulberry32, mass, gridEdges, hashSim };
});
