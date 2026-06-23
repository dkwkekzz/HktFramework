// HktInfra step-0170 — 헤드리스 검증 (아이템 우편 saga liveness capstone·mailLiveConsistent — 아이템 우편↔가방 arc 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmllive`.
//   더한 한 조각: mailLiveConsistent() = mailGiveConsistent(0167) ∧ itemConsistent(0160). 4체제(정상·보상·혼합·crash 복구)서 그것 + 2-서비스 보존(mailCustodyItems≡가방 mailcustody) + 교차 정합(ackedOk==mailXfers) 동시 성립. 거래소 0140 의 우편 판.
//   검증: ⒜ `reg`(키트) — 미호출 = 0169 비트 동일. ⒝ `exmllive`(가설) — 4체제 전부 mailLiveConsistent·보존·교차 합치·crash 복구 보존.
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
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailCompensate: true, sagaDedup: true, mailPersist: true, mailTtl: 10, mailOps, invOps, ...extra });

const REGIMES = (seed) => ({
  normal: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'item1'), FETCH(20, 'h1')], [PICK(3, 'x'), PICK(4, 'x')]),
  comp: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'itemX')], [PICK(3, 'x')]),
  mixed: base(seed, [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30), SEND(33, 'c', 'x', 'h3', '3', 'item2')], [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')]),
});

function exmllive(seeds) {
  console.log('== exmllive: *capstone* — 아이템 우편 saga liveness(mailLiveConsistent = give 회계 ∧ 아이템 회계). 4체제서 그것 + 2-서비스 보존(우편≡가방 custody) + 교차 정합(ackedOk==mailXfers) + crash 복구 동시 성립. 아이템 우편↔가방 arc 닫기(거래소 0140 의 우편 판). ==');
  console.log('seed   | 4체제 live | 보존(우편≡가방) | 교차(ackedOk==mailXfers) | crash 복구 보존 | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run({ ...R[k] });
    const live = Object.values(runs).every(r => r.mail.mailLiveConsistent());
    const preserve = Object.values(runs).every(r => {
      const ci = r.mail.mailCustodyItems(); const iv = [...(r.inventory.byOwner.get('mailcustody') || [])].sort();
      return ci.length === iv.length && ci.every((x, i) => x === iv[i]);
    });
    const cross = Object.values(runs).every(r => r.mail.ackedOk === r.inventory.mailXfers);
    // crash 복구: mixed 의 우편 박스를 crash→reconstruct 후에도 아이템 회계·custody 보존(가방은 별 박스라 무변경).
    const rm = runs.mixed; const preItems = rm.mail.mailCustodyItems().join(','); rm.mail.crash(); rm.mail.reconstruct();
    const crashOk = rm.mail.itemConsistent() && rm.mail.mailCustodyItems().join(',') === preItems &&
      rm.mail.mailCustodyItems().join(',') === [...(rm.inventory.byOwner.get('mailcustody') || [])].sort().join(',');
    const ok =
      check(live, `seed ${seed}: 어느 체제서 mailLiveConsistent false`) &&
      check(preserve, `seed ${seed}: 2-서비스 보존 깨짐`) &&
      check(cross, `seed ${seed}: 교차 정합 깨짐`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 아이템 회계/보존 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(live ? '예(3/3)' : '아니오', 10)} | ${pad(preserve ? '예' : '아니오', 15)} | ${pad(cross ? '예' : '아니오', 24)} | ${pad(crashOk ? '예' : '아니오', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 아이템 우편↔가방 arc 가 *닫힌다*: give 회계(gives==ackedOk+ackedFail+pending)·아이템 회계(itemSent==held+fetched+expired)·2-서비스 보존(보유 우편≡가방 mailcustody)·교차 정합(ackedOk==mailXfers)이 4체제(정상·보상·혼합·crash 복구)서 *동시* 성립(거래소 0140 의 우편 판). 세 leg(인출·입금·반환)·saga 회신·보상·멱등 재전송이 모두 보존을 지킨다. 아이템 우편 arc(0161~0170) 완성 — 리뷰 #40 닫힘. 미호출=0169 비트 동일(reg).');
}

kit.MODES['exmllive'] = exmllive;
kit.ORDER.splice(1, 0, 'exmllive');

(async () => { process.exit(await kit.cli(process.argv)); })();
