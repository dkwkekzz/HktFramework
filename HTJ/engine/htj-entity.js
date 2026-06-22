// htj-entity.js — HTJ 확장성 레버 2(승격)의 *개체 동역학*: 격자에서 빠진 개체를 *개체-공간에서* 굴린다.
//
//   design/scalability.md §0 목적 ②·§2 레버2·§4 S5 — step_0026(htj-promote)이 안정 덩어리를
//   격자에서 빼내 소수 파라미터 개체로 *환원*했다면(이관 다리), 이 파일은 그 개체를 *법칙으로 굴린다*.
//   비용이 흐르는 유체에만 묶이려면, 빠져나온 개체는 격자 순회 없이 *제 파라미터만으로* 움직여야 한다.
//
//   이 첫 단위(step_0027) = **자유 탄도 운동**: 힘이 없으면 개체는 제 속도(v=P/질량)를 지킨 채 등속
//   직진한다 — 개체판 뉴턴 1법칙. step_0006 의 격자 advect(유체의 탄도 이류)를 *개체-공간*으로 옮긴
//   거울짝이다. 격자는 단 한 칸도 안 돈다 — 위치 몇 개 숫자를 적분할 뿐(O(개체수), 부피와 무관).
//
//   stepEntity(entity, dt, opts): 개체 위치를 속도만큼 전진. v = P/질량. 위치 += v·dt.
//     opts.N 주면 위치를 [0,N) 로 *주기 wrap*(토러스, 경계 손실 0). 질량·운동량 P·각운동량 L·에너지는
//     전부 *불변*(자유 운동은 위치만 바꾼다 → KE_cm=½|P|²/M 도 불변 → 총E 정확 보존). 개체를 변형해 반환.
//   stepEntities(entities, dt, opts): 목록 일괄 전진(편의).
//
//   세계(법칙) 그 자체 — 격자·렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). promote 가 만든
//   개체 descriptor 만 읽고 쓴다. 정직한 한계(이 단위): 힘이 없다(자유 드리프트뿐) — 중력 가속(개체에
//   작용)·각운동량 보존 회전(스핀)·개체끼리 상호작용은 후속 step. 강등(demote)은 *새 위치*에서 일어난다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJEntity = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-12;
  // [0,N) 주기 — 토러스 경계(손실 0). 이미 범위 안이면 그대로(불필요한 부동소수 오차 방지=항등 보존).
  function wrap(v, N) { return (v >= 0 && v < N) ? v : ((v % N) + N) % N; }

  // 개체 한 개를 dt 만큼 자유 전진. 힘 없음 → 속도 v=P/질량 등속 직진. 위치만 변하고 보존량은 불변.
  //   opts.N: 주면 위치를 [0,N) 로 주기 wrap(없으면 자유 공간, wrap 안 함).
  function stepEntity(entity, dt, opts) {
    opts = opts || {};
    const m = entity.mass;
    const vx = m > EPS ? entity.px / m : 0;            // 강체 속도 = 총운동량 / 질량
    const vy = m > EPS ? entity.py / m : 0;
    const vz = m > EPS ? entity.pz / m : 0;
    entity.cx += vx * dt;                              // 위치 적분(등속)
    entity.cy += vy * dt;
    entity.cz += vz * dt;
    if (opts.N != null) {                              // 주기 경계(토러스)
      entity.cx = wrap(entity.cx, opts.N);
      entity.cy = wrap(entity.cy, opts.N);
      entity.cz = wrap(entity.cz, opts.N);
    }
    // 질량·운동량 P·각운동량 L·내부E·총E 는 자유 운동에서 *불변* — 손대지 않는다(위치만 변함).
    return entity;
  }

  // 개체 목록 일괄 전진(편의) — 각 개체를 stepEntity 로.
  function stepEntities(entities, dt, opts) {
    for (let i = 0; i < entities.length; i++) stepEntity(entities[i], dt, opts);
    return entities;
  }

  // 개체간 중력(직접 합산 N-body) — 자유 직진(stepEntity)을 *서로 끌어 휘는 궤적*으로.
  //   step_0007 격자 자기중력(모든 질량이 모든 질량을 끈다)의 *개체-공간* 거울짝. 격자 보간 없이 개체끼리만:
  //   쌍(i,j)마다 F = G·m_i·m_j·(r_j−r_i)/(|r|²+soft²)^{3/2} 를 i 에 +F·j 에 −F(뉴턴 3법칙)로 줘
  //   **순 운동량을 기계 정밀도로 정확 보존**(쌍힘 equal-opposite, 쌍 루프라 구조적으로 상쇄). soft=특이점
  //   완화 길이(r→0 발산 방지). 운동량이 바뀌면 KE_cm·energy(=KE_cm+internalE) 를 재계산(descriptor 자기일관).
  //   opts: { G(기본 1), soft(기본 1) }. (격자↔개체 결합 중력 = S6 통합 트리, 이 단위 밖.)
  function applyEntityGravity(entities, dt, opts) {
    opts = opts || {};
    const G = opts.G != null ? opts.G : 1;
    const soft = opts.soft != null ? opts.soft : 1;
    const s2 = soft * soft, n = entities.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;     // r_j − r_i
      const d2 = dx * dx + dy * dy + dz * dz + s2;
      const f = G * a.mass * b.mass / (d2 * Math.sqrt(d2));           // |F|/dist (softened 1/d³)
      const fx = f * dx * dt, fy = f * dy * dt, fz = f * dz * dt;     // 충격량 = F·dt
      a.px += fx; a.py += fy; a.pz += fz;                             // i 는 j 쪽으로(+F, 인력)
      b.px -= fx; b.py -= fy; b.pz -= fz;                             // j 는 −F(뉴턴 3법칙) → ΣΔp=0 정확
    }
    // 운동량 바뀐 개체의 KE_cm·energy 재계산(descriptor 자기일관: energy=KE_cm+internalE, internalE 불변).
    for (let i = 0; i < n; i++) {
      const e = entities[i];
      if (e.internalE == null) e.internalE = e.energy - (e.KEcm || 0);
      e.KEcm = e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return entities;
  }

  // 개체 쌍 중력 퍼텐셜 에너지(softened, 위 힘과 일관) — 역학 에너지 보존 검증 공유.
  //   U = −Σ_{i<j} G·m_i·m_j / sqrt(|r|²+soft²). (역학E = ΣKE_cm + U 가 유계로 보존되는지 verify 에서 확인.)
  function pairPotentialEnergy(entities, opts) {
    opts = opts || {};
    const G = opts.G != null ? opts.G : 1;
    const soft = opts.soft != null ? opts.soft : 1;
    const s2 = soft * soft, n = entities.length;
    let U = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      U -= G * a.mass * b.mass / Math.sqrt(dx * dx + dy * dy + dz * dz + s2);
    }
    return U;
  }

  // 개체 속도 v=P/질량(편의 — 검증·표시 공유).
  function velocity(entity) {
    const m = entity.mass;
    return m > EPS ? [entity.px / m, entity.py / m, entity.pz / m] : [0, 0, 0];
  }

  return { stepEntity, stepEntities, applyEntityGravity, pairPotentialEnergy, velocity, VERSION: 2 };
});
