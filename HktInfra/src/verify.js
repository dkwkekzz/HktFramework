// HktInfra step-0172 — 헤드리스 검증 (아이템 우편 saga 자동 주기 재전송·mailAutoRetry)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailauto`.
//   더한 한 조각: mailAutoRetry ON 이면 mailSweep op 이 미해결 give 재전송도 트리거(주기적 타임아웃 재전송·거래소 0129 의 우편 판). 명시 mailRetry op(0168) 없이 같은 주기 신호(sweep)로 pending drain. ttl 체크 앞·OFF 면 0171 비트 동일.
//   검증: ⒜ `reg`(키트) — autoRetry OFF = 0171 비트 동일. ⒝ `mailauto`(가설) — 회신 손실 후 명시 RETRY 없이 주기 sweep 만으로 ON 은 pending 0 drain(retries≥1)·OFF 는 pending 잔존. 양 체제 sagaConsistent.
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
// 회신 손실(ackDrop=[1]) 후 *명시 RETRY 없이* 주기 sweep 만 둔다. ttl 0 → sweep 은 autoRetry 만(TTL 회수 격리). auto: mailAutoRetry 토글.
const base = (seed, auto) => ({
  seed, ticks: 60, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0, mailAckDrop: [1], mailAutoRetry: auto,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30), SWEEP(40), SWEEP(50)],
});

function mailauto(seeds) {
  console.log('== mailauto: 아이템 우편 saga *자동 주기 재전송*(mailAutoRetry). 회신 손실 후 *명시 mailRetry op 없이* 주기 mailSweep 만으로 미해결 give 를 재전송 → pending drain. 거래소 0129(exchSweep autoRetry)의 우편 판. ON drain vs OFF 잔존. ==');
  console.log('seed   | OFF pending/retries | ON pending/retries | ON drain | sagaConsistent 양체제 | 판정');
  for (const seed of seeds) {
    const off = run(base(seed, false));
    const on = run(base(seed, true));
    const offPend = off.mail.pendingGives(), onPend = on.mail.pendingGives();
    const consistent = off.mail.sagaConsistent() && on.mail.sagaConsistent();
    const drained = onPend === 0 && on.mail.retries >= 1;    // ON: sweep 재전송이 손실 회신을 회복 → pending 0
    const offStuck = offPend >= 1 && off.mail.retries === 0;  // OFF: 명시 RETRY 없어 손실 give 잔존(재전송 0)
    const closed = on.mail.gives === on.mail.ackedGives;      // ON: 닫힌 고리(전 give 회신 수신)
    const ok =
      check(consistent, `seed ${seed}: 어느 체제서 sagaConsistent false`) &&
      check(offStuck, `seed ${seed}: OFF 가 pending 잔존 안 함(pend ${offPend}/retries ${off.mail.retries})`) &&
      check(drained, `seed ${seed}: ON drain 실패(pend ${onPend}/retries ${on.mail.retries})`) &&
      check(closed, `seed ${seed}: ON 닫힌 고리 아님(gives ${on.mail.gives}≠acked ${on.mail.ackedGives})`);
    console.log(`${pad(seed, 6)} | ${pad(offPend + '/' + off.mail.retries, 19)} | ${pad(onPend + '/' + on.mail.retries, 18)} | ${pad(drained ? '예' : '아니오', 8)} | ${pad(consistent ? '예' : '아니오', 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 회신 손실로 미해결(pending) 남은 give 를, 명시 mailRetry op 없이 *주기 mailSweep* 신호만으로 자동 재전송한다(거래소 0129 의 우편 판). 가방 dedup(0168)이 재실행 0 을 보장하므로 재전송은 안전(재회신만 유도). autoRetry ON 은 pending 0 으로 drain·OFF 는 잔존(명시 재전송 필요) — 실서버의 타임아웃 기반 주기 재전송을 우편의 기존 주기 신호(sweep)에 피기백.');
}

kit.MODES['mailauto'] = mailauto;
kit.ORDER.splice(1, 0, 'mailauto');

(async () => { process.exit(await kit.cli(process.argv)); })();
