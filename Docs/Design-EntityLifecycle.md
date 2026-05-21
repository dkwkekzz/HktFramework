# Entity Lifecycle — VM 위 엔티티 수명 표현

본 문서는 [I-0034](intents/I-0034.md) 의 상세 구현·근거. 결정론 VM 위에서 엔티티의 *생애주기* (spawn → 상태 전이 → death → cleanup) 를 어떻게 표현하는지, 그리고 폴링 패턴이 왜 무너지는지·어떻게 대체하는지를 한 곳에 정리한다.

상위 의도 / 관련 문서:
- [I-0006 — 결정론적 시뮬레이션 시스템](intents/I-0006.md)
- [Runtime-Pipeline.md](Runtime-Pipeline.md)
- [PR-3-Phase2-Plan.md](PR-3-Phase2-Plan.md)
- [HktGameplay/Content/Stories/SCHEMA.md](../HktGameplay/Content/Stories/SCHEMA.md)

---

## 1. 무엇을 *Lifecycle* 이라 부르는가

`Story.Flow.<Domain>.<Entity>.Lifecycle` 패턴을 가진 Story 가 lifecycle 의 정의이다. 본 Story 는 *엔티티가 살아있는 동안 계속 도는* VM 한 슬롯을 점유한다.

| Story | 책임 |
|---|---|
| `Story.Flow.Natural.Birch.Lifecycle` | Birch 가 살아있는 동안 대기 → 사망 시 Branch 3 본 drop + SaplingSeed 디스패치 + DestroyEntity |
| `Story.Flow.Natural.Oak.Lifecycle` | Oak 동일 + LineageFelledCount 갱신 |
| `Story.Flow.NPC.Lifecycle` | NPC Brain 루프 — *매 프레임* `Yield 1` 후 ActionIntent 해석 (Attack / Move) + 사망 처리 |
| `Story.Flow.PlayerLifecycle` | 플레이어 동일 패턴 |

**두 부류로 나뉜다.**

1. **Sleeping lifecycle (Birch / Oak)** — 살아있는 동안은 *아무것도 하지 않는다*. 사망 이벤트만 기다린다.
2. **Brain lifecycle (NPC / Player)** — 매 프레임 의사결정. 단순 폴링이 아니라 *매 프레임 결정* 자체가 본질.

본 의도의 변경 대상은 1번. 2번은 매 프레임 의사결정이 본질이므로 그대로 둔다.

---

## 2. 폴링 패턴이 왜 무너지는가

### 2.1 변경 전 Birch_Lifecycle 패턴

```jsonc
{ "op": "Label", "name": "check" },
{ "op": "HasTag", "dst": {"var":"isDead"}, "entity": "Self", "tag": "StateDead" },
{ "op": "JumpIf", "cond": {"var":"isDead"}, "label": "die" },
{ "op": "WaitSeconds", "seconds": 1.0 },
{ "op": "Jump", "label": "check" },
```

`WaitSeconds` 는 `EVMStatus::Yielded` 로 진입한다. VM 슬롯은 **점유 유지**. cleanup 은 `Completed / Failed` 만 회수한다.

### 2.2 슬롯 단조 증가

청크 로드마다 `Story.Flow.Spawner.Natural.Birch` 이벤트가 디스패치되어 Birch 1 본당 lifecycle VM 1 개가 생성된다. 죽기 전까지는 회수되지 않는다.

```
프레임 N    : Birch_Lifecycle × K (K = 살아있는 Birch 수)
프레임 N+1  : Birch_Lifecycle × (K + ΔSpawn)
…
```

청크가 N 개 로드되면 ≈ `N × density × lifecycle_count` 슬롯이 점유된다. 풀 상한에 도달하는 순간:

```
W LogHktCore: VM Build: Pool exhausted
HKT_VM_EVENT_RECORD_EVENT(..., Discarded, ..., "PoolExhausted")
```

이후 도착한 모든 spawner / 전투 이벤트가 **silent drop**. 게임 상태는 *결정론적으로* 망가진다 (drop 자체는 결정론 입력에 종속).

### 2.3 풀 상한 자체의 하드코드 문제

부수적으로 발견된 일관성 결함:

- `HktSimulationLimits.h::MaxVMs = 512`
- `FHktVMRuntimePool` 내부: `static constexpr int32 MaxVMs = 256`

상수가 두 곳에 분리 정의되어 512 를 의도했지만 실제 풀은 256 으로 동작. 단순 오타급의 누수.

---

## 3. 해결 전략 — 3 축 동시

### 축 A. *깨우기 채널* 도입 — 폴링을 폐지

새 opcode `WaitTag(WatchEntity, Tag)` 와 `EWaitEventType::TagAdded`. WaitTag 진입 시 VM 은 `EVMStatus::WaitingEvent` 로 진입하고 슬롯은 살아있되 **매 프레임 polling 비용이 ~0**.

