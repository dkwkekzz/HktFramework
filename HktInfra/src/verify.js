// HktInfra step-0169 — 헤드리스 검증 (아이템 우편 교차 정합·mailXfers — mail ackedOk == 가방 mailcustody transfers)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlxfer`.
//   더한 한 조각: 가방 mailXfers(from/to 중 'mailcustody' 인 성공 give 수) == 우편 ackedOk(성공 회신 수). 두 서비스 회계가 합치(거래소 0130 escrowXfers==giveOks 의 우편 판).
//   검증: ⒜ `reg`(키트) — 우편 give 부재 = 0168 비트 동일(mailXfers 0). ⒝ `exmlxfer`(가설) — 발신·수령·반환 전 leg 후 mail.ackedOk == inv.mailXfers.
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
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailPersist: true, mailTtl: 10, mailOps, invOps, ...extra });

function exmlxfer(seeds) {
  console.log('== exmlxfer: *교차 정합* — 우편 ackedOk == 가방 mailXfers(mailcustody 관여 transfer). 두 서비스 회계가 합치(거래소 0130 escrowXfers==giveOks 의 우편 판). 발신·수령·반환 전 leg 합산. ==');
  console.log('seed   | gives | ackedOk | inv mailXfers | ackedOk==mailXfers | escrow 무오염 | 판정');
  for (const seed of seeds) {
    // x 가 item0~2 pickup → h1(item0·수령)·h2(item1·만료반환)·h3(item2·보유) 발신 후 h1 수령·sweep.
    const invOps = [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30), SEND(33, 'c', 'x', 'h3', '3', 'item2')];
    const r = run(base(seed, mailOps, invOps));
    const inv = r.inventory, mail = r.mail;
    const cross = mail.ackedOk === inv.mailXfers;
    // escrow(거래소)와 분리: 우편 give 는 escrowXfers 를 오염 안 함(거래소 부재 → escrowXfers 0).
    const ok =
      check(cross, `seed ${seed}: 교차 정합 깨짐(mail ackedOk ${mail.ackedOk}≠inv mailXfers ${inv.mailXfers})`) &&
      check(inv.escrowXfers === 0, `seed ${seed}: 우편 give 가 escrowXfers 오염(${inv.escrowXfers})`) &&
      check(mail.ackedOk === mail.gives && mail.pending.size === 0, `seed ${seed}: 무손실 미drain(ackedOk ${mail.ackedOk}/gives ${mail.gives})`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(mail.ackedOk, 7)} | ${pad(inv.mailXfers, 13)} | ${pad(cross ? '예' : '아니오', 18)} | ${pad(inv.escrowXfers === 0 ? '예' : '아니오', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 두 서비스 회계가 *교차 합치*한다: 우편이 센 성공 give(ackedOk) == 가방이 센 mailcustody transfer(mailXfers)(거래소 0130 의 우편 판). 우편 give 는 escrowXfers(거래소 판)를 오염시키지 않는다(custody 의제 소유자 분리). liveness capstone(0170) 후속. 우편 give 부재=0168 비트 동일(reg).');
}

kit.MODES['exmlxfer'] = exmlxfer;
kit.ORDER.splice(1, 0, 'exmlxfer');

(async () => { process.exit(await kit.cli(process.argv)); })();
