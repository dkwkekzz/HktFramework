// HktInfra step-0245 — 헤드리스 검증 (배치 SSOT 실배선 #51 — reconcile capstone)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placereconcile`.
//   더한 한 조각: placementDrift() 질의 — 결정(placement)==집행(running) drift. placeExecute ON 이면 혼합 op(place+migrate+rebalance+drain) 뒤에도 drift 0(paper 표류 없음). advisory→executed arc 닫기. 미주입/OFF → 0244 비트 동일(reg). #51 실배선 5(capstone).
//   검증: ⒜ `reg`(키트). ⒝ `placereconcile`(가설) — 혼합 op 후 drift 0·runningCount==placedCount·드레인 host running 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
const MIGRATE = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
const HOSTS = ['hostA', 'hostB', 'hostC'];
// 혼합: 4존 가동 → z4 이주 → 부하 재배치 → hostB 드레인. 매 op 가 paper+executed 동시 구동 → drift 0 유지.
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), PLACE(4, 'z4', 'hostC'), MIGRATE(5, 'z4', 'hostA'), REBAL(6, HOSTS), DRAIN(7, 'hostB', HOSTS)];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placereconcile(seeds) {
  console.log('== placereconcile (0245·#51 실배선 capstone): placement(결정)↔running(집행) reconcile — 혼합 op(place+migrate+rebalance+drain) 뒤에도 placementDrift 0(결정==집행·advisory paper 표류 없음)·runningCount==placedCount·드레인한 hostB running 0. advisory→executed arc 닫기. ==');
  console.log('seed   | drift | run==placed | A | B | C | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch;
    const A = o.runningOn('hostA'), B = o.runningOn('hostB'), C = o.runningOn('hostC');
    // drift 0·집행==결정 카운트·드레인 hostB 0·총합 4(전 존 정확히 한 host).
    const ok = check(o.placementDrift() === 0 && o.runningCount() === o.placedCount() && o.runningCount() === 4 && B === 0 && (A + B + C) === 4,
      `seed ${seed}: reconcile 위반 (drift ${o.placementDrift()}·run ${o.runningCount()}·placed ${o.placedCount()}·B ${B})`);
    console.log(`${pad(seed, 6)} | ${pad(o.placementDrift(), 5)} | ${pad(o.runningCount() + '/' + o.placedCount(), 11)} | ${pad(A, 1)} | ${pad(B, 1)} | ${pad(C, 1)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placereconcile'] = placereconcile;
kit.ORDER.splice(1, 0, 'placereconcile');

(async () => { process.exit(await kit.cli(process.argv)); })();
