# HktStory Skill — Story 작성 가이드

HktStory는 register-based bytecode VM 위에서 동작하는 게임 로직 Flow를 정의하는 시스템이다.
두 가지 작성 방식을 지원한다:
1. **C++ DSL** — `FHktStoryBuilder` fluent builder로 직접 작성 (HktStory 모듈)
2. **JSON** — `FHktStoryOpRegistry` 기반 JSON으로 작성 (HktStoryGenerator 모듈, MCP 경로)

## Architecture Overview

```
[C++ 경로]  Story(.cpp) → FHktStoryBuilder → FHktVMProgram(bytecode) → FHktVMInterpreter(실행)
[JSON 경로] Story(.json) → FHktStoryJsonCompiler → FHktStoryOpRegistry(dispatch) → FHktStoryBuilder → FHktVMProgram
```

- **서버 권위적**: 클라이언트는 Precondition으로 사전 판단만 하고, 서버가 바이트코드를 실행하여 최종 검증
- **Pure C++**: UObject/UWorld 의존 없음. HktCore 모듈은 순수 C++ VM
- **자가 등록**: C++ 경로는 `HKT_REGISTER_STORY_BODY()` 매크로, JSON 경로는 `FHktStoryOpRegistry` 자동 dispatch

### FHktStoryOpRegistry — HktStoryGenerator 무변경 보장

`FHktStoryOpRegistry`(HktCore)는 모든 Builder 메서드를 이름/파라미터/핸들러로 등록한다.
`FHktStoryJsonCompiler`(HktStoryGenerator)는 이 레지스트리를 참조하여 자동으로 JSON→Builder 변환.

**새 Operation 추가 시:**
1. `FHktStoryBuilder`에 메서드 추가
2. `HktStoryOpRegistry.cpp`의 `RegisterBuiltinOps()`에 등록
3. 이 skill.md의 Builder API Reference 업데이트
→ **HktStoryGenerator 코드 변경 불필요**

---

## C++ 경로 — File Structure

- 파일 위치: `Source/HktStory/Private/Definitions/HktStory<Name>.cpp`
- 네임스페이스: `namespace HktStory<Name> { ... }`
- 파일명 규칙: `HktStory` + PascalCase 이름 (예: `HktStoryFireball.cpp`)

### C++ Template

```cpp
// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"

namespace HktStory<Name>
{
    // Story Name — "Story.Event.<Category>.<Name>" 또는 "Story.Flow.<Category>.<Name>"
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_<Name>, "Story.Event.<Category>.<Name>", "<설명>");

    // 필요한 태그 정의 (Entity, Anim, VFX, Sound, Effect 등)
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_..., "...", "...");

    /**
     * ================================================================
     * <Story 이름> Flow
     *
     * 자연어로 읽으면:
     * "<이 Flow가 하는 일을 자연어로 기술>"
     *
     * Self = <소스 엔티티 설명>, Target = <타겟 엔티티 설명>
     * ================================================================
     */
    HKT_REGISTER_STORY_BODY()
    {
        using namespace Reg;

        Story(Story_<Name>)
            // ... builder chain ...
            .Halt()
            .BuildAndRegister();
    }
}
```

---

## JSON 경로 — Format

JSON 경로는 MCP를 통해 AI Agent가 Story를 동적 생성할 때 사용한다.
`FHktStoryOpRegistry`에 등록된 모든 Operation이 자동 지원된다.

### JSON Template

```json
{
  "storyTag": "Ability.Skill.IceBlast",
  "description": "Ice blast skill",
  "cancelOnDuplicate": false,
  "tags": {
    "alias": "Full.GameplayTag.Name"
  },
  "steps": [
    { "op": "AddTag", "entity": "Self", "tag": "alias_or_full_tag" },
    { "op": "WaitSeconds", "seconds": 1.0 },
    { "op": "Halt" }
  ]
}
```

