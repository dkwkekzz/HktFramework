/* HWS step-0027 헤드리스 검증 — 가지치기 덴드라이트(dendrite: 자라는 결정 전선이 *경계 불안정*[Mullins-Sekerka]으로 옆가지를 뻗는다. 형태 사다리 R5, R 하이트필드).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 dendrite 법칙 1개(LAW_ORDER ⑤g, turing 뒤·combust 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0027/verify.js <reg|conserve|det|dendrite|sustain|all> [seed]
 *  - reg     : 회귀 0 — kDendrite=0 이면 step-0026 과 비트 동일(dendrite 통째 skip·E·R·G 불변). 덴드라이트 스택 해시를 golden turing@ 와 대조.
 *  - conserve: 보존 — 덴드라이트(셀 안 E→R 쌍 거래 — 결정화/복제와 같은 경계)가 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kDendrite on 같은 시드 2회 비트 동일(곡률 증폭 침착이 E·R 을 바꿔 해시에. snap 으로 곡률 판정 — 스캔 순서 무관, Math.random 금지).
 *  - dendrite: 가설 — 경계 불안정(*평탄 전선이 옆가지로 갈린다*). dendrite 아레나(균일 고-E 장 + 중심 R 씨앗, 다른 법칙 다 off):
 *              off(성장 없음=컴팩트 씨앗) vs on(가지친 덴드라이트). ① 성장(area↑) ② *경계 불안정*(거칠기 roughness≫1·가지 끝 tips 多 — 컴팩트 원판 아님) ③ 곡률 역할(sharp>flat). ④ 셀 안 E→R 쌍 거래라 보존.
 *  - sustain : 덴드라이트(실제 E→R 전선 성장)가 step-0026 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — 전선만 성장·자원 clamp 라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0026 그대로(별·…·튜링 불안정) + 가지치기 덴드라이트(kDendrite 1).
 *   *전체 스택은 희소·이동성*이라 큰 결정이 드물어 덴드라이트가 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 덴드라이트 현상은 dendrite 의 *dendrite 아레나*에서 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(dendrite 법칙 포함)
var fs = require('fs');
var path = require('path');

var SEEDS = [42, 7, 1234, 99, 2026];
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02, pTumble: 1.0 };
var STAGE = { kRelief: 1.0, kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var CROWD = { kCrowd: 0.20, crowdR: 3 };
var FSM = { kFSM: 1, livingFrac: 0.55, burnOn: 0.6, burnOff: 0.4 };
var FLUX = { kFlux: 1, aFlux: 0.1 };
var GENE = { kTemplate: 1, geneRate: 0.5, geneThresh: 0.3, geneMu: 0.01, geneTypes: 4, geneFit0: 0.5, geneFitStep: 0.15, geneClear: 0.05 };
var INHERIT = { kInherit: 1, inheritMu: 0.01, inheritCost: 0.02 };
var ADH = { kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5 };
var MEM = { kMembrane: 0.5 };
var SHARE = { kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0 };
var PUBLIC = { kPublic: 0.3, pubSynergy: 2.0 };
var DIFF = { kDiff: 0.3 };
var GERM = { kGermline: 0.3 };
var ANCHOR = { kAnchor: 1, anchorM: 0.6, anchorKin: 2 };
var TENSION = { kTension: 1, tensionGamma: 0.10 };
var ANISO = { kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2 };
var TURING = { kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5 };
var DENDRITE = { kDendrite: 1, dendRate: 0.06, dendThresh: 0.5, dendSharp: 1.0 };  // step-0027 신규 — 가지치기 덴드라이트(전체 스택은 희소라 큰 결정 드물어 거의 안 켜짐 — 현상은 dendrite 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 튜링 불안정 + 가지치기 덴드라이트). extra 로 kDendrite=0 주면 step-0026 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, ANISO, TURING, DENDRITE, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* dendrite 아레나 — 균일 고-E 장(noise 미세 섭동) + 중심 R 씨앗. 다른 법칙 다 off, dendrite 만 on/off·sharp 로 *경계 불안정을 격리*.
 * kDendrite=1 이면 자라는 전선이 곡률 증폭(짧은 활성) + 기하 차폐(긴 억제=E 확산)로 옆가지를 뻗고(가지친 덴드라이트), off 면 씨앗 그대로(성장 없음). kEvap=0·drive off 라 닫힌 장부 단순. */
