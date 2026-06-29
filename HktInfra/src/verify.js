// HktInfra step-0376 — 헤드리스 검증 (#62 runMulti 코어 통합 6: 상주 failover)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordfailover`.
//   더한 한 조각: cluster-coord.js failover(deadHost,toHost)=killHost+죽은 host 존을 생존 host 에 재가동(driver.failoverZone·상태 소실). 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordfailover` — 2 host·3 zone: run(3) 후 failover hostA→hostB → hostA socketDead·z1·z3 hostB 재가동·a1 소실(정직한 한계)·failovers==1.
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

// step-0376 #62 통합 6 — 상주 failover: run 후 hostA 장애 시 죽은 host(socketDead)의 존을 hostB 에 재가동(상태 소실 정직).
async function coordfailover(seeds) {
  const BASE = coordScenario();
  console.log('== coordfailover (0376·#62 통합 6): 상주 failover — run(3) 후 hostA→hostB 재가동·a1 소실(정직)·failovers==1 ==');
  console.log('seed   | hostA dead | z1·z3 hostB | a1 소실 | failovers | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let dead = false, reassigned = false, lost = false, fos = 0;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.failover('hostA', 'hostB');                            // hostA 의 z1·z3 → hostB
      dead = cluster.socketDead.has('hostA');
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      reassigned = !!(sb && sb.snap && sb.snap['z1'] && sb.snap['z3']);
      lost = !realPos(sb, 'z1', 'a1');                                   // 죽은 host 상태 소실 — a1 없음(정직한 한계)
      fos = coord.failovers;
    } finally { await cluster.shutdown(); }
    const ok = check(dead && reassigned && lost && fos === 1, `seed ${seed}: failover 위반 (dead ${dead}·re ${reassigned}·lost ${lost}·n ${fos})`);
    console.log(`${pad(seed, 6)} | ${pad(dead ? 'Y' : 'N', 10)} | ${pad(reassigned ? 'Y' : 'N', 11)} | ${pad(lost ? 'Y' : 'N', 7)} | ${pad(fos, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordfailover'] = coordfailover;
kit.ORDER.splice(1, 0, 'coordfailover');

(async () => { process.exit(await kit.cli(process.argv)); })();
