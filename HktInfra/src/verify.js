// HktInfra step-0076 — 헤드리스 검증 (전달 영수증·whisperReceipt)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wdeliver`.
//   더한 한 조각: 0071~0075 의 라우터는 라우팅 *결정*(프레즌스 질의→up 전달/down 반송)까지만 견고했다 — whisperDeliver 를 보내는 순간 routed++ 로 셌지 *대상이 실제로 받았는지*는 확인 안 했다(best-effort·0075 §9). 이 step 은 전달의 *수신 확인 고리*를 더한다: 라우터가 deliverable 일 때 whisperDeliver 에 {seq, ackTo} 부착·inflight 보류 → 수신측 Mailbox 가 적재 후 whisperAck{seq} 회신 → 라우터가 inflight 해제·delivered++. 0057 recoverAck 의 *전달* 판(routed⊇delivered·inflight=routed-delivered).
//   검증: ⒜ `reg`(키트) — whisperReceipt 미설정이면 0075 비트 동일(mbox 박스 0·ackTo 미부착). ⒝ `wdeliver`(가설) — 클라가 'mbox'(프레즌스 up)에게 귓속말. ON: routed 1→Mailbox received 1·acks 1→delivered 1·acksRecv 1·inflight 0. OFF(whisperReceipt 끔): mbox 박스 부재(net.send drop)→routed 1 이나 delivered 0·acksRecv 0(영수증 없는 best-effort 의 대조). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const WHISPER_AT = 80;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wdeliver(seeds) {
  console.log('== wdeliver: *가설* — 전달의 *수신 확인 고리*. 라우터가 whisperDeliver 에 seq/ackTo 부착·inflight 보류 → Mailbox 가 whisperAck 회신 → delivered 확인(routed⊇delivered). whisperReceipt ON vs OFF ==');
  console.log(`  클라가 'mbox'(프레즌스 up)에게 귓속말@${WHISPER_AT}. ON: routed 1·Mailbox received/acks 1·delivered 1·acksRecv 1·inflight 0. OFF: mbox 부재→routed 1 이나 delivered 0·acksRecv 0(best-effort).`);
  console.log('seed   | routed | delivered | acksRecv | inflight | mbox rx/ack | OFF deliv | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { whisperReceipt: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // whisperReceipt OFF — mbox 박스 부재·라우터 receipt false(ackTo 미부착·inflight 미보류)
    const wr = on.wrouter; const mb = on.mbox; const wo = off.wrouter;
    // ① 전달+확인 — 라우터가 routed 1·delivered 1(영수증으로 확인)·acksRecv 1·inflight 0(보류 없음).
    const confirmed = wr && wr.routed === 1 && wr.delivered === 1 && wr.acksRecv === 1 && wr.inflight.size === 0;
    // ② 수신측 — Mailbox 가 received 1·acks 1(적재 후 영수증 회신). 박스 존재.
    const received = mb && mb.received === 1 && mb.acks === 1;
    // ③ 대조(OFF) — mbox 박스 부재(net.send drop)·라우터는 routed 1 이나 delivered 0·acksRecv 0(영수증 없는 best-effort).
    const offGap = off.mbox == null && wo && wo.routed === 1 && wo.delivered === 0 && wo.acksRecv === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(confirmed, `seed ${seed}: 전달 확인 틀림(routed ${wr && wr.routed}·delivered ${wr && wr.delivered}·acks ${wr && wr.acksRecv}·inflight ${wr && wr.inflight.size})`) &&
      check(received, `seed ${seed}: 수신측 틀림(mbox ${mb && mb.received}/${mb && mb.acks})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(mbox ${off.mbox}·routed ${wo && wo.routed}·delivered ${wo && wo.delivered}·acks ${wo && wo.acksRecv})`) &&
      check(nonInvasive, `seed ${seed}: 영수증이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.routed : 0, 6)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad(wr ? wr.acksRecv : 0, 8)} | ${pad(wr ? wr.inflight.size : 0, 8)} | ${pad((mb ? mb.received : 0) + '/' + (mb ? mb.acks : 0), 11)} | ${pad(wo ? wo.delivered : 0, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → whisperDeliver 가 fire-and-forget(routed 만 셈)에서 *수신 확인된 전달*(routed⊇delivered·inflight=미확인분)로 승격. 수신측 Mailbox 가 영수증(whisperAck)으로 고리를 닫는다(0057 recoverAck 의 전달 판·SPINE 계층3 채팅/소셜).');
  console.log('    whisperReceipt 미설정 = 0075 비트 동일(mbox 박스 0·ackTo 미부착·reg). OFF 면 영수증 없이 best-effort(delivered 0). 비-침습: 영수증/수신함 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['wdeliver'] = wdeliver;
kit.ORDER.splice(1, 0, 'wdeliver');

(async () => { process.exit(await kit.cli(process.argv)); })();
