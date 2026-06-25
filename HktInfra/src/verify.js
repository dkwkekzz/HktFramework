// HktInfra step-0283 — 헤드리스 검증 (#56 브리지 존 데이터 평면 3: leave 흐름·entity 제거)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneleave`.
//   더한 한 조각: zoneLeave 가 실 EntityZone 핸들에서 avatar/세션을 제거(퇴장). OFF→0282 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zoneleave`(가설) — enter a1·a2 후 a1 leave → count 2→1·a1 사라짐·a2 잔존·zoneLeaves==1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0283 #56 브리지 존 데이터 평면 3 검증 — zoneLeave 가 실 EntityZone 핸들에서 avatar 제거.
//   z1 에 a1·a2 enter(count 2) → a1 leave → count 1·a1 없음·a2 잔존·zoneLeaves==1(실존 avatar 만).
function zoneleave(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA')];
  const ENTOPS = [ENTER(2, 'z1', 'a1'), ENTER(3, 'z1', 'a2'), LEAVE(5, 'z1', 'a1')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zoneleave (0283·#56 3): 브리지 존 leave 흐름 — zoneLeave 가 실 EntityZone 핸들에서 avatar 제거. a1·a2 enter(2)→a1 leave→count1·a1 사라짐·a2 잔존·zoneLeaves==1. ==');
  console.log('seed   | cnt | a1? | a2? | leaves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch;
    const cnt = o.zoneEntityCount('z1');
    const ok = check(cnt === 1 && !o.zoneHasEntity('z1', 'a1') && o.zoneHasEntity('z1', 'a2') && o.zoneLeaves === 1,
      `seed ${seed}: leave 위반 (cnt ${cnt}·a1 ${o.zoneHasEntity('z1', 'a1')}·a2 ${o.zoneHasEntity('z1', 'a2')}·leaves ${o.zoneLeaves})`);
    console.log(`${pad(seed, 6)} | ${pad(cnt, 3)} | ${pad(o.zoneHasEntity('z1', 'a1') ? 'Y' : 'N', 3)} | ${pad(o.zoneHasEntity('z1', 'a2') ? 'Y' : 'N', 3)} | ${pad(o.zoneLeaves, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneleave'] = zoneleave;
kit.ORDER.splice(1, 0, 'zoneleave');

(async () => { process.exit(await kit.cli(process.argv)); })();
