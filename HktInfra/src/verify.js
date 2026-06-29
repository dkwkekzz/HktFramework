// HktInfra step-0366 — 헤드리스 검증 (#57 실 데이터 평면 6: reconcile — 목표 plan→실 cluster 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostreconcilereal`.
//   더한 한 조각: ClusterHostDriver.reconcile(plan,cluster,specOf) — orch hostSpawnPlan 목표에 실 cluster 를 spawn/zoneadd/killHost 로 수렴(상태 기반·표준 reconcile). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostreconcilereal` — orch z1·z3@A·z2@B → 빈 cluster reconcile: 실 host.js hostA=[z1,z3]·hostB=[z2]·livePids 2(plan 대로 수렴).
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

// step-0366 #57 실 데이터 평면 6 — reconcile. orch z1·z3@hostA·z2@hostB → 빈 실 cluster 를 plan 으로 수렴.
//   실 host.js hostA snapshot=[z1,z3]·hostB=[z2]·livePids 2 == orch.hostSpawnPlan(목표 상태 == 실 집행).
async function hostreconcilereal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z3', 'hostA'), PLACE(3, 'z2', 'hostB')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverReal: true, placementOps: OPS };
  console.log('== hostreconcilereal (0366·#57): reconcile — orch hostSpawnPlan 목표에 실 cluster 수렴. ==');
  console.log('seed   | plan          | A zones | B zones | live | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const plan = o.hostSpawnPlan();
    const cluster = new Cluster([]);
    let aZones = '?', bZones = '?', live = 0;
    try {
      await cluster.spawn();
      await drv.reconcile(plan, cluster, zoneSpecOf);   // 빈 cluster → plan 으로 수렴
      live = cluster.livePids().length;
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      aZones = sa && sa.snap ? Object.keys(sa.snap).sort().join(',') : '?';
      bZones = sb && sb.snap ? Object.keys(sb.snap).sort().join(',') : '?';
    } finally { await cluster.shutdown(); }
    const planStr = plan.order.map(h => h + '=' + plan.hosts[h].zones.join('/')).join(' ');
    const ok = check(aZones === 'z1,z3' && bZones === 'z2' && live === 2, `seed ${seed}: reconcile 위반 (A ${aZones}·B ${bZones}·live ${live})`);
    console.log(`${pad(seed, 6)} | ${pad(planStr, 13)} | ${pad(aZones, 7)} | ${pad(bZones, 7)} | ${pad(live, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostreconcilereal'] = hostreconcilereal;
kit.ORDER.splice(1, 0, 'hostreconcilereal');

(async () => { process.exit(await kit.cli(process.argv)); })();
