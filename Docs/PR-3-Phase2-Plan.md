# PR-3 Phase 2 작업 계획 — Agent 위임용

> 본 문서는 PR-3 strangler-fig 마이그레이션의 Phase 2 작업을 다른 Claude agent 가
> 자기-완결적으로 수행할 수 있도록 작성된 위임 명세이다. 각 PR (2a/2b/2c/2d) 은
> 별도 세션에서 의뢰 가능하며, 의존 순서는 2a → 2b → 2c → 2d.

## 공통 컨텍스트

### 작업 위치
`E:\WS\UE5\HktProto\Plugins\HktFramework`

### 배경
PR-3 는 cpp Story 와 schema 2 JSON Story 의 strangler-fig 병행 운영을 구축한다:

- **cpp 32개 Story** (`HktGameplay/Source/HktStory/Private/Definitions/*.cpp`) — 본문 무수정으로 그대로 등록
- **새 schema 2 JSON Story** — `Story.V2.{원본}` prefix tag 로 별도 등록
- 두 program 이 충돌 없이 공존. gameplay 는 dispatch 시 어느 tag 를 쓸지 선택

검증: UE Automation 테스트 (`HktStoryV2EquivalenceTest.cpp`, `IMPLEMENT_SIMPLE_AUTOMATION_TEST`).
`FHktAutomationTestHarness` (`HktGameplayDeveloper/Source/HktAutomationTests/Public/HktAutomationTestsHarness.h`) 로
cpp/V2 program 을 각각 `ExecuteProgram` 한 뒤 `GetProperty` 결과를 비교한다.
**byte-identical 비교는 폐기** — 의미 등가성만 검증.

### 사전 결정 (모든 단계에 적용)
1. tag 컨벤션: `Story.V2.{원본cpp의 storyTag}`
2. cpp Story 본문 무수정. VM (`HktCore/Private/VM/`) / 인스트럭션 인코딩 무수정
3. 스니펫 *구현* cpp (`HktSnippetCombat.cpp`, `HktSnippetItem.cpp`, `HktSnippetNPC.cpp`) 본문 무수정.
   *JSON 노출* cpp (`HktStory/Private/HktSnippetJsonCommands.cpp`) 는 핸들러 추가 허용
4. 빌드 명령 실행 금지 (Editor 가 열려 있음 — 사용자가 hot reload 로 검증)
5. 코드 주석은 한국어
6. ini 갱신: `Config/Tags/HktStoryTags.ini` 에 V2 tag 추가 (Editor 재시작 후 GameplayTag 등록)

### 절대 금지
- VM 변경 (`HktCore/Private/VM/`)
- 인스트럭션 인코딩 변경 (`FInstruction`)
- cpp Story 본문 변경 (`HKT_REGISTER_STORY_BODY()` 안)
- 스니펫 구현 cpp 본문 변경
- 빌드 명령 (`Build.bat`, `msbuild`, `UnrealBuildTool` 어떤 형태로든)

### 진행 방식
- TodoWrite 로 진척 추적
- 막히면 (특히 schema 2 표현 불가, 의미 모호, builder API 부재) 즉시 멈추고 보고
- 추측해서 진행하지 말 것

### 기 진행 산출물 (참고)
- `HktGameplay/Content/Stories/SCHEMA.md` — schema 2 op 카탈로그 (참조용, 부족분이 본 작업의 입력)
- `HktGameplay/Content/Stories/Combat/Fireball.json` — schema 2 V2 (v1 폴백 register 문자열 잔존, Phase 2a 의 B 단계에서 정리)
- `HktGameplay/Content/Stories/Movement/MoveStop.json` — schema 2 V2 (`StopMovement` v2 핸들러 부재로 등록 실패 의심)
- `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktStoryV2EquivalenceTest.cpp` — UE Automation 케이스 1개 (MoveStop)
- `Config/Tags/HktStoryTags.ini` — `Story.V2.Event.Skill.Fireball`, `Story.V2.Event.Move.Stop` 등록됨

