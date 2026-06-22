// HktInfra step-0097 — 헤드리스 검증 (귓속말 반송 발행·관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pbounce`.
//   더한 한 조각: 0082(포기)·0087(성공)·0093/0095(파티 종결) 발행은 전달 수명주기 대부분을 관측 스트림에 실었지만, *반송*(대상 down/permanent 으로 즉시 도달 불가)은 라우터 내부 카운터(bounced)에만 남았다. 이 step 은 반송을 svc.whisper.bounced{to,from,state} 로 발행 → audit 구독. 0082 failed(유계 재시도 소진 후 포기)와 달리 *즉시 도달 불가*(프레즌스 down/permanent 판정) — 전달 결말의 셋째 종류.
//   검증: ⒜ `reg`(키트) — bouncePublish 미설정이면 0096 비트 동일(발행 0·구독 행 0). ⒝ `pbounce`(가설) — ranking 을 permanent(rankDie+dropRecover)로 만들고 거기로 귓속말 → 반송. ON: bouncePublished 1·audit svc.whisper.bounced 1·bounced 1. OFF: 0·0·bounced 1(여전히 카운트). minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const WHISPER_AT = 60;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  recoverMaxRetries: 3, dropRecover: 99,   // ranking 치유를 막아 permanentDown 으로 → 거기로 보낸 귓속말은 *반송*
  whispers: [{ at: WHISPER_AT, from: 'client0', to: 'ranking', body: 'hi-rank' }],
  ...extra });

function pbounce(seeds) {
  console.log('== pbounce: *가설* — 귓속말 반송 발행. 대상 down/permanent(즉시 도달 불가) 반송을 svc.whisper.bounced 발행 → audit 관측(0082 failed 와 달리 즉시 도달 불가·전달 결말의 셋째 종류). bouncePublish ON vs OFF ==');
  console.log('  ranking permanent(rankDie+dropRecover)·거기로 귓속말. ON: bouncePublished 1·audit svc.whisper.bounced 1·bounced 1. OFF: 0·0·bounced 1(내부 카운터만).');
  console.log('seed   | bounced | pub ON | audit ON | pub OFF | audit OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { bouncePublish: true }) });
    const off = run({ ...P_BASE(seed, { bouncePublish: false }) });   // 발행 0(0096 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const bnOn = wr ? wr.bounced : -1;
    const pubOn = wr ? wr.bouncePublished : -1;
    const pubOff = wo ? wo.bouncePublished : -1;
    const auOn = on.audit ? (on.audit.seen.get('svc.whisper.bounced') || 0) : -1;
    const auOff = off.audit ? (off.audit.seen.get('svc.whisper.bounced') || 0) : -1;
    // ① 발행+관측 — 반송 1·발행 1·audit 관측 1.
    const published = bnOn === 1 && pubOn === 1 && auOn === 1;
    // ② 대조(OFF) — 발행 0·audit 미관측 0·반송은 여전히 1(라우팅 판정 자체는 0096 불변).
    const silent = wo && wo.bounced === 1 && pubOff === 0 && auOff === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(published, `seed ${seed}: 발행/관측 틀림(bounced ${bnOn}·pub ${pubOn}·audit ${auOn}·기대 1/1/1)`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(bounced ${wo && wo.bounced}·pub ${pubOff}·audit ${auOff}·기대 1/0/0)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(bnOn, 7)} | ${pad(pubOn, 6)} | ${pad(auOn, 8)} | ${pad(pubOff, 7)} | ${pad(auOff, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 전달 결말이 관측 평면에 모두 실린다: 성공(svc.whisper.delivered·0087)·포기(svc.whisper.failed·0082·유계 재시도 소진)·*반송*(svc.whisper.bounced·0097·즉시 도달 불가). 같은 audit sink 가 전달의 세 종류 결말을 한 스트림으로 본다(SPINE 계층3·5 전달 수명주기 관측 완성).');
  console.log('    bouncePublish 미설정 = 발행 0·구독 행 0 = 0096 비트 동일(reg). 비-침습: 발행은 관측 평면 추가일 뿐 라우팅 판정 불변(bounced·minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pbounce'] = pbounce;
kit.ORDER.splice(1, 0, 'pbounce');

(async () => { process.exit(await kit.cli(process.argv)); })();
