// HktInfra step-0120 — 헤드리스 검증 (거래소↔가방 2-서비스 보존 불변·escrowItemIds 단언)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exinvconsv`.
//   더한 한 조각: 0117~0119 가 거래소↔가방을 escrow 중개로 결합 — 이제 두 서비스에 걸친 보존을 단언한다. 거래소 open 매물 itemId 집합(escrowItemIds) ≡ 가방 원장의 'escrow' 소유 itemId 집합(거래소 회계 ≡ 가방 권위·불일치 0). 전 거래 흐름(list/buy/cancel/expire 혼합)서 가방 total(minted) 불변·매 아이템 정확히 한 소유자.
//   검증: ⒜ `reg`(키트) — escrowItemIds 는 미호출 읽기 accessor = 0119 비트 동일. ⒝ `exinvconsv`(가설) — 5 적재→list 5(4 조기·1 늦게)→buy 2·cancel 1·sweep 만료 1. 끝: item0→b1·item1→b2(sold)·item2→s2(cancel)·item3→s2(expire)·item4→escrow(open). escrowItemIds==['item4']==가방 escrow 소유·minted 5 불변·각 1소유자·conserved.
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
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item1
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item2
  { at: 63, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item3
  { at: 64, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item4
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20, itemId: 'item3' } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },           // item0 → b1 (sold)
  { at: 76, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },           // item1 → b2 (sold)
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 3 } },       // item2 → s2 (cancel)
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item4' } },   // 늦게 list(만료 회피)
  { at: 85, op: { type: 'exchSweep', now: 85 } },                    // id4(item3·@73·age12) 만료→s2 / id5(item4·@82·age3) open 유지
];
const TTL = 5;
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchangeTtl: TTL, invOps: INV, exchangeOps: OPS, ...extra });

function exinvconsv(seeds) {
  console.log('== exinvconsv: *가설* — 거래소↔가방 2-서비스 보존 불변. 거래소 open 매물 itemId(escrowItemIds) ≡ 가방 원장 escrow 소유 itemId(거래소 회계≡가방 권위). 전 거래 흐름서 가방 total 불변·매 아이템 한 소유자. ==');
  console.log('  5 적재→list 5→buy 2·cancel 1·만료 1·open 1. 끝: item0→b1/item1→b2(sold)·item2→s2(cancel)·item3→s2(expire)·item4→escrow(open). escrowItemIds==가방 escrow 소유==[item4].');
  console.log('seed   | escrow소유 | open매물itemId | 일치 | minted | open | sold/can/exp | 한소유자합=5 | conserved | 판정');
  for (const seed of seeds) {
    const r = run({ ...P(seed, {}) });
    const inv = r.inventory; const ex = r.exchange;
    const escOwned = ownedSet(inv, 'escrow');              // 가방 원장에서 실제 escrow 소유
    const exOpen = ex.escrowItemIds();                     // 거래소가 믿는 open 매물 itemId
    const match = JSON.stringify(escOwned) === JSON.stringify(exOpen);   // 2-서비스 일치(회계 ≡ 권위)
    const minted = inv.minted; const open = ex.open();
    // 매 아이템 정확히 한 소유자: ledger 5개·각 소유자 1명(byOwner 합 == 5)
    const byOwnerSum = ownedSet(inv, 's1').length + ownedSet(inv, 's2').length + ownedSet(inv, 'b1').length + ownedSet(inv, 'b2').length + escOwned.length;
    const conserved = ex.conserved();
    const ok =
      check(match && escOwned.length === 1 && escOwned[0] === 'item4', `seed ${seed}: 2-서비스 불일치(가방 escrow ${JSON.stringify(escOwned)} != 거래소 open ${JSON.stringify(exOpen)})`) &&
      check(minted === 5 && open === 1, `seed ${seed}: minted/open 기대 5/1·실제 ${minted}/${open}`) &&
      check(ex.sold === 2 && ex.cancelled === 1 && ex.expired === 1, `seed ${seed}: sold/can/exp 기대 2/1/1·실제 ${ex.sold}/${ex.cancelled}/${ex.expired}`) &&
      check(byOwnerSum === 5 && ledgerConsistent(r) && itemConserved(r), `seed ${seed}: 아이템 소유자 합 != 5(${byOwnerSum})·원장 정합 위반`) &&
      check(conserved, `seed ${seed}: 거래소 보존 위반(listed != open+sold+cancelled+expired)`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(escOwned), 10)} | ${pad(JSON.stringify(exOpen), 14)} | ${pad(match + '', 4)} | ${pad(minted, 6)} | ${pad(open, 4)} | ${pad(ex.sold + '/' + ex.cancelled + '/' + ex.expired, 12)} | ${pad(byOwnerSum, 12)} | ${pad(conserved + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소↔가방 결합이 *두 서비스에 걸친 보존*을 유지한다: 거래소가 믿는 open 매물(escrowItemIds) ≡ 가방 원장이 실제 escrow 에 가진 아이템(회계 ≡ 권위·불일치 0). 전 거래 흐름(list/buy/cancel/expire 혼합)서 가방 total(minted) 불변이고 매 아이템은 정확히 한 소유자 — 0014 가방의 "단일 소유"가 *두 서비스 결합*에도 보존(escrow 중개 닫힌 장부).');
  console.log('    escrowItemIds 는 미호출 읽기 accessor = 0119 비트 동일(reg). 이 step 은 *결합 시스템의 창발 불변*을 단언 — 거래소↔가방 arc(0117 인출→0118 입금→0119 반환→0120 보존)가 존 넘는 실물 거래를 닫는다.');
}

kit.MODES['exinvconsv'] = exinvconsv;
kit.ORDER.splice(1, 0, 'exinvconsv');

(async () => { process.exit(await kit.cli(process.argv)); })();
