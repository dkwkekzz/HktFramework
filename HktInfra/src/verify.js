// HktInfra step-0241 — 헤드리스 검증 (배치 SSOT 실배선 #51 — 존 런타임 레지스트리·placeExecute)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placeexec`.
//   더한 한 조각: placeExecute ON 이면 placeZone 이 paper placement 갱신에 더해 실 존 런타임을 띄운다(running.set·starts++). placement(결정)≡running(집행) drift 0. 미주입/OFF → 0240 비트 동일(reg). #51 실배선 1.
//   검증: ⒜ `reg`(키트). ⒝ `placeexec`(가설) — z1@hostA·z2@hostB 실 가동·z1 재배치 멱등 → running 2·starts 2·결정==집행.
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
// z1@hostA·z2@hostB 실 가동 → z1@hostA 재배치(멱등·신규 start 아님).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z1', 'hostA')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placeexec(seeds) {
  console.log('== placeexec (0241·#51 실배선): 존 런타임 레지스트리 — placeExecute ON 이면 placeZone 이 paper placement(결정) 갱신에 더해 실 존 런타임을 host 에 띄운다(running=executed SSOT). z1@hostA·z2@hostB 가동·z1 재배치는 멱등(신규 start 아님). placement(결정)==running(집행)·drift 0. ==');
  console.log('seed   | placed | running | z1 run | A run | starts | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // running(집행) == placement(결정): z1@hostA·z2@hostB 실 가동(running 2)·재배치 멱등(starts 2)·결정/집행 일치.
    const ok = check(o.runningCount() === 2 && o.placedCount() === 2 && o.runningHostOf('z1') === 'hostA' && o.runningHostOf('z2') === 'hostB' && o.runningOn('hostA') === 1 && o.starts === 2 && o.placementOf('z1') === o.runningHostOf('z1'),
      `seed ${seed}: 실배선 위반 (running ${o.runningCount()}·z1 ${o.runningHostOf('z1')}·starts ${o.starts}·placed ${o.placedCount()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.placedCount(), 6)} | ${pad(o.runningCount(), 7)} | ${pad(o.runningHostOf('z1') || '-', 6)} | ${pad(o.runningOn('hostA'), 5)} | ${pad(o.starts, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placeexec'] = placeexec;
kit.ORDER.splice(1, 0, 'placeexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
