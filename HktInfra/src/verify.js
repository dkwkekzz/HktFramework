// HktInfra step-0310 — 헤드리스 검증 (#9 잔여 capstone: 실 host.js 물리 분리 — host 프로세스 컨테이너 전 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostproccap`.
//   더한 한 조각: hostProcCoherent()(directFlowCoherent && hostContainerCoherent). 혼합 lifecycle 을 host 프로세스 컨테이너 라우팅으로 → 참 → 실 host.js 물리 분리 arc 0301~0310 닫기. OFF→0309 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostproccap`(가설) — 전 op 혼합·host 프로세스 라우팅 후 hostProcCoherent·entityConserved·recv==drained+stale·census 정합·ledger 5/1/2/1·total1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0310 #9 잔여 capstone 검증 — 전 데이터 평면이 host 프로세스 컨테이너 경유(자기 inbox·자기 루프·roster·stale 거부)로 흘러도 배치 SSOT 와 완전 정합 + 보존.
//   0300 과 같은 혼합 lifecycle(z1@A·z2@B·z3@C·enter5·move·leave a2·hostdown C·stop z2·migrate z1·rebalance·drain)을 zoneHostProc ON 으로
//   → hostProcCoherent(directFlowCoherent && hostContainerCoherent)·entityConserved·recv==drained+stale(정상 흐름 stale0)·census.total==total1·ledger 5/1/2/1. 실 host.js 물리 분리 arc 0301~0310 닫기.
function hostproccap(seeds) {
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
  console.log('== hostproccap (0310·#9 잔여 capstone): host 프로세스 컨테이너 전 정합. 0300 혼합 lifecycle 을 host 프로세스 라우팅으로 → hostProcCoherent·consv·recv==drained+stale·census==total1·ledger5/1/2/1. 실 host.js 물리 분리 arc 0301~0310 닫기. ==');
  console.log('seed   | hpcoh | consv | total | r==d+s | census | ledger        | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const ledger = `${o.zoneEnters}/${o.zoneLeaves}/${o.zoneEntitiesLost}/${o.zoneEntitiesDiscarded}`;
    const rds = o.zoneHostFramesRecv === o.zoneHostDrained + o.zoneHostStale;
    const cs = o.zoneHostCensus();
    const ok = check(o.hostProcCoherent() && o.entityConserved() && o.totalEntities() === 1 && rds && cs.total === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1 && o.zoneHostStale === 0,
      `seed ${seed}: capstone 위반 (hpcoh ${o.hostProcCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()}·rds ${rds}·census ${cs.total}·ledger ${ledger}·stale ${o.zoneHostStale})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostProcCoherent() ? 'Y' : 'N', 5)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(rds ? 'Y' : 'N', 6)} | ${pad(cs.total, 6)} | ${pad(ledger, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostproccap'] = hostproccap;
kit.ORDER.splice(1, 0, 'hostproccap');

(async () => { process.exit(await kit.cli(process.argv)); })();