**필드 설명:**
- `storyTag`: GameplayTag 이름 (이벤트 식별자)
- `description`: 선택적 설명
- `cancelOnDuplicate`: 같은 엔티티에 동일 이벤트 중복 시 기존 취소 (기본 false)
- `tags`: 단축 alias → 전체 GameplayTag 매핑 (태그 자동 등록됨)
- `steps`: Operation 배열 (순서대로 실행)

---

## Tag 네이밍 규칙

| 카테고리 | 패턴 | 예시 |
|---------|------|------|
| Story (스킬) | `Story.Event.Skill.<Name>` | `Story.Event.Skill.Fireball` |
| Story (공격) | `Story.Event.Attack.<Name>` | `Story.Event.Attack.Basic` |
| Story (이동) | `Story.Event.Move.<Name>` | `Story.Event.Move.ToLocation` |
| Story (아이템) | `Story.Event.Item.<Name>` | `Story.Event.Item.Pickup` |
| Story (스포너) | `Story.Flow.Spawner.<Name>` | `Story.Flow.Spawner.DungeonEntrance` |
| Entity | `Entity.<Type>.<Name>` | `Entity.Projectile.Fireball` |
| Animation | `Anim.<Part>.<Action>.<Name>` | `Anim.UpperBody.Cast.Fireball` |
| VFX | `VFX.Niagara.<Name>` | `VFX.Niagara.DirectHit` |
| Sound | `Sound.<Name>` | `Sound.Explosion` |
| Effect | `Effect.<Name>` | `Effect.Burn` |

## Register System (16개)

| Register | 별칭 | 용도 |
|----------|------|------|
| R0-R8 | `R0`~`R8` | 범용. 자유롭게 사용 |
| R9 | `Temp` | Builder 내부 헬퍼 전용 (SaveConst, ApplyDamage 등). **직접 사용 금지** |
| R10 | `Self` | Event.SourceEntity — 항상 유효 |
| R11 | `Target` | Event.TargetEntity — 항상 유효 |
| R12 | `Spawned` | `SpawnEntity()` 호출 후 유효 |
| R13 | `Hit` | `WaitCollision()` 후 유효 |
| R14 | `Iter` | `NextFound()` / ForEach 루프 내 유효 |
| R15 | `Flag` / `Count` | 비교 결과, 카운트 결과 저장 |

**주의**: `ApplyDamage`/`ApplyDamageConst`는 내부적으로 R7, R8, R9(Temp)를 사용한다. 이 연산 전후로 R7-R8에 중요한 값을 보관하지 말 것.

## Builder API Reference

> C++ API와 JSON `"op"` 이름이 동일하다. JSON에서는 파라미터를 필드명으로 전달한다.

### Story Policy

| C++ | JSON | 비고 |
|-----|------|------|
| `.CancelOnDuplicate()` | `"cancelOnDuplicate": true` (top-level) | |
| `.SetPrecondition(lambda)` | C++ only | JSON에서는 사용 불가 |

### Control Flow

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.Label("name")` | `Label` | `name`: string |
| `.Jump("name")` | `Jump` | `label`: string |
| `.JumpIf(Cond, "name")` | `JumpIf` | `cond`: register, `label`: string |
| `.JumpIfNot(Cond, "name")` | `JumpIfNot` | `cond`: register, `label`: string |
| `.Yield(Frames)` | `Yield` | `frames`: int (선택, 기본 1) |
| `.WaitSeconds(1.0f)` | `WaitSeconds` | `seconds`: float |
| `.Halt()` | `Halt` | (없음) |
| `.Fail()` | `Fail` | (없음) |

### Event Wait

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.WaitCollision(Entity)` | `WaitCollision` | `entity`: register |
| `.WaitAnimEnd(Entity)` | `WaitAnimEnd` | `entity`: register |
| `.WaitMoveEnd(Entity)` | `WaitMoveEnd` | `entity`: register |

