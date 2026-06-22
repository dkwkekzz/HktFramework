// HktInfra step-0104 — 헤드리스 검증 (수신함 손실 발행·lossPublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pmloss`.
//   더한 한 조각: 0103 은 *성공* 소비(svc.mailbox.drained)만 발행했다 — 0099 inboxBound 가 미읽음 inbox 를 cap 할 때 떨군 메시지(overflowed)는 조용히 잃는다(0103 §9). 손실은 성공보다 더 관측이 필요(SLA·경보). 이 step 은 inbox overflow 드롭을 svc.mailbox.overflowed{kind:'inbox'} 로 발행(드롭 1건마다)·audit 무수정 구독 관측. 0082 failedPublish·0103 drainedPublish 와 같은 발신 0 관측 사본 패턴의 손실 판.
//   검증: ⒜ `reg`(키트) — lossPublish 미설정이면 발행 0 = 0103 비트 동일. ⒝ `pmloss`(가설) — 8 귓속말→mbox, inboxBound 4. ON(lossPublish): overflowed 4·overflowPublished 4·audit svc.mailbox.overflowed 4. OFF: overflowed 4(드롭 동일)·published 0·audit 0. 둘 다 received 8·minted 동일(비침습).
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
const K = 4;   // inbox cap → overflow N-K
const OVF = N - K;   // 기대 드롭 수 4
const auditCount = (r, topic) => (r.audit && r.audit.seen.get(topic)) || 0;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS, mailboxInboxBound: K,
  ...extra });

function pmloss(seeds) {
  console.log('== pmloss: *가설* — 수신함 손실 발행(lossPublish). inbox overflow 드롭을 svc.mailbox.overflowed 로 발행 → audit 관측(0082/0103 의 손실 판). ON vs OFF ==');
  console.log(`  ${N} 귓속말→mbox, inboxBound ${K}. ON: overflowed ${OVF}·overflowPublished ${OVF}·audit svc.mailbox.overflowed ${OVF}. OFF: overflowed ${OVF}(드롭 동일)·published 0·audit 0.`);
  console.log('seed   | received | overflowed | overflowPublished ON | audit ON | published OFF | audit OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { mailboxLossPublish: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // 발행 OFF(0103 동작·드롭은 동일)
    const mb = on.mbox; const mo = off.mbox;
    const aOn = auditCount(on, 'svc.mailbox.overflowed'); const aOff = auditCount(off, 'svc.mailbox.overflowed');
    // ① ON 발행 — overflowed OVF·overflowPublished OVF·audit OVF·received N.
    const published = mb && mb.received === N && mb.overflowed === OVF && mb.overflowPublished === OVF && aOn === OVF;
    // ② OFF 대조 — 드롭은 동일(overflowed OVF)·발행 0·audit 0(손실은 같되 관측만 다름).
    const silent = mo && mo.received === N && mo.overflowed === OVF && mo.overflowPublished === 0 && aOff === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && mb.received === mo.received && mb.overflowed === mo.overflowed;
    const ok =
      check(published, `seed ${seed}: ON 발행 틀림(overflowed ${mb && mb.overflowed}·published ${mb && mb.overflowPublished}·audit ${aOn}·기대 ${OVF}/${OVF}/${OVF})`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(overflowed ${mo && mo.overflowed}·published ${mo && mo.overflowPublished}·audit ${aOff}·기대 ${OVF}/0/0)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 수신/드롭/원장 권위 바꿈(received ${mb.received}/${mo.received}·overflowed ${mb.overflowed}/${mo.overflowed}·minted ${on.inventory.minted}/${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.overflowed : 0, 10)} | ${pad(mb ? mb.overflowPublished : 0, 20)} | ${pad(aOn, 8)} | ${pad(mo ? mo.overflowPublished : 0, 13)} | ${pad(aOff, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 수신함 수명주기가 성공·손실 양면 모두 외부 가시화로 닫힌다: 성공(svc.mailbox.drained·0103)·손실(svc.mailbox.overflowed·0104). 드롭 회계(overflowed)는 박스 권위, 발행은 그 손실의 관측 사본(SLA·경보 소비자가 무수정 구독). 0099~0104 수신함 메모리·수명주기·관측 arc 완성.`);
  console.log('    mailboxLossPublish 미설정 = 발행 0·구독 행 0 = 0103 비트 동일(reg). 비-침습: 발행은 손실 사실의 관측일 뿐 수신/드롭/원장 권위 불변(received·overflowed·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pmloss'] = pmloss;
kit.ORDER.splice(1, 0, 'pmloss');

(async () => { process.exit(await kit.cli(process.argv)); })();
