/* HWS sim 엔진 재현 검증 — law-pipeline(engine/hws-{kernel,laws,sim}.js)이 step-0010/sim-core.js 와
 * *비트 단위로 동일*함을 증명한다. (cf. verify-engine.js 는 UI 엔진 패널→코어 매핑 검증 — 다른 관심사.)
 *
 * 이것이 새 공유 sim 구조의 회귀 앵커다:
 *   - step-0010 코어는 자기 verify(reg)로 회귀 사슬(pTumble=0→0009→…→0001)을 이미 증명했다.
 *   - 따라서 "새 엔진 ≡ step-0010 코어"를 보이면 새 엔진이 그 사슬을 *통째로 상속*한다(전이).
 * 동결 파일(과거 step 의 .js) 대신 *동결 해시*(golden-sim.json)로 아카이브 재현성을 잠근다:
 *   엔진/법칙을 고치면 이 스크립트가 전 시나리오 해시를 재검증해 드리프트를 즉시 잡는다.
 *
 * 사용: node engine/validate/verify-sim-engine.js [eq|golden|all]
 *   - eq     : 새 엔진 == step-0010 코어, 전 변형(회귀 사슬) 비트 동일(E·R·장부·에이전트 + 상태 해시).
 *   - golden : 표준 시나리오 상태 해시가 golden-sim.json 과 일치(없으면 생성). 아카이브 재현 잠금.
 *   - all    : 둘 다 (기본)
 */
'use strict';
var path = require('path');
var fs = require('fs');
var ENG = require('../hws-sim.js');                       // 새 law-pipeline 코어
var REF = require('../../step-0010/sim-core.js');         // 골든 레퍼런스(닫힌 step-0010)
var GOLDEN_PATH = path.join(__dirname, 'golden-sim.json');

var SEEDS = [42, 7, 1234, 99, 2026];

