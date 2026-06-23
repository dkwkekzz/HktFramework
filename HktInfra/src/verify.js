// HktInfra step-0138 — 헤드리스 검증 (saga 영구 실패 발행·failPublish — saga liveness 수명주기 발행 완비: 포기·재개·종결)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagafailpub`.
//   더한 한 조각: 0137 영구 실패(permFailed)는 조용히 종결됐다. 종결도 발행돼야 운영이 "이 give 는 영영 못 살린다"를 안다. _resendPending 영구 실패 분기에서 failPublish ON 이면 svc.exchange.saga_failed 를 1회 발행(failPublished==permFailed)·audit 구독 관측. 이제 saga liveness 발행이 포기(saga_abandoned 0132·복구 가능)·재개(saga_readmitted 0135)·종결(saga_failed 0138·복구 불가)로 완비.
//   검증: ⒜ `reg`(키트) — failPublish OFF 면 발행 0 = 0137 비트 동일. ⒝ `exsagafailpub`(가설) — 영구 손실+readmit 3회로 영구 실패 유도(readmitMax=2). ON: failPublished 1==permFailed·audit svc.exchange.saga_failed 1·pending 1·open==escrow·sagaConsistent. OFF: 발행 0·audit 0(종결 자체 permFailed 1 동일).
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
const READMIT = (at) => ({ at, op: { type: 'exchReadmit' } });
const SW = (at) => ({ at, op: { type: 'exchSweep', now: at } });
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  SW(72), SW(74), READMIT(75),   // cycle1: abandon(1)→readmit(count 1)
  SW(76), SW(78), READMIT(79),   // cycle2: abandon(2)→readmit(count 2)
  SW(80), SW(82),                // cycle3: abandon(3) — readmitCount 2>=readmitMax 2 → 영구 실패(발행)
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' });   // 영구 손실
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: 1, readmitMax: 2,
  bus: true, audit: true, transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagafailpub(seeds) {
  console.log('== exsagafailpub: *가설* — saga 영구 실패 발행. 영구 손실+readmit 으로 영구 실패 유도. ON: failPublished 1==permFailed·audit svc.exchange.saga_failed 1·pending 1·open==escrow·sagaConsistent. OFF: 발행 0·audit 0(종결 자체는 동일). saga liveness 발행 완비(포기 0132·재개 0135·종결 0138). ==');
  console.log('seed   | ON pub/permFailed | audit saw | ON pending/open==escrow | OFF pub/audit | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { failPublish: true }) });
    const off = run({ ...P(seed, { failPublish: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const auditSaw = on.audit ? (on.audit.seen.get('svc.exchange.saga_failed') || 0) : 0;
    const offPub = off.exchange.failPublished, offAudit = off.audit ? (off.audit.seen.get('svc.exchange.saga_failed') || 0) : 0;
    const ok =
      check(on.exchange.failPublished === 1 && on.exchange.permFailed === 1, `seed ${seed}: 발행 != 영구실패(pub ${on.exchange.failPublished}/permFailed ${on.exchange.permFailed})`) &&
      check(auditSaw === 1, `seed ${seed}: audit 관측 ${auditSaw} != 1`) &&
      check(on.exchange.pendingGives() === 1 && onSafe, `seed ${seed}: 종결 후 상태 위반(pending ${on.exchange.pendingGives()}·open ${JSON.stringify(onOpen)})`) &&
      check(offPub === 0 && offAudit === 0 && off.exchange.permFailed === 1, `seed ${seed}: OFF 인데 발행/관측(pub ${offPub}/audit ${offAudit}/permFailed ${off.exchange.permFailed})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.failPublished + '/' + on.exchange.permFailed, 17)} | ${pad(auditSaw, 9)} | ${pad(on.exchange.pendingGives() + '/' + (onSafe ? '예' : '아니오'), 23)} | ${pad(offPub + '/' + offAudit, 13)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → saga liveness 수명주기 발행이 *완비*된다: 포기(svc.exchange.saga_abandoned·0132·복구 가능)·재개(svc.exchange.saga_readmitted·0135)·종결(svc.exchange.saga_failed·이 step·복구 불가)을 모두 audit 가 구독 → 운영이 saga 의 전 생애를 본다. failPublished 1 == permFailed 1.');
  console.log('    종결 발행은 통보일 뿐 — 영구 실패 give 는 여전히 pending 에 남아(미해결·sagaConsistent) open==escrow 안전(종결도 abort 아님·give 가 실제 성공했을 수 있어). failPublish OFF·bus 부재면 발행 0 = 0137 비트 동일(reg).');
}

kit.MODES['exsagafailpub'] = exsagafailpub;
kit.ORDER.splice(1, 0, 'exsagafailpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
