// HktInfra step-0360 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 10·capstone: clusterHostsCoherent + 실 다중 host E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `clusterhostcap`.
//   더한 한 조각: orch.clusterHostsCoherent() — 논리 host 컨테이너 ↔ 드라이버 계약(spawn/despawn·assign/unassign 순계)이 가동 host/존 수와 한 몸. #57 드라이버 계약 sub-arc(0351~0360) capstone.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `clusterhostcap` — ① in-proc(recorder): place+migrate+entity+egress 뒤 clusterHostsCoherent ② 실 Cluster: z1·z2@A·z3@B → 실 host.js 2개 spawn·A=[z1,z2]·B=[z3].
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

// step-0360 #57 capstone — ① in-proc 드라이버 계약 정합 ② 실 다중 host E2E.
async function clusterhostcap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  // ① in-proc(recorder) — 배치 churn(place+migrate) + entity 흐름 + egress 뒤 clusterHostsCoherent.
  const OPS1 = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), MIG(8, 'z2', 'hostB')];
  const ENT1 = [ENTER(3, 'z1', 'a1', 'dc0')]; for (let k = 0; k < 5; k++) ENT1.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  const REC = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true, downClients: 1, clusterDriverRecord: true, placementOps: OPS1, entityOps: ENT1 };
  // ② 실 Cluster — z1·z2@hostA·z3@hostB → 실 host.js 2 프로세스·A=[z1,z2]·B=[z3].
  const OPS2 = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB')];
  const REAL = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverReal: true, placementOps: OPS2 };
  console.log('== clusterhostcap (0360·#57 capstone): clusterHostsCoherent + 실 다중 host E2E. #57 드라이버 계약 0351~0360 닫기. ==');
  console.log('seed   | coherent | hosts | A존    | B존  | live | 판정');
  for (const seed of seeds) {
    // ① 정합 술어
    const r1 = run({ seed, ticks: 12, ...REC });
    const o1 = r1.orch;
    const coh = o1.clusterHostsCoherent() && o1.hostContainerCoherent() &&
      (o1.driverSpawns - o1.driverDespawns) === o1.hostCount() && (o1.driverAssigns - o1.driverUnassigns) === o1.runningCount();
    // ② 실 다중 host
    const r2 = run({ seed, ticks: 6, ...REAL });
    const drv = r2.orch.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init');
    const cluster = new Cluster([]);
    let live = 0, aZones = '-', bZones = '-';
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);
      live = cluster.livePids().length;
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      aZones = sa && sa.snap ? Object.keys(sa.snap).sort().join(',') : '-';
      bZones = sb && sb.snap ? Object.keys(sb.snap).sort().join(',') : '-';
    } finally { await cluster.shutdown(); }
    const realOk = live === 2 && aZones === 'z1,z2' && bZones === 'z3';
    const ok = check(coh && realOk, `seed ${seed}: capstone 위반 (coh ${coh}·live ${live}·A ${aZones}·B ${bZones})`);
    console.log(`${pad(seed, 6)} | ${pad(coh ? 'Y' : 'N', 8)} | ${pad(o1.hostCount(), 5)} | ${pad(aZones, 6)} | ${pad(bZones, 4)} | ${pad(live, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['clusterhostcap'] = clusterhostcap;
kit.ORDER.splice(1, 0, 'clusterhostcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
