// HktInfra step-0164 — 헤드리스 검증 (아이템 우편↔가방 2-서비스 보존 capstone·escrowItemIds·escrowConsistent)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlin4`.
//   더한 한 조각: 우편이 escrow 중인 itemId 집합(escrowIds)을 추적 → ⒜ escrowConsistent(우편 내부: itemHeld==escrowIds.size) ⒝ escrowItemIds()==가방 'escrow' 소유 집합(두 서비스 교차 정합). 거래소 0120 escrowItemIds 의 우편 판.
//   검증: ⒜ `reg`(키트) — 미호출 accessor·invMode 영향 0 = 0163 비트 동일. ⒝ `exmlin4`(가설) — 수령/만료/보유 3상태 + 가방-우편 escrow 집합 일치 + crash 복구 정합.
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
// 3 상태 동시 — item0 수령(→h1)·item1 만료반환(→x)·item2 보유(escrow). 가방·우편 escrow 집합 == {item2}.
const base = (seed) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailTtl: 10,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SEND(28, 'c', 'x', 'h4', '3', 'item2'), FETCH(15, 'h1'), SWEEP(30)],
});
const escOf = (inv) => [...(inv.byOwner.get('escrow') || [])].sort();
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function exmlin4(seeds) {
  console.log('== exmlin4: *capstone* — 아이템 우편↔가방 2-서비스 보존(escrowItemIds·escrowConsistent). 우편이 escrow 라 믿는 itemId 집합 == 가방의 실제 escrow 소유 집합(두 서비스 일치)·우편 내부 itemHeld==escrowIds.size. 거래소 0120(open==escrow) 의 우편 판. ==');
  console.log('seed   | 우편 escrowIds | 가방 escrow | 집합 일치 | escrowConsistent | minted/분포(h1/x/esc) | crash복구 | 판정');
  for (const seed of seeds) {
    const r = run(base(seed));
    const me = r.mail.escrowItemIds(); const ie = escOf(r.inventory);
    const setMatch = eq(me, ie);
    const cons = r.mail.escrowConsistent();
    const dist = r.inventory.ownerOf('item0') + '/' + r.inventory.ownerOf('item1') + '/' + r.inventory.ownerOf('item2');
    const distOk = (r.inventory.ownerOf('item0') === 'h1' && r.inventory.ownerOf('item1') === 'x' && r.inventory.ownerOf('item2') === 'escrow' && r.inventory.minted === 3);
    const pre = r.mail.digest(); r.mail.crash(); r.mail.reconstruct();
    const crashOk = (r.mail.escrowConsistent() && eq(r.mail.escrowItemIds(), me) && r.mail.digest() === pre);
    const ok =
      check(setMatch, `seed ${seed}: 우편 escrowIds(${me}) != 가방 escrow(${ie})`) &&
      check(cons, `seed ${seed}: escrowConsistent false(itemHeld!=escrowIds.size)`) &&
      check(distOk, `seed ${seed}: 가방 분포 기대 어긋남(${dist}·minted ${r.inventory.minted})`) &&
      check(crashOk, `seed ${seed}: crash 복구 후 정합/digest 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(me.join(','), 14)} | ${pad(ie.join(','), 11)} | ${pad(setMatch ? '예' : '아니오', 9)} | ${pad(cons ? '예' : '아니오', 16)} | ${pad(r.inventory.minted + ' ' + dist, 21)} | ${pad(crashOk ? '예' : '아니오', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 두 서비스가 *교차 정합*: 우편이 escrow custody 중이라 믿는 itemId 집합 == 가방 원장의 실제 escrow 소유 집합(공백·중복 0). minted 3 아이템이 매 순간 정확히 한 곳(수령자 h1·발신자 x·escrow)에 — 3 레그(0161~0163) 전이가 보존을 깨지 않음. crash→reconstruct 후에도 escrow 집합 보존.');
  console.log('    아이템 우편↔가방 arc(0161~0164) 닫힘 — 거래소↔가방(0117~0120)의 우편 판. give 회신 비동기 수신·실패 보상(saga·0165~)이 다음 자연 확장(현재 give 는 fire-and-forget·무손실 가정).');
}

kit.MODES['exmlin4'] = exmlin4;
kit.ORDER.splice(1, 0, 'exmlin4');

(async () => { process.exit(await kit.cli(process.argv)); })();
