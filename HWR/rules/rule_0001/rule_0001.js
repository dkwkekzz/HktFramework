// rule_0001 — 충격량(외부 힘의 통로)과 질량
//
// 세계 로직(engine.js)이 관성(위치 적분)·뉴턴 2법칙(a=F/m)·시간을 *이미* 소유한다.
// 그러므로 이 규칙은 원소에 작용하는 '힘'만 누적한다(엔진이 적분).
//
// ① 관성/질량 자체는 엔진이 보장 — 힘이 없으면 속도 불변(등속), 같은 힘이라도 무거우면 덜 변함(Δv=F·dt/m).
// ② 이 규칙의 몫: 외부에서 예약된 *충격량* J 를 원소에 전달하는 통로.
//    충격량은 순간적인 Δp 다. 엔진이 힘을 dt 만큼 적분하므로, 이번 tick 의 힘을 J/dt 로 환산해 누적하면
//    Δv = (J/dt)/m · dt = J/m — dt 와 무관하게 정확히 Δv = J/m (질량 = 관성의 척도).
//
// 보존: 충격량 외에 힘이 없으면 총 운동량 Σ m·v 불변. 충격량 J 가 들어오면 정확히 ΣJ 만큼 변함(닫힌 장부).
// 충격량 통로는 원소 *타입*이 아니라 외부 작용 채널(world.impulses) — author 안 함.

export default {
  id: 'rule_0001',
  name: '충격량과 질량',
  defaults: { dt: 1 },

  // 한 원소에 작용하는 힘을 누적한다. 위치·속도·tick 은 손대지 않는다(엔진 담당).
  //   e: 원소, i: 인덱스, world: 세계, params: 파라미터
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
