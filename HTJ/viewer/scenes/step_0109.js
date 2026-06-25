// viewer/scenes/step_0109.js — (법칙) 제어 힘: 행위성이 *지정 개체*에 명령 힘을 주입한다(PW-A 첫 벽돌).
//   세계 물리는 창발이지만 *입력*은 author(CLAUDE.md §4). applyControl 이 그 유일한 통로 — 호출자가 명령한
//   개체에 generic 외력을 더한다(타입 모름). 세 개체로 명령의 종류를 보인다(탑다운 x-y):
//     · A(빨강·연속 +x 힘): 누르는 동안 가속 → 점점 빨라지며 오른쪽으로(뉴턴2).
//     · B(파랑·명령 없음): 그대로 멈춰 있음(early-return·회귀 0).
//     · C(노랑·1회 임펄스): t=1 에 한 번 차임 → 이후 등속 직진(뉴턴1·자유 드리프트).
//   engine 새 법칙 htj-control.js. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0109'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const N = 48, DT = 0.05, FX = 6;

  function mk(cx, cy) { return { cx, cy, cz: 0, mass: 1, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1.2 }; }
  function build(w) { w.__e = [mk(7, 30), mk(7, 22), mk(7, 14)]; w.__t = 0; }   // A,B,C
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1);
    const cmds = [{ i: 0, fx: FX, fy: 0, fz: 0 }];                  // A: 연속 힘
    if (t === 1) cmds.push({ i: 2, fx: 9, fy: 0, fz: 0, impulse: true });  // C: 1회 임펄스
    Ctl.applyControl(w.__e, DT, { commands: cmds });               // B(i=1): 명령 없음 → 불변
    En.stepEntities(w.__e, DT);
  }

  return {
    label: 'step_0109 — (법칙) 제어 힘: 행위성이 지정 개체에 명령 힘을 주입(PW-A 첫 벽돌)',
    title: 'HTJ — 제어 힘(applyControl): 외부 입력이 개체를 민다 — 연속 힘=가속·임펄스=등속 드리프트·명령 없음=정지',
    sub: '세계 물리는 창발이지만 *입력*은 최상층 author(CLAUDE.md §4). applyControl 이 유일한 통로 — generic 외력(타입 모름). A=연속 +x 힘(가속)·B=명령 없음(정지·회귀0)·C=1회 임펄스(등속 직진). 운동량 주입(외력·보존 안 됨이 핵심).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [0, 20, 40, 60],
    captureOpts: { N, color: (v) => v >= 0.66 ? [235, 70, 60] : (v >= 0.33 ? [235, 210, 60] : [70, 130, 235]) },
    toFrame(w) {
      const e = w.__e;
      return { pts: [
        { cx: e[0].cx, cy: N - e[0].cy, r: 1.2, v: 1.0 },          // A 빨강
        { cx: e[1].cx, cy: N - e[1].cy, r: 1.2, v: 0.0 },          // B 파랑
        { cx: e[2].cx, cy: N - e[2].cy, r: 1.2, v: 0.5 },          // C 노랑
      ] };
    },

    note: '<b>행위성이 세계에 들어오는 *유일한 통로* — applyControl 이 지정 개체에 명령 힘을 주입한다.</b> PW(플레이 가능 세계) 마일스톤 A "선 캐릭터를 방향키로 굴린다"의 첫 벽돌. CLAUDE.md §4·절대 원칙: 세계 물리는 *창발*(법칙만 author)이지만 **캐릭터의 의지=행위성은 최상층 author** — 입력은 세계가 스스로 만들지 않는다. <code>applyControl(entities, dt, {commands:[{i,fx,fy,fz,impulse?}]})</code> 이 그 통로: 호출자가 명령한 개체 운동량에 외력을 더한다. <b>generic — 타입 모름</b>: "캐릭터"·"플레이어" 타입을 아는 분기가 없다(절대 원칙). 누가·어느 방향인지는 *호출자=author* 의 몫이고 engine 은 벡터만 적용한다. <b>두 모드</b>: 연속 힘(Δp=F·dt·방향키 누름)·임펄스(Δp=F·점프/발구르기 1회). <b>운동량은 주입된다(보존 안 됨)</b> — 행위성이 세계에 운동량·일을 *넣는* 게 핵심(근육이 에너지 쓰듯). 그 일은 KE 로(KEcm·energy 재계산). <b>측정(verify)</b>: ① 연속 힘 → Δp=F·dt 정확·등가속(뉴턴2) ② 명령 없는 개체 불변(early-return·회귀 0) ③ 임펄스 1회 → 이후 등속 직진(뉴턴1) ④ 결정론. <b>흐름</b>(capture·탑다운): A(빨강·연속 힘)는 점점 빨라지며 오른쪽으로, B(파랑·명령 없음)는 그 자리, C(노랑·1회 임펄스)는 한 번 차이고 등속으로 흐른다. <b>큰 그림</b>: 이 외력 한 통로 위에 다음 step 들이 "선 캐릭터(중력↓+접촉↑)" + "걷기(제어+마찰)" + "점프(접지 임펄스)"를 얹어 PW-A(걸을 수 있는 한 조각 땅)에 닿는다. <b>정직한 한계</b>: 아직 지면·중력 없는 빈 공간 데모(다음 step 이 지면 위에 세운다)·입력은 스크립트(인터랙티브 viewer 는 마일스톤 도달 시 큐레이트).'
  };
});