### Data Operations

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.LoadConst(Dst, Value)` | `LoadConst` | `dst`: register, `value`: int |
| `.LoadStore(Dst, PropId)` | `LoadStore` | `dst`: register, `property`: propertyId |
| `.LoadEntityProperty(Dst, Entity, PropId)` | `LoadEntityProperty` | `dst`, `entity`: register, `property`: propertyId |
| `.SaveStore(PropId, Src)` | `SaveStore` | `property`: propertyId, `src`: register |
| `.SaveEntityProperty(Entity, PropId, Src)` | `SaveEntityProperty` | `entity`: register, `property`: propertyId, `src`: register |
| `.SaveConst(PropId, Value)` | `SaveConst` | `property`: propertyId, `value`: int |
| `.SaveConstEntity(Entity, PropId, Value)` | `SaveConstEntity` | `entity`: register, `property`: propertyId, `value`: int |
| `.Move(Dst, Src)` | `Move` | `dst`, `src`: register |

### Arithmetic / Comparison

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.Add(Dst, Src1, Src2)` | `Add` | `dst`, `src1`, `src2`: register |
| `.Sub(Dst, Src1, Src2)` | `Sub` | 동일 |
| `.Mul(Dst, Src1, Src2)` | `Mul` | 동일 |
| `.Div(Dst, Src1, Src2)` | `Div` | 동일 |
| `.AddImm(Dst, Src, Imm)` | `AddImm` | `dst`, `src`: register, `imm`: int |
| `.CmpEq(Dst, Src1, Src2)` | `CmpEq` | `dst` (1/0), `src1`, `src2`: register |
| `.CmpNe(...)` | `CmpNe` | 동일 |
| `.CmpLt(...)` | `CmpLt` | 동일 |
| `.CmpLe(...)` | `CmpLe` | 동일 |
| `.CmpGt(...)` | `CmpGt` | 동일 |
| `.CmpGe(...)` | `CmpGe` | 동일 |

### Entity Management

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.SpawnEntity(ClassTag)` | `SpawnEntity` | `classTag`: tag |
| `.DestroyEntity(Entity)` | `DestroyEntity` | `entity`: register |

### Position & Movement

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.GetPosition(DstBase, Entity)` | `GetPosition` | `dst`: register (3연속 X,Y,Z), `entity`: register |
| `.SetPosition(Entity, SrcBase)` | `SetPosition` | `entity`: register, `src`: register (3연속) |
| `.MoveToward(Entity, TargetPos, Force)` | `MoveToward` | `entity`, `targetPos`: register (3연속), `force`: int |
| `.MoveForward(Entity, Force)` | `MoveForward` | `entity`: register, `force`: int (cm/s) |
| `.StopMovement(Entity)` | `StopMovement` | `entity`: register |
| `.GetDistance(Dst, E1, E2)` | `GetDistance` | `dst`, `entity1`, `entity2`: register |

**Position 규칙**: 위치는 항상 3개 연속 레지스터를 사용한다 (X, Y, Z). `GetPosition(R0, Self)`는 R0=X, R1=Y, R2=Z.

### Spatial Query & ForEach

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.FindInRadius(Center, Radius)` | `FindInRadius` | `center`: register, `radius`: int (cm) |
| `.NextFound()` | `NextFound` | (없음) |
| `.ForEachInRadius(Center, Radius)` | `ForEachInRadius` | `center`: register, `radius`: int (cm) |
| `.EndForEach()` | `EndForEach` | (없음) |

### Combat

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.ApplyDamage(Target, Amount)` | `ApplyDamage` | `target`, `amount`: register |
| `.ApplyDamageConst(Target, Amt)` | `ApplyDamageConst` | `target`: register, `amount`: int |
| `.ApplyEffect(Target, Tag)` | `ApplyEffect` | `target`: register, `effectTag`: tag |
| `.RemoveEffect(Target, Tag)` | `RemoveEffect` | `target`: register, `effectTag`: tag |

**주의**: ApplyDamage는 R7, R8, Temp(R9)를 내부 사용.

