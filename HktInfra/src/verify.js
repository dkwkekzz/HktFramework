// HktInfra step-0119 — 헤드리스 검증 (거래소↔가방 cancel/expire 반환·exchInventory leg 3·escrow→판매자 실물 반환)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exinvret`.
//   더한 한 조각: 0117 인출+0118 입금으로 list→buy 실물 거래는 닫혔으나 미체결 종결(취소 0107·만료 0114)은 거래소 회계만 굴리고 escrow 아이템이 판매자에게 미반환. 반환 레그 추가: exchCancel·exchSweep 만료 시 거래소가 가방에 give(itemId, escrow→seller). escrow 의 모든 출구(체결→구매자·취소/만료→판매자)가 실물 이동 동반 — 미체결 아이템 영영 묶임 0.
//   검증: ⒜ `reg`(키트) — exchInventory OFF·itemId 부재면 give 0 = 0118 비트 동일. ⒝ `exinvret`(가설) — 선-적재→list 2→cancel id1·sweep 만료 id2. ON: item0→s1(취소 반환)·item1→s2(만료 반환)·escrow 0·gives 4(list2+cancel1+expire1)·minted 2 불변. OFF: escrow 묶임·gives 0.
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
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item1
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's2', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 74, op: { type: 'exchCancel', seller: 's1', id: 1 } },   // item0 → s1 (취소 반환)
  { at: 80, op: { type: 'exchSweep', now: 80 } },                // id2(item1·@71·age 9 ≥ ttl) 만료 → s2 반환
];
const TTL = 5;
const ownedBy = (inv, av) => [...inv.ledger.values()].filter(o => o === av).length;
const P = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchangeTtl: TTL, invOps: INV, exchangeOps: OPS, ...extra });

function exinvret(seeds) {
  console.log('== exinvret: *가설* — 거래소↔가방 cancel/expire 반환(exchInventory leg 3). exchCancel·만료 시 거래소가 가방에 give(itemId, escrow→seller) → escrow 의 모든 출구가 실물 이동(체결→구매자·취소/만료→판매자). ON vs OFF ==');
  console.log('  선-적재→list 2→cancel id1(s1)·sweep 만료 id2(s2). ON: item0→s1·item1→s2·escrow 0·gives 4(list2+cancel1+expire1)·minted 2 불변. OFF: escrow 묶임·gives 0.');
  console.log('seed   | s1소유 | s2소유 | escrow | cancelled | expired | gives | minted | conserved | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P(seed, { exchInventory: true }) });
    const off = run({ ...P(seed, { exchInventory: false }) });   // 추상(give 0)
    const inv = on.inventory; const ex = on.exchange;
    const s1 = ownedBy(inv, 's1'); const s2 = ownedBy(inv, 's2'); const esc = ownedBy(inv, 'escrow');
    const gives = ex.gives; const minted = inv.minted; const conserved = ex.conserved();
    const offEsc = ownedBy(off.inventory, 'escrow'); const offGives = off.exchange.gives;
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(s1 === 1 && s2 === 1 && esc === 0, `seed ${seed}: ON 반환 기대 s1 1/s2 1/escrow 0·실제 ${s1}/${s2}/${esc}`) &&
      check(ex.cancelled === 1 && ex.expired === 1, `seed ${seed}: ON cancelled/expired 기대 1·실제 ${ex.cancelled}/${ex.expired}`) &&
      check(gives === 4 && minted === 2, `seed ${seed}: ON gives/minted 기대 4/2·실제 ${gives}/${minted}`) &&
      check(offEsc === 0 && offGives === 0, `seed ${seed}: OFF escrow/gives 기대 0(추상)·실제 ${offEsc}/${offGives}`) &&
      check(conserved && mintedEq, `seed ${seed}: 반환이 세계 mint 바꿈/보존 위반(minted ${on.inventory.minted}/${off.inventory.minted}·conserved ${conserved})`);
    console.log(`${pad(seed, 6)} | ${pad(s1, 6)} | ${pad(s2, 6)} | ${pad(esc, 6)} | ${pad(ex.cancelled, 9)} | ${pad(ex.expired, 7)} | ${pad(gives, 5)} | ${pad(minted, 6)} | ${pad(conserved + '', 9)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → escrow 의 *모든 출구*가 실물 이동을 동반한다(거래소↔가방 결합 완성): 체결→구매자(0118)·취소/만료→판매자(0119). 미체결 매물의 아이템이 escrow 에 영영 묶이지 않는다 — 거래소가 가방에 give(escrow→seller)로 돌려준다. 인출(0117)의 정확한 역연산. 가방 권위·minted 불변.');
  console.log('    exchInventory OFF·itemId 부재 = give 0 = 0118 비트 동일(reg·추상). 비-침습: 반환은 가방 권위 안의 이동일 뿐 세계 mint 불변·존 tick 밖(거래소→가방 명시 인터페이스 give·은닉).');
}

kit.MODES['exinvret'] = exinvret;
kit.ORDER.splice(1, 0, 'exinvret');

(async () => { process.exit(await kit.cli(process.argv)); })();
