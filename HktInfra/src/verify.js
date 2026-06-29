// HktInfra step-0401 — 헤드리스 검증 (#62 runMulti 합류 1·복원력: 코디네이터 epoch 펜싱 fence/presumedDead)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordfence`.
//   더한 한 조각: cluster-coord.js fence(host)=presumedDead+epoch++·tick 이 추정 사망 host 의 존 건너뜀(runMulti 펜싱의 zone cluster 판·#62 능력 합류). presumedDead 비면 0400 동치. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordfence` — 2 host·3 zone: run(5)(펜싱 0) → fence(hostB) → epoch 1·presumedDead={hostB}·이후 tick 이 z2(hostB) 건너뜀(fencedTicks↑·hostA z1/z3 만 tick).
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

// step-0401 #62 runMulti 합류 1·복원력 — coordfence: run(5)(펜싱 0) → fence(hostB) → epoch 1·presumedDead={hostB}·이후 tick 이 z2(hostB) 건너뜀(fencedTicks↑).
async function coordfence(seeds) {
  const BASE = coordScenario();
  console.log('== coordfence (0401·#62 복원력): epoch 펜싱 fence(host)·tick 이 추정 사망 host 건너뜀. ==');
  console.log('seed   | epoch | presumedDead | fencedTicks(fence 후 tick) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let ep = -1, pd = false, fbefore = -1, fafter = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);                                               // 펜싱 0(OFF 동치)
      fbefore = coord.fencedTicks;                                      // 0 기대
      coord.fence('hostB');                                            // hostB 추정 사망
      ep = coord.epoch; pd = coord.presumedDead.has('hostB');
      await coord.tick(6);                                             // hostB 존(z2) 건너뜀
      fafter = coord.fencedTicks;                                      // ≥1 기대(z2 skip)
    } finally { await cluster.shutdown(); }
    const ok = check(ep === 1 && pd && fbefore === 0 && fafter > fbefore, `seed ${seed}: 위반 (epoch ${ep}·pd ${pd}·fb ${fbefore}·fa ${fafter})`);
    console.log(`${pad(seed, 6)} | ${pad(ep, 5)} | ${pad(pd ? 'hostB' : 'none', 12)} | ${pad(`${fbefore}→${fafter}`, 26)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordfence'] = coordfence;
kit.ORDER.splice(1, 0, 'coordfence');

(async () => { process.exit(await kit.cli(process.argv)); })();
