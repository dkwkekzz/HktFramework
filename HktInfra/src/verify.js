// HktInfra step-0132 — 헤드리스 검증 (saga 포기 발행·abandonPublish — 0131 §9 "포기는 인지일 뿐" 해소)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaaband`.
//   더한 한 조각: 0131 은 상한 도달 give 를 조용히 포기했다(giveAbandoned 만 증가). 영구 미해결을 운영이 보려면 *발행*돼야 한다. _resendPending() 포기 분기에서 abandonPublish ON 이면 svc.exchange.saga_abandoned 를 버스로 1회 발행(audit 관측·발행 4종 0108/0111/0115/0123 + 이 5종째). OFF·bus 부재면 발행 0 = 0131 비트 동일.
//   검증: ⒜ `reg`(키트) — abandonPublish OFF 면 발행 0 = 0131 비트 동일. ⒝ `exsagaaband`(가설) — 영구 회신 손실+상한 ON. abandonPublish ON: abandonPublished 1 == giveAbandoned·audit svc.exchange.saga_abandoned 1·open==escrow 안전·sagaConsistent. OFF: published 0·audit 0(나머지 동일).
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
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // give seller→escrow(gid0)·회신 영구 손실
  { at: 78, op: { type: 'exchSweep', now: 78 } },   // 재전송 1
  { at: 82, op: { type: 'exchSweep', now: 82 } },   // 재전송 2
  { at: 86, op: { type: 'exchSweep', now: 86 } },   // 상한 도달 → 포기 → 발행(abandonPublish ON)
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' });
const CAP = 2;
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true,
  sagaMaxRetries: CAP, bus: true, audit: true,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagaaband(seeds) {
  console.log('== exsagaaband: *가설* — saga 포기 발행. 영구 회신 손실+상한 도달로 포기 시 svc.exchange.saga_abandoned 발행. ON: abandonPublished 1 == giveAbandoned·audit 관측 1·open==escrow 안전·sagaConsistent. OFF: 발행 0·audit 0(나머지 동일). ==');
  console.log('seed   | ON pub/abandoned | audit saw | ON open==escrow | OFF pub/audit | ON 안전·정합 | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { abandonPublish: true }) });
    const off = run({ ...P(seed, { abandonPublish: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen) && JSON.stringify(onOpen) === '["item0"]';
    const auditSaw = on.audit ? (on.audit.seen.get('svc.exchange.saga_abandoned') || 0) : 0;
    const offPub = off.exchange.abandonPublished, offAudit = off.audit ? (off.audit.seen.get('svc.exchange.saga_abandoned') || 0) : 0;
    const ok =
      check(on.exchange.abandonPublished === 1 && on.exchange.giveAbandoned === 1, `seed ${seed}: 발행 != 포기(pub ${on.exchange.abandonPublished}/abandoned ${on.exchange.giveAbandoned})`) &&
      check(auditSaw === 1, `seed ${seed}: audit 관측 ${auditSaw} != 1`) &&
      check(onSafe, `seed ${seed}: 발행이 안전 깸(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(offPub === 0 && offAudit === 0 && off.exchange.giveAbandoned === 1, `seed ${seed}: OFF 인데 발행/관측 발생(pub ${offPub}/audit ${offAudit})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.abandonPublished + '/' + on.exchange.giveAbandoned, 16)} | ${pad(auditSaw, 9)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(offPub + '/' + offAudit, 13)} | ${pad((onSafe && on.exchange.sagaConsistent()) ? '예' : '아니오', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 영구 미해결 give 가 *가시*해진다: 상한 포기(0131) 시 svc.exchange.saga_abandoned 를 버스로 1회 발행 → audit(임의 소비자)이 관측(abandonPublished 1 == giveAbandoned 1). 거래소 수명주기 발행 5종(sold 0108·cancelled 0111·expired 0115·aborted 0123·saga_abandoned 0132).');
  console.log('    발행은 포기 *사실 통보*일 뿐 보상 아님 — open==escrow 안전 유지(give 가 실제 성공했을 수 있어 abort 안 함). abandonPublish OFF·bus 부재면 발행 0 = 0131 비트 동일(reg). 회계 정합(sagaConsistent)은 ON/OFF 모두 유지.');
}

kit.MODES['exsagaaband'] = exsagaaband;
kit.ORDER.splice(1, 0, 'exsagaaband');

(async () => { process.exit(await kit.cli(process.argv)); })();
