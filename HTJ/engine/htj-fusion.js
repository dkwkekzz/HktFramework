// htj-fusion.js — HTJ 열째 법칙: 내부 발열(별의 점화) = 무겁고 뜨거운 코어가 *스스로 열을 만든다*.
//
//   step_0011 까지로 *돌*(차가운 정착 덩어리)은 창발한다 — 중력으로 뭉치고(0007) 반발·열압력으로
//   떠받쳐(0008·0010) 점성으로 식어 정착(0011)한 불활성 질량. 하지만 *별*(에너지를 방출하는 존재)은
//   아직 없다. step_0004 의 점화·step_0005 의 복사는 `energy`(=질량) 필드에 붙어 있어 — 0006 에서
//   energy=질량(E=mc²)으로 못 박은 뒤로는 "복사=질량 소실·점화=질량 생성"이 되어 물리적으로 어긋난다.
//   별의 에너지 방출은 *질량*이 아니라 **열(therm/온도)** 에서 나와야 한다.
//
//   법칙은 **밀도·온도 게이트 내부 발열** 하나 — 핵융합 점화의 본질(질량 보존):
//     게이트:  ρ ≥ ρ_crit  AND  T ≥ T_crit          (무겁고 뜨거운 코어만 켜진다)
//     내부E :  u ← u + dt·rate·ρ   (게이트 켜진 셀)   (질량당 발열률 × 질량 = 발열, 질량은 불변)
//   온도 T=u/ρ(=step_0009 정의). **energy(ρ)는 절대 안 건드린다** → 별이 빛을 내도 질량 보존
//   (0005 의 질량 소실 문제를 닫는다). 만들어진 열은 step_0010 열압력으로 코어를 부풀리고(별이 큼),
//   step_0012 후속의 복사로 식는다(빛나며 식는 별).
//
//   못 박는 것 — **별과 돌이 *같은 법칙의 두 regime*으로 갈린다(author 안 함)**:
//     · 무겁고 조밀한 코어 → 중력 압축으로 ρ·T 가 임계를 넘음 → 점화 → 자기 발열·자기지속 = **별**.
//     · 가볍거나 차가운 덩어리 → 임계 못 넘음 → 게이트 안 켜짐 → 그냥 식음 = **돌**.
//     · 자기지속(latching): 점화로 T 오르면 게이트가 더 확실히 켜진다(켜지면 유지) — 별의 정체성.
//   현실 그대로 — 질량이 임계(~0.08 태양질량)를 넘으면 별, 못 넘으면 행성/돌. 타입으로 박지 않는다.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   rate=0 또는 dt=0 → 항등(early return) — 가법성/회귀 0 가드. 중력·반발·열압력·점성·이류와 직교 공존.
//   미래 step: 복사 냉각(therm sink)으로 발열↔복사 균형의 *영구 그래디언트*(뜨거운 코어→식는 표면)
//     = 지속하는 비평형 구조(0005 별 트랙 합류, 단 질량 보존). 그 뒤 상태방정식 P(ρ,T)→상(플라즈마=점화 영역).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJFusion = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²) — 발열은 이걸 *안* 건드린다
  const THERM = 'therm';                // 내부에너지 밀도 u(열) — 발열이 들어가는 곳
  const DEFAULT_RATE = 1.0;             // 질량당 발열률(노브)
  const DEFAULT_RHO_CRIT = 5.0;         // 점화 밀도 임계(노브) — 무거운 코어만 넘음
  const DEFAULT_T_CRIT = 1.0;           // 점화 온도 임계(노브) — 뜨거운 코어만 넘음
  const EPS = 1e-12;

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 점화 게이트 마스크(ρ≥ρ_crit ∧ T≥T_crit, T=u/ρ)를 scratch 에 1/0 으로 채워 돌려준다. 측정·검증 공유.
  function ignitionMask(world, opts) {
    opts = opts || {};
    const rhoCrit = opts.rhoCrit != null ? opts.rhoCrit : DEFAULT_RHO_CRIT;
    const tCrit = opts.tCrit != null ? opts.tCrit : DEFAULT_T_CRIT;
    const rho = world.fields[RHO], u = ensure(world, THERM), L = rho.length;
    const m = world.scratch.__fmask || (world.scratch.__fmask = new Float64Array(L));
    for (let i = 0; i < L; i++) {
      const r = rho[i], T = r > EPS ? u[i] / r : 0;
      m[i] = (r >= rhoCrit && T >= tCrit) ? 1 : 0;
    }
    return m;
  }

  // 내부 발열 1스텝 — 점화한(무겁고 뜨거운) 셀에 열을 더한다: u ← u + dt·rate·ρ. 질량(ρ)은 불변.
  //   rate=0 또는 dt=0 → 항등(early return, 회귀 0). 별=켜짐(자기지속), 돌=꺼짐(임계 미달).
  function applyFusion(world, dt, opts) {
    opts = opts || {};
    const rate = opts.rate != null ? opts.rate : DEFAULT_RATE;
    if (dt == null) dt = 1;
    if (!rate || !dt) return world;                      // 노브=0 → 세계 불변
    const rhoCrit = opts.rhoCrit != null ? opts.rhoCrit : DEFAULT_RHO_CRIT;
    const tCrit = opts.tCrit != null ? opts.tCrit : DEFAULT_T_CRIT;
    const rho = world.fields[RHO], u = ensure(world, THERM), L = rho.length;
    for (let i = 0; i < L; i++) {
      const r = rho[i];
      if (r < rhoCrit) continue;                         // 밀도 게이트
      const T = r > EPS ? u[i] / r : 0;
      if (T < tCrit) continue;                           // 온도 게이트
      u[i] += dt * rate * r;                             // 내부 발열(질량당 발열률 × 질량). ρ 불변.
    }
    return world;
  }

  // 총 발열 셀 수 / 총 내부에너지 / 최대 온도 — 별↔돌 판별 측정자.
  function ignitedCount(world, opts) { const m = ignitionMask(world, opts); let c = 0; for (let i = 0; i < m.length; i++) c += m[i]; return c; }
  function totalInternal(world) { const u = ensure(world, THERM); let s = 0; for (let i = 0; i < u.length; i++) s += u[i]; return s; }
  function maxTemperature(world) {
    const rho = world.fields[RHO], u = ensure(world, THERM); let T = 0;
    for (let i = 0; i < rho.length; i++) { const t = rho[i] > EPS ? u[i] / rho[i] : 0; if (t > T) T = t; }
    return T;
  }

  return { applyFusion, ignitionMask, ignitedCount, totalInternal, maxTemperature,
           RHO, THERM, DEFAULT_RATE, DEFAULT_RHO_CRIT, DEFAULT_T_CRIT, VERSION: 1 };
});
