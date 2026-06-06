/* 엔진 검증(headless) — 공통 엔진이 닫힌 step-0006.html 과 *같은 시뮬*을 구동하는지 증명한다.
 *
 * 시뮬 동작은 sim-core.js 에서 오고 엔진은 그 파일을 그대로 로드하므로, UI 가 결과를 바꿀 수
 *   있는 경로는 단 하나 — createSim 에 넘기는 파라미터다. 따라서 검증의 핵심은:
 *   "선언적 패널 → createSim 파라미터" 매핑이 step-0006.html 의 reset() 과 동일한가.
 *
 *   ① 파라미터 매핑 — HWS.defaultParams(panel) 이 step-0006.html reset() 의 기본 컨트롤
 *      파라미터와 정확히 일치하는가.
 *   ② 결정론 — 그 파라미터로 만든 시뮬을 같은 시드로 2회 돌려 상태 해시가 일치하는가(엔진 무관,
 *      코어 보증 재확인).
 *   ③ 회귀 — baseCost=0(기초대사비 off) 이면 baseCost=0.08 과 다른 궤적이어야(노브가 실제로 먹힘)
 *      하고, 게이트(base 체크 off)가 baseCost 를 0 으로 매핑하는지.
 *
 * 사용: node engine/validate/verify-engine.js
 */
'use strict';
var path = require('path');
var core = require(path.join(__dirname, '..', '..', 'step-0006', 'sim-core.js'));
var engine = require(path.join(__dirname, '..', 'hws-ui.js'));
var panel = require(path.join(__dirname, 'step-0006.panel.js'));

var SEEDS = [42, 7, 1234, 99, 2026];
var fails = 0;
function ok(name, cond, detail) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) fails++;
}
function eqObj(a, b) {
  var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join(',') !== kb.join(',')) return false;
  for (var i = 0; i < ka.length; i++) if (a[ka[i]] !== b[ka[i]]) return false;
  return true;
}

console.log('① 파라미터 매핑 — 패널 기본값 == step-0006.html reset() 기본 컨트롤');
/* step-0006.html reset() 이 기본 컨트롤 상태(모든 체크 on, 슬라이더 기본값)로 만드는 파라미터 */
var EXPECTED = {
  drive: true, kA: 0.45, life: true, kL: 0.05,
  repro: true, mDiv: 1.2, move: true, moveThresh: 0.02, baseCost: 0.08
};
var got = engine.defaultParams(panel);
ok('defaultParams(panel) deep-equals step-0006.html 기본 파라미터', eqObj(got, EXPECTED),
   JSON.stringify(got));

console.log('\n② 결정론 — 같은 시드 2회 → 상태 해시 일치 (200 tick)');
for (var s = 0; s < SEEDS.length; s++) {
  var a = core.createSim(SEEDS[s], got); core.run(a, 200);
  var b = core.createSim(SEEDS[s], got); core.run(b, 200);
  ok('seed ' + SEEDS[s], core.hashState(a) === core.hashState(b), core.hashState(a));
}

console.log('\n③ 회귀/게이트 — base 체크 off → baseCost 0 으로 매핑 & 궤적 분기');
/* 게이트: base 체크를 끈 패널의 defaultParams 는 baseCost=0 이어야 한다 */
var offPanel = JSON.parse(JSON.stringify(panel, function (k, v) { return typeof v === 'function' ? undefined : v; }));
(function () {
  engine.eachItem(offPanel, function (it) { if (it.id === 'base') it.def = false; });
  var offParams = engine.defaultParams(offPanel);
  ok('base off → baseCost == 0 (게이트 동작)', offParams.baseCost === 0, 'baseCost=' + offParams.baseCost);
  /* 분기: baseCost 0 vs 0.08 은 씨앗을 놓고 돌리면 다른 상태여야(노브가 실제로 먹힘) */
  var seed = 42;
  function withSeed(bc) {
    var sim = core.createSim(seed, Object.assign({}, got, { baseCost: bc }));
    core.run(sim, 50);
    var pools = core.detectPools(sim, { minE: 1.5, prom: 0.3 });
    for (var i = 0; i < Math.min(3, pools.length); i++) core.spawnAgent(sim, pools[i].x, pools[i].y);
    core.run(sim, 300);
    return sim;
  }
  var simOn = withSeed(0.08), simOff = withSeed(0.0);
  ok('baseCost 0.08 vs 0 → 다른 상태(노브가 시뮬에 반영됨)',
     core.hashState(simOn) !== core.hashState(simOff),
     'on=' + core.hashState(simOn) + ' off=' + core.hashState(simOff));
})();

console.log('\n④ 장부 — 기본 파라미터로 500 tick 후 닫힌 장부 잔차 < 1e-6');
for (var s2 = 0; s2 < SEEDS.length; s2++) {
  var sim = core.createSim(SEEDS[s2], got);
  core.run(sim, 50);
  var pools = core.detectPools(sim, { minE: 1.5, prom: 0.3 });
  for (var i = 0; i < Math.min(3, pools.length); i++) core.spawnAgent(sim, pools[i].x, pools[i].y);
  core.run(sim, 450);
  var led = core.ledger(sim);
  ok('seed ' + SEEDS[s2] + ' 잔차 ' + led.residual.toExponential(2), led.residual < 1e-6);
}

console.log('\n⑤ 3D attach — 패널 장식이 createSim 파라미터 매핑을 바꾸지 않는다 (hws-3d.js)');
/* 3D 레이어가 시뮬에 영향을 줄 수 있는 유일한 경로도 createSim 파라미터다. attach 는 view 전용
 * 체크(view3d, param 없음)와 drawHook 체이닝만 더하므로 defaultParams 가 비트 동일해야 한다. */
(function () {
  var hws3d = require(path.join(__dirname, '..', 'hws-3d.js'));
  var rows0 = panel.controls.length;
  var p3 = hws3d.attach(panel);
  ok('defaultParams(attach(panel)) == defaultParams(panel)',
     eqObj(engine.defaultParams(p3), got), JSON.stringify(engine.defaultParams(p3)));
  ok('원본 패널 불변 + view3d 행 1개 추가',
     panel.controls.length === rows0 && p3.controls.length === rows0 + 1,
     rows0 + ' → ' + p3.controls.length);
  ok('drawHook 체이닝 장착', typeof p3.drawHook === 'function');
})();

console.log('\n' + (fails === 0 ? '✅ 엔진 검증 통과 — 공통 엔진이 step-0006 을 동일 시뮬로 재현' : '❌ ' + fails + ' 건 실패'));
process.exit(fails === 0 ? 0 : 1);
