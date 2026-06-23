// HktInfra step-0155 — 헤드리스 검증 (MailFeed 회계 정합 capstone·feedConsistent — unread==sent−read−expired)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlfcons`.
//   더한 한 조각: MailFeed.feedConsistent() — 모든 수신자에 unread == sent − read − expired·unread≥0(0150 mailConsistent 의 읽기 모델 판·capstone). 0151~0154 의 모든 배지 전이가 이 분할을 보존.
//   검증: ⒜ `reg`(키트) — feedConsistent 미호출 = 0154 비트 동일. ⒝ `exmlfcons`(가설) — 4체제(수령만·만료만·혼합·crash 복구) 전부 feedConsistent true + feed==우편 권위.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body) => ({ at, op: { type: 'mailSend', id, from, to, body } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailSentPublish: true, mailReadPublish: true, mailExpirePublish: true, mailFeed: true, mailFeedRead: true, mailFeedExpire: true, mailOps: ops, ...extra });

// 4 체제 — 배지 분할이 서로 다르되 unread==sent−read−expired 불변.
const REGIMES = (seed) => ({
  fetchOnly: base(seed, [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), FETCH(20, 'h1')], { mailTtl: 0 }),   // unread 0·read 3
  expireOnly: base(seed, [SEND(5, 'a', 'x', 'h2', '1'), SEND(6, 'b', 'x', 'h2', '2'), SEND(7, 'c', 'x', 'h3', '3'), SWEEP(30)], { mailTtl: 10 }),       // unread 0·expired 3
  mixed: base(seed, [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(8, 'c', 'x', 'h4', '3'), FETCH(20, 'h1'), SEND(28, 'd', 'x', 'h5', '4'), SWEEP(30)], { mailTtl: 10 }),   // 혼합: read 2·expired 1·unread 1
});

function exmlfcons(seeds) {
  console.log('== exmlfcons: *capstone* — MailFeed 회계 정합(feedConsistent·unread==sent−read−expired). 배지의 미읽음은 입금에서 읽음·만료를 뺀 것(공백·중복 0). 4체제(수령만·만료만·혼합·crash 복구) 전부 성립·feed==우편 권위. ==');
  console.log('seed   | fetchOnly | expireOnly | mixed | crash복구 정합 | 4체제 feedConsistent | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const snap = (r) => { const f = r.mailfeed; return f.totalUnread() + 'u'; };
    const live = Object.values(runs).every(r => r.mailfeed.feedConsistent());
    // feed==우편 권위(모든 체제): totalUnread == mail.totalHeld.
    const eqAuth = Object.values(runs).every(r => r.mailfeed.totalUnread() === r.mail.totalHeld());
    // crash 복구 체제: mixed 의 feed 를 crash→reconstruct 후에도 feedConsistent + digest 동일.
    const f = runs.mixed.mailfeed; const preDig = f.digest(); f.crash(); f.reconstruct(runs.mixed.mail.journal);
    const crashOk = (f.feedConsistent() && f.digest() === preDig);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 feedConsistent false`) &&
      check(eqAuth, `seed ${seed}: feed totalUnread≠우편 totalHeld`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 정합/digest 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.fetchOnly), 9)} | ${pad(snap(runs.expireOnly), 10)} | ${pad(snap(runs.mixed), 5)} | ${pad(crashOk ? '예' : '아니오', 13)} | ${pad(live ? '예(4/4)' : '아니오', 20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → MailFeed 배지 회계가 *대수적으로 닫힌다*: 모든 수신자에 unread == sent − read − expired·unread≥0(공백·중복 0) — 0151~0154 가 더한 모든 전이(입금·읽음·만료·replay)가 이 분할을 보존. crash→reconstruct 후에도 불변. 0150 mailConsistent(우편 권위 판)의 읽기 모델 판. 배지 질의(0156) 후속. feedConsistent 미호출=0154 비트 동일(reg).');
}

kit.MODES['exmlfcons'] = exmlfcons;
kit.ORDER.splice(1, 0, 'exmlfcons');

(async () => { process.exit(await kit.cli(process.argv)); })();
