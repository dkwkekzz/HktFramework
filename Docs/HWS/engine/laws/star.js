  /* ⑤b 점화·연소·소진(step-0011) — 구동 내생화. kIgnite=0 이면 통째로 건너뜀(회귀 0, stars 불변).
   * 별 = 활성도 축의 *소산 극단*(SPINE 결정2). 닫힌 고리: 저장체 R 이 임계를 넘으면 *세계 안에서* 점화
   * (R→연료, 쌍 거래) → 연료를 E 로 태우며 국소 봉우리가 되고(연료→E, 쌍 거래) → 소진하면 꺼진다(비가역, 결정3).
   * 태운 E 가 퍼져(①확산) 다른 곳에 R 로 굳고(⑤결정화)→새 별이 거기서 점화→봉우리 *명멸·이동*. 외부 고정 source
   * (영구 전역 봉우리)가 사라져 개체군이 수렴할 점이 없어진다. 새 외부 항 없음 — injected 불변, F 가 순잔액:
   *   sumE + M + R + F + evap + sunk + metab − injected = E0  (별 없으면 F=0 → step-0010 장부 식과 동일).
   * 결정4(속성–필드–국소반응): 별은 fuel 속성 + 로컬 R 문턱(내 칸 R>ignThresh 면 점화)으로만 판정 — 전역 조율자 0. */
  var STAR_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];   // 서행 방향(4이웃) — 점화 시 tumbleHash 로 하나 고른다
  var ASH_LINGER = 20;   // 재(ash) 불응기 길이(고정 상수, 노브 아님) — 식는 ember 가 점화 슬롯을 점유하는 tick 수.

  function ignite(sim) {
    var p = sim.p; if (p.kIgnite === 0) return;
    var E = sim.E, R = sim.R, W = p.W, H = p.H, stars = sim.stars;
    var starRate = p.starRate, dPer = p.starDriftPeriod;
    /* 1. 각 별의 한 tick: 주입(연료→E, disc — sim.injected 로 경계 추적) → 소진 판정 → 서행(정한 방향 주기마다 한 칸).
     *    별은 *외부 질량(연료)을 태워 장에 주입하며 서행하는 채식지*다 — 생명이 그 E 봉우리를 쫓는다(churn 엔진). */
    var alive = [], fsm = p.kFSM !== 0;
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s], cells = st.cells, nc = cells.length;
      if (st.state === 2) {                                     // 재(ash) — 식는 ember: 주입 0·정지. ASH_LINGER tick 머물다 제거(비가역·불응기).
        if (++st.ashAge >= ASH_LINGER) { sim.starDeaths++; continue; }   //   점화 슬롯을 점유해 그 자리 재점화를 막는다(흥분성 매질 refractory).
        alive.push(st); continue;
      }
      /* 주입율 — FSM on 이면 상태 배수(living=livingFrac, burning=1), off 면 원본(비트 동일: burnMul undefined). */
      var want = (st.burnMul !== undefined ? starRate * st.burnMul : starRate) * nc, inj = st.fuel < want ? st.fuel : want, per = inj / nc;
      for (var bc = 0; bc < nc; bc++) E[cells[bc]] += per;
      st.fuel -= inj; sim.injected += inj; sim.burned += inj;
      if (st.fuel <= 1e-9) {                                    // 연료 소진(느린 변수) — FSM 이면 burning→ash(머문다), 아니면 즉시 꺼짐(비트 동일).
        if (fsm) { st.state = 2; st.burnMul = 0; st.ashAge = 0; alive.push(st); }
        else sim.starDeaths++;
        continue;
      }
      /* 서행 — burning 만 떠돈다(FSM on). living(kindling)은 정지해 핫코어를 쌓고, FSM off 면 늘 떠돈다(비트 동일).
       * 위치만 바꿈(거래 0). 점화 시 정한 방향으로 주기마다 한 칸 — 서행 봉우리를 생명이 따라온다. */
      st.age++;
      if (st.age % dPer === 0 && (st.state === undefined || st.state === 1)) {
        var nx = (st.x + st.vx + W) % W, ny = (st.y + st.vy + H) % H;
        st.x = nx; st.y = ny; st.center = ny * W + nx; st.cells = K.discCells(W, H, nx, ny, p.starR);
      }
      alive.push(st);
    }
    sim.stars = stars = alive;
    /* 2. 점화 — 저장체 R 이 ignThresh 를 넘은 셀 중, 기존 별과 starGap 이상 떨어진 *최강 R 핵*에서 새 별 1개가
     *    태어난다(starCap 까지, tick 당 최대 1). 위치는 내생(R 누적), 방향은 tumbleHash(시드 결정 의사난수), 연료는
     *    외부 할당(starFuel0). R 은 *소비하지 않는다* — 별이 선 자리의 표식일 뿐(주입형: 별 에너지는 제 질량에서). */
    if (stars.length < p.starCap) {
      var ignThresh = p.ignThresh, starGap2 = p.starGap * p.starGap;
      var bestR = ignThresh, bi = -1, bx = 0, by = 0;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var i = y * W + x;
          if (R[i] <= bestR) continue;
          var ok = true;                              // 기존 별과 너무 가까우면 skip(국소 거리만)
          for (var k = 0; k < stars.length; k++) {
            var dx = Math.min((x - stars[k].x + W) % W, (stars[k].x - x + W) % W);
            var dy = Math.min((y - stars[k].y + H) % H, (stars[k].y - y + H) % H);
            if (dx * dx + dy * dy < starGap2) { ok = false; break; }
          }
          if (!ok) continue;
          bestR = R[i]; bi = i; bx = x; by = y;
        }
      }
      if (bi >= 0) {
        var d = STAR_DIR[K.tumbleHash(bx, by, sim.tick, sim.seed) & 3];
        var ns = { x: bx, y: by, center: bi, fuel: p.starFuel0, cells: K.discCells(W, H, bx, by, p.starR),
          vx: d[0], vy: d[1], age: 0, bornTick: sim.tick };
        if (p.kFSM !== 0) { ns.state = 0; ns.burnMul = p.livingFrac; }   // FSM on: 갓 점화 = living(kindling). off: 필드 없음(회귀).
        stars.push(ns);
        sim.starBirths++;
      }
    }
  }

  /* ⑤c 연소 FSM(별 living→burning→ash, step-0013) — kFSM=0 이면 통째로 건너뜀(회귀 0, 별 상태 필드 없음 → 해시 불변).
   * 별의 alive→dead proto-FSM(점화→소진) *가운데 burning 을 끼워* 이산 3-상태 FSM 을 완성한다(SPINE 결정3):
   *   living(갓 점화 kindling — 저활성 livingFrac·정지) →[핫코어 ≥ burnOn]→ burning(전율 1·서행) →[핫코어 < burnOff]→ ash(0·제거).
   * 핫코어 = 별 disc 평균 E(자기 throughput 의 잔열). 전이는 *문턱에서 딱 뒤집힘*(연속 변조 아님) — 활성도 배수(burnMul)가
   * 0.4→1→0 으로 *계단* 점프한다. 비가역: living→burning→ash 만(되돌림 없음·ash 는 ⑤b ignite 가 제거). 활성도로 환원:
   * burning ⟺ 전율 주입(burnMul=1) ⟺ 별 disc 의 dE/dt 가 높음 — 라벨은 그 측정의 편의 표기일 뿐(결정2 정합 (b)).
   * 히스테리시스: burnOn>burnOff(폭>0)라 경계에서 안 떨리고(anti-chatter) — 이산성이 *문턱 분리*에서 창발(결정2 정합 (c)).
   * 척추: 새 필드 없음(필드는 E·R, state 는 별 *속성* Fragment) · authored type 분기 없음(켜지는 국소 법칙=주입 배수·서행만 바뀜, 결정4) ·
   * 국소 문턱(제 disc 평균 E 만 본다, 전역 조율자 0) · 닫힌 장부(state 는 거래 0 — 주입은 ⑤b 가 fuel→E 로, 외부 질량 경계 불변).
   * combust 는 ⑤b ignite *앞*에 둔다 — 이번 tick 주입 전에 상태를 정해(이전 tick 잔열 기준) burnMul 을 ignite 가 읽는다. */
  function combust(sim) {
    var p = sim.p; if (p.kFSM === 0) return;
    var stars = sim.stars; if (!stars.length) return;
    var E = sim.E, burnOn = p.burnOn, burnOff = p.burnOff, lf = p.livingFrac;
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      if (st.state === undefined) { st.state = 0; st.burnMul = lf; }   // 안전 초기화(런 도중 FSM 켠 경우)
      if (st.state === 2) continue;                                   // 재(ash)는 ignite 가 ashAge 로 관리(불응기) — 전이 없음
      var cells = st.cells, nc = cells.length, sum = 0;               // 핫코어 = disc 평균 E(자기 throughput 의 잔열, 단일 셀보다 서행에 강건)
      for (var c = 0; c < nc; c++) sum += E[cells[c]];
      var hot = sum / nc;
      if (st.state === 0) {                                           // living(kindling): flashpoint(빠른 변수) 도달이면 SNAP 연소(점화 문턱 burnOn)
        if (hot >= burnOn) { st.state = 1; st.burnMul = 1; }
      } else {                                                        // burning: 핫코어가 소진 문턱 burnOff 미만으로 식으면 SNAP 재(조기 quench — 연료 남아도 꺼짐)
        if (hot < burnOff) { st.state = 2; st.burnMul = 0; st.ashAge = 0; }  //   히스테리시스: burnOn>burnOff(폭>0) → 그 사이 밴드에선 latch(안 떨림)
      }
    }
  }
