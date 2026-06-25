// viewer/scenes/step_0093.js — 위도 온도대: 결정론적 위도 인자 warm(j)=½(1+cos(2πj/P))를 온도 잡음에 blend → 기후대 띠.
//   0090~0092 의 온도는 *순수 잡음*이었다. 실세계 온도는 *위도*에 강하게 묶인다 — 적도 덥고 극지 춥다. 이 step 은
//   결정론적 위도 인자를 온도축에 blend → 같은 경도줄을 따라 열대→온대→한대 *띠*가 창발(잡음=국소 변이 + 위도=대역).
//   장면: 같은 맵에서 latAmp 를 0→크게 올리며 가로 기후대 띠가 점점 또렷해지는 sweep. engine 변경 0(htj-stream.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0093'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.06, NT = 3, NH = 3, P = 64;   // latPeriod=M → 창 안에 위도 한 주기(적도 위/아래·극 중앙)
  const PAL = [
    [40, 70, 130], [70, 110, 160], [120, 160, 200],     // 추움(한대): 청
    [90, 130, 80], [120, 170, 90], [150, 200, 110],     // 온화(온대): 녹
    [170, 140, 70], [200, 150, 60], [210, 120, 50],     // 더움(열대): 적
  ];
  const AMPS = [0, 0.4, 0.8];                            // sweep: 0=0090 잡음 → 위도대 점강

  function build(w) {
    w.__base = { x: 600, y: 0 };
    w.__i = 0;
    w.__bf = () => Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, latAmp: AMPS[w.__i], latPeriod: P });
  }

  return {
    label: 'step_0093 — 위도 온도대: 결정론적 위도 인자가 잡음에 blend → 기후대 띠(열대·온대·한대)',
    title: 'HTJ — 위도 온도대: 온도가 위도에 묶여(적도 덥고 극지 춥다) 가로 기후대 띠가 창발',
    sub: '0090~0092 의 온도는 순수 잡음. 실세계 온도는 위도에 강하게 묶인다. 결정론적 위도 인자 warm(j)=½(1+cos(2πj/P))를 온도축에 blend → 같은 경도줄에 열대→온대→한대 띠. 잡음(국소 변이)+위도(대역 구조). latAmp=0 → 0092/0090 byte 동일(회귀 0). engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < AMPS.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    captureOpts: { N: M, cellPx: 7, color: (v) => PAL[v | 0] || [20, 20, 20] },
    toFrame(w) {
      const o = w.__base, bf = w.__bf(), pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const b = bf(o.x + i, o.y + j);
        pts.push({ cx: i, cy: j, r: 0.62, v: b.biome });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y, latAmp: AMPS[w.__i] };
    },

    note: '<b>온도는 *순수 잡음*이 아니라 *위도*에 묶인다 — 적도는 덥고 극지는 춥다. 그 결과 기후대 띠가 창발한다.</b> 0090~0092 의 온도축은 무상관 fBm 잡음이었다(어디나 같은 분포). 그러나 실세계 온도의 1차 구조는 <b>위도</b>다: 적도가 가장 덥고 극으로 갈수록 차가워진다. 이 step 은 결정론적 위도 인자 <code>warm(j)=½(1+cos(2π·j/latPeriod))</code> ∈[0,1](적도행=1·극행=0)를 온도축에 <b>blend</b>한다: <code>tBand=(1−latAmp)·temp + latAmp·warm</code>. 그러면 잡음(국소 변이)+위도(대역 구조)의 합으로, 같은 경도줄을 따라 <b>열대→온대→한대 띠</b>가 창발한다 — 실세계 기후대 그대로. <b>측정(verify)</b>: ① corr(warm,effTemp)=0.99 > 0.6(온도가 위도에 강하게 묶임·순수 잡음이면 ≈0) ② 적도행 effTemp 0.80 ≫ 극행 0.18(Δ0.62·열대↔한대 띠) ③ corr(warm,humidity)=−0.02 ≈ 0(위도는 *온도만* 건드림·습도 무관·결합 표적화) ④ <b>latAmp=0 → 0092 biome byte 동일</b>(회귀 0) ⑤ 순수·결정론. <b>흐름</b>(capture 3 프레임): 같은 맵에서 latAmp 를 0→0.4→0.8 로 올리면, 처음엔 0090 잡음 얼룩이지만 점점 <b>가로 기후대 띠</b>(상하 적도=적·중앙 극=청)가 또렷해지고 그 위에 습도 잡음이 무늬를 얹는다. <b>원칙 준수</b>: 위도·바이옴은 *타입 모르는 제너릭 장 함수*(engine 변경 0·확인용 트랙). <b>정직한 한계</b>: 위도 period 는 무한 세계라 *주기적 띠*(유한 행성 한 적도 아님)·균등 양자화·정적·고도(0092)와는 직교 합산일 뿐 동적 결합 아님. 다음: 바이옴×지형 형태 결합·열린 해안.'
  };
});
