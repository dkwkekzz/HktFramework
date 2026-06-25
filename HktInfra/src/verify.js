// HktInfra step-0288 — 헤드리스 검증 (#56 브리지 존 데이터 평면 8: entity 정합·orphan 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneentcoherent`.
//   더한 한 조각: entityCoherent() — 단일 소유 + entity 보유 런타임은 모두 executed running(orphan 0). OFF→0287 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zoneentcoherent`(가설) — 혼합 lifecycle(enter/migrate/stop) 후 entityCoherent·stop 존 entity orphan 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0288 #56 브리지 존 데이터 평면 8 검증 — entity 정합: 단일 소유 + entity 보유 런타임은 모두 executed running(orphan 0).
//   z1·z2·z3 배치+enter(a1·a2→z1·a3→z2·a4→z3) → z1 migrate hostC + z2 stop → entityCoherent true·z2 avatar(a3) orphan 0(소유 존 null)·total 3.
function zoneentcoherent(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'), MIG(9, 'z1', 'hostC'), STOP(10, 'z2')];
  const ENTOPS = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z3', 'a4')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zoneentcoherent (0288·#56 8): entity 정합 — 단일 소유 + entity 보유 런타임은 모두 executed running(orphan 0). 혼합(enter/migrate z1/stop z2) 후 coherent·a3(z2) 소유존 null·total3·rtCnt2. ==');
  console.log('seed   | coherent | a3owner | rtCnt | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 13, ...BASE });
    const o = r.orch;
    const a3o = o.entityOwnerZone('a3');
    const ok = check(o.entityCoherent() === true && a3o === null && o.runtimeCount() === 2 && o.totalEntities() === 3,
      `seed ${seed}: 정합 위반 (coherent ${o.entityCoherent()}·a3owner ${a3o}·rtCnt ${o.runtimeCount()}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.entityCoherent() ? 'Y' : 'N', 8)} | ${pad(String(a3o), 7)} | ${pad(o.runtimeCount(), 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneentcoherent'] = zoneentcoherent;
kit.ORDER.splice(1, 0, 'zoneentcoherent');

(async () => { process.exit(await kit.cli(process.argv)); })();
