// HktInfra step-0110 — 헤드리스 검증 (거래소 저널 스냅샷 압축·exchangeSnapshot·snapshot+tail replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pexsnap`.
//   더한 한 조각: 0109 의 op 저널은 무계 성장 — replay 비용·메모리 ∝op 수(0109 §9). 0018 가방·0086 파티의 *주기 스냅샷+tail replay* 압축을 거래소에 적용: snapInterval 개 op 마다 projection 스냅샷(upToSeq)+그 이하 저널 가지치기 → 저널 tail 만 유계. reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축).
//   검증: ⒜ `reg`(키트) — snapInterval 0 이면 압축 0·저널 무계 = 0109 비트 동일. ⒝ `pexsnap`(가설) — 7 op·snapInterval 3. ON: 저널 tail ≤2(스냅샷 upToSeq 6)·crash→reconstruct == 죽기 전. OFF(0109·snap 0): 저널 7·reconstruct == 죽기 전. 둘 다 무손실·minted 불변.
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
const SNAP = 3;   // snapInterval — 3 op 마다 스냅샷
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
  exchange: true, exchangePersist: true, exchangeOps: OPS,
  ...extra });

function pexsnap(seeds) {
  console.log('== pexsnap: *가설* — 거래소 저널 스냅샷 압축(exchangeSnapshot). snapInterval 개 op 마다 projection 스냅샷+저널 가지치기 → 저널 tail 유계, reconstruct=스냅샷+tail==전체 저널(무손실·0018/0086 의 거래소 판). ON vs OFF ==');
  console.log(`  7 op·snapInterval ${SNAP}. ON: 저널 tail ≤${SNAP - 1}·crash→reconstruct==죽기 전. OFF(0109·snap 0): 저널 7·reconstruct==죽기 전. 둘 다 무손실.`);
  console.log('seed   | tail ON | snap upToSeq | recon==before ON | tail OFF | recon==before OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { exchangeSnapshot: SNAP }) });
    const off = run({ ...P_BASE(seed, {}) });   // snap 0(0109 무계 저널)
    const ex = on.exchange; const eo = off.exchange;
    const beforeOn = exDigest(ex); const tailOn = ex.journal.length; const upTo = ex.snapshot ? ex.snapshot.upToSeq : -1;
    ex.crash(); ex.reconstruct();
    const reconOn = exDigest(ex) === beforeOn && ex.conserved() && ex.open() === 1 && ex.sold === 2;
    const beforeOff = exDigest(eo); const tailOff = eo.journal.length;
    eo.crash(); eo.reconstruct();
    const reconOff = exDigest(eo) === beforeOff && eo.conserved();
    // 압축: ON 저널 tail < OFF 전체 저널(유계)·스냅샷 존재.
    const compressed = ex.snapshot != null && tailOn < tailOff && tailOn < SNAP;
    const nonInvasive = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && itemConserved(on);
    const ok =
      check(reconOn, `seed ${seed}: ON 스냅샷+tail recon != 죽기 전(before ${beforeOn})`) &&
      check(reconOff, `seed ${seed}: OFF 전체저널 recon != 죽기 전`) &&
      check(compressed, `seed ${seed}: 압축 미성립(snapshot ${ex.snapshot != null}·tailON ${tailOn}·tailOFF ${tailOff}·기대 tailON<${Math.min(tailOff, SNAP)})`) &&
      check(nonInvasive, `seed ${seed}: 압축이 세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(tailOn, 7)} | ${pad(upTo, 12)} | ${pad(reconOn + '', 16)} | ${pad(tailOff, 8)} | ${pad(reconOff + '', 17)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소 저널이 *스냅샷+tail* 로 유계화된다(0018 가방·0022 채팅·0086 파티의 거래소 판): snapInterval 마다 projection 을 스냅샷·이하 저널 가지치기, reconstruct 는 스냅샷에서 출발해 tail 만 replay → 전체 저널과 비트 동일(무손실 압축). 영속 비용이 op 누적과 무관하게 유계 — 거래소 arc(분리 0107→발행 0108→영속 0109→압축 0110) 완성.');
  console.log('    exchangeSnapshot 0 = 압축 0·저널 무계 = 0109 비트 동일(reg). 비-침습: 압축은 저널 표현 유계화일 뿐 원장/세계 권위 불변(minted ON==OFF·reconstruct 무손실)·존 tick 밖 순수 반응형.');
}

kit.MODES['pexsnap'] = pexsnap;
kit.ORDER.splice(1, 0, 'pexsnap');

(async () => { process.exit(await kit.cli(process.argv)); })();
