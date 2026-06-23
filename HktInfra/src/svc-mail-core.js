'use strict';
// step-0170 — 아이템 우편 give↔가방 transfers capstone(sagaLiveConsistent + 두 서비스 giveOks==escrowXfers): 0161~0169 가 아이템 우편↔가방 3 레그·2-서비스 보존·saga 회신/재전송/정합을 쌓았다. *전체*가 닫혀 있는가?
//   sagaLiveConsistent = mailConsistent(메시지 0150) AND itemConsistent(아이템 0160) AND escrowConsistent(escrow 0164) AND sagaConsistent(saga 0169) — 우편 박스 *내부* 네 회계층의 동시 닫힘. + verify 가 우편 giveOks == 가방 escrowXfers(두 서비스 회계 합치·거래소 0130 의 우편 판).
//   미호출 읽기 accessor·단언용 = 0169 비트 동일(reg). 아이템 우편↔가방 saga arc(0161~0170) 닫기·거래소↔가방(0117~0140)의 우편 판 완성.
// step-0169 — 아이템 우편 saga 회계 정합 capstone(sagaConsistent): 0166~0168 의 saga 회계(gives·ackedGives·pendingGives·giveOks·giveFails)가 *대수적으로 닫혀* 있는가?
//   두 항등식: ① gives == ackedGives + pendingGives(보낸 모든 give 는 정확히 acked(회신 받음) 또는 pending(미수신) 둘 중 하나·새는 give 0) ② ackedGives == giveOks + giveFails(받은 모든 회신은 ok/fail 분류·누락 0). 정상·회신손실·재전송 *모든 체제*서 성립.
//   sagaConsistent = 두 항등식 AND·미호출 읽기 accessor·단언용. 거래소 0128 의 우편 판. 미호출이면 동작 무영향 = 0168 비트 동일(reg).
// step-0168 — 아이템 우편 saga 회신 재전송 + idempotent dedup(mailRetry·가방 sagaDedup 재사용): 0167 은 손실을 *감지*만 했다 — 잃은 회신을 *되찾는* 경로가 없었다.
//   이 step: mailRetry op 이 pendingGive 의 미해결 give 를 *같은 gid* 로 재발신(_resendPending). 가방이 (replyTo,gid) 로 dedup(sagaDedup) — 이미 처리한 give 면 *재실행 없이 저장된 결과를 재회신*. 회신만 손실된 give(이미 성공)가 재실행→오판되는 것을 막는다(거래소 0126 의 우편 판). 재전송은 pending 잔존분만(gives/escrowXfers 무증가·retries++).
//   dedup ON: 재전송→저장 ok 재회신→pending drain·escrowXfers 불변(재실행 0). mailRetry op 부재면 0167 비트 동일(회귀 0). ackDrop 은 *1회* 손실로 변경(transient·재전송이 통과).
// step-0167 — 아이템 우편 saga 미해결 give 추적 + 회신 손실 감지(pendingGives·gid): 0166 은 회신을 *세기만* 했다 — 어느 give 가 회신을 못 받았는지 몰랐다(회신 손실 무대비).
//   이 step: saga ON 이면 _custody 가 give 마다 단조 gid 를 부여·미해결 집합(pending)에 add. item_result 회신이 그 gid 로 오면 delete. 정상 흐름서 pending 0 으로 drain(닫힌 고리 liveness). 회신 손실(테스트 seam ackDrop)이면 잃은 gid 가 pending 에 *남는다*(ackedGives<gives·격차 가시). 재전송 소스 pendingGive 도 보관(0168 대비).
//   거래소↔가방 0125(pendingGives·gid)의 우편 판. saga OFF·gid 부재면 추적 0 = 0166 비트 동일(회귀 0). ackDrop 미제공이면 손실 0(정상 = 무손실).
// step-0166 — 아이템 우편 saga 회신 비동기 수신(mailSaga·ackedGives): 0161~0164 는 가방 give 를 *fire-and-forget* 으로 보냈다 — 회신(item_result)을 안 받아 give 성공/실패를 우편이 몰랐다(거래소 0121 의 무대비).
//   이 step: mailSaga ON 이면 _custody 가 give 에 replyTo(우편 주소)+cause 를 실어 가방이 item_result 를 우편으로도 echo(2-서비스 피드백 채널). 우편 onMsg 가 item_result{op:'give'} 수신 → ackedGives++·giveOks/giveFails 집계. 무손실서 gives==ackedGives(닫힌 고리 liveness).
//   거래소↔가방 saga(0121)의 우편 판. mailSaga OFF·replyTo 부재면 가방이 echo 안 함 → item_result 안 옴 = 0165 비트 동일(회귀 0).
// step-0165 정리 분할 — MailService *원장 코어*(생성자 + 헬퍼 _snapState/_restore/_journal/_box/_custody + crash + reconstruct + 조회/회계 accessor + digest).
//   svc-mail.js 가 30KB 를 넘어(비대화 트리거·박스 1개=파일 1개 유계) 박스를 부품으로 재분할(기능 0·바이트 동일·reg 0). 거래소 svc-exchange core/txn(0124)·가방 svc-inventory(0053)·svc-whisper(0094) 와 같은 패턴.
//   트랜잭션 핸들러(onMsg: mailSend/mailFetch/mailSweep)는 svc-mail-txn.js 가 Object.assign 으로 프로토타입 증강(동작 불변). 진입점 svc-mail.js 가 core→txn 순 로드.
// step-0164 — 아이템 우편↔가방 2-서비스 보존 capstone(escrowItemIds·escrowConsistent): 0161~0163 이 3 레그(발신 인출·수령 입금·만료 반환)로 아이템을 *실제 가방 간* 이동시켰다. 그 두 서비스(우편·가방)의 회계가 *교차 정합*인가?
//   이 step: 우편 박스가 escrow custody 중인 itemId 집합(escrowIds)을 추적 — 발신 시 add·수령/만료 시 delete(invMode 일 때만). 두 단언: ⒜ escrowConsistent(우편 내부: itemHeld==escrowIds.size — 보유 아이템 우편 통수 == escrow 아이템 수) ⒝ verify 가 우편 escrowItemIds() == 가방의 'escrow' 소유 집합(두 서비스 일치·거래소 0120 escrowItemIds 의 우편 판).
//   미호출 read accessor·invMode OFF 시 escrowIds 미변경 = 0163 비트 동일(회귀 0). 거래소↔가방 0120(open==escrow) 의 우편 판·아이템 우편↔가방 arc(0161~0164) 닫기.
// step-0163 — 아이템 우편↔가방 leg3: 만료 시 escrow → 발신자 가방 반환(mailInv): 0161~0162 는 발신 인출·수령 입금만 했다 — 미수령 우편이 TTL 만료(0159)되면 아이템이 escrow 에 영영 묶였다(발신자도 수신자도 못 받음·아이템 증발).
//   이 step: mailSweep 만료 시 아이템 실은 통마다 가방에 give('escrow' → 발신자 from) 를 요청한다(거래소 0119 cancel/expire leg3 의 우편 판). 미수령 아이템이 발신자 가방으로 회수. 회계 gives++.
//   아이템 경로 분기 완성: 발신자→escrow(leg1) → {수령 시 수신자(leg2) | 만료 시 발신자 반환(leg3)}. 아이템은 어느 경로든 *실제 가방*에 착지(증발 0). 2-서비스 보존 capstone(0164) 후속.
//   mailInv OFF·inv 부재·item 미첨부면 give 0 = 0162 비트 동일(회귀 0).
// step-0162 — 아이템 우편↔가방 leg2: 수령 시 escrow → 수신자 가방 입금(mailInv): 0161 은 발신자 가방서 인출(escrow)만 했다 — 수신자가 수령해도 아이템이 escrow 에 묶인 채였다(가방엔 안 들어옴).
//   이 step: mailFetch 가 아이템 실은 통마다 가방에 give('escrow' → 수신자) 를 요청한다(거래소 0118 buy leg2 의 우편 판). 아이템이 escrow 를 떠나 수신자 가방으로 입금. 회계 gives++.
//   leg1(0161 발신 인출)의 짝 — 발신자→escrow→수신자 의 2-홉 custody 가 닫힌다(선물·전리품이 실제 가방 간 이동). 만료 반환 leg3(0163)·2-서비스 보존 capstone(0164) 후속.
//   mailInv OFF·inv 부재·item 미첨부면 give 0 = 0161 비트 동일(회귀 0).
// step-0161 — 아이템 우편↔가방 leg1: 발신 시 발신자 가방 인출(mailInv·escrow custody): 0157~0160 은 아이템을 *우편 박스 내 회계*로만 추적했다 — 실제 가방(inventory) 원장은 안 건드렸다(아이템 우편이 가방과 분리된 가짜 escrow).
//   이 step: mailInv ON 이면 mailSend 가 아이템 실은 통마다 가방에 give(발신자 from → 'escrow') 를 요청한다(거래소 0117 list leg1 의 우편 판). 가방이 원장 권위·우편 박스는 요청만(은닉·명시 인터페이스). 회계 gives++.
//   거래소↔가방 2-서비스 쌍 거래(0117~0120)의 우편 판 — 아이템이 발신자 가방을 *실제로 떠나* escrow custody 로 이동. 수령 입금(0162)·만료 반환(0163)·2-서비스 보존 capstone(0164) 후속.
//   mailInv OFF·inv 부재·item 미첨부면 give 0 = 0160 비트 동일(회귀 0·추상 escrow 0157~0160 동일).
// step-0160 — 아이템 우편 회계 정합 capstone(itemConsistent·itemSent==itemHeld+itemFetched+itemExpired): 0157~0159 가 아이템의 입금·수령·만료를 쌓았다. 그 회계가 *대수적으로 닫혀* 있는가?
//   itemConsistent: 아이템 1개는 매 순간 정확히 한 상태 — 보유(itemHeld)·수령(itemFetched)·만료(itemExpired) 으로 분할(공백·중복 0). itemSent == 셋의 합이 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립.
//   0150 mailConsistent(메시지 통수 판)의 *아이템 판*·아이템 우편 arc(0157~0160) 닫기. 미호출 read accessor = 0159 비트 동일(reg).
// step-0159 — 아이템 우편 만료 회수(itemExpired): 0157~0158 은 아이템의 입금·수령만 회계했다 — 미수령 아이템 우편이 TTL 만료되면 아이템 회계가 어디로 가는지 미집계였다.
//   이 step: mailSweep 만료 시 아이템 실은 통수만큼 itemExpired++(만료 우편의 아이템 회수). 회계 itemHeld→itemExpired 전이. 만료된 아이템은 발신자 반환이 자연스러우나(가방 연동) 본 step 은 *우편 박스 내 회수 회계*까지(반환 give 는 백로그). mailItem OFF·아이템 미첨부면 itemExpired 0 = 0158 비트 동일.
// step-0158 — 아이템 우편 수령(itemFetched): 0157 은 아이템을 *보유(held)* 까지만 회계했다 — 수신자가 수령하면 아이템이 어디로 가는지 미집계였다.
//   이 step: mailFetch 가 보유→수령 이동 시 아이템 실은 통수만큼 itemFetched++(아이템도 메시지와 함께 read 로 이동·읽음 보관). 회계 itemHeld→itemFetched 전이. mailItem OFF·아이템 미첨부면 itemFetched 0 = 0157 비트 동일.
// step-0157 — 아이템 첨부 우편(mailItem·mailSend item): 0142~0156 우편은 *메시지(body)* 만 날랐다 — 아이템 우편(선물·전리품 배송)이 없었다.
//   이 step: mailSend 가 선택 필드 item(아이템 id)을 받아 우편 1통이 아이템 1개를 *함께 보유*한다. itemSent(아이템 실은 입금 통수)·itemHeld(보유 중 아이템 통수) 회계. 거래소 escrow(0117)처럼 아이템이 우편함에 묶인다(가방 연동 give/반환은 후속 백로그).
//   mailItem OFF·item 미첨부면 item=null·itemSent 0·digest 무변경 = 0156 비트 동일. 수령 시 아이템 이동(0158)·만료 회수(0159)·아이템 회계 capstone(0160) 후속.
// step-0150 — 우편 회계 정합 capstone(mailConsistent·sent==held+fetched+expired): 0142~0149 우편 arc 의 *창발 불변*을 단언하는 capstone(거래소 0140 sagaLiveConsistent 의 우편 판).
//   우편 1통은 매 순간 정확히 한 상태에 있다 — 보유(held·우편함)·수령(fetched·읽음)·만료(expired·회수) 으로 분할되며 공백·중복 0. sent == totalHeld + fetched + expired 가 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립.
//   미호출 read accessor = 0149 비트 동일(reg). 0142~0149 가 더한 모든 전이(입금·수령·만료·replay)가 이 분할을 보존함을 닫는 단언.
// step-0149 — 우편 만료 발행(mailExpirePublish·svc.mail.expired): 0148 만료는 *발행 0* — 발신자/운영이 만료를 관측할 길이 없었다.
//   이 step: mailSweep 만료 시 통마다 svc.mail.expired{id,to,from} 발행 → audit 가 관측. 우편 수명주기 발행 3종(입금 svc.mail.sent 0144·읽음 svc.mail.read 0147·만료 svc.mail.expired) 완비(거래소 sold/cancelled/expired 와 동형). OFF·bus 부재면 발행 0 = 0148 비트 동일.
// step-0148 — 우편 만료 TTL(mailTtl·now−sentAt≥ttl 자동 회수): 미수령 우편이 우편함에 영영 쌓일 수 있다(0143 의 정직한 한계).
//   거래소 0114(매물 만료 TTL)처럼, mailSweep(now) 가 now−sentAt≥ttl 인 미수령 우편을 *시간 트리거*로 회수(보유→만료). 회계가 sent==held+fetched+expired 로 완비(우편 1통은 매 순간 보유/수령/만료 정확히 한 상태).
//   만료도 durable op('expire')로 저널 → reconstruct 정합. ttl 0·mailSweep 미주입이면 만료 0 = 0147 비트 동일.
// step-0147 — 우편 읽음 확인 발행(mailReadPublish·svc.mail.read): 0144 는 *입금*만 발행했다 — 수령(읽음)은 운영/발신자가 관측할 길이 없었다.
//   이 step: mailFetch 수령 시 통마다 svc.mail.read{id,to,from} 발행 → audit/발신자가 *읽음*을 관측(수명주기 발행 확장·거래소 sold/cancelled 류). 우편함 권위 불변(발행=파생 스트림·비-침습). OFF·bus 부재면 발행 0 = 0146 비트 동일.
// step-0146 — 우편 저널 스냅샷 압축(mailSnapshot): 0145 저널은 무압축이라 send/fetch 누적으로 무한 성장한다.
//   거래소 0110·가방 0018 처럼, 저널 N항(snapInterval)마다 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → *tail 만* 유계 보관.
//   reconstruct 는 스냅샷에서 출발해 tail 만 replay → 전체-저널 replay 와 *비트 동일*(무손실 압축). 라이브 projection 비-침습(압축은 저널 쪽 일). snapInterval 0 면 0145 비트 동일.
// step-0145 — 우편 영속·failover(mailPersist·op 저널 replay): 0142~0144 우편함은 *자기 영속 0* — crash 시 보유·수령이 전부 휘발했다.
//   가방 0017(효과 저널)·거래소 0109(op 저널)처럼, 우편도 원장을 바꾼 op(send·fetch)를 durable 저널에 append 하고, crash(projection 소실) 후 그 저널을 seq 순 replay 해
//   우편함+읽음+회계를 *죽기 전과 비트 동일*하게 재구성한다(event sourcing·발신/발행 없이 순수 재현). persist OFF·미replay 면 소실(영속 부재의 대가 = 대조군). "세계가 세션보다 오래 산다".
// step-0144 — 우편 발행(mailSentPublish·svc.mail.sent): 입금(mailSend)을 버스로 발행해 audit/읽기 모델이 *발행자 무수정으로* 관측한다 —
//   거래소 0108(exchangePublish→svc.exchange.sold·audit 구독)의 우편 판. 우편함 권위는 여전히 MailService(발행은 파생 관찰 스트림). OFF·bus 부재면 발행 0 = 0143 비트 동일.
// step-0143 — 우편 수령(mailFetch): 0142 는 입금만이라 우편함이 무한히 쌓였다 — 수신자가 *가져가는* 경로가 없었다.
//   이 step: 수신자가 우편함을 pull → 보유(held)에서 수령(fetched)으로 *무손실 이동*(읽음 보관·이중 수령 0·빈 우편함 재수령 0).
//   회계 확장: 0142 sent==totalHeld 에서 sent==held+fetched 로(+expired 0148). 우편은 오프라인 배송이므로 *접속 시 수령*이 정상 흐름(귓속말의 즉시 전달과 대비).
// step-0142 — 우편(Mail) 서비스 분리(MailService): SPINE §2 게임 서비스 계층의 *우편*(⬜→🟡 첫 박스). offline 비동기 배송 —
//   귓속말(0071~ wrouter)이 *온라인* 라우팅(수신자 접속 시 즉시 전달/반송)이라면, 우편은 *오프라인* 배송: 발신자가 수신자 우편함에 넣으면
//   수신자가 *나중에 접속해 수령*한다(접속 무관·세계가 세션보다 오래 — SPINE §2 "tick 과 무관한 책임은 존 밖으로").
//   존 tick 밖 별 박스(신성한 tick 보존)·단일 소유(우편함 권위는 이 박스)·발신 0(0142 — 입금만; 수령 0143·발행 0144~).
//   0142 한 조각: mailSend(입금) — 발신자→수신자 우편함에 우편 1통 적재. 우편함 = recipient별 Map(mailId→mail). 거래소(0107)·시세 피드(0112) 박스 도입 패턴.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { fnv1a } = __c;

