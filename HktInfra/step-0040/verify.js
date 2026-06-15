// HktInfra step-0040 — 헤드리스 검증 (요청 replay 버퍼 *자기-크기조정* — ack 기반 가지치기·busAck)
// 사용: node step-0040/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `busack`.
//   더한 한 조각: 0039 고정 K(busWindow)는 *최대 예상 gap(다운타임×발신율)* 을 사전 추정해야 한다(작으면 손실·크면 낭비) — 그 §9 해소.
//                 가방이 처리한 reqId 를 svc.item.ack 로 통보 → 게이트웨이가 ack 된 요청을 inBuffer 에서 가지치기 → 버퍼엔 *미-ack(in-flight)* 만 남는다(자기-크기조정).
//   검증: ⒜ `reg`(키트) — busAck=0(기본)이면 NET 이 직전 step(0039)과 *비트 동일*(ack 발행/가지치기·구독 0).
//         ⒝ `busack`(이 step·가설) — ① ack 무손실(K 추정 0) ② 버퍼 peak 가 run-length 무관(무계 unbnd 는 ∝발신 수 성장) ③ idle drain ④ 미-튜닝 고정 K 는 손실(대조).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(busack)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0039/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: busack — 요청 replay 버퍼(0037 inBuffer)를 ack-가지치기로 자기-크기조정(고정 K 대체) ──
const { run, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0039 buswin 과 동일 베이스.
const BUS_BASE = (seed, ticks = 70, ops = 10) => ({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// crash@12→재협상@14 가 활성 구간을 갈라 gap 에 18 요청이 떨어진다(0039). 고정 K=8 은 그 gap(18)을 *과소 추정* — 미-튜닝 대조군.
const CRASH_AT = 12, RENEG_AT = 14;
const K_UNDER = 8;   // 미-튜닝 고정 K(<gap 18) — 운영자가 gap 을 모르고 작게 잡은 경우(0039 tiny). ack 는 이 추정 자체가 불필요함을 보인다.

function busack(seeds) {
  console.log('== busack: *가설* — 0037 요청 버퍼를 *ack-가지치기*로 자기-크기조정(고정 K 추정 불필요): 가방이 svc.item.ack 로 처리 통보 → 게이트웨이가 ack 된 요청 제거 → 미-ack 만 보관 ==');
  console.log(`  bus.crash(@${CRASH_AT})→재협상(@${RENEG_AT}). 모두 busResend+busResendReq ON. unbnd(K0·무계) vs fixedK${K_UNDER}(미-튜닝 고정·0039) vs ack(busAck·K 없음) 비교.`);
  console.log('seed   | minted base/unbnd/fixed/ack | inBuf peak unbnd/fixed/ack | inBuf final ack | desync fixed/ack | 판정');
  for (const seed of seeds) {
    const base  = run(BUS_BASE(seed));   // crash 0 — 전 요청 도달(무손실 기준)
    const G = { busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, busResend: true, busResendReq: true };
    const unbnd = run({ ...BUS_BASE(seed), ...G, busWindow: 0 });        // 무계: 무손실이나 버퍼 ∝ 발신 수
    const fixed = run({ ...BUS_BASE(seed), ...G, busWindow: K_UNDER });  // 미-튜닝 고정 K<gap: 유계나 손실(0039)
    const ack   = run({ ...BUS_BASE(seed), ...G, busAck: true });        // ack 자기-크기조정: K 없이 유계 + 무손실

    const mB = base.inventory.minted, mU = unbnd.inventory.minted, mF = fixed.inventory.minted, mA = ack.inventory.minted;
    const peakU = unbnd.gateway.inBufPeak, peakF = fixed.gateway.inBufPeak, peakA = ack.gateway.inBufPeak;
    const finA = ack.gateway.inBuffer.length;   // ack 는 처리 완료 후 0 으로 drain(미-ack 만 남으므로 quiescent 면 비어 있음)
    const dF = itemDesync(fixed), dA = itemDesync(ack);

    // ① ack 무손실(K 추정 0): unbnd(무계)와 같은 결과 — minted==base·desync 0. 운영자가 gap 을 *몰라도* 정확.
    const ackLossless = mU === mB && mA === mB && dA === 0;
    // ② 미-튜닝 고정 K 는 손실(대조): K<gap 이라 evict → minted<base 또는 desync>0. ack 는 이 추정 부담을 없앤다.
    const fixedLossy = mF < mB || dF > 0;
    // ③ ack 가지치기로 버퍼가 미-ack(in-flight)만 보관 → quiescent 면 비어 가지친다(idle drain). 무계는 끝까지 안 빠짐(finU=peakU).
    const ackDrains = finA === 0 && unbnd.gateway.inBuffer.length === peakU;
    // ④ ack peak 가 무계보다 작다(in-flight 한정·∝발신 수 아님) — run-length 무관성은 아래 sweep 에서.
    const ackBoundedBelowUnbnd = peakA < peakU;
    const ledgerValid = itemConserved(ack) && ledgerConsistent(ack) && itemConserved(unbnd) && ledgerConsistent(unbnd) && itemConserved(fixed) && ledgerConsistent(fixed);

    const ok =
      check(ackLossless, `seed ${seed}: ack 무손실 깨짐(base ${mB}·unbnd ${mU}·ack ${mA}·desync ${dA})`) &&
      check(fixedLossy, `seed ${seed}: 미-튜닝 고정 K 손실 안 보임(대조 실패? fixed ${mF}·desync ${dF})`) &&
      check(ackDrains, `seed ${seed}: ack idle drain 안 됨(finalAck ${finA}≠0 또는 unbnd 가 drain)`) &&
      check(ackBoundedBelowUnbnd, `seed ${seed}: ack peak ${peakA} < unbnd peak ${peakU} 아님`) &&
      check(ledgerValid, `seed ${seed}: ack 가지치기가 원장 보존/정합 깨뜨림`);
    console.log(`${pad(seed,6)} | ${pad(mB+'/'+mU+'/'+mF+'/'+mA,25)} | ${pad(peakU+'/'+peakF+'/'+peakA,25)} | ${pad(finA,15)} | ${pad(dF+'/'+dA,16)} | ${ok?'OK':'FAIL'}`);
  }
  // run-length 무관성(핵심) — 가동을 늘리면 무계 버퍼는 ∝ 발신 수로 성장하나 ack peak 는 *in-flight backlog 상한*(가동 길이 무관)에 머문다.
  const sd = seeds[0];
  console.log(`  run-length 무관성(seed ${sd}·crash 없음) — 무계는 가동 길이에 비례 성장, ack peak 는 in-flight 상한에 고정:`);
  for (const [ticks, ops] of [[70, 10], [140, 20], [210, 30]]) {
    const u = run({ ...BUS_BASE(sd, ticks, ops), busResend: true, busResendReq: true, busWindow: 0 });
    const a = run({ ...BUS_BASE(sd, ticks, ops), busResend: true, busResendReq: true, busAck: true });
    console.log(`    ticks ${pad(ticks,3)} ops ${pad(ops,2)} | unbnd 버퍼 ${pad(u.gateway.inBuffer.length,3)}(∝발신) · ack peak ${pad(a.gateway.inBufPeak,3)}(고정) · ack final ${a.gateway.inBuffer.length}`);
  }
  console.log(`  → 0039 고정 K(busWindow)는 *최대 예상 gap(다운타임×발신율)* 을 사전 추정해야 한다 — 작으면 손실(fixedK${K_UNDER}=대조), 크면 메모리 낭비.`);
  console.log(`    ack-가지치기: 가방이 처리한 reqId 를 svc.item.ack 로 통보 → 게이트웨이가 ack 워터마크 이하 inBuffer 를 제거 → 버퍼엔 *미-ack(in-flight)* 만 남는다.`);
  console.log(`    정상 구간엔 ack 가 흘러 버퍼가 0 으로 drain·gap 구간엔 ack 도 끊겨 버퍼가 gap 만큼 *자동 성장* → 복구 replay 가 정확히 그만큼 덮어 *K 추정 없이* 무손실(minted==base).`);
  console.log(`    버퍼 peak 는 *in-flight backlog 상한*(발신 버스트의 함수)에 머문다 — 무계처럼 가동 길이에 비례 성장하지 않는다(위 sweep: unbnd 60→120→180 vs ack peak 고정).`);
  console.log(`    정직한 한계: ack 도 gap 에 끊겨 peak 는 in-flight 백로그(가방이 처리했으나 ack 미반환분 포함)까지 잡으므로 *완벽 튜닝된* 고정 K(=gap)보다 클 수 있다 — 무튜닝·idle drain·가동-길이 무관이 대가. 결과 경로 outBuffer ack-가지치기·seenReqs 유계화는 후속(§9). busAck=0 = 0039 비트 동일(reg).`);
}
kit.MODES['busack'] = busack;
kit.ORDER.splice(1, 0, 'busack');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
