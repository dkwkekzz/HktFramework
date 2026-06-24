// viewer/scenes/step_0079.js — 입자-메시 중력 CIC(cloud-in-cell) 보간: NGP(셀 해상도·blocky) → trilinear(sub-cell·매끈).
//   0078 PM 중력은 NGP 적치(입자를 한 셀에 몰빵)라 격자력이 셀 해상도로 끊겼다. CIC 는 셀 사이 입자를 8 셀에 부피
//   가중 분배·*같은* 가중으로 힘 수집 → 부드러운 sub-cell 격자력(적치/수집 대칭=순 운동량 보존 유지).
//   장면: 격자 우물(청록)로 떨어지는 SPH 입자 무리(주황)가 CIC 로 *매끄럽게* 모여 휘돈다. 중앙 z-슬라이스.
//
//   engine 법칙(htj-gravity.js applyParticleMeshGravity·opts.cic·VER 3). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0079'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z'];

  const N = 30, G = 1, DT = 0.05, ITERS = 120, C = (N - 1) / 2;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), rho = g.fields.energy, sig = N * 0.12;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {  // 중앙 격자 우물(인력원)
      const d2 = (x - C) ** 2 + (y - C) ** 2 + (z - C) ** 2, r = 11 * Math.exp(-d2 / (2 * sig * sig));
      if (r > 0.03) rho[(z * N + y) * N + x] += r;
    }
    const parts = [], rng = W.mulberry32(11);                  // 가장자리 고리에서 떨어지는 입자(비정렬 위치=CIC sub-cell)
    for (let n = 0; n < 80; n++) {
      const a = (n / 80) * 2 * Math.PI, rr = N * 0.40 + (rng() - 0.5) * 1.5;
      const px0 = C + Math.cos(a) * rr, py0 = C + Math.sin(a) * rr;
      parts.push({ cx: px0, cy: py0, cz: C + (rng() - 0.5) * 2, mass: 2.2,
        px: Math.sin(a) * 2.2 * 1.2, py: -Math.cos(a) * 2.2 * 1.2, pz: 0, KEcm: 0, internalE: 0, energy: 0, radius: 0.6 });  // 접선 속도(궤도)
    }
    w.__grid = g; w.__parts = parts;
  }
  function advance(w) {
    for (let s = 0; s < 7; s++) {
      Grav.applyParticleMeshGravity(w.__grid, w.__parts, DT, { G, iters: ITERS, cic: true });   // CIC 매끄러운 격자력
      for (const p of w.__parts) { const m = p.mass || 1; p.cx += p.px / m * DT; p.cy += p.py / m * DT; p.cz += p.pz / m * DT; }
    }
  }
  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round(C), pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.05) pts.push({ cx: x, cy: y, r: 0.58, v: Math.min(0.95, m / 5) }); }
    return pts;
  }
  function partPts(parts) {
    const pts = [];
    for (const p of parts) { if (Math.abs(p.cz - C) > 3.2) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.66, v: 1.3 }); }
    return pts;
  }

  return {
    label: 'step_0079 — 입자-메시 중력 CIC 보간: NGP(blocky) → trilinear(sub-cell 매끈)',
    title: 'HTJ — CIC 보간: 격자 우물(청록)로 떨어지는 SPH 입자(주황)가 매끄럽게 휘돈다',
    sub: '0078 PM 중력의 NGP 적치(한 셀 몰빵·셀 해상도 격자력)를 CIC(cloud-in-cell·trilinear)로: 셀 사이 입자를 8 셀에 부피 가중 분배·같은 가중으로 힘 수집 → 부드러운 sub-cell 격자력. 적치/수집 대칭이라 순 운동량 보존 유지. cic 안 줌 → NGP=0078 동일. 중앙 z-슬라이스.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { advance(w); },

    makeWorld() { return { N }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N, color: (v) => v >= 1 ? [212, 128, 56] : [38, 120 + v * 100, 152 + v * 90] },
    toFrame(w) {
      const pts = gridPts(w.__grid).concat(partPts(w.__parts));
      return { pts, grid: gridPts(w.__grid).length, sph: w.__parts.length };
    },

    note: '<b>입자-메시 중력의 격자력이 셀 해상도(blocky)에서 *부드러운 sub-cell*(매끈)로.</b> 0078 의 PM 중력은 입자 질량을 가장 가까운 한 셀에 적치(NGP·nearest-grid-point)했다 — 입자가 셀 경계를 넘을 때 격자력이 *점프*하는 한계(0078 정직한 한계로 명시). 이 step 의 <code>applyParticleMeshGravity</code> 의 새 옵션 <code>cic:true</code> 가 그걸 메운다 = <b>CIC(cloud-in-cell·trilinear) 보간</b>: 셀 *사이*에 놓인 입자를 둘러싼 <b>8 셀에 부피 가중 분배</b>(적치)하고, 힘은 *같은* 8 가중으로 수집(gather)한다 → 입자가 미끄러져 움직여도 격자력이 *연속*으로 변한다(verify: 0.1 이동당 힘 점프 CIC 2.1 ≪ NGP 21·10× 매끈). <b>순 운동량 보존 유지</b>: 적치와 수집이 *같은 가중*(대칭)이라 평균 가속 차감으로 Σp=0 정확(scheme 무관·verify 1e-13). <b>항등</b>: <code>cic</code> 안 주면 NGP = 0078 byte 동일(정수 좌표 입자는 CIC weight=1 단일 셀 → 둘이 같음·verify 일치). <b>장면</b>(capture 4 프레임): 가장자리 고리에서 접선 속도로 출발한 주황 SPH 입자 무리가 중앙 청록 격자 우물의 중력에 *매끄럽게* 끌려 휘돌며 모인다(NGP 면 셀 경계마다 미세하게 덜컹). <b>의미</b>: PM 통합 중력(0078)이 sub-cell 정밀도로 올라서 — 이주 입자가 격자와 *매끄럽게* 한 중력장을 이룬다. <b>정직한 한계</b>: TSC(2차) 더 매끈하나 미도입·격자는 배경(이류 생략)·입자 SPH 압력/점성은 직교(중력만). 다음: autoMigrate+PM 중력 조립(자기중력 붕괴→밀집 코어 SPH 이주가 중력적으로 결합)·구배 기준 이주.'
  };
});
