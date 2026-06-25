// viewer/scenes/step_0085.js — (조립) 격자 장면을 SPH 로: 자기중력 붕괴가 격자 질량 0 으로 입자만으로.
//   0007 이 격자 ρ 의 Poisson 으로 하던 자기중력 붕괴를, 격자를 *비운 채* 입자(SPH)만으로 재현한다 —
//   sphPressureForce(0041)+sphViscosity(0046)+applyParticleMeshGravity(0078/0084 TSC)+stepEntities(0027).
//   입자 블롭이 스스로 끌려 모이고, 낙하 KE 가 점성으로 열(internalE)이 돼 코어가 *달궈진다*(별 형성).
//   engine 변경 0(기존 법칙 조립). x-z 투영·밝기=열(internalE). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0085'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const N = 20, CTR = (N - 1) / 2, G = 10, DT = 0.016, NP = 150, R0 = 4;
  const popt = { stiffness: 6, h: 2.6, gamma: 1.5 }, vopt = { alpha: 0.8, beta: 1.2, h: 2.6, gamma: 1.5 };
  function mk(cx, cy, cz) { return { cx, cy, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }

  function build(w) {
    w.__grid = W.createWorld(N); if (!w.__grid.fields.energy) w.__grid.addField('energy'); for (const f of ['mom_x', 'mom_y', 'mom_z']) if (!w.__grid.fields[f]) w.__grid.addField(f);
    const P = []; let seed = 9; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < NP; i++) { let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1); P.push(mk(CTR + x * R0, CTR + y * R0, CTR + z * R0)); }
    w.__P = P;
  }
  function sim(w, n) {
    for (let s = 0; s < n; s++) {
      Sph.sphPressureForce(w.__P, DT, popt); Sph.sphViscosity(w.__P, DT, vopt);
      Grav.applyParticleMeshGravity(w.__grid, w.__P, DT, { G, iters: 80, tsc: true });
      En.stepEntities(w.__P, DT);
    }
  }

  const Nc = 48, SC = Nc / N;
  return {
    label: 'step_0085 — (조립) 격자 장면을 SPH 로: 자기중력 붕괴가 격자 질량 0 으로 입자만으로',
    title: 'HTJ — 격자 은퇴: 자기중력 붕괴를 입자(SPH)만으로(격자 질량 0)·낙하가 코어를 달군다',
    sub: '0007 이 격자 ρ 의 Poisson 으로 하던 자기중력 붕괴를, 격자를 비운 채 입자(SPH)만으로 재현한다 — sphPressureForce(0041)+sphViscosity(0046)+PM 중력(0078/0084 TSC)+stepEntities(0027). 입자 블롭이 스스로 모이고 낙하 KE 가 점성으로 열(internalE)이 돼 코어가 달궈진다(별 형성). engine 변경 0. 밝기=열.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, 55); },

    makeWorld() { return { N: Nc }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: Nc, color: (v) => [60 + v * 195, 70 + v * 150, 160 - v * 40] },   // 찬 파랑 → 뜨거운 흰/노랑(열)
    toFrame(w) {
      const P = w.__P, pts = [];
      let hmax = 1e-9; for (const p of P) if ((p.internalE || 0) > hmax) hmax = p.internalE;
      for (const p of P) { const heat = (p.internalE || 0) / hmax; pts.push({ cx: p.cx * SC, cy: (N - 1 - p.cz) * SC, r: 0.9, v: 0.2 + 0.8 * heat }); }
      return { pts, count: P.length };
    },

    note: '<b>격자 은퇴 — 0007 이 격자로 하던 자기중력 붕괴를, 격자를 *비운 채* 입자(SPH)만으로 한다.</b> 이 step 은 새 법칙을 더하지 않는다(engine 변경 0·조립). 0007 의 보편중력은 *격자 밀도장 ρ 의 Poisson*(자기중력)으로 별·돌을 낳았다. SW5 의 목표는 그 격자를 SPH 입자로 *은퇴*시키는 것 — 이 무대는 그게 가능함을 보인다: 입자 블롭에 <code>sphPressureForce</code>(0041·압력)+<code>sphViscosity</code>(0046·점성)+<code>applyParticleMeshGravity</code>(0078 통합중력·0084 TSC 보간)+<code>stepEntities</code>(0027)를 굴리면, <b>격자 질량이 0</b>인데도 입자가 *스스로 끌려* 모인다(PM 중력이 입자 질량을 격자에 적치→단일 Φ→입자 가속). <b>측정(verify)</b>: ① RMS 반경 3.03→0.12(< 0.5×r0·격자 없이 붕괴) ② Σ|격자 장|=0(순수 SPH 가 옛 격자 자기중력을 대신) ③ 붕괴 가열 Σ internalE=4085>0(낙하 KE→점성으로 열·압력 OFF 면 0·비가역=별 형성 시그니처·0011/0046 의 입자 판) ④ 질량 150 보존·순 운동량 Σp≈1e-14(정지 시작) ⑤ 결정론. <b>흐름</b>(capture 4 프레임): 흩어진 찬 블롭(파랑)이 자기중력으로 모여들며 → 코어가 점점 <span style="color:#fe8">뜨거워진다</span>(흰/노랑·낙하가 열로) → 격자 한 칸 없이 별이 빚어진다. <b>원칙 준수</b>: engine 은 "별/격자" 타입을 모름 — 입자=한 원소, 중력=한 Φ, 열=internalE 일반량. <b>정직한 한계</b>: 유한 코어 비리얼 평형은 미세조정 필요(여기선 붕괴+가열까지·압력 코어 안정화는 후속)·주기 경계 PM(고립계 근사)·viewer 는 x-z 투영. 다음(SW5 마무리): 격자+SPH 가 *한 세계에 공존*하며 autoMigrate 로 적응 이주하는 통합 루프.'
  };
});
