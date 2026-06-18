// scenes.js — 장면 레지스트리(append-only). 한 step = 장면 한 항(법칙 아님 — SPINE §5).
//   장면 = { id, title, desc, ticks, init(rng,K)→spec, watch(sim,K)→지표, assert(w0,w1,K)→[{name,pass,value}] }.
//   이 한 항이 검증·골든·시각화의 단일 출처(DRY). 새 장면은 직전 장면 형식을 따른다.
// atom 트랙과 동일하게 HGO.scenes 전역(브라우저) / module.exports(Node)에 등록.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./flux-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).scenes = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 격자 셀 한 칸을 렌더 계약 모양으로 만든다. q = 보존량(규칙 대상), x = 렌더 밝기 채널(= q 동기).
  //   Z=1·N=0·e=1(중성·단일 원소·단일 동위원소) 고정 → 렌더는 균일 크기 구를 그리고 밝기만 q 따라간다.
  function cell(rx, ry, q) { return { rx, ry, q, x: q, Z: 1, N: 0, e: 1, vx: 0, vy: 0 }; }

  // 창발 측정(author 아님) — q 장의 합·퍼짐. spread(max−min)가 층(확산 평형화)을 *읽는* 지표.
  function measure(sim) {
    let sum = 0, mn = Infinity, mx = -Infinity;
    for (const a of sim.atoms) { sum += a.q; if (a.q < mn) mn = a.q; if (a.q > mx) mx = a.q; }
    return { sumQ: +sum.toFixed(6), spread: +(mx - mn).toFixed(6), maxq: +mx.toFixed(6), minq: +mn.toFixed(6) };
  }

  const SCENES = {
    // ── step-0001: 기질 + 단일 규칙 + 닫힌 장부 ── θ=0(문턱 없음) → 규칙은 순수 선형 확산.
    //   중앙 블롭(고 q) + 배경(저 q) → 규칙이 기울기를 평형화한다. Σq 불변·spread 단조 감소가 가설.
    'step-0001': {
      id: 'step-0001',
      title: 'step-0001 — 기질: 단일 규칙 위의 확산',
      desc: 'θ=0 이면 규칙 F=κ·sign(d)·|d|^α 는 순수 확산. 중앙 블롭이 이웃으로 퍼져 평형화하되 총량 Σq 는 불변(반대칭 보존). 세계의 유일한 법칙이 이 한 장면에서 처음 돈다.',
      ticks: 200,
      init(rng, K) {
        const cols = 24, rows = 24, W = 100, H = 100;
        const atoms = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H;
          // 중앙 5×5 블롭 = 고 q, 그 외 배경 = 저 q. + 작은 결정론 노이즈(rng 는 초기 배치에만, SPINE §3).
          const dc = Math.abs(c - (cols - 1) / 2), dr = Math.abs(r - (rows - 1) / 2);
          const blob = (dc <= 2 && dr <= 2) ? 10 : 0;
          atoms.push(cell(rx, ry, 1 + blob + rng() * 0.01));
        }
        return { cols, rows, W, H, atoms, knobs: { kappa: 0.2, theta: 0, alpha: 1 } };
      },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '확산 평형화(spread↓)', pass: w1.spread < w0.spread, value: `${w0.spread} → ${w1.spread}` },
          { name: '평형 미완(아직 비0 — 완전 평탄 아님)', pass: w1.spread > 0, value: `spread=${w1.spread}` },
        ];
      },
    },
  };

  return { SCENES, measure };
});
