/* ============================================================
 * step-0009 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀 (분화 off 기본 — step-0008 과 비트 동일 + 트레이서의 동역학 중립성):
 *    reg  <seed>              — 미시 단독: 점화 off/on + 사슬 + 두-사슬 충돌 전부 step-0008 동일
 *    regc <seed>              — 미시+거시: step-0008 결합과 비트 동일
 *    reg0 <seed>              — 트레이서 중립성: comp on(φ=1 source) + igniteHeatB=null 이
 *                               comp off 와 비트 동일 — 동역학을 바꾸는 것은 *계수*뿐, 트레이서는 측정.
 *  분화 (igniteHeatB — 별의 종류는 물질이 운반한다):
 *    inherit <seed>           — 유전: φ=1 source 의 단일 사슬에서 후반 별 φ vs 장 전체 φ.
 *                               별이 source 형질을 *농축 운반*하는가?
 *    content <seed> [phi]     — 내용이 운명을 가른다: 단일 사슬 igniteHeatB 스윕 (φ=1 source).
 *                               열별 사슬은 빛별 사슬과 *같은 발산 총량*으로 다른 세계를 만드는가?
 *    cross   <seed> [dist] [heatB] — 이종 충돌: 빛(L)+빛, 빛+열(H), 열+열 조합의 경계 자식 대조.
 *                               자식의 living·성분 φ — 혼혈인가, 어느 쪽이 우세한가?
 *    probe   <seed> [heatB]   — 메커니즘: 조합별 경계 띠의 평균 rho/E/T (왜 L+H 만 자식이 죽는가).
 *    series  <seed> [heatB]   — 시계열 (이종 충돌의 일생): 경계 living·자식 φ·별 φ.
 *    cons    <seed> [heatB]   — 보존: E+T 잔차 (분화가 장부를 깨지 않는가) + rhoB ≤ rho 검사.
 * 시드 [42, 7, 1234, 99, 2026]. 표준 충돌 좌표 = step-0004 ③ (좌 16,32 · 우 48,32 · sink 32,8),
 * 사슬 연료·노브 = step-0007 (E=0.030, rho=0.020, ejR=6, thIgn=0.40).
 * ============================================================ */
