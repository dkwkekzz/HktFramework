// HktInfra step-0216 — 헤드리스 검증 (인스턴스 플레이어 라우팅·instanceRoute·배정 SSOT)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instanceroute`.
//   더한 한 조각: instanceRoute{player,instanceId} → player 를 active 인스턴스에 배정(한 player=한 인스턴스·권위 단일 소유). 죽은 인스턴스 거부·다른 인스턴스로 옮기면 release+acquire 쌍. 미주입 → 0215 비트 동일(reg). 2차 고도화 인스턴스 #2.
//   검증: ⒜ `reg`(키트). ⒝ `instanceroute`(가설) — p1·p2→d1, p3→d2, p1 재배정→d2, p4→죽은 d3 거부.
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
// d1·d2 spawn → p1·p2→d1, p3→d2 → p1 재배정 d1→d2(release+acquire) → p4→죽은 d3 거부.
const OPS = [
  SPAWN(2, 'd1', 'dungeon'), SPAWN(2, 'd2', 'dungeon'),
  ROUTE(4, 'p1', 'd1'), ROUTE(4, 'p2', 'd1'), ROUTE(5, 'p3', 'd2'),
  ROUTE(7, 'p1', 'd2'),
  ROUTE(8, 'p4', 'd3'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instanceroute(seeds) {
  console.log('== instanceroute: 인스턴스 플레이어 라우팅(instanceRoute) — player→instance 배정 SSOT(한 player=한 인스턴스·권위 단일 소유). 죽은 인스턴스 거부·재배정은 release+acquire 쌍. 2차 고도화 인스턴스 #2. ==');
  console.log('seed   | p1 | d1 occ | d2 occ | routed/reroute/reject | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const ins = r.instance;
    const p1 = ins.instanceOf('p1'), d1 = ins.occupancyOf('d1'), d2 = ins.occupancyOf('d2');
    // p1 d1→d2 재배정·p2 d1·p3 d2 → d1 occ 1(p2)·d2 occ 2(p1,p3). p4→죽은 d3 거부. routed 3·rerouted 1·reject 1·routedCount 3.
    const ok = check(p1 === 'd2' && d1 === 1 && d2 === 2 && ins.routed === 3 && ins.rerouted === 1 && ins.routeRejects === 1 && ins.instanceOf('p4') === null && ins.routedCount() === 3,
      `seed ${seed}: 라우팅 위반 (p1 ${p1}·d1 ${d1}·d2 ${d2}·routed ${ins.routed}/reroute ${ins.rerouted}/reject ${ins.routeRejects})`);
    console.log(`${pad(seed, 6)} | ${pad(p1 || '-', 4)} | ${pad(d1, 6)} | ${pad(d2, 6)} | ${pad(ins.routed + '/' + ins.rerouted + '/' + ins.routeRejects, 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → player 가 정확히 한 인스턴스에 배정되고(routedCount 3·단일 소유), 재배정은 release+acquire 쌍(p1 d1→d2·d1 occ 줄고 d2 occ 늘어), 죽은 인스턴스 라우팅은 거부(reject 1). 게이트웨이 던전 입장 라우팅 토대. 인스턴스 2차 고도화 #2.');
}

kit.MODES['instanceroute'] = instanceroute;
kit.ORDER.splice(1, 0, 'instanceroute');

(async () => { process.exit(await kit.cli(process.argv)); })();
