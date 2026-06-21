// HktInfra step-0072 — 헤드리스 검증 (귓속말 라우터 failover 연속성: 승격 공지→라우터 재타깃·whisperFailover)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `whisperfo`.
//   더한 한 조각: 0071 의 귓속말 라우터는 queryAddr 를 *고정*(primary 프레즌스 박스)으로 가리켜, primary 사망 후 귓속말 질의가 죽은 박스로 가 끊긴다(0071 §9). 0070 이 presmon 에 준 해법(svc.presence.active 공지→queryAddr 재타깃)을 *라우터*에 적용 → primary 사망 후 귓속말도 승격된 박스로 질의돼 라우팅 연속(읽기 경로 failover 디스커버리의 라우팅 판).
//   검증: ⒜ `reg`(키트) — whisperFailover 미설정이면 0071 비트 동일(wrouter 의 svc.presence.active 구독·재타깃 0). ⒝ `whisperfo`(가설) — primary 프레즌스 박스 사망(t30)→standby 자율 승격→active 공지. 사망 *후*(t50) 귓속말. ON: 라우터 재타깃(retargets 1·queryAddr presence2)→승격 박스가 질의 답함(질의 무손실 recv==sent==2·routed 1·bounced 1). OFF: 재타깃 0→죽은 primary 로 질의→손실(recv<sent)·귓속말 미해소(routed+bounced<2). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const FAIL_AT = 30; const WHISPER_AT = 50;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, presenceAnnounce: true, presenceFailover: { at: FAIL_AT }, whisperRouter: true, rankDie: DEAD_DIE,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'inventory', body: 'hi' }, { at: WHISPER_AT, from: 'client1', to: 'ranking', body: 'yo' }],
  ...extra });

function whisperfo(seeds) {
  console.log('== whisperfo: *가설* — primary 프레즌스 박스 사망(t' + FAIL_AT + ')→standby 자율 승격→active 공지. 사망 후(t' + WHISPER_AT + ') 귓속말이 승격된 박스로 질의돼 라우팅 연속. whisperFailover ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}·failover@${FAIL_AT}·귓속말@${WHISPER_AT}. ON: retargets 1·queryAddr presence2·routed 1·bounced 1·무손실. OFF: 재타깃 0·죽은 primary 질의→손실·미해소.`);
  console.log('seed   | retarget→addr | queries q/recv | routed/bounced | decision inv/rank | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, whisperFailover: true }) });
    const off = run({ ...P_BASE(seed, base) });   // whisperFailover OFF — wrouter 가 svc.presence.active 미구독(재타깃 0·죽은 primary 고정)
    const wr = on.wrouter; const wo = off.wrouter;
    // ① 라우터 재타깃 — 승격 박스(presence2)로 queryAddr 갱신(공지 구독). OFF 는 고정(primary).
    const retarget = wr.retargets === 1 && wr.queryAddr === 'presence2' && wo.retargets === 0 && wo.queryAddr === 'presence';
    // ② 라우팅 연속성 — 사망 후 질의가 승격 박스로 가 답을 받음(무손실 recv==sent==2)·라우팅 완료(routed 1 inventory up·bounced 1 ranking permanent).
    const continuity = wr.queriesSent === 2 && wr.repliesRecv === 2 && wr.routed === 1 && wr.bounced === 1;
    const decisionOk = wr.decisionOf('inventory') === 'routed' && wr.decisionOf('ranking') === 'bounced';
    // ③ 대조(OFF) — 재타깃 없으면 사망한 primary 로 질의 → 응답 손실(recv<sent)·귓속말 미해소(routed+bounced<2).
    const offGap = wo.repliesRecv < wo.queriesSent && (wo.routed + wo.bounced) < 2;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(retarget, `seed ${seed}: 재타깃 실패(retargets ${wr.retargets}·addr ${wr.queryAddr}·off ${wo.retargets}/${wo.queryAddr})`) &&
      check(continuity, `seed ${seed}: 라우팅 연속성 깨짐(q ${wr.queriesSent} recv ${wr.repliesRecv} routed ${wr.routed} bounced ${wr.bounced})`) &&
      check(decisionOk, `seed ${seed}: 라우팅 판정 틀림(inv ${wr.decisionOf('inventory')} rank ${wr.decisionOf('ranking')})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(recv ${wo.repliesRecv}/sent ${wo.queriesSent}·routed ${wo.routed}·bounced ${wo.bounced})`) &&
      check(nonInvasive, `seed ${seed}: 라우터가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr.retargets + '→' + wr.queryAddr, 13)} | ${pad(wr.queriesSent + '/' + wr.repliesRecv, 14)} | ${pad(wr.routed + '/' + wr.bounced, 14)} | ${pad(wr.decisionOf('inventory') + '/' + wr.decisionOf('ranking'), 17)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → primary 프레즌스 박스 사망 후, 승격된 standby 가 svc.presence.active 로 공지하고 라우터가 queryAddr 를 재타깃 → 사망 후 귓속말도 승격 박스로 질의돼 라우팅이 연속(읽기 경로 failover 디스커버리의 라우팅 판·0070 presmon 재타깃을 라우터에). 귓속말 라우팅이 프레즌스 failover 를 가로질러 끊기지 않는다.');
  console.log('    whisperFailover 미설정 = 0071 비트 동일(wrouter 의 active 구독·재타깃 0·reg). OFF 면 라우터가 죽은 primary 를 계속 가리켜 사망 후 귓속말 질의 손실·미해소. 비-침습: minted ON==OFF.');
}

kit.MODES['whisperfo'] = whisperfo;
kit.ORDER.splice(1, 0, 'whisperfo');

(async () => { process.exit(await kit.cli(process.argv)); })();
