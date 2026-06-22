// HktInfra step-0099 — 헤드리스 검증 (Mailbox inbox 유계화·드레인 읽기 모델)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pinboxbound`.
//   더한 한 조각: Mailbox.inbox 는 받은 귓속말을 *전부 영구 보관* → 읽는 이가 없으면 메모리가 received 에 비례해 무한 성장(누설). 이 step 은 inbox 를 최근 K개(inboxBound)로 유계화 — K 초과 시 가장 오래된 것 드롭(overflowed++). received(총 수신)는 진실 SSOT 로 보존. 0081 seq·0090 epoch 유계화에 이은 *inbox 차원* 유계화.
//   검증: ⒜ `reg`(키트) — inboxBound 미설정이면 0098 비트 동일(무계 배열). ⒝ `pinboxbound`(가설) — 8 귓속말→mbox(전부 전달). ON(K=4): inbox.length 4·overflowed 4·received 8. OFF: inbox.length 8·overflowed 0·received 8. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const K = 4;
const WHISPERS = [];
for (let i = 0; i < 8; i++) WHISPERS.push({ at: 46 + i * 2, from: 'client0', to: 'mbox', body: 'w' + i });   // 8 귓속말→mbox(전부 up·전달)
const N = WHISPERS.length;   // 8 수신
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS,
  ...extra });

function pinboxbound(seeds) {
  console.log('== pinboxbound: *가설* — Mailbox inbox 유계화. inbox 를 최근 K개로 cap(K 초과 시 가장 오래된 것 드롭) → 읽는 이 없어도 메모리 유계. received(총 수신)는 진실 SSOT 보존. inboxBound ON vs OFF ==');
  console.log(`  ${N} 귓속말→mbox. ON(K=${K}): inbox.length ${K}·overflowed ${N - K}·received ${N}. OFF: inbox.length ${N}·overflowed 0·received ${N}(무계).`);
  console.log('seed   | received | inbox ON | overflow ON | inbox OFF | overflow OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { mailboxInboxBound: K }) });
    const off = run({ ...P_BASE(seed, { mailboxInboxBound: 0 }) });   // 무계(0098 동작)
    const mb = on.mbox; const mo = off.mbox;
    // ① 유계 — inbox 최근 K·overflowed N-K·received N 보존.
    const bounded = mb && mb.received === N && mb.inbox.length === K && mb.overflowed === N - K;
    // ② 대조(OFF) — 무계: inbox.length == received(∝수신)·overflowed 0.
    const unbounded = mo && mo.received === N && mo.inbox.length === N && mo.overflowed === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && mb.received === mo.received;
    const ok =
      check(bounded, `seed ${seed}: 유계 틀림(received ${mb && mb.received}·inbox ${mb && mb.inbox.length}·overflow ${mb && mb.overflowed}·기대 ${N}/${K}/${N - K})`) &&
      check(unbounded, `seed ${seed}: OFF 무계 미재현(inbox ${mo && mo.inbox.length}·overflow ${mo && mo.overflowed}·기대 ${N}/0)`) &&
      check(nonInvasive, `seed ${seed}: 유계화가 수신/원장 권위 바꿈(received on ${mb.received} off ${mo.received}·minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.inbox.length : 0, 8)} | ${pad(mb ? mb.overflowed : 0, 11)} | ${pad(mo ? mo.inbox.length : 0, 9)} | ${pad(mo ? mo.overflowed : 0, 12)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 수신함의 세 차원이 모두 유계화됐다: dedup seq(0081)·dedup epoch(0090/0091)·*inbox 적재*(0099). 읽는 이 없는 수신함도 메모리가 ∝received 로 새지 않는다(최근 K 뷰). received 는 진실 SSOT 로 분리 보존 — "총 몇 받았나"(회계)와 "지금 무엇 보유"(유계 뷰)를 가른다(SPINE 계층3·5).`);
  console.log('    inboxBound 0(기본) = 무계 평면 배열 = 0098 비트 동일(reg). 비-침습: 유계화는 보유 표현만(수신/ack/원장 권위 불변·received·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pinboxbound'] = pinboxbound;
kit.ORDER.splice(1, 0, 'pinboxbound');

(async () => { process.exit(await kit.cli(process.argv)); })();
