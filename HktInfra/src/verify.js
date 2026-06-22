// HktInfra step-0080 — 헤드리스 검증 (수신측 dedup·exactly-once)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wdedup`.
//   더한 한 조각: 0077 의 at-least-once 재시도는 *영수증(ack)이 손실*되면 라우터가 *이미 받은 전달*도 재발신한다 → Mailbox 가 같은 귓속말을 두 번 적재(중복·0077 §9). 이 step 은 수신측을 멱등화한다: Mailbox 가 seq 를 기억해 중복 whisperDeliver 는 inbox 재적재 안 함(duplicates++)·ack 만 재회신. at-least-once 전송 + 수신측 dedup = exactly-once *처리*(0026 id-reconciliation 의 전달 판).
//   검증: ⒜ `reg`(키트) — dedup 미설정이면 0079 비트 동일. ⒝ `wdedup`(가설) — 'mbox' 가 첫 ack 을 떨굼(dropAck 1·전달은 정상 수신)→라우터 재발신→중복 전달. ON(dedup): received 1·inbox 1·duplicates 1(중복 걸러냄·exactly-once). OFF: received 2·inbox 2·duplicates 0(중복 적재·at-least-once). 둘 다 delivered 1. minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 60; const ACKDROP = 1; const DTIMEOUT = 4;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  deliverTimeout: DTIMEOUT, deliverAckDrop: ACKDROP,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'mbox', body: 'hi' }],
  ...extra });

function wdedup(seeds) {
  console.log('== wdedup: *가설* — at-least-once 전송 + 수신측 dedup = exactly-once 처리. ack 이 손실되면 라우터가 이미 받은 전달을 재발신 → Mailbox 가 seq 로 중복을 걸러 inbox 재적재 안 함. dedup ON vs OFF ==');
  console.log(`  'mbox' 가 첫 ack 떨굼(dropAck ${ACKDROP}·전달은 수신)→재발신→중복. ON(dedup): received 1·inbox 1·duplicates 1. OFF: received 2·inbox 2·duplicates 0. 둘 다 delivered 1.`);
  console.log('seed   | received | inbox | duplicates | delivered | OFF rx/inbox/dup | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverDedup: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // dedup OFF — 중복 전달이 inbox 에 재적재(at-least-once·0079 동작)
    const wr = on.wrouter; const mb = on.mbox; const wo = off.wrouter; const mo = off.mbox;
    // ① exactly-once — 중복 전달 1건을 dedup 으로 걸러(duplicates 1)·inbox 1·received 1·라우터 delivered 1(재-ack 로 inflight 정리).
    const exactly = mb && mb.received === 1 && mb.inbox.length === 1 && mb.duplicates === 1 && wr && wr.delivered === 1;
    // ② 대조(OFF) — dedup 없으면 중복 적재: received 2·inbox 2·duplicates 0. 라우터는 동일하게 delivered 1.
    const dupLoaded = mo && mo.received === 2 && mo.inbox.length === 2 && mo.duplicates === 0 && wo && wo.delivered === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(exactly, `seed ${seed}: exactly-once 틀림(rx ${mb && mb.received}·inbox ${mb && mb.inbox.length}·dup ${mb && mb.duplicates}·delivered ${wr && wr.delivered})`) &&
      check(dupLoaded, `seed ${seed}: OFF 중복 미재현(rx ${mo && mo.received}·inbox ${mo && mo.inbox.length}·dup ${mo && mo.duplicates})`) &&
      check(nonInvasive, `seed ${seed}: dedup 이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.inbox.length : 0, 5)} | ${pad(mb ? mb.duplicates : 0, 10)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad((mo ? mo.received : 0) + '/' + (mo ? mo.inbox.length : 0) + '/' + (mo ? mo.duplicates : 0), 16)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → at-least-once 전송(0077·재시도)이 수신측 멱등화(seq dedup)와 합쳐져 *exactly-once 처리*가 된다. ack 손실로 인한 중복 전달이 inbox 에 한 번만 남는다(0026 belief→중복 mint 차단의 전달 판·SPINE 계층3). 라우터 delivered 는 양쪽 1(전송 보장은 불변·차이는 수신측 적재).');
  console.log('    dedup 미설정 = 0079 비트 동일(seen 미사용·중복 적재·reg). OFF 면 중복 전달이 inbox 재적재(at-least-once). 비-침습: dedup 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['wdedup'] = wdedup;
kit.ORDER.splice(1, 0, 'wdedup');

(async () => { process.exit(await kit.cli(process.argv)); })();
