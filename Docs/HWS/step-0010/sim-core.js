/* HWS step-0010 sim-core — 확률적 탐사(run-and-tumble): 생명이 움직이는 풍경을 능동 추적한다
 * step-0009(확산·증발·구동·응집·생명·번식·이동·기초대사비·떠도는 자원·결정화/풍화·기복) 을 잇는다.
 * 더해진 것은 단 하나: 탐사(tumble) — 갇힌(국소 최대) 굶주린 생명이 의사난수 방향으로 한 칸.
 *   ── 가설 (STATE.md 지정) ──
 *   step-0009 가 풍경을 살아 움직이게 했지만(퇴적 전선이 영구히 떠돎) greedy 정주 생명은 그 위에서 *살되
 *   따라가지 못해* churn 이 멎는다(국소 최대 함정으로 옅은 골짜기를 못 건넘 — 0009 §8.1: 후반 6k 출생 2~7).
 *   step-0010 은 생명에게 *탐사*를 준다 — 옅은 골짜기를 건너 다음 떠도는 고임을 찾는 능력. 가설: 풍경의 내생
 *   churn 이 생명의 *끝나지 않는* churn 으로 전사된다(정적 source 인데 출생≈사망>0 지속 — G2 완전 해소 후보).
 *   메커니즘 — run-and-tumble(대장균 주화성의 최소형): 운동은 두 모드의 *접합*이 아니라 한 원리의 두 얼굴이다.
 *     ◦ run (구배 존재): greedy 가 더 높은 E 이웃으로 한 칸 — 구배가 운동을 *편향*(step-0005~0009 그대로).
 *     ◦ tumble (구배 없음): 갇힌(이동 불가=국소 최대) + 굶주린(예측 흡수 < 비용) 생명이 의사난수 방향으로 한 칸.
 *   *원칙*: 구배에 정보가 없으면(국소 최대·옅은 평지) 편향 없는 운동 = 대칭 무작위 보행만 남는다 — 이게 필드 E
 *     자신의 운동(구배 있으면 advection, 없으면 등방 확산)을 생물량 m 이 *물려받는* 것이다. greedy 는 특수 케이스,
 *     무작위가 일반(null) 운동. "굶주림"이 tumble 의 편향(rate)을 켠다 — 잘 먹는 정착 생명은 탐사하지 않는다.
 *   왜 가법(폴백)이지 *순수* 연속 run-and-tumble 이 아닌가(회귀 0 의 제약): 순수 run-and-tumble("항상 표류 +
 *     나쁜 소식에 재배향")은 *greedy 등반*과 다른 운동 원시형이라 pTumble=0 에서 step-0009 로 환원되지 않는다
 *     (회귀 0 위반). 그래서 greedy(run)를 *기반*에 두고, 구배가 사라진 자리(bIdx<0)에서만 tumble 을 더한다 —
 *     이게 "구배 없는 곳에 남는 무작위"라는 원칙의 가법적 실현. pTumble=0 이면 분기 통째 skip → 비트 동일.
 *   무작위 = 비결정론이 아니다(결정론적 의사난수): 방향은 tumbleHash(x,y,tick,seed) — Math.random 금지(척추 결정론).
 *     "무작위"의 의미는 *구배와 무상관*(탈상관)이지 *생성이 비결정*이 아니다. 같은 시드 2회 → 비트 동일.
 *   국소성(척추 결정3): tumble 트리거는 그 개체의 m·위치 + 입(disc)의 로컬 E 만 본다 — 전역 조율자 0.
 *   순환 장부(척추 결정4): tumble 은 *순수 위치 변경*(거래 0) — greedy 이동(step-0005)과 같이 장부 식 불변.
 * 순서: ①확산(+응집·기복) ②증발 ③주입 ④배출 ⑤결정화·풍화 ⑥이동(run+*tumble 신규*) ⑦생명 ⑧번식. 순서 불변.
 * 회귀: pTumble=0 이면 tumble 분기가 통째로 건너뛰어져 step-0009 의 이동(greedy)을 같은 순서로 수행 → 비트 동일.
 *   kRelief=0 이면 step-0008, kCryst=0 이면 step-0007, srcJump=0 이면 step-0006, … (회귀 체인 그대로).
 * 닫힌 장부: sumE + M(=Σm) + R(=ΣR) + evaporated + sunk + metabolized - injected = E0. (step-0009 그대로 —
 *   탐사는 위치만 바꿀 뿐 아무것도 거래하지 않는다.)
 * 브라우저/Node 겸용. step-0010.html 의 셸이 이 파일을 그대로 로드한다(window.HWS10).
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
    /* ── step-0008: 결정화·풍화(저장체 = 평형 개체) ── */
    kCryst: 0,             // 결정화율. 0 = off = step-0007 과 비트 동일(회귀). >0 이면 E>crystThresh 인 셀의
                           //   초과분의 이 비율이 매 tick 굳어 R 로(E→R). 높은 문턱 진입(빠름).
    crystThresh: 3.0,      // 결정화 문턱(척추 결정3) — E 가 이 값을 넘는 셀에서만 결정화가 켜진다(강한 고임 핵).
    kWeather: 0.0003,      // 풍화율 — 매 tick R 의 이 비율이 E 로 되돌아간다(R→E, 느림·무조건).
    /* ── step-0009: 무대(기복 — 퇴적이 바닥을 올려 흐름이 굳은 땅을 비켜간다) ── */
    kRelief: 0,            // 기복 가중. 0 = off = step-0008 과 비트 동일(회귀). >0 이면 흐름 퍼텐셜
                           //   h = E + kRelief·R 의 내리막으로 확산(donor-제한 upwind). 1 이면 3D 지형(E+R)과
                           //   흐름 퍼텐셜이 일치. 시나리오 튜닝 노브(결정론 무관) — 방향만 바꿀 뿐 총량 보존.
    /* ── step-0010 신규: 탐사(run-and-tumble — 갇힌 굶주린 생명이 의사난수 방향으로 한 칸) ── */
    pTumble: 0             // tumble 확률. 0 = off = step-0009 와 비트 동일(회귀). (0,1] 이면 greedy 가 갇힌
                           //   (이동 불가=국소 최대) + 굶주린(예측 흡수 < 비용) 생명이 매 tick 이 확률로 의사난수
                           //   방향(구배 무상관, tumbleHash) 한 칸 — 옅은 골짜기를 건너 다음 고임 탐색. 위치만 바꿔
                           //   장부 불변. 1 = 갇힌·굶주린 매 tick 무조건 tumble. 결정론 노브(시드 의사난수, 결정론 유지).
  };

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
      hPot: new Float64Array(N),               // step-0009: 흐름 퍼텐셜 h=E+kRelief·R 작업 버퍼(상태 아님)
      fLim: new Float64Array(N),               // step-0009: donor 유출 제한 f 작업 버퍼(상태 아님)
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
      moves: 0,            // 누적 이동(run, 주화성) 수 (통계용)
      tumbles: 0,          // step-0010: 누적 탐사(tumble) 수 (통계용 — 위치 변경이라 장부 무관)
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

  /* 법칙 적용 순서: ①확산(+응집·기복) ②증발 ③주입 ④배출 ⑤결정화·풍화 ⑥이동(run+tumble) ⑦생명 ⑧번식 — 순서 고정. */
  function step(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var kA = p.kA, mc = p.aggMc, w = p.aggW;
    var x, y, i, d;
    if (p.kRelief !== 0) {
      /* ① 확산(+응집) — step-0009 무대 경로(기복, donor-제한 upwind). 흐름 퍼텐셜 h=E+kRelief·R 의 내리막으로
       * 확산한다. 퇴적이 바닥을 올려(h↑) 흐름이 굳은 언덕을 *비켜 내려간다*. 흐름을 *밀어내는* 방향이라
       * 언덕에 E 가 안 쌓여 결정화가 자기 제한된다(확산을 *약화*하는 변조는 E 가 쌓여 결정화 폭주=매몰 → §7).
       *   패스0: h=E+kRelief·R. 패스1: dem_i=kD·Σmax(0,hi−hj), f_i=min(1, E_i/dem_i)(E 만 흐름, 양수성).
       *   패스2: 변 flux=f_donor·kD·max(0,Δh). 주는·받는 쪽 같은 식 → 쌍 거래 보존(장부 불변).
       * 한계: donor-제한 upwind 는 강한 h 구배(source·언덕)에서 tick 간 미세 진동이 있다(§8.3, 정직한 한계).
       *   화면 떨림은 자동 명암을 평활해 완화한다(엔진 — 시뮬 불변). 비진동 대안(대칭 변조)은 매몰되어 가설이
       *   깨지므로(§7), 진동 안전한 upwind 를 유지하고 진동은 한계로 남긴다. */
      var kB = p.kRelief, R9 = sim.R, hP = sim.hPot, fL = sim.fLim;
      for (i = 0; i < W * H; i++) hP[i] = E[i] + kB * R9[i];
      for (y = 0; y < H; y++) {
        var yNa = ((y - 1 + H) % H) * W, ySa = ((y + 1) % H) * W, yCa = y * W;
        for (x = 0; x < W; x++) {
          var xWa = (x - 1 + W) % W, xEa = (x + 1) % W;
          i = yCa + x;
          var hh = hP[i], dm = 0, dd;
          dd = hh - hP[yNa + x]; if (dd > 0) dm += dd;
          dd = hh - hP[ySa + x]; if (dd > 0) dm += dd;
          dd = hh - hP[yCa + xWa]; if (dd > 0) dm += dd;
          dd = hh - hP[yCa + xEa]; if (dd > 0) dm += dd;
          dm *= kD;
          fL[i] = dm > E[i] ? E[i] / dm : 1;
        }
      }
      for (y = 0; y < H; y++) {
        var yNb = ((y - 1 + H) % H) * W, ySb = ((y + 1) % H) * W, yCb = y * W;
        for (x = 0; x < W; x++) {
          var xWb = (x - 1 + W) % W, xEb = (x + 1) % W;
          i = yCb + x;
          var jN = yNb + x, jS = ySb + x, jW = yCb + xWb, jE = yCb + xEb;
          var hc = hP[i], net = 0, dv;
          dv = hc - hP[jN]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jN] * kD * (hP[jN] - hc);
          dv = hc - hP[jS]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jS] * kD * (hP[jS] - hc);
          dv = hc - hP[jW]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jW] * kD * (hP[jW] - hc);
          dv = hc - hP[jE]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jE] * kD * (hP[jE] - hc);
          var ei = E[i], bi = ei;
          B[i] = ei + net;
          if (kA !== 0) {
            var bN = E[jN], bS = E[jS], bW = E[jW], bE = E[jE];
            B[i] += kA * (
              aggKernel(bi < bN ? bi : bN, mc, w) * (bi - bN) +
              aggKernel(bi < bS ? bi : bS, mc, w) * (bi - bS) +
              aggKernel(bi < bW ? bi : bW, mc, w) * (bi - bW) +
              aggKernel(bi < bE ? bi : bE, mc, w) * (bi - bE)
            );
          }
        }
      }
    } else {
      /* ① 확산(+응집) — 4이웃, wrap. 총량 보존 (step-0008 식 그대로 — kBlock=0 회귀 경로) */
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
    /* ⑤ 결정화·풍화(step-0008) — kCryst=0 이면 통째로 건너뜀(회귀 0, R 불변). */
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
      /* ⑥ 이동 — run(주화성, 구배 따라 한 칸) + tumble(step-0010 신규, 갇히면 의사난수 한 칸). */
      if (p.move) {
        var moveOff = sim.moveOffsets, moveThresh = p.moveThresh, mocc = sim.occSet;
        var pTum = p.pTumble, tSeed = sim.seed, tTick = sim.tick;   // step-0010 탐사(결정론 의사난수)
        mocc.clear();
        for (var ms = 0; ms < ag.length; ms++) mocc.add(ag[ms].center);
        for (var mk = 0; mk < ag.length; mk++) {
          var mv = ag[mk];
          var floor = E[mv.center] + moveThresh;
          var mvx = mv.x, mvy = mv.y, bIdx = -1, bEv = floor, bX = 0, bY = 0;
          for (var mo = 0; mo < moveOff.length; mo++) {
            var mnx = (mvx + moveOff[mo][0] + W) % W, mny = (mvy + moveOff[mo][1] + H) % H;
            var mnidx = mny * W + mnx;
            if (mocc.has(mnidx)) continue;
            if (E[mnidx] > bEv) { bEv = E[mnidx]; bIdx = mnidx; bX = mnx; bY = mny; }
          }
          if (bIdx >= 0) {
            /* run — 구배가 있으면 더 높은 E 이웃으로(step-0005~0009 그대로). */
            mocc.delete(mv.center);
            mv.x = bX; mv.y = bY; mv.center = bIdx;
            mv.cells = discCells(W, H, bX, bY, p.lifeR);
            mocc.add(bIdx);
            sim.moves++;
            continue;
          }
          /* ── step-0010: tumble — 갇힘(구배 없음=국소 최대) → 굶주린 생명이 의사난수 방향 한 칸 ──
           * pTumble=0 이면 이 분기 통째 skip → step-0009 의 "갇히면 제자리"와 비트 동일(회귀 0).
           * 굶주림 게이트(국소 문턱): 입(disc)의 예측 흡수 < 이번 tick 비용이면 net 손실 — 도박할 만하다.
           *   잘 먹는 정착 생명(흡수≥비용)은 탐사하지 않는다 → 안정 정착을 깨지 않음.
           * 방향(구배 무상관): 빈 이웃 중 tumbleHash 로 균등 선택. 내리막도 허용(옅은 골짜기를 건너려면 필수). */
          if (pTum !== 0) {
            var mcells = mv.cells, intake = 0;
            for (var ic = 0; ic < mcells.length; ic++) intake += E[mcells[ic]];
            intake *= kL;
            var hcost = mv.m * mMaint + baseCost;
            if (intake < hcost) {                       // 굶주림 — net 손실 중
              var e0 = -1, e1 = -1, e2 = -1, e3 = -1, nE = 0;   // 빈 이웃 인덱스(최대 4)
              var ex0 = 0, ey0 = 0, ex1 = 0, ey1 = 0, ex2 = 0, ey2 = 0, ex3 = 0, ey3 = 0;
              for (var to = 0; to < moveOff.length; to++) {
                var tnx = (mvx + moveOff[to][0] + W) % W, tny = (mvy + moveOff[to][1] + H) % H;
                var tnidx = tny * W + tnx;
                if (mocc.has(tnidx)) continue;
                if (nE === 0) { e0 = tnidx; ex0 = tnx; ey0 = tny; }
                else if (nE === 1) { e1 = tnidx; ex1 = tnx; ey1 = tny; }
                else if (nE === 2) { e2 = tnidx; ex2 = tnx; ey2 = tny; }
                else { e3 = tnidx; ex3 = tnx; ey3 = tny; }
                nE++;
              }
              if (nE > 0) {
                var hsh = tumbleHash(mvx, mvy, tTick, tSeed);
                if ((hsh >>> 16) * (1 / 65536) < pTum) {       // 발화(rate) — 고비트
                  var pick = (hsh & 0xffff) % nE;              // 방향 — 저비트(균등)
                  var tIdx, tX, tY;
                  if (pick === 0) { tIdx = e0; tX = ex0; tY = ey0; }
                  else if (pick === 1) { tIdx = e1; tX = ex1; tY = ey1; }
                  else if (pick === 2) { tIdx = e2; tX = ex2; tY = ey2; }
                  else { tIdx = e3; tX = ex3; tY = ey3; }
                  mocc.delete(mv.center);
                  mv.x = tX; mv.y = tY; mv.center = tIdx;
                  mv.cells = discCells(W, H, tX, tY, p.lifeR);
                  mocc.add(tIdx);
                  sim.tumbles++;
                }
              }
            }
          }
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

  /* 총 저장체 R = Σ R[i] (장부 항. step-0008) */
  function totalStore(sim) {
    var s = 0, R = sim.R;
    for (var i = 0; i < R.length; i++) s += R[i];
    return s;
  }

  /* 닫힌 장부 검사: sumE + M + R + evaporated + sunk + metabolized - injected = E0
   * 기복(step-0009)은 확산 방향만, 탐사(step-0010)는 위치만 바꿀 뿐 — 둘 다 새 거래가 없어 장부 식이 불변이다. */
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

  /* 상태 해시 (FNV-1a 32bit) — 결정론(비트 동일) 검사용.
   * E + R 비트열 + 기본 장부 + 생명(metabolized) + 각 에이전트 x,y,m. (step-0008 과 동일.) */
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
    DEFAULTS: DEFAULTS, mulberry32: mulberry32, tumbleHash: tumbleHash, createSim: createSim,
    aggKernel: aggKernel, spawnAgent: spawnAgent, step: step, run: run,
    totalBiomass: totalBiomass, totalStore: totalStore, ledger: ledger, measure: measure, measureStore: measureStore,
    detectPools: detectPools, harvest: harvest, paintStore: paintStore, paintE: paintE, localE: localE, localStore: localStore,
    torusDist: torusDist, centroid: centroid, spread: spread, trackDist: trackDist, discCells: discCells,
    setSource: setSource, setSink: setSink,
    hashState: hashState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS10 = api;
})(typeof window !== 'undefined' ? window : globalThis);
