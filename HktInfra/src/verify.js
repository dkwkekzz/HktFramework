// HktInfra step-0163 — 헤드리스 검증 (아이템 우편↔가방 leg3: 만료 시 escrow→발신자 가방 반환·mailInv)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlin3`.
//   더한 한 조각: mailSweep 만료 시 아이템 실은 통마다 가방에 give('escrow'→발신자) 를 요청한다(mailInv ON). 거래소 0119 expire leg3 의 우편 판 — 미수령 아이템이 발신자 가방으로 회수(증발 0).
//   검증: ⒜ `reg`(키트) — mailInv OFF·give 0 = 0162 비트 동일. ⒝ `exmlin3`(가설·혼합) — item0 수령(→h1)·item1 만료(→발신자 x 반환)로 아이템 경로 분기 완성.
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
// 혼합 — item0 은 h1 이 수령(leg2·→h1)·item1 은 미수령 만료(leg3·→발신자 x 반환). 아이템 경로 분기 완성.
const base = (seed, inv) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: inv, mailTtl: 10,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30)],
});

function exmlin3(seeds) {
  console.log('== exmlin3: 아이템 우편↔가방 leg3 — 만료 시 escrow→발신자 가방 반환(mailInv). 미수령 아이템이 발신자에게 회수(증발 0). 아이템 경로 분기 완성: 발신자→escrow→{수령 시 수신자 | 만료 시 발신자 반환}. 거래소 0119 expire leg 의 우편 판. ==');
  console.log('seed   | ON gives/escrowXfers | item0(수령)/item1(만료반환) | OFF item0/item1 | fetched/expired | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const ownersOn = on.inventory.ownerOf('item0') + '/' + on.inventory.ownerOf('item1');
    const ownersOff = off.inventory.ownerOf('item0') + '/' + off.inventory.ownerOf('item1');
    const onOk = (on.mail.gives === 4 && on.inventory.escrowXfers === 4 && on.mail.itemFetched === 1 && on.mail.itemExpired === 1 &&
      on.inventory.ownerOf('item0') === 'h1' && on.inventory.ownerOf('item1') === 'x');
    const offOk = (off.mail.gives === 0 && off.inventory.escrowXfers === 0 &&
      off.inventory.ownerOf('item0') === 'x' && off.inventory.ownerOf('item1') === 'x');
    const ok =
      check(onOk, `seed ${seed}: ON leg3 어긋남(gives ${on.mail.gives}·escrowXfers ${on.inventory.escrowXfers}·owners ${ownersOn}·f/e ${on.mail.itemFetched}/${on.mail.itemExpired})`) &&
      check(offOk, `seed ${seed}: OFF 추상 escrow 어긋남(gives ${off.mail.gives}·owners ${ownersOff})`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.gives + '/' + on.inventory.escrowXfers, 20)} | ${pad(ownersOn, 27)} | ${pad(ownersOff, 15)} | ${pad(on.mail.itemFetched + '/' + on.mail.itemExpired, 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → mailInv ON: 만료가 escrow custody 의 미수령 아이템을 *발신자 가방으로 회수*(item1 ownerOf=x·발신자 반환). 수령(item0→h1)과 함께 아이템 경로 분기가 닫힌다 — 어느 경로든 실제 가방에 착지(escrowXfers 4·증발 0). OFF: 가방 원장 무변경(추상 escrow).');
  console.log('    아이템 우편↔가방 3 레그(0161 발신·0162 수령·0163 만료반환) 완비 — 2-서비스 보존 capstone(0164·escrow 잔액==itemHeld·minted==최종 분포) 후속.');
}

kit.MODES['exmlin3'] = exmlin3;
kit.ORDER.splice(1, 0, 'exmlin3');

(async () => { process.exit(await kit.cli(process.argv)); })();
