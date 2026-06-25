// HktInfra step-0285 — 헤드리스 검증 (#56 브리지 존 데이터 평면 5: hostdown 소실 — 정직한 한계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostdownent`.
//   더한 한 조각: _bridgeHostDown 이 새 인스턴스 교체 전 잃는 entity 수를 zoneEntitiesLost 로 계측(migrate 무손실과 대조·복구는 영속 후속). OFF→0284 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehostdownent`(가설) — hostA 장애 → z1 소실(새 빈 인스턴스)·z2 무사·zoneEntitiesLost 정합.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0285 #56 브리지 존 데이터 평면 5 검증 — host 장애는 entity 를 소실(graceful 이주 불가·정직한 한계).
//   z1@hostA(a1·a2·a3)·z2@hostB(b1·b2) → hostA 장애(placeHostDown) → z1 생존 host 재가동(새 빈 인스턴스·entity 3 소실)·z2 무사.
//   z1cnt 0·z2cnt 2·zoneEntitiesLost 3·zoneRescued 1·total 2·runtimeOn(hostA) 0.
function zonehostdownent(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), DOWN(8, 'hostA', HS)];
  const ENTOPS = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z1', 'a3'), ENTER(6, 'z2', 'b1'), ENTER(7, 'z2', 'b2')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonehostdownent (0285·#56 5): hostdown 소실(정직한 한계) — host 장애는 graceful 이주 불가→새 빈 인스턴스. z1@A(3)·z2@B(2)→hostA 장애→z1cnt0·z2cnt2·lost3·rescued1·total2·runtimeOn(A)0. ==');
  console.log('seed   | z1 | z2 | lost | rescued | total | A런타임 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch;
    const ok = check(o.zoneEntityCount('z1') === 0 && o.zoneEntityCount('z2') === 2 && o.zoneEntitiesLost === 3 && o.zoneRescued === 1 && o.totalEntities() === 2 && o.runtimeOn('hostA') === 0,
      `seed ${seed}: hostdown 소실 위반 (z1 ${o.zoneEntityCount('z1')}·z2 ${o.zoneEntityCount('z2')}·lost ${o.zoneEntitiesLost}·rescued ${o.zoneRescued}·total ${o.totalEntities()}·A ${o.runtimeOn('hostA')})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.zoneEntityCount('z2'), 2)} | ${pad(o.zoneEntitiesLost, 4)} | ${pad(o.zoneRescued, 7)} | ${pad(o.totalEntities(), 5)} | ${pad(o.runtimeOn('hostA'), 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostdownent'] = zonehostdownent;
kit.ORDER.splice(1, 0, 'zonehostdownent');

(async () => { process.exit(await kit.cli(process.argv)); })();
