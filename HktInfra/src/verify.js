// HktInfra step-0293 — 헤드리스 검증 (#9 멀티프로세스 배선 3: 게이트웨이 존 디렉토리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwzonedir`.
//   더한 한 조각: gatewayZoneDir — orch 가 배치 집행(start/migrate/stop/hostdown)마다 zone→host 위치를 게이트웨이에 push(zoneLoc·서비스 디스커버리) → 게이트웨이 zoneDir 캐시(#9 직접 라우팅 전제). OFF→0292 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwzonedir`(가설) — 혼합 배치 lifecycle 후 게이트웨이 zoneDir == orch.running(실 런타임 위치)·push>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// 게이트웨이 디렉토리 ↔ orch.running 정합 — 게이트웨이가 학습한 zone→host 가 실 런타임 위치와 같은가(같은 키 집합·같은 host).
function dirMatchesRunning(gw, orch) {
  if (gw.zoneDir.size !== orch.running.size) return false;
  for (const [z, h] of orch.running) if (gw.zoneDir.get(z) !== h) return false;
  return true;
}

// step-0293 #9 멀티프로세스 배선 3 검증 — 게이트웨이가 배치 집행을 서비스 디스커버리(zoneLoc)로 학습해 실 런타임 위치와 정합.
//   혼합 배치 lifecycle(place z1@A·z2@B·z3@C → hostC down → stop z2 → migrate z1 → rebalance → drain hostA) 후 게이트웨이 zoneDir == orch.running.
//   → 게이트웨이가 orch 내부를 모른 채(은닉) 직접 라우팅에 쓸 라우팅 테이블을 정확히 보유. push>0(실제 디스커버리 발생). #9 직접 라우팅(0294~)의 전제.
function gwzonedir(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'),
    DOWN(12, 'hostC', HS), STOP(13, 'z2'), MIG(14, 'z1', 'hostB'), REBAL(15, HS), DRAIN(16, 'hostA', HS)];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, gatewayZoneDir: true, placementOps: PLACEOPS };
  console.log('== gwzonedir (0293·#9 3): 게이트웨이 존 디렉토리. 혼합 배치 lifecycle 후 게이트웨이가 학습한 zoneDir == orch.running(실 런타임 위치)·push>0. 게이트웨이가 직접 라우팅에 쓸 라우팅 테이블을 은닉 유지하며 정확히 보유. ==');
  console.log('seed   | dir== | dirN | runN | push | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch, gw = r.gateway;
    const match = dirMatchesRunning(gw, o);
    const ok = check(match && o.zoneLocPushed > 0 && gw.zoneDirSize() === o.runningCount(),
      `seed ${seed}: 디렉토리 정합 위반 (match ${match}·dirN ${gw.zoneDirSize()}·runN ${o.runningCount()}·push ${o.zoneLocPushed})`);
    console.log(`${pad(seed, 6)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(gw.zoneDirSize(), 4)} | ${pad(o.runningCount(), 4)} | ${pad(o.zoneLocPushed, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwzonedir'] = gwzonedir;
kit.ORDER.splice(1, 0, 'gwzonedir');

(async () => { process.exit(await kit.cli(process.argv)); })();
