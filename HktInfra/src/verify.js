// HktInfra step-0287 — 헤드리스 검증 (#56 브리지 존 데이터 평면 7: entity 단일 소유)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneowner`.
//   더한 한 조각: entityOwnerZone/entityOwnerCount/entitiesSingleOwner 질의 — 어떤 avatar 도 두 존에 동시에 살지 않는다(권위 단일 소유의 데이터 평면 판). OFF→0286 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zoneowner`(가설) — 분산 enter + migrate 후 각 avatar 정확히 한 존·entitiesSingleOwner.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0287 #56 브리지 존 데이터 평면 7 검증 — entity 단일 소유(어떤 avatar 도 두 존에 동시 거주 금지).
//   a1·a2→z1·a3→z2·a4→z3 enter 후 z1→hostC migrate(같은 핸들·존 집합 불변) → 각 avatar 정확히 한 존·entitiesSingleOwner true.
//   entityOwnerZone(a1)='z1'·entityOwnerCount(a3)=1·total 4.
function zoneowner(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'), MIG(9, 'z1', 'hostC')];
  const ENTOPS = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z3', 'a4')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zoneowner (0287·#56 7): entity 단일 소유 — 어떤 avatar 도 두 존 동시 거주 금지. a1·a2→z1·a3→z2·a4→z3 + z1 migrate → single·a1∈z1·a3 count1·total4. ==');
  console.log('seed   | single | a1zone | a3cnt | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch;
    const ok = check(o.entitiesSingleOwner() === true && o.entityOwnerZone('a1') === 'z1' && o.entityOwnerCount('a3') === 1 && o.entityOwnerCount('a4') === 1 && o.totalEntities() === 4,
      `seed ${seed}: 단일 소유 위반 (single ${o.entitiesSingleOwner()}·a1 ${o.entityOwnerZone('a1')}·a3cnt ${o.entityOwnerCount('a3')}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.entitiesSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.entityOwnerZone('a1'), 6)} | ${pad(o.entityOwnerCount('a3'), 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneowner'] = zoneowner;
kit.ORDER.splice(1, 0, 'zoneowner');

(async () => { process.exit(await kit.cli(process.argv)); })();
