/* ============================================================
 * step-0005 sim-core : step-0004 코어를 그대로 잇는다
 * step-0004 까지: 행동(wE) + 재귀 2층(승급) + 하향 A-편향(wBack).
 * step-0005 가 더하는 단 하나 — 하향 *에너지* 채널 (재앙의 원형):
 *   거시 발화(burst)가 그 거시 셀이 덮는 미시 영역에 열(T)을 쏟아붓는다.
 *   - 승급(미시 대사 → 거시 E)의 정확한 대칭: 거시 발화 → 미시 T.
 *   - 신호 결합이다 — 받는 층(미시)의 장부(injectedTick)에 기록해 미시 장부를 닫는다.
 *     (승급도 같은 성질: 거시 E 소득은 거시 장부의 주입이고, 미시는 손실을 기록하지 않는다.
 *      층간 결합은 "신호 → 소득"이며 각 층의 장부가 독립적으로 닫힌다 — [06] 재귀의 원칙.)
 * 새 법칙이 아니다. 발화는 [03] 임계가 이미 만든다. 채널은 그 방출분의 일부를 아래로
 * 돌리는 *연산자* 하나(coupleDownEnergy)이며, wDown=0 이면 step-0004 와 비트 단위로 동일하다.
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
    wE: 0.0,         // 끌림의 E 추종 가중치. 0 = step-0002와 동일
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
    contestR: 10,    // 경합사망 판정 반경
  };

  function createSim(N, opts) {
    opts = opts || {};
    const M = N * N;
    const z = () => new Float32Array(M);
    const sim = {
      N, M,
      wrap: opts.wrap !== false,
      E: z(), T: z(), rho: z(), A: z(),
      Abias: null,            // 상위 층이 내려보내는 끌림 편향 (wBack)
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
      births: 0, deathsTotal: 0, contested: 0,
      external: null,         // tick 시작 직후 호출되는 외부 주입 훅 (승급·하향에너지가 사용)
      lastBurst: [],          // ★ step-0005: 이번 tick 발화한 셀 [{i, released}] — 하향 에너지 채널이 읽는다 (순수 측정)
      pendingDownT: null,     // ★ step-0005: 상위 발화가 예약한 미시 T 주입 버퍼 (다음 step에서 external 이 비운다)
      stats: null,
      rng: mulberry32(opts.seed == null ? 42 : opts.seed),
    };
    if (opts.emptyInit) {
      sim.rho0 = 0;
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

  /* ---------- [03-2] 응집 (E를 태워야 모인다 = 대사) ---------- */
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

  /* ---------- [03-4] 임계: 발화 ----------
   * step-0005: 발화한 셀과 방출 에너지를 sim.lastBurst 에 기록한다 (순수 측정 — 동역학 불변).
   * 미시에서는 읽는 곳이 없어 무해하고, 거시에서는 하향 에너지 채널이 이걸 읽어 미시로 열을 내린다. */
  function threshold(sim) {
    const { N, E, T, rho } = sim;
    const thE = sim.params.thE, toT = sim.params.burstToT;
    sim.lastBurst.length = 0;                                  // ★ 매 tick 초기화
    const burst = [];
    for (let i = 0; i < sim.M; i++) if (E[i] > thE) burst.push(i);
    for (const i of burst) {
      const released = E[i] * 0.7;
      sim.lastBurst.push({ i, released });                     // ★ 발화 셀 + 방출분 기록
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

  /* ---------- [05] agent 검출 + 시간 추적 → 항상성 + 행동 측정 ---------- */
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
        const v = wrapDist(sim, f.cx, f.cy, p.cx, p.cy);
        next.push({
          id: p.id, cells: f.cells, mass: f.mass, cx: f.cx, cy: f.cy,
          metab: f.metab, age: p.age + 1, massEMA: ema,
          speed: v,
          speedEMA: p.speedEMA * 0.95 + v * 0.05,
          dist: p.dist + v,
          trail: p.trail,
        });
      } else {
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
      if (a.alive && (sim.tick & 3) === 0) {
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

    if (sim.external) sim.external(sim);                        // 0. 외부 주입(승급·하향에너지) — 장부 기록 책임은 훅에 있음
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
      meanSpeed: living.length ? living.reduce((s, a) => s + a.speedEMA, 0) / living.length : 0,
      dissRate: sum(sim.diss),
      recentDeaths: sim.deaths.length,
      births: sim.births, deathsTotal: sim.deathsTotal, contested: sim.contested,
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
   * [06] 재귀 2층 — 승급(promotion) + 동일 step() 재호출 + ★하향 에너지 채널
   * ============================================================ */
  const MACRO_DEFAULTS = {
    N2: 16,           // 상위 격자 크기
    every: 4,         // 미시 몇 tick마다 거시 1 tick
    kPromote: 0.10,   // mass→ρ₂ 완화 주입 속도
    cE: 3.0,          // metab→E₂ 변환 계수 (대사 소득)
    scaleM: 0.25,     // mass→ρ₂ 스케일
    wBack: 0.0,       // 거시 A₂ → 미시 Abias (조향 하향 결합)
    wDown: 0.0,       // ★ step-0005: 거시 발화 방출분 → 미시 T 주입 강도 (에너지 하향 결합). 0 = step-0004와 동일
    params: {
      wE: 0.5,
      thRho: 0.20, lifeAge: 30, alphaRho: 0.03, kT: 3,
      g: 2.0, cost: 0.05, delta: 0.01, radT: 0.03, thE: 0.9,
      // thE=0.9 는 step-0004 기본값(회귀 보존). "발화=사건화"를 위한 thE₂ 상향은 실험에서 override.
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
      m.injectedTick += injE;                   // 거시 장부: 승급 소득은 거시의 주입
    };
    macro.couple = opts;

    // ★ 하향 에너지 채널: 미시에 T 주입 버퍼 + drain 훅을 단다 (wDown 과 무관하게 설치 — 실험에서 라이브 토글 가능).
    // 미시 external = 예약된 하향 T 를 미시 step 시작에 주입하고 미시 장부(injectedTick)에 기록 → 미시 장부 닫힘.
    micro.pendingDownT = new Float32Array(micro.M);
    micro.external = function (m) {
      const p = m.pendingDownT;
      let inj = 0;
      for (let i = 0; i < m.M; i++) if (p[i] !== 0) { m.T[i] += p[i]; inj += p[i]; p[i] = 0; }
      if (inj) m.injectedTick += inj;           // 미시 장부: 하향 에너지는 미시의 주입 (승급의 대칭)
    };
    return macro;
  }

  /* 거시 A₂를 미시 Abias로 내려보내기 (조향 하향 결합, wBack>0일 때) */
  function coupleDown(micro, macro, wBack) {
    if (!wBack) { micro.Abias = null; return; }
    if (!micro.Abias) micro.Abias = new Float32Array(micro.M);
    const N = micro.N, N2 = macro.N, f = N2 / N, B = micro.Abias;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i2 = Math.min(N2 - 1, (y * f) | 0) * N2 + Math.min(N2 - 1, (x * f) | 0);
      B[y * N + x] = wBack * macro.A[i2];
    }
  }

  /* ★ 거시 발화 → 미시 T 주입 예약 (에너지 하향 결합, wDown>0일 때) ----------
   * 거시 셀 i 가 방출분 released 로 발화하면, 그 셀이 덮는 미시 f×f 블록에 wDown·released 만큼의
   * 열을 고르게 예약한다. 실제 주입·장부 기록은 다음 미시 step 의 micro.external 이 한다.
   * T 는 [03-1b] 열 교반으로 rho 를 녹이고 [03-3] 복사로 빠져나간다 = 일시적 "열파" = 재앙. */
  function coupleDownEnergy(micro, macro, wDown) {
    if (!wDown || !macro.lastBurst.length) return;
    const N = micro.N, N2 = macro.N, f = (N / N2) | 0;   // f = 미시 한 변당 미시 셀 수 (64/16 = 4)
    const cells = f * f;
    const p = micro.pendingDownT;
    for (const b of macro.lastBurst) {
      const mx = b.i % N2, my = (b.i / N2) | 0;
      const per = wDown * b.released / cells;
      const ox = mx * f, oy = my * f;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        p[(oy + dy) * N + (ox + dx)] += per;
      }
    }
  }

  /* 미시+거시를 함께 굴리는 헬퍼: 미시 step 후 every마다 거시 step + 양방향 결합 */
  function stepCoupled(micro, macro) {
    const s = step(micro);
    if (macro && micro.tick % macro.couple.every === 0) {
      step(macro);
      coupleDown(micro, macro, macro.couple.wBack);
      coupleDownEnergy(micro, macro, macro.couple.wDown);   // ★ 거시 발화 → 미시 T 예약
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
    createSim, step, stepCoupled, createMacro, coupleDown, coupleDownEnergy,
    addSource, addSink, defaultScenario, sweepWindow, sum,
    DEFAULT_PARAMS, MACRO_DEFAULTS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SimCore;
  else global.SimCore = SimCore;
})(typeof window !== 'undefined' ? window : globalThis);
