// HktInfra step-0224 — 헤드리스 검증 (오케스트레이터 host 드레인·placeDrain)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placedrain`.
//   더한 한 조각: placeDrain{host,hosts} → host 의 모든 존을 나머지 host 중 최소부하로 이주(release+acquire 연쇄·드레인 후 부하 0·정비/퇴역). 미주입 → 0223 비트 동일(reg). 3차 고도화 오케 #2.
//   검증: ⒜ `reg`(키트). ⒝ `placedrain`(가설) — A 2존·B/C 1존 → drain A → A 0·존 B/C 로 분산.
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
// z1·z2 → hostA(부하 2), z3 → hostB, z4 → hostC → drain A → A 비움(0)·z1/z2 를 B/C 로 분산.
const OPS = [
  PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), PLACE(4, 'z4', 'hostC'),
  DRAIN(5, 'hostA', ['hostA', 'hostB', 'hostC']),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };

function placedrain(seeds) {
  console.log('== placedrain: 오케스트레이터 host 드레인(placeDrain) — 정비/퇴역할 host 의 *모든* 존을 나머지 host 중 최소부하로 차례차례 이주(release+acquire 연쇄·권위 단일 소유 보존·드레인 후 그 host 부하 0). 매 존마다 최소부하 재계산(고른 분산). 3차 고도화 오케 #2. ==');
  console.log('seed   | A부하 | B부하 | C부하 | moves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // drain A: A 0·z1→B(B=2)·z2→C(C=2)·drainMoves 2.
    const ok = check(o.hostLoad('hostA') === 0 && o.hostLoad('hostB') === 2 && o.hostLoad('hostC') === 2 && o.drainMoves === 2 && o.placementOf('z1') === 'hostB' && o.placementOf('z2') === 'hostC',
      `seed ${seed}: drain 위반 (A ${o.hostLoad('hostA')}·B ${o.hostLoad('hostB')}·C ${o.hostLoad('hostC')}·moves ${o.drainMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostLoad('hostA'), 5)} | ${pad(o.hostLoad('hostB'), 5)} | ${pad(o.hostLoad('hostC'), 5)} | ${pad(o.drainMoves, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 퇴역할 hostA(z1·z2)를 드레인하면 두 존이 최소부하 host 로 차례 이주(z1→B·z2→C)해 A 부하 0(비움)·B/C 각 2(고른 분산) — 정비/스케일다운 시 그 머신을 안전히 빼낸다(release+acquire 연쇄·권위 보존). 어떤 단일 host 도 영구 중심이 아니다(SPINE §2). 오케 3차 고도화 #2.');
}

kit.MODES['placedrain'] = placedrain;
kit.ORDER.splice(1, 0, 'placedrain');

(async () => { process.exit(await kit.cli(process.argv)); })();
