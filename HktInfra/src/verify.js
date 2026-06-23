// HktInfra step-0166 — 헤드리스 검증 (아이템 우편 발신 실패 보상·mailCompensate — give 실패→우편 롤백·phantom 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlcomp`.
//   더한 한 조각: 발신 leg give 가 실패(발신자 미소유) 회신하면 그 우편을 롤백(box 제거·sent--·itemSent--·compensated++). 거래소 0122 exchCompensate 의 우편 판·phantom 0.
//   검증: ⒜ `reg`(키트) — mailCompensate OFF = 0165 비트 동일. ⒝ `exmlcomp`(가설) — 미소유 발신은 롤백(우편 미적재)·소유 발신은 유지.
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
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailCompensate: true, mailPersist: true, mailOps, invOps, ...extra });

function exmlcomp(seeds) {
  console.log('== exmlcomp: 아이템 우편 발신 실패 보상(mailCompensate·give 실패→우편 롤백). 발신자가 안 가진 아이템 우편은 적재 취소(거래소 0122 의 우편 판·phantom 0). ==');
  console.log('seed   | sent | itemHeld | ackedFail | compensated | h1 우편함(phantom) | 판정');
  for (const seed of seeds) {
    // x 가 item0 만 pickup. item0(유효)·itemX(x 미소유) 두 통 발신 → itemX 발신 leg 실패→롤백. 유효 item0 만 남음.
    const invOps = [PICK(3, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'itemX')];
    const r = run(base(seed, mailOps, invOps));
    const mail = r.mail;
    const phantom = mail.held('h1');   // 보상 후 h1 우편함엔 유효 우편(item0) 1통만(phantom itemX 롤백).
    const ok =
      check(mail.sent === 1, `seed ${seed}: sent ${mail.sent}≠1(itemX 롤백 후)`) &&
      check(mail.itemHeld() === 1, `seed ${seed}: itemHeld ${mail.itemHeld()}≠1`) &&
      check(mail.ackedFail === 1 && mail.compensated === 1, `seed ${seed}: ackedFail ${mail.ackedFail}·compensated ${mail.compensated}≠1`) &&
      check(phantom === 1, `seed ${seed}: h1 우편함 ${phantom}≠1(phantom 잔존?)`);
    console.log(`${pad(seed, 6)} | ${pad(mail.sent, 4)} | ${pad(mail.itemHeld(), 8)} | ${pad(mail.ackedFail, 9)} | ${pad(mail.compensated, 11)} | ${pad(phantom, 18)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 발신자가 안 가진 아이템 우편은 *적재가 취소*된다: 발신 leg give 실패 회신→우편 롤백(box 제거·sent--·compensated++·거래소 0122 의 우편 판). 받는 이가 실물 없는 phantom 우편을 받지 않는다(phantom 0). 회신 손실 재전송(0167)·dedup(0168) 후속. mailCompensate OFF=0165 비트 동일(reg).');
}

kit.MODES['exmlcomp'] = exmlcomp;
kit.ORDER.splice(1, 0, 'exmlcomp');

(async () => { process.exit(await kit.cli(process.argv)); })();
