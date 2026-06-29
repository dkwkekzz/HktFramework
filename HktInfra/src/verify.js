// HktInfra step-0377 — 헤드리스 검증 (#62 runMulti 코어 통합 7: syncPlan 상주 reconcile 자가 치유)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordsync`.
//   더한 한 조각: cluster-coord.js syncPlan()=driver.reconcile(orch.hostSpawnPlan) 재호출(토폴로지 drift 자가 치유). 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordsync` — 2 host·3 zone: run(3) 후 hostA 의 z3 존 소실(zonedel drift)→ syncPlan() → z3 hostA 복원·clusterCoherent Y·acted>0.
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

// step-0377 #62 통합 7 — syncPlan 자가 치유: run 후 z3 존 소실(drift) → syncPlan() 이 orch 목표로 복원·coherent.
async function coordsync(seeds) {
  const BASE = coordScenario();
  console.log('== coordsync (0377·#62 통합 7): syncPlan 상주 reconcile — z3 drift 소실→syncPlan→z3 복원·coherent ==');
  console.log('seed   | drift gone | restored | coherent | acted | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let driftGone = false, restored = false, coherent = false, acted = 0;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await cluster.rpc('hostA', { cmd: 'zonedel', addr: 'z3' });        // 토폴로지 drift — hostA 가 z3 소실
      const s1 = await cluster.rpc('hostA', { cmd: 'snapshot' });
      driftGone = !(s1 && s1.snap && s1.snap['z3']);
      acted = await coord.syncPlan();                                    // 자가 치유 — orch 목표로 수렴
      const s2 = await cluster.rpc('hostA', { cmd: 'snapshot' });
      restored = !!(s2 && s2.snap && s2.snap['z3']);
      coherent = await drv.clusterCoherent(o, cluster);
    } finally { await cluster.shutdown(); }
    const ok = check(driftGone && restored && coherent && acted > 0, `seed ${seed}: sync 위반 (drift ${driftGone}·rest ${restored}·coh ${coherent}·acted ${acted})`);
    console.log(`${pad(seed, 6)} | ${pad(driftGone ? 'Y' : 'N', 10)} | ${pad(restored ? 'Y' : 'N', 8)} | ${pad(coherent ? 'Y' : 'N', 8)} | ${pad(acted, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordsync'] = coordsync;
kit.ORDER.splice(1, 0, 'coordsync');

(async () => { process.exit(await kit.cli(process.argv)); })();
