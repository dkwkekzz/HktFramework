// HktInfra step-0130 — 헤드리스 검증 (거래소 give ↔ 가방 transfers 정합 capstone·escrowXfers — 두 서비스 회계 합치)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagacap`.
//   더한 한 조각: 거래소↔가방 saga arc(0121~0129)의 capstone. 가방에 escrowXfers(from/to 중 'escrow' 인 성공 transfer) 계측을 더해, *거래소가 믿는* 성공 give 수(giveOks)와 *가방이 실제 실행한* escrow transfer 수(escrowXfers)가 정확히 일치함을 단언 — 두 서비스의 회계가 합치(cross-service 정합). 거래소가 유일한 give 원천이면 가방 총 transfers == escrowXfers 도 성립.
//   검증: ⒜ `reg`(키트) — escrowXfers 는 escrow give 부재면 0 = 0129 비트 동일. ⒝ `exsagacap`(가설) — 전 거래 흐름서 giveOks==escrowXfers==9·가방 transfers==escrowXfers(거래소 유일 give 원천)·minted 5 불변·open==escrow·conserved·sagaConsistent. 0120 물리 정합 + 0128 회계 닫힘을 *두 서비스 transfer 수준*에서 묶는다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },
  { at: 63, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },
  { at: 64, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20, itemId: 'item3' } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },
  { at: 76, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 3 } },
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item4' } },
  { at: 85, op: { type: 'exchSweep', now: 85 } },
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const P = (seed) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, exchangeTtl: 5, invOps: INV, exchangeOps: OPS });

function exsagacap(seeds) {
  console.log('== exsagacap: *가설* — 거래소 give ↔ 가방 transfers 정합 capstone. 거래소가 믿는 성공 give(giveOks) == 가방이 실제 실행한 escrow transfer(escrowXfers) — 두 서비스 회계 합치. 거래소 유일 give 원천이면 가방 transfers==escrowXfers. 0120 물리 정합 + 0128 회계 닫힘을 두 서비스 transfer 수준서 묶음. ==');
  console.log('seed   | giveOks | escrowXfers | inv transfers | giveOks==escrowXfers | xfers==escrowXfers | minted | open==escrow | conserved | 판정');
  for (const seed of seeds) {
    const r = run({ ...P(seed) });
    const ex = r.exchange, inv = r.inventory;
    const esc = ownedSet(inv, 'escrow'), open = ex.escrowItemIds();
    const safe = JSON.stringify(esc) === JSON.stringify(open);
    const cross = ex.giveOks === inv.escrowXfers;                 // 두 서비스 회계 합치(핵심 capstone)
    const soleSrc = inv.transfers === inv.escrowXfers;            // 거래소가 유일 give 원천(itemOps 0) → 모든 transfer 가 escrow
    const ok =
      check(ex.giveOks === 9 && inv.escrowXfers === 9, `seed ${seed}: giveOks/escrowXfers 기대 9(${ex.giveOks}/${inv.escrowXfers})`) &&
      check(cross, `seed ${seed}: 거래소 giveOks(${ex.giveOks}) != 가방 escrowXfers(${inv.escrowXfers}) — 두 서비스 회계 불합치`) &&
      check(soleSrc, `seed ${seed}: 가방 transfers(${inv.transfers}) != escrowXfers(${inv.escrowXfers}) — 비-escrow give 혼입`) &&
      check(safe && inv.minted === 5 && ex.conserved() && ex.sagaConsistent() && itemConserved(r) && ledgerConsistent(r), `seed ${seed}: 보존/정합 깨짐(safe ${safe}·minted ${inv.minted}·conserved ${ex.conserved()}·sagaConsistent ${ex.sagaConsistent()})`);
    console.log(`${pad(seed, 6)} | ${pad(ex.giveOks, 7)} | ${pad(inv.escrowXfers, 11)} | ${pad(inv.transfers, 13)} | ${pad(cross ? '예' : '아니오', 20)} | ${pad(soleSrc ? '예' : '아니오', 18)} | ${pad(inv.minted, 6)} | ${pad((safe ? '예' : '아니오') + ' ' + JSON.stringify(open), 12)} | ${pad(ex.conserved() + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 두 서비스의 회계가 *합치*한다: 거래소가 믿는 성공 escrow give(giveOks 9) == 가방이 실제 실행한 escrow transfer(escrowXfers 9) — 거래소의 *요청 회계*와 가방의 *실행 회계*가 정확히 일치(cross-service 정합). 거래소가 유일 give 원천이라 가방 총 transfers 도 escrowXfers 와 같다(비-escrow give 혼입 0).');
  console.log('    이것이 거래소↔가방 arc 의 capstone: 0120 물리 정합(open 매물 ≡ 가방 escrow 소유)·0128 회계 닫힘(gives==acked+pending)을 *transfer 수준*에서 묶는다 — 한 서비스의 give 결정이 다른 서비스의 원장 변이와 1:1. minted 5 불변·open==escrow·conserved·sagaConsistent 동반. escrowXfers 는 escrow give 부재면 0 = 0129 비트 동일(reg).');
}

kit.MODES['exsagacap'] = exsagacap;
kit.ORDER.splice(1, 0, 'exsagacap');

(async () => { process.exit(await kit.cli(process.argv)); })();
