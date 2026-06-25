// viewer/scenes/step_0118.js — (조립) 발밑 바이옴 + DNA 형태 바위: 환경이 *발밑에서* 행위성과 만난다(PW-C).
//   PW-C(딛고 사는 환경) 마무리 — 두 작은 조립을 한 무대에(조립 step 은 부품 여럿 묶기 허용·새 물리 0):
//   ① 발밑 바이옴 — biomeField(0090)를 캐릭터 발밑 x 에서 샘플 → 걸으면 *발밑 바이옴*(땅 색)이 경계서 바뀐다
//      (환경 장이 행위성과 만남·기후 띠를 가로지름). ② DNA 형태 바위 — 세계 형태 사전(shapeDict·0062)의 hash 로
//      reconstructShape(0063)가 *민둥 구가 아닌* 여러 구성원 구로 펼친 *비구형 바위*. 캐릭터가 그 *실제 형태
//      footprint* 에 막힌다(바운딩 구가 아니라 DNA 윤곽). 둘 다 generic(바이옴·형태 타입 코드 0). engine 변경 0.
//   수직=y(중력 −y)·측면도. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0118'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;
  const DNA = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  const N = 48, DT = 0.05, G = 4, FX = 8;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
  const biome = Stream.biomeField({ scale: 0.09, nTemp: 3, nHum: 3, tempSalt: 'BT', humSalt: 'BH' });
  const biomeAt = (x) => biome(x, 0).biome;

  function build(w) {
    const an = [];
    for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
    // DNA 형태 바위 — 세계 형태 사전에 등록(dedup)된 hash 로 비구형 footprint 펼침(0062/0063)
    const dict = {};
    const members = [{ cx: 0, cy: 0, cz: 0, radius: 1 }, { cx: 1.4, cy: 0, cz: 0, radius: 1 }, { cx: 0.7, cy: 1.3, cz: 0, radius: 1 }, { cx: -0.6, cy: 0.9, cz: 0, radius: 1 }];
    const hash = DNA.registerShape(dict, members, { quantum: 0.25 });
    const rock = { cx: 38, cy: -0.4, cz: 0, radius: 2.4, shapeHash: hash };
    const rockPts = DNA.reconstructShape(rock, dict, { quantum: 0.25, spread: 1.5, subScale: 1.5 });
    const rockAnchors = rockPts.map(p => ({ cx: p.cx, cy: p.cy, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: p.r }));
    const ch = { cx: 10, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__an = an; w.__rockAn = rockAnchors; w.__rockPts = rockPts; w.__ch = ch; w.__allAn = [...an, ...rockAnchors]; w.__t = 0;
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), ch = w.__ch, allAn = w.__allAn;
    ch.py -= ch.mass * G * DT;
    En.applyEntityContact([ch, ...allAn], DT, COPT);
    if (t >= 40) Ctl.applyControl([ch], DT, { commands: [{ i: 0, fx: FX }] });
    En.applyEntityFriction([ch, ...allAn], DT, FOPT);
    En.applyEntityRollingResistance([ch, ...allAn], DT, ROPT);
    for (const a of allAn) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
    En.stepEntity(ch, DT);
  }

  return {
    label: 'step_0118 — (조립) 발밑 바이옴 + DNA 형태 바위: 환경이 발밑에서 행위성과 만난다(PW-C)',
    title: 'HTJ — 발밑 바이옴(걸으면 땅 색이 기후 띠 따라 바뀜) + DNA 형태 바위(비구형 footprint 에 막힘)·둘 다 generic',
    sub: 'PW-C 마무리·두 작은 조립·새 물리 0. ① 발밑 바이옴=biomeField(0090)를 캐릭터 발밑서 샘플→걸으면 땅 색이 기후 경계서 바뀜. ② DNA 형태 바위=세계 형태 사전(0062) hash 로 reconstructShape(0063)가 비구형 구성원 구로 펼침→캐릭터가 실제 형태 footprint 에 막힘(바운딩 구 아님). 바이옴·형태 타입 코드 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [40, 300, 600, 1100],                              // 바이옴 띠를 가로지르며 걸어 DNA 바위에 막힘
    captureOpts: {
      N, color: (v) => {
        if (v >= 0.97) return [235, 70, 60];                    // 캐릭터=빨강
        if (v >= 0.85) return [150, 150, 160];                  // DNA 바위=회색
        const palette = [[70, 120, 60], [110, 150, 70], [150, 160, 90], [120, 140, 110], [90, 130, 120], [70, 110, 130], [140, 130, 90], [100, 120, 80], [130, 110, 70]];
        return palette[Math.round(v * 100) % 9];                // 바이옴(0..8)→색
      }
    },
    toFrame(w) {
      const pts = [], VY = (cy) => 22 - cy;
      for (const a of w.__an) if (a.cx >= 0 && a.cx <= N) pts.push({ cx: a.cx, cy: VY(a.cy), r: 3, v: biomeAt(a.cx) / 100 });   // 땅=발밑 바이옴 색
      for (const p of w.__rockPts) pts.push({ cx: p.cx, cy: VY(p.cy), r: p.r * 0.8, v: 0.9 });                                   // DNA 바위(회색·비구형)
      pts.push({ cx: w.__ch.cx, cy: VY(w.__ch.cy), r: 1.2, v: 1.0 });                                                            // 캐릭터
      return { pts };
    },

    note: '<b>환경이 *발밑에서* 행위성과 만난다 — 걸으면 발밑 바이옴(땅 색)이 기후 띠 따라 바뀌고, *DNA 형태* 바위는 그 실제 윤곽으로 캐릭터를 막는다.</b> PW-C(딛고 사는 환경) 마무리 — 두 작은 조립을 한 무대에(조립 step 은 부품 묶기 허용·engine 변경 0). <b>① 발밑 바이옴</b>: <code>biomeField</code>(0090·독립 온도·습도 → 9 칸 바이옴)를 *캐릭터 발밑 x* 에서 샘플 → 캐릭터가 걸으면 *발밑 바이옴*(땅 색)이 기후 경계에서 바뀐다(환경 장이 *행위성*과 만나는 첫 지점 — 어디 서 있나에 따라 발밑 환경이 다름). <b>② DNA 형태 바위</b>: 세계 *형태 사전*(shapeDict·0062·정규화 hash dedup)에 등록된 hash 로 <code>reconstructShape</code>(0063)가 *민둥 구가 아니라* 여러 구성원 구로 펼친 *비구형 바위*. 캐릭터는 그 *실제 형태 footprint*(왼쪽으로 튀어나온 구성원)에 막힌다 — 바운딩 구가 아니라 DNA 윤곽이 충돌 경계다. <b>둘 다 generic</b>: "초원"·"바위" 타입 코드 없음 — 바이옴=두 축의 양자화(타입 0)·형태=세계 사전의 hash(타입 0·절대 원칙). <b>측정(verify)</b>: ① <b>발밑 바이옴</b> 캐릭터가 걸으며 발밑 바이옴이 ≥3 종 바뀜·발밑 값이 biomeField 샘플과 일치(별도 author 아님) ② <b>바이옴 경계</b> 경로에 뚜렷한 바이옴 띠 경계 존재 ③ <b>DNA footprint</b> 바위가 여러 구성원 구(비구형)·캐릭터가 그 실제 구성원에 막힘(바운딩 구 반경 아님) ④ <b>형태=세계 DNA</b> 바위 형태가 등록 hash(사전 dedup)서 옴 ⑤ 결정론. <b>흐름</b>(capture·측면도): 빨간 캐릭터가 *색이 바뀌는*(바이옴 띠) 땅을 걸어 회색 *DNA 형태* 바위에 막혀 선다. <b>큰 그림</b>: PW-C — 발밑 바이옴·건널 수 있는 물(0117)·DNA 형태 바위가 *딛고 사는 환경*을 이룬다. 다음은 PW-D(살아 움직이는 것). <b>원칙 준수</b>: 바이옴=generic biomeField(타입 0)·바위 형태=세계 hash 사전(0062)·충돌=generic 접촉·engine 변경 0. <b>정직한 한계</b>: 1D 발밑 샘플(2D 바이옴 맵 보행은 후속)·바위는 앵커 구성원 근사(연속 메시 아님)·바이옴이 아직 보행 물리를 바꾸진 않음(색만·바이옴별 마찰 등은 후속).'
  };
});
