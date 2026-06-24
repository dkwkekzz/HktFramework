// HktInfra step-0249 — 헤드리스 검증 (배치 SSOT 실배선 #51 — 전 lifecycle 집행 capstone)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placecapstone`.
//   더한 한 조각: runningHosts() 질의 + 전 op(start·auto·migrate·hostdown·stop) 혼합 시퀀스가 끝나도 결정(placement)==집행(running)·drift 0·한 존 정확히 한 host(공백/중복 0)·전 op-type 발화. executed 배치 SSOT arc(0241~0249) 닫기. 미주입/OFF → 0248 비트 동일(reg). #51 실배선 9(capstone).
//   검증: ⒜ `reg`(키트). ⒝ `placecapstone`(가설) — 혼합 시퀀스 후 running 4/placed 4·drift 0·single owner·전 카운터 발화.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const H = ['hostA', 'hostB', 'hostC'];
const P = (at, z, h) => ({ at, op: { type: 'placeZone', zoneId: z, host: h } });
const A = (at, z, hosts) => ({ at, op: { type: 'placeAuto', zoneId: z, hosts } });
const M = (at, z, h) => ({ at, op: { type: 'placeMigrate', zoneId: z, toHost: h } });
const ST = (at, z) => ({ at, op: { type: 'placeStop', zoneId: z } });
const HD = (at, h, hosts) => ({ at, op: { type: 'placeHostDown', host: h, hosts } });
// 전 op 혼합: start(z1,z2)·auto(z3,z4)·migrate(z2→C)·hostC 장애(z2·z4 재가동)·stop(z1)·auto(z9).
const OPS = [P(1, 'z1', 'hostA'), P(2, 'z2', 'hostA'), A(3, 'z3', H), A(4, 'z4', H), M(5, 'z2', 'hostC'), HD(6, 'hostC', H), ST(7, 'z1'), A(8, 'z9', H)];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placecapstone(seeds) {
  console.log('== placecapstone (0249·#51 실배선 capstone): 전 lifecycle 집행 — start·auto·migrate·hostdown·stop 혼합 시퀀스 후에도 결정(placement)==집행(running)·drift 0·한 존 정확히 한 host(공백/중복 0)·전 op-type 발화. executed 배치 SSOT arc(0241~0249) 닫기. ==');
  console.log('seed   | run/placed | drift | single | hosts | rescued | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch;
    const A_ = o.runningOn('hostA'), B_ = o.runningOn('hostB'), C_ = o.runningOn('hostC');
    const single = (A_ + B_ + C_) === o.runningCount();
    // 불변: drift 0·running==placed==4·single owner·가동 host 3·전 op-type 발화(starts·rtMig·rescued·retired·hostDowns·auto)·z1 퇴역·z2 재가동(hostA).
    const ok = check(o.placementDrift() === 0 && o.runningCount() === 4 && o.placedCount() === 4 && single && o.runningHosts().size === 3 &&
      o.starts === 5 && o.runtimeMigrations === 1 && o.hostRescued === 2 && o.zonesRetired === 1 && o.hostDowns === 1 && o.autoPlacements === 3 &&
      o.runningHostOf('z1') === null && o.runningHostOf('z2') === 'hostA',
      `seed ${seed}: capstone 위반 (drift ${o.placementDrift()}·run ${o.runningCount()}·single ${single}·rescued ${o.hostRescued}·retired ${o.zonesRetired})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runningCount() + '/' + o.placedCount(), 10)} | ${pad(o.placementDrift(), 5)} | ${pad(single ? 'yes' : 'NO', 6)} | ${pad(o.runningHosts().size, 5)} | ${pad(o.hostRescued, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placecapstone'] = placecapstone;
kit.ORDER.splice(1, 0, 'placecapstone');

(async () => { process.exit(await kit.cli(process.argv)); })();
