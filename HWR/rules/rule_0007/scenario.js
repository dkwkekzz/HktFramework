// scenario — 배제 부피 쇼케이스: 전자구름이 겹치면 부딪치고 튕긴다(전하 없이도).
//  ① 정면 충돌(중성) — 마주 오는 두 중성 원자가 *서로 통과하지 않고* 되튕긴다. 관성만이면 그냥 지나칠 텐데
//     전자구름 배제가 막는다. 전하 0 이라 rule_0003 EM 은 안 보임 → 순수히 rule_0007 의 일.
//  ② 전자 수로 크기 — Z 큰 원자(채워진 껍질 많음)는 큰 구름 → 더 멀리서 부딪친다. 작은 Z 는 더 가까이.
//  ③ 가스(다체) — 여러 원자가 박스 안을 날아다니며 서로 튕겨 압력·확산처럼 보이는 거동이 창발.
// Z 는 *근본 정수*(전자 수)만 seed — 껍질·구름 크기는 코드가 계산. Math.random 금지(시드 의사난수).
export default {
  rule: 'rule_0007',
  name: '배제 부피 — 충돌·튕김(전자구름)',
  setup() {
    const w = 600, h = 600, d = 600;
    const els = [];
    // 시드 의사난수 — 결정론.
    let s = 20260627;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    // ① 정면 충돌(중성) — 마주 오는 두 헬륨형(Z=2, 비활성=결합 안 함). 통과 대신 튕긴다.
    els.push({ x: 270, y: 300, z: 300, vx: +1.0, vy: 0, vz: 0, m: 2, Z: 2, hue: 50 });
    els.push({ x: 330, y: 300, z: 300, vx: -1.0, vy: 0, vz: 0, m: 2, Z: 2, hue: 50 });

    // ② 전자 수로 크기 — 큰 원자(Z=18, 세 껍질)는 큰 구름. (관찰: ①보다 먼 거리에서 튕김)
    els.push({ x: 250, y: 150, z: 300, vx: +0.8, vy: 0, vz: 0, m: 4, Z: 18, hue: 0 });
    els.push({ x: 350, y: 150, z: 300, vx: -0.8, vy: 0, vz: 0, m: 4, Z: 18, hue: 0 });

    // ③ 가스(다체) — 비활성 원자 무리(결합 안 해 순수 충돌만). 박스를 날아다니며 서로 튕긴다.
    for (let k = 0; k < 24; k++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, sp = 0.6 + rnd() * 1.0;
      const sxy = Math.sqrt(1 - u * u);
      els.push({
        x: 80 + rnd() * (w - 160), y: 360 + rnd() * 200, z: 80 + rnd() * (d - 160),
        vx: Math.cos(th) * sxy * sp, vy: Math.sin(th) * sxy * sp, vz: u * sp,
        m: 2, Z: 10, hue: 200,                       // 네온형(Z=10, 비활성)
      });
    }

    return { width: w, height: h, depth: d, tick: 0, elements: els, impulses: [] };
  },
};
