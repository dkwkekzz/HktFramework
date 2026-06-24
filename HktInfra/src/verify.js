// HktInfra step-0243 — 헤드리스 검증 (배치 SSOT 실배선 #51 — executed placeRebalance)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placerebalexec`.
//   더한 한 조각: placeExecute ON 이면 자동 부하 재배치(placeRebalance)가 paper 갱신마다 실 존 런타임도 _migrate(0242)로 함께 이주 → running 이 실제 균형 수렴(0223 자동 트리거의 집행 판). 미주입/OFF → 0242 비트 동일(reg). #51 실배선 3.
//   검증: ⒜ `reg`(키트). ⒝ `placerebalexec`(가설) — z1·z2·z3@hostA 가동 → rebalance → running A/B/C 각 1·rtMig 2·결정==집행.
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
const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
// z1·z2·z3@hostA 실 가동(불균형 3/0/0) → rebalance → 실 런타임 균형 1/1/1.
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), REBAL(4, ['hostA', 'hostB', 'hostC'])];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placerebalexec(seeds) {
  console.log('== placerebalexec (0243·#51 실배선): executed placeRebalance — placeExecute ON 이면 자동 부하 재배치가 paper 갱신마다 실 존 런타임도 _migrate(release+acquire)로 이주 → running 이 *실제* 균형 수렴(0223 자동 트리거의 집행 판). z1·z2·z3@hostA(3/0/0) → running A/B/C 각 1·rtMig 2·결정==집행. ==');
  console.log('seed   | A run | B run | C run | rtMig | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // 실 균형: running A/B/C 각 1·runtimeMigrations 2·결정(placement)==집행(running) 모든 존.
    const ok = check(o.runningOn('hostA') === 1 && o.runningOn('hostB') === 1 && o.runningOn('hostC') === 1 && o.runtimeMigrations === 2 && o.runningCount() === 3 &&
      ['z1', 'z2', 'z3'].every(z => o.placementOf(z) === o.runningHostOf(z)),
      `seed ${seed}: 실 재배치 위반 (A ${o.runningOn('hostA')}·B ${o.runningOn('hostB')}·C ${o.runningOn('hostC')}·rtMig ${o.runtimeMigrations})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runningOn('hostA'), 5)} | ${pad(o.runningOn('hostB'), 5)} | ${pad(o.runningOn('hostC'), 5)} | ${pad(o.runtimeMigrations, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placerebalexec'] = placerebalexec;
kit.ORDER.splice(1, 0, 'placerebalexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
