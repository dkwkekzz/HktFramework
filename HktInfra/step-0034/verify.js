// HktInfra step-0034 — 헤드리스 검증 (버스 *동적 구독/해지* — runtime sub/unsub)
// 사용: node step-0034/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = busdyn(아래).
//   이 step 의 가설: 버스 라우팅 테이블을 *런타임에 양방향으로* 바꾸면(unsub→re-sub) 팬아웃이 *그 소비자만* 바뀐다 —
//                    공동 구독자(ranking)·발행자(bus.publishes)는 비트 동일이고, 손실은 토글한 소비자(audit)의 gap 에만 국한된다.
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이 step 의 새 모드(busdyn)만 추가.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0033/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: busdyn — 버스 동적 구독/해지(런타임 sub/unsub) ──
const { run, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극).
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// svc.item.out 이벤트는 tick 11~22 에 몰린다(사전 측정). unsub→re-sub 창이 활성 구간을 가르게 잡아 gap 손실을 강제.
const TOPIC = 'svc.item.out';     // 토글 대상 — audit·ranking 공동 구독(가방 결과 스트림)
const OTHER = 'svc.item';         // audit 가 계속 구독하는 *다른* 토픽(토글 무영향 대조)
const UNSUB_AT = 15, RESUB_AT = 18;

function busdyn(seeds) {
  console.log('== busdyn: *가설* — 버스 동적 구독/해지가 팬아웃을 *그 소비자만* 바꾼다(공동 구독자·발행자 비트 동일) ==');
  console.log(`  audit 의 ${TOPIC} 구독을 런타임 unsub(@${UNSUB_AT})→re-sub(@${RESUB_AT}). gap 손실만 audit 에 — ranking(공동 구독자)·bus.publishes·audit 의 ${OTHER} 행은 비트 동일.`);
  console.log('seed   | A0 base | A_unsub | A_resub | ranking R0/R1/R2 | other O0/O1/O2 | pub동일 | u/s회계 | clean | 판정');
  for (const seed of seeds) {
    const base  = run(BUS_BASE(seed));   // 정적 구독(0032 동작) — 전 구독 유지
    const uonly = run({ ...BUS_BASE(seed), busReSub: [{ at: UNSUB_AT, from: 'audit', type: 'unsub', topic: TOPIC }] });
    const resub = run({ ...BUS_BASE(seed), busReSub: [
      { at: UNSUB_AT, from: 'audit', type: 'unsub', topic: TOPIC },
      { at: RESUB_AT, from: 'audit', type: 'sub',   topic: TOPIC } ] });

    const A0 = base.audit.seen.get(TOPIC) || 0, Au = uonly.audit.seen.get(TOPIC) || 0, Ar = resub.audit.seen.get(TOPIC) || 0;
    const R0 = base.ranking.consumed, R1 = uonly.ranking.consumed, R2 = resub.ranking.consumed;
    const O0 = base.audit.seen.get(OTHER) || 0, O1 = uonly.audit.seen.get(OTHER) || 0, O2 = resub.audit.seen.get(OTHER) || 0;
    const P0 = base.bus.publishes, P1 = uonly.bus.publishes, P2 = resub.bus.publishes;

    const unsubStops = Au < A0;                     // unsub 후 audit 가 그 토픽 이벤트를 더는 못 받음(gap 존재)
    const resubResumes = Ar > Au;                   // re-sub 후 재수신(resub 가 unsub-only 보다 더 받음)
    const gapMissed = Ar < A0;                       // [unsub,resub) gap 은 진짜 놓침(전 구독보다 적음 = 토글 유효)
    const coSubSame = R0 === R1 && R1 === R2;        // 공동 구독자 ranking 은 audit 토글과 무관(비트 동일·라우팅 행 분리)
    const otherSame = O0 === O1 && O1 === O2;        // audit 의 *다른* 토픽(OTHER) 행은 무영향(그 토픽만 바뀜)
    const pubSame = P0 === P1 && P1 === P2;          // 발행자 무수정 — pub 수신 동일(팬아웃 사본 수만 변화)
    const acct = base.bus.unsubsRx === 0 && base.bus.subsRx === 0 &&   // 정적 base 는 런타임 sub/unsub 0
                 uonly.bus.unsubsRx === 1 && uonly.bus.subsRx === 0 &&
                 resub.bus.unsubsRx === 1 && resub.bus.subsRx === 1;
    // 동적 라우팅이 라이브 원장 보존/정합/desync 를 안 깸(원장 권위는 가방 — 버스 관찰 토글과 독립)
    const clean = itemConserved(resub) && ledgerConsistent(resub) && itemDesync(resub) === 0;

    const ok =
      check(unsubStops, `seed ${seed}: unsub 후에도 audit 가 ${TOPIC} 계속 수신(A0 ${A0}·Au ${Au})`) &&
      check(resubResumes, `seed ${seed}: re-sub 후 재수신 안 함(Au ${Au}·Ar ${Ar})`) &&
      check(gapMissed, `seed ${seed}: gap 손실 없음(Ar ${Ar}==A0 ${A0} — 토글 무효)`) &&
      check(coSubSame, `seed ${seed}: 공동 구독자 ranking 영향받음(R ${R0}/${R1}/${R2})`) &&
      check(otherSame, `seed ${seed}: audit 다른 토픽 행 영향(O ${O0}/${O1}/${O2})`) &&
      check(pubSame, `seed ${seed}: 발행자 pub 수신 달라짐(P ${P0}/${P1}/${P2})`) &&
      check(acct, `seed ${seed}: sub/unsub 회계 불일치(base ${base.bus.subsRx}/${base.bus.unsubsRx}·u ${uonly.bus.unsubsRx}·r ${resub.bus.subsRx}/${resub.bus.unsubsRx})`) &&
      check(clean, `seed ${seed}: 동적 라우팅이 보존/정합/desync 깨뜨림`);
    console.log(`${pad(seed,6)} | ${pad(A0,7)} | ${pad(Au,7)} | ${pad(Ar,7)} | ${pad(R0+'/'+R1+'/'+R2,16)} | ${pad(O0+'/'+O1+'/'+O2,14)} | ${(pubSame?'예':'아니오').padEnd(6)} | ${pad('u'+resub.bus.unsubsRx+'/s'+resub.bus.subsRx,7)} | ${(clean?'예':'아니오').padEnd(5)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 라우팅 테이블 Map<topic,[sub...]> 이 유일 SSOT. unsub=splice(그 addr 만)→해당 소비자 팬아웃 중단, re-sub=push→재개. 공동 구독자·발행자는 테이블의 *다른* 행이라 비트 동일(은닉·결정론 보존).`);
  console.log(`    분산 버스 failover 의 선결: 죽은 브로커→산 브로커로 구독을 *재협상*(옛 라우트 unsub·새 라우트 sub)하는 토대. busReSub OFF = 0032 비트 동일(reg).`);
}
kit.MODES['busdyn'] = busdyn;
kit.ORDER.splice(1, 0, 'busdyn');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
