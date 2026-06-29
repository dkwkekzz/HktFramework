// HktInfra step-0359 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 9: 실 host 프로세스 다중 존 incremental 가동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostmultizone`.
//   더한 한 조각: host.js zoneadd cmd(가동 중 host 에 존 증분 추가·기존 보존) + flush 가 specOf init→zoneadd 로 송신 → 한 실 host.js 프로세스가 여러 존 소유. orch zoneHost 다중 존 컨테이너 → 실 OS 프로세스 다중 존.
//   검증: ⒜ `reg`(키트·드라이버 미주입·비트 동일). ⒝ `hostmultizone` — z1·z2@hostA: 실 host.js 1개 spawn·zoneadd×2·snapshot 에 z1·z2 둘 다 인스턴스.
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

// step-0359 #57 실 host.js OS 프로세스 spawn 9 — 실 host 프로세스 다중 존 incremental. z1·z2@hostA → 한 실 host.js 프로세스가 두 존 소유.
//   드라이버 commands==[spawnOne:hostA,init:z1,init:z2]·flush(specOf)→spawnOne 1회·zoneadd 2회·snapshot 에 z1·z2 둘 다 인스턴스(kind zone)·livePid 1.
async function hostmultizone(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverReal: true, placementOps: OPS };
  console.log('== hostmultizone (0359·#57): 한 실 host.js 프로세스가 여러 존 incremental 소유(zoneadd). ==');
  console.log('seed   | cmds                  | livePid | z1 | z2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 6, ...BASE });
    const drv = r.orch.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init');
    const cmdStr = drv.commands.map(c => c.op + (c.zone ? ':' + c.zone : ':' + c.host)).join(',');
    const cluster = new Cluster([]);
    let live = 0, z1 = null, z2 = null;
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);   // spawnOne(hostA) 1회 + zoneadd(z1)·zoneadd(z2) — 한 프로세스 두 존.
      live = cluster.livePids().length;
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      z1 = snap && snap.snap ? snap.snap['z1'] : null;
      z2 = snap && snap.snap ? snap.snap['z2'] : null;
    } finally { await cluster.shutdown(); }
    const ok = check(cmdStr === 'spawnOne:hostA,init:z1,init:z2' && live === 1 && z1 && z1.kind === 'zone' && z2 && z2.kind === 'zone',
      `seed ${seed}: multizone 위반 (cmds ${cmdStr}·live ${live}·z1 ${!!z1}·z2 ${!!z2})`);
    console.log(`${pad(seed, 6)} | ${pad(cmdStr, 21)} | ${pad(live, 7)} | ${pad(z1 ? 'Y' : 'N', 2)} | ${pad(z2 ? 'Y' : 'N', 2)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostmultizone'] = hostmultizone;
kit.ORDER.splice(1, 0, 'hostmultizone');

(async () => { process.exit(await kit.cli(process.argv)); })();