---

## PR-3-Phase2a — schema 2 핸들러 보강 + 메타 키

가장 큰 unblocker. 이 단계 완료가 후속 80% 를 푼다.

### 입력 정독
- `HktGameplay/Source/HktCore/Public/HktStoryJsonParser.h`
- `HktGameplay/Source/HktCore/Private/HktStoryJsonParser.cpp` — 특히 `InitializeCoreCommandsV2` 함수 (1043-1152행 근처)
- `HktGameplay/Source/HktCore/Public/HktStoryBuilder.h` — FHktVar 오버로드 메서드 시그니처 카탈로그
- `HktGameplay/Source/HktStory/Private/HktSnippetJsonCommands.cpp` — 기존 `RegisterCommandV2` 패턴 참조

### 작업 A — 누락 v2 핸들러 등록

`HktStoryJsonParser.cpp::InitializeCoreCommandsV2` 에 다음 op 들의 v2 핸들러를 `RegisterCommandV2` 로 추가한다.
각각의 builder API (FHktVar 오버로드) 는 `HktStoryBuilder.h` 에 이미 존재한다 (Phase 2a 가 아니라 builder 작업이 아닌 *파서 매핑* 작업이다).

| OpName | Builder 메서드 시그니처 (예상) | JSON 형식 |
|---|---|---|
| `GetPosition` | `FHktVarBlock GetPosition(FHktVar Entity)` | `{"op":"GetPosition","entity":...,"out":"posBlockName"}` (out 은 NewVarBlock 으로 명명) |
| `SetPosition` | `SetPosition(FHktVar, FHktVarBlock)` | `{"op":"SetPosition","entity":...,"pos":{"block":"name"}}` |
| `MoveToward` | `MoveToward(FHktVar, FHktVarBlock, int32)` | `{"op":"MoveToward","entity":...,"targetPos":{"block":"name"},"force":N}` |
| `PlayVFX` | `PlayVFX(FHktVarBlock, FGameplayTag)` | `{"op":"PlayVFX","pos":{"block":"name"},"tag":"..."}` |
| `PlaySoundAtLocation` | `PlaySoundAtLocation(FHktVarBlock, FGameplayTag)` | `{"op":"PlaySoundAtLocation","pos":{"block":"name"},"tag":"..."}` |
| `GetDistance` | `GetDistance(FHktVar, FHktVar, FHktVar)` | `{"op":"GetDistance","dst":...,"entity1":...,"entity2":...}` |
| `IfHasTrait` | `IfHasTrait(FHktVar, FHktTrait*)` | `{"op":"IfHasTrait","entity":...,"trait":"Hittable"}` |
| `CheckTrait` | 동일 | 동일 |
| `CountByTag` | `CountByTag(FHktVar Dst, FGameplayTag)` | `{"op":"CountByTag","dst":...,"tag":"..."}` |
| `CountByOwner` | `CountByOwner(FHktVar Dst, FHktVar Owner, FGameplayTag)` | `{"op":"CountByOwner","dst":...,"owner":...,"tag":"..."}` |
| `FindByOwner` | `FindByOwner(FHktVar Dst, FHktVar Owner, FGameplayTag, int32 FailLabel)` | `{"op":"FindByOwner","dst":...,"owner":...,"tag":"...","failLabel":"name"}` |
| `SetOwnerUid` | `SetOwnerUid(FHktVar Entity, FHktVar OwnerEntity)` | `{"op":"SetOwnerUid","entity":...,"owner":...}` |
| `ClearOwnerUid` | 동일 | `{"op":"ClearOwnerUid","entity":...}` |
| `GetWorldTime` | `GetWorldTime(FHktVar Dst)` | `{"op":"GetWorldTime","dst":...}` |
| `RandomInt` | `RandomInt(FHktVar Dst, int32 Min, int32 Max)` | `{"op":"RandomInt","dst":...,"min":N,"max":N}` |
| `HasPlayerInGroup` | (시그니처 정독 후 확인) | (정독 후 결정) |
| `ForEachInRadius` / `EndForEach` | `ForEachInRadius(FHktVar Center, int32 RadiusCm)` | `{"op":"ForEachInRadius","center":...,"radius":N}` ... `{"op":"EndForEach"}` |
| `NextFound` | (Iter 진행) | `{"op":"NextFound"}` (인자 없음) |
| `FindInRadius` / `FindInRadiusEx` | (정독 후 확인) | 동일 |
| `SetStance` | `SetStance(FHktVar Entity, FGameplayTag)` | `{"op":"SetStance","entity":...,"stanceTag":"..."}` |
| `SetItemSkillTag` | `SetItemSkillTag(FHktVar Entity, FGameplayTag)` | `{"op":"SetItemSkillTag","entity":...,"skillTag":"..."}` |
| `RemoveEffect` | `RemoveEffect(FHktVar Target, FGameplayTag)` | `{"op":"RemoveEffect","target":...,"effectTag":"..."}` |
| `LookAt` | (정독) | (정독) |
| `WaitAnimEnd` | `WaitAnimEnd(FHktVar Entity, FGameplayTag)` | `{"op":"WaitAnimEnd","entity":...,"animTag":"..."}` |
| `WaitMoveEnd` | `WaitMoveEnd(FHktVar Entity)` | `{"op":"WaitMoveEnd","entity":...}` |
| `WaitGrounded` | `WaitGrounded(FHktVar Entity)` | `{"op":"WaitGrounded","entity":...}` |
| `DispatchEventTo` | `DispatchEventTo(FGameplayTag, FHktVar Target)` | `{"op":"DispatchEventTo","eventTag":"...","target":...}` |
| `DispatchEventFrom` | `DispatchEventFrom(FGameplayTag, FHktVar Source)` | `{"op":"DispatchEventFrom","eventTag":"...","source":...}` |
| `ApplyJump` | (정독) | (정독) |
| `If` / `IfNot` / `Else` / `EndIf` | `If(FHktVar Cond)` / `IfNot(FHktVar Cond)` 존재 | `{"op":"If","cond":...}` ... `{"op":"Else"}` ... `{"op":"EndIf"}` |
| `JumpIf` / `JumpIfNot` | FHktVar 변형 | `{"op":"JumpIf","cond":...,"label":"name"}` |
| `WaitCollision` | `FHktVar WaitCollision(FHktVar Watch)` (반환값 = Hit) | `{"op":"WaitCollision","entity":...,"out":"hitVarName"}` (반환을 명시 var 로) |
| `StopMovement` | `StopMovement(FHktVar Entity)` | `{"op":"StopMovement","entity":...}` (Phase 2a 에서 등록 — 이거 부재가 MoveStop.json 미등록 원인) |

