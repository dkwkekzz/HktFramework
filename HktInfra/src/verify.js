// HktInfra step-0295 — 헤드리스 검증 (#9 멀티프로세스 배선 5: 게이트웨이→실 존 직접 move/leave 라우팅)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdirmove`.
//   더한 한 조각: 게이트웨이 직접 라우팅을 move/leave 로 확장(enter 와 동형·zoneDir 해소→zoneDeliver→orch host 검증·_bridgeMove/_bridgeLeave). OFF→0294 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdirmove`(가설) — enter+move+leave 가 모두 게이트웨이 직접 라우팅으로 실 런타임 적용·routes==applied·moves/leaves 발화·entityConserved·단일 소유.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0295 #9 멀티프로세스 배선 5 검증 — enter/move/leave 가 모두 게이트웨이 직접 라우팅으로 실 런타임에 적용.
//   place z1@A·z2@B → 직접 enter a1·a2→z1 → 직접 move a1(+2,+1) → 직접 leave a2.
//   → z1 a1 잔존(a2 떠남)·total1·routes4==applied4·moves1·leaves1·stale0·miss0·conserved(1==2−1)·단일 소유. 직접 라우팅이 enter 뿐 아니라 전 데이터 평면 op 를 덮는다(#9).
function gwdirmove(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENTOPS = [ENTER(6, 'z1', 'a1'), ENTER(7, 'z1', 'a2'), MOVE(10, 'z1', 'a1', 2, 1), LEAVE(12, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdirmove (0295·#9 5): 게이트웨이→실 존 직접 move/leave 라우팅. enter+move+leave 모두 게이트웨이 직접 라우팅으로 실 런타임 적용. total1·routes4==applied4·moves1·leaves1·stale0·miss0·conserved·단일 소유. ==');
  console.log('seed   | z1 | total | routes | appl | mv | lv | stale | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch, gw = r.gateway;
    const ok = check(o.zoneEntityCount('z1') === 1 && o.zoneHasEntity('z1', 'a1') && o.totalEntities() === 1 &&
      gw.gatewayZoneRoutes === 4 && o.zoneDirectApplied === 4 && o.zoneMoves === 1 && o.zoneLeaves === 1 &&
      o.zoneDirStale === 0 && gw.gatewayZoneMisses === 0 && o.entitiesSingleOwner() && o.entityConserved(),
      `seed ${seed}: 직접 move/leave 위반 (z1 ${o.zoneEntityCount('z1')}·routes ${gw.gatewayZoneRoutes}·appl ${o.zoneDirectApplied}·mv ${o.zoneMoves}·lv ${o.zoneLeaves}·stale ${o.zoneDirStale}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.totalEntities(), 5)} | ${pad(gw.gatewayZoneRoutes, 6)} | ${pad(o.zoneDirectApplied, 4)} | ${pad(o.zoneMoves, 2)} | ${pad(o.zoneLeaves, 2)} | ${pad(o.zoneDirStale, 5)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdirmove'] = gwdirmove;
kit.ORDER.splice(1, 0, 'gwdirmove');

(async () => { process.exit(await kit.cli(process.argv)); })();
