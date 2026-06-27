// rule_0007 — 전자구름 배제 부피 (Pauli exclusion / excluded volume)
//
// 지금까지 "단단함(밀어내는 정상력)"은 *전하가 있어야* 켜졌다 — rule_0003 의 Born 반발은 전하 사이트(이온
//   순전하·분자 부분전하)에서만 작동한다. 그래서 **중성 홀원자는 서로 통과**한다(배제 부피 없음 → 충돌 없음
//   → 그냥 등속으로 스쳐 지나감). 실세계는 그렇지 않다: 중성 원자도 가까워지면 *전자구름이 겹쳐* 파울리
//   배타 원리로 강하게 밀어낸다. 이 단거리 반발이 물질에 *부피*를 주고 — 원자가 서로 *부딪치게* 한다.
//
// rule_0007 은 그 배제 부피를 **모든 원자**에 부여한다 — 전하와 무관하게, *전자가 있으면* 충돌한다.
//   전자기력(rule_0003)의 Born 항이 전하곱에 묶인 것과 달리, 여긴 순수히 *전자구름 겹침*만 본다.
//   · 크기(전자구름 반경 σ)는 *전자 수*에서 온다 — 전자가 더 많은 껍질을 채울수록(주기↓) 구름이 크다.
//     원자번호 Z(=중성 전자 수)가 있으면 채워진 껍질 수(rule_0004 shellState.period)로 σ 를 측정한다.
//     전하도 읽는다: 양이온(전자 잃음)은 작고, 음이온(전자 얻음)은 크다(이온 반경 창발).
//   · Z 가 없는 *구형* 원소(기존 시나리오·분자 합성체)는 시각/접촉 반경 `r` 의 일부를 코어로 쓴다(하위 호환).
//
// 힘의 성질 — 산발하고 튕긴다:
//   · 단거리: 두 구름이 겹칠 때만(중심거리 r < σᵢ+σⱼ) 작동, 그 밖에선 0 → 원거리 거동 불변(기존 규칙 무간섭).
//   · 보존력(탄성): 속도에 무관한 중심 반발(단방향 Hooke). 소산이 없어 충돌 후 *되튕긴다* → 운동에너지 보존
//     → 산발·튕김이 사그라들지 않는다(rule_0003 마찰의 감쇠와 대비). "정적"의 반대.
//   · 운동량 보존: 모든 항이 중심·상대량 → 작용-반작용 정확히 상쇄 → ΣΔp = 0.
// 결정론: 현재 위치·Z·전하만 읽음. Math.random 금지. 같은 입력 → 같은 출력.
//
// 결합과의 공존: 결합(rule_0002/0004)은 *사건*이라, 이번 틱에 게이트(접촉+접근+부드러움+잔여 손)를 만족하면
//   엔진이 병합/이동을 실행한다 — 배제 부피 힘과 무관하게. 배제 부피는 *결합하지 않는* 겹침(포화·비활성·
//   같은전하·너무 빠름)만 밀어낸다. 부드럽게 만나면 붙고(결합), 세게 부딪치면 튕긴다(배제 부피) — 둘이
//   같은 세계에서 자연히 갈린다. 코어 σ 를 결합 길이보다 작게 둬 결합 거리에 닿을 수는 있게 한다.

import { shellState } from '../rule_0004/rule_0004.js';

// 원소의 전자구름 반경 σ — *측정값*(상태 아님). 전자 수에서 창발한다.
//   Z 있음: 채워진 껍질 수(period)가 클수록 큰 구름 + 전하 보정(양이온↓·음이온↑).
//   Z 없음·r 있음: 시각 반경의 일부를 코어로(구형 원소·분자 합성체 — 하위 호환).
//   둘 다 없음: 기본 코어 sigma0.
function cloudRadius(e, p) {
  const sigma0 = p.evSigma0 != null ? p.evSigma0 : 1.0;
  if (e.Z != null) {
    const perShell = p.evPerShell != null ? p.evPerShell : 1.4;
    const shrink = p.evChargeShrink != null ? p.evChargeShrink : 0.3;
    const sh = shellState(e.Z);
    return Math.max(0.1, sigma0 + perShell * sh.period - shrink * (e.q || 0));
  }
  if (e.r != null) return (p.evRfrac != null ? p.evRfrac : 0.6) * e.r;
  return sigma0;
}

export default {
  id: 'rule_0007',
  name: '전자구름 배제 부피',
  //   kPauli       : 배제 반발 세기(단방향 Hooke 스프링 상수)
  //   evSigma0     : 기본 구름 반경(상수항) / evPerShell : 채워진 껍질 1개당 반경 증가(전자 수→크기)
  //   evChargeShrink: 전하 1단위당 반경 변화(양이온↓·음이온↑ = 이온 반경) / evRfrac : Z 없는 원소의 r→코어 비율
  //   evRMin       : 중심거리 하한(완전 겹침 시 방향 안정용)
  defaults: { kPauli: 0.6, evSigma0: 1.0, evPerShell: 1.4, evChargeShrink: 0.3, evRfrac: 0.6, evRMin: 0.3 },

  // 원소 i 에 작용하는 배제 반발을 누적한다(상태는 안 건드림). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const p = params || {};
    const kPauli = p.kPauli != null ? p.kPauli : 0.6;
    const rMin = p.evRMin != null ? p.evRMin : 0.3;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;

    const sigmaE = cloudRadius(e, p);

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      const sigma = sigmaE + cloudRadius(o, p);          // 두 구름이 닿는 중심거리(접촉)

      // 토러스 최근접 변위 d = o − e (e 에서 o 로) — 3D
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= sigma * sigma) continue;                 // 안 겹침 → 힘 0(단거리)

      const r = Math.sqrt(r2 < rMin * rMin ? rMin * rMin : r2);
      const overlap = sigma - r;                         // 겹친 깊이(>0)
      const f = kPauli * overlap;                        // 단방향 Hooke(보존력=탄성). 깊을수록 강하게 밂.
      // e 를 o 의 반대로(밀어냄): 방향 = −d/r
      e.fx -= f * dx / r; e.fy -= f * dy / r; e.fz -= f * dz / r;
    }
  },
};
