// HktInfra step-0109 — 헤드리스 검증 (거래소 영속·failover·exchangePersist·op 저널 replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pexper`.
//   더한 한 조각: 0107~0108 거래소 원장은 휘발 — 박스 crash 시 매물·체결 회계 전부 소실. 0017 가방·0085 파티가 event sourcing 으로 푼 것을 거래소에 적용: list/buy/cancel 명령을 durable op 저널에 기록, crash 후 fresh 거래소가 저널 seq 순 replay 해 projection 재구성 → 죽기 전과 비트 동일(open 매물·listed/sold/cancelled/delivered/proceeds/returned 재현). rejects(실패 시도)는 비-durable.
//   검증: ⒜ `reg`(키트) — exchangePersist 미설정이면 저널 0·crash 후 빈 원장 = 0108 비트 동일. ⒝ `pexper`(가설) — 4 list·2 buy·1 cancel → crash → reconstruct. ON: 재구성 == 죽기 전(open 1·listed 4·sold 2·cancelled 1·proceeds s1 15·conserved). OFF: 재구성 후 빈 원장(소실·listed 0). minted 불변(비침습).
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
// 거래소 원장 다이제스트(crash 전후 비교 — durable 상태만: open 매물 + 회계).
const exDigest = ex => JSON.stringify({
  open: [...ex.listings.keys()].sort((a, b) => a - b),
  listed: ex.listed, sold: ex.sold, cancelled: ex.cancelled,
  deliv: [...ex.delivered.entries()].sort(), proc: [...ex.proceeds.entries()].sort(), ret: [...ex.returned.entries()].sort(),
});
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  exchange: true, exchangeOps: OPS,
  ...extra });

function pexper(seeds) {
  console.log('== pexper: *가설* — 거래소 영속·failover(exchangePersist). list/buy/cancel 을 durable op 저널에 기록·crash 후 replay 로 재구성 → 죽기 전과 비트 동일(0017 가방·0085 파티의 거래소 판). ON vs OFF ==');
  console.log('  4 list·2 buy·1 cancel → crash → reconstruct. ON: 재구성 == 죽기 전(open 1·listed 4·sold 2·cancelled 1·proceeds s1 15·conserved). OFF: 빈 원장(소실).');
  console.log('seed   | before(open/listed/sold/cancel) | journal | after ON | recon==before ON | after OFF(소실) | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { exchangePersist: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // 영속 OFF(0108 동작·휘발)
    const ex = on.exchange; const eo = off.exchange;
    const before = exDigest(ex); const jlen = ex.journal.length;
    ex.crash(); ex.reconstruct();                 // RAM 소실 → 저널 replay 로 재구성
    const after = exDigest(ex);
    const reconOk = after === before && ex.conserved() && ex.open() === 1 && ex.sold === 2 && ex.cancelled === 1 && ex.proceeds.get('s1') === 15;
    eo.crash(); eo.reconstruct();                 // 영속 OFF → 저널 0 → 빈 원장(소실)
    const lost = eo.listed === 0 && eo.sold === 0 && eo.open() === 0 && eo.journal.length === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(reconOk, `seed ${seed}: ON 재구성 != 죽기 전(before ${before}·after ${after}·conserved ${ex.conserved()})`) &&
      check(lost, `seed ${seed}: OFF 소실 미재현(listed ${eo.listed}·sold ${eo.sold}·open ${eo.open()}·journal ${eo.journal.length}·기대 0)`) &&
      check(nonInvasive, `seed ${seed}: 영속이 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    const bShort = `${ex.open()}/${ex.listed}/${ex.sold}/${ex.cancelled}`;
    console.log(`${pad(seed, 6)} | ${pad(bShort, 31)} | ${pad(jlen, 7)} | ${pad(`${ex.open()}/${ex.listed}/${ex.sold}/${ex.cancelled}`, 8)} | ${pad(reconOk + '', 16)} | ${pad(`${eo.open()}/${eo.listed}/${eo.sold}`, 14)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소가 *자기 op 저널만으로* crash 를 투명 복구한다: list/buy/cancel 이 durable 저널(체결 발행 0108 의 영속 짝), crash 후 fresh 박스가 seq 순 replay 해 projection 재구성 == 죽기 전(0017 가방·0085 파티 event sourcing 의 거래소 판). 매물·체결·escrow 보존이 죽음을 넘어 산다(데이터 계층6 의 게임 서비스 판).');
  console.log('    exchangePersist 미설정 = 저널 0·crash 후 빈 원장 = 0108 비트 동일(reg). 비-침습: 영속은 저널 기록일 뿐 세계/가방 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pexper'] = pexper;
kit.ORDER.splice(1, 0, 'pexper');

(async () => { process.exit(await kit.cli(process.argv)); })();
