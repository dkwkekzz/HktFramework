// HktInfra step-0060 — 헤드리스 검증 (프레즌스 *발행*: orch 의 소비자 건강 판정을 svc.presence 버스 이벤트로→다른 서비스 구독·presencePublish)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `publish`.
//   더한 한 조각: 0055~0059 의 소비자 건강 판정(down/up/permanent)은 orch *사유 상태*(consumerDown/permanentDown)였다 — 오직 orch 만 안다. 이제 그 판정을 svc.presence 버스 이벤트로 발행해 *다른 서비스*(audit·미래의 모니터링/대시보드/대체 spawn)가 구독·반응할 수 있게 한다. 0054 가 lease 를 관측 가능하게 한 것의 *프레즌스 판정* 판 — 프레즌스가 1급 발행 신호.
//   검증: ⒜ `reg`(키트) — presencePublish=0 이면 0059 비트 동일(발행 0). ⒝ `publish`(가설) — 치유: down+up 2건 발행·audit 1:1 수신 / 영구 분실: down+permanent 2건·audit 수신·permanentDown={ranking}. OFF 면 발행/수신 0. 비-침습(minted 동일).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3;
const aud = (r) => r.audit.seen.get('svc.presence') || 0;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, ...extra });

function publish(seeds) {
  console.log('== publish: *가설* — orch 의 소비자 건강 판정(down/up/permanent)을 svc.presence 버스 이벤트로 발행→audit(범용 sink)가 구독·수신. presencePublish ON vs OFF ==');
  console.log(`  치유(rankDie ${DEAD_DIE}): down+up 2건 발행. 영구 분실(dropRecover ${PERM}·상한 ${CAP}): down+permanent 2건. audit 가 발행 수와 1:1 수신(무손실)·OFF 면 0.`);
  console.log('seed   | heal pub/audit | perm pub/audit | perm permDown | OFF pub/audit | 비침습 | 판정');
  for (const seed of seeds) {
    const heal = run({ ...P_BASE(seed, { presencePublish: true, rankDie: DEAD_DIE }) });
    const perm = run({ ...P_BASE(seed, { presencePublish: true, dropRecover: PERM, recoverMaxRetries: CAP, rankDie: DEAD_DIE }) });
    const off  = run({ ...P_BASE(seed, { rankDie: DEAD_DIE }) });   // presencePublish OFF
    const healOk = heal.orch.presencePublished === 2 && aud(heal) === 2;           // down+up·audit 1:1
    const permOk = perm.orch.presencePublished === 2 && aud(perm) === 2 && perm.orch.permanentDown.has('ranking');   // down+permanent
    const offNone = off.orch.presencePublished === 0 && aud(off) === 0;
    const delivered = aud(heal) === heal.orch.presencePublished && aud(perm) === perm.orch.presencePublished;   // 무손실 전달
    const nonInvasive = heal.inventory.minted === off.inventory.minted && perm.inventory.minted === off.inventory.minted;
    const ok =
      check(healOk, `seed ${seed}: 치유 발행 불일치(pub ${heal.orch.presencePublished} audit ${aud(heal)})`) &&
      check(permOk, `seed ${seed}: 영구 발행 불일치(pub ${perm.orch.presencePublished} audit ${aud(perm)} permDown ${[...perm.orch.permanentDown]})`) &&
      check(delivered, `seed ${seed}: 발행≠수신(무손실 깨짐)`) &&
      check(offNone, `seed ${seed}: OFF 인데 발행/수신(${off.orch.presencePublished}/${aud(off)})`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted heal ${heal.inventory.minted} perm ${perm.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(heal) && itemConserved(heal) && ledgerConsistent(perm) && itemConserved(perm), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(heal.orch.presencePublished + '/' + aud(heal), 14)} | ${pad(perm.orch.presencePublished + '/' + aud(perm), 14)} | ${pad('{' + [...perm.orch.permanentDown] + '}', 13)} | ${pad(off.orch.presencePublished + '/' + aud(off), 13)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 프레즌스가 1급 발행 신호: orch 의 건강 판정(down/up/permanent)이 svc.presence 버스 이벤트로 나가 audit 가 1:1 수신(무손실). 이제 *어떤 서비스*든 구독해 소비자 건강에 반응할 수 있다(모니터링·대시보드·대체 spawn 토대) — 0054 가 lease 를 관측 가능하게 한 것의 프레즌스 판정 판.');
  console.log('    presencePublish=0 = 0059 비트 동일(발행 0·reg). 비-침습: ON/OFF minted 동일(순수 제어 평면·발행은 관측일 뿐 원장 권위 불변).');
}

kit.MODES['publish'] = publish;
kit.ORDER.splice(1, 0, 'publish');

(async () => { process.exit(await kit.cli(process.argv)); })();
