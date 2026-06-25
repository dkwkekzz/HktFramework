// HktInfra step-0276 — 헤드리스 검증 (#51b 실 zone.js 브리지 5: zoneRuntimeDrift 정합 질의)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonedrift`.
//   더한 한 조각: `zoneRuntimeDrift()` 질의 — running(zoneId→host 문자열 추상 SSOT)과 zoneRuntimes(실 EntityZone 핸들 host)가 어긋난 존 수. placeExecute+zoneBridge ON 이면 전 배치 op 뒤 0(추상 집행↔실 런타임 한 몸). placementDrift(0245)의 실물 판·읽기 전용. OFF→0275 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonedrift`(가설) — start/migrate/stop/hostdown 혼합 op 후 zoneRuntimeDrift 0·runtimeCount==runningCount(추상↔실 일치).
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
function zonedrift(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  // start·migrate·hostdown·stop 전부 거친 혼합 시퀀스 — 매 op 가 running 문자열과 실 런타임을 한 몸으로 움직였는가(표류 0).
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA'), MIG(4, 'z1', 'hostC'), DOWN(5, 'hostB', ['hostA', 'hostB', 'hostC']), STOP(6, 'z3')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonedrift (0276·#51b 5): zoneRuntimeDrift 정합 질의 — running 문자열 추상 SSOT 와 zoneRuntimes 실 핸들 host 가 한 몸인가. start/migrate/hostdown/stop 혼합 후 drift 0·runtimeCount==runningCount(추상↔실 일치). ==');
  console.log('seed   | drift | rtCnt | runCnt | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch;
    const ok = check(o.zoneRuntimeDrift() === 0 && o.runtimeCount() === o.runningCount() && o.runtimeCount() === 2,
      `seed ${seed}: drift 위반 (drift ${o.zoneRuntimeDrift()}·rtCnt ${o.runtimeCount()}·runCnt ${o.runningCount()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneRuntimeDrift(), 5)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.runningCount(), 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonedrift'] = zonedrift;
kit.ORDER.splice(1, 0, 'zonedrift');

(async () => { process.exit(await kit.cli(process.argv)); })();