### Tags

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.AddTag(Entity, Tag)` | `AddTag` | `entity`: register, `tag`: tag |
| `.RemoveTag(Entity, Tag)` | `RemoveTag` | `entity`: register, `tag`: tag |
| `.HasTag(Dst, Entity, Tag)` | `HasTag` | `dst` (1/0), `entity`: register, `tag`: tag |
| `.CountByTag(Dst, Tag)` | `CountByTag` | `dst`: register, `tag`: tag |

### Presentation (VFX / Sound)

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.PlayVFX(PosBase, Tag)` | `PlayVFX` | `pos`: register (3연속), `tag`: tag |
| `.PlayVFXAttached(Entity, Tag)` | `PlayVFXAttached` | `entity`: register, `tag`: tag |
| `.PlaySound(Tag)` | `PlaySound` | `tag`: tag |
| `.PlaySoundAtLocation(PosBase, Tag)` | `PlaySoundAtLocation` | `pos`: register (3연속), `tag`: tag |

### World Query

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.GetWorldTime(Dst)` | `GetWorldTime` | `dst`: register |
| `.RandomInt(Dst, Modulus)` | `RandomInt` | `dst`, `modulus`: register |
| `.HasPlayerInGroup(Dst)` | `HasPlayerInGroup` | `dst`: register (1/0) |

### Item System

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.CountByOwner(Dst, Owner, Tag)` | `CountByOwner` | `dst`, `owner`: register, `tag`: tag |
| `.FindByOwner(Owner, Tag)` | `FindByOwner` | `owner`: register, `tag`: tag |
| `.SetOwnerUid(Entity)` | `SetOwnerUid` | `entity`: register |
| `.ClearOwnerUid(Entity)` | `ClearOwnerUid` | `entity`: register |

### Stance & Utility

| C++ | JSON op | 파라미터 |
|-----|---------|---------|
| `.SetStance(Entity, StanceTag)` | `SetStance` | `entity`: register, `stanceTag`: tag |
| `.SetItemSkillTag(Entity, SkillTag)` | `SetItemSkillTag` | `entity`: register, `skillTag`: tag |
| `.Log(TEXT("message"))` | `Log` | `message`: string |

## PropertyId 목록

### Hot Properties (O(1) 직접 인덱싱)

| ID | 용도 |
|----|------|
| `PosX`, `PosY`, `PosZ` | 위치 |
| `RotYaw` | 회전 |
| `MoveTargetX/Y/Z` | 이동 목표 |
| `MoveForce` | 이동 힘 |
| `IsMoving` | 이동 중 여부 |
| `MaxSpeed` | 최대 이동 속도 |
| `Health`, `MaxHealth` | 체력 |
| `AttackPower` | 공격력 |
| `Defense` | 방어력 |
| `Team` | 팀 |
| `Mana`, `MaxMana` | 마나 |
| `OwnerEntity` | 소유 엔티티 |
| `EntitySpawnTag` | 스폰 태그 |
| `Stance` | 스탠스 |
| `CP`, `MaxCP` | 전투 포인트 |
| `AttackSpeed` | 공격 속도 |
| `NextActionFrame` | 다음 행동 프레임 |

### Cold Properties (페어 배열 순회)

| ID | 용도 |
|----|------|
| `TargetPosX/Y/Z` | 이벤트 파라미터: 이동 목표 |
| `Param0`~`Param3` | 이벤트 파라미터: 범용 |
| `AnimState`, `AnimStateUpper`, `VisualState` | 애니메이션/비주얼 |
| `VelX/Y/Z` | 속도 |
| `Mass` | 질량 |
| `CollisionRadius` | 충돌 반경 |
| `ItemState` | 아이템 상태 (0=Ground, 1=InBag, 2=Active) |
| `ItemId` | 아이템 ID |
| `BagSlot` | 가방 슬롯 번호 |
| `ActionSlot` | 액션 슬롯 (-1=없음) |
| `BagCapacity` | 가방 용량 |
| `IsNPC` | NPC 여부 |
| `SpawnFlowTag` | 스폰 Flow 태그 |
| `ItemSkillTag` | 아이템 스킬 태그 |
| `SkillCPCost` | 스킬 CP 소모량 |
| `RecoveryFrame` | 회복 프레임 |

