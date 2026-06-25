// viewer/scenes/step_0117.js — (조립) 건널 수 있는 물: SPH 물이 *상호작용하는 물체*다(부력+저항·PW-C).
//   PW-C(딛고 사는 환경)의 물 — 새 물리 0. 캐릭터를 SPH 물 입자들과 *같은 배열*에 넣어 함께 굴리면, 물을
//   만드는 바로 그 법칙에서 두 거동이 *창발*한다: ① 부력 = SPH 압력(0041)의 ∇P(아르키메데스) — 가벼우면
//   뜨고 무거우면 가라앉는다(잠김 깊이 ∝ 밀도) ② 저항 = SPH 점성(0046) — 물 속 수평 운동이 느려진다(건너기
//   힘듦). 물은 generic SPH(타입 0)·캐릭터는 그 압력장 속 한 물체일 뿐. 시연: 가벼운(초록)·무거운(적갈)
//   캐릭터를 못에 떨어뜨림 → 초록은 수면에 뜨고 적갈은 가라앉는다. engine 변경 0. 수직=z(중력 −z)·측면도. UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0117'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const N = 28, DT = 0.02, G = 4;
  const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 }, bopt = { stiffness: 200, damp: 30, skin: 0.6 };

  function mkw(x, z) { return { cx: x, cy: 0, cz: z, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }
  function build(w) {
    const an = [];
    for (let x = 0; x <= 24; x++) an.push({ cx: x, cy: 0, cz: -3, radius: 3 });             // 바닥
    for (let z = 0; z <= 18; z += 2) { an.push({ cx: -1, cy: 0, cz: z, radius: 2 }); an.push({ cx: 25, cy: 0, cz: z, radius: 2 }); }  // 벽(못)
    const water = [];
    for (let x = 3; x <= 21; x += 1.3) for (let z = 1; z <= 10; z += 1.3) water.push(mkw(x, z));
    for (let s = 0; s < 400; s++) { Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt); for (const p of water) p.pz -= p.mass * G * DT; Sph.sphBoundaryForce(water, an, DT, bopt); En.stepEntities(water, DT); }
    const surf = Math.max(...water.map(p => p.cz));
    const light = { cx: 9, cy: 0, cz: surf + 5, mass: 0.4, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1.4 };   // 가벼움→뜸
    const heavy = { cx: 15, cy: 0, cz: surf + 5, mass: 3.0, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1.4 };  // 무거움→가라앉음
    w.__an = an; w.__water = water; w.__light = light; w.__heavy = heavy; w.__surf = surf;
  }
  function sim(w) {
    const all = [...w.__water, w.__light, w.__heavy];
    Sph.sphPressureForce(all, DT, popt); Sph.sphViscosity(all, DT, vopt);
    for (const p of all) p.pz -= p.mass * G * DT;
    Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
    Sph.sphBoundaryForce([w.__light, w.__heavy], w.__an, DT, bopt);    // 캐릭터도 벽·바닥엔 막힘(못 통과)
    En.stepEntities(all, DT);
  }

  return {
    label: 'step_0117 — (조립) 건널 수 있는 물: SPH 물이 상호작용하는 물체다(부력+저항·PW-C)',
    title: 'HTJ — 건널 수 있는 물: 캐릭터를 SPH 물에 넣으면 압력서 부력(가벼우면 뜸·무거우면 가라앉음)·점성서 저항이 창발',
    sub: 'PW-C 의 물·새 물리 0. 캐릭터를 SPH 물 입자와 같은 배열에 넣어 함께 굴림 → 물 만드는 법칙서 두 거동 창발: 부력=SPH 압력(0041) ∇P(아르키메데스·잠김 깊이∝밀도)·저항=SPH 점성(0046·물 속 운동 느려짐). 물=generic SPH(타입 0). 가벼운(초록)=뜸·무거운(적갈)=가라앉음.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [1, 40, 110, 320],                                 // 떨어짐 → 물에 닿음 → 갈라짐(뜸/가라앉음)
    captureOpts: { N, color: (v) => v >= 0.9 ? [70, 220, 90] : (v >= 0.7 ? [180, 60, 50] : [70, 130, 230]) },   // 초록=light·적갈=heavy·파랑=물
    toFrame(w) {
      const pts = [], VY = (z) => 22 - z;
      for (const p of w.__water) pts.push({ cx: p.cx + 2, cy: VY(p.cz), r: 0.7, v: 0.3 });
      pts.push({ cx: w.__light.cx + 2, cy: VY(w.__light.cz), r: 1.4, v: 1.0 });
      pts.push({ cx: w.__heavy.cx + 2, cy: VY(w.__heavy.cz), r: 1.4, v: 0.75 });
      return { pts };
    },

    note: '<b>물은 *건널 수 있는 물체*다 — 캐릭터를 SPH 물에 넣으면 부력(떠받침)과 저항(느려짐)이 *물 만드는 법칙에서* 창발한다.</b> PW-C(딛고 사는 환경)의 물. 새 물리 0 — 캐릭터를 SPH 물 입자들과 *같은 배열*에 넣어 함께 굴린다. 그러면 두 거동이 따라온다: ① <b>부력</b> = SPH 압력(0041)의 압력 기울기 ∇P 가 잠긴 물체를 위로 민다(아르키메데스 — 물 만드는 압력이 곧 부력) → 밀도가 물보다 작으면 *뜨고* 크면 *가라앉는다*(잠김 깊이 ∝ 밀도). ② <b>저항</b> = SPH 점성(0046)이 물 속 수평 운동을 *느리게* 한다(건너기 힘듦·휘젓는 저항). 물은 generic SPH(타입 0)이고 캐릭터는 그 압력장 속 한 *물체*일 뿐 — "물"·"부력" 타입 코드 없음(절대 원칙). <b>측정(verify)</b>: ① <b>부력</b> 가벼운 캐릭터는 수면 근처에 뜨고(바닥 안 닿음)·무거운 건 더 깊이 잠긴다(깊이 ∝ 밀도) ② <b>안 빠짐</b> 캐릭터가 바닥/벽을 통과 안 함(물+경계가 떠받침·담음) ③ <b>저항(drag)</b> 수평으로 민 캐릭터가 물 속에선 느려지고(점성) 진공에선 그대로(뉴턴1) ④ <b>물 보존</b> 캐릭터가 들어가도 물 입자 수·질량 보존 ⑤ 결정론. <b>흐름</b>(capture·측면도·파랑=물): 초록(가벼움)·적갈(무거움) 캐릭터가 못에 떨어져 — 초록은 수면에 *뜨고* 적갈은 *가라앉는다*. <b>큰 그림</b>: PW-C 의 첫 벽돌 — 환경의 물이 *상호작용하는 물체*(딛고·뜨고·건너는). 다음은 발밑 바이옴·DNA 형태 바위(0118). <b>원칙 준수</b>: 물=generic SPH 압력/점성(0041/0046·타입 0)·부력/저항=그 법칙서 창발·engine 변경 0. <b>정직한 한계</b>: 캐릭터를 SPH 입자로 근사(큰 물체 정밀 경계 아님)·작은 못·정지 물(흐르는 물 건너기는 후속)·아직 걷기와 결합 안 함(시연=물 상호작용만).'
  };
});
