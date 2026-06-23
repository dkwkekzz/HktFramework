// HktInfra step-0158 — 헤드리스 검증 (아이템 우편 수령·itemFetched — 보유→수령 아이템 이동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlitf`.
//   더한 한 조각: mailFetch 가 보유→수령 이동 시 아이템 실은 통수만큼 itemFetched++(아이템도 read 로 이동). 회계 itemHeld→itemFetched 전이.
//   검증: ⒜ `reg`(키트) — mailItem OFF = 0157 비트 동일. ⒝ `exmlitf`(가설) — 수령 후 itemHeld→0·itemFetched 증가·itemSent==itemHeld+itemFetched(+itemExpired 0).
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
const base = (seed, ops, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailPersist: true, mailItem: true, mailOps: ops, ...extra });

function exmlitf(seeds) {
  console.log('== exmlitf: 아이템 우편 수령(itemFetched·보유→수령 아이템 이동). 수령 시 아이템도 read 로 이동·itemHeld→itemFetched 전이. itemSent==itemHeld+itemFetched. ==');
  console.log('seed   | itemSent | itemHeld | itemFetched | itemSent==held+fetched | crash 복구 | 판정');
  for (const seed of seeds) {
    // h1 에 3통(2 아이템·1 메시지)·h2 에 1 아이템. h1 만 수령 → h1 아이템 2 수령·h2 아이템 1 보유. itemSent 3·itemHeld 1·itemFetched 2.
    const ops = [SEND(5, 'a', 'x', 'h1', '1', 'sword'), SEND(6, 'b', 'x', 'h1', '2', 'shield'), SEND(7, 'c', 'x', 'h1', '3'), SEND(8, 'd', 'y', 'h2', '4', 'potion'), FETCH(20, 'h1')];
    const r = run(base(seed, ops));
    const mail = r.mail;
    const inv = mail.itemSent === mail.itemHeld() + mail.itemFetched + mail.itemExpired;
    const shape = mail.itemSent === 3 && mail.itemHeld() === 1 && mail.itemFetched === 2;
    const preDig = mail.digest(); mail.crash(); mail.reconstruct();
    const crashOk = (mail.digest() === preDig && mail.itemFetched === 2 && mail.itemHeld() === 1);
    const ok =
      check(shape, `seed ${seed}: 아이템 분할 어긋남(itemSent ${mail.itemSent}·itemHeld ${mail.itemHeld()}·itemFetched ${mail.itemFetched})`) &&
      check(inv, `seed ${seed}: itemSent≠itemHeld+itemFetched+itemExpired`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 아이템 수령 회계 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mail.itemSent, 8)} | ${pad(mail.itemHeld(), 8)} | ${pad(mail.itemFetched, 11)} | ${pad(inv ? '예' : '아니오', 22)} | ${pad(crashOk ? '예' : '아니오', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 수령 시 아이템도 보유→수령 이동(itemHeld→itemFetched): mailFetch 가 read 로 아이템을 옮기고 itemFetched++. itemSent==itemHeld+itemFetched+itemExpired(아이템 1개는 매 순간 보유/수령/만료 중 한 상태). crash→reconstruct 정합. 만료 회수(0159)·아이템 회계 capstone(0160) 후속. mailItem OFF=0157 비트 동일(reg).');
}

kit.MODES['exmlitf'] = exmlitf;
kit.ORDER.splice(1, 0, 'exmlitf');

(async () => { process.exit(await kit.cli(process.argv)); })();
