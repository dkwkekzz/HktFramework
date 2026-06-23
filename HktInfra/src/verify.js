// HktInfra step-0139 — 헤드리스 검증 (가방 회복 자기 공지·invUpPublish — 0136 자동 트리거의 발행자·실 버스 체인 완성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagainvup`.
//   더한 한 조각: 0136 은 거래소의 *구독·반응*만 세웠다(ev 직접 주입). 이 step 은 *발행자*를 세운다 — 가방이 회복을 svc.inventory.up 으로 *발행*하고, 버스가 그것을 거래소(0136 구독자)로 라우팅 → 거래소가 자동 재admission. 발행→버스→구독 실 체인(0136 의 직접 주입 대신 진짜 버스 경유). announceUp 은 회복 시점 seam.
//   검증: ⒜ `reg`(키트) — invUpPublish OFF·announceUp 부재면 발행 0 = 0138 비트 동일. ⒝ `exsagainvup`(가설) — 손실(tick<86)로 포기 후 손실 해소→가방 announceUp@88→svc.inventory.up 발행→버스→거래소 autoReadmit. ON: invUpPublished 1·거래소 readmitted 1(실 버스 경유)·pending 0·open==escrow. OFF: 가방 미발행→거래소 신호 0→pending 1 고착.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 88, op: { type: 'announceUp' } },   // 손실 해소 후 가방 회복 자기 공지(→ svc.inventory.up 발행 → 버스 → 거래소 autoReadmit)
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 76, op: { type: 'exchSweep', now: 76 } },   // retry1(reply 손실)
  { at: 80, op: { type: 'exchSweep', now: 80 } },   // retry2(reply 손실)
  { at: 84, op: { type: 'exchSweep', now: 84 } },   // cap=2 도달 → 포기
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 재전송 → ack → drain(가방 회복 신호로 재admission 됐으면)
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 86 });
const CAP = 2;
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: CAP, autoReadmit: true,
  bus: true, audit: true, transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagainvup(seeds) {
  console.log('== exsagainvup: *가설* — 가방 회복 자기 공지(invUpPublish)가 0136 자동 트리거의 발행자. 손실로 포기 후 가방 announceUp@88→svc.inventory.up 발행→버스→거래소 autoReadmit. ON: invUpPublished 1·거래소 readmitted 1(실 버스 경유)·pending 0·open==escrow. OFF: 가방 미발행→거래소 readmitted 0·pending 1 고착. ==');
  console.log('seed   | ON invUpPub/ex readmitted/pending | ON open==escrow | OFF invUpPub/readmitted/pending | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { invUpPublish: true }) });
    const off = run({ ...P(seed, { invUpPublish: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const recovered = on.inventory.invUpPublished === 1 && on.exchange.readmitted === 1 && on.exchange.pendingGives() === 0;
    const ok =
      check(recovered, `seed ${seed}: 실 버스 체인 회복 실패(invUpPub ${on.inventory.invUpPublished}/ex readmitted ${on.exchange.readmitted}/pending ${on.exchange.pendingGives()})`) &&
      check(onSafe, `seed ${seed}: 회복 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.inventory.invUpPublished === 0 && off.exchange.readmitted === 0 && off.exchange.pendingGives() === 1, `seed ${seed}: OFF 인데 발행/재admission(invUpPub ${off.inventory.invUpPublished}/readmitted ${off.exchange.readmitted}/pending ${off.exchange.pendingGives()})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(0128 불변)`);
    console.log(`${pad(seed, 6)} | ${pad(on.inventory.invUpPublished + '/' + on.exchange.readmitted + '/' + on.exchange.pendingGives(), 33)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.inventory.invUpPublished + '/' + off.exchange.readmitted + '/' + off.exchange.pendingGives(), 31)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 자동 트리거의 *발행→버스→구독* 실 체인이 완성된다: 가방이 회복을 svc.inventory.up 으로 발행(invUpPublished 1) → 버스가 거래소(0136 구독자)로 라우팅 → 거래소 autoReadmit→_readmit(readmitted 1) → sweep 재전송→ack→drain(pending 0·open==escrow). 0136 은 직접 ev 주입이었으나 이제 진짜 버스 경유(발행자 무수정·은닉).');
  console.log('    invUpPublish OFF 면 가방이 안 발행 → 거래소가 신호를 못 받아 재admission 0·pending 1 고착(발행자가 회복 신호의 *원천*임을 대조 증명). invUpPublish OFF·announceUp 부재면 0138 비트 동일(reg). 회계 정합 ON/OFF 유지.');
}

kit.MODES['exsagainvup'] = exsagainvup;
kit.ORDER.splice(1, 0, 'exsagainvup');

(async () => { process.exit(await kit.cli(process.argv)); })();
