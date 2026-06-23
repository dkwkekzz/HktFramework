// HktInfra step-0136 — 헤드리스 검증 (saga 재admission 자동 트리거·autoReadmit — 0056 busPresenceRecover 의 saga 판)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaautoread`.
//   더한 한 조각: 0134/0135 재admission 은 *수동* exchReadmit op 였다. autoReadmit ON 이면 거래소가 svc.inventory.up(가방 회복 신호)을 *구독*해, 그 ev 수신 시 스스로 _readmit() — 수동 op 불요(decouple·은닉: 거래소는 가방 회복을 직접 안 보고 발행된 신호로만 반응). 가방 회복 신호 전달은 0187/0189 의 presAnnounceStraggler 처럼 구독 ev 를 거래소에 주입해 모델.
//   검증: ⒜ `reg`(키트) — autoReadmit OFF 면 svc.inventory.up ev 무시·구독 미추가 = 0135 비트 동일. ⒝ `exsagaautoread`(가설) — 손실(tick<86)로 포기 후 손실 해소→svc.inventory.up 발행(@88). ON: 거래소 자동 _readmit→readmitted 1·sweep@90 재전송→pending 0·open==escrow. OFF: 같은 ev 무시→readmitted 0·pending 1 고착.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const INV = [{ at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } }];   // item0
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 76, op: { type: 'exchSweep', now: 76 } },   // retry1(reply 손실)
  { at: 80, op: { type: 'exchSweep', now: 80 } },   // retry2(reply 손실)
  { at: 84, op: { type: 'exchSweep', now: 84 } },   // cap=2 도달 → 포기
  { at: 88, op: { type: 'ev', topic: 'svc.inventory.up', ev: { addr: 'inventory' } } },   // 가방 회복 신호(구독 ev 주입·바스 배달 모델) → autoReadmit ON 이면 자동 재admission
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 재전송 → ack → drain
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 86 });
const CAP = 2;
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: CAP,
  bus: true, audit: true, transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagaautoread(seeds) {
  console.log('== exsagaautoread: *가설* — saga 재admission 자동 트리거(autoReadmit). 손실로 포기 후 손실 해소→svc.inventory.up 발행(@88). ON: 거래소가 구독 신호 수신→스스로 _readmit→readmitted 1·sweep@90→pending 0·open==escrow(수동 op 불요). OFF: 같은 ev 무시→readmitted 0·pending 1 고착. ==');
  console.log('seed   | ON readmitted/pending/oks | ON open==escrow | OFF readmitted/pending/oks | ON 자동회복·안전 | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { autoReadmit: true }) });
    const off = run({ ...P(seed, { autoReadmit: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const recovered = on.exchange.readmitted === 1 && on.exchange.pendingGives() === 0 && on.exchange.giveOks === on.exchange.gives;
    const ok =
      check(recovered, `seed ${seed}: 자동 재admission 회복 실패(readmitted ${on.exchange.readmitted}/pending ${on.exchange.pendingGives()}/oks ${on.exchange.giveOks}/gives ${on.exchange.gives})`) &&
      check(onSafe, `seed ${seed}: 자동 회복 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.exchange.readmitted === 0 && off.exchange.pendingGives() === 1 && off.exchange.giveOks === 0, `seed ${seed}: OFF 인데 ev 에 반응(readmitted ${off.exchange.readmitted}/pending ${off.exchange.pendingGives()})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(0128 불변)`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.readmitted + '/' + on.exchange.pendingGives() + '/' + on.exchange.giveOks, 25)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.readmitted + '/' + off.exchange.pendingGives() + '/' + off.exchange.giveOks, 26)} | ${pad((recovered && onSafe) ? '예' : '아니오', 15)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재admission 이 *자동·decouple* 이 된다: 거래소가 svc.inventory.up(가방 회복)을 구독해 수신 시 스스로 _readmit → 운영의 수동 exchReadmit 없이 손실 해소를 따라 회복(readmitted 1·pending 0·open==escrow). 거래소는 가방 내부/주소를 직접 안 보고 *발행된 신호*로만 반응(은닉·단일 연결). 0056 busPresenceRecover(프레즌스 회복→재구독)의 saga 판.');
  console.log('    autoReadmit OFF 면 같은 svc.inventory.up ev 가 와도 거래소가 무시(branch 휴면) → pending 1 고착·oks 0. autoReadmit OFF·구독 미추가면 0135 비트 동일(reg). 회계 정합(sagaConsistent) ON/OFF 유지.');
}

kit.MODES['exsagaautoread'] = exsagaautoread;
kit.ORDER.splice(1, 0, 'exsagaautoread');

(async () => { process.exit(await kit.cli(process.argv)); })();
