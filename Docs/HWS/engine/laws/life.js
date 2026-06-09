  /* ⑥ 이동 — run(주화성, 구배 따라 한 칸, step-0005) + tumble(step-0010, 갇히면 의사난수 한 칸).
   * 생명 off / 에이전트 0 / move off 면 통째로 건너뜀(회귀). pTumble=0 이면 tumble 분기 skip(=step-0009). */
  function move(sim) {
    var p = sim.p;
    if (!p.life || !sim.agents.length || !p.move) return;
    var W = p.W, H = p.H, E = sim.E, ag = sim.agents;
    var kL = p.kL, mMaint = p.mMaint, baseCost = p.baseCost;
    var moveOff = sim.moveOffsets, moveThresh = p.moveThresh, mocc = sim.occSet;
    var pTum = p.pTumble, tSeed = sim.seed, tTick = sim.tick;
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
        mv.cells = K.discCells(W, H, bX, bY, p.lifeR);
        mocc.add(bIdx);
        sim.moves++;
        continue;
      }
      /* tumble — 갇힘(구배 없음=국소 최대) → 굶주린 생명이 의사난수 방향 한 칸(옅은 골짜기 건너기).
       * 굶주림 게이트: 입(disc)의 예측 흡수 < 이번 tick 비용이면 net 손실 — 도박할 만하다. 잘 먹는 정착 생명은 안 함. */
      if (pTum !== 0) {
        var mcells = mv.cells, intake = 0;
        for (var ic = 0; ic < mcells.length; ic++) intake += E[mcells[ic]];
        intake *= kL;
        var hcost = mv.m * mMaint + baseCost;
        if (intake < hcost) {                       // 굶주림 — net 손실 중
          var empties = sim.tumbleBuf; empties.length = 0;   // 빈 이웃 [idx,x,y] (재사용 버퍼)
          for (var to = 0; to < moveOff.length; to++) {
            var tnx = (mvx + moveOff[to][0] + W) % W, tny = (mvy + moveOff[to][1] + H) % H;
            var tnidx = tny * W + tnx;
            if (!mocc.has(tnidx)) empties.push(tnidx, tnx, tny);
          }
          var nE = empties.length / 3;
          if (nE > 0) {
            var hsh = K.tumbleHash(mvx, mvy, tTick, tSeed);
            if ((hsh >>> 16) * (1 / 65536) < pTum) {       // 발화(rate) — 고비트
              var pick = ((hsh & 0xffff) % nE) * 3;        // 방향 — 저비트(균등)
              mocc.delete(mv.center);
              mv.x = empties[pick + 1]; mv.y = empties[pick + 2]; mv.center = empties[pick];
              mv.cells = K.discCells(W, H, mv.x, mv.y, p.lifeR);
              mocc.add(empties[pick]);
              sim.tumbles++;
            }
          }
        }
      }
    }
  }

  /* ⑥b 혼잡(밀도 의존 자기제한, step-0012) — kCrowd=0 이면 통째로 건너뜀(회귀 0, agents·장부 불변).
   * 내생 구동(별)은 동결을 풀었으나 carrying capacity 가 없어 생명이 과증식→공멸했다(step-0011 §5). 이 법칙은
   * 그 *음성 피드백*을 더한다: 각 생명이 *국소 밀도*(crowdR disc 안의 다른 생명 수)에 비례한 추가 대사세를 낸다 —
   * 붐비면 net 손실이 커져(흡수<비용) 솎이고, 다음 ⑦생명에서 m<mDeath 면 죽는다(죽음 처리는 ⑦에 위임 — 중복 없음).
   * 이것이 로지스틱 자기제한이다: 국소 밀도가 높을수록 1인당 생존이 어려워져 개체군이 *국소* 수용력으로 수렴한다.
   * 척추: 새 필드 없음(필드는 여전히 E) · authored 분기 없음(연속 활성도 변조) · 국소 문턱(이웃만 셈, 전역 조율자 0) ·
   * 닫힌 장부(혼잡세는 m→metabolized 쌍 거래, baseCost 와 같은 소산 경계 — sumE+M+R+…+metab−inj=E0 불변). */
  function crowd(sim) {
    var p = sim.p; if (p.kCrowd === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, W = p.W, H = p.H, kC = p.kCrowd;
    /* crowdR disc 오프셋(중심 제외) — 노브 변경 시에만 재계산, sim 에 캐시(상태 아님 → 해시·회귀 무관). */
    var offs = sim.crowdOffsets;
    if (!offs || sim.crowdOffR !== p.crowdR) { offs = sim.crowdOffsets = K.discOffsets(p.crowdR); sim.crowdOffR = p.crowdR; }
    var occ = sim.crowdGrid, NG = W * H;
    if (!occ || occ.length !== NG) occ = sim.crowdGrid = new Uint16Array(NG);
    else occ.fill(0);
    for (var k = 0; k < ag.length; k++) occ[ag[k].center]++;   // 점유 그리드(보통 셀당 1)
    for (var k2 = 0; k2 < ag.length; k2++) {
      var a = ag[k2], ax = a.x, ay = a.y, dens = 0;
      for (var o = 0; o < offs.length; o++) {
        var nx = (ax + offs[o][0] + W) % W, ny = (ay + offs[o][1] + H) % H;
        dens += occ[ny * W + nx];
      }
      if (dens === 0) continue;
      var tax = kC * dens;                                     // 혼잡 대사세(절대) — 밀도 비례
      if (tax > a.m) tax = a.m;
      a.m -= tax; sim.metabolized += tax;                      // 소산(스트레스 호흡, 닫힌 장부 sink)
    }
  }

  /* ⑦ 생명(흡수·유지·사망) — step-0006 그대로. cost = m·mMaint + baseCost. survivors 를 sim.agents 로 넘긴다
   * (원본은 생명 블록 끝에서 한 번 대입했지만, 여기선 ⑦ 끝에 대입 → ⑧ 번식이 그 배열을 읽고 push: 비트 동일). */
  function metabolize(sim) {
    var p = sim.p;
    if (!p.life || !sim.agents.length) return;
    var E = sim.E, ag = sim.agents, kL = p.kL, mMaint = p.mMaint, mDeath = p.mDeath, baseCost = p.baseCost;
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
    sim.agents = survivors;
  }

  /* ⑧ 번식 — repro off 면 건너뜀. 분열 = 생물량 내부 분배(부모 m/2 + 자식 m/2). step-0004 그대로.
   * sim.agents(=⑦의 survivors)를 직접 읽고 push — 원본의 survivors push 와 동일 배열·동일 순서. */
  function reproduce(sim) {
    var p = sim.p;
    if (!p.life || !p.repro) return;
    var W = p.W, H = p.H, E = sim.E, survivors = sim.agents;
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
        cells: K.discCells(W, H, bestX, bestY, p.lifeR),
        center: bestIdx, bornTick: sim.tick
      });
      occ.add(bestIdx);
      sim.births++;
    }
  }
