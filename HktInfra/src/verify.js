// HktInfra step-0201 — 헤드리스 검증 (인스턴스 서버 분리·spawn 기본·instanceService/instanceSpawn)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `instancespawn`.
//   더한 한 조각: InstanceServer 박스 — 던전/매치 일회성 인스턴스의 spawn SSOT(존과 수명주기 분리). instanceSpawn 으로 인스턴스를 띄우고 active SSOT 에 잡힘(멱등 재-spawn no-op). instanceService OFF → 박스 0 → 0200 비트 동일(reg). 1차 너비: 기본 통신만(despawn·라우팅은 0202~).
//   검증: ⒜ `reg`(키트) — 0200 비트 동일. ⒝ `instancespawn`(가설) — spawn 3종+멱등 재-spawn → activeCount==3·각 isActive·미spawn isActive=false.
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
// 시나리오: 던전 3종 spawn + 같은 id 재-spawn(멱등 no-op) 섞임.
const OPS = [
  SPAWN(2, 'd1', 'dungeon'), SPAWN(3, 'd2', 'dungeon'), SPAWN(4, 'd1', 'dungeon'),   // d1 재-spawn → 멱등(active 2).
  SPAWN(5, 'd3', 'arena'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };

function instancespawn(seeds) {
  console.log('== instancespawn: 인스턴스(던전) 서버 분리 — spawn 기본. 던전/매치 일회성 인스턴스를 수요 따라 띄우고 active SSOT 에 잡힘(멱등 재-spawn no-op·권위 단일 소유). 존과 수명주기 분리. ==');
  console.log('seed   | active | d1 | d2 | d3 | d9(미spawn) | spawns | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const active = r.instance.activeCount();
    const d1 = r.instance.isActive('d1'), d2 = r.instance.isActive('d2'), d3 = r.instance.isActive('d3'), d9 = r.instance.isActive('d9');
    const ok = check(active === 3 && d1 && d2 && d3 && !d9 && r.instance.spawns === 4,
      `seed ${seed}: spawn 위반 (active ${active}·spawns ${r.instance.spawns})`);
    console.log(`${pad(seed, 6)} | ${pad(active, 6)} | ${pad(d1 ? '예' : '아니오', 2)} | ${pad(d2 ? '예' : '아니오', 2)} | ${pad(d3 ? '예' : '아니오', 2)} | ${pad(d9 ? '예' : '아니오', 11)} | ${pad(r.instance.spawns, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → InstanceServer 가 던전/매치 일회성 인스턴스의 *어떤 게 살아있나* SSOT(권위 단일 소유). spawn 4회 중 d1 재-spawn 은 멱등 no-op → active 3(중복 0). 존과 수명주기 분리(존=영속 tick·인스턴스=수요 탄력). 1차 너비 기본 통신 — despawn/라우팅은 0202~.');
}

kit.MODES['instancespawn'] = instancespawn;
kit.ORDER.splice(1, 0, 'instancespawn');

(async () => { process.exit(await kit.cli(process.argv)); })();