**작업 절차**:
1. `HktStoryBuilder.h` 정독 — 표의 builder 시그니처 확정 (예상치와 다르면 실제 시그니처에 맞춤)
2. `HktStoryJsonParser.cpp::InitializeCoreCommandsV2` 에 각 핸들러 등록
3. 기존 `RegisterCommandV2` 호출들의 패턴 그대로 복제 (`A.GetVar(B, ...)`, `A.GetVarBlock(B, ..., 3)`, `A.GetTag(...)`, `A.GetInt(...)`, `B.ResolveLabel(...)` 등)
4. 등록 키는 cpp Story 본문에서 사용되는 정확한 메서드명과 일치해야 한다 (대소문자 포함). 사용자가 작성한 schema 1 legacy JSON 7개 (`Content/Stories/Story_*.json`) 의 op 키도 참조

### 작업 B — 메타 키 `flowMode` 추가

`HktStoryJsonParser.cpp::ParseAndBuild` (또는 메타 파싱 위치) 에서 JSON 의 `"flowMode"` 키를 인식하고 `Builder.SetFlowMode(FName)` 호출. 4개 ItemSpawner cpp 가 사용 (`HktStory/Private/Definitions/HktStoryItemSpawner*.cpp` 참조).

다른 메타 키 (`cancelOnDuplicate`, `archetype`, `requiresTrait`, `precondition`) 도 schema 2 에서 모두 인식되는지 확인. 부재 시 추가.

