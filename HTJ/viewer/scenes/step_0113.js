// viewer/scenes/step_0113.js — (조립) 절차 지형 위를 걷기: 캐릭터가 *절차적 높이장*을 오르내린다(PW-A→B).
//   0111(평지 걷기)을 *절차 지형*(fBm 높이장·0059/0074)으로 옮긴다 — 새 물리 0. 두 트랙을 잇는다:
//   창발(걷기 행위성·0111) ↔ 절차(무한 지형 장·0074). 지면 앵커를 elev(x)=fBm 높이로 깔면, 같은 걷기
//   법칙이 캐릭터를 *언덕을 따라* 오르내리게 한다 — 발이 표면을 따라가고(cy≈elev(cx)+r) 안 가라앉는다.
//   지형은 author 안 한다(fBm 장에서 발현·타입 0). engine 변경 0. 수직=y(중력 −y)·탑다운. UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0113'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const N = 48, DT = 0.05, G = 4, FX = 8;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
  const elev = (x) => 9 + 6 * Stream.fbm(x * 0.03, 0.5, { salt: 'RIDGE', octaves: 3, gain: 0.5 });  // 절차 높이장(author 아님)

  function build(w) {
    const an = [];
    for (let x = -6; x <= 90; x += 0.5) an.push({ cx: x, cy: elev(x) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
    const ch = { cx: 8, cy: elev(8) + 1.5, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__an = an; w.__ch = ch; w.__es = [ch, ...an]; w.__t = 0;
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch, an = w.__an;
    ch.py -= ch.mass * G * DT;
    En.applyEntityContact(es, DT, COPT);
    if (t >= 60) Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: FX }] });   // 오른쪽으로 걷기
    En.applyEntityFriction(es, DT, FOPT);
    En.applyEntityRollingResistance(es, DT, ROPT);
    for (const a of an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
    En.stepEntity(ch, DT);
  }

  return {
    label: 'step_0113 — (조립) 절차 지형 위를 걷기: 캐릭터가 fBm 높이장을 오르내린다(PW-A→B)',
    title: 'HTJ — 절차 지형 보행: 같은 걷기 법칙이 캐릭터를 fBm 언덕 따라 오르내리게(발이 표면 추종·안 가라앉음·지형은 author 아님)',
    sub: '0111(평지 걷기)을 절차 지형(fBm 높이장·0059/0074)으로 옮김·새 물리 0. 창발(걷기·0111)↔절차(무한 지형·0074) 잇기. 지면 앵커를 elev(x)=fBm 높이로 깔면 같은 걷기 법칙이 캐릭터를 언덕 따라 오르내리게 한다(cy≈elev(cx)+r 추종). 지형은 author 안 함(fBm 발현·타입 0).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [60, 280, 480, 680],                               // 출발 → 언덕 오름 → 정상 → 내림
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [110, 90, 65] },
    toFrame(w) {
      const pts = [], VY = (cy) => 24 - cy;
      for (const a of w.__an) if (a.cx >= 0 && a.cx <= N) pts.push({ cx: a.cx, cy: VY(a.cy), r: 3, v: 0.3 });
      pts.push({ cx: w.__ch.cx, cy: VY(w.__ch.cy), r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>캐릭터가 *절차 지형*을 걷는다 — 같은 걷기 법칙이 fBm 언덕을 따라 오르내리게 한다.</b> PW-A 를 평지에서 *절차 지형*으로 옮겨(0111→여기) 두 트랙을 잇는다: **창발**(걷기 행위성·0111) ↔ **절차**(무한 지형 장·0074·streamChunks 의 장). engine 변경 0(조립). 지면 앵커를 <code>elev(x)=fBm 높이장</code>(0074 의 그 절차 잡음·octaves 3)으로 깔면 — *새 걷기 법칙 없이* 0111 의 제어+마찰+중력 그대로가 캐릭터를 *언덕을 따라* 오르내리게 한다: 발이 표면을 따라가(cy≈elev(cx)+r) 안 가라앉고, 오르막을 오르고 내리막을 내려간다. <b>지형은 author 안 한다</b> — fBm 장에서 발현하고(특정 "언덕" 타입 코드 0), 보행 물리는 그 장의 높이만 읽는다(generic·절대 원칙). <b>측정(verify)</b>: ① <b>지형 추종</b> corr(캐릭터 cy, elev(cx)) ≈1·offset(cy−elev) 좁은 띠(표면 위를 탐) ② <b>오르내림</b> 캐릭터 고도가 지형 따라 유의미하게 변함(평지 아님·climb>1.5) ③ <b>접지 유지</b> cy 가 표면 근처 유계(안 가라앉고 안 날아감) ④ <b>traversal</b> 언덕에 안 갇히고 한참 전진(절차 지형 횡단) ⑤ 결정론. <b>흐름</b>(capture·탑다운): 빨간 캐릭터가 흙빛 fBm 언덕을 따라 오르막을 오르고 능선을 넘는다(고도 변화·표면 추종). <b>큰 그림</b>: PW-A→B 다리 — 보행이 *절차 세계*와 만났다. 다음은 경사 한계(0114·못 오르는 절벽)·끝없이 펼쳐지는 지형(0115 streamChunks). <b>원칙 준수</b>: 지형=fBm 발현(타입 0)·보행=generic 접촉/마찰·engine 변경 0. <b>정직한 한계</b>: 1D 단면 높이장(2D 지형은 후속)·앵커 그리드 해상도·유한 패치(무한 스트리밍은 0115).'
  };
});
