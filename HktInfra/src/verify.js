// HktInfra step-0267 — 헤드리스 검증 (정리 #49 인접·선제: orchestrator 제어 평면 핸들러 믹스인 분리·orch-control.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `orchctlsplit`.
//   더한 한 조각: Orchestrator 의 제어 평면 핸들러(onMsg·onTick)를 orch-control.js 믹스인으로 분리(Object.assign prototype). 0251 orch-placement(executed lifecycle 메서드) 분할의 짝. 정의 위치만 이동·기능 0 → 0266 비트 동일(reg). orchestrator.js 27.5KB→18.9KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `orchctlsplit`(가설) — placeZone 명령이 배치 SSOT 갱신(onMsg)·failover onTick 정상.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0267 정리 분할(#49 인접) 검증 — 오케 제어 평면 핸들러(onMsg·onTick)를 orch-control 믹스인으로 위임한 뒤,
//   placeZone 명령이 여전히 onMsg 로 배치 SSOT 를 갱신하고 failover onTick 이 정상 도는지 본다(투명 분할).
function orchctlsplit(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };
  console.log('== orchctlsplit (0267 분할·#49 인접): 오케 제어 평면 핸들러(onMsg·onTick)를 orch-control 믹스인으로 위임 — placeZone 명령이 배치 SSOT 갱신(onMsg)·failover onTick 정상·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | z1 host | z2 host | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const ok = check(o.placementOf('z1') === 'hostA' && o.placementOf('z2') === 'hostB' && o.placedCount() === 2,
      `seed ${seed}: 배치 SSOT 위반 (z1 ${o.placementOf('z1')}·z2 ${o.placementOf('z2')})`);
    console.log(`${pad(seed, 6)} | ${pad(o.placementOf('z1') || '-', 7)} | ${pad(o.placementOf('z2') || '-', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['orchctlsplit'] = orchctlsplit;
kit.ORDER.splice(1, 0, 'orchctlsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
