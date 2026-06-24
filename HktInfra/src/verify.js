// HktInfra step-0218 — 헤드리스 검증 (오케스트레이터 존 재배치 핸드오프·placeMigrate·권위 단일 소유)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placemigrate`.
//   더한 한 조각: placeMigrate{zoneId,toHost} → 이미 배치된 존을 release(기존)+acquire(toHost) 쌍으로 이동(권위 단일 소유 보존·공백/중복 0). 미배치/같은 host 거부. 미주입 → 0217 비트 동일(reg). 2차 고도화 오케 #2.
//   검증: ⒜ `reg`(키트). ⒝ `placemigrate`(가설) — z1@A·z2@B → z1 migrate→C, 같은 host 재요청·미배치 z9 거부 → 총 배치 수 보존(공백/중복 0).
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
// z1@A·z2@B → z1 migrate A→C → 같은 host(C) 재요청 거부 → 미배치 z9 migrate 거부.
const OPS = [
  PLACE(2, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'),
  MIGRATE(4, 'z1', 'hostC'),
  MIGRATE(6, 'z1', 'hostC'),
  MIGRATE(7, 'z9', 'hostA'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };

function placemigrate(seeds) {
  console.log('== placemigrate: 오케스트레이터 존 재배치 핸드오프(placeMigrate) — 배치된 존을 release(기존)+acquire(신규) 쌍으로 이동(권위 단일 소유 보존·공백/중복 0·0006 핸드오프 배치 판). 미배치/같은 host 거부. 2차 고도화 오케스트레이터 #2. ==');
  console.log('seed   | z1 | 부하 A/B/C | placed | migrate/reject | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 9, ...BASE });
    const o = r.orch;
    const z1 = o.placementOf('z1');
    const la = o.hostLoad('hostA'), lb = o.hostLoad('hostB'), lc = o.hostLoad('hostC');
    // z1 A→C 이동·z2 B 유지 → A 0·B 1·C 1. 총 배치 2 보존(공백/중복 0). migrations 1·rejects 2(같은 host+미배치).
    const ok = check(z1 === 'hostC' && la === 0 && lb === 1 && lc === 1 && o.placedCount() === 2 && o.migrations === 1 && o.migrateRejects === 2,
      `seed ${seed}: 재배치 위반 (z1 ${z1}·부하 ${la}/${lb}/${lc}·placed ${o.placedCount()}·mig ${o.migrations}/rej ${o.migrateRejects})`);
    console.log(`${pad(seed, 6)} | ${pad(z1.replace('host', ''), 4)} | ${pad(la + '/' + lb + '/' + lc, 9)} | ${pad(o.placedCount(), 6)} | ${pad(o.migrations + '/' + o.migrateRejects, 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → placeMigrate 가 존을 release+acquire 쌍으로 옮긴다(z1 A→C·A 부하 줄고 C 늘어). 총 배치 수가 보존돼(공백/중복 0·권위 단일 소유) 어느 순간에도 존 소유 host 가 정확히 1. 미배치/같은 host 는 거부(reject 2). 부하 재균형·재배치 토대. 오케스트레이터 2차 고도화 #2.');
}

kit.MODES['placemigrate'] = placemigrate;
kit.ORDER.splice(1, 0, 'placemigrate');

(async () => { process.exit(await kit.cli(process.argv)); })();
