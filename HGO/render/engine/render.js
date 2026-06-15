// render.js — 렌더 트랙의 그리기 구현. 단일 뷰어(atom/viewer.html)가 이 모듈을 load 해
//   캔버스 렌더링을 *위임*한다(SPINE §6.1 단일 뷰어 — 뷰어를 클론하지 않는다).
//   렌더는 atom 스냅샷(atoms·photons)을 *읽기만* 한다 — 위치·양은 sim 그대로, 색만 번역.
//
// 렌즈 L-λ: 광자 lambda → 스펙트럼 색(spectral.js). 색을 author 하지 않는다(RENDER.md §3).
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGORender = root.HGORender || {}).render = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 단일 뷰어가 매 프레임 호출: draw(ctx, sim, K). 상태 없음(스냅샷만 읽음).
  function draw(ctx, sim, K) {
    const SP = (typeof globalThis !== 'undefined' ? globalThis : this).HGORender.spectral;
    const cv = ctx.canvas;
    const sx = cv.width / sim.W, sy = cv.height / sim.H;

    // 검은 무대
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);

    // 원자 = 광원(읽기: 위치 rx,ry · 크기 = 질량 Z+N · 밝기 = 들뜸 x>0). 색 author 0.
    for (const a of sim.atoms) {
      const r = 1.5 + Math.sqrt(K.mass(a));
      ctx.beginPath();
      ctx.arc(a.rx * sx, a.ry * sy, r, 0, 6.2832);
      ctx.fillStyle = (a.x | 0) > 0 ? '#39405a' : '#20242f';   // 들뜬 원자는 약간 밝게
      ctx.fill();
    }

    // 광자 = 색 있는 빛(가법 합성). 색 = λ → 스펙트럼(측정 범위 정규화 — 창은 데이터에서 잼).
    const range = SP.measureRange(sim.photons) || { lo: 1, hi: 2 };
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sim.photons) {
      const [cr, cg, cb] = SP.photonColor(p.lambda, range);
      const x = p.rx * sx, y = p.ry * sy, rad = 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.85)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    drawStrip(ctx, sim, SP, range, cv.width, cv.height);
  }

  // 측정된 스펙트럼선을 캔버스 하단 띠로(실제 스펙트럼선의 창발 — 색=λ).
  function drawStrip(ctx, sim, SP, range, W, H) {
    const h = 14, y0 = H - h;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, y0, W, h);
    const lines = new Map();   // 'from→to' → lambda (중복 제거)
    for (const p of sim.photons) lines.set(p.from + '→' + p.to, p.lambda);
    for (const lambda of lines.values()) {
      const nm = SP.lambdaToNm(lambda, range.lo, range.hi);
      const x = ((nm - 400) / 300) * W;
      const [cr, cg, cb] = SP.wavelengthToRGB(nm);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x - 2, y0, 4, h);
    }
  }

  return { draw };
});
