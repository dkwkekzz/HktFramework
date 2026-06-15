// HktInfra step-0037 — 헤드리스 검증 (버스 failover *결과 경로 무손실* — producer replay 로 gap desync 0)
// 사용: node step-0037/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = busfail(아래·0034 위에 한 조각 확장).
//   이 step 의 가설: 0034 는 버스 crash 후 *재구독*으로 routing 을 복구했으나, crash gap 에 떨군 svc.item.out *결과*(원장 적용·클라 미수신)는
//                    영구 손실(클라 belief 가 원장보다 뒤처짐 = itemDesync≥0·0034 §9). 가방(producer)이 발신 결과를 보관했다가 버스 복구 시
//                    *재발행*(0023 홉 신뢰·0025 give-resend 의 버스 판)하면 뒤처진 클라가 따라잡아 itemDesync→0 — 클라 belief 는 Set 이라 멱등(dedup 불요).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이 step 의 새 모드(busfail)만 추가.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0036/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: busfail — 버스 failover: 구독 재협상으로 라우팅 복구 ──
const { run, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극).
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// svc.item.out 이벤트는 tick 11~22 에 몰린다(사전 측정). crash→재협상 창이 활성 구간을 가르게 잡아 gap 손실을 강제.
const TOPIC = 'svc.item.out';     // 측정 토픽 — audit·ranking 공동 구독(가방 결과 스트림)
const CRASH_AT = 12, RENEG_AT = 14;   // pub 스트림(버스 수신)이 재협상 이후로도 흐르게 — crash 전 일부 수신·gap 손실·재협상 후 재개가 모두 가시

