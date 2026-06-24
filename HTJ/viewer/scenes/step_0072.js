// viewer/scenes/step_0072.js — adaptLOD coarsen DNA 태깅: 재coarsen 해도 형태가 살아남는다(왕복 LOD 루프 완성).
//   0071 은 매 프레임 master 에서 새로 전개해 재coarsen 의 DNA 소실을 *회피*했다. 이 step 은 그 구멍을 메운다:
//   adaptLOD coarsen 이 opts.tagDNA 훅으로 합친 블롭에 shapeHash 를 *부착* → 누적 상태로 굴려도 coarsen→refine→
//   재coarsen→refine 왕복에서 *원래 형태*가 보존된다(refine 이 평면 고리로 떨어지지 않음). 0071 의 짝.
//
//   merge-dna.md §4 M2/M4 — coarsen 은 형태를 *기억*(tagDNA)·refine 은 형태를 *복원*(refineByDNA). 둘이 모여
//   DNA 가 LOD cycle 을 살아남는 닫힌 루프. 확인용 도구라 engine 을 읽기만. UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0072'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const E = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const D = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  const SHAPE = [{ cx: 0, cy: 0, cz: 0 }, { cx: 1, cy: 0, cz: 0 }, { cx: 2, cy: 0, cz: 0 }, { cx: 0, cy: 1, cz: 0 }, { cx: 0, cy: 2, cz: 1 }, { cx: 2, cy: 1, cz: 0 }, { cx: 2, cy: 2, cz: 1 }];
  const ROPT = { quantum: 0.25, spread: 2.6 };

  function build(w) {
    const N = w.N, cen = N / 2;
    const dict = {}, hash = D.registerShape(dict, SHAPE);
    // 시작 = coarse DNA 블롭 1개(이미 태깅됨·합쳐졌다 가정).
    const blob = { cx: cen, cy: cen, cz: cen, radius: N * 0.08, mass: 42, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 28, cells: 42, lodMembers: SHAPE.length, shapeHash: hash };
    blob.KEcm = 0; blob.energy = blob.internalE;
    w.__dict = dict; w.__live = [blob]; w.__N = N;
    // 관찰자: 멀리(coarse) → 가까이(refine) → 멀리(재coarsen·태깅) → 가까이(refine·*같은* 형태).
    w.__obsPath = [{ cx: N * 0.12, cy: N * 0.12 }, { cx: cen - 1, cy: cen - 1 }, { cx: N * 0.88, cy: N * 0.12 }, { cx: cen - 1, cy: cen - 1 }];
    w.__obsI = 0; setObs(w);
  }
  function setObs(w) { const o = w.__obsPath[w.__obsI]; w.__obs = { cx: o.cx, cy: o.cy }; }
  // 누적 상태로 LOD 한 스텝 — coarsen 은 tagDNA 로 형태 기억·refine 은 refineByDNA 로 형태 복원(왕복 보존).
  function lod(w) {
    const r = E.adaptLOD(w.__live, {
      observer: [w.__obs.cx, w.__obs.cy, w.__N / 2], blockSize: w.__N * 1.1, nearRadius: w.__N * 0.30, spread: 1,
      tagDNA: (mem) => D.registerShape(w.__dict, mem),                  // coarsen: 형태 기억(0072)
      refineDNA: (e) => D.refineByDNA(e, w.__dict, ROPT)               // refine: 형태 복원(0071)
    });
    w.__live = r.entities;
  }

  function sum(list, f) { let s = 0; for (const e of list) s += f(e); return s; }

  return {
    label: 'step_0072 — coarsen DNA 태깅(재coarsen 해도 형태 보존·왕복 LOD 루프 완성)',
    title: 'HTJ — 왕복 LOD: coarse→형태 조각→재coarse→형태 조각, DNA 가 cycle 을 살아남는다',
    sub: '0071 이 회피한 재coarsen DNA 소실을 메운다: adaptLOD coarsen 이 opts.tagDNA 훅으로 합친 블롭에 shapeHash 부착 → 누적 상태로 굴려도 coarsen→refine→재coarsen→refine 에서 원래 형태 보존(refine 이 평면 고리로 안 떨어짐). coarsen=형태 기억·refine=형태 복원. 4 보존량 정확·태깅은 메타데이터(물리 불변). merge-dna §4 M2/M4.',
    mode: 'energy', dynamics: false, render: 'energy',
    defaults: {},

    init(w) { build(w); },
    advance(w) { if (w.__obsI < w.__obsPath.length - 1) { w.__obsI++; setObs(w); lod(w); } },

    makeWorld() { return { N: 48 }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: 48, cellPx: 8 },
    toFrame(w) {
      const pts = [];
      let zmin = Infinity, zmax = -Infinity; for (const e of w.__live) { if (e.cz < zmin) zmin = e.cz; if (e.cz > zmax) zmax = e.cz; }
      const zspan = (zmax - zmin) || 1;
      for (const e of w.__live) pts.push({ cx: e.cx, cy: e.cy, r: e.radius, v: 0.4 + 0.5 * (e.cz - zmin) / zspan });
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; pts.push({ cx: w.__obs.cx + Math.cos(t) * 1.6, cy: w.__obs.cy + Math.sin(t) * 1.6, r: 0.5, v: 1.0 }); }
      return { pts, pieces: w.__live.length, dnaTagged: w.__live.filter(e => e.shapeHash).length, totalMass: sum(w.__live, e => e.mass) };
    },

    note: '<b>재coarsen 해도 형태가 살아남는다 — coarse→DNA 형태 조각→재coarse→*같은* DNA 형태 조각.</b> 0071 은 LOD 루프를 매 프레임 정준 master 에서 새로 전개해 *재coarsen 의 DNA 소실*을 회피했다(mergeGroup 이 shapeHash 를 안 태깅). 이 step 은 그 구멍을 메운다: <code>adaptLOD</code> coarsen 가지에 <code>opts.tagDNA(members)</code> 훅(0062 tagMerge·0071 refineDNA 와 같은 DI 패턴) — 합치며 구성원 배치를 형태 DNA 로 정규화·등록해 블롭에 <b>shapeHash 부착</b>. 그러면 누적 상태로 굴려도 <b>coarsen→refine→재coarsen→refine 왕복</b>에서 원래 형태가 보존된다(refine 0071 이 평면 고리로 떨어지지 않음). <b>핵심 짝</b>: coarsen 은 형태를 <i>기억</i>(tagDNA)·refine 은 형태를 <i>복원</i>(refineByDNA·0070) → DNA 가 LOD cycle 을 살아남는 닫힌 루프. <b>흐름</b>(capture 4 프레임): 관찰자(밝은 고리)가 멀리(coarse 민둥 구 1개)→가까이(L 자 형태 7조각)→멀리(재coarse·태깅·1개)→가까이(<b>같은</b> L 자 7조각) → DNA 가 왕복을 살아남음. <b>보존·확장성</b>: 태깅은 *메타데이터*라 질량·운동량·각운동량·총E 불변(rehash 가 태그와 동일·형태 cycle 보존)·같은 형태는 사전 1항목(K 불변·dedup). <b>원칙 준수</b>: tagDNA/refineDNA 모두 *타입을 모름*(형태는 DNA·engine 타입코드 0)·훅 미지정→0039 byte 동일(회귀0). <b>정직한 한계</b>: 되쪼갠 조각 정적(자유 운동/재정착 후속)·회전 미정규화(M2·회전한 같은 모양→다른 hash)·near/far 2단(연속 LOD 아님)·coarsen 은 블록당 2+ 일 때만. 다음: TW4 광활(무한 펼침·스케일) 또는 침식(물↔지형 왕복)·SW5 격자 은퇴.'
  };
});
