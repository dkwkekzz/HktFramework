// scenario — 같은 충격량, 다른 질량: 가벼운 원소가 앞서 나간다 (질량 = 관성의 척도)
//  · 왼쪽 열: 정지한 원소 4개(m=1,2,4,8). tick 5 에 동일 충격량 +x → Δv=J/m 로 갈라진다.
//  · 가운데: 같은 속도·다른 질량의 드리프트 원소(관성 — 질량 무관 같은 궤적).
export default {
  rule: 'rule_0001',
  setup() {
    const w = 800, h = 600;
    const masses = [1, 2, 4, 8];
    const els = [];

    // kick 원소(인덱스 0..3): 정지 상태로 세로 배치
    masses.forEach((m, i) => {
      els.push({
        x: 80, y: 110 + i * 120, vx: 0, vy: 0, m,
        r: 3 + Math.sqrt(m) * 2,
        hue: Math.round(200 - i / (masses.length - 1) * 160),
      });
    });

    // 드리프트 원소: 같은 vx, 다른 질량 → 같은 변위(갈릴레이)
    for (let i = 0; i < 6; i++) {
      els.push({ x: 360, y: 70 + i * 85, vx: 1.2, vy: 0, m: 1 + i, r: 4, hue: 120 });
    }

    // 예약 충격량: tick 5 에 kick 원소 전체에 동일한 +x 충격량 J
    const J = 6;
    const impulses = masses.map((_, idx) => ({ tick: 5, idx, jx: J, jy: 0 }));

    return { width: w, height: h, tick: 0, elements: els, impulses };
  },
};
