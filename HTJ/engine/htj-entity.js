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

  // 구체 합치기(강착) — 닿고 느린 개체들을 더 큰 개체 하나로 합친다(수박/강착·step_0036·SW1).
  //   design/sphere-world.md §6 SW1 — 구체 세계의 첫 벽돌. 두 구체가 *닿고*(CoM 거리 ≤ r_a+r_b+pad)
  //   *느리면*(상대 속도 |v_a−v_b| ≤ vstick) 하나의 큰 구체로 붙는다 — 느리면 붙고 빠르면 안 붙음(임계가
  //   author 안 하고 가른다; 빠르면 깨지는 쪽은 SW3). N 개를 1 개로 줄여 비용↓(N체 중력·충돌) + 창발 물리
  //   (강착=행성 형성). 닿고 느린 쌍을 *연결 성분*으로 묶어 각 성분을 한 개체로 **직접 합산**(순서 무관·결정론).
  //
  //   보존(합산이라 *정확*): 한 성분 g 에 대해 — 질량 Σm · 운동량 ΣP · CoM=질량가중 · 각운동량(원점 기준)
  //     Σ(L_i + r_i×P_i) 불변 · 총E ΣE_i 불변. 합쳐진 개체:
  //       mass=Σm, P=ΣP, CoM=Σm·r/Σm, KEcm=½|P|²/M,
  //       internalE = ΣE_i − KEcm  (비탄성 강착: 잃은 CoM 운동E 가 *열*로 → internalE ≥ Σinternal_i·항상 데워짐),
  //       energy = KEcm + internalE = ΣE_i  (정확),
  //       L_intrinsic = ΣL_i + Σ(r_i−CoM)×P_i  (궤도 각운동량 → 합쳐진 구체의 *스핀*; 원점 기준 총 L 불변),
  //       radius = 등가 구(Σcells), cells=Σcells.
  //   opts: { vstick(상대 속도 임계, 기본 0.5·시뮬 상수), pad(닿음 여유, 기본 0.5) }.
  //   반환: { entities: 새 목록(합쳐진 것 + 안 닿은 것), merges: 합쳐진 성분 수 }. 입력은 변형하지 않는다.
  const FOURPI_3 = 4 * Math.PI / 3;
  function equivalentRadius(n) { return Math.cbrt(n / FOURPI_3); }

  function mergeGroup(entities, g) {
    let mass = 0, cx = 0, cy = 0, cz = 0, Px = 0, Py = 0, Pz = 0;
    let energySum = 0, cells = 0, peak = 0, sumKEcm = 0, sumIntKE = 0;
    for (const idx of g) {
      const e = entities[idx];
      mass += e.mass; cx += e.mass * e.cx; cy += e.mass * e.cy; cz += e.mass * e.cz;
      Px += e.px; Py += e.py; Pz += e.pz;
      energySum += (e.energy != null ? e.energy : 0);
      cells += (e.cells || 1);
      sumKEcm += (e.KEcm != null ? e.KEcm : (e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0));
      sumIntKE += (e.internalKE || 0);
      if ((e.peak || 0) > peak) peak = e.peak || 0;
    }
    cx = mass > EPS ? cx / mass : 0; cy = mass > EPS ? cy / mass : 0; cz = mass > EPS ? cz / mass : 0;
    // 각운동량 L_intrinsic = Σ L_i + Σ (r_i−CoM)×P_i (궤도 L → 합쳐진 구체 스핀). 원점 기준 총 L 불변.
    let Lx = 0, Ly = 0, Lz = 0;
    for (const idx of g) {
      const e = entities[idx];
      Lx += (e.Lx || 0); Ly += (e.Ly || 0); Lz += (e.Lz || 0);
      const rx = e.cx - cx, ry = e.cy - cy, rz = e.cz - cz;
      Lx += ry * e.pz - rz * e.py; Ly += rz * e.px - rx * e.pz; Lz += rx * e.py - ry * e.px;
    }
    const KEcm = mass > EPS ? 0.5 * (Px * Px + Py * Py + Pz * Pz) / mass : 0;
    const internalE = energySum - KEcm;            // 비탄성 강착열(≥0: KEcm≤ΣKEcm_i≤ΣE_i)
    const internalKE = sumIntKE + (sumKEcm - KEcm); // 강체화된 상대 운동(열로)
    const energy = KEcm + internalE;               // = energySum (정확 보존)
    return {
      cx, cy, cz, mass, px: Px, py: Py, pz: Pz, Lx, Ly, Lz,
      KEcm, internalKE, internalE, energy,
      cells, radius: equivalentRadius(cells),
      temp: mass > EPS ? internalE / mass : 0, peak
    };
  }

  function mergeEntities(entities, opts) {
    opts = opts || {};
    const vstick = opts.vstick != null ? opts.vstick : 0.5;
    const pad = opts.pad != null ? opts.pad : 0.5;
    const n = entities.length;
    if (n < 2) return { entities: entities.slice(), merges: 0 };
    // union-find — 닿고 느린 쌍을 연결 성분으로(root=성분 최소 인덱스 → 결정론).
    const parent = new Array(n); for (let i = 0; i < n; i++) parent[i] = i;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra === rb) return; if (ra < rb) parent[rb] = ra; else parent[ra] = rb; }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > a.radius + b.radius + pad) continue;          // 안 닿음
      const ma = a.mass > EPS ? a.mass : 1, mb = b.mass > EPS ? b.mass : 1;
      const rvx = b.px / mb - a.px / ma, rvy = b.py / mb - a.py / ma, rvz = b.pz / mb - a.pz / ma;
      if (Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz) > vstick) continue;  // 너무 빠름 → 안 붙음(SW3 가 깸)
      union(i, j);
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
    const roots = Array.from(groups.keys()).sort((a, b) => a - b);  // 최소 인덱스 순 = 결정론
    const out = []; let merges = 0;
    for (const r of roots) {
      const g = groups.get(r);
      if (g.length === 1) { out.push(entities[g[0]]); continue; }
      out.push(mergeGroup(entities, g)); merges++;
    }
    return { entities: out, merges };
  }

  // 개체 접촉(반발 + 소산) — 겹친 구체를 밀어내고(반발=Hooke 쌍힘) 접촉 상대 운동을 감쇠(소산→열·비가역).
  //   design/sphere-world.md §6 SW2(DEM) — 합치기(SW1)가 *닿고 느린* 구체를 하나로 붙였다면, 이건 *겹친*
  //   구체가 합쳐지지 않고 **서로를 떠받치게** 한다 — "쌓이고·표면이 서고·선다"의 접촉 쪽("선 캐릭터 =
  //   중력↓ + 접촉 반발↑ 균형"). 두 힘:
  //     ① 반발(Hooke 보존 쌍힘): 겹침 overlap=(r_a+r_b)−d > 0 이면 F=k·overlap 를 법선(a↔b)으로 밀어냄.
  //        a 는 −n̂·b 는 +n̂ 로 equal-opposite → **순 운동량 정확 보존**(step_0028 중력 쌍힘과 동형). 보존력
  //        → 탄성 PE U=½k·overlap²(contactPotentialEnergy)에 저장, 정착(평형 overlap*)에서 중력과 균형.
  //     ② 감쇠(법선 소산): 접촉 상대 법선 속도 v_n 을 감쇠(J=−c·v_n·dt, equal-opposite=운동량 보존).
  //        잃은 운동E 를 *정확 회계*(감쇠 충격량 전후 KE 차)해 두 개체 internalE 로 → **비가역 소산**(엔트로피↑·
  //        step_0011 점성의 구체-접촉 판). 반발만이면 영원히 튕기지만(탄성), 감쇠가 있어야 *멈춘다*.
  //   에너지 정합: 총E = Σenergy_i + U_contact 가 보존(반발은 KEcm↔U_contact 가역·감쇠는 KEcm→internalE 비가역).
  //   opts: { k(반발 강성, 기본 0 → 접촉 없음·early-return=회귀 0), cDamp(법선 감쇠, 기본 0) }.
  //   가법: 노브 0 이면 즉시 반환(기존 거동 불변). 입력 개체를 제자리 변형해 반환.
  function applyEntityContact(entities, dt, opts) {
    opts = opts || {};
    const k = opts.k != null ? opts.k : 0;
    const c = opts.cDamp != null ? opts.cDamp : 0;
    const n = entities.length;
    if (n < 2 || (k === 0 && c === 0)) return entities;       // 노브=0 → early-return(회귀 0)
    // internalE 자기일관 보장(descriptor 에 없으면 energy−KEcm 으로 채움).
    for (let i = 0; i < n; i++) {
      const e = entities[i];
      if (e.internalE == null) {
        const ke = e.KEcm != null ? e.KEcm : (e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0);
        e.internalE = (e.energy != null ? e.energy : ke) - ke;
      }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;     // a→b
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const overlap = (a.radius + b.radius) - d;
      if (overlap <= 0 || d < EPS) continue;                          // 안 겹침·동일 위치(방향 불정) → 접촉 없음
      const nx = dx / d, ny = dy / d, nz = dz / d;                    // 법선 단위(a→b)
      const ma = a.mass > EPS ? a.mass : 1, mb = b.mass > EPS ? b.mass : 1;
      // ① 반발(Hooke 보존 쌍힘) — a 는 −n̂(밀려남)·b 는 +n̂ → ΣΔp=0 정확.
      if (k !== 0) {
        const jr = k * overlap * dt;                                  // 충격량 크기 = F·dt
        a.px -= jr * nx; a.py -= jr * ny; a.pz -= jr * nz;
        b.px += jr * nx; b.py += jr * ny; b.pz += jr * nz;
      }
      // ② 감쇠(법선 소산 → 열) — 정확 KE 회계로 비가역 dissipation 을 internalE 에 적립.
      if (c !== 0) {
        const KEa0 = 0.5 * (a.px * a.px + a.py * a.py + a.pz * a.pz) / ma;
        const KEb0 = 0.5 * (b.px * b.px + b.py * b.py + b.pz * b.pz) / mb;
        const vn = (b.px / mb - a.px / ma) * nx + (b.py / mb - a.py / ma) * ny + (b.pz / mb - a.pz / ma) * nz;
        // 임계 감쇠 클램프: 상대 법선 속도를 *0 까지만* 없앤다(역전 금지). Δv_n = J/μ 이므로 v_n→0 의 임펄스는
        //   J_zero = −μ·v_n. |J| 가 이를 넘으면(c·dt > μ) 상대 운동이 역전·증폭돼 KE 가 *늘어*(dissip<0·에너지 주입·
        //   internalE 음수)나므로, 넘지 않게 자른다 → dissip ≥ 0·internalE 단조↑ 보장(비가역 소산이 항상 참).
        const mu = (ma * mb) / (ma + mb);
        let J = -c * vn * dt;                                         // 상대 법선 운동 반대(소산) — equal-opposite
        const Jzero = -mu * vn;                                       // v_n→0 임펄스(같은 부호)
        if (Math.abs(J) > Math.abs(Jzero)) J = Jzero;                 // 임계 초과 → 0 까지만(역전 방지)
        b.px += J * nx; b.py += J * ny; b.pz += J * nz;
        a.px -= J * nx; a.py -= J * ny; a.pz -= J * nz;
        const KEa1 = 0.5 * (a.px * a.px + a.py * a.py + a.pz * a.pz) / ma;
        const KEb1 = 0.5 * (b.px * b.px + b.py * b.py + b.pz * b.pz) / mb;
        const dissip = (KEa0 + KEb0) - (KEa1 + KEb1);                 // 잃은 KE(클램프로 항상 ≥0) → 열로
        a.internalE += 0.5 * dissip; b.internalE += 0.5 * dissip;    // 두 개체 반씩(비가역)
      }
    }
    // KEcm·energy 재계산(자기일관: energy = KEcm + internalE).
    for (let i = 0; i < n; i++) {
      const e = entities[i];
      e.KEcm = e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return entities;
  }

  // 접촉 탄성 퍼텐셜 에너지 U = Σ_{i<j} ½·k·overlap²(겹친 쌍만) — 반발 힘과 일관(F=−dU/d(overlap)).
  //   역학E 보존 검증 공유: 총E = Σenergy_i + U_contact 가 보존(반발은 KEcm↔U 가역). pairPotentialEnergy 의 접촉 판.
  function contactPotentialEnergy(entities, opts) {
    opts = opts || {};
    const k = opts.k != null ? opts.k : 0;
    if (k === 0) return 0;
    const n = entities.length;
    let U = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      const overlap = (a.radius + b.radius) - Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (overlap > 0) U += 0.5 * k * overlap * overlap;
    }
    return U;
  }

  // 접촉 마찰(접선 저항 + 구름) — 접촉(0037)의 *법선* 반발/감쇠가 못 막는 **접선 방향 상대 운동**에 저항.
  //   design/environment.md §3 TW1 "딛는 표면엔 마찰이 필요" — 0056 이 드러낸 격차(마찰 없는 법선 접촉이라
  //   경사면서 못 서고 골로 미끄러짐)를 메운다. Coulomb 마찰: 접선력 |F_t| ≤ μ·F_n (F_n=k·overlap=반발력).
  //   미끄럼이 크면 동마찰(점성 cTan·|v_t|, μ·F_n 상한)로 *KE→열* 소산, 작으면 접선 운동을 0 까지만 잡아(역전
  //   금지) *정지 마찰* 근사 → 경사면에 *선다/그립*.
  //   **올바른 마찰은 접촉점에 작용해 스핀(구름)으로 각운동량을 넘긴다**(중심 접선력은 각운동량을 깬다):
  //     · 단일 접촉점 p_c = 겹침 구간 중점 → 두 개체의 지렛대(ra_vec=p_c−r_a·rb_vec=p_c−r_b)가 같은 점 →
  //       임펄스를 p·L(스핀) 양쪽에 주면 ΔL_total = p_c×(J_a+J_b) = p_c×0 = 0 (각운동량 *정확* 보존).
  //     · 표면 접선 상대속도(스핀 ω=L/I 포함, I=⅖m r²)를 줄인다 → 미끄럼 멈추고 구른다.
  //   에너지: 잃은 *병진* KE 를 internalE 로 적립(merge 규약 계승 — 스핀 KE 도 internalE 에 lump, energy=KEcm+
  //   internalE 정확 보존). 운동량=equal-opposite 쌍힘 정확 보존. J ≤ J_stop(접선 운동 0 임펄스) → 소산≥0.
  //   opts: { k(반발 강성=F_n 계산용), mu(Coulomb 계수, 기본 0 → early-return=회귀 0), cTan(접선 점성, 기본 mu*k) }.
  //   가법: mu=0 이면 즉시 반환(0037 거동 불변). 입력 개체를 제자리 변형해 반환.
  function applyEntityFriction(entities, dt, opts) {
    opts = opts || {};
    const k = opts.k != null ? opts.k : 0;
    const mu = opts.mu != null ? opts.mu : 0;
    const cTan = opts.cTan != null ? opts.cTan : mu * k;
    const n = entities.length;
    if (n < 2 || mu === 0 || k === 0) return entities;          // 노브=0 → early-return(회귀 0)
    for (let i = 0; i < n; i++) {                               // internalE 자기일관(없으면 채움)
      const e = entities[i];
      if (e.internalE == null) {
        const ke = e.KEcm != null ? e.KEcm : (e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0);
        e.internalE = (e.energy != null ? e.energy : ke) - ke;
      }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const overlap = (a.radius + b.radius) - d;
      if (overlap <= 0 || d < EPS) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d;               // 법선 단위(a→b)
      const ma = a.mass > EPS ? a.mass : 1, mb = b.mass > EPS ? b.mass : 1;
      const Ia = 0.4 * ma * a.radius * a.radius, Ib = 0.4 * mb * b.radius * b.radius;  // 구체 관성 ⅖mr²
      // 단일 접촉점 지렛대(겹침 중점) — 양 개체 같은 점 → 각운동량 정확 보존.
      const la = a.radius - overlap / 2, lb = -(b.radius - overlap / 2);  // ra_vec=la·n̂·rb_vec=lb·n̂
      // 각속도 ω = L / I.
      const wax = (a.Lx || 0) / Ia, way = (a.Ly || 0) / Ia, waz = (a.Lz || 0) / Ia;
      const wbx = (b.Lx || 0) / Ib, wby = (b.Ly || 0) / Ib, wbz = (b.Lz || 0) / Ib;
      // 접촉점 표면 속도 = v_cm + ω×r_vec. r_vec_a = la·n̂, r_vec_b = lb·n̂.
      const vax = a.px / ma + (way * (la * nz) - waz * (la * ny));
      const vay = a.py / ma + (waz * (la * nx) - wax * (la * nz));
      const vaz = a.pz / ma + (wax * (la * ny) - way * (la * nx));
      const vbx = b.px / mb + (wby * (lb * nz) - wbz * (lb * ny));
      const vby = b.py / mb + (wbz * (lb * nx) - wbx * (lb * nz));
      const vbz = b.pz / mb + (wbx * (lb * ny) - wby * (lb * nx));
      // 상대 표면 속도(b−a) → 접선 성분(법선 제거).
      let rvx = vbx - vax, rvy = vby - vay, rvz = vbz - vaz;
      const rvn = rvx * nx + rvy * ny + rvz * nz;
      let tx = rvx - rvn * nx, ty = rvy - rvn * ny, tz = rvz - rvn * nz;
      const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (vt < EPS) continue;
      tx /= vt; ty /= vt; tz /= vt;                              // 접선 단위 t̂
      const Fn = k * overlap;
      // 접선 유효 질량⁻¹ = 1/ma + 1/mb + |la·n̂×t̂|²/Ia + |lb·n̂×t̂|²/Ib (n̂⊥t̂ → |n̂×t̂|=1).
      const mEffInv = 1 / ma + 1 / mb + (la * la) / Ia + (lb * lb) / Ib;
      const Jstop = vt / mEffInv;                                // 접선 상대 운동 0 임펄스
      let J = Math.min(cTan * vt * dt, mu * Fn * dt, Jstop);     // 점성 vs Coulomb 상한 vs 정지(역전 금지)
      // 임펄스 Jt = J·t̂ — b 는 −Jt·a 는 +Jt(equal-opposite=운동량 보존). 전후 *병진* KE 차 → internalE.
      const KEt0 = 0.5 * (a.px * a.px + a.py * a.py + a.pz * a.pz) / ma + 0.5 * (b.px * b.px + b.py * b.py + b.pz * b.pz) / mb;
      const Jx = J * tx, Jy = J * ty, Jz = J * tz;
      a.px += Jx; a.py += Jy; a.pz += Jz;
      b.px -= Jx; b.py -= Jy; b.pz -= Jz;
      // 스핀: 접촉점 임펄스의 토크 ΔL = r_vec × J_impulse. a: (la·n̂)×(+Jt)·b: (lb·n̂)×(−Jt).
      a.Lx = (a.Lx || 0) + (la * ny) * Jz - (la * nz) * Jy;
      a.Ly = (a.Ly || 0) + (la * nz) * Jx - (la * nx) * Jz;
      a.Lz = (a.Lz || 0) + (la * nx) * Jy - (la * ny) * Jx;
      b.Lx = (b.Lx || 0) - ((lb * ny) * Jz - (lb * nz) * Jy);
      b.Ly = (b.Ly || 0) - ((lb * nz) * Jx - (lb * nx) * Jz);
      b.Lz = (b.Lz || 0) - ((lb * nx) * Jy - (lb * ny) * Jx);
      const KEt1 = 0.5 * (a.px * a.px + a.py * a.py + a.pz * a.pz) / ma + 0.5 * (b.px * b.px + b.py * b.py + b.pz * b.pz) / mb;
      const dissip = KEt0 - KEt1;                                // 잃은 병진 KE(스핀+열) → internalE(merge 규약)
      a.internalE += 0.5 * dissip; b.internalE += 0.5 * dissip;
    }
    for (let i = 0; i < n; i++) {                                // KEcm·energy 재계산(자기일관)
      const e = entities[i];
      e.KEcm = e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return entities;
  }

  // 구름 저항(rolling resistance) — 마찰(0057)이 *미끄럼*을 막아도 구체는 자유로이 *굴러* 비탈을 데굴데굴 흘러내려
  //   안식각이 완만해진다(평평한 더미). 구름 저항은 그 *구름 자체*에 저항해 굴러가다 멈추게 한다 → **가파른 안식각**
  //   (진짜 산·언덕 더미). design/environment.md §3 TW1 — 0057 이 "구름 저항 없음"으로 남긴 한계를 메운다.
  //   겹친 쌍의 **상대 구름 각속도** ω_rel = ω_a − ω_b (ω=L/I, I=⅖mr²) 에 반대하는 *토크 쌍*(a 에 −M·b 에 +M):
  //     · 토크 쌍이라 순 각운동량 변화 0 → **총 각운동량 정확 보존**(스핀끼리 주고받음)·운동량은 안 건드림(순수 토크).
  //     · 크기 J = min(cRoll·|ω_rel|·dt, μ_r·R_eff·F_n·dt, J_stop) — 점성 vs Coulomb 상한(μ_r·R_eff·F_n) vs 정지
  //       (ω_rel→0 임펄스 J_stop=|ω_rel|/(1/I_a+1/I_b), 역전 금지). F_n=k·overlap, R_eff=조화평균 반경.
  //   에너지: 스핀 KE 는 internalE 에 lump 되어 있다(0057·merge 규약) — 구름이 줄면 그 스핀 KE 가 열로 바뀌므로
  //   internalE·KEcm 둘 다 손대지 않는다 → 총E(=KEcm+internalE) 정확 보존(스핀 KE 감소는 internalE 내부 재분류).
  //   opts: { k(반발 강성=F_n), muRoll(Coulomb 구름 계수, 기본 0 → early-return=회귀0), cRoll(점성, 기본 0.5) }.
  //   가법: muRoll=0 이면 즉시 반환(0057 거동 불변). 입력 개체를 제자리 변형해 반환.
  function applyEntityRollingResistance(entities, dt, opts) {
    opts = opts || {};
    const k = opts.k != null ? opts.k : 0;
    const muRoll = opts.muRoll != null ? opts.muRoll : 0;
    const cRoll = opts.cRoll != null ? opts.cRoll : 0.5;
    const n = entities.length;
    if (n < 2 || muRoll === 0 || k === 0) return entities;       // 노브=0 → early-return(회귀 0)
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const overlap = (a.radius + b.radius) - d;
      if (overlap <= 0 || d < EPS) continue;
      const ma = a.mass > EPS ? a.mass : 1, mb = b.mass > EPS ? b.mass : 1;
      const Ia = 0.4 * ma * a.radius * a.radius, Ib = 0.4 * mb * b.radius * b.radius;
      // 상대 구름 각속도 ω_rel = ω_a − ω_b.
      const wx = (a.Lx || 0) / Ia - (b.Lx || 0) / Ib;
      const wy = (a.Ly || 0) / Ia - (b.Ly || 0) / Ib;
      const wz = (a.Lz || 0) / Ia - (b.Lz || 0) / Ib;
      const wm = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (wm < EPS) continue;
      const Fn = k * overlap, Reff = 2 * a.radius * b.radius / (a.radius + b.radius);
      const Jstop = wm / (1 / Ia + 1 / Ib);                      // ω_rel→0 임펄스(역전 금지)
      const J = Math.min(cRoll * wm * dt, muRoll * Reff * Fn * dt, Jstop);
      const ux = wx / wm, uy = wy / wm, uz = wz / wm;
      // 토크 쌍: a 의 스핀 감소·b 증가 → ω_rel↓·ΣL_spin 불변(총 각운동량 보존).
      a.Lx = (a.Lx || 0) - J * ux; a.Ly = (a.Ly || 0) - J * uy; a.Lz = (a.Lz || 0) - J * uz;
      b.Lx = (b.Lx || 0) + J * ux; b.Ly = (b.Ly || 0) + J * uy; b.Lz = (b.Lz || 0) + J * uz;
    }
    return entities;                                            // 운동량·internalE·KEcm 불변 → energy 그대로
  }

  // 구체 쪼개기(파편화) — 한 구체를 n 조각으로 터뜨린다(mergeGroup 의 역·step_0038·SW3).
  //   design/sphere-world.md §6 SW3 — 합치기(SW1)의 *거울*: 강한 충돌/외란으로 임계를 넘은 구체가 작은
  //   구체들로 깨진다. mergeGroup 의 보존 합산을 *역으로* — 부모 1 개를 n 조각으로 나누되 질량·운동량·
  //   각운동량(원점 기준)·총E 를 *정확* 보존(Σ조각 = 부모). 분산(폭발)에 쓰는 운동E 는 부모 internalE
  //   (결합/열)에서 꺼낸다 — merge 의 "잃은 CoM KE → 열" 의 역인 "결합열 → 조각 분산 KE"(internalE↔KEcm 재분배).
  //
  //   조각 배치(대칭 → 보존 정확): n 조각을 CoM 둘레 평면 고리(각 2πk/n)에 등질량·등셀로 놓고 반경 방향
  //   폭발 속도 s·û_k 를 준다. Σû_k=0(고리) → 순 운동량 부모와 같음(질량가중 평균차감으로 기계정밀도 강제·0007
  //   거울). 각운동량: 부모 intrinsic 스핀 L 을 조각마다 L/n 씩 나눠 줌 + 대칭 배치라 궤도 L=0 → 원점 기준 총 L
  //   정확 보존. 에너지: KE_explosion=½M·s²=dispersalFrac·internalE → 조각 internalE=(1−dispersalFrac)·internalE/n,
  //   ΣE = KEcm_parent + internalE_parent = E_parent(정확).
  //   opts: { n(조각 수, 기본 4), dispersalFrac(분산에 쓸 internalE 비율, 기본 0.5), spread(배치 반경 배수, 기본 1) }.
  //   반환: 조각 배열(n<2 면 [entity] 그대로). 입력은 변형하지 않는다.
  function fragmentEntity(entity, opts) {
    opts = opts || {};
    const n = Math.max(1, Math.floor(opts.n != null ? opts.n : 4));
    if (n < 2) return [entity];
    const df = Math.max(0, Math.min(1, opts.dispersalFrac != null ? opts.dispersalFrac : 0.5));
    const M = entity.mass;
    const vcx = M > EPS ? entity.px / M : 0, vcy = M > EPS ? entity.py / M : 0, vcz = M > EPS ? entity.pz / M : 0;
    const internalE = entity.internalE != null ? entity.internalE : ((entity.energy || 0) - (entity.KEcm || 0));
    const m = M / n, cells = (entity.cells || n) / n, radius = equivalentRadius(Math.max(1e-9, cells));
    const d = (opts.spread != null ? opts.spread : 1) * (entity.radius || radius);
    const KE_explosion = df * Math.max(0, internalE);
    const s = M > EPS ? Math.sqrt(2 * KE_explosion / M) : 0;     // ½M·s² = KE_explosion
    const intEach = (internalE - KE_explosion) / n;             // 남은 결합열 균등 분배(≥0: df≤1)
    const Lx = (entity.Lx || 0) / n, Ly = (entity.Ly || 0) / n, Lz = (entity.Lz || 0) / n;  // intrinsic 스핀 균등 분배
    // 조각 속도(폭발) 만들고, 질량가중 평균을 v_cm 에 맞춰 빼 ΣP 를 부모와 *정확* 일치(0007 평균차감).
    const dirs = [], vel = []; let mvx = 0, mvy = 0, mvz = 0;
    for (let k = 0; k < n; k++) {
      const th = 2 * Math.PI * k / n, ux = Math.cos(th), uy = Math.sin(th), uz = 0;
      const vx = vcx + s * ux, vy = vcy + s * uy, vz = vcz + s * uz;
      dirs.push([ux, uy, uz]); vel.push([vx, vy, vz]); mvx += vx; mvy += vy; mvz += vz;
    }
    const ox = mvx / n - vcx, oy = mvy / n - vcy, oz = mvz / n - vcz;   // 평균 − v_cm = 보정 오프셋(Σû_k≠0 의 FP)
    const out = [];
    for (let k = 0; k < n; k++) {
      const ux = dirs[k][0], uy = dirs[k][1], uz = dirs[k][2];
      const vx = vel[k][0] - ox, vy = vel[k][1] - oy, vz = vel[k][2] - oz;   // ΣP 정확 보정
      const px = m * vx, py = m * vy, pz = m * vz;
      const KEcm = m > EPS ? 0.5 * (px * px + py * py + pz * pz) / m : 0;
      out.push({
        cx: entity.cx + ux * d, cy: entity.cy + uy * d, cz: entity.cz + uz * d,
        mass: m, px, py, pz, Lx, Ly, Lz,
        KEcm, internalKE: (entity.internalKE || 0) / n, internalE: intEach, energy: KEcm + intEach,
        cells, radius, temp: m > EPS ? intEach / m : 0, peak: entity.peak || 1
      });
    }
    return out;
  }

  // 충돌 임계 쪼개기(자기-트리거) — 닿고 *빠른* 쌍을 파편화(mergeEntities 의 거울: 느림→합침·빠름→깨짐).
  //   design/sphere-world.md §6 SW3 — 합치기↔쪼개기 왕복. 접촉(거리 ≤ r_a+r_b+pad)한 쌍의 상대 운동E
  //   ½·μ·|v_a−v_b|² 가 결합E 임계(shatterKE·시뮬 상수) 이상이면 두 구체를 fragmentEntity 로 깬다(임계가 가른다).
  //   각 fragmentEntity 가 *제* 보존량을 정확 보존 → 쌍 총량도 정확 보존(합의 합). μ=reduced mass.
  //   opts: { shatterKE(임계 상대 운동E·기본 1), n, dispersalFrac, spread, pad(닿음 여유·기본 0.5) }.
  //   반환: { entities, shatters }. 입력은 변형하지 않는다.
  function fragmentOnImpact(entities, opts) {
    opts = opts || {};
    const shatterKE = opts.shatterKE != null ? opts.shatterKE : 1;
    const pad = opts.pad != null ? opts.pad : 0.5;
    const n = entities.length;
    if (n < 2) return { entities: entities.slice(), shatters: 0 };
    const mark = new Array(n).fill(false);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = entities[i], b = entities[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > a.radius + b.radius + pad) continue;   // 안 닿음
      const ma = a.mass > EPS ? a.mass : 1, mb = b.mass > EPS ? b.mass : 1;
      const rvx = b.px / mb - a.px / ma, rvy = b.py / mb - a.py / ma, rvz = b.pz / mb - a.pz / ma;
      const mu = (ma * mb) / (ma + mb);
      if (0.5 * mu * (rvx * rvx + rvy * rvy + rvz * rvz) >= shatterKE) { mark[i] = true; mark[j] = true; }  // 빠르면 깨짐
    }
    const out = []; let shatters = 0;
    for (let i = 0; i < n; i++) {
      if (mark[i]) { const frags = fragmentEntity(entities[i], opts); for (const f of frags) out.push(f); shatters++; }
      else out.push(entities[i]);
    }
    return { entities: out, shatters };
  }

  // 적응 LOD (관찰자 거리 기반 합치기/쪼개기) — 멀면 합치고(coarse)·가까이서 쪼갠다(fine)·step_0039·SW4.
  //   design/sphere-world.md §6 SW4 / §4. 0034 공간 LOD(htj-lod downsample/upsample)의 *Lagrangian* 판:
  //   격자 블록을 평균내는 대신, *구체*를 관찰자 거리에 따라 합치고 쪼갠다. 트리거만 바뀐다 — SW1(합치기·
  //   mergeGroup)·SW3(쪼개기·fragmentEntity)의 보존 합산/분배를 *물리 임계*(속도·충돌E) 대신 **거리 임계**로
  //   재사용한다(보존은 그대로라 벌크 정확). 두 방향:
  //     ① coarsen(먼 곳→합침): 관찰자서 먼(near 밖) 구체를 *블록 버킷*으로 묶어 블록당 1 개 coarse 구체로 합산
  //        (mergeGroup). occupied far block 1 개 = 1 노드 → 먼 구체를 아무리 늘려도 비용이 *블록 수*에 묶인다.
  //     ② refine(가까운 곳→쪼갬): near 안의 coarse 구체(lodMembers>1)를 그 구성원 수 만큼 fine 조각으로 되쪼갬
  //        (fragmentEntity, dispersalFrac=0 → 폭발 없이 v_cm 공유·벌크 정확). 가까이서 디테일 복원.
  //   **비용이 세계 크기가 아니라 관찰되는 디테일에 묶인다**(scalability.md 레버3 의 Lagrangian 판). 세계를 키워
  //   (먼 구체를 더 늘려)도 near 예산(fine 개체)+occupied far block 수는 일정 → effective 개체 수 평탄.
  //   벌크(질량·운동량·각운동량(원점)·총E)는 합산/분배가 정확하므로 coarsen·refine·왕복 모두 *정확 보존*.
  //   모양은 손실(LOD 근사·design §5 난점 1) — coarse 는 내부 배열을 잃고, refine 은 평면 고리로 *근사 복원*.
  //   opts: { observer:[x,y,z], blockSize(bs>0), nearRadius(관찰자 거리 ≤ 이 값=near·world 단위), spread } —
  //     observer 없거나 bs≤0 이면 early-return(아무 호출처도 없으니 회귀 0). lodMembers 는 구성원 수(기본 1).
  //   반환: { entities(새 목록·= effective 개체 수), coarsened(합친 far 블록 수), refined(되쪼갠 near coarse 수) }.
  //   입력은 변형하지 않는다(합쳐진/쪼개진 건 새 descriptor).
  function adaptLOD(entities, opts) {
    opts = opts || {};
    const obs = opts.observer, bs = opts.blockSize != null ? opts.blockSize : 0;
    if (!obs || bs <= 0) return { entities: entities.slice(), coarsened: 0, refined: 0 };  // 노브 없음 → 회귀 0
    const nearR2 = (opts.nearRadius != null ? opts.nearRadius : 0) ** 2;
    const n = entities.length;
    // near/far 분류 — near 는 그대로/refine 대상, far 는 블록 버킷으로 묶어 coarsen.
    const farBuckets = new Map(); const nearIdx = [];
    for (let i = 0; i < n; i++) {
      const e = entities[i];
      const dx = e.cx - obs[0], dy = e.cy - obs[1], dz = e.cz - obs[2];
      if (dx * dx + dy * dy + dz * dz <= nearR2) { nearIdx.push(i); continue; }
      const key = Math.floor(e.cx / bs) + ',' + Math.floor(e.cy / bs) + ',' + Math.floor(e.cz / bs);
      if (!farBuckets.has(key)) farBuckets.set(key, []);
      farBuckets.get(key).push(i);
    }
    const out = []; let coarsened = 0, refined = 0;
    // ① coarsen — 블록당 2+ 면 합침(블록 키 정렬 = 결정론). 단일은 그대로(이미 최소).
    for (const key of Array.from(farBuckets.keys()).sort()) {
      const g = farBuckets.get(key);
      if (g.length === 1) { out.push(entities[g[0]]); continue; }
      const merged = mergeGroup(entities, g);
      merged.lodMembers = g.reduce((s, idx) => s + (entities[idx].lodMembers || 1), 0);  // 되쪼갤 fine 수
      out.push(merged); coarsened++;
    }
    // ② refine — near 의 coarse 구체(구성원>1)를 그 수 만큼 fine 으로(폭발 없이 = dispersalFrac 0).
    for (const idx of nearIdx) {
      const e = entities[idx], members = e.lodMembers || 1;
      if (members > 1) {
        const frags = fragmentEntity(e, { n: members, dispersalFrac: 0, spread: opts.spread });
        for (const f of frags) { f.lodMembers = 1; out.push(f); }
        refined++;
      } else out.push(e);
    }
    return { entities: out, coarsened, refined };
  }

  return { stepEntity, stepEntities, applyEntityGravity, pairPotentialEnergy, velocity, mergeEntities, equivalentRadius, applyEntityContact, contactPotentialEnergy, applyEntityFriction, applyEntityRollingResistance, fragmentEntity, fragmentOnImpact, adaptLOD, VERSION: 8 };
});
