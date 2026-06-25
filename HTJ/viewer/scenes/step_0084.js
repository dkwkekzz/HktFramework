// viewer/scenes/step_0084.js — PM 중력 TSC(Triangular-Shaped Cloud·2차) 보간: CIC(C⁰·kink) → TSC(C¹·매끈).
//   한 입자(셀 사이 위치)의 *적치 밀도장*(__pmrho)을 보간 사다리 세 칸으로 본다: NGP(한 셀·blocky) →
//   CIC(2×2×2·trilinear) → TSC(3×3×3·2차·매끈한 구름). 같은 입자, 같은 위치, scheme 만 바뀐다.
//   engine: htj-gravity.js applyParticleMeshGravity opts.tsc(VER 4). z 중앙 슬라이스 heatmap. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0084'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Grav = require ? require('../../engine/htj-gravity.js') : self.HTJGravity;

  const Nc = 16, PX = 8.5, PY = 8.5, PZ = 8, SCHEMES = ['ngp', 'cic', 'tsc'], NAME = { ngp: 'NGP(한 셀·blocky)', cic: 'CIC(2³·trilinear)', tsc: 'TSC(3³·2차·매끈)' };

  function depositField(scheme) {
    const w = W.createWorld(Nc); if (!w.fields.energy) w.addField('energy'); for (const f of ['mom_x', 'mom_y', 'mom_z']) if (!w.fields[f]) w.addField(f);
    const p = { cx: PX, cy: PY, cz: PZ, mass: 12, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 };
    Grav.applyParticleMeshGravity(w, [p], 1e-4, { G: 1e-12, cic: scheme === 'cic', tsc: scheme === 'tsc' });   // 적치만(거의 0 힘)
    return w.fields['__pmrho'];
  }

  return {
    label: 'step_0084 — PM 중력 TSC 보간: CIC(kink) → TSC(2차·매끈한 적치 구름)',
    title: 'HTJ — PM 중력 보간 사다리: NGP(blocky) → CIC(trilinear) → TSC(2차·매끈)',
    sub: '입자-메시 중력의 적치/수집 보간을 한 칸 더: 0079 CIC(2³·1차 trilinear·C⁰ kink) → TSC(3³·2차·C¹). 같은 셀-사이 입자의 적치 밀도장을 본다 — NGP 는 한 셀(blocky), CIC 는 2×2 블록, TSC 는 매끈한 3×3 구름. 적치/수집 대칭→순 운동량 보존·tsc off→0079 동일. z 중앙 슬라이스.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { w.__i = 0; w.__field = depositField(SCHEMES[0]); w.__scheme = SCHEMES[0]; },
    advance(w) { if (w.__i < SCHEMES.length - 1) { w.__i++; w.__scheme = SCHEMES[w.__i]; w.__field = depositField(w.__scheme); } },

    makeWorld() { return { N: Nc }; },
    frames: [0, 1, 2],
    captureOpts: { N: Nc, color: (v) => [30 + v * 60, 40 + v * 90, 90 + v * 160] },   // 어두움→밝은 청색 = 밀도
    toFrame(w) {
      const f = w.__field, N = Nc, z = PZ, pts = [];
      let mx = 0; for (let i = 0; i < f.length; i++) if (f[i] > mx) mx = f[i];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = f[(z * N + y) * N + x] / (mx || 1);
        if (d > 1e-4) pts.push({ cx: (x + 0.5) / N * Nc, cy: (N - 1 - y + 0.5) / N * Nc, r: 1.4, v: 0.15 + 0.85 * d });
      }
      return { pts, scheme: NAME[w.__scheme], cells: pts.length };
    },

    note: '<b>입자-메시 중력의 보간을 한 칸 더 — CIC(1차·kink) → TSC(2차·매끈).</b> 0078 이 입자 질량을 격자에 적치해 격자와 한 Φ 로 묶었고(NGP·한 셀·blocky), 0079 가 CIC(2³ 셀·trilinear)로 sub-cell 매끈함을 줬다. 이 step 은 그 사다리의 다음 칸 <code>opts.tsc</code>: <b>TSC(Triangular-Shaped Cloud)</b> = 가장 가까운 셀 ±1(축마다 3 셀·총 <b>27 셀</b>)에 *2차* 가중 <code>w(d)=½(½∓d)², ¾−d²</code>(Σ=1) 으로 적치/수집. <b>핵심</b>: CIC 가중은 삼각(1차·C⁰)이라 셀 경계서 기울기가 *꺾이고*(kink), TSC 가중은 piecewise-2차(C¹)라 기울기까지 연속 → 입자가 움직여도 격자력이 매끈. <b>측정(verify)</b>: ① 정수 좌표 입자(m=8)도 27 셀로 퍼진다(중심 8·0.75³=3.375·면이웃 0.563·합 8 보존)·CIC 면 한 셀 몰빵 ② 미세 이동당 적치 가중 <b>2차 차분</b>(기울기 점프) 최대 TSC 2.25e-2 ≪ CIC 8.00e-1(35× 매끈·삼각 kink 제거) ③ 적치/수집 대칭→순 운동량 보존(Σp≈1e-12) ④ tsc off→CIC=0079 byte 동일(회귀 0) ⑤ 결정론. <b>흐름</b>(capture 3 프레임): 같은 셀-사이 입자(8.5,8.5)의 적치 밀도장이 NGP(한 밝은 셀·blocky) → CIC(2×2 블록) → TSC(매끈한 3×3 구름)로 *부드러워진다* — verify ②의 "kink 제거"가 화면에 그대로. <b>원칙 준수</b>: 보간은 입자↔격자 generic 적치 규약(타입 무관)·중력은 한 Φ·engine 은 "지형/별" 모름. <b>정직한 한계</b>: 2차까지(3차 PCS 는 더 매끈하나 64 셀·비용↑·미도입)·경계 wrap(주기)·힘은 여전히 중심차분 ∇Φ(격자 해상도 한계)·viewer 는 z 중앙 슬라이스. 다음(SW5): 격자 장면 SPH 점진 대체·입자 SPH+PM 중력 통합 루프.'
  };
});
