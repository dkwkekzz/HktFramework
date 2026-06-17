// HktInfra step-0047 — 헤드리스 검증 (per-producer seen 워터마크 — busProducerNs 복합키를 busSeenBound 가 가지치게·busSeenNs)
// 사용: node step-0047/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `seenns`.
//   더한 한 조각: 0046 busProducerNs ON 이면 seenReqs 키가 *복합키*(`producer\0reqId`·문자열)인데, 0042 busSeenBound 의 prune 은 `r <= upTo`(숫자 비교) → `'gw\05' <= 5` 는 false(NaN)
//                 → 복합키가 *영영* 안 가지쳐져 seenReqs 가 무계 회귀(busSeenBound 무력화·0046 §9/리뷰 §1). 해법: 게이트웨이가 svc.item.seen 에 producer 태깅 → 가방이 producer 별 워터마크로 *그 producer 의* 복합키만 가지친다.
//   검증: ⒜ `reg`(키트) — busSeenNs=0(기본)이면 NET 이 직전 step(0046)과 *비트 동일*(seen 미태깅·숫자 prune).
//         ⒝ `seenns`(이 step·가설) — busProducerNs+busSeenBound ON 에서 busSeenNs OFF 는 seenReqsPeak 가 run-length 에 비례(무계·복합키 안 가지쳐짐)·ON 은 유계(run-length 무관·drain)·minted 보존(dedup 정확성).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(seenns)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0046/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: seenns — busProducerNs 복합키를 busSeenBound 가 가지치도록 per-producer seen 워터마크 ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 단일 게이트웨이로 충분히 자극(자기 복합키 `gateway\0reqId` 가 숫자 워터마크에 안 걸리는 게 finding). busResendReq(reqId 태깅)+busAck(요청 ack)+busSeenBound(prune)+busProducerNs(복합키) 다 ON.
//   busSeenBound prune 이 *복합키*를 만나는 조합 — busSeenNs OFF 면 prune 무력(무계), ON 이면 producer 별 가지치기(유계). ops 가 요청 생산량(×6 클라).
const SEEN_BASE = (seed, ops) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResendReq: true, busAck: true, busSeenBound: true, busProducerNs: true });

function seenns(seeds) {
  console.log('== seenns: *가설* — 0046 busProducerNs ON 이면 seenReqs 키가 복합키(`producer\\0reqId`·문자열)인데, 0042 busSeenBound prune 은 숫자 비교(`r<=upTo`) → `\'gw\\05\'<=5` 는 false(NaN) → 복합키가 영영 안 가지쳐진다(busSeenBound 무력·seenReqs 무계 회귀·0046 §9/리뷰 §1). per-producer seen 워터마크(게이트웨이가 seen 에 producer 태깅 → 가방이 그 producer 복합키만 가지치기) → 유계 ==');
  console.log('  단일 게이트웨이 + busProducerNs+busSeenBound+busAck+busResendReq ON. busSeenNs OFF(복합키 prune 실패·무계) vs ON(producer 별 prune·유계). ops 10/30(요청 ∝ 60/180)로 run-length 의존성 가시화.');
  console.log('seed   | seenPeak off/on (ops10) | seenPeak off/on (ops30) | minted off/on(ops30) | seenFinal off/on | 판정');
  for (const seed of seeds) {
    const off10 = run({ ...SEEN_BASE(seed, 10) });                      // busSeenNs OFF(=0046) — 복합키 prune 실패 → 무계
    const on10  = run({ ...SEEN_BASE(seed, 10), busSeenNs: true });     // ON — producer 별 prune → 유계
    const off30 = run({ ...SEEN_BASE(seed, 30) });                      // 더 긴 생산 — OFF peak 비례 성장(무계 증거)
    const on30  = run({ ...SEEN_BASE(seed, 30), busSeenNs: true });     // ON peak 는 run-length 무관(유계 증거)
    const pOff10 = off10.inventory.seenReqsPeak, pOn10 = on10.inventory.seenReqsPeak;
    const pOff30 = off30.inventory.seenReqsPeak, pOn30 = on30.inventory.seenReqsPeak;
    // ① ON 이 OFF 보다 작음(가지치기) ② OFF 는 run-length 에 비례(무계) ③ ON 은 run-length 무관(유계) ④ minted 보존(dedup 정확성·가지치기가 재처리 유발 0) ⑤ ON 은 idle drain(final 0) ⑥ 원장 자기-정합
    const ok =
      check(pOn30 < pOff30, `seed ${seed}: busSeenNs ON peak 가 OFF 보다 안 작음(ops30 ${pOff30}→${pOn30})`) &&
      check(pOff30 > pOff10, `seed ${seed}: busSeenNs OFF peak 가 run-length 무관(무계면 ops10<ops30: ${pOff10},${pOff30})`) &&
      check(pOn30 <= pOn10, `seed ${seed}: busSeenNs ON peak 가 run-length 에 비례(유계면 ops30≤ops10: ${pOn10},${pOn30})`) &&
      check(off30.inventory.minted === on30.inventory.minted, `seed ${seed}: 가지치기가 dedup 정확성 깸(minted off ${off30.inventory.minted} ≠ on ${on30.inventory.minted})`) &&
      check(on30.inventory.seenReqs.size === 0, `seed ${seed}: ON 인데 seenReqs idle drain 0 아님(final ${on30.inventory.seenReqs.size})`) &&
      check(ledgerConsistent(on30) && itemConserved(on30) && ledgerConsistent(off30) && itemConserved(off30), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(pOff10 + '/' + pOn10, 23)} | ${pad(pOff30 + '/' + pOn30, 23)} | ${pad(off30.inventory.minted + '/' + on30.inventory.minted, 20)} | ${pad(off30.inventory.seenReqs.size + '/' + on30.inventory.seenReqs.size, 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 0046 복합키(producer\\0reqId·문자열) + 0042 숫자 prune(r<=upTo)은 NaN 비교라 영영 안 가지쳐짐 → busSeenNs OFF peak 가 요청량(run-length)에 비례(무계·busSeenBound 가 사실상 무력·리뷰 §1 재현).`);
  console.log(`    이 step: 게이트웨이가 svc.item.seen 에 producer 태깅 → 가방이 producer 별 워터마크(producerSeenWm)로 *그 producer 의* 복합키만(접두사 일치 + 숫자 suffix ≤ upTo) 가지친다 → ON peak 가 run-length 무관(유계)·idle drain(final 0)·minted 보존(가지친 reqId 는 미-재출현이라 dupe 0).`);
  console.log(`    busSeenNs=0 = 0046 비트 동일(seen 미태깅·숫자 prune·reg). 정직한 한계: per-producer ack 워터마크(busAck inBuffer 가지치기)는 단일 게이트웨이라 충분 — 다중 게이트웨이 producer 별 ack 가지치기는 후속.`);
}

kit.MODES['seenns'] = seenns;
kit.ORDER.splice(1, 0, 'seenns');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