### 작업 C — Fireball.json / MoveStop.json 정리

A 완료 후 두 JSON 의 v1 폴백 register 문자열을 명명 var 로 재작성:

**MoveStop.json** — `cancelOnDuplicate` + `StopMovement` 만으로 단순. v2 핸들러 등록 후 그대로 동작해야 함. JSON 본문 변경 불요. 등록 실패가 해소되면 OK.

**Fireball.json** — 다음 라인 정리:
- line 30: `Move dst:{var:hitTarget} src:"Hit"` → `WaitCollision` 의 명시 반환 형태로. 즉 line 29 의 `WaitCollision` 에 `out: "hitVarName"` 추가하고 line 30 은 그 var 를 hitTarget 에 Move
- line 34: `GetPosition dst:"R0" entity:"Spawned"` → `{"op":"GetPosition","entity":{"var":"fireball"},"out":"explosionPos"}` (block out)
- line 36 이후: fireball var 는 DestroyEntity 후 무효 — 그 전에 GetPosition 으로 위치 추출 필요. 순서 유지
- line 43-44: `pos:"R0"` → `{"block":"explosionPos"}`
- line 50: `Move dst:{target:true} src:"Iter"` → `Iter` 를 명시 var 로 반환받는 형태가 ForEach v2 에 있는지 확인. 없으면 ForEachInRadius 의 묵시 출력으로 유지하되, schema 2 에서 `{"iter":"iterVarName"}` 같은 명시 매핑 추가

### 검증 (Phase 2a 완료 기준)
사용자가 hot reload 후 Session Frontend 에서 `HktCore.Story.V2.MoveStop.Equivalent` 자동화 테스트가 PASS 되어야 한다. PASS 시 Phase 2a 완료.

### 보고 형식 (한국어)
1. 작업 A — 추가된 v2 핸들러 카탈로그 (op명 ↔ JSON 키 ↔ builder 메서드)
2. 작업 B — flowMode 및 다른 메타 키 처리 요약
3. 작업 C — Fireball.json/MoveStop.json diff
4. 검증 안내 — `HktCore.Story.V2.MoveStop.Equivalent` 실행 요청

---

## PR-3-Phase2b — Wait 없는 12개 cpp → V2 JSON + automation test

### 전제
PR-3-Phase2a 완료 (모든 v2 핸들러 + flowMode 등록). MoveStop.V2 자동화 테스트 PASS 확인.

### 대상 cpp (12개)
- MoveStop ✓ (Phase 2a 에서 검증됨)
- MoveForward, Jump
- ItemDrop, ItemActivate, ItemDeactivate, ItemPickup, ItemTrade
- PlayerInWorld, TargetDefault
- VoxelBreak, VoxelCrumble, VoxelCrack

### 작업 (각 cpp 별)
1. `HktStory/Private/Definitions/HktStory{Name}.cpp` 본문 정독 — op 시퀀스 추출
2. `Content/Stories/{Category}/{Name}.json` 작성 (schema 2)
   - Category 매핑:
     - Movement: MoveForward, Jump
     - Item: ItemDrop, ItemActivate, ItemDeactivate, ItemPickup, ItemTrade
     - Lifecycle: PlayerInWorld, TargetDefault
     - Voxel: VoxelBreak, VoxelCrumble, VoxelCrack
   - storyTag: `Story.V2.{원본cpp의 storyTag}`
