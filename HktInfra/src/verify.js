// HktInfra step-0221 — 헤드리스 검증 (인스턴스 플레이어 이탈·instanceLeave·3차 균형 라운드 시작)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instanceleave`.
//   더한 한 조각: instanceLeave{player} → 배정된 player 의 route 해제(occupancy 감소·권위 release·0216 acquire 짝). 미배정 player 는 멱등 no-op(leaveMisses). 미주입 → 0220 비트 동일(reg). 3차 고도화 인스턴스 #1.
//   검증: ⒜ `reg`(키트). ⒝ `instanceleave`(가설) — spawn+route 후 배정 player 이탈 → occupancy 감소·route null / 미배정 player 이탈 → miss.
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
const ROUTE = (at, player, instanceId) => ({ at, op: { type: 'instanceRoute', player, instanceId } });
const LEAVE = (at, player) => ({ at, op: { type: 'instanceLeave', player } });
// d1 spawn → p1·p2 를 d1 에 배정 → p1 이탈(occupancy 2→1·route null) → pX(미배정) 이탈(miss).
const OPS = [
  SPAWN(1, 'd1', 'dungeon'),
  ROUTE(2, 'p1', 'd1'), ROUTE(3, 'p2', 'd1'),
  LEAVE(4, 'p1'),
  LEAVE(5, 'pX'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instanceleave(seeds) {
  console.log('== instanceleave: 인스턴스 플레이어 이탈(instanceLeave) — 배정된 player 가 인스턴스를 떠나면 route 해제(occupancy 감소·권위 release·0216 acquire 짝·던전 퇴장). 미배정 player 는 멱등 no-op. 비운 인스턴스는 0222 수요 자동 despawn 의 회수 대상. 3차 고도화 인스턴스 #1·균형 라운드 시작. ==');
  console.log('seed   | d1 occ | p1 route | left | misses | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const inst = r.instance;
    // p1·p2 배정 후 p1 이탈 → d1 occupancy 1(p2 만)·p1 route null·left 1·미배정 pX 이탈 leaveMisses 1·routedCount 1.
    const ok = check(inst.occupancyOf('d1') === 1 && inst.instanceOf('p1') === null && inst.instanceOf('p2') === 'd1' && inst.left === 1 && inst.leaveMisses === 1 && inst.routedCount() === 1,
      `seed ${seed}: 이탈 위반 (d1 occ ${inst.occupancyOf('d1')}·p1 ${inst.instanceOf('p1')}·left ${inst.left}·misses ${inst.leaveMisses})`);
    console.log(`${pad(seed, 6)} | ${pad(inst.occupancyOf('d1'), 6)} | ${pad(inst.instanceOf('p1') || '-', 8)} | ${pad(inst.left, 4)} | ${pad(inst.leaveMisses, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 배정 player(p1) 이탈은 route 를 해제해 occupancy 가 2→1 로 줄고(권위 release·d1 엔 p2 만 남음), 미배정 player(pX) 이탈은 멱등 no-op(leaveMisses 1). 비운 자리는 0222 수요 자동 despawn 회수 대상 — 던전 수명주기의 축소 절반. 인스턴스 3차 고도화 #1.');
}

kit.MODES['instanceleave'] = instanceleave;
kit.ORDER.splice(1, 0, 'instanceleave');

(async () => { process.exit(await kit.cli(process.argv)); })();