/* step-0010/verify.js 와 동일한 시나리오 상수(전체 스택). */
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02 };
var BASE = 0.08;
var STATIC = { srcJump: 0, srcPeriod: 150 };
var CRYST = { kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var RELIEF = { kRelief: 1.0 };
var TUMBLE = { pTumble: 1.0 };
var POOL = { minE: 1.5, prom: 0.3 };
/* 별(step-0011) — 내생 구동 시나리오. golden 의 endo@ 키가 별+생명 스택을 동결 잠근다(step-0012~ 회귀 앵커). */
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var CROWD = { kCrowd: 0.20, crowdR: 3 };   // 자기제한(step-0012) — golden 의 cwd@ 키가 별+생명+혼잡 스택을 동결 잠근다(step-0013~ 회귀 앵커).
var FSM = { kFSM: 1, livingFrac: 0.55, burnOn: 0.6, burnOff: 0.4 };  // 연소 FSM(step-0013) — golden 의 fsm@ 키가 별+생명+혼잡+FSM 스택을 동결 잠근다(step-0014~ 회귀 앵커).
var FLUX = { kFlux: 1, aFlux: 0.1 };  // 활성도 계량(step-0014) — golden 의 flux@ 키가 별+생명+혼잡+FSM+계량 스택을 동결 잠근다(step-0015~ 회귀 앵커).
var GENE = { kTemplate: 1, geneRate: 0.5, geneThresh: 0.3, geneMu: 0.01, geneTypes: 4, geneFit0: 0.5, geneFitStep: 0.15, geneClear: 0.05 };  // R-주형 복제(step-0015) — golden 의 gene@ 키가 + 복제 스택을 동결 잠근다(step-0016~ 회귀 앵커).
var INHERIT = { kInherit: 1, inheritMu: 0.01, inheritCost: 0.02 };  // 생명 유전(step-0016) — golden 의 life@ 키가 + 생명 유전 스택을 동결 잠근다(step-0017~ 회귀 앵커).
var ADH = { kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5 };  // 차등 응집(step-0017) — golden 의 org@ 키가 + 응집 스택을 동결 잠근다(step-0018~ 회귀 앵커).
var MEM = { kMembrane: 0.5 };  // 막/flux 결합(step-0018) — golden 의 mem@ 키가 + 막 결합 스택을 동결 잠근다(step-0019~ 회귀 앵커).
var SHARE = { kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0 };  // 생물량 공유(step-0019, 균일 협동) — golden 의 share@ 키가 + 생물량 공유 스택을 동결 잠근다(step-0020~ 회귀 앵커).
var PUBLIC = { kPublic: 0.3, pubSynergy: 2.0 };  // 공공재 협동(step-0020, 균일 협동) — golden 의 pub@ 키가 + 공공재 스택을 동결 잠근다(step-0021~ 회귀 앵커).
var DIFF = { kDiff: 0.3 };  // 세포 분화(step-0021) — golden 의 diff@ 키가 + 분화 스택을 동결 잠근다(step-0022~ 회귀 앵커).
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

function scn(extra) {
  return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, STATIC, CRYST, RELIEF, TUMBLE, extra || {});
}
/* 내생 시나리오(외부 source off, 별이 구동) — step-0011/verify.js endoScn 과 동일 상수. */
function endoScn(extra) {
  return Object.assign({}, AGG, LIFE, REPRO, MOVE, RELIEF, TUMBLE, CRYST, STAR, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {});
}
/* 자기제한 켠 내생 시나리오(step-0012 스택, FSM off) — step-0013/verify.js scn({kFSM:0}) 과 동일 상수. */
function crowdScn(extra) { return Object.assign({}, endoScn(), CROWD, extra || {}); }
/* 연소 FSM 켠 내생 시나리오(step-0013 스택, flux off) — step-0014/verify.js scn({kFlux:0}) 과 동일 상수. */
function fsmScn(extra) { return Object.assign({}, crowdScn(), FSM, extra || {}); }
/* 활성도 계량 켠 내생 시나리오(step-0014 스택, 복제 off) — step-0015/verify.js scn({kTemplate:0}) 과 동일 상수. */
function fluxScn(extra) { return Object.assign({}, fsmScn(), FLUX, extra || {}); }
/* R-주형 복제 켠 내생 시나리오(step-0015 스택) — step-0015/verify.js scn() 과 동일 상수. */
function geneScn(extra) { return Object.assign({}, fluxScn(), GENE, extra || {}); }
/* 생명 유전 켠 내생 시나리오(step-0016 스택) — step-0016/verify.js scn() 과 동일 상수. */
function lifeScn(extra) { return Object.assign({}, geneScn(), INHERIT, extra || {}); }
/* 차등 응집 켠 내생 시나리오(step-0017 스택) — step-0017/verify.js scn() 과 동일 상수. */
function orgScn(extra) { return Object.assign({}, lifeScn(), ADH, extra || {}); }
/* 막/flux 결합 켠 내생 시나리오(step-0018 스택) — step-0018/verify.js scn() 과 동일 상수. */
function memScn(extra) { return Object.assign({}, orgScn(), MEM, extra || {}); }
/* 생물량 공유 켠 내생 시나리오(step-0019 스택) — step-0019/verify.js scn() 과 동일 상수. */
function shareScn(extra) { return Object.assign({}, memScn(), SHARE, extra || {}); }
/* 공공재 협동 켠 내생 시나리오(step-0020 스택) — step-0020/verify.js scn() 과 동일 상수. */
function pubScn(extra) { return Object.assign({}, shareScn(), PUBLIC, extra || {}); }
/* 세포 분화 켠 내생 시나리오(step-0021 스택) — step-0021/verify.js scn() 과 동일 상수. */
function diffScn(extra) { return Object.assign({}, pubScn(), DIFF, extra || {}); }
/* 조밀 클론 조직 시나리오(step-0021 differentiate *실활성*) — step-0021/verify.js diffArena() 와 동일 상수.
 * diff@(전체 스택, 희소라 갇힌 세포 드물어 분화 거의 안 켜짐)와 달리, 이 tdiff@ 는 confluent 조직에서 분화 코드 경로(soma→germ 기부)를
 * *실제로* 도는 상태를 동결한다(드리프트 가드 — diff@ 만으론 differentiate 본문이 거의 미커버라는 점을 보완). */
