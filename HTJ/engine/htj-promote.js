// htj-promote.js — HTJ 확장성 레버 2(승격)의 *이관 다리*: 안정 덩어리를 격자에서 빼내 개체로, 그리고 되돌린다.
//
//   design/scalability.md §0 목적 ②·§2 레버2·§4 S5 — 확장성의 *질적 도약*. step_0014 검출(읽기 전용)이
//   덩어리를 *개체로 환원해 보여줬다면*, 승격은 그 덩어리를 *격자에서 실제로 빼내* 비용을 흐르는 유체에만
//   묶는다. step_0024(진공 동반 수송 보존)·step_0025(동결=안정 판정)가 그 부품을 갖췄다 — 이 step 은 그
//   부품을 잇는 **이관 다리**다: 격자 셀 ↔ 소수 파라미터 개체를, **질량·운동량·에너지를 정확히 보존**하며.
//
//   promote(world, cells): 덩어리 셀들을 읽어 개체로 환원하고 *그 셀들을 격자에서 0 으로 비운다*.
//     개체 = { 중심 CoM · 질량 Σρ · 총운동량 P=Σg · 각운동량 L=Σ(r−CoM)×g · 총에너지 E=Σ(½|g|²/ρ + u)
//              · 내부에너지 internalE=Σu+(KE_total−KE_cm) · 반지름(등가 구) · 온도 · 셀수 }
//   demote(world, entity): 개체를 CoM 둘레 *균일 구*로 격자에 되돌린다 — 질량/운동량/에너지를 정확히 복원.
//
//   보존(S5 관문 = design §4): 승격↔강등에서 **질량·운동량·에너지 정확 이관**(상대 ≤1e-12).
//     · 질량 Σρ, 운동량 Σg 는 합이 그대로 개체로/격자로 옮겨가 정확 보존.
//     · 에너지: 덩어리를 강체로 굳히면 *내부 운동*(셀별 속도 차)이 사라진다 → 그 운동E 를 *열로 전환*해
//       internalE 에 담는다(물리적 강체화: 내부 유동→열). 총E=KE_cm+internalE 는 정확 보존(KE 일부가 u 로).
//   정직한 한계(이 첫 단위): demote 는 *균일 속도* 구라 **각운동량(스핀)을 복원 안 한다**(균일 구 L=0).
//     각운동량은 개체에 *기록*만 하고(강체 회전 동역학=다음 step), 회전이 작은(L≈0) 대칭 덩어리에선 무해.
//     강체 *운동*(개체가 힘 받아 움직임)·*자동 트리거*(동결→승격, 외란→강등)도 후속 step.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). 검출(htj-cluster)과
//   진공 동반 수송(htj-vacuum)의 보존 이관을 잇는다. promote 한 셀은 정확히 0 → 활성 집합(S2)에서 빠짐.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJPromote = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²)
  const THERM = 'therm';                // 내부에너지 u(열)
  const MOM = ['mom_x', 'mom_y', 'mom_z'];
  const EPS = 1e-12;
  const FOURPI_3 = 4 * Math.PI / 3;
  function equivalentRadius(n) { return Math.cbrt(n / FOURPI_3); }

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 승격 — cells(셀 인덱스 목록, 보통 detectClumps(...,{collectCells:true}).cellList)를 개체로 환원하고
  //   그 셀들을 격자에서 0 으로 비운다. 운동량·내부에너지 장이 없으면 0 으로 간주(질량만 있는 세계도 OK).
  function promote(world, cells) {
    const N = world.N, NN = N * N;
    const rho = world.fields[RHO];
    const u = world.fields[THERM] || null;
    const gx = world.fields[MOM[0]] || null, gy = world.fields[MOM[1]] || null, gz = world.fields[MOM[2]] || null;

    let mass = 0, cx = 0, cy = 0, cz = 0;
    let Px = 0, Py = 0, Pz = 0, U = 0, KEtot = 0, peak = 0;
    // 1패스: 질량·CoM·운동량·내부E·총운동E 누적.
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k], r = rho[i];
      const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / NN;
      mass += r; cx += r * x; cy += r * y; cz += r * z;
      const a = gx ? gx[i] : 0, b = gy ? gy[i] : 0, c = gz ? gz[i] : 0;
      Px += a; Py += b; Pz += c;
      if (r > EPS) KEtot += 0.5 * (a * a + b * b + c * c) / r;     // 셀 운동E ½|g|²/ρ
      if (u) U += u[i];
      if (r > peak) peak = r;
    }
    cx = mass > EPS ? cx / mass : 0; cy = mass > EPS ? cy / mass : 0; cz = mass > EPS ? cz / mass : 0;
    // 각운동량 L = Σ (r−CoM) × g (2패스 — CoM 확정 후).
    let Lx = 0, Ly = 0, Lz = 0;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / NN;
      const rx = x - cx, ry = y - cy, rz = z - cz;
      const a = gx ? gx[i] : 0, b = gy ? gy[i] : 0, c = gz ? gz[i] : 0;
      Lx += ry * c - rz * b; Ly += rz * a - rx * c; Lz += rx * b - ry * a;
    }
    const KEcm = mass > EPS ? 0.5 * (Px * Px + Py * Py + Pz * Pz) / mass : 0;
    const internalKE = KEtot - KEcm;                  // 내부 운동E(셀별 속도 차) — 강체화 시 열로 전환
    const internalE = U + internalKE;                 // 강체 개체의 "열"(원래 열 + 열화된 내부 운동)
    const energy = KEcm + internalE;                  // 총E = KEtot + U (정확 보존량)

    // 격자 비우기 — promote 한 셀은 정확히 0(활성 집합에서 빠짐·진공과 동일 부류).
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      rho[i] = 0; if (u) u[i] = 0; if (gx) gx[i] = 0; if (gy) gy[i] = 0; if (gz) gz[i] = 0;
    }

    return {
      cx, cy, cz, mass, px: Px, py: Py, pz: Pz, Lx, Ly, Lz,
      KEcm, internalKE, internalE, energy,
      cells: cells.length, radius: equivalentRadius(cells.length),
      temp: mass > EPS ? U / mass : 0, peak
    };
  }

  // 강등(역승격) — 개체를 CoM 둘레 *균일 구*로 격자에 되돌린다. 질량/운동량/에너지를 정확히 복원.
  //   구 = CoM 에서 반지름 r 안의 *빈*(ρ=0) 격자 셀. 셀마다 ρ=질량/n · g=ρ·(P/M) · u=internalE/n.
  //   → Σρ=질량 · Σg=P · KE=½|P|²/M=KEcm · Σu=internalE → 총E=KEcm+internalE=개체 에너지(정확).
  //   *빈 셀에만* 얹는 이유(보존): KE=½|g|²/ρ 는 (ρ,g)에 비선형이라 *기존 가스 위에 더하면* 에너지가
  //   비선형으로 어긋난다(½|g₀+g|²/(ρ₀+ρ) ≠ ½|g₀|²/ρ₀+½|g|²/ρ). 빈 셀(ρ₀=0)에 얹으면 정확히 가법.
  //   (점유 셀 위 강등 = 물리적 충돌/병합 = 후속 step.) 반환: 되돌린 셀 수.
  function demote(world, entity) {
    const N = world.N;
    const rho = ensure(world, RHO), u = ensure(world, THERM);
    const gx = ensure(world, MOM[0]), gy = ensure(world, MOM[1]), gz = ensure(world, MOM[2]);
    let r = Math.max(entity.radius, 0.5);
    const collectEmpty = (rad) => {
      const x0 = Math.max(0, Math.floor(entity.cx - rad)), x1 = Math.min(N - 1, Math.ceil(entity.cx + rad));
      const y0 = Math.max(0, Math.floor(entity.cy - rad)), y1 = Math.min(N - 1, Math.ceil(entity.cy + rad));
      const z0 = Math.max(0, Math.floor(entity.cz - rad)), z1 = Math.min(N - 1, Math.ceil(entity.cz + rad));
      const out = [], r2 = rad * rad;
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - entity.cx, dy = y - entity.cy, dz = z - entity.cz;
        if (dx * dx + dy * dy + dz * dz <= r2) { const i = (z * N + y) * N + x; if (rho[i] === 0) out.push(i); }
      }
      return out;
    };
    // 빈 셀이 모자라면 반경을 넓혀 개체 셀수만큼은 확보(질량을 너무 조밀하게 안 쌓도록).
    let ball = collectEmpty(r), guard = 0;
    while (ball.length < entity.cells && r < N && guard++ < 8) { r += 1; ball = collectEmpty(r); }
    if (ball.length === 0) return 0;                  // 둘 자리가 없음(전부 점유) — 충돌, 이 단위 밖
    const n = ball.length;
    const rhoC = entity.mass / n;                     // 셀당 질량(균일)
    const vx = entity.mass > EPS ? entity.px / entity.mass : 0;   // 균일 속도 v=P/M
    const vy = entity.mass > EPS ? entity.py / entity.mass : 0;
    const vz = entity.mass > EPS ? entity.pz / entity.mass : 0;
    const uC = entity.internalE / n;                  // 셀당 내부E(균일)
    for (let k = 0; k < n; k++) {
      const i = ball[k];
      rho[i] = rhoC;                                   // 빈 셀(ρ=0)에 얹음 → 가법 정확
      gx[i] = rhoC * vx; gy[i] = rhoC * vy; gz[i] = rhoC * vz;
      u[i] = uC;
    }
    return n;
  }

  // 측정자 — 개체 목록의 보존량 합(이관 보존 검증 공유).
  function totalEntityMass(ents) { let s = 0; for (const e of ents) s += e.mass; return s; }
  function totalEntityMomentum(ents) { let x = 0, y = 0, z = 0; for (const e of ents) { x += e.px; y += e.py; z += e.pz; } return [x, y, z]; }
  function totalEntityEnergy(ents) { let s = 0; for (const e of ents) s += e.energy; return s; }

  return { promote, demote, totalEntityMass, totalEntityMomentum, totalEntityEnergy, equivalentRadius,
           RHO, THERM, MOM, VERSION: 1 };
});
