// HktInfra step-0382 — 헤드리스 검증 (#65 양방향 동기 2: coordDesync — placement 기준 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coorddesync2`.
//   더한 한 조각: cluster-coord.js coordDesync()=placement 권위로 host 조회 + orch entity 권위(host-무관) 양방향 대조. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coorddesync2` — 2 host·3 zone: run(3) 후 coordDesync==0 && == driver.clusterDesync(placement==orch plan 일 때 동치).
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

// step-0382 #65 양방향 2 — coordDesync: run(3) 후 placement 기준 desync 0 && driver.clusterDesync 와 동치(placement==orch plan).
async function coorddesync2(seeds) {
  const BASE = coordScenario();
  console.log('== coorddesync2 (0382·#65 양방향 2): coordDesync — placement 기준 정합·driver.clusterDesync 와 동치 ==');
  console.log('seed   | coordDesync | clusterDesync | 동치 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let cd = -1, dd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      cd = await coord.coordDesync();
      dd = await drv.clusterDesync(o, cluster);
    } finally { await cluster.shutdown(); }
    const ok = check(cd === 0 && cd === dd, `seed ${seed}: coordDesync 위반 (cd ${cd}·dd ${dd})`);
    console.log(`${pad(seed, 6)} | ${pad(cd, 11)} | ${pad(dd, 13)} | ${pad(cd === dd ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coorddesync2'] = coorddesync2;
kit.ORDER.splice(1, 0, 'coorddesync2');

(async () => { process.exit(await kit.cli(process.argv)); })();
