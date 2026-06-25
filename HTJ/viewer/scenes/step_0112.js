// viewer/scenes/step_0112.js — (조립·버그수정) 점프: *무거운 자유 구체* 표면서 방사 도약(편법 0·PW-A).
//   ⚠ 버그 수정(0111 과 같은 원칙 위반 제거): 옛 0112 는 평평한 앵커+운동량 지우기+`-mg` 위에서 점프했다.
//   바로잡음 — 지면=무거운 자유 구체. 점프 = 접지일 때만 *방사 바깥쪽*(중력 반대) 임펄스(0109): 솟구쳐 행성
//   중력에 끌려 *탄도*로 표면에 착지한다. 걷기(접선·접지일 때만)와 합쳐 표면을 따라 *깡총* 뛴다. 점프 세기는
//   *탈출속도(6.3)보다 작아*(2.5) 우주로 안 날아가고 돌아온다 — 안 날아감도 *물리*(중력)지 고정 코드 아님.
//   고정 0·-mg 0·앵커 0. engine 변경 0. 카메라=행성 중심. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0112'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;

  const N = 48, DT = 0.05, CX = 24, CY = 24, R = 12, M = 8000, JY = 2.5, FW = 6;
  const GOPT = { G: 0.03, soft: 1 }, COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
  const mk = (m, x, y, r) => ({ cx: x, cy: y, cz: 0, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: r });

  function build(w) { w.__planet = mk(M, CX, CY, R); w.__ch = mk(1, CX, CY + R + 1, 1); w.__es = [w.__planet, w.__ch]; w.__t = 0; w.__arc = []; }
  function radial(w) { const p = w.__planet, c = w.__ch; const dx = c.cx - p.cx, dy = c.cy - p.cy, d = Math.hypot(dx, dy); return [dx / d, dy / d, d]; }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch, p = w.__planet;
    En.applyEntityGravity(es, DT, GOPT); En.applyEntityContact(es, DT, COPT);
    const [nx, ny] = radial(w), grounded = Ctl.groundContact(ch, [p], 0.05) >= 0;
    if (t >= 50 && grounded) { ch.px += FW * (-ny) * DT; ch.py += FW * (nx) * DT; }   // 걷기=접지일 때만(접선)
    if ((t === 80 || t === 150 || t === 220) && grounded) { ch.px += JY * nx; ch.py += JY * ny; }  // 점프=방사 바깥(접지일 때만)
    En.applyEntityFriction(es, DT, FOPT); En.applyEntityRollingResistance(es, DT, ROPT);
    En.stepEntities(es, DT);
    if (t >= 70 && t % 3 === 0) w.__arc.push([ch.cx, ch.cy]);
  }

  return {
    label: 'step_0112 — (조립·버그수정) 점프: 무거운 자유 구체 표면서 방사 도약(편법 0)',
    title: 'HTJ — 점프(버그수정): 자유 구체 표면서 접지일 때만 방사 도약→중력에 끌려 탄도 착지·표면 따라 깡총·우주로 안 날아감(탈출속도 미만)',
    sub: '⚠ 버그수정: 옛 0112 는 평지+앵커 운동량 지우기+-mg 위 점프. 바로잡음: 지면=무거운 자유 구체·점프=접지일 때만 방사 바깥 임펄스(0109)→행성 중력에 끌려 탄도 착지. 걷기(접선)와 합쳐 표면 따라 깡총. 점프 세기<탈출속도(2.5<6.3)→우주로 안 날아감(=물리·고정 아님). 고정 0·-mg 0·앵커 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [50, 90, 110, 240],                                // 표면 → 도약(방사) → 정점 → 깡총 이어감
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : (v >= 0.5 ? [235, 150, 90] : [120, 95, 70]) },
    toFrame(w) {
      const p = w.__planet, c = w.__ch, sh = p.cx - N / 2, sv = p.cy - N / 2, MAP = (e) => ({ x: e.cx - sh, y: N - (e.cy - sv) });
      const pts = [{ cx: MAP(p).x, cy: MAP(p).y, r: R, v: 0.2 }];
      for (const a of w.__arc) { const m = MAP({ cx: a[0], cy: a[1] }); pts.push({ cx: m.x, cy: m.y, r: 0.5, v: 0.65 }); }   // 궤적 잔상
      const m = MAP(c); pts.push({ cx: m.x, cy: m.y, r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>점프(버그수정) — 무거운 자유 구체 표면에서 접지일 때만 *방사 바깥쪽*으로 솟구쳐, 행성 중력에 끌려 탄도로 착지한다.</b> <b>⚠ 무엇이 틀렸었나</b>: 옛 0112 는 0111 처럼 *평평한 앵커*를 매 틱 운동량 0 으로 지우고 `-mg` 를 박은 위에서 점프했다(지면 개념+고정 코드=원칙 위반). <b>바로잡음</b>: 지면=아주 무거운 *자유* 구체. 점프 = *접지일 때만*(<code>groundContact</code>) 내보내는 *방사 바깥쪽*(중력 반대 방향=위) 임펄스(0109)다 → 캐릭터가 솟구쳐 *행성 중력*(0028·0110/0111 의 그 중력)에 끌려 내려와 표면에 착지한다. 걷기(접선·접지일 때만)와 합치면 표면을 따라 *깡총깡총* 뛴다. <b>구체 특유의 올바름</b>: 점프 세기(임펄스 2.5)를 *탈출속도(6.3)보다 작게* 두면 캐릭터는 우주로 안 날아가고 돌아온다 — "안 날아감"마저 *고정 코드가 아니라 물리*(중력 vs 탈출속도)에서 나온다(세게 차면 정말 궤도로 떠난다). <b>고정 0·</b><code>-mg</code><b> 0·앵커 0.</b> <b>측정(verify)</b>: ① <b>도약</b> 접지 방사 점프 → 고도(d) 솟음 ② <b>탄도 복귀·안 탈출</b> 솟았다 중력에 끌려 표면으로 착지·다시 접지(peak 유계≪궤도이탈) ③ <b>접지 게이트</b> 공중 점프 무시(연타해도 착지 후에만 도약) ④ <b>탈출속도 미만</b> 임펄스<탈출속도라 돌아옴(세게 차면 떠남=물리) ⑤ <b>편법 부재</b> 제어 없이 계 운동량 보존(고정 없음의 증거) ⑥ 결정론. <b>흐름</b>(capture·카메라=행성 중심·주황=궤적): 빨간 캐릭터가 행성 표면을 걷다 방사로 솟아(주황 호) 정점을 찍고 탄도로 내려와 착지해 깡총 이어간다. <b>원칙 준수</b>: 지면=무거운 구체·점프=generic 방사 임펄스(0109)·복귀=중력·engine 변경 0·고정/박기 0. <b>정직한 한계</b>: 제어는 외력(행위성=author·0109 사양)·접촉 단일 점·점프 타이밍은 스크립트(인터랙티브 viewer 는 마일스톤 도달 시).'
  };
});
