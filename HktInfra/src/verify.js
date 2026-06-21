// HktInfra step-0074 — 헤드리스 검증 (재타깃 윈도 질의 재시도·whisperRetry)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `whisperretry`.
//   더한 한 조각: 0072 의 재타깃은 primary 사망 *후* 도착한 질의만 구한다 — 승격 공지가 라우터에 닿기 *전*의 윈도(사망~공지 전파)에 보낸 질의는 죽은 primary 로 가 영영 손실(0072 §9). 이 step 은 라우터가 재타깃(svc.presence.active)할 때 아직 응답 못 받은 *보류 질의*를 새 active 주소로 재발신 → 윈도 손실분도 승격 박스로 다시 가 답을 받는다(0058 recoverRetry 의 질의 판·공지가 재시도 구동·onTick 0).
//   검증: ⒜ `reg`(키트) — whisperRetry 미설정이면 0073 비트 동일(재발신 0). ⒝ `whisperretry`(가설) — primary 사망(t30) 윈도(t31·공지 전)에 귓속말. 둘 다 재타깃됨(retargets 1). ON: 보류 질의 재발신(retries 2)→해소(routed 1·bounced 1·pending 0). OFF: 재발신 0→윈도 질의 영구 손실(routed+bounced 0·pending 2). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const FAIL_AT = 30; const WHISPER_AT = 31;   // t31 = 승격 공지(promote~t34) 전 윈도
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, presenceAnnounce: true, presenceFailover: { at: FAIL_AT }, whisperRouter: true, whisperFailover: true, rankDie: DEAD_DIE,
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'inventory', body: 'hi' }, { at: WHISPER_AT, from: 'client1', to: 'ranking', body: 'yo' }],
  ...extra });

function whisperretry(seeds) {
  console.log('== whisperretry: *가설* — primary 사망(t' + FAIL_AT + ') 윈도(t' + WHISPER_AT + '·공지 전)에 귓속말 → 죽은 primary 로 질의 손실. 재타깃 시 보류 질의 재발신으로 복구. whisperRetry ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}·failover@${FAIL_AT}·귓속말@${WHISPER_AT}(공지 전 윈도). 둘 다 재타깃 1. ON: retries 2→routed 1·bounced 1·pending 0. OFF: retries 0→손실(routed+bounced 0·pending 2).`);
  console.log('seed   | retargets | retries | routed/bounced | pending | decision inv/rank | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, whisperRetry: true }) });
    const off = run({ ...P_BASE(seed, base) });   // whisperRetry OFF — 재타깃은 주소만 갱신·보류 질의 방치(윈도 손실 영구)
    const wr = on.wrouter; const wo = off.wrouter;
    // ① 둘 다 재타깃됨(retargets 1) — 재시도 *외의* failover 경로는 동일. 차이는 보류 질의 재발신뿐.
    const bothRetarget = wr.retargets === 1 && wo.retargets === 1;
    // ② 윈도 복구(ON) — 보류 질의 재발신(retries 2)→전부 해소(routed 1 inventory·bounced 1 ranking·pending 0).
    const recovered = wr.retries === 2 && wr.routed === 1 && wr.bounced === 1 && wr.pendingCount() === 0;
    const decisionOk = wr.decisionOf('inventory') === 'routed' && wr.decisionOf('ranking') === 'bounced';
    // ③ 대조(OFF) — 재발신 0 → 윈도 질의 영구 손실(routed+bounced 0·pending 2 미해소).
    const offGap = wo.retries === 0 && (wo.routed + wo.bounced) === 0 && wo.pendingCount() === 2;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(bothRetarget, `seed ${seed}: 재타깃 비대칭(on ${wr.retargets} off ${wo.retargets})`) &&
      check(recovered, `seed ${seed}: 윈도 복구 실패(retries ${wr.retries} routed ${wr.routed} bounced ${wr.bounced} pending ${wr.pendingCount()})`) &&
      check(decisionOk, `seed ${seed}: 라우팅 판정 틀림(inv ${wr.decisionOf('inventory')} rank ${wr.decisionOf('ranking')})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(retries ${wo.retries} routed ${wo.routed} bounced ${wo.bounced} pending ${wo.pendingCount()})`) &&
      check(nonInvasive, `seed ${seed}: 라우터가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr.retargets + '/' + wo.retargets, 9)} | ${pad(wr.retries + '/' + wo.retries, 7)} | ${pad(wr.routed + '/' + wr.bounced, 14)} | ${pad(wr.pendingCount() + '/' + wo.pendingCount(), 7)} | ${pad(wr.decisionOf('inventory') + '/' + wr.decisionOf('ranking'), 17)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재타깃은 주소만 갱신할 뿐, 윈도(사망~공지 전파)에 이미 죽은 primary 로 보낸 질의는 OFF 면 영구 손실된다(0072 §9). ON 은 재타깃 시 보류 질의를 새 주소로 재발신 → 윈도 손실분도 승격 박스로 다시 가 라우팅이 끝까지 완결(읽기 경로 at-least-once·0058 recoverRetry 의 질의 판). 공지가 재시도를 구동(onTick 0).');
  console.log('    whisperRetry 미설정 = 0073 비트 동일(재발신 0·reg). OFF 면 재타깃돼도 윈도 질의는 방치돼 손실(pending 잔존). 비-침습: minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['whisperretry'] = whisperretry;
kit.ORDER.splice(1, 0, 'whisperretry');

(async () => { process.exit(await kit.cli(process.argv)); })();