const C = require('./sim-core.js');
const C8 = require('../step-0008/sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));

const CHAIN_PARAMS = {
  wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
  igniteSpread: 0.92, igniteHeat: 0.05, igniteRadius: 0,
};

/* ---------- reg: step-0009 코어 == step-0008 코어 (비트 동일) ---------- */
function expReg(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o0 = C8.sweepWindow(64, rates, 1500, seed, { wE });
    const n0 = C.sweepWindow(64, rates, 1500, seed, { wE });
    const md0 = Math.max(...rates.map((r, i) => Math.abs(o0[i].living - n0[i].living)));
    const o1 = C8.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const n1 = C.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const md1 = Math.max(...rates.map((r, i) => Math.abs(o1[i].living - n1[i].living)));
    console.log(`seed=${seed} wE=${wE}  점화off 최대차이=${md0}  점화on(thIgn=0.45) 최대차이=${md1}  ${md0 === 0 && md1 === 0 ? 'OK' : 'DIFF!'}`);
  }
  // 사슬(ejR=6) + 두-사슬 충돌(d=32) 도 step-0008 과 비트 동일한지 — 같은 시드·시나리오로 stats 비교
  const dr = chainRegDiff(seed);
  console.log(`seed=${seed} 사슬(ejR=6) step-0008 대비 최대차이: totalRho=${dr.rho.toExponential(2)} deaths=${dr.deaths} living=${dr.living}  ${dr.ok ? 'OK' : 'DIFF!'}`);
  const dc = collideRegDiff(seed);
  console.log(`seed=${seed} 충돌(d=32) step-0008 대비 최대차이: totalRho=${dc.rho.toExponential(2)} deaths=${dc.deaths} living=${dc.living}  ${dc.ok ? 'OK' : 'DIFF!'}`);
}
function chainRegDiff(seed) {
  const mk = (Core) => {
    const sim = Core.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    Core.addSource(sim, 16, 32, 2, 0.030, 0.020); Core.addSink(sim, 48, 48, 4, 0.10);
    let rho = 0, deaths = 0, living = 0;
    for (let t = 1; t <= 2000; t++) { const s = Core.step(sim); rho = s.totalRho; deaths = s.deathsTotal; living = s.livingCount; }
    return { rho, deaths, living };
  };
  const a = mk(C8), b = mk(C);
  return { rho: Math.abs(a.rho - b.rho), deaths: Math.abs(a.deaths - b.deaths), living: Math.abs(a.living - b.living),
    ok: a.rho === b.rho && a.deaths === b.deaths && a.living === b.living };
}
function collideRegDiff(seed) {
  const mk = (Core) => {
    const sim = Core.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    Core.twoChainScenario(sim, { dist: 32 });
    let rho = 0, deaths = 0, living = 0;
    for (let t = 1; t <= 2000; t++) { const s = Core.step(sim); rho = s.totalRho; deaths = s.deathsTotal; living = s.livingCount; }
    return { rho, deaths, living };
  };
  const a = mk(C8), b = mk(C);
  return { rho: Math.abs(a.rho - b.rho), deaths: Math.abs(a.deaths - b.deaths), living: Math.abs(a.living - b.living),
    ok: a.rho === b.rho && a.deaths === b.deaths && a.living === b.living };
}
function expRegc(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = C8.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* ---------- reg0: 트레이서의 동역학 중립성 ----------
 * comp on (φ=1 source, rhoB 가 매 tick 모든 수송에 동승) + igniteHeatB=null →
 * comp off 와 rho/E/T 가 비트 동일해야 한다. 트레이서는 순수 측정이고,
 * 동역학을 바꾸는 것은 오직 계수(igniteHeatB)임을 증명. */
function expReg0(seed) {
  const mk = (phi) => {
    const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    C.singleChainScenario(sim, { phi });            // phi=1 → enableComp, phi=0 → comp off
    let rho = 0, E = 0, T = 0, deaths = 0, living = 0;
    for (let t = 1; t <= 3000; t++) { const s = C.step(sim); rho = s.totalRho; E = s.totalE; T = s.totalT; deaths = s.deathsTotal; living = s.livingCount; }
    return { rho, E, T, deaths, living, comp: !!sim.rhoB };
  };
  const off = mk(0), on = mk(1);
  const ok = off.rho === on.rho && off.E === on.E && off.T === on.T && off.deaths === on.deaths && off.living === on.living;
  console.log(`seed=${seed} comp ${off.comp ? 'on' : 'off'}→${on.comp ? 'on' : 'off'} (φ=1, igniteHeatB=null)  차이: totalRho=${Math.abs(off.rho - on.rho).toExponential(2)} E=${Math.abs(off.E - on.E).toExponential(2)} T=${Math.abs(off.T - on.T).toExponential(2)} deaths=${Math.abs(off.deaths - on.deaths)} living=${Math.abs(off.living - on.living)}  ${ok ? 'OK (트레이서=순수 측정)' : 'DIFF!'}`);
}

/* ---------- inherit: 성분이 사슬을 따라 흐르는가 (유전) ----------
 * φ=1 source 단일 사슬, igniteHeatB=null (계수 off — 동역학은 step-0008 그대로, 트레이서만 켠다).
 * 후반 별들의 평균 φ vs 장 전체 평균 φ — 별이 source 형질을 *농축* 운반하면 별 φ ≫ 장 φ. */
function expInherit(seed) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.singleChainScenario(sim, { phi: 1 });
  const ticks = 10000, tail = Math.floor(ticks * 0.6);
  let sPhi = 0, sN = 0, farPhi = 0, farN = 0;
  for (let t = 1; t <= ticks; t++) {
    C.step(sim);
    if (t >= tail) {
      for (const b of sim.lastIgnite) {
        sPhi += b.phi; sN++;
        const x = b.i % 64, y = (b.i / 64) | 0;
        const d = Math.sqrt((x - 16) * (x - 16) + (y - 32) * (y - 32));
        if (d > 6) { farPhi += b.phi; farN++; }                 // 분배 디스크(r6) 밖 = 사슬이 *옮겨간* 자리
      }
    }
  }
  const fieldPhi = sim.stats.totalRhoB / sim.stats.totalRho;
  console.log(`seed=${seed} φ=1 source 단일 사슬 (igniteHeatB=null — 트레이서만), 10000 tick 후반:`);
  console.log(`  별 φ 평균=${f(sN ? sPhi / sN : 0, 3)} (n=${sN})  d>6 별 φ=${f(farN ? farPhi / farN : 0, 3)} (n=${farN})  vs 장 전체 φ=${f(fieldPhi, 3)}`);
  console.log(`  (별 φ ≫ 장 φ 면 사슬이 source 형질을 농축 운반 — 종류가 사슬을 따라 흐른다)`);
}

