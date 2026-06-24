// HktInfra step-0222 — 헤드리스 검증 (인스턴스 수요 자동 despawn·instanceReap)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instancereap`.
//   더한 한 조각: instanceReap{kind,target} → active(kind)>target 면 빈(occupancy 0) 인스턴스 부족분 자동 회수(탄력 축소·0215 거울). 점유 인스턴스 보호. 미주입 → 0221 비트 동일(reg). 3차 고도화 인스턴스 #2.
//   검증: ⒜ `reg`(키트). ⒝ `instancereap`(가설) — demand 4 spawn → 1개 점유 → reap target 1 → 빈 3개 회수·점유 1개 생존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const DEMAND = (at, kind, target) => ({ at, op: { type: 'instanceDemand', kind, target } });
const ROUTE = (at, player, instanceId) => ({ at, op: { type: 'instanceRoute', player, instanceId } });
const REAP = (at, kind, target) => ({ at, op: { type: 'instanceReap', kind, target } });
// demand 4 dungeon spawn(auto-1..4) → p1 을 auto-1 에 배정(점유) → reap target 1 → 빈 auto-2..4 회수·점유 auto-1 생존.
const OPS = [
  DEMAND(1, 'dungeon', 4),
  ROUTE(2, 'p1', 'dungeon-auto-1'),
  REAP(3, 'dungeon', 1),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instancereap(seeds) {
  console.log('== instancereap: 인스턴스 수요 자동 despawn(instanceReap) — active(kind)>target 면 빈(occupancy 0) 인스턴스를 부족분만큼 자동 회수(탄력 축소·0215 수요 spawn 의 거울). 점유 인스턴스는 보호(플레이어 안 쫓음). 결정론 회수 순서. 3차 고도화 인스턴스 #2. ==');
  console.log('seed   | active | reaped | auto-1 | auto-2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const inst = r.instance;
    // demand 4 → reap target 1: 점유된 auto-1 생존·빈 auto-2/3/4 회수(reaped 3·active 1).
    const ok = check(inst.activeCount() === 1 && inst.reaped === 3 && inst.isActive('dungeon-auto-1') && !inst.isActive('dungeon-auto-2') && inst.occupancyOf('dungeon-auto-1') === 1,
      `seed ${seed}: reap 위반 (active ${inst.activeCount()}·reaped ${inst.reaped}·auto-1 ${inst.isActive('dungeon-auto-1')})`);
    console.log(`${pad(seed, 6)} | ${pad(inst.activeCount(), 6)} | ${pad(inst.reaped, 6)} | ${pad(inst.isActive('dungeon-auto-1') ? 'live' : '-', 6)} | ${pad(inst.isActive('dungeon-auto-2') ? 'live' : 'reap', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 수요 4로 띄운 던전 중 점유된 auto-1 은 보호되고 빈 auto-2/3/4 만 회수(reaped 3·active 1) — 수요 하락 시 빈 인스턴스를 탄력 축소(0215 spawn 의 거울)하되 플레이어를 쫓지 않는다. 던전 수명주기 회수 절반 완성. 인스턴스 3차 고도화 #2.');
}

kit.MODES['instancereap'] = instancereap;
kit.ORDER.splice(1, 0, 'instancereap');

(async () => { process.exit(await kit.cli(process.argv)); })();
