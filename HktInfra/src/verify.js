// HktInfra step-0117 — 헤드리스 검증 (거래소↔가방 list 인출·exchInventory leg 1·escrow 실체화)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exinvlist`.
//   더한 한 조각: 0107~0116 escrow 는 추상(거래소 카운터)이라 list 후에도 판매자가 가방 아이템을 계속 보유(0107 §9). escrow 를 *가방 원장의 reserved 아바타 'escrow'* 로 실체화: exchList{seller,itemId} 시 거래소가 가방에 give(itemId, seller→escrow) → 아이템이 escrow custody 로(2-서비스 쌍 거래의 인출 레그). 가방이 권위(판매자 이중 판매 불가)·가방 total(minted) 불변·xfer++.
//   검증: ⒜ `reg`(키트) — exchInventory OFF·itemId 부재면 give 0 = 0116 비트 동일(추상 escrow). ⒝ `exinvlist`(가설) — 판매자 가방 선-적재(invOps pickup)→exchList(itemId). ON: 4 아이템 'escrow' 소유·판매자 0·gives/transfers 4·minted 불변·open 4·conserved. OFF: 아이템 판매자 보유·gives 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 판매자 가방 선-적재(invOps pickup·itemOps 0 라 itemId 결정론: item0..item3)
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
];
const ownedBy = (inv, av) => [...inv.ledger.values()].filter(o => o === av).length;
const P = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, invOps: INV, exchangeOps: OPS, ...extra });

function exinvlist(seeds) {
  console.log('== exinvlist: *가설* — 거래소↔가방 list 인출(exchInventory leg 1). exchList 시 거래소가 가방에 give(itemId, seller→escrow) → escrow 를 가방 원장에 실체화(추상→진짜·2-서비스 쌍 거래 인출 레그). 가방이 권위·minted 불변. ON vs OFF ==');
  console.log('  판매자 가방 선-적재(item0/1=s1·item2/3=s2)→list 4. ON: 4 아이템 escrow 소유·판매자 0·gives/transfers 4·open 4·conserved. OFF: 아이템 판매자 보유·gives 0.');
  console.log('seed   | escrow소유 | 판매자소유 | gives | transfers | minted | open | conserved | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P(seed, { exchInventory: true }) });
    const off = run({ ...P(seed, { exchInventory: false }) });   // 추상 escrow(0116·give 0)
    const inv = on.inventory; const ex = on.exchange;
    const esc = ownedBy(inv, 'escrow'); const sellerOwn = ownedBy(inv, 's1') + ownedBy(inv, 's2');
    const gives = ex.gives; const xfers = inv.transfers; const minted = inv.minted; const open = ex.open();
    const conserved = ex.conserved();
    const offSellerOwn = ownedBy(off.inventory, 's1') + ownedBy(off.inventory, 's2'); const offGives = off.exchange.gives;
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(esc === 4 && sellerOwn === 0, `seed ${seed}: ON escrow 소유 기대 4/판매자 0·실제 ${esc}/${sellerOwn}`) &&
      check(gives === 4 && xfers === 4, `seed ${seed}: ON gives/transfers 기대 4·실제 ${gives}/${xfers}`) &&
      check(minted === 4 && open === 4 && conserved, `seed ${seed}: ON minted/open/conserved 기대 4/4/true·실제 ${minted}/${open}/${conserved}`) &&
      check(offSellerOwn === 4 && offGives === 0, `seed ${seed}: OFF 판매자 보유/gives 기대 4/0·실제 ${offSellerOwn}/${offGives}`) &&
      check(mintedEq, `seed ${seed}: 인출이 세계 mint 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(esc, 10)} | ${pad(sellerOwn, 10)} | ${pad(gives, 5)} | ${pad(xfers, 9)} | ${pad(minted, 6)} | ${pad(open, 4)} | ${pad(conserved + '', 9)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → escrow 가 *가방 원장에 실체화*된다(존 넘는 거래의 진짜 형태): exchList 가 가방에 give(seller→escrow) 를 보내 아이템을 escrow custody 로 옮긴다 — 이후 가방 원장에서 escrow 소유(판매자 이중 판매 불가·가방이 권위). 거래소↔가방 2-서비스 쌍 거래의 *인출* 레그. 가방 total(minted) 불변(이동일 뿐).');
  console.log('    exchInventory OFF·itemId 부재 = give 0 = 0116 비트 동일(reg·추상 escrow). 비-침습: 인출은 가방 권위 안의 이동일 뿐 세계 mint 불변·존 tick 밖(거래소→가방 명시 인터페이스 give·은닉). buy/cancel/expire 입금·반환 레그는 후속.');
}

kit.MODES['exinvlist'] = exinvlist;
kit.ORDER.splice(1, 0, 'exinvlist');

(async () => { process.exit(await kit.cli(process.argv)); })();
