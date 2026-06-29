// HktInfra step-0367 — 헤드리스 검증 (#57 실 데이터 평면 7: 실 다중 host 격리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostisoreal`.
//   더한 한 조각: ClusterHostDriver.hostEntities — 실 host 의 존별 entity 관찰(다중 host 격리 검증). OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostisoreal` — z1@A(a1)·z2@B(b1) → 실 deliver 뒤 hostA={z1:[a1]}·hostB={z2:[b1]}·교차 누수 0(a1∉B·b1∉A).
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

// step-0367 #57 실 데이터 평면 7 — 다중 host 격리. z1@hostA(a1)·z2@hostB(b1).
//   실 deliver 뒤 hostA entities={z1:[a1]}·hostB={z2:[b1]}·교차 누수 0(a1 은 hostB 에 없고 b1 은 hostA 에 없음·실 프로세스 경계).
async function hostisoreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z2', 'b1', 'dc1')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostisoreal (0367·#57): 실 다중 host 데이터 평면 격리 — 각 host 자기 존 entity 만·교차 누수 0. ==');
  console.log('seed   | hostA       | hostB       | 누수0 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const drv = r.orch.clusterDriver;
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'deliver');
    const cluster = new Cluster([]);
    let ea = {}, eb = {};
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);
      ea = await drv.hostEntities(cluster, 'hostA');
      eb = await drv.hostEntities(cluster, 'hostB');
    } finally { await cluster.shutdown(); }
    const aOk = JSON.stringify(ea) === JSON.stringify({ z1: ['a1'] });
    const bOk = JSON.stringify(eb) === JSON.stringify({ z2: ['b1'] });
    const noLeak = !(ea.z2) && !(eb.z1) && !((ea.z1 || []).includes('b1')) && !((eb.z2 || []).includes('a1'));
    const ok = check(aOk && bOk && noLeak, `seed ${seed}: iso 위반 (A ${JSON.stringify(ea)}·B ${JSON.stringify(eb)})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(ea), 11)} | ${pad(JSON.stringify(eb), 11)} | ${pad(noLeak ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostisoreal'] = hostisoreal;
kit.ORDER.splice(1, 0, 'hostisoreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
