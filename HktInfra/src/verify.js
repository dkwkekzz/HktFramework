// HktInfra step-0303 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 3 — host 컨테이너 단일 소유 + 표류 질의)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostdrift`.
//   더한 한 조각: zoneHostSingleOwner()(어떤 존도 두 host 컨테이너 동시 귀속 안 함) + zoneHostDrift()(host 컨테이너==running·표류 0). 읽기 전용→0302 비트 동일(reg).
//   검증: ⒜ `reg`(키트·읽기 전용 비트 동일). ⒝ `zonehostdrift`(가설) — 혼합 lifecycle 후 drift 0·singleOwner·data 평면 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0303 #9 잔여 검증 — host 컨테이너의 구조 불변(단일 소유 + 표류 0)을 1급 술어로 단언.
//   0300 혼합 lifecycle 을 zoneHostProc ON 으로: zoneHostDrift 0(컨테이너==running)·zoneHostSingleOwner(어떤 존도 두 host 없음) + directFlowCoherent·total1·ledger 5/1/2/1.
function zonehostdrift(seeds) {
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
  console.log('== zonehostdrift (0303·#9 잔여 3): host 컨테이너 단일 소유 + 표류 질의. 혼합 lifecycle 후 zoneHostDrift 0·zoneHostSingleOwner + directFlowCoherent·total1·ledger5/1/2/1. ==');
  console.log('seed   | drift | single | dflow | total | ledger        | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const ledger = `${o.zoneEnters}/${o.zoneLeaves}/${o.zoneEntitiesLost}/${o.zoneEntitiesDiscarded}`;
    const ok = check(o.zoneHostDrift() === 0 && o.zoneHostSingleOwner() && o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1,
      `seed ${seed}: host 컨테이너 불변 위반 (drift ${o.zoneHostDrift()}·single ${o.zoneHostSingleOwner()}·dflow ${o.directFlowCoherent()}·total ${o.totalEntities()}·ledger ${ledger})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneHostDrift(), 5)} | ${pad(o.zoneHostSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(ledger, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostdrift'] = zonehostdrift;
kit.ORDER.splice(1, 0, 'zonehostdrift');

(async () => { process.exit(await kit.cli(process.argv)); })();
