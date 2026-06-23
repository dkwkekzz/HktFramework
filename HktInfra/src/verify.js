// HktInfra step-0163 — 헤드리스 검증 (아이템 우편 만료 반환 leg3 — mailSweep 만료 시 우편 custody→발신자 가방 give)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlinv3`.
//   더한 한 조각: mailSweep 만료 시 그 우편의 아이템을 'mailcustody'→발신자 가방으로 반환 give(거래소 0119 cancel/expire 반환 leg 의 우편 판). 받는 이가 안 가져가면 보낸 이에게 돌아온다.
//   검증: ⒜ `reg`(키트) — invMode OFF = 0162 비트 동일. ⒝ `exmlinv3`(가설) — 미수령 만료 후 아이템이 발신자 가방으로 반환(ownerOf==발신자).
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

function exmlinv3(seeds) {
  console.log('== exmlinv3: 아이템 우편 만료 반환 leg3(mailSweep 만료 → 우편 custody→발신자 가방 give). 받는 이가 안 가져가면 보낸 이에게 돌아온다(거래소 0119 의 우편 판·아이템 보존). ==');
  console.log('seed   | gives | item0 owner(수령) | item1 owner(만료반환) | 판정');
  for (const seed of seeds) {
    // x 가 item0·item1 pickup → h1·h2 발신 → h1 수령(item0→h1)·h2 미수령→만료 sweep(item1→x 반환).
    const invOps = [PICK(3, 'x'), PICK(4, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30)];
    const r = run(base(seed, mailOps, invOps));
    const inv = r.inventory, mail = r.mail;
    const o0 = inv.ownerOf('item0'), o1 = inv.ownerOf('item1');
    const ok =
      check(o0 === 'h1', `seed ${seed}: 수령 item0 owner ${o0}≠h1`) &&
      check(o1 === 'x', `seed ${seed}: 만료 반환 실패(item1 owner ${o1}≠x 발신자)`) &&
      check(mail.gives === 4, `seed ${seed}: gives ${mail.gives}≠4(발신2+수령1+반환1)`) &&
      check(mail.itemExpired === 1, `seed ${seed}: itemExpired ${mail.itemExpired}≠1`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(o0, 17)} | ${pad(o1, 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 미수령 만료 아이템이 발신자에게 돌아온다: mailSweep 만료 → 우편 custody→발신자 가방 반환 give(거래소 0119 의 우편 판). 세 leg(인출 0161·입금 0162·반환 0163) 완비 — 아이템은 발신자/custody/수령자 중 한 곳에만(보존). 2-서비스 보존(0164)이 이를 단언. invMode OFF=0162 비트 동일(reg).');
}

kit.MODES['exmlinv3'] = exmlinv3;
kit.ORDER.splice(1, 0, 'exmlinv3');

(async () => { process.exit(await kit.cli(process.argv)); })();
