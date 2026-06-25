// HktInfra step-0299 — 헤드리스 검증 (#9 멀티프로세스 배선 9: 디렉토리 bijection — 다중존 rebalance/drain churn)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdirbij`.
//   더한 한 조각: gateway zoneDirSnapshot() 질의(전 라우팅 테이블). 다중존 rebalance/drain 으로 여러 존이 동시 이주해도 게이트웨이 dir 가 running 과 정확한 bijection 유지·직접 라우팅 entity 보존. OFF 무관(읽기 전용·비트 동일 reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdirbij`(가설) — 4존 A 몰림→rebalance→drain B 후 dir==running(bijection·4엔트리)·entity graceful 보존·single·entityDirectCoherent·conserved.
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

// step-0299 #9 멀티프로세스 배선 9 검증 — 다중존 rebalance/drain 으로 여러 존이 한꺼번에 이주해도 게이트웨이 디렉토리가 running 과 정확한 bijection.
//   place z1~z4@A(몰림) → 직접 enter a1→z1·a2→z2 → rebalance([A,B,C])(분산) → drain B([A,B,C])(B 비움). graceful 이주는 같은 핸들 → a1·a2 보존.
//   → dir==running(bijection·dirN4==runN4)·entity graceful 보존(total2)·single·entityDirectCoherent·conserved·stale0·miss0. 게이트웨이 라우팅 테이블이 대량 churn 을 정확히 추적.
function gwdirbij(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), PLACE(4, 'z4', 'hostA'),
    REBAL(12, HS), DRAIN(16, 'hostB', HS)];
  const ENTOPS = [ENTER(7, 'z1', 'a1'), ENTER(8, 'z2', 'a2')];
  const BASE = { clients: 6, moves: 26, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdirbij (0299·#9 9): 디렉토리 bijection — 다중존 rebalance/drain churn. 4존 A 몰림→rebalance→drain B 후 게이트웨이 dir==running(bijection)·직접 enter entity graceful 보존(total2)·single·dcoh·conserved·stale0. ==');
  console.log('seed   | dirN | runN | dir== | total | single | dcoh | consv | stale | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 26, ...BASE });
    const o = r.orch, gw = r.gateway;
    const match = dirMatchesRunning(gw, o);
    const ok = check(match && gw.zoneDirSize() === o.runningCount() && o.runningCount() === 4 &&
      o.totalEntities() === 2 && o.entitiesSingleOwner() && o.entityDirectCoherent() && o.entityConserved() &&
      o.zoneDirStale === 0 && gw.gatewayZoneMisses === 0,
      `seed ${seed}: bijection 위반 (match ${match}·dirN ${gw.zoneDirSize()}·runN ${o.runningCount()}·total ${o.totalEntities()}·single ${o.entitiesSingleOwner()}·dcoh ${o.entityDirectCoherent()}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(gw.zoneDirSize(), 4)} | ${pad(o.runningCount(), 4)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(o.entitiesSingleOwner() ? 'Y' : 'N', 6)} | ${pad(o.entityDirectCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.zoneDirStale, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdirbij'] = gwdirbij;
kit.ORDER.splice(1, 0, 'gwdirbij');

(async () => { process.exit(await kit.cli(process.argv)); })();
