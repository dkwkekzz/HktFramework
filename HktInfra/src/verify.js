// HktInfra step-0397 — 헤드리스 검증 (#67 orch 이중 권위 합류 4: failover 도 orch where-view 에 write-back)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordfailwb`.
//   더한 한 조각: cluster-coord.js failover 가 _orchWriteBack 으로 orch where-view 동기. migrate(0396)+failover(0397) 둘 다 거친 뒤도 authoritiesAgree Y. placement 기반 술어 불변=0396 동치·reg 0.
//   검증: ⒜ `reg`. ⒝ `coordfailwb` — 2 host·3 zone: run(5)+migrate z1 A→B+failover hostA→hostB → authoritiesAgree **Y**·orchWhere[z3]==hostB·syncedCoherent Y·lost 1.
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

// step-0397 #67 orch 이중 권위 합류 4 — coordfailwb: run(5)+migrate z1 A→B+failover hostA→hostB → migrate+failover 둘 다 write-back → authoritiesAgree Y·orchWhere[z3]==hostB·syncedCoherent Y·lost 1.
async function coordfailwb(seeds) {
  const BASE = coordScenario();
  console.log('== coordfailwb (0397·#67): failover write-back → migrate+failover 뒤도 authoritiesAgree Y. ==');
  console.log('seed   | agree(failover 후) | orchWhere[z3] | synced | lost | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let agree = false, ow3 = '-', sc = false, lost = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      await coord.migrate('z1', 'hostA', 'hostB');                       // write-back(0396)
      await coord.failover('hostA', 'hostB');                            // write-back(0397)·z3 lost
      agree = coord.authoritiesAgree();                                  // 둘 다 합류 → Y
      ow3 = coord.orchWhere()['z3'];
      sc = await coord.syncedCoherent();
      lost = coord.lostZones.size;
    } finally { await cluster.shutdown(); }
    const ok = check(agree && ow3 === 'hostB' && sc && lost === 1, `seed ${seed}: 위반 (agree ${agree}·ow3 ${ow3}·sc ${sc}·lost ${lost})`);
    console.log(`${pad(seed, 6)} | ${pad(agree ? 'Y' : 'N', 18)} | ${pad(ow3, 13)} | ${pad(sc ? 'Y' : 'N', 6)} | ${pad(lost, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordfailwb'] = coordfailwb;
kit.ORDER.splice(1, 0, 'coordfailwb');

(async () => { process.exit(await kit.cli(process.argv)); })();
