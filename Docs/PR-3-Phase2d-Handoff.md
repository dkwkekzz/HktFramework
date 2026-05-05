# PR-3 Phase 2d — Story Spec 검증 시스템 설계 및 작업 리스트

> 본 문서는 Phase 2d 의 방향을 재정의한다. 이전 명세(cpp precondition 람다 분류 +
> CombatUseSkill V2 변환)는 **보류**되었다. 새 방향은 **Story 자체 검증 시스템 구축**이다.

## 배경 — 왜 방향이 바뀌었나

Phase 2a~2c 에서 cpp Story → V2 JSON 등가성 검증을 위해 `HktStoryV2EquivalenceTest.cpp`
(1268줄, 27 케이스) 가 작성되었다. 이 방식의 문제:

- **검증 대상이 잘못됨** — Equivalence 는 "cpp 와 v2 가 같은가"만 본다. 정작 중요한
  *작성자 의도 ↔ 실제 동작* 은 검증 대상이 아니다.
- **수명 한계** — cpp Story 가 제거되면 비교 대상이 사라져 자동 폐기.
- **Story 추가 시 안전망 부재** — 신규 Story 가 의도대로 흐르는지 보장 메커니즘이 없다.
  현재는 작성자가 코드 리뷰 + 인-게임 플레이로만 검증.

V1/V2 런타임 비교 결과 **VM/바이트코드/디스패치는 동일**하고 차이는 빌더 추상화
(`RegisterIndex` → `FHktVar`) 뿐이다. 따라서 V2 가동의 실체는 호출지점 retarget
4곳(`HktServerRule.cpp:84-85`, `HktClientRule.cpp:10-13` 등)이며, retarget 전에
**모든 Story 의 의미 정합성을 보장할 영구 안전망**이 필요하다.

## 검증 레이어 재설계

| 레이어 | 검증 대상 | 수명 | 우선순위 |
|---|---|---|---|
| **Story Spec** (신규) | 작성자 의도 ↔ 실제 동작 | 영구 | **1순위** |
| Op 단위 테스트 | 핸들러 정확성 (Add, Move, ApplyDamage 등) | 영구 | 선택적 보강 |
| Equivalence (기존) | cpp ↔ V2 번역 무결성 | cpp 제거 시 종료 | 마이그레이션 안전망 (유지) |

Story Spec 이 깔리면 op 핸들러 버그도 대부분 spec 에서 검출된다. op 단위 테스트는
spec 으로 커버 안 되는 기반 인프라 (예: VReg 할당기, 컨트롤플로우 엣지) 에 한해 보강.

## Story Spec 설계

### 파일 배치

```
HktGameplay/Content/Stories/
├── Combat/
│   ├── BasicAttack.json        ← Story 본문 (기존)
│   └── BasicAttack.spec.json   ← Story 시나리오 (신규)
```

`.spec.json` 미존재 시 Story 는 검증 없이 등록되며 자동화 테스트에 노출되지 않는다
(점진 도입 가능). 향후 Definition of Done 에 spec 동반 작성 포함.

### Spec 스키마 (안)

```json
{
  "storyTag": "Story.V2.Event.Attack.Basic",
  "scenarios": [
    {
      "name": "기본 타격 — 사거리 내 Hittable 적에게 데미지",
      "given": {
        "self":   { "properties": {"AttackPower": 100}, "position": [0, 0, 0] },
        "target": {
          "properties": {"Health": 500},
          "traits": ["Hittable"],
          "position": [150, 0, 0]
        }
      },
      "events": [],
      "expect": {
        "target": {
          "properties": {"Health": 400},
          "tags": ["Anim.Montage.HitReaction"]
        },
        "status": "Completed"
      }
    },
    {
      "name": "사거리 밖 적엔 데미지 없음",
      "given": {
        "self":   { "properties": {"AttackPower": 100} },
        "target": {
          "properties": {"Health": 500},
          "traits": ["Hittable"],
          "position": [500, 0, 0]
        }
      },
      "expect": { "target": { "properties": {"Health": 500} } }
    },
    {
      "name": "애니메이션 종료까지 대기",
      "given": { "...": "..." },
      "events": [
        { "advance": 30 },
        { "inject": "AnimEnd", "entity": "self" }
      ],
      "expect": {
        "self":   { "tags": [] },
        "status": "Completed"
      }
    }
  ]
}
```

### 필드 정의

