// HktInfra step-0071 — 헤드리스 검증 (귓속말 라우터: 프레즌스 질의로 라우팅·whisperRouter)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `whisper`.
//   더한 한 조각: 0069/0070 은 프레즌스 SSOT 의 *질의 인터페이스*(presenceQuery→presenceReply·pull)와 그 failover 연속성을 세웠지만, 질의자는 presmon(관찰 모델·"질의가 도는가" 대역)이었다. 이 step 은 그 인터페이스의 첫 *진짜* 라우팅 소비자를 더한다 — 클라가 귓속말을 보내면 라우터(wrouter)가 대상 상태를 프레즌스 SSOT 에 질의→그 답으로 라우팅 결정(up=전달·down/permanent=반송). SPINE 계층5: 프레즌스 SSOT 가 귓속말·파티·핸드오프 라우팅의 단일 조회처라는 큰 그림의 첫 라우팅 소비자.
//   검증: ⒜ `reg`(키트) — whisperRouter 미설정이면 0070 비트 동일(wrouter 박스 0). ⒝ `whisper`(가설) — ON: 귓속말 to 'inventory'(up)→전달(routed 1)·to 'ranking'(permanent)→반송(bounced 1)·질의 무손실(recv==sent==2)·decision[inventory]=routed/[ranking]=bounced. OFF(whisperRouter 끔): wrouter 부재 → 라우팅 0(대상 상태 모름·귓속말 미도달). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const WHISPER_AT = 80;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, rankDie: DEAD_DIE, ...extra });

function whisper(seeds) {
  console.log('== whisper: *가설* — 클라 귓속말을 라우터가 프레즌스 SSOT 에 질의→대상 상태로 라우팅(up 전달·permanent 반송). whisperRouter ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}·귓속말@${WHISPER_AT}: to 'inventory'(up)·to 'ranking'(permanent). ON: routed 1·bounced 1·질의 무손실(recv==sent==2). OFF: wrouter 부재→라우팅 0.`);
  console.log('seed   | queries q/recv | routed/bounced | decision inv/rank | wrouter on/off | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP,
      whispers: [{ at: WHISPER_AT, from: 'client0', to: 'inventory', body: 'hi' }, { at: WHISPER_AT, from: 'client1', to: 'ranking', body: 'yo' }] };
    const on  = run({ ...P_BASE(seed, { ...base, whisperRouter: true }) });
    const off = run({ ...P_BASE(seed, base) });   // whisperRouter OFF — wrouter 박스 부재(주입 0·라우팅 없음)
    const wr = on.wrouter;
    // ① 질의 무손실 — 귓속말 2건 각각 presence 질의 1건·응답 1건(recv==sent==2). 라우터가 SSOT 인터페이스를 실제 호출.
    const lossless = wr && wr.queriesSent === 2 && wr.repliesRecv === 2;
    // ② 프레즌스가 라우팅을 구동 — up 대상(inventory)은 전달(routed 1), permanent 대상(ranking)은 반송(bounced 1).
    const routedOk = wr && wr.routed === 1 && wr.bounced === 1;
    const decisionOk = wr && wr.decisionOf('inventory') === 'routed' && wr.decisionOf('ranking') === 'bounced';
    // ③ 대조(OFF) — whisperRouter 끄면 wrouter 박스가 없다(라우팅 인프라 부재 = 귓속말이 프레즌스를 못 묻고 미도달).
    const offGap = off.wrouter === null;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(lossless, `seed ${seed}: 질의 무손실 깨짐(sent ${wr && wr.queriesSent} recv ${wr && wr.repliesRecv})`) &&
      check(routedOk, `seed ${seed}: 라우팅 수치 틀림(routed ${wr && wr.routed} bounced ${wr && wr.bounced})`) &&
      check(decisionOk, `seed ${seed}: 라우팅 판정 틀림(inv ${wr && wr.decisionOf('inventory')} rank ${wr && wr.decisionOf('ranking')})`) &&
      check(offGap, `seed ${seed}: OFF 대조 깨짐(wrouter ${off.wrouter})`) &&
      check(nonInvasive, `seed ${seed}: 라우터가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad((wr ? wr.queriesSent : 0) + '/' + (wr ? wr.repliesRecv : 0), 14)} | ${pad((wr ? wr.routed : 0) + '/' + (wr ? wr.bounced : 0), 14)} | ${pad((wr ? wr.decisionOf('inventory') : '-') + '/' + (wr ? wr.decisionOf('ranking') : '-'), 17)} | ${pad((on.wrouter ? 'box' : 'none') + '/' + (off.wrouter ? 'box' : 'none'), 14)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 라우터가 "대상이 어디에/어떤 상태인가"를 프레즌스 SSOT 에 질의(pull)하고 그 답으로 라우팅을 결정한다 — up 은 전달, permanent 는 반송. 0069/0070 질의 인터페이스의 첫 *진짜* 라우팅 소비자(presmon 은 질의자 대역이었다). SPINE 계층5: 프레즌스 SSOT = 귓속말·파티 라우팅의 단일 조회처.');
  console.log('    whisperRouter 미설정 = 0070 비트 동일(wrouter 박스 0·reg). OFF 면 라우팅 인프라 부재. 비-침습: 라우터는 권위 0(질의 소비·전달만)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['whisper'] = whisper;
kit.ORDER.splice(1, 0, 'whisper');

(async () => { process.exit(await kit.cli(process.argv)); })();
