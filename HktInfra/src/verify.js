// HktInfra step-0167 — 헤드리스 검증 (아이템 우편 saga 미해결 추적 + 회신 손실 감지·pendingGives·gid)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlpend`.
//   더한 한 조각: saga ON 이면 _custody 가 give 마다 gid 부여·pending 에 add, item_result 회신이 delete. 정상 0 drain·회신 손실(테스트 seam ackDrop) 시 잃은 gid 잔존(ackedGives<gives·격차 가시). 거래소 0125 의 우편 판.
//   검증: ⒜ `reg`(키트) — saga OFF·gid 부재 = 0166 비트 동일. ⒝ `exmlpend`(가설) — 무손실: pending 0·gives==acked / 회신 손실: pending=잃은 수·ackedGives<gives.
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
// give 4건(발신2 gid0/1·수령1 gid2·만료1 gid3). drop=[1] 이면 발신2 회신 손실 → pending {1}.
const base = (seed, drop) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailSaga: true, mailTtl: 10, mailAckDrop: drop,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30)],
});

function exmlpend(seeds) {
  console.log('== exmlpend: 아이템 우편 saga 미해결 추적 + 회신 손실 감지(pendingGives·gid). 무손실서 pending 0 drain(닫힌 고리)·회신 손실 시 잃은 gid 가 pending 에 남는다(ackedGives<gives 격차 가시). 거래소 0125 의 우편 판. ==');
  console.log('seed   | 무손실 gives/acked/pending | 손실[1] gives/acked/pending | 격차 가시 | 판정');
  for (const seed of seeds) {
    const clean = run(base(seed, null));
    const lossy = run(base(seed, [1]));
    const cleanOk = (clean.mail.gives === 4 && clean.mail.ackedGives === 4 && clean.mail.pendingGives() === 0);
    const lossyOk = (lossy.mail.gives === 4 && lossy.mail.ackedGives === 3 && lossy.mail.pendingGives() === 1 && lossy.mail.pending.has(1));
    const gap = (lossy.mail.gives - lossy.mail.ackedGives === lossy.mail.pendingGives());
    const ok =
      check(cleanOk, `seed ${seed}: 무손실 drain 어긋남(gives ${clean.mail.gives}·acked ${clean.mail.ackedGives}·pending ${clean.mail.pendingGives()})`) &&
      check(lossyOk, `seed ${seed}: 손실 잔존 어긋남(acked ${lossy.mail.ackedGives}·pending ${lossy.mail.pendingGives()})`) &&
      check(gap, `seed ${seed}: gives-acked != pending(격차 불일치)`);
    console.log(`${pad(seed, 6)} | ${pad(clean.mail.gives + '/' + clean.mail.ackedGives + '/' + clean.mail.pendingGives(), 26)} | ${pad(lossy.mail.gives + '/' + lossy.mail.ackedGives + '/' + lossy.mail.pendingGives(), 27)} | ${pad(gap ? '예' : '아니오', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 무손실: 보낸 give 4 모두 회신 도착 → pending 0 drain(닫힌 고리 liveness). 회신 손실(ackDrop=[1]): gid1(둘째 발신 인출)의 item_result 가 손실 → 그 gid 가 pending 에 *남는다*(ackedGives 3<gives 4·gives−acked==pending). 우편이 "어느 give 가 응답을 못 받았나"를 안다 — 재전송의 토대.');
  console.log('    재전송(idempotent dedup·가방 sagaDedup 재사용 0168)·정합 capstone(sagaConsistent 0169)·transfers capstone(0170) 후속.');
}

kit.MODES['exmlpend'] = exmlpend;
kit.ORDER.splice(1, 0, 'exmlpend');

(async () => { process.exit(await kit.cli(process.argv)); })();
