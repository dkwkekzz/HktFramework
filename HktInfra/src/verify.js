// HktInfra step-0364 — 헤드리스 검증 (#57 실 데이터 평면 4: 실 host.js migrate 상태 보존)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostmigratereal`.
//   더한 한 조각: ClusterHostDriver.migrateZone — snapshot(from)→toHost zoneadd→loadstate→zonedel(from). 실 프로세스 경계를 entity 보존하며 존 이주. OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostmigratereal` — z1@A·a1 enter → migrate z1 A→B: hostB snapshot 에 z1·a1 보존(같은 위치)·hostA 에 z1 없음(release).
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

// step-0364 #57 실 데이터 평면 4 — 실 host.js migrate 상태 보존. z1@hostA·a1 enter → migrateZone z1 A→B.
//   hostB snapshot 에 z1 인스턴스 + a1 보존(같은 위치=무손실)·hostA 에 z1 없음(release+acquire 원자 교체·실 프로세스 경계 넘어 entity 보존).
async function hostmigratereal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostmigratereal (0364·#57): 실 host.js migrate — snapshot+loadstate 상태 이전·실 프로세스 경계 무손실. ==');
  console.log('seed   | A후 zones | B후 z1 a1   | preserved | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const authPos = o.zoneEntityPos('z1', 'a1');
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'deliver');
    const cluster = new Cluster([]);
    let aZones = '?', bA1 = null;
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);                                  // hostA: z1 + a1
      await drv.migrateZone(cluster, 'z1', 'hostA', 'hostB', zoneSpecOf);    // z1 A→B 상태 보존
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      aZones = sa && sa.snap ? (Object.keys(sa.snap).sort().join(',') || '(none)') : '?';
      const zb = sb && sb.snap ? sb.snap['z1'] : null;
      const ent = zb && zb.ents ? zb.ents.find(([id]) => id === 'a1') : null;
      bA1 = ent ? ent[1] : null;
    } finally { await cluster.shutdown(); }
    const preserved = bA1 && authPos && bA1.x === authPos.x && bA1.y === authPos.y;
    const ok = check(aZones === '(none)' && !!preserved, `seed ${seed}: migrate 위반 (A후 ${aZones}·B a1 ${JSON.stringify(bA1)}·auth ${JSON.stringify(authPos)})`);
    console.log(`${pad(seed, 6)} | ${pad(aZones, 9)} | ${pad(JSON.stringify(bA1), 11)} | ${pad(preserved ? 'Y' : 'N', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostmigratereal'] = hostmigratereal;
kit.ORDER.splice(1, 0, 'hostmigratereal');

(async () => { process.exit(await kit.cli(process.argv)); })();
