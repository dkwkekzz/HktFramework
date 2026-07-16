// engine.js — S0 원자 단계의 연속층 + 통 분리 장부 + tick 파이프라인 뼈대
//
// 세부 단계 ① 무대·장부. 여기서 세운 구조(자료형·장부 통·파이프라인)는
// 이후 모든 세부 단계가 "채우기만" 하고 바꾸지 않는다 (design/01-stage-ledger.md).
// 커널 형태 ⟨I 국소 교환 · M 측정 · ⇧ 출력⟩ 의 I(연속 힘) 자리와
// 이산 전이(사건 큐·접촉 샘플)의 자리를 지금 전부 판다 — ①은 힘 0·전이 0.
//
// node 와 브라우저 겸용. 외부 의존 0 (단계 5원칙: 자체 완전 모듈).

(function () {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  // ── Verlet 표류 허용치 (② 가 고정 — 이후 전 단계의 E 잔차 기준) ──
  //    대표 강성 장면(s02-gas-collide, 척력 벽) 을 dt 스캔해 |ΔE|/E ≈ C·dt² (C≈10) 측정.
  //    기본 dt=0.004 에서 max|ΔE|/E ≈ 1.9e-4 → 시드 변동 여유 두고 EPS_E=5e-4 로 고정.
  const EPS_E = 5e-4;      // 상대 에너지 표류 허용치 (기본 dt 에서)
  const DT_STIFF = 0.004;  // 척력 벽 기준 기본 dt
  const MIN_DSIGMA = 0.7;  // 겹침 문턱: min d/σ 가 이 값 아래로 내려가면 침투 (위반 0)

  // ── Vec3 — 처음부터 3성분. 2D 전용 경로는 두지 않는다 (차원은 장면이 정한다) ──
  const V = {
    make: (x = 0, y = 0, z = 0) => ({ x, y, z }),
    clone: (a) => ({ x: a.x, y: a.y, z: a.z }),
    zero: () => ({ x: 0, y: 0, z: 0 }),
    addInto: (a, b) => { a.x += b.x; a.y += b.y; a.z += b.z; return a; },
    addScaledInto: (a, b, s) => { a.x += b.x * s; a.y += b.y * s; a.z += b.z * s; return a; },
    lenSq: (a) => a.x * a.x + a.y * a.y + a.z * a.z,
    len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  };

  // ── PRNG (mulberry32) — 뷰어 재현·verify 시드 고정용. 결정론은 요구하지 않으나
  //    (KERNEL §7) 테스트에서 dt 반감을 같은 초기조건으로 비교하려면 시드가 필요하다. ──
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 박스-뮐러: 표준정규 난수 (맥스웰 초기 운동량 샘플에 사용)
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ── 사건 큐 (이진 힙) — ④ 전이 엔진이 사용. ①은 자료구조·소진 루프만 존재 ──
  //    원소: { t_fire, rowId, participants:[id...], ver } · ver 로 lazy 무효화.
  function makeQueue() {
    return { heap: [] };
  }
  function queuePush(q, ev) {
    const h = q.heap; h.push(ev);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].t_fire <= h[i].t_fire) break;
      [h[p], h[i]] = [h[i], h[p]]; i = p;
    }
  }
  function queuePop(q) {
    const h = q.heap;
    if (h.length === 0) return null;
    const top = h[0], last = h.pop();
    if (h.length > 0) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let m = i;
        if (l < h.length && h[l].t_fire < h[m].t_fire) m = l;
        if (r < h.length && h[r].t_fire < h[m].t_fire) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }

  // ── 통 분리 장부 — 0 이어도 처음부터 전 통 존재 (DESIGN §2) ──
  //    E_total = Σ(전 통) 이 시간 상수. ①은 힘 0 이라 정확 보존.
  const LEDGER_BINS = [
    'K_tr',       // Σ p²/2m (병진) — ①
    'U_elec',     // 쌍 퍼텐셜(쿨롱+척력) — ②
    'U_int',      // 들뜸 에너지 (Σocc·ε − 바닥) — ④
    'U_bond',     // 결합 우물 + 스프링 — ⑥
    'U_vib',      // 진동 — ⑦
    'U_rot',      // 회전 — ⑦
    'U_pol',      // 분극 −½Σα·E² — ⑧
    'E_photon',   // 방출된 복사 (④ 빈 → ⑫ 광자 입자)
    'E_nuclear',  // 예약 — ㉓~
    'E_escape',   // 열린 경계로 나간 에너지
  ];
  function makeLedger() {
    const l = {};
    for (const b of LEDGER_BINS) l[b] = 0;
    l.P_escape = V.zero();  // 탈출 입자 운동량 회계 (P 보존 검사는 P + P_escape)
    return l;
  }
  function ledgerTotal(world) {
    let s = 0;
    for (const b of LEDGER_BINS) s += world.ledger[b];
    return s;
  }

  // ── 원자·월드 생성 ──
  let _nextId = 1;
  function makeAtom(sp, r, p, q) {
    return {
      id: _nextId++,
      sp,                    // 종 id (질량·σ·ε 테이블 키) — ①은 질량만 의미
      q: q || 0,             // 전하 (②~④ 중성 q=0 — 테스트 전하 장면만 ≠0 · ⑤에서 실전)
      r: V.clone(r),
      p: V.clone(p),
      F: V.zero(),           // 힘 누산 (velocity Verlet) — ①은 0
      disp: V.zero(),        // 누적 변위 (주기 랩과 무관한 참 변위) — MSD 관측용
      occ: null,             // ③에서 채움
      mu: null,              // ⑧에서 채움
    };
  }

  function makeWorld(opts) {
    const o = opts || {};
    return {
      t: 0,
      dt: o.dt != null ? o.dt : 0.01,
      box: o.box || { L: V.make(20, 20, 20), bc: 'periodic' },
      frozenZ: o.frozenZ !== false,   // 기본 z 동결 (초기 검증 장면)
      mass: o.mass || { X: 1.0 },     // 종별 질량 테이블
      sigma: o.sigma || { X: 1.0 },   // 종별 상호작용 지름 (② 척력·Lorentz 혼합)
      eps: o.eps || { X: 1.0 },       // 종별 척력 세기 (② Berthelot 혼합)
      kc: o.kc != null ? o.kc : 1.0,  // 쿨롱 상수 (노브)
      soft: o.soft != null ? o.soft : 0.1,  // softening s (d→0 발산 방지, 노브)
      virial: 0,                      // ② 비리얼 (압력 측정) — pairForces 가 갱신
      minDsigma: Infinity,            // ② 최근접 비율 min d/σ — 겹침 감시
      atoms: [],
      electrons: [],   // ⑤ 전
      photons: [],     // ⑫ 전
      bonds: [],       // ⑥ 전 — 빈 배열로 구조만 존재
      escaped: [],     // 열린 경계로 나간 원자 (Σc 회계 유지용 — 시뮬에서는 제외)
      queue: makeQueue(),
      ledger: makeLedger(),
      computeForces: o.computeForces || zeroForces,  // ①은 F=0
    };
  }

  // ①의 힘: 없음. atom.F=0, U_elec=0. (②가 쿨롱+척력으로 교체)
  function zeroForces(world) {
    for (const a of world.atoms) { a.F.x = 0; a.F.y = 0; a.F.z = 0; }
    world.ledger.U_elec = 0;
  }

  // 최소 이미지: 주기 경계에서 성분 차를 [−L/2, L/2) 로 접는다
  function minImage(dx, L) { return dx - L * Math.round(dx / L); }

  // ── ② 연속 힘: 쿨롱 + 단거리 척력, 전 쌍 O(N²) + 최소 이미지 (DESIGN §3.2) ──
  //    V(d) = k_c·qᵢqⱼ/(d+s) + ε_rep·(σᵢⱼ/d)¹²
  //    F(i←j) = [ k_c·qᵢqⱼ/(d+s)² + 12·ε_rep·σᵢⱼ¹²/d¹³ ]·d̂   (반대칭 → P 보존은 구조가 보장)
  //    부수 측정: 비리얼(압력)·최근접 비율 min d/σᵢⱼ 를 world 에 남긴다.
  function pairForces(world) {
    const atoms = world.atoms, n = atoms.length;
    const L = world.box.L, periodic = world.box.bc === 'periodic';
    const kc = world.kc, s = world.soft, frozenZ = world.frozenZ;
    for (const a of atoms) { a.F.x = 0; a.F.y = 0; a.F.z = 0; }
    let U = 0, virial = 0, minRatio = Infinity;
    for (let i = 0; i < n; i++) {
      const ai = atoms[i], sgi = world.sigma[ai.sp], epi = world.eps[ai.sp];
      for (let j = i + 1; j < n; j++) {
        const aj = atoms[j];
        let dx = ai.r.x - aj.r.x, dy = ai.r.y - aj.r.y, dz = ai.r.z - aj.r.z;
        if (periodic) {
          dx = minImage(dx, L.x); dy = minImage(dy, L.y);
          dz = frozenZ ? 0 : minImage(dz, L.z);
        }
        const d2 = dx * dx + dy * dy + dz * dz;
        const d = Math.sqrt(d2);
        const sig = (sgi + world.sigma[aj.sp]) / 2;          // Lorentz
        const eps = Math.sqrt(epi * world.eps[aj.sp]);        // Berthelot
        const q = ai.q * aj.q;
        const invS = 1 / (d + s);
        const sr12 = Math.pow(sig / d, 12);
        U += kc * q * invS + eps * sr12;                      // 쌍 퍼텐셜 → U_elec
        // 힘 크기 |F| (양수 = 척력): 쿨롱 항 + 척력 벽 항
        const fmag = kc * q * invS * invS + 12 * eps * sr12 / d;
        const fOverD = fmag / d;
        ai.F.x += fOverD * dx; ai.F.y += fOverD * dy; ai.F.z += fOverD * dz;
        aj.F.x -= fOverD * dx; aj.F.y -= fOverD * dy; aj.F.z -= fOverD * dz;
        virial += fmag * d;                                   // r·F = fOverD·d² = fmag·d
        const ratio = d / sig;
        if (ratio < minRatio) minRatio = ratio;
      }
    }
    if (frozenZ) for (const a of atoms) a.F.z = 0;            // z 동결: 힘의 z 누수 차단
    world.ledger.U_elec = U;
    world.virial = virial;
    world.minDsigma = minRatio;
  }

  // ── 장부 갱신: 활성 원자의 병진 운동에너지를 K_tr 로. 나머지 통은 각 모듈이 채운다 ──
  function recomputeLedger(world) {
    let K = 0;
    for (const a of world.atoms) {
      const m = world.mass[a.sp];
      K += V.lenSq(a.p) / (2 * m);
    }
    world.ledger.K_tr = K;
  }

  // ── 경계 처리 ──
  function applyBoundary(world) {
    const L = world.box.L, bc = world.box.bc;
    if (bc === 'periodic') {
      for (const a of world.atoms) {
        a.r.x = wrap(a.r.x, L.x); a.r.y = wrap(a.r.y, L.y);
        if (!world.frozenZ) a.r.z = wrap(a.r.z, L.z);
      }
    } else if (bc === 'reflect') {
      for (const a of world.atoms) {
        reflect1(a, 'x', L.x); reflect1(a, 'y', L.y);
        if (!world.frozenZ) reflect1(a, 'z', L.z);
      }
    } else if (bc === 'open') {
      const keep = [];
      for (const a of world.atoms) {
        if (outside(a.r, L, world.frozenZ)) {
          // 탈출 회계: 운동에너지 → E_escape · 운동량 → P_escape · 원자는 escaped 로
          const m = world.mass[a.sp];
          world.ledger.E_escape += V.lenSq(a.p) / (2 * m);
          V.addInto(world.ledger.P_escape, a.p);
          world.escaped.push(a);
        } else keep.push(a);
      }
      world.atoms = keep;
    }
  }
  function wrap(x, L) { x = x % L; return x < 0 ? x + L : x; }
  function reflect1(a, k, L) {
    if (a.r[k] < 0) { a.r[k] = -a.r[k]; a.p[k] = -a.p[k]; }
    else if (a.r[k] > L) { a.r[k] = 2 * L - a.r[k]; a.p[k] = -a.p[k]; }
  }
  function outside(r, L, frozenZ) {
    if (r.x < 0 || r.x > L.x || r.y < 0 || r.y > L.y) return true;
    if (!frozenZ && (r.z < 0 || r.z > L.z)) return true;
    return false;
  }

  // ── tick 파이프라인 (DESIGN §4.3) ──
  //    사건 큐 소진 → 힘 → velocity Verlet → 경계 → 접촉 전이 샘플 → 장부·측정
  function step(world) {
    drainQueue(world);          // ④ 사용 · ①은 빈 큐
    const dt = world.dt;

    // velocity Verlet: p += F dt/2 ; r += (p/m) dt ; F 재계산 ; p += F dt/2
    world.computeForces(world);            // 첫 F (①은 0)
    for (const a of world.atoms) V.addScaledInto(a.p, a.F, dt / 2);
    for (const a of world.atoms) {
      const m = world.mass[a.sp];
      const vx = a.p.x / m, vy = a.p.y / m, vz = a.p.z / m;
      a.r.x += vx * dt; a.r.y += vy * dt; a.r.z += vz * dt;
      a.disp.x += vx * dt; a.disp.y += vy * dt; a.disp.z += vz * dt;
    }
    applyBoundary(world);
    world.computeForces(world);            // 새 위치에서 F
    for (const a of world.atoms) V.addScaledInto(a.p, a.F, dt / 2);

    sampleContacts(world);      // ④ 사용 · ①은 no-op
    recomputeLedger(world);

    if (world.frozenZ) assertFrozenZ(world);
    world.t += dt;
  }

  // ①에선 큐가 비어 있고 소진 루프만 존재 (④가 실사용)
  function drainQueue(world) {
    while (world.queue.heap.length > 0 && world.queue.heap[0].t_fire <= world.t) {
      queuePop(world.queue);  // ①은 발생 사건 0 — 자리만
    }
  }
  function sampleContacts(_world) { /* ④ 접촉 전이 샘플 — ①은 no-op */ }

  // z 동결 검증: 힘의 z 성분이 수치 오염을 만들면 즉시 검출 (design §01)
  function assertFrozenZ(world) {
    for (const a of world.atoms) {
      if (Math.abs(a.r.z) > 1e-12 || Math.abs(a.p.z) > 1e-12) {
        throw new Error(`frozenZ 위반: atom#${a.id} z=${a.r.z} pz=${a.p.z}`);
      }
    }
  }

  // 여러 tick 실행
  function run(world, ticks) {
    for (let i = 0; i < ticks; i++) step(world);
    return world;
  }

  const api = {
    EPS_E, DT_STIFF, MIN_DSIGMA,
    V, makeRng, gaussian,
    makeQueue, queuePush, queuePop,
    LEDGER_BINS, makeLedger, ledgerTotal,
    makeAtom, makeWorld, zeroForces, pairForces, minImage,
    recomputeLedger, applyBoundary, step, run,
  };

  if (isNode) module.exports = api;
  else window.HktS0Engine = api;
})();