**given** — 초기 `FHktWorldState` 구성
- `self` / `target` / `entities[]` — 엔티티 단위 명세
- `properties: {PropertyId 이름: 값}` — `HktCoreProperties.h` 의 PropertyId 카탈로그 기준
- `traits: [TraitTag]` — `HktCoreArchetype` 트레이트
- `tags: [GameplayTag]` — 초기 태그
- `position: [x, y, z]` — 좌표 (있을 때만)

**events** — 시간 진행 + 외부 이벤트 주입 (`HktAutomationTestsHarness` API 매핑)
- `{ "advance": N }` → `AdvanceTimerFrames(N)`
- `{ "inject": "Collision", "entity": "<ref>" }` → `InjectCollisionEvent`
- `{ "inject": "MoveEnd" }` → `InjectMoveEndEvent`
- `{ "inject": "Grounded" }` → `InjectGroundedEvent`
- `{ "inject": "AnimEnd", "entity": "<ref>" }` (신규 harness API 필요 가능)

**expect** — 종료 시점 상태 매처
- `status: "Completed" | "Failed" | "Waiting"` — VM 종료 상태
- `<entityRef>.properties.{Id}: 값` — 정확 일치
- `<entityRef>.tags: [...]` — 부분 일치 (포함 검증) 또는 `tagsExact` 로 정확 일치
- 향후 확장: `entityCount`, `<entityRef>.position`, dirty set 검증

### 런너

`FHktStorySpecRunner` — `HktAutomationTests` 모듈에 신설.

1. 부팅 시 `Content/Stories/**/*.spec.json` 스캔
2. 각 시나리오를 자동화 테스트 1개로 펼침 — 카테고리:
   `HktCore.Story.Spec.{StoryTag.정규화}.{ScenarioName.정규화}`
3. 실행:
   - `given` → `FHktWorldState` 구성 (harness `CreateEntityWithProperties` 등 활용)
   - 프로그램 로드 → `ExecuteUntilWait` 또는 `ExecuteProgram`
   - `events` 순차 처리 (advance / inject) + `ResumeUntilDone`
   - `expect` 매처 평가 → 실패 시 actual vs expected diff 출력

## Phase 2 후속 단계 정리

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 2a/2b/2c | V2 JSON 본문 작성 (32 → 36개) | ✅ 완료 (Phase 2e 에서 V2 sidecar 일괄 폐기됨 — 아래 참조) |
| **Phase 2d (재정의)** | Story Spec 시스템 인프라 + 선행 적용 | ✅ 완료 |
| **Phase 2e (재정의)** | **Story 정리 + V1 root JSON 진실원화 + Spec 작성 + REGFLOW 청소** | ✅ 완료 (PlayerInit schema 2 보류) |
| **Phase 2f (재정의)** | **precondition op-code JSON 화 + CombatUseSkill / Item* 5종 root JSON + Spec** | ✅ 완료 (PlayerInit schema 2 재시도 회귀 → 재롤백) |
| Phase 2g | 호출지점 retarget (이제 `Story.V2.*` 가 아닌 base tag 로 통일) | 자연 해소 |
| Phase 2h | cpp Story 본문 제거 (V1 root JSON 이 진실원이 된 후) | 대기 |
| Phase 2i | (Phase 2g 자연 해소로 불필요) | 폐기 |
| (별도) | PlayerInit schema 2 회귀 진단 — V2 register coloring × presentation 사이드 이펙트 | 미해결 |

## Phase 2e (재정의) — Story 정리 + V1 root JSON 진실원화

### 방향 전환 배경

Phase 2d 진입 후 사용자 결정으로 **V2 sidecar (`Stories/<Category>/*.json`) 일괄 폐기 + V1 root (`Story_*.json`) 만 유지** 방향으로 전환. 사유:
- V2 sidecar 는 cpp Story 의 등가 검증 (Equivalence test) 만이 존재 가치였는데, V2 retarget (Phase 2g) 와 cpp 제거 (Phase 2h) 가 둘 다 미진행 → 영구 가치 없음
- V1 root JSON 이 더 단순하고, 호출지가 이미 `Story.Event.*` 형식이라 retarget 불필요
- cpp Story 들은 Phase 2h 에서 한 번에 제거 — 그때까지 cpp 가 진실원, JSON 은 보강용

### 유지된 6 root JSON (트레이스 포함)

