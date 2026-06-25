// viewer/scenes/step_0115.js — (조립) 끝없이 걷는 땅: 지형이 *관찰자(캐릭터)* 둘레로 스트리밍된다(PW-B).
//   0113(절차 지형 보행)을 *무한 세계*로 — 새 물리 0. streamChunks(0073)로 지면을 *캐릭터 둘레 창*에서만
//   materialize 한다(관찰자=플레이어). 캐릭터가 걸어도 *활성 앵커 수는 유계*(∝ 창)·세계는 무한(elev(x) 모든
//   x 에 정의). 비용 ∝ 관찰 영역(세계 크기 무관)·PW 불변식. 카메라가 캐릭터를 따라가 지형이 *흘러간다*.
//   engine 변경 0(조립·0073 streamChunks + 0113 보행). 수직=y(중력 −y)·탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0115'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const N = 48, DT = 0.05, G = 4, FX = 8, W = 22, SP = 2;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
  const elev = (x) => 9 + 5 * Stream.fbm(x * 0.03, 0.5, { salt: 'LAND', octaves: 3, gain: 0.5 });  // 무한 절차 지형

  function build(w) {
    w.__ch = { cx: 8, cy: elev(8) + 1.0, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__t = 0; w.__an = []; w.__count = 0;
  }
  // 지면을 캐릭터(관찰자) 둘레 창에서만 펼친다 — streamChunks(0073)·band j=0·무한 grid 중 반경 안만.
  function streamGround(ch) {
    const { chunks } = Stream.streamChunks({ cx: ch.cx, cy: 0 }, { spacing: SP, radius: W, shapeAt: (i, j) => j === 0 ? 1 : null });
    return chunks.map(c => ({ cx: c.gx * SP, cy: elev(c.gx * SP) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 }));
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), ch = w.__ch;
    const an = streamGround(ch); w.__an = an; w.__count = an.length;   // 매 step 캐릭터 둘레만 펼침(유계)
    const es = [ch, ...an];
    ch.py -= ch.mass * G * DT;
    En.applyEntityContact(es, DT, COPT);
    if (t >= 30) Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: FX }] });
    En.applyEntityFriction(es, DT, FOPT);
    En.applyEntityRollingResistance(es, DT, ROPT);
    En.stepEntity(ch, DT);                                            // 앵커는 안 step(부동) — 매 step 새로 펼치므로 zero 불요
  }

  return {
    label: 'step_0115 — (조립) 끝없이 걷는 땅: 지형이 관찰자(캐릭터) 둘레로 스트리밍(PW-B)',
    title: 'HTJ — 끝없이 걷는 땅: streamChunks 가 지면을 캐릭터 둘레 창에서만 펼침·걸어도 활성 앵커 유계·세계는 무한(비용∝관찰)',
    sub: '0113 보행을 무한 세계로·새 물리 0. streamChunks(0073)로 지면을 캐릭터 둘레 창에서만 materialize(관찰자=플레이어). 걸어도 활성 앵커 수 유계(∝창)·세계 무한(elev 모든 x 정의)·비용∝관찰 영역(세계 크기 무관·PW 불변식). 카메라가 캐릭터 따라가 지형이 흘러간다.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); sim(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [40, 700, 1400, 2100],                             // 걸을수록 지형이 흘러간다(같은 활성 수)
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [105, 95, 70] },
    toFrame(w) {
      const pts = [], VY = (cy) => 24 - cy, ch = w.__ch, shift = ch.cx - N / 2;   // 카메라=캐릭터 중심
      for (const a of w.__an) { const rx = a.cx - shift; if (rx >= 0 && rx <= N) pts.push({ cx: rx, cy: VY(a.cy), r: 3, v: 0.3 }); }
      pts.push({ cx: N / 2, cy: VY(ch.cy), r: 1.2, v: 1.0 });   // 캐릭터는 항상 화면 중앙
      return { pts, count: w.__count };
    },

    note: '<b>끝없이 걷는 땅 — 지형이 *관찰자(캐릭터)* 둘레로 스트리밍되어, 걸어도 비용은 *관찰 영역*에만 묶인다(세계 크기 무관).</b> PW-B(끝없이 걷는 땅)·PW 불변식 "비용 ∝ 관찰 영역". 0113(절차 지형 보행)을 *무한 세계*로 올린다 — engine 변경 0(조립). 핵심: 지면을 *통째로* 만들지 않고 <code>streamChunks</code>(0073·무한 grid 중 관찰자 반경 안 청크만 materialize)로 *캐릭터 둘레 창*에서만 펼친다(관찰자=플레이어·band j=0). 세계는 무한이다 — <code>elev(x)</code> 가 *모든* x 에 정의된 절차 장이라, 캐릭터가 아무리 멀리 가도 그 자리 지형은 정의돼 있다. 하지만 *활성 앵커 수*는 창 크기에 묶여 일정하다(∝ 2W). <b>측정(verify)</b>: ① <b>무한 보행</b> 캐릭터가 어떤 고정 창보다 훨씬 멀리 걷는다(span≫창) ② <b>작업집합 유계</b> 활성 앵커 수가 거리와 무관하게 일정(시작≈한참 뒤)·총 횡단 컬럼 수 ≫ 활성 앵커 수(비용≠세계 크기) ③ <b>연속 지형</b> 스트리밍 중 틈 없이 늘 접지(안 빠짐) ④ 결정론. <b>흐름</b>(capture·탑다운·카메라=캐릭터 중심): 빨간 캐릭터는 화면 중앙에 있고 흙빛 지형이 *발밑으로 흘러간다* — 매 프레임 다른 지형인데 활성 앵커 수는 그대로. <b>큰 그림</b>: PW-B 의 핵심 — 끝없이 펼쳐지는 절차 세계를 *유계 비용*으로 걷는다. 다음은 근거리 진짜 물리/원거리 필드 LOD(0116·adaptLOD 관찰자=캐릭터). <b>원칙 준수</b>: 지형=무한 절차 장(타입 0)·스트리밍=generic streamChunks(0073)·관찰자=캐릭터·engine 변경 0. <b>정직한 한계</b>: 1D 단면 띠(2D 청크 지형은 후속)·매 step 재materialize(증분 캐싱은 후속)·앵커 그리드 해상도.'
  };
});
