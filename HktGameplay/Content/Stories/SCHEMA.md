# HktStory JSON Schema

이 문서는 `HktStoryJsonParser` 가 인식하는 JSON Story 의 전체 스키마를 기술한다.
정의 진실원(source of truth):

- `HktGameplay/Source/HktCore/Public/HktStoryJsonParser.h`
- `HktGameplay/Source/HktCore/Private/HktStoryJsonParser.cpp`
- `HktGameplay/Source/HktStory/Private/HktSnippetJsonCommands.cpp` (V2 스니펫 카탈로그)
- `HktGameplay/Source/HktCore/Public/HktStoryBuilder.h` (Fluent API)

---

## 1. 최상위 메타 필드

파서가 인식하는 키만 나열한다. 그 외 키는 무시된다.

| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `schema` | int (1\|2) | 선택, 기본 1 | `2` 면 `FHktVar` VarRef API 가 우선 디스패치된다. |
| `storyTag` | string | 필수 | 등록될 GameplayTag (예: `"Story.Event.Skill.Fireball"`). 빈 문자열 금지. |
| `archetype` | string | 선택 | `FHktArchetypeRegistry::FindByName` 으로 해석. 미지의 값은 경고. |
| `cancelOnDuplicate` | bool | 선택 | `true` 면 `Builder.CancelOnDuplicate()` — 같은 엔티티의 동일 EventTag VM 이 이미 있으면 기존을 취소. |
| `tags` | object | 선택 | `{ "alias": "Real.Tag.Path" }` 별칭 맵. step 의 모든 GameplayTag 인자에서 alias 우선 lookup. |
| `preconditions` | array | 선택 | 읽기 전용 op (FHktStoryJsonParser::IsReadOnlyOp 참조) 만 허용. 위반 시 에러. |
| `steps` | array | 필수 | 본 스토리 시퀀스. |

> **주의**: `tag`, `requiresTrait`, `precondition` (단수형), `body`, `flowMode` 같은 키는 **현재 파서가 인식하지 않는다**. 메타 단계에서는 위 표만 유효하다 (단수 `precondition` 키 입력 시 무시됨 — 항상 `preconditions` 배열을 사용할 것).

---

## 2. VarRef 4종 (schema 2 전용)

`FHktStoryCmdArgs::GetVar(B, Key)` 가 처리하는 4가지 변수 참조 형태:

```jsonc
// (1) named var — 같은 빌더 내에서 같은 이름은 같은 VReg 로 해석
{"var": "hitTarget"}

// (2) self — FHktStoryBuilder::Self()
{"self": true}

// (3) target — FHktStoryBuilder::Target()
{"target": true}

// (4) const — 새 anonymous VReg + LoadConst(N) 자동 emit
{"const": 100}
```

추가:

```jsonc
// 블록 인덱싱 — 매 호출마다 size-3 블록을 새로 발급한 뒤 i 번째 슬롯의 FHktVar 반환.
// 같은 이름으로 반복 호출하더라도 동일 블록을 재사용하지 않는다 (PR-3 에서 NamedBlockMap 도입 예정).
{"block": "explosionPos", "index": 0}
```

블록 인자 (`pos` 등) 는 별도로 `GetVarBlock(B, Key, Count)` 를 사용:

```jsonc
{"block": "explosionPos"}   // count 는 핸들러가 결정 (예: 3)
```

### Schema 1 호환 문자열 (deprecated)

값이 객체가 아닌 문자열이면 `ParseRegister` 로 폴백. `"Self"`, `"Target"`, `"Spawned"`, `"Hit"`, `"Iter"`, `"Flag"`, `"Count"`, `"Temp"`, `"R0".."R9"` 인식. R0..R9 는 `__pre_R{N}` 명명 변수로 매핑된다.

---

## 3. Op 카탈로그 (schema 1 + 공통)

각 항목 형식: `OpName` — 빌더 메서드 — JSON 인자.

V2 (schema 2) 컬럼이 비어있으면 v1 핸들러로 폴백한다 (인자 형태 동일하지만 레지스터 인자가 VarRef 객체로 바뀐다).

