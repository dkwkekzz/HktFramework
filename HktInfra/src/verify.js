// HktInfra step-0162 — 헤드리스 검증 (아이템 우편 수령 입금 leg2 — mailFetch 가 우편 custody→수령자 가방 give)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlinv2`.
//   더한 한 조각: mailFetch 가 수령 통 아이템을 'mailcustody'→수령자 가방으로 give(거래소 0118 buy 입금 leg 의 우편 판). 인출(0161)의 짝.
//   검증: ⒜ `reg`(키트) — invMode OFF = 0161 비트 동일. ⒝ `exmlinv2`(가설) — 발신(x→custody)→수령(custody→h1) 후 아이템이 수령자 h1 가방 소유.
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
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailPersist: true, mailOps, invOps, ...extra });

function exmlinv2(seeds) {
  console.log('== exmlinv2: 아이템 우편 수령 입금 leg2(mailFetch → 우편 custody→수령자 가방 give). 인출(0161)의 짝 — 발신자서 빠진 실물이 수령자 가방에 들어온다(거래소 0118 의 우편 판). ==');
  console.log('seed   | gives | item0 owner(수령후) | item1 owner(미수령) | 판정');
  for (const seed of seeds) {
    // x 가 item0·item1 pickup → 둘을 h1·h2 로 발신(custody) → h1 만 수령(item0→h1 가방)·item1 미수령(custody 잔류).
    const invOps = [PICK(3, 'x'), PICK(4, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1'), FETCH(20, 'h1')];
    const r = run(base(seed, mailOps, invOps));
    const inv = r.inventory, mail = r.mail;
    const o0 = inv.ownerOf('item0'), o1 = inv.ownerOf('item1');
    const ok =
      check(o0 === 'h1', `seed ${seed}: 수령 입금 실패(item0 owner ${o0}≠h1)`) &&
      check(o1 === 'mailcustody', `seed ${seed}: 미수령 item1 owner ${o1}≠mailcustody`) &&
      check(mail.gives === 3, `seed ${seed}: gives ${mail.gives}≠3(발신2+수령1)`) &&
      check(mail.itemFetched === 1, `seed ${seed}: itemFetched ${mail.itemFetched}≠1`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(o0, 19)} | ${pad(o1, 19)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 아이템 우편 수령이 실물을 수령자 가방에 넣는다: mailFetch → 우편 custody→수령자 가방 give(거래소 0118 의 우편 판·인출 0161 의 짝). 미수령분은 custody 잔류(보유 held). 만료 반환(0163)·2-서비스 보존(0164)·saga 신뢰 전달(0165~) 후속. invMode OFF=0161 비트 동일(reg).');
}

kit.MODES['exmlinv2'] = exmlinv2;
kit.ORDER.splice(1, 0, 'exmlinv2');

(async () => { process.exit(await kit.cli(process.argv)); })();
