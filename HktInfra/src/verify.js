// HktInfra step-0298 — 헤드리스 검증 (#9 멀티프로세스 배선 8: 직접 라우팅 데이터 평면 단일 소유 + 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdirsingle`.
//   더한 한 조각: entityDirectCoherent() 질의(entityCoherent && zoneDirStale===0 — 직접 라우팅 데이터 평면 정합 + 오라우팅 누수 0). 읽기 전용. OFF 경로 무관 → 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdirsingle`(가설) — 직접 라우팅 혼합 lifecycle(place×3·migrate·move·leave·enter) 후 entitiesSingleOwner·entityDirectCoherent·entityConserved·dir bijection·stale/miss 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

function dirMatchesRunning(gw, orch) {
  if (gw.zoneDir.size !== orch.running.size) return false;
  for (const [z, h] of orch.running) if (gw.zoneDir.get(z) !== h) return false;
  return true;
}

// step-0298 #9 멀티프로세스 배선 8 검증 — 게이트웨이 직접 라우팅 체제에서 entity 데이터 평면이 단일 소유·정합·보존.
//   place z1@A·z2@B·z3@C → 직접 enter a1·a2→z1·a3→z2·a4→z3 → migrate z1 A→C(graceful·보존) → 직접 move a1 → 직접 leave a4 → 직접 enter a5→z2.
//   → entitiesSingleOwner·entityDirectCoherent(entityCoherent && stale0)·entityConserved(total4==5−1)·dir==running(bijection)·routes7==applied7·miss0. 직접 라우팅이 churn 아래 안전.
function gwdirsingle(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'), MIG(12, 'z1', 'hostC')];
  const ENTOPS = [ENTER(6, 'z1', 'a1'), ENTER(7, 'z1', 'a2'), ENTER(8, 'z2', 'a3'), ENTER(9, 'z3', 'a4'),
    MOVE(14, 'z1', 'a1', 1, 1), LEAVE(15, 'z3', 'a4'), ENTER(16, 'z2', 'a5')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdirsingle (0298·#9 8): 직접 라우팅 데이터 평면 단일 소유+정합. 직접 enter/migrate/move/leave/enter 혼합 후 entitiesSingleOwner·entityDirectCoherent(entityCoherent && stale0)·entityConserved(total4==5−1)·dir==running·routes7==appl7·miss0. ==');
  console.log('seed   | total | single | dcoh | consv | dir== | routes | appl | stale | miss | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch, gw = r.gateway;
    const match = dirMatchesRunning(gw, o);
    const ok = check(o.entitiesSingleOwner() && o.entityDirectCoherent() && o.entityConserved() && o.totalEntities() === 4 &&
      match && gw.gatewayZoneRoutes === 7 && o.zoneDirectApplied === 7 && o.zoneDirStale === 0 && gw.gatewayZoneMisses === 0,
      `seed ${seed}: 직접 정합 위반 (single ${o.entitiesSingleOwner()}·dcoh ${o.entityDirectCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()}·dir ${match}·routes ${gw.gatewayZoneRoutes}·appl ${o.zoneDirectApplied})`);
    console.log(`${pad(seed, 6)} | ${pad(o.totalEntities(), 5)} | ${pad(o.entitiesSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.entityDirectCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(gw.gatewayZoneRoutes, 6)} | ${pad(o.zoneDirectApplied, 4)} | ${pad(o.zoneDirStale, 5)} | ${pad(gw.gatewayZoneMisses, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdirsingle'] = gwdirsingle;
kit.ORDER.splice(1, 0, 'gwdirsingle');

(async () => { process.exit(await kit.cli(process.argv)); })();
