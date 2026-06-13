# step-0033 concepts — Dynamic pub/sub subscription (runtime sub/unsub)

> 정식 기록: [step-0033.md](step-0033.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 동적 구독(dynamic subscription) | 발행/구독 라우팅 테이블을 *런타임에* 바꾸는 능력(정적 선언이 아니라) | `ServiceBus.onMsg` 의 `sub`/`unsub` 분기 — 라우팅 Map 을 양방향 변경 |
| 구독 해지(unsub) | 라우팅 테이블에서 (topic, subscriber) 행을 제거 — `sub` 의 대칭 | `_unsub` = 배열에서 그 addr 만 `splice` |
| 구독 재협상(re-subscription) | failover 시 소비자가 *옛 라우트 해지·새 라우트 등록*으로 구독을 옮김 | 버스 failover 의 선결 — 이 step 이 그 메커니즘만 깐다 |
| 라우팅 테이블 SSOT | 누가 어느 토픽을 받는가의 유일 진실 = `Map<topic,[sub...]>` | 별도 상태 0 — 동적 변경도 이 Map 한 곳만 |
| 소비자 격리(per-subscriber routing) | 한 소비자의 구독 변경이 *다른 구독자·발행자*에 무영향 | ranking(공동 구독자)·bus.publishes 비트 동일로 증명 |
| at-most-once gap | 구독하지 않은 동안의 이벤트는 못 받음(영속/이력 없으면 손실) | A_resub < A0 — gap 손실이 *설계상* 정상 |

## 1. 왜 동적 구독인가 — failover 의 선결

상용 분산 이벤트 버스(NATS·Redpanda·Kafka)는 브로커가 죽으면 소비자가 *다른 브로커에 재구독*한다. 즉 "누가 무엇을 받는가"는 시작 시점에 고정된 정적 배선이 아니라, 런타임에 계속 바뀌는 *살아있는 테이블*이다. HktInfra 의 `ServiceBus`(0016)는 지금까지 이 테이블을 토폴로지 빌더의 *선언 spec*(opts.subs)으로 한 번 채우고 끝이었다 — `unsub` 도 없고 런타임 `sub` 도 행사되지 않았다.

버스 failover(STATE §2 ⒝)를 지으려면 *먼저* 라우팅 테이블을 런타임에 바꿀 수 있어야 한다. 그래서 이 step 은 기능의 *본체*(영속·backup 버스)가 아니라 그 **토대**(동적 sub/unsub)만 깐다 — "한 step = 한 조각" 원칙. 큰 그림에서 이것은 이벤트 버스 계층(SPINE §1·§2)을 *정적 배선*에서 *재협상 가능한 substrate* 로 한 칸 옮기는 일이다.

## 2. unsub = sub 의 대칭 — 라우팅 Map 하나만 만진다

`sub` 은 `push`(배열에 addr 추가), `unsub` 은 `splice`(배열에서 그 addr 제거)다. 핵심은 **그 addr 만** 빼는 것 — 토픽의 나머지 구독자 등록 순서가 보존되어야 *공동 구독자의 팬아웃이 비트 동일*하게 유지된다(팬아웃 순서 = 배열 순서 = 결정론). 라우팅 테이블 `Map<topic,[sub...]>` 이 유일한 SSOT 라서, 동적 변경도 별도 상태 없이 이 Map 한 곳만 바꾼다 — 영속·복구가 필요해지면 *이 Map 의 저널/스냅샷*만 다루면 된다(후속 ⒝).

## 3. 무엇을 어떻게 검증했나 — 소비자 격리 + gap 손실

검증은 한 토픽(`svc.item.out`, audit·ranking 공동 구독)을 audit 가 런타임에 unsub(@15)→re-sub(@18) 하고 세 런을 비교한다:

- **A0(전구독)=60, A_unsub=30, A_resub=42**: unsub 후 audit 수신이 멈추고(30<60), re-sub 후 재개되나(42>30) gap 은 못 메운다(42<60). 이 세 부등식이 *양방향 동적 라우팅이 실제로 작동*함을 수치로 못 박는다.
- **ranking(공동 구독자) R0=R1=R2**: audit 의 토글이 *같은 토픽을 받는 다른 소비자*에 무영향 = **소비자 격리**. 라우팅 행이 분리되어 있다는 증거.
- **발행자 무수정 bus.publishes 동일·audit 의 다른 토픽(svc.item) 동일**: 발행자는 소비자 토글을 모르고(은닉), 토글은 *그 (소비자,토픽) 행* 만 바꾼다.

**정직한 한계 — gap 손실은 버그가 아니라 의미다**: 구독하지 않은 동안의 이벤트는 받지 못한다(at-most-once). re-sub 가 과거를 replay 하지 않으므로 A_resub < A0 이 남는다. 분산 버스 failover 가 *무손실*이려면 버스 영속+이력 replay 또는 소비자측 저널 reconstruct(0020/0025 패턴)가 더 필요하다 — 이 step 은 *재협상 메커니즘*까지만, 무손실은 후속 본체의 몫이다.

## 한 줄 요약

이벤트 버스의 라우팅 테이블을 런타임에 *양방향으로*(unsub/sub) 바꾸는 능력을 더했다 — 토글은 그 (소비자,토픽) 행만 바꾸고 공동 구독자·발행자는 비트 동일이며, 구독하지 않은 동안의 gap 손실은 at-most-once 의 정직한 의미다. 이것이 버스 failover(구독 재협상)의 선결 토대다.
