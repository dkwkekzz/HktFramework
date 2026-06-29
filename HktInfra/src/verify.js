// HktInfra step-0388 — 헤드리스 검증 (#65 양방향 동기 8: syncPlan 이 placement 권위 기준)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordsync2`.
//   더한 한 조각: cluster-coord.js syncPlan 이 placement(실 위치)로 차분(orch plan stale 무관) → migrate 후 옳은 host 에 복원. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordsync2` — 2 host·3 zone: run(3)+migrate z3(빈 존) A→B → z3 drift(hostB zonedel)→ syncPlan → z3 hostB 복원(hostA 아님)·coordDesync 0.
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

// step-0388 #65 양방향 8 — syncPlan 이 placement 권위 기준: migrate(z3@B·빈 존) 후 z3 drift→syncPlan→z3 hostB 복원(hostA 아님)·desync 0.
async function coordsync2(seeds) {
  const BASE = coordScenario();
  console.log('== coordsync2 (0388·#65 양방향 8): syncPlan placement 기준 — migrate 후 옳은 host(hostB) 에 복원 ==');
  console.log('seed   | z3 on hostB | z3 on hostA | coordDesync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let onB = false, onA = false, cd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.migrate('z3', 'hostA', 'hostB');                       // placement z3@B(빈 존·entity 손실 confound 없음)
      await cluster.rpc('hostB', { cmd: 'zonedel', addr: 'z3' });        // drift — z3 소실(hostB)
      await coord.syncPlan();                                            // placement 기준 → hostB 에 복원(orch plan 은 hostA)
      const sb = await cluster.rpc('hostB', { cmd: 'snapshot' });
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      onB = !!(sb && sb.snap && sb.snap['z3']);
      onA = !!(sa && sa.snap && sa.snap['z3']);                          // orch plan 따랐으면 잘못 hostA 에 복원됐을 것
      cd = await coord.coordDesync();
    } finally { await cluster.shutdown(); }
    const ok = check(onB && !onA && cd === 0, `seed ${seed}: sync2 위반 (onB ${onB}·onA ${onA}·cd ${cd})`);
    console.log(`${pad(seed, 6)} | ${pad(onB ? 'Y' : 'N', 11)} | ${pad(onA ? 'Y' : 'N', 11)} | ${pad(cd, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordsync2'] = coordsync2;
kit.ORDER.splice(1, 0, 'coordsync2');

(async () => { process.exit(await kit.cli(process.argv)); })();