| 파일 | StoryTag | 도달 경로 |
|---|---|---|
| `Story_PlayerInit.json` | Story.State.Player.Init | (루트) |
| `Story_TargetAction.json` | Story.Event.Target.Action | (루트) — DispatchEvent → MoveTo / UseSkill / ItemPickup |
| `Story_WorldInit.json` | Story.Flow.World.Init | (루트) — DispatchEventFrom → NPCLifecycle |
| `Story_MoveTo.json` | Story.Event.Move.ToLocation | TargetAction → DispatchEvent |
| `Story_NPCLifecycle.json` | Story.Flow.NPC.Lifecycle | WorldInit → DispatchEventFrom |
| `Story_BasicAttack.json` | Story.Event.Attack.Basic | TargetAction → UseSkill (cpp) → InnateLabel → DispatchEvent |

### 작업 진행도

#### 1. JSON 정리 ✅
- [x] V2 sidecar 폴더 일괄 삭제 (Combat/Movement/Item/Lifecycle/NPC/Voxel) — `Heal.spec.json`/`MoveStop.spec.json` 포함
- [x] dead-code root 삭제: `Story_CharacterSpawn.json` (dispatch 호출지 0)
- [x] `HktStoryV2EquivalenceTest.cpp` 폐기 — V2 sidecar 사라져 비교 대상 0, 27 케이스 모두 "V2 JSON 파일 없음" 로그 폭주

#### 2. Story_BasicAttack.json cpp 등가화 ✅
- [x] `InteractTerrain(Self, 200)` 추가 (cpp 와 등가)
- [x] `IfHasTrait Iter Hittable` 필터 추가 — cpp 의 Hittable 트레이트 보유 엔티티 한정 데미지 동작과 일치

#### 3. Spec 인프라 확장 ✅
- [x] `given.event` 블록 신설 — `Context.EventParam0..3 / EventTargetPos*` (실 게임에선 이벤트 디스패치가 채움). `LoadStore Param0` 류 op 가 entity 컬럼이 아닌 Context local 을 읽는 점 spec 에서 명시 가능
- [x] `FHktSpecEventParams` 추가 (`HktStorySpecTypes.h`)
- [x] `FHktStorySpecParser::ParseGiven` 에서 `event` 키 파싱
- [x] `FHktAutomationTestHarness::SetEventParams(...)` API 신설
- [x] `FHktStorySpecAutomationTest::RunTest` — `Given.Event.bSet` 시 호출
- [x] **archetype 와이어링** — `FHktSpecEntity.Archetype` (이미 파싱됨) 가 `BuildEntity` 에서 미사용이라 `IfHasTrait Hittable` 류가 항상 false. `FHktArchetypeRegistry::FindByName` → `WorldState.SetArchetype` 추가, 미등록 이름 즉시 fail
- [x] `SPEC.md` 갱신 — 4.1 절 (event), archetype 의무 명시

#### 4. Spec 작성 (6/6) ✅
- [x] `Story_MoveTo.spec.json` — 1 시나리오 (TargetPos 이동 + MoveEnd 주입)
- [x] `Story_BasicAttack.spec.json` — 2 시나리오 (Hittable 데미지 / non-Hittable 면제)
- [x] `Story_TargetAction.spec.json` — 2 시나리오 (dispatch_move / item_pickup)
- [x] `Story_PlayerInit.spec.json` — 1 시나리오 (status only — SpawnEntity 흐름 검증 어려움)
- [x] `Story_WorldInit.spec.json` — 1 시나리오 (status only — 3 NPC 스폰)
- [x] `Story_NPCLifecycle.spec.json` — 1 시나리오 (사망 분기, RandomInt 비결정 → status only)

#### 5. V1 root → schema 2 마이그레이션 (REGFLOW 경고 청소) 🚧

**배경**: V1 schema (`"R0".."R9"` 고정 RegisterIndex) 가 빌더 내부 스니펫의 스크래치 슬롯과 충돌해 `REGFLOW R0 Dead Write / R3 Read-before-Write` 경고를 다량 발생. V2 schema 의 `FHktVar` 익명 VReg 할당기가 이를 정확히 해결하기 위한 도입이었음.

**걸림돌**: V2 schema 는 op-by-op 핸들러 디스패치 — 등록되지 않은 op 는 V1 핸들러로 폴백하면서 RegisterIndex 슬롯을 직접 사용 → 같은 프로그램 내 V2/V1 혼용 시 슬롯 분리. 결과적으로 schema 2 만 표기해도 V1 fallback op 가 있는 한 경고 잔존.

**해결**: 누락된 V2 핸들러를 모두 추가 (기존 FHktVar 빌더 메서드 합성).

