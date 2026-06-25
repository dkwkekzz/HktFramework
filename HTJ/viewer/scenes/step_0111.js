// viewer/scenes/step_0111.js — (조립·버그수정) 걷기: *무거운 자유 구체* 지면 위를 걷는다(편법 0·PW-A 핵심).
//   ⚠ 버그 수정(원칙 위반 제거): 옛 0111 은 평평한 *앵커 줄*을 매 틱 운동량 0 으로 *지워* 부동성을 위조하고
//   균일 중력 `-mg` 를 손으로 박았다 — "지면"이라는 *개념*을 만들고 물리가 아니라 고정 코드로 붙잡은 것(절대
//   원칙 위반). 바로잡음: 지면은 *개념이 아니라 아주 무거운 자유 구체*(M≫m)일 뿐. 캐릭터는 오직
//   **관성(0027)+중력(0028,쌍힘·"아래"는 행성 질량 쪽)+접촉=전자기 반발(0037)+마찰(0057/58)+제어(0109)** 로
//   서고·걷는다. 고정 코드 0·`-mg` 0·앵커 0. 안 움직임=행성의 무게(관성)·안 날아감=궤도속도(4.5)≫걷는속도(1).
//   시연: 행성 표면을 한쪽으로 걷다 → 멈춤 → 반대로(제어에 반응). engine 변경 0. 카메라=행성 중심. UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0111'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;

  const N = 48, DT = 0.05, R = 12, M = 8000, F = 8;
  const GOPT = { G: 0.03, soft: 1 }, COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

  function mk(m, x, y, r) { return { cx: x, cy: y, cz: 0, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: r }; }
  function build(w) {
    const planet = mk(M, 24, 24, R);                          // 지면 = 아주 무거운 자유 구체(개념 아님·고정 안 함)
    const ch = mk(1, 24, 24 + R + 1, 1);                       // 캐릭터(꼭대기)
    w.__planet = planet; w.__ch = ch; w.__es = [planet, ch]; w.__t = 0;
  }
  function tang(w) { const p = w.__planet, c = w.__ch; const dx = c.cx - p.cx, dy = c.cy - p.cy, d = Math.hypot(dx, dy); return [-dy / d, dx / d]; }
  // 방향키 스크립트(행위성=author): 한쪽 → 멈춤 → 반대쪽 → 멈춤.
  function cmd(t) { if (t < 60) return 0; if (t < 320) return F; if (t < 420) return 0; if (t < 680) return -F; return 0; }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch;
    En.applyEntityGravity(es, DT, GOPT);                      // 중력(쌍힘·방사)="아래"는 행성 쪽
    En.applyEntityContact(es, DT, COPT);                      // 접촉 반발(전자기)
    const f = cmd(t); if (f) { const [tx, ty] = tang(w); ch.px += f * tx * DT; ch.py += f * ty * DT; }  // 제어=접선(걷기)
    En.applyEntityFriction(es, DT, FOPT);                     // 마찰(접지 발판)
    En.applyEntityRollingResistance(es, DT, ROPT);            // 구름 저항(속도 유계)
    En.stepEntities(es, DT);                                  // 관성
  }

  return {
    label: 'step_0111 — (조립·버그수정) 걷기: 무거운 자유 구체 지면 위를 걷는다(편법 0)',
    title: 'HTJ — 걷기(버그수정): 지면=무거운 자유 구체·캐릭터가 관성+중력+접촉+마찰로만 표면을 걷는다(고정 코드 0·안 날아감)',
    sub: '⚠ 버그수정: 옛 0111 은 앵커를 매 틱 운동량 0 으로 지워 부동성 위조+균일 -mg(지면 개념·고정 코드=원칙 위반). 바로잡음: 지면=아주 무거운 자유 구체(M≫m)·캐릭터는 관성(0027)+중력(0028 쌍힘·"아래"=행성 쪽)+접촉(0037)+마찰(0057/58)+제어(0109)로만 서고 걷는다. 안 움직임=무게(관성)·안 날아감=궤도속도≫걷는속도. engine 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [60, 320, 420, 680],                              // 꼭대기 → 한쪽으로 걸음 → 멈춤 → 반대로
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [120, 95, 70] },   // 캐릭터=빨강·행성=흙빛
    toFrame(w) {
      const p = w.__planet, c = w.__ch, sh = p.cx - N / 2, sv = p.cy - N / 2;     // 카메라=행성 중심
      return { pts: [
        { cx: p.cx - sh, cy: N - (p.cy - sv), r: R, v: 0.3 },
        { cx: c.cx - sh, cy: N - (c.cy - sv), r: 1.2, v: 1.0 },
      ] };
    },

    note: '<b>걷기(버그수정) — 지면은 *개념이 아니라 아주 무거운 자유 구체*이고, 캐릭터는 관성·중력·접촉(전자기 반발)·마찰만으로 그 표면을 걷는다.</b> <b>⚠ 무엇이 틀렸었나</b>: 옛 0111(및 0112~0118)은 *평평한 앵커 줄*을 지면 삼고, 매 틱 <code>a.px=a.py=0</code> 로 그 운동량을 *지워* 부동성을 위조했으며, 중력도 법칙이 아니라 <code>-mg</code> 로 손수 박았다. 이는 (ㄱ) "지면"이라는 *타입 개념*을 만들고 (ㄴ) 물리가 아니라 *고정 코드*로 붙잡은 것 — "세계는 법칙뿐, 그 위에 물체가 있을 뿐"이라는 절대 원칙 위반이었다. <b>바로잡음</b>: 지면 = 아주 무거운 *자유* 구체(M=8000≫m=1) 하나. 캐릭터는 오직 — <b>관성</b>(<code>stepEntities</code>·0027)·<b>중력</b>(<code>applyEntityGravity</code>·0028 쌍힘 → "아래"는 행성 질량 쪽으로 *창발*)·<b>접촉=전자기 반발</b>(<code>applyEntityContact</code>·0037)·<b>마찰</b>(0057/58)·<b>제어</b>(0109·접선=걷기 의지) — 로 선다·걷는다. <b>고정 코드 0·</b><code>-mg</code><b> 0·앵커 0.</b> 행성이 안 움직이는 건 *고정*이 아니라 *무게(관성)* 때문이고(캐릭터가 밀어도 거의 안 밀림), 캐릭터가 안 날아가는 건 행성이 *충분히 무거워* 궤도속도(4.5)가 걷는 속도(≈1)보다 훨씬 커서다(지구에서 걷는다고 안 날아가듯). <b>측정(verify)</b>: ① <b>고정 없이 선다</b> 정착 속도→0·표면(d≈R+r)·행성 드리프트 ≪ 캐릭터 호(무게로 버팀) ② <b>걷기</b> 제어로 표면 따라 각도 휘어 돎(arc) ③ <b>안 날아감</b> 걷는 내내 d≈R+r 유지·속도 ≪ 궤도속도(원심 탈출 0) ④ <b>멈춤</b> 놓으면 마찰이 멈춤 ⑤ <b>편법 부재</b> 루프에 운동량 지우기·-mg·anchored 코드 0 ⑥ 결정론. <b>흐름</b>(capture·카메라=행성 중심): 빨간 캐릭터가 흙빛 행성 표면을 한쪽으로 걸어 돌다 멈추고, 반대로 걸어 돌아온다(표면에 붙어 휘어 감). <b>원칙 준수</b>: 지면=무거운 구체(타입 아님)·모든 거동이 generic 법칙·고정/박기 0·engine 변경 0. <b>정직한 한계</b>: 제어는 외력(행위성=author·운동량 주입은 0109 의 사양)이라 계 CoM 이 미세 표류(행성도 0.8 드리프트)·접촉 단일 점.'
  };
});