매칭 정책 — `VMProcessSystem` 이 매 프레임 `Pool.ForEachActive` 안에서 `WaitingEvent + Type == TagAdded` 인 VM 에 대해:

```cpp
const FGameplayTagContainer& Tags = WorldState.GetTagsBySlot(Slot);
if (Tags.HasTag(Runtime.EventWait.WatchedTag))  // 계층 매칭
    Runtime.Status = EVMStatus::Ready;
```

다른 Wait 류 (Collision / MoveEnd / Grounded) 와 달리 **ScratchEvents 큐를 거치지 않는다**. 이유:

- 태그 부여는 `VMProxy::AddTag` 한 곳이지만 호출 지점이 매우 많다 (Op_AddTag, SpawnEntity ClassTag, VMCleanupSystem, 외부 입력…). 채널 1 곳으로 모으려면 모든 호출 지점에 emit 코드를 흩뿌려야 함.
- WorldState 의 태그 컨테이너 자체가 진실의 단일 출처. 그것을 polling 하면 *누락 가능성 0*.
- `WaitingEvent` VM 수는 lifecycle 등 소수. polling 비용은 N\_wait × |TagContainer| 정도로 작다.

`WatchedEntity` 가 사라지면 `EVMStatus::Failed` 로 전이. 영원히 wake 불가능한 상태를 빠르게 cleanup 한다.

### 축 B. *풀 자체* 의 동적 확장

`FHktVMRuntimePool` 은 하드코드 정적 배열 → 동적 grow.

```
InitialVMPoolCapacity = 64        // 부팅 시 SetNum
MaxVMPoolCapacity     = 1024      // hard cap (FHktVMHandle.Index 가 24-bit 이므로 안전)
```

`Allocate()` 가 FreeSlots 비면 `GrowOneSlot()` 으로 한 슬롯씩 push. hard cap 초과 시 Invalid 반환.

이는 *축 A 의 안전망*. WaitTag 가 슬롯 점유는 유지하므로 *콘텐츠가 늘면 풀도 늘어야* 한다. 결정론 입력(핸들 Index 가 직렬화 / 스냅샷에 포함) 이므로 상한은 헤더 상수로 고정 — CVar 미사용.

`Reserve(MaxVMPoolCapacity)` 로 grow 중 realloc 빈도를 줄인다 (SOA 배열 6개의 동시 capacity 확보).

### 축 C. *백프레셔* — 포화 시 spawner 류 먼저 차단

```cpp
SpawnerBackpressureSoftCap = MaxVMPoolCapacity * 3 / 4   // 768
```

`FHktVMBuildSystem::Process` 진입부에서:

```cpp
if (Pool.GetUsage() >= SoftCap && EventTag.MatchesTag(Story.Flow.Spawner.Natural))
    continue;  // drop, reason = "PoolPressureDrop"
```

핵심 게임플레이 이벤트(전투 / 인터랙션) 는 hard cap 까지 grow 로 흡수. 청크 로드마다 폭증하는 spawner 류만 차단해 lifecycle / 전투 VM 의 슬롯을 보호한다.

`Story.Flow.Spawner.Natural` 는 native tag 로 신규 등록. 계층 매칭(`MatchesTag`) 으로 `Story.Flow.Spawner.Natural.Birch/Oak/Tree/Slime` 모두를 포괄.

---

## 4. 결정론 / 직렬화 영향

### 4.1 직렬화 포맷 변경

`FHktVMSnapshot` 에 `FGameplayTag WaitWatchedTag` 추가:

```cpp
Ar << S.WaitType << S.WaitWatchedEntity << S.WaitRemainingFrames;
Ar << S.WaitWatchedTag;  // NEW
```

`CaptureVMSnapshots` / `RehydrateVMPool` 도 함께 갱신. **기존 saved state (replay / late-join 캡처) 는 무효화** — 새로 캡처해야 한다.

### 4.2 핸들 안정성

`MaxVMPoolCapacity = 1024` 는 `FHktVMHandle.Index` 의 24-bit 범위 내. 직렬화·hash 안정성에 영향 없다.

### 4.3 백프레셔의 결정성

drop 자체가 입력의 일부 (`FHktSimulationEvent.NewEvents` 의 어느 항목을 build 단계가 받아주는가). 서버·클라이언트 양쪽이 동일한 `Pool.GetUsage()` 값을 갖는 한 동일하게 drop. 결정론 보존.

서버·클라이언트의 풀 상태가 분기되면 결정성이 깨질 수 있으나, `FHktWorldDeterminismSimulator` 의 단일 권위 입력 모델 안에서는 양쪽이 같은 이벤트 순서를 받는다 → 같은 풀 상태 → 같은 drop. PR-? 의 미드조인 복원 경로(`RehydrateVMPool`) 에서도 ActiveVMSnapshots 가 풀 상태를 그대로 재현하므로 분기 위험 없음.

