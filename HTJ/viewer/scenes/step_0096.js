// viewer/scenes/step_0096.js — (조립) 바이옴 지형 위의 바다: 바다는 따뜻한 저지 분지에 고이고, 찬 고지(산)는 섬으로 솟는다.
//   두 트랙을 한 무대에서 합친다: ① 2D 바다(0091·SPH 물이 분지에 한 수면) ② 바이옴(0092~0095·biomeField, 고도축=실제
//   지형장 → 높은 땅=찬 바이옴). 그러면 *바다는 따뜻한 저지에, 산은 찬 고지에* 한 세계에서 일관되게 자리잡는다(기후+해수면).
//   탑다운(x-y 맵·따뜻한 저지 녹 → 찬 고지 백·물 파랑). engine 변경 0(0091 SPH + biomeField). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0096'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  function lat(i, j) { let h = (Math.imul(((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
  function sm(t) { return t * t * (3 - 2 * t); }
  function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf);
    const a = lat(xi, yi) * (1 - u) + lat(xi + 1, yi) * u, b = lat(xi, yi + 1) * (1 - u) + lat(xi + 1, yi + 1) * u; return a * (1 - v) + b * v; }
  function fbm2(x, y) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vn(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; }
  const AMP = 24, SCALE = 0.16, R = 18;
  const terr = (x, y) => AMP * fbm2((x + 100) * SCALE, (y + 100) * SCALE);
  const bf = Stream.biomeField({ scale: 0.07, nTemp: 3, nHum: 3, lapse: 0.6, elevFn: (x, y) => terr(x, y) / AMP });

  const G = 4, DT = 0.02, CHUNK = 1000;
  const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };
  const CAN = 40, SPAN = 44, SC = CAN / SPAN;

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
    label: 'step_0096 — (조립) 바이옴 지형 위의 바다: 따뜻한 저지=바다·찬 고지=산(섬)',
    title: 'HTJ — 바이옴 지형 위의 바다: 바다는 따뜻한 저지 분지에 고이고, 찬 고지(산)는 섬으로 솟는다(기후+해수면 한 세계)',
    sub: '두 트랙을 한 무대에서 합친다: 2D 바다(0091·SPH 물이 분지에 한 수면) + 바이옴(0092~0095·고도축=실제 지형 → 높은 땅=찬 바이옴). 바다는 따뜻한 저지에, 산은 찬 고지에 일관되게 자리잡는다. engine 변경 0. 탑다운(따뜻 저지 녹→찬 고지 백·물 파랑).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, CHUNK); },

    makeWorld() { return { N: CAN }; },
    frames: [0, 1, 2, 3],
    // v≥1.5=물(파랑) · v∈[0,1)=땅: 따뜻한 저지(녹)→찬 고지/산(백·만년설).
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [50, 110, 210] : [70 + v * 150, 120 + v * 95, 70 + v * 130] },
    toFrame(w) {
      const G2 = 30, X = [], Y = [], E = [];
      let emin = Infinity, emax = -Infinity;
      for (let j = 0; j < G2; j++) for (let i = 0; i < G2; i++) {
        const x = -R + (i / (G2 - 1)) * 2 * R, y = -R + (j / (G2 - 1)) * 2 * R, e = bf(x, y).effTemp;
        X.push(x); Y.push(y); E.push(e); if (e < emin) emin = e; if (e > emax) emax = e;
      }
      const span = (emax - emin) || 1, pts = [];
      for (let k = 0; k < E.length; k++) {
        const cold = 1 - (E[k] - emin) / span;             // 창 내 대비 스트레치: 찬 고지=1=백·따뜻 저지=0=녹
        pts.push({ cx: (X[k] + SPAN / 2) * SC, cy: (SPAN / 2 - Y[k]) * SC, r: 0.62, v: 0.05 + 0.9 * cold });
      }
      for (const p of w.__water) pts.push({ cx: (p.cx + SPAN / 2) * SC, cy: (SPAN / 2 - p.cy) * SC, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length };
    },

    note: '<b>두 트랙이 한 세계로 만난다 — 바다는 *따뜻한 저지 분지*에 고이고, 찬 *고지(산)*는 섬으로 솟는다(기후와 해수면이 일관).</b> 0091 은 2D 맵 지형 위에 SPH 물로 연속 바다·해안선·섬을 냈다. 0092~0095 는 바이옴(온도·습도·위도·고도)을 쌓아, 고도축에 *실제 지형장*을 먹여 "높은 땅=찬 바이옴"(산이 차다·0095)까지 왔다. 이 step 은 그 둘을 <b>한 무대</b>에서 굴린다(engine 변경 0·새 법칙 0): 같은 지형 높이장이 ⓐ 바다의 분지(물이 고일 낮은 곳)이자 ⓑ 바이옴의 고도축(높은 곳이 찬 산)이다. 그래서 *바다는 따뜻한 저지에, 산은 찬 고지에* 저절로 일관되게 자리잡는다. <b>측정(verify)</b>: ① 바다=저지(바다 31·땅 165·바다지형 8.6 < 땅지형 12.0·물이 낮은 분지에 고임) ② <b>cross-thread 창발</b> 바다 effTemp 0.22 > 섬 0.07(Δ0.15)·섬 34개 중 찬 바이옴 100%(따뜻한 바다↔찬 산이 한 세계에서 자기일관) ③ 물 보존(121→121·발산 없음) ④ 결정론. <b>흐름</b>(capture 4 프레임·탑다운): 살포된 물(파랑)이 낮은 분지로 흘러 고이며 → 따뜻한 저지(녹)는 바다가 되고, 찬 고지(백·만년설)는 해수면 위로 솟아 *산/섬*으로 남는다. <b>큰 그림</b>: 환경(TW)의 두 축(바다·기후)이 마침내 한 화면에 — 게임의 "딛고 다닐 해안·기후대 있는 대륙"에 한 발 더. <b>원칙 준수</b>: 물·지형 한 원소(구체)·바이옴/해안선은 *측정된 장*(타입 0·engine 변경 0). <b>정직한 한계</b>: 유한 SPH 물(깊은 분지부터)·앵커 그릇 경계(열린 해안 아님)·바이옴은 *읽기*(물이 바이옴을 바꾸진 않음·강수→침식 결합은 후속)·탑다운 단일 뷰. 다음: 열린 해안·바이옴 3D 표면·안정 분절 침식.'
  };
});
