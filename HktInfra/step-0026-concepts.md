# step-0026 개념 — id-reconciliation: 클라 belief 기반 서버 재수렴

## 핵심 통찰: "라이브 ack ≠ 내구성"

서버가 클라에게 `item_result(pickup, ok, itemId)` 를 보낸 순간, 클라 belief 는 업데이트된다. 하지만 그 직전에 서버가 crash 한다면?

- 서버 입장: mint 저널이 PersistStore 에 도달하지 못했다 → replay 후 원장에 itemId 없음
- 클라 입장: ack 를 받았으므로 items 에 itemId 가 있다

이것이 `at-most-once delivery` 와 `at-least-once` 사이의 간극이다. write-behind 패턴은 "쓰기가 confirm 됐다"고 말하지만 내구성은 journal→persist 의 완전성에 달려 있다.

## id-reconciliation 패턴

**문제**: 서버 상태(원장) ≠ 클라 belief(items). 서버가 truth 이지만, 이 경우 서버가 *틀렸다*(crash 로 소실). 클라 belief 가 더 완전한 정보를 담고 있다.

**해법**: 클라가 자신의 belief 를 서버에 선언 → 서버가 재구성.

```
Client → Server: "내가 보유한 아이템은 [A, B, C] 입니다"
Server → Client: "B 는 알고 있음(durable). A, C 는 모름 → 재발급: A'→newA, C'→newC"
Client: belief 갱신 (A→newA, C→newC, B 불변)
```

멱등성: 같은 요청을 두 번 보내도 durable 아이템은 skip → 이중 발급 0.

## mintTotal 보정의 두 층위

재발급 시 새 ID 가 기존 아이템과 충돌하지 않아야 한다.

**층위 1 — xfer replay 충돌 방지** (replay 함수):
XMINTLOSS 로 mint 항목이 모두 손실되면 `maxMintId = -1 → mintTotal = 0`. 하지만 xfer 항목으로 복원된 아이템(item0 등)이 이미 있다. 따라서 xfer 항목의 itemId 번호도 `maxMintId` 에 반영해야 한다.

**층위 2 — owned 범위 충돌 방지** (item_reconcile 핸들러):
클라 owned 에 있는 ID 번호가 mintTotal 보다 크면, re-mint 가 그 ID 와 충돌한다. 예: owned=[item1, item3], mintTotal=1 이면 item1 → 'item1', item3 → check ledger(item1이 방금 set됨!) → skip → 아이템 손실.

해법: `item_reconcile` 시작 시 `mintTotal = max(mintTotal, max(owned IDs) + 1)`.

## 이 패턴이 일반화되는 곳

id-reconciliation 은 "서버가 클라보다 뒤처진 경우" 에 일반적으로 적용 가능하다:

- **캐릭터 스탯**: 서버 DB 소실 + 클라가 최종 값 캐시 → 클라 값으로 재설정
- **세션 토큰**: 세션 서비스 crash + 클라 토큰 유효 → 클라 토큰으로 재검증
- **청크 소유권**: 청크 서버 crash + 클라가 편집 중인 청크 목록 → 재배정

공통 구조: 클라가 *확인된 사실*(서버가 ack 한 것)을 선언 → 서버가 그것을 truth 로 재구성.

## write-behind 신뢰성의 완성

```
PersistStore (내구 저널)
      ↑
      │ journal 홉
      │
InventoryService (원장 권위)
      │
      │ item_result (at-least-once ack)
      ↓
Client (belief)
```

이 체인의 각 홉에서 손실이 발생할 수 있다:
- journal 홉 중간 손실 → 0023 NAK 재전송
- journal 홉 tail 손실 → 0024 heartbeat → NAK
- xfer in-flight 손실 → 0025 give-resend
- mint in-flight 손실 → 0026 id-reconciliation ← 여기

모든 손실 경로가 닫혔다. 클라 belief 는 항상 서버 진실로 수렴한다.
