// scenario — 화학 쇼케이스: 전기음성도가 결합의 운명을 가른다.
//  ① H₂ (공유): en 같은 두 원자가 부드럽게 만남 → ΔEN=0 → 하나의 분자로 병합(중성, 1개체).
//  ② NaCl (이온): en 차이 큰 두 원자 → 전자 이동(Na⁺·Cl⁻) → 병합 대신 전기력(rule_0003)이 붙잡아
//     평형 거리에서 묶인 이온쌍이 됨(2개체, 흩어지지도 무너지지도 않음).
//  ③ 비활성 원자: 홀로 떠도는 중성 원자 — 짝이 없어 아무 일도 안 일어남.
// en 값은 *시나리오가 seed* 하는 보편 스칼라(규칙은 차이만 읽음). Math.random 금지.
export default {
  rule: 'rule_0003',
  setup() {
    const w = 800, h = 600;
    const els = [];
    const atom = (x, y, vx, m, en, hue) => ({ x, y, z: 0, vx, vy: 0, m, en, q: 0, r: 2 + Math.sqrt(m) * 2, hue });

    // ① H₂ — en 2.2 동일 → 공유 결합(병합)
    els.push(atom(300, 150, +0.4, 1, 2.2, 50));
    els.push(atom(322, 150, -0.4, 1, 2.2, 50));

    // ② NaCl — Na(en 0.9) + Cl(en 3.2), ΔEN 2.3 → 이온 결합(전자 이동) → 전기력이 묶음
    els.push(atom(250, 380, +0.4, 2, 0.9, 30));   // Na형(낮은 en)
    els.push(atom(296, 380, -0.4, 2, 3.2, 210));  // Cl형(높은 en)

    // ③ 비활성 원자 — 홀로, 짝 없음
    els.push(atom(600, 300, 0, 2, 2.5, 120));

    return { width: w, height: h, tick: 0, elements: els };
  },
};
