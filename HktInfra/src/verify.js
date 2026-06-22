// HktInfra step-0085 — 헤드리스 검증 (파티 멤버십 영속·failover)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `ppersist`.
//   더한 한 조각: 0084 까지 PartyService 멤버십은 *휘발*이라 crash 시 결성·가입/탈퇴 전부 소실(0084 §9). 이 step 은 멤버십 변경 명령(create/join/leave)을 durable 변경 저널에 기록하고, crash(RAM 소실) 후 fresh 박스가 저널을 replay 해 멤버십 projection 을 재구성한다(0017 가방·0020 랭킹·0021 채팅 event sourcing 의 멤버십 판). 멤버십=휘발 projection·저널=durable.
//   검증: ⒜ `reg`(키트) — partyPersist 미설정이면 0084 비트 동일(저널 0·휴면). ⒝ `ppersist`(가설) — 파티 'p1' 결성[a,b]→join c→leave a→멤버십 [b,c]·저널 3. crash()→멤버십 소실. reconstruct(). ON(persist): 멤버십 [b,c] 복원(==죽기 전)·저널 3. OFF(영속 0): reconstruct 해도 빈 멤버십(소실·저널 0). minted 동일(비침습).
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
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, partyService: true,
  partyCreate: [{ at: 40, partyId: 'p1', members: ['a', 'b'] }],
  partyOps: [{ at: 50, op: 'join', partyId: 'p1', member: 'c' }, { at: 56, op: 'leave', partyId: 'p1', member: 'a' }],
  ...extra });

const memOf = (ps) => ps ? ps.membersOf('p1').slice().sort() : null;
const eq = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

function ppersist(seeds) {
  console.log('== ppersist: *가설* — 파티 멤버십 영속·failover. 멤버십 변경(create/join/leave)을 durable 저널에 기록, crash 후 fresh 박스가 저널 replay 로 멤버십 재구성(0020 ranking reconstruct 의 멤버십 판). partyPersist ON vs OFF ==');
  console.log("  파티 'p1' 결성[a,b]→join c→leave a→[b,c]·저널 3. crash()→소실. reconstruct(). ON: [b,c] 복원(==죽기 전)·저널 3. OFF: 빈 멤버십(소실)·저널 0.");
  console.log('seed   | 죽기전 | journal | crash후 | reconstruct후 | 복원==죽기전 | OFF reconstruct후 | OFF저널 | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyPersist: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // partyPersist OFF — 저널 0·crash 후 복원 불가(0084 동작·휘발)
    const ps = on.pservice; const po = off.pservice;
    const before = memOf(ps);              // 죽기 전 멤버십 [b,c]
    const jlen = ps ? ps.journal.length : -1;
    ps.crash(); const afterCrash = memOf(ps);   // crash → projection 소실(빈 멤버십)
    ps.reconstruct(); const afterRec = memOf(ps);   // 저널 replay → 멤버십 재구성
    po.crash(); po.reconstruct(); const offRec = memOf(po);   // OFF: 저널 0 → 복원 불가
    // ① 영속·복원 — 죽기 전 [b,c]·저널 3·crash 후 빈 멤버십·reconstruct 후 [b,c](==죽기 전·무손실 failover).
    const restored = eq(before, ['b', 'c']) && jlen === 3 && afterCrash.length === 0 && eq(afterRec, before);
    // ② 대조(OFF) — 영속 0 이면 reconstruct 해도 빈 멤버십(소실)·저널 0.
    const lost = offRec.length === 0 && po.journal.length === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(restored, `seed ${seed}: 영속/복원 틀림(before ${before}·journal ${jlen}·crash ${afterCrash}·rec ${afterRec})`) &&
      check(lost, `seed ${seed}: OFF 소실 미재현(offRec ${offRec}·journal ${po.journal.length})`) &&
      check(nonInvasive, `seed ${seed}: 영속이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad('[' + before.join(',') + ']', 6)} | ${pad(jlen, 7)} | ${pad(afterCrash.length, 7)} | ${pad('[' + afterRec.join(',') + ']', 13)} | ${pad(eq(afterRec, before) + '', 12)} | ${pad('[' + offRec.join(',') + ']', 17)} | ${pad(po.journal.length, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → PartyService 가 *멤버십 변경 저널*(durable)로 crash 를 견딘다: projection(휘발)이 죽어도 저널 replay 가 멤버십을 죽기 전과 비트 동일하게 복원("파티가 박스보다 오래 산다"). 0084 svc.party.changed 스트림이 곧 이 저널의 이벤트(0017/0020/0021 event sourcing 의 멤버십 판·SPINE 계층3).');
  console.log('    partyPersist 미설정 = 0084 비트 동일(저널 0·휴면·reg). 비-침습: 영속은 멤버십 projection 과 직교(저널은 durable·읽기만)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['ppersist'] = ppersist;
kit.ORDER.splice(1, 0, 'ppersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
