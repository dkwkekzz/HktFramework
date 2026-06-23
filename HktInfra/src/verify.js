// HktInfra step-0156 — 헤드리스 검증 (미읽음 배지 질의 인터페이스·mailUnreadQuery→mailUnreadReply)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlfq`.
//   더한 한 조각: MailFeed 가 {type:'mailUnreadQuery',rcpt} 요청에 현재 unread 를 {type:'mailUnreadReply'} 로 회신(request/reply over net·프레즌스 0069 presenceQuery 의 우편 판). 순수 읽기.
//   검증: ⒜ `reg`(키트) — 질의 미수신 = 0155 비트 동일. ⒝ `exmlfq`(가설) — 질의 수신→회신 1:1·회신 unread == 질의 시점 unreadOf.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body) => ({ at, op: { type: 'mailSend', id, from, to, body } });
const base = (seed, ops, q, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailSentPublish: true, mailFeed: true, mailOps: ops, mailFeedQuery: q, ...extra });

function exmlfq(seeds) {
  console.log('== exmlfq: 미읽음 배지 질의 인터페이스(mailUnreadQuery→mailUnreadReply·request/reply over net·프레즌스 0069 의 우편 판). 질의 수신→회신 1:1·회신 unread == 질의 시점 배지. ==');
  console.log('seed   | queriesRx | repliesSent | 회신 h1/h2 unread | 회신==배지 | 판정');
  for (const seed of seeds) {
    // h1 3통·h2 2통 입금 후, tick 25 에 h1·h2 배지 질의(미수령 → unread 3·2).
    const ops = [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4'), SEND(9, 'e', 'y', 'h2', '5')];
    const q = [{ at: 25, rcpt: 'h1' }, { at: 26, rcpt: 'h2' }];
    const r = run(base(seed, ops, q));
    const f = r.mailfeed;
    const last = f._lastReply || {};
    // 마지막 질의(h2)의 회신 unread == 그 시점 배지 unreadOf(h2). 1:1(queriesRx==repliesSent==2).
    const replyEqBadge = (last.rcpt === 'h2' && last.unread === f.unreadOf('h2'));
    const ok =
      check(f.queriesRx === 2, `seed ${seed}: queriesRx ${f.queriesRx}≠2`) &&
      check(f.repliesSent === 2, `seed ${seed}: repliesSent ${f.repliesSent}≠2`) &&
      check(replyEqBadge, `seed ${seed}: 회신 unread≠배지(${last.unread} vs ${f.unreadOf('h2')})`) &&
      check(f.unreadOf('h1') === 3 && f.unreadOf('h2') === 2, `seed ${seed}: 배지 ${f.unreadOf('h1')}/${f.unreadOf('h2')}≠3/2`);
    console.log(`${pad(seed, 6)} | ${pad(f.queriesRx, 9)} | ${pad(f.repliesSent, 11)} | ${pad(f.unreadOf('h1') + '/' + f.unreadOf('h2'), 17)} | ${pad(replyEqBadge ? '예' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 미읽음 배지를 *원격에서 질의*할 수 있다: mailUnreadQuery→mailUnreadReply(request/reply over net·프레즌스 0069 의 우편 판). 회신 unread == 질의 시점 배지·질의↔회신 1:1. 순수 읽기(배지 무변경). 아이템 첨부 우편(0157~) 후속. 질의 미수신=0155 비트 동일(reg).');
}

kit.MODES['exmlfq'] = exmlfq;
kit.ORDER.splice(1, 0, 'exmlfq');

(async () => { process.exit(await kit.cli(process.argv)); })();
