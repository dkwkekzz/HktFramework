// HktInfra step-0284 — 헤드리스 검증 (#56 브리지 존 데이터 평면 4: migrate 무손실 — 행동적 보존)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonemigent`.
//   더한 한 조각: totalEntities() census 질의. _bridgeMigrate(같은 EntityZone 핸들 host 교체)가 entity 를 *행동적으로* 무손실 보존(0273 구조적 보존의 데이터 평면 판). OFF→0283 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonemigent`(가설) — migrate 없는 런 vs migrate 런: entity 수·위치 동일(보존)·host 만 이동.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0284 #56 브리지 존 데이터 평면 4 검증 — migrate(같은 핸들)가 entity 를 행동적으로 무손실 보존.
//   nomig 런(a1·a2·a3 enter + a1 move·host A) vs mig 런(같은 + z1→hostC migrate). migrate 는 같은 EntityZone 핸들의 host 만 교체하므로:
//   entity 수 3 보존·a1 위치 동일(이주가 위치 안 건드림)·runtimeHost A→C·totalEntities 3·zoneMigrations 1.
function zonemigent(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA')];
  const MIGOPS = [MIG(6, 'z1', 'hostC')];
  const ENTOPS = [ENTER(2, 'z1', 'a1'), ENTER(3, 'z1', 'a2'), ENTER(4, 'z1', 'a3'), MOVE(5, 'z1', 'a1', 3, 2)];
  const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, entityOps: ENTOPS };
  console.log('== zonemigent (0284·#56 4): migrate 무손실(행동적) — 같은 EntityZone 핸들 host 교체가 entity 보존. nomig vs mig(z1→hostC): 수3·a1 위치 동일·runtimeHost A→C·total3·zoneMigrations1. ==');
  console.log('seed   | total | cnt | a1pos동일 | rtHost | migs | 판정');
  for (const seed of seeds) {
    const rN = run({ seed, ticks: 12, ...COMMON, placementOps: PLACEOPS });
    const rM = run({ seed, ticks: 12, ...COMMON, placementOps: PLACEOPS.concat(MIGOPS) });
    const pN = rN.orch.zoneEntityPos('z1', 'a1');
    const pM = rM.orch.zoneEntityPos('z1', 'a1');
    const posEq = pN && pM && pN.x === pM.x && pN.y === pM.y;
    const rt = rM.orch.zoneRuntimeHostOf('z1');
    const ok = check(rM.orch.totalEntities() === 3 && rM.orch.zoneEntityCount('z1') === 3 && posEq && rt === 'hostC' && rN.orch.zoneRuntimeHostOf('z1') === 'hostA' && rM.orch.zoneMigrations === 1,
      `seed ${seed}: migrate 무손실 위반 (total ${rM.orch.totalEntities()}·cnt ${rM.orch.zoneEntityCount('z1')}·posEq ${posEq}·rt ${rt}·migs ${rM.orch.zoneMigrations})`);
    console.log(`${pad(seed, 6)} | ${pad(rM.orch.totalEntities(), 5)} | ${pad(rM.orch.zoneEntityCount('z1'), 3)} | ${pad(posEq ? 'Y' : 'N', 9)} | ${pad(rt, 6)} | ${pad(rM.orch.zoneMigrations, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonemigent'] = zonemigent;
kit.ORDER.splice(1, 0, 'zonemigent');

(async () => { process.exit(await kit.cli(process.argv)); })();
