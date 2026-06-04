/* HWS step-0001 sim-core — 닫힌 장부를 가진 최소 세계
 * 터(64x64 wrap 격자) + 흐름량(E) + 법칙(확산·소산) + 구동(source→sink).
 * 브라우저/Node 겸용. 결정론: 같은 시드 → 비트 단위 동일.
 * step-0001.html 의 인라인 코어는 이 파일과 동일해야 한다(수정 시 양쪽 반영).
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
    drive: true            // 구동 on/off — off 면 source·sink 둘 다 정지
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

  /* 법칙 적용 순서 고정: ① 확산 ② 소산 ③ 주입(source) ④ 배출(sink)
   * — 순서가 결과를 바꾸므로 이후 step 에서도 이 순서를 유지한다. */
  function step(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var x, y, i, d;
    /* ① 확산 — 4이웃 라플라시안, wrap. 총량 보존 */
    for (y = 0; y < H; y++) {
      var yN = ((y - 1 + H) % H) * W, yS = ((y + 1) % H) * W, yC = y * W;
      for (x = 0; x < W; x++) {
        var xW = (x - 1 + W) % W, xE = (x + 1) % W;
        i = yC + x;
        B[i] = E[i] + kD * (E[yN + x] + E[yS + x] + E[yC + xW] + E[yC + xE] - 4 * E[i]);
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

  /* 측정: 총량·평균·공간 분산·최대 — 비평형(기울기 유지) 판정에 varE 사용 */
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
    step: step, run: run, ledger: ledger, measure: measure, hashState: hashState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS1 = api;
})(typeof window !== 'undefined' ? window : globalThis);
