// HktInfra step-0063 — 헤드리스 검증 (프레즌스 모니터: svc.presence 의 down/up/permanent 를 구독해 소비자별 건강 상태 기계 유지·presenceMonitor)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `monitor`.
//   더한 한 조각: 0060 §9 는 프레즌스 발행의 반응자로 *모니터링 대시보드·대체 spawn·알림*을 예고했다. 0061 이 *대체 spawn*(행동)을 더했다면, 이 step 은 *모니터링 대시보드*(관측) — svc.presence 를 구독해 소비자별 *상태 기계*(현재 down/up/permanent + 전이 회계)를 유지하는 구조적 읽기 모델(SPINE 계층 5 세션/프레즌스의 "누가 어디에" 관측 면). audit(0016)이 토픽별 수만 세는 범용 sink 라면, presmon 은 프레즌스 특화 상태 기계.
//   검증: ⒜ `reg`(키트) — presenceMonitor=0 이면 0062 비트 동일(박스·구독 0). ⒝ `monitor`(가설) — 치유(rankDie): presmon ranking 상태 'up'·down 1·up 1 / 영구 분실(dropRecover+상한): 'permanent'·down 1·perm 1. 발행 수와 events 1:1(무손실 관측). OFF 면 presmon 없음. 발행자·기존 소비자 무수정·비-침습.
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
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  rankDie: DEAD_DIE, ...extra });

const pub = (r) => r.orch.presencePublished;
const ev = (r) => r.presmon ? r.presmon.events : -1;
const st = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const cnt = (r, mp) => (r.presmon && r.presmon[mp].get('ranking')) || 0;

function monitor(seeds) {
  console.log('== monitor: *가설* — presmon 이 svc.presence(down/up/permanent)를 구독해 소비자별 건강 *상태 기계*를 유지. presenceMonitor ON vs OFF ==');
  console.log(`  치유(rankDie ${DEAD_DIE}): ranking down→up → 상태 'up'·down 1·up 1. 영구 분실(dropRecover ${PERM}·상한 ${CAP}): down→permanent → 'permanent'·down 1·perm 1. events==발행(무손실).`);
  console.log('seed   | heal 상태/cnt | perm 상태/cnt | ev==pub | off presmon | 비침습 | 판정');
  for (const seed of seeds) {
    const heal = run({ ...P_BASE(seed, { presenceMonitor: true }) });
    const perm = run({ ...P_BASE(seed, { presenceMonitor: true, dropRecover: PERM, recoverMaxRetries: CAP }) });
    const off  = run({ ...P_BASE(seed) });   // presenceMonitor OFF
    const healOk = st(heal) === 'up' && cnt(heal, 'downCount') === 1 && cnt(heal, 'upCount') === 1;
    const permOk = st(perm) === 'permanent' && cnt(perm, 'downCount') === 1 && cnt(perm, 'permCount') === 1;
    const lossless = ev(heal) === pub(heal) && ev(perm) === pub(perm);   // 관측==발행(무손실)
    const offNone = off.presmon === null;
    const nonInvasive = heal.inventory.minted === off.inventory.minted && perm.inventory.minted === off.inventory.minted;
    const ok =
      check(healOk, `seed ${seed}: 치유 상태 불일치(상태 ${st(heal)} down ${cnt(heal,'downCount')} up ${cnt(heal,'upCount')})`) &&
      check(permOk, `seed ${seed}: 영구 상태 불일치(상태 ${st(perm)} down ${cnt(perm,'downCount')} perm ${cnt(perm,'permCount')})`) &&
      check(lossless, `seed ${seed}: 관측!=발행(heal ${ev(heal)}/${pub(heal)} perm ${ev(perm)}/${pub(perm)})`) &&
      check(offNone, `seed ${seed}: OFF 인데 presmon 존재`) &&
      check(nonInvasive, `seed ${seed}: 모니터가 원장 권위 바꿈`) &&
      check(ledgerConsistent(heal) && itemConserved(heal) && ledgerConsistent(perm) && itemConserved(perm), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(st(heal) + ' ' + cnt(heal,'downCount') + '/' + cnt(heal,'upCount'), 13)} | ${pad(st(perm) + ' ' + cnt(perm,'downCount') + '/' + cnt(perm,'permCount'), 13)} | ${pad(ev(heal) + '/' + pub(heal), 7)} | ${pad(offNone + '', 11)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → presmon 은 프레즌스 특화 *상태 기계*("누가 지금 어떤 상태인가" 대시보드·SPINE 계층 5 관측 면). 0061 의 대체 spawn(행동)과 짝 — 같은 svc.presence 신호에 *관측자*가 발행자 무수정으로 얹힌다(0016 decouple).');
  console.log('    presenceMonitor=0 = 0062 비트 동일(박스·구독 0·reg). events==발행 = 무손실 관측. 비-침습: 발신 0·원장 권위 불변.');
}

kit.MODES['monitor'] = monitor;
kit.ORDER.splice(1, 0, 'monitor');

(async () => { process.exit(await kit.cli(process.argv)); })();
