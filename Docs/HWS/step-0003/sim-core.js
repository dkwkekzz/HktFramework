/* HWS step-0003 sim-core — 자원을 먹는 패턴(생명)이 스스로를 유지하는 세계
 * step-0002(확산·증발·구동·응집) 을 잇는다. 더해진 것은 단 하나: 생명(Life).
 *   생명 = 자원(고임)의 E 를 흡수해 *유지 비용*(대사)을 내며 존속하는 국소 패턴.
 *   - 흡수(absorb): 입(반경 lifeR 원판)의 E 의 kL 비율을 끌어와 생물량 m 으로.   E → m
 *   - 유지(maintain): 매 tick 생물량의 mMaint 비율을 대사로 소비(소산).            m → metabolized
 *   - 사망(death): m 이 mDeath 미만으로 떨어지면 죽고 남은 m 을 터(E)로 되돌림.    m → E
 *   생물량의 정상상태 m* ≈ (kL·Σ입E)/mMaint — 자원이 많을수록 크고, 마르면 0(=죽음).
 * 회귀: 에이전트가 없으면(sim.agents 비어 있음) 생명 블록을 통째로 건너뜀
 *       → step-0002 식·순서와 비트 단위 동일.
 * 닫힌 장부: sumE + M(=Σm) + evaporated + sunk + metabolized - injected = E0.
 *   흡수(E↓ m↑)·유지(m↓ metabolized↑)·사망(m↓ E↑) 셋 다 한 변에서 다른 변으로의 이동.
 * 브라우저/Node 겸용. step-0003.html 의 인라인 코어는 이 파일과 동일해야 한다.
 */
