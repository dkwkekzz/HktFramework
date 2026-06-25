// viewer/scenes/step_0101.js — (조립) 기후·강·호수·바다 통합 맵: 물순환 사다리(0097~0100)+바이옴(0090~0096)을 한 무대에서.
//   같은 지형 높이장 하나가 ⓐ 바이옴 고도축(높은 곳=찬 산) ⓑ 강(흐름 누적 0098) ⓒ 호수(lakeFill 0100) ⓓ 바다(저지 임계)
//   를 모두 결정 → 모든 물 요소가 자기일관. 장면: 해수면을 올리며(0.2→0.4) 해안이 전진하고 호수가 바다에 합류하는 sweep.
//   땅은 바이옴+riparian(강가 초록 회랑)으로 채색. engine 변경 0·새 법칙 0(확인용 조립). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0101'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 80, SCALE = 0.06, X0 = 200, Y0 = -150, NH = 3, T = 0.4, RIPW = 0.5, COLD = 0.18;
  const SEAPCT = [0.10, 0.18, 0.28];                    // sweep: 해수면 상승 — 해안 전진·호수→바다 합류

  function build(w) {
    w.__elevFn = (i, j) => Stream.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
    w.__bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, lapse: 0.4, elevFn: w.__elevFn });
    w.__F = Stream.flowAccumulation({ elevFn: w.__elevFn, x0: X0, y0: Y0, W: M, H: M });
    w.__Lk = Stream.lakeFill({ elevFn: w.__elevFn, x0: X0, y0: Y0, W: M, H: M });
    w.__lmax = Math.log(w.__F.maxAcc + 1);
    const sorted = Array.from(w.__F.elev).slice().sort((a, b) => a - b);
    w.__sorted = sorted; w.__i = 0;
  }

  return {
    label: 'step_0101 — (조립) 기후·강·호수·바다 통합 맵: 한 지형장이 산·강·호수·바다를 자기일관하게',
    title: 'HTJ — 통합 맵: 같은 지형장 하나가 바이옴 고도축·강·호수·바다를 모두 결정(물순환+기후 한 세계)',
    sub: '물순환 사다리(강수 0097·흐름 0098·riparian 0099·호수 0100)+바이옴(0090~0096)을 한 무대에서. 같은 지형 높이장이 ⓐ 고도축(높은 곳=찬 산) ⓑ 강 라우팅 ⓒ 호수 분지 ⓓ 바다(저지)를 다 정한다 → 자기일관. 해수면 0.2→0.42 sweep(해안 전진·호수→바다). engine 변경 0·새 법칙 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < SEAPCT.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    // 밴드: 강(시안)>호수(중파랑)>바다(짙은 파랑)>찬 산(회→백)>따뜻 땅(모래→초록·riparian).
    captureOpts: {
      N: M, cellPx: 6, color: (v) => {
        if (v >= 5) return [80, 200, 230];                                   // 강(시안)
        if (v >= 4) return [55, 125, 205];                                   // 호수
        if (v >= 3) return [22, 65, 145];                                    // 바다(깊은 파랑)
        if (v >= 2) { const e = Math.min(1, v - 2); return [135 + e * 105, 148 + e * 92, 150 + e * 95]; }  // 찬 산→만년설
        const e = v < 0 ? 0 : (v > 1 ? 1 : v); return [200 - e * 150, 178 - e * 28, 115 - e * 55];          // 따뜻 땅(모래→초록)
      }
    },
    toFrame(w) {
      const F = w.__F, Lk = w.__Lk, bf = w.__bf, pts = [];
      const seaLevel = w.__sorted[Math.floor(M * M * SEAPCT[w.__i])];
      let hmin = Infinity, hmax = -Infinity;
      for (let k = 0; k < M * M; k++) { const h = F.elev[k]; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
      const span = (hmax - hmin) || 1;
      for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
        const k = r * M + c; let v;
        if (F.elev[k] < seaLevel) v = 3.5;                                   // 바다(저지 임계 아래)
        else if (Lk.depth[k] > 1e-6) v = 4.5;                               // 내륙 호수
        else if (Math.log(F.acc[k] + 1) / w.__lmax > 0.6) v = 5.5;          // 강
        else {                                                              // 땅 — 바이옴+riparian
          const b = bf(X0 + c, Y0 + r);
          if (b.effTemp < COLD) v = 2 + (F.elev[k] - hmin) / span;          // 찬 고지=산(고도→만년설)
          else {
            const nla = Math.log(F.acc[k] + 1) / w.__lmax;
            const ramp = nla <= T ? 0 : (nla - T) / (1 - T);
            v = Math.min(0.999999, b.humidity + RIPW * ramp);               // 따뜻 땅(습도→초록·강가 적심)
          }
        }
        pts.push({ cx: c, cy: r, r: 0.6, v });
      }
      return { pts, count: M * M, seaPct: SEAPCT[w.__i] };
    },

    note: '<b>물순환 사다리(강수·강·강가·호수)와 기후(바이옴)가 마침내 *한 맵*으로 만난다 — 같은 지형 높이장 하나가 산·강·호수·바다를 모두 *자기일관*하게 결정한다.</b> 이 step 은 그동안 쌓은 제너릭 장들을 한 무대에서 굴리는 <b>조립</b>이다(engine 변경 0·새 법칙 0): 같은 높이장 h 가 ⓐ 바이옴 *고도축*(effTemp=temp−lapse·h → 높은 곳=찬 산·만년설·0095) ⓑ 강의 *라우팅*(흐름 누적 0098 → 능선서 발원해 골짜기로) ⓒ 호수 *분지*(lakeFill 0100 → 유출구 높이 평평 수면) ⓓ *바다*(저지 임계 아래)를 동시에 정한다. 거기에 riparian(0099)으로 강가를 초록으로 적신다. <b>측정(verify)</b>: ① <b>물 위계</b> 바다지형 0.37 < 호수 0.57 < 마른땅 0.62(바다 최저·호수 중간 분지·땅 최고) ② <b>강→호수 종착</b> 내부 sink 111개 100%가 호수로 채워짐(흐름이 분지에 모여 호수가 됨·0098↔0100 일치) ③ <b>기후 자기일관</b> 바다 effTemp 0.24 > 산(고지 20%) 0.03(같은 지형장이 분지이자 고도축이라 바다=따뜻 저지·산=찬 고지) ④ 결정론. <b>흐름</b>(capture 3 프레임): 해수면을 0.20→0.30→0.42 로 올리면 <b>해안이 전진</b>하며 저지가 바다(짙은 파랑)에 잠기고, 내륙 호수(중파랑)가 바다에 합류한다 — 시안 강줄기는 찬 산(회백)에서 발원해 초록 평원(riparian 회랑)을 지나 호수·바다로 흘러든다. <b>큰 그림</b>: 환경(TW)이 *딛고 다닐 대륙* — 산·강·호수·해안·기후대가 모두 *법칙 한 줌*(노이즈+라우팅+채움+분류)에서 자기일관하게 창발(author 0). <b>원칙 준수</b>: 모두 *제너릭 장 측정*(타입 0·engine 변경 0). <b>정직한 한계</b>: 정적 기하(SPH 동적 물 0091/0096 과 별개·여긴 장 측정 통합 뷰)·해수면=전역 임계 노브·증발/유량 균형·침식 결합은 후속. 다음: 동적 SPH 물과 통합·침식 결합·바이옴 3D 표면.'
  };
});
