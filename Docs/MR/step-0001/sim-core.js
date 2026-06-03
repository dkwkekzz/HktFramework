/* ============================================================
 * step-0002 sim-core : 6요소 통합 시뮬레이션 코어 (브라우저/Node 겸용)
 * step-0001 문서의 설계를 그대로 구현:
 *  [01] N×N 격자, SoA Float32Array, 4-이웃, wrap/clamp
 *  [02] 양 E,T,rho,A (0~1 정규화 기준)
 *  [03] 법칙 4종: 확산/응집/소산·보존/임계 — 전부 플럭스(교환) 형태 = 수치적 보존
 *  [04] source/sink + 복사(radiation) = 기울기 엔진
 *  [05] agent 검출(flood fill) + 시간 추적 → 항상성 판정
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
    kA: 0.4,         // A가 rho를 추종하는 속도 (응집 되먹임)
    alphaA: 0.3,     // A 평활화 = 끌림의 사거리. 0이면 점 붕괴(체커보드 불안정)
    rhoMax: 0.9,     // 배제 압력: rho가 이 값에 가까울수록 더 못 들어옴 (점 붕괴 방지)
    delta: 0.008,    // 소산율 (E → T)
    radT: 0.02,      // T 복사 = 전역 sink (우주로 식음)
    thE: 0.75,       // 발화 임계
    burstToT: 0.6,   // 발화 방출분 중 T로 가는 비율 (나머지는 이웃 E로 전파)
    thRho: 0.30,     // agent 검출 밀도 임계
    lifeAge: 60,     // 항상성 판정: 최소 수명 (tick)
    metabEps: 1e-5,  // 항상성 판정: 최소 대사율
    srcRate: 0.05,   // 기본 source 강도
    snkRate: 0.10,   // 기본 sink 강도
  };

  function createSim(N, opts) {
    opts = opts || {};
    const M = N * N;
    const z = () => new Float32Array(M);
    const sim = {
      N, M,
      wrap: opts.wrap !== false,
      E: z(), T: z(), rho: z(), A: z(),
      dq: z(), dq2: z(),      // 플럭스 누적 작업 버퍼 (동기적 갱신 보장)
      diss: z(),              // 이번 tick 셀별 E→T 전환량 (대사 측정용)
      sources: [], sinks: [],
      params: Object.assign({}, DEFAULT_PARAMS, opts.params || {}),
      toggles: { source: true, diffuse: true, attract: true, dissipate: true, threshold: true, detect: true },
      tick: 0,
      injectedTick: 0, removedTick: 0,   // 이번 tick 장부
      injected: 0, removed: 0,           // 누적 장부
      rho0: 0,
      agents: [], nextId: 1,
      deaths: [],            // 최근 사망 기록 {tick, age}
      stats: null,
      rng: mulberry32(opts.seed == null ? 42 : opts.seed),
    };
    // [02] 초기화: rho/A 약한 난수, E/T는 0 — "무에서 구조가 떠오르는가"
    for (let i = 0; i < M; i++) {
      sim.rho[i] = 0.10 + 0.15 * sim.rng();
      sim.A[i] = sim.rho[i];
    }
    sim.rho0 = sum(sim.rho);
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
        sim.E[i] += s.rate;           // 무제한 주입 — 과잉은 임계 발화로 터진다
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
      // 오른쪽 이웃
      if (x + 1 < N || sim.wrap) {
        const j = y * N + ((x + 1) % N);
        const f = k * (q[j] - q[i]); dq[i] += f; dq[j] -= f;
      }
      // 아래 이웃
      if (y + 1 < N || sim.wrap) {
        const j = ((y + 1) % N) * N + x;
        const f = k * (q[j] - q[i]); dq[i] += f; dq[j] -= f;
      }
    }
    for (let i = 0; i < sim.M; i++) q[i] += dq[i];
  }

  /* ---------- [03-1b] 열 교반: T가 높은 곳일수록 rho가 빨리 흩어진다 ----------
   * 같은 플럭스 형태(보존). 변동 계수 = alphaRho*(1 + kT*T_edge). */
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
        if (k > 0.24) k = 0.24;                       // 수치 안정 상한
        const f = k * (rho[j] - rho[i]); dq[i] += f; dq[j] -= f;
      }
    }
    for (let i = 0; i < sim.M; i++) rho[i] += dq[i];
  }

  /* ---------- [03-2] 응집 (E를 태워야 모인다 = 대사) ----------
   * rho가 A 높은 쪽으로 흐른다. 단, 옮기려면 donor의 E가 필요하고
   * 그 비용은 T로 전환된다(보존). E가 없으면 응집 불가 → 구조는 굶으면 흩어진다. */
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
        const eff = E[from] / (E[from] + 0.15);          // 대사 게이트: E 없으면 못 움직임
        const press = Math.max(0, 1 - rho[to] / sim.params.rhoMax); // 배제 압력
        let move = g * Math.abs(dA) * rho[from] * eff * press * 0.25;
        const avail = rho[from] + dq[from];
        if (move > avail * 0.5) move = avail * 0.5;       // 한 tick 과도 이동 방지
        let c = cost * move;                              // 대사 비용
        if (c > E[from]) { const sc = E[from] / c; move *= sc; c = E[from]; }
        if (move <= 0) continue;
        dq[from] -= move; dq[to] += move;
        E[from] -= c; T[from] += c; diss[from] += c;      // E→T (보존)
      }
    }
    for (let i = 0; i < sim.M; i++) rho[i] += dq[i];
    // 응집 되먹임: A는 rho를 추종 → 덩어리가 더 끌어당김
    const kA = sim.params.kA;
    for (let i = 0; i < sim.M; i++) A[i] += kA * (rho[i] - A[i]);
    // 끌림의 사거리: A를 평활화 → 한 점이 아니라 '덩어리'가 끌어당긴다
    // (이게 없으면 셀 단위 점 붕괴 = 체커보드 불안정이 생긴다)
    diffuse(sim, A, sim.params.alphaA);
    diffuse(sim, A, sim.params.alphaA);
  }

  /* ---------- [03-3] 소산·보존 + 복사 ---------- */
  function dissipate(sim) {
    const { E, T, diss } = sim;
    const delta = sim.params.delta, radT = sim.params.radT;
    for (let i = 0; i < sim.M; i++) {
      const d = delta * E[i];
      E[i] -= d; T[i] += d; diss[i] += d;   // E→T
      const r = radT * T[i];                // T 복사 = 전역 sink
      T[i] -= r; sim.removedTick += r;
    }
  }

  /* ---------- [03-4] 임계: 발화 ----------
   * E가 임계를 넘으면 불연속 사건: E의 70%가 방출되어
   * 일부는 T로(소산), 일부는 이웃 E로(연쇄 전파). rho 일부가 이웃으로 흩어짐(보존). */
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
      const scatter = rho[i] * 0.30 / Math.max(1, ns.length); // 구조 파괴
      for (const n of ns) { rho[n] += scatter; }
      rho[i] *= 0.70;
    }
    return burst.length;
  }

  /* ---------- [05] agent 검출 + 시간 추적 → 항상성 ---------- */
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
      if (cells.length < 3) continue; // 노이즈 컷
      let mass = 0, mx = 0, my = 0, metab = 0;
      for (const c of cells) {
        mass += rho[c]; metab += sim.diss[c];
        mx += (c % N) * rho[c]; my += ((c / N) | 0) * rho[c];
      }
      found.push({ cells, mass, cx: mx / mass, cy: my / mass, metab });
    }
    // 시간 추적: 직전 agent와 centroid 최근접 매칭
    const prev = sim.agents, used = new Uint8Array(found.length);
    const next = [];
    for (const p of prev) {
      let best = -1, bestD = 6 * 6; // 매칭 반경 6셀
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
        next.push({
          id: p.id, cells: f.cells, mass: f.mass, cx: f.cx, cy: f.cy,
          metab: f.metab, age: p.age + 1, massEMA: ema,
        });
      } else {
        sim.deaths.push({ tick: sim.tick, age: p.age }); // 소멸 = 생멸 기록
        if (sim.deaths.length > 200) sim.deaths.shift();
      }
    }
    for (let k = 0; k < found.length; k++) if (!used[k]) {
      const f = found[k];
      next.push({ id: sim.nextId++, cells: f.cells, mass: f.mass, cx: f.cx, cy: f.cy, metab: f.metab, age: 0, massEMA: f.mass });
    }
    sim.agents = next;
    // 항상성 판정: 수명 + 질량 안정 + 대사 > 0
    const P = sim.params;
    for (const a of sim.agents) {
      a.alive = a.age >= P.lifeAge &&
        Math.abs(a.mass - a.massEMA) < 0.5 * a.massEMA &&
        a.metab > P.metabEps;
    }
  }

  /* ---------- tick 루프 ([07] 고정 순서) ---------- */
  function step(sim) {
    const tg = sim.toggles;
    const prevTotal = sum(sim.E) + sum(sim.T);
    sim.injectedTick = 0; sim.removedTick = 0;
    sim.diss.fill(0);

    if (tg.source) { applySources(sim); applySinks(sim); }      // 1. [04]
    if (tg.diffuse) {                                           // 2. [03] 확산
      diffuse(sim, sim.T, sim.params.alphaT);
      diffuse(sim, sim.E, sim.params.alphaE);
      diffuseRhoMelt(sim);                                      //    엔트로피+열 교반: 구조를 흩는다
    }
    if (tg.attract) attract(sim);                               // 3. [03] 응집(대사)
    if (tg.dissipate) dissipate(sim);                           // 4. [03] 소산+복사
    const bursts = tg.threshold ? threshold(sim) : 0;           // 5. [03] 임계
    sim.tick++;
    if (tg.detect) detectAgents(sim);                           // 7. [05] 검출·추적

    // 9. 지표
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
      dissRate: sum(sim.diss),
      recentDeaths: sim.deaths.length,
    };
    return sim.stats;
  }

  function addSource(sim, x, y, r, rate) {
    sim.sources.push({ x, y, r, rate, cells: cellsInRadius(sim, x, y, r) });
  }
  function addSink(sim, x, y, r, rate) {
    sim.sinks.push({ x, y, r, rate, cells: cellsInRadius(sim, x, y, r) });
  }

  /* 기본 시나리오: 대각선 기울기 (한쪽 source, 반대쪽 sink) */
  function defaultScenario(sim, srcRate) {
    sim.sources.length = 0; sim.sinks.length = 0;
    const N = sim.N;
    addSource(sim, (N * 0.25) | 0, (N * 0.25) | 0, 3, srcRate != null ? srcRate : sim.params.srcRate);
    addSink(sim, (N * 0.75) | 0, (N * 0.75) | 0, 4, sim.params.snkRate);
  }

  /* "생명의 창" 스윕: source 강도별로 새 시뮬을 돌려 살아있는 agent 수 측정 */
  function sweepWindow(N, rates, ticks, seed, paramsOverride) {
    const out = [];
    for (const r of rates) {
      const sim = createSim(N, { seed: seed == null ? 42 : seed, params: paramsOverride });
      defaultScenario(sim, r);
      let livingSum = 0, deathSum = 0, n = 0, burstSum = 0;
      const tail = Math.floor(ticks * 2 / 3);
      let prevDeaths = 0;
      for (let t = 0; t < ticks; t++) {
        const s = step(sim);
        if (t >= tail) {
          livingSum += s.livingCount; burstSum += s.bursts; n++;
          deathSum += sim.deaths.length - prevDeaths > 0 ? sim.deaths.length - prevDeaths : 0;
        }
        prevDeaths = sim.deaths.length;
      }
      out.push({
        rate: r,
        living: livingSum / n,
        bursts: burstSum / n,
        deaths: deathSum,
        maxResid: Math.abs(sim.stats.resid),
      });
    }
    return out;
  }

  const SimCore = { createSim, step, addSource, addSink, defaultScenario, sweepWindow, sum, DEFAULT_PARAMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = SimCore;
  else global.SimCore = SimCore;
})(typeof window !== 'undefined' ? window : globalThis);
