// viewer/scenes/step_0090.js — 절차적 장 다축화(바이옴): 독립 온도·습도 fBm → 제너릭 2D 바이옴 분류.
//   0074 는 *단일* 노이즈축(높이)만 봤다. 실세계 바이옴은 ≥2 독립 축(온도·습도)의 교차다(춥고 습함=툰드라·덥고
//   건조=사막…). 이 step 은 두 *무상관* 노이즈 채널(salt 분리)을 (temp,humidity)→정수 칸으로 *제너릭* 양자화.
//   장면: 무한 세계의 바이옴 맵(셀=칸 색)·관찰자 점프마다 코히어런트한 바이옴 패치가 다른 성격으로.
//   engine 변경 0(확인용 트랙·htj-stream.js biomeField). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0090'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.06, NT = 3, NH = 3;
  // 9칸 팔레트 — 온도(저→고: 청→적) × 습도(저→고: 어두→밝). biome = t*3 + h.
  const PAL = [
    [40, 70, 130], [70, 110, 160], [120, 160, 200],     // 추움: 건조 툰드라→습윤 한대림
    [90, 130, 80], [120, 170, 90], [150, 200, 110],     // 온화: 초원→온대림→우림
    [170, 140, 70], [200, 150, 60], [210, 120, 50],     // 더움: 사막→사바나→열대
  ];

  function build(w) {
    w.__bf = Stream.biomeField({ scale: SCALE, nTemp: NT, nHum: NH, octaves: 4, gain: 0.55 });
    // 관찰자 경로 — 무한 세계의 서로 다른 지역(huge 좌표). 매번 유한 창·일정 비용·코히어런트 바이옴.
    w.__path = [{ x: 0, y: 0 }, { x: 920, y: -640 }, { x: -41023, y: 28510 }];
    w.__i = 0;
  }

  return {
    label: 'step_0090 — 절차적 장 다축화(바이옴): 독립 온도·습도 → 제너릭 2D 바이옴',
    title: 'HTJ — 절차적 장 다축화: 무상관 온도·습도 두 축의 교차로 바이옴이 창발(사막·툰드라·우림…)',
    sub: '0074 는 단일 노이즈축(높이)만. 실세계 바이옴은 ≥2 독립 축(온도·습도)의 교차다. 두 무상관 노이즈 채널(salt 분리·corr≈0)을 (temp,humidity)→정수 칸으로 제너릭 양자화 — 각 축은 공간 상관(코히어런트), 둘은 서로 독립. 관찰자가 무한 세계를 점프하면 바이옴 패치가 지역마다 다른 성격으로. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < w.__path.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    captureOpts: { N: M, cellPx: 7, color: (v) => PAL[v | 0] || [20, 20, 20] },
    toFrame(w) {
      const o = w.__path[w.__i], pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const b = w.__bf(o.x + i, o.y + j);
        pts.push({ cx: i, cy: j, r: 0.62, v: b.biome });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y };
    },

    note: '<b>바이옴이 *두 독립 축*(온도·습도)의 교차로 창발한다 — 단일 노이즈(0074)는 1D 였다.</b> 0074 는 무한 절차적 장의 형태를 *하나의* 노이즈축(높이)으로 골랐다. 실세계 바이옴은 ≥2 *독립* 축의 교차다: 춥고 습하면 한대림·덥고 건조하면 사막·온화하고 습하면 우림… 이 step 의 <code>biomeField</code> 는 두 fBm 을 *다른 salt*(독립 lattice 채널)로 뽑아 — 각 축은 <b>공간 상관</b>(코히어런트·이웃이 닮음)이되 <b>서로 무상관</b>(corr≈0)이게 한다. 핵심은 salt: 좌표 오프셋(같은 노이즈의 다른 패치)은 윈도우마다 spurious 상관이 들쭉날쭉(측정상 0.25~0.53)이라, lattice 난수에 <b>채널 salt + 강한 avalanche 믹싱</b>을 넣어야 진짜 독립(corr −0.04)이 된다. 바이옴은 (temp,humidity)→정수 칸의 <b>제너릭 2D 양자화</b>(타입 하드코딩 0·biome=칸 인덱스일 뿐·"사막/툰드라" 이름은 렌더의 몫). <b>측정(verify)</b>: ① corr(temp,humidity)=−0.036≈0(진짜 2D·같은 노이즈면 corr≈1) ② 두 축 모두 이웃차(0.027) ≪ 무작위쌍차(0.139)(코히어런트) ③ 9칸 전부 발현(온도×습도 교차) ④ salt 없음 → 0074 fbm byte 동일(회귀 0) ⑤ 순수·경로 무관. <b>흐름</b>(capture 3 프레임): 관찰자가 무한 세계의 서로 다른 지역으로 점프 → 각 창이 <b>이어진 바이옴 패치</b>(코히어런트 색 영역)이고 지역마다 다른 바이옴 조성(온도×습도 조합). <b>원칙 준수</b>: 노이즈·바이옴 분류는 *타입 모르는 제너릭 장 함수*(engine 변경 0·확인용 트랙). <b>정직한 한계</b>: 두 축 균등 양자화(실세계 바이옴 경계는 비선형)·fBm 평균 쏠림으로 가운데 칸 과대표현·정적(시간 변화 없음)·2D 맵(고도 결합은 후속). 다음: 연속 바다 3D·다축 이주 이력.'
  };
});
