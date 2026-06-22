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
  //
  //   opts.spin(가법·기본 off): 켜면 개체의 기록된 각운동량 L 을 *강체 회전장*으로 복원한다(step_0029) —
  //     ω = I⁻¹·L(I=볼 관성 텐서), 셀 속도 v = v_cm + ω×(r−볼CoM). 회전은 순 선운동량을 0 만큼 더하므로
  //     (Σρ·ω×r = ω×Σρr = 0) Σg=P 불변, L 은 I·ω=L 로 복원(왕복 각운동량 보존). 회전 KE=½ω·L 는
  //     internalE 에서 빼 열로 분배(uC=(internalE−KE_rot)/n) → 총E=KEcm+KE_rot+열=KEcm+internalE 정확 보존.
  //     internalE 가 KE_rot 보다 작으면 ω 를 스케일해 열≥0 유지(에너지 우선·L 일부만 — 정직한 한계).
  //     **off(기본)면 균일 속도 = 기존과 byte 동일**(회귀 0 — opts.spin 켠 step 만 회전 복원).
  function demote(world, entity, opts) {
    opts = opts || {};
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
    let uC = entity.internalE / n;                    // 셀당 내부E(균일·spin off 기본)
    // 회전 복원(opts.spin) — 강체 각속도 ω=I⁻¹L 로 회전장을 얹는다(기본 off=균일=byte 동일).
    let spin = false, wx = 0, wy = 0, wz = 0, bcx = 0, bcy = 0, bcz = 0;
    if (opts.spin && entity.mass > EPS && (entity.Lx || entity.Ly || entity.Lz)) {
      const xyz = (i) => { const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); return [x, y, z]; };
      for (let k = 0; k < n; k++) { const p = xyz(ball[k]); bcx += p[0]; bcy += p[1]; bcz += p[2]; }
      bcx /= n; bcy /= n; bcz /= n;                   // 볼 CoM(회전 중심)
      let Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0;  // 관성 텐서(질량 rhoC 균일)
      for (let k = 0; k < n; k++) { const p = xyz(ball[k]); const dx = p[0] - bcx, dy = p[1] - bcy, dz = p[2] - bcz; Ixx += rhoC * (dy * dy + dz * dz); Iyy += rhoC * (dx * dx + dz * dz); Izz += rhoC * (dx * dx + dy * dy); Ixy -= rhoC * dx * dy; Ixz -= rhoC * dx * dz; Iyz -= rhoC * dy * dz; }
      const w3 = solve3(Ixx, Ixy, Ixz, Ixy, Iyy, Iyz, Ixz, Iyz, Izz, entity.Lx, entity.Ly, entity.Lz);
      if (w3) {
        wx = w3[0]; wy = w3[1]; wz = w3[2];
        let KErot = 0.5 * (wx * entity.Lx + wy * entity.Ly + wz * entity.Lz);
        if (KErot > entity.internalE && KErot > EPS) {  // 열 부족 → ω 스케일(에너지 우선, L 일부만)
          const s = Math.sqrt(entity.internalE / KErot); wx *= s; wy *= s; wz *= s; KErot = entity.internalE;
        }
        uC = Math.max(0, entity.internalE - KErot) / n;  // 남은 internalE = 열
        spin = true;
      }
    }
    for (let k = 0; k < n; k++) {
      const i = ball[k];
      let vxi = vx, vyi = vy, vzi = vz;
      if (spin) { const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); const rx = x - bcx, ry = y - bcy, rz = z - bcz; vxi += wy * rz - wz * ry; vyi += wz * rx - wx * rz; vzi += wx * ry - wy * rx; }
      rho[i] = rhoC;                                   // 빈 셀(ρ=0)에 얹음 → 가법 정확
      gx[i] = rhoC * vxi; gy[i] = rhoC * vyi; gz[i] = rhoC * vzi;
      u[i] = uC;
    }
    return n;
  }

  // 대칭 3×3 선형계 A·ω=L 풀이(Cramer) — 관성 텐서 역(ω=I⁻¹L). |det|≈0(특이=점/선형 분포)면 null.
  function solve3(a, b, c, d, e, f, g, h, i, lx, ly, lz) {
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-9) return null;
    const wx = (lx * (e * i - f * h) - b * (ly * i - f * lz) + c * (ly * h - e * lz)) / det;
    const wy = (a * (ly * i - lz * f) - lx * (d * i - f * g) + c * (d * lz - ly * g)) / det;
    const wz = (a * (e * lz - ly * h) - b * (d * lz - ly * g) + lx * (d * h - e * g)) / det;
    return [wx, wy, wz];
  }

  // 측정자 — 개체 목록의 보존량 합(이관 보존 검증 공유).
  function totalEntityMass(ents) { let s = 0; for (const e of ents) s += e.mass; return s; }
  function totalEntityMomentum(ents) { let x = 0, y = 0, z = 0; for (const e of ents) { x += e.px; y += e.py; z += e.pz; } return [x, y, z]; }
  function totalEntityEnergy(ents) { let s = 0; for (const e of ents) s += e.energy; return s; }

  return { promote, demote, totalEntityMass, totalEntityMomentum, totalEntityEnergy, equivalentRadius,
           RHO, THERM, MOM, VERSION: 1 };
});
