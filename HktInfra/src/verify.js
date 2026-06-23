// HktInfra step-0170 — 헤드리스 검증 (아이템 우편 give↔가방 transfers capstone·sagaLiveConsistent + giveOks==escrowXfers)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmllive`.
//   더한 한 조각: sagaLiveConsistent() = mailConsistent AND itemConsistent AND escrowConsistent AND sagaConsistent(우편 박스 내부 네 회계층 동시 닫힘) + verify 가 우편 giveOks==가방 escrowXfers(두 서비스 합치·거래소 0130/0140 의 우편 판).
//   검증: ⒜ `reg`(키트) — 미호출 accessor = 0169 비트 동일. ⒝ `exmllive`(가설) — 정상·손실+재전송 양 체제서 sagaLiveConsistent true + 두 서비스 회계 합치.
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
// 3 상태(수령·만료반환·보유) + saga. 정상·회신손실+재전송 양 체제.
const base = (seed, drop, retry) => ({
  seed, ticks: 50, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 10, mailAckDrop: drop,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SEND(28, 'c', 'x', 'h4', '3', 'item2'), FETCH(15, 'h1'), SWEEP(30)].concat(retry ? [RETRY(40)] : []),
});

function exmllive(seeds) {
  console.log('== exmllive: *capstone* — 아이템 우편 give↔가방 transfers(sagaLiveConsistent + giveOks==escrowXfers). 우편 박스 내부 네 회계층(메시지·아이템·escrow·saga) 동시 닫힘 + 우편·가방 *두 서비스* 회계 합치. 거래소 0130/0140 의 우편 판·아이템 우편↔가방 arc(0161~0170) 닫기. ==');
  console.log('seed   | normal giveOks/xfers | loss+retry giveOks/xfers | 두 서비스 합치 | sagaLiveConsistent | 판정');
  for (const seed of seeds) {
    const norm = run(base(seed, null, false));
    const lr = run(base(seed, [1], true));
    const live = norm.mail.sagaLiveConsistent() && lr.mail.sagaLiveConsistent();
    const match = (norm.mail.giveOks === norm.inventory.escrowXfers && lr.mail.giveOks === lr.inventory.escrowXfers);
    const shapes = (norm.mail.giveOks === 5 && norm.inventory.escrowXfers === 5 && lr.mail.giveOks === 5 && lr.inventory.escrowXfers === 5 && lr.mail.retries === 1);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 sagaLiveConsistent false`) &&
      check(match, `seed ${seed}: 두 서비스 회계 불합치(norm ${norm.mail.giveOks}/${norm.inventory.escrowXfers}·lr ${lr.mail.giveOks}/${lr.inventory.escrowXfers})`) &&
      check(shapes, `seed ${seed}: 기대 수치 어긋남`);
    console.log(`${pad(seed, 6)} | ${pad(norm.mail.giveOks + '/' + norm.inventory.escrowXfers, 20)} | ${pad(lr.mail.giveOks + '/' + lr.inventory.escrowXfers, 24)} | ${pad(match ? '예' : '아니오', 14)} | ${pad(live ? '예(2/2)' : '아니오', 18)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편 박스 *내부* 네 회계층이 동시에 닫힌다: 메시지(mailConsistent)·아이템(itemConsistent)·escrow 집합(escrowConsistent)·saga(sagaConsistent). 그리고 우편이 성공시킨 give(giveOks)는 가방이 기록한 escrow transfer(escrowXfers)와 정확히 일치 — 두 *독립* 서비스의 회계가 합치(은닉 경계 너머 무손실). 회신손실+재전송 체제서도 재실행 0 덕에 합치 보존(giveOks==escrowXfers==5).');
  console.log('    아이템 우편↔가방 saga arc(0161~0170) 닫힘 — 거래소↔가방(0117~0140)의 우편 판 완성. 우편 박스가 메시지·배지·아이템·가방 연동(3레그+saga) 네 축으로 섰다. 주기 재전송(autoRetry)·발행 게이트 통합·길드 후속.');
}

kit.MODES['exmllive'] = exmllive;
kit.ORDER.splice(1, 0, 'exmllive');

(async () => { process.exit(await kit.cli(process.argv)); })();
