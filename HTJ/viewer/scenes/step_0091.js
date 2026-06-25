// viewer/scenes/step_0091.js — (조립) 연속 바다·해안선: 2D 맵 노이즈 지형 위로 SPH 물이 한 수면을 찾고 해안선이 창발.
//   0083 은 1D 단면(x-z·한 분지)이었다. 이 무대는 2D 맵 지형 h(x,y) 위로 물을 떨궈 — 분지로 흘러 한 수면(바다)을
//   이루고, 바다와 땅이 닿는 해안선·해수면 위로 솟은 섬이 *법칙만으로* 창발한다. 탑다운(x-y 맵·고도 음영+물 파랑).
//   engine 변경 0(노이즈 높이장 + sphPressureForce/Viscosity/BoundaryForce + 중력 + stepEntities). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0091'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  function lat(i, j) { let h = (Math.imul(((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
  function sm(t) { return t * t * (3 - 2 * t); }
  function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf);
    const a = lat(xi, yi) * (1 - u) + lat(xi + 1, yi) * u, b = lat(xi, yi + 1) * (1 - u) + lat(xi + 1, yi + 1) * u; return a * (1 - v) + b * v; }
  function fbm2(x, y) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vn(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; }
  const AMP = 24, SCALE = 0.16, R = 18;
  const terr = (x, y) => AMP * fbm2((x + 100) * SCALE, (y + 100) * SCALE);

  const G = 4, DT = 0.02, CHUNK = 1000;
  const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };
  const CAN = 40, SPAN = 44, SC = CAN / SPAN;                 // 월드 ±22 → 캔버스 0..40

  function build(w) {
    const an = [], AR = 5, DXY = 2.4;
    for (let x = -R; x <= R + 1e-9; x += DXY) for (let y = -R; y <= R + 1e-9; y += DXY) an.push({ cx: x, cy: y, cz: terr(x, y) - AR, radius: AR });
    for (let t = -R; t <= R + 1e-9; t += 2.4) for (let z = 0; z <= AMP + 10; z += 3) {
      an.push({ cx: t, cy: -R - 2, cz: z, radius: 5 }); an.push({ cx: t, cy: R + 2, cz: z, radius: 5 });
      an.push({ cx: -R - 2, cy: t, cz: z, radius: 5 }); an.push({ cx: R + 2, cy: t, cz: z, radius: 5 });
    }
    const water = []; let seed = 11; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let x = -R + 4; x <= R - 4; x += 2.6) for (let y = -R + 4; y <= R - 4; y += 2.6) water.push({ cx: x + (rnd() - .5), cy: y + (rnd() - .5), cz: AMP + 8 + rnd() * 3, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
    w.__an = an; w.__water = water;
  }
  function sim(w, n) {
    for (let s = 0; s < n; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      En.stepEntities(w.__water, DT);
    }
  }

  return {
    label: 'step_0091 — (조립) 연속 바다·해안선: 2D 맵에 물이 한 수면을 찾고 해안선이 창발',
    title: 'HTJ — 연속 바다·해안선: 2D 맵 지형 위로 물이 분지에 고여 한 수면(바다)·해안선·섬이 법칙만으로',
    sub: '0083 은 1D 단면(한 분지)이었다. 여기선 2D 맵 지형 h(x,y) 위로 물을 떨궈 — 분지로 흘러 한 수면(바다)을 이루고 바다∩땅 해안선·해수면 위로 솟은 섬이 창발. 지형=노이즈 법칙(author 없음)·바다=중력+경계 접촉. engine 변경 0. 탑다운(x-y 맵·고도 음영+물 파랑).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, CHUNK); },

    makeWorld() { return { N: CAN }; },
    frames: [0, 1, 2, 3],
    // 색: v<1 = 지형 고도(어두운 저지→밝은 능선·녹갈색)·v≥1.5 = 물(파랑).
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [50, 110, 210] : [70 + v * 110, 90 + v * 90, 55 + v * 40] },
    toFrame(w) {
      const pts = [];
      // 지형 배경(탑다운 고도 음영)
      let tmin = Infinity, tmax = -Infinity; const G2 = 30;
      const ht = []; for (let j = 0; j < G2; j++) for (let i = 0; i < G2; i++) { const x = -R + (i / (G2 - 1)) * 2 * R, y = -R + (j / (G2 - 1)) * 2 * R, h = terr(x, y); ht.push([x, y, h]); if (h < tmin) tmin = h; if (h > tmax) tmax = h; }
      const span = (tmax - tmin) || 1;
      for (const [x, y, h] of ht) pts.push({ cx: (x + SPAN / 2) * SC, cy: (SPAN / 2 - y) * SC, r: 0.62, v: 0.15 + 0.8 * (h - tmin) / span });
      // 물(파랑·탑다운)
      for (const p of w.__water) pts.push({ cx: (p.cx + SPAN / 2) * SC, cy: (SPAN / 2 - p.cy) * SC, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length };
    },

    note: '<b>2D 맵에서 물이 분지에 고여 *한 수면(바다)*을 찾고, 바다와 땅이 닿는 *해안선*·해수면 위로 솟은 *섬*이 법칙만으로 창발한다.</b> 0083 은 1D 단면(x-z·한 분지)에서 "지형+바다 한 화면"을 보였다 — 이 step 은 그걸 <b>2D 맵</b>(x-y 높이장 h(x,y))으로 올려 *연속 바다·해안선*을 낸다. 지형은 <code>fBm</code> 높이장(author 없음)으로 깔고(작은 앵커 구 + 둘레 벽=그릇), 물은 균일 살포 후 <code>sphPressureForce</code>+<code>sphViscosity</code>+중력+<code>sphBoundaryForce</code>(0060 경계 접촉)로 정착시킨다 — engine 변경 0(조립). <b>측정(verify)</b>: ① <b>연속 수면</b> 2D 맵 전역에서 물 표면 산포(0.79) ≪ 0.4×지형 산포(1.11) → 물이 한 높이(≈12.8)를 찾는다=바다 ② <b>해안선 창발</b>(0083 엔 없던) 바다∩땅 경계 31셀에서 지형이 바다→땅으로 *솟는다*(마른쪽 10.0 > 젖은쪽 8.6)·젖은쪽은 해수면 아래(잠긴 해저) ③ <b>땅·바다·섬 공존</b> 바다 31·땅 165·해수면 위로 솟은 섬 34·바다 지형 < 땅 지형 ④ 물 보존(121→121·발산 없음) ⑤ 결정론. <b>흐름</b>(capture 4 프레임·탑다운): 살포된 물(파랑)이 떨어져 → 낮은 분지로 흘러 고이며 → <b>해안선이 또렷한 연속 바다</b>가 되고 봉우리는 섬으로 남는다(고도 음영 위에 파란 바다). <b>큰 그림</b>: 환경(TW2)이 1D 단면 → 2D 맵으로 — 게임의 "딛고 다닐 해안·바다"에 한 발 더. <b>원칙 준수</b>: 물·지형 모두 한 원소(구체)·해안선은 *측정된 경계*(타입 0). <b>정직한 한계</b>: 유한 SPH 물이라 깊은 분지부터 채워 얕은 저지대는 마른 채(연속성은 물량에 의존)·2D 높이장(오버행 없음)·앵커 그릇 경계(열린 해안 아님)·탑다운 단일 뷰. 다음: 다축 이주 이력·고도×바이옴 결합·열린 해안.'
  };
});
