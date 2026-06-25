// HktInfra step-0294 — 헤드리스 검증 (#9 멀티프로세스 배선 4: 게이트웨이→실 존 직접 enter 라우팅)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdirenter`.
//   더한 한 조각: gatewayDirectZone — 게이트웨이가 자기 zoneDir 로 존 host 를 해소해 zoneDeliver 로 직접 라우팅(orch 데이터 평면 우회·라우팅 결정이 게이트웨이에). orch 는 host 일치 검증 후 적용(stale 거부). OFF→0293 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdirenter`(가설) — 게이트웨이 직접 라우팅한 enter 가 실 런타임에 적용·routes==applied==enters·stale/miss 0·entityConserved·단일 소유.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0294 #9 멀티프로세스 배선 4 검증 — 게이트웨이가 *직접* 존으로 라우팅한 enter 가 실 런타임에 정확히 도달.
//   place z1@A·z2@B(디렉토리 학습) → 게이트웨이 직접 라우팅 enter a1·a2→z1·a3→z2(클라→게이트웨이→zoneDir 해소→zoneDeliver→orch 검증·적용).
//   → z1cnt2·z2cnt1·total3·routes3==applied3==enters3·stale0·miss0·단일 소유·entityConserved. 라우팅 결정이 orch 가 아니라 게이트웨이에(#9 핵심·orch 데이터 평면 우회).
function gwdirenter(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENTOPS = [ENTER(6, 'z1', 'a1'), ENTER(7, 'z1', 'a2'), ENTER(8, 'z2', 'a3')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdirenter (0294·#9 4): 게이트웨이→실 존 직접 enter 라우팅. 게이트웨이가 zoneDir 로 host 해소→zoneDeliver 직접→orch 검증·적용. z1cnt2·z2cnt1·total3·routes==applied==enters3·stale0·miss0·단일 소유·conserved. 라우팅 결정이 게이트웨이에. ==');
  console.log('seed   | z1 | z2 | total | routes | appl | stale | miss | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch, gw = r.gateway;
    const ok = check(o.zoneEntityCount('z1') === 2 && o.zoneEntityCount('z2') === 1 && o.totalEntities() === 3 &&
      gw.gatewayZoneRoutes === 3 && o.zoneDirectApplied === 3 && o.zoneDirStale === 0 && gw.gatewayZoneMisses === 0 &&
      o.entitiesSingleOwner() && o.entityConserved(),
      `seed ${seed}: 직접 라우팅 위반 (z1 ${o.zoneEntityCount('z1')}·z2 ${o.zoneEntityCount('z2')}·routes ${gw.gatewayZoneRoutes}·appl ${o.zoneDirectApplied}·stale ${o.zoneDirStale}·miss ${gw.gatewayZoneMisses}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.zoneEntityCount('z2'), 2)} | ${pad(o.totalEntities(), 5)} | ${pad(gw.gatewayZoneRoutes, 6)} | ${pad(o.zoneDirectApplied, 4)} | ${pad(o.zoneDirStale, 5)} | ${pad(gw.gatewayZoneMisses, 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdirenter'] = gwdirenter;
kit.ORDER.splice(1, 0, 'gwdirenter');

(async () => { process.exit(await kit.cli(process.argv)); })();
