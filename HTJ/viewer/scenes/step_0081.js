// viewer/scenes/step_0081.js — 구배(전단) 기준 적응 이주: |∇v| 큰 영역도 SPH 로(디테일=밀도뿐 아니라 속도 변화).
//   0077 autoMigrate 는 밀도(셀 질량)만으로 격자↔SPH 를 골랐다. 디테일은 밀도만이 아니다 — 속도가 공간적으로
//   빠르게 변하는 전단·소용돌이 영역은 고정 셀 격자가 수치 확산으로 뭉개고 Lagrangian(SPH)이 더 잘 좇는다.
//   gridShearField(|∇v|)≥shearOn 인 셀도 SPH 로. 장면: 위/아래 반대 흐름의 *전단층*(중앙)만 SPH(주황)·균일 흐름은 격자(청록).
//
//   engine 법칙(htj-sph.js autoMigrate+gridShearField·VER 19). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0081'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30, SHEAR_ON = 0.35, C = (N - 1) / 2;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), rho = g.fields.energy, mx = g.fields.mom_x;
    // 박스 전체 균일 밀도 + 전단층: 위(y<C) +x 흐름·아래(y≥C) −x 흐름 → 오직 중앙 y≈C 띠만 큰 |∇v|(반대 방향 만남).
    // 박스를 꽉 채워 rho=0 경계(가짜 전단)를 없앤다 — 전단은 y=C 계면 하나뿐.
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; rho[i] = 1; mx[i] = (y < C ? 3 : -3);   // vx 가 y=C 에서 +3↔−3 급변(큰 전단)
    }
    w.__grid = g; w.__parts = []; w.__phase = 0;
  }
  function advance(w) {
    if (w.__phase === 0) {                                       // 전단층만 SPH 로 이주(균일 흐름은 격자)
      const r = SPH.autoMigrate(w.__grid, w.__parts, { shearOn: SHEAR_ON });
      w.__parts = r.particles; w.__toSPH = r.toSPH;
      for (const p of w.__parts) p.px = (p.cy < C ? 3 : -3) * (p.mass || 1) * 0.25;  // 이주 속도 이어받기(가시화)
    } else {                                                     // SPH 전단층 입자가 반대 흐름으로 미끄러진다(Lagrangian)
      for (let s = 0; s < 10; s++) En.stepEntities(w.__parts, 0.05);
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
    label: 'step_0081 — 구배(전단) 기준 적응 이주: |∇v| 큰 전단층만 SPH(디테일=속도 변화)',
    title: 'HTJ — 전단 기준 이주: 반대 흐름이 만나는 전단층(주황)만 SPH·균일 흐름(청록)은 격자',
    sub: '0077 의 밀도 기준 autoMigrate 에 전단 기준을 더한다(gridShearField·|∇v|≥shearOn). 디테일은 밀도뿐 아니라 속도가 빠르게 변하는 곳(전단·소용돌이) — 고정 셀 격자가 수치 확산으로 뭉개는 곳을 Lagrangian SPH 가 좇는다. 위/아래 반대 흐름의 전단층만 SPH 로. 중앙 z-슬라이스.',
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

    note: '<b>디테일은 밀도만이 아니다 — *속도가 빠르게 변하는* 곳(전단)도 SPH 가 맡는다.</b> 0077 의 <code>autoMigrate</code> 는 셀 질량(밀도 프록시) 하나로 격자↔SPH 를 골랐다(밀집→SPH·확산→격자). 하지만 "비용이 디테일을 따라간다"의 *디테일*은 밀도뿐이 아니다: 속도가 공간적으로 빠르게 변하는 <b>전단·소용돌이·충돌면</b>은 고정 셀 격자(Eulerian)가 수치 확산으로 뭉개고, 물질을 따라가는 SPH(Lagrangian)가 훨씬 잘 좇는다. 이 step 의 새 측정자 <code>gridShearField</code>(셀별 |∇v|=√Σ(∂v_i/∂x_j)²)가 그 곳을 짚고, <code>autoMigrate({shearOn})</code> 가 |∇v|≥shearOn 인 셀도 SPH 로 보낸다(밀도 OR 전단). <b>장면</b>(capture 4 프레임): 위(+x 흐름)·아래(−x 흐름)가 만나는 *전단층*(중앙 띠)만 주황 SPH 로 이주하고, 균일 흐름 영역은 청록 격자로 남는다 → 이후 SPH 전단층 입자가 반대 흐름으로 미끄러진다(Lagrangian). <b>검증</b>: 같은 밀도(ρ=1)라도 전단 큰 띠만 SPH·균일 내부는 격자(verify)·밀도+전단 OR 결합·전역 보존(이주=이동·rel 0)·shearOn 안 줌→0077 동일. <b>의미</b>: 표현 적응 정책이 단일 임계(밀도)에서 *다축*(밀도+구배)으로 — 0077 의 한계(단일 임계 쌍)를 한 축 넓힌다. <b>정직한 한계</b>: |∇v| 만(와도·발산 분해 안 함)·단일 shearOn 임계·이력 없음(전단은 hysteresis 미적용)·viewer 중앙 z-슬라이스만. 다음: 와도/발산 분해·전단 이력·격자 이류 합류.'
  };
});
