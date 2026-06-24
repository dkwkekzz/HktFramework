// HktInfra step-0251 — 헤드리스 검증 (정리 #49 인접 — 오케스트레이터 배치 런타임 분리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `orchsplit`.
//   더한 한 조각: 배치 SSOT 런타임 메서드(_start/_migrate/_hostDown/_stop/_rebalance/_drain·load helper·placement/executed 질의)를 orch-placement.js 믹스인으로 분리, Object.assign 으로 prototype 되섞음(투명·플래그 없음·reg 0). orchestrator.js 34KB>30KB 트리거 유계화.
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `orchsplit`(가설) — 분리 후에도 executed 배치 lifecycle(start+migrate)이 결정==집행(drift 0)·한 존 정확히 한 host(running 단일 소유)를 유지.
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
const MIGRATE = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
// z1@hostA 가동 → hostC 이주(분리된 _start·_migrate 가 모두 실행되는 경로).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(1, 'z2', 'hostB'), MIGRATE(2, 'z1', 'hostC')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function orchsplit(seeds) {
  console.log('== orchsplit (0251·정리 #49): 오케스트레이터 배치 런타임 분리(orch-placement.js 믹스인) — _start/_migrate/_hostDown/_stop/_rebalance/_drain·질의를 Object.assign 으로 prototype 되섞음. 분리 후에도 executed lifecycle(z1@A 가동+z2@B 가동→z1 hostC 이주)이 결정==집행(drift 0)·running 단일 소유(z1==hostC·z2==hostB) 유지. ==');
  console.log('seed   | z1 running | z2 running | running수 | drift | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // 분리된 믹스인 메서드 호출: runningHostOf·runningCount·placementDrift 가 prototype 에서 정상 해소.
    const z1 = o.runningHostOf('z1'), z2 = o.runningHostOf('z2');
    const drift = o.placementDrift(), rc = o.runningCount();
    const ok = check(z1 === 'hostC' && z2 === 'hostB' && drift === 0 && rc === 2,
      `seed ${seed}: 분리 위반 (z1 ${z1}·z2 ${z2}·drift ${drift}·running ${rc})`);
    console.log(`${pad(seed, 6)} | ${pad(z1 || '-', 10)} | ${pad(z2 || '-', 10)} | ${pad(rc, 9)} | ${pad(drift, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['orchsplit'] = orchsplit;
kit.ORDER.splice(1, 0, 'orchsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
