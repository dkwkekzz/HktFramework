// HktInfra step-0118 — 헤드리스 검증 (거래소↔가방 buy 입금·exchInventory leg 2·escrow→구매자 실물 인도)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exinvbuy`.
//   더한 한 조각: 0117 은 list 인출 레그만(escrow 실체화) — exchBuy 는 거래소 sold 회계만 굴리고 구매자 가방엔 아이템 미인도. 입금 레그 추가: exchBuy 성립 시 거래소가 가방에 give(itemId, escrow→buyer) → escrow custody 가 구매자 가방으로(인출 0117 의 짝). list(인출)+buy(인도)가 *존 넘는 실물 거래* 완성. 가방 권위·minted 불변·xfer++.
//   검증: ⒜ `reg`(키트) — exchInventory OFF·itemId 부재면 give 0 = 0117 비트 동일. ⒝ `exinvbuy`(가설) — 선-적재→list 4→buy id1(b1)·id2(b2). ON: item0→b1·item1→b2·escrow 2(item2/3)·판매자 0·gives 6(list4+buy2)·minted 4 불변. OFF: 구매자 0/판매자 4·gives 0.
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
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20, itemId: 'item3' } },
  { at: 74, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },   // item0 → b1
  { at: 75, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },   // item1 → b2
];
const ownedBy = (inv, av) => [...inv.ledger.values()].filter(o => o === av).length;
const P = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, invOps: INV, exchangeOps: OPS, ...extra });

function exinvbuy(seeds) {
  console.log('== exinvbuy: *가설* — 거래소↔가방 buy 입금(exchInventory leg 2). exchBuy 시 거래소가 가방에 give(itemId, escrow→buyer) → escrow custody 가 구매자 가방으로(인출 0117 의 짝). list+buy 가 존 넘는 실물 거래 완성. ON vs OFF ==');
  console.log('  선-적재→list 4→buy id1(b1)·id2(b2). ON: item0→b1·item1→b2·escrow 2(item2/3)·판매자 0·gives 6(list4+buy2)·minted 4 불변. OFF: 구매자 0·판매자 4·gives 0.');
  console.log('seed   | b1소유 | b2소유 | escrow | 판매자 | gives | minted | sold | conserved | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P(seed, { exchInventory: true }) });
    const off = run({ ...P(seed, { exchInventory: false }) });   // 추상 sold(0117 give 인출만·0116 buy)
    const inv = on.inventory; const ex = on.exchange;
    const b1 = ownedBy(inv, 'b1'); const b2 = ownedBy(inv, 'b2'); const esc = ownedBy(inv, 'escrow'); const sellerOwn = ownedBy(inv, 's1') + ownedBy(inv, 's2');
    const gives = ex.gives; const minted = inv.minted; const sold = ex.sold; const conserved = ex.conserved();
    const offBuyers = ownedBy(off.inventory, 'b1') + ownedBy(off.inventory, 'b2'); const offGives = off.exchange.gives;
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(b1 === 1 && b2 === 1, `seed ${seed}: ON 구매자 보유 기대 b1 1/b2 1·실제 ${b1}/${b2}`) &&
      check(esc === 2 && sellerOwn === 0, `seed ${seed}: ON escrow 기대 2/판매자 0·실제 ${esc}/${sellerOwn}`) &&
      check(gives === 6 && minted === 4 && sold === 2, `seed ${seed}: ON gives/minted/sold 기대 6/4/2·실제 ${gives}/${minted}/${sold}`) &&
      check(offBuyers === 0 && offGives === 0, `seed ${seed}: OFF 구매자 보유/gives 기대 0·실제 ${offBuyers}/${offGives}`) &&
      check(conserved && mintedEq, `seed ${seed}: 입금이 세계 mint 바꿈/보존 위반(minted ${on.inventory.minted}/${off.inventory.minted}·conserved ${conserved})`);
    console.log(`${pad(seed, 6)} | ${pad(b1, 6)} | ${pad(b2, 6)} | ${pad(esc, 6)} | ${pad(sellerOwn, 6)} | ${pad(gives, 5)} | ${pad(minted, 6)} | ${pad(sold, 4)} | ${pad(conserved + '', 9)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → list(인출 0117)+buy(인도 0118)가 *존 넘는 실물 거래*를 완성한다: 판매자가 escrow 에 맡긴 실제 가방 아이템이 체결 시 구매자 가방으로 간다(거래소→가방 give escrow→buyer). 가방이 권위(소유 전이는 가방이 수행)·거래소는 요청만. 가방 total(minted) 불변(전부 이동).');
  console.log('    exchInventory OFF·itemId 부재 = give 0 = 0117 비트 동일(reg·추상 sold). 비-침습: 입금은 가방 권위 안의 이동일 뿐 세계 mint 불변·존 tick 밖(거래소→가방 명시 인터페이스 give·은닉). cancel/expire 반환 레그는 후속.');
}

kit.MODES['exinvbuy'] = exinvbuy;
kit.ORDER.splice(1, 0, 'exinvbuy');

(async () => { process.exit(await kit.cli(process.argv)); })();
