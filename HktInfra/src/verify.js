// HktInfra step-0308 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 8 — host 컨테이너 정합 불변 primitive)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostcoh`.
//   더한 한 조각: hostContainerCoherent()(single + drift0 + roster 회계 닫힘). 읽기 전용→0307 비트 동일(reg).
//   검증: ⒜ `reg`(키트·읽기 전용 비트 동일). ⒝ `zonehostcoh`(가설) — 혼합 lifecycle 후 hostContainerCoherent·데이터 평면 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0308 #9 잔여 검증 — host 컨테이너 층의 정합을 단일 술어로 단언(single + drift0 + roster 회계 닫힘).
//   0300 혼합 lifecycle 을 zoneHostProc ON 으로: hostContainerCoherent() + directFlowCoherent·total1·ledger 5/1/2/1.
function zonehostcoh(seeds) {
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
    DOWN(15, 'hostC', HS), STOP(16, 'z2'), MIG(17, 'z1', 'hostB'), REBAL(18, HS), DRAIN(19, 'hostA', HS)];
  const ENTOPS = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z1', 'a2'), ENTER(7, 'z2', 'a3'), ENTER(8, 'z3', 'a4'), ENTER(9, 'z3', 'a5'),
    MOVE(10, 'z1', 'a1', 2, 1), LEAVE(11, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonehostcoh (0308·#9 잔여 8): host 컨테이너 정합 불변. 혼합 lifecycle 후 hostContainerCoherent(single+drift0+roster 회계) + dflow·total1·ledger5/1/2/1. ==');
  console.log('seed   | hcoh | single | drift | reg-dereg | hosts | dflow | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const net = o.hostRegisters - o.hostDeregisters;
    const ok = check(o.hostContainerCoherent() && o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1,
      `seed ${seed}: host 정합 위반 (hcoh ${o.hostContainerCoherent()}·single ${o.zoneHostSingleOwner()}·drift ${o.zoneHostDrift()}·net ${net}·hosts ${o.zoneHostHosts().size}·dflow ${o.directFlowCoherent()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${pad(o.zoneHostSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.zoneHostDrift(), 5)} | ${pad(net, 9)} | ${pad(o.zoneHostHosts().size, 5)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostcoh'] = zonehostcoh;
kit.ORDER.splice(1, 0, 'zonehostcoh');

(async () => { process.exit(await kit.cli(process.argv)); })();
