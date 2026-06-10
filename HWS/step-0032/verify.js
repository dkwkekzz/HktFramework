/* HWS step-0032 헤드리스 검증 — 지지 침착(VOXEL.md V4: E→R 결정화를 지지 있는 칸으로 게이트. 공중 바위 차단·지면 바닥부터 쌓임).
 * 새 구조(law-pipeline): 이 step 은 *법칙을 더하지 않는다* — crystallize 의 E→R 침착에 지지 게이트를 더한다(게이트 노브 1개 + 문턱 1개).
 *   변경점: DEFAULTS.kSupport(마스터 0/1, 기본 0) · supportThresh(지지 문턱) · crystallize 가 kSupport>0 이면 W×H×D 전 평면 + 지지 게이트.
 *   kSupport=0 이면 z=0 평면만(step-0031 비트 동일·게이트 무효). D=1 이면 z=0 평면뿐이라 게이트 항상 통과 = 비트 동일(이중 가드).
 *
 * 사용: node step-0032/verify.js <reg|ground|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kSupport 값 무관 비트 동일(z=0 평면뿐, 게이트가 바닥서 항상 통과). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~grav@ 비트 불변)가 권위.
 *  - ground   : 가설 — *지지 게이트가 공중 바위를 막고 지면을 바닥부터 쌓는다*. 천장(z=7) 한 평면에 E 슬랩 주입 + 중력:
 *               무게이트(supportThresh=0)면 슬랩이 *제자리에서* 굳어 부유 R(공중 바위) 발생 — 게이트(supportThresh=0.5)면 E 가 바닥까지 떨어진 *뒤* 굳어 부유 R=0·R 이 바닥(z=0)에서 쌓인다.
 *  - conserve : 보존 — D=8 중력+결정화+지지 게이트에서 닫힌 장부 잔차 < 1e-11(침착·풍화·중력 모두 쌍 거래; 게이트는 위치만 거름).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 지지 침착 3D 아레나 — verify-sim-engine.js supportArena() 와 동일 상수(골든 support@ 와 일치).
 * D=8 voxel 상자, 균일 E + 중력 침전 + 결정화 + 지지 게이트 — 다른 법칙 다 off(순수 지지 침착 격리). */
function supportArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 2.0, noise: 0.5, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.2, kCryst: 0.05, crystThresh: 1.0, kWeather: 0.0003, kSupport: 1, supportThresh: 0.5,
    kCrowd: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 천장 슬랩 아레나 — E=0 에서 시작해 천장(z=7) 한 평면에만 E 슬랩 주입(공중 바위 vs 바닥 쌓임 대조용). 풍화 off(깨끗한 R 회계). */
function slabArena(thresh) { return supportArena({ initE: 0, noise: 0, kWeather: 0, supportThresh: thresh }); }
function injectTopSlab(sim, z, val) { for (var k = 0; k < WH; k++) { var i = z * WH + k; sim.E[i] += val; sim.E0 += val; } }
function planeRsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.R[z * WH + k]; s.push(t); } return s; }
/* 부유 R 측정 — z>0 셀 중 R>eps 이면서 *바로 아래 칸 R < thresh*(지지 없음 = 공중)인 칸 수. 고정 기준 문턱(0.5)으로 *물리적* 부유를 잰다. */
function measureFloat(sim, D, thresh, eps) {
  var R = sim.R, n = 0;
  for (var z = 1; z < D; z++) for (var k = 0; k < WH; k++) { var i = z * WH + k; if (R[i] > eps && R[i - WH] < thresh) n++; }
  return n;
}

