// HktInfra step-0286 — 헤드리스 검증 (#56 브리지 존 데이터 평면 6: stop 폐기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonestopent`.
//   더한 한 조각: _bridgeStop 이 폐기 전 그 핸들의 entity 수를 zoneEntitiesDiscarded 로 계측(계획적 퇴역·hostdown 비자발 소실과 구분). OFF→0285 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonestopent`(가설) — z1 stop → z1 런타임 제거·entity 폐기 계측·z2 무사.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0286 #56 브리지 존 데이터 평면 6 검증 — 존 운영 퇴역(stop)은 그 핸들 entity 를 폐기(계획적).
//   z1@hostA(a1·a2)·z2@hostB(b1·b2·b3) → z1 stop → z1 런타임 제거(zoneEntityCount 0·미가동)·z2 무사.
//   zoneEntitiesDiscarded 2·zoneStops 1·runtimeCount 1·total 3(z2 만).
function zonestopent(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), STOP(9, 'z1')];
  const ENTOPS = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z2', 'b1'), ENTER(6, 'z2', 'b2'), ENTER(7, 'z2', 'b3')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonestopent (0286·#56 6): stop 폐기 — 존 운영 퇴역은 그 핸들 entity 폐기(계획적). z1@A(2)·z2@B(3)→z1 stop→z1 미가동(cnt0)·z2 무사(3)·discarded2·stops1·rtCount1·total3. ==');
  console.log('seed   | z1 | z2 | discarded | stops | rtCnt | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch;
    const ok = check(o.zoneEntityCount('z1') === 0 && o.zoneEntityCount('z2') === 3 && o.zoneEntitiesDiscarded === 2 && o.zoneStops === 1 && o.runtimeCount() === 1 && o.totalEntities() === 3,
      `seed ${seed}: stop 폐기 위반 (z1 ${o.zoneEntityCount('z1')}·z2 ${o.zoneEntityCount('z2')}·disc ${o.zoneEntitiesDiscarded}·stops ${o.zoneStops}·rt ${o.runtimeCount()}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.zoneEntityCount('z2'), 2)} | ${pad(o.zoneEntitiesDiscarded, 9)} | ${pad(o.zoneStops, 5)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonestopent'] = zonestopent;
kit.ORDER.splice(1, 0, 'zonestopent');

(async () => { process.exit(await kit.cli(process.argv)); })();
