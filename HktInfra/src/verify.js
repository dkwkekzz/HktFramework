// HktInfra step-0122 — 헤드리스 검증 (거래소↔가방 list 인출 실패 보상·exchCompensate saga 보상 거래)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagacomp`.
//   더한 한 조각: 0121 은 give 결과를 받기만 했다(집계). 이 step 은 그 피드백에 *반응* — list 인출 give 실패(판매자 미소유 itemId)면 거래소가 그 낙관적 listing 을 abort(open 롤백·phantom 매물 0). 2-서비스 보존 불변이 *실패 주입 아래서도* 유지.
//   검증: ⒜ `reg`(키트) — compensate OFF·실패 부재면 abort 0 = 0121 비트 동일. ⒝ `exsagacomp`(가설) — 미소유 list 주입: ON 이면 giveFails 1·aborted 1·거래소 open ≡ 가방 escrow 소유(2-서비스 일치 유지); OFF 면 phantom 매물 잔존(open 에 미소유 itemId·거래소 open ≠ 가방 escrow). 저널 'abort'→reconstruct 정합(crash 후 open 복원).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

// 미소유 list 주입 — s1 이 item0/item1 을 적재(2 mint)한 뒤, item0 은 정상 list, 'item9'(미소유)는 무효 list.
//   무효 list 의 인출 give 는 가방서 owner≠s1 → ok:false → compensate ON 이면 거래소가 그 listing 을 abort(phantom 0).
const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item1
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // 유효 — give ok → open
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'ghost', price: 5, itemId: 'item9' } },     // 무효(s1 미소유) — give fail → 보상 abort
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, invOps: INV, exchangeOps: OPS, ...extra });

function exsagacomp(seeds) {
  console.log('== exsagacomp: *가설* — list 인출 실패 보상. 미소유 list 주입(s1 이 안 가진 item9) → 가방 give 실패(ok:false) → compensate ON 이면 거래소가 그 listing 을 abort(phantom 매물 0·낙관적 open 롤백). 2-서비스 보존이 실패 아래서도 유지. OFF 면 phantom 잔존. ==');
  console.log('  s1 적재 item0/item1 → list item0(유효·give ok→open) + list item9(미소유·give fail). ON: aborted 1·open=[item0]==가방 escrow. OFF: open=[item0,item9]≠가방 escrow(phantom).');
  console.log('seed   | giveFails | abrt(ON/OFF) | ON open==escrow | OFF open==escrow | ON open | OFF open | recon open | conserved | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { exchCompensate: true }) });
    const off = run({ ...P(seed, { exchCompensate: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow');       // 가방 실제 escrow 소유(item0 만 — item9 give 실패)
    const onOpen = on.exchange.escrowItemIds();            // 거래소가 믿는 open 매물 itemId
    const offEsc = ownedSet(off.inventory, 'escrow');
    const offOpen = off.exchange.escrowItemIds();
    const onMatch = JSON.stringify(onEsc) === JSON.stringify(onOpen);    // ON: 보상으로 일치
    const offMatch = JSON.stringify(offEsc) === JSON.stringify(offOpen); // OFF: phantom 으로 불일치
    // 저널 'abort' → reconstruct 정합: persist ON 으로 다시 돌려 crash 후 복원 → open 복원(abort 가 replay 됨)
    const rec = run({ ...P(seed, { exchCompensate: true, exchangePersist: true }) });
    rec.exchange.crash(); rec.exchange.reconstruct();
    const reconOpen = rec.exchange.escrowItemIds();
    const ok =
      check(on.exchange.giveFails === 1 && off.exchange.giveFails === 1, `seed ${seed}: giveFails 기대 1(ON ${on.exchange.giveFails}/OFF ${off.exchange.giveFails})`) &&
      check(on.exchange.aborted === 1 && off.exchange.aborted === 0, `seed ${seed}: aborted 기대 ON1/OFF0(ON ${on.exchange.aborted}/OFF ${off.exchange.aborted})`) &&
      check(onMatch && JSON.stringify(onOpen) === '["item0"]', `seed ${seed}: ON 2-서비스 불일치(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(!offMatch && JSON.stringify(offOpen) === '["item0","item9"]', `seed ${seed}: OFF phantom 미잔존(open ${JSON.stringify(offOpen)})`) &&
      check(JSON.stringify(reconOpen) === '["item0"]', `seed ${seed}: reconstruct open != [item0](abort 저널 정합 깨짐·${JSON.stringify(reconOpen)})`) &&
      check(on.exchange.conserved() && on.inventory.minted === 2, `seed ${seed}: 보존/minted 깨짐(conserved ${on.exchange.conserved()}·minted ${on.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.giveFails, 9)} | ${pad(on.exchange.aborted + '/' + off.exchange.aborted, 12)} | ${pad((onMatch ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad((offMatch ? '예' : '아니오') + ' ' + JSON.stringify(offOpen), 16)} | ${pad(on.exchange.open(), 7)} | ${pad(off.exchange.open(), 8)} | ${pad(JSON.stringify(reconOpen), 10)} | ${pad(on.exchange.conserved() + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 보상이 낙관적 가정을 *자기수정*한다: list 인출 give 가 실패하면(판매자 미소유) 거래소가 그 listing 을 abort → 거래소 open ≡ 가방 escrow 소유(2-서비스 보존이 실패 주입 아래서도 유지). compensate OFF 면 phantom 매물(open 에 가방에 없는 item9)이 잔존 — 0120 보존 불변이 *깨진다*. 보상이 그 격차의 원인.');
  console.log('    저널 abort 가 reconstruct 에도 정합(crash 후 open=[item0]·phantom 미부활) — 보상이 영속 경로까지 닫힌다. compensate OFF·실패 부재면 abort 0 = 0121 비트 동일(reg).');
}

kit.MODES['exsagacomp'] = exsagacomp;
kit.ORDER.splice(1, 0, 'exsagacomp');

(async () => { process.exit(await kit.cli(process.argv)); })();
