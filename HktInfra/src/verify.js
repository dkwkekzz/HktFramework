// HktInfra step-0089 — 헤드리스 검증 (producer epoch 워터마크·라우터 재시작 안전)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pepoch`.
//   더한 한 조각: 0081 수신측 dedup 워터마크는 라우터 deliverySeq 단조 가정에 기댄다. 라우터 *재시작* 시 deliverySeq 가 0 부터 다시 → 재시작 후 낮은 seq 가 옛 워터마크 이하라 Mailbox 가 신규 전달을 *이미 본 것*으로 오인해 떨군다(유실·0081 §9). 이 step 은 라우터 epoch(재시작마다 ++)를 whisperDeliver 에 실어 Mailbox 가 워터마크를 (producer,epoch)로 분리 → 새 epoch=새 워터마크 → 재시작 후 낮은 seq 도 정상 수신(0013/0048 epoch 펜싱의 전달 판).
//   검증: ⒜ `reg`(키트) — epochKeyed 미설정이면 epoch 미부착 = 0088 비트 동일. ⒝ `pepoch`(가설) — N 귓속말→라우터 restart(deliverySeq 0·epoch++)→M 귓속말. ON(epochKeyed): (prod,epoch) 분리 → received N+M(재시작 후도 수신)·dup 0. OFF: producer 만 키 → 재시작 후 seq≤옛 wm → 떨굼·received N(유실)·dup M. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14;
const N1 = 6; const N2 = 6; const RESTART_TICK = 64;   // phase1 6 귓속말(seq 1..6)→restart@64→phase2 6 귓속말(seq 1..6 재시작)
const W1 = Array.from({ length: N1 }, (_, k) => ({ at: 48 + k * 2, from: 'client0', to: 'mbox', body: 'a' + k }));
const W2 = Array.from({ length: N2 }, (_, k) => ({ at: 66 + k * 2, from: 'client0', to: 'mbox', body: 'b' + k }));
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  deliverDedupBound: true,   // 0081 워터마크(이 버그가 사는 곳)
  whispers: [...W1, ...W2], wrouterRestart: { at: RESTART_TICK },
  ...extra });

function pepoch(seeds) {
  console.log('== pepoch: *가설* — producer epoch 워터마크. 라우터 재시작(deliverySeq 0 리셋)이 0081 워터마크를 오작동시키는 버그를, epoch(재시작마다 ++)를 whisperDeliver 에 실어 (producer,epoch)로 워터마크 분리해 고친다. epochKeyed ON vs OFF ==');
  console.log(`  ${N1} 귓속말→restart@${RESTART_TICK}(seq 0 리셋·epoch++)→${N2} 귓속말. ON: received ${N1 + N2}·dup 0(재시작 후도 수신). OFF: received ${N1}·dup ${N2}(재시작 후 seq≤옛 wm→떨굼).`);
  console.log('seed   | restarts | received ON | dup ON | received OFF | dup OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { epochKeyed: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // epochKeyed OFF — epoch 미부착·producer 만 키(재시작 후 오접힘·0088 동작)
    const mb = on.mbox; const mo = off.mbox; const wr = on.wrouter;
    // ① epoch 안전 — 재시작 후에도 전부 수신(received N1+N2)·중복 오접힘 0.
    const safe = mb && mb.received === N1 + N2 && mb.duplicates === 0 && wr && wr.restarts === 1;
    // ② 대조(OFF) — epoch 없으면 재시작 후 낮은 seq 가 옛 워터마크 이하 → 떨굼: received N1(phase2 유실)·dup N2.
    const buggy = mo && mo.received === N1 && mo.duplicates === N2;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(safe, `seed ${seed}: epoch 안전 틀림(received ${mb && mb.received}·dup ${mb && mb.duplicates}·restarts ${wr && wr.restarts}·기대 ${N1 + N2}/0/1)`) &&
      check(buggy, `seed ${seed}: OFF 버그 미재현(received ${mo && mo.received}·dup ${mo && mo.duplicates}·기대 ${N1}/${N2})`) &&
      check(nonInvasive, `seed ${seed}: epoch 가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.restarts : 0, 8)} | ${pad(mb ? mb.received : 0, 11)} | ${pad(mb ? mb.duplicates : 0, 6)} | ${pad(mo ? mo.received : 0, 12)} | ${pad(mo ? mo.duplicates : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 라우터 재시작이 깨뜨리는 *단조 seq 가정*을 epoch 펜싱이 복원한다: (producer,epoch) 키로 재시작 전후 seq 공간을 분리해, 리셋된 낮은 seq 가 옛 워터마크에 오접히지 않는다(전달 유실 0). 0013/0048 epoch 펜싱의 전달 dedup 판(SPINE 계층3·5).');
  console.log('    epochKeyed 미설정 = 0088 비트 동일(epoch 미부착·Mailbox 키=producer·reg). 비-침습: epoch 는 dedup 키 분리만(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['pepoch'] = pepoch;
kit.ORDER.splice(1, 0, 'pepoch');

(async () => { process.exit(await kit.cli(process.argv)); })();
