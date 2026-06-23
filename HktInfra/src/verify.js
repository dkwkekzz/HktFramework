// HktInfra step-0134 — 헤드리스 검증 (saga 포기 give 재admission·exchReadmit — 0048 busLeaseLife 재admission 의 saga 판)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaread`.
//   더한 한 조각: 0131 의 상한 포기는 *영구*였다 — 회신 손실이 *해소*되면 운영이 그 give 를 재개할 수 있어야 한다. 포기 시 give 파라미터를 abandonedGive 에 간직, exchReadmit op 이 그것을 pendingGive 로 되돌리고 retryCount 를 리셋(상한 재충전) → 다음 sweep 이 재전송 → 손실 해소 후면 ack→drain.
//   검증: ⒜ `reg`(키트) — exchReadmit 부재·sagaMaxRetries 0 면 abandonedGive 빔·no-op = 0133 비트 동일. ⒝ `exsagaread`(가설) — 손실(tick<86)로 포기(giveAbandoned 1·pending 1) 후 손실 해소→exchReadmit→sweep. 재admission ON: readmitted 1·pending 0·giveOks 회복·open==escrow. OFF(재admission 없음): pending 1 고착·giveOks 0.
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
// 손실(tick<86) 동안: 초기 give@70 + sweep@76(retry1)·@80(retry2)·@84(cap=2 도달→포기). 손실 해소(≥86) 후: readmit@88 + sweep@90(재전송→ack→drain).
const OPS_BASE = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 76, op: { type: 'exchSweep', now: 76 } },   // retry1(reply 손실)
  { at: 80, op: { type: 'exchSweep', now: 80 } },   // retry2(reply 손실)
  { at: 84, op: { type: 'exchSweep', now: 84 } },   // cap 도달 → 포기(abandonedGive)
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 손실 해소 후 재전송(readmit 됐으면 ack→drain)
];
const READMIT = { at: 88, op: { type: 'exchReadmit' } };   // 손실 해소 후 운영 재admission(sweep@90 앞)
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 86 });   // tick<86 회신 손실·이후 통과
const CAP = 2;
const P = (seed, ops) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: CAP,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: ops });

function exsagaread(seeds) {
  console.log('== exsagaread: *가설* — saga 포기 give 재admission(exchReadmit). 손실(tick<86)로 cap 포기(giveAbandoned 1·pending 1) 후 손실 해소→exchReadmit→sweep. ON: readmitted 1·pending 0·giveOks 회복·open==escrow 안전. OFF(재admission 없음): pending 1 고착·giveOks 0. ==');
  console.log('seed   | ON readmit/pending/oks | ON open==escrow | OFF readmit/pending/oks | ON 회복·안전 | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, [...OPS_BASE.slice(0, 4), READMIT, OPS_BASE[4]]) });   // 포기(84)→readmit(88)→sweep(90)
    const off = run({ ...P(seed, OPS_BASE) });                                          // readmit 없음 — sweep(90)도 abandonedGive 만 봄(pendingGive 빔)
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const recovered = on.exchange.readmitted === 1 && on.exchange.pendingGives() === 0 && on.exchange.giveOks === on.exchange.gives;
    const ok =
      check(recovered, `seed ${seed}: 재admission 회복 실패(readmitted ${on.exchange.readmitted}/pending ${on.exchange.pendingGives()}/oks ${on.exchange.giveOks}/gives ${on.exchange.gives})`) &&
      check(onSafe, `seed ${seed}: 회복 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.exchange.readmitted === 0 && off.exchange.pendingGives() === 1 && off.exchange.giveOks === 0, `seed ${seed}: OFF 인데 회복 발생(readmitted ${off.exchange.readmitted}/pending ${off.exchange.pendingGives()}/oks ${off.exchange.giveOks})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(0128 불변)`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.readmitted + '/' + on.exchange.pendingGives() + '/' + on.exchange.giveOks, 22)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.readmitted + '/' + off.exchange.pendingGives() + '/' + off.exchange.giveOks, 23)} | ${pad((recovered && onSafe) ? '예' : '아니오', 11)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 포기가 *가역*이 된다: 손실 해소 후 exchReadmit 이 abandonedGive 를 pendingGive 로 되돌리고 retryCount 를 리셋(상한 재충전) → 다음 sweep@90 이 재전송 → 회신이 통과해(손실 해소) ack→pending drain·giveOks 회복·open==escrow 안전. 0048 busLeaseLife 재admission(축출 소비자 재가입)의 saga 판.');
  console.log('    재admission 없으면(OFF) sweep@90 은 pendingGive 가 비어(abandonedGive 에만 있음) no-op → pending 1 고착·giveOks 0. exchReadmit 부재·sagaMaxRetries 0 면 abandonedGive 빔 = 0133 비트 동일(reg). 회계 정합(sagaConsistent)은 ON/OFF 모두 유지.');
}

kit.MODES['exsagaread'] = exsagaread;
kit.ORDER.splice(1, 0, 'exsagaread');

(async () => { process.exit(await kit.cli(process.argv)); })();