##### 5.1 V2 핸들러 추가 (`HktStoryJsonParser::InitializeCoreCommandsV2`) ✅
- [x] `ReadProperty` ≡ `LoadStore`
- [x] `WriteProperty` ≡ `SaveStore`
- [x] `WriteConst` = LoadConst tmp + SaveStore
- [x] `LoadEntityProperty` ≡ `LoadStoreEntity`
- [x] `SaveEntityProperty` ≡ `SaveStoreEntity`
- [x] `AddImm` (FHktVar 오버로드 사용)
- [x] `IfEq/Ne/Lt/Le/Gt/Ge` (CmpXx + If 합성)
- [x] `IfEqConst..GeConst` (LoadConst tmp + CmpXx + If 합성)
- [x] `IfPropertyEq/Ne/Lt/Le/Gt/Ge` (LoadStoreEntity + LoadConst tmp + CmpXx + If 합성)
- [x] `MoveTowardProperty` (3 LoadStore + MoveToward block 합성 — V1 의 FHktScopedRegBlock 회피)

미보강 (필요 시 추가): `InteractTerrain` (BasicAttack 에서 사용 중 — V1 fallback 잔존, FHktVar 빌더 오버로드 추가 필요)

##### 5.2 5 root JSON 마이그레이션
- [x] `Story_WorldInit.json` — `"schema": 2`, R0/R1/R2 → `{"block":"spawnPos","index":N}`, ReadProperty → LoadStore, AddImm → V2, SetPosition `src` → `pos: {"block":"spawnPos"}`
- [x] `Story_NPCLifecycle.json` — `"schema": 2`, R0/R1 → `{"var":"isDead/modulus/rand"}` 의미적 명명, IfEqConst → V2 합성
- [x] `Story_MoveTo.json` — `"schema": 2` 만 표기 (레지스터 미사용; MoveTowardProperty 는 V2 합성 핸들러로 자연 해소)
- [x] `Story_BasicAttack.json` — 모든 R0/R1/R2 → 의미적 var 명 (`now/recovery/speed/rateNum/atk` 등). `InteractTerrain` 은 V1 fallback 유지 (단순 단발 op, ScopedReg 미사용 → 충돌 없음). **`damage_hittable_target_in_radius` Health=80 회귀 원인 = V1 builder 의 `IfHasTrait` 가 `FHktScopedReg` 로 R0 슬롯을 덮어써 AttackPower 를 0 으로 만들고 있었음. schema 2 마이그레이션으로 자연 해소.**
- [x] `Story_TargetAction.json` — 모든 R0~R4 → 의미적 var 명 (`itemId/itemState/dist/isNpc/item/range/now/nextFrame`). 위치 블록은 `{"block":"targetPos"}` (V1 의 R2/R3/R4 contiguous read 대체). `GetPosition` 은 `out: "targetPos"` 형식.
- [⏸️] `Story_PlayerInit.json` — schema 2 마이그레이션 시도 후 **롤백 (V1 schema 유지)**. 부팅 시 `AllocateViewsForEntity` 가 id=0 + anim tag 로 호출되는 회귀 발생. `Move dst=Self src=Spawned` + `SetStance/PlayVFXAttached/SetItemSkillTag` 등 presentation 사이드 이펙트가 V2 register coloring 의 pinned VReg 처리와 어떻게 상호작용하는지 추가 조사 필요. PlayerInit 은 세션 시작에 1 회만 실행 → REGFLOW 경고 무시 가능, 안정성 우선.

#### 6. 후속 검증 — Heal 회귀는 오진이었음
Phase 2d 종료 시 의심된 Heal V2 `partial_heal_under_max` 회귀는 **VM 회귀가 아닌 spec 셋업 누락**이었음 — `Param0` 은 entity 컬럼이 아닌 `Context.EventParam0` 에서 읽힘. `given.event` 블록 도입으로 자연 해소됨. Heal Story 자체는 cpp 정의로 정상 동작.

## Phase 2f (재정의) — precondition op-code JSON 화 + Combat/Item root JSON 신규

### 방향

원안(구 Phase 2d 잔여) 의 *cpp precondition 람다 분류 + CombatUseSkill V2 sidecar 변환* 은 Phase 2e 의 V2 sidecar 폐기 + V1 root JSON 진실원화 결정 이후 다음과 같이 재해석:

1. precondition 은 op-code 시퀀스 형식 JSON 으로 **모두 변환** (분류 후 skip 폐지). 단, 임의 C++ 로직(예: `IsValidEntity` 가드 같은 dispatcher 자동 가드 의존) 은 read-only op 시퀀스로 표현 가능한 범위만 작성.
2. CombatUseSkill + 5 Item* 는 root JSON 부재 상태였으므로 **신규 root JSON 작성** (schema 2). cpp 본문은 그대로 유지 — JSON 이 같은 base tag 로 등록되어 cpp 를 덮어쓴다 (`overwriting existing program (JSON override?)` 로그 정상).
3. JSON 진영을 schema 2 로 통일하면 V1/V2 혼용 슬롯 충돌이 사라져 PlayerInit 회귀도 자연 해소될 가설로 schema 2 재시도 — **재회귀** (아래 5 항목 참조).

### 인프라 — 코드 변경 0

precondition JSON 인프라는 Phase 2 이전부터 존재:

- 메타 키 `preconditions` 배열 — `HktStoryJsonParser::ParsePreconditions`
- 화이트리스트 `IsReadOnlyOp` (제어흐름 / 비교 / 산술 / `LoadStore*` / `IfPropertyXx` / `HasTag` / `GetDistance` / `GetWorldTime` / `RandomInt` / `CountByOwner` / `Log`)
- 빌더 `BeginPrecondition()` / `EndPrecondition()` — `PreconditionSection` 별도 `FCodeSection`
- VM `FHktVMInterpreter::ExecutePrecondition` — `Reg::Flag != 0` 결과 또는 `Fail` op 시 false. 1000 인스트럭션 상한.

작성 컨벤션:

```jsonc
"preconditions": [
  // ... read-only ops, 분기시 fail 라벨로 점프 ...
  { "op": "LoadConst", "dst": "Flag", "value": 1 },
  { "op": "Halt" },
  { "op": "Label", "name": "fail" },
  { "op": "Fail" }
]
```

### 1. 신규 root JSON 6개 ✅

| 파일 | precondition 본문 (요약) |
|---|---|
| `Story_CombatUseSkill.json` | `WorldTime < NextActionFrame(Self)` → fail. 본문: `SnippetCooldownCheck` + `WriteConst NextActionFrame 0x7FFFFFFF` 잠금 + 5 dispatch 분기(Fireball/Heal/Lightning/Buff + innate BasicAttack) + 인라인 일괄 데미지(AttackPower×2). |
| `Story_ItemDrop.json` | `OwnerEntity(Target) == Self`. 본문: ValidateOwnership + Active 였으면 ClearEquipSlot + RemoveItemStats + DropToGround. |
| `Story_ItemActivate.json` | `ItemState(Target)==1 && OwnerEntity(Target)==Self`. 본문: 동일 EquipIndex 충돌 아이템 evict 후 ActivateInSlot. |
| `Story_ItemDeactivate.json` | `ItemState(Target)==2 && OwnerEntity(Target)==Self`. 본문: ClearEquipSlot + DeactivateToBag + 다른 활성 아이템 탐색하여 Stance 복원/Unarmed. |
| `Story_ItemPickup.json` | `ItemState(Target)==0 && Distance≤300 && EquipSlot0..8 중 0 존재`. 본문: ValidateItemState + 거리 재검증 + FindEmptyEquipSlot + AssignOwnership + ActivateInSlot. |
| `Story_ItemTrade.json` | `Param0/Param1` 동적 entity, 양측 OwnerEntity / ItemState!=2. 본문: 동일 검증 후 OwnerEntity swap + ClearOwnerUid. |

ini / GameplayTag 등록 변경 없음 — 모든 storyTag 가 cpp `UE_DEFINE_GAMEPLAY_TAG_COMMENT` 으로 이미 등록.

### 2. PlayerInit schema 2 재시도 → 재롤백 ⏸️

JSON 진영 schema 통일 가설 검증 차원에서 schema 2 마이그레이션 재시도:

- `LoadStore R1/R2/R3 TargetPosX/Y/Z` → `{block:"spawnPos", index:0..2}` 명명 블록
- `SetPosition entity=Self src=R1` → `pos: {block:"spawnPos"}` V2 block 인자
- `CountByOwner dst=R0` → `{var:"itemCount"}` 의미적 var 명
- 다른 op 들은 register 인자 없거나 entity 슬롯 (Self/Spawned) 만 사용 → 문자열 그대로 유지

**결과: Phase 2e 5.2 와 동일한 회귀 재발** — character entity 의 tag 가 anim tag 로 잘못 분류되는 현상. `AllocateViewsForEntity id=0 + anim tag` 로그 패턴 동일.

