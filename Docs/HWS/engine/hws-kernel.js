/* HWS 공통 커널 — *동결된 원시형*. 모든 step 이 공유하는, step 간 변하지 않는 기반 함수만 둔다.
 *
 * 설계 동기(STATE §2 law-pipeline): step-0001~0010 은 sim-core.js 를 통째로 복사하며 진화했다 —
 *   그런데 그중 ~20개 헬퍼(disc·장부·측정·해시·centroid…)는 step 사이 *바이트 단위로 동일*했다.
 *   UI 를 engine/hws-ui.js 로 한 번 분리했듯(0007), 이 커널은 그 sim 쪽 중복을 끝낸다.
 *   여기 있는 것은 시뮬 *상태를 바꾸지 않는*(또는 외부 주입을 장부 보정하는) 순수/준순수 함수뿐 —
 *   세계의 *법칙*(매 tick E 를 흐르게/먹게/굳게 하는 항)은 engine/hws-laws.js 에 따로 산다.
 *
 * 불변 규칙: 이 파일은 *동결*이다. 한 번 들어온 함수의 산술은 바꾸지 않는다 — 바꾸면 과거 step 의
 *   재현 수치가 흔들린다(아카이브 재현성). 회귀의 골든 레퍼런스는 engine/validate/golden.json 의
 *   상태 해시(hashState)다: 커널/법칙을 수정하면 `node engine/validate/verify-engine.js` 가 전 시나리오
 *   해시를 재검증해 드리프트를 즉시 잡는다(동결 파일 대신 동결 해시).
 *
 * 브라우저: window.HWS_KERNEL / Node: module.exports.
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

  /* ── 결정론적 tumble 해시 (정수 avalanche) — 탐사 방향을 *구배와 무상관*으로 뽑되 시드 결정론 유지.
   * (x,y,tick,seed) 의 순수 함수 → Math.random 금지(척추), 같은 시드 2회 비트 동일. 두 셀이 같은 tick 에
   * 같은 칸일 수 없으므로(점유) 개체별 고유. "무작위"는 *생성이 비결정*이 아니라 *구배와 탈상관*을 뜻한다. */
  function tumbleHash(x, y, t, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
             Math.imul(t | 0, 2246822519) + Math.imul(seed | 0, 3266489917)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

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

  /* 반경 r 원판의 (dx,dy) 오프셋 목록 — 중심 제외, 스캔 순서(dy 바깥·dx 안쪽) 고정. */
  function discOffsets(r) {
    var offs = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy <= r * r) offs.push([dx, dy]);
      }
    }
    return offs;
  }

  /* 농도 창 커널 — 포물선 bump. m=mc 에서 1, |m-mc|>=w 에서 0 (compact support). */
  function aggKernel(m, mc, w) {
    var t = (m - mc) / w;
    t = t * t;
    return t < 1 ? 1 - t : 0;
  }

  /* 생명 스폰 — (x,y)에 에이전트를 놓는다. 초기 생물량은 터에서 끌어온다(E↓ m↑, 닫힌 장부). */
  function spawnAgent(sim, x, y, m0) {
    var p = sim.p;
    var cx = ((x % p.W) + p.W) % p.W, cy = ((y % p.H) + p.H) % p.H;
    var center = cy * p.W + cx;
    var want = m0 != null ? m0 : p.mSeed;
    var seedM = sim.E[center] < want ? sim.E[center] : want;
    sim.E[center] -= seedM;
    var a = {
      x: cx, y: cy, m: seedM,
      cells: discCells(p.W, p.H, cx, cy, p.lifeR),
      center: center, bornTick: sim.tick
    };
    sim.agents.push(a);
    return a;
  }

  /* 별 스폰(step-0011 bootstrap) — (x,y)에 별을 놓는다. 연료는 *외부 할당*(별의 질량) — E 를 깎지 않는다.
   * 별이 연료를 태워 E 로 주입할 때 비로소 sim.injected 로 장부에 들어온다(외부 source 와 같은 경계). 활성도
   * 축의 *소산 극단*(SPINE 결정2): R 누적 핵에서 점화하는 내생 주입원이며, 그 자리를 떠돈다(서행 채식지). */
  function spawnStar(sim, x, y, fuel0) {
    var p = sim.p;
    var cx = ((x % p.W) + p.W) % p.W, cy = ((y % p.H) + p.H) % p.H;
    var center = cy * p.W + cx;
    var f = fuel0 != null ? fuel0 : p.starFuel0;
    var DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]], d = DIR[tumbleHash(cx, cy, sim.tick, sim.seed) & 3];
    var st = { x: cx, y: cy, center: center, fuel: f, cells: discCells(p.W, p.H, cx, cy, p.starR),
      vx: d[0], vy: d[1], age: 0, bornTick: sim.tick };
    sim.stars.push(st);
    return st;
  }

  /* 총 생물량 M = Σ 에이전트.m */
  function totalBiomass(sim) {
    var M = 0, ag = sim.agents;
    for (var k = 0; k < ag.length; k++) M += ag[k].m;
    return M;
  }

  /* 총 별 연료 F = Σ 별.fuel (장부 항. step-0011 — 별이 없으면 0, 회귀 무관). */
  function totalFuel(sim) {
    var f = 0, st = sim.stars;
    if (st) for (var i = 0; i < st.length; i++) f += st[i].fuel;
    return f;
  }

  /* 총 저장체 R = Σ R[i] (장부 항. step-0008) */
  function totalStore(sim) {
    var s = 0, R = sim.R;
    for (var i = 0; i < R.length; i++) s += R[i];
    return s;
  }

  /* 닫힌 장부 검사: sumE + M + R + evaporated + sunk + metabolized - injected = E0
   * 기복(step-0009)은 확산 방향만, 탐사(step-0010)는 위치만 바꿀 뿐 — 둘 다 새 거래가 없어 장부 식 불변.
   * 별(step-0011)은 *내생 주입원*이다 — 별의 연료(F)는 *외부 할당*(별의 질량, 아직 장에 안 든 대기 에너지)이라
   * 닫힌 장부에 들지 않는다. 별이 연료를 태워 E 로 *주입*하면 sim.injected 가 늘고(외부 source 와 같은 경계 항)
   * sumE 가 같이 늘어 식이 그대로 닫힌다. 즉 step-0010 장부 식과 동일 — 별은 source 의 위치를 내생화할 뿐. */
  function ledger(sim) {
    var sumE = 0, E = sim.E;
    for (var i = 0; i < E.length; i++) sumE += E[i];
    var M = totalBiomass(sim), R = totalStore(sim);
    var lhs = sumE + M + R + sim.evaporated + sim.sunk + sim.metabolized - sim.injected;
    var scale = Math.max(1, sim.E0 + sim.injected);
    return { sumE: sumE, biomass: M, store: R, fuel: totalFuel(sim), residual: Math.abs(lhs - sim.E0) / scale };
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

  /* 저장체 측정 — 총량·최대·점유 셀 수(R>eps). 저장체가 어디에 얼마나 굳었나. */
  function measureStore(sim, eps) {
    var R = sim.R, N = R.length, sum = 0, mx = 0, cells = 0;
    var e = eps != null ? eps : 0.01;
    for (var i = 0; i < N; i++) {
      sum += R[i];
      if (R[i] > mx) mx = R[i];
      if (R[i] > e) cells++;
    }
    return { total: sum, maxR: mx, cells: cells };
  }

  /* 고임 검출 — step-0002 와 동일. */
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

  /* 수확 — step-0002 와 동일. */
  function harvest(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, removed = 0;
    for (var k = 0; k < cells.length; k++) { removed += E[cells[k]]; E[cells[k]] = 0; }
    sim.sunk += removed;
    return removed;
  }

  /* 저장체 칠하기 — (cx,cy) 반경 r 원판에 R 을 amount 씩 더한다. 검증(deflect 프로브)·데모용.
   * 외부에서 들여온 양이므로 E0 를 함께 올려 장부를 보정한다(닫힌 장부 유지 — harvest 의 sunk 와 같은 정신). */
  function paintStore(sim, cx, cy, r, amount) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), R = sim.R, added = 0;
    for (var k = 0; k < cells.length; k++) { R[cells[k]] += amount; added += amount; }
    sim.E0 += added;
    return added;
  }

  /* E 칠하기 — (cx,cy) 반경 r 원판에 E 를 amount 씩 더한다. 검증(escape 프로브)·데모용.
   * 외부에서 들여온 양이므로 E0 를 함께 올려 장부를 보정한다(닫힌 장부 유지 — paintStore 와 같은 정신). */
  function paintE(sim, cx, cy, r, amount) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, added = 0;
    for (var k = 0; k < cells.length; k++) { E[cells[k]] += amount; added += amount; }
    sim.E0 += added;
    return added;
  }

  /* 국소 E 합 — (cx,cy) 중심 반경 r 원판의 E 총합. */
  function localE(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), E = sim.E, s = 0;
    for (var k = 0; k < cells.length; k++) s += E[cells[k]];
    return s;
  }

  /* 국소 R 합 — (cx,cy) 중심 반경 r 원판의 저장체 총합. 저장체가 어디에 쌓였나. */
  function localStore(sim, cx, cy, r) {
    var cells = discCells(sim.p.W, sim.p.H, cx, cy, r), R = sim.R, s = 0;
    for (var k = 0; k < cells.length; k++) s += R[cells[k]];
    return s;
  }

  /* 토러스 거리(wrap) */
  function torusDist(W, H, ax, ay, bx, by) {
    var dx = Math.abs(ax - bx); if (dx > W - dx) dx = W - dx;
    var dy = Math.abs(ay - by); if (dy > H - dy) dy = H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* 개체군 무게중심(생물량 가중, 토러스) */
  function centroid(sim) {
    var ag = sim.agents, W = sim.p.W, H = sim.p.H;
    if (!ag.length) return null;
    var sx = 0, sy = 0, cx = 0, cy = 0, sw = 0;
    var tx = 2 * Math.PI / W, ty = 2 * Math.PI / H;
    for (var k = 0; k < ag.length; k++) {
      var ww = ag[k].m > 0 ? ag[k].m : 1e-9;
      sx += Math.cos(ag[k].x * tx) * ww; cx += Math.sin(ag[k].x * tx) * ww;
      sy += Math.cos(ag[k].y * ty) * ww; cy += Math.sin(ag[k].y * ty) * ww;
      sw += ww;
    }
    var ax = Math.atan2(cx / sw, sx / sw); if (ax < 0) ax += 2 * Math.PI;
    var ay = Math.atan2(cy / sw, sy / sw); if (ay < 0) ay += 2 * Math.PI;
    return { x: ax / tx, y: ay / ty };
  }

  /* 개체군 공간 확산 반경 */
  function spread(sim) {
    var ag = sim.agents;
    if (!ag.length) return 0;
    var ct = centroid(sim), W = sim.p.W, H = sim.p.H;
    var sw = 0, sd = 0;
    for (var k = 0; k < ag.length; k++) {
      var ww = ag[k].m > 0 ? ag[k].m : 1e-9;
      var dd = torusDist(W, H, ag[k].x, ag[k].y, ct.x, ct.y);
      sd += ww * dd * dd; sw += ww;
    }
    return Math.sqrt(sd / sw);
  }

  /* 무게중심 → source 추적 거리(토러스) */
  function trackDist(sim) {
    var ct = centroid(sim);
    if (!ct) return null;
    return torusDist(sim.p.W, sim.p.H, ct.x, ct.y, sim.p.source.x, sim.p.source.y);
  }

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용 + 골든 레퍼런스(아카이브 재현성).
   * E + R 비트열 + 기본 장부 + 생명(metabolized) + 각 에이전트 x,y,m. (step-0008 이래 동일.) */
  function hashState(sim) {
    var h = 0x811c9dc5 >>> 0;
    function feed(buf) {
      var dv = new DataView(buf);
      for (var j = 0; j < dv.byteLength; j++) {
        h = (h ^ dv.getUint8(j)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    feed(sim.E.buffer);
    feed(sim.R.buffer);
    feed(new Float64Array([sim.injected, sim.evaporated, sim.sunk, sim.metabolized, sim.tick]).buffer);
    var ag = sim.agents;
    feed(new Float64Array([ag.length]).buffer);
    for (var k = 0; k < ag.length; k++) feed(new Float64Array([ag[k].x, ag[k].y, ag[k].m]).buffer);
    /* 별(step-0011) — *가법*: 별이 있을 때만 먹인다. 별 없는 과거 시나리오(0001~0010)는 이 분기 skip →
     * 해시 비트 동일(골든 불변, verify-sim-engine 으로 증명). 별 위치·연료로 결정론·재현 보장. */
    var st = sim.stars;
    if (st && st.length) {
      feed(new Float64Array([st.length]).buffer);
      for (var j2 = 0; j2 < st.length; j2++) {
        feed(new Float64Array([st[j2].x, st[j2].y, st[j2].fuel]).buffer);
        /* 연소 FSM state(step-0013) — *가법*: state 가 있을 때만 먹인다(FSM off 면 undefined → skip → 골든 endo@ 불변).
         * 이산 라벨이 결정론·재현에 들어간다(상태 라벨이 해시에). */
        if (st[j2].state !== undefined) feed(new Float64Array([st[j2].state]).buffer);
      }
    }
    /* 활성도 필드 A(step-0014) — *가법*: 계량이 활성(fluxInit)일 때만 먹인다(kFlux=0 이면 false → skip → 과거 골든 전부 불변).
     * 활성도(측정값)가 결정론·재현에 들어간다(같은 시드 2회 A 도 비트 동일). A 는 읽기 전용 계기지만 결정론 검증엔 포함. */
    if (sim.fluxInit) feed(sim.A.buffer);
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* source/sink 위치·반경 변경 후 셀 목록 재계산 — 검증 시나리오·데모용. */
  function setSource(sim, opts) {
    sim.p.source = Object.assign({}, sim.p.source, opts || {});
    sim.srcCells = discCells(sim.p.W, sim.p.H, sim.p.source.x, sim.p.source.y, sim.p.source.r);
    sim.srcBase = { x: sim.p.source.x, y: sim.p.source.y };
    sim.srcBaseTick = sim.tick;
  }
  function setSink(sim, opts) {
    sim.p.sink = Object.assign({}, sim.p.sink, opts || {});
    sim.sinkCells = discCells(sim.p.W, sim.p.H, sim.p.sink.x, sim.p.sink.y, sim.p.sink.r);
  }

  var api = {
    mulberry32: mulberry32, tumbleHash: tumbleHash,
    discCells: discCells, discOffsets: discOffsets, aggKernel: aggKernel, spawnAgent: spawnAgent, spawnStar: spawnStar,
    totalBiomass: totalBiomass, totalStore: totalStore, totalFuel: totalFuel, ledger: ledger,
    measure: measure, measureStore: measureStore,
    detectPools: detectPools, harvest: harvest, paintStore: paintStore, paintE: paintE,
    localE: localE, localStore: localStore,
    torusDist: torusDist, centroid: centroid, spread: spread, trackDist: trackDist,
    hashState: hashState, setSource: setSource, setSink: setSink
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS_KERNEL = api;
})(typeof window !== 'undefined' ? window : globalThis);
