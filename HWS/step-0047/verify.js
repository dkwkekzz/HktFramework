/* HWS step-0047 헤드리스 검증 — 3D 생명 유전 상속(inherit 의 부모 탐색을 연직축으로, VOXEL.md V5+).
 * 0043 이 번식(reproduce)을 z-일반화해 자식이 z±1(위/아래)에도 태어나고, 0045·0046 이 z>0 액적을 정렬·구조했다. 그러나 생명 유전(inherit, step-0016 = 갓 태어난 자식이 *인접 부모*에게서 유전형을 상속)은 여전히 2D였다 —
 *   부모 탐색이 GENE_VN(평면 4-이웃)·키 ny·W+nx(z=0 평면)라 z>0 자식은 *엉뚱한 z=0 평면*을 봐 제 위/아래 부모를 못 찾았다. 그래서 z>0 으로 번식한 자식은 유전형을 못 물려받고 무유전(g=0)으로 굳었다(유전 정보의 연직 전파 누수).
 *   이 step 은 inherit 의 부모 탐색을 GENE_VN→GENE_VN6(평면 4 + z±1, 6-이웃)·키를 제 z 평면 + z±1 로 *제자리 일반화*한다(0045 adhere·0046 share 와 같은 형식) + 노브 kInheritZ:
 *   z>0 자식이 제 위/아래 부모서 유전형을 상속한다 = 0043 이 z 로 번식시킨 자식이 비로소 *혈통을 잇는다*(유전 정보의 연직 전파·step-0016 의 3D 짝).
 *   회귀(이중 가드): kInheritZ=0 → 3D 블록 미진입(2D 경로·직전 step 비트 동일·z>0 자식은 키 ny·W+nx 가 z=0 평면이라 인접 부모 못 찾아 *무유전으로 굳음*) / D=1 → z 이웃 없어 2D 등가.
 *
 * 사용: node step-0047/verify.js <reg|prop|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kInheritZ=0 → z>0 자식이 2D 탐색(z=0 평면)이라 부모 못 찾아 상속 0(무유전 g=0 으로 굳음)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~shr3@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - prop     : 가설 — *z>0 자식이 제 위/아래(z±1) 부모서 유전형을 상속한다(연직 유전 전파)*. kInheritZ off vs on 비교: off 면
 *               z>0 자식이 인접 부모를 못 찾아 무유전(상속 0·g=0) → on 이면 위/아래 부모서 상속(상속>0·자식 태그 = 부모 태그, fidelity 1.0).
 *  - conserve : 보존 — 상속은 *a.g(이산 유전 태그)만* 바꿈(에너지·m 무관) — 닫힌 장부 잔차 < 1e-11(inherit 의 표현형세는 별도·이 아레나는 cost=0).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — a.g 가 상속을 반영).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 3D 생명 유전 상속 아레나 — verify-sim-engine.js inhArena()/seedInherit 와 동일 상수(골든 inh3@ 와 일치).
 * D=8 voxel. 생명 외 모든 동역학 off(이동·번식·흡수·대사세·혼잡·응집·공유 off → 오직 inherit 만 a.g 를 바꾼다). inherit 만 켜고 kInheritZ 토글.
 * 생명을 *수직 컬럼*(같은 (x,y)·z=0..D−1)으로 두되 z 짝수 = 태그 박힌 부모(g=tag·bornTick=−1)·z 홀수 = 갓 태어난 자식(g=0·bornTick=0).
 * 2D 투영으론 한 칸이라 자식이 z=0 평면 이웃(빈칸)만 봐 못 상속, 3D 론 제 z±1 부모(짝수 z)서 상속. 컬럼 3개에 서로 다른 태그(1·2·3) → fidelity(자식 태그=부모 태그) 도 검증. */
function inhArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 0,
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 4, geneFit0: 1, geneFitStep: 0, kInheritZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 수직 컬럼 3개(같은 (x,y)·z=0..D−1). z 짝수 = 부모(g=col 태그·m=1·bornTick=−1), z 홀수 = 자식(g=0·m=1·bornTick=0 → 이번 tick 상속 시도). 컬럼 간격 6 → 2D 투영서도 컬럼끼리 안 닿음(순수 연직 상속 격리). */
function seedInherit(sim) {
  var E = sim.E, D = sim.p.D, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 5; sim.E0 += 5; }
  var cols = [[16, 16, 1], [22, 22, 2], [28, 28, 3]];   // [x, y, tag]
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], tag = cols[c][2], center = z * WH + y * W + x;
    var even = (z & 1) === 0;
    sim.E[center] -= 1;                                  // 생물량 m=1 은 E 서 떼온다(닫힌 장부 — share seedKinColumns 와 같은 정신)
    sim.agents.push({ x: x, y: y, z: z, m: 1, g: even ? tag : 0, cells: [center], center: center, bornTick: even ? -1 : 0 });
  }
  return sim.agents.length;
}
/* 상속 통계: z>0 에서 *자식(짝수 아닌 z = 처음 g=0 으로 심긴 칸)* 이 유전형을 얻었나 + 부모 태그와 일치(fidelity)하나. */
function inhStats(sim) {
  var ag = sim.agents, got = 0, fid = 0, childZ = 0;
  for (var k = 0; k < ag.length; k++) {
    var a = ag[k]; if (a.z <= 0) continue; var even = (a.z & 1) === 0; if (even) continue;   // z>0 홀수 = 자식
    childZ++;
    if (a.g > 0) { got++; var pTag = (a.x === 16) ? 1 : (a.x === 22) ? 2 : 3; if (a.g === pTag) fid++; }
  }
  return { childZ: childZ, inherited: got, fidelity: got ? fid / got : 0 };
}
function build(seed, kIZ, ticks) { var s = ENG.createSim(seed, inhArena({ kInheritZ: kIZ })); seedInherit(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }
var TICKS = 1;   // 상속은 출생 tick(bornTick==tick=0)에만 — 1 tick 이면 충분.

/* ── reg: 회귀 0 — kInheritZ=0 → z>0 자식이 2D 탐색(z=0 평면)이라 부모 못 찾아 상속 0(무유전 g=0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = inhStats(a);
  return { seed: seed, inherited: st.inherited, hashA: ha, hashB: hb, pass: ha === hb && st.inherited === 0 };
}

/* ── prop: 가설 — z>0 자식이 제 위/아래(z±1) 부모서 유전형을 상속한다(연직 유전 전파). kInheritZ off vs on 비교. ── */
function prop(seed) {
  var off = build(seed, 0, TICKS), on = build(seed, 1, TICKS);
  var so = inhStats(off), sn = inhStats(on);
  return {
    seed: seed, childZ: sn.childZ, inhOff: so.inherited, inhOn: sn.inherited, fidOn: sn.fidelity,
    /* off: z>0 자식이 인접 부모 못 찾아 상속 0. on: 위/아래 부모서 상속(전 자식)·자식 태그 = 부모 태그(fidelity 1.0). */
    pass: so.inherited === 0 && sn.inherited === sn.childZ && sn.fidelity === 1
  };
}

/* ── conserve: 상속은 a.g(이산 태그)만 바꿈 — 에너지/m 무관, 닫힌 장부 잔차(이 아레나 cost=0). ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS);
  var L = ENG.ledger(s), st = inhStats(s);
  return { seed: seed, residual: L.residual, inherited: st.inherited, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(a.g 가 상속을 반영). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'inherited', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kInheritZ=0 → z>0 자식이 2D 탐색(키 ny·W+nx = z=0 평면)이라 제 위/아래 부모를 못 찾아 상속 0(무유전 g=0 으로 굳음 — 옛 2D inherit 가 z>0 자식의 혈통을 못 잇던 그 caveat)·2회 실행 비트 동일. 이 step 은 inherit *제자리 확장*(0045 adhere·0046 share 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~shr3@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'prop') {
    var rb = seeds.map(prop); table(rb, ['seed', 'childZ', 'inhOff', 'inhOn', 'fidOn', 'pass']);
    console.log('z>0 자식이 제 위/아래(z±1) 부모서 유전형을 상속한다(유전 전파의 연직축 일반화·step-0016 의 3D 짝): D=8·수직 컬럼 3개(z 짝수 = 태그 박힌 부모[태그 1·2·3]·홀수 = 갓 태어난 자식 g=0)·inherit 만 on — kInheritZ OFF 면 z>0 자식이 2D 투영상 z=0 평면 이웃(빈칸)만 봐 인접 부모를 못 찾아 상속 ' + avg(rb, 'inhOff').toFixed(2) + ' → ON 이면 위/아래(z±1) 부모서 상속 ' + avg(rb, 'inhOn').toFixed(2) + '(전 자식 ' + avg(rb, 'childZ').toFixed(2) + ' 마리)·fidelity ' + avg(rb, 'fidOn').toFixed(2) + '(자식 태그 = 부모 태그) = 0043 이 z 로 번식시킨 자식이 비로소 혈통을 잇는다. inherit 의 부모 탐색이 GENE_VN(평면 4)→GENE_VN6(평면 4 + z±1). a.g(이산 태그) 복사라 세대 무한히 건너도 비트 보존.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'inherited', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (상속은 *a.g 이산 태그만* 바꾼다 — 에너지·m·R 을 안 건드린다, 유전 정보는 장부 밖. 3D 상속 ' + avg(rc, 'inherited').toFixed(2) + ' 가 일어나도 E+R+T 불변. 표현형세[tax]는 별도 경로[이 아레나 cost=0]).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(a.g 가 3D 상속을 반영·mu=0 무변이·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'prop', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
