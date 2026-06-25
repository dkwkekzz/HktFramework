// viewer/scenes/step_0116.js — (조립) 근거리 진짜 물리 / 원거리 필드: LOD 가 *관찰자(캐릭터)* 를 따라간다(PW-B).
//   0115(끝없이 걷는 땅)의 짝 — 지형 너머 *사물(바위·잔해)* 도 비용을 관찰 영역에 묶는다. adaptLOD(0039)에
//   관찰자=캐릭터를 주면, 캐릭터 *근처*는 개별 구체(fine·진짜 물리), *멀면* 블록당 하나로 합쳐진다(coarse).
//   캐릭터가 걸으면 fine 영역이 따라간다. 먼 곳 디테일을 아무리 늘려도(밀도↑) effective 개체 수는 유계
//   (블록으로 합쳐짐)·합산이라 질량 정확 보존. engine 변경 0(조립·0039 adaptLOD). 탑다운 맵. UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0116'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const N = 48, NEARR = 10, BS = 6, WORLD = 130;

  function build(w) {
    const es = []; let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 420; i++) es.push({ cx: rnd() * WORLD, cy: 1 + rnd() * 14, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, cells: 1, lodMembers: 1, radius: 0.62 });
    w.__field = es; w.__obsX = 18; w.__t = 0; w.__lod = es;
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1);
    w.__obsX = Math.min(WORLD - 18, 18 + t * 0.18);              // 캐릭터가 오른쪽으로 이동(관찰자)
    const r = En.adaptLOD(w.__field, { observer: [w.__obsX, 8, 0], nearRadius: NEARR, blockSize: BS, spread: 1 });
    w.__lod = r.entities; w.__obsY = 8;
  }

  return {
    label: 'step_0116 — (조립) 근거리 진짜 물리/원거리 필드: LOD 가 관찰자(캐릭터)를 따라간다(PW-B)',
    title: 'HTJ — 관찰자 LOD: 캐릭터 근처는 개별 구체(fine·진짜 물리)·멀면 블록으로 합쳐짐(coarse)·fine 영역이 캐릭터 따라감(비용∝관찰)',
    sub: '0115의 짝·새 물리 0. 지형 너머 사물도 비용을 관찰 영역에 묶음. adaptLOD(0039)에 관찰자=캐릭터→근처는 개별 구체(fine), 멀면 블록당 하나(coarse). 걸으면 fine 영역 따라감. 먼 디테일 늘려도(밀도↑) effective 유계·질량 정확 보존.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); sim(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [1, 150, 320, 500],                                // fine 영역이 오른쪽으로 따라간다
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : (v >= 0.5 ? [235, 200, 90] : [90, 110, 160]) },
    toFrame(w) {
      const pts = [], shift = w.__obsX - N / 2;                  // 카메라=캐릭터 중심
      for (const e of w.__lod) {
        const rx = e.cx - shift; if (rx < 0 || rx > N) continue;
        const fine = (e.lodMembers || 1) === 1;
        pts.push({ cx: rx, cy: e.cy + 16, r: fine ? 0.5 : Math.max(1.2, e.radius), v: fine ? 0.7 : 0.2 });   // fine=밝은 작은 점·coarse=큰 흐린 덩이
      }
      pts.push({ cx: N / 2, cy: w.__obsY + 16, r: 1.2, v: 1.0 });   // 캐릭터(관찰자)·항상 중앙
      return { pts };
    },

    note: '<b>근거리는 진짜 물리, 원거리는 필드 — LOD 가 *관찰자(캐릭터)* 를 따라가 비용을 *관찰 영역*에 묶는다.</b> PW-B 의 두 번째 기둥(0115 끝없는 땅의 짝): 지형 너머 *사물*(바위·잔해)도 같은 불변식을 따른다. <code>adaptLOD</code>(0039·Lagrangian LOD)에 *관찰자=캐릭터*를 주면 — 캐릭터 *근처*(nearRadius 안) 개체는 *개별 구체*(fine·진짜 물리·상호작용 가능)로 두고, *멀면* 블록 버킷당 하나의 coarse 구체로 합친다(mergeGroup·합산 정확). 캐릭터가 걸으면 그 fine 영역이 *따라간다*(뒤는 다시 coarsen·앞은 refine). <b>핵심 이득</b>: 먼 곳 디테일을 아무리 늘려도(far 밀도↑) 그것들이 *같은 블록*으로 합쳐져 effective 개체 수가 유계 — 비용이 세계 디테일이 아니라 *관찰 영역*에 묶인다. <b>측정(verify)</b>: ① <b>근거리 fine/원거리 coarse</b> 관찰자 nearRadius 안은 개별·밖은 블록 합쳐짐(far 블록 ≪ far 개체) ② <b>비용 유계</b> far 밀도 ×8 키워도(개체 117→817) effective 평탄(49→50)·블록으로 흡수 ③ <b>보존</b> coarsen/refine 합산이라 총 질량 정확 보존(LOD bulk exact) ④ <b>관찰자 따라감</b> 관찰자 옮기면 fine 집합이 따라옴(새 위치 근처 개체 fine·떠난 곳 coarsen) ⑤ 결정론. <b>흐름</b>(capture·탑다운·카메라=캐릭터 중심): 빨간 캐릭터 둘레에 *밝은 작은 점*(fine 개별 구체)이 모이고, 화면 가장자리(먼 곳)는 *큰 흐린 덩이*(coarse 블록) — 캐릭터가 걸으면 fine 무리가 따라 움직인다. <b>큰 그림</b>: PW-B 완성 — 끝없는 지형(0115) + 끝없는 사물(여기)을 *유계 비용*으로. 다음은 PW-C(딛고 사는 환경·건널 수 있는 물·발밑 바이옴). <b>원칙 준수</b>: LOD=generic adaptLOD(0039·타입 0)·관찰자=캐릭터·합산 보존·engine 변경 0. <b>정직한 한계</b>: 모양은 LOD 근사(coarse 는 내부 배열 잃음·0039 한계)·far 블록 수는 세계 *공간 범위*엔 비례(밀도엔 무관)·near 개체는 아직 상호작용 안 시킴(시연=LOD 만).'
  };
});
