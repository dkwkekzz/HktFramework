// rule_0002 — 결합 (원소가 합쳐져 하나의 개체가 된다)
//
// 결합은 운동량을 더하는 '힘'이 아니라 세계의 *위상*(원소 개수)을 바꾸는 사건이다.
// 그래서 이 규칙은 힘을 누적하지 않고, 결합할 쌍을 *표시*만 한다(현재 상태만 읽는 같은 계약).
//   · 규칙(여기) = 결합의 법칙: 언제 결합하는가 — 접촉(거리 ≤ 반경 합) + 접근(상대속도가 닫힘).
//   · 엔진(engine.js reconcileMerges) = 결합의 메커니즘: 어떻게 합치는가 — 질량 합·운동량 보존·질량중심.
// 엔진은 매 틱 world.pendingMerges 를 비우고(①) 적분 뒤 소비(⑤)하므로, 여기선 push 만 하면 된다.
//
// author 안 함: 타입("물·불") 분기 0. 접촉은 순수 기하, 반경은 질량에서만 온다(R = bondK·√m, 등밀도).
// 결정론: 현재 위치·속도만 읽고 j>i 쌍만 표시(중복 방지). Math.random 금지.

const radius = (m, bondK) => bondK * Math.sqrt(m > 0 ? m : 1); // 질량→접촉 반경(등밀도, 2D: 면적∝질량)

export default {
  id: 'rule_0002',
  name: '결합',
  //   bondK : 질량→반경 환산 계수(접촉 판정의 크기 척도)
  //   vStick: 결합 문턱 — 상대속력이 이보다 빠르면 결합이 충격을 못 가둬 들러붙지 않는다(튕김/통과).
  //           에너지로 보면 결합 용량 E_bond = ½μ·vStick² 이고 조건은 ½μ|Δv|² ≤ E_bond ⟺ |Δv| ≤ vStick.
  defaults: { bondK: 2, vStick: 2.5 },

  // 원소 i 가 자기보다 뒤(j>i)의 원소와 접촉·접근하고, 충분히 부드럽게 만나면 병합 쌍 {a:i,b:j} 를 표시한다.
  //   위치·속도·tick·병합 실행은 손대지 않는다(엔진 담당). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const bondK = params && params.bondK != null ? params.bondK : 2;
    const vStick = params && params.vStick != null ? params.vStick : Infinity;
    const els = world.elements;
    const W = world.width, H = world.height;
    const Ri = radius(e.m, bondK);

    for (let j = i + 1; j < els.length; j++) {
      const o = els[j];
      // 토러스 최근접 변위(둘 사이 가장 가까운 이미지)
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      const R = Ri + radius(o.m, bondK);
      if (dx * dx + dy * dy > R * R) continue;          // 접촉 아님

      // 접근(닫힘): 중심선 방향 상대속도가 음수여야 결합(서로 멀어지면 결합 안 함)
      const dvx = (o.vx || 0) - (e.vx || 0), dvy = (o.vy || 0) - (e.vy || 0);
      if (dx * dvx + dy * dvy >= 0) continue;           // 멀어지는 중 → 결합 안 함

      // 결합 문턱: 너무 빠르게 만나면 결합이 충격을 못 가둔다 → 들러붙지 않음(닿는 게 다 뭉치진 않는다)
      if (dvx * dvx + dvy * dvy > vStick * vStick) continue;

      world.pendingMerges.push({ a: i, b: j });         // 엔진이 ⑤에서 질량·운동량 보존 병합
    }
  },
};
