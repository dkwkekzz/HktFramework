# Stage 1 — Intent

Cycle Contract 의 Goal / Possibility 에서 **세계가 보장해야 하는 의미 단위** 를 추출한다.

## 입력

```text
context/TARGET-HORIZON.md
cycles/<cycle-id>/00-CYCLE-CONTRACT.md      (상태가 CONFIRMED 여야 함)
context/WORLD-BASELINE.md                   (관련 부분집합)
design/Design-Concept.md                    (Goal / Possibility 원본 — fallback)
```

## 출력

```text
cycles/<cycle-id>/01-INTENT-PACKAGE.md
```

템플릿: [../templates/INTENT-PACKAGE.md](../templates/INTENT-PACKAGE.md)

## Intent 란 무엇인가

Intent 는 **세계에서 무엇이 참이어야 하는가** 만 정의한다. 구현 요구사항이 아니다.

```text
잘못된 Intent                          올바른 Intent
─────────────────────                  ────────────────────────────────
MiningComponent 를 만든다.              광맥을 알고 있으며,
Mine() 메서드를 추가한다.               적절한 채굴 도구를 가지고 있고,
InventoryService 를 호출한다.           광맥에 접근 가능한 Actor 는

                                       Mine 을 통해

                                       광맥의 Resource 를 감소시키고
                                       자신의 Inventory 에 Resource 를
                                       획득할 수 있다.
```

## 절차

### 1. Trace 고정

각 Intent 는 반드시 원본까지 추적 가능해야 한다.

```text
Intent ID:
    INTENT-<DOMAIN>-<NNN>

Source Goal:
    GOAL-<...>

Source Possibility:
    POSSIBILITY-<...>
```

### 2. Intent 문장 작성

한 Intent 는 다음 세 부분을 모두 담는다.

```text
조건절     어떤 상태의 Actor 가
행위절     무엇을 통해
결과절     세계와 자신이 어떻게 달라지는가
```

문장 안의 **모든 명사·수식어가 Stage 2 에서 State 나 Rule 로 폐쇄될 것**임을 의식하고 쓴다.
"적절한 도구" 처럼 폐쇄 불가능한 모호어는 쓰지 않는다 —
"Mining Capability 를 가진 Tool" 처럼 판정 가능한 표현으로 쓴다.

### 3. Semantic Inventory 작성

Intent 문장에서 등장하는 의미 요소를 **빠짐없이** 나열한다.
이 목록이 Stage 2 의 Closure 검사 대상이고 Stage 5 의 채점표다.

```text
"광맥을 알고 있다"          → 의미 요소: Actor 의 인지, Deposit 의 식별
"채굴 도구를 가지고 있다"    → 의미 요소: 소유, 도구의 채굴 능력
"접근 가능하다"             → 의미 요소: 위치, 상호작용 거리
"Resource 를 감소시킨다"     → 의미 요소: 자원 수량의 변화
"Inventory 에 획득한다"      → 의미 요소: 소유 수량의 변화
```

여기서 대응 State 이름을 확정하지 않는다. 그것은 Stage 2 의 결정이다.

### 4. Contract 범위 대조

Contract 의 `Explicitly Deferred` 에 있는 것을 Intent 에 끌어들이지 않는다.
Contract 의 `Goal / Possibility Scope` 를 넘는 Intent 를 만들지 않는다.

## 금지

```text
클래스 / 함수 / 파일 / 자료구조 언급
Contract 의 Goal · Possibility 를 추가·삭제·변경
Stage 2 의 State 이름 확정
구현 난이도를 이유로 조건 삭제
```

## 종료

`01-INTENT-PACKAGE.md` 작성 → `context/CURRENT-CYCLE.md` 의 Stage 1 줄 갱신 → **STOP.**
Stage 2 는 별도 invocation 이다.
