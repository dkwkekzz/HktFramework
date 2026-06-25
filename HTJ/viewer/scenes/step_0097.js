// viewer/scenes/step_0097.js — 강수장(precipitation): 비는 별도 축이 아니라 이미 가진 두 축(humidity·effTemp)의 derived 함수.
//   biomeField 에 precip = clamp01(humidity^0.7·(precipFloor+(1−precipFloor)·effTemp)) 추가. 습하고 따뜻=비 많음(우림)·
//   건조하거나 추움=비 적음(사막/툰드라). 장면: precipFloor 를 1→0 으로 내리며 *온도 게이트*가 켜지는 sweep —
//   처음엔 습한 곳이면 추워도 비가 오지만, floor 가 내려갈수록 찬 고지/극지가 *말라간다*(증발↓→사막·툰드라).
//   engine 변경 0(확인용 트랙·htj-stream.js biomeField). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0097'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.07, NT = 3, NH = 3, P = 64;
  const FLOORS = [1.0, 0.5, 0.0];                        // sweep: 1=온도 무관(습도만) → 0=완전 온도 게이트(추우면 말라감)

  function build(w) {
    w.__base = { x: 800, y: -200 };
    w.__terr = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__i = 0;
    w.__bf = () => Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, latAmp: 0.25, latPeriod: P, lapse: 0.6, elevFn: w.__terr, precipFloor: FLOORS[w.__i] });
  }

  return {
    label: 'step_0097 — 강수장: 습하고 따뜻하면 비 많음(우림)·건조하거나 추우면 적음(사막/툰드라)',
    title: 'HTJ — 강수장(precipitation): 비는 humidity·effTemp 의 derived 함수 — 우림은 젖고 사막/툰드라는 마른다',
    sub: '비(강수)는 별도 축이 아니라 이미 가진 두 축(습도·유효온도)의 함수다: precip=clamp01(humidity^0.7·(floor+(1−floor)·effTemp)). 습하고 따뜻=비↑(우림)·건조하거나 추움=비↓(사막/툰드라). precipFloor 1→0 sweep 으로 온도 게이트가 켜진다. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < FLOORS.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // v∈[0,1]=강수량: 마름(연한 모래색)→젖음(짙은 청록). 비 많은 곳이 진해진다.
    captureOpts: {
      N: M, cellPx: 7, color: (v) => {
        const e = v < 0 ? 0 : (v > 1 ? 1 : v);
        return [205 - e * 165, 180 - e * 60, 120 + e * 90];   // 모래(건조)→청록(다우)
      }
    },
    toFrame(w) {
      const o = w.__base, bf = w.__bf(), pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const p = bf(o.x + i, o.y + j).precip;
        pts.push({ cx: i, cy: j, r: 0.62, v: p });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y, precipFloor: FLOORS[w.__i] };
    },

    note: '<b>비(강수)는 *새로운 축*이 아니라 *이미 가진 두 축*(습도·유효온도)의 함수다 — 습하고 따뜻하면 우림처럼 젖고, 건조하거나 추우면 사막/툰드라처럼 마른다.</b> 0090~0095 는 온도·습도·위도·고도 네 축을 쌓아 바이옴 칸을 냈다. 실세계에서 *강수*는 그 위에 얹힌 derived 측정이다: 공기가 머금는 수분(humidity)이 많고 증발이 활발할수록(따뜻=effTemp↑) 비가 많다. 그래서 <code>precip = clamp01(humidity^0.7 · (precipFloor + (1−precipFloor)·effTemp))</code> — *새 노이즈 0·타입 하드코딩 0*(기존 장의 순수 함수). 강(0098)은 바로 이 강수가 지형을 따라 흘러 모이는 곳에서 창발한다. <b>측정(verify)</b>: ① corr(humidity,precip)=0.63·corr(effTemp,precip)=0.78(둘 다 비를 끈다) ② 습·온 0.60 ≫ 건·한 0.23(우림 vs 사막/툰드라) ③ precip∈[0,1] 유한 ④ <b>biome byte 불변</b>(precip 은 가법·회귀 0) ⑤ 결정론. <b>흐름</b>(capture 3 프레임): precipFloor 를 1→0.5→0 으로 내리면 *온도 게이트*가 점점 켜진다 — 처음엔 습한 곳이면 추워도 비가 오지만(floor=1), floor 가 내려갈수록 찬 고지·극지가 <b>말라가며</b>(청록→모래색) 사막·툰드라가 드러난다. <b>원칙 준수</b>: 강수는 *제너릭 derived 장*(engine 변경 0·확인용 트랙·기존 두 축의 함수일 뿐). <b>정직한 한계</b>: 지형성 강수(산이 비구름을 막아 비그늘 사막)·바람·계절은 아직 없음(정적·순수 국소 함수). 다음: 강수→지형 따라 흐름 누적(flowField)으로 강 창발.'
  };
});
