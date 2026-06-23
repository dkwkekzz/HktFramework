// HktInfra step-0168 — 헤드리스 검증 (아이템 우편 미해결 give 재전송 멱등·mailRetry + 가방 sagaDedup)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlretry`.
//   더한 한 조각: _resendPending() 이 pending give 를 같은 gid 로 재발신·가방 sagaDedup 가 재실행 없이 원결과 재회신(거래소 0126 의 우편 판·재실행 0). pending Set→Map(재전송 소스).
//   검증: ⒜ `reg`(키트) — mailRetryAt 미주입·sagaDedup OFF = 0167 비트 동일. ⒝ `exmlretry`(가설) — pending 중 재전송→가방 transfers 무증가(dedup)·mail acked 1회·이중 이동 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
// sagaDedup ON — 가방이 (replyTo,gid) 재전송을 재실행 없이 원결과 재회신.
const base = (seed, mailOps, invOps, retryAt, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailPersist: true, mailOps, invOps, mailRetryAt: retryAt, ...extra });

function exmlretry(seeds) {
  console.log('== exmlretry: 아이템 우편 미해결 give 재전송 멱등(mailRetry + 가방 sagaDedup). pending give 를 같은 gid 로 재발신해도 가방이 재실행 없이 원결과 재회신(거래소 0126 의 우편 판·재실행 0·이중 이동 0). ==');
  console.log('seed   | gives | retries | acked | inv transfers | item0 owner | 이중 이동 0 | 판정');
  for (const seed of seeds) {
    // x 가 item0 pickup → 발신(give@8). 같은 tick(8) 발신 직후 재전송 — 첫 회신 처리 전이라 pending 잔존·재전송. 가방 dedup 으로 재실행 0.
    const invOps = [PICK(3, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0')];
    const r = run(base(seed, mailOps, invOps, [8]));
    const inv = r.inventory, mail = r.mail;
    // 발신 give 1건 + 재전송 1건. 가방 transfers 는 1(dedup·재실행 0)·mail acked 1(idempotent)·item0 owner=mailcustody.
    const noDouble = inv.transfers === 1 && mail.acked === 1 && mail.ackedOk === 1;
    const ok =
      check(mail.gives === 1, `seed ${seed}: gives ${mail.gives}≠1`) &&
      check(mail.retries >= 1, `seed ${seed}: retries ${mail.retries}<1(재전송 미발생·pending 이미 drain?)`) &&
      check(noDouble, `seed ${seed}: 이중 이동(transfers ${inv.transfers}·acked ${mail.acked})`) &&
      check(inv.ownerOf('item0') === 'mailcustody', `seed ${seed}: item0 owner ${inv.ownerOf('item0')}≠mailcustody`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(mail.retries, 7)} | ${pad(mail.acked, 5)} | ${pad(inv.transfers, 13)} | ${pad(inv.ownerOf('item0'), 11)} | ${pad(noDouble ? '예' : '아니오', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 미해결 give 재전송이 *멱등*하다: 같은 gid 재발신→가방 sagaDedup 가 재실행 없이 원결과 재회신(거래소 0126 의 우편 판). 가방 transfers 무증가(이중 이동 0)·mail acked 1회(pending.has 가 둘째 회신 무시). 회신 손실(멀티프로세스·#9) 회복의 안전한 토대. 교차 정합(0169)·liveness capstone(0170) 후속. mailRetry 미주입=0167 비트 동일(reg).');
}

kit.MODES['exmlretry'] = exmlretry;
kit.ORDER.splice(1, 0, 'exmlretry');

(async () => { process.exit(await kit.cli(process.argv)); })();
