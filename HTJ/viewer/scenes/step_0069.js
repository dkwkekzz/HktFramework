// viewer/scenes/step_0069.js — T3 거리 LOD: DNA 발현 해상도를 관찰자 거리에 묶는다(가까이 fine·멀면 coarse).
//
//   merge-dna.md §5 T3 — 0068(T2b)은 *모든* 청크를 같은 해상도로 표면 발현했다. 세계가 커지면(청크 N↑)
//   전부 fine 비용이 N 에 비례한다. 이 step 은 SW4 적응 LOD(0039·물리)의 **렌더 판**: 관찰자에 가까운 청크는
//   fine(전체 DNA 점)·멀수록 coarse(decimate)·가장 먼 청크는 *민둥 구 1개*. 관찰자가 움직이면 **fine 영역이
//   따라온다** = 비용이 *세계 크기*가 아니라 *관찰 영역*에 묶인다. **지형 전용 코드 0**(engine·htj-render.js 변경 0)
//   — 타입 무관 lodCloud(viewer) + 기존 제너릭 pointCloudSurface(0068) + drawSurface(0065) 조립.
//
//   확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0069'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;
  const Lod = require ? require('../htj-lod.js') : self.HTJLod;
  const Surf = require ? require('../htj-surface.js') : self.HTJSurface;

  // 5×5 앵커 타일 — kind 가 둔덕/분지/평지(정규화 후 K=3 종·dedup).
  function tile(kind) {
    const m = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const bump = Math.max(0, 1 - (i * i + j * j) / 6);
      let z = 0; if (kind === 'peak') z = 1.3 * bump; else if (kind === 'valley') z = -1.3 * bump;
      m.push({ cx: i, cy: j, cz: z });
    }
    return m;
  }
  const G = 6;                                                          // 6×6 = 36 청크 = 넓은 세계
  const KINDS = []; for (let k = 0; k < G * G; k++) KINDS.push(['flat', 'peak', 'valley'][(k * 7 + (k / G | 0)) % 3]);

  function build(w) {
    const N = w.N, SP = N / (G + 0.5), cen = (N - SP * (G - 1)) / 2;
    const dict = {}, chunks = [];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const hash = D.registerShape(dict, tile(KINDS[r * G + c]));        // 제너릭 DNA 등록(dedup·0067)
      chunks.push({ cx: cen + c * SP, cy: cen + r * SP, cz: N * 0.5, radius: SP * 0.5, mass: 1e9, anchored: true, shapeHash: hash });
    }
    w.__entities = chunks; w.__shapeDict = dict; w.__SP = SP;
    w.__lopt = { band: SP * 1.05, maxL: 4, ropt: { quantum: 0.25, spread: 2.6, subScale: 2.4 } };
    // 관찰자 경로 — 한 모서리에서 반대 모서리로 대각 스윕(fine 영역이 따라옴을 보임).
    const a = cen - SP * 0.3, b = cen + SP * (G - 0.7);
    w.__obsPath = [{ cx: a, cy: a }, { cx: (a + b) / 2, cy: (a + b) / 2 }, { cx: b, cy: b }];
    w.__obsI = 0;
    rebuild(w);
  }
  // 관찰자 거리별 LOD 점 무리 → 제너릭 연속 표면(점→면). 관찰자가 움직이면 fine 영역이 따라온다.
  function rebuild(w) {
    const obs = w.__obsPath[w.__obsI]; w.__obs = { cx: obs.cx, cy: obs.cy, cz: w.N * 0.5 };
    const r = Lod.lodCloud(w.__entities, w.__shapeDict, w.__obs, w.__lopt);
    w.__cloud = r.cloud; w.__lod = r;
    w.__surface = Surf.pointCloudSurface(r.cloud, { res: 84 });          // ← 제너릭(타입 무관·0068)
    w.__hMax = w.__surface.hMax;
  }

  return {
    label: 'step_0069 — 거리 LOD(발현 해상도가 관찰자 거리에 묶임·가까이 fine·멀면 coarse·민둥 구)',
    title: 'HTJ — 거리 LOD: 가까이 fine·멀면 coarse·비용∝관찰 영역(세계 크기 아님)',
    sub: '0068 의 *모든 청크 같은 해상도* 표면을 관찰자 거리에 묶는다: 가까운 청크는 fine(전체 DNA 점)·멀수록 coarse(decimate)·가장 먼 청크는 민둥 구 1개. 관찰자가 움직이면 fine 영역이 따라온다 = 비용이 세계 크기가 아니라 관찰 영역에. SW4 적응 LOD(0039·물리)의 렌더 판. engine·htj-render.js 변경 0(타입 무관 lodCloud + 기존 pointCloudSurface·drawSurface 조립). merge-dna §5 T3.',
    mode: 'energy', dynamics: false, render: 'terrain',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__obsI < w.__obsPath.length - 1) { w.__obsI++; rebuild(w); } },  // 관찰자 한 칸 전진

    // ── 헤드리스 캡처(top-down 음영 표면 + 관찰자 마커) ──
    makeWorld() { return { N: 48 }; },
    frames: [0, 1, 2],                                                   // 관찰자 3 위치(스윕)
    captureOpts: { N: 84 },
    toFrame(w) {
      const surf = w.__surface, R = surf.nx, pts = [];
      const Lv = [0.5, 0.7, 0.55], Lm = Math.hypot(Lv[0], Lv[1], Lv[2]), Ln = [Lv[0] / Lm, Lv[1] / Lm, Lv[2] / Lm];
      const span = (surf.hMax - surf.hMin) || 1;
      for (let J = 0; J < R; J++) for (let I = 0; I < R; I++) {
        const k = J * R + I; if (!surf.mask[k]) continue;
        const n = surf.normals[k], shade = 0.35 + 0.5 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);
        const h = (surf.heights[k] - surf.hMin) / span;
        pts.push({ cx: (I / (R - 1)) * 84, cy: (J / (R - 1)) * 84, r: 0.6, v: 0.22 + 0.6 * shade * (0.6 + 0.4 * h) });
      }
      // 관찰자 마커(밝은 점) — surface 평면 좌표(x0/dx)로 사상.
      const ox = (w.__obs.cx - surf.x0) / surf.dx, oy = (w.__obs.cy - surf.y0) / surf.dy;
      for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2; pts.push({ cx: (ox + Math.cos(ang) * 2.5) / (R - 1) * 84, cy: (oy + Math.sin(ang) * 2.5) / (R - 1) * 84, r: 0.8, v: 1.0 }); }
      return { pts, filled: surf.filled, fineCount: w.__lod.fineCount, finePoints: w.__lod.finePoints, totalPoints: w.__lod.totalPoints, dictSize: Object.keys(w.__shapeDict).length };
    },

    note: '<b>발현 해상도가 *관찰자 거리*에 묶인다 — 가까이 fine·멀면 coarse·관찰자가 움직이면 fine 영역이 따라온다.</b> 0068(T2b)은 *모든* 지형 청크를 같은 해상도로 표면 발현했다. 세계가 커지면(청크 N↑) 전부 fine 으로 그리는 비용이 N 에 비례한다. 이 step 은 그 발현을 <b>관찰자 거리</b>에 묶는다(merge-dna §5 T3·SW4 적응 LOD 0039 의 <b>렌더 판</b>): 가까운 청크는 <b>fine</b>(전체 DNA 점·reconstructShape 0063), 멀수록 <b>coarse</b>(stride=2^L decimate·반경 √stride 확대로 덮음), 가장 먼 청크는 <b>민둥 구 1개</b>("hash 한 개 coarse"). <b>핵심(측정)</b>: 먼 세계를 키워도 <b>fine(비싼) 예산은 불변</b>·먼 청크는 청크당 O(1) → 비용이 *세계 크기*가 아니라 *관찰 영역*에 묶인다(0039/0015/0034 의 측정 계보·렌더 판). <b>흐름</b>(capture 3 프레임): 관찰자(밝은 고리)가 한 모서리→중앙→반대 모서리로 스윕 → 그 둘레만 *선명한 땅*(fine), 먼 곳은 *흐릿한 큰 둔덕*(coarse) → fine 영역이 관찰자를 따라온다. <b>원칙 준수</b>: lodCloud(viewer/htj-lod.js)는 <b>타입을 모른다</b> — 입력은 개체+사전+관찰자, 출력은 점 무리. 관찰자(camera·거리)는 *확인용* 개념이라 engine 이 모르는 viewer 도메인(세계↔확인용 단방향·<b>engine·htj-render.js 변경 0</b>=구조적 회귀 0·engine 타입코드 0). 자연스러움은 손수 필터가 아니라 겹치는 구체 splat(0068)·LOD 도 그 위. <b>정직한 한계</b>: 거리 LOD 는 *발현*(렌더)만 — 물리 footprint LOD(가까이서 hash→형태 *물리* 되쪼갬)는 M4·TW4 합류·hysteresis 없음(레벨 경계 깜빡임 가능·band 밴드폭 노브)·top-down 높이장(M2 회전 미정규화·오버행 없음)·타일 손수 골격(절차 생성 TW4). 다음: M4 물리 footprint 또는 TW4 광활(무한 펼침)·침식.'
  };
});
