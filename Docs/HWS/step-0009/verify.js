/* HWS step-0009 헤드리스 검증 — 저장체가 무대가 된다(기복: 퇴적이 흐름을 휘어 내생적 풍경 재편)
 * 사용: node verify.js <reg|conserve|det|deflect|reorg|all> [seed]
 *  - reg     : 회귀 0 — kRelief=0 step-0009 == step-0008 비트 단위 동일(E·R·장부·에이전트 직접 비교).
 *  - conserve: V1 보존 — 기복 on 에서도 닫힌 장부 잔차 < 1e-6 (기복은 확산의 방향만 바꿀 뿐 쌍 거래 그대로).
 *  - det     : V2 결정론 — 기복 on, 같은 시드 2회 실행 비트 동일(E+R+에이전트).
 *  - deflect : 가설 ① 무대 — 저장체가 국소 확산을 변조하는가(흐름이 굳은 땅을 넘지 못하는가).
 *              source 둘레에 저장체 성벽(ring)을 칠하고 같은 성벽의 두 세계를 대조: kRelief on 이면 성벽이
 *              둑(dam)이 되어 흐름이 안에 고이고 밖은 마른다. kRelief=0(비활성 저장 = step-0008)이면 그냥 통과.
 *  - reorg   : 가설 ② 재편 — 고임이 저장체 둘레에 재편되는가(내생적 풍경 변화). 결정화+기복 on 으로
 *              FORM 후 8000 tick 창 2개의 *순퇴적 증분 지도* ΔR 상관(corrD)을 kRelief=0 기준선과 대조:
 *              기복 off 면 영원히 같은 핵에 쌓여 corrD=1.000(전선 고정), on 이면 corrD≈0.04(전선이 떠돎).
 *              고임 수·turnover·새 고임→퇴적 거리(nearRock)로 "살아 움직이는 풍경"을 함께 본다.
 *              퇴적이 고임 자리를 메우면 흐름이 옆으로 밀려 고임이 *스스로* 움직인다(외부 sawtooth 없이 — G2/G3).
 *  - all     : 전 모드 + 요약
 * 응집/생명/번식/이동/기초대사비/떠도는 자원 시나리오 상수는 step-0008 그대로. 결정화 상수 중 crystThresh 만
 * 3.0→2.0 재튜닝 — 기복이 E 를 문턱 위에 머물지 못하게 깎으므로(maxE→cTh 로 클립) 문턱이 고임 E 범위(1.5~3)
 * 안에 있어야 래칫이 계속 걸린다(cTh=3.0 이면 결정화가 한 번 일고 멎어 재편이 일과성으로 끝남 — 스캔으로 확인).
 * 무대 시나리오 상수: kRelief=1.0 (step-0009 신규 — 흐름 퍼텐셜 h=E+R: 3D 지형 높이와 일치).
 */
'use strict';
var core = require('./sim-core.js');
var core8 = require('../step-0008/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02 };
var BASE = 0.08;
var JUMP = { srcJump: 6, srcPeriod: 150 };
var CRYST = { kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };  // cTh 3.0→2.0 재튜닝(헤더 주석 참조)
var RELIEF = { kRelief: 1.0 };                    // 무대(기복) — step-0009 신규
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

/* 기복까지 켠 표준 시나리오(전체 스택). 회귀(reg)는 kRelief=0 으로 따로 만든다. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, JUMP, CRYST, RELIEF, extra || {}); }
/* 회귀 비교용 — step-0008 기준 시나리오(기복 없음·결정화 on). */
function scn8(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, JUMP, CRYST, extra || {}); }
/* 재편(reorg) 프로브 — 생명 없는 정적 필드 + 결정화 + 기복(step-0008 의 fieldScn 에 RELIEF 만 추가). */
function fieldScn(extra) { return Object.assign({}, AGG, { life: false, srcJump: 0 }, CRYST, RELIEF, extra || {}); }
/* 둑(deflect) 프로브 — 응집·결정화까지 끈 선형 확산 세계 + 손으로 칠한 저장체 성벽(순수 기복 측정).
 * kCryst=0 이면 풍화 블록도 통째로 꺼져(코어 ⑤ 게이트) 칠한 성벽이 영구 고정 — 깨끗한 정적 장애물. */
