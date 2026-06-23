// HktInfra step-0167 — 헤드리스 검증 (아이템 우편 give 회계 정합·mailGiveConsistent — gives==ackedOk+ackedFail+pending)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlgc`.
//   더한 한 조각: mailGiveConsistent() — 발신한 custody give 는 매 순간 정확히 한 상태(ackedOk·ackedFail·pending)에 분할. gives==셋의 합(거래소 0128 sagaConsistent 의 우편 판).
//   검증: ⒜ `reg`(키트) — 미호출 = 0166 비트 동일. ⒝ `exmlgc`(가설) — 3체제(정상·보상·혼합)서 mailGiveConsistent 전부 true·무손실 pending 0.
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
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailCompensate: true, mailPersist: true, mailOps, invOps, ...extra });

const REGIMES = (seed) => ({
  // 정상: 2 소유 발신+수령 = 4 give 전부 ok.
  normal: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'item1'), FETCH(20, 'h1')], [PICK(3, 'x'), PICK(4, 'x')]),
  // 보상: 1 소유(ok)+1 미소유(fail→보상). gives 2·ackedOk 1·ackedFail 1.
  comp: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'itemX')], [PICK(3, 'x')]),
  // 혼합: 2 소유 발신(2 give)·h2 미수령(custody 잔류·수령 give 0).
  mixed: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1')], [PICK(3, 'x'), PICK(4, 'x')]),
});

function exmlgc(seeds) {
  console.log('== exmlgc: *capstone* — 아이템 우편 give 회계 정합(mailGiveConsistent·gives==ackedOk+ackedFail+pending). custody give 는 매 순간 정확히 한 상태(회신성공·회신실패·미해결)에 분할(거래소 0128 의 우편 판). ==');
  console.log('seed   | normal(g/ok/f/p) | comp | mixed | 3체제 mailGiveConsistent | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const snap = (r) => { const m = r.mail; return m.gives + '/' + m.ackedOk + '/' + m.ackedFail + '/' + m.pending.size; };
    const live = Object.values(runs).every(r => r.mail.mailGiveConsistent());
    const drained = Object.values(runs).every(r => r.mail.pending.size === 0);   // 무손실(인프로세스 FIFO)서 전부 drain
    const shapes = (runs.comp.mail.ackedOk === 1 && runs.comp.mail.ackedFail === 1 && runs.comp.mail.compensated === 1);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 mailGiveConsistent false`) &&
      check(drained, `seed ${seed}: pending 미drain`) &&
      check(shapes, `seed ${seed}: 보상 체제 분할 어긋남(${snap(runs.comp)})`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.normal), 16)} | ${pad(snap(runs.comp), 8)} | ${pad(snap(runs.mixed), 9)} | ${pad(live ? '예(3/3)' : '아니오', 24)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → give 회계가 *대수적으로 닫힌다*: 발신한 custody give 는 매 순간 정확히 한 상태(회신성공 ackedOk·회신실패 ackedFail·미해결 pending)에 있고 gives==셋의 합(공백·중복 0·거래소 0128 의 우편 판). 무손실(인프로세스 FIFO)서 pending 0 drain·실패는 보상으로 phantom 0. 재전송 멱등(0168)·교차 정합(0169)·liveness capstone(0170) 후속. 미호출=0166 비트 동일(reg).');
}

kit.MODES['exmlgc'] = exmlgc;
kit.ORDER.splice(1, 0, 'exmlgc');

(async () => { process.exit(await kit.cli(process.argv)); })();
