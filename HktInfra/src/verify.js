// HktInfra step-0153 — 헤드리스 검증 (MailFeed 만료 반영·mailFeedExpire — svc.mail.expired 구독→unread--)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlfexp`.
//   더한 한 조각: MailFeed 가 svc.mail.expired(0149)도 구독해 만료 시 unread 차감·expired++ → 미수령 만료 우편이 배지에서 사라진다. 회계 unread==sent−read−expired 로 닫힘.
//   검증: ⒜ `reg`(키트) — mailFeedExpire OFF = 0152 비트 동일(expired 토픽 미구독). ⒝ `exmlfexp`(가설) — 만료한 만큼 unread 감소·unread==sent−read−expired.
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
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
// 발행→구독 전제: bus·mail*Publish 3종·mailFeed·mailFeedRead·mailFeedExpire ON. ttl 로 만료 트리거.
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailSentPublish: true, mailReadPublish: true, mailExpirePublish: true, mailFeed: true, mailFeedRead: true, mailFeedExpire: true, mailTtl: 10, mailOps: ops, ...extra });

function exmlfexp(seeds) {
  console.log('== exmlfexp: MailFeed 만료 반영(svc.mail.expired 구독→unread--). 미수령 만료 우편이 배지에서 사라진다. unread==sent−read−expired. ==');
  console.log('seed   | h1 u/r/e | h2 u/r/e | total unread | unread==sent−read−expired | 판정');
  for (const seed of seeds) {
    // h1 3통 입금+수령(read 3·unread 0). h2 2통 입금·미수령→sweep 만료(expired 2·unread 0).
    const ops = [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4'), SEND(9, 'e', 'y', 'h2', '5'), FETCH(15, 'h1'), SWEEP(30)];
    const r = run(base(seed, ops));
    const f = r.mailfeed;
    const u1 = f.unreadOf('h1'), r1 = f.readOf('h1'), e1 = f.expiredOf('h1');
    const u2 = f.unreadOf('h2'), r2 = f.readOf('h2'), e2 = f.expiredOf('h2');
    const tot = f.totalUnread();
    const inv = (u1 === f.sentOf('h1') - r1 - e1) && (u2 === f.sentOf('h2') - r2 - e2);
    const ok =
      check(u1 === 0 && r1 === 3 && e1 === 0, `seed ${seed}: h1 u/r/e ${u1}/${r1}/${e1}≠0/3/0`) &&
      check(u2 === 0 && r2 === 0 && e2 === 2, `seed ${seed}: h2 u/r/e ${u2}/${r2}/${e2}≠0/0/2`) &&
      check(tot === 0, `seed ${seed}: totalUnread ${tot}≠0`) &&
      check(inv, `seed ${seed}: unread≠sent−read−expired`);
    console.log(`${pad(seed, 6)} | ${pad(u1 + '/' + r1 + '/' + e1, 8)} | ${pad(u2 + '/' + r2 + '/' + e2, 8)} | ${pad(tot, 12)} | ${pad(inv ? '예' : '아니오', 25)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 만료(svc.mail.expired) 구독으로 미수령 만료 우편이 배지에서 사라진다: unread==sent−read−expired(per recipient). 0151~0153 으로 배지가 입금(+)·읽음(−)·만료(−) 전 수명주기를 반영. 영속·late-join(0154)·회계 정합 capstone(0155)·질의(0156) 후속. mailFeedExpire OFF=0152 비트 동일(reg).');
}

kit.MODES['exmlfexp'] = exmlfexp;
kit.ORDER.splice(1, 0, 'exmlfexp');

(async () => { process.exit(await kit.cli(process.argv)); })();
