// HktInfra step-0176 — 헤드리스 검증 (아이템 우편 saga 포기 give 재admission·mailReadmit)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailreadmit`.
//   더한 한 조각: 포기(abandonedGive·0173/0174) 된 give 를 mailReadmit op 이 pendingGive 로 되돌려 retry 재개(retryCount 리셋·상한 재충전·거래소 0134 의 우편 판). mailReadmit op 부재면 0175 비트 동일.
//   검증: ⒜ `reg`(키트) — readmit op 부재·포기 미발생 = 0175 비트 동일. ⒝ `mailreadmit`(가설) — 포기 후 ON 은 재admission(readmitted 1·abandonedGive 비움·재무장)·OFF 는 abandonedGive 잔존. 양 체제 sagaConsistent.
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
// 지속 손실(gid1)+상한2 → sweep30/40 재전송·sweep50 포기. rm: mailReadmit op(55) 유무. sweep60 재전송. ttl 0.
const base = (seed, rm) => ({
  seed, ticks: 70, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0,
  mailAckDropAlways: [1], mailAutoRetry: true, mailMaxRetries: 2,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SWEEP(30), SWEEP(40), SWEEP(50)].concat(rm ? [READMIT(55), SWEEP(60)] : [SWEEP(60)]),
});

function mailreadmit(seeds) {
  console.log('== mailreadmit: 아이템 우편 saga *포기 give 재admission*(mailReadmit). 상한 도달로 포기(abandonedGive)된 give 를 운영이 pendingGive 로 되돌려 retry 재개(거래소 0134 의 우편 판). ON 재무장 vs OFF 잔존. ==');
  console.log('seed   | ON readmitted/abandonedGive | OFF readmitted/abandonedGive | 재무장 | sagaConsistent 양체제 | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const consistent = on.mail.sagaConsistent() && off.mail.sagaConsistent();
    const rearmed = on.mail.readmitted === 1 && on.mail.abandonedGive.size === 0 && on.mail.giveAbandoned === 1;   // 재admission → abandonedGive 비움·pendingGive 로 복귀
    const stuck = off.mail.readmitted === 0 && off.mail.abandonedGive.size === 1;   // readmit 없으면 포기 give 잔존
    const ok =
      check(consistent, `seed ${seed}: 어느 체제서 sagaConsistent false`) &&
      check(rearmed, `seed ${seed}: ON 재admission 실패(readmitted ${on.mail.readmitted}/abandonedGive ${on.mail.abandonedGive.size})`) &&
      check(stuck, `seed ${seed}: OFF 포기 give 잔존 안 함(readmitted ${off.mail.readmitted}/abandonedGive ${off.mail.abandonedGive.size})`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.readmitted + '/' + on.mail.abandonedGive.size, 27)} | ${pad(off.mail.readmitted + '/' + off.mail.abandonedGive.size, 28)} | ${pad(rearmed ? '예' : '아니오', 6)} | ${pad(consistent ? '예' : '아니오', 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재시도 상한 도달로 *포기*(abandonedGive)된 give 는 영구가 아니다 — 손실이 해소되면 운영이 mailReadmit 으로 pendingGive 로 되돌려 retry 를 재개(retryCount 리셋·상한 재충전). 이후 sweep/mailRetry 가 재전송하고, 손실이 진짜 풀렸으면 ack→drain. readmit ON 은 abandonedGive 를 비우고 재무장·OFF 는 잔존. 0048 busLeaseLife 재admission·거래소 0134 의 우편 판. (무한 abandon↔readmit 차단=readmitMax 후속.)');
}

kit.MODES['mailreadmit'] = mailreadmit;
kit.ORDER.splice(1, 0, 'mailreadmit');

(async () => { process.exit(await kit.cli(process.argv)); })();
