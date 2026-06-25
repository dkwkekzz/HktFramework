// HktInfra step-0280 — 헤드리스 검증 (#51b 실 zone.js 브리지 9·capstone: 전 계층 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonecapstone`.
//   더한 한 조각: `fullyCoherent()` 질의 — placement(결정)==running(집행)==zoneRuntimes(실물) 세 층 완전 일치(placementDrift 0+bridgeCoherent+placedCount==runtimeCount). 혼합 lifecycle(start/auto/migrate/rebalance/drain/hostdown/stop) 전체를 거쳐도 참 → #51b arc 닫기. OFF→0279 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonecapstone`(가설) — 7종 op 혼합 후 fullyCoherent·runtimeCount==runningCount==placedCount·zone 집합 보존(공백/중복 0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;
const { run } = NET;

// step-0272 #51b 실 zone.js 브리지 1 검증 — zoneBridge ON 이면 placeZone 집행(_start)이 실 EntityZone 인스턴스를
//   host 에 띄워 zoneRuntimes 에 등록한다. running(zoneId→host 문자열) 추상과 실 zone.js 런타임이 일치(실물 정합):
//   z1→hostA·z2→hostB 두 실 EntityZone 핸들·runtimeCount==2·zoneStarts==2·멱등 재배치(같은 host 재-place)는 신규 인스턴스 0.
function zonecapstone(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const AUTO = (at, zoneId, hosts) => ({ at, op: { type: 'placeAuto', zoneId, hosts } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const HS = ['hostA', 'hostB', 'hostC'];
  // 7종 op 혼합 — start·auto·migrate·rebalance·drain·hostdown·stop 전부. zone 집합: z1,z2,z3,z4 생성 후 z4 stop → 3 잔존(move 류는 집합 보존).
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), AUTO(4, 'z4', HS),
    MIG(5, 'z1', 'hostC'), REBAL(6, HS), DRAIN(7, 'hostA', HS), DOWN(8, 'hostB', HS), STOP(9, 'z4')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonecapstone (0280·#51b 9·capstone): 전 계층 정합 — placement(결정)==running(집행)==zoneRuntimes(실물). 7종 op(start/auto/migrate/rebalance/drain/hostdown/stop) 혼합 후 fullyCoherent·runtimeCount==runningCount==placedCount==3(z4 stop·move 류 집합 보존·공백/중복 0). #51b arc 닫기. ==');
  console.log('seed   | full | rtCnt | runCnt | placed | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch;
    const ok = check(o.fullyCoherent() && o.runtimeCount() === 3 && o.runningCount() === 3 && o.placedCount() === 3,
      `seed ${seed}: capstone 위반 (full ${o.fullyCoherent()}·rtCnt ${o.runtimeCount()}·runCnt ${o.runningCount()}·placed ${o.placedCount()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.fullyCoherent() ? 'Y' : 'N', 4)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.runningCount(), 6)} | ${pad(o.placedCount(), 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonecapstone'] = zonecapstone;
kit.ORDER.splice(1, 0, 'zonecapstone');

(async () => { process.exit(await kit.cli(process.argv)); })();
