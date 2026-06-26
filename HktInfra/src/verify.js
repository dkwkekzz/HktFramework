// HktInfra step-0301 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 1 — host 1급 컨테이너 레지스트리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostreg`.
//   더한 한 조각: zoneHostProc 플래그 + zoneHosts(host→{zones}) 컨테이너. 배치 집행(start/migrate/hostdown/stop)이 _hostSet 으로 zone→host 귀속 유지. OFF→0300 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehostreg`(가설) — 혼합 lifecycle 후 host 컨테이너가 running 과 정확히 한 몸(zoneHostOf==running·hosts 집합 일치·총 귀속==running.size) + 데이터 평면 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// host 컨테이너가 executed running 과 정확히 한 몸인가(step-0301) — ⒜ 모든 running 존이 자기 host 컨테이너에 귀속 ⒝ 총 귀속 수 == running 수(extra/orphan 0) ⒞ 컨테이너 host 집합 == running host 집합.
function hostContainerMatchesRunning(o) {
  for (const [z, h] of o.running) if (o.zoneHostOf(z) !== h) return false;
  let n = 0; for (const host of o.zoneHostHosts()) n += o.hostRuntimeCount(host);
  if (n !== o.running.size) return false;
  const runHosts = new Set([...o.running.values()]);
  const ctHosts = o.zoneHostHosts();
  if (runHosts.size !== ctHosts.size) return false;
  for (const h of runHosts) if (!ctHosts.has(h)) return false;
  return true;
}

// step-0301 #9 잔여 검증 — host 가 1급 컨테이너(자기 존 집합 소유)로 묶이고, 그 귀속이 배치 집행 SSOT(running)와 완전 정합 + 데이터 평면 보존.
//   0300 과 같은 혼합 lifecycle(z1@A·z2@B·z3@C·enter5·move·leave a2·hostdown C·stop z2·migrate z1·rebalance·drain)을 zoneHostProc ON 으로 돌린 뒤
//   → host 컨테이너 == running(bijection·zoneHostOf/hosts/총귀속) + directFlowCoherent·entityConserved·total1·ledger 5/1/2/1.
function zonehostreg(seeds) {
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
  console.log('== zonehostreg (0301·#9 잔여 1): host 1급 컨테이너(zoneHosts) 레지스트리. 혼합 lifecycle 후 host 컨테이너 == running(zoneHostOf·hosts·총귀속) + directFlowCoherent·entityConserved·total1·ledger5/1/2/1. ==');
  console.log('seed   | hc== | hosts | runtimes | dflow | consv | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const match = hostContainerMatchesRunning(o);
    const ok = check(match && o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1,
      `seed ${seed}: host 컨테이너 위반 (hc== ${match}·dflow ${o.directFlowCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()}·hosts ${o.zoneHostHosts().size}·rt ${o.runtimeCount()})`);
    console.log(`${pad(seed, 6)} | ${pad(match ? 'Y' : 'N', 4)} | ${pad(o.zoneHostHosts().size, 5)} | ${pad(o.runtimeCount(), 8)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostreg'] = zonehostreg;
kit.ORDER.splice(1, 0, 'zonehostreg');

(async () => { process.exit(await kit.cli(process.argv)); })();
