// rule_0006 — 금속 결합 (Metallic bonding) : 금속이 비로소 *덩어리 고체*가 된다
//
// 지금까지 물질은 분자·이온쌍 같은 *소규모*까지만 형성됐다. 금속(철·나트륨 등)은 결합 종류가 없어
// rule_0004 가 공유로 *쌍*만 만들었다(틀림 — 금속은 분자가 아니다). 진짜 금속은 원자들이 **원자가
// 전자를 공유 전자바다(delocalized electron sea)에 내놓고**, 양이온 코어들이 그 전자바다에 잠겨
// (embedded) 서로 끌린다. 이 결합은:
//   · **비방향성**(전자바다는 등방) — 분자(방향성 부분전하)와 달리 회전 없이도 응집한다.
//   · **비포화**(이웃이 많을수록 더 깊이 잠김) → 가능한 많은 이웃 = *조밀 充塡 고체*(격자).
//   · **소산적**(전자바다가 상대운동을 흡수 = 전자 산란·포논) → 식어서 바닥상태(고체)로 정착.
//
// 이게 dt=1 적분에서 *안정한 벌크 고체*가 되는 핵심이다: 등방(방향 정렬 불필요) + 소산(에너지 드리프트
// 냉각). 분자(방향성)·이온(같은전하 반발)이 dt=1 에서 응집상을 못 붙잡던 것과 대비된다.
//
// author 안 함: "철·금" 분기 0. 금속 여부는 Z 의 껍질 구조에서 *창발*(`shellState(Z).tendency==='metal'`),
//   결합 세기는 *원자가 전자 수*(공유 전자 수)에서 창발 → Fe(원자가 8)는 Na(원자가 1)보다 단단·치밀.
// 전자기적 본성: 금속 결합도 EM(코어–전자바다–코어)이지만, *비국소(delocalized)* 라 점전하(rule_0003)로
//   표현 못 한다 — 그래서 전자바다를 embedded-atom 식 유효 상호작용으로 둔다(중성 금속은 rule_0003 에
//   안 보이므로 이중계산 아님). 결정론: 현재 위치·속도·Z 만 읽음. Math.random 금지.

import { shellState } from '../rule_0004/rule_0004.js';

// 금속 원자인가 — Z 의 껍질에서 창발(바깥 껍질이 절반 미만 채워짐 → 전자를 내놓는 성향).
const isMetal = e => e.Z != null && shellState(e.Z).tendency === 'metal';
// 공유 전자 수(금속성 세기) — 원자가 전자. 많을수록 전자바다가 짙어 결합이 깊다(Fe 8 > Na 1).
const metallicity = e => (e.Z != null ? shellState(e.Z).valence : 0);
const radius = (m, bondK) => bondK * Math.sqrt(m > 0 ? m : 1);

export default {
  id: 'rule_0006',
  name: '금속 결합',
  //   kMetal : 전자바다 결합 세기(우물 깊이 ε = kMetal·√(원자가ᵢ·원자가ⱼ) → Z 에서 창발)
  //   bondK  : 질량→코어 반경(σ = 두 반경 합, rule_0002/0004 와 같은 척도)
  //   rCutK  : 차단 거리(σ·rCutK 밖이면 무시) / rMinFrac : 코어 하한 / fMax : 힘 상한(적분 안정)
  //   kSink  : 전자바다 소산(상대운동 흡수 → 냉각·고체화). 운동량 보존(상대량만 소산).
  defaults: { kMetal: 1.5, bondK: 2, rCutK: 2.8, rMinFrac: 0.7, fMax: 40, kSink: 0.3 },

  // 금속 원소 i 에 작용하는 금속 결합(전자바다 인력+코어 반발+소산)을 누적한다. 금속끼리만 — 그 외엔 안 보임.
  //   각 원소가 '자기에게 작용하는 힘'을 모든 금속 상대로부터 합산 → i↔j 쌍은 정확히 반대 → 운동량 보존.
  apply(e, i, world, params) {
    if (!isMetal(e)) return;                               // 금속이 아니면 금속 결합 안 함(특성 없음)
    const kMetal = params && params.kMetal != null ? params.kMetal : 1.5;
    const bondK = params && params.bondK != null ? params.bondK : 2;
    const rCutK = params && params.rCutK != null ? params.rCutK : 2.8;
    const rMinFrac = params && params.rMinFrac != null ? params.rMinFrac : 0.7;
    const fMax = params && params.fMax != null ? params.fMax : 40;
    const kSink = params && params.kSink != null ? params.kSink : 0.3;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;
    const Ri = radius(e.m, bondK), vi = metallicity(e);

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      if (!isMetal(o)) continue;                           // 금속 상대하고만 전자바다 공유

      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;

      const sigma = Ri + radius(o.m, bondK);               // 코어 접촉(평형) 척도 = 두 반경 합
      let r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > sigma * rCutK) continue;                     // 차단 거리 밖 → 무시
      const rFloor = sigma * rMinFrac;
      if (r < rFloor) r = rFloor;                          // 코어 발산 방지(하한)
      const ux = dx / r, uy = dy / r, uz = dz / r;         // i→j 단위벡터

      // 전자바다 결합(embedded-atom 식 LJ형): 우물 깊이 ε = kMetal·√(원자가곱)(Z 에서 창발).
      //   멀면 (σ/r)⁶ 인력(전자바다 잠김), 가까우면 −2(σ/r)¹² 코어 반발(양이온 코어).
      const eps = kMetal * Math.sqrt(vi * metallicity(o));
      const sr = sigma / r, s6 = Math.pow(sr, 6), s12 = s6 * s6;
      let F = (24 * eps / r) * (s6 - 2 * s12);
      if (F > fMax) F = fMax; else if (F < -fMax) F = -fMax;
      e.fx += F * ux; e.fy += F * uy; e.fz += F * uz;

      // 소산(전자바다가 상대운동 흡수 = 전자 산란·포논 → 냉각·고체화). 상대속도라 운동량 보존(같이 움직이면 0).
      const wgt = (sigma * sigma) / (r * r);               // 접촉 가중(단거리)
      const dvx = (e.vx || 0) - (o.vx || 0), dvy = (e.vy || 0) - (o.vy || 0), dvz = (e.vz || 0) - (o.vz || 0);
      e.fx -= kSink * wgt * dvx; e.fy -= kSink * wgt * dvy; e.fz -= kSink * wgt * dvz;
    }
  },
};
