// viewer/scenes/step_0088.js — (조립) 정상상태 별: 가열(점화)↔냉각(복사) 균형으로 *지속하며 빛나는* 별.
//   0087 은 유한 코어 비리얼 평형이나 *단열*(열 출입 없음)이었다. 진짜 별은 빛난다 — 내부에서 열을 만들고
//   (점화 0053 연료→열) 표면에서 잃는다(복사 0052 열→빛). 둘을 0087 코어에 얹으면 에너지 *정상상태*:
//   가열률≈냉각률 → 내부E plateau·광도 정상·연료 단조 소진(유한 수명). engine 변경 0(조립).
//   x-z 투영·밝기=열(internalE). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0088'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;

  const C = { u0: 7, NP: 120, R0: 5, G: 1, soft: 0.8, h: 2.2, gamma: 5 / 3, alpha: 1.0, beta: 2.0, dt: 0.002,
              fuel0: 20, ignRate: 3.5, uCrit: 3, coolRate: 0.5, floor: 1 };
  const CHUNK = 800, CAN = 48, SPAN = 16, SC = CAN / SPAN;

  function build(w) {
    let s = 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const P = []; for (let i = 0; i < C.NP; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
      P.push({ cx: x * C.R0, cy: y * C.R0, cz: z * C.R0, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: C.u0, KEcm: 0, energy: C.u0, radius: 1, fuel: C.fuel0, radiated: 0 }); }
    w.__P = P;
  }
  function sim(w, n) {
    for (let k = 0; k < n; k++) {
      En.applyEntityGravity(w.__P, C.dt, { G: C.G, soft: C.soft });
      Sph.sphThermalPressureForce(w.__P, C.dt, { gamma: C.gamma, h: C.h });
      Sph.sphViscosity(w.__P, C.dt, { alpha: C.alpha, beta: C.beta, gamma: C.gamma, h: C.h });
      Sph.sphIgnition(w.__P, C.dt, { rate: C.ignRate, uCrit: C.uCrit });
      Sph.sphRadiativeCooling(w.__P, C.dt, { coolRate: C.coolRate, floor: C.floor });
      En.stepEntities(w.__P, C.dt);
    }
  }

  return {
    label: 'step_0088 — (조립) 정상상태 별: 가열↔냉각 균형으로 지속하며 빛나는 별',
    title: 'HTJ — 정상상태 별: 점화(연료→열)↔복사(열→빛) 균형이 *지속하며 빛나는* 별을 빚는다',
    sub: '0087 유한 코어는 단열(열 출입 없음)이었다. 진짜 별은 빛난다 — 점화(0053 연료→열)로 데우고 복사(0052 열→빛)로 잃는다. 둘을 0087 코어에 얹으면 가열률≈냉각률 균형으로 내부E 가 plateau·광도 정상·연료 단조 소진(유한 수명). engine 변경 0. 밝기=열.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, CHUNK); },

    makeWorld() { return { N: CAN }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: CAN, color: (v) => [60 + v * 195, 70 + v * 150, 160 - v * 40] },
    toFrame(w) {
      const P = w.__P, pts = [];
      let hmax = 1e-9; for (const p of P) if ((p.internalE || 0) > hmax) hmax = p.internalE;
      for (const p of P) { const heat = (p.internalE || 0) / hmax;
        pts.push({ cx: (p.cx + SPAN / 2) * SC, cy: (SPAN / 2 - p.cz) * SC, r: 0.9, v: 0.2 + 0.8 * heat }); }
      return { pts, count: P.length };
    },

    note: '<b>정상상태 별 — 가열↔냉각 균형으로 *지속하며 빛나는* 별.</b> 새 법칙 0(engine 변경 0·조립). <b>0087 과의 차이</b>: 0087 의 코어는 비리얼 평형(압력이 붕괴 멈춤)이지만 *단열* — 열이 들어오거나 나가지 않았다. 진짜 별은 <b>빛난다</b>: 내부에서 핵융합으로 열을 만들고(<code>sphIgnition</code> 0053·연료 fuel→내부E·u≥uCrit 면 점화) 표면에서 빛으로 잃는다(<code>sphRadiativeCooling</code> 0052·내부E→radiated). 이 둘을 0087 코어(중력 0028+압력 0045+점성 0046)에 얹으면 <b>에너지 정상상태</b>가 창발한다: 가열률이 냉각률과 *균형*을 이뤄 — 너무 뜨거우면 복사가 가열을 앞질러 식고, 너무 식으면 점화가 다시 데운다 → 내부E 가 <b>plateau</b>(붕괴도 폭주도 아님). <b>측정(verify)</b>: ① <b>정상상태</b> — 큰 throughput(광도 L≈407/t 가 끊임없이 흐르는데도) 내부E ⟨U⟩≈937 이 거의 불변(spread 5.8%·plateau) ② <b>가열≈냉각</b> 연소 420/t ≈ 복사 407/t(불균형 3%·정상상태의 정의) ③ <b>빛나는 유한 수명</b> 광도 L>0 지속(별이 빛난다)+연료 단조 소진 2400→384(다 쓰면 꺼짐·유한 수명) ④ <b>전체 에너지 장부 닫힘</b> KE+내부E+중력PE+연료+복사빛 = const(rel 9e-3·연료 저장고와 떠난 빛까지 포함한 완전한 수지) ⑤ 운동량 보존(정지 시작·점화/냉각은 운동량 불변) ⑥ 결정론. <b>흐름</b>(capture 4 프레임): 비리얼 코어가 점화해 <span style="color:#fe8">환히 빛나고</span>(밝기=열) → 가열↔냉각 균형으로 *밝기를 유지*하며(정상상태) → 연료를 태우며 지속한다. <b>큰 그림</b>: 0087 "지속하는 개체"에 *에너지 throughput*(먹고 빛나고 늙는다)이 더해진 것 — 별의 일생(점화→정상연소→연료 고갈)이 author 없이 균형에서 나온다. <b>원칙 준수</b>: engine 은 "별" 타입을 모름 — 입자=한 원소, 연료/열/빛=일반량. 새 법칙 0. <b>정직한 한계</b>: ⓐ 점화율·냉각률은 노브(자기조절은 uCrit 게이트 한 방향뿐·u<uCrit 면 꺼짐) ⓑ softened 중력(0087 계승) ⓒ 총 장부 ~1% 수치 표류 ⓓ x-z 투영. <b>다음</b>: 발산(충격면) 축·연속 바다 3D·다축 바이옴.'
  };
});