가설("schema 2 통일이 V1/V2 슬롯 충돌을 해소") 은 **반증됨**. 회귀 원인은 V1/V2 혼용이 아닌 **V2 register coloring × presentation 사이드 이펙트의 단독 상호작용**으로 좁혀짐. 추가 조사 항목 (별도 단계):

- `Move dst=Self src=Spawned` 후 Self pinned VReg 가 후속 `SetStance/PlayVFXAttached/SetItemSkillTag` 의 entity 인자에서 어떻게 해소되는지 디스어셈블
- presentation 옵저버가 GameplayTag 컨테이너 → anim 매핑 시 어느 채널에서 잘못된 tag id 가 주입되는지 추적
- `TagToInt(SetItemSkillTag.SkillTag)` 와 anim tag id 공간 충돌 가능성 검사

PlayerInit 은 V1 schema 로 재롤백 (`Story_PlayerInit.json`). 게임플레이 무회귀 상태 유지. REGFLOW 경고는 잔존하지만 부팅 1회 실행이라 비치명적.

### 3. Spec 작성 ✅ (3/6 — 셋업 한계로 happy-path 일부 보류)

- [x] `Story_CombatUseSkill.spec.json` — innate dispatch (Param1 슬롯 미설정 → SnippetLoadItemFromSlot 실패 → DispatchEvent BasicAttack + Halt). `NextActionFrame=0x7FFFFFFF` 잠금 검증.
- [x] `Story_ItemPickup.spec.json` — happy path: Target=Ground, 거리 ≤300, 슬롯 0 비어있음 → ItemState=2.
- [x] `Story_ItemDrop.spec.json` — fail path: `OwnerEntity=0` (미설정) → SnippetValidateOwnership Fail.
- [⏸] ItemActivate/Deactivate/Trade happy-path + Pickup OwnerEntity 검증 — spec 의 given 이 entity id 동적 참조(`"OwnerEntity": "self"` 류)를 지원하지 않음. spec parser 확장 필요 → 별도 단계로 이관.

spec runner (`FHktStorySpecAutomationTest::RunTest`) 는 `ExecuteProgram` 직접 호출이라 **precondition 미실행**. main body 만 검증되며, precondition 구조 검증은 별도 `HktStoryIntegrityTests::RunPreconditionIntegrity` 가 담당.

## 본 작업 (Phase 2d 재정의) — 작업 리스트 [완료]

### 1. 스펙 스키마 확정 ✅

- [x] `HktGameplay/Content/Stories/SPEC.md` 작성 — given/events/expect 필드 카탈로그
- [x] PropertyId 참조 규칙 — **이름 문자열만** (uint16 직접 금지)
- [x] 엔티티 ref 표기 통일 — `self` / `target` / `entities[N]` (`spawned` 는 본 Phase 미사용)
- [x] 매처 시멘틱 명문화 — `tags` 부분 일치 / `tagsExact` 정확 / `tagsAbsent` 부재 / `properties` 정확

### 2. Spec 파서 ✅

- [x] `FHktStorySpecParser` 신설 — `HktAutomationTests` 모듈 (HktCore 순수성 보호)
- [x] `FHktStorySpec` / `FHktSpecScenario` / `FHktSpecGiven` / `FHktSpecEvent` / `FHktSpecMatcher` / `FHktSpecExpect` 구조체 (`HktStorySpecTypes.h`)
- [x] JSON → 구조체 변환 + scenario index / 키 위치 포함 에러 메시지
- [x] **런타임 TMap 0** — 출력은 `TArray<TPair>`, TMap 은 파서 내부 (load time) 중복 키 검출 한정

### 3. Spec 런너 (자동화 테스트 통합) ✅

- [x] `FHktStorySpecAutomationTest` (`IMPLEMENT_COMPLEX_AUTOMATION_TEST`) — `HktCore.Story.Spec.<TagN>.<NameN>` 동적 등록
- [x] given → WorldState 구성 (`AllocateEntity` + `SetProperty` + `AddTag`); 알 수 없는 PropertyId 즉시 fail
- [x] events → harness `Inject*` / `AdvanceTimerFrames` 디스패처
- [x] expect 매처 — `status` / `properties` / `tags` / `tagsExact` / `tagsAbsent`
- [x] 실패 diag prefix — `(파일명 scenario #i 'name')`
- [x] **Lazy 등록** — registry 가 이미 채워진 경우 `InitializeAllStories` 건너뛰어 "overwriting existing program" 로그 회피

