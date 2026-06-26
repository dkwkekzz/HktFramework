// rule_0002 — 결합 (원소가 합쳐지거나, 전자를 주고받는다)
//
// 결합은 힘이 아니라 세계의 *상태*를 바꾸는 사건이다. 규칙은 결합 사건을 *표시*만 한다(현재 상태만 읽음).
//   · 규칙(여기) = 결합의 법칙: 언제·어떤 결합인가.
//   · 엔진(engine.js) = 결합의 메커니즘: 병합/전하 이동을 실행.
//
// 결합 조건(공통): 접촉(거리 ≤ 반경 합) + 접근(상대속도 닫힘) + 부드러움(|Δv| ≤ vStick).
// 결합 종류 — 전기음성도(en)로 가른다. 두 원소의 en 차이 ΔEN = |en_i − en_j| 가 성격을 정한다:
//   · ΔEN 작음(< ionicThreshold) → 공유 결합: 전자를 나눠 가짐 → 하나의 분자로 병합(pendingMerges).
//   · ΔEN 큼(≥ ionicThreshold) → 이온 결합: en 높은 쪽이 전자를 빼앗음 → +/− 이온(pendingTransfers, 병합 안 함).
//     (이미 전하를 띤 이온은 재이동 안 함 — 중성끼리만. 이온을 붙잡는 전기력은 rule_0003.)
//
// author 안 함: 타입("산소·나트륨") 분기 0. en 은 질량처럼 원소가 가진 *보편 스칼라*(시나리오가 seed).
//   규칙은 en 의 *차이*만 읽어 ΔEN→공유/이온을 정한다 — "if 산소" 같은 분기는 없다.
// 결정론: 현재 위치·속도·en·q 만 읽고 j>i 쌍만 표시. Math.random 금지.

const radius = (m, bondK) => bondK * Math.sqrt(m > 0 ? m : 1); // 질량→접촉 반경(등밀도, 2D: 면적∝질량)

export default {
  id: 'rule_0002',
  name: '결합',
  //   bondK         : 질량→반경 환산 계수(접촉 판정 크기 척도)
  //   vStick        : 결합 문턱 — 상대속력이 이보다 빠르면 결합이 충격을 못 가둬 안 붙음(E_bond=½μ·vStick²)
  //   ionicThreshold: 전기음성도 차이 ΔEN 이 이 값 이상이면 이온 결합(전자 빼앗음), 미만이면 공유 결합(병합)
  //   transferQ     : 이온 결합에서 옮기는 전하량(전자 1개)
  defaults: { bondK: 2, vStick: 2.5, ionicThreshold: 1.7, transferQ: 1 },

  // 원소 i 가 j>i 와 결합 조건을 만족하면, 전기음성도 차이로 공유(병합)/이온(전하 이동)을 표시한다.
  //   상태 변경(병합·전하 이동)은 손대지 않는다(엔진 담당). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const bondK = params && params.bondK != null ? params.bondK : 2;
    const vStick = params && params.vStick != null ? params.vStick : Infinity;
    const ionicThreshold = params && params.ionicThreshold != null ? params.ionicThreshold : Infinity;
    const transferQ = params && params.transferQ != null ? params.transferQ : 1;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;
    // 껍질/원자가 규칙(rule_0004)이 관장하는 원소(원자번호 Z 또는 잔여 원자가 freeValence 를 가진 것)는
    //   원자가 한도 결합(다중 결합가·포화·비활성)을 rule_0004 가 처리하므로 여기서는 건드리지 않는다.
    //   둘 다 그런 속성이 없는 *구형* 원소만 rule_0002 가 결합시킨다(하위 호환 — 기존 시나리오엔 Z 없음).
    const isShell = x => x.Z != null || x.freeValence != null;
    if (isShell(e)) return;
    const Ri = radius(e.m, bondK);

    for (let j = i + 1; j < els.length; j++) {
      const o = els[j];
      if (isShell(o)) continue;
      // 토러스 최근접 변위(둘 사이 가장 가까운 이미지) — 3D
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      const R = Ri + radius(o.m, bondK);
      if (dx * dx + dy * dy + dz * dz > R * R) continue; // 접촉 아님(구 거리)

      // 접근(닫힘): 중심선 방향 상대속도가 음수여야 결합(서로 멀어지면 결합 안 함)
      const dvx = (o.vx || 0) - (e.vx || 0), dvy = (o.vy || 0) - (e.vy || 0), dvz = (o.vz || 0) - (e.vz || 0);
      if (dx * dvx + dy * dvy + dz * dvz >= 0) continue; // 멀어지는 중 → 결합 안 함

      // 결합 문턱: 너무 빠르게 만나면 결합이 충격을 못 가둔다 → 결합 안 함(닿는 게 다 뭉치진 않는다)
      if (dvx * dvx + dvy * dvy + dvz * dvz > vStick * vStick) continue;

      // 결합 종류: 전기음성도 차이로 공유 vs 이온
      const dEN = Math.abs((e.en || 0) - (o.en || 0));
      if (dEN >= ionicThreshold) {
        // 이온 결합 — en 높은 쪽이 전자를 빼앗음(엔진이 방향 결정). 중성끼리만(이온 재이동 방지).
        if ((e.q || 0) === 0 && (o.q || 0) === 0)
          world.pendingTransfers.push({ a: i, b: j, dq: transferQ });
      } else {
        // 공유 결합 — 전자를 나눠 가짐 → 하나의 분자로 병합
        world.pendingMerges.push({ a: i, b: j });
      }
    }
  },
};
