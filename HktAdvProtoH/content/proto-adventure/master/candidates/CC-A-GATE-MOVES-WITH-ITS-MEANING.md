# CC-A-GATE-MOVES-WITH-ITS-MEANING

접수: Feedback — C017-target-gathers-the-actions 의 MASTER FEEDBACK 이 보고한 관찰이다.
Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    관문이 다른 자리로 옮겨갈 때 그 사유를 잃지 않는다. 판정이 옮겨가면 사유도 함께 간다.

## 무엇을 말하는가 (예시)

한 줄로: **관문을 옮길 때 "왜 안 되는지" 를 두고 오지 마라.**

C017 이 살펴봄의 대상을 요청에서 **고른 것**으로 옮겼다. 그때 사유 코드 둘이 함께 갔다.

```text
C014 까지   살펴봄이 거절한다   target-is-self · no-such-target
C017 부터   고르기가 거절한다   target-is-self · no-such-target   (뜻은 한 글자도 안 바뀌었다)
```

### ❌ 흔한 구현 — 관문만 옮기고 사유는 버린다

```text
"이제 고르기가 앞에서 막으니까 살펴봄 쪽 사유는 지운다"
→ 고르기는 그냥 실패하고, 화면에는 아무 말도 안 뜬다
→ 플레이어: "왜 안 골라지지?"
```

판정이 앞으로 옮겨간 것은 **구현의 정리**인데, 사유를 두고 오면 그것이 **플레이의 후퇴**가
된다. 세계는 여전히 답을 알고 있다 — 자기 자신이라서다. 말하지 않기로 한 것뿐이다.

### 무엇이 달라지나

C017 은 사유를 함께 옮겨서, 대상을 고르려다 실패한 플레이어가 그 자리에서 이유를 읽는다.
C014 가 세운 태도("왜 자기는 못 하는지도 세계가 말한다")가 새 관문에서 그대로 산다.

### 경계 — 이건 이 원칙이 아니다

**사유의 신설**이 아니다. 새 관문에 새 사유가 필요하면 그것은 그 Cycle 의 설계이지 이
원칙의 요구가 아니다. 이 원칙이 말하는 것은 **이미 있던 사유가 관문의 이사에서 사라지지
않는다** 하나뿐이다.

## OBSERVED REPEATING PATTERN

    1회 — C017 (살펴봄 → 고르기로 사유 코드 둘이 이동)
    전조: C014 가 "왜 자기는 못 하는지도 세계가 말한다" 를 세운 것.
    **사례가 하나뿐이다** — 승격 조건(반복)을 아직 만족하지 않는다.

## AFFECTED NODES

    MC-DESIGNATE-TARGET · MC-OBSERVE · 앞으로 관문이 옮겨갈 모든 자리

## EXPECTED SCOPE

    GLOBAL

## REQUIRES

    판정이 다른 규칙으로 옮겨가면 그 판정이 내던 사유도 함께 옮긴다

## PROHIBITS

    관문을 옮기면서 사유를 없애 실패가 말없이 돌아오게 하는 것

## PREFERS

    옮긴 사유의 코드 이름을 유지하는 것 (문구 표가 따라갈 필요가 없다)

## POTENTIAL CONFLICTS

    없음. `DC-WORLD-OWNS-THE-SURFACE-LIST` 의 시간 축 판이다 —
    그쪽이 "목록은 세계가 소유한다" 라면 이쪽은 "그 목록이 이사할 때 잃지 않는다" 다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    아직 이르다. 사례가 하나뿐이고, SURFACE-LIST 로 이미 설명되는 부분이 크다.
    두 번째 이사(예: 휘두름이 고른 것을 읽게 되는 Cycle)가 오면 그때 판단한다.

## HUMAN DECISION

    PENDING
    Reason
