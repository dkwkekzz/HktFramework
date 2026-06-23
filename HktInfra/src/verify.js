// HktInfra step-0129 — 헤드리스 검증 (saga 자동 재전송·autoRetry — exchSweep 피기백)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaauto`.
//   더한 한 조각: 0126 의 명시 exchRetry op 를 *주기적* exchSweep(0114 TTL sweep)이 트리거하는 자동 재전송으로. autoRetry ON 이면 매 sweep 이 미해결 give 재전송 → 회신 손실이 지속돼도 다음 sweep 이 다시 시도(가방 dedup 이 재실행 0).
//   검증: ⒜ `reg`(키트) — autoRetry OFF·exchSweep 부재면 0128 비트 동일(sweep 은 TTL 만). ⒝ `exsagaauto`(가설) — 회신 손실(tick<88) + exchSweep@84(손실 중·재시도 실패)·@90(손실 후·재시도 성공). autoRetry ON: pending 0·giveOks 회복·open==escrow(안전). OFF: pending 1(고착·재전송 0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

// s1 list item0(give·회신 손실). exchSweep 2회(84=손실 중·90=손실 후)가 자동 재전송 트리거. ttl 0(만료 없음·sweep 은 재전송 트리거로만).
const INV = [{ at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } }];   // item0
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // give seller→escrow(gid0)·회신 손실
  { at: 84, op: { type: 'exchSweep', now: 84 } },   // 손실 중 재전송(회신 또 손실)
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 손실 후 재전송(회신 통과→pending drain)
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 88 });   // tick<88 회신 손실(최초+84 재전송)·90 재전송 회신 통과
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagaauto(seeds) {
  console.log('== exsagaauto: *가설* — saga 자동 재전송(exchSweep 피기백). 회신 손실(tick<88) + 주기 exchSweep@84(손실 중)·@90(손실 후). autoRetry ON: 매 sweep 이 미해결 give 재전송→90 재전송 회신 통과→pending 0·giveOks 회복·open==escrow(안전). OFF: 재전송 0·pending 고착. ==');
  console.log('seed   | autoON retries/pending/oks | ON open==escrow | autoOFF retries/pending | OFF open==escrow | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { autoRetry: true }) });
    const off = run({ ...P(seed, { autoRetry: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const offEsc = ownedSet(off.inventory, 'escrow'), offOpen = off.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen);
    const ok =
      check(on.exchange.retries >= 1 && on.exchange.pendingGives() === 0 && on.exchange.giveOks === on.exchange.gives, `seed ${seed}: autoRetry ON 회복 실패(retries ${on.exchange.retries}/pending ${on.exchange.pendingGives()}/oks ${on.exchange.giveOks}/gives ${on.exchange.gives})`) &&
      check(onSafe && JSON.stringify(onOpen) === '["item0"]', `seed ${seed}: autoRetry ON 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.exchange.retries === 0 && off.exchange.pendingGives() === off.exchange.gives, `seed ${seed}: autoRetry OFF 인데 재전송/회복 발생(retries ${off.exchange.retries}/pending ${off.exchange.pendingGives()})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(0128 불변)`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.retries + '/' + on.exchange.pendingGives() + '/' + on.exchange.giveOks, 26)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.retries + '/' + off.exchange.pendingGives(), 23)} | ${pad((JSON.stringify(offEsc) === JSON.stringify(offOpen) ? '예' : '아니오') + ' ' + JSON.stringify(offOpen), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재전송이 *자동·주기적*이 된다: exchSweep(0114 TTL 신호)을 재사용해 매 주기 미해결 give 를 재전송 → 회신 손실이 지속돼도(@84 재전송 회신 또 손실) 다음 주기(@90)에 다시 시도해 끝내 회복(pending 0·giveOks 회복·2-서비스 안전). 가방 dedup(0126) 이 매 재전송의 재실행 0 을 보장.');
  console.log('    autoRetry OFF 면 sweep 은 TTL 회수만(0114) → 재전송 0·pending 고착(회신 손실 영구). exchSweep 부재·autoRetry OFF 면 0128 비트 동일(reg). 회계 정합(0128 sagaConsistent)은 ON/OFF 모두 유지.');
}

kit.MODES['exsagaauto'] = exsagaauto;
kit.ORDER.splice(1, 0, 'exsagaauto');

(async () => { process.exit(await kit.cli(process.argv)); })();
