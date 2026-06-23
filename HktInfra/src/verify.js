// HktInfra step-0159 — 헤드리스 검증 (아이템 우편 만료 회수·itemExpired — 만료 우편의 아이템 회수)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlitx`.
//   더한 한 조각: mailSweep 만료 시 아이템 실은 통수만큼 itemExpired++(itemHeld→itemExpired 전이). 미수령 아이템 우편의 TTL 회수 회계.
//   검증: ⒜ `reg`(키트) — mailItem OFF = 0158 비트 동일. ⒝ `exmlitx`(가설) — 만료 후 itemExpired 증가·itemSent==itemHeld+itemFetched+itemExpired·crash 복구 정합.
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
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailItem: true, mailTtl: 10, mailOps: ops, ...extra });

function exmlitx(seeds) {
  console.log('== exmlitx: 아이템 우편 만료 회수(itemExpired·만료 우편의 아이템 회수). 미수령 아이템 우편 TTL 만료 시 itemHeld→itemExpired 전이. itemSent==itemHeld+itemFetched+itemExpired. ==');
  console.log('seed   | itemSent | held/fetch/exp | itemSent==분할합 | crash 복구 | 판정');
  for (const seed of seeds) {
    // h1 1아이템 수령·h2 1아이템 미수령 만료·h3 1아이템 생존(sweep 직후 입금). itemSent 3·itemFetched 1·itemExpired 1·itemHeld 1.
    const ops = [SEND(5, 'a', 'x', 'h1', '1', 'sword'), SEND(6, 'b', 'y', 'h2', '2', 'shield'), FETCH(15, 'h1'), SWEEP(30), SEND(32, 'c', 'z', 'h3', '3', 'potion')];
    const r = run(base(seed, ops));
    const mail = r.mail;
    const inv = mail.itemSent === mail.itemHeld() + mail.itemFetched + mail.itemExpired;
    const shape = mail.itemSent === 3 && mail.itemHeld() === 1 && mail.itemFetched === 1 && mail.itemExpired === 1;
    const preDig = mail.digest(); mail.crash(); mail.reconstruct();
    const crashOk = (mail.digest() === preDig && mail.itemExpired === 1 && mail.itemHeld() === 1 && mail.itemFetched === 1);
    const ok =
      check(shape, `seed ${seed}: 아이템 분할 어긋남(s${mail.itemSent}·h${mail.itemHeld()}·f${mail.itemFetched}·e${mail.itemExpired})`) &&
      check(inv, `seed ${seed}: itemSent≠itemHeld+itemFetched+itemExpired`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 아이템 만료 회계 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mail.itemSent, 8)} | ${pad(mail.itemHeld() + '/' + mail.itemFetched + '/' + mail.itemExpired, 14)} | ${pad(inv ? '예' : '아니오', 16)} | ${pad(crashOk ? '예' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 만료 시 아이템도 회수(itemHeld→itemExpired): mailSweep 가 만료 우편의 아이템을 itemExpired 로 집계. itemSent==itemHeld+itemFetched+itemExpired(아이템 1개는 매 순간 보유/수령/만료 중 정확히 한 상태). crash→reconstruct 정합. 아이템 회계 capstone(0160)·발신자 반환(가방 연동) 후속. mailItem OFF=0158 비트 동일(reg).');
}

kit.MODES['exmlitx'] = exmlitx;
kit.ORDER.splice(1, 0, 'exmlitx');

(async () => { process.exit(await kit.cli(process.argv)); })();
