/* ============================================================
 * step-0004 sim-core : step-0003 코어를 그대로 잇는다 (시작 시점 변경 0 = 회귀 자명)
 * step-0002 코어를 그대로 잇되 세 가지를 추가한다:
 *  (1) 행동의 떠오름 — 끌림이 국소 E를 약하게 추종: A ← ρ + wE·E
 *      (새 법칙이 아니라 [03] 응집 되먹임의 계수 하나. wE=0이면 step-0002와 동일)
 *  (2) 행동 측정 — agent별 이동 속도/누적 이동거리, 탄생·사망·경합사망 집계
 *  (3) 재귀 2층 — 살아있는 agent를 거친 격자(상위 장)의 "양"으로 승급하고,
 *      *문자 그대로 같은* step()을 N₂×N₂ 격자에 재호출 ([06]의 "원 안의 원")
 * ============================================================ */
(function (global) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEFAULT_PARAMS = {
    alphaT: 0.5,     // T 확산율
    alphaE: 0.25,    // E 확산율
    alphaRho: 0.02,  // rho 기본 확산 = 구조를 흩으려는 엔트로피
    kT: 5,           // 열 교반: T가 높을수록 rho가 빨리 흩어진다 (녹는다)
    g: 2.0,          // 응집 강도
    cost: 0.06,      // 응집 대사 비용 (옮긴 질량당 E 소모 → T)
    kA: 0.4,         // A가 (rho + wE·E)를 추종하는 속도 (응집 되먹임)
    alphaA: 0.3,     // A 평활화 = 끌림의 사거리
    wE: 0.0,         // ★ step-0003: 끌림의 E 추종 가중치. 0 = step-0002와 동일
    rhoMax: 0.9,     // 배제 압력
    delta: 0.008,    // 소산율 (E → T)
    radT: 0.02,      // T 복사 = 전역 sink
    thE: 0.75,       // 발화 임계
    burstToT: 0.6,   // 발화 방출분 중 T 비율
    thRho: 0.30,     // agent 검출 밀도 임계
    lifeAge: 60,     // 항상성 판정: 최소 수명 (tick)
    metabEps: 1e-5,  // 항상성 판정: 최소 대사율
    srcRate: 0.05,
    snkRate: 0.10,
    contestR: 10,    // ★ 경합사망 판정 반경 (사망 시 이 안에 다른 생존 agent가 있으면 경합)
  };

  function createSim(N, opts) {
    opts = opts || {};
    const M = N * N;
    const z = () => new Float32Array(M);
    const sim = {
      N, M,
      wrap: opts.wrap !== false,
      E: z(), T: z(), rho: z(), A: z(),
      Abias: null,            // ★ 상위 층이 내려보내는 끌림 편향 (양방향 결합용, 기본 없음)
      dq: z(), dq2: z(),
      diss: z(),
      sources: [], sinks: [],
      params: Object.assign({}, DEFAULT_PARAMS, opts.params || {}),
      toggles: { source: true, diffuse: true, attract: true, dissipate: true, threshold: true, detect: true },
      tick: 0,
      injectedTick: 0, removedTick: 0,
      injected: 0, removed: 0,
      rho0: 0,
      agents: [], nextId: 1,
      deaths: [],
      births: 0, deathsTotal: 0, contested: 0,   // ★ 생멸 회전 장부
      external: null,         // ★ tick 시작 직후 호출되는 외부 주입 훅 (2층 승급이 사용)
      stats: null,
      rng: mulberry32(opts.seed == null ? 42 : opts.seed),
    };
    if (opts.emptyInit) {
      sim.rho0 = 0;           // ★ 2층용: 무에서 시작 (양은 승급으로만 들어온다)
    } else {
      for (let i = 0; i < M; i++) {
        sim.rho[i] = 0.10 + 0.15 * sim.rng();
        sim.A[i] = sim.rho[i];
      }
      sim.rho0 = sum(sim.rho);
    }
    return sim;
  }

  function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }

  function cellsInRadius(sim, cx, cy, r) {
    const out = [], N = sim.N;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      let x = cx + dx, y = cy + dy;
      if (sim.wrap) { x = (x + N) % N; y = (y + N) % N; }
      else if (x < 0 || x >= N || y < 0 || y >= N) continue;
      out.push(y * N + x);
    }
    return out;
  }

  /* ---------- [04] source / sink ---------- */
  function applySources(sim) {
    for (const s of sim.sources) {
      for (const i of s.cells) {
        sim.E[i] += s.rate;
        sim.injectedTick += s.rate;
      }
    }
  }
  function applySinks(sim) {
    for (const s of sim.sinks) {
      for (const i of s.cells) {
        const rE = sim.E[i] * s.rate, rT = sim.T[i] * s.rate;
        sim.E[i] -= rE; sim.T[i] -= rT;
        sim.removedTick += rE + rT;
      }
    }
  }

  /* ---------- [03-1] 확산 (플럭스 형태 = 보존) ---------- */
  function diffuse(sim, q, alpha) {
    const { N, dq } = sim; dq.fill(0);
    const k = alpha * 0.25;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (x + 1 < N || sim.wrap) {
        const j = y * N + ((x + 1) % N);
        const f = k * (q[j] - q[i]); dq[i] += f; dq[j] -= f;
      }
      if (y + 1 < N || sim.wrap) {
        const j = ((y + 1) % N) * N + x;
        const f = k * (q[j] - q[i]); dq[i] += f; dq[j] -= f;
      }
    }
    for (let i = 0; i < sim.M; i++) q[i] += dq[i];
  }

  /* ---------- [03-1b] 열 교반 ---------- */
  function diffuseRhoMelt(sim) {
    const { N, rho, T, dq } = sim; dq.fill(0);
    const a = sim.params.alphaRho, kT = sim.params.kT;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      for (let d = 0; d < 2; d++) {
        let j;
        if (d === 0) { if (x + 1 >= N && !sim.wrap) continue; j = y * N + ((x + 1) % N); }
        else { if (y + 1 >= N && !sim.wrap) continue; j = ((y + 1) % N) * N + x; }
        let k = 0.25 * a * (1 + kT * 0.5 * (T[i] + T[j]));
        if (k > 0.24) k = 0.24;
        const f = k * (rho[j] - rho[i]); dq[i] += f; dq[j] -= f;
      }
    }
    for (let i = 0; i < sim.M; i++) rho[i] += dq[i];
  }

  /* ---------- [03-2] 응집 (E를 태워야 모인다 = 대사) ----------
   * step-0003 변경점: A의 추종 목표가 rho → rho + wE·E (+ 상위층 편향 Abias).
   * wE > 0이면 끌림이 먹이(E)를 향하므로 덩어리가 E 쪽 가장자리에서 자라고
   * 반대쪽에서 줄어든다 = "기어간다". 새 항이 아니라 기존 되먹임의 목표값 변경. */
  function attract(sim) {
    const { N, rho, A, E, T, dq, diss } = sim;
    const g = sim.params.g, cost = sim.params.cost;
    dq.fill(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      for (let d = 0; d < 2; d++) {
        let j;
        if (d === 0) { if (x + 1 >= N && !sim.wrap) continue; j = y * N + ((x + 1) % N); }
        else { if (y + 1 >= N && !sim.wrap) continue; j = ((y + 1) % N) * N + x; }
        const dA = A[j] - A[i];
        if (dA === 0) continue;
        const from = dA > 0 ? i : j, to = dA > 0 ? j : i;
        const eff = E[from] / (E[from] + 0.15);
        const press = Math.max(0, 1 - rho[to] / sim.params.rhoMax);
        let move = g * Math.abs(dA) * rho[from] * eff * press * 0.25;
        const avail = rho[from] + dq[from];
        if (move > avail * 0.5) move = avail * 0.5;
        let c = cost * move;
        if (c > E[from]) { const sc = E[from] / c; move *= sc; c = E[from]; }
        if (move <= 0) continue;
        dq[from] -= move; dq[to] += move;
        E[from] -= c; T[from] += c; diss[from] += c;
      }
    }
    for (let i = 0; i < sim.M; i++) rho[i] += dq[i];
    // 응집 되먹임: A ← rho + wE·E (+ Abias). wE=0, Abias=null이면 step-0002와 동일.
    const kA = sim.params.kA, wE = sim.params.wE, B = sim.Abias;
    if (wE === 0 && !B) {
      for (let i = 0; i < sim.M; i++) A[i] += kA * (rho[i] - A[i]);
    } else {
      for (let i = 0; i < sim.M; i++) {
        const target = rho[i] + wE * E[i] + (B ? B[i] : 0);
        A[i] += kA * (target - A[i]);
      }
    }
    diffuse(sim, A, sim.params.alphaA);
    diffuse(sim, A, sim.params.alphaA);
  }

  /* ---------- [03-3] 소산·보존 + 복사 ---------- */
  function dissipate(sim) {
    const { E, T, diss } = sim;
    const delta = sim.params.delta, radT = sim.params.radT;
    for (let i = 0; i < sim.M; i++) {
      const d = delta * E[i];
      E[i] -= d; T[i] += d; diss[i] += d;
      const r = radT * T[i];
      T[i] -= r; sim.removedTick += r;
    }
  }

  /* ---------- [03-4] 임계: 발화 ---------- */
  function threshold(sim) {
    const { N, E, T, rho } = sim;
    const thE = sim.params.thE, toT = sim.params.burstToT;
    const burst = [];
    for (let i = 0; i < sim.M; i++) if (E[i] > thE) burst.push(i);
    for (const i of burst) {
      const released = E[i] * 0.7;
      E[i] *= 0.3;
      const x = i % N, y = (i / N) | 0;
      const ns = [];
      const push = (nx, ny) => {
        if (sim.wrap) ns.push(((ny + N) % N) * N + ((nx + N) % N));
        else if (nx >= 0 && nx < N && ny >= 0 && ny < N) ns.push(ny * N + nx);
      };
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      T[i] += released * toT;
      const spread = released * (1 - toT) / Math.max(1, ns.length);
      for (const n of ns) E[n] += spread;
      const scatter = rho[i] * 0.30 / Math.max(1, ns.length);
      for (const n of ns) { rho[n] += scatter; }
      rho[i] *= 0.70;
    }
    return burst.length;
  }

  /* ---------- [05] agent 검출 + 시간 추적 → 항상성 + ★행동 측정 ---------- */
  function wrapDist(sim, ax, ay, bx, by) {
    const N = sim.N;
    let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (sim.wrap) { dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); }
    return Math.sqrt(dx * dx + dy * dy);
  }

  function detectAgents(sim) {
    const { N, rho } = sim, thRho = sim.params.thRho;
    const seen = new Uint8Array(sim.M);
    const found = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (seen[i] || rho[i] < thRho) continue;
      const cells = [], stack = [i]; seen[i] = 1;
      while (stack.length) {
        const c = stack.pop(); cells.push(c);
        const cx = c % N, cy = (c / N) | 0;
        const cand = [];
        if (cx + 1 < N || sim.wrap) cand.push(cy * N + ((cx + 1) % N));
        if (cx - 1 >= 0 || sim.wrap) cand.push(cy * N + ((cx - 1 + N) % N));
        if (cy + 1 < N || sim.wrap) cand.push(((cy + 1) % N) * N + cx);
        if (cy - 1 >= 0 || sim.wrap) cand.push(((cy - 1 + N) % N) * N + cx);
        for (const n of cand) if (!seen[n] && rho[n] >= thRho) { seen[n] = 1; stack.push(n); }
      }
      if (cells.length < 3) continue;
      let mass = 0, mx = 0, my = 0, metab = 0;
      for (const c of cells) {
        mass += rho[c]; metab += sim.diss[c];
        mx += (c % N) * rho[c]; my += ((c / N) | 0) * rho[c];
      }
      found.push({ cells, mass, cx: mx / mass, cy: my / mass, metab });
    }
    const prev = sim.agents, used = new Uint8Array(found.length);
    const next = [];
    for (const p of prev) {
      let best = -1, bestD = 6 * 6;
      for (let k = 0; k < found.length; k++) {
        if (used[k]) continue;
        let dx = Math.abs(found[k].cx - p.cx), dy = Math.abs(found[k].cy - p.cy);
        if (sim.wrap) { dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); }
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = k; }
      }
      if (best >= 0) {
        used[best] = 1;
        const f = found[best];
        const ema = p.massEMA * 0.98 + f.mass * 0.02;
        const v = wrapDist(sim, f.cx, f.cy, p.cx, p.cy);         // ★ 이번 tick 이동량
        next.push({
          id: p.id, cells: f.cells, mass: f.mass, cx: f.cx, cy: f.cy,
          metab: f.metab, age: p.age + 1, massEMA: ema,
          speed: v,                                              // ★ 순간 속도 (셀/tick)
          speedEMA: p.speedEMA * 0.95 + v * 0.05,                // ★ 평활 속도
          dist: p.dist + v,                                      // ★ 누적 이동거리
          trail: p.trail,                                        // ★ 궤적 (UI용, 최대 64점)
        });
      } else {
        // 사망: 그 자리에 다른 생존 agent가 가까이 있었으면 "경합사망" = 경쟁의 흔적
        sim.deaths.push({ tick: sim.tick, age: p.age });
        if (sim.deaths.length > 200) sim.deaths.shift();
        sim.deathsTotal++;
        for (const q of prev) {
          if (q.id !== p.id && q.alive && wrapDist(sim, q.cx, q.cy, p.cx, p.cy) <= sim.params.contestR) {
            sim.contested++; break;
          }
        }
      }
    }
    for (let k = 0; k < found.length; k++) if (!used[k]) {
      const f = found[k];
      next.push({
        id: sim.nextId++, cells: f.cells, mass: f.mass, cx: f.cx, cy: f.cy,
        metab: f.metab, age: 0, massEMA: f.mass,
        speed: 0, speedEMA: 0, dist: 0, trail: [],
      });
      sim.births++;
    }
    sim.agents = next;
    const P = sim.params;
    for (const a of sim.agents) {
      a.alive = a.age >= P.lifeAge &&
        Math.abs(a.mass - a.massEMA) < 0.5 * a.massEMA &&
        a.metab > P.metabEps;
      if (a.alive && (sim.tick & 3) === 0) {                     // ★ 궤적 기록 (4tick마다)
        a.trail.push(a.cx, a.cy);
        if (a.trail.length > 128) a.trail.splice(0, 2);
      }
    }
  }

  /* ---------- tick 루프 ([07] 고정 순서) — 미시·거시가 같은 함수를 쓴다 ---------- */
  function step(sim) {
    const tg = sim.toggles;
    const prevTotal = sum(sim.E) + sum(sim.T);
    sim.injectedTick = 0; sim.removedTick = 0;
    sim.diss.fill(0);

    if (sim.external) sim.external(sim);                        // ★ 0. 외부 주입(승급 등) — 장부 기록 책임은 훅에 있음
    if (tg.source) { applySources(sim); applySinks(sim); }      // 1. [04]
    if (tg.diffuse) {                                           // 2. [03] 확산
      diffuse(sim, sim.T, sim.params.alphaT);
      diffuse(sim, sim.E, sim.params.alphaE);
      diffuseRhoMelt(sim);
    }
    if (tg.attract) attract(sim);                               // 3. [03] 응집(대사)
    if (tg.dissipate) dissipate(sim);                           // 4. [03] 소산+복사
    const bursts = tg.threshold ? threshold(sim) : 0;           // 5. [03] 임계
    sim.tick++;
    if (tg.detect) detectAgents(sim);                           // 7. [05] 검출·추적

    const totalE = sum(sim.E), totalT = sum(sim.T);
    const resid = (totalE + totalT) - (prevTotal + sim.injectedTick - sim.removedTick);
    const living = sim.agents.filter(a => a.alive);
    sim.injected += sim.injectedTick; sim.removed += sim.removedTick;
    sim.stats = {
      tick: sim.tick, totalE, totalT,
      totalRho: sum(sim.rho), rhoDrift: sum(sim.rho) - sim.rho0,
      resid, bursts,
      agentCount: sim.agents.length,
      livingCount: living.length,
      meanAge: living.length ? living.reduce((s, a) => s + a.age, 0) / living.length : 0,
      meanMetab: living.length ? living.reduce((s, a) => s + a.metab, 0) / living.length : 0,
      meanSpeed: living.length ? living.reduce((s, a) => s + a.speedEMA, 0) / living.length : 0, // ★
      dissRate: sum(sim.diss),
      recentDeaths: sim.deaths.length,
      births: sim.births, deathsTotal: sim.deathsTotal, contested: sim.contested,                // ★
    };
    return sim.stats;
  }

  function addSource(sim, x, y, r, rate) {
    sim.sources.push({ x, y, r, rate, cells: cellsInRadius(sim, x, y, r) });
  }
  function addSink(sim, x, y, r, rate) {
    sim.sinks.push({ x, y, r, rate, cells: cellsInRadius(sim, x, y, r) });
  }

  function defaultScenario(sim, srcRate) {
    sim.sources.length = 0; sim.sinks.length = 0;
    const N = sim.N;
    addSource(sim, (N * 0.25) | 0, (N * 0.25) | 0, 3, srcRate != null ? srcRate : sim.params.srcRate);
    addSink(sim, (N * 0.75) | 0, (N * 0.75) | 0, 4, sim.params.snkRate);
  }

  /* ============================================================
   * ★ [06] 재귀 2층 — 승급(promotion) + 동일 step() 재호출
   *
   * 상위 세계도 그냥 createSim()으로 만든 또 하나의 장이다. 다른 점은 단 둘:
   *  (a) 초기 양이 0 (emptyInit) — 거시의 양은 전부 아래에서 올라온다
   *  (b) source가 없고 대신 external 훅 = 승급 연산자가 양을 주입한다
   *      mass→ρ₂ (완화 주입: ρ₂가 살아있는 agent 질량 분포를 시정수 1/kP로 추종)
   *      metab→E₂ (대사 소득: 미시가 E를 태운 만큼 거시 에너지가 들어온다 = 거시의 source)
   * 법칙·검출·항상성 판정은 한 글자도 다르지 않은 같은 함수다.
   * ============================================================ */
  const MACRO_DEFAULTS = {
    N2: 16,           // 상위 격자 크기 (미시 64 → 거시 16, 4×4 셀이 거시 1셀)
    every: 4,         // 미시 몇 tick마다 거시 1 tick
    kPromote: 0.10,   // mass→ρ₂ 완화 주입 속도
    cE: 3.0,          // metab→E₂ 변환 계수 (대사 소득)
    scaleM: 0.25,     // mass→ρ₂ 스케일 (거시 ρ가 0~1 범위에 들도록)
    wBack: 0.0,       // 거시 A₂ → 미시 Abias 되먹임 강도 (0 = 하향 결합 끔)
    params: {         // 거시 법칙 파라미터 — 같은 법칙, 다른 상수 (스케일이 다르므로)
      wE: 0.5,        // 거시에도 행동을 켠다: 무리가 대사 소득을 향해 움직인다
      thRho: 0.20, lifeAge: 30, alphaRho: 0.03, kT: 3,
      g: 2.0, cost: 0.05, delta: 0.01, radT: 0.03, thE: 0.9,
    },
  };

  function createMacro(micro, opts) {
    opts = Object.assign({}, MACRO_DEFAULTS, opts || {});
    const mparams = Object.assign({}, MACRO_DEFAULTS.params, (opts || {}).params || {});
    const macro = createSim(opts.N2, { seed: 7, emptyInit: true, params: mparams, wrap: micro.wrap });
    macro.isMacro = true;
    const f = opts.N2 / micro.N;
    const Mf = new Float32Array(macro.M);   // 승급 작업 버퍼
    macro.external = function (m) {
      Mf.fill(0);
      let injE = 0;
      for (const a of micro.agents) {
        if (!a.alive) continue;
        const cx = Math.min(opts.N2 - 1, (a.cx * f) | 0);
        const cy = Math.min(opts.N2 - 1, (a.cy * f) | 0);
        const i = cy * opts.N2 + cx;
        Mf[i] += a.mass * opts.scaleM;          // mass → ρ₂ 목표 분포
        const e = a.metab * opts.cE;            // metab → E₂ 소득
        m.E[i] += e; injE += e;
      }
      for (let i = 0; i < m.M; i++) m.rho[i] += opts.kPromote * (Mf[i] - m.rho[i]);
      m.injectedTick += injE;                   // 보존 장부: 승급 소득은 거시의 주입
    };
    macro.couple = opts;
    return macro;
  }

  /* 거시 A₂를 미시 Abias로 내려보내기 (양방향 결합, wBack>0일 때) */
  function coupleDown(micro, macro, wBack) {
    if (!wBack) { micro.Abias = null; return; }
    if (!micro.Abias) micro.Abias = new Float32Array(micro.M);
    const N = micro.N, N2 = macro.N, f = N2 / N, B = micro.Abias;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i2 = Math.min(N2 - 1, (y * f) | 0) * N2 + Math.min(N2 - 1, (x * f) | 0);
      B[y * N + x] = wBack * macro.A[i2];
    }
  }

  /* 미시+거시를 함께 굴리는 헬퍼: 미시 step 후 every마다 거시 step */
  function stepCoupled(micro, macro) {
    const s = step(micro);
    if (macro && micro.tick % macro.couple.every === 0) {
      step(macro);
      coupleDown(micro, macro, macro.couple.wBack);
    }
    return s;
  }

  /* "생명의 창" 스윕 (미시 단독 또는 미시+거시) */
  function sweepWindow(N, rates, ticks, seed, paramsOverride, withMacro) {
    const out = [];
    for (const r of rates) {
      const sim = createSim(N, { seed: seed == null ? 42 : seed, params: paramsOverride });
      const macro = withMacro ? createMacro(sim, withMacro === true ? null : withMacro) : null;
      defaultScenario(sim, r);
      let livingSum = 0, burstSum = 0, n = 0;
      let macroLivingSum = 0, macroN = 0;
      let speedSum = 0;
      const tail = Math.floor(ticks * 2 / 3);
      for (let t = 0; t < ticks; t++) {
        const s = stepCoupled(sim, macro);
        if (t >= tail) {
          livingSum += s.livingCount; burstSum += s.bursts; speedSum += s.meanSpeed; n++;
          if (macro && macro.stats) { macroLivingSum += macro.stats.livingCount; macroN++; }
        }
      }
      out.push({
        rate: r,
        living: livingSum / n,
        bursts: burstSum / n,
        meanSpeed: speedSum / n,
        deaths: sim.deathsTotal, births: sim.births, contested: sim.contested,
        macroLiving: macroN ? macroLivingSum / macroN : 0,
        maxResid: Math.abs(sim.stats.resid),
        macroResid: macro && macro.stats ? Math.abs(macro.stats.resid) : 0,
      });
    }
    return out;
  }

  const SimCore = {
    createSim, step, stepCoupled, createMacro, coupleDown,
    addSource, addSink, defaultScenario, sweepWindow, sum,
    DEFAULT_PARAMS, MACRO_DEFAULTS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SimCore;
  else global.SimCore = SimCore;
})(typeof window !== 'undefined' ? window : globalThis);
