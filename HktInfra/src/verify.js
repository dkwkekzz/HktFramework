// HktInfra step-0144 — 헤드리스 검증 (우편 입금 발행·mailSentPublish — svc.mail.sent·audit 무수정 관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 입금(mailSend)을 버스로 svc.mail.sent 발행 → audit(발행자 무수정 소비자)가 관측. 거래소 0108(exchangePublish→svc.exchange.sold)의 우편 판. 우편함 권위는 여전히 MailService(발행은 파생 관찰 스트림).
//   검증: ⒜ `reg`(키트) — mailSentPublish OFF·mail OFF = 0143 비트 동일. ⒝ `exmail`(가설) — ON 이면 sentPublished==sent==audit.seen(svc.mail.sent)·발행이 우편함 상태 불변(발행은 비-침습)·OFF 면 발행 0.
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
// 발행 검증엔 bus+audit 필요(거래소 발행 검증과 동형). mail+mailSentPublish 로 우편 박스가 svc.mail.sent 발행.
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true, mail: true, ...extra });

function exmail(seeds) {
  console.log('== exmail: 우편 입금 발행(mailSentPublish·svc.mail.sent) — 입금을 버스로 발행, audit(발행자 무수정 소비자)가 관측. ON: sentPublished==sent==audit.seen·발행이 우편함 불변(비-침습). OFF: 발행 0. ==');
  console.log('seed   | sent | sentPublished | audit(svc.mail.sent) | totalHeld | OFF발행0 | 발행불변held | 판정');
  for (const seed of seeds) {
    const ops = [SEND(10, 'm0', 'hero0', 'hero1', 'a'), SEND(12, 'm1', 'hero2', 'hero1', 'b'), SEND(14, 'm2', 'hero0', 'hero3', 'c')];
    const on = run({ ...base(seed, { mailOps: ops, mailSentPublish: true }) });
    const off = run({ ...base(seed, { mailOps: ops, mailSentPublish: false }) });
    const mOn = on.mail, mOff = off.mail;
    const pub = mOn.sentPublished;                            // 3
    const seen = on.audit.seen.get('svc.mail.sent') || 0;     // 3 (audit 가 무수정으로 관측)
    const offPub = mOff.sentPublished;                        // 0
    const heldSame = (mOn.totalHeld() === mOff.totalHeld());  // 발행 ON/OFF 우편함 상태 동일(발행 비-침습)
    const ok =
      check(mOn.sent === 3 && pub === 3, `seed ${seed}: sent ${mOn.sent}·published ${pub}(≠3)`) &&
      check(seen === 3, `seed ${seed}: audit svc.mail.sent ${seen}(≠3)`) &&
      check(offPub === 0, `seed ${seed}: OFF 발행 ${offPub}(≠0)`) &&
      check(heldSame, `seed ${seed}: 발행이 우편함 변경(ON ${mOn.totalHeld()}≠OFF ${mOff.totalHeld()})`);
    console.log(`${pad(seed, 6)} | ${pad(mOn.sent, 4)} | ${pad(pub, 13)} | ${pad(seen, 20)} | ${pad(mOn.totalHeld(), 9)} | ${pad(offPub === 0 ? '예' : '아니오', 8)} | ${pad(heldSame ? '예' : '아니오', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 입금 발행은 *발행자 무수정 소비자* 패턴(거래소 0108·랭킹 0019)의 우편 판: 우편 박스는 svc.mail.sent 를 발행만, audit 는 구독 행 추가만으로 관측. 발행은 우편함 권위 불변(비-침습·sentPublished==sent==audit.seen). OFF·bus 부재면 발행 0 = 0143 비트 동일(reg).');
  console.log('    다음(0145): 영속·failover(mailPersist — op 저널 replay) — crash 후 우편함 재구성(거래소 0109 의 우편 판).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
