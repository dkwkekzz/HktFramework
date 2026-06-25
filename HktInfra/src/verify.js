// HktInfra step-0273 — 헤드리스 검증 (#51b 실 zone.js 브리지 2: _migrate 실 런타임 host 이주)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonemigrate`.
//   더한 한 조각: zoneBridge ON 이면 orch 의 _migrate 가 *같은 EntityZone 핸들*의 host 를 release+acquire 원자 교체(zoneRuntimes·재생성 아님·상태 보존). 0273 _bridgeMigrate·zoneMigrations 계측. OFF→0272 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonemigrate`(가설) — z1 A→C→A 두 번 이주에도 zoneStarts 불변(인스턴스 1회만 생성=재생성 아님)·zoneMigrations==2·최종 host 정확·단일 소유.
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
function zonemigrate(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), MIG(3, 'z1', 'hostC'), MIG(4, 'z1', 'hostA')];   // z1: A→C→A 두 번 이주(재생성 없이 같은 핸들).
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonemigrate (0273·#51b 2): _migrate 실 런타임 host 이주 — 같은 EntityZone 핸들의 host 를 release+acquire 원자 교체(재생성 아님·상태 보존). z1 A→C→A 두 번 이주에도 zoneStarts 불변(인스턴스 1회 생성)·zoneMigrations 2·최종 host=hostA·단일 소유. ==');
  console.log('seed   | rtCnt | z1 host | starts | migr | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const z1 = o.zoneRuntimeOf('z1');
    const realEZ = !!z1 && z1.ents instanceof Map;
    const ok = check(o.runtimeCount() === 2 && o.zoneRuntimeHostOf('z1') === 'hostA' && o.zoneRuntimeHostOf('z2') === 'hostB' && o.zoneStarts === 2 && o.zoneMigrations === 2 && realEZ,
      `seed ${seed}: 이주 위반 (rtCnt ${o.runtimeCount()}·z1 ${o.zoneRuntimeHostOf('z1')}·starts ${o.zoneStarts}·migr ${o.zoneMigrations}·realEZ ${realEZ})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.zoneRuntimeHostOf('z1') || '-', 7)} | ${pad(o.zoneStarts, 6)} | ${pad(o.zoneMigrations, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonemigrate'] = zonemigrate;
kit.ORDER.splice(1, 0, 'zonemigrate');

(async () => { process.exit(await kit.cli(process.argv)); })();