function wallScn(extra) { return Object.assign({}, { kA: 0, life: false, srcJump: 0, kCryst: 0 }, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* 두 sim 의 상태(E·R·장부·에이전트)가 비트 단위 동일한가 — cross-core 회귀 비교용. */
function sameState(a, b) {
  var maxd = 0;
  for (var i = 0; i < a.E.length; i++) { var dd = Math.abs(a.E[i] - b.E[i]); if (dd > maxd) maxd = dd; }
  for (i = 0; i < a.R.length; i++) { var dr = Math.abs(a.R[i] - b.R[i]); if (dr > maxd) maxd = dr; }
  var ok = maxd === 0;
  if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk || a.metabolized !== b.metabolized) ok = false;
  if (a.agents.length !== b.agents.length) ok = false;
  else for (var k = 0; k < a.agents.length; k++) {
    var p = a.agents[k], q = b.agents[k];
    if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false;
  }
  return { maxDiff: maxd, pass: ok };
}

/* ── reg: 회귀 0 — kRelief=0 면 step-0008 와 비트 단위 동일 ──
 * (A) 에이전트 0(결정화 on — R 이 쌓여도 기복 off 면 무대 아님), 구동 on/off.
 * (B) 에이전트 있음(번식·이동·baseCost·떠도는 자원·결정화 on), kRelief=0, +4000 tick. */
function reg(seed) {
  var maxd = 0, ok = true;
  [true, false].forEach(function (drive) {
    var a = core8.createSim(seed, scn8({ drive: drive })); core8.run(a, 10000);
    var b = core.createSim(seed, scn({ drive: drive, kRelief: 0 })); core.run(b, 10000);
    var r = sameState(a, b); maxd = Math.max(maxd, r.maxDiff); if (!r.pass) ok = false;
  });
  var a8 = core8.createSim(seed, scn8()); core8.run(a8, FORM);
  var b9 = core.createSim(seed, scn({ kRelief: 0 })); core.run(b9, FORM);
  spawnStrongest(core8, a8, 1); spawnStrongest(core, b9, 1);
  core8.run(a8, 4000); core.run(b9, 4000);
  var rr = sameState(a8, b9); maxd = Math.max(maxd, rr.maxDiff); if (!rr.pass) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 기복 on(전체 스택), 닫힌 장부(sumE+M+R+evap+sunk+metab-injected=E0) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass, store: led.store,
    pop: sim.agents.length, births: sim.births, deaths: sim.deaths, pass: led.residual < 1e-6 };
}

/* ── det: 기복 on, 결정론(비트 동일, R 포함) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnStrongest(core, s, 1); core.run(s, 4000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* 성벽 칠하기 — source 중심 반경 [r1,r2] 환(annulus)에 R=amt. E0 보정(장부 유지). */
function paintRing(sim, cx, cy, r1, r2, amt) {
  var R = sim.R, added = 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var dx = Math.min((x - cx + W) % W, (cx - x + W) % W);
      var dy = Math.min((y - cy + H) % H, (cy - y + H) % H);
      var d2 = dx * dx + dy * dy;
      if (d2 >= r1 * r1 && d2 <= r2 * r2) { R[y * W + x] += amt; added += amt; }
    }
  }
  sim.E0 += added;
  return added;
}

/* source 중심 토러스 거리 기준 E 분할 합: 성벽 안(d<r1) / 성벽 띠 / 성벽 밖(d>r2) */
function splitE(sim, cx, cy, r1, r2) {
  var E = sim.E, inn = 0, wall = 0, out = 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var dx = Math.min((x - cx + W) % W, (cx - x + W) % W);
      var dy = Math.min((y - cy + H) % H, (cy - y + H) % H);
      var d2 = dx * dx + dy * dy, e = E[y * W + x];
      if (d2 < r1 * r1) inn += e;
      else if (d2 <= r2 * r2) wall += e;
      else out += e;
    }
  }
  return { inn: inn, wall: wall, out: out };
}

/* ── deflect: 가설 ① 무대 — 저장체가 확산을 변조한다(흐름이 굳은 땅을 넘지 못함) ──
 * 선형 확산 세계(응집·생명·결정화 off)에서 source 둘레에 저장체 성벽(반경 6~8, R=20)을 칠한다.
 * 같은 성벽의 두 세계: (B) kRelief=1 — 성벽이 흐름 퍼텐셜 h 를 20 올려 둑(dam)이 된다: E 가 둑 높이를
 *                      넘기 전엔 못 빠져나가 주입 E 가 안에 고인다. (0) kRelief=0 — step-0008 의 비활성
 *                      저장: 성벽이 있어도 흐름이 그냥 통과. 3000 tick 후 성벽 안/밖 E 를 대조.
 * 기복이 켜져야만 저장체가 *무대*(흐름을 휘는 지형)가 됨을 증명. */
