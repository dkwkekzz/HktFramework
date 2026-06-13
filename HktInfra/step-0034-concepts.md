# step-0034 concepts — Bus failover via subscription re-negotiation

> 정식 기록: [step-0034.md](step-0034.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 파생 상태(derived state) | 다른 곳의 진실에서 *재구성 가능*한 상태 — 그 자체가 진실 원천이 아님 | 버스 라우팅 테이블 = 소비자 구독의 파생 |
| 구독 재협상(re-negotiation) | failover 시 소비자가 새 버스에 구독을 *다시 선언*해 라우팅을 재구성 | `busRestart.renegAt` → 정적 subs 재발신 |
| 진실 원천(source of truth) | 어떤 상태의 권위 보유자 — 복구는 여기서 흘러나온다 | 구독의 진실 원천 = *소비자*(버스 아님) |
| at-most-once gap | 구독/연결이 끊긴 동안의 메시지는 한 번도 안 옴(영속 없으면 손실) | crash~재협상 사이 발행분 = 손실 |
| 손상 vs 손실(corruption vs loss) | 손상=상태가 *틀림*(dupe·conservation 깨짐), 손실=상태가 *덜 반영*(유효하나 누락) | 버스 failover = 손실(원장 valid)·손상 아님 |

## 1. 핵심 통찰 — 버스는 들 게 없어서 복구가 쉽다

0017~0032 의 데이터 계층 failover 는 모두 *진실 원천이 죽는* 문제였다 — 가방 원장·persist 저널이 죽으면 그 안의 데이터를 어디선가 되살려야 했다(저널 replay·N-replica union·quorum). 버스는 다르다: **버스가 드는 라우팅 테이블은 *파생 상태*다.** "누가 무엇을 구독하나"의 진실 원천은 *소비자 자신*이지 버스가 아니다. 그래서 버스가 죽어도 잃을 *진실*이 없다 — 소비자들이 자기 구독을 *다시 선언*(재협상)하면 라우팅은 즉시 재구성된다. 버스 내부 영속(저널/스냅샷)도, 이력 replay 도 필요 없다.

이것이 이 step 의 한 줄: **버스 failover = 소비자 재구독.** 0033 이 깐 동적 sub(런타임 구독)가 바로 그 재협상의 메커니즘이다 — 0033 은 "할 수 있다"를, 0034 는 "failover 에 쓴다"를 보인다.

## 2. 무엇을 어떻게 검증했나 — 3런 대조

`bus.crash(@12)`(라우팅 RAM 소실) 후 세 런을 비교한다:

- **기준선(crash 0)**: audit 가 svc.item.out 60개 수신(A0=60), ranking 60 소비.
- **crash만(대조군·재협상 없음)**: crash 후 routing 이 빈 채로 — 이후 pub 전부 unrouted. audit 6·ranking 6 에서 멈춤, 구독자 수 0 = **서비스 경로 영구 단절**(비영속 버스의 단일점 대가).
- **crash+재협상(@14)**: 소비자들이 재구독 → 라우팅 재구성(구독자 수 3 == 기준선) → 팬아웃 재개. audit 6→30·ranking 6→27. **복구.** 단 crash~재협상 gap 의 발행분은 못 메운다(30 < 60 = at-most-once).

세 런의 분리(6 < 30 < 60·구독자 0 vs 3)가 "crash 가 끊고, 재협상이 라우팅을 되살린다"를 수치로 못 박는다.

## 3. 정직한 한계 — 손상이 아니라 손실, 그리고 두 종류

검증에서 `itemDesync=6` 이 남는다. 왜? 버스는 결과 스트림(svc.item.out → 읽기 모델)뿐 아니라 *요청* 스트림(svc.item → inventory)도 나른다(0016 토폴로지). crash gap 에 떨궈진 in-flight 요청은 inventory 에 안 닿아 그 item op 이 원장에 반영되지 않는다 → 클라 belief 와 6 격차.

핵심 구분: 이것은 **손상이 아니라 손실**이다. 원장은 여전히 *valid* 하다 — 보존(conserved)·정합(consistent)·dupe 0. 단지 떨군 op 만큼 *덜* 반영됐을 뿐이다. 재협상은 라우팅을 복구할 뿐, 떨군 메시지를 메우지 않는다(악화도 안 시킴 — dR ≤ dC). desync 0 인 *무손실* 버스 failover 는 요청 경로 재발신(0023 홉 NAK·0025 give-resend 의 버스 판)이나 버스 라우팅·in-flight 영속이 추가로 필요 — 이 step 은 *재협상으로 라우팅을 복구하는* 토대까지만이다.

## 한 줄 요약

버스가 드는 라우팅 테이블은 *파생 상태*(진실 원천 = 소비자)라, 버스 failover 는 버스 내부 영속 없이 소비자 *재구독*만으로 routing 을 재구성한다 — 0033 동적 sub 의 failover 용례. 복구는 라우팅을 되살리되 crash gap 의 in-flight 메시지는 at-most-once 손실(원장은 손상 아닌 손실·valid 유지)이며, 요청 경로 무손실은 후속이다.
