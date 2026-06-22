// HktInfra step-0101 — 헤드리스 검증 (읽음 확인 영수증·drainAck 2단계 읽음)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pread`.
//   더한 한 조각: 0100 의 drain() 은 inbox 를 *파괴적으로 즉시 비운다* — 읽는 순간 소비. 읽은 결과가 손실되면(처리 전 크래시·전송 유실) 영영 잃음(재드레인 정합 미보장·0100 §9). 이 step 은 drain 을 *2단계 읽음*으로: drain() 이 inbox 를 미확인 체크아웃으로 옮겨 반환하되 *제거 않고 보유*, ackDrain(seq) 로 처리 완료 확인 시에만 안전 제거(drainAcked). ack 전 재드레인은 같은 배치 무손실 재반환(at-least-once 읽음) → 읽음 손실 복구 가능. 0076 whisperReceipt 의 *읽음측* 판.
//   검증: ⒜ `reg`(키트) — drainAck 미설정(mailboxDrainAck OFF)이면 drain() = 0100 파괴적 즉시 비움 = 비트 동일. ⒝ `pread`(가설) — 8 귓속말→mbox. ON-미확인: 읽되 ack 0 → 8 보유(checkout·drained 0·복구 가능) vs OFF: 읽음=즉시 소비(drained 8·held 0·파괴적). ON-확인: 재드레인(읽음 손실 복구)+ack → drained 8·drainAcked 8·held 0(안전 제거). 셋 다 received 8·minted 동일(비침습).
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
const held = m => (m && m.checkout ? m.checkout.msgs.length : 0);   // 미확인 체크아웃 보유량(읽었으나 ack 안 됨·복구 가능)
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whispers: WHISPERS,
  ...extra });

function pread(seeds) {
  console.log('== pread: *가설* — 읽음 확인 영수증(drainAck). drain 을 2단계 읽음(checkout→ackDrain)으로: ack 전엔 보유(복구 가능)·ack 시에만 안전 제거. 읽음 손실이 재드레인으로 복구됨을 보인다(0100 파괴적 드레인 대비) ==');
  console.log(`  ${N} 귓속말→mbox. ON-미확인: 읽되 ack 0 → ${N} 보유(checkout·drained 0). ON-확인: 재드레인+ack → drained ${N}·drainAcked ${N}·held 0. OFF(0100): 읽음=즉시 소비(drained ${N}·held 0·파괴적).`);
  console.log('seed   | received | held(ON-미확인) | drained(ON-확인) | drainAcked | held(ON-확인) | drained(OFF) | held(OFF) | 비침습 | 판정');
  for (const seed of seeds) {
    // ON-미확인: 읽되 ack 누락 → N 이 체크아웃에 보유(복구 가능·drained 0).
    const onHeld = run({ ...P_BASE(seed, { mailboxDrainAck: true, mboxDrain: [{ at: 75 }] }) });
    // ON-확인: 읽음 손실 복구 — drain@75(읽음 유실·ack 없음)→재drain@80(같은 배치 무손실 재반환)→ackDrain@85(안전 제거).
    const onAck = run({ ...P_BASE(seed, { mailboxDrainAck: true, mboxDrain: [{ at: 75 }, { at: 80 }], mboxDrainAck: [{ at: 85 }] }) });
    // OFF(0100): 파괴적 즉시 비움 — 읽는 순간 소비(읽음 손실 시 영영 잃음).
    const off = run({ ...P_BASE(seed, { mboxDrain: [{ at: 75 }] }) });
    const mh = onHeld.mbox; const ma = onAck.mbox; const mo = off.mbox;
    // ① ON-미확인 — 읽었으나 ack 0: N 보유(checkout)·drained 0·drainAcked 0·inbox 0(읽음 손실에도 복구 가능).
    const heldRecoverable = mh && mh.received === N && mh.inbox.length === 0 && held(mh) === N && mh.drained === 0 && mh.drainAcked === 0;
    // ② ON-확인 — 재드레인(읽음 손실 복구)+ack: drained N·drainAcked N·held 0·checkout null·inbox 0(안전 제거·exactly-once 소비).
    const confirmedRemoved = ma && ma.received === N && ma.inbox.length === 0 && ma.checkout === null && ma.drained === N && ma.drainAcked === N && held(ma) === 0;
    // ③ OFF(0100) 대조 — 파괴적: drained N(읽음=소비)·held 0·drainAcked 0(2단계 없음).
    const offDestructive = mo && mo.received === N && mo.inbox.length === 0 && mo.drained === N && mo.drainAcked === 0 && held(mo) === 0;
    const nonInvasive = onHeld.inventory.minted === off.inventory.minted && onAck.inventory.minted === off.inventory.minted && mh.received === mo.received && ma.received === mo.received;
    const ok =
      check(heldRecoverable, `seed ${seed}: ON-미확인 보유 틀림(received ${mh && mh.received}·held ${held(mh)}·drained ${mh && mh.drained}·acked ${mh && mh.drainAcked}·기대 ${N}/${N}/0/0)`) &&
      check(confirmedRemoved, `seed ${seed}: ON-확인 안전제거 틀림(drained ${ma && ma.drained}·acked ${ma && ma.drainAcked}·held ${held(ma)}·checkout ${ma && ma.checkout}·기대 ${N}/${N}/0/null)`) &&
      check(offDestructive, `seed ${seed}: OFF 파괴적 미재현(drained ${mo && mo.drained}·held ${held(mo)}·acked ${mo && mo.drainAcked}·기대 ${N}/0/0)`) &&
      check(nonInvasive, `seed ${seed}: 읽음 확인이 수신/원장 권위 바꿈(received ${mh.received}/${ma.received}/${mo.received}·minted ${onHeld.inventory.minted}/${onAck.inventory.minted}/${off.inventory.minted})`) &&
      check(ledgerConsistent(onAck) && itemConserved(onAck) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mh ? mh.received : 0, 8)} | ${pad(held(mh), 14)} | ${pad(ma ? ma.drained : 0, 16)} | ${pad(ma ? ma.drainAcked : 0, 10)} | ${pad(held(ma), 13)} | ${pad(mo ? mo.drained : 0, 12)} | ${pad(held(mo), 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 드레인이 *2단계 읽음*(checkout→ackDrain)으로 손실 안전해진다: 읽되 미확인이면 보유(복구 가능)·재드레인이 무손실 재반환(at-least-once 읽음)·ack 시에만 안전 제거(exactly-once 소비). 0100 파괴적 드레인(읽음=소비)의 읽음 손실 취약성을 닫는다 — 0076 전달 영수증의 읽음측 판.`);
  console.log('    mailboxDrainAck 미설정 = drain() 파괴적 즉시 비움 = 0100 비트 동일(reg). 비-침습: 읽음 확인은 보유 비움 절차일 뿐 수신/ack/원장 권위 불변(received·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pread'] = pread;
kit.ORDER.splice(1, 0, 'pread');

(async () => { process.exit(await kit.cli(process.argv)); })();
