// HktInfra step-0161 — 헤드리스 검증 (아이템 우편↔가방 leg1: 발신 시 발신자 가방 인출·mailInv·escrow custody)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlinv`.
//   더한 한 조각: mailSend 가 아이템 실은 통마다 가방에 give(발신자→'escrow') 를 요청한다(mailInv ON). 거래소 0117 list leg1 의 우편 판 — 아이템이 발신자 가방을 *실제로 떠난다*.
//   검증: ⒜ `reg`(키트) — mailInv OFF·give 0 = 0160 비트 동일. ⒝ `exmlinv`(가설) — ON: 아이템이 발신자→escrow 로 이동(가방 ownerOf=escrow·escrowXfers==gives==itemSent)·OFF: 발신자 보유(추상 escrow).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
// 발신자 x 가 가방서 item0·item1 을 mint(선-적재) → 아이템 우편 2통 발신(item0·item1) + 메시지만 1통.
const base = (seed, inv) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: inv,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h1', '2', 'item1'), SEND(8, 'c', 'x', 'h1', '3')],
});

function exmlinv(seeds) {
  console.log('== exmlinv: 아이템 우편↔가방 leg1 — 발신 시 발신자 가방 인출(mailInv·escrow custody). 아이템이 발신자 가방을 *실제로 떠나* escrow 로 이동(ON) vs 우편 박스 내 추상 escrow(OFF). 거래소 0117 list leg 의 우편 판. ==');
  console.log('seed   | ON gives/escrowXfers | item0/item1 소유자(ON) | OFF 소유자 | itemHeld ON/OFF | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const ownersOn = on.inventory.ownerOf('item0') + '/' + on.inventory.ownerOf('item1');
    const ownersOff = off.inventory.ownerOf('item0') + '/' + off.inventory.ownerOf('item1');
    const onOk = (on.mail.gives === 2 && on.mail.itemSent === 2 && on.inventory.escrowXfers === 2 &&
      on.inventory.ownerOf('item0') === 'escrow' && on.inventory.ownerOf('item1') === 'escrow' && on.mail.itemHeld() === 2);
    const offOk = (off.mail.gives === 0 && off.inventory.escrowXfers === 0 &&
      off.inventory.ownerOf('item0') === 'x' && off.inventory.ownerOf('item1') === 'x' && off.mail.itemHeld() === 2);
    const ok =
      check(onOk, `seed ${seed}: ON leg1 어긋남(gives ${on.mail.gives}·escrowXfers ${on.inventory.escrowXfers}·owners ${ownersOn}·itemHeld ${on.mail.itemHeld()})`) &&
      check(offOk, `seed ${seed}: OFF 추상 escrow 어긋남(gives ${off.mail.gives}·owners ${ownersOff})`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.gives + '/' + on.inventory.escrowXfers, 20)} | ${pad(ownersOn, 22)} | ${pad(ownersOff, 10)} | ${pad(on.mail.itemHeld() + '/' + off.mail.itemHeld(), 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → mailInv ON: 아이템 우편 발신이 발신자 가방서 아이템을 *실제로 인출*해 escrow custody 로 옮긴다(가방 ownerOf=escrow·escrowXfers==gives==itemSent==2). OFF: 우편 박스 회계(itemHeld)는 같으나 가방 원장 무변경(item0/1 여전히 발신자 x 소유 = 추상 escrow 0157~0160).');
  console.log('    거래소↔가방 2-서비스 쌍 거래(0117~0120)의 우편 leg1 — 수령 입금(0162)·만료 반환(0163)·2-서비스 보존 capstone(0164) 후속.');
}

kit.MODES['exmlinv'] = exmlinv;
kit.ORDER.splice(1, 0, 'exmlinv');

(async () => { process.exit(await kit.cli(process.argv)); })();
