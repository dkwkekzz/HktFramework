// viewer/scenes/step_0070.js — M4 DNA 물리 footprint: 가까이 가면 합친 덩어리가 *원래 DNA 형태의 물리 조각*으로
//   되쪼개진다(평면 고리 아님·4 보존량 정확). "렌더 LOD(0069)↔물리 LOD 합류" — 렌더가 그리던 그 형태를 *물리*가 차지.
//
//   merge-dna.md §4 M4 — reconstructShape(M3·렌더 점)의 *물리 개체* 판. adaptLOD(0039) refine 이 합친 개체를
//   *평면 고리*로 근사 복원하던 한계를, 개체 shapeHash 가 가리키는 DNA 형태 위치로 되쪼개되 질량·운동량·각운동량
//   (원점)·총E 를 정확 보존(refineByDNA·engine). 멀면 coarse 민둥 구 1개·가까이 fine 형태 조각 N개 = 거리 LOD 의 물리 판.
//   확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0070'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  // L 자 3D 형태(z 기복) — 합친 덩어리의 DNA(원래 구성원 배치).
  const SHAPE = [{ cx: 0, cy: 0, cz: 0 }, { cx: 1, cy: 0, cz: 0 }, { cx: 2, cy: 0, cz: 0 }, { cx: 0, cy: 1, cz: 0 }, { cx: 0, cy: 2, cz: 1 }, { cx: 2, cy: 1, cz: 0 }, { cx: 2, cy: 2, cz: 1 }];
  const ROPT = { quantum: 0.25, spread: 3.0 };

  function build(w) {
    const N = w.N, cen = N / 2;
    const dict = {}, hash = D.registerShape(dict, SHAPE);
    // 합친 덩어리(coarse·민둥 구 1개) — 알려진 질량/운동량/각운동량/총E.
    const parent = { cx: cen, cy: cen, cz: cen, radius: N * 0.09, mass: 60, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 40, cells: 60, shapeHash: hash };
    parent.KEcm = 0; parent.energy = parent.internalE;
    w.__shapeDict = dict; w.__parent = parent; w.__phys = [parent]; w.__refined = false;
    w.__refineDist = N * 0.30;                                          // 관찰자가 이 안에 들면 물리 되쪼갬
    // 관찰자 경로 — 모서리에서 덩어리로 접근.
    w.__obsPath = [{ cx: N * 0.12, cy: N * 0.12 }, { cx: N * 0.30, cy: N * 0.30 }, { cx: cen - N * 0.02, cy: cen - N * 0.02 }];
    w.__obsI = 0; setObs(w);
  }
  function setObs(w) { const o = w.__obsPath[w.__obsI]; w.__obs = { cx: o.cx, cy: o.cy, cz: w.N / 2 }; }
  // 관찰자가 가까워지면 합친 덩어리 → DNA 형태 물리 조각(refineByDNA·보존 정확). 멀어지면 다시 coarse.
  function relod(w) {
    const p = w.__parent, d = Math.hypot(w.__obs.cx - p.cx, w.__obs.cy - p.cy);
    if (d <= w.__refineDist && !w.__refined) { w.__phys = D.refineByDNA(p, w.__shapeDict, ROPT) || [p]; w.__refined = true; }
    else if (d > w.__refineDist && w.__refined) { w.__phys = [p]; w.__refined = false; }
  }

  function sum(list, f) { let s = 0; for (const e of list) s += f(e); return s; }

  return {
    label: 'step_0070 — DNA 물리 footprint(가까이 가면 합친 덩어리가 원래 형태 물리 조각으로·보존 정확)',
    title: 'HTJ — 렌더 LOD↔물리 LOD 합류: 가까이 가면 덩어리가 DNA 형태 물리 조각으로 되쪼개짐',
    sub: '합친 덩어리(coarse 민둥 구)가 관찰자 접근 시 shapeHash 가 가리키는 *원래 DNA 형태* 위치의 물리 조각 N개로 되쪼개진다(평면 고리 아님). refineByDNA(engine)가 질량·운동량·각운동량(원점)·총E 를 정확 보존. 렌더가 그리던(reconstructShape 0063) 바로 그 형태를 물리가 차지 = 거리 LOD(0069)의 물리 판. merge-dna §4 M4.',
    mode: 'energy', dynamics: false, render: 'energy',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__obsI < w.__obsPath.length - 1) { w.__obsI++; setObs(w); relod(w); } },

    // ── 헤드리스 캡처(top-down·물리 개체 디스크 + 관찰자 마커) ──
    makeWorld() { return { N: 48 }; },
    frames: [0, 1, 2],
    captureOpts: { N: 48, cellPx: 8 },
    toFrame(w) {
      const pts = [];
      // 물리 개체(코어스 1개 or 형태 조각 N개) — z 높을수록 밝게(형태 기복 보임).
      let zmin = Infinity, zmax = -Infinity; for (const e of w.__phys) { if (e.cz < zmin) zmin = e.cz; if (e.cz > zmax) zmax = e.cz; }
      const zspan = (zmax - zmin) || 1;
      for (const e of w.__phys) pts.push({ cx: e.cx, cy: e.cy, r: e.radius, v: 0.45 + 0.45 * (e.cz - zmin) / zspan });
      // 관찰자 마커(밝은 고리).
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; pts.push({ cx: w.__obs.cx + Math.cos(t) * 1.6, cy: w.__obs.cy + Math.sin(t) * 1.6, r: 0.5, v: 1.0 }); }
      return { pts, members: w.__phys.length, totalMass: sum(w.__phys, e => e.mass), totalE: sum(w.__phys, e => e.energy) };
    },

    note: '<b>가까이 가면 합친 덩어리가 *원래 DNA 형태의 물리 조각*으로 되쪼개진다 — 평면 고리(0039 한계)가 아니라 진짜 모양, 그리고 4 보존량 정확.</b> 0069(거리 LOD)는 *렌더* 해상도를 관찰자 거리에 묶었다. 이 step 은 그 *물리* 판이다(merge-dna §4 M4): 합친 개체(coarse 민둥 구 1개)에 관찰자가 다가오면 <code>refineByDNA</code>(engine·htj-shapedna)가 그 개체의 <code>shapeHash</code> 가 가리키는 세계 사전(shapeDict)의 *원래 구성원 배치*로 N개 물리 조각을 되쪼갠다. <b>핵심(합류)</b>: 같은 사전·hash·배율을 써 → <b>렌더가 그리던(reconstructShape 0063/0069) 바로 그 형태를 *물리*가 차지</b>한다(렌더 LOD↔물리 LOD 합류). <b>보존</b>: 구성원이 모두 부모 CoM 속도를 받고 offset 합을 0 으로 맞춰 → 질량·운동량·<b>각운동량(원점·궤도+스핀)</b>·총E 를 *정확* 보존(폭발 없는 dispersalFrac=0 판). 모양은 유지되되 물리는 무손실 — adaptLOD(0039) refine 이 *평면 고리*로 근사하던 한계를 푼다. <b>흐름</b>(capture 3 프레임): 관찰자(밝은 고리)가 모서리→접근→덩어리 곁 → 덩어리가 1개 큰 구 → <b>L 자 형태 7조각</b>으로 되쪼개짐(z 기복=밝기). <b>원칙 준수</b>: refineByDNA 는 *타입을 모른다* — 입력은 개체+사전, 형태는 DNA 가 담는다(engine 타입코드 0·sphere-world §1). hash 없음/사전에 없음 → null(호출자 fragmentEntity 평면 고리 폴백=0039 불변·회귀 0). <b>정직한 한계</b>: 되쪼갠 조각은 *정적*(이 장면은 발현 시연·되쪼갠 뒤 자유 운동/재정착은 후속)·회전 미정규화(M2·회전한 같은 모양→다른 hash)·재coarsen 은 viewer 토글(엔진 adaptLOD 의 DNA 경로 배선은 후속 hook)·조각 반경 등가 구 근사. 다음: adaptLOD 에 refineByDNA hook 배선 또는 TW4 광활·침식.'
  };
});
