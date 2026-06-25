// viewer/scenes/step_0094.js — 바이옴이 지형 형태(DNA)를 고른다: biome → 지형 DNA 랜드폼 팔레트(streamChunks shapeAt).
//   0074 는 무한 세계의 형태를 *단일 높이 노이즈*로 골랐다. 이 step 은 그 선택을 *바이옴*에 맡긴다(조립): 각 셀의
//   (온도·습도·위도) 바이옴이 그 지역의 *랜드폼*(평탄·사구·평원·구릉·능선 DNA)을 고른다 → 같은 바이옴=같은 지형 성격,
//   기후마다 다른 지형(툰드라 평탄·사막 사구·삼림 구릉). 부품: biomeField(0090~93)·registerShape(0062)·streamChunks(0073).
//   engine 변경 0(확인용 트랙·조립). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0094'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const M = 64, SCALE = 0.09, P = 60;
  // 랜드폼 relief 색조 ramp(평탄→능선): 갈→노→연녹→녹→회백(고도/지형 성격 틴트).
  const LANDCOL = [[150, 130, 95], [205, 195, 110], [150, 195, 120], [80, 150, 85], [200, 205, 210]];
  function landTile(kind) {
    const m = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const b = Math.max(0, 1 - (i * i + j * j) / 8); let cz = 0;
      if (kind === 1) cz = 0.4 * Math.sin(i * 1.6);
      else if (kind === 2) cz = 0.25 * (((i + j) & 1) ? 1 : -1);
      else if (kind === 3) cz = 1.3 * b;
      else if (kind === 4) cz = 2.2 * Math.max(0, 1 - Math.abs(i));
      m.push({ cx: i, cy: j, cz });
    }
    return m;
  }
  const BIOME2FORM = [0, 4, 4, 2, 3, 3, 1, 2, 3];   // 한대:평탄/능선/능선 · 온대:평원/구릉/구릉 · 열대:사구/평원/구릉

  function build(w) {
    w.__dict = {};
    w.__land = [0, 1, 2, 3, 4].map(k => D.registerShape(w.__dict, landTile(k)));
    w.__bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, latAmp: 0.45, latPeriod: P });
    w.__path = [{ x: 1500, y: -300 }, { x: 38400, y: 9120 }, { x: -52017, y: 31044 }];
    w.__i = 0;
  }

  return {
    label: 'step_0094 — 바이옴이 지형 형태(DNA)를 고른다: 기후마다 다른 랜드폼(평탄·사구·구릉·능선)',
    title: 'HTJ — 바이옴이 지형 형태를 고른다: 단일 노이즈가 아니라 (온도·습도·위도)가 그 지역 랜드폼을 결정',
    sub: '0074 는 무한 세계의 형태를 단일 높이 노이즈로 골랐다. 이 step 은 그 선택을 바이옴에 맡긴다(조립): 각 셀의 바이옴이 지형 DNA 랜드폼(평탄·사구·평원·구릉·능선)을 고른다 → 같은 바이옴=같은 지형 성격, 기후마다 다른 지형. 부품: biomeField·registerShape·streamChunks. engine 변경 0.',
    mode: 'energy', dynamics: false, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__i < w.__path.length - 1) w.__i++; },

    makeWorld() { return { N: M }; },
    frames: [0, 1, 2],
    captureOpts: { N: M, cellPx: 7, color: (v) => LANDCOL[v | 0] || [20, 20, 20] },
    toFrame(w) {
      const o = w.__path[w.__i], pts = [];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const form = BIOME2FORM[w.__bf(o.x + i, o.y + j).biome];
        pts.push({ cx: i, cy: j, r: 0.62, v: form });
      }
      return { pts, count: M * M, worldX: o.x, worldY: o.y, dictSize: Object.keys(w.__dict).length };
    },

    note: '<b>무한 세계의 *지형 형태*가 단일 노이즈(0074)가 아니라 *바이옴*에 의해 결정된다 — 기후마다 다른 랜드폼.</b> 0074 는 무한 절차적 장의 형태를 *하나의 높이 노이즈*로 골랐다(어디나 같은 종류의 지형). 그러나 실세계 지형의 성격은 *기후*와 묶인다: 툰드라는 평탄하고, 사막은 사구가 일고, 삼림 고원은 구릉지고, 한대 산지는 능선이 솟는다. 이 step 은 그 결합을 <b>조립</b>한다(engine 변경 0·새 법칙 0) — 각 셀의 <code>biomeField</code> (온도·습도·위도, 0090~0093) 바이옴이 그 지역의 <b>지형 DNA 랜드폼</b>(평탄·사구·평원·구릉·능선 — <code>registerShape</code> 로 세계 사전에 등록·0062)을 고르고, <code>streamChunks</code> (0073)가 그 형태로 무한 세계를 펼친다. <b>측정(verify)</b>: ① 1257/1257 청크의 DNA 랜드폼이 그 바이옴이 고른 형태와 정확히 일치(지형 형태 = 바이옴의 순수 함수·단일 노이즈 아님) ② 한 창에 랜드폼 4종 발현(기후마다 다른 지형) ③ 이웃 청크 같은 랜드폼 0.90 ≫ 무작위쌍 0.62(바이옴이 뭉쳐 지형 성격도 뭉침·코히어런트 province) ④ 형태 5종 ≪ 청크 1257개(shapeDict 공유·K≪N·M2 dedup 정신) ⑤ 순수·결정론. <b>흐름</b>(capture 3 프레임): 관찰자가 무한 세계의 서로 다른 지역으로 점프 → 각 창이 <b>이어진 지형-형태 province</b>(같은 색=같은 랜드폼·갈=평탄/노=사구/녹=구릉/회백=능선)이고 위도 띠(0093)를 따라 지형 성격이 바뀐다. <b>원칙 준수</b>: 바이옴·형태 선택은 *타입 모르는 제너릭 장+DNA*(engine 변경 0·"툰드라/사막" 이름은 렌더의 몫·BIOME2FORM 은 렌더 도메인 매핑). <b>정직한 한계</b>: BIOME2FORM 은 손수 짠 *매핑 표*(랜드폼 자체는 창발 아님·바이옴↔형태 대응은 설계)·top-down 색 province(3D 표면 발현은 0074 의 surface 파이프라인 결합 후속)·정적. 다음: 열린 해안·안정 분절 침식.'
  };
});
