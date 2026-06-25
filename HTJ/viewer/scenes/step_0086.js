// viewer/scenes/step_0086.js — (조립) SW5 통합 루프: 격자+SPH 가 한 세계에 공존하며 단일 Φ 로 함께 굴러간다.
//   0080(autoMigrate+PM 중력) 위에 *완전한 루프*: autoMigrate(0077) + SPH 압력/점성(0041/0046) + PM 중력
//   (TSC 0084) + 격자 이류 advect(0006) + stepEntities(0027). 밀집 격자(우)는 SPH 로 이주해 유체로 거동,
//   옅은 격자(좌)는 advect 로 함께 흐르고, 둘은 *같은 Φ* 로 서로 끈다 — 한 세계, 두 표현, 하나의 물리.
//   engine 변경 0(기존 법칙 조립). z 중앙 슬라이스·청록=격자 밀도·주황=SPH 입자. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0086'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const In = require ? require('../../engine/htj-inertia.js') : self.HTJInertia;

  const N = 16, DT = 0.04, ZC = 8;
  const popt = { stiffness: 4, h: 2.2, gamma: 1.4 }, vopt = { alpha: 0.6, beta: 1, h: 2.2, gamma: 1.4 };
  function blob(rho, cx, cy, cz, val, sig) { for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] += val * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / sig); }

  function build(w) {
    const g = W.createWorld(N); if (!g.fields.energy) g.addField('energy'); for (const f of ['mom_x', 'mom_y', 'mom_z']) if (!g.fields[f]) g.addField(f);
    blob(g.fields.energy, 4, 8, ZC, 6, 4); blob(g.fields.energy, 11, 8, ZC, 34, 3);
    w.__grid = g; w.__P = [];
  }
  function sim(w, n) {
    for (let s = 0; s < n; s++) {
      const r = Sph.autoMigrate(w.__grid, w.__P, { rhoOn: 12, rhoOff: 0.01 }); w.__P = r.particles;
      if (w.__P.length) { Sph.sphPressureForce(w.__P, DT, popt); Sph.sphViscosity(w.__P, DT, vopt); }
      Grav.applyParticleMeshGravity(w.__grid, w.__P, DT, { G: 1, iters: 110, tsc: true });
      In.advect(w.__grid, DT); En.stepEntities(w.__P, DT);
    }
  }

  const Nc = 48, SC = Nc / N;
  return {
    label: 'step_0086 — (조립) SW5 통합 루프: 격자+SPH 가 한 세계에 공존하며 단일 Φ 로 함께 굴러간다',
    title: 'HTJ — SW5 통합 루프: 한 세계, 두 표현(격자+SPH), 하나의 물리(단일 Φ)',
    sub: '0080(autoMigrate+PM 중력) 위에 완전한 루프: autoMigrate + SPH 압력/점성(0041/0046) + PM 중력(TSC 0084) + 격자 이류 advect(0006) + stepEntities. 밀집 격자(우)는 SPH 로 이주해 유체로 거동, 옅은 격자(좌)는 advect 로 함께 흐르고, 둘은 같은 Φ 로 서로 끈다. engine 변경 0. 청록=격자·주황=SPH.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, 6); },

    makeWorld() { return { N: Nc }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: Nc, color: (v) => v >= 0.6 ? [255, 150, 45] : [25 + v * 40, 80 + v * 230, 100 + v * 240] },   // 주황=SPH·청록=격자 밀도
    toFrame(w) {
      const g = w.__grid.fields.energy, pts = [];
      let gmax = 1e-9; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = g[(ZC * N + y) * N + x]; if (v > gmax) gmax = v; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {   // 격자 밀도(청록·z 중앙 슬라이스)
        const d = g[(ZC * N + y) * N + x] / gmax; if (d > 0.02) pts.push({ cx: (x + 0.5) * SC, cy: (N - 1 - y + 0.5) * SC, r: 1.2, v: 0.08 + 0.45 * d });
      }
      for (const p of w.__P) pts.push({ cx: (p.cx + 0.5) * SC, cy: (N - 1 - p.cz) * SC, r: 0.8, v: 0.75 });   // SPH 입자(주황)
      return { pts, grid: Math.round(gmax * 10) / 10, count: w.__P.length };
    },

    note: '<b>SW5 의 마지막 그림 — 한 세계, 두 표현(격자+SPH), 하나의 물리.</b> SW5 는 격자 유체를 SPH 로 *은퇴*시키는 트랙이었다. 0077 이 밀도별 적응 이주(autoMigrate)를, 0078~0084 가 격자+입자를 *단일 Φ* 로 묶는 통합중력(+TSC 보간)을, 0085 가 격자 없이 입자만의 자기중력 붕괴를 보였다. 이 step 은 그 모두를 *한 루프*로 합친다(조립·engine 변경 0): 매 step <code>autoMigrate</code>(밀집 격자→SPH·확산 SPH→격자) → <code>sphPressureForce</code>+<code>sphViscosity</code>(이주 입자가 *유체로* 거동) → <code>applyParticleMeshGravity</code>{tsc}(격자+입자 단일 Φ) → <code>advect</code>(격자 배경도 *함께 흐름*) → <code>stepEntities</code>. <b>0080 대비 새로움</b>: ② 이주 입자의 SPH 내부물리(압력/점성·0080 은 중력만) ③ 격자 이류 합류(0080 은 격자 정지). <b>측정(verify)</b>: ① 격자(옅은 좌)+SPH(밀집 우) 공존·같은 Φ 로 상호인력(격자 px +·입자 px −·합≈0) ② Σ internalE 6004>0(이주 입자가 유체로 가열) ③ advect 전후 격자 L1 차 40.4>0(격자도 Φ 로 흐름) ④ 통합 루프 30회 전역 질량 보존(rel 2e-15)·순 운동량 Σp≈1e-13(정지 시작) ⑤ 결정론. <b>흐름</b>(capture 4 프레임): 우측 밀집 덩어리가 <span style="color:#fb8">SPH(주황)</span>로 이주해 유체로 뭉치고, 좌측 옅은 <span style="color:#5cc">격자(청록)</span>는 advect 로 흐르며, 둘이 같은 Φ 로 서로 끌려 한 세계에서 함께 진화한다. <b>원칙 준수</b>: 격자·SPH 는 같은 질량의 *두 표현*일 뿐 engine 은 "격자/입자" 타입을 분기하지 않는다(autoMigrate=밀도 적응·중력=한 Φ). <b>정직한 한계</b>: 격자 advect 1차 수치확산·주기 경계 PM(고립계 근사)·유한 코어 비리얼 평형 미세조정 후속·viewer z 중앙 슬라이스. SW5 골격은 이로써 닫힌다(격자↔SPH 적응·통합중력·은퇴·통합 루프). 다음: 발산(충격면) 축·이주 이력·안정 분절 침식 등 후속 정밀화.'
  };
});
