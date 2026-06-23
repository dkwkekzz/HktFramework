// HktInfra step-0125 — 헤드리스 검증 (saga 미해결 give 추적 + 회신 손실 감지·pendingGives·gid)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagapend`.
//   더한 한 조각: 0121 §9(회신 손실 무대비)를 가시화. saga ON 이면 각 give 에 gid 부여·미해결 집합(pending)에 add, item_result 회신이 gid 로 remove. 정상 흐름 pending→0(닫힌 고리 liveness)·회신 경로 손실 주입 시 잔존(ack 미수신 격차 가시).
//   검증: ⒜ `reg`(키트) — saga OFF·gid 부재면 추적 0 = 0124 비트 동일. ⒝ `exsagapend`(가설) — 정상: pending 0·pendingPeak>0·ackedGives==gives; 회신 손실(inventory→exchange item_result 드롭): pending==gives·ackedGives 0(격차 가시). 손실에도 2-서비스 *안전*(escrowItemIds==가방 escrow)은 유지 — 격차는 *지식*이지 안전 아님.
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
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },
  { at: 76, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 3 } },
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item4' } },
  { at: 85, op: { type: 'exchSweep', now: 85 } },
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
// 회신 경로 손실 — 가방→거래소 item_result 만 100% 드롭(give 자체는 가방서 정상 실행·escrow 이동 정상). 거래소가 회신을 못 받아 pending 잔존.
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' });
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, exchangeTtl: 5, invOps: INV, exchangeOps: OPS, ...extra });

function exsagapend(seeds) {
  console.log('== exsagapend: *가설* — saga 미해결 give 추적·회신 손실 감지. 각 give 에 gid·pending add·회신이 remove. 정상: pending→0(닫힌 고리). 회신 손실(가방→거래소 item_result 드롭): pending 잔존(ack 미수신 격차 가시·ackedGives<gives). 손실에도 2-서비스 안전(open==escrow) 유지=격차는 지식이지 안전 아님. ==');
  console.log('seed   | gives | 정상 pending/peak | 정상 acked | 손실 pending | 손실 acked | 손실 open==escrow | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed) });                                  // 정상(무손실)
    const lossy = run({ ...P(seed, { transport: REPLYLOSS(seed) }) }); // 회신 손실
    const lEsc = ownedSet(lossy.inventory, 'escrow');
    const lOpen = lossy.exchange.escrowItemIds();
    const lSafe = JSON.stringify(lEsc) === JSON.stringify(lOpen);     // 손실에도 2-서비스 안전(낙관적 booking 이 우연히 옳음)
    const ok =
      check(on.exchange.gives > 0 && on.exchange.pendingPeak > 0, `seed ${seed}: in-flight give 미추적(gives ${on.exchange.gives}/peak ${on.exchange.pendingPeak})`) &&
      check(on.exchange.pendingGives() === 0 && on.exchange.ackedGives === on.exchange.gives, `seed ${seed}: 정상 흐름 pending 미-drain(pending ${on.exchange.pendingGives()}/acked ${on.exchange.ackedGives}/gives ${on.exchange.gives})`) &&
      check(lossy.exchange.pendingGives() === lossy.exchange.gives && lossy.exchange.ackedGives === 0, `seed ${seed}: 회신 손실 격차 미가시(pending ${lossy.exchange.pendingGives()}/gives ${lossy.exchange.gives}/acked ${lossy.exchange.ackedGives})`) &&
      check(lSafe, `seed ${seed}: 회신 손실에도 2-서비스 안전 깨짐(open ${JSON.stringify(lOpen)} vs escrow ${JSON.stringify(lEsc)})`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.gives, 5)} | ${pad(on.exchange.pendingGives() + '/' + on.exchange.pendingPeak, 17)} | ${pad(on.exchange.ackedGives, 10)} | ${pad(lossy.exchange.pendingGives(), 12)} | ${pad(lossy.exchange.ackedGives, 10)} | ${pad((lSafe ? '예' : '아니오') + ' ' + JSON.stringify(lOpen), 17)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소가 *어느 give 가 응답을 못 받았나*를 안다: 정상 흐름서 pending 은 0 으로 drain(모든 give acked·닫힌 고리 liveness)·회신 손실 시 잃은 회신의 gid 가 pending 에 잔존(ackedGives<gives = ack 미수신 격차 가시). 0121 §9(회신 손실 무대비)의 *감지* 절반.');
  console.log('    회신 손실에도 2-서비스 *안전*(open 매물 ≡ 가방 escrow 소유)은 유지 — give 자체는 가방서 정상 실행됐고 거래소의 낙관적 booking 이 우연히 옳다. 격차는 *지식*(거래소가 확인 못 함)이지 안전 위반이 아니다. 재전송(idempotent dedup·우연 의존 제거)은 후속. saga OFF·gid 부재면 추적 0 = 0124 비트 동일.');
}

kit.MODES['exsagapend'] = exsagapend;
kit.ORDER.splice(1, 0, 'exsagapend');

(async () => { process.exit(await kit.cli(process.argv)); })();
