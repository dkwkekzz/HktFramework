// HktInfra step-0178 — 헤드리스 검증 (아이템 우편 saga 재admission 횟수 상한·mailReadmitMax)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailreadmitmax`.
//   더한 한 조각: gid 가 readmitMax 회 재admission 된 뒤 또 포기되면 *영구 실패*(permFailed)로 abandonedGive 에 안 넣어 재admission 차단(무한 abandon↔readmit 루프 방지·거래소 0137 의 우편 판). pending 엔 잔존(sagaConsistent 불변). readmitMax 0 면 무제한 = 0177 비트 동일.
//   검증: ⒜ `reg`(키트) — readmitMax 0 = 0177 비트 동일. ⒝ `mailreadmitmax`(가설) — 반복 abandon↔readmit 서 상한(1)은 permFailed 1·재admission 차단(readmitted 1)·무제한(0)은 readmitted 2·permFailed 0. 양 체제 sagaConsistent.
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
// 지속 손실(gid1)+상한2. 두 라운드 abandon↔readmit. rmMax: 재admission 횟수 상한(0=무제한). ttl 0.
const base = (seed, rmMax) => ({
  seed, ticks: 100, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: 2, mailReadmitMax: rmMax,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'),
    SWEEP(30), SWEEP(40), SWEEP(50), READMIT(55), SWEEP(60), SWEEP(70), SWEEP(80), READMIT(85), SWEEP(90)],
});

function mailreadmitmax(seeds) {
  console.log('== mailreadmitmax: 아이템 우편 saga *재admission 횟수 상한*(mailReadmitMax). 무한 abandon↔readmit 루프 차단 — gid 가 N회 재admission 후 또 포기되면 영구 실패(permFailed)로 재admission 차단. 거래소 0137 의 우편 판. 상한1 vs 무제한. ==');
  console.log('seed   | 무제한 readmitted/perm | 상한1 readmitted/perm | 차단 | sagaConsistent 양체제 | 판정');
  for (const seed of seeds) {
    const inf = run(base(seed, 0));
    const cap = run(base(seed, 1));
    const consistent = inf.mail.sagaConsistent() && cap.mail.sagaConsistent();
    const capped = cap.mail.permFailed === 1 && cap.mail.readmitted === 1 && cap.mail.abandonedGive.size === 0;   // 1회 재admission 후 또 포기→영구 실패·재admission 차단
    const unbounded = inf.mail.permFailed === 0 && inf.mail.readmitted === 2;   // 무제한: 두 번 재admission·영구 실패 0
    const ok =
      check(consistent, `seed ${seed}: 어느 체제서 sagaConsistent false`) &&
      check(unbounded, `seed ${seed}: 무제한 기대 어긋남(readmitted ${inf.mail.readmitted}/perm ${inf.mail.permFailed})`) &&
      check(capped, `seed ${seed}: 상한 기대 어긋남(readmitted ${cap.mail.readmitted}/perm ${cap.mail.permFailed}/abandonedGive ${cap.mail.abandonedGive.size})`);
    console.log(`${pad(seed, 6)} | ${pad(inf.mail.readmitted + '/' + inf.mail.permFailed, 22)} | ${pad(cap.mail.readmitted + '/' + cap.mail.permFailed, 21)} | ${pad(capped ? '예' : '아니오', 4)} | ${pad(consistent ? '예' : '아니오', 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 손실이 영영 안 풀리면 abandon↔readmit 가 무한 반복될 수 있다(무제한·readmitted 누적). readmitMax 상한은 gid 당 N회 재admission 후 또 포기되면 *영구 실패*(permFailed)로 못 박아 재admission 을 차단한다(abandonedGive 제외). 그래도 abort 아님 — pending(Set)엔 미해결로 남겨 sagaConsistent(gives==acked+pending) 불변. 0059 recoverMaxRetries·거래소 0137 의 우편 판. (영구 실패 발행=후속 0179.)');
}

kit.MODES['mailreadmitmax'] = mailreadmitmax;
kit.ORDER.splice(1, 0, 'mailreadmitmax');

(async () => { process.exit(await kit.cli(process.argv)); })();
