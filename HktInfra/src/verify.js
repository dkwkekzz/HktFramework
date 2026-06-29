// HktInfra step-0369 — 헤드리스 검증 (#57 실 데이터 평면 9: clusterDesync 정합 술어)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdesyncreal`.
//   더한 한 조각: ClusterHostDriver.clusterDesync(orch,cluster) — 실 host.js entity 위치 vs in-proc 권위 불일치 수(양방향). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostdesyncreal` — driveCluster 뒤 clusterDesync==0(2 host·다중 entity 권위 재현)·일부러 권위 밖 deliver 주입하면 desync>0(술어 민감).
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

// step-0369 #57 실 데이터 평면 9 — clusterDesync 정합 술어. z1@A(a1+move)·z2@B(b1).
//   driveCluster 뒤 clusterDesync==0(전 entity 실 host 위치==권위)·일부러 권위 밖 zoneadd(z9 빈 존+딴 entity) 주입 시 desync>0(술어가 실제로 불일치를 잡음).
async function hostdesyncreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostdesyncreal (0369·#57): clusterDesync 정합 술어 — 실 host 위치 vs in-proc 권위(desync 0=수렴·민감). ==');
  console.log('seed   | desync | 주입후 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let desync = -1, injected = -1;
    try {
      await cluster.spawn();
      await drv.driveCluster(o, cluster, zoneSpecOf, 1);
      desync = await drv.clusterDesync(o, cluster);                 // 정상 → 0
      // 민감도: 실 host 에만 권위 밖 entity 주입(deliver enter ghost) → desync 1 검출
      await cluster.rpc('hostA', { cmd: 'deliver', items: [{ gi: 0, m: { to: 'z1', from: 'gw', payload: { type: 'enter', sessionId: 's:ghost', avatar: 'ghost' } } }] });
      await drv.tickZone(cluster, 'hostA', 'z1', 2);
      injected = await drv.clusterDesync(o, cluster);               // ghost 는 권위에 없음 → ≥1
    } finally { await cluster.shutdown(); }
    const ok = check(desync === 0 && injected >= 1, `seed ${seed}: desync 위반 (정상 ${desync}·주입후 ${injected})`);
    console.log(`${pad(seed, 6)} | ${pad(desync, 6)} | ${pad(injected, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdesyncreal'] = hostdesyncreal;
kit.ORDER.splice(1, 0, 'hostdesyncreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