/* ---------- content: 발산의 내용이 사슬의 운명을 가른다 ----------
 * φ=1 source 단일 사슬에서 igniteHeatB 만 스윕. 발산 총량(light)·E+T 장부는 전부 동일 —
 * 다른 것은 오직 T↔E 분배뿐. 열별(heatB↑)은 빛 대신 열을 내린다 → 열 교반이 구조를 녹이고
 * 응집 연료(E)가 줄어 생명·사슬이 어떻게 달라지는가. */
function runContent(seed, phi, heatB, ticks) {
  const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  C.singleChainScenario(sim, { phi });
  ticks = ticks || 6000;
  const tail = Math.floor(ticks * 0.6);
  const xs = [], ys = [];
  let stars = 0, living = 0, phiSum = 0, phiN = 0, n = 0, maxResid = 0;
  for (let t = 1; t <= ticks; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t >= tail) {
      for (const b of sim.lastIgnite) { xs.push(b.i % 64); ys.push((b.i / 64) | 0); phiSum += b.phi; phiN++; }
      stars += sim.lastIgnite.length; living += st.livingCount; n++;
    }
  }
  let std = 0;
  if (xs.length > 1) {
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let v2 = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; v2 += dx * dx + dy * dy; }
    std = Math.sqrt(v2 / xs.length);
  }
  return { stars: stars / n, living: living / n, std, starPhi: phiN ? phiSum / phiN : 0,
    totalRho: sim.stats.totalRho, maxResid };
}
function expContent(seed, phi) {
  phi = phi == null ? 1 : +phi;
  console.log(`seed=${seed} φ=${phi} source 단일 사슬, igniteHeatB 스윕 (igniteHeat=0.05 = 빛별 기준):`);
  console.log('heatB | 별/tick  living  별 std  totalRho  별 φ');
  for (const hb of [0.05, 0.20, 0.35, 0.50, 0.65]) {
    const r = runContent(seed, phi, hb, 6000);
    console.log(`${f(hb, 2)}  |  ${f(r.stars, 2).padStart(5)}   ${f(r.living, 2).padStart(5)}   ${f(r.std, 1).padStart(4)}   ${f(r.totalRho, 1).padStart(6)}   ${f(r.starPhi, 2)}`);
  }
}

/* ---------- cross: 이종 충돌 — 빛별 사슬 + 열별 사슬의 경계 자식 ----------
 * d=32 (step-0008 ② 의 공유 자식 거리). 조합 LL(φ0+φ0)/LH(φ0+φ1)/HH(φ1+φ1).
 * igniteHeatB = heatB (열별의 열비). LL 은 분화 없음 = step-0008 충돌과 동일 동역학. */
