// HktInfra step-0203 — 헤드리스 검증 (오케스트레이터 존 배치 SSOT·placeZone)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `zoneplace`.
//   더한 한 조각: Orchestrator.placeZone → 배치 맵(zoneId→host·재배치 덮어씀). "누가 어디서 도나"의 배치 결정 권위(코디네이션). placementOps 미주입 → 0202 비트 동일(reg).
//   검증: ⒜ `reg`(키트). ⒝ `zoneplace`(가설) — place 3(zone1@A·zone2@B·zone1@C 재배치) → placedCount 2·zone1=hostC·zone2=hostB.
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
// 시나리오: zone1@hostA·zone2@hostB → zone1@hostC(재배치 덮어씀).
const OPS = [
  PLACE(2, 'zone1', 'hostA'), PLACE(3, 'zone2', 'hostB'), PLACE(4, 'zone1', 'hostC'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, failover: true, bus: true, placementOps: OPS };

function zoneplace(seeds) {
  console.log('== zoneplace: 오케스트레이터 존 배치 SSOT — placeZone 으로 "어느 존을 어느 host 에 둘지" 기록(배치 결정 권위·코디네이션 계층). 재배치는 덮어씀. 정적 배치 한계 제거의 씨앗. ==');
  console.log('seed   | placed | zone1 | zone2 | placements | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const placed = r.orch.placedCount();
    const z1 = r.orch.placementOf('zone1'), z2 = r.orch.placementOf('zone2');
    const ok = check(placed === 2 && z1 === 'hostC' && z2 === 'hostB' && r.orch.placements === 3,
      `seed ${seed}: 배치 위반 (placed ${placed}·z1 ${z1}·z2 ${z2}·placements ${r.orch.placements})`);
    console.log(`${pad(seed, 6)} | ${pad(placed, 6)} | ${pad(z1 || '-', 5)} | ${pad(z2 || '-', 5)} | ${pad(r.orch.placements, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → Orchestrator 가 "누가 어디서 도나"의 배치 SSOT(권위 단일 소유). place 3 회 중 zone1 재배치는 덮어씀 → placed 2·zone1=hostC. 정적 배치(0006 의 2존 고정) 한계를 푸는 코디네이션 씨앗 — 어떤 단일 서버도 영구 중심이 아니다. 기본 통신(질의는 0204).');
}

kit.MODES['zoneplace'] = zoneplace;
kit.ORDER.splice(1, 0, 'zoneplace');

(async () => { process.exit(await kit.cli(process.argv)); })();
