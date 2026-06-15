// HktInfra step-0044 — 헤드리스 검증 (다중 소비자 min-워터마크 — 결과 버퍼 가지치기를 모든 소비자 frontier 의 최소로·busMinWm)
// 사용: node step-0044/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `minwm`.
//   더한 한 조각: 0041 결과 ack(busOutAck)는 outBuffer 를 *게이트웨이 단일* 소비자 frontier 까지 가지쳤다(§9 ①). svc.item.out 의 둘째 소비자(ranking)가 게이트웨이보다 *늦게* 복구되면
//                 단일 워터마크 + 소비자 dedup 0(=0043)으론 정확 복구가 안 된다(재발행×live 중복→이중 적용·또는 starve). 일반화: 각 소비자가 frontier 를 통보 → 가방이 *최소(min)*까지만 가지치기 + 소비자 outSeq dedup.
//   검증: ⒜ `reg`(키트) — busMinWm=0(기본)이면 NET 이 직전 step(0043)과 *비트 동일*(소비자 태깅/min 계산/ranking ack·dedup 0).
//         ⒝ `minwm`(이 step·가설) — 비대칭 복구(ranking 늦은 재구독)에서 single(0043)은 투영≠원장(over>0)·min 은 투영==원장(rankProjectionFaithful)·outBuffer 보존(peak↑).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(minwm)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0043/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: minwm — 결과 버퍼 가지치기를 *모든 소비자 frontier 의 최소(min)*로 일반화(다중 소비자) ──
const { run, itemConserved, ledgerConsistent, rankProjectionFaithful, ledgerCounts } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0040/0041 과 동일 베이스.
const BUS_BASE = (seed, ticks = 70, ops = 10) => ({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// crash@12→gateway 재협상@14→ranking 늦은 재협상@16 — 비대칭 복구로 min-워터마크 자극(단일 워터마크는 ranking 정확 복구 실패).
const CRASH_AT = 12, RENEG_AT = 14, RANK_RENEG_AT = 16;

function minwm(seeds) {
  console.log('== minwm: *가설* — 0041 결과 ack 는 *게이트웨이 단일* 소비자 frontier 까지 outBuffer 를 가지쳤다(§9 ①). svc.item.out 의 둘째 소비자(ranking)가 게이트웨이보다 *늦게* 복구되면, 단일 워터마크 + 소비자 dedup 0(=0043)으론 정확 복구 불가(투영≠원장). 다중 소비자 min-워터마크(모든 소비자 frontier 의 최소까지만 가지치기) + ranking outSeq dedup → 늦은 ranking 도 *정확히* 따라잡음(투영==원장) ==');
  console.log(`  crash@${CRASH_AT}→gateway 재협상@${RENEG_AT}→ranking 늦은 재협상@${RANK_RENEG_AT}(비대칭). single(busMinWm OFF=0043 동작) vs min(busMinWm ON) 대조.`);
  console.log('seed   | rankFaithful single/min | single 투영오차(over/under) | outBuf peak single/min | outPruned min | 판정');
  const FO = { busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, rankRenegAt: RANK_RENEG_AT, busResend: true, busOutAck: true };
  for (const seed of seeds) {
    const single = run({ ...BUS_BASE(seed), ...FO });                   // 단일 워터마크(0043 동작) — 늦은 ranking 정확 복구 실패
    const min    = run({ ...BUS_BASE(seed), ...FO, busMinWm: true });   // min-워터마크 + dedup — 정확 복구
    const fS = rankProjectionFaithful(single), fM = rankProjectionFaithful(min);
    // single 투영 오차 방향 진단: over=재발행×live 이중 적용·under=starve(가지친 결과 못 받음). min 은 0/0(정확).
    const tc = ledgerCounts(single); let over = 0, under = 0;
    for (const [a, n] of tc) { const g = single.ranking.ranks.get(a) || 0; if (g > n) over += g - n; if (g < n) under += n - g; }
    for (const [a, n] of single.ranking.ranks) if (!tc.has(a)) over += n;
    const peakS = single.inventory.outBufPeak, peakM = min.inventory.outBufPeak;
    // ① min 은 정확 복구(투영==원장) ② single 은 부정합(데모 자극 성립) ③ min 이 더 보존(peak↑·뒤처진 소비자용) ④ 원장 자기-정합(가방 권위 무영향)
    const ok =
      check(fM, `seed ${seed}: min-워터마크인데 ranking 투영 ≠ 원장(불완전 복구·over ${over} under ${under})`) &&
      check(!fS, `seed ${seed}: single 워터마크인데 ranking 투영 정합(데모 자극 실패)`) &&
      check(peakM > peakS, `seed ${seed}: min 이 더 보존 안 함(peak ${peakS}→${peakM})`) &&
      check(ledgerConsistent(min) && itemConserved(min), `seed ${seed}: 원장 자기-정합 깨짐(min)`);
    console.log(`${pad(seed,6)} | ${pad((fS?'T':'F')+'/'+(fM?'T':'F'),23)} | ${pad('over '+over+' / under '+under,27)} | ${pad(peakS+'/'+peakM,22)} | ${pad(min.inventory.outPruned,13)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 0041 결과 ack 는 *게이트웨이 단일* 소비자에 키잉(§9 ①). 둘째 소비자(ranking)가 늦게 복구되면 단일 워터마크 + dedup 0(=0043)으론 투영≠원장(over>0 — resendOut×live 이중 적용).`);
  console.log(`    이 step: ⒜ ranking 을 *ack 하는 1급 소비자*로(svc.item.out.ack{outSeq,consumer:'ranking'}) ⒝ 가방이 *모든 기대 소비자 frontier 의 최소(min)*까지만 outBuffer 가지치기(가장 뒤처진 소비자 보존) ⒞ ranking outSeq dedup(재발행×live 중복 멱등).`);
  console.log(`    → 늦은 ranking 도 보존된 buffer 를 replay 받아 *정확히* 따라잡음(rankProjectionFaithful·투영==원장). outBuf peak single<min 이 보존을 가시화. busMinWm=0 = 0043 비트 동일(reg).`);
  console.log(`    정직한 한계: 영구 뒤처진 소비자는 min 을 눌러 buffer 를 무계 보유(min-워터마크의 대가) — 적응형 축출/소비자 lease 후속. 다중 게이트웨이 producer 워터마크(0042 §9)도 후속.`);
}

kit.MODES['minwm'] = minwm;
kit.ORDER.splice(1, 0, 'minwm');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