## Story 패턴별 예시

### Pattern 1: 단순 스킬 (순차 실행)

**C++:**
```cpp
Story(Story_BasicAttack)
    .AddTag(Self, Tag_Anim_Attack)
    .WaitAnimEnd(Self)
    .LoadStore(R0, PropertyId::AttackPower)
    .ApplyDamage(Target, R0)
    .PlayVFXAttached(Target, VFX_HitSpark)
    .RemoveTag(Self, Tag_Anim_Attack)
    .Halt()
    .BuildAndRegister();
```

**JSON:**
```json
{
  "storyTag": "Ability.Attack.Basic",
  "tags": { "AnimAttack": "Anim.UpperBody.Combat.Attack", "VFX_Hit": "VFX.HitSpark" },
  "steps": [
    { "op": "AddTag", "entity": "Self", "tag": "AnimAttack" },
    { "op": "WaitAnimEnd", "entity": "Self" },
    { "op": "LoadEntityProperty", "dst": "R0", "entity": "Self", "property": "AttackPower" },
    { "op": "ApplyDamage", "target": "Target", "amount": "R0" },
    { "op": "PlayVFXAttached", "entity": "Target", "tag": "VFX_Hit" },
    { "op": "RemoveTag", "entity": "Self", "tag": "AnimAttack" },
    { "op": "Halt" }
  ]
}
```

### Pattern 2: 투사체 스킬 (Spawn + Collision)

**C++:**
```cpp
Story(Story_Fireball)
    .AddTag(Self, Tag_Cast)
    .WaitSeconds(1.0f)
    .SpawnEntity(Entity_Projectile)
    .GetPosition(R0, Self)
    .SetPosition(Spawned, R0)
    .MoveForward(Spawned, 500)
    .WaitCollision(Spawned)
    .GetPosition(R3, Spawned)
    .DestroyEntity(Spawned)
    .ApplyDamageConst(Hit, 100)
    .ForEachInRadius(Hit, 300)
        .Move(Target, Iter)
        .ApplyDamageConst(Target, 50)
        .ApplyEffect(Target, Effect_Burn)
    .EndForEach()
    .RemoveTag(Self, Tag_Cast)
    .Halt()
    .BuildAndRegister();
```

**JSON:**
```json
{
  "storyTag": "Ability.Skill.Fireball",
  "tags": {
    "Proj": "Entity.Projectile.Fireball",
    "Cast": "Anim.UpperBody.Cast.Fireball",
    "Burn": "Effect.Burn"
  },
  "steps": [
    { "op": "AddTag", "entity": "Self", "tag": "Cast" },
    { "op": "WaitSeconds", "seconds": 1.0 },
    { "op": "SpawnEntity", "classTag": "Proj" },
    { "op": "GetPosition", "dst": "R0", "entity": "Self" },
    { "op": "SetPosition", "entity": "Spawned", "src": "R0" },
    { "op": "MoveForward", "entity": "Spawned", "force": 500 },
    { "op": "WaitCollision", "entity": "Spawned" },
    { "op": "GetPosition", "dst": "R3", "entity": "Spawned" },
    { "op": "DestroyEntity", "entity": "Spawned" },
    { "op": "ApplyDamageConst", "target": "Hit", "amount": 100 },
    { "op": "ForEachInRadius", "center": "Hit", "radius": 300 },
    { "op": "Move", "dst": "Target", "src": "Iter" },
    { "op": "ApplyDamageConst", "target": "Target", "amount": 50 },
    { "op": "ApplyEffect", "target": "Target", "effectTag": "Burn" },
    { "op": "EndForEach" },
    { "op": "RemoveTag", "entity": "Self", "tag": "Cast" },
    { "op": "Halt" }
  ]
}
```