---

## 5. Story 작성 가이드

### 5.1 Sleeping lifecycle — WaitTag 사용

```jsonc
{ "op": "WaitTag", "entity": "Self", "tag": "StateDead" },
// 깨어남 → 죽음 처리 절차
```

기존 폴링 5줄을 1줄로 대체. `tag` 는 schema 2 의 tag alias (`tags: { "StateDead": "State.Dead" }`) 사용 권장.

계층 매칭이므로 `tag: "State"` 로 두면 `State.Dead`, `State.Stunned`, `State.Frozen` 등 어느 상태가 부여되어도 wake. 보수적으로는 leaf 태그를 명시.

### 5.2 Brain lifecycle — 그대로 둔다

NPC / Player Lifecycle 처럼 매 프레임 의사결정이 본질이면 `Yield 1` 폴링을 유지. 단, 본 패턴의 VM 수는 *active entity 수 * 1* 로 풀 사용량에 직접 비례한다 — Brain 류가 늘어나면 `MaxVMPoolCapacity` 를 검토.

### 5.3 ScratchEvents 채널 vs polling 채널

| 채널 | 출처 | 매칭 비용 | 신규 추가 비용 |
|---|---|---|---|
| ScratchEvents 큐 (Collision/MoveEnd/Grounded) | Physics / Movement 시스템이 explicit emit | N\_wait × N\_events | Producer 측에 emit 코드 추가 필수 |
| WorldState polling (TagAdded) | WorldState 의 태그 컨테이너 자체 | N\_wait × \|TagContainer\| | 신규 채널 추가 없음 |

신규 Wait 류 opcode 를 도입할 때 — *진실의 단일 출처가 WorldState 안에 있는가* 를 기준으로 선택. PropertyId 값 변화 대기, 위치 변화 대기 등도 동일 polling 패턴이 적용 가능.

---

## 6. 변경된 파일 (참고)

| 파일 | 변경 |
|---|---|
| `HktCore/Private/HktSimulationLimits.h` | MaxVMs 삭제 → Initial/Max/Soft 분할 |
| `HktCore/Private/VM/HktVMRuntime.h/.cpp` | 동적 grow + GetCapacity/GetUsage + WatchedTag |
| `HktCore/Private/VM/HktVMTypes.h` | `EWaitEventType::TagAdded` |
| `HktCore/Private/VM/HktVMInterpreter.h/.cpp` | `Op_WaitTag` + precondition skip |
| `HktCore/Private/HktSimulationSystems.cpp` | VMProcessSystem TagAdded polling + VMBuildSystem 백프레셔 |
| `HktCore/Public/HktCoreEvents.h` | `FHktVMSnapshot::WaitWatchedTag` + 직렬화 |
| `HktCore/Public/HktStoryTypes.h` | OpCode list `WaitTag` |
| `HktCore/Public/HktCoreTags.h/.cpp` | `HktNaturalStoryTags::SpawnerNaturalRoot` |
| `HktCore/Private/HktStoryBuilder.cpp` / `HktCore/Public/HktStoryBuilder.h` | `WaitTag` 빌더 (RegisterIndex / FHktVar 양쪽) |
| `HktCore/Private/HktStoryJsonParser.cpp` | `"WaitTag"` 등록 |
| `HktCore/Private/HktStoryValidator.cpp` | WaitTag 케이스 |
| `HktCore/Public/HktVMEventRecorder.h` | `GetHktPendingTypeName` TagAdded |
| `HktCore/Private/HktWorldDeterminismSimulator.cpp` | Capture/Rehydrate WatchedTag, MaxVMs → MaxVMPoolCapacity |
| `HktGameplay/Content/Stories/Natural/Birch/Birch_Lifecycle.json` (+ spec) | WaitTag 1 줄 |
| `HktGameplay/Content/Stories/Natural/Oak/Oak_Lifecycle.json` (+ spec) | WaitTag 1 줄 |

---

## 7. TODO

- NPC / Player Lifecycle 의 Brain 루프 비용 측정 — 슬롯 수가 동시 active entity 수와 1:1. `MaxVMPoolCapacity = 1024` 충분 여부.
- `WaitTag` 의 *부정형* (`UntilTagRemoved`) — 현재 미지원. 죽었다 살아나는 패턴(Respawn) 에 필요해질 수 있음.
- `WaitProperty(Entity, Prop, CmpOp, Value)` — PropertyId polling 의 일반화. 본 PR 범위 밖.
- 백프레셔의 root tag 가 자연 spawner 한정 — 일반 `Story.Flow.Spawner` root 로 확대할지는 다른 spawner 도입 시 재검토.
