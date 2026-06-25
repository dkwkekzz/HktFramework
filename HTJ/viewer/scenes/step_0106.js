// viewer/scenes/step_0106.js — 이주 이력(hysteresis): autoMigrate 의 minDwell 이 임계 근처 격자↔SPH *깜빡임*을 막는다.
//   저밀도+고전단 셀은 격자→SPH(전단 큼)→즉시 SPH→격자(밀도 작음)를 *매 call 깜빡인다*(전단 축은 복귀 임계 없음).
//   minDwell 이 갓 이주한 입자를 minDwell call 동안 격자 복귀에서 면제 → 깜빡임 급감. 두 경우(이력 0 vs 이력 K)의
//   *격자 복귀(깜빡임) 시계열*을 나란히 그려 비교한다(위=이력 없음·빽빽·아래=이력·드뭄). engine 법칙(minDwell=0→회귀 0).
//   UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0106'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];
  const N = 8;

  function world() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); const c = (N - 1) / 2;
    const rho = w.fields.energy, mx = w.fields.mom_x;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (z * N + y) * N + x; rho[i] = 1; mx[i] = 2.0 * (y - c); }
    return w; }

  function build(w) {
    w.__w0 = world(); w.__p0 = []; w.__h0 = [];                    // 이력 없음(minDwell=0)
    w.__wH = world(); w.__pH = []; w.__hH = [];                    // 이력(minDwell=6)
    w.__maxG = 1;
  }
  function step(w) {
    const r0 = Sph.autoMigrate(w.__w0, w.__p0, { shearOn: 1.0, rhoOff: 1.0, minDwell: 0 });
    w.__p0 = r0.particles; w.__h0.push(r0.toGrid);
    const rH = Sph.autoMigrate(w.__wH, w.__pH, { shearOn: 1.0, rhoOff: 1.0, minDwell: 6 });
    w.__pH = rH.particles; w.__hH.push(rH.toGrid);
    w.__maxG = Math.max(w.__maxG, r0.toGrid, rH.toGrid);
  }

  const CAN = 48, T = 40;
  return {
    label: 'step_0106 — 이주 이력(hysteresis): minDwell 이 임계 근처 격자↔SPH 깜빡임을 막는다',
    title: 'HTJ — 이주 이력(hysteresis): 저밀도+고전단 셀의 격자↔SPH 깜빡임을 minDwell 이 끊는다',
    sub: '전단/와도/발산 축은 복귀 임계가 없어 저밀도+고전단 셀이 매 call 격자↔SPH 깜빡인다(불필요 이주). minDwell 이 갓 이주 입자를 K call 복귀 면제 → 깜빡임 급감. 위=이력 없음(빽빽)·아래=이력(드뭄). engine 법칙(minDwell=0→회귀 0).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { step(w); },

    makeWorld() { return { N: CAN }; },
    frames: [9, 19, 29, 39],
    // v: 1=이력없음(빨강·깜빡임)·2=이력(파랑·억제)·0.x=배경/축.
    captureOpts: { N: CAN, color: (v) => v >= 2 ? [80, 150, 240] : (v >= 1 ? [225, 90, 70] : [40, 44, 52]) },
    toFrame(w) {
      const pts = []; const x0 = 4, x1 = CAN - 3, baseTop = 22, baseBot = CAN - 4, barH = 16;
      const xAt = (t) => x0 + (x1 - x0) * (t / (T - 1));
      // 두 베이스라인(축)
      for (let t = 0; t < T; t++) { const x = xAt(t); pts.push({ cx: x, cy: baseTop, r: 0.35, v: 0.3 }); pts.push({ cx: x, cy: baseBot, r: 0.35, v: 0.3 }); }
      // 막대 — 각 call 의 격자 복귀(toGrid) 높이(정규화). 위=이력없음(빨강)·아래=이력(파랑).
      const draw = (hist, base, up, v) => {
        for (let t = 0; t < hist.length; t++) { const x = xAt(t), h = barH * Math.min(1, hist[t] / w.__maxG);
          for (let yy = 0; yy <= h; yy += 0.9) pts.push({ cx: x, cy: base + (up ? -yy : yy), r: 0.55, v }); }
      };
      draw(w.__h0, baseTop, true, 1.0);                           // 이력 없음 — 위로(빨강)
      draw(w.__hH, baseBot, false, 2.0);                          // 이력 — 아래로(파랑)
      return { pts, count: w.__h0.reduce((s, g) => s + g, 0) };
    },

    note: '<b>임계 근처에서 격자↔SPH 가 매 call *깜빡이는* 낭비를 *이주 이력(hysteresis)* 이 끊는다.</b> 적응 이주(0077·0081·0082·0089)는 밀도·전단·와도·발산 4축으로 디테일 영역을 SPH 로 올린다. 그런데 SPH→격자 *복귀* 는 *밀도(rhoOff)* 만 본다 — 전단/와도/발산 축엔 복귀 임계가 없다. 그래서 *저밀도+고전단* 셀은 격자→SPH(전단 큼)→즉시 SPH→격자(밀도 작음)를 *매 call 깜빡인다*(불필요 이주·캐시 무효화·결정론 잡음). 이 step 은 그 깜빡임을 *상태 기억*으로 끊는다: <code>minDwell</code> — 갓 격자→SPH 이주한 입자는 minDwell call 동안 격자 복귀에서 *면제*(p.migDwell 카운터). 그 사이 셀은 SPH 로 *머문다*(디테일이니 SPH 가 맞다). <b>가법·회귀 0</b>: minDwell=0 → 면제 0 → 0089 byte 동일. <b>측정(verify)</b>: ① <b>깜빡임 방지</b> 12 call 격자 복귀 이벤트 6144 → (이력6) 512(8%·≪50%) ② 이력 중 SPH 유지(복귀 0 → held↑) ③ <b>항등</b> minDwell=0 → 0089 동일 ④ 전역 질량 보존(이력은 *시점만* 늦춤·이주=이동) ⑤ 결정론. <b>흐름</b>(capture·시계열): 위 트랙(이력 없음·빨강)은 *거의 매 call* 격자 복귀 막대가 선다(깜빡임)·아래 트랙(이력·파랑)은 막대가 *드문드문*(억제). <b>큰 그림</b>: 적응 이주가 *떨림 없이* 안정 — 디테일 영역이 들락날락 안 하고 자리잡는다(비용·결정론 안정). <b>원칙 준수</b>: 이력은 generic 이주 정책(타입 0)·축 무관. <b>정직한 한계</b>: dwell 후엔 다시 평가(영구 고정 아님·여전히 주기 K 잔여 깜빡임)·셀이 아니라 입자에 dwell(이주 단위)·전단 복귀 임계 자체(shearOff)는 후속 선택. 다음(디테일 마무리): 바이옴 3D 표면·안정 분절 침식 등.'
  };
});
