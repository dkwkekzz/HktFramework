// HktInfra step-0090 — 헤드리스 검증 (epoch 워터마크 유계화)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pepochbnd`.
//   더한 한 조각: 0089 의 (producer,epoch) 워터마크는 재시작 안전을 주지만 Mailbox 가 *모든 epoch* 워터마크를 영영 보관 → epoch 차원이 ∝재시작 수로 무한 성장(0089 §9). 재시작(epoch++)은 inflight 를 비우므로 *옛 epoch 전달은 다시 안 옴* → 더 높은 epoch 도착 시 낮은 epoch 워터마크는 안전하게 가지친다. base producer 당 현재 epoch 만 유지 → epoch 차원 유계(0048/0042 유계화의 epoch 판).
//   검증: ⒜ `reg`(키트) — epochBound 미설정이면 0089 비트 동일(가지치기 0). ⒝ `pepochbnd`(가설) — 3회 재시작(epoch 0..3)·각 epoch 마다 귓속말. ON(epochBound): epochKeyCount 1(현재 epoch 만)·received 전부. OFF: epochKeyCount 4(∝epoch·누적). 둘 다 received 동일·dup 0(epoch 키잉은 불변). minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const EPOCHS = 4;   // epoch 0..3 (3회 재시작)
// 각 epoch 구간에 귓속말 2개씩 + 구간 사이 재시작. epoch e 구간: tick base..base+3, 재시작은 그 직후.
const WHISPERS = []; const RESTARTS = [];
for (let e = 0; e < EPOCHS; e++) {
  const base = 46 + e * 8;
  WHISPERS.push({ at: base, from: 'client0', to: 'mbox', body: 'e' + e + 'a' }, { at: base + 2, from: 'client0', to: 'mbox', body: 'e' + e + 'b' });
  if (e < EPOCHS - 1) RESTARTS.push({ at: base + 5 });   // 마지막 epoch 뒤엔 재시작 없음
}
const TOTAL = WHISPERS.length;   // 8 전달
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  deliverDedupBound: true, epochKeyed: true,   // 0081 워터마크 + 0089 epoch 키잉(이 버그가 사는 곳)
  whispers: WHISPERS, wrouterRestart: RESTARTS,
  ...extra });

function pepochbnd(seeds) {
  console.log('== pepochbnd: *가설* — epoch 워터마크 유계화. 재시작(epoch++)은 inflight 를 비우므로 옛 epoch 전달은 다시 안 옴 → 더 높은 epoch 도착 시 낮은 epoch 워터마크 가지치기. base producer 당 현재 epoch 만 유지. epochBound ON vs OFF ==');
  console.log(`  ${EPOCHS - 1}회 재시작(epoch 0..${EPOCHS - 1})·각 epoch 귓속말 2. ON: epochKeyCount 1(현재만)·received ${TOTAL}. OFF: epochKeyCount ${EPOCHS}(∝epoch·누적)·received ${TOTAL}. 둘 다 dup 0.`);
  console.log('seed   | restarts | epochKeys ON | received ON | dup ON | epochKeys OFF | received OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverEpochBound: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // epochBound OFF — 옛 epoch 워터마크 누적(0089 동작)
    const mb = on.mbox; const mo = off.mbox; const wr = on.wrouter;
    const onKeys = mb ? mb.epochKeyCount() : -1; const offKeys = mo ? mo.epochKeyCount() : -1;
    // ① epoch 유계 — 현재 epoch 워터마크만(producer 당 1)·재시작에도 전부 수신·dup 0(epoch 키잉 불변).
    const bounded = onKeys === 1 && mb.received === TOTAL && mb.duplicates === 0 && wr && wr.restarts === EPOCHS - 1;
    // ② 대조(OFF) — 가지치기 0 이면 epoch 마다 워터마크 누적(EPOCHS 개)·received 는 같다(유계화는 메모리만).
    const accum = offKeys === EPOCHS && mo.received === TOTAL && mo.duplicates === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(bounded, `seed ${seed}: epoch 유계 틀림(onKeys ${onKeys}·received ${mb && mb.received}·dup ${mb && mb.duplicates}·restarts ${wr && wr.restarts}·기대 1/${TOTAL}/0/${EPOCHS - 1})`) &&
      check(accum, `seed ${seed}: OFF 누적 미재현(offKeys ${offKeys}·received ${mo && mo.received}·기대 ${EPOCHS}/${TOTAL})`) &&
      check(nonInvasive, `seed ${seed}: 유계화가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.restarts : 0, 8)} | ${pad(onKeys, 12)} | ${pad(mb ? mb.received : 0, 11)} | ${pad(mb ? mb.duplicates : 0, 6)} | ${pad(offKeys, 13)} | ${pad(mo ? mo.received : 0, 12)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → epoch 차원이 *현재 epoch* 하나로 접힌다: 재시작이 옛 epoch 전달을 영영 끊으므로(inflight 비움) 낮은 epoch 워터마크는 잊어도 안전 — 재시작 안전(0089)을 무계 메모리 없이 얻는다(received ${TOTAL}·dup 0 불변). 0048 lease lifecycle·0042 seen 유계화의 epoch 판(SPINE 계층3·5).`);
  console.log('    epochBound 미설정 = 0089 비트 동일(가지치기 0·옛 epoch 누적·reg). 비-침습: 유계화는 워터마크 키 표현만(수신 판정·원장 불변)·received/minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['pepochbnd'] = pepochbnd;
kit.ORDER.splice(1, 0, 'pepochbnd');

(async () => { process.exit(await kit.cli(process.argv)); })();
