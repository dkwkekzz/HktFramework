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
var GERM = { kGermline: 0.3 };  // 생식세포 계통 격리(step-0022) — golden 의 germ@ 키가 + 계통 스택을 동결 잠근다(step-0023~ 회귀 앵커).
var ANCHOR = { kAnchor: 1, anchorM: 0.6, anchorKin: 2 };  // 정착 생활사(step-0023) — golden 의 anchor@ 키가 + 정착 스택을 동결 잠근다(step-0024~ 회귀 앵커).
var TENSION = { kTension: 1, tensionGamma: 0.10 };  // 곡률 기반 표면장력(step-0024) — golden 의 curv@ 키가 + 표면장력 스택을 동결 잠근다(step-0025~ 회귀 앵커).
var ANISO = { kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2 };  // 방향성 결정화(step-0025) — golden 의 aniso@ 키가 + 방향성 결정화 스택을 동결 잠근다(step-0026~ 회귀 앵커).
var TURING = { kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5 };  // E↔R 튜링 불안정(step-0026) — golden 의 turing@ 키가 + 튜링 스택을 동결 잠근다(step-0027~ 회귀 앵커).
var DENDRITE = { kDendrite: 1, dendRate: 0.06, dendThresh: 0.5, dendSharp: 1.0 };  // 가지치기 덴드라이트(step-0027) — golden 의 dend@ 키가 + 덴드라이트 스택을 동결 잠근다(step-0028~ 회귀 앵커).
var SELECT = { kPermeate: 0.3 };  // 선택 투과 막(step-0028) — golden 의 select@ 키가 + 선택 투과 막 스택을 동결 잠근다(step-0029~ 회귀 앵커).
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
/* 생식세포 계통 격리 켠 내생 시나리오(step-0022 스택) — step-0022/verify.js scn() 과 동일 상수. */
function germScn(extra) { return Object.assign({}, diffScn(), GERM, extra || {}); }
/* 정착 생활사 켠 내생 시나리오(step-0023 스택) — step-0023/verify.js scn() 과 동일 상수. */
function ancScn(extra) { return Object.assign({}, germScn(), ANCHOR, extra || {}); }
/* 곡률 표면장력 켠 내생 시나리오(step-0024 스택) — step-0024/verify.js scn() 과 동일 상수. */
function curvScn(extra) { return Object.assign({}, ancScn(), TENSION, extra || {}); }
/* 방향성 결정화 켠 내생 시나리오(step-0025 스택) — step-0025/verify.js scn() 과 동일 상수. */
function anisoScn(extra) { return Object.assign({}, curvScn(), ANISO, extra || {}); }
/* 튜링 불안정 켠 내생 시나리오(step-0026 스택) — step-0026/verify.js scn() 과 동일 상수. */
function turScn(extra) { return Object.assign({}, anisoScn(), TURING, extra || {}); }
/* 가지치기 덴드라이트 켠 내생 시나리오(step-0027 스택) — step-0027/verify.js scn() 과 동일 상수. */
function dendScn(extra) { return Object.assign({}, turScn(), DENDRITE, extra || {}); }
/* 선택 투과 막 켠 내생 시나리오(step-0028 스택) — step-0028/verify.js scn() 과 동일 상수. */
function selScn(extra) { return Object.assign({}, dendScn(), SELECT, extra || {}); }
/* 6-이웃 z-확산 3D 아레나(step-0030 V2 *실활성*) — step-0030/verify.js zArena() 와 동일 상수.
 * D=8 voxel 상자, 등방 확산(kD=kDz=0.15, 6-이웃 안정: 4·0.15+2·0.15=0.9<1) + z=0 source 구동 + 응집(z-항 코드 경로) — 다른 법칙 다 off.
 * 골든 D=1 시나리오(std@~tselect@)는 z 항이 없어 z 확산 코드 경로를 *전혀 안 돈다* — 이 zdiff@ 가 V2 의 z-확산·z-응집 본문을 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function zdiffScn(extra) {
  return Object.assign({}, {
    D: 8, initE: 1.0, noise: 0.5, drive: true,
    source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
    kD: 0.15, kDz: 0.15, kEvap: 0.001, kA: 0.3, aggMc: 1.1, aggW: 0.7, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 중력 침전 3D 아레나(step-0031 V3 *실활성*) — step-0031/verify.js gravArena() 와 동일 상수.
 * D=8 voxel 상자, 균일 E(noise 로 미세 섭동) + 중력 하향 침전(kGravity=0.2) — 다른 법칙(확산 포함) 다 off 라 *순수 중력* 코드 경로만 돈다.
 * 골든 D=1 키들·zdiff@(kGravity=0)는 gravity 가 early-return 이라 이 코드 경로를 *전혀 안 돈다* — 이 grav@ 가 V3 의 z-하향 쌍 거래 본문을 동결한다(드리프트 가드). */
function gravArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 1.0, noise: 0.5, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.2,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 지지 침착 3D 아레나(step-0032 V4 *실활성*) — step-0032/verify.js supportArena() 와 동일 상수.
 * D=8 voxel 상자, 균일 E(>crystThresh) + 중력 하향 침전(kGravity) + 결정화(kCryst) + 지지 게이트(kSupport=1) — 다른 법칙 다 off.
 * 골든 D=1 키들(kSupport 미설정=0 → crystallize z=0 평면 = 비트 동일)·grav@(kCryst=0)는 3D+게이트 코드 경로를 *안 돈다* — 이 support@ 가 지지 게이트·3D 침착 본문을 동결한다(드리프트 가드). */
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
/* R 차폐 3D 아레나(step-0033 V5 *실활성*) — step-0033/verify.js occludeArena()/seedOcclude() 와 동일 상수.
 * D=8 voxel 상자, 빈 세계 + 정적 R 지면 슬랩(z=3 전 평면) + 그 위(z=4..7) E 주입 + 중력(kGravity) + 차폐 게이트(kOcclude=1) — 다른 법칙 다 off(결정화·풍화 off → R 정적).
 * grav@/support@(kOcclude=0)·골든 D=1 키들은 차폐 게이트 코드 경로를 *안 돈다* — 이 occl@ 가 차폐 본문(아래 R≥문턱 시 하향 차단)을 동결한다(드리프트 가드). */
function occludeArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.2, kOcclude: 1, occludeThresh: 0.5,
    kCryst: 0, kWeather: 0, kSupport: 0,
    kCrowd: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
var OCC_GZ = 3, OCC_RVAL = 1.0, OCC_EVAL = 2.0;
function seedOcclude(sim) {                                            // 정적 R 지면 슬랩 + 그 위 E — 둘 다 E0(장부 baseline)에 산입. step-0033/verify.js seedOcclude() 와 동일.
  var WH = sim.p.W * sim.p.H, D = sim.p.D, k, z, i;
  for (k = 0; k < WH; k++) { i = OCC_GZ * WH + k; sim.R[i] = OCC_RVAL; sim.E0 += OCC_RVAL; }
  for (z = OCC_GZ + 1; z < D; z++) for (k = 0; k < WH; k++) { i = z * WH + k; sim.E[i] += OCC_EVAL; sim.E0 += OCC_EVAL; }
}
/* 부유 R 붕괴 3D 아레나(step-0034 V5+ *실활성*) — step-0034/verify.js collapseArena()/seedFloatR() 와 동일 상수.
 * D=8 voxel 상자, 빈 세계(initE=0·R 0) + *공중에 뜬* R 슬랩(z=5 전 평면, 아래 z=0..4 비움) + 붕괴(kCollapse) — 다른 법칙 다 off(중력·결정화 off → 순수 R 낙하 코드 경로만).
 * grav@/support@/occl@(kCollapse=0)·골든 D=1 키들은 collapse 가 early-return 이라 이 코드 경로를 *안 돈다* — 이 coll@ 가 V5+ 의 R 하향 쌍 거래 본문(아래 비지지 시 낙하)을 동결한다(드리프트 가드). */
function collapseArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kCollapse: 0.2, collapseThresh: 0.5,
    kGravity: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
var COL_GZ = 5, COL_RVAL = 1.0;
function seedFloatR(sim) {                                             // 공중에 뜬 R 슬랩(z=COL_GZ, 아래 전부 빈칸) — R 은 E0 장부 baseline 에 산입. step-0034/verify.js seedFloatR() 와 동일.
  var WH = sim.p.W * sim.p.H, k, i;
  for (k = 0; k < WH; k++) { i = COL_GZ * WH + k; sim.R[i] = COL_RVAL; sim.E0 += COL_RVAL; }
}
/* 별 부력 상승 3D 아레나(step-0035 V5+ *실활성*) — step-0035/verify.js sunArena()/seedSunCore() 와 동일 상수.
 * D=8 voxel 상자, 빈 세계 + z=0 정적 R 핵(점화 신호, R≥ignThresh) + 별 점화(kIgnite)·부력 상승(kStarRise) — 중력·결정화·생명 다 off(순수 부력+방출 코드 경로만).
 * kGravity=0 으로 격리(방출 E 가 제자리 — 별이 떠오른 높이에 E 가 남아 부력을 또렷이 동결). starCap=1 로 단일 별. 골든 별 D=1 키들(std@~)은 kStarRise=0 이라 부력 미진입 → 이 sun@ 가 z-상승·3D ball 방출 본문을 동결한다(드리프트 가드). */
function sunArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 1, kStarRise: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
var SUN_RVAL = 2.0;
function seedSunCore(sim) {                                            // z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0 장부 baseline 에 산입. step-0035/verify.js seedSunCore() 와 동일.
  var p = sim.p, disc = ENG.discCells(p.W, p.H, (p.W / 2) | 0, (p.H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
/* 별 하강·일생 3D 아레나(step-0036 V5+ *실활성*) — sunArena 와 동일하되 부력 위에 하강(kStarFall=1)을 켠다. step-0036/verify.js fallArena() 와 동일 상수.
 * 별이 z=0 R 핵서 점화→연료 충분하면 천장까지 떠오르고(rise)→연료가 starFallThresh 아래로 쇠하면 도로 가라앉는다(fall, 가라앉는 동안에도 방출).
 * sun@(kStarFall=0)는 하강 분기·연료 쇠퇴 침강 본문을 *안 돈다* → 이 fall@ 가 하강 중 방출(E 분포가 하강 경로 따라 내려가는 본문)을 동결한다(드리프트 가드). step-0037~ 회귀 앵커: 새 노브=0 이면 이 해시 불변. */
function fallArena(extra) {
  return sunArena(Object.assign({ kStarFall: 1, starFallThresh: 0.5 }, extra || {}));
}
/* 태양빛 비 3D 아레나(step-0037 V5+ *통합*) — fallArena(=0036 별 일생) 위에 중력(kGravity=0.2)을 켠다. step-0037/verify.js rainArena() 와 동일 상수.
 * 별이 z=0 R 핵서 떴다 지며(0036) 高z 에서 뿌린 E 를 중력(V3)이 z=0 바닥으로 끌어내려 고이게 한다 = 바다(별빛→비→바다). 이 step 은 법칙 무변경 — 두 기존 법칙(ignite 별 일생·gravity)의 *합성*.
 * fall@(kGravity=0)는 중력 미커버(방출 E 가 제자리) → 이 rain@ 가 별빛+중력 통합 본문(高z 방출 E 가 바닥에 고이는 합성 경로)을 동결한다(드리프트 가드). step-0038~ 회귀 앵커: 새 노브=0 이면 이 해시 불변. */
function rainArena(extra) {
  return fallArena(Object.assign({ kGravity: 0.2 }, extra || {}));
}
/* 별 죽음·일몰사 3D 아레나(step-0038 V5+) — fallArena(=0036 별 일생) 위에 일몰사(kStarSet=1)를 켠다. step-0038/verify.js deathArena() 와 동일 상수.
 * 떠올랐다 다시 지는 별이 z=0(지평선)에 닿으면 꺼지고, 빈 starCap 자리에 R 핵서 다음 별이 난다(出沒生死 순환). 새 노브 kStarSet 게이트.
 * fall@(kStarSet=0)는 일몰사 미커버(진 별이 z=0 서 계속 탐) → 이 death@ 가 일몰사 본문(떴다 진 별의 z=0 소멸·세대 재점화)을 동결(드리프트 가드). step-0039~ 회귀 앵커: 새 노브=0 이면 이 해시 불변. */
function deathArena(extra) {
  return fallArena(Object.assign({ kStarSet: 1 }, extra || {}));
}
/* 죽은 별 잔해→새 씨앗 3D 아레나(step-0039 V5+) — deathArena(=0038 일몰사) 위에 잔해 침착(kAshSeed=0.5)을 켠다. step-0039/verify.js remnArena() 와 동일 상수.
 * 일몰사로 지는 별이 z=0(무덤)에서 꺼질 때, 미연소 외부 연료의 절반이 그 자리 R 로 가라앉아 다음 별의 점화 씨앗이 된다(出沒生死 → 잔해 → 재구성). 새 노브 kAshSeed 게이트.
 * death@(kAshSeed=0)는 잔해 침착 미커버(진 별이 흔적 없이 사라짐) → 이 remn@ 가 잔해 R 침착·E0 보정 본문을 동결(드리프트 가드). step-0040~ 회귀 앵커: 새 노브=0 이면 이 해시 불변. */
function remnArena(extra) {
  return deathArena(Object.assign({ kAshSeed: 0.5 }, extra || {}));
}
/* 전체 에너지 고리 폐합 3D 아레나(step-0040 V5+ *통합*) — rainArena(=0037 별빛→비→바다) 위에 결정화+지지 침착(kCryst·kSupport)을 켜 *바다를 지면/씨앗으로* 굳힌다. step-0040/verify.js cycleArena() 와 동일 상수.
 * 별이 떴다 지며 뿌린 E 가 중력으로 z=0 바다로 고이고(0037) → 그 바다 E 가 결정화로 R(지면/씨앗)로 굳어(0008·0032 지지 게이트) → R 이 ignThresh 넘으면 새 별이 거기서 점화(0011) = E→별→비→바다→지면→새 별 *완전 self-running 폐합*. 이 step 은 법칙 무변경 — 검증된 부품(별 일생·중력·결정화·지지)의 합성.
 * rain@(kCryst=0)는 결정화 미커버(바다가 안 굳음) → 이 ring@ 가 바다→지면/씨앗 폐합 본문(고인 E 가 R 로 굳어 새 점화 씨앗 됨)을 동결(드리프트 가드). step-0041~ 회귀 앵커: 새 부품(kCryst)=0 이면 이 해시 = rain@ 와 같은 경로(법칙 무변경). */
function cycleArena(extra) {
  return rainArena(Object.assign({ kCryst: 0.05, crystThresh: 2.0, kSupport: 1, supportThresh: 0.5, kWeather: 0, starCap: 3 }, extra || {}));
}
/* 풍화 평형 closed 3D 아레나(step-0041 V5+ — SPINE 척도분리 *느린 재구성*) — step-0041/verify.js weqArena() 와 동일 상수.
 * 외부 연료 주입 0(별·source off)인 닫힌 저장소: 균일 E(initE=5)가 중력으로 z=0 바다로 고이고 → 지지 침착으로 지면 R 로 굳고 → *풍화(kWeather=0.01)로 R 이 천천히 E 로 되돌아온다*.
 *   풍화 없이는 물질이 통째로 R 로 동결(E 굶음·새 동결 G2), 풍화로 R↔E 동적 평형(쌓임↔풍화 carrying capacity). ring@ 등(kWeather=0)은 풍화 평형 미커버 → 이 키가 풍화 R→E 재구성·물질 carrying capacity 본문을 동결(드리프트 가드).
 *   법칙 무변경(풍화는 step-0008 부터 crystallize 안). step-0042~ 회귀 앵커: 새 부품(kWeather)=0 이면 풍화 분기 no-op(rel=0) → 물질 동결 경로(법칙 무변경). */
function weqArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 5.0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0.2, kCollapse: 0, kCryst: 0.05, crystThresh: 2.0, kSupport: 1, supportThresh: 0.5, kWeather: 0.01, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 생명 z-이동 3D 아레나(step-0042 V5+ — 주화성의 연직축 일반화) — step-0042/verify.js mvzArena() 와 동일 상수.
 * D=8 voxel, 정적 연직 E 구배(E(z)=1+z), z=0 평면에 생명 9 마리(3×3). kMoveZ=1 → 생명이 천장까지 오른다(연직 주화성). 순수 z-이동 격리(흡수·대사·번식 off).
 * 골든 D=1·생명 키들(move 가 2D)은 z-이동 미커버 → 이 키가 move 6-이웃 z-주화성·agent.z 해시 본문을 동결(드리프트 가드). step-0043~ 회귀 앵커: 새 노브(kMoveZ)=0 이면 2D 경로(직전 비트 동일). */
function mvzArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, kL: 0, lifeR: 0,
    life: true, move: true, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedMvz(sim) {                                                 // 정적 연직 E 구배 E(z)=1+z + z=0 평면 생명 9 마리(3×3). step-0042/verify.js seedGradient/seedLife 와 동일.
  var E = sim.E, D = sim.p.D, WH = sim.p.W * sim.p.H;
  for (var z = 0; z < D; z++) { var base = 1 + z; for (var i = 0; i < WH; i++) { E[z * WH + i] = base; sim.E0 += base; } }
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 20 + gx * 4, 20 + gy * 4);
}
/* 3D 번식 3D 아레나(step-0043 V5+ — 번식의 연직축 일반화) — step-0043/verify.js div3Arena()/seedGradient/seedLife 와 동일 상수.
 * D=8 voxel, 정적 연직 E 구배(E(z)=1+z), z=0 평면에 생명 9 마리(3×3). kDivZ=1 → 자식이 위로 줄지어 태어나 천장까지(번식 상승). 순수 z-번식 격리(이동·흡수·대사 off·mDiv 작게).
 * mvz@(kDivZ=0·repro=false)는 reproduce z-경로 미커버 → 이 키가 reproduce 6-이웃 z-출생·agent.z 해시 본문을 동결(드리프트 가드). step-0044~ 회귀 앵커: 새 노브(kDivZ)=0 이면 2D 경로(비트 동일). */
function div3Arena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: true, mDiv: 0.005, divR: 1, popCap: 4096, kDivZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedDiv3(sim) {                                                // 정적 연직 E 구배 E(z)=1+z + z=0 평면 생명 9 마리(3×3). step-0043/verify.js seedGradient/seedLife 와 동일.
  var E = sim.E, D = sim.p.D, WH = sim.p.W * sim.p.H;
  for (var z = 0; z < D; z++) { var base = 1 + z; for (var i = 0; i < WH; i++) { E[z * WH + i] = base; sim.E0 += base; } }
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 16 + gx * 6, 16 + gy * 6);
}
/* 3D 혼잡 3D 아레나(step-0044 V5+ — 혼잡 carrying capacity 의 연직 일반화) — step-0044/verify.js capArena()/seedColumns 와 동일 상수.
 * D=8 voxel, 생명 수직 컬럼 3개(같은 (x,y), z=0..D−1)·crowd 만 on(이동·번식·흡수·대사 off → m 은 혼잡세로만). kCrowdZ=1 → 수직 적층이 z-이웃 세 혼잡세를 냄(3D carrying capacity).
 * cwd@ 등 2D 키들은 z=0 평면 혼잡만 커버 → 이 키가 ball 밀도 셈·W·H·D occ 본문을 동결(드리프트 가드). step-0045~ 회귀 앵커: 새 노브(kCrowdZ)=0 이면 2D 경로(비트 동일). */
function capArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0.02, crowdR: 3, kCrowdZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedColumns(sim) {                                            // 균일 E=2 + 생명 수직 컬럼 3개(각 z=0..D−1 적층). step-0044/verify.js seedColumns 와 동일.
  var E = sim.E, D = sim.p.D, W = sim.p.W, H = sim.p.H, WH = W * H, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x;
    var seedM = sim.E[center] < 1 ? sim.E[center] : 1;
    sim.E[center] -= seedM;
    sim.agents.push({ x: x, y: y, z: z, m: seedM, cells: [center], center: center, bornTick: sim.tick });
  }
}
/* 3D 차등 응집 3D 아레나(step-0045 V5+ — 차등 응집[kin 정렬]의 연직축 일반화) — step-0045/verify.js sortArena()/seedKinBlock 과 동일 상수.
 * D=8 voxel, 두 유전형 z-체커보드 블록(z∈[1,7))·adhere 만 on(이동·번식·흡수·대사·혼잡 off → 위치는 정렬로만). kAdhereZ=1 → z>0 거주 생명이 z±이웃 kin 을 세 3D 정렬(연직 cell sorting).
 * org@ 등 2D 키들(z=0 평면 정렬)은 W·H·D occ·6-이웃·26-이웃 미커버 → 이 키가 3D 정렬 본문·agent.z 해시를 동결(드리프트 가드). step-0046~ 회귀 앵커: 새 노브(kAdhereZ)=0 이면 2D 경로(비트 동일). */
function sortArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedKinBlock(sim) {                                            // 균일 E=2 + 두 유전형 z-체커보드 블록(x∈[12,24)·y∈[12,24)·z∈[1,7)·≈60% 채움). step-0045/verify.js seedKinBlock 과 동일.
  var E = sim.E, D = sim.p.D, W = sim.p.W, H = sim.p.H, WH = W * H, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }
  for (var z = 1; z < 7; z++) for (var y = 12; y < 24; y++) for (var x = 12; x < 24; x++) {
    if (((x * 3 + y * 5 + z * 7) % 5) >= 3) continue;
    var center = z * WH + y * W + x, tag = 1 + ((x + y + z) & 1);
    var seedM = sim.E[center] < 1 ? sim.E[center] : 1;
    sim.E[center] -= seedM;
    sim.agents.push({ x: x, y: y, z: z, m: seedM, g: tag, cells: [center], center: center, bornTick: sim.tick });
  }
}
/* 3D 생물량 공유 3D 아레나(step-0046 V5+ — risk-pooling 의 연직축 일반화) — step-0046/verify.js poolArena()/seedKinColumns 와 동일 상수.
 * D=8 voxel, 수직 kin 컬럼 3개(같은 (x,y)·태그 1·z=0..D−1·z 짝수 안전 m=1.0·홀수 궁핍 m=0.2)·share 만 on(이동·번식·흡수·혼잡·응집 off → m 은 구조로만). kShareZ=1 → z>0 굶주린 kin 이 z±1 안전 kin 에게 구조(연직 risk-pooling).
 * share@ 등 2D 키들(z=0 평면 구조)은 W·H·D occ·+z 쌍 미커버 → 이 키가 3D 구조 본문을 동결(드리프트 가드). step-0047~ 회귀 앵커: 새 노브(kShareZ)=0 이면 2D 경로(비트 동일). */
function poolArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0.1, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedKinColumns(sim) {                                          // 균일 E=2 + 수직 kin 컬럼 3개(태그 1·z 짝수 안전 1.0·홀수 궁핍 0.2). step-0046/verify.js seedKinColumns 와 동일.
  var E = sim.E, D = sim.p.D, W = sim.p.W, H = sim.p.H, WH = W * H, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x, want = (z & 1) ? 0.2 : 1.0;
    var seedM = sim.E[center] < want ? sim.E[center] : want;
    sim.E[center] -= seedM;
    sim.agents.push({ x: x, y: y, z: z, m: seedM, g: 1, cells: [center], center: center, bornTick: sim.tick });
  }
}
/* 3D 생명 유전 상속 3D 아레나(step-0047 V5+ — inherit 부모 탐색의 연직축 일반화) — step-0047/verify.js inhArena()/seedInherit 와 동일 상수.
 * D=8 voxel, 수직 컬럼 3개(같은 (x,y)·z=0..D−1·z 짝수=태그 박힌 부모[태그 1·2·3]·홀수=갓 태어난 자식 g=0)·inherit 만 on(이동·번식·흡수·혼잡·응집·공유 off → a.g 는 상속으로만). kInheritZ=1 → z>0 자식이 z±1 부모서 유전형 상속(연직 유전 전파).
 * gene@/life@ 등 2D 키들(z=0 평면 상속)은 GENE_VN6·키 z·WH+ny·W+nx 미커버 → 이 키가 3D 상속 본문을 동결(드리프트 가드). step-0048~ 회귀 앵커: 새 노브(kInheritZ)=0 이면 2D 경로(비트 동일). */
function inhArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 0,
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 4, geneFit0: 1, geneFitStep: 0, kInheritZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedInherit(sim) {                                             // 수직 컬럼 3개(z 짝수=부모 g=태그·bornTick=−1·홀수=자식 g=0·bornTick=0). step-0047/verify.js seedInherit 와 동일.
  var E = sim.E, D = sim.p.D, W = sim.p.W, H = sim.p.H, WH = W * H, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 5; sim.E0 += 5; }
  var cols = [[16, 16, 1], [22, 22, 2], [28, 28, 3]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], tag = cols[c][2], center = z * WH + y * W + x, even = (z & 1) === 0;
    sim.E[center] -= 1;                                                 // 생물량 m=1 은 E 서 떼온다(닫힌 장부)
    sim.agents.push({ x: x, y: y, z: z, m: 1, g: even ? tag : 0, cells: [center], center: center, bornTick: even ? -1 : 0 });
  }
}
/* 3D 막/flux 결합 3D 아레나(step-0048 V5+ — couple kin E-공유의 연직축 일반화) — step-0048/verify.js cplArena()/seedCoupleColumns 와 동일 상수.
 * D=8 voxel, 수직 kin 컬럼 3개(같은 (x,y)·태그 1·z=0..D−1·제 칸 E z 짝수 고=2.5·홀수 저=0.5)·couple 만 on(확산·중력·이동·번식·흡수·혼잡·응집·공유·유전 off → E 는 couple 로만). kCoupleZ=1 → z>0 kin 이 z±1 동료와 E 균등화(연직 막).
 * org@/couple 2D 키들(z=0 평면 공유)은 W·H·D occ·+z 쌍·하 dc z 교정 미커버 → 이 키가 3D 막 본문을 동결(드리프트 가드). step-0049~ 회귀 앵커: 새 노브(kCoupleZ)=0 이면 2D 경로(비트 동일). */
function cplArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 0,
    kInherit: 0, inheritMu: 0, inheritCost: 0, kInheritZ: 0,
    kMembrane: 0.5, kCoupleZ: 1,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function seedCoupleColumns(sim) {                                       // 수직 kin 컬럼 3개(태그 1·z 짝수 고 E=2.5·홀수 저 E=0.5·m=0.5 E 서 떼옴). step-0048/verify.js seedCoupleColumns 와 동일.
  var E = sim.E, D = sim.p.D, W = sim.p.W, H = sim.p.H, WH = W * H, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 0; }
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x;
    E[center] = (z & 1) ? 1.0 : 3.0; sim.E0 += E[center];
    E[center] -= 0.5;
    sim.agents.push({ x: x, y: y, z: z, m: 0.5, g: 1, cells: [center], center: center, bornTick: sim.tick });
  }
}
/* 에너지 질 강등 3D 아레나(step-0049 *실활성* — E 에 연속 질 축 q 를 더해 둘째 법칙으로 단조 강등) — step-0049/verify.js qArena() 와 동일 상수.
 * D=8 voxel 상자, 균일 E(noise 섭동) + degrade 만 on(kDegrade=0.05·qInit0=1.0, 다른 법칙 다 off → E 안 움직임). 골든 전 키(kDegrade=0)는 q 미작동·미해시 → 이 qual@ 가 degrade 본문(q 단조 강등·해시 산입)을 동결한다(드리프트 가드).
 * step-0050~ 회귀 앵커: 새 노브(kDegrade)=0 이면 q 미해시(과거 골든 전부 불변). */
function qualArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 1.0, noise: 0.5, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kDegrade: 0.05, qInit0: 1.0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0
  }, extra || {});
}
/* 별 질 생산 3D 아레나(step-0050 V? *실활성* — 별[핵융합]이 고질 E 를 생산해 둘째 법칙 식음에 맞섬 → 질 구배 창발) — step-0050/verify.js starqArena() 와 동일 상수.
 * sunArena(별 부력 상승·z=0 R 핵서 점화·高z 에서 방출) 위에 degrade(kDegrade=0.05·*qInit0=0 냉각 베이스라인* → 별이 유일한 질 source) + kStarQual=1(주입 E 고질) 을 켠다.
 * qual@(kStarQual=0·별 없음)는 별 질 블렌딩 미커버 → 이 starq@ 가 ignite 질 생산 본문(주입 칸 q 질량가중 혼합)을 동결한다(드리프트 가드). step-0051~ 회귀 앵커: 새 노브(kStarQual)=0 이면 q 미접촉(과거 골든 전부 불변). */
function starqArena(extra) {
  return sunArena(Object.assign({ kDegrade: 0.05, qInit0: 0, kStarQual: 1 }, extra || {}));
}
/* q advection 3D 아레나(step-0051 V? *실활성* — 질이 gravity 하향 유출에 동승 → 침강 hot plume) — step-0051/verify.js qadvArena()/seedQTop() 와 동일 상수.
 * D=8 voxel 상자, 천장(z=D−1) 평면에 고질 E 블록(seedQTop) + gravity(kGravity=0.3, 하향 침전) + degrade(kDegrade=0.01·질 축 alive) + kQAdvect=1(질 동승) — 확산·별·생명 다 off(순수 하향 수송). qInit0=0(냉각 — 천장 블록만 고질).
 * starq@/qual@(kQAdvect=0)는 advection 미커버 → 이 qadv@ 가 gravity 질 동승 본문(하강 E 가 제 질을 데리고 내려감)을 동결한다(드리프트 가드). step-0052~ 회귀 앵커: 새 노브(kQAdvect)=0 이면 q 미접촉(과거 골든 전부 불변). */
function qadvArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.3, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 1
  }, extra || {});
}
function seedQTop(sim) {   // 천장(z=D−1) 평면에 고질 E 블록 — gravity 가 아래로 침전시키며 advection 이 질을 데리고 내려간다. q 축 alive(qInit=true).
  var p = sim.p, WH = p.W * p.H, top = (p.D - 1) * WH, k;
  for (k = 0; k < WH; k++) { sim.E[top + k] = 10; sim.E0 += 10; sim.q[top + k] = 1; }
  sim.qInit = true;
}
/* 질-구배 주화성 2D 아레나(step-0052 *실활성* — 생명이 *질 구배*[엑서지]를 따라 오른다, 슈뢰딩거 낙차) — step-0052/verify.js qtaxArena()/seedQHill 와 동일 상수.
 * 평탄 E=1(noise 0·kL 0·drive off — E 가 안 변해 *유일한* 방향 신호가 q) + 중앙(32,32) 방사형 고질 q 원뿔(seedQHill) + degrade(질 축 alive) + 생명 3×3(중심 밖) + kQTaxis=5(질 추종).
 * 골든 전 키(kQTaxis=0)는 *순수 E* 주화성(q 미참조)이라 질-구배 추종 미커버 → 이 키가 attr() 질 가중 끌개 본문(생명이 q 따라 모임·agent.x/y 해시)을 동결(드리프트 가드). step-0053~ 회귀 앵커: 새 노브(kQTaxis)=0 이면 attr=E(순수 E·바이트 동일). */
function qtaxArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: true, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 5
  }, extra || {});
}
function seedQHill(sim) {   // 평탄 E=1 + 중앙(32,32) 방사형 고질 q 원뿔(반경 RQ 내 선형) + 생명 3×3(중심서 ~17칸 — 원뿔 안). q 축 alive.
  var p = sim.p, W = p.W, H = p.H, N = W * H, E = sim.E, q = sim.q, cx = 32, cy = 32, RQ = 24, qHi = 0.95, qLo = 0.05, i, x, y;
  for (i = 0; i < N; i++) { E[i] = 1; sim.E0 += 1; }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var dx = Math.min((x - cx + W) % W, (cx - x + W) % W), dy = Math.min((y - cy + H) % H, (cy - y + H) % H);   // 토러스 거리
    var d = Math.sqrt(dx * dx + dy * dy), t = d < RQ ? 1 - d / RQ : 0;     // 원뿔(반경 밖 평탄 qLo)
    q[(y * W + x)] = qLo + (qHi - qLo) * t;
  }
  sim.qInit = true;
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 18 + gy * 2);   // 중심서 ~17칸(원뿔 안) → 질 따라 중앙으로 오른다
}
/* 질-의존 대사 2D 아레나(step-0053 *실활성* — 고질 E 가 더 영양, 슈뢰딩거 낙차의 에너지론) — step-0053/verify.js qmetArena()/seedQMetab 와 동일 상수.
 * 평탄 E=2 + 두 q 구역(고질 0.9·저질 0.1, 같은 E) + 정착 생명 두 무리(고질 위 3×3·저질 위 3×3·move off — 흡수 격리) + degrade(질 축 alive) + kQMetab=5. mMaint 0(순수 m 누적).
 * qtax@ 등 전 키(kQMetab=0)는 *균일 흡수*(take=E·kL·q 무관)라 질-의존 대사 미커버 → 이 키가 metabolize 질 가중 본문(고질 무리 m↑·agent.m 해시)을 동결(드리프트 가드). step-0054~ 회귀 앵커: 새 노브(kQMetab)=0 이면 take=E·kL 바이트 동일. */
function qmetArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0.05, lifeR: 0,
    life: true, move: false, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 0, kQMetab: 5
  }, extra || {});
}
function seedQMetab(sim) {   // 평탄 E=2 + 고질(0.9)/저질(0.1) 두 구역 + 정착 생명 두 무리(고질 위 y=28·저질 위 y=36). q 축 alive.
  var p = sim.p, W = p.W, H = p.H, N = W * H, E = sim.E, q = sim.q, i, gx, gy;
  for (i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; q[i] = 0.1; }              // 평탄 E·저질 베이스
  for (var y = 24; y < 32; y++) for (var x = 16; x < 26; x++) q[y * W + x] = 0.9;   // 고질 구역(고질 무리 자리)
  sim.qInit = true;
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 26 + gy * 2);   // 고질 무리(y=26~30·q 0.9)
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 36 + gy * 2);   // 저질 무리(y=36~40·q 0.1)
}
/* 명시적 질 배출 2D 아레나(step-0054 *실활성* — 생명이 먹은 자리 residual q 강등, 엔트로피 export) — step-0054/verify.js qexpArena()/seedQMetab 와 동일.
 * qmetArena 위에 kQExport=1 만 더한다(고질 무리가 먹은 자리 q↓). qmet@ 등 전 키(kQExport=0)는 *q 미접촉*이라 배출 미커버 → 이 키가 metabolize q-쓰기 본문(먹은 자리 q 강등·q 해시)을 동결(드리프트 가드). step-0055~ 회귀 앵커: 새 노브(kQExport)=0 이면 q[idx] 미접촉(과거 골든 전부 불변). */
