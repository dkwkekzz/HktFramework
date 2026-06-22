// HktInfra step-0078 — 헤드리스 검증 (전달 재시도 상한·deliverMaxRetries)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wcap`.
//   더한 한 조각: 0077 의 재시도는 *무상한*이라 수신측이 영영 죽으면 inflight·재발신이 무한 누적된다(0077 §9). 이 step 은 재시도를 유계화한다 — inflight 마다 tries 를 세고, deliverMaxRetries 회 재발신해도 ack 없으면 영구 전달불가로 단정해 포기(undeliverable++·inflight 제거). 0059 recoverMaxRetries(치유 포기)의 *전달* 판.
//   검증: ⒜ `reg`(키트) — deliverMaxRetries 미설정이면 0077 비트 동일(무상한·포기 0). ⒝ `wcap`(가설) — 'mbox' 가 모든 전달을 떨굼(dropDeliver 99·영영 ack 0). ON(deliverMaxRetries 3): deliverRetries 3 후 포기→undeliverable 1·inflight 0. OFF(상한 0): 무상한 재발신(deliverRetries 다수)·inflight 1(영영 갇힘)·undeliverable 0. 둘 다 delivered 0. minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 40; const DROP = 99; const DTIMEOUT = 4; const CAP = 3;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  deliverDrop: DROP, deliverTimeout: DTIMEOUT,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wcap(seeds) {
  console.log('== wcap: *가설* — 무한 재시도를 유계 재시도+명시적 포기로. 수신측이 영영 죽어 ack 가 영영 없을 때, deliverMaxRetries 회 후 영구 전달불가로 포기(undeliverable). deliverMaxRetries 상한 ON vs OFF(무상한) ==');
  console.log(`  'mbox' 가 모든 전달 떨굼(dropDeliver ${DROP})·귓속말@${WHISPER_AT}·timeout ${DTIMEOUT}. ON(상한 ${CAP}): deliverRetries ${CAP}→undeliverable 1·inflight 0. OFF(상한 0): 무상한→inflight 1(갇힘)·undeliverable 0. 둘 다 delivered 0.`);
  console.log('seed   | deliverRetries | undeliverable | inflight | delivered | OFF retr/infl/undel | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverMaxRetries: CAP }) });
    const off = run({ ...P_BASE(seed, {}) });   // deliverMaxRetries 0 — 무상한 재시도(0077 동작·inflight 영영 갇힘)
    const wr = on.wrouter; const wo = off.wrouter;
    // ① 유계 재시도+포기 — deliverRetries 정확히 CAP·undeliverable 1·inflight 0·delivered 0(ack 영영 없음).
    const capped = wr && wr.deliverRetries === CAP && wr.undeliverable === 1 && wr.inflight.size === 0 && wr.delivered === 0;
    // ② 대조(OFF·무상한) — undeliverable 0·inflight 1(영영 갇힘)·deliverRetries > CAP(상한 없이 계속).
    const unbounded = wo && wo.undeliverable === 0 && wo.inflight.size === 1 && wo.deliverRetries > CAP && wo.delivered === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(capped, `seed ${seed}: 유계 포기 틀림(retries ${wr && wr.deliverRetries}·undel ${wr && wr.undeliverable}·inflight ${wr && wr.inflight.size}·delivered ${wr && wr.delivered})`) &&
      check(unbounded, `seed ${seed}: OFF 무상한 미재현(undel ${wo && wo.undeliverable}·inflight ${wo && wo.inflight.size}·retries ${wo && wo.deliverRetries})`) &&
      check(nonInvasive, `seed ${seed}: 상한이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.deliverRetries : 0, 14)} | ${pad(wr ? wr.undeliverable : 0, 13)} | ${pad(wr ? wr.inflight.size : 0, 8)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad((wo ? wo.deliverRetries : 0) + '/' + (wo ? wo.inflight.size : 0) + '/' + (wo ? wo.undeliverable : 0), 19)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → at-least-once 의 *무한* 재시도가 *유계 재시도+명시적 포기*(undeliverable)로 승격. 수신측 영영-죽음에도 inflight·재발신이 유한하게 멈춘다(0059 recoverMaxRetries 의 전달 판·SPINE 계층3). 포기 신호는 후속(발신자 통지·undeliverable 발행).');
  console.log('    deliverMaxRetries 미설정 = 0077 비트 동일(무상한·포기 0·reg). OFF 면 inflight 영영 갇힘. 비-침습: 상한 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 제어 평면.');
}

kit.MODES['wcap'] = wcap;
kit.ORDER.splice(1, 0, 'wcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
