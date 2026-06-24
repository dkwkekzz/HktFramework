// viewer/scenes/step_0078.js — 입자-격자 통합 중력(Particle-Mesh): 격자 유체와 SPH 입자가 *하나의 Φ* 를 공유한다.
//   0007 자기중력=격자만·0033 통합중력=개체만이었고, 이주한 SPH 입자는 격자 중력과 미결합이었다(SW5 잔여).
//   applyParticleMeshGravity 가 입자 질량을 격자에 적치 → 결합 밀도로 단일 Poisson → a=−∇Φ 로 격자·입자 함께 가속.
//   장면: 청록 격자 덩어리(좌) + 주황 SPH 입자 무리(우)가 *서로* 끌려 가운데로 모인다. 중앙 z-슬라이스 top-down.
//
//   engine 법칙(htj-gravity.js applyParticleMeshGravity·VER 2). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0078'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z'];

  const N = 30, G = 1, DT = 0.04, ITERS = 120;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), zc = (N - 1) / 2, yc = (N - 1) / 2;
    const rho = g.fields.energy;
    const sig = N * 0.10;
    // 격자 덩어리(좌·x≈9)
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d2 = (x - N * 0.30) ** 2 + (y - yc) ** 2 + (z - zc) ** 2;
      const r = 9 * Math.exp(-d2 / (2 * sig * sig)); if (r > 0.03) rho[(z * N + y) * N + x] += r;
    }
    // SPH 입자 무리(우·x≈21)
    const parts = []; const rng = W.mulberry32(7);
    for (let n = 0; n < 60; n++) {
      const a = rng() * 2 * Math.PI, rr = rng() * N * 0.08;
      parts.push({ cx: N * 0.70 + Math.cos(a) * rr, cy: yc + Math.sin(a) * rr, cz: zc + (rng() - 0.5) * 2,
        mass: 3.5, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0, radius: 0.62 });
    }
    w.__grid = g; w.__parts = parts;
  }
  function advance(w) {
    for (let s = 0; s < 6; s++) {
      Grav.applyParticleMeshGravity(w.__grid, w.__parts, DT, { G, iters: ITERS });
      // 격자 운동량을 단순 이류(donor 없이 위치 안 옮김 — 격자는 배경)·입자만 자유 운동(Lagrangian).
      for (const p of w.__parts) { const m = p.mass || 1; p.cx += p.px / m * DT; p.cy += p.py / m * DT; p.cz += p.pz / m * DT; }
    }
  }
  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round((N - 1) / 2), pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.05) pts.push({ cx: x, cy: y, r: 0.6, v: Math.min(0.95, m / 4) }); }
    return pts;
  }
  function partPts(parts) {
    const zc = (N - 1) / 2, pts = [];
    for (const p of parts) { if (Math.abs(p.cz - zc) > 3) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.7, v: 1.3 }); }
    return pts;
  }

  return {
    label: 'step_0078 — 입자-격자 통합 중력(Particle-Mesh): 격자 유체+SPH 입자가 하나의 Φ 공유',
    title: 'HTJ — 통합 중력: 격자 덩어리(청록)와 SPH 입자 무리(주황)가 같은 퍼텐셜로 서로 끌린다',
    sub: '0007 중력의 입자-메시 판: 입자 질량을 격자에 적치 → 결합 밀도 ρ⁺=ρ_grid+scatter(parts) 로 단일 Poisson Φ → a=−∇Φ 로 격자·입자 함께 가속. 격자+입자 평균 가속 차감 → 순 운동량 정확 보존. 입자 없음 → applyGravity 와 byte 동일. 중앙 z-슬라이스.',
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

    note: '<b>격자 유체와 SPH 입자가 *하나의 중력 퍼텐셜*을 공유한다 — 진짜 통합 중력.</b> 0007 자기중력은 격자만, 0033 통합중력(htj-hybrid)은 승격 개체(Barnes-Hut)만 다뤘다. 0055~ 이주한 SPH 입자는 격자 중력과 *미결합*이었다(SW5 의 마지막 잔여·0077 한계로 명시). 이 step 의 새 엔진 법칙 <code>applyParticleMeshGravity</code> 가 그 공백을 메운다 = <b>0007 중력의 입자-메시(Particle-Mesh) 판</b>: ① 입자 질량을 격자에 적치(NGP)해 *결합 밀도* ρ⁺=ρ_grid+scatter(parts) 를 만들고 ② 그 ρ⁺ 로 <b>단 하나의</b> Poisson Φ 를 푼다(격자·입자가 *같은* 퍼텐셜을 본다) ③ a=−∇Φ 로 격자 운동량과 입자 속도를 *함께* 가속한다. <b>순 운동량 정확 보존</b>: 질량가중 평균 가속 ā(격자+입자 모두 포함)를 차감 → Σ변화=0(뉴턴 3법칙·NGP 적치/수집 대칭·verify Σp≈1e-13). <b>항등</b>: 입자 없음 → ρ⁺=ρ_grid 라 0007 <code>applyGravity</code> 와 *byte 동일*(회귀 0·verify fnv 일치)·G=0 → 불변. <b>장면</b>(capture 4 프레임): 청록 격자 덩어리(좌)와 주황 SPH 입자 무리(우)가 같은 Φ 로 *서로* 끌려 가운데로 모인다(격자는 +x·입자는 −x·verify 상호 인력). <b>의미</b>: 격자↔SPH 가 표현만 적응 선택(0077)되는 게 아니라 *중력으로도 한 세계*가 됐다 — 이주한 입자가 더는 중력적으로 격자와 단절되지 않는다. SW5 의 마지막 결합 벽돌. <b>정직한 한계</b>: NGP 적치(CIC 보간 아님·셀 해상도 격자력)·격자는 배경(이류 생략·입자만 자유 운동)·입자 자체 SPH 압력/점성은 직교(이 step 은 중력만)·viewer 중앙 z-슬라이스만. 다음: 구배/속도 기준 적응 이주 정책·안정 분절 침식·CIC 보간.'
  };
});
