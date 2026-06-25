// HktInfra step-0275 — 헤드리스 검증 (#51b 실 zone.js 브리지 4: _hostDown 실 런타임 재가동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostdown`.
//   더한 한 조각: zoneBridge ON 이면 _hostDown 이 죽은 host 의 실 EntityZone 런타임을 생존 host 에 *새 인스턴스*로 재가동(비자발적·상태 보존 불가·migrate 와 다름). 0275 _bridgeHostDown·zoneRescued 계측·runtimeOn 질의. OFF→0274 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehostdown`(가설) — hostA 장애 후 그 host 실 런타임 0·존들 생존 host 재가동·zoneRescued==구조된 존 수·runtimeCount 보존(단일 소유).
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
function zonehostdown(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), DOWN(4, 'hostA', ['hostA', 'hostB', 'hostC'])];   // hostA 비자발 장애 → z1·z2 생존 host 재가동.
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonehostdown (0275·#51b 4): _hostDown 실 런타임 재가동 — 죽은 host 의 실 EntityZone 런타임을 생존 host 에 새 인스턴스 재가동(비자발적·상태 보존 불가). hostA 장애 후 runtimeOn(hostA) 0·z1·z2 생존 host 재가동·zoneRescued 2·runtimeCount 3 보존(단일 소유). ==');
  console.log('seed   | onA | rtCnt | rescued | z1 host | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const z1h = o.zoneRuntimeHostOf('z1');
    const ok = check(o.runtimeOn('hostA') === 0 && o.runtimeCount() === 3 && o.zoneRescued === 2 && z1h !== 'hostA' && !!z1h,
      `seed ${seed}: hostdown 위반 (onA ${o.runtimeOn('hostA')}·rtCnt ${o.runtimeCount()}·rescued ${o.zoneRescued}·z1 ${z1h})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runtimeOn('hostA'), 3)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.zoneRescued, 7)} | ${pad(z1h || '-', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostdown'] = zonehostdown;
kit.ORDER.splice(1, 0, 'zonehostdown');

(async () => { process.exit(await kit.cli(process.argv)); })();
