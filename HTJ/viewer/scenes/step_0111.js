// viewer/scenes/step_0111.js — (조립) 걷기: 제어 힘 + 마찰 → 캐릭터가 지면 위를 *걷는다*(PW-A 핵심).
//   0110(선 캐릭터)에 행위성(0109 applyControl)을 얹는다 — 새 물리 0. 평평한 한 조각 땅(앵커 구체 줄·0056/0108
//   식) 위에 선 캐릭터에 *수평 제어 힘*을 주면, 접촉 마찰(0057)+구름 저항(0058)이 *접지를 잡아* 발판 삼아
//   걷는다: 누르는 동안 *종단속도*(마찰 점성 cTan·v = 제어력)로 나아가고, 놓으면 마찰이 *멈춘다*(얼음 아님).
//   걷기 = 행위성(외력) ↔ 접지 마찰의 균형. 시연: 오른쪽으로 걷다 → 멈춤 → 왼쪽으로 → 멈춤(제어에 반응).
//   engine 변경 0(조립·0109+0037+0057+0058). 수직=y(중력 −y)·탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0111'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Ctl = require ? require('../../engine/htj-control.js') : self.HTJControl;

  const N = 40, DT = 0.05, G = 4, F = 8;
  const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

  function build(w) {
    const an = [];
    for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
    const ch = { cx: 10, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
    w.__an = an; w.__ch = ch; w.__es = [ch, ...an]; w.__t = 0;
  }
  // 방향키 스크립트(행위성=author): 서다 → 오른쪽 → 멈춤 → 왼쪽 → 멈춤.
  function cmd(t) { if (t < 70) return 0; if (t < 210) return F; if (t < 300) return 0; if (t < 440) return -F; return 0; }
  function sim(w) {
    const t = (w.__t = (w.__t || 0) + 1), es = w.__es, ch = w.__ch, an = w.__an;
    ch.py -= ch.mass * G * DT;                                  // 균일 중력(아래=−y)
    En.applyEntityContact(es, DT, COPT);                        // 떠받침(0037)
    const f = cmd(t); if (f) Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: f }] });  // 제어 힘(0109)
    En.applyEntityFriction(es, DT, FOPT);                       // 접지 마찰(0057)=발판
    En.applyEntityRollingResistance(es, DT, ROPT);             // 구름 저항(0058)=자유 굴림 방지
    for (const a of an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }  // 지면=부동(앵커)
    En.stepEntity(ch, DT);
  }

  return {
    label: 'step_0111 — (조립) 걷기: 제어 힘 + 마찰로 캐릭터가 지면을 걷는다(PW-A 핵심)',
    title: 'HTJ — 걷기: 선 캐릭터에 수평 제어 힘 → 접지 마찰을 발판 삼아 종단속도로 걷고, 놓으면 멈춘다(오른쪽→멈춤→왼쪽)',
    sub: '0110(선 캐릭터)에 행위성(0109)을 얹음·새 물리 0. 평평한 한 조각 땅 위 선 캐릭터에 수평 제어 힘→접촉 마찰(0057)+구름 저항(0058)이 접지를 잡아 걷는다: 누르는 동안 종단속도(cTan·v=제어력), 놓으면 마찰이 멈춤(얼음 아님). 걷기=외력↔접지 마찰 균형. 오른쪽→멈춤→왼쪽→멈춤.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [70, 210, 300, 440],                               // 서다 → 오른쪽 걸음 → 멈춤 → 왼쪽 걸음
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [120, 95, 70] },   // 캐릭터=빨강·지면=흙빛
    toFrame(w) {
      const pts = [], VY = (cy) => 24 - cy;                    // 수직 매핑(지면·캐릭터를 패널 중앙으로)
      for (const a of w.__an) if (a.cx >= 0 && a.cx <= N) pts.push({ cx: a.cx, cy: VY(a.cy), r: 3, v: 0.3 });
      pts.push({ cx: w.__ch.cx, cy: VY(w.__ch.cy), r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>선 캐릭터가 *걷는다* — 수평 제어 힘을 접지 마찰로 발판 삼아 나아가고, 놓으면 멈춘다.</b> PW-A 핵심: 0110(선 캐릭터=중력↓+접촉↑ 균형)에 0109(행위성 제어 힘)를 얹어 *걸을 수 있는 한 조각 땅*을 만든다 — engine 변경 0(조립). 평평한 땅(앵커 구체 줄·0056/0108 식·무게가 곧 부동) 위 선 캐릭터에 <code>applyControl</code> 로 수평 힘을 주면: 접촉 마찰(0057·접선 저항)+구름 저항(0058·자유 굴림 방지)이 *접지를 잡아* — 미끄러지는 얼음이 아니라 *발판*이 된다. <b>걷기 = 외력(행위성) ↔ 접지 마찰의 균형</b>: 누르는 동안엔 마찰 점성 cTan·v 가 제어력과 맞먹는 *종단속도*로 나아가고(무한 가속 아님), 놓으면 마찰이 운동E 를 열로 빼 *멈춘다*. <b>측정(verify)</b>: ① <b>걷기</b> +x 제어 → cx 유의미 증가·접지 유지 ② <b>종단속도</b> 속도 유계(자유 가속 F·t/m 의 수십분의 1·후반 거의 일정) ③ <b>멈춤</b> 제어 놓으면 |v|→0(얼음 아님) ④ <b>접지 유지</b> cy 가 표면 근처 유계(안 날아가고 안 가라앉음) ⑤ 결정론. <b>흐름</b>(capture·탑다운): 빨간 캐릭터가 흙빛 땅 위를 오른쪽으로 걸어가 멈추고, 다시 왼쪽으로 걸어와 멈춘다(제어에 반응). <b>큰 그림</b>: PW-A "걸을 수 있는 한 조각 땅" 달성 직전 — 다음은 점프(0112)·절차 지형 위 걷기(0113). <b>원칙 준수</b>: 제어=generic 외력(0109)·마찰=generic 접촉 법칙(0057/0058)·지면=무거운 구체·engine 변경 0. <b>정직한 한계</b>: 평평한 패치(곡면 행성 걷기는 종단속도≪궤도속도 필요·후속)·접촉 단일 점·입력은 스크립트(인터랙티브 viewer 는 마일스톤 도달 시 큐레이트).'
  };
});
