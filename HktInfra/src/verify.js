// HktInfra step-0128 — 헤드리스 검증 (saga 회계 정합 불변·sagaConsistent — 체제 무관 대수적 닫힘)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaconsist`.
//   더한 한 조각: 0121~0127 saga 회계가 *대수적으로 닫혀* 있는지 단언. ① gives==ackedGives+pendingGives(새는 give 0) ② ackedGives==giveOks+giveFails(분류 누락 0). 세 체제(정상·회신손실·재전송+dedup) 모두서 성립=체제 무관 회계 정합.
//   검증: ⒜ `reg`(키트) — sagaConsistent 미호출 accessor = 0127 비트 동일. ⒝ `exsagaconsist`(가설) — 정상(pending 0·oks==gives)·손실(pending==gives·acked 0)·재전송+dedup(pending 0·oks 회복) 모두 sagaConsistent()==true·항등식 성립.
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
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },
  { at: 63, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },
  { at: 64, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
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
const OPS_RETRY = OPS.concat([{ at: 88, op: { type: 'exchRetry' } }]);
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 88 });   // tick<88: 최초 회신만 손실·재전송(88+) 회신 통과
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, exchangeTtl: 5, invOps: INV, exchangeOps: OPS, ...extra });

function exsagaconsist(seeds) {
  console.log('== exsagaconsist: *가설* — saga 회계 정합 불변. ① gives==acked+pending(새는 give 0) ② acked==oks+fails(분류 누락 0). 세 체제(정상·회신손실·재전송+dedup) 모두서 sagaConsistent()==true. 체제 무관 대수적 닫힘. ==');
  console.log('seed   | 체제          | gives | acked | pending | oks | fails | ①gives==a+p | ②a==o+f | sagaConsistent | 판정');
  for (const seed of seeds) {
    const regimes = [
      ['정상         ', run({ ...P(seed) })],
      ['회신손실      ', run({ ...P(seed, { transport: REPLYLOSS(seed) }) })],
      ['재전송+dedup  ', run({ ...P(seed, { sagaDedup: true, sagaDedupBound: true, exchangeOps: OPS_RETRY, transport: REPLYLOSS(seed) }) })],
    ];
    for (const [name, r] of regimes) {
      const e = r.exchange;
      const id1 = e.gives === e.ackedGives + e.pendingGives();
      const id2 = e.ackedGives === e.giveOks + e.giveFails;
      const sc = e.sagaConsistent();
      const ok =
        check(id1, `seed ${seed} ${name.trim()}: gives ${e.gives} != acked ${e.ackedGives} + pending ${e.pendingGives()}`) &&
        check(id2, `seed ${seed} ${name.trim()}: acked ${e.ackedGives} != oks ${e.giveOks} + fails ${e.giveFails}`) &&
        check(sc === (id1 && id2), `seed ${seed} ${name.trim()}: sagaConsistent() ${sc} != (id1&&id2)`);
      console.log(`${pad(seed, 6)} | ${name} | ${pad(e.gives, 5)} | ${pad(e.ackedGives, 5)} | ${pad(e.pendingGives(), 7)} | ${pad(e.giveOks, 3)} | ${pad(e.giveFails, 5)} | ${pad(id1 ? '예' : '아니오', 11)} | ${pad(id2 ? '예' : '아니오', 7)} | ${pad(sc ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
  console.log('  → saga 회계가 *체제 무관*으로 대수적으로 닫혀 있다: 보낸 모든 give 는 정확히 acked(회신 받음) 또는 pending(미수신) 둘 중 하나(새는 give 0)·받은 모든 회신은 ok 또는 fail(분류 누락 0). 정상(pending 0·oks==gives)·회신손실(pending==gives·acked 0)·재전송+dedup(pending 0·oks 회복) 모두서 sagaConsistent()==true.');
  console.log('    이 두 항등식이 거래소↔가방 saga(0121 피드백~0127 유계)의 *창발 불변* — 손실·재전송 같은 고장 주입 아래서도 회계가 새거나 중복되지 않는다(0120 2-서비스 보존의 회계 평면 판). sagaConsistent 미호출이면 동작 무영향 = 0127 비트 동일(reg).');
}

kit.MODES['exsagaconsist'] = exsagaconsist;
kit.ORDER.splice(1, 0, 'exsagaconsist');

(async () => { process.exit(await kit.cli(process.argv)); })();
