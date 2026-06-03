/* ============================================================
 * step-0004 헤드리스 검증 (Node):  node verify.js <mode> [args]
 *  ① 다양성과 행동의 양립:
 *    reg  <seed>                    — 회귀: step-0003 코어와 동일한가 (wE 0 / 0.5)
 *    div  <seed> [wE]               — 다양성 스윕: alphaA × rhoMax (정주 다양성·속도)
 *    herd <seed> <wE> <alphaA> <rhoMax> — 기동성: 걷는 source 추적 (step-0003과 같은 프로토콜)
 *    arch <seed> [wE]               — 군도: 분산 자원에서 다양성+행동이 양립하는가
 *    walk4 <seed> [wE]              — 집단 이주: 4 source가 함께 동쪽으로 16셀 걷는다
 *    split <seed> [wE]              — 분열: source가 둘로 갈라지면 군락도 갈라지는가
 *  ② 하향 결합 (wBack):
 *    back <seed> <wBack>            — 무리 짓기: t=2500에 wBack 켜고 응집도 전/후 비교
 *    dis  <seed> <wBack> [flare]    — 재앙 전파: t=3000에 승급 소득 ×flare(200tick) → 거시 발화 → 미시 사망
 * 모든 수치는 시드 [42, 7, 1234, 99, 2026]로 시드별 실행해 평균한다 (45초 제한).
 * ============================================================ */
const C = require('./sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : String(x));
function wdist(N, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy);
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- reg: step-0003 코어와 비트 단위 비교 ---------- */
function expReg(seed) {
  const OLD = require('../step-0003/sim-core.js');
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o = OLD.sweepWindow(64, rates, 1500, seed, { wE });
    const n = C.sweepWindow(64, rates, 1500, seed, { wE });
    const maxd = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
    console.log(`seed=${seed} wE=${wE} 최대차이=${maxd} ${maxd === 0 ? 'OK' : 'DIFF!'}`);
  }
}

/* ---------- div: ① 정주 다양성 스윕 (단일 source, 3000 tick) ---------- */
function expDiv(seed, wE) {
  wE = wE == null ? 1 : +wE;
  console.log(`seed=${seed} wE=${wE}`);
  console.log('alphaA rhoMax living speed births/1k deaths/1k contested% resid');
  for (const alphaA of [0.05, 0.15, 0.3]) for (const rhoMax of [0.5, 0.7, 0.9]) {
    const sim = C.createSim(64, { seed, params: { wE, alphaA, rhoMax } });
    C.defaultScenario(sim, 0.04);
    let liv = 0, spd = 0, n = 0;
    for (let t = 0; t < 3000; t++) {
      const s = C.step(sim);
      if (t >= 2000) { liv += s.livingCount; spd += s.meanSpeed; n++; }
    }
    const con = sim.deathsTotal ? sim.contested / sim.deathsTotal * 100 : 0;
    console.log(`${alphaA} ${rhoMax} ${f(liv / n, 2)} ${f(spd / n, 4)} ${f(sim.births / 3, 1)} ${f(sim.deathsTotal / 3, 1)} ${f(con, 0)} ${Math.abs(sim.stats.resid).toExponential(1)}`);
  }
}

/* ---------- herd: ① 기동성 — 걷는 source (step-0003 herd와 같은 프로토콜) ---------- */
function expHerd(seed, wE, alphaA, rhoMax) {
  const sim = C.createSim(64, { seed, params: { wE: +wE, alphaA: +alphaA, rhoMax: +rhoMax } });
  C.addSource(sim, 16, 16, 3, 0.04); C.addSink(sim, 48, 48, 4, 0.10);
  for (let t = 0; t < 1500; t++) C.step(sim);
  const olds = sim.agents.filter(a => a.alive).map(a => a.id);
  let sx = 16;
  for (let t = 0; t < 3700; t++) {
    if (t % 80 === 0 && sx < 48) { sx++; sim.sources.length = 0; C.addSource(sim, sx, 16, 3, 0.04); }
    C.step(sim);
  }
  let surv = 0, fin = 0, travel = 0;
  for (const id of olds) {
    const a = sim.agents.find(x => x.id === id && x.alive);
    if (a) { surv++; fin += wdist(64, a.cx, a.cy, 48, 16); travel += a.dist; }
  }
  const livAfter = sim.agents.filter(a => a.alive).length;
  console.log(`seed=${seed} 정착=${olds.length} 생존=${surv} 최종living=${livAfter} 누적이동=${surv ? f(travel / surv, 1) : '-'} source까지=${surv ? f(fin / surv, 1) : '-'}`);
}

