// rule_0001 — 관성 (질량 = 관성의 척도)
//
// 관성: 원소는 운동 상태(속도)를 유지하려 한다 — 변화에 *저항*한다. 그 저항의 크기가 *질량* 이다.
//   · 외부에서 힘/변형이 들어오면 변화는 a = F/m — 질량이 클수록 같은 힘에 덜 변한다(저항이 크다).
//   · 힘이 없으면 변화 0 → 등속(저항의 극한). '관성'과 '질량'은 분리되지 않는 하나의 법칙이다.
//
// 이 저항(a=F/m)·적분·시간은 세계 로직(engine.js)이 모든 원소에 *항상* 실현한다.
// rule_0001 의 코드 몫: 외부 힘/변형이 세계로 들어오는 *입구*를 연다 — world.impulses 에 예약된
//   외부 힘을 힘 누적기에 더한다. 그러면 엔진의 a=F/m 가 질량에 비례해 저항한다(무거울수록 덜 변함).
//   충격량은 '입력'일 뿐 별도 개념이 아니다 — 사용자가 밀거나(상호작용) 시나리오가 예약한 외부 작용.
//
// 순간 충격량 J(Δp)를 힘으로: 엔진이 힘을 dt 만큼 적분하므로 이번 tick 의 힘을 J/dt 로 환산하면
//   Δv = (J/dt)/m·dt = J/m — dt 무관하게 정확. 질량이 클수록 Δv 가 작다(= 저항).
//
// 보존: 외부 힘이 없으면 총 운동량 Σ m·v 불변. 외부 힘 J 가 들어오면 정확히 ΣJ 만큼 변함(닫힌 장부).
// 외부 힘 입구(world.impulses)는 원소 *타입*이 아니라 외부 작용 채널 — author 안 함.

export default {
  id: 'rule_0001',
  name: '관성',
  defaults: { dt: 1 },

  // 외부에서 들어온 힘/변형을 힘 누적기에 더한다(엔진의 a=F/m 가 질량으로 저항).
  //   위치·속도·tick·적분은 손대지 않는다(엔진 담당). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const dt = params && params.dt != null ? params.dt : 1;
    const imps = world.impulses;
    if (!Array.isArray(imps)) return;
    // 이번 tick 에 이 원소(idx===i)로 예약된 외부 힘 J → 힘 J/dt 로 누적
    for (const imp of imps) {
      if (imp.tick === world.tick && imp.idx === i) {
        e.fx += (imp.jx || 0) / dt;   // 엔진 적분에서 Δv = J/m — 무거울수록 덜 변함(= 관성)
        e.fy += (imp.jy || 0) / dt;
        if (imp.jz != null) e.fz += imp.jz / dt;  // 3D 외부 힘(깊이 축). 없으면 무시(하위 호환)
      }
    }
  },
};
