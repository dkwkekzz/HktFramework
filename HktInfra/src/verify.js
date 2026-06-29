// HktInfra step-0390 — 헤드리스 검증 (#65 양방향 동기 10·grand capstone: syncedCoherent — migrate/failover 포함 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordsyncedcap`.
//   더한 한 조각: cluster-coord.js syncedCoherent()=maxDesync0 && coordDesync0(lost 제외) && placementCoherent. #65 양방향 동기 sub-arc(0381~0390) 닫기. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordsyncedcap` — 2 host·3 zone: run(5)+migrate z1 A→B+failover hostA→hostB → syncedCoherent Y(0380 이 제외한 migrate/failover 포함)·대조로 driver.clusterDesync>0(옛 #65 버그).
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

// step-0390 #65 양방향 10·grand capstone — syncedCoherent: run(5)+migrate+failover 뒤에도 정합(0380 이 제외한 lifecycle 포함)·대조 driver.clusterDesync>0(옛 #65).
async function coordsyncedcap(seeds) {
  const BASE = coordScenario();
  console.log('== coordsyncedcap (0390·#65 grand capstone): migrate/failover 포함 양방향 정합. 0381~0390 닫기. ==');
  console.log('seed   | syncedCoherent | placecoh | coordDesync | clusterDesync(옛) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let synced = false, pc = false, cd = -1, dd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);                                                // 연속 루프(maxDesync 0)
      await coord.migrate('z1', 'hostA', 'hostB');                       // graceful 이주(a1 보존)
      await coord.failover('hostA', 'hostB');                            // hostA(z3) 장애→hostB(z3 lost)
      synced = await coord.syncedCoherent();                            // maxDesync0 && coordDesync0(lost 제외) && placementCoherent
      pc = await coord.placementCoherent();
      cd = await coord.coordDesync();
      dd = await drv.clusterDesync(o, cluster);                          // 옛 경로(orch plan stale) → 발산
    } finally { await cluster.shutdown(); }
    const ok = check(synced && pc && cd === 0 && dd > 0, `seed ${seed}: capstone 위반 (synced ${synced}·pc ${pc}·cd ${cd}·dd ${dd})`);
    console.log(`${pad(seed, 6)} | ${pad(synced ? 'Y' : 'N', 14)} | ${pad(pc ? 'Y' : 'N', 8)} | ${pad(cd, 11)} | ${pad(dd, 17)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordsyncedcap'] = coordsyncedcap;
kit.ORDER.splice(1, 0, 'coordsyncedcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