// ── [게임 서비스] MailService — 오프라인 우편 배송 박스. 존 tick 밖·발신 0(0142). 우편함 권위 단일 소유. ──
//   boxes: recipient -> Map(mailId -> {id, from, to, body, sentAt}). mailSend 입금 시 우편 1통 적재(같은 id 재전송 멱등).
//   회계(0150 capstone 대비): sent = 총 입금 통수. 0142 엔 held(보유)만 = sent(수령/만료 0).
class MailService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 발행용(svc.mail.* 발행 — 0144~).
    this.sentPublish = opts.sentPublish || false;   // 입금 발행(step-0144·mailSentPublish) — mailSend 시 svc.mail.sent 발행. OFF·bus 부재면 발행 0(0143 비트 동일).
    this.sentPublished = 0;        // 발행한 svc.mail.sent 수(step-0144·계측·sent 와 1:1).
    this.readPublish = opts.readPublish || false;   // 읽음 발행(step-0147·mailReadPublish) — mailFetch 수령 시 통마다 svc.mail.read 발행. OFF·bus 부재면 발행 0(0146 비트 동일).
    this.readPublished = 0;        // 발행한 svc.mail.read 수(step-0147·계측·fetched 와 1:1).
    this.expirePublish = opts.expirePublish || false;   // 만료 발행(step-0149·mailExpirePublish) — mailSweep 만료 시 통마다 svc.mail.expired 발행. OFF·bus 부재면 발행 0(0148 비트 동일).
    this.expirePublished = 0;      // 발행한 svc.mail.expired 수(step-0149·계측·expired 와 1:1).
    this.boxes = new Map();        // recipient -> Map(mailId -> mail) — 우편함 권위(단일 소유·보유 held).
    this.sent = 0;                 // 총 입금 통수(회계 — 0150 sent==held+fetched+expired 의 좌변).
    this.fetched = 0;              // 총 수령 통수(step-0143 — 수신자가 가져간 합).
    this.expired = 0;              // 총 만료 통수(step-0148 — 만료 회수 합; 0143 엔 0).
    this.item = opts.item || false;   // 아이템 첨부 우편(step-0157·mailItem) — mailSend 의 item 필드를 우편에 싣는다. OFF 면 item=null·itemSent 0(0156 비트 동일).
    this.itemSent = 0;             // 아이템 실은 입금 통수(step-0157 — 0160 itemSent==itemHeld+itemFetched+itemExpired 의 좌변).
    this.itemFetched = 0;          // 아이템 실은 수령 통수(step-0158).
    this.itemExpired = 0;          // 아이템 실은 만료 통수(step-0159).
    this.inv = opts.inv || null;        // 가방(inventory) 주소(step-0161·mailInv) — 아이템 우편 escrow 실체화 give 의 대상. 부재면 추상 escrow(0160 동일).
    this.invMode = opts.invMode || false;   // 우편↔가방 원자 거래(step-0161·mailInv) — ON 이면 send/fetch/expire 가 가방 give 로 아이템 custody 이동. OFF 면 추상 escrow(0160 비트 동일).
    this.gives = 0;                // 가방에 보낸 give 요청 통수(step-0161 — 0164 2-서비스 보존·가방 escrowXfers 와 교차 정합).
    this.saga = opts.saga || false;     // saga 회신 비동기 수신(step-0166·mailSaga) — ON 이면 give 에 replyTo+cause 를 실어 가방이 item_result 를 echo. OFF 면 fire-and-forget(0165 비트 동일).
    this.ackedGives = 0;           // 가방서 회신(item_result) 받은 give 통수(step-0166 — 무손실서 gives==ackedGives·닫힌 고리 liveness).
    this.giveOks = 0;              // 성공 회신 통수(step-0166 — 0170 giveOks==가방 escrowXfers 교차 정합 capstone 의 좌변).
    this.giveFails = 0;            // 실패 회신 통수(step-0166 — 발신자 미소유 등; 무손실·정상 소유서 0).
    this.gid = 0;                  // 단조 give id(step-0167) — saga 회신 매칭 키. _custody 가 발급.
    this.pending = new Set();      // 미해결 give 의 gid 집합(step-0167) — _custody add·item_result 회신이 delete. 정상 0 drain·회신 손실 시 잔존(ack 미수신 격차 가시).
    this.pendingGive = new Map();  // gid -> {itemId,from,to,cause}(step-0167) — 재전송 소스(0168 대비·회신 손실 시 같은 gid 로 재발신).
    this.pendingPeak = 0;          // 미해결 최대치(step-0167·관측).
    this.ackDrop = opts.ackDrop ? new Set(opts.ackDrop) : null;   // 테스트 seam(step-0167) — 수신 시 *1회* 드롭할 gid 집합(transient 회신 손실 모의·step-0168 부터 drop-once → 재전송이 통과). 미제공이면 무손실(production 무영향·reg 0).
    this.retries = 0;              // saga 재전송 통수(step-0168·mailRetry — 재발신은 gives 무증가·이 별도 계측).
    this.escrowIds = new Set();    // escrow custody 중인 itemId 집합(step-0164·2-서비스 보존) — 발신 add·수령/만료 delete(invMode 일 때만). 가방의 'escrow' 소유 집합과 교차 정합. invMode OFF 면 빔(0163 비트 동일).
    this.read = new Map();         // recipient -> [수령한 mail…] — 읽음 보관(0147 읽음 확인 발행 대비·수령 내용 검증).
    this._seq = 0;                 // 결정론 mail id 시퀀스(id 미지정 시 'mail'+seq — 단일 박스 순서 = 결정적).
    this.ttl = opts.ttl || 0;      // 만료 TTL(step-0148·mailTtl) — now−sentAt≥ttl 미수령 우편 자동 회수. 0 면 만료 0(0147 동일).
    this.persist = opts.persist || false;   // 원장 영속(step-0145·mailPersist) — send/fetch op 를 durable 저널에 기록·crash 후 replay. OFF 면 저널 0(0144 동일·휘발).
    this.journal = [];             // durable op 저널 [{seq,kind,...}](step-0145) — projection(우편함·읽음·회계)과 분리(crash 시 projection 만 소실).
    this.jseq = 0;                 // 저널 시퀀스(append-only).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0146·mailSnapshot) — 저널 N항마다 projection 스냅샷+가지치기. 0 면 무압축(0145 동일).
    this.snapshot = null;          // {upToSeq, state}(step-0146) — 마지막 압축 스냅샷. reconstruct 의 출발점.
  }
  // projection 스냅샷/복원(step-0146) — 우편함(보유)·읽음·회계를 plain 구조로 직렬화/역직렬화(스냅샷 압축의 베이스).
  _snapState() {
    return {
      boxes: [...this.boxes].map(([r, mm]) => [r, [...mm.values()].map(x => ({ ...x }))]),
      read: [...this.read].map(([r, arr]) => [r, arr.map(x => ({ ...x }))]),
      sent: this.sent, fetched: this.fetched, expired: this.expired,
    };
  }
  _restore(s) {
    this.boxes = new Map(s.boxes.map(([r, arr]) => [r, new Map(arr.map(x => [x.id, { ...x }]))]));
    this.read = new Map(s.read.map(([r, arr]) => [r, arr.map(x => ({ ...x }))]));
    this.sent = s.sent; this.fetched = s.fetched; this.expired = s.expired;
  }
  // op 저널 추가(step-0145) — 우편함을 바꾼 op(send/fetch)만 durable 저널에 append. persist OFF 면 no-op(0144 동일).
  //   step-0146: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  }
  _box(rcpt) { if (!this.boxes.has(rcpt)) this.boxes.set(rcpt, new Map()); return this.boxes.get(rcpt); }
  // 아이템 custody 이동 헬퍼(step-0161) — 우편↔가방 2-서비스 쌍 거래의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(fromAvatar→toAvatar). 가방이 권위·우편은 요청만(은닉). 미충족이면 no-op(추상 escrow·0160 동일·reg 0).
  //   거래소 _custody(0117)의 우편 판. send=발신자→escrow(leg1 0161)·fetch=escrow→수신자(leg2 0162)·expire=escrow→발신자(leg3 0163).
  _custody(itemId, from, to, cause) {
    if (!this.invMode || !this.inv || itemId == null || !this.net) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to };
    // saga 피드백(step-0166·mailSaga) — ON 이면 replyTo(우편 주소)+cause(어느 레그·mailId) 를 실어 가방이 item_result 를 우편으로도 회신.
    //   OFF 면 msg 가 0165 와 정확히 같다(replyTo/cause 키 없음) → 가방의 echo(_sagaReply) 휴면 = 비트 동일(reg 0).
    if (this.saga) {
      const gid = this.gid++;           // 미해결 추적 id(step-0167) — 회신 매칭 키
      msg.replyTo = this.addr; msg.cause = cause; msg.gid = gid;
      this.pending.add(gid);
      this.pendingGive.set(gid, { itemId, from, to, cause });   // 재전송 소스(step-0168 대비)
      if (this.pending.size > this.pendingPeak) this.pendingPeak = this.pending.size;
    }
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
    if (to === 'escrow') this.escrowIds.add(itemId);        // 발신 인출(leg1) — escrow 진입(step-0164·2-서비스 보존 추적)
    else if (from === 'escrow') this.escrowIds.delete(itemId);   // 수령 입금(leg2)·만료 반환(leg3) — escrow 이탈
  }
  // 미해결 give 재전송(step-0168·mailRetry) — pendingGive 에 남은(회신 손실) give 를 *같은 gid* 로 재발신(재실행 아닌 *재회신* 유도·가방 sagaDedup 전제).
  //   재전송이라 gives/escrowIds 무증가(이미 추적 중)·retries++. pendingGive 비었으면(saga OFF·전부 acked) no-op = 0167 비트 동일.
  _resendPending() {
    if (!this.invMode || !this.inv || !this.net) return;
    for (const [gid, g] of this.pendingGive) {
      this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId: g.itemId, fromAvatar: g.from, toAvatar: g.to, replyTo: this.addr, cause: g.cause, gid });
      this.retries++;
    }
  }
  // crash(step-0145) — 박스 RAM 소실의 인프로세스 모델: projection(우편함·읽음·회계)만 비운다. *op 저널은 durable* 이라 보존(거래소 0109 의 우편 판).
  crash() {
    this.boxes = new Map(); this.read = new Map();
    this.sent = 0; this.fetched = 0; this.expired = 0; this.sentPublished = 0; this.readPublished = 0; this.expirePublished = 0; this._seq = 0; this._lastFetch = null;
    this.itemSent = 0; this.itemFetched = 0; this.itemExpired = 0;   // step-0157~0159: 아이템 회계도 RAM 소실(저널 replay 로 복원)
    this.gives = 0;   // step-0161: give 계측도 소실. reconstruct 는 custody 를 *재발행하지 않는다*(다른 서비스 부수효과·저널 replay 는 projection 만 — 거래소 0109 동형)
    this.ackedGives = 0; this.giveOks = 0; this.giveFails = 0;   // step-0166: saga 회신 계측 소실(저널 밖·외부 회신 의존·reconstruct 가 재발행 안 함)
    this.gid = 0; this.pending = new Set(); this.pendingGive = new Map(); this.pendingPeak = 0;   // step-0167: 미해결 추적도 소실(외부 회신 의존)
    this.retries = 0;   // step-0168: 재전송 계측 소실
    this.escrowIds = new Set();   // step-0164: escrow 추적도 소실 → reconstruct 가 저널 replay 로 재계산(custody 재발행 없이 집합만).
  }
  // reconstruct(step-0145·failover) — fresh 박스가 durable op 저널을 seq 순 replay 해 projection 을 재계산(onMsg 와 같은 매핑·발신/발행 없이) → 죽기 전과 비트 동일.
  //   send → 우편함 적재 + sent++(멱등). fetch → 그 시점 보유분 전부 box→read 이동(수령 회계 재현). 발행(sentPublish)은 replay 에서 *안 한다*(파생 스트림·이중 발행 방지).
  //   step-0146: 스냅샷이 있으면 그 projection 에서 출발해 tail(seq>upToSeq)만 replay(스냅샷 압축 — 전체 replay 와 비트 동일).
  reconstruct() {
    if (this.snapshot) this._restore(this.snapshot.state);
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'send') {
        const box = this._box(e.to);
        if (box.has(e.id)) continue;
        const item = e.item != null ? e.item : null;   // step-0157: 아이템 동봉 replay
        box.set(e.id, { id: e.id, from: e.from, to: e.to, body: e.body, sentAt: e.sentAt, item });
        this.sent++;
        if (item != null) this.itemSent++;
        if (this.invMode && item != null) this.escrowIds.add(item);   // step-0164: 발신 replay 시 escrow 진입 재계산(custody 재발행 없이 집합만)
      } else if (e.kind === 'fetch') {
        const box = this.boxes.get(e.to);
        const out = box ? [...box.values()] : [];
        if (out.length) {
          const log = this.read.get(e.to) || [];
          for (const mm of out) log.push(mm);
          this.read.set(e.to, log);
          this.fetched += out.length;
          for (const mm of out) if (mm.item != null) this.itemFetched++;   // step-0158: 아이템 수령 이동 replay
          if (this.invMode) for (const mm of out) if (mm.item != null) this.escrowIds.delete(mm.item);   // step-0164: 수령 replay 시 escrow 이탈 재계산
          box.clear();
        }
      } else if (e.kind === 'expire') {   // 만료(step-0148) — 회수된 우편 1통 제거 + expired++(저널 정합).
        const box = this.boxes.get(e.to);
        if (box && box.has(e.id)) { const mm = box.get(e.id); box.delete(e.id); this.expired++; if (mm.item != null) { this.itemExpired++; if (this.invMode) this.escrowIds.delete(mm.item); } }   // step-0159: 아이템 만료 회수 replay (step-0164: escrow 이탈 재계산)
      }
    }
  }
  held(rcpt) { const b = this.boxes.get(rcpt); return b ? b.size : 0; }   // 한 수신자 우편함 보유 통수
  totalHeld() { let n = 0; for (const b of this.boxes.values()) n += b.size; return n; }   // 전 우편함 보유 합
  itemHeld() { let n = 0; for (const b of this.boxes.values()) for (const mm of b.values()) if (mm.item != null) n++; return n; }   // 보유 중 아이템 실은 통수(step-0157)
  fetchedOf(rcpt) { const l = this.read.get(rcpt); return l ? l.length : 0; }   // 한 수신자 수령 통수(step-0143)
  boxOf(rcpt) { const b = this.boxes.get(rcpt); return b ? [...b.values()] : []; }   // 우편함 통째(읽기·결정론 순서)
  readOf(rcpt) { const l = this.read.get(rcpt); return l ? l.slice() : []; }   // 수령(읽음) 보관 통째(step-0143)
  // 회계 정합(step-0143 — sent==held+fetched; 0148 에 +expired). 우편 1통은 매 순간 정확히 한 상태(보유·수령·만료)에 있다(공백·중복 0).
  accountConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // 우편 회계 정합 capstone(step-0150·단언용 읽기 accessor) — 0142~0149 arc 의 창발 불변: 우편 1통은 매 순간 정확히 한 상태(보유 held·수령 fetched·만료 expired)에 분할(공백·중복 0).
  //   sent == totalHeld + fetched + expired 가 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립. accountConsistent 와 동치이나 capstone 의 명시 이름(거래소 0140 sagaLiveConsistent 의 우편 판).
  mailConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // 아이템 회계 정합 capstone(step-0160·단언용 읽기 accessor) — 0157~0159 의 창발 불변: 아이템 1개는 매 순간 정확히 한 상태(보유 itemHeld·수령 itemFetched·만료 itemExpired)에 분할(공백·중복 0).
  //   itemSent == itemHeld + itemFetched + itemExpired 가 *모든 체제*서 성립. 0150 mailConsistent(메시지 통수 판)의 아이템 판·아이템 우편 arc(0157~0160) 닫기.
  itemConsistent() { return this.itemSent === this.itemHeld() + this.itemFetched + this.itemExpired; }
  // 우편↔가방 2-서비스 보존 capstone(step-0164·단언용 읽기 accessor) — escrow custody 중인 itemId 집합·우편 내부 정합.
  //   escrowItemIds(): 우편이 escrow 에 묶었다고 믿는 itemId 정렬 집합(가방의 'escrow' 소유 집합과 교차 정합 — 두 서비스 일치). escrowConsistent(): 보유 아이템 우편 통수(itemHeld) == escrow 아이템 수(escrowIds.size) — 우편 1통=아이템 1개=escrow 1건. 거래소 0120 escrowItemIds(open==escrow) 의 우편 판.
  escrowItemIds() { return [...this.escrowIds].sort(); }
  escrowConsistent() { return this.itemHeld() === this.escrowIds.size; }
  pendingGives() { return this.pending.size; }   // 미해결(회신 미수신) give 통수(step-0167) — 정상 0·회신 손실 시 잔존. 0166 gives==ackedGives 의 격차 = 이 값.
  // saga 회계 정합 capstone(step-0169·단언용 읽기 accessor) — 0166~0168 saga 회계의 창발 불변. 두 항등식 AND:
  //   ① gives == ackedGives + pendingGives(보낸 give 는 정확히 acked 또는 pending·새는 give 0) ② ackedGives == giveOks + giveFails(회신은 ok/fail 분류·누락 0). 정상·손실·재전송 모든 체제서 성립. 거래소 0128 의 우편 판.
  sagaConsistent() { return this.gives === this.ackedGives + this.pending.size && this.ackedGives === this.giveOks + this.giveFails; }
  // 아이템 우편↔가방 전체 닫힘 capstone(step-0170·단언용 읽기 accessor) — 우편 박스 *내부* 네 회계층의 동시 닫힘:
  //   mailConsistent(메시지 통수 0150) AND itemConsistent(아이템 0160) AND escrowConsistent(escrow 집합 0164) AND sagaConsistent(saga 회계 0169). 거래소 0140 sagaLiveConsistent 의 우편 판. + verify 가 giveOks==가방 escrowXfers(두 서비스 합치).
  sagaLiveConsistent() { return this.mailConsistent() && this.itemConsistent() && this.escrowConsistent() && this.sagaConsistent(); }
  // digest — 우편 *전체 상태* 해시(결정론·failover 비트 동일 검증용). 0145: 우편함(보유)+읽음(수령)+회계 카운터 포함(crash→reconstruct 가 죽기 전과 동일한지 단언).
  digest() {
    const rows = [];
    for (const rcpt of [...this.boxes.keys()].sort())
      for (const id of [...this.boxes.get(rcpt).keys()].sort()) {
        const mm = this.boxes.get(rcpt).get(id);
        rows.push(`H/${rcpt}/${id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}${mm.item != null ? ':i' + mm.item : ''}`);   // step-0157: 아이템 첨부 시만 추가(미첨부=0156 비트 동일)
      }
    for (const rcpt of [...this.read.keys()].sort())
      for (const mm of this.read.get(rcpt))
        rows.push(`R/${rcpt}/${mm.id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}${mm.item != null ? ':i' + mm.item : ''}`);   // step-0158: 수령 아이템 첨부 시만 추가
    rows.push(`C:sent=${this.sent},fetched=${this.fetched},expired=${this.expired}`);
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail_core = __part;
