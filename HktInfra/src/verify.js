// HktInfra step-0179 — 헤드리스 검증 (아이템 우편 saga 영구 실패 발행·mailFailPublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailfail`.
//   더한 한 조각: 영구 실패(permFailed·0178) 시 svc.mail.saga_failed 1회 발행(saga liveness 발행 종결 마디·포기 0174/재개 0177 의 종결 판·failPublished==permFailed·거래소 0138 의 우편 판). OFF·bus 부재면 발행 0 = 0178 비트 동일.
//   검증: ⒜ `reg`(키트) — failPublish OFF = 0178 비트 동일(구독 미추가). ⒝ `mailfail`(가설) — 영구 실패서 ON 은 failPublished==permFailed 발행+audit 관측·OFF 는 발행 0.
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
// 지속 손실(gid1)+상한2+readmitMax1 → 두 라운드 후 영구 실패. pub: mailFailPublish 토글. audit 관측. ttl 0.
const base = (seed, pub) => ({
  seed, ticks: 100, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: 2, mailReadmitMax: 1, mailFailPublish: pub,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'),
    SWEEP(30), SWEEP(40), SWEEP(50), READMIT(55), SWEEP(60), SWEEP(70), SWEEP(80)],
});

function mailfail(seeds) {
  console.log('== mailfail: 아이템 우편 saga *영구 실패 발행*(mailFailPublish). 영구 실패(permFailed·0178) 시 svc.mail.saga_failed 1회 발행(saga liveness 발행 종결 마디·포기 0174/재개 0177 의 종결 판·permFailed 와 1:1·거래소 0138 의 우편 판). ON 발행+관측 vs OFF 발행 0. ==');
  console.log('seed   | permFailed | ON published/audit | OFF published | 1:1+관측 | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const pf = on.mail.permFailed;
    const auditRx = on.audit.seen.get('svc.mail.saga_failed') || 0;
    const onMatch = on.mail.failPublished === pf && auditRx === pf && pf === 1;
    const offSilent = off.mail.failPublished === 0 && off.mail.permFailed === 1;   // OFF: 영구 실패는 하되 발행 0
    const ok =
      check(onMatch, `seed ${seed}: ON 발행/관측 불일치(permFailed ${pf}·pub ${on.mail.failPublished}·audit ${auditRx})`) &&
      check(offSilent, `seed ${seed}: OFF 발행 0 아님(pub ${off.mail.failPublished}·permFailed ${off.mail.permFailed})`);
    console.log(`${pad(seed, 6)} | ${pad(pf, 10)} | ${pad(on.mail.failPublished + '/' + auditRx, 18)} | ${pad(off.mail.failPublished, 13)} | ${pad(onMatch ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → readmitMax(0178) 도달로 *영구 실패*(permFailed)한 give 를 svc.mail.saga_failed 로 1회 발행한다 — 운영/audit 가 *발행자(우편) 무수정으로* saga 종결을 관측(포기 svc.mail.saga_abandoned 0174·재개 svc.mail.saga_readmitted 0177 의 종결 판·거래소 0138 의 우편 판). 이제 우편 saga 수명주기 발행이 포기·재개·종결 3종으로 완비. OFF 면 발행 0·구독 미추가 = 0178 비트 동일.');
}

kit.MODES['mailfail'] = mailfail;
kit.ORDER.splice(1, 0, 'mailfail');

(async () => { process.exit(await kit.cli(process.argv)); })();
