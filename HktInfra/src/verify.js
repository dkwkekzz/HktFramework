// HktInfra step-0354 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 4: clusterDriver onAssign/onUnassign 존 roster)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostroster`.
//   더한 한 조각: clusterDriver.onAssign(host,zone)/onUnassign(host,zone) — 존↔host 귀속(실 cluster.init/loadstate/migrate 입력). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`(키트·드라이버 미부착·비트 동일). ⒝ `hostroster` — z1@A·z2@A·z2 migrate→B 뒤 assigns==[A:z1,A:z2,B:z2]·unassigns==[A:z2]·net roster==hostSpawnPlan.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0354 #57 실 host.js OS 프로세스 spawn 4 — 존 roster 귀속. z1@hostA·z2@hostA·z2 migrate→hostB.
//   assigns==[hostA:z1, hostA:z2, hostB:z2]·unassigns==[hostA:z2]·net roster(assign−unassign)==hostSpawnPlan(hostA=[z1]·hostB=[z2])·driverAssigns−driverUnassigns==running.
function hostroster(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), MIG(3, 'z2', 'hostB')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverRecord: true, placementOps: OPS };
  console.log('== hostroster (0354·#57): clusterDriver onAssign/onUnassign 존 roster — 실 cluster.init/loadstate/migrate 입력. ==');
  console.log('seed   | assigns              | unassigns | A roster | B roster | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const aOk = drv.assigns.join(',') === 'hostA:z1,hostA:z2,hostB:z2';
    const uOk = drv.unassigns.join(',') === 'hostA:z2';
    // net roster(assign−unassign) 재구성 — 순서 무관 multiset 차(이 시나리오는 중복 없음).
    const netRoster = (h) => {
      const add = drv.assigns.filter(x => x.startsWith(h + ':')).map(x => x.split(':')[1]);
      const rem = drv.unassigns.filter(x => x.startsWith(h + ':')).map(x => x.split(':')[1]);
      return add.filter(z => !rem.includes(z)).sort();
    };
    const plan = o.hostSpawnPlan();
    const rosterOk = netRoster('hostA').join(',') === (plan.hosts.hostA ? plan.hosts.hostA.zones.join(',') : '') &&
                     netRoster('hostB').join(',') === (plan.hosts.hostB ? plan.hosts.hostB.zones.join(',') : '');
    const cntOk = (o.driverAssigns - o.driverUnassigns) === o.runningCount();
    const ok = check(aOk && uOk && rosterOk && cntOk, `seed ${seed}: roster 위반 (assigns ${drv.assigns}·unassigns ${drv.unassigns}·A ${netRoster('hostA')})`);
    console.log(`${pad(seed, 6)} | ${pad(drv.assigns.join(','), 20)} | ${pad(drv.unassigns.join(','), 9)} | ${pad(netRoster('hostA').join(','), 8)} | ${pad(netRoster('hostB').join(','), 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostroster'] = hostroster;
kit.ORDER.splice(1, 0, 'hostroster');

(async () => { process.exit(await kit.cli(process.argv)); })();
