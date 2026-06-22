// HktInfra step-0115 — 헤드리스 검증 (매물 만료 발행·expirePublish·svc.exchange.expired)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exexppub`.
//   더한 한 조각: 0114 만료(시간 트리거 회수)는 거래소 내부 expired 회계로만 굴러 외부 관측 불가(0114 §9). 0108 sold·0111 cancelled 발행과 같은 매핑으로 만료 성립을 svc.exchange.expired{id,seller,item,price} 로 1회 발행 — 무수정 소비자(audit·시세)가 만료 관측. 0016 발행자 무수정 소비자 패턴의 거래소 *만료* 판(0111 cancelled 의 시간 트리거 형제).
//   검증: ⒜ `reg`(키트) — expirePublish OFF·bus 부재 = 발행 0 = 0114 비트 동일. ⒝ `exexppub`(가설) — sweep@80 으로 id4 만료. ON: expirePublished==expired(1)·audit svc.exchange.expired 1. OFF: 발행 0·audit 0. 둘 다 expired/conserved/minted 불변(비-침습).
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
  { at: 80, op: { type: 'exchSweep', now: 80 } },
];
const TTL = 5;   // id4(ring·listedAt 73·sweep now 80·age 7) ≥ ttl → 만료
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangePublish: true, cancelPublish: true, exchangePersist: true, exchangeTtl: TTL, exchangeOps: OPS,
  ...extra });

function exexppub(seeds) {
  console.log('== exexppub: *가설* — 매물 만료 발행(expirePublish). sweep 만료 시 svc.exchange.expired 1회 발행(시간 트리거 escrow→판매자 회수·0108 sold·0111 cancelled 의 만료 형제·0016 무수정 소비자). ON vs OFF ==');
  console.log(`  sweep@80 으로 id4(ring·age 7≥ttl ${TTL}) 만료. ON: expirePublished==expired(1)·audit svc.exchange.expired 1. OFF: 발행 0·audit 0. 둘 다 expired/conserved/minted 불변.`);
  console.log('seed   | expired | pub ON | audit ON | pub OFF | audit OFF | conserved | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { expirePublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // expirePublish 0(0114 발행 없음)
    const ex = on.exchange; const eo = off.exchange;
    const expired = ex.expired;
    const pubOn = ex.expirePublished; const auOn = on.audit.seen.get('svc.exchange.expired') || 0;
    const pubOff = eo.expirePublished; const auOff = off.audit.seen.get('svc.exchange.expired') || 0;
    const conserved = ex.conserved() && eo.conserved();
    const nonInvasive = on.inventory.minted === off.inventory.minted && ex.expired === eo.expired && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(expired === 1, `seed ${seed}: expired 기대 1·실제 ${expired}`) &&
      check(pubOn === expired && auOn === expired, `seed ${seed}: ON 발행/관측 != expired(pub ${pubOn}·audit ${auOn}·expired ${expired})`) &&
      check(pubOff === 0 && auOff === 0, `seed ${seed}: OFF 발행/관측 != 0(pub ${pubOff}·audit ${auOff})`) &&
      check(conserved, `seed ${seed}: 보존 위반(listed != open+sold+cancelled+expired)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted}·expired ${ex.expired}/${eo.expired})`);
    console.log(`${pad(seed, 6)} | ${pad(expired, 7)} | ${pad(pubOn, 6)} | ${pad(auOn, 8)} | ${pad(pubOff, 7)} | ${pad(auOff, 9)} | ${pad(conserved + '', 9)} | ${pad(nonInvasive + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 매물 *만료*(시간 트리거 회수)가 svc.exchange.expired 로 외부 관측된다(0108 sold·0111 cancelled 의 만료 형제): sweep 가 escrow→판매자 반환을 성립시키는 순간 버스로 1회, audit·시세 등 무수정 소비자가 만료를 본다(시세 회전/깊이 추적). 0016 발행자 무수정 소비자 패턴 — 거래소 수명주기 발행 3종(체결·취소·만료) 완비.');
  console.log('    expirePublish 0·bus 부재 = 발행 0 = 0114 비트 동일(reg). 비-침습: 발행은 관측 사본일 뿐 거래소 원장(expired/returned)·세계 가방(minted) 권위 불변·존 tick 밖 순수 반응형.');
}

kit.MODES['exexppub'] = exexppub;
kit.ORDER.splice(1, 0, 'exexppub');

(async () => { process.exit(await kit.cli(process.argv)); })();