function deflect(seed) {
  var T = 3000, R1 = 6, R2 = 8, AMT = 20;
  function trial(kb) {
    var s = core.createSim(seed, wallScn({ kRelief: kb }));
    paintRing(s, s.p.source.x, s.p.source.y, R1, R2, AMT);
    core.run(s, T);
    var sp = splitE(s, s.p.source.x, s.p.source.y, R1, R2);
    return { sp: sp, led: core.ledger(s) };
  }
  var b = trial(RELIEF.kRelief), z = trial(0);
  var gain = z.sp.inn > 0 ? b.sp.inn / z.sp.inn : Infinity;     // 갇힘 배율(성벽 안 E 비교)
  return { seed: seed, inBlock: b.sp.inn, inOff: z.sp.inn, outBlock: b.sp.out, outOff: z.sp.out,
    gain: gain, residual: Math.max(b.led.residual, z.led.residual),
    /* ① 기복 on 이면 흐름이 둑 안에 고이고(안 E 크게 증가) 밖은 마른다. 장부도 닫힌 채(성벽은 E0 보정). */
    pass: gain > 2.0 && b.sp.out < z.sp.out && Math.max(b.led.residual, z.led.residual) < 1e-6 };
}

/* 고임 turnover — pools2 중 pools1 의 어느 고임과도 d 초과 떨어진(새 자리) 비율. */
function poolTurnover(p1, p2, d) {
  if (!p2.length) return 0;
  var moved = 0;
  for (var i = 0; i < p2.length; i++) {
    var mind = Infinity;
    for (var j = 0; j < p1.length; j++) {
      var dd = core.torusDist(W, H, p2[i].x, p2[i].y, p1[j].x, p1[j].y);
      if (dd < mind) mind = dd;
    }
    if (mind > d) moved++;
  }
  return moved / p2.length;
}

/* source 후광(거리<=excl) 제외 Pearson 상관 — 퇴적 전선이 같은 자리에 머무는지 본다.
 * (source 둘레는 두 세계 모두 상시 퇴적이라 공통 성분 — 제외해야 들판의 전선 이동이 또렷.) */
function corrField(a, b, sx, sy, excl) {
  var n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var dx = Math.min((x - sx + W) % W, (sx - x + W) % W);
      var dy = Math.min((y - sy + H) % H, (sy - y + H) % H);
      if (dx * dx + dy * dy <= excl * excl) continue;
      var u = a[y * W + x], v = b[y * W + x];
      n++; sa += u; sb += v; saa += u * u; sbb += v * v; sab += u * v;
    }
  }
  var cov = sab / n - (sa / n) * (sb / n);
  var va = saa / n - (sa / n) * (sa / n), vb = sbb / n - (sb / n) * (sb / n);
  return (va > 0 && vb > 0) ? cov / Math.sqrt(va * vb) : 1;
}

/* 창의 순퇴적 증분 지도 — ΔR 의 양수부(어디에 새로 쌓였나). 풍화 감소는 무시. */
function posInc(a, b) {
  var out = new Float64Array(a.length);
  for (var i = 0; i < a.length; i++) { var d = b[i] - a[i]; out[i] = d > 0 ? d : 0; }
  return out;
}

/* 고임 → 최근접 퇴적(R>1) 셀 평균 거리 — 재편이 "저장체 둘레"에서 일어나는가의 직접 수치. */
function nearRock(sim, pools) {
  var R = sim.R, s = 0, n = 0;
  for (var i = 0; i < pools.length; i++) {
    var mind = Infinity;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (R[y * W + x] > 1) {
          var dd = core.torusDist(W, H, pools[i].x, pools[i].y, x, y);
          if (dd < mind) mind = dd;
        }
      }
    }
    if (mind < Infinity) { s += mind; n++; }
  }
  return n ? s / n : -1;
}

