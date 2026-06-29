// HktInfra step-0368 — 헤드리스 검증 (#57 실 데이터 평면 8: driveCluster 통합 E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdrivereal`.
//   더한 한 조각: ClusterHostDriver.driveCluster(orch,cluster,specOf) — reconcile+deliver 재생+전 존 tick 을 한 호출에(runMulti analog·#62). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostdrivereal` — z1@A(a1+move)·z2@B(b1+move) → driveCluster: 실 a1·b1 위치 == in-proc 권위(desync 0·2 host E2E)·view 산출.
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
const eq = (a, b) => a && b && a.x === b.x && a.y === b.y;

// step-0368 #57 실 데이터 평면 8 — driveCluster 통합 E2E. z1@hostA(a1+4move)·z2@hostB(b1+3move).
//   한 driveCluster 호출(reconcile+deliver+tick) 뒤 실 host.js a1·b1 위치 == in-proc orch 권위(2 host·desync 0)·view 산출>0.
async function hostdrivereal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 4; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  for (let k = 0; k < 3; k++) ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1'));
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostdrivereal (0368·#57): driveCluster 통합 E2E — 한 호출에 reconcile+deliver+tick·2 host desync 0. ==');
  console.log('seed   | a1 auth/real        | b1 auth/real        | views | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const aAuth = o.zoneEntityPos('z1', 'a1'), bAuth = o.zoneEntityPos('z2', 'b1');
    const cluster = new Cluster([]);
    let aReal = null, bReal = null, views = 0;
    try {
      await cluster.spawn();
      views = await drv.driveCluster(o, cluster, zoneSpecOf, 1);
      aReal = realPos(await cluster.rpc('hostA', { cmd: 'snapshot' }), 'z1', 'a1');
      bReal = realPos(await cluster.rpc('hostB', { cmd: 'snapshot' }), 'z2', 'b1');
    } finally { await cluster.shutdown(); }
    const ok = check(eq(aAuth, aReal) && eq(bAuth, bReal) && views > 0, `seed ${seed}: drive 위반 (a ${JSON.stringify(aAuth)}/${JSON.stringify(aReal)}·b ${JSON.stringify(bAuth)}/${JSON.stringify(bReal)}·views ${views})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(aAuth) + '/' + JSON.stringify(aReal), 19)} | ${pad(JSON.stringify(bAuth) + '/' + JSON.stringify(bReal), 19)} | ${pad(views, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdrivereal'] = hostdrivereal;
kit.ORDER.splice(1, 0, 'hostdrivereal');

(async () => { process.exit(await kit.cli(process.argv)); })();
