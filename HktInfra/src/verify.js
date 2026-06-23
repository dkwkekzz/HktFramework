// HktInfra step-0151 — 헤드리스 검증 (우편 미읽음 배지 읽기 모델·mailFeed — svc.mail.sent 구독→수신자별 unread)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmailfeed`.
//   더한 한 조각: MailFeed — 우편 박스가 발행하는 svc.mail.sent(0144)를 *소비만* 해 수신자별 미읽음(unread) 투영을 만든다(거래소 MarketFeed 0112 의 우편 판·CQRS read model). 우편함 권위 0·발신 0.
//   검증: ⒜ `reg`(키트) — mailFeed OFF = 0150 비트 동일(박스·구독 0). ⒝ `exmailfeed`(가설) — 발행된 입금마다 수신자 unread++·feed 투영이 우편 박스 권위(sent)와 일치.
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
// 발행→구독 전제: bus ON·mailSentPublish ON·mailFeed ON. mailFeed 는 svc.mail.sent 만 소비(unread++) — 읽음/만료 반영은 0152~0153.
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailSentPublish: true, mailFeed: true, mailOps: ops, ...extra });

function exmailfeed(seeds) {
  console.log('== exmailfeed: 우편 미읽음 배지 읽기 모델(MailFeed·svc.mail.sent 구독→수신자별 unread). 우편함 권위 0·발신 0(거래소 MarketFeed 0112 의 우편 판). 발행된 입금마다 수신자 unread++·feed==우편 박스 sent. ==');
  console.log('seed   | h1 unread | h2 unread | totalUnread | mail.sent | feed==auth | 판정');
  for (const seed of seeds) {
    // 5통 입금: h1 ×3·h2 ×2 → unreadOf(h1)==3·unreadOf(h2)==2·totalUnread==5.
    const ops = [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4'), SEND(9, 'e', 'y', 'h2', '5')];
    const r = run(base(seed, ops));
    const f = r.mailfeed, mail = r.mail;
    const u1 = f.unreadOf('h1'), u2 = f.unreadOf('h2'), tot = f.totalUnread();
    // feed 투영이 우편 박스 권위(입금 sent)와 일치 — 발행자 무수정 소비자가 권위 스트림을 정확히 미러.
    const feedEqAuth = (tot === mail.sent) && (u1 === mail.held('h1') + mail.fetchedOf('h1')) && (u2 === mail.held('h2') + mail.fetchedOf('h2'));
    const ok =
      check(u1 === 3, `seed ${seed}: h1 unread ${u1}≠3`) &&
      check(u2 === 2, `seed ${seed}: h2 unread ${u2}≠2`) &&
      check(tot === 5, `seed ${seed}: totalUnread ${tot}≠5`) &&
      check(feedEqAuth, `seed ${seed}: feed 투영≠우편 권위(tot ${tot} vs sent ${mail.sent})`);
    console.log(`${pad(seed, 6)} | ${pad(u1, 9)} | ${pad(u2, 9)} | ${pad(tot, 11)} | ${pad(mail.sent, 9)} | ${pad(feedEqAuth ? '예' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → MailFeed 는 우편 발행 스트림(svc.mail.sent)을 소비만 해 수신자별 미읽음 배지를 투영한다(원장 권위 0·발신 0). 0016 발행자 무수정 소비자: 우편/버스 코드·발신 스트림 비트 동일, 추가는 구독 행 + 박스뿐(reg 0). 읽음(0152)·만료(0153) 반영·영속(0154)·회계 정합(0155)·질의(0156) 후속.');
}

kit.MODES['exmailfeed'] = exmailfeed;
kit.ORDER.splice(1, 0, 'exmailfeed');

(async () => { process.exit(await kit.cli(process.argv)); })();