function diffTissueScn(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 30, rate: 0.03 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0, kShare: 0, kPublic: 0,
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 1, geneFit0: 1, geneFitStep: 0,
    kAdhesion: 0, kDiff: 0.6
  }, extra || {});
}
function seedTissue(C, sim) { for (var y = 26; y < 38; y++) for (var x = 26; x < 38; x++) { var a = C.spawnAgent(sim, x, y); a.g = 1; } }
/* gene@ 결정 절차의 고정 유전 씨앗 — 두 유전형(저적합 tag1 · 고적합 tag4)을 대칭으로 심는다(결정론). */
function seedGenes(C, sim) { C.spawnGene(sim, 20, 20, 2, 1, 1.0); C.spawnGene(sim, 44, 44, 2, 4, 1.0); }
function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}
function seedStars(C, sim, k) { for (var i = 0; i < k; i++) C.spawnStar(sim, (i * 53) % W, (i * 29) % H); }

/* 두 sim 의 상태가 비트 단위 동일한가 — cross-core 비교(E·R·장부·에이전트 직접). */
function sameState(a, b) {
  var maxd = 0, i;
  for (i = 0; i < a.E.length; i++) { var dd = Math.abs(a.E[i] - b.E[i]); if (dd > maxd) maxd = dd; }
  for (i = 0; i < a.R.length; i++) { var dr = Math.abs(a.R[i] - b.R[i]); if (dr > maxd) maxd = dr; }
  var ok = maxd === 0;
  if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk || a.metabolized !== b.metabolized) ok = false;
  if (a.agents.length !== b.agents.length) ok = false;
  else for (var k = 0; k < a.agents.length; k++) {
    var p = a.agents[k], q = b.agents[k];
    if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false;
  }
  return { maxDiff: maxd, pass: ok && maxd === 0 };
}

/* 회귀 사슬을 한 시나리오씩 끄며 만든 노브 세트 — 각 변형에서 새 엔진이 step-0010 코어와 동일해야 한다.
 * (step-0010 코어가 이 변형들로 0009→…→0001 비트 동일을 이미 증명했으므로, 새 엔진의 동치는 사슬을 상속.) */
var VARIANTS = [
  { name: 'full-tumble (0010)', extra: {} },
  { name: 'pTumble=0  (->0009)', extra: { pTumble: 0 } },
  { name: 'kRelief=0  (->0008)', extra: { pTumble: 0, kRelief: 0 } },
  { name: 'kCryst=0   (->0007)', extra: { pTumble: 0, kRelief: 0, kCryst: 0 } },
  { name: 'srcJump=6  (wander)', extra: { srcJump: 6 } },
  { name: 'baseCost=0 (->0005)', extra: { pTumble: 0, kRelief: 0, kCryst: 0, baseCost: 0 } },
  { name: 'move=false (->0004)', extra: { pTumble: 0, kRelief: 0, kCryst: 0, baseCost: 0, move: false } },
  { name: 'repro=false(->0003)', extra: { pTumble: 0, kRelief: 0, kCryst: 0, baseCost: 0, repro: false } },
  { name: 'kA=0,nolife(->0001)', extra: { kA: 0, life: false } }
];

/* 한 (시나리오, 시드)에서 두 코어를 *동일 절차*로 굴려 끝 상태를 비교. 발산은 보통 수백 tick 안에 드러난다. */
function eqTrial(extra, seed, form, post) {
  var a = ENG.createSim(seed, scn(extra)); ENG.run(a, form); spawnStrongest(ENG, a, 3); ENG.run(a, post);
  var b = REF.createSim(seed, scn(extra)); REF.run(b, form); spawnStrongest(REF, b, 3); REF.run(b, post);
  var st = sameState(a, b);
  st.hashEng = ENG.hashState(a); st.hashRef = REF.hashState(b);
  st.hashMatch = st.hashEng === st.hashRef;
  return st;
}

