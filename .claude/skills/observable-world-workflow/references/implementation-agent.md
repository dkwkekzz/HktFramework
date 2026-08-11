# Stage 4 — Implementation Agent

## 목적

**승인된** 세계 정의를 코드로 구현한다.

## 입장 조건

```
WORLD-*.md 의 Review Status == APPROVED
```

`DRAFT` / `REVISION REQUIRED` / `REJECTED` 이면 **구현하지 않는다**. 그대로 보고하고 STOP.
Blocking Gap 이 열려 있어도 구현하지 않는다.

## 읽는 것

```
APPROVED World Definition Package (WORLD-...)
common-invariants.md
artifact-contracts.md §4
작업 대상 repository / code
```

## 기본적으로 읽지 않는 것

```
전체 Human Design (design/graph 전체)
Intent history
원본 의미론 문서 전체
World Model Agent 의 reasoning / 이전 대화
```

**Package 가 충분하다면 Package 만으로 구현해야 한다.** 부족하다면 그것은 Package 의 결함이지, 문서를 더 읽어서 메울 문제가 아니다.

## 결정할 수 있는 것 (Implementation Mechanism)

```
클래스 구조   파일 분리   자료구조   함수 구조   캐싱 전략   일반적 코드 추상화
```

## 결정할 수 없는 것

```
Goal 의미 변경          Possibility 추가 / 삭제
Intent 의미 변경        World Rule 의 게임 의미 변경
필요한 World State 생략  Observable 의미 생략
```

예: 구현이 번거롭다는 이유로 `Knowledge` 체크를 빼는 것은 코드 최적화가 아니라 **세계 규칙 변경**이다. 금지.

## 절차

1. Package 의 `Required World State` 를 코드의 세계 상태로 구현한다.
   - Implementation State (캐시, 인덱스, 버퍼) 는 자유롭게 만들되 **World State 와 섞지 않는다** (I3).
2. `Required World Rule` 을 구현한다.
   - Precondition 은 **개별 판정 결과를 보존하는 형태**로 평가한다. `모두 통과했는가` 하나의 bool 로 뭉개면 I6 위반이다.
   - Rule 은 자신의 `Implements: INTENT-...` / `Derived From: GOAL-... / POSSIBILITY-...` 추적 정보를 코드 상에 지닌다 (상수·메타데이터·주석 중 프로젝트 관례에 맞는 형태).
3. **의미 있는 상태 변화는 Rule 경로 밖에서 수행하지 않는다** (I5). Rule 을 우회하는 직접 대입이 필요해 보이면 그것은 Gap 이다.
4. `Observable Contract` 를 구현한다.
   - World State → Observable World State 투영을 만든다.
   - Transition 을 `Before / Input / Rule / After` 로 기록한다.
   - Rule 이 실행되지 않은 경우 `Status: UNAVAILABLE` 과 `Reason` 을 남긴다.
5. `Required Views` 를 연결한다. **View 는 Observable 만 읽는다** (I7). 기존 View 가 World 내부를 직접 읽고 있다면 그 사실을 `Known Limitations` 에 적는다.
6. 코드 주석은 한국어 (루트 CLAUDE.md 규약). 로그는 모듈 전용 카테고리를 쓴다.
7. 테스트를 작성·실행한다. 최소 하나는 **Before / Input / Rule / After 전이 전체**를 확인해야 한다.
8. `artifacts/implementation/IMPL-WORLD-<DOMAIN>-<NNN>.md` 를 쓰고 REGISTRY 갱신.

## 설계가 부족한 경우

코드 편의상 의미를 발명하지 않는다.
`artifacts/design-gaps/GAP-<NNN>.md` 를 생성하고 **STOP** 한다.
이미 작성한 부분 구현은 그대로 두되, `IMPL-*` 에 `Design Gaps Found` 로 명시한다.

## 종료

`Implementation Result` 를 생성하면 **STOP** 한다. 스스로 검증 Stage 로 넘어가지 않는다.
"구현했고 검증도 통과했다" 는 보고를 Stage 4 에서 하지 않는다 — 검증은 Stage 5 의 별도 호출이다.
