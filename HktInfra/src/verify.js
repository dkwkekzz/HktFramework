// HktInfra step-0086 — 헤드리스 검증 (파티 저널 스냅샷 압축)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pcompact`.
//   더한 한 조각: 0085 의 변경 저널은 *무계 성장*이라 가입/탈퇴 누적 시 replay 비용·메모리가 ∝변경 수(0085 §9). 0018 가방·0022 채팅의 *주기 스냅샷+tail replay* 압축을 멤버십 저널에 적용: snapInterval 개 변경마다 멤버십 스냅샷(upToSeq)+그 이하 저널 가지치기 → 저널은 tail 만(유계). reconstruct=스냅샷+tail replay == 전체 저널 replay(무손실).
//   검증: ⒜ `reg`(키트) — snapInterval 0 이면 0085 비트 동일(압축 0). ⒝ `pcompact`(가설) — create p1[a]+join b..f(6 변경)·snapInterval 4 → 압축 1회·저널 tail 2(전체 6 대비). crash→reconstruct(스냅샷+tail)==죽기 전[a..f]. OFF(snapInterval 0): 저널 6(무계)·압축 0. 둘 다 멤버십 동일. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const SNAPI = 4;
const ADDS = ['b', 'c', 'd', 'e', 'f'];   // create p1[a] + join b..f = 6 변경(snapInterval 4 → 압축 1회·저널 tail 2)
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, partyService: true, partyPersist: true,
  partyCreate: [{ at: 40, partyId: 'p1', members: ['a'] }],
  partyOps: ADDS.map((mbr, k) => ({ at: 44 + k * 2, op: 'join', partyId: 'p1', member: mbr })),
  ...extra });

const memOf = (ps) => ps ? ps.membersOf('p1').slice().sort() : null;
const eq = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

function pcompact(seeds) {
  console.log('== pcompact: *가설* — 파티 저널 스냅샷 압축. snapInterval 개 변경마다 멤버십 스냅샷+저널 가지치기 → 저널 tail 만(유계). reconstruct=스냅샷+tail==전체 저널(무손실). 0018/0022 압축의 멤버십 판. partySnapshot ON vs OFF ==');
  console.log(`  create p1[a]+join b..f(6 변경)·snapInterval ${SNAPI} → ON: 압축 1·저널 tail 2·스냅샷 upTo 4. OFF: 저널 6(무계)·압축 0. crash→reconstruct(스냅샷+tail)==죽기 전. 둘 다 멤버십 [a..f].`);
  console.log('seed   | 죽기전     | ON저널 | snaps | OFF저널 | reconstruct후 | 복원==죽기전 | OFF복원 | 비침습 | 판정');
  const WANT = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partySnapshot: SNAPI }) });
    const off = run({ ...P_BASE(seed, { partySnapshot: 0 }) });   // 압축 0 — 저널 무계(0085 동작)
    const ps = on.pservice; const po = off.pservice;
    const before = memOf(ps);
    const onJ = ps ? ps.journal.length : -1; const snaps = ps ? ps.snapshots : -1; const offJ = po ? po.journal.length : -1;
    ps.crash(); ps.reconstruct(); const onRec = memOf(ps);
    po.crash(); po.reconstruct(); const offRec = memOf(po);
    // ① 압축·무손실 — ON 저널 tail 유계(<전체 6)·스냅샷 1회·reconstruct(스냅샷+tail)==죽기 전[a..f].
    const compacted = eq(before, WANT) && onJ < ADDS.length + 1 && onJ <= SNAPI && snaps >= 1 && eq(onRec, before);
    // ② 대조(OFF) — 압축 0 이면 저널 전체(6)·스냅샷 0·reconstruct 도 [a..f](압축은 무손실이라 멤버십 동일).
    const full = offJ === ADDS.length + 1 && po.snapshots === 0 && eq(offRec, WANT);
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(compacted, `seed ${seed}: 압축/무손실 틀림(before ${before}·onJ ${onJ}·snaps ${snaps}·rec ${onRec})`) &&
      check(full, `seed ${seed}: OFF 무계 미재현(offJ ${offJ}·snaps ${po.snapshots}·rec ${offRec})`) &&
      check(nonInvasive, `seed ${seed}: 압축이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad('[' + before.join(',') + ']', 10)} | ${pad(onJ, 6)} | ${pad(snaps, 5)} | ${pad(offJ, 7)} | ${pad('[' + onRec.join(',') + ']', 13)} | ${pad(eq(onRec, before) + '', 12)} | ${pad('[' + offRec.join(',') + ']', 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 멤버십 저널이 *주기 스냅샷+tail* 로 압축돼 유계가 된다: 스냅샷이 upToSeq 이하를 대신하고 tail 만 replay 해도 전체 저널 replay 와 *비트 동일*(무손실). 무계 성장(0085)을 0018 가방·0022 채팅과 같은 패턴으로 해소(SPINE 계층3·6).');
  console.log('    snapInterval 0 = 0085 비트 동일(압축 0·저널 무계·reg). 비-침습: 압축은 저널 표현만 유계화(멤버십 projection·복원 결과 불변)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['pcompact'] = pcompact;
kit.ORDER.splice(1, 0, 'pcompact');

(async () => { process.exit(await kit.cli(process.argv)); })();