3. `Config/Tags/HktStoryTags.ini` 에 V2 tag 추가
4. `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktStoryV2EquivalenceTest.cpp` 에 `FHktStoryV2_{Name}_Equivalent` UE Automation 케이스 추가
   - 패턴: 기존 MoveStop 케이스 (`HktStoryV2EquivalenceTest.cpp`) 참조
   - 입력 prop 셋업 → ExecuteProgram(cpp, MaxFrames=500) → ExecuteProgram(V2) → property 비교
   - 의미 있는 prop 만 비교 (cpp 본문에서 SaveStore/SaveConstEntity 한 prop 들)

### 절대 금지
- precondition 람다가 있는 cpp 는 본 단계에서 변환하지 않음 — Phase 2d 로 이관 (해당 cpp: ItemActivate, ItemDeactivate, ItemDrop, ItemPickup, ItemTrade — 이 5개는 Phase 2b 에서 본문은 변환하되 precondition 검증은 skip).

### 보고
- 변환 완료 cpp 목록 + 각 V2 JSON 경로
- 추가된 자동화 테스트 케이스 목록
- ini diff
- 검증 안내 — `HktCore.Story.V2.*` 일괄 실행

---

## PR-3-Phase2c — Harness 확장 + Wait 있는 14개 cpp

### 전제
Phase 2b 완료. Wait 없는 12개 모두 PASS.

### 작업 A — Harness 확장
`HktGameplayDeveloper/Source/HktAutomationTests/Public/HktAutomationTestsHarness.h` + `Private/HktAutomationTestsHarness.cpp` 에 다음 메서드 추가:

```cpp
// VM 이 Wait* op 에 도달할 때까지 진행. wait 타입 반환.
EVMStatus ExecuteUntilWait(const FHktVMProgram* P, FHktEntityId Self, FHktEntityId Target,
                           int32 MaxFrames, EHktWaitKind& OutWaitKind);

// Wait 를 외부 이벤트로 해소하고 계속 진행.
void InjectCollisionEvent(FHktEntityId Watcher, FHktEntityId Hit);
void InjectMoveEndEvent(FHktEntityId Entity);
void InjectAnimEndEvent(FHktEntityId Entity, FGameplayTag AnimTag);
void InjectGroundedEvent(FHktEntityId Entity);

// Wait 해소 후 또는 일반 진행 - Halt 또는 Failed 까지.
EVMStatus ResumeUntilDone(int32 MaxFrames);
```

`ExecuteProgram` 의 기존 구현 (`HktAutomationTestsHarness.cpp` 55-127 행) 을 정독해 wait 처리 로직을 분리/노출.

### 작업 B — 14개 cpp 변환

대상: BasicAttack, Buff, CharacterSpawn, Heal, Lightning, NPCLifecycle, DebrisLifecycle,
NPCSpawnerGoblinCamp, NPCSpawnerProximity, NPCSpawnerWave,
ItemSpawnerAncientStaff, ItemSpawnerBandage, ItemSpawnerThunderHammer, ItemSpawnerTreeDrop, ItemSpawnerWingsOfFreedom,
MoveTo, VoxelShatter, Fireball ✓(Phase 2a 에서 정리됨)

(NPCSpawner/ItemSpawner 는 무한 루프 — 동등성 검증 시 N틱 후 비교 또는 SpawnerLoopBegin/End 의 한 사이클만 비교)

각 cpp 에 대해 Phase 2b 와 동일 4단계. 추가로:
- `ExecuteUntilWait` → `Inject*` → `ResumeUntilDone` 으로 wait 처리
- 입력에 Hit 대상 entity, Move 대상 위치 등 시뮬레이션 의도에 맞게 셋업

CombatUseSkill 은 precondition 람다 + 동적 dispatch 가 있어 Phase 2d 까지 미루는 것을 권장.

### 보고
- Harness 확장 diff
- 14개 V2 JSON + 자동화 테스트
- skip 한 cpp + 사유

