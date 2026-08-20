# CC-THE-CHOICE-IS-THE-OBSERVERS-OWN

접수: Feedback — C017-target-gathers-the-actions 의 MASTER FEEDBACK 이 보고한 관찰이다.
Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    관찰자에게 매달리는 세계의 사실은 세계가 지니되 관찰자별로 갈리고, 담는 것은 Id 뿐이며,
    "없음" 을 따로 저장하지 않고, 대상 쪽에는 아무것도 적지 않는다.

## 무엇을 말하는가 (예시)

한 줄로: **"내가 무엇을 하고 있는가" 는 상대에게 적지 마라.**

이 세계에는 관찰자에게 매달리는 사실이 셋 있고, 셋 다 같은 모양으로 섰다.

```text
C004  어느 몸이 내 몸인가     Observer.ActorId
C014  무엇을 아는가           World.Acquaintances   (ObserverId → 알게 된 Id 들)
C017  누구를 고르고 있는가     World.TargetSelections (ObserverId → 고른 Id)
```

네 성질이 매번 같았다.

```text
1. 세계가 지닌다      Client 가 자기 쪽에 적지 않는다 — 적으면 World Authority 가 깨진다
2. 관찰자별로 갈린다   한 몸을 둘이 번갈아 조종해도 앎과 선택은 갈린다
3. Id 만 담는다       값을 베끼지 않는다 — 베끼면 세계가 바뀌어도 손에는 옛 값이 남는다
4. 대상 쪽은 비어 있다  골라졌다는 사실이 그 존재에 적히지 않는다
```

### ❌ 흔한 구현 — 대상 쪽에 적는다

```ts
// 이렇게 하지 않았다
actor.targetedBy.push(observerId)   // 이 존재를 누가 고르고 있는가
actor.knownBy.push(observerId)      // 이 존재를 누가 아는가
```

읽기는 편하다. 그런데 **그 줄이 생기는 순간 위협도가 된다** — 존재가 "나를 누가 보고
있는지" 를 알게 되고, 그러면 그것으로 판단하지 않을 이유가 없어진다. C017 이 세운
`DC-TARGET-IS-INTENT-NOT-AIM`("지목은 대상을 달라지게 하지 않는다")이 코드 구조로
지켜지는 것이 이 네 번째 성질이다. 대상 쪽이 비어 있으면 **그 규칙을 어길 자리가 없다.**

### 가장 안 읽히는 조각 — 3번(Id 만 담는다)

넷 중 이것이 가장 중요한데 가장 눈에 안 띈다. `world/semantic/target-selection.ts` 는
`{ observerId, targetEntityId }` 두 문자열만 담는다. 이름도 자리도 생명도 담지 않는다.

담았다면: 고른 상대가 걸어가면 화면의 대상 프레임은 **고른 순간의 자리**를 계속 보인다.
그 어긋남은 "왜 이 표시가 안 따라오지" 라는 버그로 나타나고, 고치는 방법은 매 Tick
베낀 값을 갱신하는 것 — 즉 같은 값을 두 곳에 살려 두고 동기화하는 일이 된다.

### 경계 — 이건 이 원칙이 아니다

세계가 지니는 사실 전부가 아니다. **관찰자에게 매달리는 것**만이다. 존재의 생명·기력·
능력치는 그 존재의 것이고 이 원칙과 무관하다. 그리고 "대상 쪽에 아무것도 적지 않는다" 는
지금 단계의 규율이다 — 위협도라는 개념을 **세우기로 결정한** Cycle 이 오면 그때는
대상 쪽에 적는 것이 그 개념의 정의가 된다. 그때 이 원칙은 그 결정을 막는 것이 아니라
**그것이 결정이었음을 드러내는** 역할을 한다.

## OBSERVED REPEATING PATTERN

    3회 — C004 (Observer.ActorId) · C014 (Acquaintances) · C017 (TargetSelections)
    C017 은 이 모양을 새로 발명하지 않고 C014 의 것을 그대로 가져왔고,
    그때 판단할 것이 하나도 남지 않았다 — 패턴이 굳었다는 신호다.

## AFFECTED NODES

    MC-DESIGNATE-TARGET · MC-WATCH-TARGET · MC-OBSERVE
    앞으로 관찰자별 사실이 생길 모든 자리 (대화 상대 · 파티 · 표식 · 퀘스트 진행)

## EXPECTED SCOPE

    GLOBAL — 세계 상태를 관찰자에게 매달지 대상에게 매달지의 판단 전반

## REQUIRES

    관찰자에게 매달리는 사실은 세계가 관찰자 Id 를 열로 지닌다
    담는 것은 Id 뿐이며 값은 언제나 그 순간의 존재에서 읽는다
    "없음" 은 항목의 부재로 표현한다

## PROHIBITS

    대상 쪽에 "누가 나를 고르고/알고 있는가" 를 적는 것
    관찰자별 사실을 Client 가 자기 쪽에 소유하는 것

## PREFERS

    같은 모양의 장부가 이미 있으면 그것을 그대로 가져오는 것 (C017 이 C014 에서 그랬다)

## POTENTIAL CONFLICTS

    없음. `DC-TARGET-IS-INTENT-NOT-AIM` 을 구조로 뒷받침한다.
    다만 위협도(MP-* 가 아직 요구하지 않음)를 세우는 Cycle 이 오면 PROHIBITS 첫 줄과
    정면으로 만난다 — 위 "경계" 절이 그 자리를 미리 그어 둔 것이다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    셋이 같은 모양으로 섰고 세 번째에는 판단이 남지 않았다. 승격하면 네 번째부터는
    "대상 쪽에 적을까" 를 다시 묻지 않게 된다 — 그리고 그 물음에 잘못 답하는 것이
    되돌리기 가장 어려운 종류다 (대상 쪽에 적은 값을 읽는 규칙이 붙기 시작하면
    그것을 걷어내는 것이 곧 그 규칙들을 다시 쓰는 일이 된다).

## HUMAN DECISION

    PENDING
    Reason
