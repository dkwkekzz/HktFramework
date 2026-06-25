// viewer/scenes/step_0089.js — 발산(압축·충격면) 기준 적응 이주: 수렴 흐름만 SPH(회전≠압축 분리).
//   0082 의 |∇×v|(와도)는 회전만 짚는다 — 압축/충격면(수렴 흐름)은 못 잡는다. 발산 ∇·v 가 그걸 짚는다:
//   수렴(infall·충격 전면)은 ∇·v<0·순수 회전은 ∇·v=0. 충격면은 격자가 수치 확산으로 뭉개고 SPH 인공점성이
//   잘 좇는다. 장면: 좌측 수렴 압축(max(0,−∇·v) 큼)만 SPH(주황)·우측 회전 소용돌이(∇·v=0)는 격자(청록) 유지.
//   engine 법칙(htj-sph.js autoMigrate+gridDivergenceField·VER 21). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0089'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30, DIV_ON = 0.6, C = (N - 1) / 2;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), rho = g.fields.energy, mx = g.fields.mom_x, my = g.fields.mom_y;
    const lx = N * 0.30, rx = N * 0.70, cy = C, gauss = (x, y, bx, s) => Math.exp(-((x - bx) ** 2 + (y - cy) ** 2) / (2 * s * s));
    // 박스 전체 z 균일(슬랩 금지). 흐름은 in-plane.
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; rho[i] = 1;
      // 좌: 수렴 압축(∇·v<0·충격면) · 우: 회전 소용돌이(∇·v=0) — 둘 다 가우시안 코어.
      const wl = gauss(x, y, lx, N * 0.10), wr = gauss(x, y, rx, N * 0.10);
      mx[i] = -(x - lx) * 0.9 * wl + -(y - cy) * 0.9 * wr;       // 좌 수렴 vx + 우 회전 vx
      my[i] = -(y - cy) * 0.9 * wl + (x - rx) * 0.9 * wr;        // 좌 수렴 vy + 우 회전 vy
    }
    w.__grid = g; w.__parts = []; w.__phase = 0;
  }
  function advance(w) {
    if (w.__phase === 0) {                                       // 수렴 압축(좌)만 SPH·회전(우)은 격자
      const r = SPH.autoMigrate(w.__grid, w.__parts, { divOn: DIV_ON });
      w.__parts = r.particles; w.__toSPH = r.toSPH;
      for (const p of w.__parts) { const dx = p.cx - N * 0.30, dy = p.cy - C; p.px = -dx * (p.mass || 1) * 0.5; p.py = -dy * (p.mass || 1) * 0.5; }  // 수렴 속도 이어받기
    } else {                                                     // SPH 입자가 안으로 모인다(Lagrangian·충격면 따라감)
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
    label: 'step_0089 — 발산(압축·충격면) 기준 적응 이주: 수렴 흐름만 SPH(회전≠압축 분리)',
    title: 'HTJ — 발산 기준 이주: 좌측 수렴 압축(주황)만 SPH·우측 회전 소용돌이(청록)는 격자',
    sub: '0082 의 |∇×v|(와도)는 회전만 짚는다 — 압축/충격면(수렴 흐름)은 못 잡는다. 발산 ∇·v(gridDivergenceField·max(0,−∇·v)≥divOn)는 수렴만 짚는다: 순수 회전은 ∇·v=0·방사 팽창은 ∇·v>0(둘 다 안 잡음). 충격면은 SPH 인공점성이 잘 좇는다. 좌 수렴만 SPH·우 회전은 격자. 중앙 z-슬라이스.',
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

    note: '<b>압축(충격면)을 회전과 *구분*해 SPH 로 — 디테일 판정 다축의 마지막 축.</b> 0081(전단 |∇v|)은 모든 변형을, 0082(와도 |∇×v|)는 *회전만* 짚었지만, 둘 다 *압축/충격면*(수렴 흐름)을 회전과 못 가른다. 이 step 의 새 측정자 <code>gridDivergenceField</code>(셀별 max(0,−∇·v))와 <code>autoMigrate({divOn})</code> 가 *수렴(압축)만* 짚는다: 순수 회전은 <b>∇·v=0</b>(verify: divOn→이주 0·같은 장 vortOn→이주 1000)·방사 팽창은 ∇·v>0 이라 수렴 아님(divOn→이주 0). 충격 전면(수렴)은 고정 셀 격자가 수치 확산으로 뭉개고 SPH 인공점성(0046)이 잘 좇는 구조라 별 축이 값있다 = <b>0082 와도 축의 거울짝</b>. 이제 autoMigrate 는 <b>밀도 OR 전단 OR 회전 OR 압축</b> 4축 다축 정책 완성(임계 안 준 축은 무시·다 안 주면 0077 밀도만·divOn off→0077/0081/0082 동일·회귀 0). <b>장면</b>(capture 4 프레임): 좌측 수렴 압축(max(0,−∇·v) 큼)만 주황 SPH 로 이주하고, 우측 회전 소용돌이(∇·v=0)는 청록 격자로 남는다 → SPH 입자가 안으로 모인다(Lagrangian·충격면 따라감). <b>의미</b>: 표현 적응 정책이 밀도(0077)→전단(0081)→회전(0082)→압축(0089)으로 물리적으로 의미 있는 축을 모두 갖췄다 — 비용이 *진짜 디테일*(밀집·전단·소용돌이·충격면)을 따라간다. <b>정직한 한계</b>: 수렴 크기만(방향 무시)·단일 divOn 임계·이력 없음·viewer 중앙 z-슬라이스만. 다음: 다축 이력·연속 바다 3D·다축 바이옴.'
  };
});
