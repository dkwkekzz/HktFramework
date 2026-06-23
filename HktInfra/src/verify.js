// HktInfra step-0173 — 헤드리스 검증 (아이템 우편 saga 재시도 상한·mailMaxRetries)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailmax`.
//   더한 한 조각: _resendPending 에 gid 당 재전송 상한(maxRetries). 도달 시 그 give 포기(pendingGive 제거·재전송 중단·giveAbandoned++)·pending(Set) 잔존(sagaConsistent 불변·거래소 0131 의 우편 판). maxRetries 0 면 무제한 = 0172 비트 동일. 테스트 seam ackDropAlways(지속 회신 손실).
//   검증: ⒜ `reg`(키트) — maxRetries 0·ackDropAlways 미사용 = 0172 비트 동일. ⒝ `mailmax`(가설) — 지속 손실서 상한 도달 후 포기(giveAbandoned 1·retries==max)·무제한은 매 sweep 재전송(retries==sweeps). 양 체제 pending 잔존·sagaConsistent.
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
// gid1(둘째 give·item1) 회신을 *지속* 드롭 → 재전송이 영영 통과 못 함. autoRetry+주기 sweep 4회. max: 재시도 상한(0=무제한). ttl 0 → sweep 은 autoRetry 만.
const base = (seed, max) => ({
  seed, ticks: 70, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: max,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SWEEP(30), SWEEP(40), SWEEP(50), SWEEP(60)],
});

function mailmax(seeds) {
  console.log('== mailmax: 아이템 우편 saga *재시도 상한*(mailMaxRetries). 지속 회신 손실(gid1)서 무제한 재전송은 매 sweep 재발신·상한(max=2)은 N회 후 포기(giveAbandoned++·재전송 중단·pending 잔존). 거래소 0131 의 우편 판. 양 체제 sagaConsistent. ==');
  console.log('seed   | 무제한 retries/abandoned | 상한2 retries/abandoned | 상한 동작 | sagaConsistent 양체제 | 판정');
  for (const seed of seeds) {
    const inf = run(base(seed, 0));
    const cap = run(base(seed, 2));
    const consistent = inf.mail.sagaConsistent() && cap.mail.sagaConsistent();
    const capped = cap.mail.giveAbandoned === 1 && cap.mail.retries === 2 && cap.mail.pendingGives() === 1;   // 2회 후 포기·pending 잔존
    const unbounded = inf.mail.giveAbandoned === 0 && inf.mail.retries === 4 && inf.mail.pendingGives() === 1;  // 매 sweep(4회) 재전송·포기 0
    const ok =
      check(consistent, `seed ${seed}: 어느 체제서 sagaConsistent false`) &&
      check(unbounded, `seed ${seed}: 무제한 기대 어긋남(retries ${inf.mail.retries}/abandoned ${inf.mail.giveAbandoned}/pend ${inf.mail.pendingGives()})`) &&
      check(capped, `seed ${seed}: 상한 기대 어긋남(retries ${cap.mail.retries}/abandoned ${cap.mail.giveAbandoned}/pend ${cap.mail.pendingGives()})`);
    console.log(`${pad(seed, 6)} | ${pad(inf.mail.retries + '/' + inf.mail.giveAbandoned, 24)} | ${pad(cap.mail.retries + '/' + cap.mail.giveAbandoned, 23)} | ${pad(capped ? '포기 1' : '아니오', 9)} | ${pad(consistent ? '예' : '아니오', 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 지속 회신 손실(가방 echo 영영 안 옴)서 무제한 재전송은 매 주기 sweep 마다 같은 give 를 재발신해 네트워크를 영영 누른다. maxRetries 상한은 gid 당 N회 재전송 후 그 give 를 *포기*(재전송 중단·giveAbandoned++) — 그러나 abort 가 아니라(give 가 실제 성공했을 수 있어) pending(Set)엔 미해결로 남긴다(sagaConsistent: gives==acked+pending 불변). 0059 recoverMaxRetries·거래소 0131 의 우편 판.');
}

kit.MODES['mailmax'] = mailmax;
kit.ORDER.splice(1, 0, 'mailmax');

(async () => { process.exit(await kit.cli(process.argv)); })();
