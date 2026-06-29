// HktInfra step-0353 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 3: clusterDriver 훅 seam)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdrive`.
//   더한 한 조각: orch _hostSet 의 spawn/despawn 지점에서 clusterDriver.onSpawn/onDespawn 호출(cluster-run.js 가 실 cluster.spawnOne/killHost 집행). OFF(드라이버 null)→호출 0·비트 동일.
//   검증: ⒜ `reg`(키트·드라이버 미부착·비트 동일). ⒝ `hostdrive` — clusterDriverRecord ON: z1@A·z2@B·drain B→C 뒤 recorder spawns==[A,B,C]·despawns==[B]·driverSpawns==hostRegisters·생애주기 정합.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0353 #57 실 host.js OS 프로세스 spawn 3 — clusterDriver 훅 seam. clusterDriverRecord ON 으로 인프로세스 recorder 부착.
//   z1@hostA·z2@hostB·hostB drain→hostC: spawn hostA·hostB·hostC, despawn hostB. recorder.spawns==[A,B,C]·despawns==[B]·driverSpawns==hostRegisters==3·driverDespawns==hostDeregisters==1·생애주기 spawn 순서 정합.
function hostdrive(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), DRAIN(3, 'hostB', ['hostA', 'hostB', 'hostC'])];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, zoneHostLifecycle: true, clusterDriverRecord: true, placementOps: OPS };
  console.log('== hostdrive (0353·#57): clusterDriver 훅 seam — _hostSet spawn/despawn 이 driver 호출(실 cluster.spawnOne/killHost 집행 이음새). ==');
  console.log('seed   | spawns    | despawns | dS | dD | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const drv = o.clusterDriver;
    const spawnsOk = drv.spawns.join(',') === 'hostA,hostB,hostC';
    const despawnsOk = drv.despawns.join(',') === 'hostB';
    const cntOk = o.driverSpawns === o.hostRegisters && o.driverSpawns === 3 && o.driverDespawns === o.hostDeregisters && o.driverDespawns === 1;
    const lcSpawns = o.hostLifecycle().filter(e => e.kind === 'spawn').map(e => e.host).join(',');
    const lcOk = lcSpawns === drv.spawns.join(',');
    const ok = check(spawnsOk && despawnsOk && cntOk && lcOk, `seed ${seed}: drive 위반 (spawns ${drv.spawns}·despawns ${drv.despawns}·dS ${o.driverSpawns}·dD ${o.driverDespawns}·lc ${lcSpawns})`);
    console.log(`${pad(seed, 6)} | ${pad(drv.spawns.join(','), 9)} | ${pad(drv.despawns.join(','), 8)} | ${pad(o.driverSpawns, 2)} | ${pad(o.driverDespawns, 2)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdrive'] = hostdrive;
kit.ORDER.splice(1, 0, 'hostdrive');

(async () => { process.exit(await kit.cli(process.argv)); })();
