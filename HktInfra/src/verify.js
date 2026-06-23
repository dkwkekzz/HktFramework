// HktInfra step-0127 — 헤드리스 검증 (saga dedup 유계화·sagaDedupBound·saga_done ack-of-ack)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagabound`.
//   더한 한 조각: 0126 의 가방 dedup 맵(sagaResults)은 무계 성장. 거래소가 give 결과 최종 수신 시 saga_done{gid} 를 보내 가방이 dedup 항목 가지치기(0042 워터마크의 saga 판). 결과 최종 수신 = 더는 재전송 안 함 = 잊어도 안전.
//   검증: ⒜ `reg`(키트) — sagaDedupBound OFF·saga_done 부재면 0126 비트 동일. ⒝ `exsagabound`(가설) — 정상 흐름(9 give·dedup ON): bound ON 이면 sagaResults 0 으로 drain(유계)·sagaDones==acked; OFF 면 무계(sagaResults==gives). 정확성(giveOks·open==escrow·conserved) 불변.
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
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, exchangeTtl: 5, invOps: INV, exchangeOps: OPS, ...extra });

function exsagabound(seeds) {
  console.log('== exsagabound: *가설* — saga dedup 유계화. 거래소가 give 결과 최종 수신 시 saga_done{gid}→가방이 dedup 항목 가지치기. 정상 흐름(9 give·dedup ON): bound ON 이면 sagaResults 0 으로 drain(유계)·sagaDones==acked; OFF 면 무계(sagaResults==gives). 정확성 불변. ==');
  console.log('seed   | gives | bound ON sagaResults/dones | bound OFF sagaResults | giveOks | open==escrow | conserved | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { sagaDedupBound: true }) });
    const off = run({ ...P(seed, { sagaDedupBound: false }) });
    const onSize = on.inventory.sagaResults.size, offSize = off.inventory.sagaResults.size;
    const esc = ownedSet(on.inventory, 'escrow'), open = on.exchange.escrowItemIds();
    const safe = JSON.stringify(esc) === JSON.stringify(open);
    const ok =
      check(on.exchange.gives === 9 && on.exchange.ackedGives === 9, `seed ${seed}: give/ack 기대 9(${on.exchange.gives}/${on.exchange.ackedGives})`) &&
      check(onSize === 0 && on.exchange.sagaDones === on.exchange.ackedGives, `seed ${seed}: bound ON sagaResults 미-drain(size ${onSize}·dones ${on.exchange.sagaDones} vs acked ${on.exchange.ackedGives})`) &&
      check(offSize === off.exchange.gives, `seed ${seed}: bound OFF sagaResults 무계 기대(size ${offSize} vs gives ${off.exchange.gives})`) &&
      check(on.exchange.giveOks === 9 && safe && on.exchange.conserved(), `seed ${seed}: 정확성 깨짐(oks ${on.exchange.giveOks}·safe ${safe}·conserved ${on.exchange.conserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.gives, 5)} | ${pad(onSize + '/' + on.exchange.sagaDones, 26)} | ${pad(offSize, 21)} | ${pad(on.exchange.giveOks, 7)} | ${pad((safe ? '예' : '아니오') + ' ' + JSON.stringify(open), 12)} | ${pad(on.exchange.conserved() + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 가방 dedup 맵이 *유계*가 된다: 거래소가 give 결과를 최종 수신(더는 재전송 안 함)하면 saga_done 으로 통보 → 가방이 그 (replyTo,gid) dedup 항목을 잊는다 → 정상 흐름서 sagaResults 가 0 으로 drain(처리 give 수에 무관). bound OFF 면 무계(∝처리 give).');
  console.log('    saga_done 손실돼도 안전(가방이 항목 보존 → 재전송 시 여전히 멱등 재회신 → 다음 ack 가 다시 prune) — best-effort 가지치기(0042 busSeenBound 워터마크의 saga 판). 정확성(giveOks·open==escrow·conserved)은 유계화와 직교·불변. sagaDedupBound OFF·saga_done 부재면 0126 비트 동일(reg).');
}

kit.MODES['exsagabound'] = exsagabound;
kit.ORDER.splice(1, 0, 'exsagabound');

(async () => { process.exit(await kit.cli(process.argv)); })();
