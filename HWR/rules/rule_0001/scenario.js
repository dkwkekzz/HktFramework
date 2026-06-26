// scenario — 관성: 같은 외부 힘에 질량이 다르게 저항한다(질량 = 관성의 척도).
//  ① kick 4개: 정지 상태, 질량 m=1,2,4,8. tick 5 에 동일 충격량 +x → Δv=J/m 로 갈라진다
//     (무거울수록 덜 변함 = 더 큰 저항). 관성·질량이 거동으로 드러나는 핵심 장면.
//  ② drift: 같은 vx·다른 질량 → 외부 힘이 없으니 같은 변위(저항할 대상이 없음 = 등속, 갈릴레이).
export default {
  rule: 'rule_0001',
  setup() {
    const w = 800, h = 600;
    const masses = [1, 2, 4, 8];
    const els = [];

    // ① kick 원소(인덱스 0..3): 정지 상태로 세로 배치
    masses.forEach((m, i) => {
      els.push({
        x: 80, y: 110 + i * 120, z: 0, vx: 0, vy: 0, m,
        r: 3 + Math.sqrt(m) * 2,
        hue: Math.round(200 - i / (masses.length - 1) * 160),
      });
    });

    // ② 드리프트 원소: 같은 vx, 다른 질량 → 같은 변위(외부 힘 없음 → 질량 무관)
    for (let i = 0; i < 6; i++) {
      els.push({ x: 360, y: 70 + i * 85, z: 0, vx: 1.2, vy: 0, m: 1 + i, r: 4, hue: 120 });
    }

    // 예약 외부 힘: tick 5 에 kick 원소 전체에 동일한 +x 충격량 J
    const J = 6;
    const impulses = masses.map((_, idx) => ({ tick: 5, idx, jx: J, jy: 0 }));

    // depth → 세계는 3D 박스(폭 w × 높이 h × 깊이 d). 이 장면은 평면(z=0) 단면이지만 공간 자체는 3D.
    return { width: w, height: h, depth: 600, tick: 0, elements: els, impulses };
  },
};
