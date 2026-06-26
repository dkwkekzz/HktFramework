// HktInfra step-0312 — 헤드리스 검증 (#9 잔여: host 프로세스 생애주기 이벤트 로그)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostlifecycle`.
//   더한 한 조각: _hostSet 의 host 컨테이너 spawn/despawn 을 순서 있는 이벤트 로그(hostLifecycleLog)로 — 실 cluster.spawnOne/killHost 호출 지점의 씨앗. OFF 플래그 zoneHostLifecycle(OFF→로그 0·baseline 비트 동일).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostlifecycle`(가설) — churn(3 host spawn→drain 1 despawn) 후 로그 net 집합 == zoneHostHosts·spawn−despawn == 현 host 수.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0312 #9 잔여 검증 — host 프로세스 생애주기 이벤트 로그(hostLifecycle). 3 host(A·B·C) spawn 후 hostA 드레인 → z1 이주(A 마지막 존 잃음) → A despawn.
//   로그를 접은 net 집합(spawn 추가·despawn 제거)이 *지금 가동 host 집합*(zoneHostHosts)과 정확히 일치 + spawn−despawn == 현 host 수. 로그가 roster 의 정직한 역사(실 spawnOne/killHost 타임라인 씨앗).
function hostlifecycle(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'), DRAIN(6, 'hostA', HS)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneHostLifecycle: true };
  console.log('== hostlifecycle (0312·#9 잔여): host 프로세스 생애주기 로그. 3 host spawn→hostA drain→A despawn. 로그 net 집합 == zoneHostHosts·spawn−despawn == 현 host. ==');
  console.log('seed   | spawn | despw | net==live | sp−dp==hosts | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS });
    const o = r.orch;
    const net = [...o.hostLifecycleNet()].sort().join(',');
    const live = [...o.zoneHostHosts()].sort().join(',');
    const sp = o.hostSpawnCount(), dp = o.hostDespawnCount();
    const ok = check(net === live && (sp - dp) === o.zoneHosts.size && sp === 3 && dp === 1,
      `seed ${seed}: 생애주기 로그 위반 (net [${net}]·live [${live}]·spawn ${sp}·despawn ${dp}·hosts ${o.zoneHosts.size})`);
    console.log(`${pad(seed, 6)} | ${pad(sp, 5)} | ${pad(dp, 5)} | ${pad(net === live ? 'Y' : 'N', 9)} | ${pad((sp - dp) === o.zoneHosts.size ? 'Y' : 'N', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostlifecycle'] = hostlifecycle;
kit.ORDER.splice(1, 0, 'hostlifecycle');

(async () => { process.exit(await kit.cli(process.argv)); })();
