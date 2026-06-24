// viewer/scenes/step_0074.js — 절차적 장 고도화(노이즈): 무한 절차적 장의 형태 선택을 백색 잡음 → 공간 상관 노이즈로.
//   0073(streamChunks)은 grid (i,j)→형태를 *백색 잡음*(hashIndex)으로 골랐다 → 봉우리·계곡이 흩어진 모자이크. 이 step 은
//   그 장 함수만 *공간 상관 노이즈*(fBm·fieldNoise)로 교체 — 인접 셀이 닮아 봉우리·계곡이 뭉치고(코히어런트 지형),
//   저주파 옥타브가 바이옴(큰 동질 지역)을 만든다. 스트리밍(TW4)·거리 LOD(0069)·표면(0068)·DNA(T2)는 그대로 굴린다.
//
//   engine 변경 0(확인용 트랙)·streamChunks 도 불변(shapeAt 만 다른 함수를 받음). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0074'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;
  const Lod = require ? require('../htj-lod.js') : self.HTJLod;
  const Surf = require ? require('../htj-surface.js') : self.HTJSurface;

  // 높이 오름차순 K=4 팔레트(분지<평지<능선<봉우리) — 노이즈 높이가 이 K개에 사상되면 같은 높이대가 *뭉쳐* 발현.
  function tile(kind) { const m = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const b = Math.max(0, 1 - (i * i + j * j) / 6); let z = 0; if (kind === 1) z = -1.3 * b; else if (kind === 2) z = (Math.abs(i) <= 0 ? 1.3 * b : 0); else if (kind === 3) z = 1.3 * b; m.push({ cx: i, cy: j, cz: z }); } return m; }

  function build(w) {
    const dict = {}, palette = [0, 1, 2, 3].map(k => D.registerShape(dict, tile(k))), K = palette.length;
    w.__dict = dict; w.__K = K;
    w.__spacing = 12; w.__radius = w.__spacing * 5.5;
    // 백색 잡음(0073) → 공간 상관 노이즈. scale 작을수록 큰 바이옴(창보다 큰 동질 지역).
    w.__field = Stream.fieldNoise(palette, { scale: 0.055, octaves: 4, gain: 0.55 });
    w.__lopt = { band: w.__radius * 0.42, maxL: 3, ropt: { quantum: 0.25, spread: 2.6, subScale: 2.4 } };
    // 관찰자 경로 — 무한 노이즈 세계의 서로 다른 바이옴 세 곳(huge 좌표). 매번 유한 창·일정 비용·*코히어런트* 지형.
    const S = w.__spacing;
    w.__obsPath = [{ cx: 0, cy: 0 }, { cx: 640 * S, cy: -480 * S }, { cx: -52017 * S, cy: 31044 * S }];
    w.__obsI = 0; rebuild(w);
  }
  function rebuild(w) {
    const o = w.__obsPath[w.__obsI]; w.__obs = { cx: o.cx, cy: o.cy };
    const s = Stream.streamChunks(w.__obs, { spacing: w.__spacing, radius: w.__radius, z: 0, shapeAt: w.__field });
    w.__count = s.count;
    w.__cloud = Lod.lodCloud(s.chunks, w.__dict, { cx: w.__obs.cx, cy: w.__obs.cy, cz: 0 }, w.__lopt).cloud;
    w.__surface = Surf.pointCloudSurface(w.__cloud, { res: 88 });
    w.__hMax = w.__surface.hMax;
  }

  return {
    label: 'step_0074 — 절차적 장 고도화(노이즈): 백색 잡음 → 공간 상관 지형·바이옴',
    title: 'HTJ — 절차적 장 고도화: 무한 세계의 형태를 노이즈로(봉우리·계곡이 뭉치고 바이옴이 생긴다)',
    sub: '0073 의 무한 절차적 장은 형태를 백색 잡음(hashIndex)으로 골라 봉우리·계곡이 흩어졌다. 이 step 은 장 함수만 공간 상관 노이즈(fBm·fieldNoise)로 교체 — 인접 셀이 닮아 같은 높이대가 뭉치고(코히어런트 지형), 저주파 옥타브가 바이옴(큰 동질 지역)을 만든다. 스트리밍·거리 LOD·표면·DNA 는 그대로. engine 변경 0(확인용 트랙).',
    mode: 'energy', dynamics: false, render: 'terrain',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__obsI < w.__obsPath.length - 1) { w.__obsI++; rebuild(w); } },

    makeWorld() { return { N: 64 }; },
    frames: [0, 1, 2],
    captureOpts: { N: 88 },
    toFrame(w) {
      const surf = w.__surface, R = surf.nx, pts = [];
      const Lv = [0.5, 0.7, 0.55], Lm = Math.hypot(Lv[0], Lv[1], Lv[2]), Ln = [Lv[0] / Lm, Lv[1] / Lm, Lv[2] / Lm];
      const span = (surf.hMax - surf.hMin) || 1;
      for (let J = 0; J < R; J++) for (let I = 0; I < R; I++) {
        const k = J * R + I; if (!surf.mask[k]) continue;
        const n = surf.normals[k], shade = 0.35 + 0.5 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);
        const h = (surf.heights[k] - surf.hMin) / span;
        pts.push({ cx: (I / (R - 1)) * 88, cy: (J / (R - 1)) * 88, r: 0.6, v: 0.22 + 0.6 * shade * (0.6 + 0.4 * h) });
      }
      const ox = (w.__obs.cx - surf.x0) / surf.dx, oy = (w.__obs.cy - surf.y0) / surf.dy;
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; pts.push({ cx: (ox + Math.cos(t) * 2.5) / (R - 1) * 88, cy: (oy + Math.sin(t) * 2.5) / (R - 1) * 88, r: 0.8, v: 1.0 }); }
      return { pts, filled: surf.filled, count: w.__count, worldX: Math.round(w.__obs.cx), worldY: Math.round(w.__obs.cy), dictSize: Object.keys(w.__dict).length };
    },

    note: '<b>무한 세계가 이제 *노이즈*로 형태를 고른다 — 봉우리·계곡이 흩어지지 않고 뭉치며, 바이옴(큰 동질 지역)이 생긴다.</b> 0073(TW4)은 세계를 무한 절차적 장으로 풀었지만, 각 grid 셀의 형태를 <code>hashIndex</code>(<b>백색 잡음</b>)으로 골랐다 — 인접 셀이 무상관이라 봉우리·계곡이 모자이크처럼 흩어진다(0073 의 정직한 한계 "장이 손수 K 팔레트+해시 사상"). 이 step 은 그 *장 함수만* 바꾼다(<code>streamChunks</code> 도 불변·<code>shapeAt</code> 만 다른 함수): <b>공간 상관 노이즈</b> <code>fieldNoise(palette,{scale,octaves})</code> = fBm(여러 옥타브 값 노이즈 합) 높이를 높이순 팔레트(분지&lt;평지&lt;능선&lt;봉우리)에 사상. <b>핵심(측정)</b>: ① 인접 셀 차(0.032)가 먼 셀 차(0.20)·백색 잡음 인접 차(0.34)보다 훨씬 작다 = <b>공간 상관 창발</b>(같은 높이대가 뭉친다) ② 같은 형태 평균 런 8.8셀 ≫ 백색 잡음 1.0셀 = <b>바이옴</b>(저주파 옥타브가 만든 큰 동질 지역) ③ fBm ∈ [0,1)·사상 idx ∈ [0,K)(huge 좌표여도 팔레트 밖 없음). 장은 여전히 <b>순수·경로 무관</b>(같은 (i,j)→같은 형태·재방문 동일) — 0073 스트리밍의 유한 창·일정 비용 위에 그대로 얹힌다. <b>흐름</b>(capture 3 프레임): 관찰자(밝은 고리)가 무한 노이즈 세계의 *서로 다른 바이옴* 세 곳으로 점프 → 각 창이 흩어진 모자이크가 아니라 <b>이어진 능선·계곡</b>(코히어런트 지형)·창마다 다른 지형 성격(바이옴). <b>원칙 준수</b>: 노이즈는 *타입을 모르는 제너릭 장 함수*(형태는 DNA·발현은 제너릭 표면·engine 타입코드 0)·관찰자=확인용 개념→viewer 도메인(engine 변경 0). <b>정직한 한계</b>: fBm 평균이 가운데로 쏠려 극단(분지·봉우리) 타일이 드묾(대비 스트레치/도메인 왜곡은 후속)·2D 높이장(오버행 없음·진짜 3D 청크는 후속)·바이옴은 단일 노이즈 사상(온도·습도 다축 바이옴은 후속)·정적(시간 변화/침식 없음). 다음: 침식(물↔지형 왕복) 또는 SW5 격자 은퇴.'
  };
});