function qexpArena(extra) { return qmetArena(Object.assign({ kQExport: 1 }, extra || {})); }
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
/* 조밀 클론 조직 + 생식세포 계통 격리 시나리오(step-0022 sequester *실활성*) — step-0022/verify.js germArena() 와 동일 상수.
 * diffTissueScn 과 같은 조밀 단일 클론 조직이되 *위치 분화 off(kDiff=0)·계통 격리 on(kGermline=0.6)* — soma 계통이 germ kin 에게 m 전량 export 하는 코드 경로를 동결한다(드리프트 가드). */
function tgermTissueScn(extra) {
  return Object.assign({}, diffTissueScn({ kDiff: 0, kGermline: 0.6 }), extra || {});
}
/* 정착 settling 아레나(step-0023 anchor *실활성*) — step-0023/verify.js ancArena() 와 동일 상수.
 * 흩어진 단일 클론 씨앗 + 국소 정적 먹이(r=8) → 정착 off 면 잘게 흩어진 조직, on 이면 잘 먹은 kin 코어가 고착해 큰 안정 confluent 조직.
 * anchor@(전체 스택, 희소라 정착 거의 안 켜짐 — 직교성 동결)와 달리 이 tanc@ 는 정착 코드 경로(a.sessile 설정·move/adhere skip)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function ancTissueScn(extra) {
  return Object.assign({}, {
    initE: 1.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 8, rate: 0.12 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 1.0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0, kShare: 0, kPublic: 0, kGermline: 0,
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 1, geneFit0: 1, geneFitStep: 0,
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5,
    kDiff: 0.3,
    kAnchor: 1, anchorM: 0.55, anchorKin: 2
  }, extra || {});
}
/* 곡률 표면장력 rounding 아레나(step-0024 tension *실활성*) — step-0024/verify.js arena() 와 동일 상수.
 * 준균일 고-E 장에 단일 클론(tag1) 조밀 조직 + adhere·couple(R1 막) on → tension 이 *E-막*에 Young-Laplace 곡률 구배를 얹어 고-E 핵을 둥근 돔으로 모은다(coreRatio>1·coreCirc↑).
 * curv@(전체 스택, 희소라 표면장력 거의 안 켜짐 — 직교성 동결)와 달리 이 tcurv@ 는 곡률 코드 경로(E 볼록→오목 flux)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function curvTissueScn(extra) {
  return Object.assign({}, {
    initE: 2.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 44, rate: 0.02 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0,
    kL: 0.05, mMaint: 0.005, mDeath: 0.01, mSeed: 0.6, lifeR: 1,
    repro: false, mDiv: 999, divR: 1, popCap: 4096,
    move: false, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0,
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5,
    kMembrane: 0.5,
    kTension: 1, tensionGamma: 0.10
  }, extra || {});
}
/* 방향성 결정화 crystal 아레나(step-0025 anisotropy *실활성*) — step-0025/verify.js anisoArena() 와 동일 상수.
 * 균일 E 장 + 중심 유전 씨앗(tag1) → 방향성 결정화가 선호 축(가로)으로만 E→R 침착해 needle/결정축을 키운다(이방성 지수>1). 다른 법칙 다 off(순수 R 형태 격리).
 * aniso@(전체 스택, 희소라 큰 결정 드물어 방향성 약하게 켜짐 — 직교성 동결)와 달리 이 taniso@ 는 방향성 결정화 코드 경로(축 E→R 침착·태그 복사)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function anisoTissueScn(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0,
    geneTypes: 4, kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2
  }, extra || {});
}
/* 튜링 turing 아레나(step-0026 turing *실활성*) — step-0026/verify.js turArena() 와 동일 상수.
 * 균일 E(noise 로 미세 섭동) + 균일 R(0.5) 장, 다른 법칙 다 off, turing 만 on → 비확산 R 자기촉매 + 확산 E 가 균일을 깨 *반점/줄무늬*(특성 파장). kD=0.2(E 확산=긴 거리 억제)·kEvap=0.
 * turing@(전체 스택, 희소라 큰 패턴 드물어 튜링 약하게 켜짐 — 직교성 동결)와 달리 이 tturing@ 는 튜링 코드 경로(셀별 E↔R 자기촉매 침착·붕괴)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function turTissueScn(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0,
    kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5
  }, extra || {});
}
/* 덴드라이트 dendrite 아레나(step-0027 dendrite *실활성*) — step-0027/verify.js dendArena() 와 동일 상수.
 * 균일 저-E(0.8, E-제한 → 영구 빈틈) 장 + 중심 R 씨앗, 다른 법칙 다 off, dendrite 만 on → 곡률 증폭(짧은 활성) + 기하 차폐(긴 억제=E 확산)가 평탄 전선을 깨 *옆가지*(가지친 덴드라이트). kD=0.2·kEvap=0.
 * dend@(전체 스택, 희소라 큰 결정 드물어 덴드라이트 약하게 켜짐 — 직교성 동결)와 달리 이 tdend@ 는 덴드라이트 코드 경로(전선 셀 곡률 증폭 E→R 침착)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function dendTissueScn(extra) {
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
/* 덴드라이트 중심 R 씨앗(step-0027 dendrite 아레나) — (32,32) 반경 2 원판을 고체 R(1.0)로 채운다. dendrite 가 전선을 가지친다. */
function seedDendriteDisc(C, sim) { var cells = C.discCells(W, H, 32, 32, 2), R = sim.R, add = 0; for (var k = 0; k < cells.length; k++) { add += 1.0 - R[cells[k]]; R[cells[k]] = 1.0; } sim.E0 += add; }
/* 선택 투과 막 membrane 아레나(step-0028 permeate *실활성*) — step-0028/verify.js selArena() 와 동일 상수.
 * 균일 E 장 + 중심 kin 액적(tag1 8×8 블록, m0=0 마커), 다른 법칙 다 off, permeate 만 on → 액적 표면이 빈 바깥에서 E 를 능동 import(정류)해 안>바깥 농도 차를 유지. life off(에이전트는 막 마커·대사 안 함)·kEvap=0·drive off → 닫힌 장부 단순.
 * select@(전체 스택, 희소라 큰 액적 드물어 막 약하게 켜짐 — 직교성 동결)와 달리 이 tselect@ 는 막 코드 경로(표면 셀 빈 바깥 import)를 *실제로* 도는 상태를 동결한다(드리프트 가드). */
