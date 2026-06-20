// HktInfra step-0061 — 헤드리스 검증 (대체 소비자 자동 활성화: standby ranking2 가 svc.presence 'permanent' 신호에 스스로 활성화·역할 인계·spawnReplace)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `spawn`.
//   더한 한 조각: 0060 이 orch 의 'permanent'(포기) 판정을 svc.presence 로 *발행*만 했다(반응 로직 분리). 이 step 은 그 신호에 *행동하는* 첫 반응자 — 사전 등록된 *대기(standby)* 소비자 ranking2 가 svc.presence 의 'permanent'(ranking) 를 받아 스스로 svc.item.out 에 재구독해 죽은 소비자의 역할을 이어받는다(존 shadow follower 승격의 서비스 판).
//   검증: ⒜ `reg`(키트) — spawnReplace=0 이면 0060 비트 동일(액터·구독 0). ⒝ `spawn`(가설) — 영구 분실로 permanent 발행 시: ON 이면 ranking2 활성화(activated)·인계 소비/발행(consumed>0·published>0) / OFF 면 standby 없음(대체 0). 비-침습(minted 동일).
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
const P_BASE = (seed, extra) => ({ seed, ticks: 120, clients: 6, moves: 40, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 40, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  dropRecover: PERM, recoverMaxRetries: CAP, rankDie: DEAD_DIE, ...extra });

function spawn(seeds) {
  console.log('== spawn: *가설* — orch 가 영구 분실 소비자(ranking)를 svc.presence 의 \'permanent\' 로 발행하면, 사전 등록된 대기(standby) 소비자 ranking2 가 스스로 svc.item.out 에 재구독해 역할을 인계. spawnReplace ON vs OFF ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}) → permanent 발행. ON 이면 ranking2 활성화·인계 소비/발행. OFF 면 standby 없음(대체 0).`);
  console.log('seed   | permDown | on act@ | on consumed/pub | off standby | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { spawnReplace: true }) });
    const off = run({ ...P_BASE(seed) });   // spawnReplace OFF
    const permFired = on.orch.permanentDown.has('ranking');
    const r2 = on.ranking2;
    const activated = !!(r2 && r2.activated);
    const tookOver = !!(r2 && r2.consumed > 0 && r2.published > 0);
    const offNoStandby = off.ranking2 === null;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(permFired, `seed ${seed}: permanent 미발행(트리거 불발)`) &&
      check(activated, `seed ${seed}: ranking2 미활성(permanent 신호에 인계 안 함)`) &&
      check(tookOver, `seed ${seed}: ranking2 인계 실패(consumed ${r2 && r2.consumed} pub ${r2 && r2.published})`) &&
      check(offNoStandby, `seed ${seed}: OFF 인데 standby 존재(대체 새어나옴)`) &&
      check(nonInvasive, `seed ${seed}: 대체 활성화가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad('{' + [...on.orch.permanentDown] + '}', 8)} | ${pad(r2 ? r2.activatedAt : '-', 7)} | ${pad((r2 ? r2.consumed : 0) + '/' + (r2 ? r2.published : 0), 15)} | ${pad(offNoStandby + '', 11)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → permanent 신호에 *행동하는* 첫 반응자: 대기 소비자가 영구 down 발행을 받아 스스로 역할을 인계(존 shadow follower 승격의 서비스 판). 0060 이 신호를 발행만 했다면, 이 step 은 그 신호로 *자동 대체*가 일어남을 증명.');
  console.log('    spawnReplace=0 = 0060 비트 동일(액터·구독 0·reg). 비-침습: ON/OFF minted 동일(대체는 읽기 모델 인계일 뿐 원장 권위 불변). 한계: 활성화 *이후* 결과만 인계(다운타임 중 놓친 이력은 late-join reconstruct(0020)가 후속).');
}

kit.MODES['spawn'] = spawn;
kit.ORDER.splice(1, 0, 'spawn');

(async () => { process.exit(await kit.cli(process.argv)); })();
