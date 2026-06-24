// HktInfra step-0246 — 헤드리스 검증 (배치 SSOT 실배선 #51 — executed placeStop)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placestopexec`.
//   더한 한 조각: placeStop{zoneId} → 존 운영 퇴역(결정 placement 제거 + placeExecute ON 이면 실 런타임 running 종료·instance _despawn 의 존 판). 없는 존 멱등 no-op. 미주입/OFF → 0245 비트 동일(reg). #51 실배선 6.
//   검증: ⒜ `reg`(키트). ⒝ `placestopexec`(가설) — z1·z2·z3 가동 → z2 stop → placed 2·running 2·z2 제거·drift 0·미존 zX 멱등.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
// z1·z2·z3 가동 → z2 운영 퇴역(stop) → 미존 zX stop(멱등 no-op).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), STOP(4, 'z2'), STOP(5, 'zX')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placestopexec(seeds) {
  console.log('== placestopexec (0246·#51 실배선): executed placeStop — placeStop{zoneId} 이 존을 운영 퇴역(결정 placement 제거 + placeExecute ON 이면 실 런타임 running 종료·instance _despawn 의 존 판). 없는 존 멱등 no-op. z2 stop 후 placed 2·running 2·z2 사라짐·drift 0·zonesRetired 1(미존 zX no-op). ==');
  console.log('seed   | placed | running | z2 run | retired | stops | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // z2 퇴역: placed 2(z1,z3)·running 2·z2 결정/집행 모두 제거·drift 0·zonesRetired 1·stops 2(zX 멱등).
    const ok = check(o.placedCount() === 2 && o.runningCount() === 2 && o.placementOf('z2') === null && o.runningHostOf('z2') === null && o.placementDrift() === 0 && o.zonesRetired === 1 && o.stops === 2,
      `seed ${seed}: stop 위반 (placed ${o.placedCount()}·running ${o.runningCount()}·z2 ${o.runningHostOf('z2')}·retired ${o.zonesRetired}·drift ${o.placementDrift()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.placedCount(), 6)} | ${pad(o.runningCount(), 7)} | ${pad(o.runningHostOf('z2') || '-', 6)} | ${pad(o.zonesRetired, 7)} | ${pad(o.stops, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placestopexec'] = placestopexec;
kit.ORDER.splice(1, 0, 'placestopexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
