// HktInfra step-0081 — 헤드리스 검증 (dedup seen 집합 유계화·워터마크)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `wsbound`.
//   더한 한 조각: 0080 의 수신측 dedup 은 본 seq 를 *전부* 평면 Set 에 영구 보관 → 귓속말 누적 시 메모리가 run 에 비례해 무한 성장(0080 §9). 라우터 deliverySeq 는 단조 증가이고 ack/포기한 seq 는 재발신 안 되므로 *연속 워터마크 이하* seq 는 안전하게 잊어도 된다. 이 step 은 producer(전달자) 별 연속 워터마크(seenWm)+희소 비순차 집합(seenAbove)으로 seen 을 O(gap)로 유계화한다(0042 busSeenBound·0047 busSeenNs 의 전달 dedup 판). dedup 판정은 불변 — 메모리 표현만 유계.
//   검증: ⒜ `reg`(키트) — dedupBound 미설정이면 0080 비트 동일(평면 Set). ⒝ `wsbound`(가설) — N개 귓속말을 잇따라 'mbox' 로(각 단조 deliverySeq) + 첫 ack 손실(dropAck 1)로 중복 1건 유발. ON(dedupBound): seenSize(=ΣseenAbove)≤K 유계·seenWm=N(연속 흡수). OFF(평면 dedup): seenSize=N(∝run·무계). 둘 다 received N·inbox N·duplicates 1(dedup 보존)·delivered N.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const ACKDROP = 1; const DTIMEOUT = 4;
// N개 귓속말을 spaced 틱으로 'mbox' 에 — 각자 단조 deliverySeq 를 만들어 seen 집합을 키운다(유계 vs 무계 대조). 첫 ack 손실로 중복 1건 유발(dedup 보존 확인).
const NWHISPER = 12; const WSTART = 48; const WSTEP = 2;
const WHISPERS = Array.from({ length: NWHISPER }, (_, k) => ({ at: WSTART + k * WSTEP, from: 'client0', to: 'mbox', body: 'w' + k }));
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  deliverTimeout: DTIMEOUT, deliverAckDrop: ACKDROP, whispers: WHISPERS,
  ...extra });

function wsbound(seeds) {
  console.log('== wsbound: *가설* — dedup seen 집합 유계화. 라우터 deliverySeq 단조 + ack/포기 후 재발신 0 → 연속 워터마크 이하 seq 는 잊어도 안전. producer 별 seenWm+희소 seenAbove 로 O(gap) 유계화. dedupBound ON vs OFF(평면) ==');
  console.log(`  ${NWHISPER}개 귓속말을 잇따라 'mbox'(단조 seq) + 첫 ack 손실(dropAck ${ACKDROP})로 중복 1건. ON: seenSize(Σabove)≤K 유계·seenWm=${NWHISPER}. OFF: seenSize=${NWHISPER}(∝run). 둘 다 received ${NWHISPER}·inbox ${NWHISPER}·duplicates 1.`);
  console.log('seed   | seenSize ON | seenWm | OFF seenSize | received | inbox | dup | delivered | bounded | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverDedupBound: true }) });   // 유계 — 워터마크+희소 집합
    const off = run({ ...P_BASE(seed, { deliverDedup: true }) });        // 무계 — 0080 평면 Set(∝고유 seq)
    const mb = on.mbox; const mo = off.mbox; const wr = on.wrouter;
    const onSize = mb ? mb.seenSize() : -1;
    const offSize = mo ? mo.seenSize() : -1;
    // producer(wrouter) 별 워터마크가 N 까지 연속 흡수됐는가 — 전체 N seq 가 접혀 잔여(seenAbove)는 유계.
    const wm = mb && mb.seenWm.size ? Math.max(...mb.seenWm.values()) : 0;
    // ① 유계 — ON 의 보관 항목(Σ seenAbove)은 작은 상수(K=2) 이하, OFF 는 N(고유 seq 전부 보관). 워터마크는 N 까지 전진.
    const bounded = onSize >= 0 && onSize <= 2 && offSize === NWHISPER && wm === NWHISPER;
    // ② dedup 보존 — 메모리 유계화에도 exactly-once 유지: 중복 1건 걸러(duplicates 1)·inbox/received N(중복 미적재)·라우터 delivered N.
    const exactly = mb && mb.received === NWHISPER && mb.inbox.length === NWHISPER && mb.duplicates === 1 && wr && wr.delivered === NWHISPER;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(bounded, `seed ${seed}: 유계 틀림(ON seenSize ${onSize} wm ${wm}·OFF ${offSize}·기대 ON≤2 wm ${NWHISPER} OFF ${NWHISPER})`) &&
      check(exactly, `seed ${seed}: dedup 보존 틀림(rx ${mb && mb.received}·inbox ${mb && mb.inbox.length}·dup ${mb && mb.duplicates}·delivered ${wr && wr.delivered}·기대 ${NWHISPER}/${NWHISPER}/1/${NWHISPER})`) &&
      check(nonInvasive, `seed ${seed}: 유계화가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(onSize, 11)} | ${pad(wm, 6)} | ${pad(offSize, 12)} | ${pad(mb ? mb.received : 0, 8)} | ${pad(mb ? mb.inbox.length : 0, 5)} | ${pad(mb ? mb.duplicates : 0, 3)} | ${pad(wr ? wr.delivered : 0, 9)} | ${pad(bounded + '', 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 평면 Set(0080) 은 본 seq 를 영구 보관해 메모리가 run 에 비례(∝고유 seq). producer 별 연속 워터마크는 흡수된 seq 를 즉시 잊어(O(gap)) 유계 — 같은 dedup 정확도(exactly-once)를 무계 메모리 없이 얻는다(0042/0047 의 전달 dedup 판·SPINE 계층3).');
  console.log('    dedupBound 미설정 = 0080 비트 동일(평면 Set·무계·reg). 비-침습: 유계화 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['wsbound'] = wsbound;
kit.ORDER.splice(1, 0, 'wsbound');

(async () => { process.exit(await kit.cli(process.argv)); })();
