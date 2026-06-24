// viewer/scenes/step_0080.js — (조립) autoMigrate(0077) + 입자-메시 중력(0078/0079) 한 무대: 적응 표현 + 통합 중력.
//   밀집 격자 영역이 SPH 로 이주(autoMigrate)한 뒤에도 *같은 Φ* 로 격자와 중력 결합(applyParticleMeshGravity·CIC).
//   엔진 변경 0 — 기존 두 법칙을 한 장면에서 함께 굴려 SW5 페이오프(표현은 적응·중력은 하나)를 보인다.
//   장면: 옅은 격자 구름(좌·청록)+밀집 덩어리(우)가 SPH 로 이주(주황)→둘이 같은 중력장으로 끌려 합류. 중앙 z-슬라이스.
//
//   engine 법칙 0(조립). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0080'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30, G = 1, DT = 0.05, ITERS = 110, RHO_ON = 3.0, RHO_OFF = 0.02, C = (N - 1) / 2;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function blob(rho, cx, cy, val, sig) {
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = val * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - C) ** 2) / (2 * sig * sig));
      if (r > 0.03) rho[(z * N + y) * N + x] += r;
    }
  }
  function build(w) {
    const g = emptyWorld(), rho = g.fields.energy;
    blob(rho, N * 0.32, C, 1.4, N * 0.11);                    // 좌: 옅은 격자 구름(< rhoOn → 격자 유지)
    blob(rho, N * 0.70, C, 7.0, N * 0.07);                    // 우: 밀집 덩어리(≥ rhoOn → SPH 이주)
    w.__grid = g; w.__parts = []; w.__phase = 0;
  }
  function advance(w) {
    const r = SPH.autoMigrate(w.__grid, w.__parts, { rhoOn: RHO_ON, rhoOff: RHO_OFF });   // 밀집→SPH·옅은 건 격자
    w.__parts = r.particles;
    for (let s = 0; s < 6; s++) {
      Grav.applyParticleMeshGravity(w.__grid, w.__parts, DT, { G, iters: ITERS, cic: true });  // 격자+입자 같은 Φ
      for (const p of w.__parts) { const m = p.mass || 1; p.cx += p.px / m * DT; p.cy += p.py / m * DT; p.cz += p.pz / m * DT; }
    }
    w.__phase++;
  }
  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round(C), pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.05) pts.push({ cx: x, cy: y, r: 0.58, v: Math.min(0.95, m / 2) }); }
    return pts;
  }
  function partPts(parts) {
    const pts = [];
    for (const p of parts) { if (Math.abs(p.cz - C) > 3.2) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.66, v: 1.3 }); }
    return pts;
  }

  return {
    label: 'step_0080 — (조립) 적응 이주 + 입자-메시 통합 중력: 표현은 적응·중력은 하나',
    title: 'HTJ — 조립: 밀집 영역이 SPH 로 이주(주황)해도 격자 구름(청록)과 같은 중력장으로 합류',
    sub: 'autoMigrate(0077·밀집→SPH·확산→격자)와 applyParticleMeshGravity(0078/0079·격자+입자 단일 Φ·CIC)를 한 무대에서 함께 굴린다. 엔진 변경 0(조립). 밀집 덩어리가 SPH 로 이주한 뒤에도 격자 구름과 *서로* 끌려 합류 — 표현은 적응 선택, 중력은 하나. 중앙 z-슬라이스.',
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

    note: '<b>표현은 *적응 선택*(격자↔SPH)되고 중력은 *하나*다 — SW5 페이오프를 한 무대에서.</b> 이 step 은 새 엔진 법칙을 더하지 않는다(조립 step). 이미 가진 두 법칙을 한 장면에서 *함께* 굴린다: <code>autoMigrate</code>(0077·밀집/붕괴 영역은 SPH·확산 영역은 격자로 자동 선택)과 <code>applyParticleMeshGravity</code>(0078·격자 유체+SPH 입자가 단일 Φ 공유, 0079·CIC sub-cell). <b>합쳐서 생기는 것</b>: 밀집 덩어리(우)가 SPH 입자로 *이주*한 뒤에도, 옅은 격자 구름(좌)과 *같은 중력 퍼텐셜*로 묶여 서로 끌려 합류한다(verify: 격자 +x·입자 −x·합≈0·전역 운동량/질량 보존 rel 1e-16). 0078 까지는 입자를 손으로 놓아 결합을 보였다면, 여기선 입자가 *autoMigrate 의 결과로 생겨* 그대로 중력 결합된다 — 두 메커니즘이 한 루프로 닫힌다. <b>장면</b>(capture 4 프레임): ① 옅은 격자 구름(좌·청록)+밀집 덩어리(우) → 밀집만 SPH(주황)로 이주 → ②③④ SPH 무리가 격자 구름의 중력에 끌려 좌로 휘며 합류(격자도 입자 쪽으로 당겨짐). <b>의미</b>: "격자 은퇴"가 표현 적응(0077)에 그치지 않고 *중력적으로도 한 세계* — 디테일 필요한 곳은 SPH, 조용한 배경은 격자, 그러나 둘은 하나의 중력장. SW5 적응 이주 루프(0051→0055→0076→0077)와 통합 중력(0078/0079)이 한 무대에서 만난다. <b>정직한 한계</b>: 격자는 배경(이류 생략·입자만 자유 운동)·단일 임계 쌍 정책·viewer 중앙 z-슬라이스만. 다음: 구배/속도 기준 적응 이주·격자 이류 합류·안정 분절 침식.'
  };
});
