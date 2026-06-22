// HktInfra step-0100 — 헤드리스 검증 (Mailbox inbox 드레인·읽음 소비)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pdrain`.
//   더한 한 조각: 0099 의 inboxBound 는 inbox 를 최근 K개로 cap 하되 초과분을 *드롭*(잃음)한다 — notification 트레이 의미론(0099 §9). 진짜 수신함은 소유자가 *읽어 비운다* — 읽은 메시지는 소비된다. 이 step 은 drain() 으로 그 정상 비움을 모델: 현 inbox 반환·비움·drained 누적 → 읽는 이가 있으면 inbox 가 *무손실로* 유계(드롭 0). 0099 cap(읽는 이 없을 때 방어)과 짝.
//   검증: ⒜ `reg`(키트) — drain() 미호출(mboxDrain 미제공)이면 inbox 누적 = 0099 비트 동일. ⒝ `pdrain`(가설) — 8 귓속말→mbox, 모두 전달 후 drain 1회. ON(mboxDrain): inbox 0·drained 8·overflowed 0(무손실). OFF: inbox 8·drained 0. 둘 다 received 8·minted 동일(비침습).
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
const WHISPERS = [];
for (let i = 0; i < 8; i++) WHISPERS.push({ at: 46 + i * 2, from: 'client0', to: 'mbox', body: 'w' + i });   // 8 귓속말→mbox(전부 up·전달, 마지막 at 60)
const N = WHISPERS.length;   // 8 수신
const DRAIN = [{ at: 75 }];   // 전부 전달된 뒤 소유자가 1회 읽어 비움
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS,
  ...extra });

function pdrain(seeds) {
  console.log('== pdrain: *가설* — Mailbox inbox 드레인. 소유자가 수신함을 읽어 비운다(drain) → 읽는 이가 있으면 inbox 가 무손실로 유계(0099 lossy cap 과 짝). mboxDrain ON vs OFF ==');
  console.log(`  ${N} 귓속말→mbox·전달 후 drain 1회. ON: inbox 0·drained ${N}·overflowed 0(무손실). OFF: inbox ${N}·drained 0. 둘 다 received ${N}.`);
  console.log('seed   | received | inbox ON | drained ON | overflow ON | inbox OFF | drained OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { mboxDrain: DRAIN }) });
    const off = run({ ...P_BASE(seed, {}) });   // drain 미호출(0099 동작)
    const mb = on.mbox; const mo = off.mbox;
    // ① 드레인 — inbox 0·drained N·overflowed 0(무손실 비움)·received N 보존.
    const drained = mb && mb.received === N && mb.inbox.length === 0 && mb.drained === N && mb.overflowed === 0;
    // ② 대조(OFF) — drain 미호출: inbox 누적(==received)·drained 0.
    const accum = mo && mo.received === N && mo.inbox.length === N && mo.drained === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && mb.received === mo.received;
    const ok =
      check(drained, `seed ${seed}: 드레인 틀림(received ${mb && mb.received}·inbox ${mb && mb.inbox.length}·drained ${mb && mb.drained}·overflow ${mb && mb.overflowed}·기대 ${N}/0/${N}/0)`) &&
      check(accum, `seed ${seed}: OFF 누적 미재현(inbox ${mo && mo.inbox.length}·drained ${mo && mo.drained}·기대 ${N}/0)`) &&
      check(nonInvasive, `seed ${seed}: 드레인이 수신/원장 권위 바꿈(received on ${mb.received} off ${mo.received}·minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.inbox.length : 0, 8)} | ${pad(mb ? mb.drained : 0, 10)} | ${pad(mb ? mb.overflowed : 0, 11)} | ${pad(mo ? mo.inbox.length : 0, 9)} | ${pad(mo ? mo.drained : 0, 11)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 수신함 메모리의 두 방어가 완성된다: *읽는 이 있을 때* drain(무손실 소비·0100)·*읽는 이 없을 때* inboxBound cap(lossy 드롭·0099). received(총 수신 회계)는 둘 다 진실 SSOT 로 보존 — 보유(inbox)는 소비/방어로 유계, 진실은 분리(SPINE 계층3·5 수신함 메모리 모델 완성).`);
  console.log('    mboxDrain 미제공 = drain() 미호출 = inbox 누적 = 0099 비트 동일(reg). 비-침습: drain 은 보유 비움일 뿐 수신/ack/원장 권위 불변(received·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pdrain'] = pdrain;
kit.ORDER.splice(1, 0, 'pdrain');

(async () => { process.exit(await kit.cli(process.argv)); })();