/* ── reorg: 가설 ② 재편 — 고임이 저장체 둘레에 재편된다(내생적 풍경 변화, 외부 sawtooth 없이) ──
 * 생명 없는 정적 필드(응집+결정화+기복 on). FORM(8000) 후 8000 tick 창 2개의 순퇴적 증분 지도를 대조:
 *  - 기복 on: 퇴적이 바닥을 올려 흐름·고임이 옆으로 밀림 → 다음 창의 퇴적은 *다른 자리*(corrD≈0.04).
 *    고임은 15~20개로 살아 있고(자기 제한: R 평균 ~470 에서 풍화와 균형) 매 창 새 자리 비율(turnover)≈0.3~0.6,
 *    새 고임은 퇴적 둘레(평균 거리 ~2.6)에 선다. 후기 창에도 결정화가 계속(dCry>100 — 래칫이 안 멎음).
 *  - 기복 off(step-0008 비활성 저장): 같은 핵에 영원히 쌓여 corrD=1.000(전선 고정) — 게다가 cTh=2.0 에선
 *    문턱 위 모든 고임이 무한 결정화로 통째로 굳어 세계가 암석화(R~8500, 고임 소멸). 무대가 켜져야 풍경이
 *    *살아 움직인다*. */
function reorg(seed) {
  var T2 = 8000, D = 3;
  function trial(kb) {
    var s = core.createSim(seed, fieldScn({ kRelief: kb }));
    core.run(s, FORM);
    var p1 = core.detectPools(s, POOL), R1 = s.R.slice();
    core.run(s, T2);
    var p2 = core.detectPools(s, POOL), R2 = s.R.slice(), c1 = s.crystallized;
    core.run(s, T2);
    var p3 = core.detectPools(s, POOL), R3 = s.R.slice(), c2 = s.crystallized;
    return { n1: p1.length, n2: p2.length, n3: p3.length,
      tv1: poolTurnover(p1, p2, D), tv2: poolTurnover(p2, p3, D),
      corrD: corrField(posInc(R1, R2), posInc(R2, R3), s.p.source.x, s.p.source.y, 10),
      dCry: c2 - c1, R: core.totalStore(s), near: nearRock(s, p3) };
  }
  var b = trial(RELIEF.kRelief), z = trial(0);
  return { seed: seed, nB: b.n1 + '/' + b.n2 + '/' + b.n3, tvB1: b.tv1, tvB2: b.tv2,
    corrDB: b.corrD, corrD0: z.corrD, dCryB: b.dCry, RB: b.R, R0: z.R, near: b.near,
    /* ② 기복 on: 고임 생존 + 퇴적 전선 이동(corrD↓) + 래칫 지속. off: 전선 고정(corrD≈1). */
    pass: b.n3 >= 5 && b.corrD < 0.3 && z.corrD > 0.9 && b.dCry > 100 };
}

function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3);
  return x.toFixed(4);
}
function table(rows, cols) {
  console.log(cols.join('\t'));
  rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); });
}

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'maxDiff', 'pass']);
    console.log('회귀 0: kRelief=0 step-0009 == step-0008 (에이전트 0 구동 on/off + 에이전트 있음 결정화·떠도는 자원 on kRelief=0)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'store', 'pop', 'births', 'deaths', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (기복은 확산 방향만 — sumE+M+R+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'deflect') {
    var rf = seeds.map(deflect); table(rf, ['seed', 'inBlock', 'inOff', 'gain', 'outBlock', 'outOff', 'residual', 'pass']);
    console.log('저장체 둑 안 E: 기복 on=' + avg(rf, 'inBlock').toFixed(1) + ' vs off=' + avg(rf, 'inOff').toFixed(1) +
      ' (' + avg(rf, 'gain').toFixed(2) + '×) — 굳은 땅은 흐름을 통과시키지 않는다(가설 ①)');
    return rf.every(function (r) { return r.pass; });
  } else if (mode === 'reorg') {
    var rg = seeds.map(reorg); table(rg, ['seed', 'nB', 'tvB1', 'tvB2', 'corrDB', 'corrD0', 'dCryB', 'RB', 'R0', 'near', 'pass']);
    console.log('퇴적 전선 상관(창1 vs 창2): 기복 on=' + avg(rg, 'corrDB').toFixed(3) + '(떠돎) vs off=' + avg(rg, 'corrD0').toFixed(3) +
      '(고정) · turnover=' + ((avg(rg, 'tvB1') + avg(rg, 'tvB2')) / 2).toFixed(2) + ' · 새 고임→퇴적 거리=' + avg(rg, 'near').toFixed(1) +
      ' — 퇴적이 흐름을 밀어 고임이 스스로 재편된다(가설 ②, 내생적 churn). 기복 off 면 암석화(R=' + avg(rg, 'R0').toFixed(0) + ')');
    return rg.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'deflect', 'reorg'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
