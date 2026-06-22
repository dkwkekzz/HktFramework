// HktInfra step-0102 — 헤드리스 검증 (미확인 체크아웃 유계화·checkoutBound)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pcobnd`.
//   더한 한 조각: 0101 의 2단계 읽음은 ack 전 미확인 메시지를 *체크아웃에 무계 보유*한다 — 읽는 이가 느리거나 죽어 영영 ack 안 하면 checkout 이 received 에 비례해 성장(0101 §9). 0099 가 inbox 를 최근 K 로 cap 했듯, 이 step 은 *미확인 체크아웃* 을 최근 K(checkoutBound)로 cap: drain 후 K 초과면 가장 오래된 미확인 드롭(checkoutOverflowed++·lossy). drained(ack 소비)는 무손실 보존(0101), checkout cap 은 미확인 보유의 lossy 유계화 — 0099 inbox cap(미읽음 방어)의 읽음측 판.
//   검증: ⒜ `reg`(키트) — checkoutBound 미설정이면 무계 보유 = 0101 비트 동일. ⒝ `pcobnd`(가설) — 8 귓속말→mbox, drain 후 ack 누락(슬로/데드 리더). ON(checkoutBound 4): held 4·overflow 4(옛 미확인 드롭). OFF(무계): held 8·overflow 0. 둘 다 received 8·minted 동일(비침습).
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
const K = 4;   // 미확인 체크아웃 cap(최근 K개)
const held = m => (m && m.checkout ? m.checkout.msgs.length : 0);   // 미확인 체크아웃 보유량
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS,
  ...extra });

function pcobnd(seeds) {
  console.log('== pcobnd: *가설* — 미확인 체크아웃 유계화(checkoutBound). 읽되 영영 ack 안 하는 슬로/데드 리더의 보유 누설을 최근 K 로 cap(0099 inbox cap 의 읽음측 판). ON vs OFF ==');
  console.log(`  ${N} 귓속말→mbox, drain 후 ack 누락. ON(checkoutBound ${K}): held ${K}·overflow ${N - K}(옛 미확인 드롭). OFF(무계): held ${N}·overflow 0. 둘 다 received ${N}.`);
  console.log('seed   | received | held ON | overflow ON | held OFF | overflow OFF | drained | 비침습 | 판정');
  for (const seed of seeds) {
    // ON: 미확인 체크아웃 최근 K cap. drain@75 후 ack 누락 → held K·overflow N-K(옛 미확인 드롭).
    const on  = run({ ...P_BASE(seed, { mailboxDrainAck: true, mboxDrain: [{ at: 75 }], mailboxCheckoutBound: K }) });
    // OFF: 무계 보유(0101) — held N·overflow 0.
    const off = run({ ...P_BASE(seed, { mailboxDrainAck: true, mboxDrain: [{ at: 75 }] }) });
    const mb = on.mbox; const mo = off.mbox;
    // ① ON cap — held K·checkoutOverflowed N-K·received N 보존·drained 0(ack 누락).
    const capped = mb && mb.received === N && held(mb) === K && mb.checkoutOverflowed === N - K && mb.drained === 0;
    // ② OFF 무계 — held N·overflow 0·received N.
    const unbounded = mo && mo.received === N && held(mo) === N && mo.checkoutOverflowed === 0 && mo.drained === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && mb.received === mo.received;
    const ok =
      check(capped, `seed ${seed}: ON cap 틀림(received ${mb && mb.received}·held ${held(mb)}·overflow ${mb && mb.checkoutOverflowed}·기대 ${N}/${K}/${N - K})`) &&
      check(unbounded, `seed ${seed}: OFF 무계 미재현(held ${held(mo)}·overflow ${mo && mo.checkoutOverflowed}·기대 ${N}/0)`) &&
      check(nonInvasive, `seed ${seed}: 체크아웃 cap 이 수신/원장 권위 바꿈(received ${mb.received}/${mo.received}·minted ${on.inventory.minted}/${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(held(mb), 7)} | ${pad(mb ? mb.checkoutOverflowed : 0, 11)} | ${pad(held(mo), 8)} | ${pad(mo ? mo.checkoutOverflowed : 0, 12)} | ${pad(mb ? mb.drained : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 수신함 메모리가 세 차원 모두 유계: *미읽음* inbox cap(0099·lossy)·*읽음-미확인* checkout cap(0102·lossy)·*확인 소비* drained(0100/0101·무손실). received(총 수신 회계)는 셋 다 진실 SSOT 로 보존 — 보유는 차원별로 cap·소비로 유계, 진실은 분리.`);
  console.log('    mailboxCheckoutBound 미설정 = 무계 보유 = 0101 비트 동일(reg). 비-침습: 체크아웃 cap 은 미확인 보유 드롭일 뿐 수신/원장 권위 불변(received·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pcobnd'] = pcobnd;
kit.ORDER.splice(1, 0, 'pcobnd');

(async () => { process.exit(await kit.cli(process.argv)); })();
