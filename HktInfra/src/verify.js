// HktInfra step-0116 — 헤드리스 검증 (시세 피드 만료 반영·svc.exchange.expired 구독)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmktexp`.
//   더한 한 조각: 0112 MarketFeed 는 체결·취소만 소비 — 0115 가 발행하는 만료(svc.exchange.expired)는 시세에 반영 안 됨(0115 §9). 셋째 토픽을 구독해 item별 expired 회전 누적 → 거래소 수명주기 3종(체결·취소·만료)이 모두 시세에 흐른다. reconstruct(0113)도 'expire' op 를 expired++ 로 처리(라이브 소비와 정합).
//   검증: ⒜ `reg`(키트) — marketFeed OFF 면 박스 0 = 0115 비트 동일. ⒝ `exmktexp`(가설) — sweep@80 으로 ring 만료. ON: expiredOf(ring)=1·consumed 3(sold2+expire1)·reconstruct(거래소 저널)==라이브. cancel 없는 OPS 라 cancelledOf 0. 둘 다 거래소 sold/minted 불변.
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
  { at: 80, op: { type: 'exchSweep', now: 80 } },   // potion(id3·@72)·ring(id4·@73) 둘 다 age ≥ ttl → 만료
];
const TTL = 5;
const mktDigest = mk => JSON.stringify([...mk.market.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangePublish: true, cancelPublish: true, expirePublish: true, exchangePersist: true, exchangeTtl: TTL, marketFeed: true, exchangeOps: OPS,
  ...extra });

function exmktexp(seeds) {
  console.log('== exmktexp: *가설* — 시세 피드 만료 반영(svc.exchange.expired 구독). 0112 체결·취소에 만료(0115)를 더해 거래소 수명주기 3종이 모두 시세에 흐른다. reconstruct 도 expire op 를 expired++ 로 정합. ON ==');
  console.log(`  sweep@80 으로 potion(id3)·ring(id4) 만료. ON: expiredOf(ring)=1·expiredOf(potion)=1·consumed 4(sold2+expire2)·reconstruct(거래소 저널)==라이브. 둘 다 거래소/minted 불변.`);
  console.log('seed   | consumed | ring exp | potion exp | sword vol | recon==live | expired 합 | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, {}) });
    const off = run({ ...P_BASE(seed, { marketFeed: false, expirePublish: false }) });   // 시세 피드 없음(0115 동일)
    const mk = on.market;
    const consumed = mk.consumed;
    const ringExp = mk.expiredOf('ring'); const potExp = mk.expiredOf('potion'); const swordVol = mk.volumeOf('sword');
    const live = mktDigest(mk);
    const fresh = new (NET.MarketFeed)({ bus: 'bus' }); fresh.reconstruct(on.exchange.journal);
    const reconEq = mktDigest(fresh) === live;
    const expSum = on.exchange.expired;
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(consumed === 4, `seed ${seed}: consumed 기대 4(sold2+expire2)·실제 ${consumed}`) &&
      check(ringExp === 1 && potExp === 1, `seed ${seed}: 만료 반영 기대 ring1/potion1·실제 ${ringExp}/${potExp}`) &&
      check(reconEq, `seed ${seed}: reconstruct(저널) != 라이브(live ${live})`) &&
      check(expSum === 2, `seed ${seed}: 거래소 expired 기대 2·실제 ${expSum}`) &&
      check(mintedEq, `seed ${seed}: 시세 반영이 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(consumed, 8)} | ${pad(ringExp, 8)} | ${pad(potExp, 10)} | ${pad(swordVol, 9)} | ${pad(reconEq + '', 11)} | ${pad(expSum, 10)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소 수명주기 3종(체결 0108·취소 0111·만료 0115)이 모두 시세 피드에 흐른다 — MarketFeed 가 svc.exchange.expired 를 구독해 item별 만료 회전을 누적(매물 깊이/회전 추적 완성). reconstruct 도 거래소 op 저널의 expire 를 expired++ 로 처리해 라이브와 비트 동일(CQRS read model 은 전 수명주기 발행을 전제).');
  console.log('    marketFeed OFF·만료 미발행 = 시세 박스 0·expired 0 = 0115 비트 동일(reg). 비-침습: 시세 반영은 발행 사본의 파생일 뿐 거래소 원장(sold/expired)·세계 가방(minted) 권위 불변·존 tick 밖 순수 반응형.');
}

kit.MODES['exmktexp'] = exmktexp;
kit.ORDER.splice(1, 0, 'exmktexp');

(async () => { process.exit(await kit.cli(process.argv)); })();
