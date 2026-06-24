// viewer/scenes/step_0077.js — SW5 자동 양방향 이주: 밀도별로 격자↔SPH 표현을 *자동 선택*(적응 LOD·SW5 페이오프).
//   0055/0076 이 양방향 이주를 줬다면, autoMigrate 는 *정책*으로 묶어 표현을 자동 고른다(SW4 적응 LOD 0039 의
//   격자↔SPH 판): 밀집/붕괴 코어는 SPH(주황·Lagrangian 이 따라감)·확산 헤일로는 격자(청록·고정 셀로 저렴) →
//   비용이 디테일을 따라간다. 한 세계에 두 표현이 *밀도에 따라 공존*. 중앙 z-슬라이스 top-down.
//
//   engine 법칙(htj-sph.js autoMigrate·VER 18·0055+0076 정책). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0077'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30, RHO_ON = 2.2, RHO_OFF = 0.25;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), c = (N - 1) / 2;
    const rho = g.fields.energy, u = g.fields.therm;
    const sigH = N * 0.26, sigC = N * 0.08;                   // 넓은 헤일로 + 좁은 밀집 코어
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
      const r = 0.7 * Math.exp(-d2 / (2 * sigH * sigH)) + 6.0 * Math.exp(-d2 / (2 * sigC * sigC));
      if (r < 0.04) continue; rho[i] = r; u[i] = r * 0.2;
    }
    w.__grid = g; w.__parts = []; w.__c = c; w.__phase = 0;
  }
  function advance(w) {
    if (w.__phase === 0) {                                    // 적응 이주: 밀집 코어→SPH·확산 헤일로는 격자 유지
      const r = SPH.autoMigrate(w.__grid, w.__parts, { rhoOn: RHO_ON, rhoOff: RHO_OFF });
      w.__parts = r.particles; w.__toSPH = r.toSPH; w.__toGrid = r.toGrid;
      for (const p of w.__parts) { const dx = p.cx - w.__c, dy = p.cy - w.__c, rr = Math.hypot(dx, dy) || 1; p.px += -dy / rr * 1.3; p.py += dx / rr * 1.3; }  // 코어에 소용돌이(Lagrangian 가시화)
      w.__phase = 1;
    } else {                                                  // SPH 코어가 자유로이 움직인다(격자 헤일로는 고정 셀)
      for (let s = 0; s < 16; s++) En.stepEntities(w.__parts, 0.05);
      w.__phase++;
    }
  }
  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round((N - 1) / 2), pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.04) pts.push({ cx: x, cy: y, r: 0.6, v: Math.min(0.95, m / 1.2) }); }
    return pts;
  }
  function partPts(parts) {
    const zc = (N - 1) / 2, pts = [];
    for (const p of parts) { if (Math.abs(p.cz - zc) > 2.2) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.72, v: 1 + Math.min(0.9, (p.mass || 0) / 5) }); }
    return pts;
  }

  return {
    label: 'step_0077 — SW5 자동 양방향 이주: 밀도별 격자↔SPH 적응 선택(SW5 페이오프)',
    title: 'HTJ — 적응 표현: 밀집 코어는 SPH·확산 헤일로는 격자(비용이 디테일을 따라간다)',
    sub: '0055/0076 의 양방향 이주를 autoMigrate 가 정책으로 묶어 표현을 자동 선택(SW4 적응 LOD 0039 의 격자↔SPH 판): 밀집/붕괴 코어는 SPH(Lagrangian)·확산 헤일로는 격자(고정 셀 저렴)·이력(ρ_on>ρ_off)으로 깜빡임 방지·전역 보존. 한 세계에 두 표현이 밀도에 따라 공존. 중앙 z-슬라이스.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { advance(w); },

    makeWorld() { return { N }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N, color: (v) => v >= 1 ? [205, 120 + (v - 1) * 55, 55] : [38, 118 + v * 100, 150 + v * 95] },
    toFrame(w) {
      const pts = gridPts(w.__grid).concat(partPts(w.__parts));   // 격자(청록)+SPH(주황) 공존
      return { pts, grid: gridPts(w.__grid).length, sph: w.__parts.length, toSPH: w.__toSPH || 0, toGrid: w.__toGrid || 0 };
    },

    note: '<b>한 세계에 두 표현이 *밀도에 따라* 공존한다 — 밀집 코어는 SPH(주황), 확산 헤일로는 격자(청록).</b> SW5 의 목표는 격자(Eulerian·고정 셀)와 SPH/자유 구체(Lagrangian·물질 따라감)를 *비용에 맞게* 오가는 것이다. 0051/0055(격자→SPH)·0076(SPH→격자)이 양방향 메커니즘을 줬고, 이 step 의 새 엔진 법칙 <code>autoMigrate</code> 가 그 둘을 *정책*으로 묶어 **표현을 자동 선택**한다 = <b>SW4 적응 LOD(0039·멀면 합치고 가까이 쪼갬)의 격자↔SPH 판</b>: 밀집/붕괴 영역(ρ≥ρ_on)은 SPH 로(Lagrangian 이 붕괴 디테일을 따라감)·확산/조용한 영역(입자셀질량≤ρ_off)은 격자로(고정 셀이 저렴) → *비용이 디테일을 따라간다*. <b>이력(hysteresis)</b>: ρ_on &gt; ρ_off 라 임계 근처에서 표현이 *깜빡이지 않는다*(0025 동결·0039 coarsen 정신·verify 중간 밀도 5회 반복 이주 0). <b>전역 보존</b>: grid→SPH(0055 이동)+SPH→grid(0076 누적) 둘 다 보존이라 (남은 격자+입자) 총 질량·운동량·총E 불변(verify rel 0). <b>흐름</b>(capture 4 프레임): ① 청록 격자 블롭(코어+헤일로) → ② 밀집 코어만 SPH(주황)로 이주·확산 헤일로는 격자(청록) 유지 → ③④ SPH 코어가 자유로이 소용돌이친다(Lagrangian 이 물질을 따라감)·격자 헤일로는 고정 셀로 배경 유지. <b>의미</b>: "은퇴"가 전부-아니면-전무가 아니라 *영역마다 적응* — 디테일이 필요한 곳엔 SPH, 조용한 배경엔 격자. 0026 promote·0031 demote·0039 적응 LOD 가 격자↔SPH 표현 경계에서 한 정책으로 닫힘. <b>정직한 한계</b>: 밀도 프록시는 셀 질량(SPH 커널 밀도 아님)·정책은 단일 임계 쌍(다축·구배 기준 후속)·이주 입자↔격자 통합 중력 미결합(0033 의 SPH 판 후속)·viewer 중앙 z-슬라이스만. 다음: 통합 중력 SPH 판·구배/속도 기준 정책·안정 분절 침식.'
  };
});
