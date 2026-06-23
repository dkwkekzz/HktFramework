// HktInfra step-0157 — 헤드리스 검증 (아이템 첨부 우편·mailItem — mailSend item·itemSent/itemHeld 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlitem`.
//   더한 한 조각: mailSend 가 선택 필드 item 을 받아 우편 1통이 아이템 1개를 함께 보유(거래소 escrow 의 우편 판). itemSent(아이템 실은 입금)·itemHeld(보유 중 아이템) 회계.
//   검증: ⒜ `reg`(키트) — mailItem OFF = 0156 비트 동일. ⒝ `exmlitem`(가설) — 아이템 첨부분만 itemSent++·itemHeld 추적·mailConsistent 불변·crash 복구 시 아이템 보존.
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
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailItem: true, mailOps: ops, ...extra });

function exmlitem(seeds) {
  console.log('== exmlitem: 아이템 첨부 우편(mailSend item·itemSent/itemHeld). 우편 1통이 아이템 1개를 함께 보유(거래소 escrow 의 우편 판). 아이템 첨부분만 회계·mailConsistent 불변. ==');
  console.log('seed   | sent | itemSent | itemHeld | mailConsistent | crash복구 아이템 보존 | 판정');
  for (const seed of seeds) {
    // h1 에 3통: 2통 아이템 첨부(sword·shield)·1통 메시지만. → sent 3·itemSent 2·itemHeld 2·held 3.
    const ops = [SEND(5, 'a', 'x', 'h1', '1', 'sword'), SEND(6, 'b', 'x', 'h1', '2', 'shield'), SEND(7, 'c', 'x', 'h1', '3')];
    const r = run(base(seed, ops));
    const mail = r.mail;
    const consistent = mail.mailConsistent() && mail.itemSent === 2 && mail.itemHeld() === 2 && mail.sent === 3 && mail.totalHeld() === 3;
    // crash→reconstruct 후 아이템 보존(itemSent·itemHeld·digest 동일).
    const preDig = mail.digest(); mail.crash(); mail.reconstruct();
    const crashOk = (mail.digest() === preDig && mail.itemSent === 2 && mail.itemHeld() === 2);
    const ok =
      check(consistent, `seed ${seed}: 아이템 회계 어긋남(itemSent ${mail.itemSent}·itemHeld ${mail.itemHeld()}·sent ${mail.sent})`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 아이템 소실/digest 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mail.sent, 4)} | ${pad(mail.itemSent, 8)} | ${pad(mail.itemHeld(), 8)} | ${pad(mail.mailConsistent() ? '예' : '아니오', 14)} | ${pad(crashOk ? '예' : '아니오', 20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편이 *아이템*을 나른다: mailSend item → 우편 1통이 아이템 1개를 함께 보유(itemSent·itemHeld·거래소 escrow 의 우편 판). 아이템 첨부분만 itemSent++(메시지 전용 우편은 item=null·미집계)·mailConsistent(sent==held+fetched+expired) 불변·crash→reconstruct 시 아이템 저널 동봉으로 보존. 수령 이동(0158)·만료 회수(0159)·아이템 회계 capstone(0160) 후속. mailItem OFF=0156 비트 동일(reg).');
}

kit.MODES['exmlitem'] = exmlitem;
kit.ORDER.splice(1, 0, 'exmlitem');

(async () => { process.exit(await kit.cli(process.argv)); })();
