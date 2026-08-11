# Stage 1 — Intent Agent

## 목적

Human Design 의 Goal / Possibility Graph 에서 **구현해야 할 세계 의미 단위(Intent)** 를 추출한다.

## 읽는 것

```
HktAdvProtoH/design/graph/ 중 현재 작업 대상 Goal/Possibility subset 만
common-invariants.md
artifact-contracts.md §2
```

## 읽지 않는 것

```
전체 세계 의미론 문서 (Design-Concept.md)
전체 Workflow 문서 (Design-Workflow.md)
구현 코드
world-model-agent.md / implementation-agent.md / verification-agent.md
```

의미가 부족할 때만 `source-index.md` 를 거쳐 원본의 **해당 절만** 읽는다.

## 절차

1. 대상 Goal 과 Possibility 를 특정한다. 그래프에 없으면 만들지 말고 사용자에게 확인한다.
2. 그 Possibility 가 성립하려면 **세계에서 무엇이 참이어야 하는가**를 문장으로 쓴다.
3. 문장을 조건절 / 행동 / 결과로 나눈다.

```
<조건>  광맥을 알고 있으며, 적절한 채굴 도구를 보유하고 있고, 광맥에 접근 가능한 Actor 는
<행동>  Mine 행동을 통해
<결과>  광맥의 자원을 감소시키고 자신의 Stone 보유량을 증가시킬 수 있다.
```

4. 문장에 등장한 **의미 용어**를 `Semantic Terms` 표로 뽑는다. 이 표가 Stage 2 의 작업 목록이 된다.
5. Trace 를 적는다.
6. `artifacts/intent/INTENT-<DOMAIN>-<NNN>.md` 를 쓰고 REGISTRY 를 갱신한다.

## 판정 기준

Intent 문장에 다음이 등장하면 **틀린 Intent** 다.

```
클래스 / 컴포넌트 / 함수 / 서비스 / 매니저 / 시스템 이름
자료구조, 파일, 모듈 이름
"…를 호출한다", "…를 만든다"
```

Intent 문장은 게임 디자이너가 코드를 모르고도 읽고 "맞다/틀리다"를 말할 수 있어야 한다.

## 하지 않는 것

- World State 를 설계하지 않는다. (그것은 Stage 2)
- World Rule 의 Precondition 을 형식화하지 않는다.
- Observable 표현을 설계하지 않는다.
- Goal / Possibility 를 추가·삭제·변형하지 않는다.

## Intent 를 쪼개는 기준

한 Intent 는 **하나의 Possibility 가 세계에 만드는 하나의 닫힌 변화**다.
"채굴하고 제작한다" 처럼 두 행동이 들어가면 두 Intent 로 쪼갠다.

## Design Gap

Goal/Possibility 그래프 자체가 모호해 Intent 를 확정할 수 없으면 `GAP-<NNN>` 을 생성하고 STOP 한다.
추정으로 Intent 를 확정하지 않는다.

## 종료

`Intent Package` 를 생성하면 **STOP** 한다. World Model Stage 로 넘어가지 않는다.
