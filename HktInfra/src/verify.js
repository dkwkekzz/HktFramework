// HktInfra step-0113 — 헤드리스 검증 (시세 피드 영속·late-join·marketReconstruct·거래소 op 저널 replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mktpersist`.
//   더한 한 조각: 0112 MarketFeed 는 자기 영속 0 — crash 시 시세 소실. 0020 읽기 모델이 쓰기 모델 저널을 replay 했듯, MarketFeed 가 *거래소 durable op 저널*(0109)을 replay 해 시세 재계산(list→id별 item·buy→last/volume·cancel→cancelled). 시세 피드는 자기 영속 0 이어도 거래소 저널이 권위 사본이라 완전 복원(다운타임 누락 따라잡음·CQRS).
//   검증: ⒜ `reg`(키트) — 코드 변경은 MarketFeed 에 reconstruct 메서드 추가뿐(marketFeed OFF 면 박스 0) = 0112 비트 동일. ⒝ `mktpersist`(가설) — ON: crash→reconstruct(거래소 저널)==죽기 전==라이브. OFF: crash 만→빈 투영(소실). 둘 다 거래소 sold/minted 불변(비-침습).
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
const mktDigest = mk => JSON.stringify([...mk.market.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangePublish: true, cancelPublish: true, exchangePersist: true, marketFeed: true, exchangeOps: OPS,
  ...extra });

function mktpersist(seeds) {
  console.log('== mktpersist: *가설* — 시세 피드 영속·late-join(marketReconstruct). 시세 피드는 자기 영속 0 이어도 *거래소 durable op 저널*(0109) replay 로 시세 완전 복원(0020 읽기 모델의 거래소 판·CQRS). ON(crash→reconstruct) vs OFF(crash 만) ==');
  console.log('  OPS: list 4·buy id1·id2·cancel id3. ON: reconstruct(거래소 저널)==죽기 전==라이브. OFF: crash 만→빈 투영(소실). 둘 다 거래소 sold/minted 불변.');
  console.log('seed   | 저널 op | 라이브 다이제스트 | recon==before ON | empty OFF | sold ON==OFF | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const r = run({ ...P_BASE(seed, {}) });
    const mk = r.market;
    const before = mktDigest(mk); const jlen = r.exchange.journal.length;
    // ON: crash→reconstruct(거래소 저널)
    mk.crash(); mk.reconstruct(r.exchange.journal);
    const reconOn = mktDigest(mk) === before && mk.market.size > 0;
    // OFF: crash 만(복원 안 함) — 빈 투영
    const off = run({ ...P_BASE(seed, {}) }); off.market.crash();
    const emptyOff = off.market.market.size === 0;
    const nonInvasive = r.exchange.sold === off.exchange.sold && r.inventory.minted === off.inventory.minted && ledgerConsistent(r) && itemConserved(r);
    const ok =
      check(reconOn, `seed ${seed}: ON reconstruct != 죽기 전(before ${before})`) &&
      check(emptyOff, `seed ${seed}: OFF crash 후 비어있지 않음(size ${off.market.market.size})`) &&
      check(nonInvasive, `seed ${seed}: 복원이 거래소/세계 권위 바꿈(sold ${r.exchange.sold}/${off.exchange.sold}·minted ${r.inventory.minted}/${off.inventory.minted})`);
    const liveD = `sword@${r.market.priceOf('sword')}/v${r.market.volumeOf('sword')}·shield@${r.market.priceOf('shield')}`;
    console.log(`${pad(seed, 6)} | ${pad(jlen, 7)} | ${pad(liveD, 17)} | ${pad(reconOn + '', 16)} | ${pad(emptyOff + '', 9)} | ${pad((r.exchange.sold === off.exchange.sold) + '', 12)} | ${pad((r.inventory.minted === off.inventory.minted) + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 시세 피드가 *자기 영속 0* 이어도 거래소 op 저널(권위 사본) replay 로 완전 복원된다(0020 읽기 모델의 거래소 판): list→id별 item·buy→last/volume·cancel→cancelled = 라이브 sold/cancelled 소비와 동일 매핑. 다운타임에 버스가 흘려보낸 발행을 놓쳐도 거래소가 영속한 op 로 따라잡음(CQRS read model 의 핵심).');
  console.log('    reconstruct 메서드 추가뿐(marketFeed OFF 면 박스 0) = 0112 비트 동일(reg). 비-침습: 복원은 시세 투영 재계산일 뿐 거래소 원장(sold)·세계 가방(minted) 권위 불변. ※ 저널 스냅샷 압축(0110) 시 가지친 head 의 volume 이력은 복원 불가(스냅샷에 시세 카운터 없음·snapInterval 0 전제·§9).');
}

kit.MODES['mktpersist'] = mktpersist;
kit.ORDER.splice(1, 0, 'mktpersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