function runEq() {
  var FORM = 800, POST = 700, evalSeeds = [42, 7, 1234];
  console.log('== eq: 새 엔진(law-pipeline) == step-0010 코어, 비트 동일 ==');
  console.log('variant\t\tseed\tmaxDiff\t\thashEng\t\thashRef\t\tres');
  var allOk = true;
  VARIANTS.forEach(function (v) {
    evalSeeds.forEach(function (seed) {
      var r = eqTrial(v.extra, seed, FORM, POST);
      var ok = r.pass && r.hashMatch;
      if (!ok) allOk = false;
      console.log(v.name + '\t' + seed + '\t' + r.maxDiff.toExponential(2) + '\t' + r.hashEng + '\t' + r.hashRef + '\t' + (ok ? 'OK' : 'FAIL'));
    });
  });
  /* 깊은 표준 런 — 누적 오차까지 비트 동일 확인(전 시드, 긴 tick). */
  console.log('-- deep 표준(full stack, FORM 4000 + 4000) --');
  SEEDS.forEach(function (seed) {
    var r = eqTrial({}, seed, 4000, 4000);
    var ok = r.pass && r.hashMatch;
    if (!ok) allOk = false;
    console.log('deep\t\t\t' + seed + '\t' + r.maxDiff.toExponential(2) + '\t' + r.hashEng + '\t' + r.hashRef + '\t' + (ok ? 'OK' : 'FAIL'));
  });
  console.log(allOk ? 'eq PASS\n' : 'eq FAIL\n');
  return allOk;
}

/* golden: 표준 시나리오 상태 해시를 golden-sim.json 과 대조. 동결 해시 = 아카이브 재현 잠금.
 *   std@  — step-0010 등가 스택(외부 source, 별 없음). 0011 까지의 회귀 사슬을 잠근다.
 *   endo@ — step-0011 내생 구동(별+생명, 외부 source off). 0012 의 회귀 앵커(kCrowd=0 이면 이 해시 불변).
 *   cwd@  — step-0012 자기제한 스택(별+생명+혼잡, FSM off). 0013 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   fsm@  — step-0013 연소 FSM 스택(별+생명+혼잡+FSM, flux off). 0014 의 회귀 앵커.
 *   flux@ — step-0014 활성도 계량 스택(+계량, 복제 off). 0015 의 회귀 앵커: 새 노브 kTemplate=0 이면 이 해시 불변.
 *   gene@ — step-0015 R-주형 복제 스택(+복제+유전 씨앗). 0016~ 의 회귀 앵커: 새 노브 kInherit=0 이면 이 해시 불변.
 *   life@ — step-0016 생명 유전 스택(+생명 유전+유전 씨앗). 0017~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   org@  — step-0017 차등 응집 스택(+응집+유전 씨앗). 0018~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   mem@  — step-0018 막/flux 결합 스택(+kin E 공유, kMembrane on). 0019~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   share@ — step-0019 생물량 공유 스택(+kin m 표적 구조, kShare on). 0020~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   pub@  — step-0020 공공재 협동 스택(+kin E→m 시너지, kPublic on). 0021~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   diff@ — step-0021 세포 분화 스택(전체 스택, 희소라 분화 거의 안 켜짐 — 직교성 동결). 0022~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   tdiff@ — step-0021 조밀 클론 조직(differentiate *실활성* — soma→germ 기부가 세게 돔). diff@ 가 분화 본문을 거의 미커버라 이 키가 분화 코드 경로를 동결한다(드리프트 가드).
 * 키 추가는 *미존재 시 no-op 가법*(DURABLE CONSTRAINT) — 기존 키는 비교, 새 키는 파일에 기록(드리프트 아님). */
