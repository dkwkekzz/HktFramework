// HktInfra step-0375 — 헤드리스 검증 (#62 runMulti 코어 통합 5: 상주 migrate)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmigrate`.
//   더한 한 조각: cluster-coord.js migrate(zone,fromHost,toHost)=driver.migrateZone 상주 lifecycle 감쌈(상태 보존·migrations 계측). 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordmigrate` — 2 host·3 zone: run(3) 후 migrate z1 A→B → a1 상태 보존(==권위)·hostA z1 release·migrations==1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
const realPos = (snap, zone, id) => { const z = snap && snap.snap ? snap.snap[zone] : null; const e = z && z.ents ? z.ents.find(([x]) => x === id) : null; return e ? e[1] : null; };

// 공유 시나리오 빌더 — 2 host·3 zone(z1@A·z2@B·z3@A)·entity a1@z1·b1@z2 + move. #62 코디네이터 arc 공통.
function coordScenario() {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  return { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
}

// step-0375 #62 통합 5 — 상주 migrate: run 후 z1 A→B 이주 시 상태 보존(a1==권위)·hostA release·migrations 계측.
async function coordmigrate(seeds) {
  const BASE = coordScenario();
  console.log('== coordmigrate (0375·#62 통합 5): 상주 migrate — run(3) 후 z1 A→B 상태 보존·release·migrations==1 ==');
  console.log('seed   | mig a1 보존 | hostA release | migrations | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let migOk = false, released = false, migs = 0;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      const a1Auth = o.zoneEntityPos('z1', 'a1');
      await coord.migrate('z1', 'hostA', 'hostB');
      const a1B = realPos(await cluster.rpc('hostB', { cmd: 'snapshot' }), 'z1', 'a1');
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      migOk = a1B && a1Auth && a1B.x === a1Auth.x && a1B.y === a1Auth.y;
      released = !(sa && sa.snap && sa.snap['z1']);
      migs = coord.migrations;
    } finally { await cluster.shutdown(); }
    const ok = check(migOk && released && migs === 1, `seed ${seed}: migrate 위반 (mig ${migOk}·rel ${released}·n ${migs})`);
    console.log(`${pad(seed, 6)} | ${pad(migOk ? 'Y' : 'N', 11)} | ${pad(released ? 'Y' : 'N', 13)} | ${pad(migs, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmigrate'] = coordmigrate;
kit.ORDER.splice(1, 0, 'coordmigrate');

(async () => { process.exit(await kit.cli(process.argv)); })();
