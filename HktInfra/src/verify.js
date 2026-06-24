// HktInfra step-0244 — 헤드리스 검증 (배치 SSOT 실배선 #51 — executed placeDrain)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placedrainexec`.
//   더한 한 조각: placeExecute ON 이면 host 드레인(placeDrain)이 paper 갱신마다 실 존 런타임도 _migrate(0242)로 이주 → 드레인 후 그 host running 0(실제 비워짐·0224 퇴역 안전 이주의 집행 판). 미주입/OFF → 0243 비트 동일(reg). #51 실배선 4.
//   검증: ⒜ `reg`(키트). ⒝ `placedrainexec`(가설) — z1·z2@A·z3@B·z4@C 가동 → A 드레인 → running A 0·B 2·C 2·rtMig 2·결정==집행.
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
const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
// z1·z2@hostA·z3@hostB·z4@hostC 실 가동 → hostA 드레인(퇴역) → 실 런타임 이주(A 비워짐).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), PLACE(4, 'z4', 'hostC'), DRAIN(5, 'hostA', ['hostA', 'hostB', 'hostC'])];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placedrainexec(seeds) {
  console.log('== placedrainexec (0244·#51 실배선): executed placeDrain — placeExecute ON 이면 host 드레인이 paper 갱신마다 실 존 런타임도 _migrate(release+acquire)로 이주 → 드레인 후 그 host running 0(*실제* 비워짐·0224 퇴역 안전 이주의 집행 판). z1·z2@A·z3@B·z4@C → A 드레인 → running A 0·B 2·C 2·rtMig 2·결정==집행. ==');
  console.log('seed   | A run | B run | C run | rtMig | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // 실 드레인: running A 0·B 2·C 2·runtimeMigrations 2·z1 hostB·z2 hostC·결정==집행 전 존.
    const ok = check(o.runningOn('hostA') === 0 && o.runningOn('hostB') === 2 && o.runningOn('hostC') === 2 && o.runtimeMigrations === 2 && o.runningHostOf('z1') === 'hostB' && o.runningHostOf('z2') === 'hostC' &&
      ['z1', 'z2', 'z3', 'z4'].every(z => o.placementOf(z) === o.runningHostOf(z)),
      `seed ${seed}: 실 드레인 위반 (A ${o.runningOn('hostA')}·B ${o.runningOn('hostB')}·C ${o.runningOn('hostC')}·rtMig ${o.runtimeMigrations})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runningOn('hostA'), 5)} | ${pad(o.runningOn('hostB'), 5)} | ${pad(o.runningOn('hostC'), 5)} | ${pad(o.runtimeMigrations, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placedrainexec'] = placedrainexec;
kit.ORDER.splice(1, 0, 'placedrainexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