/* ---------- ②·군도 공통: 시나리오 ---------- */
function archipelago(sim) {
  sim.sources.length = 0; sim.sinks.length = 0;
  C.addSource(sim, 16, 16, 3, 0.04); C.addSource(sim, 48, 16, 3, 0.04);
  C.addSource(sim, 16, 48, 3, 0.04); C.addSource(sim, 48, 48, 3, 0.04);
  C.addSink(sim, 32, 32, 4, 0.10);
}

/* ---------- arch: ① 군도 — 분산 자원에서 다양성+행동이 양립하는가 ---------- */
function expArch(seed, wE) {
  wE = wE == null ? 1 : +wE;
  const sim = C.createSim(64, { seed, params: { wE } });
  archipelago(sim);
  let liv = 0, spd = 0, n = 0;
  for (let t = 0; t < 3000; t++) {
    const s = C.step(sim);
    if (t >= 2000) { liv += s.livingCount; spd += s.meanSpeed; n++; }
  }
  const L = sim.agents.filter(a => a.alive);
  let pd = 0, np = 0;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { pd += wdist(64, L[i].cx, L[i].cy, L[j].cx, L[j].cy); np++; }
  console.log(`seed=${seed} wE=${wE} living=${f(liv / n, 2)} 속도=${f(spd / n, 4)} 쌍거리=${np ? f(pd / np, 1) : '-'} 탄생/사망=${sim.births}/${sim.deathsTotal}`);
}

/* ---------- walk4: ① 집단 이주 — 4 source가 함께 동쪽으로 16셀 걷는다 ---------- */
function expWalk4(seed, wE) {
  wE = wE == null ? 1 : +wE;
  const sim = C.createSim(64, { seed, params: { wE } });
  archipelago(sim);
  for (let t = 0; t < 2000; t++) C.step(sim);
  const olds = sim.agents.filter(a => a.alive).map(a => a.id);
  const pos = [[16, 16], [48, 16], [16, 48], [48, 48]];
  let walked = 0;
  for (let t = 0; t < 2800; t++) {
    if (t % 80 === 0 && walked < 16) {
      walked++;
      sim.sources.length = 0;
      for (const p of pos) C.addSource(sim, (p[0] + walked) % 64, p[1], 3, 0.04);
    }
    C.step(sim);
  }
  let surv = 0, fin = 0, travel = 0;
  for (const id of olds) {
    const a = sim.agents.find(x => x.id === id && x.alive);
    if (a) {
      surv++; travel += a.dist;
      let best = 1e9;
      for (const p of pos) best = Math.min(best, wdist(64, a.cx, a.cy, (p[0] + 16) % 64, p[1]));
      fin += best;
    }
  }
  const livAfter = sim.agents.filter(a => a.alive).length;
  console.log(`seed=${seed} wE=${wE} 정착=${olds.length} 생존=${surv} 최종living=${livAfter} 누적이동=${surv ? f(travel / surv, 1) : '-'} source까지=${surv ? f(fin / surv, 1) : '-'}`);
}

/* ---------- split: ① 분열 — source가 둘로 갈라져 걸어가면 군락도 갈라지는가 ---------- */
function expSplit(seed, wE) {
  wE = wE == null ? 1 : +wE;
  const sim = C.createSim(64, { seed, params: { wE } });
  C.addSource(sim, 32, 32, 3, 0.04); C.addSink(sim, 8, 8, 4, 0.10);
  for (let t = 0; t < 1500; t++) C.step(sim);
  const before = sim.agents.filter(a => a.alive).length;
  // 분열: 0.04 하나 → 0.02 둘 (총 에너지 보존), 80tick마다 1셀씩 동/서로 12셀
  let off = 0;
  for (let t = 0; t < 3000; t++) {
    if (t % 80 === 0 && off < 12) {
      off++;
      sim.sources.length = 0;
      C.addSource(sim, 32 + off, 32, 3, 0.02); C.addSource(sim, 32 - off, 32, 3, 0.02);
    }
    C.step(sim);
  }
  const L = sim.agents.filter(a => a.alive);
  let dE = 1e9, dW = 1e9;
  for (const a of L) {
    dE = Math.min(dE, wdist(64, a.cx, a.cy, 44, 32));
    dW = Math.min(dW, wdist(64, a.cx, a.cy, 20, 32));
  }
  console.log(`seed=${seed} wE=${wE} 분열전=${before} 분열후=${L.length} 동쪽source까지=${L.length ? f(dE, 1) : '-'} 서쪽source까지=${L.length ? f(dW, 1) : '-'} 탄생=${sim.births}`);
}

