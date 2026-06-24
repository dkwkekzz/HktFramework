// viewer/scenes/step_0073.js — TW4 광활: 세계 = 무한 절차적 장, viewer 는 관찰자 둘레 유한 창만 materialize.
//   관찰자가 아무리 멀리 가도(huge 좌표) 창 크기 일정·K 형태 공유 = "끝없이 펼침·비용≠세계 크기". 스트리밍(TW4)을
//   거리 LOD(0069)·제너릭 표면(0068)·형태 DNA(T2)와 *함께* 굴린다 — 무한 지형이 관찰 영역 비용으로 발현.
//
//   environment.md TW4 — 0069~0072 LOD 가 발현/물리 비용을 관찰 영역에 묶었으나 세계는 유한 패치였다. 이 step 은
//   세계 자체를 무한 절차적 장(streamChunks·grid (i,j)→DNA)으로. engine 변경 0(확인용 트랙). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0073'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;
  const Lod = require ? require('../htj-lod.js') : self.HTJLod;
  const Surf = require ? require('../htj-surface.js') : self.HTJSurface;

  function tile(kind) { const m = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const b = Math.max(0, 1 - (i * i + j * j) / 6); let z = 0; if (kind === 1) z = 1.3 * b; else if (kind === 2) z = -1.3 * b; else if (kind === 3) z = (Math.abs(i) <= 0 ? 1.3 * b : 0); m.push({ cx: i, cy: j, cz: z }); } return m; }

  function build(w) {
    const dict = {}, palette = [0, 1, 2, 3].map(k => D.registerShape(dict, tile(k))), K = palette.length;
    w.__dict = dict; w.__K = K;
    w.__spacing = 12; w.__radius = w.__spacing * 5.5;
    w.__field = (i, j) => palette[Stream.hashIndex(i, j, K)];        // 무한 위치 → K 형태(순수·경로 무관)
    w.__lopt = { band: w.__radius * 0.42, maxL: 3, ropt: { quantum: 0.25, spread: 2.6, subScale: 2.4 } };
    // 관찰자 경로 — 무한 세계의 *아주 멀리 떨어진* 세 지점(huge 좌표). 매번 유한 창·일정 비용.
    const S = w.__spacing;
    w.__obsPath = [{ cx: 0, cy: 0 }, { cx: 1287 * S, cy: 940 * S }, { cx: -88123 * S, cy: 50007 * S }];
    w.__obsI = 0; rebuild(w);
  }
  function rebuild(w) {
    const o = w.__obsPath[w.__obsI]; w.__obs = { cx: o.cx, cy: o.cy };
    const s = Stream.streamChunks(w.__obs, { spacing: w.__spacing, radius: w.__radius, z: 0, shapeAt: w.__field });
    w.__count = s.count;
    // 거리 LOD: 창 안에서도 가까운 청크 fine·가장자리 coarse(관찰자 기준 한 번에).
    w.__cloud = Lod.lodCloud(s.chunks, w.__dict, { cx: w.__obs.cx, cy: w.__obs.cy, cz: 0 }, w.__lopt).cloud;
    w.__surface = Surf.pointCloudSurface(w.__cloud, { res: 88 });    // 관찰자 둘레로 자동 프레이밍
    w.__hMax = w.__surface.hMax;
  }

  return {
    label: 'step_0073 — TW4 광활(무한 절차적 세계·관찰자 둘레 유한 창·비용≠세계 크기)',
    title: 'HTJ — 광활함: 세계는 무한 절차적 장, viewer 는 관찰자 둘레 유한 창만(끝없이 펼침·비용 일정)',
    sub: '세계 = 무한 절차적 장(grid (i,j)→DNA 순수 함수)·viewer 는 관찰자 둘레 반경 안 청크만 materialize(유한 작업집합). 관찰자가 huge 좌표로 가도 창 크기 일정·K 형태 공유 = 끝없이 펼침·비용≠세계 크기. 스트리밍(TW4)을 거리 LOD(0069)·제너릭 표면(0068)·형태 DNA(T2)와 함께. engine 변경 0(확인용 트랙). environment TW4.',
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
      // 관찰자 마커(창 중심·자동 프레이밍).
      const ox = (w.__obs.cx - surf.x0) / surf.dx, oy = (w.__obs.cy - surf.y0) / surf.dy;
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; pts.push({ cx: (ox + Math.cos(t) * 2.5) / (R - 1) * 88, cy: (oy + Math.sin(t) * 2.5) / (R - 1) * 88, r: 0.8, v: 1.0 }); }
      return { pts, filled: surf.filled, count: w.__count, worldX: Math.round(w.__obs.cx), worldY: Math.round(w.__obs.cy), dictSize: Object.keys(w.__dict).length };
    },

    note: '<b>세계가 *끝없이* 펼쳐진다 — 그래도 비용은 일정(관찰자 둘레 유한 창만 그린다).</b> 0069~0072 의 LOD 는 발현/물리 *비용*을 관찰 영역에 묶었지만(가까이 fine·멀면 coarse), 세계 자체는 여전히 *유한한 손수 청크 목록*(작은 패치)이었다 — 거의 모든 지형 step 이 "스케일이 핵심 미해결"이라 적은 마지막 벽돌. 이 step 은 그걸 푼다(environment TW4): <b>세계 = 무한 절차적 장</b>(<code>streamChunks</code>·grid 좌표 (i,j) → DNA shapeHash 의 *순수 함수*), viewer 는 <b>관찰자 둘레 반경 안 청크만 materialize</b>(유한 작업집합). <b>핵심(측정)</b>: 관찰자가 아무리 멀리 가도(capture 의 huge 월드 좌표) 창 크기 일정(∝반경²·세계 크기/위치 무관)·무한 위치가 K 형태만 공유(dedup K≪N·장은 (i,j)의 순수 함수라 *경로 무관*·재방문 동일) = "끝없이 펼침·비용≠세계 크기"(0015/0034/0039/0069 측정 계보의 *세계 extent* 판). <b>합성</b>: 스트리밍(TW4) 위에 거리 LOD(0069·창 안에서도 가까이 fine·가장자리 coarse)·제너릭 표면(0068 pointCloudSurface)·형태 DNA(T2) 를 *함께* 굴려 — 무한 지형이 관찰 영역 비용으로 *땅*으로 발현. <b>흐름</b>(capture 3 프레임): 관찰자(밝은 고리)가 무한 세계의 *아주 멀리 떨어진* 세 지점(0,0)→(15444,11280)→(huge)으로 점프 → 매번 같은 크기의 유한 지형 창·같은 K 팔레트. <b>원칙 준수</b>: streamChunks 는 *타입을 모름*(장은 (i,j)→hash·형태는 DNA·engine 타입코드 0)·관찰자=확인용 개념→viewer 도메인(engine 변경 0·세계↔확인용 단방향). <b>정직한 한계</b>: 장이 손수 K 팔레트+해시 사상(진짜 노이즈/바이옴 지형 생성은 후속·장 함수 교체로 확장)·청크 경계 이음매(LOD 가 부드럽히나 청크간 연속성은 근사)·정적(절차적이라 결정론적이나 시간 변화/침식 없음)·2D 평면 grid(고도 장은 DNA z·진짜 3D 청크는 후속). 다음: 절차적 장 고도화(노이즈·바이옴) 또는 침식(물↔지형 왕복)·SW5 격자 은퇴.'
  };
});
