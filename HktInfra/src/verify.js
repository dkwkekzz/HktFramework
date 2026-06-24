// HktInfra step-0215 — 헤드리스 검증 (인스턴스 수요 spawn·instanceDemand·탄력 확장)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instancedemand`.
//   더한 한 조각: instanceDemand{kind,target} → active(kind)<target 면 부족분 자동 spawn(탄력 확장·결정론 auto-id). 이미 충족이면 멱등 0개. 미주입 → 0214 비트 동일(reg). 2차 고도화 인스턴스 #1.
//   검증: ⒜ `reg`(키트). ⒝ `instancedemand`(가설) — 1개서 demand(target3)→+2, 재요청 멱등 0, despawn 후 demand→+1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SPAWN = (at, instanceId, kind) => ({ at, op: { type: 'instanceSpawn', instanceId, kind } });
const DESPAWN = (at, instanceId) => ({ at, op: { type: 'instanceDespawn', instanceId } });
const DEMAND = (at, kind, target) => ({ at, op: { type: 'instanceDemand', kind, target } });
// d1 1개 → demand(target3)=+2 → 재요청 멱등 0 → d1 despawn → demand(target3)=+1.
const OPS = [
  SPAWN(2, 'd1', 'dungeon'),
  DEMAND(4, 'dungeon', 3),
  DEMAND(6, 'dungeon', 3),
  DESPAWN(8, 'd1'),
  DEMAND(10, 'dungeon', 3),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instancedemand(seeds) {
  console.log('== instancedemand: 인스턴스 수요 spawn(instanceDemand) — active(kind)<target 면 부족분 자동 spawn(탄력 확장). 이미 충족이면 멱등 0개. 수요 따라 던전 인스턴스를 채운다. 2차 고도화 인스턴스 #1. ==');
  console.log('seed   | active | demandSpawns | demands | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const ins = r.instance;
    // d1(+1) → demand3(+2=3) → demand3(멱등 0) → despawn(2) → demand3(+1=3). 최종 active 3·demandSpawns 3·demands 3.
    const ok = check(ins.activeCount() === 3 && ins.demandSpawns === 3 && ins.demands === 3 && ins.retired === 1,
      `seed ${seed}: 수요 위반 (active ${ins.activeCount()}·demandSpawns ${ins.demandSpawns}·demands ${ins.demands})`);
    console.log(`${pad(seed, 6)} | ${pad(ins.activeCount(), 6)} | ${pad(ins.demandSpawns, 12)} | ${pad(ins.demands, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → demand(target3) 가 부족분만 자동 spawn(1→3 채움·+2), 이미 충족이면 멱등 0, despawn 후 재요청은 다시 채움(+1). active 가 target 으로 탄력 수렴(수요 기반 스케일링·오케스트레이터 부하 spawn 토대). 인스턴스 2차 고도화 #1.');
}

kit.MODES['instancedemand'] = instancedemand;
kit.ORDER.splice(1, 0, 'instancedemand');

(async () => { process.exit(await kit.cli(process.argv)); })();
