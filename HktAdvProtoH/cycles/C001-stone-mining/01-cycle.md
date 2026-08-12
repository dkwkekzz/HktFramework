# CYCLE C001 — Stone Mining

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## TYPE
    New Capability

## TARGET CAPABILITY
    Mining

## GOAL
    곡괭이를 보유한 캐릭터를 광맥까지 이동시켜 Mine 을 수행하면
    광맥의 자원이 줄고 자신의 Inventory 에 Stone 1개가 획득된다.

## INCLUDED
    Character Movement (광맥까지 이동)
    Pickaxe Possession (Mining 가능 조건)
    Stone Deposit (광맥 — 유한한 자원 보유)
    Mine Action (캐기 수행)
    Stone Acquisition (Inventory 에 Stone 획득)

## EXCLUDED
    Inventory Capacity (저장 한계)
    Tool Durability (곡괭이 내구도)
    Deposit Respawn (광맥 재생)
    Stone 외 다른 자원 종류
    Crafting / Trade / Combat
    Multiplayer (다른 Actor 와의 상호작용)

## RELATED EXISTING CAPABILITY
    없음 — 첫 Cycle. 공유 World 의 기반 Semantic (Actor · Position · Inventory · Item)
    이 이번 Cycle 에서 처음 도입된다.
