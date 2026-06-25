// viewer/scenes/step_0112.js — (조립) 점프: 접지 게이트 + 상향 임펄스 → 캐릭터가 *뛴다*(PW-A).
//   0111(걷기)에 *점프*를 더한다 — 새 물리 0. 점프 = 접지일 때만 내보내는 상향 임펄스(0109 impulse)다:
//   Ctl.groundContact 로 *발이 땅에 닿았는지* 보고(generic·"겹친 앵커 있나"), 닿았을 때만 위로 임펄스를
//   준다. 그러면 캐릭터가 솟구쳐(상승) 중력에 끌려 *탄도 궤적*으로 내려와 착지한다. 공중에서 점프 다시
//   눌러도 무시(접지 게이트). 걷기(수평 힘)와 합쳐 *달리며 도약*하는 포물선 hop. engine 변경 0.
//   수직=y(중력 −y)·탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0112'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;

  const N = 40, DT = 0.05, G = 4, JY = 7, FX = 3;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

  function build(w) {
    const an = [];
    for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
    const ch = { cx: 6, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__an = an; w.__ch = ch; w.__es = [ch, ...an]; w.__t = 0; w.__arc = [];
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch, an = w.__an;
    ch.py -= ch.mass * G * DT;
    En.applyEntityContact(es, DT, COPT);
    const cmds = [];
    if (t >= 70) cmds.push({ i: 0, fx: FX });                  // 달리기(수평 제어)
    const grounded = Ctl.groundContact(ch, an, 0.05) >= 0;     // 발이 땅에 닿았나(generic 접지)
    if ((t === 80 || t === 160) && grounded) cmds.push({ i: 0, fy: JY, impulse: true });  // 접지일 때만 도약
    if (cmds.length) Ctl.applyControl(es, DT, { commands: cmds });
    En.applyEntityFriction(es, DT, FOPT);
    En.applyEntityRollingResistance(es, DT, ROPT);
    for (const a of an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
    En.stepEntity(ch, DT);
    if (t >= 78 && t <= 175 && t % 3 === 0) w.__arc.push([ch.cx, ch.cy]);   // 궤적 잔상
  }

  return {
    label: 'step_0112 — (조립) 점프: 접지 게이트 + 상향 임펄스로 캐릭터가 뛴다(PW-A)',
    title: 'HTJ — 점프: 접지일 때만 상향 임펄스 → 솟구쳐 탄도 궤적으로 착지·달리며 도약(포물선 hop)·공중 점프는 무시',
    sub: '0111(걷기)에 점프 추가·새 물리 0. 점프=접지일 때만 내보내는 상향 임펄스(0109): groundContact 가 발이 땅에 닿았는지 보고(generic), 닿았을 때만 위로 임펄스→솟구쳐 중력에 끌려 탄도로 착지. 공중에서 다시 눌러도 무시(접지 게이트). 걷기+점프=달리며 도약하는 포물선 hop.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [78, 95, 112, 175],                                // 접지 → 상승 → 정점 → 착지 후 달림
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : (v >= 0.5 ? [235, 150, 90] : [120, 95, 70]) },
    toFrame(w) {
      const pts = [], VY = (cy) => 24 - cy;
      for (const a of w.__an) if (a.cx >= 0 && a.cx <= N) pts.push({ cx: a.cx, cy: VY(a.cy), r: 3, v: 0.2 });
      for (const a of w.__arc) pts.push({ cx: a[0], cy: VY(a[1]), r: 0.5, v: 0.65 });   // 궤적 잔상(주황)
      pts.push({ cx: w.__ch.cx, cy: VY(w.__ch.cy), r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>캐릭터가 *뛴다* — 발이 땅에 닿았을 때만 위로 솟구쳐(점프), 중력에 끌려 탄도 궤적으로 착지한다.</b> PW-A 마무리: 0111(걷기)에 점프를 더한다 — engine 변경 0(조립). 점프 = *접지일 때만* 내보내는 상향 임펄스다(0109 <code>applyControl impulse</code>). <code>groundContact</code>(generic — "겹친 앵커가 있나"만 봄·특정 지면 타입 모름)로 발이 땅에 닿았는지 확인하고, 닿았을 때만 위로 임펄스를 준다 → 캐릭터가 솟구쳐 상승하고 중력(0110 의 그 중력)이 끌어내려 *포물선*으로 착지한다. <b>접지 게이트</b>가 핵심: 공중에서 점프를 다시 눌러도 무시된다(발이 안 닿았으니 — 무한 비행 방지). 걷기(수평 힘)와 합치면 *달리며 도약하는* hop 이 된다. <b>측정(verify)</b>: ① <b>도약</b> 접지 점프 → 정점이 선 높이보다 훌쩍(peak−stand>4) ② <b>탄도 복귀</b> 솟았다 중력에 끌려 *제자리 근처로 착지*하고 다시 접지 ③ <b>접지 게이트</b> 공중에서 점프 연타해도 무시(단발 점프와 *같은 정점*)·정점에서 groundContact=−1·설 때 ≥0 ④ <b>재무장</b> 착지해 다시 접지하면 또 점프 가능 ⑤ 결정론. <b>흐름</b>(capture·탑다운·주황=궤적 잔상): 빨간 캐릭터가 달리다 땅을 차고 솟아(상승) 정점을 찍고 포물선으로 내려와 착지해 계속 달린다. <b>큰 그림</b>: PW-A "걸을 수 있는 한 조각 땅"의 행위성(서다·걷다·뛰다) 완성 — 다음은 *절차 지형* 위를 걷기(0113)로 PW-B(끝없이 걷는 땅)에 다가간다. <b>원칙 준수</b>: 점프 결정(언제·접지 확인)은 호출자=author·임펄스/접지 판정은 generic(0109)·engine 변경 0. <b>정직한 한계</b>: 평평한 패치·접촉 단일 점·점프 타이밍은 스크립트(인터랙티브 viewer 는 마일스톤 도달 시 큐레이트).'
  };
});