### 3.1 제어 흐름 (Control Flow)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `Label` | `Label` | `name: string` | (공통) |
| `Jump` | `Jump` | `label: string` | (공통) |
| `JumpIf` | `JumpIf` | `cond`, `label: string` | (공통) — v2: `cond` VarRef |
| `JumpIfNot` | `JumpIfNot` | `cond`, `label: string` | (공통) |
| `Yield` | `Yield` | `frames: int`(opt, default 1) | (공통) |
| `WaitSeconds` | `WaitSeconds` | `seconds: float`(opt, 1.0) | (공통) |
| `Halt` | `Halt` | (없음) | (공통) |
| `Fail` | `Fail` | (없음) | (공통) |
| `If` | `If` | `cond` | v2: VarRef |
| `IfNot` | `IfNot` | `cond` | v2: VarRef |
| `Else` | `Else` | (없음) | (공통) |
| `EndIf` | `EndIf` | (없음) | (공통) |
| `IfEq`/`IfNe`/`IfLt`/`IfLe`/`IfGt`/`IfGe` | 동일 | `a`, `b` | v1만 |
| `IfEqConst`/`IfNeConst`/`IfLtConst`/`IfLeConst`/`IfGtConst`/`IfGeConst` | 동일 | `src`, `value: int` | v1만 |
| `IfPropertyEq/Ne/Lt/Le/Gt/Ge` | 동일 | `entity`, `property: string`, `value: int` | v1만 |
| `Repeat` | `Repeat` | `count: int` | (공통) |
| `EndRepeat` | `EndRepeat` | (없음) | (공통) |

### 3.2 이벤트 대기 (Wait)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `WaitCollision` | `WaitCollision` | `entity` (opt, default Spawned) | v2: VarRef 필수 |
| `WaitAnimEnd` | `WaitAnimEnd` | `entity` (opt, Self) | v1만 |
| `WaitMoveEnd` | `WaitMoveEnd` | `entity` (opt, Self) | v1만 |
| `WaitUntilCountZero` | `WaitUntilCountZero` | `tag: string`, `interval: float`(opt 2.0) | (공통) |

### 3.3 데이터 (Data)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `LoadConst` | `LoadConst` | `dst`, `value: int` | v2: VarRef dst |
| `LoadStore` | `LoadStore` | `dst`, `property: string` | v2: VarRef dst |
| `LoadStoreEntity` | `LoadStoreEntity` | `dst`, `entity`, `property` | v2: VarRef |
| `LoadEntityProperty` | `LoadEntityProperty` | `dst`, `entity`, `property` | v1만 |
| `SaveStore` | `SaveStore` | `property`, `src` | v2: VarRef src |
| `SaveStoreEntity` (v2 전용) | `SaveStoreEntity` | `entity`, `property`, `src` | v2 |
| `SaveEntityProperty` | `SaveEntityProperty` | `entity`, `property`, `src` | v1만 |
| `SaveConst` | `SaveConst` | `property`, `value: int` | (공통) |
| `SaveConstEntity` | `SaveConstEntity` | `entity`, `property`, `value: int` | v2: VarRef |
| `Move` | `Move` | `dst`, `src` | v2: VarRef |
| `ReadProperty` | `ReadProperty` | `dst`, `property` | v1만 |
| `WriteProperty` | `WriteProperty` | `property`, `src` | v1만 |
| `WriteConst` | `WriteConst` | `property`, `value: int` | (공통) |

### 3.4 산술 / 비교

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `Add`/`Sub`/`Mul`/`Div` | 동일 | `dst`, `src1`, `src2` | v2: VarRef |
| `AddImm` | `AddImm` | `dst`, `src`, `imm: int` | v1만 |
| `CmpEq`/`CmpNe`/`CmpLt`/`CmpLe`/`CmpGt`/`CmpGe` | 동일 | `dst`, `src1`, `src2` | v2 (Eq/Ne/Lt만, 그외 v1 폴백) |
| `CmpEqConst`/...`CmpGeConst` | 동일 | `dst`, `src`, `value: int` | v1만 |

### 3.5 엔티티

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `SpawnEntity` | `SpawnEntity` (v1) / `SpawnEntityVar`(v2) | `classTag: string`, v2: 선택적 `out: string` 으로 결과를 named var 에 바인딩 | v2 별도 |
| `DestroyEntity` | `DestroyEntity` | `entity` | v2: VarRef |