/* ---------- ② 공통: 응집도 측정 ---------- */
/* 살아있는 미시 agent들이 가장 가까운 살아있는 "사회" 중심에서 평균 몇 셀 떨어져 있나 */
function cohesion(sim, macro) {
  const soc = macro.agents.filter(a => a.alive);
  const liv = sim.agents.filter(a => a.alive);
  if (!soc.length || !liv.length) return null;
  const g = sim.N / macro.N;
  let s = 0;
  for (const a of liv) {
    let best = 1e9;
    for (const m of soc) {
      const d = wdist(sim.N, a.cx, a.cy, (m.cx + 0.5) * g, (m.cy + 0.5) * g);
      if (d < best) best = d;
    }
    s += best;
  }
  return s / liv.length;
}

/* ---------- back: ② 무리 짓기 — t=2500에 wBack 켜기 ---------- */
function expBack(seed, wBack) {
  wBack = +wBack;
  const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
  const macro = C.createMacro(sim);            // wBack=0으로 시작
  archipelago(sim);
  let cohB = 0, nB = 0, livB = 0, mB = 0, cohA = 0, nA = 0, livA = 0, mA = 0;
  for (let t = 0; t < 4500; t++) {
    if (t === 2500) macro.couple.wBack = wBack;
    C.stepCoupled(sim, macro);
    if (t >= 1500 && t < 2500) {
      const c = cohesion(sim, macro); if (c != null) { cohB += c; nB++; }
      livB += sim.stats.livingCount; if ((t + 1) % 4 === 0) mB += macro.stats.livingCount * 4;
    }
    if (t >= 3500) {
      const c = cohesion(sim, macro); if (c != null) { cohA += c; nA++; }
      livA += sim.stats.livingCount; if ((t + 1) % 4 === 0) mA += macro.stats.livingCount * 4;
    }
  }
  console.log(`seed=${seed} wBack=${wBack} 응집도 ${nB ? f(cohB / nB, 2) : '-'}→${nA ? f(cohA / nA, 2) : '-'}셀  미시living ${f(livB / 1000, 1)}→${f(livA / 1000, 1)}  사회 ${f(mB / 1000, 2)}→${f(mA / 1000, 2)}  미시잔차=${Math.abs(sim.stats.resid).toExponential(1)}`);
}

/* ---------- dis: ② 재앙 전파 — 승급 소득 플레어 → 거시 발화 → 미시 사망 ---------- */
function expDis(seed, wBack, flare) {
  wBack = +wBack; flare = flare == null ? 5 : +flare;
  const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
  const macro = C.createMacro(sim, { wBack });
  C.defaultScenario(sim, 0.04);
  const cE0 = macro.couple.cE;
  let dPrev = 0, dB = 0, burB = 0, burA = 0, livEnd = 0, n = 0;
  for (let t = 0; t < 4200; t++) {
    if (t === 2000) dPrev = sim.deathsTotal;
    if (t === 3000) { dB = sim.deathsTotal - dPrev; dPrev = sim.deathsTotal; macro.couple.cE = cE0 * flare; }
    if (t === 3200) macro.couple.cE = cE0;
    C.stepCoupled(sim, macro);
    if ((t + 1) % 4 === 0 && macro.stats) {
      if (t >= 2000 && t < 3000) burB += macro.stats.bursts;
      if (t >= 3000) burA += macro.stats.bursts;
    }
    if (t >= 3700) { livEnd += sim.stats.livingCount; n++; }
  }
  const dA = sim.deathsTotal - dPrev;
  console.log(`seed=${seed} wBack=${wBack} flare=${flare} 거시발화 전=${burB} 후=${burA}  미시사망 전1k=${dB} 후1.2k=${dA}  말기living=${f(livEnd / n, 1)}`);
}