function selTissueScn(extra) {
  return Object.assign({}, {
    initE: 1.0, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0,
    kPermeate: 0.3
  }, extra || {});
}
/* 선택 투과 막 중심 kin 액적(step-0028 membrane 아레나) — (28..36)² = 8×8 tag1 블록, m0=0(마커라 E 안 깎음). permeate 가 이 표면에서 바깥 E 를 import. */
function seedSelBlock(C, sim) { for (var y = 28; y < 36; y++) for (var x = 28; x < 36; x++) { var a = C.spawnAgent(sim, x, y, 0); a.g = 1; } }
function seedBlob(C, sim, tag) { for (var y = 24; y < 40; y++) for (var x = 24; x < 40; x++) { var a = C.spawnAgent(sim, x, y); a.g = tag; } }
/* 방향성 결정화 씨앗(step-0025 crystal 아레나) — 중심에 유전 R 씨앗(tag1 disc r2) 하나. anisotropy 가 가로 축으로 needle 을 키운다. */
function seedGeneDisc(C, sim) { C.spawnGene(sim, 32, 32, 2, 1, 1.0); }
/* 튜링 균일 R 씨앗(step-0026 turing 아레나) — 격자 전체를 균일 R(amount)로 채운다(외부 질량이라 E0 보정). 대칭은 E 의 초기 noise 가 깬다 → turing 이 반점/줄무늬로 키운다. */
function seedTuringR(C, sim, amount) { var R = sim.R, add = 0, a = amount != null ? amount : 0.5; for (var i = 0; i < R.length; i++) { R[i] = a; add += a; } sim.E0 += add; }
function seedTissue(C, sim) { for (var y = 26; y < 38; y++) for (var x = 26; x < 38; x++) { var a = C.spawnAgent(sim, x, y); a.g = 1; } }
/* 흩어진 단일 클론 씨앗(step-0023 settling 아레나) — 정착이 흩어진 씨앗을 confluent 조직으로 모은다(정착 off 면 흩어진 채). */
function seedScatter(C, sim) { for (var y = 18; y < 46; y += 3) for (var x = 18; x < 46; x += 3) { var a = C.spawnAgent(sim, x, y); a.g = 1; } }
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
 *   germ@ — step-0022 생식세포 계통 격리 스택(전체 스택, 희소라 격리 거의 안 켜짐 — 직교성 동결). 0023~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   tgerm@ — step-0022 조밀 클론 조직(sequester *실활성* — soma 계통이 germ kin 에게 m 전량 export). germ@ 가 격리 본문을 거의 미커버라 이 키가 계통 코드 경로를 동결한다(드리프트 가드).
 *   anchor@ — step-0023 정착 생활사 스택(전체 스택, 희소라 정착 거의 안 켜짐 — 직교성 동결). step-0024~ 의 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   tanc@ — step-0023 정착 settling 아레나(anchor *실활성* — 흩어진 씨앗이 고착해 confluent 조직). anchor@ 가 정착 본문을 거의 미커버라 이 키가 정착 코드 경로를 동결한다(드리프트 가드).
 *   curv@ — step-0024 곡률 표면장력 스택(전체 스택, 희소라 표면장력 거의 안 켜짐 — 직교성 동결). step-0025~ 의 회귀 앵커: 새 노브 kTension=0 이면 이 해시 불변.
 *   tcurv@ — step-0024 곡률 rounding 아레나(tension *실활성* — 볼록 돌기→오목 만 재배치로 둥글림·합침). curv@ 가 곡률 본문을 거의 미커버라 이 키가 곡률 코드 경로를 동결한다(드리프트 가드).
 *   aniso@ — step-0025 방향성 결정화 스택(전체 스택, 희소라 큰 결정 드물어 방향성 거의 안 켜짐 — 직교성 동결). step-0026~ 의 회귀 앵커: 새 노브 kAniso=0 이면 이 해시 불변.
 *   taniso@ — step-0025 방향성 결정화 crystal 아레나(anisotropy *실활성* — 유전 씨앗이 선호 축으로 needle 결정축을 키움). aniso@ 가 방향성 본문을 거의 미커버라 이 키가 방향성 코드 경로를 동결한다(드리프트 가드).
 *   turing@ — step-0026 E↔R 튜링 불안정 스택(전체 스택, 희소라 큰 패턴 드물어 튜링 거의 안 켜짐 — 직교성 동결). step-0027~ 의 회귀 앵커: 새 노브 kTuring=0 이면 이 해시 불변.
 *   tturing@ — step-0026 튜링 turing 아레나(turing *실활성* — 균일이 깨져 반점/줄무늬, 비확산 R 자기촉매 + 확산 E). turing@ 가 튜링 본문을 거의 미커버라 이 키가 튜링 코드 경로를 동결한다(드리프트 가드).
 *   dend@ — step-0027 가지치기 덴드라이트 스택(전체 스택, 희소라 큰 결정 드물어 덴드라이트 거의 안 켜짐 — 직교성 동결). step-0028~ 의 회귀 앵커: 새 노브 kDendrite=0 이면 이 해시 불변.
 *   tdend@ — step-0027 덴드라이트 dendrite 아레나(dendrite *실활성* — 평탄 전선이 경계 불안정[곡률 증폭+기하 차폐]으로 옆가지). dend@ 가 덴드라이트 본문을 거의 미커버라 이 키가 덴드라이트 코드 경로를 동결한다(드리프트 가드).
 *   select@ — step-0028 선택 투과 막 스택(전체 스택, 희소라 큰 액적 드물어 막 거의 안 켜짐 — 직교성 동결). step-0029~ 의 회귀 앵커: 새 노브 kPermeate=0 이면 이 해시 불변.
 *   tselect@ — step-0028 선택 투과 막 membrane 아레나(permeate *실활성* — kin 액적 표면이 빈 바깥에서 E 능동 import·정류 → 안>바깥 농도 차). select@ 가 막 본문을 거의 미커버라 이 키가 막 코드 경로를 동결한다(드리프트 가드).
 *   zdiff@ — step-0030 6-이웃 z-확산 3D 아레나(V2 *실활성* — D=8 voxel 상자, 등방 확산[kD=kDz=0.15] + z=0 source + z 응집). 골든 D=1 키들은 z 항이 산술 0 이라 z 코드 경로 미커버 — 이 키가 z-확산·z-응집 본문을 동결한다(드리프트 가드). step-0031~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   grav@ — step-0031 중력 침전 3D 아레나(V3 *실활성* — D=8 voxel 상자, 균일 E + 중력 하향 침전[kGravity=0.2], 확산 포함 다른 법칙 다 off). zdiff@·골든 D=1 키들은 kGravity=0 이라 gravity early-return → 코드 경로 미커버 — 이 키가 z-하향 쌍 거래 본문을 동결한다(드리프트 가드). step-0032~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   support@ — step-0032 지지 침착 3D 아레나(V4 *실활성* — D=8 voxel 상자, 균일 E + 중력 + 결정화 + 지지 게이트[kSupport=1]). 골든 D=1 키들은 kSupport=0 이라 crystallize z=0 평면(2D, 비트 동일)·grav@ 는 kCryst=0 — 3D+게이트 미커버 → 이 키가 지지 게이트·3D 침착 본문을 동결한다(드리프트 가드). step-0033~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   occl@ — step-0033 R 차폐 3D 아레나(V5 *실활성* — D=8 voxel 상자, 정적 R 지면 슬랩[z=3] + 그 위 E + 중력 + 차폐 게이트[kOcclude=1]). grav@/support@ 는 kOcclude=0 이라 차폐 게이트 미커버 → 이 키가 차폐 본문(아래 R≥문턱 시 하향 차단)을 동결한다(드리프트 가드). step-0034~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   coll@ — step-0034 부유 R 붕괴 3D 아레나(V5+ *실활성* — D=8 voxel 상자, 공중 R 슬랩[z=5, 아래 빈칸] + 붕괴[kCollapse=0.2], 중력·결정화 다 off → 순수 R 낙하). grav@/support@/occl@ 는 kCollapse=0 이라 collapse early-return → 미커버 — 이 키가 R 하향 쌍 거래 본문(아래 비지지 시 낙하)을 동결한다(드리프트 가드). step-0035~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   sun@ — step-0035 별 부력 상승 3D 아레나(V5+ *실활성* — D=8 voxel 상자, z=0 R 핵[점화 신호] + 별 점화[kIgnite=1]·부력[kStarRise=1], 중력 off → 별이 떠올라 高z 에서 3D ball 방출). 골든 별 D=1 키들(std@~)은 kStarRise=0 이라 부력 미진입 → 미커버 — 이 키가 z-상승·3D ball 방출 본문을 동결한다(드리프트 가드). step-0036~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
 *   fall@ — step-0036 별 하강·일생 3D 아레나(V5+ *실활성* — sun@ 위에 하강[kStarFall=1]까지 켬 → 별이 떠올랐다 연료 쇠퇴로 가라앉으며 방출). sun@(kStarFall=0)는 하강 본문 미커버 → 이 키가 하강 중 방출(E 분포가 하강 경로 따라 내려가는 본문)을 동결한다(드리프트 가드). step-0037~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
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
  SEEDS.forEach(function (seed) {                                      // germ@ — diff@ + 생식세포 계통 격리(전체 스택, 희소라 격리 거의 안 켜짐 — 직교성 동결). step-0023 회귀 앵커.
    var a = ENG.createSim(seed, germScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['germ@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tgerm@ — 조밀 클론 조직(sequester *실활성*: soma 계통이 germ kin 에게 m 전량 export). germ@ 의 미커버를 보완해 계통 코드 경로를 동결. step-0023 회귀 앵커.
    var a = ENG.createSim(seed, tgermTissueScn()); seedTissue(ENG, a); ENG.run(a, 800);
    cur['tgerm@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // anchor@ — germ@ + 정착 생활사(전체 스택, 희소라 정착 거의 안 켜짐 — 직교성 동결). step-0024 회귀 앵커.
    var a = ENG.createSim(seed, ancScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['anchor@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tanc@ — 정착 settling 아레나(anchor *실활성*: 흩어진 씨앗이 고착해 confluent 조직). anchor@ 의 미커버를 보완해 정착 코드 경로를 동결. step-0024 회귀 앵커.
    var a = ENG.createSim(seed, ancTissueScn()); seedScatter(ENG, a); ENG.run(a, 800);
    cur['tanc@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // curv@ — anchor@ + 곡률 표면장력(전체 스택, 희소라 표면장력 거의 안 켜짐 — 직교성 동결). step-0025 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, curvScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['curv@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tcurv@ — 곡률 rounding 아레나(tension *실활성*: E-막에 Young-Laplace 곡률 구배 → 고-E 돔). curv@ 의 미커버를 보완해 곡률 코드 경로를 동결. step-0025 회귀 앵커.
    var a = ENG.createSim(seed, curvTissueScn()); seedBlob(ENG, a, 1); ENG.run(a, 800);
    cur['tcurv@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // aniso@ — curv@ + 방향성 결정화(전체 스택, 희소라 큰 결정 드물어 방향성 거의 안 켜짐 — 직교성 동결). step-0026 회귀 앵커: 새 노브 kAniso=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, anisoScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['aniso@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // taniso@ — 방향성 결정화 crystal 아레나(anisotropy *실활성*: 유전 씨앗이 선호 축으로 needle 결정축). aniso@ 의 미커버를 보완해 방향성 코드 경로를 동결. step-0026 회귀 앵커.
    var a = ENG.createSim(seed, anisoTissueScn()); seedGeneDisc(ENG, a); ENG.run(a, 20);
    cur['taniso@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // turing@ — aniso@ + E↔R 튜링 불안정(전체 스택, 희소라 큰 패턴 드물어 튜링 거의 안 켜짐 — 직교성 동결). step-0027 회귀 앵커: 새 노브 kTuring=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, turScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['turing@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tturing@ — 튜링 turing 아레나(turing *실활성*: 균일이 깨져 반점/줄무늬 — 비확산 R 자기촉매 + 확산 E). turing@ 의 미커버를 보완해 튜링 코드 경로를 동결. step-0027 회귀 앵커.
    var a = ENG.createSim(seed, turTissueScn()); seedTuringR(ENG, a, 0.5); ENG.run(a, 800);
    cur['tturing@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // dend@ — turing@ + 가지치기 덴드라이트(전체 스택, 희소라 큰 결정 드물어 덴드라이트 거의 안 켜짐 — 직교성 동결). step-0028 회귀 앵커: 새 노브 kDendrite=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, dendScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['dend@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tdend@ — 덴드라이트 dendrite 아레나(dendrite *실활성*: 평탄 전선이 경계 불안정으로 옆가지). dend@ 의 미커버를 보완해 덴드라이트 코드 경로를 동결. step-0028 회귀 앵커.
    var a = ENG.createSim(seed, dendTissueScn()); seedDendriteDisc(ENG, a); ENG.run(a, 300);
    cur['tdend@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // select@ — dend@ + 선택 투과 막(전체 스택, 희소라 큰 액적 드물어 막 거의 안 켜짐 — 직교성 동결). step-0029 회귀 앵커: 새 노브 kPermeate=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, selScn()); seedStars(ENG, a, 6); ENG.run(a, 2000); spawnStrongest(ENG, a, 5); seedGenes(ENG, a); ENG.run(a, 3000);
    cur['select@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // tselect@ — 막 membrane 아레나(permeate *실활성*: kin 액적 표면이 빈 바깥서 E 능동 import → 안>바깥). select@ 의 미커버를 보완해 막 코드 경로를 동결. step-0029 회귀 앵커.
    var a = ENG.createSim(seed, selTissueScn()); seedSelBlock(ENG, a); ENG.run(a, 300);
    cur['tselect@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // zdiff@ — 6-이웃 z-확산 3D 아레나(step-0030 V2 *실활성*: D=8 voxel 상자, 등방 확산 + z 응집). 골든 D=1 키들은 z 코드 경로 미커버라 이 키가 z-확산·z-응집 본문을 동결. step-0031~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, zdiffScn()); ENG.run(a, 600);
    cur['zdiff@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // grav@ — 중력 침전 3D 아레나(step-0031 V3 *실활성*: D=8 voxel 상자, 균일 E 가 중력으로 z=0 바닥에 침전). zdiff@(kGravity=0)는 gravity 미커버라 이 키가 z-하향 쌍 거래 본문을 동결. step-0032~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, gravArena()); ENG.run(a, 600);
    cur['grav@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // support@ — 지지 침착 3D 아레나(step-0032 V4 *실활성*: D=8 voxel, 균일 E + 중력 + 결정화 + 지지 게이트). 골든 D=1 키들(kSupport=0→z=0 침착)·grav@(kCryst=0)는 3D+게이트 미커버라 이 키가 지지 게이트·3D 침착 본문을 동결. step-0033~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, supportArena()); ENG.run(a, 600);
    cur['support@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // occl@ — R 차폐 3D 아레나(step-0033 V5 *실활성*: D=8 voxel, 정적 R 지면 슬랩[z=3] + 그 위 E + 중력 + 차폐 게이트[kOcclude=1]). grav@/support@(kOcclude=0)는 차폐 게이트 미커버라 이 키가 차폐 본문(아래 R≥문턱 시 하향 차단)을 동결. step-0034~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, occludeArena()); seedOcclude(a); ENG.run(a, 600);
    cur['occl@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // coll@ — 부유 R 붕괴 3D 아레나(step-0034 V5+ *실활성*: D=8 voxel, 공중 R 슬랩[z=5] + 붕괴[kCollapse=0.2], 중력·결정화 off → 순수 R 낙하). grav@/support@/occl@(kCollapse=0)는 collapse early-return 이라 미커버 — 이 키가 R 하향 쌍 거래 본문(아래 비지지 시 낙하)을 동결. step-0035~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, collapseArena()); seedFloatR(a); ENG.run(a, 600);
    cur['coll@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // sun@ — 별 부력 상승 3D 아레나(step-0035 V5+ *실활성*: D=8 voxel, z=0 R 핵 + 별 점화·부력[kStarRise=1], 중력 off → 별이 떠올라 高z 에서 3D ball 방출). 골든 별 D=1 키들(std@~)은 kStarRise=0 이라 부력 미진입 — 이 키가 z-상승·3D ball 방출 본문을 동결. step-0036~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, sunArena()); seedSunCore(a); ENG.run(a, 200);
    cur['sun@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // fall@ — 별 하강·일생 3D 아레나(step-0036 V5+ *실활성*: D=8 voxel, z=0 R 핵 + 별 점화·부력[kStarRise=1]·하강[kStarFall=1], 중력 off → 별이 떠올랐다 연료 쇠퇴로 가라앉으며 방출). sun@(kStarFall=0)는 하강 본문 미커버 — 이 키가 하강 중 방출(E 분포가 하강 경로 따라 내려가는 본문)을 동결. step-0037~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, fallArena()); seedSunCore(a); ENG.run(a, 200);
    cur['fall@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // rain@ — 태양빛 비 3D 아레나(step-0037 V5+ *통합*: fallArena[=0036 별 일생] 위에 중력[kGravity=0.2] 켬 → 별이 떴다 지며 高z 에서 뿌린 E 를 중력이 z=0 바닥으로 끌어내려 고이게 함=바다). 이 step 은 법칙 무변경 — fall@(kGravity=0)는 중력 미커버 → 이 키가 별빛+중력 합성 경로(高z 방출 E 가 바닥에 고임)를 동결. step-0038~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, rainArena()); seedSunCore(a); ENG.run(a, 200);
    cur['rain@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // death@ — 별 죽음·일몰사 3D 아레나(step-0038 V5+: fallArena[=0036 별 일생] 위에 일몰사[kStarSet=1] 켬 → 떴다 진 별이 z=0[지평선] 닿으면 꺼지고 R 핵서 다음 별 점화=세대 순환). fall@(kStarSet=0)는 일몰사 미커버(진 별이 z=0 서 계속 탐) → 이 키가 일몰사 본문(z=0 소멸·재점화)을 동결. step-0039~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, deathArena()); seedSunCore(a); ENG.run(a, 200);
    cur['death@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // remn@ — 죽은 별 잔해→씨앗 3D 아레나(step-0039 V5+: deathArena[=0038 일몰사] 위에 잔해 침착[kAshSeed=0.5] 켬 → 진 별이 z=0 무덤에 미연소 연료 절반을 R 씨앗으로 남김). death@(kAshSeed=0)는 잔해 미커버(흔적 없이 사라짐) → 이 키가 잔해 R 침착·E0 보정 본문을 동결. step-0040~ 회귀 앵커: 새 노브=0 이면 이 해시 불변.
    var a = ENG.createSim(seed, remnArena()); seedSunCore(a); ENG.run(a, 200);
    cur['remn@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // ring@ — 전체 에너지 고리 폐합 3D 아레나(step-0040 V5+ *통합*: rainArena[=0037 별빛→비→바다] 위에 결정화+지지[kCryst=0.05·kSupport=1] 켬 → 바다 E 가 z=0 지면/씨앗 R 로 굳어 새 별 점화 = E→별→비→바다→지면→새 별 완전 폐합). 법칙 무변경 — rain@(kCryst=0)는 결정화 미커버 → 이 키가 바다→지면/씨앗 폐합 본문을 동결. step-0041~ 회귀 앵커: 새 부품(kCryst)=0 이면 rain@ 경로(법칙 무변경).
    var a = ENG.createSim(seed, cycleArena()); seedSunCore(a); ENG.run(a, 500);
    cur['ring@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // weq@ — 풍화 평형 closed 3D 아레나(step-0041 V5+: weqArena[균일 E·중력→바다·지지 침착→지면] 위에 풍화[kWeather=0.01] 켬 → R↔E 동적 평형, 물질 동결 회피). ring@ 등(kWeather=0)은 풍화 평형 미커버 → 이 키가 풍화 R→E 재구성·물질 carrying capacity 본문을 동결(드리프트 가드). step-0042~ 회귀 앵커: 새 부품(kWeather)=0 이면 풍화 분기 no-op(법칙 무변경).
    var a = ENG.createSim(seed, weqArena()); ENG.run(a, 1000);
    cur['weq@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // mvz@ — 생명 z-이동 3D 아레나(step-0042 V5+: 정적 연직 E 구배[E(z)=1+z] + z=0 생명 9 마리 + kMoveZ=1 → 천장까지 오름). 골든 생명 키들(move 2D)은 z-주화성 미커버 → 이 키가 move 6-이웃 z-주화성·agent.z 해시 본문을 동결(드리프트 가드). step-0043~ 회귀 앵커: 새 노브(kMoveZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, mvzArena()); seedMvz(a); ENG.run(a, 30);
    cur['mvz@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // div3@ — 3D 번식 3D 아레나(step-0043 V5+: 정적 연직 E 구배[E(z)=1+z] + z=0 생명 9 마리 + kDivZ=1 → 자식이 위로 줄지어 태어나 천장까지). 골든 번식 키들(자식 z=0 평면)·mvz@(repro off)는 reproduce z-경로 미커버 → 이 키가 reproduce 6-이웃 z-출생·agent.z 해시 본문을 동결(드리프트 가드). step-0044~ 회귀 앵커: 새 노브(kDivZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, div3Arena()); seedDiv3(a); ENG.run(a, 30);
    cur['div3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // cap3@ — 3D 혼잡 3D 아레나(step-0044 V5+: 생명 수직 컬럼 3개[z=0..7] + crowd[kCrowd=0.02] + kCrowdZ=1 → 수직 적층이 z-이웃 세 혼잡세). cwd@ 등 2D 키들(z=0 평면 혼잡)은 ball 밀도·W·H·D occ 미커버 → 이 키가 3D 혼잡 본문을 동결(드리프트 가드). step-0045~ 회귀 앵커: 새 노브(kCrowdZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, capArena()); seedColumns(a); ENG.run(a, 8);
    cur['cap3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // adh3@ — 3D 차등 응집 3D 아레나(step-0045 V5+: 두 유전형 z-체커보드 블록[z∈[1,7)] + adhere[kAdhesion=1] + kAdhereZ=1 → z>0 거주 생명이 z±이웃 kin 을 세 3D 정렬). org@ 등 2D 키들(z=0 평면 정렬)은 W·H·D occ·6-이웃·26-이웃 미커버 → 이 키가 3D 정렬 본문·agent.z 해시를 동결(드리프트 가드). step-0046~ 회귀 앵커: 새 노브(kAdhereZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, sortArena()); seedKinBlock(a); ENG.run(a, 40);
    cur['adh3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // shr3@ — 3D 생물량 공유 3D 아레나(step-0046 V5+: 수직 kin 컬럼 3개[태그 1·z 짝수 안전·홀수 궁핍] + share[kShare=0.5] + kShareZ=1 → z>0 굶주린 kin 이 z±1 안전 kin 에게 구조). share@ 등 2D 키들(z=0 평면 구조)은 W·H·D occ·+z 쌍 미커버 → 이 키가 3D 구조 본문을 동결(드리프트 가드). step-0047~ 회귀 앵커: 새 노브(kShareZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, poolArena()); seedKinColumns(a); ENG.run(a, 8);
    cur['shr3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // inh3@ — 3D 생명 유전 상속 3D 아레나(step-0047 V5+: 수직 컬럼 3개[z 짝수 부모 태그 1·2·3·홀수 자식 g=0] + inherit[kInherit=1] + kInheritZ=1 → z>0 자식이 z±1 부모서 유전형 상속). gene@/life@ 등 2D 키들(z=0 평면 상속)은 GENE_VN6·z 평면 키 미커버 → 이 키가 3D 상속 본문(a.g 연직 전파)을 동결(드리프트 가드). step-0048~ 회귀 앵커: 새 노브(kInheritZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, inhArena()); seedInherit(a); ENG.run(a, 1);
    cur['inh3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // cpl3@ — 3D 막/flux 결합 3D 아레나(step-0048 V5+: 수직 kin 컬럼 3개[태그 1·z 짝수 고 E·홀수 저 E] + couple[kMembrane=0.5] + kCoupleZ=1 → z>0 kin 이 z±1 동료와 E 균등화). org@/2D couple 키들(z=0 평면 공유)은 W·H·D occ·+z 쌍·하 dc z 교정 미커버 → 이 키가 3D 막 본문(E 연직 균질화)을 동결(드리프트 가드). step-0049~ 회귀 앵커: 새 노브(kCoupleZ)=0 이면 2D 경로(비트 동일).
    var a = ENG.createSim(seed, cplArena()); seedCoupleColumns(a); ENG.run(a, 20);
    cur['cpl3@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // qual@ — 에너지 질 강등 3D 아레나(step-0049: 균일 E + degrade[kDegrade=0.05·qInit0=1.0] → q 단조 강등·엑서지 X=Σq·E 파괴). 골든 전 키(kDegrade=0)는 q 미작동·미해시 → 이 키가 degrade 본문(q 단조 강등·해시 산입)을 동결(드리프트 가드). step-0050~ 회귀 앵커: 새 노브(kDegrade)=0 이면 q 미해시(과거 골든 전부 불변).
    var a = ENG.createSim(seed, qualArena()); ENG.run(a, 30);
    cur['qual@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // starq@ — 별 질 생산 3D 아레나(step-0050: sunArena[별 점화·부력·高z 방출] + degrade[kDegrade=0.05·qInit0=0 냉각 베이스라인] + kStarQual=1 → 별이 주입한 E 만 고질[q→1]·degrade 가 나머지를 식힘 = 질 구배). qual@(kStarQual=0·별 없음)는 별 질 블렌딩 미커버 → 이 키가 ignite 질 생산 본문(주입 칸 q 질량가중 혼합)을 동결(드리프트 가드). step-0051~ 회귀 앵커: 새 노브(kStarQual)=0 이면 q 미접촉(과거 골든 전부 불변).
    var a = ENG.createSim(seed, starqArena()); seedSunCore(a); ENG.run(a, 60);
    cur['starq@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // qadv@ — q advection 3D 아레나(step-0051: 천장 고질 E 블록 + gravity[kGravity=0.3] + degrade[kDegrade=0.01] + kQAdvect=1 → 하강 E 가 제 질을 데리고 z=0 바다로 내려감=침강 hot plume). starq@/qual@(kQAdvect=0)는 advection 미커버 → 이 키가 gravity 질 동승 본문(하강 E 의 질 수송)을 동결(드리프트 가드). step-0052~ 회귀 앵커: 새 노브(kQAdvect)=0 이면 q 미접촉(과거 골든 전부 불변).
    var a = ENG.createSim(seed, qadvArena()); seedQTop(a); ENG.run(a, 30);
    cur['qadv@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // qtax@ — 질-구배 주화성 2D 아레나(step-0052: 평탄 E=1 + 방사형 고질 q 원뿔 + 생명 3×3[중심 밖] + degrade[질 축 alive] + kQTaxis=5 → 생명이 q 따라 중앙[고질]으로 모임=슈뢰딩거 낙차). qadv@ 등 전 키(kQTaxis=0)는 *순수 E* 주화성이라 질 가중 끌개 미커버 → 이 키가 attr() 본문(생명이 엑서지 따라 이동·agent.x/y 해시)을 동결(드리프트 가드). step-0053~ 회귀 앵커: 새 노브(kQTaxis)=0 이면 attr=E(바이트 동일).
    var a = ENG.createSim(seed, qtaxArena()); seedQHill(a); ENG.run(a, 24);
    cur['qtax@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // qmet@ — 질-의존 대사 2D 아레나(step-0053: 평탄 E=2 + 고질/저질 두 구역 + 정착 생명 두 무리[move off] + degrade[질 축 alive] + kQMetab=5 → 고질 위 무리가 더 많이 흡수해 m↑). qtax@ 등 전 키(kQMetab=0)는 *균일 흡수*라 질 가중 미커버 → 이 키가 metabolize 질 가중 본문(고질 무리 m↑·agent.m 해시)을 동결(드리프트 가드). step-0054~ 회귀 앵커: 새 노브(kQMetab)=0 이면 take=E·kL 바이트 동일.
    var a = ENG.createSim(seed, qmetArena()); seedQMetab(a); ENG.run(a, 12);
    cur['qmet@' + seed] = ENG.hashState(a);
  });
  SEEDS.forEach(function (seed) {                                      // qexp@ — 명시적 질 배출 2D 아레나(step-0054: qmet 셋업 + kQExport=1 → 생명이 먹은 자리 residual q 강등=엔트로피 export). qmet@ 등 전 키(kQExport=0)는 q 미접촉이라 배출 미커버 → 이 키가 metabolize q-쓰기 본문(먹은 자리 q↓·q 해시)을 동결(드리프트 가드). step-0055~ 회귀 앵커: 새 노브(kQExport)=0 이면 q[idx] 미접촉.
    var a = ENG.createSim(seed, qexpArena()); seedQMetab(a); ENG.run(a, 12);
    cur['qexp@' + seed] = ENG.hashState(a);
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
