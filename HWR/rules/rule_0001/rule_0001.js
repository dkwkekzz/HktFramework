// rule_0001 — 관성과 질량
//
// 세계의 첫 법칙: 원소는 *관성*을 가지며, 이에 *질량*을 갖는다.
//  ① 관성(뉴턴 1법칙): 힘이 없으면 속도는 불변 — 위치만 v 로 적분된다.
//  ② 질량 = 관성의 척도: 같은 힘이라도 무거울수록 덜 변한다(a = F/m).
//
// 이 두 법칙은 세계 로직(engine.js)이 모든 원소에 *항상* 실현한다(적분·a=F/m·시간은 엔진의 몫).
// 그러므로 rule_0001 의 코드 몫은 질량을 *거동으로 드러내는* 외부 통로 — 충격량(impulse)이다:
//   같은 충격량 J 라도 질량이 다르면 다르게 반응(Δv = J/m)함으로써, 질량이 '관성의 척도'임을 검증한다.
//   충격량은 순간적인 Δp 다. 엔진이 힘을 dt 만큼 적분하므로 이번 tick 의 힘을 J/dt 로 환산해 누적하면
//   Δv = (J/dt)/m · dt = J/m — dt 와 무관하게 정확.
//
// 보존: 충격량 외에 힘이 없으면 총 운동량 Σ m·v 불변(관성). 충격량 J 가 들어오면 정확히 ΣJ 만큼 변함(닫힌 장부).
// 충격량 통로는 원소 *타입*이 아니라 외부 작용 채널(world.impulses) — author 안 함.

export default {
  id: 'rule_0001',
  name: '관성과 질량',
  defaults: { dt: 1 },

  // 관성·질량(적분·a=F/m)은 엔진이 실현한다. 이 규칙은 질량을 드러내는 외부 충격량을 힘으로 누적한다.
  // 위치·속도·tick 은 손대지 않는다(엔진 담당).  e: 원소, i: 인덱스, world: 세계, params: 파라미터
  apply(e, i, world, params) {
    const dt = params && params.dt != null ? params.dt : 1;
    const imps = world.impulses;
    if (!Array.isArray(imps)) return;
    // 이번 tick 에 이 원소(idx===i)로 예약된 충격량 J → 힘 J/dt 로 누적 (엔진 적분에서 Δv=J/m)
    for (const imp of imps) {
      if (imp.tick === world.tick && imp.idx === i) {
        e.fx += imp.jx / dt;
        e.fy += imp.jy / dt;
      }
    }
  },
};
