// viewer/scenes/step_0114.js — (조립) 경사 한계: 완경사는 오르고 급경사(절벽)는 막힌다(창발 walkability).
//   0113(절차 지형 보행)에서 *어디까지 오를 수 있나*가 창발한다 — 새 물리 0·author 한 "벽" 0. 같은 제어
//   힘으로 캐릭터는 완만한 비탈은 오르지만, 가파른 절벽 앞에선 *선다*(못 오름): 경사 따라 내려가는 중력
//   성분이 제어 힘+마찰을 이기면 멈춘다. 임계는 *힘 균형*에서 창발(제어 힘 키우면 더 가파른 것도 오름) —
//   지형에 "못 가는 곳" 태그를 박지 않는다(절대 원칙). 시연: 비탈을 올라 절벽 밑에 막혀 선다. engine 변경 0.
//   수직=y(중력 −y)·탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0114'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;

  const N = 48, DT = 0.05, G = 4, FX = 8;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
  // 평지 → 완경사(0.45·24°) → 절벽(3.0·72°). author 한 "벽"이 아니라 그냥 더 가파른 지형.
  function elev(x) { let e = 4; if (x > 20) e += 0.45 * Math.min(x - 20, 16); if (x > 40) e += 3.0 * (x - 40); return e; }

  function build(w) {
    const an = [];
    for (let x = -6; x <= 90; x += 0.5) an.push({ cx: x, cy: elev(x) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
    const ch = { cx: 8, cy: elev(8) + 1.0, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__an = an; w.__ch = ch; w.__es = [ch, ...an]; w.__t = 0;
  }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch, an = w.__an;
    ch.py -= ch.mass * G * DT;
    En.applyEntityContact(es, DT, COPT);
    if (t >= 40) Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: FX }] });
    En.applyEntityFriction(es, DT, FOPT);
    En.applyEntityRollingResistance(es, DT, ROPT);
    for (const a of an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
    En.stepEntity(ch, DT);
  }

  return {
    label: 'step_0114 — (조립) 경사 한계: 완경사는 오르고 급경사(절벽)는 막힌다(창발 walkability)',
    title: 'HTJ — 경사 한계: 같은 제어 힘으로 완경사는 오르고 가파른 절벽 앞엔 막혀 선다(임계=힘 균형서 창발·author 벽 아님)',
    sub: '0113 보행에서 *어디까지 오를 수 있나*가 창발·새 물리 0·author 벽 0. 같은 제어 힘으로 완만한 비탈은 오르지만 가파른 절벽 앞엔 선다(경사 따라 내려가는 중력 성분이 제어+마찰 이김). 임계는 힘 균형서 창발(제어 힘 키우면 더 가파른 것도 오름). 지형에 "못 가는 곳" 태그 안 박음.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [1, 350, 650, 1400],                               // 평지 → 비탈 오름 → 절벽 접근 → 절벽 밑 막힘
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [110, 90, 65] },
    toFrame(w) {
      const pts = [], VY = (cy) => 26 - cy;
      for (const a of w.__an) if (a.cx >= 0 && a.cx <= N) pts.push({ cx: a.cx, cy: VY(a.cy), r: 3, v: 0.3 });
      pts.push({ cx: w.__ch.cx, cy: VY(w.__ch.cy), r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>어디까지 오를 수 있나가 *창발*한다 — 완만한 비탈은 오르고, 가파른 절벽 앞에선 같은 힘으로도 막혀 선다.</b> 0113(절차 지형 보행)에 *경사 한계*가 따라온다 — engine 변경 0·author 한 "벽"이나 "못 가는 곳" 태그 0(절대 원칙). 같은 제어 힘(0109)으로 캐릭터는 완만한 비탈(24°)은 꾸준히 오르지만, 가파른 절벽(72°) 앞에선 *선다*: 경사를 따라 내려가는 중력 성분(mg·sinθ)이 커져 제어 힘+마찰을 이기면 더 못 오른다. <b>임계는 힘 균형에서 창발</b> — 지형이 "절벽"이라고 선언해서가 아니라(타입 0), 그냥 *더 가파른* 높이장일 뿐이고, 제어 힘을 키우면 같은 절벽도 오른다(임계가 F 따라 움직임). <b>측정(verify)</b>: ① <b>완경사 오름</b> 완만한 비탈(24°)서 유의미하게 climb(고도 ↑) ② <b>급경사 막힘</b> 가파른 절벽(72°)서 같은 힘으로 거의 못 오름(climb≈0·절벽 밑서 정지) ③ <b>창발 임계(힘 균형)</b> 같은 절벽도 제어 힘 키우면(F 8→30) 오른다 — 한계가 author 아닌 힘 균형서 창발 ④ 결정론. <b>흐름</b>(capture·탑다운): 빨간 캐릭터가 흙빛 비탈을 올라 능선을 지나 *절벽 밑에서 막혀 선다*(더 못 감). <b>큰 그림</b>: 걸을 수 있는 땅의 *지형*이 행위성을 빚는다(완경사=길·절벽=장벽) — author 없이 walkability 창발. 다음은 끝없이 펼쳐지는 지형(0115 streamChunks·PW-B). <b>원칙 준수</b>: 절벽=더 가파른 높이장(타입 0)·한계=generic 힘 균형·engine 변경 0. <b>정직한 한계</b>: 1D 단면·단일 접촉점(실제 등반/걸림은 더 복잡)·임계 각은 노브(F·μ·g)에 의존.'
  };
});