### 4. Harness API 보강 ✅

- [x] `InjectAnimEndEvent()` — `AdvanceTimerFrames(SimFPS)` 위임. VM/EWaitEventType 변경 0
- [x] entity ref 해석 — RunTest 의 `ResolveRef` 람다 (`self`/`target`/`entities[N]`)
- (보류) `InjectCustomEvent` 일반화 — 현재 4종으로 충분

### 5. 선행 적용 ✅

- [x] `Movement/MoveStop.spec.json` — 1 시나리오 (StopMovement → IsMoving=0). MoveForce 는 안 건드리는 점 spec 에 반영
- [x] `Combat/Heal.spec.json` — 2 시나리오 (default + clamp). `partial_heal_under_max` 는 V2 회귀 의심으로 보류

### 6. 문서화 ✅

- [x] `Content/Stories/SCHEMA.md` 상단에 spec 사이드카 cross-reference
- [x] 본 문서의 종료 조건 + V2 prefix 정책 + Heal V2 회귀 단서 명시
- (생략) `CLAUDE.md` 1단락 — 사용자가 필요 시 추가

## 절대 금지 (위반 시 즉시 중단)

- 빌드 명령 (`Build.bat` / `msbuild` / `UnrealBuildTool`) — 사용자가 hot reload 로 검증
- VM 변경 (`HktCore/Private/VM/`) — 본 작업은 검증 인프라만 다룸
- 인스트럭션 인코딩 변경 (`FInstruction`)
- 기존 Equivalence 테스트 삭제 — Phase 2h 까지 안전망으로 유지
- cpp Story 본문 수정 (`Definitions/*.cpp`) — Phase 2g 이후 retarget 단계에서 다룸
- 코드/JSON 주석은 한국어

## 핵심 참조 파일

- `HktGameplay/Source/HktCore/Public/HktCoreProperties.h` — PropertyId 카탈로그
- `HktGameplay/Source/HktCore/Public/HktCoreArchetype.h` — 트레이트 정의
- `HktGameplay/Source/HktCore/Private/HktStoryJsonParser.cpp` — 본 시스템과 별도, 본문 파서 (참조용)
- `HktGameplay/Source/HktCore/Private/HktStoryJsonLoader.cpp` — 부팅 시 스캔 패턴 (Spec 런너가 유사 패턴 재사용)
- `HktGameplayDeveloper/Source/HktAutomationTests/Public/HktAutomationTestsHarness.h` — 실행/주입 API
- `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktStoryV2EquivalenceTest.cpp` — 기존 패턴 참고용 (삭제 금지)
- `Config/Tags/HktStoryTags.ini` — V2 tag 등록 (절대 경로: `E:/WS/UE5/HktProto/Config/Tags/HktStoryTags.ini`)

## 진행 방식

- 막히면 (스키마 모호, harness API 부재, JSON 파싱 한계) 즉시 멈추고 보고
- 추측 금지 — harness 헤더 / parser / loader 실제 코드 정독 후 결정
- 빌드/실행 시도 금지 — 사용자가 hot reload 후 직접 수행
- Spec 1~2개 통과 확인까지가 본 Phase 의 종료 조건. 32개 전체 spec 작성은 Phase 2e 로 분리

## Phase 2e 우선 조사 항목 — Heal V2 회귀 의심

Heal.spec.json 의 `partial_heal_under_max` 시나리오 (Param0=30, Health=100→예상 130) 가 실제 150 (= 100+50, 기본값 분기) 을 반환. V2 schema 2 의 `LoadStore Param0` + `CmpEqConst (amount==0)` 결합에서 비-0 Param0 가 0 으로 읽히는 회귀 의심.

근거:
- `default_amount_when_param0_zero` (Param0=0): 100+50=150 ✓ — Param0 값 무관하게 기본 분기로 같은 결과
- `clamp_to_maxhealth_on_overflow` (Param0=100): 180+50=230 → clamp 200 ✓ — Param0 가 0 으로 읽혀도 동일 결과 (우연의 통과)
- `partial_heal_under_max` (Param0=30): 100+50=150 ✗ — Param0 가 0 으로 읽힐 때만 설명 가능

기존 V2 equivalence 테스트가 모두 Param0=0 으로 한정되어 노출되지 않았던 케이스. spec 시스템이 의도한 대로 회귀를 노출. 본 시나리오는 Phase 2d 진행을 막지 않도록 일단 spec 에서 보류 — Phase 2e 첫 조사 항목으로 진단 후 복원.

