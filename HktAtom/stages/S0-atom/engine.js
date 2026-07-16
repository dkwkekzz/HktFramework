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
      level: 0,              // ④ 내부 준위 인덱스 (0=바닥·1=들뜸) — 2준위 근사
      ver: 0,               // 준위 변경 버전 (사건 큐 lazy 무효화)
      occ: null,             // ③ 부껍질 벡터 (⑤+ 세부 이온화에서 사용)
      mu: null,              // ⑧에서 채움
    };
  }

  function makeWorld(opts) {
    const o = opts || {};
    const w = {
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
      rng: o.rng || Math.random,      // ④ 전이 샘플용 난수원
      catalog: o.catalog || null,     // ④ 전이 카탈로그 (행 배열) — 없으면 이산층 꺼짐
      specLevels: o.specLevels || null, // ④ 종별 {dE, g0, g1} — U_int·hazard 가 사용
      rc: o.rc != null ? o.rc : 1.5,  // ④ 접촉 반경 (노브)
      nu_col: o.nu_col != null ? o.nu_col : 1.0,   // ④ 충돌 전이 시도율 노브
      nu_abs: o.nu_abs != null ? o.nu_abs : 1.0,   // ④ 흡수율 노브
      tau_rad: o.tau_rad != null ? o.tau_rad : Infinity, // ④ 복사 수명 (∞=방출 없음)
      radiativeOpen: o.radiativeOpen || false,     // ④ 방출 광자가 즉시 탈출(냉각) vs 빈 저장(공동)
      nPhotons: 0,                    // ④ 광자 빈 (단일 종 = 스칼라 개수)
      atoms: [],
      electrons: [],   // ⑤ 전
      photons: [],     // ⑫ 전
      bonds: [],       // ⑥ 전 — 빈 배열로 구조만 존재
      escaped: [],     // 열린 경계로 나간 원자 (Σc 회계 유지용 — 시뮬에서는 제외)
      queue: makeQueue(),
      ledger: makeLedger(),
      computeForces: o.computeForces || zeroForces,  // ①은 F=0
    };
    w.atomById = (id) => { for (const a of w.atoms) if (a.id === id) return a; return null; };
    return w;
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

  // ── 장부 갱신: K_tr(병진)·U_int(들뜸). E_photon·E_escape 는 전이가 증분 회계 ──
  function recomputeLedger(world) {
    let K = 0, Uint = 0;
    for (const a of world.atoms) {
      K += V.lenSq(a.p) / (2 * world.mass[a.sp]);
      if (a.level > 0 && world.specLevels) Uint += world.specLevels[a.sp].dE;
    }
    world.ledger.K_tr = K;
    world.ledger.U_int = Uint;
  }

  // 총 에너지 (사건 단위 회계 검사용 — K·U 재계산 + 전 통)
  function totalEnergy(world) { recomputeLedger(world); return ledgerTotal(world); }

  // ── ④ 이산층: 전이 실행기 ──

  // 준위 변경 (버전 증가 → 예약된 방출 사건 lazy 무효화)
  function setLevel(a, lvl) { if (a.level !== lvl) { a.level = lvl; a.ver++; } }

  // 상대 운동에너지 ↔ 내부 에너지 교환 (COM 운동량 불변 → P 보존). dInt>0 = KE→내부(흡열)
  function collisionalTransfer(world, i, j, dInt) {
    const a = world.atoms[i], b = world.atoms[j];
    const mi = world.mass[a.sp], mj = world.mass[b.sp], Mt = mi + mj, mu = mi * mj / Mt;
    let vx = a.p.x / mi - b.p.x / mj, vy = a.p.y / mi - b.p.y / mj, vz = a.p.z / mi - b.p.z / mj;
    const v2 = vx * vx + vy * vy + vz * vz, KE = 0.5 * mu * v2;
    const KEn = KE - dInt;
    if (KEn < 0 || KE <= 0) return false;            // 에너지 부족 → 전이 불가
    const s = Math.sqrt(KEn / KE);
    const vcx = (a.p.x + b.p.x) / Mt, vcy = (a.p.y + b.p.y) / Mt, vcz = (a.p.z + b.p.z) / Mt;
    vx *= s; vy *= s; vz *= s;
    a.p.x = mi * (vcx + (mj / Mt) * vx); a.p.y = mi * (vcy + (mj / Mt) * vy); a.p.z = mi * (vcz + (mj / Mt) * vz);
    b.p.x = mj * (vcx - (mi / Mt) * vx); b.p.y = mj * (vcy - (mi / Mt) * vy); b.p.z = mj * (vcz - (mi / Mt) * vz);
    return true;
  }

  // 상대 운동에너지 ½μ|v_rel|²
  function relKE(world, i, j) {
    const a = world.atoms[i], b = world.atoms[j];
    const mi = world.mass[a.sp], mj = world.mass[b.sp], mu = mi * mj / (mi + mj);
    const vx = a.p.x / mi - b.p.x / mj, vy = a.p.y / mi - b.p.y / mj, vz = a.p.z / mi - b.p.z / mj;
    return 0.5 * mu * (vx * vx + vy * vy + vz * vz);
  }

  // Larsen–Borgnakke 충돌 내부 교환 — 세부 균형 정확판 (볼츠만이 창발한다, author 0).
  //   충돌 총에너지 E_c = 상대KE + 표적 내부에너지. 후보 준위 k(ε_k≤E_c)를 g_k 가중으로 뽑는다.
  //   (2D 상대 병진 상태밀도 ∝ E_t⁰ 이므로 가중치는 g_k 뿐 — e^{−ΔE/T} 는 어디에도 안 적는다).
  //   뽑힌 뒤 상대 KE = E_c − ε_k 로 재조정 (COM 불변 → P 보존). 들뜸·완화는 이 한 규칙의 두 결과.
  function lbRedistribute(world, i, j) {
    const rng = world.rng;
    const tgt = rng() < 0.5 ? i : j;
    const a = world.atoms[tgt], L = world.specLevels[a.sp];
    const KE = relKE(world, i, j);
    const eOld = a.level ? L.dE : 0;
    const Ec = KE + eOld;
    let nl = 0;
    if (L.dE <= Ec) nl = (rng() < L.g1 / (L.g0 + L.g1)) ? 1 : 0;   // 에너지 충분 → g 가중 선택
    const dInt = (nl ? L.dE : 0) - eOld;                          // KE 에서 뺄 양(양수=흡열)
    if (dInt !== 0 && !collisionalTransfer(world, i, j, dInt)) return false;
    const was = a.level; setLevel(a, nl);
    if (nl === 1 && was === 0) scheduleEmission(world, a);
    return dInt !== 0 || nl !== was;
  }

  // 접촉쌍 (반경 r_c 내) — ④부터 이산 채널이 사용
  function contactPairs(world) {
    const out = [], A = world.atoms, rc2 = world.rc * world.rc;
    const L = world.box.L, per = world.box.bc === 'periodic';
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
      if (per) { dx = minImage(dx, L.x); dy = minImage(dy, L.y); dz = world.frozenZ ? 0 : minImage(dz, L.z); }
      else if (world.frozenZ) dz = 0;
      if (dx * dx + dy * dy + dz * dz <= rc2) out.push([i, j]);
    }
    return out;
  }

  const expSample = (rng, tau) => -tau * Math.log(1 - rng());

  // 방출 사건 예약 (수명 채널 — ①의 큐 뼈대 실사용). τ=∞ 면 예약 안 함.
  function scheduleEmission(world, a) {
    if (!isFinite(world.tau_rad)) return;
    queuePush(world.queue, { t_fire: world.t + expSample(world.rng, world.tau_rad), rowId: 'R-EMI', part: a.id, ver: a.ver });
  }

  // 전이 apply 를 사건 단위 장부 검사로 감싼다 (전후 E·P 차 ≤ 1e-9)
  function checkedApply(world, fn) {
    const E0 = totalEnergy(world), P0 = momentumRaw(world);
    const changed = fn();
    if (changed && world._auditP !== false) {
      const E1 = totalEnergy(world), P1 = momentumRaw(world);
      if (Math.abs(E1 - E0) > 1e-9) throw new Error(`전이 E 위반: ${E1 - E0}`);
      if (world._auditP && (Math.abs(P1.x - P0.x) > 1e-9 || Math.abs(P1.y - P0.y) > 1e-9)) throw new Error('전이 P 위반');
    }
    return changed;
  }
  function momentumRaw(world) { const P = V.zero(); for (const a of world.atoms) V.addInto(P, a.p); return P; }

  // 접촉 채널 실행: 접촉쌍마다 카탈로그 행 샘플 (p=1−e^{−k·dt}), 첫 성공 후 그 쌍 종료.
  //   두 시계 중 접촉 시계 (DESIGN §4.2). 방출은 수명 시계(큐), 흡수는 빈 밀도(runAbsorption).
  function runTransitions(world) {
    if (!world.catalog) return;
    const dt = world.dt, rng = world.rng;
    const pairs = contactPairs(world);
    for (const pr of pairs) {
      for (const row of world.catalog) {
        if (row.kind !== 'contact') continue;
        const ctx = row.match(world, pr[0], pr[1]);
        if (!ctx) continue;
        const k = row.hazard(world, ctx);
        if (k > 0 && rng() < 1 - Math.exp(-k * dt)) {
          const done = checkedApply(world, () => row.apply(world, ctx));
          if (done) break;   // 한 쌍 한 tick 한 전이
        }
      }
    }
    runAbsorption(world);       // R-ABS — 접촉*(광자 빈 밀도). 빈이 비면 no-op
  }

  // R-ABS 흡수: 바닥 원자가 광자 빈에서 흡수 (E_photon → U_int). 빈 근사 → 운동량 없음(정직 한계).
  function runAbsorption(world) {
    if (world.nPhotons <= 0 || !world.specLevels) return;
    const dt = world.dt, rng = world.rng;
    const vol = world.frozenZ ? world.box.L.x * world.box.L.y : world.box.L.x * world.box.L.y * world.box.L.z;
    for (const a of world.atoms) {
      if (world.nPhotons <= 0) break;
      if (a.level !== 0) continue;
      const k = world.nu_abs * (world.nPhotons / vol);
      if (k > 0 && rng() < 1 - Math.exp(-k * dt)) {
        checkedApply(world, () => {
          const L = world.specLevels[a.sp];
          world.nPhotons--; world.ledger.E_photon -= L.dE;
          setLevel(a, 1); scheduleEmission(world, a);
          return true;
        });
      }
    }
  }

  // 수명 채널: 큐에서 발화한 방출 사건 처리 (lazy 무효화 검사)
  function fireEvent(world, ev) {
    if (ev.rowId !== 'R-EMI') return;
    const a = world.atomById && world.atomById(ev.part);
    if (!a || a.level !== 1 || a.ver !== ev.ver) return;   // 무효화 (완화됨·재예약됨)
    checkedApply(world, () => {
      const L = world.specLevels[a.sp];
      setLevel(a, 0);
      if (world.radiativeOpen) world.ledger.E_escape += L.dE;   // 열린 복사 → 탈출
      else { world.nPhotons++; world.ledger.E_photon += L.dE; if (world.spectrumAdd) world.spectrumAdd(L.dE); }
      return true;
    });
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

    runTransitions(world);      // ④ 접촉 전이 샘플 + 흡수 · ①②③은 catalog 없음 → no-op
    recomputeLedger(world);

    if (world.frozenZ) assertFrozenZ(world);
    world.t += dt;
  }

  // 사건 큐 소진: 발화 시각이 지난 사건을 처리 (④ 방출) · ①②③은 빈 큐
  function drainQueue(world) {
    while (world.queue.heap.length > 0 && world.queue.heap[0].t_fire <= world.t) {
      fireEvent(world, queuePop(world.queue));
    }
  }

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
    recomputeLedger, totalEnergy, applyBoundary, step, run,
    setLevel, collisionalTransfer, relKE, lbRedistribute, contactPairs, scheduleEmission, runTransitions,
  };

  if (isNode) module.exports = api;
  else window.HktS0Engine = api;
})();