(function (global) {
  'use strict';

  /* ── 결정론적 PRNG (mulberry32) — 초기 노이즈에만 사용 ── */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 표준 시나리오 파라미터 (step 간 수치 비교를 위해 고정) ── */
  var DEFAULTS = {
    W: 64, H: 64,          // 터: 격자 크기 (wrap)
    kD: 0.20,              // 확산 계수 (4이웃, 안정 조건 kD <= 0.25)
    kEvap: 0.001,          // 증발률 — 매 tick E 의 kEvap 비율이 장부 T 로
    initE: 1.0,            // 초기 평균 E
    noise: 0.5,            // 초기 노이즈 진폭 (시드로 결정)
    source: { x: 16, y: 16, r: 3, rate: 0.05 },  // 셀당/tick당 주입량
    sink:   { x: 48, y: 48, r: 4, rate: 0.10 },  // 셀 E 의 비율 제거
    drive: true,           // 구동 on/off — off 면 source·sink 둘 다 정지
    /* ── step-0002: 응집(농도 창 안의 uphill 흐름) ── */
    kA: 0,                 // 응집 강도. 기본 0 = off = step-0001 과 비트 동일
    aggMc: 1.1,            // 농도 창 중심
    aggW: 0.7,             // 농도 창 반폭 (|m-mc|>=w 면 응집 0)
    /* ── step-0003 신규: 생명(자원을 먹는 자기유지 패턴) ── */
    life: true,            // 생명 법칙 on/off. 단, 에이전트가 없으면 어차피 no-op(회귀)
    kL: 0.05,              // 흡수율 — 매 tick 입(disc)의 E 의 이 비율을 생물량으로
    mMaint: 0.03,          // 유지율 — 매 tick 생물량의 이 비율을 대사로 소산
    mDeath: 0.05,          // 사망 임계 — m 이 이 값 미만이면 사망
    mSeed: 0.50,           // 스폰 시 초기 생물량
    lifeR: 1               // 입 반경(흡수 원판). 1 = 자신+4이웃(von Neumann 근사 disc)
  };

  /* 반경 r 원판에 포함되는 셀 인덱스 목록 (wrap) */
  function discCells(W, H, cx, cy, r) {
    var cells = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          var x = (cx + dx + W) % W, y = (cy + dy + H) % H;
          cells.push(y * W + x);
        }
      }
    }
    return cells;
  }

  function createSim(seed, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    p.source = Object.assign({}, DEFAULTS.source, (params && params.source) || {});
    p.sink = Object.assign({}, DEFAULTS.sink, (params && params.sink) || {});
    var rng = mulberry32(seed);
    var N = p.W * p.H;
    var E = new Float64Array(N);
    for (var i = 0; i < N; i++) E[i] = p.initE + p.noise * (rng() - 0.5);
    var E0 = 0;
    for (i = 0; i < N; i++) E0 += E[i];
    return {
      p: p, seed: seed, tick: 0,
      E: E, buf: new Float64Array(N),
      srcCells: discCells(p.W, p.H, p.source.x, p.source.y, p.source.r),
      sinkCells: discCells(p.W, p.H, p.sink.x, p.sink.y, p.sink.r),
      E0: E0,                                  // 초기 총량 (장부의 기준점)
      injected: 0, evaporated: 0, sunk: 0,     // 닫힌 장부 T (step-0002 그대로)
      /* ── step-0003: 생명 ── */
      agents: [],          // 살아있는 에이전트 목록 (비면 생명 법칙 no-op = 회귀)
      metabolized: 0,      // 대사로 소산된 총량 (장부의 새 항)
      deaths: 0            // 누적 사망 수 (통계용 — 장부와 무관)
    };
  }

  /* 농도 창 커널 — 포물선 bump. m=mc 에서 1, |m-mc|>=w 에서 0 (compact support). */
  function aggKernel(m, mc, w) {
    var t = (m - mc) / w;
    t = t * t;
    return t < 1 ? 1 - t : 0;
  }

  /* 생명 스폰 — (x,y)에 에이전트를 놓는다. 초기 생물량은 *터에서 끌어온다*:
   * 중심 셀의 E 에서 m0(기본 mSeed)만큼 떼어 생물량으로 — 닫힌 장부(E↓ m↑) 유지.
   * 자원이 부족하면 있는 만큼만 떼어 가므로(음수 E 없음), 자원 없는 곳에선 곧 굶어 죽는다
   * (= 생명은 자원이 있는 곳에서만 태어날 수 있다). 입 셀(disc lifeR)을 미리 계산해 둔다. */
  function spawnAgent(sim, x, y, m0) {
    var p = sim.p;
    var cx = ((x % p.W) + p.W) % p.W, cy = ((y % p.H) + p.H) % p.H;
    var center = cy * p.W + cx;
    var want = m0 != null ? m0 : p.mSeed;
    var seedM = sim.E[center] < want ? sim.E[center] : want;  // 가용 E 한도 내에서
    sim.E[center] -= seedM;                                   // E → m (출생 비용)
    var a = {
      x: cx, y: cy, m: seedM,
      cells: discCells(p.W, p.H, cx, cy, p.lifeR),
      center: center, bornTick: sim.tick
    };
    sim.agents.push(a);
    return a;
  }

  /* 법칙 적용 순서 고정: ① 확산(+응집) → ② 증발 → ③ 주입 → ④ 배출 → ⑤ 생명
   * — 순서가 결과를 바꾸므로 이후 step 에서도 이 순서를 유지한다.
   * 생명(⑤)은 매 tick 갓 구동된 터에서 자원을 먹는다. */
  function step(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var kA = p.kA, mc = p.aggMc, w = p.aggW;
    var x, y, i, d;
    /* ① 확산(+응집) — 4이웃, wrap. 총량 보존 (step-0002 식 그대로) */
    for (y = 0; y < H; y++) {
      var yN = ((y - 1 + H) % H) * W, yS = ((y + 1) % H) * W, yC = y * W;
      for (x = 0; x < W; x++) {
        var xW = (x - 1 + W) % W, xE = (x + 1) % W;
        i = yC + x;
        var eN = E[yN + x], eS = E[yS + x], eWc = E[yC + xW], eEc = E[yC + xE], ei = E[i];
        B[i] = ei + kD * (eN + eS + eWc + eEc - 4 * ei);
        if (kA !== 0) {
          B[i] += kA * (
            aggKernel(ei < eN ? ei : eN, mc, w) * (ei - eN) +
            aggKernel(ei < eS ? ei : eS, mc, w) * (ei - eS) +
            aggKernel(ei < eWc ? ei : eWc, mc, w) * (ei - eWc) +
            aggKernel(ei < eEc ? ei : eEc, mc, w) * (ei - eEc)
          );
        }
      }
    }
    sim.E = B; sim.buf = E; E = sim.E;
    /* ② 증발 */
    var kEvap = p.kEvap, evap = 0;
    for (i = 0; i < W * H; i++) { d = E[i] * kEvap; E[i] -= d; evap += d; }
    sim.evaporated += evap;
    /* ③④ 구동 */
    if (p.drive) {
      var sc = sim.srcCells, rate = p.source.rate;
      for (i = 0; i < sc.length; i++) E[sc[i]] += rate;
      sim.injected += rate * sc.length;
      var kc = sim.sinkCells, srate = p.sink.rate, snk = 0;
      for (i = 0; i < kc.length; i++) { d = E[kc[i]] * srate; E[kc[i]] -= d; snk += d; }
      sim.sunk += snk;
    }
    /* ⑤ 생명 — 에이전트가 없으면 통째로 건너뜀(회귀 0). 흡수·유지·사망 모두 닫힌 장부.
     * 각 에이전트: (a) 입의 E 를 kL 비율 흡수 → m  (b) m 의 mMaint 비율 대사 소산
     *             (c) m < mDeath 면 사망 — 남은 m 을 중심 셀의 E 로 되돌림. */
    if (p.life && sim.agents.length) {
      var ag = sim.agents, kL = p.kL, mMaint = p.mMaint, mDeath = p.mDeath;
      var survivors = [];
      for (var k = 0; k < ag.length; k++) {
        var a = ag[k], cells = a.cells;
        /* (a) 흡수: E → m (각 셀의 kL 비율 — kL<1 이므로 E>=0 유지) */
        var got = 0;
        for (var c = 0; c < cells.length; c++) {
          var idx = cells[c], take = E[idx] * kL;
          E[idx] -= take; got += take;
        }
        a.m += got;
        /* (b) 유지: m → metabolized (생물량 비례 소산 → 정상상태 고정점) */
        var cost = a.m * mMaint;
        a.m -= cost; sim.metabolized += cost;
        /* (c) 사망: 남은 m → E (분해), 에이전트 제거 */
        if (a.m < mDeath) {
          E[a.center] += a.m; a.m = 0;
          a.deathTick = sim.tick; sim.deaths++;
        } else {
          survivors.push(a);
        }
      }
      sim.agents = survivors;
    }
    sim.tick++;
  }

  function run(sim, ticks) { for (var t = 0; t < ticks; t++) step(sim); return sim; }

  /* 총 생물량 M = Σ 에이전트.m (장부 항. 드리프트 없이 직접 합산) */
  function totalBiomass(sim) {
    var M = 0, ag = sim.agents;
    for (var k = 0; k < ag.length; k++) M += ag[k].m;
    return M;
  }

  /* 닫힌 장부 검사: sumE + M + evaporated + sunk + metabolized - injected = E0
   * 상대 잔차 = |위반량| / max(1, E0 + injected). 생명 off 면 M=metabolized=0 → step-0002 식. */
  function ledger(sim) {
    var sumE = 0, E = sim.E;
    for (var i = 0; i < E.length; i++) sumE += E[i];
    var M = totalBiomass(sim);
    var lhs = sumE + M + sim.evaporated + sim.sunk + sim.metabolized - sim.injected;
    var scale = Math.max(1, sim.E0 + sim.injected);
    return { sumE: sumE, biomass: M, residual: Math.abs(lhs - sim.E0) / scale };
  }

  /* 측정: 총량·평균·공간 분산·최대 */
  function measure(sim) {
    var E = sim.E, N = E.length, sum = 0, i;
    for (i = 0; i < N; i++) sum += E[i];
    var mean = sum / N, v = 0, mx = -Infinity;
    for (i = 0; i < N; i++) {
      var dd = E[i] - mean; v += dd * dd;
      if (E[i] > mx) mx = E[i];
    }
    return { sumE: sum, mean: mean, varE: v / N, maxE: mx };
  }

  /* 고임(자원의 원형) 검출 — step-0002 와 동일. source 아닌 곳의 지속 봉우리. */
  function detectPools(sim, opt) {
    opt = opt || {};
    var minE = opt.minE != null ? opt.minE : 1.5;
    var prom = opt.prom != null ? opt.prom : 0.3;
    var excl = opt.excl != null ? opt.excl : sim.p.source.r + 4;
    var p = sim.p, W = p.W, H = p.H, E = sim.E;
    var sx = p.source.x, sy = p.source.y;
    var out = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x, ei = E[i];
        if (ei < minE) continue;
        var dxs = Math.min((x - sx + W) % W, (sx - x + W) % W);
        var dys = Math.min((y - sy + H) % H, (sy - y + H) % H);
        if (dxs * dxs + dys * dys <= excl * excl) continue;
        var isMax = true, ring = 0, cnt = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = (x + dx + W) % W, ny = (y + dy + H) % H, en = E[ny * W + nx];
            if (en > ei) isMax = false;
            ring += en; cnt++;
          }
        }
        if (!isMax) continue;
        var pr = ei - ring / cnt;
        if (pr < prom) continue;
        out.push({ x: x, y: y, e: ei, prom: pr });
      }
    }
    out.sort(function (a, b) { return b.e - a.e; });
    return out;
  }

  /* 수확 — step-0002 와 동일. 반경 r 원판의 E 를 제거하고 장부(sunk)에 기록. */
  function harvest(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, removed = 0;
    for (var k = 0; k < cells.length; k++) { removed += E[cells[k]]; E[cells[k]] = 0; }
    sim.sunk += removed;
    return removed;
  }

  /* 국소 E 합 — (cx,cy) 중심 반경 r 원판의 E 총합. 자원 고갈/회복 측정용. */
  function localE(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, s = 0;
    for (var k = 0; k < cells.length; k++) s += E[cells[k]];
    return s;
  }

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용.
   * E 비트열 + 기본 장부 + 생명(metabolized, 각 에이전트 x,y,m). */
  function hashState(sim) {
    var h = 0x811c9dc5 >>> 0;
    function feed(buf) {
      var dv = new DataView(buf);
      for (var j = 0; j < dv.byteLength; j++) {
        h = (h ^ dv.getUint8(j)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    feed(sim.E.buffer);
    feed(new Float64Array([sim.injected, sim.evaporated, sim.sunk, sim.metabolized, sim.tick]).buffer);
    var ag = sim.agents;
    feed(new Float64Array([ag.length]).buffer);
    for (var k = 0; k < ag.length; k++) feed(new Float64Array([ag[k].x, ag[k].y, ag[k].m]).buffer);
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* 기본 장부만 해시 — 회귀 검사(step-0002 와 비트 동일)용.
   * step-0002 hashState 와 같은 필드만 해시한다(생명 항 제외). */
  function hashBase(sim) {
    var h = 0x811c9dc5 >>> 0;
    var dv = new DataView(sim.E.buffer);
    for (var i = 0; i < dv.byteLength; i++) {
      h = (h ^ dv.getUint8(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
    }
    var meta = new Float64Array([sim.injected, sim.evaporated, sim.sunk, sim.tick]);
    var mv = new DataView(meta.buffer);
    for (i = 0; i < mv.byteLength; i++) {
      h = (h ^ mv.getUint8(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  var api = {
    DEFAULTS: DEFAULTS, mulberry32: mulberry32, createSim: createSim,
    aggKernel: aggKernel, spawnAgent: spawnAgent, step: step, run: run,
    totalBiomass: totalBiomass, ledger: ledger, measure: measure,
    detectPools: detectPools, harvest: harvest, localE: localE,
    hashState: hashState, hashBase: hashBase
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS3 = api;
})(typeof window !== 'undefined' ? window : globalThis);
