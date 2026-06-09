
  /* ─────────────────────────────────────────────────────────────────────────
   * 법칙들 — 매 tick 세계의 E/R/agents 를 제자리 변형. 각자 자기 노브로 게이트(노브=0 → early-return = 회귀).
   * 순서는 LAW_ORDER(아래)가 단일 출처로 고정한다: ①확산 ②증발 ③④구동 ⑤결정화 ⑥이동 ⑦생명 ⑧번식.
   * ───────────────────────────────────────────────────────────────────────── */

  /* ① 확산(+응집·기복) — E 의 흐름. *이 법칙이 E/buf 스왑을 소유한다*(확산 결과를 buf 에 써서 swap-in).
   * kRelief≠0 이면 무대 경로(기복, donor-제한 upwind, h=E+kRelief·R 내리막), 0 이면 4이웃 선형 확산.
   * kA≠0 이면 농도 창 응집을 같은 루프에서 가법(한 step=한 항이되 둘은 늘 같은 패스에서 계산됨 — 비트 동일 유지). */
  function diffuse(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var kA = p.kA, mc = p.aggMc, w = p.aggW;
    var x, y, i;
    if (p.kRelief !== 0) {
      /* 기복(donor-제한 upwind): 패스0 h=E+kRelief·R, 패스1 유출수요·제한 f, 패스2 변 flux(쌍 거래 보존). */
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
              aggK(bi < bN ? bi : bN, mc, w) * (bi - bN) +
              aggK(bi < bS ? bi : bS, mc, w) * (bi - bS) +
              aggK(bi < bW ? bi : bW, mc, w) * (bi - bW) +
              aggK(bi < bE ? bi : bE, mc, w) * (bi - bE)
            );
          }
        }
      }
    } else {
      /* 4이웃, wrap. 총량 보존 (step-0008 식 그대로 — kRelief=0 회귀 경로) */
      for (y = 0; y < H; y++) {
        var yN = ((y - 1 + H) % H) * W, yS = ((y + 1) % H) * W, yC = y * W;
        for (x = 0; x < W; x++) {
          var xW = (x - 1 + W) % W, xE = (x + 1) % W;
          i = yC + x;
          var eN = E[yN + x], eS = E[yS + x], eWc = E[yC + xW], eEc = E[yC + xE], eii = E[i];
          B[i] = eii + kD * (eN + eS + eWc + eEc - 4 * eii);
          if (kA !== 0) {
            B[i] += kA * (
              aggK(eii < eN ? eii : eN, mc, w) * (eii - eN) +
              aggK(eii < eS ? eii : eS, mc, w) * (eii - eS) +
              aggK(eii < eWc ? eii : eWc, mc, w) * (eii - eWc) +
              aggK(eii < eEc ? eii : eEc, mc, w) * (eii - eEc)
            );
          }
        }
      }
    }
    sim.E = B; sim.buf = E;
  }
  var aggK = K.aggKernel;

  /* ② 증발 — 매 tick E 의 kEvap 비율이 장부 evaporated 로. */
  function evaporate(sim) {
    var p = sim.p, E = sim.E, N = p.W * p.H, kEvap = p.kEvap, evap = 0, d;
    for (var i = 0; i < N; i++) { d = E[i] * kEvap; E[i] -= d; evap += d; }
    sim.evaporated += evap;
  }

  /* ③④ 구동 — 떠도는 source(step-0007) 재배치 + 주입 + 배출(sink). drive off 면 통째로 정지(회귀). */
  function drive(sim) {
    var p = sim.p; if (!p.drive) return;
    var E = sim.E, W = p.W, H = p.H, i, d;
    if (p.srcJump !== 0 && p.srcPeriod > 0) {
      var nj = Math.floor((sim.tick - sim.srcBaseTick) / p.srcPeriod);
      var ncx = (((sim.srcBase.x + p.srcJump * nj) % W) + W) % W;
      if (ncx !== p.source.x) {
        p.source.x = ncx;
        sim.srcCells = K.discCells(W, H, ncx, p.source.y, p.source.r);
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
  function crystallize(sim) {
    var p = sim.p; if (p.kCryst === 0) return;
    var E = sim.E, N = p.W * p.H, R = sim.R, kC = p.kCryst, cth = p.crystThresh, kW = p.kWeather;
    var cry = 0, wth = 0;
    for (var i = 0; i < N; i++) {
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
