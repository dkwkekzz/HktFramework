// HktInfra step-0361 — 헤드리스 검증 (#57 실 데이터 평면 1: 실 host.js deliver E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdeliverreal`.
//   더한 한 조각: clusterDriver.onFrame 이 frame 동봉 → flush deliver 가 실 host.js {cmd:'deliver',items} 집행 → 실 프로세스 zone.onMsg 가 entity 적용. OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hostdeliverreal` — z1@A·a1 enter → 실 host.js spawn+zoneadd+deliver 뒤 snapshot 의 a1 위치 == in-proc orch 권위(desync 0·실 소켓 데이터 평면).
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

// step-0361 #57 실 데이터 평면 1 — 실 host.js deliver. z1@hostA·a1 enter(이동 없음·deliver-only 결정론).
//   in-proc 권위 zoneEntityPos('z1','a1') == 실 host.js snapshot 의 a1 위치(enter 만 rng 소비·tick 무관) → 실 소켓 데이터 평면 desync 0.
async function hostdeliverreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostdeliverreal (0361·#57): 실 host.js deliver — entity frame 이 실 프로세스 zone.onMsg 로 적용·in-proc 권위와 desync 0. ==');
  console.log('seed   | in-proc a1  | real a1     | match | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const authPos = o.zoneEntityPos('z1', 'a1');
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'deliver');
    const cluster = new Cluster([]);
    let realPos = null;
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const zs = snap && snap.snap ? snap.snap['z1'] : null;
      const ent = zs && zs.ents ? zs.ents.find(([id]) => id === 'a1') : null;
      realPos = ent ? ent[1] : null;
    } finally { await cluster.shutdown(); }
    const match = authPos && realPos && authPos.x === realPos.x && authPos.y === realPos.y;
    const ok = check(!!match, `seed ${seed}: deliver 위반 (auth ${JSON.stringify(authPos)}·real ${JSON.stringify(realPos)})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(authPos), 11)} | ${pad(JSON.stringify(realPos), 11)} | ${pad(match ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdeliverreal'] = hostdeliverreal;
kit.ORDER.splice(1, 0, 'hostdeliverreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
