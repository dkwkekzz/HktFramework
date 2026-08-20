# CC-REASONS-ARE-A-LIST-NOT-A-BRANCH

접수: Feedback — C018-stance-decides-who-can-be-struck 의 MASTER FEEDBACK 이 보고한 관찰이다.
Cycle Agent 는 관찰만 보고했고, **그 Cycle 스스로 보류를 권했다** (사례가 하나뿐이다).
승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    한 판정이 여러 사정에서 나올 수 있으면, 사정을 목록으로 두고 판정은 그 목록을 읽는다.
    판정 안에 사정을 분기로 적지 않는다.

## 무엇을 말하는가 (예시)

한 줄로: **판정이 "왜" 를 알면 안 된다. "왜" 들의 목록만 알아야 한다.**

C018 이 태도를 세우면서 나온 형태다. 지금 적대를 낳는 사정은 하나뿐이다 —
지킬 자리에 침입자가 들었다. 그런데 그것을 판정 안에 적지 않았다.

```ts
// world/semantic/relation.ts
export const HOSTILITY_REASONS: readonly HostilityReason[] = [
  { id: 'guarded-ground-intruded',
    holds: (a, b) => a.guardedGround !== null && isInsideGuardedGround(a.guardedGround, b.position) },
];

// world/rules/relation.ts — 판정은 목록만 읽는다
for (const reason of HOSTILITY_REASONS) if (reason.holds(a, b)) return 'hostile';
return 'neutral';
```

### ❌ 흔한 구현 — 판정 안에 사정을 적는다

```ts
// 이렇게 하지 않았다
function stance(a, b) {
  if (a.guardedGround && inside(a.guardedGround, b)) return 'hostile';
  return 'neutral';
}
```

지금은 **완전히 같다.** 항목이 하나뿐이기 때문이다. 갈리는 것은 두 번째 사정이 올 때다.

### 무엇이 달라지나 — 두 번째 사정이 올 때

진영이든 결투든 도발이든, 적대의 두 번째 이유가 서는 Cycle 을 생각하자.

```text
분기로 적었으면   stance() 를 고친다 → 그 함수를 부르는 자리들을 다시 본다
                 → 관문(RULE-HARM-GATE-001)과 자율 판단과 투영이 모두 검토 대상이 된다
목록으로 두면     HOSTILITY_REASONS 에 항목 하나를 더한다 → 끝
                 관문도 관찰 계약도 화면도 한 글자도 안 바뀐다
```

그리고 사정 목록을 **투영하지 않기로** 한 것이 이 구조의 나머지 절반이다 (C018 04
OBSERVABLE PROJECTION NOTE). 화면이 "무엇이 적대를 만드는가" 를 알면 항목이 늘 때마다
화면도 함께 고쳐야 한다 — 목록으로 둔 값어치가 거기서 사라진다.

### 경계 — 이건 이 원칙이 아니다

**모든 조건문을 배열로 바꾸라는 말이 아니다.** 사정이 하나로 확정된 판정
(예: 쓰러짐 = 생명이 0)은 그냥 적는다. 이 원칙이 겨냥하는 것은 **근거 문서가 이미
"이유는 여럿" 이라고 말한 자리**다 — C018 의 경우 Human 이 "npc·monster 등 세계의
규칙에 따라 관계가 적대여야 할 이유가 정해진다" 로 명시했다.

## OBSERVED REPEATING PATTERN

    1회 — C018 (HOSTILITY_REASONS)
    **값어치가 아직 실측되지 않았다.** 항목이 하나뿐이라 분기로 적은 것과 결과가 같다.
    두 번째 사정이 서는 Cycle 이 이 후보를 확인하거나 기각한다.

## AFFECTED NODES

    MC-RELATION-STANCE · 앞으로 여러 사정에서 나올 판정 전부
    (위협도 · 진영 · 거래 가부 · 지역 진입 가부)

## EXPECTED SCOPE

    GLOBAL

## REQUIRES

    여러 사정에서 나올 수 있는 판정은 사정을 목록으로 두고 판정이 그것을 읽는다
    사정 목록의 단일 출처는 세계다

## PROHIBITS

    사정 목록 자체를 관찰에 싣는 것 (화면이 항목마다 따라 고쳐지게 된다)

## PREFERS

    항목이 자기 Id 를 지니는 것 — 나중에 "왜 적대인가" 를 싣기로 하면 그 자리가 이미 있다

## POTENTIAL CONFLICTS

    없음. `DC-WORLD-OWNS-THE-SURFACE-LIST` 와 같은 방향이다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    **아직 아니다.** C018 스스로 보류를 권했고 그 판단이 옳다 — 지금 승격하면 근거가
    하나짜리 패턴이 된다. 다만 기록해 두는 이유가 있다: 두 번째 사정이 오는 Cycle 이
    이 구조를 **모르고 분기로 되돌리면** 그때 잃는 것이 크고, 되돌리기도 어렵다.

## HUMAN DECISION

    PENDING
    Reason
