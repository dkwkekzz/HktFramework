// HktInfra step-0140 — 헤드리스 검증 (saga liveness 회계 정합 capstone·sagaLiveConsistent — 0131~0139 arc 의 창발 불변)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagalive`.
//   더한 한 조각: 0131~0139 가 saga liveness FSM(재전송 상한→포기→재admission→자동 트리거→재admission 상한→영구 실패→회복 발행)을 쌓았다. 그 회계가 *대수적으로 닫혀* 있는가? sagaLiveConsistent: 미해결(pending) give 는 정확히 한 상태 — 재전송 중(pendingGive)·재admission 대기(abandonedGive)·영구 종결(permFailed) 으로 분할(공백·중복 0)된다. pending.size == pendingGive + abandonedGive + permFailed, + 0128 sagaConsistent AND.
//   검증: ⒜ `reg`(키트) — 미호출 accessor = 0139 비트 동일. ⒝ `exsagalive`(가설) — 4체제(정상·포기·재admission 회복·영구 실패)서 sagaLiveConsistent 전부 true + 각 체제 분할 카운트 일치. liveness 회계 닫힘을 capstone 으로 단언.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const INV = [{ at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } }];   // item0
const SW = (at) => ({ at, op: { type: 'exchSweep', now: at } });
const READMIT = (at) => ({ at, op: { type: 'exchReadmit' } });
const LIST = { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } };
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
// 영구 손실(tail<HEAL 이면 해소) — 체제별로 HEAL 조정.
const LOSS = (seed, heal) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && (heal == null || m.tick < heal) });
const base = (seed, ops, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, invOps: INV, exchangeOps: ops, ...extra });

// 4 체제: 정상(무손실)·포기(영구 손실+cap)·재admission 회복(손실 해소+readmit)·영구 실패(영구 손실+readmitMax 초과)
const REGIMES = (seed) => ({
  normal:  base(seed, [LIST, SW(80)], { sagaMaxRetries: 2 }),                                   // 무손실 → pending 0
  abandon: base(seed, [LIST, SW(74), SW(78)], { sagaMaxRetries: 1, transport: LOSS(seed) }),    // 영구 손실 → 포기(abandonedGive 1)
  recover: base(seed, [LIST, SW(76), SW(80), SW(84), READMIT(88), SW(90)], { sagaMaxRetries: 2, transport: LOSS(seed, 86) }),   // 손실 해소+readmit → drain
  permfail: base(seed, [LIST, SW(72), SW(74), READMIT(75), SW(76), SW(78), READMIT(79), SW(80), SW(82)], { sagaMaxRetries: 1, readmitMax: 2, transport: LOSS(seed) }),   // 영구 손실 → 영구 실패(permFailed 1)
});

function exsagalive(seeds) {
  console.log('== exsagalive: *capstone* — saga liveness 회계 정합(sagaLiveConsistent). 미해결 give 는 정확히 한 상태: 재전송 중(pendingGive)·재admission 대기(abandonedGive)·영구 종결(permFailed). pending == 셋의 합(공백·중복 0) + 0128 sagaConsistent. 4체제(정상·포기·재admission 회복·영구실패) 전부 성립. ==');
  console.log('seed   | normal(p/pg/ab/pf) | abandon | recover | permfail | 4체제 sagaLiveConsistent | open==escrow | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const snap = (r) => { const e = r.exchange; return e.pendingGives() + '/' + e.pendingGive.size + '/' + e.abandonedGive.size + '/' + e.permFailed; };
    const live = Object.values(runs).every(r => r.exchange.sagaLiveConsistent());
    // 각 체제 기대 분할: normal pending 0 / abandon abandonedGive 1 / recover pending 0(drain) / permfail permFailed 1
    const shapes =
      runs.normal.exchange.pendingGives() === 0 &&
      runs.abandon.exchange.abandonedGive.size === 1 && runs.abandon.exchange.pendingGives() === 1 &&
      runs.recover.exchange.pendingGives() === 0 && runs.recover.exchange.readmitted === 1 &&
      runs.permfail.exchange.permFailed === 1 && runs.permfail.exchange.pendingGives() === 1;
    const safe = Object.values(runs).every(r => JSON.stringify(ownedSet(r.inventory, 'escrow')) === JSON.stringify(r.exchange.escrowItemIds()));
    const ok =
      check(live, `seed ${seed}: 어느 체제서 sagaLiveConsistent false`) &&
      check(shapes, `seed ${seed}: 체제별 분할 카운트 기대 어긋남(normal ${snap(runs.normal)}·abandon ${snap(runs.abandon)}·recover ${snap(runs.recover)}·permfail ${snap(runs.permfail)})`) &&
      check(safe, `seed ${seed}: 어느 체제서 open!=escrow(2-서비스 안전 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.normal), 18)} | ${pad(snap(runs.abandon), 7)} | ${pad(snap(runs.recover), 7)} | ${pad(snap(runs.permfail), 8)} | ${pad(live ? '예(4/4)' : '아니오', 23)} | ${pad(safe ? '예' : '아니오', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → liveness 회계가 *대수적으로 닫힌다*: 미해결 give 는 매 순간 정확히 한 상태(재전송 중 pendingGive·재admission 대기 abandonedGive·영구 종결 permFailed)에 있고 pending == 셋의 합(공백·중복 0) — 0131~0139 arc(상한·포기·재admission·자동 트리거·영구 실패)가 더한 모든 전이가 이 분할을 보존한다. 0128 sagaConsistent(보낸/받은 회계)와 AND 로 saga 회계 전체가 닫힘.');
  console.log('    형식: p(pending)/pg(pendingGive)/ab(abandonedGive)/pf(permFailed). 정상 0/0/0/0·포기 1/0/1/0·재admission 회복 0/0/0/0·영구실패 1/0/0/1 — 각 체제가 다른 분할이되 pending==pg+ab+pf 불변. 모든 체제 open==escrow(2-서비스 안전). sagaLiveConsistent 는 미호출 accessor = 0139 비트 동일(reg).');
}

kit.MODES['exsagalive'] = exsagalive;
kit.ORDER.splice(1, 0, 'exsagalive');

(async () => { process.exit(await kit.cli(process.argv)); })();