function runCross(seed, dist, phiL, phiR, heatB, ticks) {
  const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  if (phiL || phiR) C.enableComp(sim);   // LL 도 comp on 으로 통일 (φ 측정을 위해) — reg0 가 중립성 보증
  else C.enableComp(sim);
  const sc = C.twoChainScenario(sim, { dist, phiL, phiR });
  ticks = ticks || 6000;
  const tail = Math.floor(ticks * 0.6);
  let living = 0, cross = 0, crossPhi = 0, crossPhiN = 0, n = 0;
  let lLiving = 0, rLiving = 0, border = 0, all = 0, maxResid = 0;
  for (let t = 1; t <= ticks; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t >= tail) {
      for (const b of sim.lastIgnite) { all++; if (Math.abs(b.i % 64 - sc.cx) <= 3) border++; }
      living += st.livingCount;
      for (const a of sim.agents) {
        if (!a.alive) continue;
        if (Math.abs(a.cx - sc.cx) <= 3) { cross++; crossPhi += C.agentPhi(sim, a); crossPhiN++; }
        else if (a.cx < sc.cx) lLiving++;
        else rLiving++;
      }
      n++;
    }
  }
  return { living: living / n, cross: cross / n, crossPhi: crossPhiN ? crossPhi / crossPhiN : 0,
    lLiving: lLiving / n, rLiving: rLiving / n, borderFrac: all ? border / all : 0, maxResid };
}
/* 단일 사슬 대조군 (step-0008 child 의 분화판): 좌 위치에 사슬 하나만 — 경계 living 이 *제 몸*인지 확인 */
function runCrossCtl(seed, dist, phi, heatB, ticks) {
  const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  C.enableComp(sim);
  C.singleChainScenario(sim, { x: 32 - (dist >> 1), y: 32, phi });
  ticks = ticks || 6000;
  const tail = Math.floor(ticks * 0.6);
  let cross = 0, n = 0;
  for (let t = 1; t <= ticks; t++) {
    C.step(sim);
    if (t >= tail) {
      for (const a of sim.agents) if (a.alive && Math.abs(a.cx - 32) <= 3) cross++;
      n++;
    }
  }
  return { cross: cross / n };
}
function expCross(seed, dist, heatB) {
  dist = dist == null ? 32 : +dist;
  heatB = heatB == null ? 0.5 : +heatB;
  console.log(`seed=${seed} dist=${dist} igniteHeatB=${heatB}  이종 충돌 (L=빛별 φ0, H=열별 φ1):`);
  console.log('조합 | 전체living  좌living  우living  경계living(자식)  자식 φ  경계별%');
  for (const [name, pL, pR] of [['L+L', 0, 0], ['L+H', 0, 1], ['H+H', 1, 1]]) {
    const r = runCross(seed, dist, pL, pR, heatB, 6000);
    console.log(`${name}  |   ${f(r.living, 2).padStart(6)}    ${f(r.lLiving, 2).padStart(5)}    ${f(r.rLiving, 2).padStart(5)}      ${f(r.cross, 2).padStart(5)}        ${f(r.crossPhi, 2)}   ${f(r.borderFrac * 100, 1)}`);
  }
  for (const [name, phi] of [['L만 ', 0], ['H만 ', 1]]) {
    const r = runCrossCtl(seed, dist, phi, heatB, 6000);
    console.log(`${name} |       -        -        -       ${f(r.cross, 2).padStart(5)}        (대조군: 단일 사슬의 경계 living)`);
  }
}

/* ---------- series: 이종 충돌의 일생 ---------- */
function expSeries(seed, heatB) {
  heatB = heatB == null ? 0.5 : +heatB;
  const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  const sc = C.twoChainScenario(sim, { dist: 32, phiL: 0, phiR: 1 });
  console.log(`seed=${seed} L+H d=32 heatB=${heatB}  tick   별수  경계living  자식φ  좌별φ  우별φ`);
  for (let t = 1; t <= 10000; t++) {
    const st = C.step(sim);
    if (t >= 7000 && t % 1000 === 0) {
      let bl = 0, bp = 0, bn = 0;
      for (const a of sim.agents) if (a.alive && Math.abs(a.cx - sc.cx) <= 3) { bl++; bp += C.agentPhi(sim, a); bn++; }
      let lp = 0, ln = 0, rp = 0, rn = 0;
      for (const b of sim.lastIgnite) { const x = b.i % 64; if (x < sc.cx) { lp += b.phi; ln++; } else { rp += b.phi; rn++; } }
      console.log(`              ${String(t).padStart(5)}   ${String(st.stars).padStart(3)}      ${String(bl).padStart(3)}      ${f(bn ? bp / bn : 0, 2)}   ${f(ln ? lp / ln : 0, 2)}   ${f(rn ? rp / rn : 0, 2)}`);
    }
  }
}

