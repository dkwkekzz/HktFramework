// HktInfra step-0168 — 헤드리스 검증 (아이템 우편 saga 회신 재전송 + idempotent dedup·mailRetry·가방 sagaDedup)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlretry`.
//   더한 한 조각: mailRetry op 이 pendingGive 의 미해결 give 를 같은 gid 로 재발신(_resendPending). 가방 sagaDedup 이 (replyTo,gid) 로 *재실행 없이 재회신* → pending drain·재실행 0. 거래소 0126 의 우편 판.
//   검증: ⒜ `reg`(키트) — mailRetry op 부재 = 0167 비트 동일. ⒝ `exmlretry`(가설) — dedup ON: 재전송→재회신→pending 0·escrowXfers 불변(재실행 0) / dedup OFF: 재실행→escrowXfers++ (안전 위반·아이템 오배치).
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
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const RETRY = (at) => ({ at, op: { type: 'mailRetry' } });
// gid1(둘째 발신 인출) 회신 1회 손실 → pending {1} → mailRetry 재전송. dedup ON/OFF 대조.
const base = (seed, dedup) => ({
  seed, ticks: 50, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: dedup, mailTtl: 10, mailAckDrop: [1],
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30), RETRY(40)],
});

function exmlretry(seeds) {
  console.log('== exmlretry: 아이템 우편 saga 회신 재전송 + idempotent dedup(mailRetry). 회신 손실된 give 를 같은 gid 로 재전송 → 가방 sagaDedup 이 *재실행 없이 재회신*(ON) vs 재실행(OFF·escrowXfers++ 안전 위반). 거래소 0126 의 우편 판. ==');
  console.log('seed   | dedup ON acked/pend/xfers | dedup OFF acked/pend/xfers | 재실행 0(ON) | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const onOk = (on.mail.ackedGives === 4 && on.mail.pendingGives() === 0 && on.mail.giveOks === 4 && on.mail.giveFails === 0 && on.inventory.escrowXfers === 4 && on.mail.retries === 1 && on.mail.itemConsistent());
    const offHazard = (off.inventory.escrowXfers === 5);   // dedup OFF: 재전송이 *재실행*돼 spurious transfer(아이템 오배치·안전 위반)
    const ok =
      check(onOk, `seed ${seed}: dedup ON 안전 drain 어긋남(acked ${on.mail.ackedGives}·pending ${on.mail.pendingGives()}·xfers ${on.inventory.escrowXfers}·oks ${on.mail.giveOks})`) &&
      check(offHazard, `seed ${seed}: dedup OFF 재실행 안 일어남(escrowXfers ${off.inventory.escrowXfers} != 5) — dedup 의 의의 미입증`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.ackedGives + '/' + on.mail.pendingGives() + '/' + on.inventory.escrowXfers, 26)} | ${pad(off.mail.ackedGives + '/' + off.mail.pendingGives() + '/' + off.inventory.escrowXfers, 26)} | ${pad(on.inventory.escrowXfers === 4 ? '예' : '아니오', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → dedup ON: 재전송→가방이 저장된 ok 재회신(재실행 0)→pending 0 drain·escrowXfers 4 불변·itemConsistent 보존. dedup OFF: 재전송이 *재실행*(이미 만료 반환된 item1 을 다시 escrow 로)→escrowXfers 5·아이템 오배치(안전 위반). 회신만 손실된 give 의 재전송은 *재회신*이어야 안전 — 가방 (replyTo,gid) dedup 이 보장.');
  console.log('    dedup 유계화(saga_done 재사용 0169?)·정합 capstone(sagaConsistent)·transfers capstone(giveOks==escrowXfers 0170) 후속.');
}

kit.MODES['exmlretry'] = exmlretry;
kit.ORDER.splice(1, 0, 'exmlretry');

(async () => { process.exit(await kit.cli(process.argv)); })();
