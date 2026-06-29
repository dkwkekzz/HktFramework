// HktInfra step-0365 — 헤드리스 검증 (#57 실 데이터 평면 5: 실 host.js killHost + failover 재가동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostkillreal`.
//   더한 한 조각: ClusterHostDriver.failoverZone — 죽은 host 의 존을 생존 host 에 새 인스턴스 재가동(상태 소실). + 실 cluster.killHost(child_process 종료). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostkillreal` — hostA(z1+a1)·hostB(z2) → kill hostA: livePids 2→1·failover z1→hostB(새 빈 존·a1 소실)·hostB={z1,z2}.
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

// step-0365 #57 실 데이터 평면 5 — 실 killHost + failover. hostA(z1+a1)·hostB(z2) → kill hostA.
//   livePids 2→1(실 프로세스 종료)·failoverZone z1→hostB(새 빈 존·죽은 host 상태 소실·정직한 한계)·hostB snapshot={z1,z2}·z1 a1 없음.
async function hostkillreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostkillreal (0365·#57): 실 host.js killHost(child_process 종료) + failover 재가동(상태 소실). ==');
  console.log('seed   | live전 | live후 | B후 zones | a1소실 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const drv = r.orch.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'deliver');
    const cluster = new Cluster([]);
    let livePre = 0, livePost = 0, bZones = '?', a1Gone = false;
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);           // hostA(z1+a1)·hostB(z2)
      livePre = cluster.livePids().length;
      await cluster.killHost('hostA');                // 실 child_process 종료(SIGKILL·소켓 RST)
      livePost = cluster.livePids().length;
      await drv.failoverZone(cluster, 'z1', 'hostB', zoneSpecOf);   // z1 생존 host 재가동(새 빈 존)
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      bZones = sb && sb.snap ? Object.keys(sb.snap).sort().join(',') : '?';
      const zb = sb && sb.snap ? sb.snap['z1'] : null;
      a1Gone = !!zb && (!zb.ents || !zb.ents.find(([id]) => id === 'a1'));
    } finally { await cluster.shutdown(); }
    const ok = check(livePre === 2 && livePost === 1 && bZones === 'z1,z2' && a1Gone,
      `seed ${seed}: kill 위반 (pre ${livePre}·post ${livePost}·B ${bZones}·a1소실 ${a1Gone})`);
    console.log(`${pad(seed, 6)} | ${pad(livePre, 6)} | ${pad(livePost, 6)} | ${pad(bZones, 9)} | ${pad(a1Gone ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostkillreal'] = hostkillreal;
kit.ORDER.splice(1, 0, 'hostkillreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
