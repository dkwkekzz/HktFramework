// HktInfra step-0274 — 헤드리스 검증 (#51b 실 zone.js 브리지 3: _stop 실 런타임 종료)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonestop`.
//   더한 한 조각: zoneBridge ON 이면 orch 의 _stop 이 실 EntityZone 런타임을 zoneRuntimes 에서 제거(핸들 폐기). 0274 _bridgeStop·zoneStops 계측·없는 존 멱등. OFF→0273 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonestop`(가설) — placeStop 집행 후 그 존 런타임 제거(runtimeCount 감소·zoneRuntimeOf null)·다른 존 생존·없는 존 stop 은 멱등(zoneStops 무증).
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
function zonestop(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), STOP(3, 'z1'), STOP(4, 'z3')];   // z1 퇴역·z3(미존재) 멱등 no-op.
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonestop (0274·#51b 3): _stop 실 런타임 종료 — placeStop 집행이 실 EntityZone 런타임을 zoneRuntimes 에서 제거(핸들 폐기). z1 퇴역 후 runtimeCount 1·z1 핸들 null·z2 생존·zoneStops 1·없는 z3 stop 은 멱등(무증). ==');
  console.log('seed   | rtCnt | z1 | z2 | stops | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const ok = check(o.runtimeCount() === 1 && o.zoneRuntimeOf('z1') === null && !!o.zoneRuntimeOf('z2') && o.zoneStops === 1 && o.zoneStarts === 2,
      `seed ${seed}: stop 위반 (rtCnt ${o.runtimeCount()}·z1 ${o.zoneRuntimeOf('z1')}·z2 ${!!o.zoneRuntimeOf('z2')}·stops ${o.zoneStops})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.zoneRuntimeOf('z1') ? 'live' : 'gone', 4)} | ${pad(o.zoneRuntimeOf('z2') ? 'live' : 'gone', 4)} | ${pad(o.zoneStops, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonestop'] = zonestop;
kit.ORDER.splice(1, 0, 'zonestop');

(async () => { process.exit(await kit.cli(process.argv)); })();
