// HktInfra step-0202 — 헤드리스 검증 (인스턴스 서버 despawn·spawn/despawn 수명주기 SSOT 완성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instancedespawn`.
//   더한 한 조각: instanceDespawn → active 에서 제거(없는 id 멱등 no-op). 0201 spawn 의 짝 — 던전/매치 일회성 수명(떴다 사라짐). instanceService OFF → 0200 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — 0201(=0200 비트 동일) 동일. ⒝ `instancedespawn`(가설) — spawn 3 + despawn 1 + 없는 id despawn → active 2·retired 1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SPAWN = (at, instanceId, kind) => ({ at, op: { type: 'instanceSpawn', instanceId, kind } });
const DESPAWN = (at, instanceId) => ({ at, op: { type: 'instanceDespawn', instanceId } });
// 시나리오: 던전 3종 spawn → d2 despawn(종료) → 없는 d9 despawn(멱등 no-op).
const OPS = [
  SPAWN(2, 'd1', 'dungeon'), SPAWN(3, 'd2', 'dungeon'), SPAWN(4, 'd3', 'arena'),
  DESPAWN(5, 'd2'), DESPAWN(6, 'd9'),   // d2 종료(active→2)·d9 없음(멱등 no-op).
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instancedespawn(seeds) {
  console.log('== instancedespawn: 인스턴스 despawn — spawn/despawn 수명주기 SSOT 완성. 던전 종료 시 active 에서 제거(일회성 수명·없는 id 멱등 no-op). 존(영속)과 달리 인스턴스는 떴다 사라진다. ==');
  console.log('seed   | active | d1 | d2(종료) | d3 | despawns | retired | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const active = r.instance.activeCount();
    const d1 = r.instance.isActive('d1'), d2 = r.instance.isActive('d2'), d3 = r.instance.isActive('d3');
    const ok = check(active === 2 && d1 && !d2 && d3 && r.instance.despawns === 2 && r.instance.retired === 1,
      `seed ${seed}: despawn 위반 (active ${active}·despawns ${r.instance.despawns}·retired ${r.instance.retired})`);
    console.log(`${pad(seed, 6)} | ${pad(active, 6)} | ${pad(d1 ? '예' : '아니오', 2)} | ${pad(d2 ? '예' : '아니오', 8)} | ${pad(d3 ? '예' : '아니오', 2)} | ${pad(r.instance.despawns, 8)} | ${pad(r.instance.retired, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → instanceDespawn 으로 던전 종료를 SSOT 에 반영(active 제거). spawn 3·despawn 2(d2 종료+d9 멱등 no-op) → active 2·retired 1(실제 종료만). 일회성 수명(spawn→despawn) 완성 — 존의 영속 수명과 분리. 기본 통신 완비(0203~ 오케스트레이터 배치).');
}

kit.MODES['instancedespawn'] = instancedespawn;
kit.ORDER.splice(1, 0, 'instancedespawn');

(async () => { process.exit(await kit.cli(process.argv)); })();