function busfail(seeds) {
  console.log('== busfail: *가설* — 버스 crash gap 에 떨군 svc.item.out 결과를 가방(producer)이 *재발행*하면 뒤처진 클라가 따라잡아 itemDesync→0 ==');
  console.log(`  bus.crash(@${CRASH_AT}) → 재협상(@${RENEG_AT}). recover(재구독만·gap 결과 손실=대조군) vs resend(재구독+결과 재발행·busResend ON·무손실) 비교. crashOnly=영구 단절.`);
  console.log('seed   | A_recover | ranking Rr | subN base/recov/crashO | 원장valid | desync recov→resend | outResends | 판정');
  for (const seed of seeds) {
    const base   = run(BUS_BASE(seed));   // crash 0 — 전 구독 유지(0033 동작)
    const crashO = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT } });                       // crash 만(재협상 없음) = 영구 단절(대조군)
    const recov  = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT } });    // crash + 재협상(routing 복구만) = 결과 gap 손실(대조군)
    const resend = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, busResend: true });   // crash + 재협상 + 결과 재발행(이 step) = 무손실

    const A0 = base.audit.seen.get(TOPIC) || 0, Ac = crashO.audit.seen.get(TOPIC) || 0, Ar = recov.audit.seen.get(TOPIC) || 0;
    const Rr = recov.ranking.consumed, R0 = base.ranking.consumed, Rc = crashO.ranking.consumed;
    const subN0 = base.bus.subscriberCount(TOPIC), subNr = recov.bus.subscriberCount(TOPIC), subNc = crashO.bus.subscriberCount(TOPIC);
    const dR = itemDesync(recov), dResend = itemDesync(resend), dC = itemDesync(crashO);   // recov: gap 결과 손실로 desync≥0 / resend: 재발행으로 desync 0
    const outResends = resend.inventory.outResends;

    const crashSevers = Ac < A0 && Rc < R0;          // crash 후 서비스 경로 단절(audit·ranking 둘 다 수신 멈춤)
    const recovers = Ar > Ac && Rr > Rc;             // 재협상 후 팬아웃 재개(복구가 단절보다 더 받음)
    const routingBack = subNr === subN0 && subN0 > 0; // 재협상이 라우팅 테이블을 *완전* 복원(구독자 수 == 기준선)
    const severed = subNc === 0;                       // 대조군: crash 후 재협상 0 이면 구독자 0(영구 단절)
    // 이 step 의 핵심: recov(재구독만)는 gap 의 떨군 *결과* 때문에 클라 belief 가 원장보다 뒤처짐(desync≥0·0034 §9 = 대조군) →
    //   resend(busResend ON)는 가방이 보관 결과를 재발행 → 뒤처진 클라가 따라잡음(desync 0·무손실). 클라 belief 는 Set 이라 재배달 멱등(consumer dedup 불요).
    const lostWithoutResend = dR > 0;                  // 대조군: 재구독만으론 결과 gap 손실 잔존(클라 뒤처짐)
    const losslessWithResend = dResend === 0;          // 가설: 결과 재발행으로 desync 0(무손실)
    const resendHappened = outResends > 0;             // 재발행이 실제 일어남(producer replay 발동)
    // 원장 무손상 — 결과 재발행은 *읽기 전용 fan-out*(원장 비-침습) → 보존·정합 유지. 재발행이 원장을 오염시키지 않음.
    const ledgerValid = itemConserved(resend) && ledgerConsistent(resend) && itemConserved(recov) && ledgerConsistent(recov);

    const ok =
      check(crashSevers, `seed ${seed}: crash 가 서비스 경로 안 끊음(A0 ${A0}·Ac ${Ac}·R0 ${R0}·Rc ${Rc})`) &&
      check(recovers, `seed ${seed}: 재협상 후 복구 안 됨(Ac ${Ac}·Ar ${Ar}·Rc ${Rc}·Rr ${Rr})`) &&
      check(routingBack, `seed ${seed}: 재협상이 라우팅 미복원(subN base ${subN0}·recover ${subNr})`) &&
      check(severed, `seed ${seed}: 대조군 crash 후에도 구독자 잔존(영구 단절 아님·subN ${subNc})`) &&
      check(lostWithoutResend, `seed ${seed}: 대조군(재구독만) desync 0 — gap 결과 손실이 안 보임(dR ${dR})`) &&
      check(losslessWithResend, `seed ${seed}: 결과 재발행에도 desync 잔존(dResend ${dResend})`) &&
      check(resendHappened, `seed ${seed}: 결과 재발행 0(producer replay 미발동·outResends ${outResends})`) &&
      check(ledgerValid, `seed ${seed}: 버스 failover/재발행이 원장 보존/정합 깨뜨림(손상)`);
    console.log(`${pad(seed,6)} | ${pad(Ar,9)} | ${pad(Rr,10)} | ${pad(subN0+'/'+subNr+'/'+subNc,22)} | ${(ledgerValid?'예':'아니오').padEnd(8)} | ${pad(dR+'→'+dResend,19)} | ${pad(outResends,10)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 버스는 *살아 돌아온* 새 박스(영속 0) — crash gap 에 떨군 메시지를 못 메운다. 진실 원천(producer=가방)이 발신 결과를 보관했다 재발행해야 무손실.`);
  console.log(`    recover(재구독만)는 routing 만 복구 → gap 의 떨군 *결과*(원장 적용·클라 미수신)는 영구 손실(클라 belief < 원장 = desync·0034 §9 = 대조군).`);
  console.log(`    resend(busResend ON)는 0023 홉 신뢰·0025 give-resend 의 *버스 판* — 가방이 svc.item.out 결과를 재발행 → 뒤처진 클라 따라잡음(desync 0). 클라 belief 는 Set 이라 멱등(재배달 무해·dedup 불요).`);
  console.log(`    정직한 한계: outBuffer 무계(유계 슬라이딩 창은 후속 — 0017→0018 압축 선례). *요청* 경로 드롭(mint 안 됨·양측 모름 = desync 무관)·give 결과 ahead 케이스는 0025 give-resend 영역. busResend OFF = 0035 비트 동일(reg).`);
}
kit.MODES['busfail'] = busfail;
kit.ORDER.splice(1, 0, 'busfail');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
