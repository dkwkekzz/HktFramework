// viewer/scenes/step_0099.js — (조립) 강이 바이옴을 적신다(riparian): 흐름 누적(0098)이 강가 유효 습도를 올려
//   *강 회랑*이 주변보다 풍성해진다(사막을 가르는 초록 띠·오아시스). 두 트랙을 한 무대에서 합친다(engine 변경 0·새 법칙 0):
//   ① 흐름 누적(0098) ② 바이옴(0090~0097). effHum=clamp01(humidity+ripW·ramp(normLogAcc))·임계 이하=무보정(강가만 적심).
//   장면: ripW 0→0.6 sweep — 마른 땅(모래)에 강을 따라 초록 회랑이 돋는다. engine 변경 0(확인용 트랙). UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0099'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 80, SCALE = 0.06, X0 = 200, Y0 = -150, NT = 3, NH = 3, T = 0.4;
  const RIPW = [0, 0.3, 0.6];                            // sweep: 0=강 무관(0097) → 강가가 점점 풍성(riparian)

  function build(w) {
    w.__elevFn = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__bf = Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, lapse: 0.4, elevFn: w.__elevFn });
    w.__F = Stream.flowAccumulation({ elevFn: w.__elevFn, x0: X0, y0: Y0, W: M, H: M });
    w.__lmax = Math.log(w.__F.maxAcc + 1);
    w.__i = 0;
  }

  return {
    label: 'step_0099 — (조립) 강이 바이옴을 적신다(riparian): 사막을 가르는 초록 강 회랑',
    title: 'HTJ — 강이 바이옴을 적신다(riparian): 흐름 누적이 강가 습도를 올려 사막에 초록 회랑(오아시스)이 돋는다',
    sub: '두 트랙을 한 무대에서: 흐름 누적(0098 강)+바이옴(0090~0097). effHum=clamp01(humidity+ripW·ramp(흐름))·임계 이하=무보정(강가만). ripW 0→0.6 sweep 으로 마른 땅에 강 따라 초록 회랑이 돋는다. ripW=0→0097 동일(회귀 0). engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < RIPW.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // v=습도 바이옴 칸(0=사막 모래·1=초원 연녹·2=우림 짙은 녹). 강이 칸을 올리면 색이 또렷이 점프한다.
    captureOpts: {
      N: M, cellPx: 6, color: (v) => {
        if (v >= 1.5) return [40, 120, 50];     // 우림(짙은 녹)
        if (v >= 0.5) return [120, 175, 80];    // 초원(연녹)
        return [200, 178, 115];                 // 사막(모래)
      }
    },
    toFrame(w) {
      const F = w.__F, bf = w.__bf, ripW = RIPW[w.__i], pts = [];
      const q = (v, n) => { let i = Math.floor(v * n); return i < 0 ? 0 : (i >= n ? n - 1 : i); };
      for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
        const k = r * M + c, b = bf(X0 + c, Y0 + r);
        const nla = Math.log(F.acc[k] + 1) / w.__lmax;
        const ramp = nla <= T ? 0 : (nla - T) / (1 - T);
        const effHum = Math.min(0.999999, b.humidity + ripW * ramp);
        pts.push({ cx: c, cy: r, r: 0.6, v: q(effHum, NH) });   // 습도 칸(사막/초원/우림)
      }
      return { pts, count: M * M, ripW };
    },

    note: '<b>강(0098)은 단지 물줄기가 아니라 *주변을 적신다* — 강가의 유효 습도가 올라 사막 한가운데에도 강을 따라 *초록 회랑*(riparian zone·오아시스)이 돋는다.</b> 두 트랙을 한 무대에서 굴리는 <b>조립</b>이다(engine 변경 0·새 법칙 0): ① 흐름 누적(0098 flowAccumulation·어디에 강이 흐르나) ② 바이옴(0090~0097 biomeField·기후 습도). 강가만 적시도록 <code>effHum = clamp01(humidity + ripW·ramp(normLogAcc))</code>, ramp 은 흐름이 임계(0.4) 넘는 강 셀에서만 켜진다(임계 이하=무보정 → 들판은 안 바뀜·강둑만). <b>측정(verify)</b>: ① corr(흐름,습도증가)=0.82 — 강일수록 더 적심 ② <b>사막 속 강 회랑</b> 건조지 강 셀 100% vs 비-강 0% 가 습한 바이옴 칸으로(Δ100%) — 마른 땅을 강이 가르며 초록 띠를 만든다 ③ effHum∈[0,1) ④ <b>ripW=0 → 바이옴 byte 불변</b>(riparian 끄면 0097 동일·회귀 0) ⑤ 결정론. <b>흐름</b>(capture 3 프레임): ripW 를 0→0.3→0.6 올리면, 처음엔 기후만 따르던 건조한 모래땅에 <b>강을 따라 짙은 초록 회랑</b>이 또렷이 돋는다(나뭇가지 드레인 네트워크가 그대로 초록 띠로). <b>원칙 준수</b>: 적심은 *두 제너릭 장의 조립*(타입 0·engine 변경 0). <b>정직한 한계</b>: 유효 습도만 바꿈(실제 식생/색은 호출자 해석)·정적·유한 창·강폭=흐름 임계 노브. 다음: 호수 채움(pit→평평 수면) → 기후·강·호수·바다 통합 맵.'
  };
});
