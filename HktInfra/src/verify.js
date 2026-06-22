// HktInfra step-0112 — 헤드리스 검증 (거래소 시세 피드 읽기 모델·marketFeed·svc.exchange.sold+cancelled 구독)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `market`.
//   더한 한 조각: 거래소(0107~0111)는 escrow 원장 권위 + 체결(0108 sold)·취소(0111 cancelled) 발행. 이 step 은 그 두 토픽을 *소비만* 하는 MarketFeed(읽기 모델)를 더한다 — item별 {last 체결가, volume 거래량, cancelled 취소} 투영(0019 RankingService 의 거래소 판·CQRS). 원장 권위 0·발신 0(audit 처럼 관찰 전용·시세는 pull). sold ev 에 item 추가(시세 키).
//   검증: ⒜ `reg`(키트) — marketFeed OFF 면 박스 0·구독 0 = 0111 비트 동일. ⒝ `market`(가설) — OPS: list 4(sword10/shield5/potion3/ring20)·buy id1·id2·cancel id3. ON: priceOf(sword)=10/vol 1·priceOf(shield)=5/vol 1·cancelledOf(potion)=1·consumed 3(sold 2+cancel 1). OFF: market null. 둘 다 거래소 sold/cancelled·minted 불변(비-침습).
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
  exchange: true, exchangePublish: true, cancelPublish: true, exchangeOps: OPS,
  ...extra });

function market(seeds) {
  console.log('== market: *가설* — 거래소 시세 피드 읽기 모델(marketFeed). svc.exchange.sold+cancelled 구독→item별 {last 체결가·volume 거래량·cancelled}. 0019 RankingService 의 거래소 판(CQRS·원장 권위 0·발신 0·관찰 전용). ON vs OFF ==');
  console.log('  OPS: list 4(sword10/shield5/potion3/ring20)·buy id1(sword,b1)·id2(shield,b2)·cancel id3(potion). ON: price sword 10/vol 1·shield 5/vol 1·potion cancelled 1·consumed 3. OFF: market null. 둘 다 거래소/minted 불변.');
  console.log('seed   | consumed | sword@ | swordVol | shield@ | potionCancel | OFF null | sold ON==OFF | minted ON==OFF | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { marketFeed: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // marketFeed 0(박스 없음·0111 동일)
    const mk = on.market;
    const consumed = mk.consumed;
    const swordP = mk.priceOf('sword'); const swordV = mk.volumeOf('sword');
    const shieldP = mk.priceOf('shield'); const potionC = mk.cancelledOf('potion');
    const offNull = off.market == null;
    const soldEq = on.exchange.sold === off.exchange.sold && on.exchange.cancelled === off.exchange.cancelled;
    const mintedEq = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(consumed === 3, `seed ${seed}: consumed 기대 3·실제 ${consumed}`) &&
      check(swordP === 10 && swordV === 1, `seed ${seed}: sword 시세 기대 10/1·실제 ${swordP}/${swordV}`) &&
      check(shieldP === 5, `seed ${seed}: shield 시세 기대 5·실제 ${shieldP}`) &&
      check(potionC === 1, `seed ${seed}: potion cancelled 기대 1·실제 ${potionC}`) &&
      check(offNull, `seed ${seed}: OFF 에 market 박스 존재(기대 null)`) &&
      check(soldEq && mintedEq, `seed ${seed}: 피드가 거래소/세계 권위 바꿈(sold ${on.exchange.sold}/${off.exchange.sold}·minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(consumed, 8)} | ${pad(swordP, 6)} | ${pad(swordV, 8)} | ${pad(shieldP, 7)} | ${pad(potionC, 12)} | ${pad(offNull + '', 8)} | ${pad(soldEq + '', 12)} | ${pad(mintedEq + '', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소 발행 스트림(sold+cancelled)에서 item별 시세(체결가·거래량·취소)가 *파생 뷰*로 선다(0019 ranking CQRS 의 거래소 판): MarketFeed 는 두 토픽을 소비만 하고 원장 권위 0·발신 0(audit 처럼 관찰 전용·시세는 priceOf/volumeOf pull). 거래량 피드엔 sold+cancelled 양쪽이 필요(0111 의 동기).');
  console.log('    marketFeed 0·거래소 부재 = 박스 0·구독 0 = 0111 비트 동일(reg). 비-침습: 피드는 발행 사본의 파생일 뿐 거래소 원장(sold/cancelled)·세계 가방(minted) 권위 불변·존 tick 밖 순수 반응형.');
}

kit.MODES['market'] = market;
kit.ORDER.splice(1, 0, 'market');

(async () => { process.exit(await kit.cli(process.argv)); })();
