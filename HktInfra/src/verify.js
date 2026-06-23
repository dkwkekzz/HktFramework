// HktInfra step-0137 — 헤드리스 검증 (saga 재admission 횟수 상한·readmitMax — 무한 abandon↔readmit 루프 방지)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagapermfail`.
//   더한 한 조각: 0134/0136 §9 — 손실이 영구면 abandon→readmit→retry→abandon→… 이 무한 반복될 수 있다. readmitMax 회 재admission 된 give 가 또 포기되면 *영구 실패*(permFailed)로 abandonedGive 에 안 넣어 재admission 을 차단한다. give 는 pending 에 남아 미해결(sagaConsistent 불변)·재admission 만 끊긴다. 0131 의 재전송 상한과 합쳐 총 작업 = sagaMaxRetries × readmitMax 로 2단 유계.
//   검증: ⒜ `reg`(키트) — readmitMax 0 면 영구 실패 분기 휴면 = 0136 비트 동일. ⒝ `exsagapermfail`(가설) — *영구* 손실 + 반복 readmit 신호(3회). readmitMax=2 ON: readmitted 2 로 유계·permFailed 1·pending 1·open==escrow·sagaConsistent. OFF(0): readmitted 3(신호마다 무한 재개)·permFailed 0.
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
// 영구 손실. cap=1(retransmit 1회 후 포기). 한 cycle = [sweep(retransmit)·sweep(abandon)·readmit]. 3 cycle 반복.
const READMIT = (at) => ({ at, op: { type: 'exchReadmit' } });
const SW = (at) => ({ at, op: { type: 'exchSweep', now: at } });
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  SW(72), SW(74), READMIT(75),   // cycle1: retransmit·abandon(1)·readmit(→readmitCount 1)
  SW(76), SW(78), READMIT(79),   // cycle2: retransmit·abandon(2)·readmit(→readmitCount 2)
  SW(80), SW(82), READMIT(83),   // cycle3: retransmit·abandon(3) — readmitMax=2 ON 이면 여기서 permFail(readmit no-op)·OFF 면 readmit(→3)
  SW(84), SW(86),                // 추가 sweep(ON: pendingGive 빔 no-op·OFF: 또 abandon)
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' });   // 영구 손실(tick 게이트 없음)
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: 1,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagapermfail(seeds) {
  console.log('== exsagapermfail: *가설* — saga 재admission 횟수 상한(readmitMax=2). 영구 손실 + readmit 신호 3회. ON: readmitted 2 유계·3번째 포기서 영구 실패(permFailed 1·재admission 차단)·pending 1·open==escrow·sagaConsistent. OFF(0): readmitted 3(신호마다 무한 재개)·permFailed 0. ==');
  console.log('seed   | ON readmitted/permFailed/pending | ON open==escrow | OFF readmitted/permFailed | ON 유계<OFF | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { readmitMax: 2 }) });
    const off = run({ ...P(seed, { readmitMax: 0 }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const bounded = on.exchange.readmitted < off.exchange.readmitted;
    const ok =
      check(on.exchange.readmitted === 2 && on.exchange.permFailed === 1 && on.exchange.pendingGives() === 1, `seed ${seed}: 상한 ON 기대 어긋남(readmitted ${on.exchange.readmitted}/permFailed ${on.exchange.permFailed}/pending ${on.exchange.pendingGives()})`) &&
      check(onSafe, `seed ${seed}: 영구 실패 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.exchange.readmitted === 3 && off.exchange.permFailed === 0, `seed ${seed}: 상한 OFF 기대 어긋남(readmitted ${off.exchange.readmitted}/permFailed ${off.exchange.permFailed})`) &&
      check(bounded, `seed ${seed}: 상한이 재admission 발산을 못 막음(ON ${on.exchange.readmitted} !< OFF ${off.exchange.readmitted})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(영구 실패 give 가 pending 에 남아야)`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.readmitted + '/' + on.exchange.permFailed + '/' + on.exchange.pendingGives(), 32)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.readmitted + '/' + off.exchange.permFailed, 25)} | ${pad(bounded ? '예' : '아니오', 10)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → abandon↔readmit 루프가 *유계*가 된다: gid 가 readmitMax(2)회 재admission 된 뒤 또 포기되면 영구 실패로 abandonedGive 에 안 넣어 재admission 을 끊는다(readmitted 2 고정·permFailed 1). 0131 재전송 상한(sagaMaxRetries)과 합쳐 총 재전송 ≤ sagaMaxRetries×(readmitMax+1) 로 2단 유계.');
  console.log('    영구 실패 give 는 pending 에 남아(미해결) sagaConsistent(gives==acked+pending) 불변·open==escrow 안전(영구 실패도 abort 아님). readmitMax 0 면 신호마다 무한 재개(OFF readmitted 3)·영구 실패 분기 휴면 = 0136 비트 동일(reg).');
}

kit.MODES['exsagapermfail'] = exsagapermfail;
kit.ORDER.splice(1, 0, 'exsagapermfail');

(async () => { process.exit(await kit.cli(process.argv)); })();
