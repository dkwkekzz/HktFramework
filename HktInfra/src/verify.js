// HktInfra step-0362 — 헤드리스 검증 (#57 실 데이터 평면 2: 실 host.js zonedel 존 제거)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzonedelreal`.
//   더한 한 조각: host.js zonedel cmd + flush stop(onUnassign)→실 host.js zonedel. 가동 중 host 에서 존 제거(다른 존 보존). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostzonedelreal` — z1·z2@A·placeStop z1 → 실 host.js spawn+zoneadd×2+zonedel z1 뒤 snapshot 에 z2 만(z1 제거).
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

// step-0362 #57 실 데이터 평면 2 — 실 host.js zonedel. z1·z2@hostA·placeStop z1 → onUnassign(hostA,z1)→flush stop→실 zonedel.
//   실 host.js snapshot 에 z2 만 남고 z1 제거(다른 존 보존)·orch running 도 z1 제거(in-proc↔실 정합).
async function hostzonedelreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), STOP(3, 'z1')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverReal: true, placementOps: OPS };
  console.log('== hostzonedelreal (0362·#57): 실 host.js zonedel — 가동 중 존 제거(다른 존 보존)·in-proc↔실 정합. ==');
  console.log('seed   | cmds                      | real zones | running | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'stop');
    const cmdStr = drv.commands.map(c => c.op + (c.zone ? ':' + c.zone : ':' + c.host)).join(',');
    const cluster = new Cluster([]);
    let realZones = '-';
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      realZones = snap && snap.snap ? Object.keys(snap.snap).sort().join(',') : '-';
    } finally { await cluster.shutdown(); }
    const runningZones = [...o.running.keys()].sort().join(',');
    const ok = check(realZones === 'z2' && runningZones === 'z2' && cmdStr === 'spawnOne:hostA,init:z1,init:z2,stop:z1',
      `seed ${seed}: zonedel 위반 (real ${realZones}·running ${runningZones}·cmds ${cmdStr})`);
    console.log(`${pad(seed, 6)} | ${pad(cmdStr, 25)} | ${pad(realZones, 10)} | ${pad(runningZones, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzonedelreal'] = hostzonedelreal;
kit.ORDER.splice(1, 0, 'hostzonedelreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
