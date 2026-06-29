// HktInfra step-0358 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 8: 실 child_process 존 인스턴스화 E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostspawnreal`.
//   더한 한 조각: ClusterHostDriver.flush(cluster, specOf) — orch zoneHost 컨테이너 spawnOne/init 명령을 *실 Cluster(child_process)* 에 집행 → 실 host.js 프로세스가 그 존을 makeActor 로 인스턴스화. orch 논리 컨테이너 → 실 OS 프로세스 존 가동 E2E.
//   검증: ⒜ `reg`(키트·드라이버 미주입·비트 동일). ⒝ `hostspawnreal` — z1@hostA: 실 host.js spawn(livePid 1)·init specs[z1]·snapshot 에 zone z1 인스턴스 존재.
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

// 실 host.js 가 makeActor('zone') 로 인스턴스화할 최소 존 spec — buildTopology zone spec 의 축약(결정론 시드=zoneId 해시).
const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });

// step-0358 #57 실 host.js OS 프로세스 spawn 8 — 실 child_process E2E. z1@hostA → orch 드라이버 spawnOne/init 을 실 Cluster 에 flush.
//   실 host.js 프로세스 spawn(livePid 1)·init(specs[z1])·snapshot 에 zone z1 인스턴스 존재 = orch 논리 컨테이너가 실 OS 프로세스 존으로 물질화.
async function hostspawnreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, clusterDriverReal: true, placementOps: OPS };
  console.log('== hostspawnreal (0358·#57): orch zoneHost → 실 host.js OS 프로세스 존 인스턴스화 E2E. ==');
  console.log('seed   | cmds       | livePid | zone z1 | kind | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 6, ...BASE });
    const drv = r.orch.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init');   // 이 proof 는 spawn+init 만(deliver 는 실 frame items 필요·후속).
    const cmdStr = drv.commands.map(c => c.op + (c.zone ? ':' + c.zone : ':' + c.host)).join(',');
    const cluster = new Cluster([]);   // 초기 host 0 — 드라이버 spawnOne 이 실 child_process 를 띄운다.
    let live = 0, zoneSnap = null, kind = '-';
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);   // spawnOne('hostA')=실 host.js·init specs[z1]=child 가 makeActor.
      live = cluster.livePids().length;
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      zoneSnap = snap && snap.snap ? snap.snap['z1'] : null;
      kind = zoneSnap ? zoneSnap.kind : '-';
    } finally { await cluster.shutdown(); }
    const ok = check(cmdStr === 'spawnOne:hostA,init:z1' && live === 1 && zoneSnap && kind === 'zone',
      `seed ${seed}: spawn 위반 (cmds ${cmdStr}·live ${live}·zone ${!!zoneSnap}·kind ${kind})`);
    console.log(`${pad(seed, 6)} | ${pad(cmdStr, 10)} | ${pad(live, 7)} | ${pad(zoneSnap ? 'Y' : 'N', 7)} | ${pad(kind, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostspawnreal'] = hostspawnreal;
kit.ORDER.splice(1, 0, 'hostspawnreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
