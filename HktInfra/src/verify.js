// HktInfra step-0272 — 헤드리스 검증 (#51b 실 zone.js 브리지 1: orch 존 런타임 레지스트리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonebridge`.
//   더한 한 조각: zoneBridge ON 이면 orch 의 배치 집행(_start)이 *실 EntityZone 인스턴스*를 host 에 띄운다(zoneRuntimes 레지스트리·orch-zonebridge.js). 0241~0250 의 running(zoneId→host 문자열) 추상을 실 zone.js 런타임에 연결. OFF→0271 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonebridge`(가설) — placeZone 집행 후 실 EntityZone 핸들이 올바른 host 에 등록(runtimeCount==배치 수·zoneStarts==신규·멱등 재배치는 인스턴스 증가 0).
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
function zonebridge(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z1', 'hostA')];   // 3번째 = z1 같은 host 재-place(멱등·신규 인스턴스 0).
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonebridge (0272·#51b 1): orch 존 런타임 레지스트리 — placeZone 집행이 실 EntityZone 인스턴스를 host 에 띄움(zoneRuntimes). running 문자열 추상↔실 zone.js 런타임 일치(z1→hostA·z2→hostB·runtimeCount 2·zoneStarts 2·멱등 재-place 신규 0). ==');
  console.log('seed   | rtCnt | z1 host | z2 host | starts | 실EZ | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const z1 = o.zoneRuntimeOf('z1');
    const realEZ = !!z1 && z1.ents instanceof Map && typeof z1.isAuthority === 'function';   // 진짜 EntityZone 핸들인가(running 문자열이 아니라 실물).
    const ok = check(o.runtimeCount() === 2 && o.zoneRuntimeHostOf('z1') === 'hostA' && o.zoneRuntimeHostOf('z2') === 'hostB' && o.zoneStarts === 2 && realEZ,
      `seed ${seed}: 브리지 위반 (rtCnt ${o.runtimeCount()}·z1 ${o.zoneRuntimeHostOf('z1')}·z2 ${o.zoneRuntimeHostOf('z2')}·starts ${o.zoneStarts}·realEZ ${realEZ})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.zoneRuntimeHostOf('z1') || '-', 7)} | ${pad(o.zoneRuntimeHostOf('z2') || '-', 7)} | ${pad(o.zoneStarts, 6)} | ${pad(realEZ ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonebridge'] = zonebridge;
kit.ORDER.splice(1, 0, 'zonebridge');

(async () => { process.exit(await kit.cli(process.argv)); })();
