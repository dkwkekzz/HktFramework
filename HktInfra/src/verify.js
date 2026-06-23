// HktInfra step-0164 — 헤드리스 검증 (아이템 우편 2-서비스 보존·mailCustodyItems — 보유 우편 아이템 ≡ 가방 mailcustody 소유)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlinv4`.
//   더한 한 조각: mailCustodyItems()(보유 우편 아이템 집합) == 가방 'mailcustody' 소유 집합 — 우편 회계와 가방이 합치(거래소 0120 open≡escrow 의 우편 판).
//   검증: ⒜ `reg`(키트) — 미호출 = 0163 비트 동일. ⒝ `exmlinv4`(가설) — 혼합 체제(보유·수령·만료) 후 보유 우편 아이템 ≡ 가방 mailcustody 소유.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailPersist: true, mailTtl: 10, mailOps, invOps, ...extra });

function exmlinv4(seeds) {
  console.log('== exmlinv4: *2-서비스 보존* — 보유 우편 아이템(mailCustodyItems) ≡ 가방 mailcustody 소유. 우편 회계와 가방이 합치(거래소 0120 open≡escrow 의 우편 판·공백·중복 0). ==');
  console.log('seed   | 보유 우편 아이템 | 가방 mailcustody 소유 | 합치 | 판정');
  for (const seed of seeds) {
    // x 가 item0~3 pickup → 4통 발신(h1·h1·h2·h3) → h1 수령(item0·item1→h1)·h3 만료(item3→x 반환)·item2(h2) 보유.
    const invOps = [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x'), PICK(5, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'item1'), SEND(11, 'd', 'x', 'h3', '4', 'item3'), FETCH(20, 'h1'), SWEEP(30), SEND(33, 'c', 'x', 'h2', '3', 'item2')];
    const r = run(base(seed, mailOps, invOps));
    const inv = r.inventory, mail = r.mail;
    const custodyItems = mail.mailCustodyItems();
    const invCustody = [...(inv.byOwner.get('mailcustody') || [])].sort();
    const match = custodyItems.length === invCustody.length && custodyItems.every((x, i) => x === invCustody[i]);
    // 혼합 결과: item2(h2 보유)만 custody 잔류. item0·item1 수령(h1)·item3 만료 반환(x).
    const ok =
      check(match, `seed ${seed}: 보존 깨짐(우편 [${custodyItems}] vs 가방 [${invCustody}])`) &&
      check(custodyItems.length === 1 && custodyItems[0] === 'item2', `seed ${seed}: 보유 아이템 기대 어긋남 [${custodyItems}]`) &&
      check(inv.ownerOf('item0') === 'h1' && inv.ownerOf('item3') === 'x', `seed ${seed}: 수령/반환 결과 어긋남`);
    console.log(`${pad(seed, 6)} | ${pad('[' + custodyItems + ']', 16)} | ${pad('[' + invCustody + ']', 21)} | ${pad(match ? '예' : '아니오', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편 회계와 가방이 *합치*한다: 보유 우편이 든 아이템(mailCustodyItems) == 가방 mailcustody 소유 집합(거래소 0120 open≡escrow 의 우편 판·공백·중복 0). 세 leg(인출·입금·반환)가 in-transit 아이템을 정확히 보유 우편과 일치시킴 — 아이템은 발신자/custody/수령자 중 한 곳에만(보존). saga 회신(0165)·실패 보상(0166) 후속. 미호출=0163 비트 동일(reg).');
}

kit.MODES['exmlinv4'] = exmlinv4;
kit.ORDER.splice(1, 0, 'exmlinv4');

(async () => { process.exit(await kit.cli(process.argv)); })();
