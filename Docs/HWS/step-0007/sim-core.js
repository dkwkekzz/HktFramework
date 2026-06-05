/* HWS step-0007 sim-core — 세계가 스스로 자원을 옮기면(떠도는 자원) 개체군이 끝없이 추적해 정착 동결이 풀린다
 * step-0006(확산·증발·구동·응집·생명·번식·이동·기초대사비) 을 잇는다. 더해진 것은 단 하나: 떠도는 자원
 *   (source 가 srcPeriod tick 마다 srcJump 칸씩 +x 로 *재배치*된다 — 토러스 wrap).
 *   step-0006 까지 source 는 한자리(16,16)에 고정 → 정적 자원 풍경 위에서 개체군이 결국 한 고임으로
 *   모여 *얼어붙었다*(정착 후 출생=사망=0). step-0005(이동)·step-0006(비용) 두 번의 능력 추가가 모두
 *   "정적 끌개로 수렴"함을 보였다 — 흩어진 끝나지 않는 동역학은 *무대 자체가 움직여야* 한다.
 *   step-0007 은 source 셀을 주기적으로 옮긴다: cellX = round(x0 + srcJump·floor(tick/srcPeriod)).
 *     주입이 일어나는 *자리*만 바뀐다 — 주입 총량(rate·셀수)은 불변이라 닫힌 장부가 유지된다(자원 이동은
 *     "어디에" 만 바꿀 뿐 "얼마나" 는 안 바꾼다). 개체군은 떠도는 고임을 *끝없이* 따라가야 살고(이동+문턱+
 *     움직이는 표적), 못 따라가면(이동 off·점프 과대) 뒤처져 굶어 죽는다. 정착 동결이 *추적+churn* 으로 바뀐다.
 *   왜 점프(이산)인가: *매끄러운* 균일 표류는 함께 움직이는 좌표계에서 보면 step-0006 정적 상태와 동일
 *     (갈릴레이 불변)이라 개체군이 강체처럼 미끄러져 따라갈 뿐 인구학적 동결이 안 풀린다(출생=사망=0).
 *     srcJump 이 충분히 크면(≈2·source.r) 매 재배치가 *비평형 transient* 를 만든다 — 뒤처진 개체는 마른
 *     옛 자리에서 굶어 죽고(사망 전선), 따라잡은 개체는 신선한(미수확) 고임에서 m 을 키워 분열(출생 전선)한다.
 *     srcJump=1(≈연속 표류)은 이 동결을 못 풀고, srcJump≈6 이라야 churn 이 지속된다 — 같은 한 노브의 양 끝.
 *   순서: 이동(⑤) → 흡수·유지·사망(⑥) → 번식(⑦). step-0006 그대로. 재배치는 ③④ 구동 단계에서 위치만 갱신.
 * 회귀: srcJump=0 이면 재배치 블록이 통째로 건너뛰어져 srcCells 불변 → step-0006 와 비트 동일.
 *   baseCost 까지 끄면 step-0005, 이동까지 끄면 step-0004, 번식까지 끄면 step-0003, 에이전트 0 이면 step-0002 (회귀 체인).
 * 닫힌 장부: sumE + M(=Σm) + evaporated + sunk + metabolized - injected = E0 (step-0006 그대로).
 * 브라우저/Node 겸용. step-0007.html 의 셸이 이 파일을 그대로 로드한다(window.HWS7).
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
                           //   0 = step-0005 와 비트 동일(회귀). >0 이면 흡수<baseCost 인 마른 곳의 생명은 굶어 죽는다.
    /* ── step-0007 신규: 떠도는 자원(source 가 주기적으로 +x 로 재배치, 토러스 wrap) ── */
    srcJump: 0,            // 재배치 1회당 source x 이동 칸수. 0 = off = step-0006 와 비트 동일(회귀).
                           //   >0 이면 source 가 srcPeriod tick 마다 srcJump 칸 +x 로 점프 → 고임이 떠돌고
                           //   개체군은 끝없이 추적해야 산다. srcJump≈1 은 동결을 못 풀고(갈릴레이), ≈6 이라야 churn 지속.
                           //   주입 *위치*만 바뀌고 총량(rate·셀수)은 불변 → 닫힌 장부 유지.
    srcPeriod: 150         // 재배치 주기(tick). 시나리오 상수. srcJump>0 일 때만 의미. 점프 사이엔 source 정지(국소 정적).
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

  /* 반경 r 원판의 (dx,dy) 오프셋 목록 — 중심 제외, 스캔 순서(dy 바깥·dx 안쪽) 고정.
   * 자식 배치·이동 후보. 순서가 동률 타이브레이크를 결정하므로 결정론을 위해 고정한다. */
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
      srcCells: discCells(p.W, p.H, p.source.x, p.source.y, p.source.r),
      sinkCells: discCells(p.W, p.H, p.sink.x, p.sink.y, p.sink.r),
      /* ── step-0007: 떠도는 자원 — 재배치 기준점(앵커)·기준 tick.
       * source 위치 = round(srcBase.x + srcJump·floor((tick - srcBaseTick)/srcPeriod)). srcJump=0 이면 항상
       * srcBase(=원위치)로 고정되어 step-0006 와 비트 동일. setSource 로 수동 이동 시 앵커를 갱신해 점프가 새 자리에서 이어진다. */
      srcBase: { x: p.source.x, y: p.source.y },
      srcBaseTick: 0,
      E0: E0,                                  // 초기 총량 (장부의 기준점)
      injected: 0, evaporated: 0, sunk: 0,     // 닫힌 장부 T (step-0002 그대로)
      /* ── step-0003: 생명 ── */
      agents: [],          // 살아있는 에이전트 목록 (비면 생명·번식·이동 모두 no-op = 회귀)
      metabolized: 0,      // 대사로 소산된 총량 (장부의 새 항 — 기초대사도 여기 기록)
      deaths: 0,           // 누적 사망 수 (통계용 — 장부와 무관)
      /* ── step-0004: 번식 ── */
      divOffsets: discOffsets(p.divR),  // 자식 배치 후보 오프셋(고정 순서)
      occSet: new Set(),   // 점유 셀 집합 (이동·번식 패스에서 재사용 — 결정론에 영향 없음)
      births: 0,           // 누적 분열(출생) 수 (통계용 — 장부와 무관)
      /* ── step-0005: 이동 ── */
      moveOffsets: discOffsets(p.moveR), // 이동 후보 오프셋(고정 순서)
      moves: 0             // 누적 이동(한 칸 옮김) 수 (통계용 — 장부와 무관)
      /* step-0007(떠도는 자원)은 새 *장부* 항이 없다 — 주입 위치만 옮길 뿐 총량 보존. 위치는 srcBase/srcBaseTick 로 추적. */
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
   * (분열로 태어나는 자식과 달리, 이 스폰은 터와 거래한다 — step-0003 그대로.) */
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

  /* 법칙 적용 순서 고정: ① 확산(+응집) → ② 증발 → ③ 주입 → ④ 배출 → ⑤ 이동 → ⑥ 생명 → ⑦ 번식
   * — 순서가 결과를 바꾸므로 이후 step 에서도 이 순서를 유지한다.
   * 이동(⑤)·생명(⑥)·번식(⑦)은 매 tick 갓 구동된 터 위에서 일어난다. */
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
    /* ③④ 구동 — step-0007: 떠도는 source. srcJump=0 면 위치 갱신 블록을 건너뛰어 srcCells 불변(회귀 0).
     * srcJump>0 면 source 셀을 round(srcBase.x + srcJump·floor((tick-srcBaseTick)/srcPeriod)) 로 옮긴다(토러스 wrap).
     * 점프 사이엔 위치 정지 → 매 재배치가 비평형 transient(뒤처진 개체 아사 + 따라잡은 개체 분열)를 만든다.
     * 주입 *위치*만 바뀌고 주입 총량(rate·셀수)은 불변 → 닫힌 장부 유지. sink 는 고정. */
    if (p.drive) {
      if (p.srcJump !== 0 && p.srcPeriod > 0) {
        var nj = Math.floor((sim.tick - sim.srcBaseTick) / p.srcPeriod);
        var ncx = (((sim.srcBase.x + p.srcJump * nj) % W) + W) % W;
        if (ncx !== p.source.x) {                 // 셀이 바뀔 때만 disc 재계산(결과는 위치만의 함수 — 결정론)
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
    /* ⑤⑥⑦ 생명 단계 — 에이전트가 없으면 통째로 건너뜀(회귀 0). 이동→흡수·유지·사망→번식 순. step-0006 그대로. */
    if (p.life && sim.agents.length) {
      var ag = sim.agents, kL = p.kL, mMaint = p.mMaint, mDeath = p.mDeath, baseCost = p.baseCost;
      /* ⑤ 이동(주화성) — move off 면 건너뜀(회귀 0). 이동 = 위치 변경(생물량·E 불변 → 장부 불변).
       * step-0005 그대로. 입이 닿는 빈 이웃 중 E 최고 셀이 현재 중심보다 moveThresh 이상 높으면 한 칸. */
      if (p.move) {
        var moveOff = sim.moveOffsets, moveThresh = p.moveThresh, mocc = sim.occSet;
        mocc.clear();
        for (var ms = 0; ms < ag.length; ms++) mocc.add(ag[ms].center);
        for (var mk = 0; mk < ag.length; mk++) {
          var mv = ag[mk];
          var floor = E[mv.center] + moveThresh;   // 이만큼 높은 빈 이웃이라야 옮긴다
          var mvx = mv.x, mvy = mv.y, bIdx = -1, bE = floor, bX = 0, bY = 0;
          for (var mo = 0; mo < moveOff.length; mo++) {
            var mnx = (mvx + moveOff[mo][0] + W) % W, mny = (mvy + moveOff[mo][1] + H) % H;
            var mnidx = mny * W + mnx;
            if (mocc.has(mnidx)) continue;
            if (E[mnidx] > bE) { bE = E[mnidx]; bIdx = mnidx; bX = mnx; bY = mny; }
          }
          if (bIdx < 0) continue;                  // 충분히 높은 빈 이웃 없음 → 머묾
          mocc.delete(mv.center);
          mv.x = bX; mv.y = bY; mv.center = bIdx;   // 한 칸 이동 — m·E 불변(장부 불변)
          mv.cells = discCells(W, H, bX, bY, p.lifeR);
          mocc.add(bIdx);
          sim.moves++;
        }
      }
      /* ⑥ 생명(흡수·유지·사망) — step-0006 그대로. cost = m·mMaint + baseCost, m 으로 클램프.
       * baseCost>0 이면 흡수(got)가 baseCost 에 못 미치는 마른 곳의 m 이 매 tick 줄어 굶어 죽는다.
       * 표류하는 source 위에선 *뒤처진* 개체가 마른 자리에 남아 굶고, *따라간* 개체만 흡수>=baseCost 로 산다. */
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
        /* (b) 유지+기초대사: m → metabolized. cost = m·mMaint + baseCost, m 으로 클램프. */
        var cost = a.m * mMaint + baseCost;
        if (cost > a.m) cost = a.m;
        a.m -= cost; sim.metabolized += cost;
        /* (c) 사망: 남은 m → E (분해), 에이전트 제거 */
        if (a.m < mDeath) {
          E[a.center] += a.m; a.m = 0;
          a.deathTick = sim.tick; sim.deaths++;
        } else {
          survivors.push(a);
        }
      }
      /* ⑦ 번식 — repro off 면 건너뜀(회귀 0). 분열 = 생물량 내부 분배(부모 m/2 + 자식 m/2).
       * E·M 불변 → 장부는 step-0006 식 그대로 닫힌다. step-0006 그대로.
       * 표류하는 source 위에선 *앞서간* 개체가 신선한 고임에서 m 을 키워 분열(출생 전선)한다. */
      if (p.repro) {
        var mDiv = p.mDiv, divOff = sim.divOffsets, popCap = p.popCap, occ = sim.occSet;
        occ.clear();
        for (var s = 0; s < survivors.length; s++) occ.add(survivors[s].center);
        var nDiv = survivors.length;
        for (var s2 = 0; s2 < nDiv; s2++) {
          var par = survivors[s2];
          if (par.m < mDiv) continue;
          if (survivors.length >= popCap) break;
          /* 입이 닿는 빈 이웃 중 E 가 가장 높은 셀 — 동률은 divOff 스캔 순서로(결정론) */
          var px = par.x, py = par.y, bestIdx = -1, bestE = -Infinity, bestX = 0, bestY = 0;
          for (var o = 0; o < divOff.length; o++) {
            var nx = (px + divOff[o][0] + W) % W, ny = (py + divOff[o][1] + H) % H;
            var nidx = ny * W + nx;
            if (occ.has(nidx)) continue;
            if (E[nidx] > bestE) { bestE = E[nidx]; bestIdx = nidx; bestX = nx; bestY = ny; }
          }
          if (bestIdx < 0) continue;       // 빈 이웃 없음 → 분열 보류
          var half = par.m * 0.5;
          par.m = half;                    // 부모 반감
          survivors.push({                 // 자식 — 나머지 절반(터와 거래 없음 → 장부 불변)
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

  /* 총 생물량 M = Σ 에이전트.m (장부 항. 드리프트 없이 직접 합산) */
  function totalBiomass(sim) {
    var M = 0, ag = sim.agents;
    for (var k = 0; k < ag.length; k++) M += ag[k].m;
    return M;
  }

  /* 닫힌 장부 검사: sumE + M + evaporated + sunk + metabolized - injected = E0
   * 상대 잔차 = |위반량| / max(1, E0 + injected). 표류는 주입 위치만 옮길 뿐 총량 보존이라 새 항이 없다. */
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

  /* 고임(자원의 원형) 검출 — step-0002 와 동일. source 아닌 곳의 지속 봉우리.
   * 표류 source 도 매 tick 위치가 sim.p.source.x 에 갱신되므로 exclusion 이 따라간다. */
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

  /* 토러스 거리(wrap) — 두 셀 사이 최단 유클리드 거리. 이동/이주/추적 측정용. */
  function torusDist(W, H, ax, ay, bx, by) {
    var dx = Math.abs(ax - bx); if (dx > W - dx) dx = W - dx;
    var dy = Math.abs(ay - by); if (dy > H - dy) dy = H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* 개체군 무게중심(생물량 가중, 토러스) — 원형 평균으로 wrap 안전하게 계산. 개체가 없으면 null. */
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

  /* 개체군 공간 확산 반경 — 무게중심에서 각 개체까지 생물량 가중 RMS 거리(토러스). */
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

  /* 무게중심 → source 추적 거리(토러스) — ③ 추적 측정용. 개체가 없으면 null.
   * 개체군이 떠도는 자원을 추적하면 이 거리가 작고 유계로 머문다; 못 따라가면 발산하거나 개체 0. */
  function trackDist(sim) {
    var ct = centroid(sim);
    if (!ct) return null;
    return torusDist(sim.p.W, sim.p.H, ct.x, ct.y, sim.p.source.x, sim.p.source.y);
  }

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용.
   * E 비트열 + 기본 장부 + 생명(metabolized) + 각 에이전트 x,y,m.
   * step-0006 hashState 와 *동일 필드* 만 해시한다 — srcJump=0 이면 step-0006 과 일치(회귀).
   * (source 위치는 tick 의 결정론적 함수이고 그 효과가 E 에 모두 반영되므로 따로 해시하지 않는다.) */
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

  /* 기본 장부만 해시 — 회귀 검사(에이전트 0 일 때 step-0006 과 비트 동일)용. */
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

  /* source/sink 위치·반경 변경 후 셀 목록 재계산 — 검증 시나리오·데모용.
   * 시뮬레이션 상수가 아니라 시나리오 조작이다. opts: {x,y,r,rate}(일부만 줘도 됨).
   * step-0007: source 를 수동 이동하면 표류 앵커(srcBase·srcBaseTick)도 갱신해 표류가 새 자리에서 이어진다. */
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
    totalBiomass: totalBiomass, ledger: ledger, measure: measure,
    detectPools: detectPools, harvest: harvest, localE: localE,
    torusDist: torusDist, centroid: centroid, spread: spread, trackDist: trackDist, discCells: discCells,
    setSource: setSource, setSink: setSink,
    hashState: hashState, hashBase: hashBase
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS7 = api;
})(typeof window !== 'undefined' ? window : globalThis);
