// HktInfra step-0407 — 헤드리스 검증 (#62 runMulti 합류 6: clusterInfo() 재구성 보고)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordinfo`.
//   더한 한 조각: cluster-coord.js clusterInfo()=runMulti 반환 계약(livePids·placement·epoch·presumedDead·복원력 계측)의 코디네이터 판. 읽기 전용. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordinfo` — 2 host·3 zone: run(5)+fence(hostB)+restart(z1,hostA_r) → clusterInfo: epoch 1·presumedDead⊇[hostB]·placement 3존·restarts 1·ticks 5·livePids≥1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
const realPos = (snap, zone, id) => { const z = snap && snap.snap ? snap.snap[zone] : null; const e = z && z.ents ? z.ents.find(([x]) => x === id) : null; return e ? e[1] : null; };

// 공유 시나리오 빌더 — 2 host·3 zone(z1@A·z2@B·z3@A)·entity a1@z1·b1@z2 + move. #62 코디네이터 arc 공통.
function coordScenario() {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  return { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
}

// step-0407 #62 runMulti 합류 6 — coordinfo: run(5)+fence(hostB)+restart(z1,hostA_r) → clusterInfo: epoch 1·presumedDead⊇[hostB]·placement 3존·restarts 1·ticks 5·livePids≥1.
async function coordinfo(seeds) {
  const BASE = coordScenario();
  console.log('== coordinfo (0407·#62): clusterInfo() runMulti 호환 재구성 보고. ==');
  console.log('seed   | epoch | pd⊇hostB | zones | restarts | ticks | livePids | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let info = {};
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      coord.fence('hostB');
      await coord.restart('z1', 'hostA_r');
      info = coord.clusterInfo();
    } finally { await cluster.shutdown(); }
    const pdHas = info.presumedDead && info.presumedDead.includes('hostB');
    const zones = info.placement ? Object.keys(info.placement).length : 0;
    const ok = check(info.epoch === 1 && pdHas && zones === 3 && info.restarts === 1 && info.ticks === 5 && info.livePids.length >= 1,
      `seed ${seed}: 위반 (${JSON.stringify({ epoch: info.epoch, pd: info.presumedDead, zones, restarts: info.restarts, ticks: info.ticks, live: info.livePids.length })})`);
    console.log(`${pad(seed, 6)} | ${pad(info.epoch, 5)} | ${pad(pdHas ? 'Y' : 'N', 8)} | ${pad(zones, 5)} | ${pad(info.restarts, 8)} | ${pad(info.ticks, 5)} | ${pad(info.livePids.length, 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordinfo'] = coordinfo;
kit.ORDER.splice(1, 0, 'coordinfo');

(async () => { process.exit(await kit.cli(process.argv)); })();