/* ---------- probe: 경계 띠의 장 상태 — 왜 L+H 만 자식이 죽는가 (메커니즘 정량화) ----------
 * 경계 띠(|x-32|<=3) 의 평균 rho / E / T 를 조합별로 잰다. 자식의 조건은 thRho(0.30)<rho<thIgn(0.40)
 * 의 창 + 낮은 T (열 교반이 응결을 녹이지 않을 것). */
function expProbe(seed, heatB) {
  heatB = heatB == null ? 0.5 : +heatB;
  console.log(`seed=${seed} d=32 heatB=${heatB}  경계 띠(|x-32|<=3) 의 후반 평균 장 상태:`);
  console.log('조합 | 경계 rho   경계 E    경계 T   (자식 창: thRho 0.30 < rho, T 낮을 것)');
  for (const [name, pL, pR] of [['L+L', 0, 0], ['L+H', 0, 1], ['H+H', 1, 1]]) {
    const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
    const sim = C.createSim(64, { seed, params });
    C.enableComp(sim);
    C.twoChainScenario(sim, { dist: 32, phiL: pL, phiR: pR });
    const ticks = 6000, tail = Math.floor(ticks * 0.6);
    let r = 0, e = 0, tt = 0, n = 0, clump = 0, snaps = 0, lh = 0, rh = 0, nh = 0;
    let ag = 0, agAge = 0, agLive = 0;
    for (let t = 1; t <= ticks; t++) {
      C.step(sim);
      if (t >= tail && t % 10 === 0) {
        snaps++;
        for (let y = 0; y < 64; y++) for (let x = 29; x <= 35; x++) {
          const i = y * 64 + x; r += sim.rho[i]; e += sim.E[i]; tt += sim.T[i]; n++;
          if (sim.rho[i] >= 0.30) clump++;                       // 자식 후보 = thRho 이상 응결 셀
          if (x <= 31) { lh += sim.rho[i]; nh++; } else if (x >= 33) rh += sim.rho[i];
        }
        // 경계 띠의 agent churn: 검출은 되나 항상성(나이 lifeAge)을 못 채우는가?
        for (const a of sim.agents) if (Math.abs(a.cx - 32) <= 3) {
          ag++; agAge += a.age; if (a.alive) agLive++;
        }
      }
    }
    console.log(`${name}  |  ${f(r / n, 3)}    ${f(e / n, 3)}    ${f(tt / n, 3)}    응결셀/스냅=${f(clump / snaps, 1)}  좌반/우반 rho=${f(lh / nh, 3)}/${f(rh / nh, 3)}  경계 agent/스냅=${f(ag / snaps, 2)} (living ${f(agLive / snaps, 2)}, 평균나이 ${f(ag ? agAge / ag : 0, 0)})`);
  }
}

/* ---------- cons: 보존 — 분화가 장부를 깨지 않는가 + 트레이서 건전성 ---------- */
function expCons(seed, heatB) {
  heatB = heatB == null ? 0.5 : +heatB;
  const params = Object.assign({ ejectRadius: 6, igniteHeatB: heatB }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  C.twoChainScenario(sim, { dist: 32, phiL: 0, phiR: 1 });
  let maxResid = 0, maxOver = 0;
  for (let t = 1; t <= 8000; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t % 500 === 0) {
      for (let i = 0; i < sim.M; i++) {
        const over = sim.rhoB[i] - sim.rho[i];
        if (over > maxOver) maxOver = over;
      }
    }
  }
  console.log(`seed=${seed} L+H d=32 heatB=${heatB}  E+T 최대잔차=${maxResid.toExponential(2)} (목표 ~1e-5)`);
  console.log(`  트레이서 건전성: max(rhoB-rho)=${maxOver.toExponential(2)} (φ≤1 위반량 — 0 또는 부동소수점 잡음 수준이어야)`);
}

const MODES = { reg: expReg, regc: expRegc, reg0: expReg0, inherit: expInherit, content: expContent, cross: expCross, probe: expProbe, series: expSeries, cons: expCons };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|reg0|inherit|content|cross|series|cons> <seed> [args]');
