// HktInfra step-0111 — 헤드리스 검증 (거래소 취소 발행·cancelPublish·svc.exchange.cancelled)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `excancel`.
//   더한 한 조각: 0108 은 체결(exchBuy)만 svc.exchange.sold 로 발행 — 매물 회수(exchCancel 성공)는 외부 관측 불가. 0097 반송 발행·0104 손실 발행의 매핑으로 취소 성립을 svc.exchange.cancelled{id,seller,item,price} 로 1회 발행(매물이 escrow→판매자로 돌아가는 순간·delisting 신호). 0016 발행자 무수정 소비자 패턴의 거래소 *취소* 판(0108 sold 의 대칭).
//   검증: ⒜ `reg`(키트) — cancelPublish OFF 면 발행 0 = 0110 비트 동일. ⒝ `excancel`(가설) — OPS 에 cancel 1개. ON: cancelPublished==cancelled(1)·audit 가 svc.exchange.cancelled 1 관측. OFF: 발행 0·audit 0. 둘 다 cancelled/conserved/minted 불변(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14;
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10 } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5 } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3 } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20 } },
  { at: 74, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },
  { at: 76, op: { type: 'exchCancel', seller: 's2', id: 3 } },
];
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangePublish: true, exchangeOps: OPS,
  ...extra });

function excancel(seeds) {
  console.log('== excancel: *가설* — 거래소 취소 발행(cancelPublish). exchCancel 성공 시 svc.exchange.cancelled 1회 발행(매물 escrow→판매자 회수·delisting 신호·0108 sold 의 대칭·0016 무수정 소비자 판). ON vs OFF ==');
  console.log('  OPS 에 cancel 1개(s2·id3). ON: cancelPublished==cancelled(1)·audit svc.exchange.cancelled 1. OFF: 발행 0·audit 0. 둘 다 cancelled/conserved/minted 불변(비침습).');
  console.log('seed   | cancelled | pub ON | audit ON | pub OFF | audit OFF | conserved | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { cancelPublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // cancelPublish 0(0110 발행 없음)
    const ex = on.exchange; const eo = off.exchange;
    const cancelled = ex.cancelled;
    const pubOn = ex.cancelPublished; const auOn = on.audit.seen.get('svc.exchange.cancelled') || 0;
    const pubOff = eo.cancelPublished; const auOff = off.audit.seen.get('svc.exchange.cancelled') || 0;
    const conserved = ex.conserved() && eo.conserved();
    const nonInvasive = on.inventory.minted === off.inventory.minted && ex.cancelled === eo.cancelled && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(cancelled === 1, `seed ${seed}: cancelled 기대 1·실제 ${cancelled}`) &&
      check(pubOn === cancelled && auOn === cancelled, `seed ${seed}: ON 발행/관측 != cancelled(pub ${pubOn}·audit ${auOn}·cancelled ${cancelled})`) &&
      check(pubOff === 0 && auOff === 0, `seed ${seed}: OFF 발행/관측 != 0(pub ${pubOff}·audit ${auOff})`) &&
      check(conserved, `seed ${seed}: 보존 위반(listed != open+sold+cancelled)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted}·cancelled ${ex.cancelled}/${eo.cancelled})`);
    console.log(`${pad(seed, 6)} | ${pad(cancelled, 9)} | ${pad(pubOn, 6)} | ${pad(auOn, 8)} | ${pad(pubOff, 7)} | ${pad(auOff, 9)} | ${pad(conserved + '', 9)} | ${pad(nonInvasive + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소 *취소*(매물 회수)가 svc.exchange.cancelled 로 외부 관측된다(0108 sold 발행의 대칭): escrow→판매자 반환이 성립하는 순간 버스로 1회, audit 등 무수정 소비자가 구독해 delisting 을 본다(거래량 피드는 sold+cancelled 양쪽 필요·매물 깊이 추적 씨앗). 0016 발행자 무수정 소비자 패턴.');
  console.log('    cancelPublish 0·bus 부재 = 발행 0 = 0110 비트 동일(reg). 비-침습: 발행은 관측 사본일 뿐 원장/세계 권위 불변(minted ON==OFF·cancelled 동일·conserved)·존 tick 밖 순수 반응형.');
}

kit.MODES['excancel'] = excancel;
kit.ORDER.splice(1, 0, 'excancel');

(async () => { process.exit(await kit.cli(process.argv)); })();
