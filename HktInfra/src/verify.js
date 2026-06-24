// HktInfra step-0242 — 헤드리스 검증 (배치 SSOT 실배선 #51 — executed placeMigrate)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placemigrexec`.
//   더한 한 조각: placeExecute ON 이면 placeMigrate 가 paper placement 갱신에 더해 실 존 런타임을 release+acquire 로 *실제 이주*(running 단일 키 원자 교체·0218 paper Map.set 의 집행 판). 미주입/OFF → 0241 비트 동일(reg). #51 실배선 2.
//   검증: ⒜ `reg`(키트). ⒝ `placemigrexec`(가설) — z1·z2@hostA 가동 → z1→hostC 이주 → running z1 hostC·z2 hostA·단일 소유·결정==집행.
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
// z1·z2@hostA 실 가동 → z1 을 hostC 로 실제 이주(release hostA + acquire hostC).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), MIGRATE(3, 'z1', 'hostC')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placemigrexec(seeds) {
  console.log('== placemigrexec (0242·#51 실배선): executed placeMigrate — placeExecute ON 이면 placeMigrate 가 실 존 런타임을 release(hostA)+acquire(hostC) 로 *실제 이주*(running 원자 교체·0218 paper 의 집행 판). z1@hostA→hostC 후 running z1 hostC·z2 hostA·한 존 정확히 한 host(중복/공백 0)·결정==집행. ==');
  console.log('seed   | z1 run | z2 run | A run | C run | rtMig | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // 실 이주: z1 hostC·z2 hostA·hostA 1개(z2)·hostC 1개(z1)·runtimeMigrations 1·결정(placement)==집행(running).
    const ok = check(o.runningHostOf('z1') === 'hostC' && o.runningHostOf('z2') === 'hostA' && o.runningOn('hostA') === 1 && o.runningOn('hostC') === 1 && o.runtimeMigrations === 1 && o.placementOf('z1') === o.runningHostOf('z1'),
      `seed ${seed}: 실 이주 위반 (z1 ${o.runningHostOf('z1')}·z2 ${o.runningHostOf('z2')}·A ${o.runningOn('hostA')}·C ${o.runningOn('hostC')}·rtMig ${o.runtimeMigrations})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runningHostOf('z1') || '-', 6)} | ${pad(o.runningHostOf('z2') || '-', 6)} | ${pad(o.runningOn('hostA'), 5)} | ${pad(o.runningOn('hostC'), 5)} | ${pad(o.runtimeMigrations, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placemigrexec'] = placemigrexec;
kit.ORDER.splice(1, 0, 'placemigrexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
