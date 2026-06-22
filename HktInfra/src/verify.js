// HktInfra step-0087 — 헤드리스 검증 (전달 수명주기 관측·svc.whisper.delivered)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wdpublish`.
//   더한 한 조각: 0082 는 전달 *실패*(포기)만 svc.whisper.failed 로 발행 → 운영 평면이 보는 전달 스트림이 실패 절반뿐(성공·비용 관측 불가·0082 §9). 이 step 은 전달 *성공*도 발행해 수명주기를 완성: whisperAck 확인 시 svc.whisper.delivered{to, seq, tries} 발행(tries=확인까지 재발신=전달 비용) → audit 가 성공·실패 둘 다 구독(0082 failed + 0087 delivered = 전달 수명주기 전체).
//   검증: ⒜ `reg`(키트) — deliveredPublish 미설정이면 0086 비트 동일(발행 0). ⒝ `wdpublish`(가설) — 'mbox' 가 첫 전달 1개 떨굼(dropDeliver 1)→재시도 후 성공(tries 1). ON(deliveredPublish): svc.whisper.delivered 발행 1·audit 관측 1·deliveredPublished 1·ev.tries 1. OFF: 발행 0·audit 0. 둘 다 delivered 1. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 56; const DTIMEOUT = 4; const DROP1 = 1;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  deliverTimeout: DTIMEOUT, deliverDrop: DROP1,   // 첫 전달 1개 떨굼 → 재시도 후 성공(tries 1)
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wdpublish(seeds) {
  console.log('== wdpublish: *가설* — 전달 수명주기 관측. 전달 *성공*을 svc.whisper.delivered{to,seq,tries} 로 발행 → audit 가 성공·실패(0082) 둘 다 구독해 수명주기 전체를 본다. deliveredPublish ON vs OFF ==');
  console.log(`  'mbox' 가 첫 전달 1개 떨굼(dropDeliver ${DROP1})→재시도 후 성공. ON: 발행 1·audit 관측 1·deliveredPublished 1·ev.tries 1(전달 비용). OFF: 발행 0·audit 0. 둘 다 delivered 1.`);
  console.log('seed   | delivered | deliveredPub | audit관측 | ev.tries | OFF audit | OFF pub | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliveredPublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // deliveredPublish OFF — 성공 발행 0(0086 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const recs = on.audit ? on.audit.records.filter(r => r.startsWith('svc.whisper.delivered|')) : [];
    const auON  = on.audit ? (on.audit.seen.get('svc.whisper.delivered') || 0) : -1;
    const auOFF = off.audit ? (off.audit.seen.get('svc.whisper.delivered') || 0) : -1;
    const tries = recs.length ? (JSON.parse(recs[0].split('|')[1]).tries) : -1;
    // ① 성공 발행+관측 — delivered 1·svc.whisper.delivered 발행 1·audit 관측 1·ev.tries 1(첫 떨굼→1회 재시도 후 확인).
    const published = wr && wr.delivered === 1 && wr.deliveredPublished === 1 && auON === 1 && tries === 1;
    // ② 대조(OFF) — deliveredPublish 없으면 발행 0·audit 미관측: delivered 1(전달 자체는 불변).
    const silent = wo && wo.delivered === 1 && wo.deliveredPublished === 0 && auOFF === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(published, `seed ${seed}: 성공 발행/관측 틀림(delivered ${wr && wr.delivered}·pub ${wr && wr.deliveredPublished}·audit ${auON}·tries ${tries})`) &&
      check(silent, `seed ${seed}: OFF 발행 누설(delivered ${wo && wo.delivered}·pub ${wo && wo.deliveredPublished}·audit ${auOFF})`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad(wr ? wr.deliveredPublished : 0, 12)} | ${pad(auON, 9)} | ${pad(tries, 8)} | ${pad(auOFF, 9)} | ${pad(wo ? wo.deliveredPublished : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 전달 수명주기의 양 끝이 같은 audit sink 로 모인다: 포기(svc.whisper.failed·0082)와 성공(svc.whisper.delivered·0087·tries 로 비용까지). 라우터는 bus 만 알고 구독자 무지(은닉)·발행자 무수정으로 audit 가 두 토픽을 본다(SPINE 계층3 관측).');
  console.log('    deliveredPublish 미설정 = 0086 비트 동일(발행 0·reg). 비-침습: 발행 권위 0(원장 무관)·delivered ON==OFF·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['wdpublish'] = wdpublish;
kit.ORDER.splice(1, 0, 'wdpublish');

(async () => { process.exit(await kit.cli(process.argv)); })();
