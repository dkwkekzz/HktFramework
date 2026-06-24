// viewer/scenes/step_0068.js — T2b 제너릭 표면 발현: DNA 점 무리(0067 배선)를 *연속 음영 표면*으로(점→면).
//
//   merge-dna.md §5 T2(B)표현 — 0067(A 배선)은 지형을 DNA 경로로 태웠으나 발현이 *점 무리*(공 무더기)였다.
//   이 step 은 그 점 무리를 **제너릭** pointCloudSurface(viewer/htj-surface.js)로 연속 높이장+법선으로 환원해
//   기존 **제너릭** drawSurface(render:'terrain')로 그린다 = *땅*. 자연스러움은 손수 필터가 아니라 *겹치는 구체
//   splat*에서 창발(sphere-world §3). **지형 전용 코드 0**(engine·htj-render.js 변경 0) — 타입 무관 유틸·경로 조립만.
//
//   확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0068'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;
  const S = require ? require('../htj-surface.js') : self.HTJSurface;

  // 로컬 타일 = 5×5 앵커 패치. kind 가 매끄러운 둔덕/분지/평지를 만든다(정규화 후 K=3 종).
  function tile(kind) {
    const m = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const bump = Math.max(0, 1 - (i * i + j * j) / 6);
      let z = 0;
      if (kind === 'peak') z = 1.3 * bump;
      else if (kind === 'valley') z = -1.3 * bump;
      m.push({ cx: i, cy: j, cz: z });
    }
    return m;
  }
  const KINDS = ['flat', 'peak', 'peak', 'flat', 'valley', 'peak', 'peak', 'valley', 'valley', 'peak', 'peak', 'valley', 'flat', 'valley', 'valley', 'flat'];

  function build(w) {
    const N = w.N, G = 4, SP = N / (G + 0.5), cen = (N - SP * (G - 1)) / 2;
    const dict = {}, chunks = [];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const hash = D.registerShape(dict, tile(KINDS[r * G + c]));      // 제너릭 DNA 등록(dedup·0067)
      chunks.push({ cx: cen + c * SP, cy: cen + r * SP, cz: N * 0.5, radius: SP * 0.5, mass: 1e9, anchored: true, shapeHash: hash, px: 0, py: 0, pz: 0 });
    }
    w.__entities = chunks; w.__shapeDict = dict;
    w.__ropt = { quantum: 0.25, spread: 2.6, subScale: 2.4 };          // sub-구체 겹치게(연속 표면)
    rebuildSurface(w);
  }
  // DNA 점 무리 → 제너릭 연속 표면(점→면). 0067 의 점 무리를 표면으로 *승급*.
  function rebuildSurface(w) {
    const cloud = [];
    for (const e of w.__entities) { const pts = D.reconstructShape(e, w.__shapeDict, w.__ropt); if (pts) for (const p of pts) cloud.push(p); }
    w.__cloud = cloud;
    w.__surface = S.pointCloudSurface(cloud, { res: 72 });             // ← 제너릭(타입 무관)·terrainSurface 대체
    w.__hMax = w.__surface.hMax;
  }

  return {
    label: 'step_0068 — 제너릭 표면 발현(DNA 점 무리→연속 음영 땅·점→면)',
    title: 'HTJ — DNA 점 무리를 제너릭 표면으로: 지형 전용 코드 없이 점→면(땅)',
    sub: '0067 의 DNA 점 무리(공 무더기)를 제너릭 pointCloudSurface 로 연속 음영 표면으로 발현. 자연스러움은 손수 필터가 아니라 겹치는 구체 splat 창발. engine·htj-render.js 변경 0(타입 무관 유틸·기존 drawSurface 조립). merge-dna §5 T2(B).',
    mode: 'energy', dynamics: false, render: 'terrain',
    defaults: {},

    init(w) { build(w); },
    advance(w) { /* 정적 지형(무한질량 앵커) */ },

    // ── 헤드리스 캡처(top-down 음영 표면) ──
    makeWorld() { return { N: 40 }; },
    frames: [1],
    captureOpts: { N: 72 },
    toFrame(w) {
      const surf = w.__surface, R = surf.nx, pts = [];
      const Lv = [0.5, 0.7, 0.55], Lm = Math.hypot(Lv[0], Lv[1], Lv[2]), Ln = [Lv[0] / Lm, Lv[1] / Lm, Lv[2] / Lm];
      const span = (surf.hMax - surf.hMin) || 1;
      for (let J = 0; J < R; J++) for (let I = 0; I < R; I++) {
        const k = J * R + I; if (!surf.mask[k]) continue;             // 표면 점유 셀만(연속 땅)
        const n = surf.normals[k], shade = 0.35 + 0.5 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);
        const h = (surf.heights[k] - surf.hMin) / span;               // 높이 → 음영에 살짝 섞기
        pts.push({ cx: (I / (R - 1)) * 72, cy: (J / (R - 1)) * 72, r: 0.6, v: 0.25 + 0.6 * shade * (0.6 + 0.4 * h) });
      }
      return { pts, filled: surf.filled, dictSize: Object.keys(w.__shapeDict).length, cloud: w.__cloud.length };
    },

    note: '<b>DNA 점 무리가 *연속 음영 땅*으로 발현된다 — 점→면(공 무더기 끝).</b> 0067(T2 A 배선)은 지형을 제너릭 DNA 경로로 태웠지만 발현이 *점 무리*였다(B 표현 미해결). 이 step 은 그 점 무리를 <b>제너릭</b> <code>pointCloudSurface</code>(viewer/htj-surface.js)로 연속 높이장+법선으로 환원해 기존 <b>제너릭</b> <code>drawSurface</code>(render:terrain)로 그린다. <b>핵심(원칙 준수)</b>: 이 표면 유틸은 <b>타입을 모른다</b> — 입력은 그냥 점 무리({cx,cy,cz,r})라 지형이든 합친 덩어리든 같은 함수가 표면으로 발현한다(0065 terrainSurface 의 *지형 특별취급*과 정반대). <b>자연스러움(매끄러움)은 손수 필터(0067 되돌린 smooth)가 아니라 *겹치는 구체 splat*에서 창발</b>(sphere-world §3 "모양은 구체 배열에 담긴다 — 겹치면 면"). <b>engine·htj-render.js 변경 0</b>(타입 무관 유틸 + 기존 drawSurface 조립) → 구조적 회귀 0·engine 타입코드 0(절대 원칙). <b>세계↔확인용 단방향</b>: pointCloudSurface 는 어디에/무슨 표면을 그릴지만(순수·렌더 의존 0)·픽셀·음영색은 viewer. <b>정직한 한계</b>: top-down 높이장 발현(오버행/동굴 없음·단일 z=f(x,y))·회전 미정규화(M2)·타일 손수 골격(절차 생성 후속)·거리 LOD 는 T3(TW4). 다음: T3 거리 LOD 또는 침식.'
  };
});
