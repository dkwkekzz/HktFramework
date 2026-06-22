// HktInfra step-0079 — 헤드리스 검증 (전달 포기 통지·deliverNotify·deliveryFailed)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wnotify`.
//   더한 한 조각: 0078 의 포기(undeliverable)는 라우터 *내부 계측*일 뿐 — 귓속말 보낸 클라는 전달이 영영 실패했음을 모른다(0078 §9). 이 step 은 포기를 *발신자에게 가시화*한다: 상한 도달로 포기할 때 원 발신자에 {type:'deliveryFailed', to, body} 회신(failedNotified++). 반송(bounce·도달불가 즉시)과 달리 포기는 *유계 재시도 소진 후* 알린다.
//   검증: ⒜ `reg`(키트) — deliverNotify 미설정이면 0078 비트 동일(통지 0). ⒝ `wnotify`(가설) — 'mbox' 가 모든 전달 떨굼·deliverMaxRetries 3. ON(deliverNotify): 포기 시 undeliverable 1·failedNotified 1·발신 client0 events 에 'deliveryFailed'. OFF: undeliverable 1 이나 failedNotified 0·client0 통지 없음(0078 동작). minted 동일(비-침습).
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
  deliverDrop: DROP, deliverTimeout: DTIMEOUT, deliverMaxRetries: CAP,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

const failedEvents = (r) => { const c = r.clients.find(x => x.addr === 'client0'); return c ? c.events.filter(e => e === 'deliveryFailed').length : -1; };

function wnotify(seeds) {
  console.log('== wnotify: *가설* — 전달 포기를 발신자에게 가시화. 상한 도달로 포기(undeliverable)할 때 원 발신자에 deliveryFailed 회신 → 클라가 "끝내 닿지 못함"을 안다. deliverNotify ON vs OFF ==');
  console.log(`  'mbox' 모든 전달 떨굼·deliverMaxRetries ${CAP}·귓속말@${WHISPER_AT}. ON: undeliverable 1·failedNotified 1·client0 events 에 deliveryFailed 1. OFF: undeliverable 1 이나 failedNotified 0·client0 통지 0.`);
  console.log('seed   | undeliverable | failedNotified | client0 failed-ev | OFF notif/ev | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverNotify: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // deliverNotify OFF — 포기는 0078 처럼 조용(통지 0)
    const wr = on.wrouter; const wo = off.wrouter;
    const onEv = failedEvents(on); const offEv = failedEvents(off);
    // ① 포기→통지 — undeliverable 1·failedNotified 1·발신 client0 이 deliveryFailed 1건 수신(events).
    const notified = wr && wr.undeliverable === 1 && wr.failedNotified === 1 && onEv === 1;
    // ② 대조(OFF) — 포기는 여전히 1(0078) 이나 통지 0·client0 미수신(events 0).
    const offGap = wo && wo.undeliverable === 1 && wo.failedNotified === 0 && offEv === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(notified, `seed ${seed}: 포기 통지 틀림(undel ${wr && wr.undeliverable}·notif ${wr && wr.failedNotified}·client0-ev ${onEv})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(undel ${wo && wo.undeliverable}·notif ${wo && wo.failedNotified}·client0-ev ${offEv})`) &&
      check(nonInvasive, `seed ${seed}: 통지가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.undeliverable : 0, 13)} | ${pad(wr ? wr.failedNotified : 0, 14)} | ${pad(onEv, 17)} | ${pad((wo ? wo.failedNotified : 0) + '/' + offEv, 12)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 전달 포기가 라우터 *내부 계측*에서 *발신자가 아는 실패*로 승격. 클라가 deliveryFailed 로 "상대에게 끝내 닿지 못함"을 안다(반송 bounce 는 도달불가 즉시·포기는 유계 재시도 소진 후·SPINE 계층3). 포기 발행(svc 토픽·감사)은 후속.');
  console.log('    deliverNotify 미설정 = 0078 비트 동일(포기는 조용·통지 0·reg). 비-침습: 통지 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 제어 평면.');
}

kit.MODES['wnotify'] = wnotify;
kit.ORDER.splice(1, 0, 'wnotify');

(async () => { process.exit(await kit.cli(process.argv)); })();