function dendArena(extra) {
  return Object.assign({}, {
    initE: 0.8, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0,
    kDendrite: 1, dendRate: 0.06, dendThresh: 0.5, dendSharp: 1.0
  }, extra || {});
}
var ARENA_T = 300;   // 씨앗이 가지를 또렷이 뻗고 *E-제한*으로 성장이 멎을 만큼(저 supersaturation → 영구 빈틈 = 가지 사이 간격).
/* 중심 R 씨앗 — (cx,cy) 반경 r 원판을 고체 R(amount)로 채운다(외부 질량이라 E0 보정). 전선이 여기서 자라 가지를 뻗는다. */
function seedDendrite(sim, amount) {
  var cells = ENG.discCells(W, H, 32, 32, 2), R = sim.R, add = 0, a = amount != null ? amount : 1.0;
  for (var k = 0; k < cells.length; k++) { add += a - R[cells[k]]; R[cells[k]] = a; }
  sim.E0 += add;
}
/* dendrite 아레나 1회 — kDendrite/dendSharp 를 주고 R 하이트필드 가지 측정. */
function dendRun(seed, opt) {
  var sim = ENG.createSim(seed, dendArena(opt || {})); seedDendrite(sim, 1.0); ENG.run(sim, ARENA_T);
  var m = ENG.measureDendrite(sim), led = ENG.ledger(sim);
  return { area: m.area, perim: m.perim, tips: m.tips, roughness: m.roughness, grown: sim.dendriteGrown, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kDendrite=0 → step-0026 비트 동일. golden turing@ 해시(튜링 스택, 덴드라이트 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden turing@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kDendrite=0. */
  var sim = ENG.createSim(seed, scn({ kDendrite: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['turing@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 덴드라이트(셀 안 E→R 쌍 거래 — 결정화/복제와 같은 경계)가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, grown: sim.dendriteGrown, pass: led.residual < 1e-6 };
}

/* ── det: kDendrite on 같은 시드 2회 비트 동일(곡률 증폭 침착이 E·R 변경 → 해시에). dendrite 아레나로 덴드라이트 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, dendArena()); seedDendrite(s, 1.0); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── dendrite: 가설 — 경계 불안정(*평탄 전선이 옆가지로 갈린다*). dendrite 아레나서 off vs flat(곡률 무증폭) vs sharp(곡률 증폭). ──
 *  ① 성장: on 의 area > off(씨앗만, 성장 없음).
 *  ② *경계 불안정*(핵심 thesis): sharp 의 거칠기 roughness ≫ 1(컴팩트 원판 ≈1; 가지친 덴드라이트는 가는 가지라 둘레 길어 ≫1) + 가지 끝 tips 多(튀어나온 끝 — 컴팩트 덩이엔 거의 0).
 *  ③ 곡률 역할: sharp(곡률 증폭) 가 flat(차폐만) 보다 *더* 가지친다(roughness·tips↑) — 곡률 증폭이 옆가지를 또렷이 한다(turing 의 "근방 커널 필수"와 같은 정신; 차폐만으로도 약한 불안정은 있음 — 정직).
 *  보존: 셀 안 E→R 쌍 거래라 잔차<1e-6. */
function dendriteTest(seed) {
  var off = dendRun(seed, { kDendrite: 0 }), flat = dendRun(seed, { dendSharp: 0 }), sharp = dendRun(seed, {});
  var pass = sharp.grown > 0                              // ① 반응 실활성
    && sharp.area > off.area * 1.5                        // ① 성장(씨앗보다 자랐다)
    && sharp.roughness > 2.0 && sharp.tips >= 4           // ② 경계 불안정(거칠기 ≫1·가지 끝 多 — 컴팩트 아님)
    && sharp.roughness > flat.roughness                   // ③ 곡률 증폭이 가지를 또렷이(차폐만 < 곡률+차폐)
    && sharp.residual < 1e-6;                             //   셀 안 E→R 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, offArea: off.area, area: sharp.area, flatRough: flat.roughness, roughness: sharp.roughness, flatTips: flat.tips, tips: sharp.tips, grown: sharp.grown, residual: sharp.residual, pass: pass };
}

/* ── sustain: 덴드라이트(실제 E→R 전선 성장)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, grown: sim.dendriteGrown, collapse: collapse };
  });
  var surv = rows.every(function (r) { return r.collapse < 0; });
  var churn = rows.every(function (r) { return r.lateBirths > 0 && r.lateDeaths > 0; });
  return { rows: rows, pass: surv && churn };
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hash', 'golden', 'pass']);
    console.log('회귀 0: kDendrite=0 step-0027 == step-0026 (덴드라이트 스택 해시 == golden turing@, dendrite 법칙 skip·E·R·G 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'grown', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (덴드라이트는 전선 셀 안에서 E→R 침착 — 결정화/복제와 같은 쌍 거래 경계 → 장부 식 불변). 전체 스택은 희소·이미 굳은 R 이라 큰 전선이 드물어 가지가 약하게만 — *덴드라이트 가지* 효과는 dendrite 아레나가 잰다(누적 성장 ' + avg(rc, 'grown').toFixed(1) + ').');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: dendrite 아레나(덴드라이트 활성) 같은 시드 2회 비트 동일(곡률 증폭 침착이 E·R 을 바꿔 해시에. tick 시작 snap 으로 곡률·고체 판정 — 스캔 순서 무관, Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'dendrite') {
    var rk = seeds.map(dendriteTest); table(rk, ['seed', 'offArea', 'area', 'flatRough', 'roughness', 'flatTips', 'tips', 'grown', 'residual', 'pass']);
    console.log('경계 불안정(*평탄 전선이 옆가지로 갈린다* — Mullins-Sekerka): 씨앗 ' + avg(rk, 'offArea').toFixed(0) + '칸 → 덴드라이트 ' + avg(rk, 'area').toFixed(0) +
      '칸(성장). *거칠기 roughness* ' + avg(rk, 'flatRough').toFixed(2) + '(차폐만)→' + avg(rk, 'roughness').toFixed(2) + '(곡률+차폐; 컴팩트 원판 ≈1 대비 ≫1 = 가지)·*가지 끝 tips* ' +
      avg(rk, 'flatTips').toFixed(1) + '→' + avg(rk, 'tips').toFixed(1) + '. 곡률 증폭(짧은 활성)이 기하 차폐(긴 억제) 위에 옆가지를 또렷이 한다(turing 과 같은 템플릿을 *전선*에). author 아닌 *창발*(침착 1개만 깖 — 척추 체크 2). 셀 안 E→R 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'grown', 'collapse']);
    console.log('덴드라이트 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(덴드라이트 가지)이 동역학을 안 깬다(전선만 성장·E≥dendRate 자원 문턱·셀 안 E→R 쌍 거래 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'dendrite', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
