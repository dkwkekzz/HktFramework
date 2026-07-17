// engine.js — S1 분자 단계의 무대·장부·tick 뼈대. **자체 완전** (S0 코드 0·외부 의존 0).
//
// 커널 재귀(KERNEL §2): 개체 자료형은 여전히 entity = {c, r, p, u} 하나다. 다만 S1 에서
//   c = 조성 다발(원자종별 개수 — S0 개체들의 Σc), u = 접힌 내부 상태(결합 에너지 + 내부 온도 T_int
//   — S0 미시 운동·결합이 여기로 접혔다 = 온도의 탄생). r·p 는 분자의 병진 국소성/운동량.
//   단계 사이 접점은 input.json(=S0 output.json)뿐 — 코드 화살표 0 (KERNEL §1).
//
// ①(무대)은 S0-① 과 동형: 힘 0. 분자들이 존재하고 자유 비행하며 장부(Σc·P·E)가 정확히 닫힌다.
//   분자 간 유효 힘(input.pairPotential 의 인력 꼬리)은 ②(응집)이 켠다.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // ── Vec3 (S0 와 독립 재구현 — 자체 완전) ──
  const V = {
    make: (x, y, z) => ({ x, y, z }),
    zero: () => ({ x: 0, y: 0, z: 0 }),
    clone: (a) => ({ x: a.x, y: a.y, z: a.z }),
    addInto: (a, b) => { a.x += b.x; a.y += b.y; a.z += b.z; },
    addScaledInto: (a, b, s) => { a.x += b.x * s; a.y += b.y * s; a.z += b.z * s; },
    lenSq: (a) => a.x * a.x + a.y * a.y + a.z * a.z,
    len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  };

  // ── 결정론 아님(KERNEL §7) — Math.random 허용. 재현 편의용 시드 RNG 제공 ──
  function makeRng(seed) { let s = (seed || 1) >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gaussian(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ── 통 분리 장부 (S0 §2 동형·처음부터 전 통 존재) ──
  //   E_total = Σ(전 통) 이 시간 상수. ①은 힘 0 이라 정확 보존.
  const LEDGER_BINS = [
    'K_tr',      // Σ p²/2m (분자 병진)
    'U_int',     // 접힌 내부 에너지 (Σ 분자 E_bind + 내부 열 저장) — 온도의 탄생
    'U_inter',   // 분자 간 유효 퍼텐셜 (② 응집부터 — ①은 0)
    'E_escape',  // 열린 경계로 나간 에너지
  ];
  function makeLedger() { const l = {}; for (const b of LEDGER_BINS) l[b] = 0; l.P_escape = V.zero(); return l; }
  function ledgerTotal(world) { let s = 0; for (const b of LEDGER_BINS) s += world.ledger[b]; return s; }

  // ── 개체(분자) 생성 — entity 인터페이스 유지 {c, r, p, u} ──
  let _nextId = 1;
  function makeMolecule(o) {
    return {
      id: _nextId++,
      sig: o.sig,                 // 분자종 시그니처 (예 'H2O1') — 라벨 아님·조성의 문자열 요약
      c: o.c,                     // 보존 다발: 원자종별 개수 {O:1, H:2} (S0 Σc)
      m: o.m,                     // 질량 (Σ 구성 원자 질량 — input 유래)
      Ebind: o.Ebind || 0,        // 접힌 결합 에너지 (음수·U_int 에 합산)
      Tint: o.Tint || 0,          // 내부 온도 (접힌 미시 운동 — 무대에선 정적 저장)
      r: V.clone(o.r),
      p: V.clone(o.p),
      F: V.zero(),
      disp: V.zero(),             // 누적 참 변위 (MSD·랩 무관)
    };
  }

  function makeWorld(opts) {
    const o = opts || {};
    const w = {
      t: 0,
      dt: o.dt != null ? o.dt : 0.01,
      box: o.box || { L: V.make(20, 20, 20), bc: 'periodic' },
      frozenZ: !!o.frozenZ,        // S1 은 기본 3D (⑬ 이후 세계는 3D)
      rng: o.rng || Math.random,
      virial: 0,
      minDist: Infinity,           // 최근접 거리 (겹침 감시 — ②부터 의미)
      mols: [],
      escaped: [],                 // 열린 경계로 나간 분자 (Σc 회계 유지)
      ledger: makeLedger(),
      computeForces: o.computeForces || zeroForces,   // ①은 F=0
      pairV: o.pairV || null,      // ② 유효 쌍 퍼텐셜 테이블 {'O|O':[[r,V]...]} (input 유래)
    };
    return w;
  }

  // ①의 힘: 없음. F=0, U_inter=0.
  function zeroForces(world) { for (const m of world.mols) { m.F.x = 0; m.F.y = 0; m.F.z = 0; } world.ledger.U_inter = 0; }

  // 최소 이미지
  function minImage(d, L) { return d - L * Math.round(d / L); }

  // 장부 갱신: K_tr(분자 병진) · U_int(Σ E_bind + 내부 열). U_inter 는 computeForces 가 채운다.
  function recomputeLedger(world) {
    let K = 0, Uint = 0;
    for (const m of world.mols) { K += V.lenSq(m.p) / (2 * m.m); Uint += m.Ebind; }
    world.ledger.K_tr = K;
    world.ledger.U_int = Uint;
  }
  function totalEnergy(world) { recomputeLedger(world); return ledgerTotal(world); }

  // 경계: periodic 랩 · open 탈출(회계) · reflect 반사
  function applyBoundary(world) {
    const L = world.box.L, bc = world.box.bc;
    if (bc === 'periodic') {
      const wrap = (x, Lx) => ((x % Lx) + Lx) % Lx;
      for (const m of world.mols) { m.r.x = wrap(m.r.x, L.x); m.r.y = wrap(m.r.y, L.y); if (!world.frozenZ) m.r.z = wrap(m.r.z, L.z); else m.r.z = 0; }
    } else if (bc === 'reflect') {
      const refl = (m, k, Lk) => { if (m.r[k] < 0) { m.r[k] = -m.r[k]; m.p[k] = -m.p[k]; } else if (m.r[k] > Lk) { m.r[k] = 2 * Lk - m.r[k]; m.p[k] = -m.p[k]; } };
      for (const m of world.mols) { refl(m, 'x', L.x); refl(m, 'y', L.y); if (!world.frozenZ) refl(m, 'z', L.z); }
    } else if (bc === 'open') {
      const keep = [];
      for (const m of world.mols) {
        if (m.r.x < 0 || m.r.x > L.x || m.r.y < 0 || m.r.y > L.y || (!world.frozenZ && (m.r.z < 0 || m.r.z > L.z))) {
          world.ledger.E_escape += V.lenSq(m.p) / (2 * m.m) + m.Ebind;
          V.addInto(world.ledger.P_escape, m.p);
          world.escaped.push(m);
        } else keep.push(m);
      }
      world.mols = keep;
    }
    if (world.frozenZ) for (const m of world.mols) { m.r.z = 0; m.p.z = 0; }
  }

  // ── tick: 힘 → velocity Verlet → 경계 → 장부 ──
  function step(world) {
    const dt = world.dt;
    world.computeForces(world);
    for (const m of world.mols) V.addScaledInto(m.p, m.F, dt / 2);
    for (const m of world.mols) {
      const vx = m.p.x / m.m, vy = m.p.y / m.m, vz = m.p.z / m.m;
      m.r.x += vx * dt; m.r.y += vy * dt; m.r.z += vz * dt;
      m.disp.x += vx * dt; m.disp.y += vy * dt; m.disp.z += vz * dt;
    }
    applyBoundary(world);
    world.computeForces(world);
    for (const m of world.mols) V.addScaledInto(m.p, m.F, dt / 2);
    recomputeLedger(world);
    if (world.frozenZ) for (const m of world.mols) if (Math.abs(m.r.z) > 1e-12 || Math.abs(m.p.z) > 1e-12) throw new Error('frozenZ 위반 mol#' + m.id);
    world.t += dt;
  }
  function run(world, ticks) { for (let i = 0; i < ticks; i++) step(world); return world; }

  const api = { V, makeRng, gaussian, LEDGER_BINS, makeLedger, ledgerTotal, makeMolecule, makeWorld, zeroForces, minImage, recomputeLedger, totalEnergy, applyBoundary, step, run };
  if (isNode) module.exports = api;
  else window.HktS1Engine = api;
})();