function runGolden() {
  console.log('== golden: 표준 시나리오 상태 해시 동결 잠금 ==');
  var cur = {};
  SEEDS.forEach(function (seed) {
    var a = ENG.createSim(seed, scn()); ENG.run(a, 4000); spawnStrongest(ENG, a, 3); ENG.run(a, 4000);
    cur['std@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // endo@ — 별 6 + 생명 5(step-0011 내생 스택)
    var a = ENG.createSim(seed, endoScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); ENG.run(a, 3000);
    cur['endo@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // cwd@ — 별 6 + 생명 5 + 자기제한(step-0012 스택, FSM off). step-0013 회귀 앵커.
    var a = ENG.createSim(seed, crowdScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); ENG.run(a, 3000);
    cur['cwd@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // fsm@ — 별 6 + 생명 5 + 자기제한 + 연소 FSM(step-0013 스택, flux off). step-0014 회귀 앵커.
    var a = ENG.createSim(seed, fsmScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); ENG.run(a, 3000);
    cur['fsm@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // flux@ — fsm@ + 활성도 계량(step-0014 스택, 복제 off). step-0015 회귀 앵커.
    var a = ENG.createSim(seed, fluxScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); ENG.run(a, 3000);
    cur['flux@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // gene@ — flux@ + R-주형 복제 + 유전 씨앗(step-0015 스택). step-0016 회귀 앵커.
    var a = ENG.createSim(seed, geneScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['gene@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // life@ — gene@ + 생명 유전(생명이 R-genotype 에서 부트스트랩·상속·표현형세, step-0016 스택). step-0017 회귀 앵커.
    var a = ENG.createSim(seed, lifeScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['life@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // org@ — life@ + 차등 응집(부트스트랩한 생명이 kin 액적으로 묶임, step-0017 스택). step-0018 회귀 앵커.
    var a = ENG.createSim(seed, orgScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['org@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // mem@ — org@ + 막/flux 결합(kin 액적이 내부 E 공유로 물리적 도메인, step-0018 스택). step-0019 회귀 앵커.
    var a = ENG.createSim(seed, memScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['mem@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // share@ — mem@ + 생물량 공유(kin 끼리 m 표적 구조, step-0019 스택). step-0020 회귀 앵커.
    var a = ENG.createSim(seed, shareScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['share@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // pub@ — share@ + 공공재 협동(kin 끼리 E→m 시너지, step-0020 스택). step-0021 회귀 앵커.
    var a = ENG.createSim(seed, pubScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['pub@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // diff@ — pub@ + 세포 분화(전체 스택, 희소라 분화 거의 안 켜짐 — 직교성 동결). step-0022 회귀 앵커.
    var a = ENG.createSim(seed, diffScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['diff@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tdiff@ — 조밀 클론 조직(differentiate *실활성*: soma→germ 기부가 세게 돔). diff@ 의 미커버를 보완해 분화 코드 경로를 동결. step-0022 회귀 앵커.
    var a = ENG.createSim(seed, diffTissueScn()); seedTissue(ENG, a); ENG.run(a, 800);
    cur['tdiff@' + seed] = ENG.hashState(a);
  });
  var gold = fs.existsSync(GOLDEN_PATH) ? JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) : {};
  var ok = true, added = 0;
  Object.keys(cur).forEach(function (k) {
    if (!(k in gold)) { gold[k] = cur[k]; added++; console.log('  ' + k + '\tcur=' + cur[k] + '\tADD (신규 키 — 가법 잠금)'); return; }
    var match = gold[k] === cur[k];
    if (!match) ok = false;
    console.log('  ' + k + '\tgold=' + gold[k] + '\tcur=' + cur[k] + '\t' + (match ? 'OK' : 'DRIFT'));
  });
  if (added > 0) fs.writeFileSync(GOLDEN_PATH, JSON.stringify(gold, null, 2) + '\n');
  console.log(ok ? ('golden PASS' + (added ? ' (' + added + ' 신규 키 기록)' : '') + '\n') : 'golden FAIL (드리프트 — 엔진 수정이 과거 재현 수치를 바꿨다)\n');
  return ok;
}

var mode = process.argv[2] || 'all';
var ok;
if (mode === 'eq') ok = runEq();
else if (mode === 'golden') ok = runGolden();
else ok = [runEq(), runGolden()].every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
