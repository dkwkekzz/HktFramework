// HktInfra step-0062 — 헤드리스 검증 (대체 소비자 late-join reconstruct: 활성화된 ranking2 가 쓰기 저널 replay 로 다운타임 갭까지 복원·투영==원장·spawnReconstruct)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `recon`.
//   더한 한 조각: 0061 의 대체 소비자(ranking2)는 *활성화 이후* 결과만 인계해 다운타임(원 ranking 사망~활성화) 이력을 놓쳤다(투영이 원장에 뒤처짐·0061 §9). 이 step 은 그 갭을 메운다 — 활성화된 ranking2 가 *쓰기 모델의 영속 저널*(PersistStore)을 reconstruct(ranks 리셋 후 전수 재계산)해 다운타임까지 복원 → 투영==원장. 0020 의 읽기 모델 late-join 을 *대체 소비자*에 적용(CQRS: 휘발 스트림 아닌 내구 저널이 복구원).
//   검증: ⒜ `reg`(키트) — spawnReconstruct=0 이면 0061 비트 동일(reconstruct 0). ⒝ `recon`(가설) — ON 이면 ranking2 활성화 + 투영==원장(갭 복원) / 대조(0061·reconstruct 없음)는 활성화돼도 투영!=원장(다운타임 갭). 비-침습(minted 동일).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent, ledgerCounts } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const RECON_AT = 115;
const P_BASE = (seed, extra) => ({ seed, ticks: 120, clients: 6, moves: 40, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 40, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, persist: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  spawnReplace: true, dropRecover: PERM, recoverMaxRetries: CAP, rankDie: DEAD_DIE, ...extra });

// 대체 소비자 투영 정합 — ranking2.ranks 가 원장 byOwner 와 정확히 일치(다운타임 갭까지 복원되면 true).
function rank2Faithful(r) {
  if (!r.ranking2) return false;
  const truth = ledgerCounts(r);
  const ranks = r.ranking2.ranks;
  for (const [a, n] of truth) if ((ranks.get(a) || 0) !== n) return false;
  for (const [a, n] of ranks) if (n !== (truth.get(a) || 0)) return false;
  return true;
}

function recon(seeds) {
  console.log('== recon: *가설* — 활성화된 대체 소비자 ranking2 가 *쓰기 저널*(PersistStore)을 reconstruct 해 다운타임 갭까지 복원 → 투영==원장. spawnReconstruct ON vs OFF(0061) ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}) → permanent 발행→ranking2 활성화. ON 이면 quiescent tick ${RECON_AT} 에 저널 reconstruct(갭 복원·투영==원장). OFF 면 활성화 이후 부분 투영(갭).`);
  console.log('seed   | act | on 투영==원장 | on r2수 | off 투영==원장 | off r2수 | 원장수 | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { spawnReconstruct: true, reconstructAt: RECON_AT }) });
    const off = run({ ...P_BASE(seed) });   // 0061 — 활성화만, reconstruct 없음
    const activated = !!(on.ranking2 && on.ranking2.activated) && !!(off.ranking2 && off.ranking2.activated);
    const onFaithful = rank2Faithful(on);          // 갭 복원 → 투영==원장
    const offGap = !rank2Faithful(off);            // reconstruct 없음 → 다운타임 갭(투영!=원장)
    const truthN = ledgerCounts(on).size;
    const onN = on.ranking2 ? on.ranking2.ranks.size : 0;
    const offN = off.ranking2 ? off.ranking2.ranks.size : 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(activated, `seed ${seed}: ranking2 미활성(전제 불성립)`) &&
      check(onFaithful, `seed ${seed}: reconstruct 후 투영!=원장(갭 복원 실패·r2 ${onN} vs 원장 ${truthN})`) &&
      check(offGap, `seed ${seed}: reconstruct 없는데 투영==원장(갭이 없음? 대조군 무의미)`) &&
      check(nonInvasive, `seed ${seed}: reconstruct 가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad((on.ranking2 ? on.ranking2.activatedAt : '-'), 3)} | ${pad(onFaithful + '', 13)} | ${pad(onN, 7)} | ${pad((!offGap) + '', 14)} | ${pad(offN, 8)} | ${pad(truthN, 6)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 대체 소비자도 *자기 영속 0* — 활성화로 역할은 인계하되(0061), 다운타임 이력은 *쓰기 저널* reconstruct 로 메운다(0020 의 읽기 모델 late-join 을 대체 소비자에 적용). reconstruct 가 ranks 리셋-재구성이라 라이브 인계분과 이중 계산 0.');
  console.log('    spawnReconstruct=0 = 0061 비트 동일(reconstruct 0·reg). 비-침습: ON/OFF minted 동일. 한계: harness-driven reconstruct(0020 선례) — 자율 저널 fetch(persist 에 버스 요청)는 후속.');
}

kit.MODES['recon'] = recon;
kit.ORDER.splice(1, 0, 'recon');

(async () => { process.exit(await kit.cli(process.argv)); })();
