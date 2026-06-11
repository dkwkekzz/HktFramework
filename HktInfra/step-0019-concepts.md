# step-0019 concepts — Emitting Consumer & Event-Driven Read Models (CQRS)

> 정식 기록: [step-0019.md](step-0019.md) · 현재 위치: [STATE.md](STATE.md)

이 문서는 step-0019 가 다루는 *핵심 개념*을 풀어 설명한다(정식 기록·수치는 [step-0019.md](step-0019.md)).

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 발신하는 소비자 | 이벤트를 *소비*하고 다시 *발행*하는 서비스 | RankingService — svc.item.out 소비 → svc.rank.out 발행 |
| consume→publish 루프 | 한 토픽을 먹고 다른 토픽을 내는 반응 사슬 | 0016 audit(관찰 전용)이 못 보인 패턴 |
| 읽기 모델(read model) | 쓰기 권위에서 *파생한* 조회 전용 뷰 | rank = 원장 byOwner 의 투영(권위 아님) |
| CQRS | 쓰기(command)와 읽기(query)를 다른 모델로 분리 | 가방=쓰기 모델, ranking=읽기 모델 |
| 프로젝션 정합 | 읽기 모델이 쓰기 모델과 정확히 일치 | rank == byOwner(읽기 ≡ 쓰기) |
| 발행자 무수정(decouple) | 소비자 추가가 발행자 코드를 안 바꿈 | inventory senderDigest on/off 불변 |
| 루프 없음(발행 유계) | 소비→발행이 무한 사이클을 안 만듦 | svc.rank.out 을 item 서비스가 안 먹음 |

## 1. 발신하는 소비자 — 0016 이 못 본 절반

0016 의 이벤트 버스는 *발행/구독*을 세웠고, AuditService 로 "발행자 무수정으로 새 소비자 추가"를 증명했다. 그러나 audit 은 **관찰 전용**(발신 0)이었다 — 이벤트를 먹기만 했다. MMO 의 많은 서비스는 그렇지 않다: 랭킹은 아이템 획득 이벤트를 *먹고* 순위 변동 이벤트를 *낸다*. 거래소는 거래 이벤트를 먹고 시세 이벤트를 낸다. 업적은 게임 이벤트를 먹고 보상 이벤트를 낸다. 전부 **consume→publish** — 소비하고 다시 발행하는 서비스다.

이 패턴이 미검증이면 버스가 "이벤트 백본"으로 충분한지 알 수 없다. consume→publish 는 ⒜ 순서(소비 순서대로 발행하는가) ⒝ 루프(발행이 다시 자기 입력을 낳지 않는가) ⒞ 결합(발행자가 새 소비자를 모르는가)이라는 새 질문을 연다. step-0019 는 RankingService 로 이 셋을 수치로 닫는다.

## 2. 읽기 모델 — 권위를 *복제*하지 않고 *재계산*한다

RankingService 의 `ranks`(아바타→보유 아이템 수)는 가방 원장(`itemId→owner`)의 **파생 뷰**다. 핵심은 ranking 이 원장에 *쓰지 않는다*는 것 — pickup/give 이벤트(svc.item.out)를 보며 카운터를 다시 셈할 뿐이다. 그래서:

- **권위 충돌이 없다.** 원장의 쓰기 권위는 여전히 가방 *하나*. ranking 은 권위를 *복제*(이중 쓰기 위험)하지 않고 같은 이벤트 스트림에서 *재계산*한다. "권위 단일 소유" 불변이 *구조적으로* 성립 — 읽기 모델은 정의상 권위가 없다.
- **프로젝션 정합.** ranking 이 *모든* item_result 를 *순서대로* 보므로, rank 는 원장 byOwner 크기와 *정확히 일치*한다(읽기 모델 ≡ 쓰기 모델). 검증의 `rankProjectionFaithful` 이 이를 모든 아바타에 대해 비교(누락·과잉 0).

이것이 **CQRS**(Command Query Responsibility Segregation)다 — 쓰기 모델(가방: 트랜잭션·단일 소유)과 읽기 모델(랭킹: 조회 최적·이벤트에서 파생)을 분리한다. 읽기 모델은 쓰기 모델을 *따라가는 투영*이지 또 하나의 진실이 아니다.

## 3. 발행자 무수정(decouple) — 둘째 소비자가 첫째를 안 건드린다

svc.item.out 은 원래 gateway 만 구독했다(클라 중계용). ranking 은 *같은 토픽에 구독 행을 추가*만으로 둘째 소비자가 된다 — 버스가 그 토픽을 gateway 와 ranking *둘 다*에게 팬아웃한다. 발행자(inventory)는 누가 자기 결과를 먹는지 *모른다*(토픽만 안다). 검증의 `senderDigest(inventory)` 가 ranking on/off 에 *비트 동일* → 발행자 발신 스트림이 새 소비자에 무영향 = decouple. 0016 의 audit decouple 이 *관찰 소비자*에 대한 증명이었다면, 이건 *발신 소비자*에 대한 같은 증명이다.

## 4. 루프 없음 — consume→publish 가 사이클을 안 만든다

발신하는 소비자의 새 위험: ranking 이 svc.rank.out 을 내는데, 만약 어떤 item 서비스가 svc.rank.out 을 먹고 다시 svc.item.* 를 낸다면 무한 루프가 된다. 이 step 의 토폴로지는 svc.rank.out 을 *gateway(클라 중계)와 audit(관찰)만* 구독하게 해 — 둘 다 item 이벤트를 *안 낸다* — 사이클을 끊는다. 검증의 `bounded`(발행 ≤ 소비×2)가 발산을 잡는다.

미묘점: **발행이 소비보다 많은 게 정상**이다. give 한 건은 from −1·to +1 — *두* 아바타의 rank 를 바꾸므로 발행 2건을 낸다. 그래서 발행(69) > 소비(60)지만 이는 루프가 아니라 *한 이벤트의 다중 효과*다. `bounded` 를 ×2 로 둬 진짜 사이클과 구별한다.

## 5. 왜 비-침습·E2E 비트 동일인가

ranking 은 onTick 0(버스 이벤트에만 반응)이라 존 tick 밖 — world 상태가 ranking on/off 에 비트 동일(신성한 tick). consume/publish 는 전부 버스 경유(주소 무지·은닉)라 클라엔 rank_update{count}만 닿고 내부 누설 0(hide). ranking 은 결정론 액터(같은 이벤트 순서 → 같은 rank)라 멀티프로세스=인프로세스 비트 동일(E2E·repro). 별 OS 프로세스로 떠도(restart-bus 13 프로세스) rankDigest 가 인프로세스와 일치.

## 한 줄 요약

이벤트를 *소비해 다시 발행*하는 서비스(RankingService)를 세워 버스의 consume→publish 루프를 검증했다 — rank 는 원장에 *쓰지 않고 재계산*하는 **읽기 모델**(CQRS)이라 byOwner 와 정확히 일치하고(읽기 ≡ 쓰기), 발행자(inventory) 무수정으로 얹히며(decouple), svc.rank.out 을 item 서비스가 안 먹어 루프가 없다(발행 유계).
