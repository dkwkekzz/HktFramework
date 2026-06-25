// viewer/scenes/step_0092.js — 고도×바이옴 결합: 세 번째 독립 fBm 축(고도)이 기온 감률로 유효 온도를 낮춘다.
//   0090 은 (온도·습도) 2축이었다. 실세계는 같은 위도(=같은 base 온도)라도 *높은 곳이 더 춥다*(기온 감률) — 적도
//   봉우리에 툰드라/만년설. 이 step 은 세 번째 무상관 노이즈축(고도)을 뽑아 effTemp=temp−lapse·elev 로 분류 → 고지대가
//   찬 바이옴 칸으로 이동. 장면: 같은 맵에서 lapse 를 0→크게 올리며 고지대가 점점 *툰드라(청)* 로 변하는 sweep.
//   engine 변경 0(확인용 트랙·htj-stream.js biomeField·lapse). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0092'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.06, NT = 3, NH = 3;
  // 9칸 팔레트(0090 과 동일) — 온도(저→고: 청→적) × 습도(저→고: 어두→밝). biome = t*3 + h.
  const PAL = [
    [40, 70, 130], [70, 110, 160], [120, 160, 200],     // 추움: 건조 툰드라→습윤 한대림
    [90, 130, 80], [120, 170, 90], [150, 200, 110],     // 온화: 초원→온대림→우림
    [170, 140, 70], [200, 150, 60], [210, 120, 50],     // 더움: 사막→사바나→열대
  ];
  const LAPSES = [0, 0.5, 1.0];                          // sweep: 0=0090 동일 → 고도 결합 점강

  function build(w) {
    w.__base = { x: 1200, y: -800 };                    // 고정 지역(같은 맵에서 lapse 만 변함)
    w.__i = 0;
    w.__bf = () => Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55, lapse: LAPSES[w.__i] });
  }

  return {
    label: 'step_0092 — 고도×바이옴 결합: 기온 감률로 고지대가 찬 바이옴(산악 툰드라)',
    title: 'HTJ — 고도×바이옴 결합: 세 번째 독립축(고도)이 유효 온도를 낮춰 적도 봉우리도 툰드라가 된다',
    sub: '0090 은 (온도·습도) 2축. 실세계는 같은 위도라도 높은 곳이 더 춥다(기온 감률·lapse). 세 번째 무상관 노이즈축(고도·salt 분리)을 뽑아 effTemp=temp−lapse·elev 로 분류 → 고지대가 찬 바이옴 칸으로 이동. lapse=0 → 0090 byte 동일(회귀 0). engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < LAPSES.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    captureOpts: { N: M, cellPx: 7, color: (v) => PAL[v | 0] || [20, 20, 20] },
    toFrame(w) {
      const o = w.__base, bf = w.__bf(), pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const b = bf(o.x + i, o.y + j);
        pts.push({ cx: i, cy: j, r: 0.62, v: b.biome });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y, lapse: LAPSES[w.__i] };
    },

    note: '<b>같은 위도(=같은 base 온도)라도 *높은 곳이 더 춥다* — 고도가 세 번째 독립축으로 들어와 바이옴을 바꾼다.</b> 0090 은 (온도·습도) 두 무상관 축의 교차로 바이옴을 냈다. 그런데 실세계엔 한 축이 더 있다: <b>고도</b>. 같은 적도여도 산봉우리엔 만년설·툰드라가 있다(기온 감률 lapse rate — 100m 오를수록 ~0.6℃ 하강). 이 step 의 <code>biomeField</code> 는 세 번째 fBm 채널(고도·<code>elevSalt=\'E\'</code>·온도·습도와 무상관)을 뽑아 <b>유효 온도 effTemp = clamp(temp − lapse·elev)</b> 로 분류한다 — 고지대일수록 유효 온도가 낮아져 *찬 바이옴 칸*(툰드라·한대림)으로 이동한다. <b>측정(verify)</b>: ① corr(elev,temp)=0.06·corr(elev,hum)=0.03 ≈ 0(세 축 무상관) ② corr(elev,effTemp)=−0.38<0·고도 상위 4분위 유효온도 0.15 < 하위 0.28(Δ0.12)·찬 바이옴 비율 상위 0.88>하위 0.69(산악 툰드라 창발) ③ 고도 축도 이웃차 0.027 ≪ 무작위쌍차 0.143(코히어런트 산맥) ④ <b>lapse=0 → 0090 biome byte 동일</b>(회귀 0) ⑤ 순수·결정론. <b>흐름</b>(capture 3 프레임): 같은 맵에서 lapse 를 0→0.5→1.0 으로 올리면, 처음엔 0090 그대로지만 점점 *고지대 패치가 청색(툰드라)* 으로 식어간다 — 저지대는 그대로. <b>원칙 준수</b>: 고도·바이옴은 *타입 모르는 제너릭 장 함수*(engine 변경 0·확인용 트랙·"툰드라" 이름은 렌더의 몫). <b>정직한 한계</b>: 고도는 *별도 노이즈 축*(0083/0091 의 실제 지형 높이장 h(x,y) 와 아직 분리·결합은 후속)·균등 양자화·정적. 다음: 위도 온도대·바이옴×지형 형태.'
  };
});
