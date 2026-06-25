// viewer/scenes/step_0100.js — 호수 채움(lakeFill): 흐름이 빠져나가지 못하는 분지(pit)는 물이 유출구 높이까지 차올라 *호수*.
//   lakeFill 이 priority-flood 로 각 셀의 수면(filled)을 구한다 → depth=filled−지형>0 = 호수(평평 수면)·경사=0. 호수
//   *타입*을 박지 않는다(일반 높이장에 채움 알고리즘 돌린 측정·타입 0). 장면: 채움 비율 0→1 sweep — 분지가 차오르며
//   평평한 호수 수면이 드러난다. engine 변경 0(확인용 트랙·htj-stream.js). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0100'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 80, SCALE = 0.06, X0 = 200, Y0 = -150;
  const FRAC = [0, 0.5, 1.0];                            // sweep: 마른 분지 → 절반 → 가득 찬 호수

  function build(w) {
    w.__elevFn = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__F = Stream.lakeFill({ elevFn: w.__elevFn, x0: X0, y0: Y0, W: M, H: M });
    w.__i = 0;
  }

  return {
    label: 'step_0100 — 호수 채움(lakeFill): 분지가 차올라 평평한 호수 수면(priority-flood)',
    title: 'HTJ — 호수 채움(lakeFill): 흐름이 못 빠지는 분지가 유출구 높이까지 차올라 평평한 호수가 된다',
    sub: '0098 은 분지(sink)에 물을 고이게만 했다. 실제로 분지는 유출구 높이까지 차올라 평평한 수면(호수)을 이룬다. lakeFill 이 priority-flood 로 수면을 구한다(depth=filled−지형>0=호수·경사=0). 호수 타입 박지 않음(일반 높이장 채움 측정). 채움 0→1 sweep. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < FRAC.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // v∈[0,1]=지형 relief(저지 암녹→능선 회녹) · v≥2=호수(파랑·밝기=수심).
    captureOpts: {
      N: M, cellPx: 6, color: (v) => {
        if (v >= 2) { const e = Math.min(1, v - 2); return [30 + e * 40, 90 + e * 70, 175 + e * 70]; }   // 호수(깊을수록 밝은 파랑)
        const e = v < 0 ? 0 : (v > 1 ? 1 : v); return [50 + e * 130, 70 + e * 110, 55 + e * 70];          // 지형 relief
      }
    },
    toFrame(w) {
      const F = w.__F, frac = FRAC[w.__i], pts = [];
      let hmin = Infinity, hmax = -Infinity;
      for (let k = 0; k < M * M; k++) { const h = F.terrain[k]; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
      const span = (hmax - hmin) || 1, dmax = F.maxDepth || 1;
      for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
        const k = r * M + c, hs = (F.terrain[k] - hmin) / span;
        const d = F.depth[k] * frac;                                  // 채움 비율(애니메이션·frac=1 이 실제 호수)
        pts.push({ cx: c, cy: r, r: 0.6, v: d > 1e-6 ? 2 + Math.min(1, d / dmax) : hs });
      }
      return { pts, count: M * M, fillFrac: frac };
    },

    note: '<b>흐름(0098)이 빠져나가지 못하는 *분지(pit)* 는 물이 차올라 *호수*가 된다 — 유출구(spill) 높이까지 *평평한 수면*을 이루며 또렷한 호반(shoreline)을 갖는다.</b> 0098 흐름 누적은 국소 최저점에 물을 *고이게만* 했다(채우진 않음). 이 step 은 priority-flood(Barnes 2014)로 각 셀의 *수면 높이*(filled)를 구한다: 창 경계(유출)에서 가장 낮은 곳부터 안으로 번지며 <code>filled[이웃]=max(지형[이웃], 흘러온 수면)</code>. 그러면 분지는 유출구 높이의 *평평한 수면* 으로 차고(depth=filled−지형>0=호수), 경사면은 안 채워진다(depth=0). <b>호수라는 타입을 코드에 박지 않는다</b> — 일반 높이장에 채움 알고리즘을 돌린 *측정*일 뿐(타입 0·engine 변경 0). <b>측정(verify)</b>: ① 분지→호수 1407 셀·최대 수심 0.249·총 수량 78.9 ② <b>평평한 수면</b> 호수 109개·한 호수 내 수면 편차 0(유출구 높이로 정확히 평평) ③ 단조 filled≥지형(물은 채우기만·땅 아래로 안 팜) ④ <b>순수 경사 → 호수 0</b>(거짓 호수 없음·분지 있어야 채움) ⑤ 결정론. <b>흐름</b>(capture 3 프레임): 채움 비율을 0→0.5→1 올리면 마른 분지(지형 relief)에 <b>파란 호수가 차올라</b> 평평한 수면과 호반이 드러난다(깊을수록 밝은 파랑). <b>원칙 준수</b>: 채움은 *제너릭 장 함수*(타입 0·순수·결정론). <b>정직한 한계</b>: 유한 창(경계=유출구)·정적 채움(SPH 물 0091 의 동적 수면과는 별개·여긴 기하 채움)·강수량과 무관(분지는 항상 가득·증발/유량 균형은 후속). 다음: 기후·강·호수·바다 통합 맵(0101).'
  };
});
