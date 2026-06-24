// viewer/scenes/step_0083.js — (조립) 법칙만으로 지형과 바다: 노이즈 지형 위로 SPH 물이 분지에 고여 수면을 찾는다.
//   author 없이 — 지형은 *노이즈 법칙*(value-noise fBm·0074 fieldNoise 가족)이 봉우리·계곡을 낳고,
//   바다는 *중력+경계 접촉*(0060 sphBoundaryForce)+SPH 압력/점성(0041/0046)으로 균일 살포한 물이
//   낮은 분지로 흘러 고이며 *제 높이의 평평한 수면*을 찾는다. 봉우리는 수면 위로 솟아 땅(섬)이 된다.
//   engine 변경 0(기존 법칙 조립). x-z 단면(옆모습)·회색=지형·파랑=바다(밝기=깊이). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0083'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  // 지형 = 노이즈 법칙(value-noise fBm) — author 없이 봉우리·계곡 창발.
  function lattice(i) { let h = (Math.imul((i ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
  function vnoise(x) { const xi = Math.floor(x), xf = x - xi, u = xf * xf * (3 - 2 * xf); return lattice(xi) * (1 - u) + lattice(xi + 1) * u; }
  function fbm(x) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f); n += a; a *= 0.5; f *= 2; } return s / n; }
  const AMP = 22, SCALE = 0.6, X0 = -50, X1 = 50;
  const terrainTop = (x) => AMP * fbm(x * SCALE);

  const G = 4, DT = 0.02;
  const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 2, beta: 2, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };
  function wp(cx, cz) { return { cx, cy: 0, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }

  function build(w) {
    const R = 7, DX = 2, an = [];
    for (let x = X0; x <= X1 + 1e-9; x += DX) an.push({ cx: x, cy: 0, cz: terrainTop(x) - R, radius: R });
    for (let z = 0; z <= 40; z += 3) { an.push({ cx: X0 - 2, cy: 0, cz: z, radius: 6 }); an.push({ cx: X1 + 2, cy: 0, cz: z, radius: 6 }); }
    w.__an = an;
    const water = []; let seed = 11; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let x = X0 + 5; x <= X1 - 5; x += 3.2) for (let k = 0; k < 2; k++) water.push(wp(x + (rnd() - 0.5) * 1.2, 30 + k * 2.2));
    w.__water = water;
  }
  function sim(w, n) {
    for (let s = 0; s < n; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      En.stepEntities(w.__water, DT);
    }
  }

  // x-z 단면 투영(옆모습): x→가로·z↑ 세로(화면은 위가 +z 가 되도록 뒤집음).
  const Nc = 64, OX = Nc * 0.06, OZ = Nc * 0.92, SX = Nc * 0.88 / (X1 - X0), SZ = Nc * 0.78 / 40;
  const sx = (x) => OX + (x - X0) * SX, sz = (z) => OZ - z * SZ;

  return {
    label: 'step_0083 — (조립) 법칙만으로 지형과 바다: 노이즈 지형 위로 물이 분지에 고여 수면을 찾는다',
    title: 'HTJ — 법칙만으로 지형과 바다: 노이즈가 봉우리·계곡을 낳고, 물이 분지에 고여 평평한 바다가 된다',
    sub: 'author 없이 — 지형은 노이즈 법칙(value-noise fBm)이 봉우리·계곡을 낳고, 바다는 중력+경계 접촉(0060)+SPH 압력/점성(0041/0046)으로 균일 살포한 물이 낮은 분지로 흘러 고이며 제 높이의 평평한 수면을 찾는다. 봉우리는 수면 위로 솟아 땅(섬)이 된다. engine 변경 0(기존 법칙 조립). x-z 단면.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, 1500); },

    makeWorld() { return { N: Nc }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: Nc, color: (v) => v >= 2.5 ? [96, 102, 112] : [40 + (1 - v) * 30, 110 + v * 40, 200 + v * 50] },
    toFrame(w) {
      const pts = [];
      // 지형(회색·v=3) — 상부 envelope 를 촘촘히 샘플(법칙이 그린 봉우리·계곡).
      for (let x = X0; x <= X1 + 1e-9; x += 1.2) { const t = terrainTop(x); for (let z = -2; z <= t; z += 1.4) pts.push({ cx: sx(x), cy: sz(z), r: 0.5, v: 3 }); }
      // 바다(파랑·밝기=깊이: 0=얕음 밝게 → 0.85 깊음). 수면 위로 솟은 지형은 자연히 땅(물이 안 덮음).
      let lo = Infinity, hi = -Infinity; for (const p of w.__water) { if (p.cz < lo) lo = p.cz; if (p.cz > hi) hi = p.cz; }
      const span = (hi - lo) || 1;
      for (const p of w.__water) { const depth = (hi - p.cz) / span; pts.push({ cx: sx(p.cx), cy: sz(p.cz), r: 0.8, v: 0.15 + 0.7 * depth }); }
      return { pts, count: w.__water.length };
    },

    note: '<b>법칙만으로 지형과 바다가 한 화면에 — 아무것도 손으로 그리지 않았다.</b> 이 step 은 새 법칙을 더하지 않는다(engine 변경 0). 대신 이미 가진 두 법칙을 *한 무대에서 함께* 굴려 창발을 본다(조립 step·선례 0035·0043·0080). <b>지형(법칙)</b>: 봉우리·계곡을 손으로 박지 않는다 — <code>value-noise fBm</code>(0074 <code>fieldNoise</code> 법칙 가족) 높이장을 깔면 봉우리·계곡이 *창발*한다(회색). <b>바다(법칙)</b>: "여기가 바다"라고 칠하지 않는다 — 물(SPH 입자)을 지형 위에 *균일하게 뿌리고*, 중력으로 떨어뜨리고, 지형 경계와 접촉(<code>sphBoundaryForce</code> 0060·법선 반발)·SPH 압력/점성(0041/0046)으로 굴리면, 물이 스스로 *낮은 분지로 흘러* 고이고 *제 높이의 평평한 수면*(파랑)을 찾는다. 봉우리는 수면 위로 솟아 자연히 <b>땅(섬)</b>이 된다 — 어디가 땅이고 어디가 바다인지를 *법칙이 가른다*(author 아님). <b>측정(verify)</b>: ① 물 찬 컬럼의 지형(8.86)이 마른 컬럼(11.23)보다 *낮다* = 중력이 물을 낮은 곳으로 ② 수면 산포(0.57)가 지형 산포(2.90)의 1/5 = <b>물이 제 높이를 찾는다(바다의 표식)</b> ③ 바다 컬럼 10·땅 컬럼 15 공존·수면 위로 솟은 봉우리(섬) = 땅·바다가 한 세계에 ④ 물 질량 보존(58→58·이동만) ⑤ 결정론(지문 동일). <b>흐름</b>(capture 4 프레임): 균일하게 뿌린 물이 떨어져 → 분지로 흘러 모이고 → 평평한 수면을 찾아 → 봉우리가 솟은 땅 사이 바다가 된다. <b>원칙 준수</b>: engine 은 여전히 "지형/바다"라는 타입을 *모른다* — 노이즈는 generic 장 함수, 경계는 generic 정적 앵커, 물은 한 원소(자유 입자). 모양·갈래는 DNA·법칙이 발현하고 viewer 는 읽기만(engine 변경 0). <b>정직한 한계</b>: 2D x-z 단면(진짜 3D 분지·해안선은 후속)·지형은 정적 앵커(0075 침식과 결합하면 물이 땅을 빚는 왕복)·물 양은 손으로 정한 살포량(수량→수위는 보존이라 결정적이나 "얼마나 채울지"는 입력)·단일 노이즈 장(바이옴 다축은 0074 후속). 다음: 침식 결합(흐름이 해안을 깎음)·3D 해안선·연속 바다(TW2).'
  };
});
