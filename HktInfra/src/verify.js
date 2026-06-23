// HktInfra step-0174 — 헤드리스 검증 (아이템 우편 saga 포기 발행·mailAbandonPublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailabandon`.
//   더한 한 조각: maxRetries 상한 도달 포기(0173) 시 svc.mail.saga_abandoned 1회 발행(운영 가시화·audit 관측·giveAbandoned 와 1:1·거래소 0132 의 우편 판). OFF·bus 부재면 발행 0 = 0173 비트 동일.
//   검증: ⒜ `reg`(키트) — abandonPublish OFF = 0173 비트 동일(토폴로지 구독 미추가). ⒝ `mailabandon`(가설) — 지속 손실 포기서 ON 은 abandonPublished==giveAbandoned 발행+audit 관측·OFF 는 발행 0.
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
// 지속 손실(gid1)+상한2 → 포기 1. pub: mailAbandonPublish 토글. audit 관측. ttl 0 → sweep 은 autoRetry 만.
const base = (seed, pub) => ({
  seed, ticks: 70, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: 2, mailAbandonPublish: pub,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SWEEP(30), SWEEP(40), SWEEP(50), SWEEP(60)],
});

function mailabandon(seeds) {
  console.log('== mailabandon: 아이템 우편 saga *포기 발행*(mailAbandonPublish). 재시도 상한(0173) 도달로 포기한 give 를 svc.mail.saga_abandoned 로 1회 발행(운영 가시화·audit 관측·giveAbandoned 와 1:1). 거래소 0132 의 우편 판. ON 발행+관측 vs OFF 발행 0. ==');
  console.log('seed   | abandoned | ON published/audit | OFF published | 1:1+관측 | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const ab = on.mail.giveAbandoned;
    const auditRx = on.audit.seen.get('svc.mail.saga_abandoned') || 0;
    const onMatch = on.mail.abandonPublished === ab && auditRx === ab && ab === 1;   // 발행==포기·audit 관측==발행
    const offSilent = off.mail.abandonPublished === 0 && off.mail.giveAbandoned === 1;   // OFF: 포기는 하되 발행 0
    const ok =
      check(onMatch, `seed ${seed}: ON 발행/관측 불일치(abandoned ${ab}·pub ${on.mail.abandonPublished}·audit ${auditRx})`) &&
      check(offSilent, `seed ${seed}: OFF 발행 0 아님(pub ${off.mail.abandonPublished})`);
    console.log(`${pad(seed, 6)} | ${pad(ab, 9)} | ${pad(on.mail.abandonPublished + '/' + auditRx, 18)} | ${pad(off.mail.abandonPublished, 13)} | ${pad(onMatch ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재전송 상한 도달로 포기한 give(영구 미해결)를 svc.mail.saga_abandoned 로 1회 발행한다 — 운영/audit 가 *발행자(우편) 무수정으로* 영구 손실을 관측(거래소 0132 의 우편 판·발행==포기==audit 관측 1:1). 포기는 발행해도 pending 잔존(미해결·재admission 여지·후속). OFF 면 발행 0·구독 미추가 = 0173 비트 동일.');
}

kit.MODES['mailabandon'] = mailabandon;
kit.ORDER.splice(1, 0, 'mailabandon');

(async () => { process.exit(await kit.cli(process.argv)); })();
