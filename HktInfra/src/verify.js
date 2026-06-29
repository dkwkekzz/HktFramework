// HktInfra step-0363 — 헤드리스 검증 (#57 실 데이터 평면 3: 실 host.js tick — move 적용 + egress 산출)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hosttickreal`.
//   더한 한 조각: ClusterHostDriver.tickZone — 실 host.js {cmd:'tick'} → zone.onTick(pending move 적용 + view_delta 산출)·산출 send 반환. OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`. ⒝ `hosttickreal` — z1@A·a1 enter+6 move → 실 deliver 뒤 tick: 실 a1 위치 == in-proc 권위(move 적용 후)·tick 산출 send 에 view(다운스트림 egress).
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

// step-0363 #57 실 데이터 평면 3 — 실 host.js tick. z1@hostA·a1 enter+6 move(dx,dy=1,1).
//   실 deliver(enter+move pending) 후 tickZone: 실 zone.onTick 이 pending move 적용 → 실 a1 위치 == in-proc 권위(move 후)·tick 산출 send 에 view(egress 실 출력).
async function hosttickreal(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  for (let k = 0; k < 6; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hosttickreal (0363·#57): 실 host.js tick — pending move 적용 + view_delta egress 산출. ==');
  console.log('seed   | in-proc a1   | real a1      | egress | match | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const authPos = o.zoneEntityPos('z1', 'a1');
    drv.commands = drv.commands.filter(c => c.op === 'spawnOne' || c.op === 'init' || c.op === 'deliver');
    const cluster = new Cluster([]);
    let realPos = null, egress = 0;
    try {
      await cluster.spawn();
      await drv.flush(cluster, zoneSpecOf);       // spawn+zoneadd+deliver(enter+move pending)
      const sends = await drv.tickZone(cluster, 'hostA', 'z1', 1);   // 실 onTick: move 적용 + view 산출
      egress = sends.filter(s => s.payload && /^view/.test(s.payload.type)).length;
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const zs = snap && snap.snap ? snap.snap['z1'] : null;
      const ent = zs && zs.ents ? zs.ents.find(([id]) => id === 'a1') : null;
      realPos = ent ? ent[1] : null;
    } finally { await cluster.shutdown(); }
    const match = authPos && realPos && authPos.x === realPos.x && authPos.y === realPos.y;
    const ok = check(!!match && egress > 0, `seed ${seed}: tick 위반 (auth ${JSON.stringify(authPos)}·real ${JSON.stringify(realPos)}·egress ${egress})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(authPos), 12)} | ${pad(JSON.stringify(realPos), 12)} | ${pad(egress, 6)} | ${pad(match ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hosttickreal'] = hosttickreal;
kit.ORDER.splice(1, 0, 'hosttickreal');

(async () => { process.exit(await kit.cli(process.argv)); })();
