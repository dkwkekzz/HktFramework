# CC-THE-VIEW-PICKS-AMONG-WHAT-THE-WORLD-OPENS

접수: Feedback — C020-what-you-carry-takes-room 의 MASTER FEEDBACK ⑥ 이 보고한 관찰이다.
Cycle Agent 는 관찰만 보고했고, **그 Cycle 스스로 보류를 권했다**
(DC-WORLD-OWNS-THE-SURFACE-LIST 의 경계 조항이 이미 같은 말을 하고 있다).
승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    세계는 무엇이 선택지인지와 각각이 지금 되는지를 싣는다.
    그중 무엇을 고를지는 View 가 정한다 — 그것은 판정이 아니라 표현이다.

## 무엇을 말하는가 (예시)

한 줄로: **세계는 "이 셋이 가능하다" 까지, View 는 "그중 이걸 하겠다" 부터.**

C020 이 덜어내기를 키 하나에 붙이면서 나온 형태다. 세계는 자리마다 덜어낼 수 있는지를
말해 줄 뿐, 그중 무엇을 덜어낼지는 말하지 않는다. 키 하나로 조작하는 화면에서는
고르는 일이 필요하고, 그 고름을 View 가 했다.

```ts
// content/proto-adventure/view/carried-presentation.ts
export function letGoTargetSlot(snapshot: GameViewSnapshot): number | null {
  for (const item of snapshot.carried) {
    const letGo = item.actions.find((a) => a.effect === 'let-go' && a.available);
    if (letGo) return letGo.slot;        // 세계가 된다고 말한 것 중 첫 자리
  }
  return null;
}
```

두 번째 관찰이다. 첫 번째는 C011 의 막기 토글이며 형태가 같다.

```ts
// content/proto-adventure/view/bindings.ts — C011
const guarding = scene.self?.guard.guarding ?? false;
const wanted = guarding ? 'guard-release' : 'guard-begin';   // 세계가 연 둘 중 하나를 고른다
```

### ❌ 흔한 구현 — View 가 판정한다

```ts
// 이렇게 하지 않았다
const target = snapshot.carried.find((c) => c.kind !== 'pickaxe');  // 곡괭이는 버리면 안 되니까
```

같은 화면이 나온다. 갈리는 것은 **규칙이 바뀔 때**다. 곡괭이를 둘 지니면 하나는 덜어낼 수
있어야 하는데, 위 코드는 영원히 막는다. 세계는 이미 `available: true` 를 보내고 있는데도.

### 무엇이 달라지나

지켜서 얻는 것: 화면이 겨누는 자리는 **언제나** 세계가 허락한 자리다. C020 의 실측이
그것이다 — 곡괭이만 지닌 몸에서 덜어내기 키를 눌러도 요청 자체가 나가지 않는다.
View 가 "곡괭이니까" 라고 판단해서가 아니라, 세계가 그 자리를 열지 않았기 때문이다.

어겼을 때 잃는 것: 규칙이 바뀌어도 화면이 따라오지 않는다. 그리고 그 어긋남은 조용하다 —
세계는 허락하는데 화면이 요청을 안 보내므로 오류도 사유도 남지 않는다.

### 가장 안 읽히는 조각 — "그것은 판정이 아니라 표현이다"

고르는 것과 판정하는 것은 다르다. 판정은 *되는가*를 답하고, 고름은 *된다고 한 것 중
무엇을*을 답한다. 앞의 것을 View 가 하면 두 개의 진실이 생기고, 뒤의 것을 세계가 하면
화면이 자기 형편(키가 하나인지 목록이 있는지)을 말할 수 없게 된다.

### 경계 — 이것은 새 원칙이 아닐 수 있다

`DC-WORLD-OWNS-THE-SURFACE-LIST` 가 이미 경계 조항으로 같은 말을 한다:
*"이 Constraint 는 '무엇이 선택지인가' 만 세계에 둔다. 그것을 어떻게 보여줄지는 여전히
View 의 결정이다."* 이 후보는 그 경계의 **한 걸음 앞**을 말한다 — 보여주는 것뿐 아니라
**고르는 것**도 View 라는 것.

그래서 신규 DC 보다 그 DC 의 `prefers` 한 줄이 맞을 수 있다. 판단은 Human 이 한다.

## OBSERVED REPEATING PATTERN

    C011   막기 토글 — 세계가 걸기·놓기를 열고, 화면이 지금 상태를 보고 하나를 고른다
    C020   덜어내기 — 세계가 자리마다 되는지를 말하고, 화면이 그중 첫 자리를 고른다

    둘 다 `view/bindings.ts` 의 KeyBinding 이며, 둘 다 `scene` 을 읽어 요청을 고른다.

## AFFECTED NODES

    직접   없음 — 이것은 Capability 의 형태가 아니라 World/View 경계의 형태다
    간접   조작 표면을 늘리는 모든 Cycle (키 하나에 여러 선택지가 걸리는 자리)

## EXPECTED SCOPE

    GLOBAL

## REQUIRES

    세계는 선택지의 집합과 각각의 가부·사유를 싣는다 (기존 DC 가 이미 요구한다)
    View 가 고른 것은 언제나 세계가 열어 둔 것 중 하나다

## PROHIBITS

    View 가 세계의 판정을 자기 코드로 다시 계산해 선택지를 좁히는 것

## PREFERS

    고를 것이 없을 때 View 가 요청을 보내지 않는 것 — 세계에 거절을 시키지 않는다

## POTENTIAL CONFLICTS

    없음. `DC-WORLD-OWNS-THE-SURFACE-LIST` 와 같은 방향이며 그 경계를 한 걸음 넓힌다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    두 번 나왔고 둘 다 같은 파일의 같은 형태다. 세 번째(장착 자리 고르기 · 쓸 대상
    고르기)가 곧 온다 — IE §19~§20 이 이미 "장착 가능한 슬롯이 여러 개라면 선택 UI" 를
    말하고 있으므로 장착 Cycle 에서 세 번째가 선다.

    다만 승격이 급하지 않다: 지금까지 두 사례 모두 그 형태를 지켰고, 어겨서 잃은 적이
    아직 없다. 세 번째 사례에서 어긋남이 실제로 나오면 그때가 승격의 근거가 된다.

## HUMAN DECISION

    PENDING
    Reason
