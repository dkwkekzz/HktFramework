'use strict';
// step-0133 정리 분할 — topo-build.js 가 33KB>30KB 박스 트리거를 넘겨, *버스 구독 테이블 빌더*(buildSubs)를 분리한다.
//   buildSubs(c) 는 ServiceBus 소비자 구독 spec([topic, addr] 배열)을 c(플래그 컨텍스트)로부터 선언적으로 짓는다 —
//   기능 0·로직 verbatim 이동·반환 집합 불변 → reg 0. 0098 topo-actors(액터 팩토리) 분리의 후속(이번엔 구독 테이블).
//   topo-build 는 *spec 빌더 + 진입점*으로 남고 이 함수를 require 해 bus actor opts.subs 에 위임한다.
// dual-mode: Node 는 require, 브라우저는 <script> 선행 로드(전역 __HktNetParts.topo_subs).
//   구독 테이블이 SSOT — *새 소비자 추가 = 여기 행 추가뿐*(발행자 spec 무수정 = decouple 가설).
function buildSubs(c) {
  const subs = [];
  if (c.inventory) subs.push(['svc.item', 'inventory'], ['svc.item.out', 'gateway']);
  if (c.inventory && c.busAck) subs.push(['svc.item.ack', 'gateway']);   // 요청 ack(0040) — 가방→게이트웨이 자기-크기조정 경로. busAck OFF 면 미추가 = 0039 토폴로지 비트 동일.
  if (c.inventory && c.busOutAck) subs.push(['svc.item.out.ack', 'inventory']);   // 결과 ack(0041) — 게이트웨이→가방 자기-크기조정 경로. busOutAck OFF 면 미추가 = 0040 토폴로지 비트 동일.
  if (c.inventory && c.busSeenBound) subs.push(['svc.item.seen', 'inventory']);   // seen 워터마크(0042) — 게이트웨이→가방 seenReqs 가지치기 경로. busSeenBound OFF 면 미추가 = 0041 토폴로지 비트 동일.
  if (c.chat) subs.push(['svc.chat', 'chat'], ['svc.chat.out', 'gateway']);
  // 랭킹(0019) — *발행자 무수정으로* svc.item.out 에 둘째 소비자(ranking) 행 추가 + svc.rank.out 을 gateway 가 구독(클라 중계).
  if (c.rankingAddr) subs.push(['svc.item.out', 'ranking'], ['svc.rank.out', 'gateway']);
  if (c.audit) for (const t of ['svc.item', 'svc.item.out', 'svc.chat', 'svc.chat.out']) subs.push([t, 'audit']);
  if (c.audit && c.busLeaseAudit && c.inventory) subs.push(['svc.item.lease', 'audit']);   // lease 생애 관측(0054) — audit 가 축출/재admission 이벤트 구독. busLeaseAudit OFF 면 미추가(0053 토폴로지 비트 동일).
  if (c.busLeaseAudit && c.busLeasePresence && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.item.lease', 'orch']);   // lease 생애 *반응*(0055) — 코디네이션(orch)이 lease 이벤트 구독해 소비자 프레즌스 SSOT 유지. busLeasePresence OFF·orch 부재면 미추가(0054 토폴로지 비트 동일).
  if (c.presencePublish && c.busLeasePresence && c.audit && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence', 'audit']);   // 프레즌스 발행(0060) — orch 가 down/up/permanent 판정을 svc.presence 로 발행, audit(범용 sink)가 구독. presencePublish OFF·audit/orch 부재면 미추가(0059 토폴로지 비트 동일).
  if (c.presenceMonitor && c.presencePublish && c.busLeasePresence && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence', 'presmon']);   // 프레즌스 모니터(0063) — svc.presence 의 셋째 소비자(구조적 상태 기계). presenceMonitor OFF 면 미추가(0062 토폴로지 비트 동일·발행자 무수정).
  if (c.presenceAnnounce && c.presenceQuery && c.presenceShadowAddr && c.presenceMonitor && c.presencePublish && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence.active', 'presmon']);   // failover 중 질의 연속성(0070) — presmon 이 승격 공지를 구독해 queryAddr 재타깃. presenceAnnounce OFF 면 미추가(0069 토폴로지 비트 동일).
  if (c.whisperRouter && c.whisperFailover && c.presenceAnnounce && c.presenceShadowAddr && c.presenceQuery && c.presenceMonitor && c.presencePublish && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence.active', 'wrouter']);   // 귓속말 라우터 failover 연속성(0072) — wrouter 가 승격 공지를 구독해 queryAddr 재타깃(0070 presmon 재타깃의 라우터 판). whisperFailover OFF 면 미추가(0071 토폴로지 비트 동일).
  if (c.presenceBox && c.presenceReportBus && c.presencePublish && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence.report', 'presence']);   // 프레즌스 보고 버스화(0065) — PresenceService 가 orch 의 전이 보고를 버스 토픽으로 구독(point-to-point 대신). presenceReportBus OFF 면 미추가(0064 토폴로지 비트 동일).
  if (c.presenceShadowAddr) subs.push(['svc.presence.report', 'presence2']);   // 프레즌스 박스 shadow(0066) — standby presence2 가 *같은* 보고 토픽을 구독해 SSOT 그림자 복제(primary 뒤 등록 → 팬아웃 순서 primary 먼저). presenceShadow OFF 면 미추가(0065 토폴로지 비트 동일).
  if (c.presenceShadowAddr && c.presenceLease) subs.push(['svc.presence.hb', 'presence2']);   // 프레즌스 박스 사망 자율 감지(0068) — standby presence2 가 active primary 의 하트비트를 구독해 침묵 길이로 사망 감지. presenceLease OFF 면 미추가(0067 토폴로지 비트 동일).
  if (c.replaceAddr && c.busLeasePresence && c.failover && c.zones === 2 && c.inventory) subs.push(['svc.presence', 'ranking2']);   // 대체 소비자 활성화(0061) — standby ranking2 가 svc.presence 의 'permanent' 신호 구독(svc.item.out 은 활성화 후 *스스로* 재구독). spawnReplace OFF 면 미추가(0060 토폴로지 비트 동일).
  if (c.audit && c.rankingAddr) subs.push(['svc.rank.out', 'audit']);   // audit 도 rank 스트림 관찰(둘째 소비자의 둘째 소비자)
  if (c.audit && c.failedPublish && c.whisperRouter) subs.push(['svc.whisper.failed', 'audit']);   // 전달 실패 발행(0082) — audit 가 svc.whisper.failed 구독(발행자 무수정 관측 소비자). failedPublish OFF 면 미추가(0081 토폴로지 비트 동일).
  if (c.audit && c.deliveredPublish && c.whisperRouter) subs.push(['svc.whisper.delivered', 'audit']);   // 전달 성공 발행(0087) — audit 가 svc.whisper.delivered 구독(수명주기 성공 절반). deliveredPublish OFF 면 미추가(0086 토폴로지 비트 동일).
  if (c.audit && c.partyChange && c.partyService) subs.push(['svc.party.changed', 'audit']);   // 멤버십 변경 발행(0084) — audit 가 svc.party.changed 구독(가입/탈퇴 관측). partyChange OFF 면 미추가(0083 토폴로지 비트 동일).
  if (c.audit && c.partyIncompletePublish && c.whisperRouter) subs.push(['svc.party.incomplete', 'audit']);   // 파티 incomplete 발행(0093) — audit 가 svc.party.incomplete 구독(부분 전달 실패 종결 관측). partyIncompletePublish OFF 면 미추가(0092 토폴로지 비트 동일).
  if (c.audit && c.partyCompletePublish && c.whisperRouter) subs.push(['svc.party.complete', 'audit']);   // 파티 complete 발행(0095) — audit 가 svc.party.complete 구독(전원 acked 성공 종결 관측). partyCompletePublish OFF 면 미추가(0094 토폴로지 비트 동일).
  if (c.audit && c.mailboxDrainedPublish && c.whisperReceipt && c.whisperRouter) subs.push(['svc.mailbox.drained', 'audit']);   // 읽음 소비 발행(0103) — audit 가 svc.mailbox.drained 구독(읽음 확인 소비 관측·수명주기 마지막 마디). mailboxDrainedPublish OFF 면 미추가(0102 토폴로지 비트 동일).
  if (c.audit && c.mailboxLossPublish && c.whisperReceipt && c.whisperRouter) subs.push(['svc.mailbox.overflowed', 'audit']);   // 수신함 손실 발행(0104) — audit 가 svc.mailbox.overflowed 구독(inbox overflow 손실 관측). mailboxLossPublish OFF 면 미추가(0103 토폴로지 비트 동일).
  if (c.audit && c.exchange && c.exchangePublish) subs.push(['svc.exchange.sold', 'audit']);   // 거래소 체결 발행(0108) — audit 가 svc.exchange.sold 구독(거래 수명주기 관측). exchangePublish OFF 면 미추가(0107 토폴로지 비트 동일).
  if (c.audit && c.exchange && c.cancelPublish) subs.push(['svc.exchange.cancelled', 'audit']);   // 거래소 취소 발행(0111) — audit 가 svc.exchange.cancelled 구독(delisting 관측). cancelPublish OFF 면 미추가(0110 토폴로지 비트 동일).
  if (c.audit && c.exchange && c.expirePublish) subs.push(['svc.exchange.expired', 'audit']);   // 거래소 만료 발행(0115) — audit 가 svc.exchange.expired 구독(만료 관측). expirePublish OFF 면 미추가(0114 토폴로지 비트 동일).
  if (c.audit && c.exchange && c.abortPublish) subs.push(['svc.exchange.aborted', 'audit']);   // 보상 발행(0123) — audit 가 svc.exchange.aborted 구독(보상 롤백 관측). abortPublish OFF 면 미추가(0122 토폴로지 비트 동일).
  if (c.audit && c.exchange && c.abandonPublish) subs.push(['svc.exchange.saga_abandoned', 'audit']);   // 포기 발행(0132) — audit 가 svc.exchange.saga_abandoned 구독(영구 미해결 give 관측). abandonPublish OFF 면 미추가(0131 토폴로지 비트 동일).
  if (c.marketFeed && c.exchange) { subs.push(['svc.exchange.sold', 'market']); subs.push(['svc.exchange.cancelled', 'market']); subs.push(['svc.exchange.expired', 'market']); }   // 시세 피드(0112·0116) — MarketFeed 가 체결·취소·만료 구독→item별 시세 투영. marketFeed OFF 면 미추가(0111 토폴로지 비트 동일).
  if (c.audit && c.bouncePublish && c.whisperRouter) subs.push(['svc.whisper.bounced', 'audit']);   // 귓속말 반송 발행(0097) — audit 가 svc.whisper.bounced 구독(즉시 도달 불가 관측). bouncePublish OFF 면 미추가(0096 토폴로지 비트 동일).
  return subs;
}

const __part = { buildSubs };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_subs = __part;
