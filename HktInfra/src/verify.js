// HktInfra step-0160 — 헤드리스 검증 (아이템 우편 회계 정합 capstone·itemConsistent — itemSent==itemHeld+itemFetched+itemExpired)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlitc`.
//   더한 한 조각: MailService.itemConsistent() — 아이템 1개는 매 순간 정확히 한 상태(보유·수령·만료)에 분할(itemSent==셋의 합). 0150 mailConsistent 의 아이템 판·아이템 우편 arc(0157~0160) 닫기.
//   검증: ⒜ `reg`(키트) — itemConsistent 미호출 = 0159 비트 동일. ⒝ `exmlitc`(가설) — 4체제(수령만·만료만·혼합·crash 복구)서 itemConsistent 전부 true + 분할 카운트 일치.
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
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailItem: true, mailOps: ops, ...extra });

// 4 체제 — 아이템 분할이 서로 다르되 itemSent==itemHeld+itemFetched+itemExpired 불변.
const REGIMES = (seed) => ({
  fetchOnly: base(seed, [SEND(5, 'a', 'x', 'h1', '1', 'i1'), SEND(6, 'b', 'x', 'h1', '2', 'i2'), FETCH(20, 'h1')], { mailTtl: 0 }),   // h0/f2/e0
  expireOnly: base(seed, [SEND(5, 'a', 'x', 'h2', '1', 'i3'), SEND(6, 'b', 'x', 'h2', '2', 'i4'), SWEEP(30)], { mailTtl: 10 }),       // h0/f0/e2
  mixed: base(seed, [SEND(5, 'a', 'x', 'h1', '1', 'i5'), SEND(8, 'c', 'x', 'h4', '3', 'i6'), FETCH(20, 'h1'), SEND(28, 'd', 'x', 'h5', '4', 'i7'), SWEEP(30)], { mailTtl: 10 }),   // f1/e1/h1
});

function exmlitc(seeds) {
  console.log('== exmlitc: *capstone* — 아이템 우편 회계 정합(itemConsistent·itemSent==itemHeld+itemFetched+itemExpired). 아이템 1개는 매 순간 정확히 한 상태(보유·수령·만료)에 분할(공백·중복 0). 4체제 전부 성립. ==');
  console.log('seed   | fetchOnly(h/f/e) | expireOnly | mixed | crash복구 정합 | 4체제 itemConsistent | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const snap = (r) => { const m = r.mail; return m.itemHeld() + '/' + m.itemFetched + '/' + m.itemExpired; };
    const live = Object.values(runs).every(r => r.mail.itemConsistent());
    const shapes =
      (runs.fetchOnly.mail.itemHeld() === 0 && runs.fetchOnly.mail.itemFetched === 2 && runs.fetchOnly.mail.itemExpired === 0) &&
      (runs.expireOnly.mail.itemHeld() === 0 && runs.expireOnly.mail.itemFetched === 0 && runs.expireOnly.mail.itemExpired === 2) &&
      (runs.mixed.mail.itemHeld() === 1 && runs.mixed.mail.itemFetched === 1 && runs.mixed.mail.itemExpired === 1);
    const m = runs.mixed.mail; const preDig = m.digest(); m.crash(); m.reconstruct();
    const crashOk = (m.itemConsistent() && m.digest() === preDig);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 itemConsistent false`) &&
      check(shapes, `seed ${seed}: 체제별 아이템 분할 기대 어긋남(fetchOnly ${snap(runs.fetchOnly)}·expireOnly ${snap(runs.expireOnly)}·mixed ${snap(runs.mixed)})`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 정합/digest 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.fetchOnly), 16)} | ${pad(snap(runs.expireOnly), 10)} | ${pad(snap(runs.mixed), 5)} | ${pad(crashOk ? '예' : '아니오', 13)} | ${pad(live ? '예(4/4)' : '아니오', 20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 아이템 회계가 *대수적으로 닫힌다*: 아이템 1개는 매 순간 정확히 한 상태(보유 itemHeld·수령 itemFetched·만료 itemExpired)에 있고 itemSent == 셋의 합(공백·중복 0) — 0157~0159 가 더한 모든 전이(첨부·수령·만료·replay)가 이 분할을 보존. crash→reconstruct 후에도 불변. 형식 h/f/e: 수령만 0/2/0·만료만 0/0/2·혼합 1/1/1. 0150 mailConsistent 의 아이템 판.');
  console.log('    아이템 우편 arc(0157~0160) 닫힘 — 우편 박스가 메시지(0142~0150)·미읽음 배지(0151~0156)·아이템(0157~0160) 세 축으로 섰다. 가방 연동 give/반환(2-서비스 보존)이 다음 자연 확장(백로그).');
}

kit.MODES['exmlitc'] = exmlitc;
kit.ORDER.splice(1, 0, 'exmlitc');

(async () => { process.exit(await kit.cli(process.argv)); })();
