/* HWS step-0008 sim-core — 흐름량이 임계를 넘어 *굳으면* 저장체(평형 상)가 된다: 첫 평형 개체 + 첫 비가역 문턱
 * step-0007(확산·증발·구동·응집·생명·번식·이동·기초대사비·떠도는 자원) 을 잇는다. 더해진 것은 단 하나: 결정화/풍화.
 *   ── 척추(SPINE.md) 첫 적용 ──
 *   지금까지 모든 개체(고임·생명)는 *소산* 쪽이었다 — 구동(흐름)이 끊기면 사라진다(증발·확산·아사). 척추 결정2가
 *   요구하는 반대 극단(저장체=평형 개체: 흐름 0에서도 존재하는 농축 저장소)이 없었다. step-0008 이 그것을 더한다.
 *   메커니즘: 각 셀의 흐름량 E 가 국소 임계 crystThresh 를 넘으면, 초과분의 kCryst 비율이 매 tick *굳어* 저장소
 *     R[i] 로 옮겨간다(E→R). R 은 확산·증발하지 않는다 — 흐름이 끊겨도 그 자리에 남는다(저장체의 정의).
 *   비가역 문턱(척추 결정3): 결정화는 E>crystThresh 일 때만 켜진다(국소 상태+국소 필드값만으로 판정, 전역 조율자 0).
 *     문턱 *이전*엔 그냥 흐르는 재료(E), 문턱을 *넘으면* 질적으로 다른 상(굳은 R)이 된다.
 *   순환(척추 비가역 vs 순환 — 척도 분리): 결정화(E→R)는 *빠르고 문턱 위에서만*, 풍화(R→E, kWeather)는 *느리고
 *     무조건*. 둘의 비대칭(높은 문턱 진입 + 느린 무조건 방출)이 *래칫*을 만든다 — 저장체는 고임이 머물던 자리에
 *     쌓이고, 고임/source 가 떠난 뒤에도 오래 남아 천천히 E 를 되돌려준다. 개체 척도는 (사실상)비가역, 세계 척도는
 *     느린 순환. 탄 나무는 못 되돌려도 탄소는 지질학적 시간에 돌아온다 — 같은 구조.
 *   장부(척추 결정4·순환): E→R·R→E 는 쌍 거래라 sumE+R 이 내부 보존. R 을 장부 항으로 더한다(생물량 M 과 같은
 *     급 — 개체가 보유한 흐름량). 상태(상)는 바뀌어도 에너지는 보존: 비가역 ≠ 비보존.
 *   저장체는 아직 *비활성 저장*이다 — 확산을 막거나(무대) 생존 문턱을 낮추지(촉매) 않는다. 그건 다음 rung(한 step=한 항).
 *     단, 생명이 *풍화된 E* 를 먹는 되먹임(저장체가 씨앗 공급)은 공유 E 필드를 통해 공짜로 창발한다.
 * 순서: ①확산(+응집) ②증발 ③주입 ④배출 → ⑤ *결정화·풍화(신규)* → ⑥이동 ⑦생명 ⑧번식. 결정화는 구동 직후·생명 직전.
 * 회귀: kCryst=0 이면 결정화·풍화 블록이 통째로 건너뛰어져 R 불변(0) → step-0007 과 비트 동일.
 *   srcJump=0 까지 끄면 step-0006, baseCost 0 이면 step-0005, 이동 off step-0004, 번식 off step-0003, 에이전트 0 step-0002.
 * 닫힌 장부: sumE + M(=Σm) + R(=ΣR) + evaporated + sunk + metabolized - injected = E0.
 * 브라우저/Node 겸용. step-0008.html 의 셸이 이 파일을 그대로 로드한다(window.HWS8).
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
    /* ── step-0003: 생명(자원을 먹는 자기유지 패턴) ── */
    life: true,            // 생명 법칙 on/off. 단, 에이전트가 없으면 어차피 no-op(회귀)
    kL: 0.05,              // 흡수율 — 매 tick 입(disc)의 E 의 이 비율을 생물량으로
    mMaint: 0.03,          // 유지율 — 매 tick 생물량의 이 비율을 대사로 소산
    mDeath: 0.05,          // 사망 임계 — m 이 이 값 미만이면 사망
    mSeed: 0.50,           // 스폰 시 초기 생물량
    lifeR: 1,              // 입 반경(흡수 원판). 1 = 자신+4이웃(von Neumann 근사 disc)
    /* ── step-0004: 번식(생물량이 임계를 넘으면 분열) ── */
    repro: true,           // 번식 on/off. off(또는 mDiv=Infinity) → step-0003 과 비트 동일(회귀)
    mDiv: 1.20,            // 분열 임계 — m >= mDiv 면 둘로 쪼갬(부모 m/2, 자식 m/2)
    divR: 1,               // 자식 배치 탐색 반경 — 이 disc 안 빈 이웃 중 E 최고 셀로
    popCap: 4096,          // 개체수 안전 상한(=격자 셀 수). 보통 자원이 먼저 제한 → 거의 안 닿음
    /* ── step-0005: 이동(주화성 — 더 높은 E 이웃으로 한 칸씩) ── */
    move: true,            // 이동 on/off. off(또는 moveR=0) → step-0004 와 비트 동일(회귀)
    moveR: 1,              // 이동 반경(보폭). 1 = 4이웃 중 한 칸. 0 = 이동 없음(회귀)
    moveThresh: 0.02,      // 이동 임계 — 빈 이웃 E 가 현재 중심보다 이만큼 높아야 옮김(구배 문턱)
    /* ── step-0006: 기초대사비(절대 생존 문턱) ── */
    baseCost: 0,           // 생물량과 무관한 절대 대사비. cost = m·mMaint + baseCost.
    /* ── step-0007: 떠도는 자원(source 가 주기적으로 +x 로 재배치, 토러스 wrap) ── */
    srcJump: 0,            // 재배치 1회당 source x 이동 칸수. 0 = off = step-0006 와 비트 동일(회귀).
    srcPeriod: 150,        // 재배치 주기(tick). srcJump>0 일 때만 의미.
    /* ── step-0008 신규: 결정화·풍화(저장체 = 평형 개체) ── */
    kCryst: 0,             // 결정화율. 0 = off = step-0007 과 비트 동일(회귀). >0 이면 E>crystThresh 인 셀의
                           //   초과분의 이 비율이 매 tick 굳어 R 로(E→R). 높은 문턱 진입(빠름).
    crystThresh: 3.0,      // 결정화 문턱(척추 결정3) — E 가 이 값을 넘는 셀에서만 결정화가 켜진다(강한 고임 핵).
                           //   문턱 이전엔 흐르는 재료(E), 넘으면 굳은 상(R). 시나리오 튜닝 노브(결정론 무관).
    kWeather: 0.0003       // 풍화율 — 매 tick R 의 이 비율이 E 로 되돌아간다(R→E, 느림·무조건).
                           //   kCryst≫kWeather 비대칭이 래칫(저장)을 만든다. 세계척도 순환의 느린 back-path.
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
      R: new Float64Array(N),                  // step-0008: 저장체(굳은 흐름량). 초기 0 → kCryst=0 이면 영원히 0(회귀)
      srcCells: discCells(p.W, p.H, p.source.x, p.source.y, p.source.r),
      sinkCells: discCells(p.W, p.H, p.sink.x, p.sink.y, p.sink.r),
      srcBase: { x: p.source.x, y: p.source.y },
      srcBaseTick: 0,
      E0: E0,                                  // 초기 총량 (장부의 기준점)
      injected: 0, evaporated: 0, sunk: 0,     // 닫힌 장부 T (step-0002 그대로)
      agents: [],          // 살아있는 에이전트 목록
      metabolized: 0,      // 대사로 소산된 총량
      deaths: 0,           // 누적 사망 수 (통계용)
      divOffsets: discOffsets(p.divR),
      occSet: new Set(),
      births: 0,           // 누적 분열(출생) 수 (통계용)
      moveOffsets: discOffsets(p.moveR),
      moves: 0,            // 누적 이동 수 (통계용)
      crystallized: 0, weathered: 0  // step-0008: 누적 결정화량·풍화량 (통계용 — 장부와 무관, R 이 순잔액)
    };
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

  /* 법칙 적용 순서: ①확산(+응집) ②증발 ③주입 ④배출 ⑤결정화·풍화 ⑥이동 ⑦생명 ⑧번식 — 순서 고정. */
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
    /* ③④ 구동 — step-0007 떠도는 source 그대로. */
    if (p.drive) {
      if (p.srcJump !== 0 && p.srcPeriod > 0) {
        var nj = Math.floor((sim.tick - sim.srcBaseTick) / p.srcPeriod);
        var ncx = (((sim.srcBase.x + p.srcJump * nj) % W) + W) % W;
        if (ncx !== p.source.x) {
          p.source.x = ncx;
          sim.srcCells = discCells(W, H, ncx, p.source.y, p.source.r);
        }
      }
      var sc = sim.srcCells, rate = p.source.rate;
      for (i = 0; i < sc.length; i++) E[sc[i]] += rate;
      sim.injected += rate * sc.length;
      var kc = sim.sinkCells, srate = p.sink.rate, snk = 0;
      for (i = 0; i < kc.length; i++) { d = E[kc[i]] * srate; E[kc[i]] -= d; snk += d; }
      sim.sunk += snk;
    }
    /* ⑤ 결정화·풍화(step-0008 신규) — kCryst=0 이면 통째로 건너뜀(회귀 0, R 불변).
     * 결정화(E→R): E>crystThresh 인 셀에서 초과분의 kCryst 가 굳어 R 로(빠름·문턱 위에서만).
     * 풍화(R→E): R 의 kWeather 가 E 로 되돌아옴(느림·무조건). 둘 다 E↔R 내부 쌍 거래 → sumE+R 보존(장부 불변).
     * 구동 직후·생명 직전: 생명은 흐르는 E 만 먹는다(굳은 R 은 못 먹음 — 풍화로 풀려야 비로소 가용). */
    if (p.kCryst !== 0) {
      var R = sim.R, kC = p.kCryst, cth = p.crystThresh, kW = p.kWeather;
      var cry = 0, wth = 0;
      for (i = 0; i < W * H; i++) {
        var ev = E[i];
        if (ev > cth) {                          // 문턱: 넘은 셀만 굳는다(국소 판정)
          var dep = (ev - cth) * kC;
          E[i] = ev - dep; R[i] += dep; cry += dep;
        }
        var ri = R[i];
        if (ri !== 0) {                          // 풍화: 굳은 R 이 천천히 E 로(느린 역행)
          var rel = ri * kW;
          R[i] = ri - rel; E[i] += rel; wth += rel;
        }
      }
      sim.crystallized += cry; sim.weathered += wth;
    }
    /* ⑥⑦⑧ 생명 단계 — 에이전트가 없으면 통째로 건너뜀(회귀 0). 이동→흡수·유지·사망→번식. step-0007 그대로. */
    if (p.life && sim.agents.length) {
      var ag = sim.agents, kL = p.kL, mMaint = p.mMaint, mDeath = p.mDeath, baseCost = p.baseCost;
      /* ⑥ 이동(주화성) */
      if (p.move) {
        var moveOff = sim.moveOffsets, moveThresh = p.moveThresh, mocc = sim.occSet;
        mocc.clear();
        for (var ms = 0; ms < ag.length; ms++) mocc.add(ag[ms].center);
        for (var mk = 0; mk < ag.length; mk++) {
          var mv = ag[mk];
          var floor = E[mv.center] + moveThresh;
          var mvx = mv.x, mvy = mv.y, bIdx = -1, bE = floor, bX = 0, bY = 0;
          for (var mo = 0; mo < moveOff.length; mo++) {
            var mnx = (mvx + moveOff[mo][0] + W) % W, mny = (mvy + moveOff[mo][1] + H) % H;
            var mnidx = mny * W + mnx;
            if (mocc.has(mnidx)) continue;
            if (E[mnidx] > bE) { bE = E[mnidx]; bIdx = mnidx; bX = mnx; bY = mny; }
          }
          if (bIdx < 0) continue;
          mocc.delete(mv.center);
          mv.x = bX; mv.y = bY; mv.center = bIdx;
          mv.cells = discCells(W, H, bX, bY, p.lifeR);
          mocc.add(bIdx);
          sim.moves++;
        }
      }
      /* ⑦ 생명(흡수·유지·사망) — step-0006 그대로. cost = m·mMaint + baseCost. */
      var survivors = [];
      for (var k = 0; k < ag.length; k++) {
        var a = ag[k], cells = a.cells;
        var got = 0;
        for (var c = 0; c < cells.length; c++) {
          var idx = cells[c], take = E[idx] * kL;
          E[idx] -= take; got += take;
        }
        a.m += got;
        var cost = a.m * mMaint + baseCost;
        if (cost > a.m) cost = a.m;
        a.m -= cost; sim.metabolized += cost;
        if (a.m < mDeath) {
          E[a.center] += a.m; a.m = 0;
          a.deathTick = sim.tick; sim.deaths++;
        } else {
          survivors.push(a);
        }
      }
      /* ⑧ 번식 — repro off 면 건너뜀. 분열 = 생물량 내부 분배(부모 m/2 + 자식 m/2). step-0004 그대로. */
      if (p.repro) {
        var mDiv = p.mDiv, divOff = sim.divOffsets, popCap = p.popCap, occ = sim.occSet;
        occ.clear();
        for (var s = 0; s < survivors.length; s++) occ.add(survivors[s].center);
        var nDiv = survivors.length;
        for (var s2 = 0; s2 < nDiv; s2++) {
          var par = survivors[s2];
          if (par.m < mDiv) continue;
          if (survivors.length >= popCap) break;
          var px = par.x, py = par.y, bestIdx = -1, bestE = -Infinity, bestX = 0, bestY = 0;
          for (var o = 0; o < divOff.length; o++) {
            var nx = (px + divOff[o][0] + W) % W, ny = (py + divOff[o][1] + H) % H;
            var nidx = ny * W + nx;
            if (occ.has(nidx)) continue;
            if (E[nidx] > bestE) { bestE = E[nidx]; bestIdx = nidx; bestX = nx; bestY = ny; }
          }
          if (bestIdx < 0) continue;
          var half = par.m * 0.5;
          par.m = half;
          survivors.push({
            x: bestX, y: bestY, m: half,
            cells: discCells(W, H, bestX, bestY, p.lifeR),
            center: bestIdx, bornTick: sim.tick
          });
          occ.add(bestIdx);
          sim.births++;
        }
      }
      sim.agents = survivors;
    }
    sim.tick++;
  }

  function run(sim, ticks) { for (var t = 0; t < ticks; t++) step(sim); return sim; }

  /* 총 생물량 M = Σ 에이전트.m */
  function totalBiomass(sim) {
    var M = 0, ag = sim.agents;
    for (var k = 0; k < ag.length; k++) M += ag[k].m;
    return M;
  }

  /* 총 저장체 R = Σ R[i] (장부 항. step-0008 신규) */
  function totalStore(sim) {
    var s = 0, R = sim.R;
    for (var i = 0; i < R.length; i++) s += R[i];
    return s;
  }

  /* 닫힌 장부 검사: sumE + M + R + evaporated + sunk + metabolized - injected = E0
   * 결정화·풍화는 E↔R 내부 쌍 거래라 새 *외부* 항이 없다 — R 을 보유 항으로 더하면 책이 닫힌다. */
  function ledger(sim) {
    var sumE = 0, E = sim.E;
    for (var i = 0; i < E.length; i++) sumE += E[i];
    var M = totalBiomass(sim), R = totalStore(sim);
    var lhs = sumE + M + R + sim.evaporated + sim.sunk + sim.metabolized - sim.injected;
    var scale = Math.max(1, sim.E0 + sim.injected);
    return { sumE: sumE, biomass: M, store: R, residual: Math.abs(lhs - sim.E0) / scale };
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

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용.
   * E + R 비트열 + 기본 장부 + 생명(metabolized) + 각 에이전트 x,y,m.
   * step-0008 은 R 을 함께 해시한다(저장체 상태도 결정론 검사 대상). 회귀(reg)는 cross-core 해시 대신
   * E·R·장부·에이전트를 직접 비교하므로 step-0007 과 필드 수가 달라도 무방. */
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
    DEFAULTS: DEFAULTS, mulberry32: mulberry32, createSim: createSim,
    aggKernel: aggKernel, spawnAgent: spawnAgent, step: step, run: run,
    totalBiomass: totalBiomass, totalStore: totalStore, ledger: ledger, measure: measure, measureStore: measureStore,
    detectPools: detectPools, harvest: harvest, localE: localE, localStore: localStore,
    torusDist: torusDist, centroid: centroid, spread: spread, trackDist: trackDist, discCells: discCells,
    setSource: setSource, setSink: setSink,
    hashState: hashState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS8 = api;
})(typeof window !== 'undefined' ? window : globalThis);
