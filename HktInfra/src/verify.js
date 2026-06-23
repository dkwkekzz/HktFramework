// HktInfra step-0162 — 헤드리스 검증 (아이템 우편↔가방 leg2: 수령 시 escrow→수신자 가방 입금·mailInv)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlin2`.
//   더한 한 조각: mailFetch 가 아이템 실은 통마다 가방에 give('escrow'→수신자) 를 요청한다(mailInv ON). 거래소 0118 buy leg2 의 우편 판 — 아이템이 escrow 를 떠나 수신자 가방으로.
//   검증: ⒜ `reg`(키트) — mailInv OFF·give 0 = 0161 비트 동일. ⒝ `exmlin2`(가설) — 발신자→escrow(leg1)→수신자(leg2) 2-홉 custody 가 닫힌다(수령 후 가방 ownerOf=수신자·gives 4).
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
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
// x 가 item0·item1 mint → 아이템 우편 2통 h1 발신 → h1 수령. 아이템 경로: x → escrow(leg1) → h1(leg2).
const base = (seed, inv) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: inv,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h1', '2', 'item1'), FETCH(20, 'h1')],
});

function exmlin2(seeds) {
  console.log('== exmlin2: 아이템 우편↔가방 leg2 — 수령 시 escrow→수신자 가방 입금(mailInv). 발신자→escrow(leg1)→수신자(leg2) 2-홉 custody 가 닫힌다(선물·전리품이 실제 가방 간 이동). 거래소 0118 buy leg 의 우편 판. ==');
  console.log('seed   | ON gives/escrowXfers | item0/item1 소유자(ON) | OFF 소유자 | itemFetched ON | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const ownersOn = on.inventory.ownerOf('item0') + '/' + on.inventory.ownerOf('item1');
    const ownersOff = off.inventory.ownerOf('item0') + '/' + off.inventory.ownerOf('item1');
    const onOk = (on.mail.gives === 4 && on.inventory.escrowXfers === 4 && on.mail.itemFetched === 2 &&
      on.inventory.ownerOf('item0') === 'h1' && on.inventory.ownerOf('item1') === 'h1');
    const offOk = (off.mail.gives === 0 && off.inventory.escrowXfers === 0 &&
      off.inventory.ownerOf('item0') === 'x' && off.inventory.ownerOf('item1') === 'x');
    const ok =
      check(onOk, `seed ${seed}: ON leg2 어긋남(gives ${on.mail.gives}·escrowXfers ${on.inventory.escrowXfers}·owners ${ownersOn}·itemFetched ${on.mail.itemFetched})`) &&
      check(offOk, `seed ${seed}: OFF 추상 escrow 어긋남(gives ${off.mail.gives}·owners ${ownersOff})`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.gives + '/' + on.inventory.escrowXfers, 20)} | ${pad(ownersOn, 22)} | ${pad(ownersOff, 10)} | ${pad(on.mail.itemFetched, 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → mailInv ON: 수령이 escrow custody 의 아이템을 *수신자 가방으로 실제 입금*(가방 ownerOf=h1·gives 4=발신2+수령2·escrowXfers 4). 발신자 x → escrow → 수신자 h1 의 2-홉이 닫힌다. OFF: 가방 원장 무변경(item0/1 여전히 발신자 x·추상 escrow).');
  console.log('    아이템 우편↔가방 leg1(0161 발신 인출)+leg2(이 step 수령 입금) — 만료 반환 leg3(0163)·2-서비스 보존 capstone(0164) 후속.');
}

kit.MODES['exmlin2'] = exmlin2;
kit.ORDER.splice(1, 0, 'exmlin2');

(async () => { process.exit(await kit.cli(process.argv)); })();
