// HktInfra step-0300 — 헤드리스 검증 (#9 멀티프로세스 배선 10·capstone: 전 데이터 평면 게이트웨이 직접 라우팅)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdircap`.
//   더한 한 조각: directFlowCoherent()(entityFlowCoherent && entityDirectCoherent). destructive+graceful 혼합 lifecycle 을 게이트웨이 직접 라우팅만으로 돌린 뒤 참 → #9 arc 0291~0300 닫기. OFF→0299 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdircap`(가설) — 전 op 혼합·직접 라우팅 후 directFlowCoherent·entityConserved·dir bijection·ledger 5/1/2/1·total1.
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

// step-0300 #9 멀티프로세스 배선 10·capstone 검증 — 전 데이터 평면이 게이트웨이 직접 라우팅으로 흐르고 배치 SSOT 와 완전 정합 + 보존.
//   0290 #56 capstone 과 같은 혼합 lifecycle(z1@A·z2@B·z3@C·enter5·move·leave a2·hostdown C·stop z2·migrate z1·rebalance·drain)을 **게이트웨이 직접 라우팅만으로**(gatewayDirectZone).
//   → directFlowCoherent(entityFlowCoherent && entityDirectCoherent)·entityConserved(total1==5−1−2−1)·dir==running(bijection)·ledger 5/1/2/1·routes7==applied7·stale0·miss0. #9 arc 0291~0300 닫기.
function gwdircap(seeds) {
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
  // 배치: 직접 라우팅 2-홉 지연을 감안해 destructive op 를 entity 적재 뒤로 늦춤(0290 보다 한 박자 뒤).
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'),
    DOWN(15, 'hostC', HS), STOP(16, 'z2'), MIG(17, 'z1', 'hostB'), REBAL(18, HS), DRAIN(19, 'hostA', HS)];
  const ENTOPS = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z1', 'a2'), ENTER(7, 'z2', 'a3'), ENTER(8, 'z3', 'a4'), ENTER(9, 'z3', 'a5'),
    MOVE(10, 'z1', 'a1', 2, 1), LEAVE(11, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdircap (0300·#9 10·capstone): 전 데이터 평면 게이트웨이 직접 라우팅. 0290 혼합 lifecycle 을 직접 라우팅만으로 → directFlowCoherent(flow && directCoh)·entityConserved(total1==5−1−2−1)·dir==running·ledger5/1/2/1·routes7==appl7·stale0·miss0. #9 arc 0291~0300 닫기. ==');
  console.log('seed   | dflow | consv | total | E/L/lost/disc | dir== | routes | appl | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch, gw = r.gateway;
    const ledger = `${o.zoneEnters}/${o.zoneLeaves}/${o.zoneEntitiesLost}/${o.zoneEntitiesDiscarded}`;
    const match = dirMatchesRunning(gw, o);
    const ok = check(o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1 &&
      match && gw.gatewayZoneRoutes === 7 && o.zoneDirectApplied === 7 && o.zoneDirStale === 0 && gw.gatewayZoneMisses === 0,
      `seed ${seed}: capstone 위반 (dflow ${o.directFlowCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()}·ledger ${ledger}·dir ${match}·routes ${gw.gatewayZoneRoutes}·appl ${o.zoneDirectApplied}·stale ${o.zoneDirStale})`);
    console.log(`${pad(seed, 6)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(ledger, 13)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(gw.gatewayZoneRoutes, 6)} | ${pad(o.zoneDirectApplied, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdircap'] = gwdircap;
kit.ORDER.splice(1, 0, 'gwdircap');

(async () => { process.exit(await kit.cli(process.argv)); })();
