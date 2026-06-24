// viewer/scenes/step_0071.js — adaptLOD↔refineByDNA 배선: LOD 루프가 near 개체를 *원래 DNA 형태* 물리 조각으로
//   되쪼갠다(0070 의 refineByDNA 를 실제 0039 LOD 파이프라인에). 0069(렌더 LOD)의 *물리* 판 — 물리 조각(비용)이
//   관찰 영역에 묶인다: 가까운 합친 덩어리는 DNA 형태 N조각으로 펼쳐지고, 먼 것은 coarse 민둥 구 1개로 남는다.
//
//   merge-dna.md §4 M4 — 정준 세계 = coarse DNA 개체 목록, adaptLOD 가 *관찰자 의존* 전개를 낸다(매 프레임 master
//   에서 새로). 합친 개체의 shapeHash 가 있으면 refineByDNA(보존 정확)·없으면 fragmentEntity 평면 고리(0039).
//   확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0071'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const E = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  const SHAPE = [{ cx: 0, cy: 0, cz: 0 }, { cx: 1, cy: 0, cz: 0 }, { cx: 2, cy: 0, cz: 0 }, { cx: 0, cy: 1, cz: 0 }, { cx: 0, cy: 2, cz: 1 }, { cx: 2, cy: 1, cz: 0 }, { cx: 2, cy: 2, cz: 1 }];
  const ROPT = { quantum: 0.25, spread: 2.6 };

  function build(w) {
    const N = w.N, G = 4, S = N / (G + 1), cen = N - S * G;
    const dict = {}, hash = D.registerShape(dict, SHAPE), master = [];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const e = { cx: cen + c * S, cy: cen + r * S, cz: N / 2, radius: S * 0.22, mass: 30, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 24, cells: 30, lodMembers: SHAPE.length, shapeHash: hash };
      e.KEcm = 0; e.energy = e.internalE; master.push(e);
    }
    w.__dict = dict; w.__master = master; w.__S = S;
    w.__obsPath = [{ cx: cen - S * 0.3, cy: cen - S * 0.3 }, { cx: cen + S * 1.5, cy: cen + S * 1.5 }, { cx: cen + S * (G - 0.7), cy: cen + S * (G - 0.7) }];
    w.__obsI = 0; relod(w);
  }
  function relod(w) {
    const o = w.__obsPath[w.__obsI]; w.__obs = { cx: o.cx, cy: o.cy };
    const r = E.adaptLOD(w.__master, {
      observer: [o.cx, o.cy, w.N / 2], blockSize: w.__S * 0.85, nearRadius: w.__S * 1.25, spread: 1,
      refineDNA: (e) => D.refineByDNA(e, w.__dict, ROPT)                  // DNA 형태 물리 복원 훅(보존 정확)
    });
    w.__view = r.entities; w.__refined = r.refined;
  }
  function sum(list, f) { let s = 0; for (const e of list) s += f(e); return s; }

  return {
    label: 'step_0071 — adaptLOD↔refineByDNA 배선(near=DNA 형태 물리 조각·far=coarse 민둥 구·물리 비용∝관찰)',
    title: 'HTJ — 물리 LOD: 가까운 덩어리는 DNA 형태 조각으로 펼치고 먼 것은 coarse·물리 비용이 관찰 영역에',
    sub: '0070 의 refineByDNA 를 실제 LOD 파이프라인(adaptLOD·0039)에 배선. 정준 세계=coarse DNA 개체 목록, adaptLOD 가 관찰자 의존 전개를 낸다: 가까운 합친 덩어리는 원래 DNA 형태 N조각으로(보존 정확)·먼 것은 coarse 민둥 구 1개. 0069(렌더 LOD)의 물리 판 — 물리 조각 수(비용)가 세계 크기 아닌 관찰 영역에. 훅 미지정/DNA 없음 → fragmentEntity 평면 고리(0039·회귀0). merge-dna §4 M4.',
    mode: 'energy', dynamics: false, render: 'energy',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__obsI < w.__obsPath.length - 1) { w.__obsI++; relod(w); } },

    makeWorld() { return { N: 64 }; },
    frames: [0, 1, 2],
    captureOpts: { N: 64, cellPx: 7 },
    toFrame(w) {
      const pts = [];
      let zmin = Infinity, zmax = -Infinity; for (const e of w.__view) { if (e.cz < zmin) zmin = e.cz; if (e.cz > zmax) zmax = e.cz; }
      const zspan = (zmax - zmin) || 1;
      for (const e of w.__view) pts.push({ cx: e.cx, cy: e.cy, r: e.radius, v: 0.4 + 0.5 * (e.cz - zmin) / zspan });
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; pts.push({ cx: w.__obs.cx + Math.cos(t) * 2.0, cy: w.__obs.cy + Math.sin(t) * 2.0, r: 0.6, v: 1.0 }); }
      return { pts, pieces: w.__view.length, refined: w.__refined, totalMass: sum(w.__view, e => e.mass) };
    },

    note: '<b>LOD 루프(adaptLOD·0039)가 관찰자 곁의 합친 덩어리를 *원래 DNA 형태 물리 조각*으로 되쪼갠다 — 0070 의 refineByDNA 가 실제 파이프라인에.</b> 0069 는 *렌더* 해상도를 관찰자 거리에 묶었고 0070 은 한 덩어리의 *물리* 되쪼갬을 보였다. 이 step 은 그 둘을 잇는다(merge-dna §4 M4): <b>정준 세계 = coarse DNA 개체(shapeHash 만) 목록</b>, <code>adaptLOD</code> 가 매 프레임 *관찰자 의존* 전개를 낸다 — 가까운(near) 덩어리는 <code>refineByDNA</code> 로 원래 형태 N조각으로 펼치고(4 보존량 정확), 먼(far) 것은 <b>coarse 민둥 구 1개</b>로 남긴다. <b>핵심</b>: 물리 조각 수(비용)가 *세계 크기*가 아니라 *관찰 영역*에 묶인다 = 0069 렌더 LOD 의 <b>물리 판</b>(0034 공간 LOD·0039 적응 LOD 의 Lagrangian 계보). <b>배선 방식</b>: adaptLOD refine 가지에 <code>opts.refineDNA(entity)</code> 훅 추가(0062 tagMerge 훅 선례·가법) — 훅이 있고 개체가 DNA 를 들면 형태 복원, 없으면 fragmentEntity *평면 고리*(0039·byte 동일·회귀0). <b>흐름</b>(capture 3 프레임): 관찰자(밝은 고리)가 4×4 덩어리 밭을 가로질러 스윕 → 그 둘레만 *DNA 형태 7조각*으로 펼쳐지고 먼 곳은 *큰 구 1개*로 남는다 → 물리 디테일이 관찰자를 따라온다. <b>원칙 준수</b>: refineByDNA·adaptLOD 모두 *타입을 모른다*(형태는 DNA·engine 타입코드 0). <b>정직한 한계</b>: 매 프레임 master 에서 새로 전개(refine→coarsen 누적이 shapeHash 를 잃는 문제 회피 — mergeGroup 이 DNA 태깅 안 함·재coarsen DNA 보존은 후속)·되쪼갠 조각 정적(자유 운동/재정착은 후속)·회전 미정규화(M2)·near/far 2단(연속 LOD 아님). 다음: 재coarsen DNA 태깅(M2 tagMerge 를 adaptLOD coarsen 에) 또는 TW4 광활·침식.'
  };
});
