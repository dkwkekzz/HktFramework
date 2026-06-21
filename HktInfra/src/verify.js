// HktInfra step-0070 — 헤드리스 검증 (failover 중 질의 연속성: 승격 공지→질의자 재타깃·presenceAnnounce)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `presqcont`.
//   더한 한 조각: 0067 failover 는 *발행(push)* 경로 연속성만 줬다(승격 standby 가 svc.presence 인계 발행). 0069 *질의(pull)* 경로는 질의자가 고정 주소(primary)를 가리켜 primary 사망 후 끊겼다(0069 §9). 이 step 은 그 고리: standby 가 승격 시 svc.presence.active 로 새 active 주소를 *공지*, 질의자(presmon)가 구독해 queryAddr 를 *재타깃* → 죽음 후 질의도 승격된 박스가 답한다(읽기 경로 failover 디스커버리).
//   검증: ⒜ `reg`(키트) — presenceAnnounce 미설정이면 0069 비트 동일(공지·재타깃 0). ⒝ `presqcont`(가설) — ON: 승격 공지(announced 1)→presmon 재타깃(retargets 1·queryAddr presence2)→죽음 후 질의를 승격된 박스가 답함(presence2 repliesSent>0)·질의 무손실(recv==sent)·queried[ranking]=permanent(fresh). OFF: 재타깃 0→죽음 후 질의가 죽은 primary 로 감(presence2 repliesSent 0·손실 recv<sent·queried[ranking]=down stale). minted 동일.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const FAIL_AT = 30;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, presenceFailover: { at: FAIL_AT }, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;

function presqcont(seeds) {
  console.log('== presqcont: *가설* — primary 사망(t' + FAIL_AT + ') 후 승격된 standby 가 svc.presence.active 공지→presmon 재타깃→죽음 후 질의도 답함(읽기 경로 failover 연속성). presenceAnnounce ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}·failover@${FAIL_AT}. ON: announced 1·retargets 1·presence2 답함·무손실·queried[ranking]=permanent. OFF: 재타깃 0·죽은 primary 로 질의→손실·queried[ranking]=down(stale).`);
  console.log('seed   | announced/retarget | presmon q/recv | pri/std repliesSent | queried ranking | push state | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, presenceAnnounce: true }) });
    const off = run({ ...P_BASE(seed, base) });   // presenceAnnounce OFF — 공지·재타깃 0(질의자 고정 주소)
    const pm = on.presmon; const pri = on.presence; const std = on.presenceShadow;
    // ① 승격 공지 + 재타깃 — standby 가 승격하며 active 주소 공지·presmon 이 queryAddr 를 presence2 로 갱신
    const retarget = std.announced === 1 && pm.retargets === 1 && pm.queryAddr === 'presence2' && off.presmon.retargets === 0 && off.presmon.queryAddr === 'presence';
    // ② 읽기 경로 연속성 — 죽음 전 질의는 primary 가(pri.repliesSent>0), 죽음 후 질의는 승격된 standby 가(std.repliesSent>0) 답함. 질의 무손실(recv==sent).
    const continuity = pri.repliesSent > 0 && std.repliesSent > 0 && pm.repliesRecv === pm.queriesSent;
    const freshRead = pm.queriedOf('ranking') === 'permanent';   // 재타깃 덕에 죽음 후 질의가 최신 SSOT(permanent)를 받음
    // ③ 대조(OFF) — 재타깃 없으면 죽음 후 질의가 죽은 primary 로 감 → std 답 0·손실(recv<sent)·stale read
    const offGap = off.presenceShadow.repliesSent === 0 && off.presmon.repliesRecv < off.presmon.queriesSent && off.presmon.queriedOf('ranking') === 'down';
    // 발행(push) 경로는 둘 다 연속(0067) — presmon 관측 state 둘 다 permanent(질의/발행 직교)
    const pushOk = pmState(on) === 'permanent' && pmState(off) === 'permanent';
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(retarget, `seed ${seed}: 공지/재타깃 실패(announced ${std.announced}·retargets ${pm.retargets}·addr ${pm.queryAddr}·off retargets ${off.presmon.retargets})`) &&
      check(continuity, `seed ${seed}: 읽기 연속성 깨짐(pri ${pri.repliesSent} std ${std.repliesSent} recv ${pm.repliesRecv} sent ${pm.queriesSent})`) &&
      check(freshRead, `seed ${seed}: 죽음 후 질의 stale(queried ${pm.queriedOf('ranking')} 기대 permanent)`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(std ${off.presenceShadow.repliesSent}·recv ${off.presmon.repliesRecv}/sent ${off.presmon.queriesSent}·queried ${off.presmon.queriedOf('ranking')})`) &&
      check(pushOk, `seed ${seed}: 발행 경로 불연속(on ${pmState(on)} off ${pmState(off)})`) &&
      check(nonInvasive, `seed ${seed}: 공지가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(std.announced + '/' + pm.retargets + '→' + pm.queryAddr, 18)} | ${pad(pm.queriesSent + '/' + pm.repliesRecv, 14)} | ${pad(pri.repliesSent + '/' + std.repliesSent, 19)} | ${pad(pm.queriedOf('ranking') + '/' + off.presmon.queriedOf('ranking'), 15)} | ${pad(pmState(on) + '', 10)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 승격된 박스가 svc.presence.active 로 새 주소를 공지하고 질의자가 재타깃 → 죽음 후 질의도 승격된 박스가 답한다(읽기 경로 failover 디스커버리). 발행(0067)·질의(이 step) *둘 다* failover 를 가로질러 연속 — 프레즌스 박스가 진짜 failover-safe SSOT.');
  console.log('    presenceAnnounce 미설정 = 0069 비트 동일(공지·재타깃 0·reg). OFF 면 질의자가 죽은 primary 를 계속 가리켜 죽음 후 읽기 손실·stale(queried down). 비-침습: minted ON==OFF.');
}

kit.MODES['presqcont'] = presqcont;
kit.ORDER.splice(1, 0, 'presqcont');

(async () => { process.exit(await kit.cli(process.argv)); })();
