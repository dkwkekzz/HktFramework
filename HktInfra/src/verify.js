// HktInfra step-0305 — 헤드리스 검증 (정리 분할: host 프로세스 컨테이너 층 0301~0304 → orch-hostproc.js·기능 0·reg 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 은 *투명 분할*(새 기능 0) — 검증 = reg 0(비트 동일) + `zonehostroster`(분리된 메서드가 prototype 으로 그대로 해소됨을 재단언).
//   더한 한 조각: 없음(orch-zonebridge.js 29.4KB>30KB 트리거 → host-proc 메서드를 orch-hostproc.js 믹스인으로 이동·Object.assign 되섞기). OFF/ON 무관 0304 비트 동일(reg).
//   검증: ⒜ `reg`(키트·분할 후에도 비트 동일). ⒝ `zonehostroster`(이전 가설 재실행) — 분리된 _hostSet·roster 질의가 그대로 동작(혼합 lifecycle 후 reg−dereg==현 host==running·데이터 평면 보존).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0304 #9 잔여 검증 — host roster 가 프로세스 spawn/despawn 회계처럼 닫힌다(register−deregister == 현 host) + roster == running hosts.
//   0300 혼합 lifecycle(hostdown C·stop z2·migrate z1·rebalance·drain 으로 host 가 들고 남)을 zoneHostProc ON 으로:
//   → hostRegisters−hostDeregisters == zoneHostHosts().size == running host 수 + roster(hostRegistered)==running hosts + directFlowCoherent·total1·ledger 5/1/2/1.
function zonehostroster(seeds) {
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
  console.log('== zonehostroster (0304·#9 잔여 4): host roster register/deregister. 혼합 lifecycle 후 reg−dereg == 현 host == running host 수·roster==running hosts + dflow·total1·ledger5/1/2/1. ==');
  console.log('seed   | reg | dereg | net==hosts | roster== | dflow | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const net = o.hostRegisters - o.hostDeregisters;
    const runHosts = new Set([...o.running.values()]);
    const netOk = net === o.zoneHostHosts().size && net === runHosts.size;
    let rosterOk = o.zoneHostHosts().size === runHosts.size;
    for (const h of runHosts) if (!o.hostRegistered(h)) rosterOk = false;
    const ok = check(netOk && rosterOk && o.hostRegisters >= 3 && o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1,
      `seed ${seed}: roster 위반 (reg ${o.hostRegisters}·dereg ${o.hostDeregisters}·net ${net}·hosts ${o.zoneHostHosts().size}·run ${runHosts.size}·roster ${rosterOk}·dflow ${o.directFlowCoherent()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostRegisters, 3)} | ${pad(o.hostDeregisters, 5)} | ${pad(netOk ? 'Y' : 'N', 10)} | ${pad(rosterOk ? 'Y' : 'N', 8)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostroster'] = zonehostroster;
kit.ORDER.splice(1, 0, 'zonehostroster');

(async () => { process.exit(await kit.cli(process.argv)); })();
