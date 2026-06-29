// HktInfra step-0351 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 1: hostSpawnPlan 매니페스트)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostplan`.
//   더한 한 조각: orch.hostSpawnPlan() 읽기 전용 매니페스트 — 실 cluster 드라이버가 집행할 spawn 계약(결정론 spawn order·host→존 roster·총계). zoneHostSnapshot(0309)을 드라이버 소비 봉투로 감쌈.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `hostplan` — z1@A·z2@B·z3@A 배치 뒤 plan.hostCount==2·order==[A,B]·A=[z1,z3]·B=[z2]·zones==running·zoneHostSnapshot 정합.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0351 #57 실 host.js OS 프로세스 spawn 1 — host 컨테이너(zoneHostProc ON)가 선 뒤 hostSpawnPlan() 매니페스트가 집행 SSOT 와 정합한가.
//   z1@hostA·z2@hostB·z3@hostA: plan.hostCount==2·order 정렬·A=[z1,z3]·B=[z2]·zones 합==running 수·각 host zones==hostZones·zoneHostSnapshot bijection.
function hostplan(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, placementOps: OPS };
  console.log('== hostplan (0351·#57): hostSpawnPlan 매니페스트 정합 — 실 cluster 드라이버가 집행할 spawn 계약(host→존 roster·결정론 order·총계). ==');
  console.log('seed   | hosts | order      | A존    | B존  | zones | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const p = o.hostSpawnPlan();
    const orderOk = p.order.length === 2 && p.order[0] === 'hostA' && p.order[1] === 'hostB';
    const aOk = p.hosts.hostA && p.hosts.hostA.count === 2 && p.hosts.hostA.zones.join(',') === 'z1,z3';
    const bOk = p.hosts.hostB && p.hosts.hostB.count === 1 && p.hosts.hostB.zones.join(',') === 'z2';
    const totOk = p.hostCount === 2 && p.zones === o.runningCount() && p.zones === 3;
    const snap = o.zoneHostSnapshot();
    const biOk = JSON.stringify(p.hosts.hostA.zones) === JSON.stringify(snap.hostA) && JSON.stringify(p.hosts.hostB.zones) === JSON.stringify(snap.hostB);
    const ok = check(orderOk && aOk && bOk && totOk && biOk, `seed ${seed}: plan 위반 (hosts ${p.hostCount}·zones ${p.zones}·A ${JSON.stringify(p.hosts.hostA && p.hosts.hostA.zones)})`);
    console.log(`${pad(seed, 6)} | ${pad(p.hostCount, 5)} | ${pad(p.order.join(','), 10)} | ${pad((p.hosts.hostA ? p.hosts.hostA.zones.join(',') : '-'), 6)} | ${pad((p.hosts.hostB ? p.hosts.hostB.zones.join(',') : '-'), 4)} | ${pad(p.zones, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostplan'] = hostplan;
kit.ORDER.splice(1, 0, 'hostplan');

(async () => { process.exit(await kit.cli(process.argv)); })();
