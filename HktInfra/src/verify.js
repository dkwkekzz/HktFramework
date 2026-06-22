// HktInfra step-0108 — 헤드리스 검증 (거래소 체결 발행·exchangePublish·거래 수명주기 관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pexpub`.
//   더한 한 조각: 0107 거래소는 체결을 내부 카운터(sold)로만 굴린다 — 외부 관측 불가. 0087/0103 이 수명주기를 발행했듯, 이 step 은 체결(exchBuy 성공)을 svc.exchange.sold{id,buyer,seller,price} 로 발행·audit 무수정 구독 관측(거래량/시세 피드 씨앗·0016 패턴의 거래소 판).
//   검증: ⒜ `reg`(키트) — exchangePublish 미설정이면 발행 0 = 0107 비트 동일(exchange OFF 면 박스 0 = 0106 동일). ⒝ `pexpub`(가설) — 4 list·2 buy·1 cancel. ON(publish): published 2·audit svc.exchange.sold 2. OFF: 0/0. 둘 다 sold 2·conserved·minted 동일(비침습).
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
const auditCount = (r, topic) => (r.audit && r.audit.seen.get(topic)) || 0;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangeOps: OPS,
  ...extra });

function pexpub(seeds) {
  console.log('== pexpub: *가설* — 거래소 체결 발행(exchangePublish). exchBuy 성공을 svc.exchange.sold 로 발행 → audit 관측(거래량/시세 피드 씨앗·0016 패턴의 거래소 판). ON vs OFF ==');
  console.log('  4 list·2 buy·1 cancel. ON: published 2·audit svc.exchange.sold 2. OFF: 0/0. 둘 다 sold 2·conserved.');
  console.log('seed   | sold | published ON | audit ON | published OFF | audit OFF | conserved | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { exchangePublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // 발행 OFF(0107 동작)
    const ex = on.exchange; const eo = off.exchange;
    const aOn = auditCount(on, 'svc.exchange.sold'); const aOff = auditCount(off, 'svc.exchange.sold');
    // ① ON 발행 — published 2·audit 2·sold 2·conserved(체결은 양쪽 동일·관측만 추가).
    const published = ex && ex.sold === 2 && ex.published === 2 && aOn === 2 && ex.conserved();
    // ② OFF 대조 — 발행 0·audit 0·sold 2(체결 동일).
    const silent = eo && eo.sold === 2 && eo.published === 0 && aOff === 0 && eo.conserved();
    const nonInvasive = on.inventory.minted === off.inventory.minted && ex.sold === eo.sold && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(published, `seed ${seed}: ON 발행 틀림(sold ${ex && ex.sold}·published ${ex && ex.published}·audit ${aOn}·conserved ${ex && ex.conserved()}·기대 2/2/2/true)`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(published ${eo && eo.published}·audit ${aOff}·sold ${eo && eo.sold}·기대 0/0/2)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 체결/원장 권위 바꿈(sold ${ex.sold}/${eo.sold}·minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(ex ? ex.sold : 0, 4)} | ${pad(ex ? ex.published : 0, 12)} | ${pad(aOn, 8)} | ${pad(eo ? eo.published : 0, 13)} | ${pad(aOff, 9)} | ${pad(ex ? ex.conserved() + '' : '-', 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소도 *발신 0* audit 가 무수정 구독해 거래 수명주기를 관측한다(svc.exchange.sold) — 0016 발행자 무수정 소비자 패턴이 거래소에도 적용. 체결 회계(sold)는 거래소 권위, 발행은 그 사실의 관측 사본(거래량/시세 피드·랭킹의 씨앗·CQRS 0019 의 거래소 판).');
  console.log('    exchangePublish 미설정 = 발행 0·구독 행 0 = 0107 비트 동일(reg). 비-침습: 발행은 체결 사실의 관측일 뿐 체결/원장 권위 불변(sold·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pexpub'] = pexpub;
kit.ORDER.splice(1, 0, 'pexpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
