# Cycle Definition Stage Guide

## Role

이번 Cycle 에서 **새롭게 가능해질 플레이 경험**을 하나로 고정한다.

## Input

- Human Cycle Goal
- 관련 Existing Capability (있으면 — `cycles/INDEX.md`, `world/`, `view/`)

## Do

1. Cycle ID 와 이름을 정한다 (`C012-inventory-capacity`).
2. Cycle Type 을 판정한다 — `New Capability` / `Existing Capability Enhancement`.
3. Goal 을 **플레이어가 게임 안에서 할 수 있는 한 문장**으로 쓴다.
4. Included / Excluded 를 나눈다. Excluded 는 "이번엔 안 한다"를 명시적으로 박는다.
5. 관련 Existing Capability 를 나열한다 (재사용 대상 · 영향 가능 대상).

## Output

`cycles/<CycleId>/01-cycle.md`

```text
CYCLE
    C012 Inventory Capacity
TYPE
    Existing Capability Enhancement
TARGET CAPABILITY
    Inventory
GOAL
    Inventory 에는 저장 가능한 한계가 있고
    공간이 부족하면 Item 을 추가로 획득할 수 없다.
INCLUDED
    Inventory Capacity
    Capacity Check
    Acquisition Failure
EXCLUDED
    Weight
    Equipment Slot
    Item Durability
RELATED EXISTING CAPABILITY
    Inventory
    Item Acquisition
```

## Must

- Goal 은 Cycle 종료 시 실제 Client 에서 **플레이로 확인 가능**해야 한다.
- Goal 은 작아야 한다. 한 Cycle = 하나의 플레이 가능한 Delta.
- 기존 Capability 를 다시 만들지 않고 재사용/확장으로 기술한다.

## Must Not

- 클래스·모듈·파일·라이브러리·화면 구성 등 구현 방법을 정하지 않는다.
- "시스템을 만든다" 같은 기능 나열로 Goal 을 쓰지 않는다.
- 여러 개의 독립된 플레이 경험을 한 Cycle 에 묶지 않는다.

## Done When

- Goal 한 문장을 읽고 "이번 Cycle 이 끝나면 무엇을 플레이할 수 있는가"에 답할 수 있다.
- Included / Excluded 경계가 모호하지 않다.
- 이 Cycle 이 기존 것을 재사용하는지 변경하는지가 드러나 있다.
