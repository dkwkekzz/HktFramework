// HktInfra step-0379 — 헤드리스 검증 (#62 runMulti 코어 통합 9: report 운영 대시보드)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordreport`.
//   더한 한 조각: cluster-coord.js report()=실 cluster+코디네이터 누계 단일 스냅샷(ticks·hosts·zones·entities·desync·migrations·failovers·coherent). 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordreport` — 2 host·3 zone: run(3) 후 report → ticks 3·hosts 2·zones 3·entities 2·desync 0·egressTotal 2·coherent Y.
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

// step-0379 #62 통합 9 — report 운영 대시보드: run(3) 후 종합 스냅샷 필드 정합(ticks·hosts·zones·entities·desync·egressTotal·coherent).
async function coordreport(seeds) {
  const BASE = coordScenario();
  console.log('== coordreport (0379·#62 통합 9): report 대시보드 — run(3) 후 {ticks·hosts·zones·entities·desync·egress·coherent} ==');
  console.log('seed   | ticks | hosts | zones | ents | desync | egr | coherent | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let rep = null;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      rep = await coord.report();
    } finally { await cluster.shutdown(); }
    const ok = check(rep && rep.ticks === 3 && rep.hosts === 2 && rep.zones === 3 && rep.entities === 2 && rep.desync === 0 && rep.maxDesync === 0 && rep.egressTotal === 2 && rep.coherent === true,
      `seed ${seed}: report 위반 (${JSON.stringify(rep)})`);
    console.log(`${pad(seed, 6)} | ${pad(rep.ticks, 5)} | ${pad(rep.hosts, 5)} | ${pad(rep.zones, 5)} | ${pad(rep.entities, 4)} | ${pad(rep.desync, 6)} | ${pad(rep.egressTotal, 3)} | ${pad(rep.coherent ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordreport'] = coordreport;
kit.ORDER.splice(1, 0, 'coordreport');

(async () => { process.exit(await kit.cli(process.argv)); })();
