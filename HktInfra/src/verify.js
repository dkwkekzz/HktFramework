// HktInfra step-0223 — 헤드리스 검증 (오케스트레이터 부하 재배치 자동 트리거·placeRebalance)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placerebalance`.
//   더한 한 조각: placeRebalance{hosts} → 후보 부하 불균형(최대−최소≥2)이면 최대→최소 host 로 존 자동 이주(균형까지·0218 자동 트리거판). 미주입 → 0222 비트 동일(reg). 3차 고도화 오케 #1.
//   검증: ⒜ `reg`(키트). ⒝ `placerebalance`(가설) — 3존 모두 hostA → rebalance → A/B/C 각 1(균형).
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
const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
// z1·z2·z3 모두 hostA 에 배치(A 과부하 3·B/C 0) → rebalance[A,B,C] → 균형(A1·B1·C1).
const OPS = [
  PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'),
  REBAL(4, ['hostA', 'hostB', 'hostC']),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };

function placerebalance(seeds) {
  console.log('== placerebalance: 오케스트레이터 부하 재배치 자동 트리거(placeRebalance) — 후보 host 부하 불균형(최대−최소≥2)이면 최대부하 host 의 존을 최소부하 host 로 자동 이주(균형까지 한 패스 수렴·0218 placeMigrate 의 자동 트리거판·release+acquire). 정적 배치 한계 제거. 3차 고도화 오케 #1. ==');
  console.log('seed   | A부하 | B부하 | C부하 | moves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // 3존 모두 A → rebalance → A1·B1·C1(균형)·moves 2(z1→B·z2→C).
    const ok = check(o.hostLoad('hostA') === 1 && o.hostLoad('hostB') === 1 && o.hostLoad('hostC') === 1 && o.rebalanceMoves === 2 && o.placementOf('z3') === 'hostA',
      `seed ${seed}: rebalance 위반 (A ${o.hostLoad('hostA')}·B ${o.hostLoad('hostB')}·C ${o.hostLoad('hostC')}·moves ${o.rebalanceMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostLoad('hostA'), 5)} | ${pad(o.hostLoad('hostB'), 5)} | ${pad(o.hostLoad('hostC'), 5)} | ${pad(o.rebalanceMoves, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 3존이 모두 hostA 에 몰린 불균형(3/0/0)을 자동 트리거가 A1/B1/C1 균형으로 수렴(moves 2·z1→B·z2→C·z3 잔류) — 운영자가 손으로 placeMigrate(0218) 하지 않아도 부하 임계 초과를 오케가 스스로 해소. 부하 분산 자동화. 오케 3차 고도화 #1.');
}

kit.MODES['placerebalance'] = placerebalance;
kit.ORDER.splice(1, 0, 'placerebalance');

(async () => { process.exit(await kit.cli(process.argv)); })();
