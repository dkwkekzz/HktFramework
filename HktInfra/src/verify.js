// HktInfra step-0370 — 헤드리스 검증 (#57 실 데이터 평면 10·grand capstone: 실 cluster 데이터 평면 E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `clusterdatacap`.
//   더한 한 조각: ClusterHostDriver.clusterCoherent(orch,cluster)=clusterDesync==0 grand capstone. #57 실 데이터 평면 sub-arc(0361~0370) 닫기. OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `clusterdatacap` — 2 host·3 zone·entity+move: driveCluster→clusterCoherent Y(desync 0) + 실 migrate z1 A→B 상태 보존(a1==권위) + hostA z1 release. host→실 host.js OS 프로세스 데이터 평면 E2E.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
const realPos = (snap, zone, id) => { const z = snap && snap.snap ? snap.snap[zone] : null; const e = z && z.ents ? z.ents.find(([x]) => x === id) : null; return e ? e[1] : null; };

// step-0370 #57 grand capstone — 실 데이터 평면 E2E. z1@A(a1+move)·z2@B(b1+move)·z3@A.
//   ① driveCluster → clusterCoherent(desync 0·전 entity 실 host==권위) ② 실 migrate z1 A→B 상태 보존(a1==권위·hostA z1 release). host→실 host.js OS 프로세스/소켓 데이터 평면 닫힘.
async function clusterdatacap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== clusterdatacap (0370·#57 grand capstone): 실 데이터 평면 E2E — coherent + 실 migrate 상태 보존. 0361~0370 닫기. ==');
  console.log('seed   | coherent | mig a1 보존 | hostA release | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let coherent = false, migOk = false, released = false;
    try {
      await cluster.spawn();
      await drv.driveCluster(o, cluster, zoneSpecOf, 1);
      coherent = await drv.clusterCoherent(o, cluster);                  // ① 전 entity 실 host==권위(desync 0)
      const a1Auth = o.zoneEntityPos('z1', 'a1');
      await drv.migrateZone(cluster, 'z1', 'hostA', 'hostB', zoneSpecOf); // ② 실 migrate z1 A→B 상태 보존
      const a1B = realPos(await cluster.rpc('hostB', { cmd: 'snapshot' }), 'z1', 'a1');
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      migOk = a1B && a1Auth && a1B.x === a1Auth.x && a1B.y === a1Auth.y;
      released = !(sa && sa.snap && sa.snap['z1']);                      // hostA 에서 z1 release
    } finally { await cluster.shutdown(); }
    const ok = check(coherent && migOk && released, `seed ${seed}: capstone 위반 (coh ${coherent}·mig ${migOk}·rel ${released})`);
    console.log(`${pad(seed, 6)} | ${pad(coherent ? 'Y' : 'N', 8)} | ${pad(migOk ? 'Y' : 'N', 11)} | ${pad(released ? 'Y' : 'N', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['clusterdatacap'] = clusterdatacap;
kit.ORDER.splice(1, 0, 'clusterdatacap');

(async () => { process.exit(await kit.cli(process.argv)); })();
