// HktInfra step-0042 — 헤드리스 검증 (가방 seenReqs dedup 집합 *유계화* — 게이트웨이 prune 워터마크·busSeenBound)
// 사용: node step-0042/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `seenbound`.
//   더한 한 조각: 0037 가방 seenReqs(요청 dedup 집합)는 처리한 *전* reqId 를 무계로 쌓는다 → 장기 가동 시 무한 성장(0040/0041 §9). 그러나 게이트웨이가 재발행하는 건 inBuffer(미-ack=reqId>inAcked)뿐.
//                 게이트웨이가 inAcked(prune 프런티어)를 svc.item.seen 으로 통보 → 가방이 그 이하 reqId 를 seenReqs 에서 제거(영영 재출현 0 → dupe 보존). busAck 의 역방향 워터마크.
//   검증: ⒜ `reg`(키트) — busSeenBound=0(기본)이면 NET 이 직전 step(0041)과 *비트 동일*(seen 발행/가지치기·구독 0).
//         ⒝ `seenbound`(이 step·가설) — ① 유계화(seenReqs peak run-length 무관·무계는 ∝처리 수 성장) ② dedup 정확성 보존(minted==base·dupe 0) ③ failover 에도 dupe 0(gap 구간 워터마크 정지 → gap reqId 보존).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(seenbound)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0041/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: seenbound — 가방 seenReqs(0037 dedup 집합)를 게이트웨이 prune 워터마크로 유계화 ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0040/0041 과 동일 베이스.
const BUS_BASE = (seed, ticks = 70, ops = 10) => ({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// crash@12→재협상@14 — failover 에도 dupe 0 검증용(gap 구간 워터마크 정지 → gap reqId 보존 → 재발행 dedup).
const CRASH_AT = 12, RENEG_AT = 14;

function seenbound(seeds) {
  console.log('== seenbound: *가설* — 0037 가방 seenReqs(요청 dedup 집합)를 게이트웨이 *prune 워터마크*로 유계화: 게이트웨이가 inAcked 를 svc.item.seen 으로 통보 → 가방이 그 이하 reqId 를 seenReqs 에서 제거(영영 재출현 0 → dupe 보존) ==');
  console.log('  요청 경로는 모두 busResendReq+busAck ON. unbnd(seenReqs 무계·∝처리 수) vs bound(busSeenBound·워터마크 가지치기) 비교.');
  console.log('seed   | minted base/unbnd/bound | seenReqs final unbnd/bound | seenReqsPeak unbnd/bound | seenPruned | dupe | 판정');
  // 요청 경로 자기-크기조정(busResendReq+busAck)은 양 변종 공통 — seenReqs 유계화(busSeenBound)만 변수.
  const REQ = { busResendReq: true, busAck: true };
  for (const seed of seeds) {
    const base  = run(BUS_BASE(seed));                                   // dedup 기계 OFF — minted 기준
    const unbnd = run({ ...BUS_BASE(seed), ...REQ });                    // seenReqs 무계: dedup 정확하나 ∝처리 수 성장
    const bound = run({ ...BUS_BASE(seed), ...REQ, busSeenBound: true }); // seenReqs 유계: 워터마크 가지치기

    const mB = base.inventory.minted, mU = unbnd.inventory.minted, mO = bound.inventory.minted;
    const finU = unbnd.inventory.seenReqs.size, finO = bound.inventory.seenReqs.size;
    const peakU = unbnd.inventory.seenReqsPeak, peakO = bound.inventory.seenReqsPeak;
    const prunedO = bound.inventory.seenPruned;
    // dupe = ledger 보존 위반(아이템 소멸 없음·minted==ledger.size). 유계화가 dedup 을 깨면 이중 mint → ledger>minted.
    const dupe = (itemConserved(unbnd) && itemConserved(bound)) ? 0 : 1;

    // ① dedup 정확성 보존: 유계화해도 minted 동일·원장 정합(가지친 reqId 는 영영 재출현 0 이라 dedup 손실 0).
    const correct = mB === mU && mU === mO && dupe === 0 && ledgerConsistent(bound) && ledgerConsistent(unbnd);
    // ② 유계화: bound 의 seenReqs 가 무계보다 작다(final·peak 둘 다) — run-length 무관성은 아래 sweep 에서.
    const bounded = finO < finU && peakO < peakU && prunedO > 0;

    const ok =
      check(correct, `seed ${seed}: 유계화가 dedup 깨뜨림(base ${mB}·unbnd ${mU}·bound ${mO} minted·dupe ${dupe})`) &&
      check(bounded, `seed ${seed}: seenReqs 유계화 안 됨(final ${finU}→${finO}·peak ${peakU}→${peakO}·pruned ${prunedO})`);
    console.log(`${pad(seed,6)} | ${pad(mB+'/'+mU+'/'+mO,23)} | ${pad(finU+'/'+finO,26)} | ${pad(peakU+'/'+peakO,24)} | ${pad(prunedO,10)} | ${pad(dupe,4)} | ${ok?'OK':'FAIL'}`);
  }
  // run-length 무관성(핵심) — 가동을 늘리면 무계 seenReqs 는 ∝ 처리 수로 성장하나 bound peak 는 *in-flight 상한*(가동 길이 무관)에 머문다.
  const sd = seeds[0];
  console.log(`  run-length 무관성(seed ${sd}·crash 없음) — 무계는 가동 길이에 비례 성장, bound peak 는 in-flight 상한에 고정:`);
  for (const [ticks, ops] of [[70, 10], [140, 20], [210, 30]]) {
    const u = run({ ...BUS_BASE(sd, ticks, ops), ...REQ });
    const o = run({ ...BUS_BASE(sd, ticks, ops), ...REQ, busSeenBound: true });
    console.log(`    ticks ${pad(ticks,3)} ops ${pad(ops,2)} | unbnd seenReqs ${pad(u.inventory.seenReqs.size,3)}(∝처리) · bound peak ${pad(o.inventory.seenReqsPeak,3)}(고정) · bound final ${o.inventory.seenReqs.size}`);
  }
  // failover 에도 dupe 0 — gap 구간엔 ack 가 끊겨 게이트웨이 inAcked 정지 → seen 워터마크도 정지 → gap reqId 가 seenReqs 에 *보존* → 복구 재발행이 dedup 으로 폐기(이중 mint 0).
  console.log(`  failover dupe 0(crash@${CRASH_AT}→재협상@${RENEG_AT}·busResend+busOutAck 무손실 위에 busSeenBound):`);
  for (const seed of seeds) {
    const G = { busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, busResend: true, busResendReq: true, busAck: true, busOutAck: true };
    const fb = run({ ...BUS_BASE(seed), ...G });                          // failover·유계화 OFF
    const fo = run({ ...BUS_BASE(seed), ...G, busSeenBound: true });      // failover·유계화 ON
    const dupe = (itemConserved(fb) && itemConserved(fo)) ? 0 : 1;
    const ok = check(fb.inventory.minted === fo.inventory.minted && dupe === 0 && ledgerConsistent(fo), `seed ${seed}: failover 유계화 dupe(minted ${fb.inventory.minted} vs ${fo.inventory.minted}·dupe ${dupe})`);
    console.log(`    seed ${pad(seed,5)} | minted off/on ${pad(fb.inventory.minted+'/'+fo.inventory.minted,9)} · seenReqs peak ${pad(fb.inventory.seenReqsPeak+'/'+fo.inventory.seenReqsPeak,9)} · dupe ${dupe} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 0037 seenReqs 는 처리한 *전* reqId 를 무계로 쌓았다(0040/0041 §9) — 게이트웨이가 재발행하는 건 inBuffer(미-ack=reqId>inAcked)뿐이라 reqId≤inAcked 는 영영 재출현 0.`);
  console.log(`    유계화: 게이트웨이가 inAcked(prune 프런티어)를 svc.item.seen 으로 통보 → 가방이 그 이하 reqId 를 seenReqs 에서 제거(busAck 의 *역방향* 워터마크).`);
  console.log(`    정상 구간엔 워터마크가 흘러 seenReqs 가 in-flight 만 남고·gap 구간엔 워터마크 정지로 gap reqId 가 보존(재발행 dedup) → run-length 무관 + dupe 0 동시 달성(위 sweep·failover).`);
  console.log(`    정직한 한계: 워터마크는 *게이트웨이 단일 producer* 기준 — 다중 게이트웨이 producer 면 per-producer 워터마크 필요. busSeenBound=0 = 0041 비트 동일(reg).`);
}
kit.MODES['seenbound'] = seenbound;
kit.ORDER.splice(1, 0, 'seenbound');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
