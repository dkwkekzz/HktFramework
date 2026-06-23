// HktInfra step-0152 — 헤드리스 검증 (MailFeed 읽음 반영·mailFeedRead — svc.mail.read 구독→unread--)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlfread`.
//   더한 한 조각: MailFeed 가 svc.mail.read(0147)도 구독해 수령(읽음) 시 unread 차감 → 미읽음 배지가 *읽으면 줄어든다*(0151 단조 증가 해소·MarketFeed 0116 만료 반영의 우편 판).
//   검증: ⒜ `reg`(키트) — mailFeedRead OFF = 0151 비트 동일(read 토픽 미구독). ⒝ `exmlfread`(가설) — 수령한 만큼 unread 감소·unread==sent−read.
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
// 발행→구독 전제: bus·mailSentPublish·mailReadPublish·mailFeed·mailFeedRead ON.
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailSentPublish: true, mailReadPublish: true, mailFeed: true, mailFeedRead: true, mailOps: ops, ...extra });

function exmlfread(seeds) {
  console.log('== exmlfread: MailFeed 읽음 반영(svc.mail.read 구독→unread--). 미읽음 배지가 읽으면 준다(0151 단조 증가 해소). unread==sent−read. ==');
  console.log('seed   | h1 u/r | h2 u/r | total unread | feed unread==sent−read | 판정');
  for (const seed of seeds) {
    // h1 3통 입금 후 수령(읽음 3) → unread 0·read 3. h2 2통 입금·미수령 → unread 2·read 0.
    const ops = [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4'), SEND(9, 'e', 'y', 'h2', '5'), FETCH(20, 'h1')];
    const r = run(base(seed, ops));
    const f = r.mailfeed;
    const u1 = f.unreadOf('h1'), r1 = f.readOf('h1'), u2 = f.unreadOf('h2'), r2 = f.readOf('h2'), tot = f.totalUnread();
    // unread == sent − read (per recipient)
    const inv = (u1 === f.sentOf('h1') - r1) && (u2 === f.sentOf('h2') - r2);
    const ok =
      check(u1 === 0 && r1 === 3, `seed ${seed}: h1 u/r ${u1}/${r1}≠0/3`) &&
      check(u2 === 2 && r2 === 0, `seed ${seed}: h2 u/r ${u2}/${r2}≠2/0`) &&
      check(tot === 2, `seed ${seed}: totalUnread ${tot}≠2`) &&
      check(inv, `seed ${seed}: unread≠sent−read`);
    console.log(`${pad(seed, 6)} | ${pad(u1 + '/' + r1, 6)} | ${pad(u2 + '/' + r2, 6)} | ${pad(tot, 12)} | ${pad(inv ? '예' : '아니오', 22)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 읽음(svc.mail.read) 구독으로 미읽음 배지가 *읽으면 준다*: unread==sent−read(per recipient·0151 단조 증가 해소). 만료 반영(0153)·영속·late-join(0154)·회계 정합(0155)·질의(0156) 후속. mailFeedRead OFF=0151 비트 동일(read 토픽 미구독·reg).');
}

kit.MODES['exmlfread'] = exmlfread;
kit.ORDER.splice(1, 0, 'exmlfread');

(async () => { process.exit(await kit.cli(process.argv)); })();
