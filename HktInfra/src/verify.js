// HktInfra step-0177 — 헤드리스 검증 (아이템 우편 saga 재admission 발행·mailReadmitPublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailreadmitpub`.
//   더한 한 조각: _readmit 으로 포기 give 재개(0176) 시 svc.mail.saga_readmitted 1회 발행(0174 포기 발행의 짝·운영 가시화·audit 관측·readmitPublished==readmitted·거래소 0135 의 우편 판). OFF·bus 부재면 발행 0 = 0176 비트 동일.
//   검증: ⒜ `reg`(키트) — readmitPublish OFF = 0176 비트 동일(구독 미추가). ⒝ `mailreadmitpub`(가설) — 포기→재admission 서 ON 은 readmitPublished==readmitted 발행+audit 관측·OFF 는 발행 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const READMIT = (at) => ({ at, op: { type: 'mailReadmit' } });
// 지속 손실(gid1)+상한2 → sweep50 포기·readmit55 재개. pub: mailReadmitPublish 토글. audit 관측. ttl 0.
const base = (seed, pub) => ({
  seed, ticks: 70, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: 2, mailReadmitPublish: pub,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SWEEP(30), SWEEP(40), SWEEP(50), READMIT(55), SWEEP(60)],
});

function mailreadmitpub(seeds) {
  console.log('== mailreadmitpub: 아이템 우편 saga *재admission 발행*(mailReadmitPublish). _readmit 으로 포기 give 재개 시 svc.mail.saga_readmitted 1회 발행(0174 포기 발행의 짝·audit 관측·readmitted 와 1:1·거래소 0135 의 우편 판). ON 발행+관측 vs OFF 발행 0. ==');
  console.log('seed   | readmitted | ON published/audit | OFF published | 1:1+관측 | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const rm = on.mail.readmitted;
    const auditRx = on.audit.seen.get('svc.mail.saga_readmitted') || 0;
    const onMatch = on.mail.readmitPublished === rm && auditRx === rm && rm === 1;
    const offSilent = off.mail.readmitPublished === 0 && off.mail.readmitted === 1;   // OFF: 재admission 은 하되 발행 0
    const ok =
      check(onMatch, `seed ${seed}: ON 발행/관측 불일치(readmitted ${rm}·pub ${on.mail.readmitPublished}·audit ${auditRx})`) &&
      check(offSilent, `seed ${seed}: OFF 발행 0 아님(pub ${off.mail.readmitPublished}·readmitted ${off.mail.readmitted})`);
    console.log(`${pad(seed, 6)} | ${pad(rm, 10)} | ${pad(on.mail.readmitPublished + '/' + auditRx, 18)} | ${pad(off.mail.readmitPublished, 13)} | ${pad(onMatch ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 포기(0174)된 give 를 재admission(0176)으로 재개할 때 svc.mail.saga_readmitted 를 1회 발행한다 — 운영/audit 가 *발행자(우편) 무수정으로* 재개를 관측(0174 포기 발행 svc.mail.saga_abandoned 의 짝·거래소 0135 의 우편 판·발행==재admission==audit 관측 1:1). 포기↔재개 수명주기 발행 한 쌍 완비. OFF 면 발행 0·구독 미추가 = 0176 비트 동일.');
}

kit.MODES['mailreadmitpub'] = mailreadmitpub;
kit.ORDER.splice(1, 0, 'mailreadmitpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
