// HktInfra step-0289 — 헤드리스 검증 (#56 브리지 존 데이터 평면 9: graceful census 보존)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonegraceful`.
//   더한 한 조각: entityCensus() {total, zones}. graceful 재배치(rebalance/drain·_migrate 같은 핸들)는 entity total 을 무손실 보존(분포만 재편). OFF→0288 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonegraceful`(가설) — rebalance+drain 후 total 보존·단일 소유·정합·moves>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0289 #56 브리지 존 데이터 평면 9 검증 — graceful 재배치(rebalance/drain)는 entity total 무손실 보존(같은 핸들 이주).
//   z1·z2·z3 모두 hostA 배치 + enter(a1·a2→z1·a3→z2·a4→z3·total4) → rebalance(분산) + drain(hostB) → total 4 보존·단일 소유·정합·rebalanceMoves+drainMoves>0.
function zonegraceful(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), REBAL(9, HS), DRAIN(11, 'hostB', HS)];
  const ENTOPS = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z3', 'a4')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonegraceful (0289·#56 9): graceful census 보존 — rebalance/drain(같은 핸들 이주)은 entity total 무손실. z1·z2·z3@A + 4 enter → rebalance+drain(B) → total4·single·coherent·moves>0. ==');
  console.log('seed   | total | single | coherent | rebMoves | drainMoves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE });
    const o = r.orch;
    const cen = o.entityCensus();
    const ok = check(cen.total === 4 && o.entitiesSingleOwner() && o.entityCoherent() && o.rebalanceMoves > 0 && o.drainMoves > 0,
      `seed ${seed}: graceful 보존 위반 (total ${cen.total}·single ${o.entitiesSingleOwner()}·coherent ${o.entityCoherent()}·reb ${o.rebalanceMoves}·drain ${o.drainMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(cen.total, 5)} | ${pad(o.entitiesSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.entityCoherent() ? 'Y' : 'N', 8)} | ${pad(o.rebalanceMoves, 8)} | ${pad(o.drainMoves, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonegraceful'] = zonegraceful;
kit.ORDER.splice(1, 0, 'zonegraceful');

(async () => { process.exit(await kit.cli(process.argv)); })();