### 3.6 위치 / 이동 (Position & Movement)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `GetPosition` | `GetPosition` | `dst`, `entity` | v1만 (v2 는 builder API 가 FHktVarBlock 을 반환하므로 별도 op 필요) |
| `SetPosition` | `SetPosition` | `entity`, `src` | v1만 |
| `MoveToward` | `MoveToward` | `entity`, `targetPos`, `force: int` | v1만 |
| `MoveForward` | `MoveForward` | `entity`, `force: int` | v2: VarRef |
| `StopMovement` | `StopMovement` | `entity` | v2: VarRef |
| `GetDistance` | `GetDistance` | `dst`, `entity1`, `entity2` | v1만 |
| `LookAt` | `LookAt` | `entity`, `target` | v1만 |
| `CopyPosition` | `CopyPosition` | `dst`, `src` | v2: VarRef |
| `MoveTowardProperty` | `MoveTowardProperty` | `entity`, `baseProp`, `force: int` | v1만 |

### 3.7 공간 질의 (Spatial Query)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `FindInRadius` | `FindInRadius` | `center`, `radius: int` | v1만 |
| `NextFound` | `NextFound` | (없음) | v1만 |
| `ForEachInRadius` | `ForEachInRadius` (Begin) | `center`, `radius: int` | v1만 (구조적 제어흐름) |
| `FindInRadiusEx` | `FindInRadiusEx` | `center`, `radius`, `filter: int` | v1만 |
| `ForEachInRadiusEx` | `ForEachInRadiusEx` | `center`, `radius`, `filter: int` | v1만 |
| `EndForEach` | `EndForEach` | (없음) | (공통) |
| `InteractTerrain` | `InteractTerrain` | `center` (opt Self), `radius: int` | v1만 |

### 3.8 전투 (Combat)

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `ApplyDamage` | `ApplyDamage` | `target`, `amount` | v2: VarRef |
| `ApplyDamageConst` | `ApplyDamageConst` | `target`, `amount: int` | v2: VarRef target |
| `ApplyEffect` | `ApplyEffect` | `target`, `effectTag: string` | v2: VarRef |
| `RemoveEffect` | `RemoveEffect` | `target`, `effectTag` | v1만 |

### 3.9 VFX / Audio

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `PlayVFX` | `PlayVFX` | `pos` (block base), `tag` | v1만 |
| `PlayVFXAttached` | `PlayVFXAttached` | `entity`, `tag` | v2: VarRef |
| `PlayVFXAtEntity` | `PlayVFXAtEntity` | `entity`, `tag` | v1만 |
| `PlaySound` | `PlaySound` | `tag` | (공통, 인자 무관) |
| `PlaySoundAtLocation` | `PlaySoundAtLocation` | `pos` (block base), `tag` | v1만 |
| `PlaySoundAtEntity` | `PlaySoundAtEntity` | `entity`, `tag` | v1만 |
| `PlayAnim` | `PlayAnim` | `entity`, `tag` | v2: VarRef |

### 3.10 태그 / 트레이트

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `AddTag` | `AddTag` | `entity`, `tag` | v2: VarRef |
| `RemoveTag` | `RemoveTag` | `entity`, `tag` | v2: VarRef |
| `HasTag` | `HasTag` | `dst`, `entity`, `tag` | v2: VarRef |
| `CheckTrait` | `CheckTrait` | `dst`, `entity`, `trait: string` | v1만 |
| `IfHasTrait` | `IfHasTrait` | `entity`, `trait: string` | v1만 |
| `CountByTag` | `CountByTag` | `dst`, `tag` | v1만 |

`trait` 허용값: `Spatial`, `Movable`, `Collidable`, `Hittable`, `Combatable`, `Animated`, `EventParam`, `Ownable`, `EquipSlots`.

### 3.11 월드 / 아이템 / 스탠스

| Op | Builder | 인자 | V2 |
|---|---|---|---|
| `GetWorldTime` | `GetWorldTime` | `dst` | v1만 |
| `RandomInt` | `RandomInt` | `dst`, `modulus` | v1만 |
| `HasPlayerInGroup` | `HasPlayerInGroup` | `dst` | v1만 |
| `CountByOwner` | `CountByOwner` | `dst`, `owner`, `tag` | v1만 |
| `FindByOwner` | `FindByOwner` | `owner`, `tag` | v1만 |
| `SetOwnerUid` | `SetOwnerUid` | `entity` | v1만 |
| `ClearOwnerUid` | `ClearOwnerUid` | `entity` | v1만 |
| `SetStance` | `SetStance` | `entity`, `stanceTag` | v1만 |
| `SetItemSkillTag` | `SetItemSkillTag` | `entity`, `skillTag` | v1만 |

### 3.12 이벤트 디스패치

| Op | Builder | 인자 |
|---|---|---|
| `DispatchEvent` | `DispatchEvent` | `eventTag` |
| `DispatchEventTo` | `DispatchEventTo` | `eventTag`, `target` |
| `DispatchEventFrom` | `DispatchEventFrom` | `eventTag`, `source` |

