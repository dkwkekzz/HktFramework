// scenario — 결합: 접촉+접근한 원소가 하나의 개체로 병합된다(개수가 준다).
//  ① 정면 충돌 쌍 3벌(질량비 다름): 서로 향해 다가가 접촉 → 하나로 병합. 합성 속도 = 질량중심 속도.
//  ② 대조 쌍: 멀리서 같은 방향 평행 이동 → 영원히 안 닿음(병합 0).
//  ③ 전이적 삼중: 세 원소가 가운데로 수렴 → 한 틱 내 연쇄 접촉 시 하나의 덩어리로(전이적 병합).
// 결합은 *초기 속도*로 접근시켜 일으킨다(끌어당기는 힘은 후속 규칙). Math.random 금지(시드 불필요).
export default {
  rule: 'rule_0002',
  setup() {
    const w = 800, h = 600;
    const els = [];

    // ① 정면 충돌 쌍 — (질량 a, 질량 b)를 서로 향해. 닿으면 병합되어 질량중심 속도로 함께 간다.
    const pairs = [
      { y: 120, ma: 2, mb: 2, x: 360, gap: 80, v: 3 }, // 대칭 → 합성 정지(V_com=0)
      { y: 240, ma: 2, mb: 6, x: 360, gap: 80, v: 3 }, // 비대칭 → 합성은 무거운 쪽으로 표류
      { y: 360, ma: 4, mb: 1, x: 360, gap: 70, v: 2.5 },
    ];
    pairs.forEach(p => {
      els.push({ x: p.x - p.gap / 2, y: p.y, z: 0, vx: +p.v, vy: 0, m: p.ma, r: 2 + Math.sqrt(p.ma) * 2, hue: 200 });
      els.push({ x: p.x + p.gap / 2, y: p.y, z: 0, vx: -p.v, vy: 0, m: p.mb, r: 2 + Math.sqrt(p.mb) * 2, hue: 20 });
    });

    // ② 대조 쌍 — 멀리 떨어져 같은 방향(평행) → 절대 안 닿음(병합 안 됨).
    els.push({ x: 120, y: 500, z: 0, vx: 1, vy: 0, m: 3, r: 2 + Math.sqrt(3) * 2, hue: 120 });
    els.push({ x: 120, y: 540, z: 0, vx: 1, vy: 0, m: 3, r: 2 + Math.sqrt(3) * 2, hue: 120 });

    // ③ 전이적 삼중 — 셋이 가운데로 수렴. 가까이 모이면 연쇄 접촉으로 한 덩어리.
    const cx = 620, cy = 300, mtri = 2;
    els.push({ x: cx - 60, y: cy, z: 0, vx: +2, vy: 0, m: mtri, r: 2 + Math.sqrt(mtri) * 2, hue: 280 });
    els.push({ x: cx, y: cy, z: 0, vx: 0, vy: 0, m: mtri, r: 2 + Math.sqrt(mtri) * 2, hue: 300 });
    els.push({ x: cx + 60, y: cy, z: 0, vx: -2, vy: 0, m: mtri, r: 2 + Math.sqrt(mtri) * 2, hue: 320 });

    return { width: w, height: h, tick: 0, elements: els };
  },
};
