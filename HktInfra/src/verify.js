// HktInfra step-0103 — 헤드리스 검증 (읽음 소비 발행·drainedPublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pdrpub`.
//   더한 한 조각: 0100~0102 는 수신함 *보유*(inbox/checkout/drained)를 회계·유계화했지만, 소유자의 *읽음 확인 소비*(ackDrain·exactly-once 완료)는 박스 내부 카운터로만 남아 외부 관측 불가. 0087 deliveredPublish 가 전달 성공을 svc.whisper.delivered 로 발행했듯, 이 step 은 읽음 소비 완료를 svc.mailbox.drained{seq,count} 로 발행한다 — ackDrain 확정 소비 시 버스로 1회, audit 구독 관측. 0087(전달측 성공 관측)의 *읽음측* 판 — 수신함 수명주기(전달→확인→소비) 마지막 마디 가시화.
//   검증: ⒜ `reg`(키트) — drainedPublish 미설정이면 발행 0 = 0102 비트 동일. ⒝ `pdrpub`(가설) — 8 귓속말→mbox, drain@75+ackDrain@85. ON(drainedPublish): drainedPublished 1·audit svc.mailbox.drained 1(count 8). OFF: 0/0. 둘 다 drained 8·received 8·minted 동일(비침습).
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
const DRAIN = [{ at: 75 }]; const ACK = [{ at: 85 }];
const auditCount = (r, topic) => (r.audit && r.audit.seen.get(topic)) || 0;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS, mailboxDrainAck: true, mboxDrain: DRAIN, mboxDrainAck: ACK,
  ...extra });

function pdrpub(seeds) {
  console.log('== pdrpub: *가설* — 읽음 소비 발행(drainedPublish). ackDrain 확정 소비를 svc.mailbox.drained 로 발행 → audit 관측(0087 deliveredPublish 의 읽음측 판). ON vs OFF ==');
  console.log(`  ${N} 귓속말→mbox, drain@75+ack@85. ON: drainedPublished 1·audit svc.mailbox.drained 1(count ${N}). OFF: 0/0. 둘 다 drained ${N}·received ${N}.`);
  console.log('seed   | received | drained | drainedPublished ON | audit ON | published OFF | audit OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { mailboxDrainedPublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // 발행 OFF(0102 동작)
    const mb = on.mbox; const mo = off.mbox;
    const aOn = auditCount(on, 'svc.mailbox.drained'); const aOff = auditCount(off, 'svc.mailbox.drained');
    // ① ON 발행 — drainedPublished 1·audit svc.mailbox.drained 1·drained N(확정 소비)·received N.
    const published = mb && mb.received === N && mb.drained === N && mb.drainedPublished === 1 && aOn === 1;
    // ② OFF 대조 — 발행 0·audit 0·drained N(소비는 동일·관측만 다름).
    const silent = mo && mo.received === N && mo.drained === N && mo.drainedPublished === 0 && aOff === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && mb.received === mo.received && mb.drained === mo.drained;
    const ok =
      check(published, `seed ${seed}: ON 발행 틀림(drained ${mb && mb.drained}·published ${mb && mb.drainedPublished}·audit ${aOn}·기대 ${N}/1/1)`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(published ${mo && mo.drainedPublished}·audit ${aOff}·기대 0/0)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 수신/소비/원장 권위 바꿈(received ${mb.received}/${mo.received}·drained ${mb.drained}/${mo.drained}·minted ${on.inventory.minted}/${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.drained : 0, 7)} | ${pad(mb ? mb.drainedPublished : 0, 19)} | ${pad(aOn, 8)} | ${pad(mo ? mo.drainedPublished : 0, 13)} | ${pad(aOff, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 수신함 수명주기가 외부 가시화로 닫힌다: 전달 성공(svc.whisper.delivered·0087)·읽음 소비(svc.mailbox.drained·0103). 발행은 *발신 0* audit 가 무수정 구독해 관측(0016 발행자 무수정 소비자 패턴) — 소비 회계(drained)는 박스 권위, 발행은 그 사실의 관측 사본.`);
  console.log('    mailboxDrainedPublish 미설정 = 발행 0·구독 행 0 = 0102 비트 동일(reg). 비-침습: 발행은 소비 사실의 관측일 뿐 수신/소비/원장 권위 불변(received·drained·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pdrpub'] = pdrpub;
kit.ORDER.splice(1, 0, 'pdrpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