### Pattern 3: 조건 분기 + 실패 처리

**C++:**
```cpp
Story(Event_Item_Drop)
    .SetPrecondition([](const FHktWorldState& WS, const FHktEvent& E) -> bool {
        return WS.IsValidEntity(E.SourceEntity) && WS.IsValidEntity(E.TargetEntity)
            && WS.GetProperty(E.TargetEntity, PropertyId::OwnerEntity) == E.SourceEntity;
    })
    .LoadEntityProperty(R0, Target, PropertyId::OwnerEntity)
    .CmpNe(Flag, R0, Self)
    .JumpIf(Flag, TEXT("fail"))
    // ... 로직 ...
    .Halt()
.Label(TEXT("fail"))
    .Log(TEXT("Drop failed"))
    .Fail()
.BuildAndRegister();
```

**JSON:** (Precondition은 C++ only — JSON에서는 바이트코드 내 검증으로 대체)
```json
{
  "storyTag": "Story.Event.Item.Drop",
  "steps": [
    { "op": "LoadEntityProperty", "dst": "R0", "entity": "Target", "property": "OwnerEntity" },
    { "op": "CmpNe", "dst": "Flag", "src1": "R0", "src2": "Self" },
    { "op": "JumpIf", "cond": "Flag", "label": "fail" },
    { "op": "ClearOwnerUid", "entity": "Target" },
    { "op": "Halt" },
    { "op": "Label", "name": "fail" },
    { "op": "Log", "message": "Drop failed: not owner" },
    { "op": "Fail" }
  ]
}
```

### Pattern 4: 루핑 스포너 (무한 루프 + 조건)

**C++:**
```cpp
Story(Story_Spawner)
.Label(TEXT("check"))
    .HasPlayerInGroup(Flag)
    .JumpIfNot(Flag, TEXT("sleep"))
    .CountByTag(R0, Entity_NPC_Skeleton)
    .LoadConst(R1, 3)
    .CmpGe(Flag, R0, R1)
    .JumpIf(Flag, TEXT("sleep"))
    .SpawnEntity(Entity_NPC_Skeleton)
    .SaveConstEntity(Spawned, PropertyId::Health, 60)
    .SaveConstEntity(Spawned, PropertyId::MaxHealth, 60)
    .GetPosition(R3, Self)
    .SetPosition(Spawned, R3)
.Label(TEXT("sleep"))
    .WaitSeconds(5.0f)
    .Jump(TEXT("check"))
.BuildAndRegister();
```

### Pattern 5: 이동 (CancelOnDuplicate)

**C++:**
```cpp
Story(Story_MoveTo)
    .CancelOnDuplicate()
    .LoadStore(R0, PropertyId::TargetPosX)
    .LoadStore(R1, PropertyId::TargetPosY)
    .LoadStore(R2, PropertyId::TargetPosZ)
    .MoveToward(Self, R0, 150)
    .WaitMoveEnd(Self)
    .StopMovement(Self)
    .Halt()
    .BuildAndRegister();
```

**JSON:**
```json
{
  "storyTag": "Story.Event.Move.ToLocation",
  "cancelOnDuplicate": true,
  "steps": [
    { "op": "LoadStore", "dst": "R0", "property": "TargetPosX" },
    { "op": "LoadStore", "dst": "R1", "property": "TargetPosY" },
    { "op": "LoadStore", "dst": "R2", "property": "TargetPosZ" },
    { "op": "MoveToward", "entity": "Self", "targetPos": "R0", "force": 150 },
    { "op": "WaitMoveEnd", "entity": "Self" },
    { "op": "StopMovement", "entity": "Self" },
    { "op": "Halt" }
  ]
}
```

### Pattern 6: 회복 (Clamp 로직)