/* ---------- ③ 공통: 두 클러스터 + 좌/우 집계 ---------- */
function twoClusters(sim, leftRate, rightRate) {
  sim.sources.length = 0; sim.sinks.length = 0;
  C.addSource(sim, 16, 32, 3, leftRate); C.addSource(sim, 48, 32, 3, rightRate);
  C.addSink(sim, 32, 8, 4, 0.10);          // sink 은 양 클러스터에서 등거리 (대칭)
}
function macroSplit(macro) {                 // 거시 ρ₂ 를 좌/우 반으로 합산
  const N2 = macro.N, h = N2 / 2; let L = 0, R = 0;
  for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) (x < h ? L += macro.rho[y * N2 + x] : R += macro.rho[y * N2 + x]);
  return { L, R };
}
function microSplit(sim) {                    // 살아있는 미시 agent 를 좌/우(cx 32)로
  let LN = 0, LM = 0, RN = 0, RM = 0;
  for (const a of sim.agents) if (a.alive) (a.cx < 32 ? (LN++, LM += a.mass) : (RN++, RM += a.mass));
  return { LN, LM, RN, RM };
}

/* ---------- soc: ③ 사회 간 상호작용 — 두 사회, t=2500에 좌측 자원 차단 + 대조(차단 없음) ----------
 * 핵심 질문: 좌측을 굶기면 우측 사회가 "흡수"하는가? 대조군(둘 다 생존)을 함께 돌려
 * 우측 성장이 흡수인지 단순 정착인지 가른다. 인자: seed [wBack] [좌LX] [우RX] */
function expSoc(seed, wBack, LX, RX) {
  wBack = wBack == null ? 0 : +wBack;
  LX = LX == null ? 16 : +LX; RX = RX == null ? 48 : +RX;     // 기본 = 군도 거리 32셀
  const mid = (LX + RX) / 2;
  const run = (cut) => {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim, { wBack });
    const tc = (l, r) => { sim.sources.length = 0; sim.sinks.length = 0; C.addSource(sim, LX, 32, 3, l); C.addSource(sim, RX, 32, 3, r); C.addSink(sim, 32, 8, 4, 0.10); };
    tc(0.04, 0.04);
    for (let t = 0; t < 2500; t++) C.stepCoupled(sim, macro);
    const soc0 = macro.agents.filter(a => a.alive).length;
    const rMass0 = sim.agents.filter(a => a.alive && a.cx >= mid).reduce((s, a) => s + a.mass, 0);
    const orphanIds = sim.agents.filter(a => a.alive && a.cx < mid).map(a => a.id);
    const d0 = sim.deathsTotal, c0 = sim.contested;
    tc(cut ? 0.0 : 0.04, 0.04);              // ★ cut=true 면 좌측 차단
    for (let t = 0; t < 3500; t++) C.stepCoupled(sim, macro);
    const soc1 = macro.agents.filter(a => a.alive).length;
    const rMass1 = sim.agents.filter(a => a.alive && a.cx >= mid).reduce((s, a) => s + a.mass, 0);
    let crossed = 0, survived = 0;
    for (const id of orphanIds) { const a = sim.agents.find(x => x.id === id && x.alive); if (a) { survived++; if (a.cx >= mid) crossed++; } }
    return { soc0, soc1, rMass0, rMass1, orphans: orphanIds.length, survived, crossed, contested: sim.contested - c0, deaths: sim.deathsTotal - d0, resid: Math.abs(sim.stats.resid) };
  };
  const cut = run(true), ctl = run(false);
  console.log(`seed=${seed} wBack=${wBack} 좌${LX}/우${RX}(거리${RX - LX})  사회 ${cut.soc0}→${cut.soc1}`);
  console.log(`  우질량  차단: ${f(cut.rMass0, 1)}→${f(cut.rMass1, 1)}   대조(둘다생존): ${f(ctl.rMass0, 1)}→${f(ctl.rMass1, 1)}   [차이=${f(cut.rMass1 - ctl.rMass1, 1)} → 0이면 흡수 아님]`);
  console.log(`  좌측 고아 ${cut.orphans} 생존 ${cut.survived} 우측이주 ${cut.crossed}  경합사망 ${cut.contested}/${cut.deaths}  미시잔차=${cut.resid.toExponential(1)}`);
}

const MODES = { reg: expReg, div: expDiv, herd: expHerd, arch: expArch, walk4: expWalk4, split: expSplit, back: expBack, dis: expDis, soc: expSoc };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|div|herd|arch|walk4|split|back|dis> <seed> [args]');
