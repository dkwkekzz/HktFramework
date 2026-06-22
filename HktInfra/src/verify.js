// HktInfra step-0121 — 헤드리스 검증 (거래소↔가방 escrow give 결과 비동기 수신·exchSaga 피드백 채널)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaack`.
//   더한 한 조각: 0117~0120 의 거래소→가방 give 는 fire-and-forget(결과 미수신) — 거래소가 give 성공을 낙관적으로 가정한다. 이 step 은 saga 피드백 채널을 연다: saga ON 이면 give 에 replyTo+cause 를 실어 가방이 item_result(ok)를 거래소로도 회신, 거래소가 ackedGives/giveOks/giveFails 로 집계(관측만·보상은 후속).
//   검증: ⒜ `reg`(키트) — saga OFF·replyTo 부재면 회신 0·집계 0 = 0120 비트 동일. ⒝ `exsagaack`(가설) — 정상 거래 흐름서 모든 escrow give 가 ok 로 acked(ackedGives==gives·giveOks==gives·giveFails 0) = 2-서비스 닫힌 피드백 고리. saga OFF 면 ackedGives 0(fire-and-forget). 0120 보존 불변(open==escrow 소유·minted 불변·conserved)도 유지.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item1
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item2
  { at: 63, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item3
  { at: 64, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item4
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20, itemId: 'item3' } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },           // item0 → b1 (sold)
  { at: 76, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },           // item1 → b2 (sold)
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 3 } },       // item2 → s2 (cancel)
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item4' } },   // 늦게 list(만료 회피)
  { at: 85, op: { type: 'exchSweep', now: 85 } },                    // id4(item3·@73·age12) 만료→s2 / id5(item4·@82·age3) open 유지
];
const TTL = 5;
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchangeTtl: TTL, invOps: INV, exchangeOps: OPS, ...extra });

function exsagaack(seeds) {
  console.log('== exsagaack: *가설* — 거래소↔가방 escrow give 결과 비동기 수신. saga ON 이면 가방이 item_result 를 거래소로 회신·거래소가 집계 → 정상 흐름서 모든 escrow give 가 ok 로 acked(ackedGives==gives·giveFails 0)=닫힌 피드백 고리. saga OFF 면 회신 0. ==');
  console.log('  5 적재→list 5→buy 2·cancel 1·만료 1·open 1. escrow give 9회(list 5+buy 2+cancel 1+expire 1) 전부 가방 ok → 거래소가 9 ack 수신·전부 ok. 0120 보존 불변도 유지.');
  console.log('seed   | gives | ackedGives | giveOks | giveFails | OFF acked | open매물itemId==escrow소유 | minted | conserved | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { exchSaga: true }) });
    const off = run({ ...P(seed, { exchSaga: false }) });
    const ex = on.exchange; const inv = on.inventory;
    const escOwned = ownedSet(inv, 'escrow');
    const exOpen = ex.escrowItemIds();
    const match = JSON.stringify(escOwned) === JSON.stringify(exOpen);   // 0120 2-서비스 일치 유지
    const minted = inv.minted; const conserved = ex.conserved();
    const offAcked = off.exchange.ackedGives;
    const ok =
      check(ex.gives > 0, `seed ${seed}: escrow give 0(인출/입금/반환 레그 미작동)`) &&
      check(ex.ackedGives === ex.gives, `seed ${seed}: ack 누락(acked ${ex.ackedGives} != gives ${ex.gives})`) &&
      check(ex.giveOks === ex.gives && ex.giveFails === 0, `seed ${seed}: 정상 흐름인데 give 실패(oks ${ex.giveOks}/fails ${ex.giveFails} vs gives ${ex.gives})`) &&
      check(offAcked === 0, `seed ${seed}: saga OFF 인데 ack 수신(${offAcked}) — fire-and-forget 위반`) &&
      check(match && minted === 5 && conserved, `seed ${seed}: 0120 보존 불변 깨짐(match ${match}·minted ${minted}·conserved ${conserved})`);
    console.log(`${pad(seed, 6)} | ${pad(ex.gives, 5)} | ${pad(ex.ackedGives, 10)} | ${pad(ex.giveOks, 7)} | ${pad(ex.giveFails, 9)} | ${pad(offAcked, 9)} | ${pad((match ? '예' : '아니오') + ' ' + JSON.stringify(exOpen), 26)} | ${pad(minted, 6)} | ${pad(conserved + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소가 가방 give 결과를 *비동기로 받는다*: saga ON 이면 모든 escrow give(인출 5+입금 2+반환 1·취소 1·만료 1)가 ok 로 회신돼 ackedGives==gives·giveFails 0 — 2-서비스 결합이 *낙관적 fire-and-forget* 에서 *닫힌 피드백 고리*로. saga OFF 면 회신 0(0120 비트 동일).');
  console.log('    이 피드백 채널이 *보상*(give 실패 시 거래소 회계 롤백·phantom 매물 0)의 토대 — 이 step 은 채널 개통+정상 흐름 집계만 단언(실패 주입→보상은 후속). replyTo 부재면 가방 회신 분기 휴면 = reg 0.');
}

kit.MODES['exsagaack'] = exsagaack;
kit.ORDER.splice(1, 0, 'exsagaack');

(async () => { process.exit(await kit.cli(process.argv)); })();