**C++:**
```cpp
Story(Story_Heal)
    .AddTag(Self, Tag_Cast_Heal)
    .WaitSeconds(0.8f)
    .LoadStore(R0, PropertyId::Health)
    .LoadStore(R1, PropertyId::MaxHealth)
    .LoadConst(R2, 50)
    .Add(R0, R0, R2)
    .CmpGt(R3, R0, R1)
    .JumpIfNot(R3, TEXT("NoClamp"))
    .Move(R0, R1)
.Label(TEXT("NoClamp"))
    .SaveStore(PropertyId::Health, R0)
    .RemoveTag(Self, Tag_Cast_Heal)
    .Halt()
    .BuildAndRegister();
```

## Build-Time Validation

Builder의 `Build()`/`BuildAndRegister()`는 다음을 자동 수행:
1. `Halt()` 누락 시 자동 추가
2. Label fixup 해결 (점프 대상 주소 패칭)
3. **Entity Flow Validation**: 특수 레지스터 초기화 순서 검증
   - `Self`, `Target`: 항상 유효 (Event에서 초기화)
   - `Spawned`: `SpawnEntity()` 이후 유효
   - `Hit`: `WaitCollision()` 이후 유효
   - `Iter`: `NextFound()` 이후 유효
   - 초기화 전 사용 시 빌드 실패 → 등록되지 않음

## Checklist — 새 Story 작성 시

### C++ 경로
1. `Source/HktStory/Private/Definitions/HktStory<Name>.cpp` 파일 생성
2. 고유 namespace로 감싸기: `namespace HktStory<Name> { ... }`
3. `UE_DEFINE_GAMEPLAY_TAG_COMMENT`로 Story 태그 및 필요한 태그 정의
4. 자연어 주석 블록 작성 (Flow의 동작을 자연어로 설명)
5. `HKT_REGISTER_STORY_BODY()` 내에서 `using namespace Reg;` 선언
6. `Story(Tag)` → builder chain → `.Halt()` → `.BuildAndRegister()` 패턴 사용
7. 조건 검증이 필요하면 `.SetPrecondition(lambda)` + 바이트코드 내 검증 (이중 검증)
8. 실패 경로는 `.Label(TEXT("fail"))` → `.Fail()`로 처리
9. R9(Temp)는 직접 사용하지 않기
10. `ApplyDamage` 사용 시 R7-R8에 중요값 보관하지 않기
11. Position 연산은 연속 3레지스터 (R0-R2 또는 R3-R5) 사용
12. 필요한 include 추가 (Precondition 사용 시 `HktWorldState.h`, `HktCoreEvents.h` 추가)

### JSON 경로
1. `storyTag` 필드 필수 — GameplayTag 네이밍 규칙 준수
2. 참조 태그는 `tags` 맵에 alias 정의 (자동 등록됨)
3. 각 step의 `"op"` 필드는 Builder API Reference의 JSON op 이름과 동일
4. 파라미터 필드명은 Builder API Reference 테이블의 파라미터 열 참조
5. `Halt` 또는 `Fail`로 종료 (누락 시 자동 추가)
6. `SetPrecondition`은 C++ only — JSON에서는 바이트코드 내 검증으로 대체

### 새 Operation 추가 시 (개발자)
1. `HktStoryBuilder.h`에 메서드 선언
2. `HktStoryBuilder.cpp`에 구현
3. `HktStoryOpRegistry.cpp`의 `RegisterBuiltinOps()`에 등록:
   ```cpp
   Register({
       TEXT("NewOpName"), TEXT("category"),
       { PReg(TEXT("entity")), PInt(TEXT("amount")) },
       [](FHktStoryBuilder& B, const auto& Args) {
           B.NewOpName(ARG_REG("entity"), ARG_INT("amount"));
       }
   });
   ```
4. 이 skill.md의 Builder API Reference 테이블에 행 추가
5. HktStoryGenerator 코드 변경 **불필요**
