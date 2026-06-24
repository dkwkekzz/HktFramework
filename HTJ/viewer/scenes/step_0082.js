// viewer/scenes/step_0082.js — 와도(vorticity) 기준 적응 이주: 회전 소용돌이만 SPH(회전≠발산 분리).
//   0081 의 |∇v|(전단)은 회전(소용돌이)과 압축/팽창(발산)을 못 가른다. 와도 ω=∇×v 는 *회전만* 짚는다 —
//   순수 발산은 |∇v| 크지만 |ω|=0. 회전 eddy 는 Lagrangian(SPH)이 특히 잘 좇으므로 별도 축이 값있다.
//   장면: 좌측 회전 소용돌이(|ω| 큼)만 SPH(주황)·우측 방사 팽창(발산·|ω|=0)은 격자(청록) 유지. 중앙 z-슬라이스.
//
//   engine 법칙(htj-sph.js autoMigrate+gridVorticityField·VER 20). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0082'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30, VORT_ON = 0.6, C = (N - 1) / 2;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), rho = g.fields.energy, mx = g.fields.mom_x, my = g.fields.mom_y;
    const lx = N * 0.30, rx = N * 0.70, cy = C, gauss = (x, y, bx, s) => Math.exp(-((x - bx) ** 2 + (y - cy) ** 2) / (2 * s * s));
    // 박스 전체 z 균일(슬랩 금지 — z 경계 가짜 와도 방지). 흐름은 in-plane 이라 와도=ω_z 만.
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; rho[i] = 1;
      // 좌: 회전 소용돌이(|ω_z| 큼) · 우: 방사 팽창(발산·ω_z=0) — 둘 다 가우시안 코어.
      const wl = gauss(x, y, lx, N * 0.10), wr = gauss(x, y, rx, N * 0.10);
      mx[i] = -(y - cy) * 0.9 * wl + (x - rx) * 0.9 * wr;        // 좌 회전 vx + 우 발산 vx
      my[i] = (x - lx) * 0.9 * wl + (y - cy) * 0.9 * wr;         // 좌 회전 vy + 우 발산 vy
    }
    w.__grid = g; w.__parts = []; w.__phase = 0;
  }
  function advance(w) {
    if (w.__phase === 0) {                                       // 회전 소용돌이(좌)만 SPH·발산(우)은 격자
      const r = SPH.autoMigrate(w.__grid, w.__parts, { vortOn: VORT_ON });
      w.__parts = r.particles; w.__toSPH = r.toSPH;
      for (const p of w.__parts) { const dx = p.cx - N * 0.30, dy = p.cy - C; p.px = -dy * (p.mass || 1) * 0.5; p.py = dx * (p.mass || 1) * 0.5; }  // 회전 속도 이어받기
    } else {                                                     // SPH 소용돌이 입자가 휘돈다(Lagrangian)
      for (let s = 0; s < 12; s++) En.stepEntities(w.__parts, 0.04);
    }
    w.__phase++;
  }
  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round(C), pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.05) pts.push({ cx: x, cy: y, r: 0.58, v: 0.55 }); }
    return pts;
  }
  function partPts(parts) {
    const pts = [];
    for (const p of parts) { if (Math.abs(p.cz - C) > 3.5) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.66, v: 1.3 }); }
    return pts;
  }

  return {
    label: 'step_0082 — 와도(vorticity) 기준 적응 이주: 회전 소용돌이만 SPH(회전≠발산 분리)',
    title: 'HTJ — 와도 기준 이주: 좌측 회전 소용돌이(주황)만 SPH·우측 방사 팽창(청록)은 격자',
    sub: '0081 의 |∇v|(전단)은 회전과 압축/팽창을 못 가른다. 와도 ω=∇×v(gridVorticityField·|∇×v|≥vortOn)는 회전만 짚는다 — 순수 발산은 |∇v| 크지만 |ω|=0. 회전 eddy 는 Lagrangian SPH 가 특히 잘 좇는다. 좌 회전만 SPH·우 발산은 격자. 중앙 z-슬라이스.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { advance(w); },

    makeWorld() { return { N }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N, color: (v) => v >= 1 ? [212, 128, 56] : [38, 120 + v * 100, 152 + v * 90] },
    toFrame(w) {
      const pts = gridPts(w.__grid).concat(partPts(w.__parts));
      return { pts, grid: gridPts(w.__grid).length, sph: w.__parts.length, toSPH: w.__toSPH || 0 };
    },

    note: '<b>회전(소용돌이)을 압축/팽창(발산)과 *구분*해 SPH 로 — 디테일 판정의 또 한 축.</b> 0081 은 |∇v|(전단)으로 디테일을 짚었지만, |∇v| 는 *회전*(eddy)과 *발산*(방사 압축/팽창)을 못 가른다. 이 step 의 새 측정자 <code>gridVorticityField</code>(셀별 |∇×v|)와 <code>autoMigrate({vortOn})</code> 가 *회전만* 짚는다: 순수 발산(방사 팽창)은 |∇v| 크지만 <b>|ω|=0</b>(verify: vortOn→이주 0·같은 장 shearOn→이주 1000·회전≠발산 분리). 회전 소용돌이(eddy)는 고정 셀 격자가 가장 못 좇고 Lagrangian SPH 가 특히 잘 좇는 구조라 별도 축이 값있다. 이제 autoMigrate 는 <b>밀도 OR 전단 OR 와도</b> 다축 정책(임계 안 준 축은 무시·다 안 주면 0077 밀도만). <b>장면</b>(capture 4 프레임): 좌측 회전 소용돌이(|ω| 큼)만 주황 SPH 로 이주하고, 우측 방사 팽창(발산·|ω|=0)은 청록 격자로 남는다 → SPH 소용돌이 입자가 휘돈다(Lagrangian). <b>의미</b>: 표현 적응 정책이 밀도(0077)→전단(0081)→회전(0082)으로 *물리적으로 의미 있는 축*을 쌓는다 — 비용이 *진짜 디테일*(회전 구조)을 따라간다. <b>정직한 한계</b>: |ω| 크기만(축 방향 무시)·단일 vortOn 임계·이력 없음·viewer 중앙 z-슬라이스만. 다음: 와도 이력·발산(충격면) 축·격자 이류 합류·안정 분절 침식.'
  };
});
