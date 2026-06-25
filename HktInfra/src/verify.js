// HktInfra step-0290 — 헤드리스 검증 (#56 브리지 존 데이터 평면 10·capstone: 전 데이터 평면 정합 + 보존 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneflowcap`.
//   더한 한 조각: entityFlowCoherent()(fullyCoherent+entityCoherent)·entityConserved()(total=enters−leaves−lost−discarded). 혼합 lifecycle(enter/move/leave/migrate/rebalance/drain/hostdown/stop) 후 둘 다 참 → #56 arc 닫기. OFF→0289 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zoneflowcap`(가설) — 전 op 혼합 후 flowCoherent·conserved·단일 소유·full lifecycle 발화.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0290 #56 브리지 존 데이터 평면 10·capstone 검증 — entity 데이터 평면이 배치 SSOT 와 완전 정합 + 보존 회계.
//   혼합 lifecycle: z1@A·z2@B·z3@C 배치+enter(a1·a2→z1·a3→z2·a4·a5→z3·5)·move·leave a2(1)·hostdown C(z3 a4·a5 소실 2)·stop z2(a3 폐기 1)·migrate z1·rebalance·drain.
//   → entityFlowCoherent·entityConserved(total 1 == 5−1−2−1)·단일 소유·enters5/leaves1/lost2/discarded1/migrations≥1(full lifecycle 발화). #56 arc 닫기.
function zoneflowcap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'),
    DOWN(12, 'hostC', HS), STOP(13, 'z2'), MIG(14, 'z1', 'hostB'), REBAL(15, HS), DRAIN(16, 'hostA', HS)];
  const ENTOPS = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z3', 'a4'), ENTER(8, 'z3', 'a5'),
    MOVE(9, 'z1', 'a1', 2, 1), LEAVE(10, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zoneflowcap (0290·#56 10·capstone): 전 데이터 평면 정합 + 보존 회계. 혼합 lifecycle 후 entityFlowCoherent(3층+entity)·entityConserved(total1==5−1−2−1)·단일 소유·enters5/leaves1/lost2/discarded1/migs≥1. #56 arc 0281~0290 닫기. ==');
  console.log('seed   | flow | consv | total | E/L/lost/disc | migs | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch;
    const ledger = `${o.zoneEnters}/${o.zoneLeaves}/${o.zoneEntitiesLost}/${o.zoneEntitiesDiscarded}`;
    const ok = check(o.entityFlowCoherent() && o.entityConserved() && o.entitiesSingleOwner() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1 && o.zoneMigrations >= 1,
      `seed ${seed}: capstone 위반 (flow ${o.entityFlowCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()}·ledger ${ledger}·migs ${o.zoneMigrations})`);
    console.log(`${pad(seed, 6)} | ${pad(o.entityFlowCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(ledger, 13)} | ${pad(o.zoneMigrations, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneflowcap'] = zoneflowcap;
kit.ORDER.splice(1, 0, 'zoneflowcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