---

## PR-3-Phase2d — Precondition 람다 6개 cpp 검토

### 전제
Phase 2c 완료. Wait 있는 14개 모두 PASS.

### 대상 cpp (6개)
- `HktStoryCombatUseSkill.cpp:89` (cooldown 단발 검사)
- `HktStoryItemActivate.cpp:48`
- `HktStoryItemDeactivate.cpp:48`
- `HktStoryItemDrop.cpp:40`
- `HktStoryItemPickup.cpp:45`
- `HktStoryItemTrade.cpp:46`

### 작업
각 cpp 의 `SetPrecondition([](WS, E){ ... })` 람다 본문을 정독:

- **단순 (op 시퀀스로 표현 가능)**: schema 2 의 `precondition` 배열에 read-only op 시퀀스 (LoadStoreEntity/Cmp/Result) 로 변환
- **복잡 (임의 C++ 로직 의존)**: 변환 skip 하고 V2 JSON 에 precondition 생략. 동등성 테스트에서 precondition 항목 제외 (cpp 만 precondition 검증, V2 는 본문만 비교)

각 cpp 별 결정 (변환/skip) 을 보고에 명시.

### 작업 산출물
- 6개 cpp 의 V2 JSON (precondition 변환 또는 생략)
- 자동화 테스트 케이스
- 변환 불가 사유 (skip 한 경우)

### 보고
- 6개 cpp 의 변환 결과 (변환/skip)
- 각 skip 의 사유 (구체적 람다 본문 인용)
- 자동화 테스트 추가
- 최종: 32개 cpp 모두에 대해 V2 변환 상태 (완료/skip/미해결) 표

---

## 부록 — 현재 알려진 위험과 결정

### `Hit`/`Iter`/`Spawned` 묵시 reg
cpp 의 `WaitCollision` 후 `Hit`, `ForEachInRadius` 후 `Iter`, `SpawnEntity` 후 `Spawned` 는
**분기/스니펫 호출 직전에 즉시 명명 var 로 옮길 것**. 이유: 분기 합류점 또는 스니펫 내부 라벨에서
묵시 reg 가 무효화된다 (cpp `FHktStoryBuilder` 가 빌드 타임에 검증).

### Schema 2 표현 불가 — 임의 람다
`SetPrecondition([](WS, E){ ... })` 의 임의 C++ 로직은 schema 2 JSON 으로 변환 불가.
6개 cpp 가 영향받는다 (Phase 2d 참조).

### `UHktStoryEditorLibrary::RegenerateStoryTagsAndReload`
ini 갱신 자동화 도구. V2 tag 가 늘어나면 사용자가 한 번 호출하여 일괄 등록 가능.
다만 본 작업에서는 각 단계 종료 시 ini 직접 추가 권장 (도구 의존 줄이기).

### 위치 정리
- `Content/Stories/Combat/` — Fireball, Heal, Lightning, BasicAttack, Buff, CombatUseSkill
- `Content/Stories/Item/` — ItemDrop, Activate, Deactivate, Pickup, Trade
- `Content/Stories/Item/Spawners/` — AncientStaff, Bandage, ThunderHammer, TreeDrop, WingsOfFreedom
- `Content/Stories/NPC/` — NPCLifecycle, DebrisLifecycle
- `Content/Stories/NPC/Spawners/` — GoblinCamp, Proximity, Wave
- `Content/Stories/Movement/` — MoveStop, MoveForward, MoveTo, Jump
- `Content/Stories/Voxel/` — Break, Crack, Crumble, Shatter
- `Content/Stories/Lifecycle/` — CharacterSpawn, PlayerInWorld, TargetDefault

### 가장 큰 unblocker
**Phase 2a** — 다른 모든 단계가 schema 2 핸들러에 의존. 한 번 Phase 2a 가 끝나면 Phase 2b/c 는 기계적 변환.
