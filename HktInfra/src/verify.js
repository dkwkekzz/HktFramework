// HktInfra step-0077 — 헤드리스 검증 (전달 손실 감지+재시도·whisperDeliverRetry)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wretry`.
//   더한 한 조각: 0076 은 미확인 전달(inflight)을 *분리*만 했지, 전달/영수증이 손실되면 inflight 에 영영 남았다(at-most-once 확인·0076 §9). 이 step 은 라우터 onTick 을 더해 deliverTimeout 경과해도 whisperAck 못 받은 inflight 전달을 *재발신*(같은 seq) → 손실에도 delivered 로 수렴(at-least-once·0058 recoverRetry 의 전달 판).
//   검증: ⒜ `reg`(키트) — deliverRetry 미설정이면 0076 비트 동일(onTick 무발화·재발신 0). ⒝ `wretry`(가설) — 'mbox'(프레즌스 up)에게 귓속말, Mailbox 가 첫 2개 전달을 떨굼(dropDeliver 2). ON: 라우터가 deliverTimeout 후 재발신(deliverRetries 2)→소진 후 도달·delivered 1·inflight 0. OFF(deliverRetry 끔): 재발신 0·delivered 0·inflight 1(손실에 갇힘). 둘 다 routed 1(첫 전달). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 60; const DROP = 2; const DTIMEOUT = 4;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverDrop: DROP, deliverTimeout: DTIMEOUT,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wretry(seeds) {
  console.log('== wretry: *가설* — 전달 손실에도 재시도로 at-least-once 수렴. Mailbox 가 첫 2개 전달을 떨구면(dropDeliver 2), 라우터가 deliverTimeout 후 미확인 inflight 를 재발신해 결국 delivered. deliverRetry ON vs OFF ==');
  console.log(`  'mbox' 에게 귓속말@${WHISPER_AT}·dropDeliver ${DROP}·deliverTimeout ${DTIMEOUT}. ON: deliverRetries ${DROP}→delivered 1·inflight 0. OFF: 재발신 0·delivered 0·inflight 1(손실에 갇힘). 둘 다 routed 1.`);
  console.log('seed   | routed | deliverRetries | delivered | inflight | mbox drop/rx | OFF deliv/infl | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverRetry: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // deliverRetry OFF — 라우터 재발신 0(미확인 inflight 방치)
    const wr = on.wrouter; const mb = on.mbox; const wo = off.wrouter; const mo = off.mbox;
    // ① 재시도→수렴 — 첫 전달은 routed 1, 떨궈진 뒤 deliverRetries DROP 회 재발신→소진 후 도달·delivered 1·inflight 0.
    const converge = wr && wr.routed === 1 && wr.deliverRetries === DROP && wr.delivered === 1 && wr.inflight.size === 0;
    // ② 수신측 — Mailbox 가 dropped DROP·received 1(재발신분 도달)·acks 1.
    const recv = mb && mb.dropped === DROP && mb.received === 1 && mb.acks === 1;
    // ③ 대조(OFF) — 재발신 0·delivered 0·inflight 1(손실에 갇힘)·mbox dropped 1(첫 전달만·재발신 없어 더 안 옴)·received 0.
    const offGap = wo && wo.deliverRetries === 0 && wo.delivered === 0 && wo.inflight.size === 1 && mo && mo.received === 0 && mo.dropped === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(converge, `seed ${seed}: 재시도 수렴 틀림(routed ${wr && wr.routed}·retries ${wr && wr.deliverRetries}·delivered ${wr && wr.delivered}·inflight ${wr && wr.inflight.size})`) &&
      check(recv, `seed ${seed}: 수신측 틀림(mbox drop ${mb && mb.dropped}·rx ${mb && mb.received}·ack ${mb && mb.acks})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(retries ${wo && wo.deliverRetries}·delivered ${wo && wo.delivered}·inflight ${wo && wo.inflight.size}·rx ${mo && mo.received})`) &&
      check(nonInvasive, `seed ${seed}: 재시도가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.routed : 0, 6)} | ${pad(wr ? wr.deliverRetries : 0, 14)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad(wr ? wr.inflight.size : 0, 8)} | ${pad((mb ? mb.dropped : 0) + '/' + (mb ? mb.received : 0), 12)} | ${pad((wo ? wo.delivered : 0) + '/' + (wo ? wo.inflight.size : 0), 14)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 전달이 *수신 확인된*(0076) 데서 *손실에도 확인까지 재시도*(at-least-once)로 승격. deliverTimeout 경과한 미확인 inflight 를 재발신해 전달/ack 손실에도 delivered 로 수렴(0058 recoverRetry·0008 ack/NAK 재전송의 전달 판·SPINE 계층3).');
  console.log('    deliverRetry 미설정 = 0076 비트 동일(onTick 무발화·재발신 0·reg). OFF 면 미확인 전달이 inflight 에 영영 갇힘. 비-침습: 재시도 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 제어 평면 timeout.');
}

kit.MODES['wretry'] = wretry;
kit.ORDER.splice(1, 0, 'wretry');

(async () => { process.exit(await kit.cli(process.argv)); })();
