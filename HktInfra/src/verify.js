// HktInfra step-0135 — 헤드리스 검증 (saga 재admission 발행·readmitPublish — 0132 포기 발행의 짝·liveness 수명주기 관측 완비)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagareadpub`.
//   더한 한 조각: 0134 exchReadmit 은 *조용히* 재개했다 — 0132 가 포기를 발행했듯 재개도 발행돼야 운영이 saga liveness 수명주기(포기↔재개)를 본다. exchReadmit 핸들러에서 readmitPublish ON 이면 svc.exchange.saga_readmitted 를 gid 마다 1회 발행(readmitPublished==readmitted)·audit 가 구독 관측.
//   검증: ⒜ `reg`(키트) — readmitPublish OFF 면 발행 0 = 0134 비트 동일. ⒝ `exsagareadpub`(가설) — 손실(tick<86)로 포기 후 손실 해소→exchReadmit. ON: readmitPublished 1==readmitted·audit svc.exchange.saga_readmitted 1·pending 0·open==escrow. OFF: 발행 0·audit 0(재개 자체는 동일).
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
  { at: 88, op: { type: 'exchReadmit' } },          // 손실 해소 후 재admission(발행)
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 재전송 → ack → drain
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 86 });
const CAP = 2;
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: CAP,
  bus: true, audit: true, transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagareadpub(seeds) {
  console.log('== exsagareadpub: *가설* — saga 재admission 발행(0132 포기 발행의 짝). 손실로 포기 후 손실 해소→exchReadmit. ON: readmitPublished 1==readmitted·audit svc.exchange.saga_readmitted 1·pending 0·open==escrow. OFF: 발행 0·audit 0(재개는 동일). ==');
  console.log('seed   | ON pub/readmitted | audit saw | ON pending/open==escrow | OFF pub/audit | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { readmitPublish: true }) });
    const off = run({ ...P(seed, { readmitPublish: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const auditSaw = on.audit ? (on.audit.seen.get('svc.exchange.saga_readmitted') || 0) : 0;
    const offPub = off.exchange.readmitPublished, offAudit = off.audit ? (off.audit.seen.get('svc.exchange.saga_readmitted') || 0) : 0;
    const ok =
      check(on.exchange.readmitPublished === 1 && on.exchange.readmitted === 1, `seed ${seed}: 발행 != 재admission(pub ${on.exchange.readmitPublished}/readmitted ${on.exchange.readmitted})`) &&
      check(auditSaw === 1, `seed ${seed}: audit 관측 ${auditSaw} != 1`) &&
      check(on.exchange.pendingGives() === 0 && onSafe, `seed ${seed}: 재개 후 미회복/안전 위반(pending ${on.exchange.pendingGives()}·open ${JSON.stringify(onOpen)})`) &&
      check(offPub === 0 && offAudit === 0 && off.exchange.readmitted === 1, `seed ${seed}: OFF 인데 발행/관측(pub ${offPub}/audit ${offAudit}/readmitted ${off.exchange.readmitted})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.readmitPublished + '/' + on.exchange.readmitted, 17)} | ${pad(auditSaw, 9)} | ${pad(on.exchange.pendingGives() + '/' + (onSafe ? '예' : '아니오'), 23)} | ${pad(offPub + '/' + offAudit, 13)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → saga liveness 수명주기가 *양방향 관측*된다: 포기(svc.exchange.saga_abandoned·0132)와 재개(svc.exchange.saga_readmitted·이 step)를 모두 audit 가 구독 → 운영이 "어느 give 가 포기됐고 언제 재개됐나"를 본다. readmitPublished 1 == readmitted 1.');
  console.log('    발행은 통보일 뿐 — 재개 동작/회복(pending drain·open==escrow)은 발행 무관(ON/OFF 동일). readmitPublish OFF·bus 부재면 발행 0 = 0134 비트 동일(reg). 회계 정합(sagaConsistent) ON/OFF 유지.');
}

kit.MODES['exsagareadpub'] = exsagareadpub;
kit.ORDER.splice(1, 0, 'exsagareadpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
