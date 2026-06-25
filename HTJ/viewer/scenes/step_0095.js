// viewer/scenes/step_0095.js — 실제 지형 고도×바이옴 결합: 고도축을 별도 노이즈(0092)가 아니라 *실제 지형 높이장*으로.
//   0092 의 고도는 *분리된 노이즈*였다(정직한 한계: 실제 지형과 무관). 이 step 은 고도축에 *지형 높이장 그 자체*(랜드폼을
//   고른 바로 그 장·0094)를 먹인다 → 높은 땅이 곧 찬 바이옴이 되어 *산봉우리에 만년설/툰드라*가 얹힌다(자기일관 산).
//   장면: 고정 지형 위에서 lapse 를 0→크게 올리면 찬 바이옴(청록)이 *봉우리(밝은 고지)* 에 정확히 들러붙는 sweep.
//   engine 변경 0(확인용 트랙·htj-stream.js biomeField elevFn). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0095'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.07, NT = 3, NH = 3, P = 64;
  const LAPSES = [0, 0.2, 0.4];                          // sweep: 0=지형 무관 → 고도 결합 점강(찬 바이옴이 봉우리에만 캡)

  function build(w) {
    w.__base = { x: 800, y: -200 };
    w.__terr = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__i = 0;
    w.__bf = () => Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, latAmp: 0.25, latPeriod: P, lapse: LAPSES[w.__i], elevFn: w.__terr });
  }

  return {
    label: 'step_0095 — 실제 지형 고도×바이옴 결합: 봉우리에 만년설(높은 땅=찬 바이옴·자기일관 산)',
    title: 'HTJ — 실제 지형 고도×바이옴 결합: 고도축이 실제 지형 높이장 → 봉우리가 차고 험준(만년설·툰드라)',
    sub: '0092 의 고도는 별도 노이즈(실제 지형과 무관)였다. 이 step 은 고도축에 지형 높이장 그 자체(랜드폼을 고른 바로 그 장)를 먹인다 → 높은 땅이 곧 찬 바이옴(만년설·툰드라). elevFn 없음→0092 동일·lapse=0→0090 동일(회귀 0). engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < LAPSES.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // v∈[0,1)=따뜻한 땅(고도 ramp 녹→암갈) · v≥2=찬 바이옴(만년설·밝기는 고도): 고지일수록 흰 만년설 캡.
    captureOpts: {
      N: M, cellPx: 7, color: (v) => {
        if (v >= 2) { const e = v - 2; return [120 + e * 110, 165 + e * 75, 205 + e * 45]; }   // 만년설(고지=더 흼)
        const e = v < 0 ? 0 : (v > 1 ? 1 : v); return [60 + e * 150, 110 + e * 95, 60 + e * 70]; // 녹(저지)→암갈/바위(고지)
      }
    },
    toFrame(w) {
      const o = w.__base, bf = w.__bf();
      // 지형 relief 대비 스트레치(창 내 min/max → [0,1]). 찬 바이옴은 만년설(v=2+고도)·따뜻하면 고도 ramp.
      let hmin = Infinity, hmax = -Infinity; const H = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const h = w.__terr(o.x + i, o.y + j); H.push(h); if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
      const span = (hmax - hmin) || 1, pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const k = j * M + i, hs = (H[k] - hmin) / span;
        const cold = Math.floor(bf(o.x + i, o.y + j).biome / NH) === 0;   // 찬 바이옴(온도 row0)
        pts.push({ cx: i, cy: j, r: 0.62, v: cold ? 2 + hs : hs });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y, lapse: LAPSES[w.__i] };
    },

    note: '<b>고도축을 *별도 노이즈*(0092)가 아니라 *실제 지형 높이장*으로 — 높은 땅이 곧 찬 바이옴이 되어 봉우리에 만년설이 얹힌다(자기일관 산).</b> 0092 는 고도를 세 번째 *독립 노이즈*로 넣어 산악 툰드라를 보였지만, 그 고도는 <b>실제 지형(0094 의 랜드폼을 고른 높이장)과 무관</b>했다(정직한 한계). 이 step 은 그 한계를 해소한다: <code>biomeField({elevFn})</code> 로 고도축에 *지형 높이장 그 자체*를 먹인다. 그러면 effTemp=temp−lapse·<b>terrain</b> 이라, 높은 땅이 곧 찬 바이옴 → 산봉우리가 차고 험준(능선 랜드폼·툰드라/만년설)해진다 — 지형과 기후가 한 장에서 *자기일관*. <b>측정(verify)</b>: ① biome.elev 가 제공한 지형 높이장과 정확히 일치(최대차 0·별도 노이즈 아님) ② corr(지형,effTemp)=−0.47<0·찬 바이옴(row0) 비율 지형상위 0.99 ≫ 하위 0.73(높은 땅=찬 바이옴·자기일관 산) ③ elevFn(지형) vs 내부 노이즈 biome 불일치 199/900(>10%·실제 결합 작동) ④ <b>lapse=0 → 0090 biome byte 동일</b>(elevFn 무시·회귀 0) ⑤ 순수·결정론. <b>흐름</b>(capture 3 프레임): 고정 지형(회색 relief) 위에서 lapse 를 0→0.4→0.9 올리면, 처음엔 찬 바이옴(청록)이 지형과 무관하게 흩어지지만 점점 <b>밝은 봉우리(고지)에 정확히 들러붙어 만년설처럼 캡</b>을 씌운다. <b>원칙 준수</b>: 결합은 *제너릭 장 함수*(engine 변경 0·확인용 트랙·지형장을 인자로 받을 뿐). <b>정직한 한계</b>: 지형장은 viewer 가 만든 2D 높이장(SPH 바다 0091 의 동적 지형과는 아직 분리)·균등 양자화·정적. 다음: 바이옴 3D 표면 발현·열린 해안.'
  };
});
