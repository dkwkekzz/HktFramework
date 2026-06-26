// scenario — 관성: 자유 운동은 질량과 무관하고(갈릴레이), 힘이 없으면 등속이다.
//  ① 같은 vx·다른 질량 6개: 세로로 정렬 → 영원히 같은 x(질량 무관, 줄이 흐트러지지 않음).
//  ② 다른 vx 5개: 같은 출발선 → 속도에 비례해 갈라진다(등속).
// 힘이 없으므로(impulse 없음) 모든 속도는 불변, 총 운동량 Σmv 도 불변이다.
export default {
  rule: 'rule_0001',
  setup() {
    const w = 800, h = 600;
    const els = [];

    // ① 같은 속도·다른 질량 → 관성으로 정렬 유지(질량은 자유 운동에 영향 없음)
    for (let i = 0; i < 6; i++) {
      const m = 1 + i;
      els.push({ x: 100, y: 80 + i * 70, z: 0, vx: 1.0, vy: 0, m, r: 3 + Math.sqrt(m) * 1.5, hue: 190 });
    }

    // ② 다른 속도 → 속도에 비례해 갈라짐(등속)
    const vxs = [0.4, 0.8, 1.2, 1.6, 2.0];
    vxs.forEach((vx, i) => {
      els.push({ x: 100, y: 540, z: 0, vx, vy: 0, m: 2, r: 4, hue: 20 + i * 28 });
    });

    return { width: w, height: h, tick: 0, elements: els };
  },
};
