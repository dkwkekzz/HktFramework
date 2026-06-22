// HktInfra step-0114 — 헤드리스 검증 (매물 만료 TTL·exchExpiry·시간 기반 escrow 자동 회수)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exexpire`.
//   더한 한 조각: 0107~0113 매물은 판매자 명시 취소로만 닫힘 — 안 팔리고 안 취소되면 영영 escrow 묶임(0111 §9). 매물에 listedAt(m.tick) 기록·exchSweep{now} op 가 now−listedAt ≥ ttl 인 open 매물을 자동 만료(escrow→판매자·취소와 같은 release 쌍이되 시간 트리거). 새 종결 상태 expired·보존식 확장(listed==open+sold+cancelled+expired)·durable 저널('expire')로 reconstruct 정합.
//   검증: ⒜ `reg`(키트) — ttl 0·exchSweep 없음 = 0113 비트 동일. ⒝ `exexpire`(가설) — list 4·buy id1·id2·cancel id3·sweep@80(now 80). ttl 5: id4(ring·@73·age 7) 만료→expired 1·open 0·conserved·crash→reconstruct==before. ttl 0(OFF): sweep no-op·open 1·expired 0. 둘 다 minted 불변.
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
const exDigest = ex => JSON.stringify({ open: [...ex.listings.keys()].sort((a, b) => a - b), listed: ex.listed, sold: ex.sold, cancelled: ex.cancelled, expired: ex.expired, ret: [...ex.returned.entries()].sort() });
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangePublish: true, cancelPublish: true, exchangePersist: true, exchangeOps: OPS,
  ...extra });

function exexpire(seeds) {
  console.log('== exexpire: *가설* — 매물 만료 TTL(exchExpiry). exchSweep{now} 가 now−listedAt ≥ ttl 인 open 매물을 자동 만료(escrow→판매자·시간 트리거 release 쌍). 새 종결 상태 expired·저널 정합. ON(ttl 5) vs OFF(ttl 0) ==');
  console.log(`  list 4·buy id1·id2·cancel id3·sweep@80. ttl ${TTL}: id4(ring@73·age 7) 만료. ON: expired 1·open 0·conserved·crash→reconstruct==before. OFF: sweep no-op·open 1·expired 0.`);
  console.log('seed   | open ON | expired ON | conserved ON | recon==before | open OFF | expired OFF | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { exchangeTtl: TTL }) });
    const off = run({ ...P_BASE(seed, { exchangeTtl: 0 }) });   // 만료 비활성(sweep no-op·0113 동일)
    const ex = on.exchange; const eo = off.exchange;
    const openOn = ex.open(); const expOn = ex.expired; const consOn = ex.conserved();
    const before = exDigest(ex);
    ex.crash(); ex.reconstruct();
    const reconOn = exDigest(ex) === before && ex.conserved();
    const openOff = eo.open(); const expOff = eo.expired; const consOff = eo.conserved();
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(openOn === 0 && expOn === 1, `seed ${seed}: ON 기대 open 0/expired 1·실제 ${openOn}/${expOn}`) &&
      check(consOn, `seed ${seed}: ON 보존 위반(listed != open+sold+cancelled+expired)`) &&
      check(reconOn, `seed ${seed}: ON reconstruct != 죽기 전(저널 expire 정합 실패·before ${before})`) &&
      check(openOff === 1 && expOff === 0 && consOff, `seed ${seed}: OFF 기대 open 1/expired 0/conserved·실제 ${openOff}/${expOff}/${consOff}`) &&
      check(mintedEq, `seed ${seed}: 만료가 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(openOn, 7)} | ${pad(expOn, 10)} | ${pad(consOn + '', 12)} | ${pad(reconOn + '', 13)} | ${pad(openOff, 8)} | ${pad(expOff, 11)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 매물이 *시간*으로 자동 회수된다(상용 경매장 만료): exchSweep 가 now−listedAt ≥ ttl 인 open 매물을 escrow→판매자 반환(취소와 같은 release 쌍이되 판매자 요청이 아닌 시간 트리거). 새 종결 상태 expired 가 보존식에 합류(listed==open+sold+cancelled+expired)·durable 저널(expire)로 crash→reconstruct 정합(0109/0110 영속·압축과 동작).');
  console.log('    ttl 0·exchSweep 없음 = sweep no-op·만료 0 = 0113 비트 동일(reg). 비-침습: 만료는 escrow 원장 내부 release 일 뿐 세계 가방(minted) 권위 불변·존 tick 밖 순수 반응형(sweep 도 주입 메시지).');
}

kit.MODES['exexpire'] = exexpire;
kit.ORDER.splice(1, 0, 'exexpire');

(async () => { process.exit(await kit.cli(process.argv)); })();