## Phase 2d 종료 조건 (체크리스트)

- [x] `Content/Stories/SPEC.md` — 스펙 스키마 카탈로그
- [x] `Movement/MoveStop.spec.json` — sanity (1 시나리오)
- [x] `Combat/Heal.spec.json` — 분기 2개 + Timer wait 자동 진행 + tagsAbsent (2 시나리오, partial 보류)
- [x] `HktAutomationTestsHarness::InjectAnimEndEvent()` — VM 변경 없이 Timer 위임
- [x] `HktStorySpecParser` — JSON → 구조체, 런타임 TMap 0 (load time 한정)
- [x] `FHktStorySpecAutomationTest` (`IMPLEMENT_COMPLEX_AUTOMATION_TEST`) — Session Frontend `HktCore.Story.Spec.*` 자동 등록
- [x] `SCHEMA.md` cross-reference 추가
- [x] Lazy 등록으로 overwrite 로그 회피
- [x] **3/3 시나리오 통과 확인** — `MoveStop.moving_to_stopped`, `Heal.default_amount_when_param0_zero`, `Heal.clamp_to_maxhealth_on_overflow`

→ Phase 2d 종료. Phase 2e 진입 가능.

## 미해결 / 후속 이슈

1. **PlayerInit schema 2 회귀 (재현)** — Phase 2e 5.2 → Phase 2f 두 차례 시도 모두 동일 회귀(`AllocateViewsForEntity id=0 + anim tag`, character entity 의 tag 가 anim 로 분류). JSON 진영 schema 통일 가설로는 미해결 → V2 register coloring × presentation 사이드 이펙트 단독 상호작용으로 좁혀짐. 진단 항목: ① `Move dst=Self src=Spawned` 후 Self pinned VReg 의 후속 entity 인자 해소 디스어셈블, ② presentation tag → anim 매핑 채널 추적, ③ `TagToInt` id 공간 충돌. 별도 단계 (2g/2h 가 아닌 독립 진단).
2. **Item* spec happy-path 미작성 (4개)** — ItemActivate / ItemDeactivate / ItemTrade + Pickup 의 OwnerEntity 검증. spec 의 `given.entity.properties` 가 entity id 동적 참조를 지원하지 않아 `OwnerEntity = self.id` 셋업 불가. spec parser 확장 (`"OwnerEntity": {"ref":"self"}` 류) 필요 — 별도 PR.
3. **CombatUseSkill — 4 dispatch 분기 spec 미작성** — Fireball/Heal/Lightning/Buff 의 HasTag 분기 검증. Item entity + tag 셋업 + 슬롯 셋업이 필요 — Item* spec 와 동일 셋업 한계.
4. **Heal V2 회귀** (Phase 2d 종료 시점 의심) — Phase 2e 6 항에서 오진으로 확인. `Param0` 이 `Context.EventParam0` 에서 읽히는 점을 spec 의 `given.event` 블록 도입으로 해소. **종결**.
5. **Session Frontend 캐시** — spec 추가/제거 후 사용자가 "Refresh Tests" 클릭 필요. UE Automation 프레임워크 레벨이라 런너 코드로 우회 불가 — 가이드만 명시.
6. **`tagsExact` 의 역방향 검출** — 현재 명시 태그 부재만 검출, 추가 태그 검출은 미구현. WorldState 컨테이너 enumerate 헬퍼 추가 시 보강.
7. **`spawned` ref / `dispatched` 매처** — TargetAction 류 dispatcher Story 검증 시 필요. 32 Story 작업 중 출현 시점에 도입.

## V2 prefix 처리 (확정안 → 사실상 폐기)

Phase 2e 의 V2 sidecar 일괄 폐기 + base tag 통일로 `Story.V2.*` prefix 자체가 사라짐. spec storyTag 는 base tag (`Story.Event.Move.Stop`) 로 작성하며, 런너는 base tag 만 lookup 한다. Phase 2g 의 retarget 도 자연 해소 (cpp 가 base tag 점유, JSON 이 같은 base tag 로 덮어씀).

## 보고 형식 (한국어)

1. 스펙 스키마 확정안 — 필드 카탈로그
2. Parser / Runner 구조 (헤더 시그니처 발췌)
3. 보강된 harness API 목록
4. 작성된 spec 2개 본문
5. 검증 안내 — 사용자가 hot reload 후 Session Frontend 에서 `HktCore.Story.Spec.*` 일괄 실행
6. 후속 Phase (2e 이후) 진입 조건 체크리스트
