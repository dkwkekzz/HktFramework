// viewer/scenes/step_0098.js — 흐름 누적(flowField): 강수가 지형 따라 흘러 모이면 *강*이 창발한다(D8 최급강하 라우팅).
//   flowAccumulation 이 유한 창에서 각 셀의 비를 가장 가파른 내리막 이웃으로 흘려 누적 → 큰 누적 = 강/유역. 강 *타입*을
//   박지 않는다(일반 높이장에 라우팅 돌린 측정·타입 0). 장면: 강 임계(누적)를 높음→낮음으로 내리며 본류→지류까지 나뭇가지
//   드레인 네트워크가 드러나는 sweep. engine 변경 0(확인용 트랙·htj-stream.js). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0098'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 80, SCALE = 0.06, X0 = 200, Y0 = -150;
  const THRESH = [40, 12, 4];                            // sweep: 본류만 → 지류 → 실개천까지(누적 임계 ↓)

  function build(w) {
    w.__elevFn = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__F = Stream.flowAccumulation({ elevFn: w.__elevFn, x0: X0, y0: Y0, W: M, H: M });
    w.__i = 0;
  }

  return {
    label: 'step_0098 — 흐름 누적(flowField): 강수가 지형 따라 모이면 강이 창발(드레인 네트워크)',
    title: 'HTJ — 흐름 누적: 비가 지형을 따라 흘러 모이면 강이 창발한다(D8 최급강하·본류↔지류 나뭇가지)',
    sub: '0097 의 강수가 가만히 있지 않고 중력 따라 낮은 곳으로 흐른다 — 지류가 모여 본류가 된다. flowAccumulation 이 유한 창에서 각 셀 비를 최급강하 이웃으로 흘려 누적 → 큰 누적=강. 강 타입 박지 않음(일반 높이장의 측정). 강 임계 40→4 sweep. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < THRESH.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // v∈[0,1]=지형 relief(어두운 저지→밝은 능선) · v≥2=강(파랑·밝기=물량 log).
    captureOpts: {
      N: M, cellPx: 6, color: (v) => {
        if (v >= 2) { const e = Math.min(1, v - 2); return [40 + e * 60, 110 + e * 80, 200 + e * 55]; }   // 강(물량 클수록 밝은 파랑)
        const e = v < 0 ? 0 : (v > 1 ? 1 : v); return [50 + e * 130, 70 + e * 110, 55 + e * 70];          // 지형 relief(저지 암녹→능선 회녹)
      }
    },
    toFrame(w) {
      const F = w.__F, th = THRESH[w.__i], pts = [];
      let hmin = Infinity, hmax = -Infinity;
      for (let k = 0; k < M * M; k++) { const h = F.elev[k]; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
      const span = (hmax - hmin) || 1, lmax = Math.log(F.maxAcc + 1);
      for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
        const k = r * M + c, hs = (F.elev[k] - hmin) / span;
        let v;
        if (F.acc[k] >= th) v = 2 + Math.log(F.acc[k] + 1) / lmax;   // 강: 물량 log 밝기
        else v = hs;                                                 // 땅: 지형 relief
        pts.push({ cx: c, cy: r, r: 0.6, v });
      }
      return { pts, count: M * M, threshold: th };
    },

    note: '<b>강수(0097)는 가만히 있지 않는다 — *중력 따라 낮은 곳으로 흐르고*, 지류가 모여 본류가 되며 한 줄기 *강*이 창발한다.</b> 이 step 은 유한 창 위에서 각 셀의 비를 *가장 가파른 내리막 이웃*(8방향 D8)으로 흘려 누적한다(고→저 한 번 훑기). 누적이 큰 셀 = 물이 모인 강/유역. <b>강이라는 타입을 코드에 박지 않는다</b> — 일반 높이장에 라우팅을 돌린 *측정*일 뿐(높이장이 지형이든 무엇이든·타입 0·engine 변경 0). <b>측정(verify)</b>: ① <b>채널화</b> maxAcc 257 / meanAcc 5.55 = 46× — 흐름이 균일하게 퍼지지 않고 *소수 본류로 집중*(강 창발의 정의) ② corr(elev,acc)=−0.28<0 — 물은 높은 곳에서 발원해 낮은 곳에 모인다 ③ 단조 acc≥1(누적은 상류를 더할 뿐 잃지 않음) ④ <b>보존</b> sinkAccum+borderOut=6400=Σrain(모든 빗방울은 결국 호수 씨앗에 고이거나 창을 빠져나간다) ⑤ 결정론. <b>흐름</b>(capture 3 프레임): 강 임계를 40→12→4 로 내리면 처음엔 굵은 *본류*만 보이다가 점점 *지류·실개천*이 드러나 <b>나뭇가지(dendritic) 드레인 네트워크</b>가 완성된다 — 지형(어두운 저지↔밝은 능선) 위로 파란 물줄기가 능선에서 발원해 골짜기로 합류한다. <b>원칙 준수</b>: 라우팅은 *제너릭 장 함수*(타입 0·순수·결정론). <b>정직한 한계</b>: 유한 창 라우팅(전역 유역 아님·창 밖으로 나간 물은 borderOut)·국소 최저점(pit)에 물이 고임=호수 씨앗(채움은 0100 lakeFill)·정적 균일 비(0097 precip 가중은 0099 에서). 다음: 강이 바이옴을 적심(riparian·강가 풍성) → 호수 채움.'
  };
});
