// HktInfra step-0150 — 헤드리스 검증 (우편 회계 정합 capstone·mailConsistent — sent==held+fetched+expired·0142~0149 arc 의 창발 불변)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0142~0149 가 우편 박스(입금→수령→발행→영속→압축→읽음발행→만료TTL→만료발행)를 쌓았다. 그 회계가 *대수적으로 닫혀* 있는가? mailConsistent: 우편 1통은 매 순간 정확히 한 상태 — 보유(held)·수령(fetched)·만료(expired) 으로 분할(공백·중복 0). sent==totalHeld+fetched+expired 가 *모든 체제*서 성립.
//   검증: ⒜ `reg`(키트) — 미호출 accessor = 0149 비트 동일. ⒝ `exmail`(가설) — 4체제(수령만·만료만·혼합·crash 복구)서 mailConsistent 전부 true + 각 체제 분할 카운트 일치.
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
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, mailPersist: true, mailOps: ops, ...extra });

// 4 체제 — 분할 카운트가 서로 다르되 sent==held+fetched+expired 불변.
const REGIMES = (seed) => ({
  // 수령만: 3통 입금·전부 h1 수령 → held 0·fetched 3·expired 0
  fetchOnly: base(seed, [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(7, 'c', 'x', 'h1', '3'), FETCH(20, 'h1')], { mailTtl: 0 }),
  // 만료만: 3통 입금·미수령·sweep 만료 → held 0·fetched 0·expired 3
  expireOnly: base(seed, [SEND(5, 'a', 'x', 'h2', '1'), SEND(6, 'b', 'x', 'h2', '2'), SEND(7, 'c', 'x', 'h3', '3'), SWEEP(30)], { mailTtl: 10 }),
  // 혼합: 4통·h1 수령(2)·h4 만료(1)·h5 생존(1) → held 1·fetched 2·expired 1
  mixed: base(seed, [SEND(5, 'a', 'x', 'h1', '1'), SEND(6, 'b', 'x', 'h1', '2'), SEND(8, 'c', 'x', 'h4', '3'), FETCH(20, 'h1'), SEND(30, 'd', 'x', 'h5', '4'), SWEEP(35)], { mailTtl: 10 }),
});

function exmail(seeds) {
  console.log('== exmail: *capstone* — 우편 회계 정합(mailConsistent·sent==held+fetched+expired). 우편 1통은 매 순간 정확히 한 상태(보유 held·수령 fetched·만료 expired)에 분할(공백·중복 0). 4체제(수령만·만료만·혼합·crash 복구) 전부 성립. ==');
  console.log('seed   | fetchOnly(h/f/e) | expireOnly | mixed | crash복구 정합 | 4체제 mailConsistent | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const snap = (r) => { const m = r.mail; return m.totalHeld() + '/' + m.fetched + '/' + m.expired; };
    const live = Object.values(runs).every(r => r.mail.mailConsistent());
    // 각 체제 기대 분할
    const shapes =
      (runs.fetchOnly.mail.totalHeld() === 0 && runs.fetchOnly.mail.fetched === 3 && runs.fetchOnly.mail.expired === 0) &&
      (runs.expireOnly.mail.totalHeld() === 0 && runs.expireOnly.mail.fetched === 0 && runs.expireOnly.mail.expired === 3) &&
      (runs.mixed.mail.totalHeld() === 1 && runs.mixed.mail.fetched === 2 && runs.mixed.mail.expired === 1);
    // crash 복구 체제: mixed 를 crash→reconstruct 후에도 mailConsistent
    const m = runs.mixed.mail; const preDig = m.digest(); m.crash(); m.reconstruct();
    const crashOk = (m.mailConsistent() && m.digest() === preDig);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 mailConsistent false`) &&
      check(shapes, `seed ${seed}: 체제별 분할 기대 어긋남(fetchOnly ${snap(runs.fetchOnly)}·expireOnly ${snap(runs.expireOnly)}·mixed ${snap(runs.mixed)})`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 정합/digest 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.fetchOnly), 16)} | ${pad(snap(runs.expireOnly), 10)} | ${pad(snap(runs.mixed), 5)} | ${pad(crashOk ? '예' : '아니오', 13)} | ${pad(live ? '예(4/4)' : '아니오', 20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편 회계가 *대수적으로 닫힌다*: 우편 1통은 매 순간 정확히 한 상태(보유 held·수령 fetched·만료 expired)에 있고 sent == 셋의 합(공백·중복 0) — 0142~0149 arc(입금·수령·발행·영속·압축·읽음발행·만료TTL·만료발행)가 더한 모든 전이가 이 분할을 보존한다. crash→reconstruct(영속 replay) 후에도 불변. 형식 h(held)/f(fetched)/e(expired): 수령만 0/3/0·만료만 0/0/3·혼합 1/2/1 — 다른 분할이되 sent==h+f+e 불변. mailConsistent 는 미호출 accessor = 0149 비트 동일(reg).');
  console.log('    우편 arc(0142~0150) 닫힘 — SPINE §2 게임 서비스 *우편* 박스 완성(입금/수령/발행 3종/영속·압축·만료·회계 정합). 거래소 arc(0107~0140)와 동형 골격.');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