### 3.13 유틸리티

| Op | Builder | 인자 |
|---|---|---|
| `Log` | `Log` | `message: string` |

---

## 4. V2 스니펫 op 카탈로그 (`HktSnippetJsonCommands.cpp`)

### 4.1 Item 스니펫 (V1 + V2: 14개)

| Op | 인자 |
|---|---|
| `SnippetAssignOwnership` | `entity`, `owner` |
| `SnippetReleaseOwnership` | `entity` |
| `SnippetApplyItemStats` | `item`, `character` |
| `SnippetRemoveItemStats` | `item`, `character` |
| `SnippetLoadItemFromSlot` | `dst`, `failLabel: string` |
| `SnippetSaveItemToEquipSlot` | `slotIndex`, `value` |
| `SnippetClearEquipSlot` | `slotIndex` |
| `SnippetFindEmptyEquipSlot` | `dst`, `failLabel: string` |
| `SnippetValidateOwnership` | `entity`, `failLabel: string` |
| `SnippetValidateItemState` | `entity`, `expectedState: int`, `failLabel: string` |
| `SnippetActivateInSlot` | `item`, `slotIndex`, `character` |
| `SnippetDeactivateToBag` | `item`, `character` |
| `SnippetDropToGround` | `item`, `posSource` |
| `SnippetSpawnGroundItemAtPos` (V2 전용) | `classTag: string`, `itemId: int`(opt 0), `pos: {"block":"name"}` |

### 4.2 Combat 스니펫 (V2: 8개)

| Op | 인자 |
|---|---|
| `SnippetCooldownCheck` | `failLabel: string` |
| `SnippetCooldownUpdateConst` | `recoveryFrame: int` |
| `SnippetCooldownUpdateFromEntity` | `item` (VarRef) |
| `SnippetResourceGainClamped` | `currentProp: string`, `maxProp: string`, `amount: int` |
| `SnippetAnimTrigger` | `entity`, `animTag: string` |
| `SnippetAnimLoopStart` | `entity`, `animTag: string` |
| `SnippetAnimLoopStop` | `entity`, `animTag: string` |
| `SnippetCheckDeath` | `entity`, `deadTag: string` |

### 4.3 NPC 스니펫 (V2: 4개)

`NPCTemplate` 필드 (모두 옵션, 기본값은 cpp 의 `FHktNPCTemplate{}`): `health: int`, `attackPower: int`, `defense: int`, `maxSpeed: int`, `team: int`.

| Op | 인자 |
|---|---|
| `SnippetSetupNPCStats` | `specificTag: string`, NPCTemplate 필드 |
| `SnippetSpawnerLoopBegin` | `loopLabel: string`, `waitLabel: string`, `countTag: string`, `cap: int` |
| `SnippetSpawnerLoopEnd` | `loopLabel: string`, `waitLabel: string`, `intervalSeconds: float`(opt 1.0) |
| `SnippetSpawnNPCAtPosition` | `npcTag: string`, NPCTemplate 필드, `pos: {"block":"name"}` |

---

## 5. 라벨 / 제어흐름 권장 패턴

- 라벨이 필요한 스니펫(`failLabel`, `loopLabel`) 은 본문에서 같은 이름으로 `{"op":"Label","name":"..."}` 을 둔다.
- `If*`/`Else`/`EndIf` 는 짝을 맞춘다.
- `ForEachInRadius` 는 v1 op (구조적 begin) — `EndForEach` 로 닫는다.
- `Repeat` ↔ `EndRepeat` 짝 필수.

---

## 6. Precondition 제약

`preconditions` 배열에는 `IsReadOnlyOp` 가 `true` 인 op 만 허용된다. 위반 시 빌드 실패.
허용 카테고리 요약: 제어흐름(라벨/점프/조건/Halt/Fail), 비교, 산술, 엔티티 프로퍼티 비교(`IfPropertyXx`), `LoadConst/LoadStore/LoadEntityProperty/ReadProperty/Move`, `GetDistance`, `HasTag/CheckTrait/IfHasTrait`, `CountByTag/GetWorldTime/RandomInt/HasPlayerInGroup`, `CountByOwner`, `Log`.

부수효과 op (`SaveStore*`, `Spawn/Destroy`, `Apply*`, `Add/RemoveTag`, `Play*`, `Wait*`, `Dispatch*`, 스니펫 등) 는 사용 불가.
