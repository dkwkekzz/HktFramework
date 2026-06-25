// viewer/scenes/step_0087.js — (조립) 비리얼 평형 별 코어: 압력이 중력 붕괴를 *유한 코어*에서 멈춘다.
//   0085 는 자기중력 붕괴를 입자만으로 보였지만 *점으로* 무너졌다(RMS 3.03→0.12·압력 없음). 이 무대는 그 위에
//   되먹임 압력(0045 sphThermalPressureForce)+점성 감쇠(0046)를 얹어 — 붕괴가 가스를 데우고 데운 가스의 압력이
//   *떠받쳐* 유한 반경에서 멈춘다. 비리얼 근처(U0≈½|W0|)에서 시작 → 점성이 잔여 운동을 깎아 **비리얼 평형**(2(K+U)+W≈0).
//   중력=쌍힘(0028)·PE=같은 법칙(0028 pairPotentialEnergy)이라 에너지 수지가 정확히 닫힌다. engine 변경 0(조립).
//   x-z 투영·밝기=열(internalE). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0087'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;

  const CFG = { u0: 7, NP: 120, R0: 5, G: 1, soft: 0.8, h: 2.2, gamma: 5 / 3, alpha: 1.0, beta: 2.0, dt: 0.002 };
  const CHUNK = 833;                         // advance 1회 = 833 engine step (4 프레임 → 0·833·1666·2499)
  const CAN = 48, SPAN = 16, SC = CAN / SPAN;   // 월드 ±8 → 캔버스 0..48

  function build(w) {
    let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const P = [];
    for (let i = 0; i < CFG.NP; i++) { let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
      P.push({ cx: x * CFG.R0, cy: y * CFG.R0, cz: z * CFG.R0, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: CFG.u0, KEcm: 0, energy: CFG.u0, radius: 1 }); }
    w.__P = P;
  }
  function sim(w, n) {
    for (let s = 0; s < n; s++) {
      En.applyEntityGravity(w.__P, CFG.dt, { G: CFG.G, soft: CFG.soft });
      Sph.sphThermalPressureForce(w.__P, CFG.dt, { gamma: CFG.gamma, h: CFG.h });
      Sph.sphViscosity(w.__P, CFG.dt, { alpha: CFG.alpha, beta: CFG.beta, gamma: CFG.gamma, h: CFG.h });
      En.stepEntities(w.__P, CFG.dt);
    }
  }

  return {
    label: 'step_0087 — (조립) 비리얼 평형 별 코어: 압력이 붕괴를 유한 코어에서 멈춘다',
    title: 'HTJ — 비리얼 평형 별 코어: 되먹임 압력이 자기중력 붕괴를 *유한 반경*에서 멈춘다(2(K+U)+W≈0)',
    sub: '0085 는 자기중력 붕괴를 입자만으로 보였으나 점으로 무너졌다(압력 없음). 여기선 되먹임 압력(0045)+점성(0046)을 얹어 — 붕괴가 가스를 데우고 압력이 떠받쳐 유한 코어에서 멈춘다. 비리얼 근처서 시작 → 점성이 잔여 운동 깎아 비리얼 평형 Q=2(K+U)/|W|→1. 중력=쌍힘(0028)·PE 같은 법칙이라 에너지 수지 정확. engine 변경 0. 밝기=열.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, CHUNK); },

    makeWorld() { return { N: CAN }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: CAN, color: (v) => [60 + v * 195, 70 + v * 150, 160 - v * 40] },   // 찬 파랑 → 뜨거운 흰/노랑(열)
    toFrame(w) {
      const P = w.__P, pts = [];
      let hmax = 1e-9; for (const p of P) if ((p.internalE || 0) > hmax) hmax = p.internalE;
      for (const p of P) {
        const heat = (p.internalE || 0) / hmax;
        pts.push({ cx: (p.cx + SPAN / 2) * SC, cy: (SPAN / 2 - p.cz) * SC, r: 0.9, v: 0.2 + 0.8 * heat });
      }
      return { pts, count: P.length };
    },

    note: '<b>비리얼 평형 별 코어 — 압력이 중력 붕괴를 *유한 코어*에서 멈춘다.</b> 이 step 은 새 법칙을 더하지 않는다(engine 변경 0·조립). <b>0085 와의 차이</b>: 0085 는 자기중력 붕괴를 입자(SPH)만으로 보였지만 *압력이 약해 점으로* 무너졌다(RMS 3.03→0.12). 진짜 별은 무한히 붕괴하지 않는다 — 압력이 떠받친다. 이 무대가 그 *멈춤*을 보인다. 가스 블롭에 <code>applyEntityGravity</code>(0028 쌍힘 중력)+<code>sphThermalPressureForce</code>(0045 *되먹임* 압력 P=(γ−1)ρu·압축이 u 를 데우고 데운 u 가 P 를 키워 더 세게 떠받침)+<code>sphViscosity</code>(0046 점성·infall 운동을 열로 깎음)+<code>stepEntities</code>(0027)를 굴린다. <b>비리얼 근처에서 시작</b>(초기 내부E U₀≈½|W₀| → Q₀≈1): 가스가 살짝 수축·가열·되튐을 반복하고 점성이 그 진동을 깎으면 <b>비리얼 평형</b>에 정착한다 — 중력(안으로)과 압력(밖으로)이 균형. <b>측정(verify)</b>: ① <b>유한 코어</b> — 압력 ON ⟨rms⟩≈4.0 으로 *유계 정착* vs OFF rms≈0.05 *점 붕괴*(비 75×·압력이 멈춤의 주역) ② <b>비리얼 정리</b> Q=2(K_bulk+U)/|W| 가 ≈1 로 정착(γ=5/3 단원자 → 2(K+U)+W=0·측정 1.07·softened 중력 ~7% 편차) ③ <b>압력 지지</b> ⟨K_bulk⟩/⟨U⟩≈0.02 ≪ 1(점성이 운동E 를 깎아 코어는 *압력*이 떠받침·*운동*이 아님) ④ 정지 시작 → Σp≈1e-13(중력·압력·점성 모두 쌍힘 equal-opposite → 운동량 정확 보존) ⑤ 결정론. <b>흐름</b>(capture 4 프레임): 흩어진 블롭이 자기중력으로 모여 <span style="color:#fe8">데워지며</span>(밝기=열) → 압력이 차오르며 붕괴를 멈춰 → 유한 반경의 *지속하는 따뜻한 코어*로 정착(점으로 안 무너지고 흩어지지도 않음). <b>큰 그림</b>: "스스로 형성돼 *지속*하는 개체"의 첫 시연 — 중력↓+압력↑ 균형이 별 코어를 빚는다(STATE §4 의 "선 캐릭터=중력↓+접촉 반발↑ 균형" 의 유체 판). <b>원칙 준수</b>: engine 은 "별" 타입을 모름 — 입자=한 원소, 중력=쌍힘, 압력/열=일반량 u. 새 법칙 0. <b>정직한 한계</b>: ⓐ <b>왜 0085 의 PM 중력이 아니라 0028 쌍힘 중력인가</b> — 주기 경계 PM 의 Φ 는 게이지(상수 오프셋) 자유가 있어 PE=½Σmᵢφᵢ 가 모호하다. 비리얼을 *정확히* 닫으려면 힘과 PE 가 *같은 법칙*이어야 해 직접 N체 중력(0028)+짝맞는 PE(0028)를 쓴다(둘 다 한 원소·알려진 역학). 0085/0086 은 격자 은퇴(PM) 트랙·이 step 은 압력-비리얼 트랙. ⓑ softened 중력(soft=0.8)이라 비리얼이 정확히 r·∇Φ 가 아니어서 Q≈1.07(7% 편차) ⓒ 냉각 없음 → 단열·점성만의 평형(복사 냉각 결합은 후속) ⓓ 총E=K+U+W 가 ~2% 수치 표류(viscosity 이산화·dt) ⓔ viewer 는 x-z 투영. <b>다음</b>: 유한 코어 + 복사 냉각(0052) 균형으로 정상상태 별·발산(충격면) 축·연속 바다 3D.'
  };
});
