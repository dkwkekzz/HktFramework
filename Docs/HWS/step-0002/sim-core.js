/* HWS step-0002 sim-core — 비선형 1개(응집)로 고임이 떠오르는 세계
 * step-0001(확산·소산·구동) 을 잇는다. 더해진 것은 단 하나:
 *   응집(aggregation) — 확산 계수의 농도 의존 확장. E 가 *농도 창* 안에서만
 *   이웃의 더 높은 쪽으로 거꾸로 흐른다(uphill). 창 밖(너무 낮음/너무 높음)에선 0.
 *   → 선형 확산이 모든 응축을 깎던 step-0001 의 부정적 결과(고임 없음)를 깬다.
 * 보존: 응집은 이웃 쌍의 *대칭* 계수에 antisymmetric 플럭스 → 닫힌 장부 유지.
 * 회귀: kA=0 이면 응집 항이 통째로 건너뛰어져 step-0001 식과 비트 단위 동일.
 * 브라우저/Node 겸용. step-0002.html 의 인라인 코어는 이 파일과 동일해야 한다.
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
    kT: 0.001,             // 소산율 — 매 tick E 의 kT 비율이 장부 T 로
    initE: 1.0,            // 초기 평균 E
    noise: 0.5,            // 초기 노이즈 진폭 (시드로 결정)
    source: { x: 16, y: 16, r: 3, rate: 0.05 },  // 셀당/tick당 주입량
    sink:   { x: 48, y: 48, r: 4, rate: 0.10 },  // 셀 E 의 비율 제거
    drive: true,           // 구동 on/off — off 면 source·sink 둘 다 정지
    /* ── step-0002 신규: 응집(농도 창 안의 uphill 흐름) ── */
    kA: 0,                 // 응집 강도. 기본 0 = off = step-0001 과 비트 동일(회귀)
    aggMc: 1.1,            // 농도 창 중심 (이 농도 부근에서 응집이 가장 셈)
    aggW: 0.7              // 농도 창 반폭 (|m-mc|>=w 면 응집 0 — compact support)
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
      injected: 0, dissipated: 0, sunk: 0      // 닫힌 장부 T
    };
  }

  /* 농도 창 커널 — 포물선 bump. m=mc 에서 1, |m-mc|>=w 에서 0 (compact support).
   * agg 가 큰 농도대에서만 uphill 흐름이 켜진다 → "자원의 창". */
  function aggKernel(m, mc, w) {
    var t = (m - mc) / w;
    t = t * t;
    return t < 1 ? 1 - t : 0;
  }

  /* 법칙 적용 순서 고정: ① 확산(+응집) → ② 소산 → ③ 주입(source) → ④ 배출(sink)
   * — 순서가 결과를 바꾸므로 이후 step 에서도 이 순서를 유지한다.
   * 응집은 ① 안에서 확산 플럭스에 더해지는 농도 의존 보정이다(새 법칙이 아님). */
  function step(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var kA = p.kA, mc = p.aggMc, w = p.aggW;
    var x, y, i, d;
    /* ① 확산(+응집) — 4이웃, wrap. 총량 보존 */
    for (y = 0; y < H; y++) {
      var yN = ((y - 1 + H) % H) * W, yS = ((y + 1) % H) * W, yC = y * W;
      for (x = 0; x < W; x++) {
        var xW = (x - 1 + W) % W, xE = (x + 1) % W;
        i = yC + x;
        var eN = E[yN + x], eS = E[yS + x], eWc = E[yC + xW], eEc = E[yC + xE], ei = E[i];
        /* 확산 — step-0001 식 그대로 (kA=0 회귀를 위해 이 식과 순서를 보존) */
        B[i] = ei + kD * (eN + eS + eWc + eEc - 4 * ei);
        /* 응집 보정 — kA=0 이면 통째로 건너뜀 → 위 식만 남아 step-0001 과 비트 동일.
         * 이웃 쌍 (i,n) 의 대칭 커널 agg((ei+en)/2) × antisymmetric (ei-en)
         * → 옆 셀에서 본 같은 변의 플럭스와 정확히 부호만 반대 = 닫힌 장부. */
        if (kA !== 0) {
          /* 커널 인자는 두 셀 중 *약한* 쪽(min) — 농도 창 바닥(mc-w)까지 빨린 셀은
           * 더는 내주지 않는다. 이게 음수 크레이터(=anti-diffusion 폭주)를 막는다.
           * min 은 (i,n) 대칭 → 플럭스는 여전히 antisymmetric = 닫힌 장부. */
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
    /* ② 소산 — E 의 kT 비율이 장부(dissipated)로 이동. 보존: E 감소량 = 장부 증가량 */
    var kT = p.kT, dis = 0;
    for (i = 0; i < W * H; i++) { d = E[i] * kT; E[i] -= d; dis += d; }
    sim.dissipated += dis;
    /* ③④ 구동 — source 주입(장부 injected 기록), sink 배출(장부 sunk 기록) */
    if (p.drive) {
      var sc = sim.srcCells, rate = p.source.rate;
      for (i = 0; i < sc.length; i++) E[sc[i]] += rate;
      sim.injected += rate * sc.length;
      var kc = sim.sinkCells, srate = p.sink.rate, snk = 0;
      for (i = 0; i < kc.length; i++) { d = E[kc[i]] * srate; E[kc[i]] -= d; snk += d; }
      sim.sunk += snk;
    }
    sim.tick++;
  }

  function run(sim, ticks) { for (var t = 0; t < ticks; t++) step(sim); return sim; }

  /* 닫힌 장부 검사: sumE + dissipated + sunk - injected = E0
   * 상대 잔차 = |위반량| / max(1, E0 + injected) */
  function ledger(sim) {
    var sumE = 0, E = sim.E;
    for (var i = 0; i < E.length; i++) sumE += E[i];
    var lhs = sumE + sim.dissipated + sim.sunk - sim.injected;
    var scale = Math.max(1, sim.E0 + sim.injected);
    return { sumE: sumE, residual: Math.abs(lhs - sim.E0) / scale };
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

  /* 고임(자원의 원형) 검출 — source 아닌 곳의 지속 가능한 국소 봉우리.
   *  조건: (1) 4이웃 국소 최대(>=) (2) E >= minE (3) prominence(=E - 8이웃 평균) >= prom
   *        (4) source 중심에서 dist > excl (source 봉우리 자체 제외).
   * 반환: 봉우리 셀 목록 [{x,y,e,prom}] (E 내림차순). */
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
        if (dxs * dxs + dys * dys <= excl * excl) continue; // source 봉우리 제외
        /* 8이웃: 국소 최대 + prominence */
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

  /* 수확 — 반경 r 원판의 E 를 제거하고 제거량을 장부(sunk)로 기록(=배출의 일종).
   * 닫힌 장부 유지. 재생 자원 검증에서 사용. 제거된 총량 반환. */
  function harvest(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, removed = 0;
    for (var k = 0; k < cells.length; k++) { removed += E[cells[k]]; E[cells[k]] = 0; }
    sim.sunk += removed;
    return removed;
  }

  /* 상태 해시 (FNV-1a 32bit, E 비트열 + 장부) — 결정론(비트 동일) 검사용 */
  function hashState(sim) {
    var h = 0x811c9dc5 >>> 0;
    var dv = new DataView(sim.E.buffer);
    for (var i = 0; i < dv.byteLength; i++) {
      h = (h ^ dv.getUint8(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
    }
    var meta = new Float64Array([sim.injected, sim.dissipated, sim.sunk, sim.tick]);
    var mv = new DataView(meta.buffer);
    for (i = 0; i < mv.byteLength; i++) {
      h = (h ^ mv.getUint8(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  var api = {
    DEFAULTS: DEFAULTS, mulberry32: mulberry32, createSim: createSim,
    aggKernel: aggKernel, step: step, run: run, ledger: ledger, measure: measure,
    detectPools: detectPools, harvest: harvest, hashState: hashState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS2 = api;
})(typeof window !== 'undefined' ? window : globalThis);
