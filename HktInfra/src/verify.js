// HktInfra step-0396 — 헤드리스 검증 (#67 orch 이중 권위 합류 3: migrate 가 orch where-view 에 write-back)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmigwb`.
//   더한 한 조각: cluster-coord.js migrate 가 _orchWriteBack 으로 orch.running/placement 동기 → migrate 후 authoritiesAgree Y. placement 기반 술어 불변=0395 동치. write-back 은 run() 후 orch 에만 작용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordmigwb` — 2 host·3 zone: run(5)+migrate z1 A→B → authoritiesAgree **Y**(0395 의 N 을 합류)·orchWhere[z1]==hostB·coordDesync 0·syncedCoherent Y.
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

// step-0396 #67 orch 이중 권위 합류 3 — coordmigwb: run(5)+migrate z1 A→B → migrate 가 orch where-view 에 write-back → authoritiesAgree Y(0395 의 N 합류)·orchWhere[z1]==hostB·coordDesync 0·syncedCoherent Y.
async function coordmigwb(seeds) {
  const BASE = coordScenario();
  console.log('== coordmigwb (0396·#67): migrate write-back → authoritiesAgree Y(합류). ==');
  console.log('seed   | agree(migrate 후) | orchWhere[z1] | coordDesync | synced | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let agree = false, ow1 = '-', cd = -1, sc = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      await coord.migrate('z1', 'hostA', 'hostB');                       // write-back ON(0396)
      agree = coord.authoritiesAgree();                                  // 합류 → Y
      ow1 = coord.orchWhere()['z1'];
      cd = await coord.coordDesync();
      sc = await coord.syncedCoherent();
    } finally { await cluster.shutdown(); }
    const ok = check(agree && ow1 === 'hostB' && cd === 0 && sc, `seed ${seed}: 위반 (agree ${agree}·ow1 ${ow1}·cd ${cd}·sc ${sc})`);
    console.log(`${pad(seed, 6)} | ${pad(agree ? 'Y' : 'N', 17)} | ${pad(ow1, 13)} | ${pad(cd, 11)} | ${pad(sc ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmigwb'] = coordmigwb;
kit.ORDER.splice(1, 0, 'coordmigwb');

(async () => { process.exit(await kit.cli(process.argv)); })();
