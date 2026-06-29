// HktInfra step-0387 — 헤드리스 검증 (#65 양방향 동기 7: placement-aware report)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordreport2`.
//   더한 한 조각: cluster-coord.js report 가 placement 기준(coordDesync·placement host/zone·lost 계측) → migrate 후도 정합. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordreport2` — 2 host·3 zone: run(3)+migrate z1 A→B → report coherent Y·hosts2·zones3·entities2·migrations1·lost0(0379 가 못했던 migrate 후 정합).
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

// step-0387 #65 양방향 7 — placement-aware report: run(3)+migrate z1 A→B → report 가 placement 기준으로 정합(0379 가 못했던 migrate 후).
async function coordreport2(seeds) {
  const BASE = coordScenario();
  console.log('== coordreport2 (0387·#65 양방향 7): placement-aware report — migrate 후 대시보드 정합 ==');
  console.log('seed   | hosts | zones | ents | desync | mig | coherent | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let rep = null;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.migrate('z1', 'hostA', 'hostB');                       // 0379 가 제외했던 migrate
      rep = await coord.report();
    } finally { await cluster.shutdown(); }
    const ok = check(rep && rep.hosts === 2 && rep.zones === 3 && rep.entities === 2 && rep.desync === 0 && rep.migrations === 1 && rep.lost === 0 && rep.coherent === true,
      `seed ${seed}: report2 위반 (${JSON.stringify(rep)})`);
    console.log(`${pad(seed, 6)} | ${pad(rep.hosts, 5)} | ${pad(rep.zones, 5)} | ${pad(rep.entities, 4)} | ${pad(rep.desync, 6)} | ${pad(rep.migrations, 3)} | ${pad(rep.coherent ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordreport2'] = coordreport2;
kit.ORDER.splice(1, 0, 'coordreport2');

(async () => { process.exit(await kit.cli(process.argv)); })();
