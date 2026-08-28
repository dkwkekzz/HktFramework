# Intent Stage Guide

## Role

Cycle Goal 을 Goal / Possibility 와 Intent 로 변환한다.

## Input

- `cycles/<CycleId>/01-cycle.md`
- 필요한 Existing Capability 의 의미 (관련 있는 기존 Cycle 의 Artifact 만 확인)

## Do

1. Goal 을 정의한다 — 세계에서 달성하려는 상태.
2. Goal 을 달성하는 Possibility 를 정의한다 — 그 상태에 이르는 가능한 경로.
3. Intent 를 추출한다 — **어떤 조건의 주체가 무엇을 하면 세계가 어떻게 변하는가**.
4. 각 Intent 를 Source Goal / Possibility 와 연결한다 — 항목 안의 `Trace` 줄로
   (별도 절을 만들지 않는다).
5. 기존 Intent 를 확장/변경하는 경우 무엇이 바뀌는지 명시한다.

## Output

`cycles/<CycleId>/02-intent.md`

항목: `GOAL / POSSIBILITY` · `INTENT SET` (Trace 인라인) · `EXISTING INTENT DELTA`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- Intent 는 **세계에서 무엇이 가능하고 무엇이 참이어야 하는지**를 표현한다.
- Intent 는 조건(Precondition)·행위·결과 변화를 모두 포함한다.
- 모든 Intent 는 Source Goal / Possibility 로 역추적 가능하다.
- 주체의 판단에 영향을 주는 것(지식·숙련도·선호·현재 목적)은 세계의 의미로 다룬다.

## Must Not

- 클래스, 함수, 서비스, Component, Rendering 등 구현 방법을 결정하지 않는다.
- State 이름·자료구조·저장 위치를 확정하지 않는다 (World Semantic 단계 책임).
- 01-cycle.md 의 EXCLUDED 항목을 Intent 로 끌어들이지 않는다.

## Done When

- Cycle Goal 의 의미가 Goal / Possibility / Intent 로 **빠짐없이** 표현되어 있다.
- Intent 문장만 읽고 "이번 Cycle 에서 무엇이 가능해지는가"에 답할 수 있다.
- Intent 어느 문장도 구현 지시로 읽히지 않는다.
