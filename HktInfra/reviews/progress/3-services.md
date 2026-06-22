# ③ 게임 서비스 — tick 과 무관한 책임

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 아이템 거래·채팅 팬아웃·랭킹 집계처럼 *존 tick 과 같은 박자로 돌 필요 없는* 책임을 전부 비동기 서비스로 떼어낸다. 판정 기준: "그 일이 시뮬 tick 박자여야 하나?" 아니면 이 줄로.

---

## 가방(인벤토리) ✅ 자라는 중

- **푸는 병목**: 아이템 이동·거래가 존 tick 을 막으면 안 되고 *존 넘는 거래*가 직접 엮이지 않고 성립해야·복제(dupe) 0.
- **지금 어디**: 단일 소유 원장 → 떨어뜨려도 안 새는 신뢰 전달까지.
  - `step-0014` — 아이템 단일 소유·이동은 쌍 거래(닫힌 장부).
  - `step-0017~0018·0023~0029` — failover·효과 저널·압축 → write-behind 신뢰성(NAK·heartbeat·give·mint) → quorum(이중쓰기·N복제·write ack).
- **남은 것**: give-resend 재정렬 견고성·멀티프로세스 패리티(transfers≠base 잔류·#9).

## 채팅 ✅ 자라는 중

- **푸는 병목**: 대규모 브로드캐스트 대역이 시뮬 대역을 안 잡아먹게 분리(전체/지역/귓속말 팬아웃).
- **지금 어디**: `step-0015` 채널 팬아웃·지역 격리 → `step-0021~0022` 커맨드 로그 영속·압축.
- **남은 것**: per-message ack/resend·홉 신뢰(#7·지금은 best-effort 팬아웃).

## 랭킹 ✅ 자라는 중

- **푸는 병목**: 집계는 발행자(가방 등)를 안 건드리고 *버스 구독*으로 따라붙어야 한다 — 소비자 추가가 발행자 무수정.
- **지금 어디**: 발신 소비자 → 1급 소비자(frontier ack) → self-healing 참여 → 대체 소비자 인계.
  - `step-0019~0020` — 발신 소비자로 붙고 읽기모델 late-join 복구.
  - `step-0044~0045` — 따로 frontier ack → min 까지만 버퍼 가지치기 → 영영 죽으면 lease 축출.
  - `step-0056~0057·0061~0062` — recover 받아 스스로 재구독·recoverAck → standby 가 permanent 에 자기 활성화·저널 reconstruct 로 갭 복원.
- **남은 것**: 다중 랭킹 보드·*런타임 동적 spawn*(지금은 사전 등록 standby 활성화).

## 귓속말/파티 라우터(wrouter) + 수신함(mbox) ✅ 자라는 중 *(전달 신뢰 → 유계·관측·재시작 안전 → 종결·멤버별 수신함)*

- **푸는 병목**: "X 에게"·"파티 전원에게" 가 *어디 있는지·살아 있는지* 모른 채 보내진다 — 프레즌스 SSOT(계층5)를 조회해 라우팅하고 *진짜 닿았는지*까지 보장해야(전송은 떨어뜨리니까). 더해 그 보장이 *메모리를 무한히 먹거나 라우터 재시작에 깨지면* 안 되고 결과(성공·실패·반송)가 *밖에서 안 보이면* 안 되며, 1:N 파티는 *끝났는지*(전원 받음/일부 영구 실패)를 명시 종결해야 한다.
- **지금 어디**: 프레즌스 질의 첫 실사용 → 전달 exactly-once → 유계·관측·재시작 안전 → **파티 세 종결 + 멤버별 수신함 + 수신함 메모리 유계화**.
  - `step-0071~0080` — 라우터(질의→전달/반송·failover 재타깃)·1:N 파티·멤버십 분리 → 전달 신뢰 호(영수증→재시도→상한→통지→dedup exactly-once).
  - `step-0081·0089~0091` — dedup 메모리 *두 축 유계화*: seq=연속 워터마크(O(gap))·epoch=재시작 펜싱(0089 유실 버그 수정→0090 옛 epoch 가지치기→**0091 grace 유예**로 지연 straggler 까지 dedup·N+1 유계·`svc-mailbox.js:44`).
  - `step-0082·0087·0097` — 전달 *세 결말을 버스로 관측*: 포기(svc.whisper.failed)·성공(svc.whisper.delivered{tries})·**반송**(svc.whisper.bounced·즉시 도달 불가·`svc-whisper-handlers.js:57`)을 audit 에 발행(발행자 무수정).
  - `step-0083·0088·0092~0093·0095` — 파티 1:N *세 종결*: done(라우팅 결정)·acked(전원 실수신)·**incomplete**(일부 영구 실패·0092 partyAckGiveup·`svc-whisper-core.js:78`) + 성공/실패 종결 *발행*(svc.party.complete/incomplete→audit·0093/0095).
  - `step-0096` — **멤버별 수신함**(mbox2): 파티원마다 자기 수신함→모든 up 멤버 ack→acked 가 N>1 에서 참값(0088 §9 해소).
  - `step-0099~0104` — 수신함 *메모리·수명주기·관측 완성*: inbox cap(미읽음·lossy)·**drainAck 2단계 읽음**(ack 전 보유 checkout→ackDrain 안전 제거·재드레인 무손실·exactly-once 소비·#26 해소·`svc-mailbox.js:58,69`)·checkout cap(읽음-미확인·lossy)·소비/손실 *발행*(svc.mailbox.drained·overflowed→audit). 수신함 메모리 세 차원(미읽음·읽음-미확인·확정소비) 유계 + 양면(성공·손실) 관측.
  - `step-0105~0106` — 디스커버리 *메아리 펜싱*: wrouter 도 svc.presence.active 공지에 epoch 가드(`svc-whisper-handlers.js:12`)로 낡은 공지 거부→죽은 박스 역-재타깃·재시도 폭주 0(presmon 0105 의 라우터 판·발행자 무수정).
- **남은 것**: 종결 이벤트 단일성(#25)·게이트웨이 경유 read E2E(#9/④)·동적 N 수신함/세션 간접(#27)·멀티프로세스 미배선(#9)·펜싱 로직 중복(#28)·ON-의미 spine 미승격(#16).

## 길드/소셜(파티 멤버십) ✅ 자라는 중

- **푸는 병목**: 파티/길드 멤버십은 *오래 사는 상태* — 한 명 들고 날 때 전체 재전송 말고(증분)·변경을 남이 구독하고(발행)·죽어도 살아남아야(영속).
- **지금 어디**: 인메모리 SSOT 씨앗(0075) → **증분·관측·영속**까지 자란 첫 길드/소셜 박스(`src/svc-party.js`).
  - `step-0075` — 멤버십 전용 박스(2단 조회)·전체 덮어쓰기.
  - `step-0084` — 증분 가입/탈퇴(partyJoin/Leave 멱등)+변경 발행(svc.party.changed→audit·발행 스트림=변경 이력).
  - `step-0085~0086` — 영속·failover(휘발 projection ⟂ durable 변경 저널·crash→replay 재구성·0017/0021 event sourcing 의 멤버십 판) → 스냅샷+tail 압축(무계 저널 유계·0018/0022 판).
- **남은 것**: cluster kill→replay 통합(현 in-process·#9).

## 거래소 ✅ 자라는 중 *(가방/파티 궤적 → 진짜 존 넘는 실물 거래)* + 우편 ⬜ 미착수

- **푸는 병목**: *두 당사자* 사이의 아이템↔대가 교환을 존 tick 밖에서 — 가방(1-당사자 이동)과 같은 불변(단일 소유 + 쌍 거래)으로·이중 판매 0·*존을 넘는 거래*가 존간 결합 없이 성립. 더해 판매자가 *실제로 가진* 아이템이 빠지고 구매자에게 *실제로* 들어가야(추상 escrow→실물).
- **지금 어디**: 분리→발행→영속→압축(한 묶음 레시피) → 수명주기 발행 완비·시세 피드 분리 → **escrow 를 가방 원장에 실체화해 진짜 존 넘는 실물 거래**(`src/svc-exchange.js`).
  - `step-0107~0110` — 서비스 분리(escrow 단일 권위·쌍 거래·보존·이중 판매 0)→체결 발행(svc.exchange.sold)→영속(op 저널 replay)→스냅샷+tail 압축(가방/파티와 같은 궤적·`svc-exchange.js:62,103,116`).
  - `step-0111·0114~0115` — *수명주기 종결 3종 완비*: 취소 발행(svc.exchange.cancelled·0108 의 대칭)·**매물 만료 TTL**(시간 트리거 escrow→판매자 회수·sweep `now−listedAt≥ttl`·새 종결 expired·보존식 4종 `listed==open+sold+cancelled+expired`·저널 'expire' 정합)·만료 발행(svc.exchange.expired). 매물이 영영 묶이지 않는다(`svc-exchange.js:67,123`).
  - `step-0117~0120` — **거래소↔가방 2-서비스 실물 거래**(#30 결합 절반 해소): escrow 를 가방 원장 아바타로 실체화 → 인출(list seller→escrow)·입금(buy escrow→buyer)·반환(cancel/expire escrow→seller) 전부 가방 give(`_custody`·`svc-exchange.js:52`) → 2-서비스 보존 단언(거래소 open `escrowItemIds`≡가방 escrow 소유·minted 불변·각 1소유자·`:127`). 가방이 아이템 권위·거래소는 give 요청자(단일 소유 불침).
- **남은 것**: 2-서비스 *원자성*(give 낙관적·결과 미수신·실패 보상 0·#31)·거래소 저널 *별 PersistStore 박스화*(현 자기 박스 내·#30 b)·멀티프로세스 배선(현 인프로세스·#9)·우편·길드 전용 박스 미착수.

## 시세 피드(MarketFeed) ✅ 자라는 중 *(새 박스·0019 ranking 의 거래소 판)*

- **푸는 병목**: 거래량·체결가·매물 회전은 거래소(발행자)를 안 건드리고 *버스 구독*으로 따라붙어 item별로 집계돼야 — 읽기 모델(CQRS)이고 권위는 거래소.
- **지금 어디**: 발행 스트림 소비 → 저널 replay 복원 → 수명주기 3종 반영(`src/svc-market.js` 새 박스).
  - `step-0112` — 분리: svc.exchange.sold+cancelled 소비→item별 {last 체결가·volume 거래량·cancelled}(원장 권위 0·발신 0·관찰 전용·pull·0019 RankingService 와 같은 CQRS 골격·다른 입력=수명주기 발행).
  - `step-0113` — 영속·late-join: 자기 영속 0 이어도 *거래소 op 저널* replay 로 시세 완전 복원(다운타임 누락 따라잡음·0020 읽기모델의 거래소 판·`svc-market.js` reconstruct).
  - `step-0116` — 만료 반영: svc.exchange.expired 구독 추가→수명주기 3종(체결·취소·만료) 모두 시세에 흐름(`svc-market.js:29`).
- **남은 것**: reconstruct==라이브 가 *전-수명주기-발행 ON* 전제(#32)·매물 깊이(open depth·list 발행 없어 미추적)·자기 스냅샷/증분 영속·멀티프로세스 배선(#9).

---

> **이 계층 다음 걸음**: 거래소↔가방을 *2-서비스 원자성/saga*(give 결과 수신·실패 보상·#31)로 닫아 낙관적 결합을 견고하게. 거래소 저널을 별 PersistStore 박스로(#30 b). 채팅에 홉 신뢰(#7). 라우팅/전달/수신함/거래소↔가방/시세 피드 호를 멀티프로세스로 배선(#9·전 호 인프로세스 전용)·안정 호를 spine 가설 모드 승격(#16·~50 모드). 수신함 동적 N·세션 간접(#27)·게이트웨이 경유 read E2E(#9/④). 우편·길드 전용 박스 씨앗 심기.
