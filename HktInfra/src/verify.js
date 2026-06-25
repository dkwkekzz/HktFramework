// HktInfra step-0279 — 헤드리스 검증 (#51b 실 zone.js 브리지 8: placeQuery 실 런타임 host 회신)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonequery`.
//   더한 한 조각: placeQuery 회신(placeReply)에 zoneBridge ON 일 때 `runtimeHost`(실 EntityZone 핸들 host) 추가 — 게이트웨이가 *실물* 런타임 위치로 라우팅(0250 running 문자열의 브리지 판·읽기 경로 완성). OFF→reply 바이트 동일=0278 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonequery`(가설) — z1 이주 후 placeQuery 회신 runtimeHost==실 핸들 host==running==placement(읽기 경로 4값 일치).
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
function zonequery(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const QUERY = (at, zoneId) => ({ at, op: { type: 'placeQuery', zoneId } });
  const OPS = [PLACE(1, 'z1', 'hostA'), MIG(2, 'z1', 'hostC'), QUERY(3, 'z1')];   // 이주 후 질의 → 회신이 실 런타임 위치(hostC) 가리켜야.
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonequery (0279·#51b 8): placeQuery 실 런타임 host 회신 — placeReply 에 runtimeHost(실 EntityZone 핸들 host) 추가. z1 이주(hostA→hostC) 후 질의 회신 runtimeHost==실 핸들 host==running==placement(읽기 경로 4값 일치·게이트웨이 실물 위치 라우팅). ==');
  console.log('seed   | reply.runtimeHost | 실핸들 | running | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const reply = o._lastPlaceReply;
    const realH = o.zoneRuntimeHostOf('z1');
    const ok = check(!!reply && reply.runtimeHost === 'hostC' && reply.runtimeHost === realH && reply.running === 'hostC' && reply.host === 'hostC',
      `seed ${seed}: query 위반 (reply.runtimeHost ${reply && reply.runtimeHost}·실핸들 ${realH}·running ${reply && reply.running})`);
    console.log(`${pad(seed, 6)} | ${pad(reply ? reply.runtimeHost : '-', 17)} | ${pad(realH || '-', 6)} | ${pad(reply ? reply.running : '-', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonequery'] = zonequery;
kit.ORDER.splice(1, 0, 'zonequery');

(async () => { process.exit(await kit.cli(process.argv)); })();
