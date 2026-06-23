// HktInfra step-0149 — 헤드리스 검증 (우편 만료 발행·mailExpirePublish — svc.mail.expired·수명주기 발행 3종 완비)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0148 만료는 발행 0 — 발신자/운영이 관측 불가였다. 이 step 은 mailSweep 만료 시 통마다 svc.mail.expired 발행 → audit 관측. 우편 수명주기 발행 3종(sent 0144·read 0147·expired) 완비(거래소 sold/cancelled/expired 와 동형).
//   검증: ⒜ `reg`(키트) — mailExpirePublish OFF·mail OFF = 0148 비트 동일. ⒝ `exmail`(가설) — ON: expirePublished==expired==audit.seen(svc.mail.expired)·발행 비-침습·OFF: 발행 0·3종 발행 동시 관측.
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
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true, mail: true, ...extra });
// m0/m1→h1 수령·m2→h3 만료·m3→h5 생존. 3종 발행 모두 켜서 동시 관측.
const OPS = [
  SEND(5, 'm0', 'h0', 'h1', 'a'), SEND(8, 'm1', 'h2', 'h1', 'b'), SEND(12, 'm2', 'h0', 'h3', 'c'),
  FETCH(20, 'h1'), SEND(30, 'm3', 'h0', 'h5', 'd'), SWEEP(35),
];
const PUBS = { mailSentPublish: true, mailReadPublish: true, mailExpirePublish: true };

function exmail(seeds) {
  console.log('== exmail: 우편 만료 발행(mailExpirePublish·svc.mail.expired) — mailSweep 만료 시 통마다 발행, audit 관측. 수명주기 발행 3종(sent·read·expired) 동시 완비. ON: expirePublished==expired==audit.seen·비-침습. OFF: 발행 0. ==');
  console.log('seed   | expired | expirePublished | audit(expired) | audit(sent/read) | OFF발행0 | 비-침습 | 판정');
  for (const seed of seeds) {
    const on = run({ ...base(seed, { mailOps: OPS, mailTtl: 10, ...PUBS }) });
    const off = run({ ...base(seed, { mailOps: OPS, mailTtl: 10, mailSentPublish: true, mailReadPublish: true, mailExpirePublish: false }) });
    const mOn = on.mail, mOff = off.mail;
    const exp = mOn.expired;                                       // 1
    const pub = mOn.expirePublished;                               // 1
    const seenE = on.audit.seen.get('svc.mail.expired') || 0;      // 1
    const seenS = on.audit.seen.get('svc.mail.sent') || 0;         // 4 (3종 동시)
    const seenR = on.audit.seen.get('svc.mail.read') || 0;         // 2
    const offPub = mOff.expirePublished;                           // 0
    const nonInv = (mOn.expired === mOff.expired && mOn.totalHeld() === mOff.totalHeld() && mOn.fetched === mOff.fetched);
    const ok =
      check(exp === 1 && pub === 1, `seed ${seed}: expired ${exp}·published ${pub}(≠1)`) &&
      check(seenE === 1, `seed ${seed}: audit svc.mail.expired ${seenE}(≠1)`) &&
      check(seenS === 4 && seenR === 2, `seed ${seed}: 3종 동시 관측 실패(sent ${seenS}≠4·read ${seenR}≠2)`) &&
      check(offPub === 0, `seed ${seed}: OFF 발행 ${offPub}(≠0)`) &&
      check(nonInv, `seed ${seed}: 발행이 상태 변경(비-침습 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(exp, 7)} | ${pad(pub, 15)} | ${pad(seenE, 14)} | ${pad(seenS + '/' + seenR, 16)} | ${pad(offPub === 0 ? '예' : '아니오', 8)} | ${pad(nonInv ? '예' : '아니오', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 만료 발행으로 우편 수명주기 발행 3종(입금 svc.mail.sent 0144·읽음 svc.mail.read 0147·만료 svc.mail.expired) 완비 — 거래소(sold/cancelled/expired)와 동형. audit 는 구독 행 추가만으로 3종 동시 관측(발행자 무수정). 발행은 우편함 권위 불변(비-침습·expirePublished==expired==audit.seen). OFF·bus 부재면 발행 0 = 0148 비트 동일(reg).');
  console.log('    다음(0150): 회계 정합 capstone(mailConsistent — sent==held+fetched+expired) — 0142~0149 arc 의 창발 불변을 단언(거래소 0140 sagaLiveConsistent 의 우편 판).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
