// HktInfra step-0082 — 헤드리스 검증 (전달 실패 발행·svc.whisper.failed)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wfpublish`.
//   더한 한 조각: 0079 의 포기 통지는 *원 발신자*에게만 deliveryFailed 를 회신한다 — 운영/감사 평면은 전달 실패를 못 본다(0079 §9). 이 step 은 포기(undeliverable)를 svc.whisper.failed 토픽으로 발행해 audit(범용 sink·발행자 무수정 소비자)가 관측하게 한다. 0060 presencePublish 의 *전달 실패* 판 — point-to-point 통지(발신자 행동용)와 토픽 발행(관측/감사용)이 직교.
//   검증: ⒜ `reg`(키트) — failedPublish 미설정이면 0081 비트 동일(발행 0). ⒝ `wfpublish`(가설) — 'mbox' 가 전달을 *전부* 떨굼(deliverDrop 99·ack 0)→라우터 재시도 상한 도달→포기(undeliverable 1). ON(failedPublish): svc.whisper.failed 1건 발행·audit 관측 1·failedPublished 1·failedNotified 1. OFF: 발행 0·audit 미관측·failedNotified 1(통지는 불변). 둘 다 undeliverable 1. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 56; const DTIMEOUT = 4; const DMAX = 2; const DROPALL = 99;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  deliverTimeout: DTIMEOUT, deliverMaxRetries: DMAX, deliverNotify: true, deliverDrop: DROPALL,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wfpublish(seeds) {
  console.log('== wfpublish: *가설* — 전달 실패 발행. 라우터가 포기(undeliverable)할 때 svc.whisper.failed 토픽으로 발행 → audit(범용 sink)가 관측. point-to-point 통지(발신자)와 직교. failedPublish ON vs OFF ==');
  console.log(`  'mbox' 가 전달 전부 떨굼(deliverDrop ${DROPALL})→재시도 상한(${DMAX}) 도달→포기. ON: 발행 1·audit 관측 1·failedPublished 1. OFF: 발행 0·audit 0. 둘 다 undeliverable 1·failedNotified 1.`);
  console.log('seed   | undel ON | failedPub | audit관측 | notif | OFF audit관측 | OFF pub | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { failedPublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // failedPublish OFF — 포기는 발신자 통지만(0081 동작)·토픽 발행 0
    const wr = on.wrouter; const wo = off.wrouter;
    const auON  = on.audit ? (on.audit.seen.get('svc.whisper.failed') || 0) : -1;
    const auOFF = off.audit ? (off.audit.seen.get('svc.whisper.failed') || 0) : -1;
    // ① 발행+관측 — 포기 1건을 svc.whisper.failed 로 발행(failedPublished 1)·audit 가 구독해 관측 1·통지도 1(직교).
    const published = wr && wr.undeliverable === 1 && wr.failedPublished === 1 && auON === 1 && wr.failedNotified === 1;
    // ② 대조(OFF) — failedPublish 없으면 발행 0·audit 미관측: undeliverable 1·failedNotified 1(통지는 불변)·failedPublished 0.
    const silent = wo && wo.undeliverable === 1 && wo.failedPublished === 0 && auOFF === 0 && wo.failedNotified === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(published, `seed ${seed}: 발행/관측 틀림(undel ${wr && wr.undeliverable}·pub ${wr && wr.failedPublished}·audit ${auON}·notif ${wr && wr.failedNotified})`) &&
      check(silent, `seed ${seed}: OFF 발행 누설(undel ${wo && wo.undeliverable}·pub ${wo && wo.failedPublished}·audit ${auOFF})`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.undeliverable : 0, 8)} | ${pad(wr ? wr.failedPublished : 0, 9)} | ${pad(auON, 9)} | ${pad(wr ? wr.failedNotified : 0, 5)} | ${pad(auOFF, 13)} | ${pad(wo ? wo.failedPublished : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 포기(undeliverable)가 두 평면으로 갈라진다: 발신자 통지(deliveryFailed·point-to-point·행동용·0079)와 토픽 발행(svc.whisper.failed·관측/감사용·0082). audit 는 발행자(wrouter) 무수정으로 구독 행만 추가돼 실패 스트림을 본다(0060 presencePublish 의 전달 실패 판·SPINE 계층3).');
  console.log('    failedPublish 미설정 = 0081 비트 동일(발행 0·reg). 비-침습: 발행 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형·은닉(bus 만 알고 구독자 무지).');
}

kit.MODES['wfpublish'] = wfpublish;
kit.ORDER.splice(1, 0, 'wfpublish');

(async () => { process.exit(await kit.cli(process.argv)); })();
