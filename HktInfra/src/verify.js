// HktInfra step-0161 — 헤드리스 검증 (아이템 우편 발신 인출 leg1·mailInv — mailSend 가 발신자 가방→우편 custody give)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlinv1`.
//   더한 한 조각: invMode ON 이면 mailSend 가 아이템을 발신자 가방→'mailcustody' 로 give(거래소 0117 list 인출 leg 의 우편 판). 가방이 권위·우편은 요청만(은닉).
//   검증: ⒜ `reg`(키트) — mailInv OFF = 0160 비트 동일(give 0·가방 무변경). ⒝ `exmlinv1`(가설) — 발신 시 아이템이 발신자→mailcustody 로 이동(inventory.ownerOf==mailcustody)·gives 집계.
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
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
// inventory ON·mailInv ON — 발신자 가방서 아이템이 빠진다. 발신자가 먼저 아이템을 소유(pickup)해야 give 성공.
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailPersist: true, mailOps, invOps, ...extra });

function exmlinv1(seeds) {
  console.log('== exmlinv1: 아이템 우편 발신 인출 leg1(mailInv — mailSend → 발신자 가방→우편 custody give). 가방이 권위·우편은 요청만(거래소 0117 의 우편 판). 발신 시 아이템이 발신자→mailcustody 이동. ==');
  console.log('seed   | gives | item0 owner | item1 owner | 발신자 잔여 | itemHeld | 판정');
  for (const seed of seeds) {
    // 발신자 x 가 item0·item1 pickup(소유) 후, 둘을 아이템 우편으로 발신(h1·h2) → 둘 다 가방서 mailcustody 로 이동.
    const invOps = [PICK(3, 'x'), PICK(4, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1')];
    const r = run(base(seed, mailOps, invOps));
    const inv = r.inventory, mail = r.mail;
    const o0 = inv.ownerOf('item0'), o1 = inv.ownerOf('item1');
    const senderLeft = !(inv.byOwner.get('x') && inv.byOwner.get('x').size);   // 발신자 x 는 둘 다 내보냄
    const ok =
      check(mail.gives === 2, `seed ${seed}: gives ${mail.gives}≠2`) &&
      check(o0 === 'mailcustody' && o1 === 'mailcustody', `seed ${seed}: custody 이동 실패(item0 ${o0}·item1 ${o1})`) &&
      check(senderLeft, `seed ${seed}: 발신자 x 가 아이템 잔여`) &&
      check(mail.itemHeld() === 2, `seed ${seed}: itemHeld ${mail.itemHeld()}≠2(우편 보유 기록)`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(o0, 11)} | ${pad(o1, 11)} | ${pad(senderLeft ? '없음' : '잔여', 11)} | ${pad(mail.itemHeld(), 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 아이템 우편 발신이 *실물*을 옮긴다: mailSend → 발신자 가방→우편 custody(mailcustody) give(거래소 0117 list 인출 leg 의 우편 판·가방이 권위·우편은 요청만). 발신자 가방서 아이템이 빠지고 in-transit custody 가 보관. 수령 입금(0162)·만료 반환(0163)·2-서비스 보존(0164) 후속. mailInv OFF=0160 비트 동일(give 0·reg).');
}

kit.MODES['exmlinv1'] = exmlinv1;
kit.ORDER.splice(1, 0, 'exmlinv1');

(async () => { process.exit(await kit.cli(process.argv)); })();
