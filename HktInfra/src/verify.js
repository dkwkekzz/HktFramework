// HktInfra step-0154 — 헤드리스 검증 (MailFeed 영속·late-join·mailFeedReconstruct — 우편 op 저널 replay 로 배지 복원)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlfrec`.
//   더한 한 조각: MailFeed.reconstruct(journal) — 자기 영속 0 인데도 우편 박스 op 저널(0145)을 replay 해 배지(unread/sent/read/expired)를 재계산(MarketFeed 0113·ranking 0020 의 우편 판·CQRS late-join).
//   검증: ⒜ `reg`(키트) — reconstruct 미호출 = 0153 비트 동일. ⒝ `exmlfrec`(가설) — crash 후 reconstruct == 라이브 배지(digest 동일)·feed==우편 권위.
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
// mailPersist ON → 우편 op 저널 존재(reconstruct 의 복구원). 발행 3종·feed 3종 구독 ON.
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailSentPublish: true, mailReadPublish: true, mailExpirePublish: true, mailFeed: true, mailFeedRead: true, mailFeedExpire: true, mailTtl: 10, mailOps: ops, ...extra });

function exmlfrec(seeds) {
  console.log('== exmlfrec: MailFeed 영속·late-join(reconstruct — 우편 op 저널 replay). 자기 영속 0 인데도 우편 저널로 배지 완전 복원. crash 후 reconstruct==라이브(digest 동일). ==');
  console.log('seed   | 라이브 digest | reconstruct digest | 동일 | feed==auth | 판정');
  for (const seed of seeds) {
    // h1 3통 입금+수령(read 3)·h2 2통 입금+만료(expired 2)·h3 1통 입금 생존(unread 1).
    const ops = [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4'), SEND(9, 'e', 'y', 'h2', '5'), FETCH(15, 'h1'), SWEEP(30), SEND(32, 'g', 'z', 'h3', '6')];
    const r = run(base(seed, ops));
    const f = r.mailfeed, mail = r.mail;
    const liveDig = f.digest();
    // feed 투영 == 우편 박스 권위(라이브): unread==held·read==fetched·expired (per recipient).
    const feedEqAuth = ['h1', 'h2', 'h3'].every(h => f.unreadOf(h) === mail.held(h) && f.readOf(h) === mail.fetchedOf(h));
    // crash → 우편 저널 replay 로 복원.
    f.crash(); f.reconstruct(mail.journal);
    const recDig = f.digest();
    const same = (recDig === liveDig);
    const ok =
      check(feedEqAuth, `seed ${seed}: 라이브 feed≠우편 권위`) &&
      check(same, `seed ${seed}: reconstruct digest≠라이브(${recDig} vs ${liveDig})`) &&
      check(f.unreadOf('h3') === 1, `seed ${seed}: 복원 후 h3 unread≠1`);
    console.log(`${pad(seed, 6)} | ${pad('0x' + liveDig.toString(16), 13)} | ${pad('0x' + recDig.toString(16), 18)} | ${pad(same ? '예' : '아니오', 4)} | ${pad(feedEqAuth ? '예' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → MailFeed 는 자기 영속 0 이어도 우편 박스 durable op 저널(0145)을 replay 해 배지를 완전 복원한다(CQRS late-join·MarketFeed 0113 의 우편 판): crash 후 reconstruct == 라이브 배지(digest 동일)·다운타임에 놓친 발행도 우편 저널이 메운다. 회계 정합 capstone(0155)·배지 질의(0156) 후속. reconstruct 미호출=0153 비트 동일(reg).');
}

kit.MODES['exmlfrec'] = exmlfrec;
kit.ORDER.splice(1, 0, 'exmlfrec');

(async () => { process.exit(await kit.cli(process.argv)); })();