/* ── reg: D=1 에선 kSupport 값이 비트 동일을 안 깬다(z=0 평면뿐, 게이트가 바닥서 항상 통과). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kSup) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kGravity: 0.2, kSupport: kSup, supportThresh: 0.5
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(1);
  return { seed: seed, hashSup0: h0, hashSup1: h1, pass: h0 === h1 };
}

/* ── ground: 가설 — 지지 게이트가 공중 바위를 막고 지면을 바닥부터 쌓는다. ── */
function ground(seed) {
  var D = 8, TICK = 600, slabZ = 7, slabE = 4.0, eps = 1e-6, refThresh = 0.5;
  /* 무게이트(supportThresh=0): 천장 슬랩이 제자리에서 굳어 공중 바위. 게이트(0.5): E 가 떨어진 뒤 바닥서 굳음. */
  var ung = ENG.createSim(seed, slabArena(0)); injectTopSlab(ung, slabZ, slabE); ENG.run(ung, TICK);
  var gat = ENG.createSim(seed, slabArena(0.5)); injectTopSlab(gat, slabZ, slabE); ENG.run(gat, TICK);
  var floatUng = measureFloat(ung, D, refThresh, eps), floatGat = measureFloat(gat, D, refThresh, eps);
  var rUng = planeRsums(ung, D), rGat = planeRsums(gat, D);
  var totUng = rUng.reduce(function (a, b) { return a + b; }, 0), totGat = rGat.reduce(function (a, b) { return a + b; }, 0);
  /* 바닥 절반(z<4) R 분율 — 게이트면 R 이 바닥에 쌓여 ↑, 무게이트면 슬랩이 천장서 굳어 ↓. */
  var botUng = totUng > 0 ? (rUng[0] + rUng[1] + rUng[2] + rUng[3]) / totUng : 0;
  var botGat = totGat > 0 ? (rGat[0] + rGat[1] + rGat[2] + rGat[3]) / totGat : 0;
  /* 최저 R 평면(z) — 게이트면 0(바닥부터), 무게이트면 높음(천장서 부유). */
  function lowestR(rs) { for (var z = 0; z < D; z++) if (rs[z] > eps) return z; return -1; }
  var loUng = lowestR(rUng), loGat = lowestR(rGat);
  return {
    seed: seed, floatUng: floatUng, floatGat: floatGat, botUng: botUng, botGat: botGat, loUng: loUng, loGat: loGat,
    /* 게이트: 부유 R(공중 바위)=0·R 이 바닥(z=0)부터·바닥 절반에 집중. 무게이트: 부유 R 다수(낙하 중 제자리 결정화).
     * (중력이 결국 E 대부분을 바닥으로 끌어 두 경우 다 바닥 R 분율은 높다 — *결정적 차이는 부유 R 유무*다.) */
    pass: floatGat === 0 && floatUng > 100 && loGat === 0 && botGat > 0.95
  };
}

/* ── conserve: D=8 중력+결정화+지지 게이트에서 닫힌 장부 잔차(침착·풍화·중력 모두 쌍 거래). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, supportArena()); ENG.run(sim, 600);
  var L = ENG.ledger(sim), rs = planeRsums(sim, 8), tot = rs.reduce(function (a, b) { return a + b; }, 0);
  var bot = tot > 0 ? (rs[0] + rs[1] + rs[2] + rs[3]) / tot : 0;
  return { seed: seed, residual: L.residual, sumE: L.sumE, sumR: L.store, botFrac: bot, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, supportArena()); ENG.run(s, 600); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashSup0', 'hashSup1', 'pass']);
    console.log('회귀 0: D=1 에선 kSupport=0 과 kSupport=1 이 비트 동일(z=0 평면뿐 — 게이트가 바닥서 항상 통과). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'ground') {
    var rg = seeds.map(ground); table(rg, ['seed', 'floatUng', 'floatGat', 'botUng', 'botGat', 'loUng', 'loGat', 'pass']);
    console.log('지지 게이트가 공중 바위를 막고 지면을 바닥부터 쌓는다: 천장(z=7) E 슬랩 + 중력 → 무게이트면 부유 R(공중 바위) ' + avg(rg, 'floatUng').toFixed(0) + '칸(최저 R 평면 z=' + avg(rg, 'loUng').toFixed(0) + ', 바닥 절반 분율 ' + (avg(rg, 'botUng') * 100).toFixed(0) + '%) → 게이트면 부유 R ' + avg(rg, 'floatGat').toFixed(0) + '칸(최저 R 평면 z=' + avg(rg, 'loGat').toFixed(0) + ' 바닥, 바닥 절반 분율 ' + (avg(rg, 'botGat') * 100).toFixed(0) + '%). E 가 떨어진 뒤 바닥서 굳어 지면이 바닥부터 쌓인다 = 지면 원형.');
    return rg.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'sumR', 'botFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 중력+결정화+지지 게이트 — 침착[E↔R]·풍화[R↔E]·중력[E↔E] 모두 쌍 거래, 닫힌 장부 유지. 게이트는 침착 위치만 거름·장부 무관. R 바닥 절반 분율 ' + (avg(rc, 'botFrac') * 100).toFixed(0) + '% — 지면이 바닥에).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(지지 침착도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'ground', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
